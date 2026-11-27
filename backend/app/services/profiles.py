from app.models import Profile
from app.schemas.profile import BiometricsOut, GeoOut, LocationOut, ProfileOut


def to_profile_out(p: Profile) -> ProfileOut:
    loc = p.location
    location = None
    if loc is not None:
        geo = (
            GeoOut(lat=loc.lat, lon=loc.lon, source=loc.geo_source or "unknown")
            if loc.lat is not None and loc.lon is not None
            else None
        )
        location = LocationOut(
            country=loc.country,
            region=loc.region,
            city=loc.city,
            address=loc.address if loc.show_address else None,
            postal_code=loc.postal_code if loc.show_address else None,
            geo=geo,
        )
    bio = p.biometrics
    return ProfileOut(
        project_id=p.project_id,
        full_name=p.full_name,
        date_of_birth=p.date_of_birth,
        nationality=p.nationality,
        gender=p.gender,
        # Photos are served through an authorised route (Phase 6), never a public path.
        # Versioned by key so a replaced photo isn't served from cache.
        photo_url=f"/api/profile/me/photo?v={p.photo_key[:8]}" if p.photo_key else None,
        title=p.title,
        classification=p.classification,
        threat_level=p.threat_level,
        watchlist_status=p.watchlist_status,
        risk_score=p.risk_score,
        priority=p.priority,
        description=p.description,
        case_notes=[n.body for n in p.notes],
        biometrics=BiometricsOut(facial=bio.facial, fingerprint=bio.fingerprint, iris=bio.iris, dna=bio.dna)
        if bio
        else None,
        location=location,
        access=p.access_status,
        is_demo=p.is_demo,
        created_at=p.created_at,
        updated_at=p.updated_at,
    )
