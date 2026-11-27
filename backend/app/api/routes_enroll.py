from fastapi import APIRouter, BackgroundTasks, Request, Response

from app.api.deps import DbDep, SettingsDep, client_ip
from app.api.routes_auth import set_client_cookie
from app.core.config import get_settings
from app.core.ratelimit import limiter
from app.schemas.enroll import EnrollIn, EnrollOut
from app.services.client_auth import start_session
from app.services.enroll import create_profile
from app.services.geocode import geocode_in_background

router = APIRouter(tags=["enrolment"])


@router.post("/enroll", response_model=EnrollOut, status_code=201)
@limiter.limit(get_settings().enroll_rate_limit)
def enroll(request: Request, response: Response, body: EnrollIn, db: DbDep, settings: SettingsDep,
           background: BackgroundTasks):
    """Self-service: the owner creates their own profile and is signed straight in."""
    ip = client_ip(request)
    profile = create_profile(db, body, ip)
    db.commit()
    set_client_cookie(response, settings, start_session(db, settings, profile, ip))
    # Resolve coordinates after responding (Nominatim is rate-limited to 1 req/s).
    background.add_task(geocode_in_background, settings, profile.id)
    return EnrollOut(project_id=profile.project_id, display_name=profile.full_name)
