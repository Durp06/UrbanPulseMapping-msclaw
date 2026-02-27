"""Configuration — all env vars and settings loaded via pydantic-settings."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings, loaded from environment variables."""

    # Redis / BullMQ
    redis_url: str = "redis://localhost:6379"

    # Postgres
    database_url: str = "postgresql://dev:devpassword@localhost:5432/urban_pulse_dev"

    # MinIO / S3
    s3_endpoint: str = "http://localhost:9000"
    s3_access_key: str = "minioaccess"
    s3_secret_key: str = "miniosecret"
    s3_bucket: str = "urban-pulse-photos"

    # AI APIs
    plantnet_api_key: str = ""
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    google_api_key: str = ""

    # Internal API
    internal_api_key: str = ""
    api_base_url: str = "http://localhost:3000"

    # LLM config
    llm_provider: str = "anthropic"  # "anthropic", "openai", or "google"
    llm_model: str = "claude-sonnet-4-5-20250929"

    # Operational
    log_level: str = "INFO"
    max_concurrent_jobs: int = 3

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
