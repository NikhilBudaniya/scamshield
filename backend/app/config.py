from functools import lru_cache
from typing import Literal
from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(extra="ignore")
    database_url: str = "sqlite:///./scamshield.db"
    access_code: str | None = Field(default=None, validation_alias="DEMO_ACCESS_CODE")
    session_secret: str = "local-demo-secret-change-me"
    session_ttl_seconds: int = 60 * 60 * 12
    max_assessments_per_session: int = 100
    max_explanations_per_session: int = 100
    jev_mode: str = "fixture"
    jev_api_key: str | None = None
    jev_model: str = "jev-1.13.0"
    jev_base_url: str = "https://api.typesafe.ai/v1/systemone"
    jev_timeout_seconds: float = 2.0
    context_provider: str = "jev"
    gemini_classification_timeout_seconds: float = Field(default=8.0, validation_alias="GEMINI_CLASSIFICATION_TIMEOUT_SECONDS")
    gemini_mode: str = "fixture"
    gemini_backend: Literal["vertex", "developer"] = Field(default="vertex", validation_alias="GEMINI_BACKEND")
    gemini_api_key: SecretStr | None = Field(default=None, validation_alias="GEMINI_API_KEY")
    google_cloud_project: str | None = None
    google_cloud_location: str = "global"
    gemini_model: str = "gemini-2.5-flash"
    gemini_timeout_seconds: float = 8.0
    cookie_secure: bool = False
    local_development: bool = False
    environment: str = "development"
    max_login_attempts_per_minute: int = 10


def validate_gemini_config(settings: Settings) -> None:
    """Require credentials for the selected backend only when Gemini is live."""
    if settings.gemini_mode != "live":
        return
    if settings.gemini_backend == "developer" and not settings.gemini_api_key:
        raise ValueError("GEMINI_BACKEND=developer requires GEMINI_API_KEY when GEMINI_MODE=live")
    if settings.gemini_backend == "vertex" and not settings.google_cloud_project:
        raise ValueError("GEMINI_BACKEND=vertex requires GOOGLE_CLOUD_PROJECT when GEMINI_MODE=live")


@lru_cache
def get_settings() -> Settings:
    return Settings()
