from datetime import date, datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.event import EventType
from app.models.user import AuthProvider, SupportedLanguage, UserTier


class RegisterRequest(BaseModel):
    """Manual email registration payload."""

    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=1, max_length=200)


class LoginRequest(BaseModel):
    """Manual email login payload."""

    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class SSOAssertionRequest(BaseModel):
    provider_token: str = Field(..., min_length=1)



class LanguagePreferenceRequest(BaseModel):
    """Preferred UI language selected during onboarding."""

    language: SupportedLanguage


class HistoricEventResponse(BaseModel):
    """Compact event history entry shown after authentication."""

    id: str
    slug: str
    title: str
    event_type: EventType
    event_date: date | None = None
    created_at: datetime
    ui_language: SupportedLanguage


class TokenResponse(BaseModel):
    """Short-lived JWT plus an optional rotating refresh credential."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int = 3600
    refresh_token: str | None = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., min_length=40, max_length=500)


class AuthSessionResponse(BaseModel):
    id: str
    client_kind: str
    installation_id: str | None = None
    user_agent: str | None = None
    created_at: datetime
    last_used_at: datetime
    expires_at: datetime


class UserResponse(BaseModel):
    """Public user profile returned to authenticated clients."""

    id: str
    email: EmailStr
    full_name: str
    auth_provider: AuthProvider
    auth_providers: list[AuthProvider] = Field(default_factory=list)
    has_password: bool = False
    tier: UserTier
    preferred_language: SupportedLanguage | None = None
    needs_language_selection: bool = False
    historic_events: list[HistoricEventResponse] = Field(default_factory=list)


class UpdateProfileRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=200)

class ChangePasswordRequest(BaseModel):
    current_password: str | None = Field(default=None, min_length=8, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)
