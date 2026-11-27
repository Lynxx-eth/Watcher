from datetime import date, datetime

from app.schemas.common import CamelModel


class GeoOut(CamelModel):
    lat: float
    lon: float
    source: str


class LocationOut(CamelModel):
    country: str
    region: str | None = None
    city: str
    address: str | None = None  # only present when the owner chose to show it
    postal_code: str | None = None
    geo: GeoOut | None = None


class BiometricsOut(CamelModel):
    facial: str
    fingerprint: str
    iris: str
    dna: str


class ProfileOut(CamelModel):
    """The owner's own profile. Never returned for any other profile."""

    project_id: str
    full_name: str
    date_of_birth: date | None
    nationality: str
    gender: str | None
    photo_url: str | None
    title: str
    classification: str
    threat_level: str
    watchlist_status: str
    risk_score: int
    priority: str
    description: str
    case_notes: list[str]
    biometrics: BiometricsOut | None
    location: LocationOut | None
    access: str
    is_demo: bool
    created_at: datetime
    updated_at: datetime
