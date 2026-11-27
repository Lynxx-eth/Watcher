from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


def normalise_db_url(url: str) -> str:
    """
    Managed Postgres hosts (Render, Heroku, Railway) inject a URL like
    `postgres://…` or `postgresql://…`, which SQLAlchemy would route to psycopg2.
    We use psycopg 3, so pin the driver. SQLite (tests) is left untouched.
    """
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


_settings = get_settings()
engine = create_engine(normalise_db_url(_settings.database_url), pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
