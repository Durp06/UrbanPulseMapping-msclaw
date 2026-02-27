"""Tests for the BullMQ job consumer."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

import src.consumer as consumer_module
from src.consumer import process_job, _parse_redis_url, QUEUE_NAME


class TestProcessJob:
    """Tests for process_job function."""

    @pytest.mark.asyncio
    async def test_process_job_valid_data(self, sample_observation_id: str):
        """Should extract observationId and return it."""
        job = MagicMock()
        job.id = "job-123"
        job.data = {"observationId": sample_observation_id}

        # Set up mock pool at module level
        mock_pool = AsyncMock()
        consumer_module._db_pool = mock_pool

        try:
            with patch("src.pipeline.run_pipeline", new_callable=AsyncMock, return_value=True):
                result = await process_job(job)

            assert result == sample_observation_id
        finally:
            consumer_module._db_pool = None

    @pytest.mark.asyncio
    async def test_process_job_missing_observation_id(self):
        """Should raise ValueError when observationId is missing."""
        job = MagicMock()
        job.id = "job-456"
        job.data = {}

        with pytest.raises(ValueError, match="observationId"):
            await process_job(job)

    @pytest.mark.asyncio
    async def test_process_job_none_observation_id(self):
        """Should raise ValueError when observationId is None."""
        job = MagicMock()
        job.id = "job-789"
        job.data = {"observationId": None}

        with pytest.raises(ValueError, match="observationId"):
            await process_job(job)


class TestParseRedisUrl:
    """Tests for _parse_redis_url helper."""

    def test_standard_url(self):
        assert _parse_redis_url("redis://localhost:6379") == ("localhost", 6379)

    def test_custom_port(self):
        assert _parse_redis_url("redis://myhost:6380") == ("myhost", 6380)

    def test_no_port(self):
        assert _parse_redis_url("redis://localhost") == ("localhost", 6379)

    def test_with_auth(self):
        assert _parse_redis_url("redis://user:pass@host:6379") == ("host", 6379)

    def test_with_path(self):
        assert _parse_redis_url("redis://localhost:6379/0") == ("localhost", 6379)

    def test_rediss_scheme(self):
        assert _parse_redis_url("rediss://secure:6380") == ("secure", 6380)


class TestQueueName:
    """Verify queue naming convention."""

    def test_queue_name_is_separate_from_ts_worker(self):
        """Our queue must differ from the TS worker's 'process-observation'."""
        assert QUEUE_NAME == "ai-process-observation"
        assert QUEUE_NAME != "process-observation"
