"""BullMQ job consumer — listens for observation processing jobs from Redis."""

import asyncio
import json
import logging
from typing import Any

import redis.asyncio as aioredis
from bullmq import Worker

import asyncpg

from src.config import settings

logger = logging.getLogger(__name__)

# Queue name — separate from the TS worker's queue.
QUEUE_NAME = "ai-process-observation"

# Module-level pool, initialized in run_consumer
_db_pool: asyncpg.Pool | None = None

# Dead letter queue for persistent failures
DLQ_KEY = "ai-pipeline:dead-letter"

# Max attempts before sending to DLQ
MAX_JOB_ATTEMPTS = 3


async def send_to_dlq(
    observation_id: str,
    error: str,
    attempt: int,
) -> None:
    """Send a failed job to the dead letter queue.

    Args:
        observation_id: The observation that failed processing.
        error: Error description.
        attempt: Which attempt this was.
    """
    host, port = _parse_redis_url(settings.redis_url)
    client = aioredis.Redis(host=host, port=port, decode_responses=True)
    try:
        entry = json.dumps({
            "observationId": observation_id,
            "error": error,
            "attempt": attempt,
        })
        await client.rpush(DLQ_KEY, entry)
        logger.info("Sent observation %s to dead letter queue: %s", observation_id, error)
    except Exception:
        logger.exception("Failed to send observation %s to DLQ", observation_id)
    finally:
        await client.aclose()


async def process_job(job: Any, token: str | None = None) -> Any:
    """Process a single observation job.

    Args:
        job: BullMQ job object with job.data containing {"observationId": "uuid"}.
        token: Optional BullMQ job token.

    Returns:
        The observation ID that was processed.
    """
    global _db_pool

    data: dict = job.data
    observation_id = data.get("observationId")

    if not observation_id:
        logger.error("Job %s missing observationId in data: %s", job.id, data)
        raise ValueError("Job data must contain 'observationId'")

    logger.info("Received job %s for observation %s", job.id, observation_id)

    if _db_pool is None:
        raise RuntimeError("Database pool not initialized")

    # Import here to avoid circular imports
    from src.pipeline import run_pipeline

    success = await run_pipeline(observation_id, _db_pool)
    if not success:
        attempt = getattr(job, "attemptsMade", 1)
        if attempt >= MAX_JOB_ATTEMPTS:
            await send_to_dlq(observation_id, "Pipeline failed after max attempts", attempt)
        raise RuntimeError(f"Pipeline failed for observation {observation_id}")

    logger.info("Job %s completed successfully for observation %s", job.id, observation_id)
    return observation_id


def _parse_redis_url(url: str) -> tuple[str, int]:
    """Extract host and port from a Redis URL.

    Args:
        url: Redis URL like redis://host:port

    Returns:
        Tuple of (host, port).
    """
    stripped = url.replace("redis://", "").replace("rediss://", "")
    if "@" in stripped:
        stripped = stripped.split("@", 1)[1]
    stripped = stripped.split("/", 1)[0]
    if ":" in stripped:
        host, port_str = stripped.rsplit(":", 1)
        return host, int(port_str)
    return stripped, 6379


async def run_consumer() -> None:
    """Start the BullMQ consumer loop. Runs until cancelled."""
    global _db_pool

    from src.clients.storage import get_db_pool

    host, port = _parse_redis_url(settings.redis_url)
    logger.info("Starting consumer on queue '%s' (redis=%s:%d)", QUEUE_NAME, host, port)

    # Create shared database pool
    _db_pool = await get_db_pool()
    logger.info("Database pool initialized")

    worker = Worker(
        QUEUE_NAME,
        process_job,
        {"connection": {"host": host, "port": port}},
    )

    logger.info("Consumer started, waiting for jobs...")

    try:
        while True:
            await asyncio.sleep(1)
    except asyncio.CancelledError:
        logger.info("Consumer shutting down...")
    finally:
        await worker.close()
        if _db_pool is not None:
            await _db_pool.close()
            _db_pool = None
        logger.info("Consumer stopped.")
