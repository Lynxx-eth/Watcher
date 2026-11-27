from fastapi import APIRouter, HTTPException, Request, Response, status

from app.api.deps import ClientSessionDep, DbDep, SettingsDep, client_ip
from app.core.config import Settings, get_settings
from app.core.ratelimit import limiter
from app.schemas.auth import ClientLoginIn, SessionOut
from app.services.activity import log_event
from app.services.client_auth import AccessDenied, authenticate, end_session, start_session

router = APIRouter(prefix="/auth", tags=["client-auth"])


def set_client_cookie(response: Response, settings: Settings, token: str) -> None:
    response.set_cookie(
        key=settings.client_cookie_name,
        value=token,
        max_age=settings.client_session_hours * 3600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/api",
    )


def _session_out(project_id: str, full_name: str) -> SessionOut:
    return SessionOut(project_id=project_id, display_name=full_name)


@router.post("/client", response_model=SessionOut)
@limiter.limit(get_settings().login_rate_limit)
def client_login(request: Request, response: Response, body: ClientLoginIn, db: DbDep, settings: SettingsDep):
    ip = client_ip(request)
    try:
        profile = authenticate(db, settings, body.project_id, body.pin, ip)
    except AccessDenied:
        # One message for every failure: unknown ID, wrong PIN, locked, suspended.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "ACCESS DENIED") from None

    set_client_cookie(response, settings, start_session(db, settings, profile, ip))
    return _session_out(profile.project_id, profile.full_name)


@router.get("/me", response_model=SessionOut)
def whoami(sess: ClientSessionDep):
    return _session_out(sess.profile.project_id, sess.profile.full_name)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, db: DbDep, settings: SettingsDep) -> Response:
    end_session(db, request.cookies.get(settings.client_cookie_name))
    log_event(db, event="Session closed", category="AUTH", actor="client", ip=client_ip(request))
    db.commit()
    resp = Response(status_code=status.HTTP_204_NO_CONTENT)
    resp.delete_cookie(settings.client_cookie_name, path="/api", secure=settings.cookie_secure,
                       httponly=True, samesite=settings.cookie_samesite)
    return resp
