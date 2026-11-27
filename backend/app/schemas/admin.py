from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import CamelModel
from app.schemas.profile import BiometricsOut

ThreatLevel = Literal["LOW", "GUARDED", "ELEVATED", "HIGH", "SEVERE"]
WatchlistStatus = Literal["NONE", "ACTIVE", "PENDING", "CLEARED"]
BioStatus = Literal["ON FILE", "MATCH FOUND", "PENDING", "NOT ON FILE"]
Priority = Literal["LOW", "NORMAL", "HIGH"]


class AdminLoginIn(BaseModel):
    username: str = Field(min_length=1, max_length=60)
    password: str = Field(min_length=1, max_length=200)


class AdminMeOut(CamelModel):
    username: str
    role: str


class PasswordChangeIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=12, max_length=200)


class ProfileRow(CamelModel):
    project_id: str
    full_name: str
    access_status: str
    threat_level: str
    watchlist_status: str
    is_demo: bool
    locked: bool
    last_access_at: datetime | None
    created_at: datetime


class ProfilePage(CamelModel):
    items: list[ProfileRow]
    total: int
    page: int
    page_size: int


class LocationAdmin(CamelModel):
    country: str
    region: str | None
    city: str
    address: str | None
    postal_code: str | None
    show_address: bool
    lat: float | None
    lon: float | None


class ProfileAdminOut(CamelModel):
    """Everything the owner entered, for support and moderation."""

    project_id: str
    full_name: str
    date_of_birth: date | None
    nationality: str
    gender: str | None
    has_photo: bool
    title: str
    classification: str
    threat_level: str
    watchlist_status: str
    risk_score: int
    priority: str
    description: str
    case_notes: list[str]
    biometrics: BiometricsOut | None
    location: LocationAdmin | None
    access_status: str
    failed_attempts: int
    locked_until: datetime | None
    last_access_at: datetime | None
    is_demo: bool
    created_at: datetime
    updated_at: datetime


class LocationIn(BaseModel):
    country: str = Field(max_length=80)
    region: str | None = Field(default=None, max_length=80)
    city: str = Field(max_length=80)
    address: str | None = Field(default=None, max_length=200)
    postal_code: str | None = Field(default=None, max_length=20)
    show_address: bool = False


class BiometricsIn(BaseModel):
    facial: BioStatus
    fingerprint: BioStatus
    iris: BioStatus
    dna: BioStatus


class ProfileUpdateIn(BaseModel):
    """Admin edits, made at the owner's request. Every field optional (PATCH)."""

    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    date_of_birth: date | None = None
    nationality: str | None = Field(default=None, max_length=80)
    gender: str | None = Field(default=None, max_length=40)
    title: str | None = Field(default=None, max_length=120)
    classification: str | None = Field(default=None, max_length=40)
    threat_level: ThreatLevel | None = None
    watchlist_status: WatchlistStatus | None = None
    risk_score: int | None = Field(default=None, ge=0, le=100)
    priority: Priority | None = None
    description: str | None = Field(default=None, max_length=2000)
    case_notes: list[str] | None = Field(default=None, max_length=20)
    location: LocationIn | None = None
    biometrics: BiometricsIn | None = None

    @field_validator("gender")
    @classmethod
    def blank_gender(cls, v: str | None) -> str | None:
        return v.strip() or None if v is not None else None

    @field_validator("full_name", "nationality", "title", "classification", "description")
    @classmethod
    def not_null(cls, v: str | None) -> str | None:
        # These columns are NOT NULL; an explicit null in a PATCH is rejected.
        if v is None:
            raise ValueError("may not be null")
        return v.strip()

    @field_validator("case_notes")
    @classmethod
    def notes_len(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        cleaned = [n.strip() for n in v if n.strip()]
        if any(len(n) > 500 for n in cleaned):
            raise ValueError("Each note must be 500 characters or fewer")
        return cleaned


class DeleteIn(BaseModel):
    confirm: str  # must equal the project ID being deleted


class PinResetOut(CamelModel):
    project_id: str
    new_pin: str  # shown once; only its hash is stored


class OverviewOut(CamelModel):
    profiles: int
    active: int
    suspended: int
    revoked: int
    locked: int
    sign_ins_24h: int
    failed_24h: int


class AuditRow(CamelModel):
    at: datetime
    actor: str
    event: str
    category: str
    status: str
    project_id: str | None
    ip: str | None
