"""Tests for the storage client — DB fetching and MinIO downloads."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

from src.clients.storage import (
    PhotoRecord,
    ObservationRecord,
    DownloadedPhoto,
    _build_minio_client,
    fetch_observation,
    fetch_photos,
    download_photo,
    fetch_observation_photos,
)


@pytest.fixture
def obs_id() -> str:
    return "550e8400-e29b-41d4-a716-446655440000"


@pytest.fixture
def mock_pool():
    pool = AsyncMock()
    return pool


@pytest.fixture
def sample_photo_record(obs_id: str) -> PhotoRecord:
    return PhotoRecord(
        id="photo-001",
        observation_id=obs_id,
        photo_type="full_tree_angle1",
        storage_key="uploads/photo-001.jpg",
        storage_url="http://localhost:9000/urban-pulse-photos/uploads/photo-001.jpg",
        mime_type="image/jpeg",
    )


@pytest.fixture
def sample_observation(obs_id: str) -> ObservationRecord:
    return ObservationRecord(
        id=obs_id,
        tree_id="tree-001",
        latitude=30.2672,
        longitude=-97.7431,
        status="pending_ai",
    )


class TestFetchObservation:
    @pytest.mark.asyncio
    async def test_found(self, mock_pool, obs_id):
        mock_pool.fetchrow.return_value = {
            "id": UUID(obs_id),
            "tree_id": UUID("00000000-0000-0000-0000-000000000001"),
            "latitude": 30.2672,
            "longitude": -97.7431,
            "status": "pending_ai",
        }
        result = await fetch_observation(mock_pool, obs_id)
        assert result is not None
        assert result.id == obs_id
        assert result.latitude == 30.2672
        assert result.status == "pending_ai"

    @pytest.mark.asyncio
    async def test_not_found(self, mock_pool, obs_id):
        mock_pool.fetchrow.return_value = None
        result = await fetch_observation(mock_pool, obs_id)
        assert result is None

    @pytest.mark.asyncio
    async def test_null_tree_id(self, mock_pool, obs_id):
        mock_pool.fetchrow.return_value = {
            "id": UUID(obs_id),
            "tree_id": None,
            "latitude": 30.0,
            "longitude": -97.0,
            "status": "pending_upload",
        }
        result = await fetch_observation(mock_pool, obs_id)
        assert result is not None
        assert result.tree_id is None


class TestFetchPhotos:
    @pytest.mark.asyncio
    async def test_returns_photos(self, mock_pool, obs_id):
        mock_pool.fetch.return_value = [
            {
                "id": UUID("00000000-0000-0000-0000-000000000010"),
                "observation_id": UUID(obs_id),
                "photo_type": "full_tree_angle1",
                "storage_key": "uploads/p1.jpg",
                "storage_url": "http://localhost:9000/bucket/uploads/p1.jpg",
                "mime_type": "image/jpeg",
            },
            {
                "id": UUID("00000000-0000-0000-0000-000000000011"),
                "observation_id": UUID(obs_id),
                "photo_type": "bark_closeup",
                "storage_key": "uploads/p2.jpg",
                "storage_url": None,
                "mime_type": "image/jpeg",
            },
        ]
        result = await fetch_photos(mock_pool, obs_id)
        assert len(result) == 2
        assert result[0].photo_type == "full_tree_angle1"
        assert result[1].photo_type == "bark_closeup"
        assert result[1].storage_url is None

    @pytest.mark.asyncio
    async def test_no_photos(self, mock_pool, obs_id):
        mock_pool.fetch.return_value = []
        result = await fetch_photos(mock_pool, obs_id)
        assert result == []


class TestDownloadPhoto:
    def test_downloads_bytes(self, sample_photo_record):
        mock_response = MagicMock()
        mock_response.read.return_value = b"\xff\xd8\xff\xe0fake-jpeg-data"
        mock_response.close = MagicMock()
        mock_response.release_conn = MagicMock()

        mock_client = MagicMock()
        mock_client.get_object.return_value = mock_response

        result = download_photo(mock_client, sample_photo_record)

        assert isinstance(result, DownloadedPhoto)
        assert result.data == b"\xff\xd8\xff\xe0fake-jpeg-data"
        assert result.record is sample_photo_record
        mock_client.get_object.assert_called_once_with(
            "urban-pulse-photos",
            "uploads/photo-001.jpg",
        )
        mock_response.close.assert_called_once()
        mock_response.release_conn.assert_called_once()

    def test_releases_conn_on_read_error(self, sample_photo_record):
        mock_response = MagicMock()
        mock_response.read.side_effect = IOError("network error")
        mock_response.close = MagicMock()
        mock_response.release_conn = MagicMock()

        mock_client = MagicMock()
        mock_client.get_object.return_value = mock_response

        with pytest.raises(IOError):
            download_photo(mock_client, sample_photo_record)

        mock_response.close.assert_called_once()
        mock_response.release_conn.assert_called_once()


class TestBuildMinioClient:
    @patch("src.clients.storage.settings")
    def test_http_endpoint(self, mock_settings):
        mock_settings.s3_endpoint = "http://localhost:9000"
        mock_settings.s3_access_key = "access"
        mock_settings.s3_secret_key = "secret"
        client = _build_minio_client()
        # Minio client stores endpoint without scheme
        assert client._base_url._url.hostname == "localhost"

    @patch("src.clients.storage.settings")
    def test_https_endpoint(self, mock_settings):
        mock_settings.s3_endpoint = "https://s3.example.com"
        mock_settings.s3_access_key = "access"
        mock_settings.s3_secret_key = "secret"
        client = _build_minio_client()
        assert client._base_url._url.scheme == "https"


class TestFetchObservationPhotos:
    @pytest.mark.asyncio
    async def test_observation_not_found(self, mock_pool, obs_id):
        mock_pool.fetchrow.return_value = None
        result = await fetch_observation_photos(mock_pool, obs_id)
        assert result is None

    @pytest.mark.asyncio
    async def test_no_photos_returns_empty_list(self, mock_pool, obs_id):
        mock_pool.fetchrow.return_value = {
            "id": UUID(obs_id),
            "tree_id": None,
            "latitude": 30.0,
            "longitude": -97.0,
            "status": "pending_ai",
        }
        mock_pool.fetch.return_value = []
        result = await fetch_observation_photos(mock_pool, obs_id)
        assert result is not None
        obs, photos = result
        assert obs.id == obs_id
        assert photos == []

    @pytest.mark.asyncio
    @patch("src.clients.storage._build_minio_client")
    @patch("src.clients.storage.download_photo")
    async def test_downloads_all_photos(self, mock_download, mock_build_client, mock_pool, obs_id):
        mock_pool.fetchrow.return_value = {
            "id": UUID(obs_id),
            "tree_id": None,
            "latitude": 30.0,
            "longitude": -97.0,
            "status": "pending_ai",
        }
        mock_pool.fetch.return_value = [
            {
                "id": UUID("00000000-0000-0000-0000-000000000010"),
                "observation_id": UUID(obs_id),
                "photo_type": "full_tree_angle1",
                "storage_key": "k1",
                "storage_url": None,
                "mime_type": "image/jpeg",
            },
        ]
        mock_download.return_value = DownloadedPhoto(
            record=PhotoRecord(
                id="00000000-0000-0000-0000-000000000010",
                observation_id=obs_id,
                photo_type="full_tree_angle1",
                storage_key="k1",
                storage_url=None,
                mime_type="image/jpeg",
            ),
            data=b"photo-bytes",
        )

        result = await fetch_observation_photos(mock_pool, obs_id)
        assert result is not None
        obs, photos = result
        assert len(photos) == 1
        assert photos[0].data == b"photo-bytes"

    @pytest.mark.asyncio
    @patch("src.clients.storage._build_minio_client")
    @patch("src.clients.storage.download_photo")
    async def test_continues_on_download_failure(self, mock_download, mock_build_client, mock_pool, obs_id):
        """If one photo fails to download, others should still be fetched."""
        mock_pool.fetchrow.return_value = {
            "id": UUID(obs_id),
            "tree_id": None,
            "latitude": 30.0,
            "longitude": -97.0,
            "status": "pending_ai",
        }
        mock_pool.fetch.return_value = [
            {
                "id": UUID("00000000-0000-0000-0000-000000000010"),
                "observation_id": UUID(obs_id),
                "photo_type": "full_tree_angle1",
                "storage_key": "k1",
                "storage_url": None,
                "mime_type": "image/jpeg",
            },
            {
                "id": UUID("00000000-0000-0000-0000-000000000011"),
                "observation_id": UUID(obs_id),
                "photo_type": "bark_closeup",
                "storage_key": "k2",
                "storage_url": None,
                "mime_type": "image/jpeg",
            },
        ]
        # First photo fails, second succeeds
        mock_download.side_effect = [
            Exception("download failed"),
            DownloadedPhoto(
                record=PhotoRecord(
                    id="00000000-0000-0000-0000-000000000011",
                    observation_id=obs_id,
                    photo_type="bark_closeup",
                    storage_key="k2",
                    storage_url=None,
                    mime_type="image/jpeg",
                ),
                data=b"photo2",
            ),
        ]

        result = await fetch_observation_photos(mock_pool, obs_id)
        assert result is not None
        obs, photos = result
        assert len(photos) == 1
        assert photos[0].record.photo_type == "bark_closeup"
