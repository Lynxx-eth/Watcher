from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import CamelModel
from app.schemas.profile import BiometricsOut, GeoOut


class UnlockIn(BaseModel):
    project_id: str = Field(min_length=4, max_length=20)
    pin: str = Field(min_length=4, max_length=12)

    @field_validator("project_id")
    @classmethod
    def norm(cls, v: str) -> str:
        v = v.strip()
        return v.upper() if v.lower().startswith("wtr-") else v


class ConfidentialStatus(CamelModel):
    unlocked: bool
    expires_at: datetime | None


class ConfidentialLocation(CamelModel):
    country: str
    region: str | None
    city: str
    address: str | None  # the owner's own full address, shown only after re-verification
    postal_code: str | None
    geo: GeoOut | None
    geo_status: str  # "LOCATED" | "PENDING" | "UNAVAILABLE"


class ConfidentialProfile(CamelModel):
    project_id: str
    full_name: str
    date_of_birth: str | None
    nationality: str
    gender: str | None
    photo_url: str | None
    title: str
    classification: str
    threat_level: str
    watchlist_status: str
    risk_score: int
    description: str
    case_notes: list[str]
    biometrics: BiometricsOut | None
    location: ConfidentialLocation | None
    expires_at: datetime
