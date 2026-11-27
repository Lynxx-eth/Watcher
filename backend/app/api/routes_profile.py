from fastapi import APIRouter, File, Query, Request, UploadFile

from app.api.deps import ClientSessionDep, DbDep, SettingsDep, client_ip
from app.api.photo_io import remove_photo, replace_photo, serve_photo
from app.services.activity import log_event
from app.schemas.activity import ActivityOut, StatsOut
from app.schemas.profile import ProfileOut
from app.services.profiles import to_profile_out
from app.services.stats import profile_stats, recent_activity

router = APIRouter(prefix="/profile", tags=["profile"])

# Every route here is scoped to the session's own profile.
# There is deliberately no /profile/{id} route.


@router.get("/me", response_model=ProfileOut)
def my_profile(sess: ClientSessionDep):
    return to_profile_out(sess.profile)


@router.get("/me/activity", response_model=list[ActivityOut])
def my_activity(sess: ClientSessionDep, db: DbDep, days: int = Query(30, ge=1, le=90)):
    return recent_activity(db, sess.profile_id, days=days)


@router.get("/me/stats", response_model=StatsOut)
def my_stats(sess: ClientSessionDep, db: DbDep):
    return profile_stats(db, sess.profile)


# ---------------------------------------------------------------- photo (owner)

@router.get("/me/photo")
def my_photo(sess: ClientSessionDep, settings: SettingsDep):
    return serve_photo(sess.profile, settings)


@router.post("/me/photo", response_model=ProfileOut)
async def upload_my_photo(request: Request, sess: ClientSessionDep, db: DbDep, settings: SettingsDep,
                          file: UploadFile = File(...)):
    p = sess.profile
    await replace_photo(p, file, settings)
    log_event(db, event="Profile photo updated", category="PROFILE", actor="client", profile_id=p.id,
              ip=client_ip(request))
    db.commit()
    return to_profile_out(p)


@router.delete("/me/photo", response_model=ProfileOut)
def delete_my_photo(sess: ClientSessionDep, db: DbDep, settings: SettingsDep):
    remove_photo(sess.profile, settings)
    db.commit()
    return to_profile_out(sess.profile)
