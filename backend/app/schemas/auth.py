from pydantic import BaseModel, Field, field_validator

from app.schemas.common import CamelModel


class ClientLoginIn(BaseModel):
    project_id: str = Field(min_length=4, max_length=20)
    pin: str = Field(min_length=4, max_length=12)

    @field_validator("project_id")
    @classmethod
    def normalise_id(cls, v: str) -> str:
        v = v.strip()
        # Generated IDs are uppercase (WTR-2026-00001); accept any case.
        return v.upper() if v.lower().startswith("wtr-") else v

    @field_validator("pin")
    @classmethod
    def digits_only(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("PIN must contain digits only")
        return v


class SessionOut(CamelModel):
    project_id: str
    display_name: str
