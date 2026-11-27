from typing import Literal

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, Query, Request, Response, UploadFile, status

from app.api.deps import AdminSessionDep, DbDep, SettingsDep, client_ip
from app.api.photo_io import remove_photo, replace_photo, serve_photo
from app.core.config import get_settings
from app.core.ratelimit import limiter
from app.models import Profile
from app.schemas.admin import (
    AdminLoginIn,
    AdminMeOut,
    AuditRow,
    DeleteIn,
    OverviewOut,
    PasswordChangeIn,
    PinResetOut,
    ProfileAdminOut,
    ProfilePage,
    ProfileUpdateIn,
)
from app.security.hashing import hash_secret, verify_secret
from app.services import admin_profiles as svc
from app.services.activity import log_event
from app.services.geocode import geocode_in_background, geocode_profile
from app.services.admin_auth import AdminDenied, authenticate_admin, end_admin_session, start_admin_session

router = APIRouter(prefix="/admin", tags=["admin"])


# ---------------------------------------------------------------- auth

@router.post("/login", response_model=AdminMeOut)
@limiter.limit(get_settings().login_rate_limit)
def admin_login(request: Request, response: Response, body: AdminLoginIn, db: DbDep, settings: SettingsDep):
    try:
        admin = authenticate_admin(db, settings, body.username.strip(), body.password, client_ip(request))
    except AdminDenied:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "INVALID CREDENTIALS") from None
    token = start_admin_session(db, settings, admin, client_ip(request))
    response.set_cookie(
        key=settings.admin_cookie_name,
        value=token,
        max_age=settings.admin_session_minutes * 60,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/api/admin",
    )
    return AdminMeOut(username=admin.username, role=admin.role)


@router.get("/me", response_model=AdminMeOut)
def admin_me(sess: AdminSessionDep):
    return AdminMeOut(username=sess.admin.username, role=sess.admin.role)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def admin_logout(request: Request, db: DbDep, settings: SettingsDep) -> Response:
    end_admin_session(db, request.cookies.get(settings.admin_cookie_name))
    resp = Response(status_code=status.HTTP_204_NO_CONTENT)
    resp.delete_cookie(settings.admin_cookie_name, path="/api/admin", secure=settings.cookie_secure,
                       httponly=True, samesite=settings.cookie_samesite)
    return resp


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(request: Request, body: PasswordChangeIn, sess: AdminSessionDep, db: DbDep) -> Response:
    admin = sess.admin
    if not verify_secret(admin.password_hash, body.current_password):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "CURRENT PASSWORD INCORRECT")
    admin.password_hash = hash_secret(body.new_password)
    log_event(db, event="Admin password changed", category="ADMIN", actor=f"admin:{admin.username}", ip=client_ip(request))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------- overview / audit

@router.get("/overview", response_model=OverviewOut)
def get_overview(_: AdminSessionDep, db: DbDep):
    return svc.overview(db)


@router.get("/audit", response_model=list[AuditRow])
def get_audit(_: AdminSessionDep, db: DbDep, limit: int = Query(100, ge=1, le=500)):
    return svc.audit(db, limit)


# ---------------------------------------------------------------- profiles

def _get_or_404(db: DbDep, project_id: str) -> Profile:
    p = svc.get_by_pid(db, project_id)
    if p is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "PROFILE NOT FOUND")
    return p


def _actor(sess: AdminSessionDep) -> str:
    return f"admin:{sess.admin.username}"


@router.get("/profiles", response_model=ProfilePage)
def list_profiles(
    _: AdminSessionDep,
    db: DbDep,
    q: str = Query("", max_length=120),
    access: Literal["ACTIVE", "SUSPENDED", "REVOKED"] | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
):
    rows, total = svc.search(db, q, access, page, page_size)
    return ProfilePage(items=[svc.to_row(p) for p in rows], total=total, page=page, page_size=page_size)


@router.get("/profiles/{project_id}", response_model=ProfileAdminOut)
def get_profile(project_id: str, sess: AdminSessionDep, db: DbDep):
    return svc.to_admin_out(_get_or_404(db, project_id))


@router.patch("/profiles/{project_id}", response_model=ProfileAdminOut)
def update_profile(project_id: str, body: ProfileUpdateIn, request: Request, sess: AdminSessionDep, db: DbDep,
                   settings: SettingsDep, background: BackgroundTasks):
    p = _get_or_404(db, project_id)
    changed = svc.apply_update(p, body)
    moved = "location:moved" in changed
    changed = [c for c in changed if c != "location:moved"]
    if moved:
        background.add_task(geocode_in_background, settings, p.id)
    if changed:
        log_event(db, event=f"Profile edited by admin ({', '.join(changed)})", category="ADMIN",
                  actor=_actor(sess), profile_id=p.id, source="ADMIN", ip=client_ip(request))
    db.commit()
    db.refresh(p)
    return svc.to_admin_out(p)


@router.get("/profiles/{project_id}/photo")
def admin_get_photo(project_id: str, _: AdminSessionDep, db: DbDep, settings: SettingsDep):
    return serve_photo(_get_or_404(db, project_id), settings)


@router.put("/profiles/{project_id}/photo", response_model=ProfileAdminOut)
async def admin_replace_photo(project_id: str, request: Request, sess: AdminSessionDep, db: DbDep,
                              settings: SettingsDep, file: UploadFile = File(...)):
    p = _get_or_404(db, project_id)
    await replace_photo(p, file, settings)
    log_event(db, event="Profile photo replaced by admin", category="ADMIN", actor=_actor(sess), profile_id=p.id,
              source="ADMIN", ip=client_ip(request))
    db.commit()
    return svc.to_admin_out(p)


@router.delete("/profiles/{project_id}/photo", response_model=ProfileAdminOut)
def admin_remove_photo(project_id: str, request: Request, sess: AdminSessionDep, db: DbDep, settings: SettingsDep):
    p = _get_or_404(db, project_id)
    remove_photo(p, settings)
    log_event(db, event="Profile photo removed by admin", category="ADMIN", actor=_actor(sess), profile_id=p.id,
              source="ADMIN", ip=client_ip(request))
    db.commit()
    return svc.to_admin_out(p)


@router.post("/profiles/{project_id}/geocode", response_model=ProfileAdminOut)
def regeocode(project_id: str, request: Request, sess: AdminSessionDep, db: DbDep, settings: SettingsDep):
    """Re-run geocoding now (e.g. after Nominatim was unreachable)."""
    p = _get_or_404(db, project_id)
    if not settings.geocoder_enabled:
        raise HTTPException(status.HTTP_409_CONFLICT, "GEOCODER DISABLED")
    geocode_profile(db, settings, p)
    log_event(db, event="Geocoding re-run by admin", category="ADMIN", actor=_actor(sess), profile_id=p.id,
              source="ADMIN", ip=client_ip(request))
    db.commit()
    db.refresh(p)
    return svc.to_admin_out(p)


# reset-pin must be registered before the generic /{action} route.
@router.post("/profiles/{project_id}/reset-pin", response_model=PinResetOut)
def reset_pin(project_id: str, request: Request, sess: AdminSessionDep, db: DbDep):
    p = _get_or_404(db, project_id)
    pin = svc.reset_pin(p)
    svc.end_all_sessions(db, p.id)
    log_event(db, event="Access PIN reset by admin", category="ADMIN", actor=_actor(sess), profile_id=p.id,
              source="ADMIN", ip=client_ip(request))
    db.commit()
    return PinResetOut(project_id=p.project_id, new_pin=pin)


@router.post("/profiles/{project_id}/{action}", response_model=ProfileAdminOut)
def access_action(
    project_id: str,
    action: Literal["suspend", "reactivate", "revoke", "unlock"],
    request: Request,
    sess: AdminSessionDep,
    db: DbDep,
):
    p = _get_or_404(db, project_id)
    try:
        svc.set_access(db, p, action)
    except svc.NotAllowed as e:
        raise HTTPException(status.HTTP_409_CONFLICT, str(e)) from None
    log_event(db, event=f"Access {action} by admin", category="ADMIN", actor=_actor(sess), profile_id=p.id,
              source="ADMIN", status="WARN" if action in ("suspend", "revoke") else "OK", ip=client_ip(request))
    db.commit()
    db.refresh(p)
    return svc.to_admin_out(p)


@router.delete("/profiles/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_profile(project_id: str, body: DeleteIn, request: Request, sess: AdminSessionDep, db: DbDep,
                   settings: SettingsDep) -> Response:
    if sess.admin.role != "owner":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "OWNER ROLE REQUIRED")
    p = _get_or_404(db, project_id)
    if body.confirm != p.project_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "CONFIRMATION DOES NOT MATCH PROJECT ID")
    remove_photo(p, settings)
    svc.delete_profile(db, p)
    log_event(db, event=f"Profile {project_id} deleted by admin", category="ADMIN", actor=_actor(sess),
              source="ADMIN", status="WARN", ip=client_ip(request))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
