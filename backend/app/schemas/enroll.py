from datetime import date

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.config import get_settings
from app.schemas.admin import BiometricsIn, LocationIn, Priority, ThreatLevel, WatchlistStatus
from app.schemas.common import CamelModel


class EnrollIn(BaseModel):
    """Everything here is entered by the person the profile describes."""

    # General
    full_name: str = Field(min_length=2, max_length=120)
    date_of_birth: date
    nationality: str = Field(min_length=2, max_length=80)
    gender: str | None = Field(default=None, max_length=40)
    title: str = Field(default="", max_length=120)
    description: str = Field(default="", max_length=2000)

    # Location (city/country required; street address optional and hidden by default)
    location: LocationIn

    # Display choices
    classification: str = Field(default="RESTRICTED", min_length=1, max_length=40)
    threat_level: ThreatLevel = "LOW"
    watchlist_status: WatchlistStatus = "NONE"
    risk_score: int = Field(default=0, ge=0, le=100)
    priority: Priority = "NORMAL"
    biometrics: BiometricsIn
    case_notes: list[str] = Field(default_factory=list, max_length=20)

    # Security + consent
    pin: str = Field(min_length=4, max_length=12)
    pin_confirm: str
    consent_own_profile: bool

    @field_validator("full_name", "nationality", "title", "classification", "description")
    @classmethod
    def strip(cls, v: str) -> str:
        return v.strip()

    @field_validator("gender")
    @classmethod
    def blank_gender(cls, v: str | None) -> str | None:
        return (v.strip() or None) if v is not None else None

    @field_validator("pin")
    @classmethod
    def pin_digits(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("PIN must contain digits only")
        if len(set(v)) == 1 or v in "0123456789012" or v in "9876543210987":
            raise ValueError("PIN is too easy to guess")
        return v

    @field_validator("case_notes")
    @classmethod
    def notes(cls, v: list[str]) -> list[str]:
        cleaned = [n.strip() for n in v if n.strip()]
        if any(len(n) > 500 for n in cleaned):
            raise ValueError("Each note must be 500 characters or fewer")
        return cleaned

    @field_validator("date_of_birth")
    @classmethod
    def adult(cls, v: date) -> date:
        today = date.today()
        age = today.year - v.year - ((today.month, today.day) < (v.month, v.day))
        if v > today or age > 120:
            raise ValueError("Enter a valid date of birth")
        if age < get_settings().min_owner_age:
            raise ValueError(f"You must be at least {get_settings().min_owner_age} to create a profile")
        return v

    @field_validator("location")
    @classmethod
    def city_country(cls, v: LocationIn) -> LocationIn:
        if not v.city.strip() or not v.country.strip():
            raise ValueError("City and country are required")
        return v

    @model_validator(mode="after")
    def checks(self) -> "EnrollIn":
        if self.pin != self.pin_confirm:
            raise ValueError("PINs do not match")
        if not self.consent_own_profile:
            raise ValueError("You must confirm this profile is about you")
        return self


class EnrollOut(CamelModel):
    project_id: str
    display_name: str
