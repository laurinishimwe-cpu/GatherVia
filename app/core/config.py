from functools import lru_cache
from typing import Annotated

from pydantic import Field, ValidationError, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables and `.env` file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    mongodb_url: str = Field(
        ...,
        description="MongoDB connection URI (e.g. mongodb://localhost:27017).",
    )
    database_name: str = Field(
        ...,
        description="Name of the MongoDB database to use.",
    )
    jwt_secret_key: str = Field(
        ...,
        min_length=32,
        description="Secret key used to sign JWT access tokens.",
    )
    google_client_id: str | None = Field(
        default=None,
        description="Google OAuth 2.0 client ID for social login.",
    )
    microsoft_client_id: str | None = Field(
        default=None,
        description="Microsoft OAuth 2.0 client ID for social login.",
    )
    public_app_url: str = Field(
        default="https://gathervia.vercel.app",
        description="Public frontend URL used when generating share links.",
    )
    email_api_key: str | None = Field(
        default=None,
        description="API key for the email delivery provider.",
    )
    email_from_address: str | None = Field(
        default=None,
        description="Sender address used by email delivery endpoints.",
    )
    whatsapp_api_key: str | None = Field(
        default=None,
        description="API key for the WhatsApp delivery provider.",
    )
    whatsapp_sender_id: str | None = Field(
        default=None,
        description="Sender identifier used by WhatsApp delivery endpoints.",
    )
    refresh_session_idle_days: int = Field(
        default=180,
        ge=1,
        le=3650,
        description="Days of inactivity before a refresh session expires.",
    )
    revenuecat_secret_api_key: str | None = Field(
        default=None,
        description="Backend-only RevenueCat secret API key.",
    )
    revenuecat_webhook_authorization: str | None = Field(
        default=None,
        description="Exact Authorization header configured for RevenueCat webhooks.",
    )
    revenuecat_basic_entitlement_id: str = Field(default="basic")
    revenuecat_pro_entitlement_id: str = Field(default="pro")
    google_play_plans_enabled: bool = Field(default=True)
    app_store_plans_enabled: bool = Field(default=False)
    storage_provider: str = Field(
        default="supabase",
        description="File storage backend used for invitation and flyer assets.",
    )
    supabase_url: str | None = Field(
        default=None,
        description="Supabase project URL used for Storage uploads and public asset URLs.",
    )
    supabase_service_role_key: str | None = Field(
        default=None,
        description="Supabase service role key used by the backend to upload storage assets.",
    )
    supabase_storage_bucket: str = Field(
        default="flyers",
        description="Supabase Storage bucket that stores invitation and flyer assets.",
    )
    storage_fallback_local: bool = Field(
        default=False,
        description="Fallback to local file storage if the remote storage provider is unavailable.",
    )

    app_name: str = Field(default="Events Management API")
    debug: bool = Field(default=False)
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default=["http://localhost:3000", "http://localhost:5173"],
        description="Comma-separated list of allowed CORS origins.",
    )

    admin_emails: str = Field(default="", description="Comma‑separated list of admin email addresses.")

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance with descriptive errors for missing values."""
    try:
        return Settings()
    except ValidationError as exc:
        missing_fields = [
            error["loc"][0]
            for error in exc.errors()
            if error["type"] == "missing"
        ]
        if missing_fields:
            field_list = ", ".join(str(field).upper() for field in missing_fields)
            raise RuntimeError(
                f"Missing required environment variables: {field_list}. "
                "Copy `.env.example` to `.env` and provide all required values."
            ) from exc
        raise RuntimeError(
            "Invalid application configuration. Check your `.env` file and "
            f"environment variables. Details: {exc}"
        ) from exc


settings = get_settings()
