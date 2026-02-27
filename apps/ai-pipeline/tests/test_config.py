"""Tests for config module — verifies settings load correctly."""

from src.config import Settings


def test_default_settings():
    """Settings should load with sensible defaults."""
    s = Settings(
        _env_file=None,
        plantnet_api_key="test",
        anthropic_api_key="test",
        openai_api_key="test",
        google_api_key="test",
        internal_api_key="test",
    )
    assert s.redis_url == "redis://localhost:6379"
    assert s.s3_bucket == "urban-pulse-photos"
    assert s.llm_provider == "anthropic"
    assert s.llm_model == "claude-sonnet-4-5-20250929"
    assert s.max_concurrent_jobs == 3
    assert s.log_level == "INFO"


def test_settings_override(monkeypatch):
    """Settings should pick up env var overrides."""
    monkeypatch.setenv("REDIS_URL", "redis://custom:6380")
    monkeypatch.setenv("LOG_LEVEL", "DEBUG")
    s = Settings(_env_file=None)
    assert s.redis_url == "redis://custom:6380"
    assert s.log_level == "DEBUG"
