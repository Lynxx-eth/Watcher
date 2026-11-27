from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.session import Base
from app.models._time import utcnow

# Enum-like values are validated by Pydantic at the API edge; the two
# most important ones are also enforced by CHECK constraints.


class Profile(Base):
    """A profile is created and owned by the person it describes (self-service)."""

    __tablename__ = "profiles"
    __table_args__ = (
        CheckConstraint("risk_score BETWEEN 0 AND 100", name="ck_profiles_risk_score"),
        CheckConstraint("access_status IN ('ACTIVE','SUSPENDED','REVOKED')", name="ck_profiles_access"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    project_id: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    pin_hash: Mapped[str] = mapped_column(String(255))

    full_name: Mapped[str] = mapped_column(String(120))
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    nationality: Mapped[str] = mapped_column(String(80), default="")
    gender: Mapped[str | None] = mapped_column(String(40), nullable=True)
    photo_key: Mapped[str | None] = mapped_column(String(80), nullable=True)

    title: Mapped[str] = mapped_column(String(120), default="")
    classification: Mapped[str] = mapped_column(String(40), default="RESTRICTED")
    threat_level: Mapped[str] = mapped_column(String(16), default="LOW")
    watchlist_status: Mapped[str] = mapped_column(String(16), default="NONE")
    risk_score: Mapped[int] = mapped_column(Integer, default=0)
    priority: Mapped[str] = mapped_column(String(16), default="NORMAL")
    description: Mapped[str] = mapped_column(Text, default="")

    # Access control
    access_status: Mapped[str] = mapped_column(String(16), default="ACTIVE")
    failed_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_access_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    location: Mapped[Optional["ProfileLocation"]] = relationship(
        back_populates="profile", uselist=False, cascade="all, delete-orphan"
    )
    biometrics: Mapped[Optional["ProfileBiometrics"]] = relationship(
        back_populates="profile", uselist=False, cascade="all, delete-orphan"
    )
    notes: Mapped[list["CaseNote"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan", order_by="CaseNote.created_at"
    )


class ProfileLocation(Base):
    __tablename__ = "profile_locations"

    profile_id: Mapped[int] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), primary_key=True)
    country: Mapped[str] = mapped_column(String(80), default="")
    region: Mapped[str | None] = mapped_column(String(80), nullable=True)
    city: Mapped[str] = mapped_column(String(80), default="")
    address: Mapped[str | None] = mapped_column(String(200), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    show_address: Mapped[bool] = mapped_column(Boolean, default=False)
    # Filled by server-side geocoding (Phase 10); never invented.
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lon: Mapped[float | None] = mapped_column(Float, nullable=True)
    geo_source: Mapped[str | None] = mapped_column(String(40), nullable=True)
    geocoded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    profile: Mapped[Profile] = relationship(back_populates="location")


class ProfileBiometrics(Base):
    """Display-only statuses chosen by the owner. Not real biometric data."""

    __tablename__ = "profile_biometrics"

    profile_id: Mapped[int] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), primary_key=True)
    facial: Mapped[str] = mapped_column(String(16), default="NOT ON FILE")
    fingerprint: Mapped[str] = mapped_column(String(16), default="NOT ON FILE")
    iris: Mapped[str] = mapped_column(String(16), default="NOT ON FILE")
    dna: Mapped[str] = mapped_column(String(16), default="NOT ON FILE")

    profile: Mapped[Profile] = relationship(back_populates="biometrics")


class CaseNote(Base):
    __tablename__ = "case_notes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    profile_id: Mapped[int] = mapped_column(ForeignKey("profiles.id", ondelete="CASCADE"), index=True)
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    profile: Mapped[Profile] = relationship(back_populates="notes")
