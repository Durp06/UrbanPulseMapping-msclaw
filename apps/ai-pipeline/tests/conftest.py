"""Shared pytest fixtures for ai-pipeline tests."""

import pytest


@pytest.fixture
def sample_observation_id() -> str:
    """A sample UUID for testing."""
    return "550e8400-e29b-41d4-a716-446655440000"


@pytest.fixture
def sample_job_data(sample_observation_id: str) -> dict:
    """Sample BullMQ job payload."""
    return {"observationId": sample_observation_id}
