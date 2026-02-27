"""MinIO/S3 photo download client and Postgres observation fetcher."""

import asyncio
import io
import logging
import uuid
from dataclasses import dataclass

import asyncpg
from minio import Minio

from src.config import settings

logger = logging.getLogger(__name__)


@dataclass
class PhotoRecord:
    """A photo record from the database."""

    id: str
    observation_id: str
    photo_type: str
    storage_key: str
    storage_url: str | None
    mime_type: str | None


@dataclass
class ObservationRecord:
    """An observation record from the database."""

    id: str
    tree_id: str | None
    latitude: float
    longitude: float
    status: str


@dataclass
class DownloadedPhoto:
    """A photo downloaded from storage with its metadata."""

    record: PhotoRecord
    data: bytes


def _build_minio_client() -> Minio:
    """Create a MinIO client from settings.

    Returns:
        Configured Minio client instance.
    """
    endpoint = settings.s3_endpoint.replace("http://", "").replace("https://", "")
    secure = settings.s3_endpoint.startswith("https://")
    return Minio(
        endpoint,
        access_key=settings.s3_access_key,
        secret_key=settings.s3_secret_key,
        secure=secure,
    )


async def get_db_pool() -> asyncpg.Pool:
    """Create a connection pool to Postgres.

    Returns:
        An asyncpg connection pool.
    """
    return await asyncpg.create_pool(settings.database_url, min_size=1, max_size=5)


async def fetch_observation(pool: asyncpg.Pool, observation_id: str) -> ObservationRecord | None:
    """Fetch an observation record by ID.

    Args:
        pool: Postgres connection pool.
        observation_id: UUID of the observation.

    Returns:
        ObservationRecord or None if not found.
    """
    row = await pool.fetchrow(
        "SELECT id, tree_id, latitude, longitude, status FROM observations WHERE id = $1",
        uuid.UUID(observation_id),
    )
    if row is None:
        logger.warning("Observation %s not found in database", observation_id)
        return None

    return ObservationRecord(
        id=str(row["id"]),
        tree_id=str(row["tree_id"]) if row["tree_id"] else None,
        latitude=row["latitude"],
        longitude=row["longitude"],
        status=row["status"],
    )


async def fetch_photos(pool: asyncpg.Pool, observation_id: str) -> list[PhotoRecord]:
    """Fetch all photo records for an observation.

    Args:
        pool: Postgres connection pool.
        observation_id: UUID of the observation.

    Returns:
        List of PhotoRecord objects.
    """
    rows = await pool.fetch(
        "SELECT id, observation_id, photo_type, storage_key, storage_url, mime_type "
        "FROM photos WHERE observation_id = $1",
        uuid.UUID(observation_id),
    )
    photos = [
        PhotoRecord(
            id=str(r["id"]),
            observation_id=str(r["observation_id"]),
            photo_type=r["photo_type"],
            storage_key=r["storage_key"],
            storage_url=r["storage_url"],
            mime_type=r["mime_type"],
        )
        for r in rows
    ]
    logger.info("Found %d photos for observation %s", len(photos), observation_id)
    return photos


def download_photo(client: Minio, photo: PhotoRecord) -> DownloadedPhoto:
    """Download a single photo from MinIO/S3.

    Args:
        client: Minio client instance.
        photo: PhotoRecord with the storage_key to download.

    Returns:
        DownloadedPhoto with the image bytes and metadata.

    Raises:
        Exception: If the download fails.
    """
    logger.info("Downloading photo %s (type=%s, key=%s)", photo.id, photo.photo_type, photo.storage_key)
    response = client.get_object(settings.s3_bucket, photo.storage_key)
    try:
        data = response.read()
    finally:
        response.close()
        response.release_conn()

    logger.info("Downloaded %d bytes for photo %s", len(data), photo.id)
    return DownloadedPhoto(record=photo, data=data)


async def fetch_observation_photos(
    pool: asyncpg.Pool,
    observation_id: str,
) -> tuple[ObservationRecord, list[DownloadedPhoto]] | None:
    """Fetch an observation and download all its photos.

    This is the main entry point for Step 3 — gets everything needed
    for the AI analyzers.

    Args:
        pool: Postgres connection pool.
        observation_id: UUID of the observation to process.

    Returns:
        Tuple of (observation, downloaded_photos) or None if observation not found.
    """
    observation = await fetch_observation(pool, observation_id)
    if observation is None:
        return None

    photo_records = await fetch_photos(pool, observation_id)
    if not photo_records:
        logger.warning("No photos found for observation %s", observation_id)
        return observation, []

    client = _build_minio_client()
    downloaded: list[DownloadedPhoto] = []

    async def _download_one(client: Minio, photo: PhotoRecord) -> DownloadedPhoto:
        return await asyncio.to_thread(download_photo, client, photo)

    tasks = [_download_one(client, photo) for photo in photo_records]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.exception("Failed to download photo %s", photo_records[i].id)
        else:
            downloaded.append(result)

    logger.info(
        "Fetched observation %s with %d/%d photos downloaded",
        observation_id,
        len(downloaded),
        len(photo_records),
    )
    return observation, downloaded
