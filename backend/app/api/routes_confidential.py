from fastapi import APIRouter, HTTPException, Request, status

from app.api.deps import ClientSessionDep, DbDep, SettingsDep, client_ip
from app.core.config import get_settings
from app.core.ratelimit import limiter
from app.models._time import as_utc
from app.schemas.confidential import ConfidentialProfile, ConfidentialStatus, UnlockIn
from app.services import confidential as svc

router = APIRouter(prefix="/confidential", tags=["confidential"])


@router.post("/unlock", response_model=ConfidentialStatus)
@limiter.limit(get_settings().login_rate_limit)
def unlock(request: Request, body: UnlockIn, sess: ClientSessionDep, db: DbDep, settings: SettingsDep):
    try:
        svc.unlock(db, settings, sess, body.project_id, body.pin, client_ip(request))
    except svc.VerificationFailed:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "VERIFICATION FAILED") from None
    return ConfidentialStatus(unlocked=True, expires_at=as_utc(sess.confidential_until))


@router.get("/status", response_model=ConfidentialStatus)
def status_(sess: ClientSessionDep):
    on = svc.is_unlocked(sess)
    return ConfidentialStatus(unlocked=on, expires_at=as_utc(sess.confidential_until) if on else None)


@router.post("/lock", response_model=ConfidentialStatus)
def lock(sess: ClientSessionDep, db: DbDep):
    svc.lock(db, sess)
    return ConfidentialStatus(unlocked=False, expires_at=None)


@router.get("/profile", response_model=ConfidentialProfile)
def confidential_profile(sess: ClientSessionDep):
    if not svc.is_unlocked(sess):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "CONFIDENTIAL ACCESS REQUIRED")
    return svc.confidential_profile(sess)
