"""
Server-side geocoding via OpenStreetMap Nominatim.

Usage policy (https://operations.osmfoundation.org/policies/nominatim/):
max 1 request/second, an identifying User-Agent, and cache results — so
calls are serialised and throttled here, results are stored on the profile,
and repeat queries are served from an in-process cache.

Coordinates are only ever written from a real geocoder response. On failure
the profile records the attempt (geocoded_at) with lat/lon left empty, and the
UI shows "location unavailable".
"""

import threading
import time
from collections import OrderedDict
from dataclasses import dataclass

import httpx
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models import Profile
from app.models._time import utcnow
from app.services.activity import log_event


@dataclass(frozen=True)
class GeoResult:
    lat: float
    lon: float
    label: str
    precision: str  # "address" | "city" | "country"


_lock = threading.Lock()
_last_call = 0.0
_cache: "OrderedDict[str, GeoResult | None]" = OrderedDict()
_CACHE_MAX = 512


def _nominatim(settings: Settings, query: str) -> GeoResult | None:
    """One throttled Nominatim lookup. Returns None on no-match or error."""
    global _last_call
    key = query.lower().strip()
    if key in _cache:
        _cache.move_to_end(key)
        return _cache[key]

    with _lock:
        wait = 1.05 - (time.monotonic() - _last_call)
        if wait > 0:
            time.sleep(wait)
        try:
            r = httpx.get(
                settings.geocoder_url,
                params={"q": query, "format": "jsonv2", "limit": 1, "addressdetails": 0},
                headers={"User-Agent": settings.geocoder_user_agent, "Accept-Language": "en"},
                timeout=settings.geocoder_timeout_s,
            )
            r.raise_for_status()
            data = r.json()
        except (httpx.HTTPError, ValueError):
            return None  # network/HTTP/JSON error → not cached, so it can be retried later
        finally:
            _last_call = time.monotonic()

    result: GeoResult | None = None
    if isinstance(data, list) and data:
        hit = data[0]
        try:
            lat, lon = float(hit["lat"]), float(hit["lon"])
            if -90 <= lat <= 90 and -180 <= lon <= 180:
                result = GeoResult(lat=lat, lon=lon, label=str(hit.get("display_name", ""))[:200], precision="")
        except (KeyError, TypeError, ValueError):
            result = None
    _cache[key] = result
    if len(_cache) > _CACHE_MAX:
        _cache.popitem(last=False)
    return result


# Replaced in tests so no network calls are made.
provider = _nominatim


def candidate_queries(country: str, region: str | None, city: str, address: str | None, postal: str | None):
    """Most specific first: full address → city/region/country → city/country → country."""
    parts = lambda *xs: ", ".join(x.strip() for x in xs if x and x.strip())  # noqa: E731
    out = []
    if address:
        out.append((parts(address, city, postal, region, country), "address"))
    out.append((parts(city, region, country), "city"))
    if region:
        out.append((parts(city, country), "city"))
    out.append((parts(country), "country"))
    seen, uniq = set(), []
    for q, prec in out:
        if q and q not in seen:
            seen.add(q)
            uniq.append((q, prec))
    return uniq


def geocode_profile(db: Session, settings: Settings, p: Profile) -> bool:
    """Resolve and store coordinates for a profile's location. Returns True if located."""
    loc = p.location
    if loc is None or not settings.geocoder_enabled:
        return False
    found: GeoResult | None = None
    for query, precision in candidate_queries(loc.country, loc.region, loc.city, loc.address, loc.postal_code):
        r = provider(settings, query)
        if r:
            found = GeoResult(r.lat, r.lon, r.label, precision)
            break
    loc.geocoded_at = utcnow()
    if found:
        loc.lat, loc.lon = found.lat, found.lon
        loc.geo_source = f"nominatim:{found.precision}"
        log_event(db, event=f"Location resolved ({found.precision} level)", category="GEO", profile_id=p.id)
    else:
        loc.lat = loc.lon = None
        loc.geo_source = None
        log_event(db, event="Location could not be resolved", category="GEO", profile_id=p.id, status="WARN")
    db.commit()
    return found is not None


def geocode_in_background(settings: Settings, profile_id: int) -> None:
    """For FastAPI BackgroundTasks: uses its own DB session."""
    from app.database.session import SessionLocal

    with SessionLocal() as db:
        p = db.get(Profile, profile_id)
        if p is not None:
            geocode_profile(db, settings, p)
