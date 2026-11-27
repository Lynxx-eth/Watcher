from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.database.session import get_db
from app.models import AdminSession, ClientSession
from app.services.admin_auth import resolve_admin
from app.services.client_auth import resolve_session

DbDep = Annotated[Session, Depends(get_db)]
SettingsDep = Annotated[Settings, Depends(get_settings)]


def client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def current_client_session(request: Request, db: DbDep, settings: SettingsDep) -> ClientSession:
    """
    The ONLY way client routes learn which profile they serve.
    Profile identity comes from the session, never from a URL or body field,
    so one client can't request another client's data.
    """
    sess = resolve_session(db, request.cookies.get(settings.client_cookie_name))
    if sess is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "SESSION REQUIRED")
    return sess


ClientSessionDep = Annotated[ClientSession, Depends(current_client_session)]


def current_admin_session(request: Request, db: DbDep, settings: SettingsDep) -> AdminSession:
    sess = resolve_admin(db, request.cookies.get(settings.admin_cookie_name))
    if sess is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "ADMIN SESSION REQUIRED")
    return sess


AdminSessionDep = Annotated[AdminSession, Depends(current_admin_session)]
