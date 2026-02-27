"""Tests for the pipeline orchestrator and result POST."""

import pytest
import httpx
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

from src.pipeline import (
    run_pipeline,
    post_ai_result,
    _build_ai_result,
    AIResult,
)
from src.analyzers.species import SpeciesResult
from src.analyzers.health import HealthResult
from src.analyzers.measurements import MeasurementResult
from src.clients.storage import ObservationRecord, DownloadedPhoto, PhotoRecord


OBS_ID = "550e8400-e29b-41d4-a716-446655440000"
API_URL = "http://localhost:3000"


def _make_valid_jpeg() -> bytes:
    """Create a minimal valid JPEG for tests that pass quality checks."""
    import io
    from PIL import Image
    import random
    random.seed(42)
    img = Image.new("RGB", (640, 480))
    pixels = img.load()
    for x in range(640):
        for y in range(480):
            pixels[x, y] = (random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def _photo_record(photo_type: str = "full_tree_angle1") -> PhotoRecord:
    return PhotoRecord(
        id="photo-001",
        observation_id=OBS_ID,
        photo_type=photo_type,
        storage_key="uploads/p1.jpg",
        storage_url=None,
        mime_type="image/jpeg",
    )


_VALID_JPEG = _make_valid_jpeg()


def _downloaded_photo(photo_type: str = "full_tree_angle1") -> DownloadedPhoto:
    return DownloadedPhoto(record=_photo_record(photo_type), data=_VALID_JPEG)


def _observation() -> ObservationRecord:
    return ObservationRecord(
        id=OBS_ID,
        tree_id="tree-001",
        latitude=30.2672,
        longitude=-97.7431,
        status="pending_ai",
    )


def _species() -> SpeciesResult:
    return SpeciesResult(common="Live Oak", scientific="Quercus virginiana", genus="Quercus", confidence=0.87)


def _health() -> HealthResult:
    return HealthResult(
        condition_structural="good", condition_leaf="fair",
        confidence=0.82, observations=["deadwood"], notes=["minor deadwood in upper crown"],
    )


def _measurements() -> MeasurementResult:
    return MeasurementResult(
        dbh_cm=45.2, dbh_in=17.8, height_m=12.8, height_ft=42.0,
        crown_width_m=8.5, crown_width_ft=27.9, num_stems=1,
    )


class TestBuildAIResult:
    def test_all_results(self):
        result = _build_ai_result(_species(), _health(), _measurements())

        assert result.species == {
            "common": "Live Oak",
            "scientific": "Quercus virginiana",
            "genus": "Quercus",
            "confidence": 0.87,
        }
        assert result.health == {
            "conditionStructural": "good",
            "conditionLeaf": "fair",
            "confidence": 0.82,
            "observations": ["deadwood"],
            "notes": ["minor deadwood in upper crown"],
        }
        assert result.measurements == {
            "dbhCm": 45.2, "dbhIn": 17.8,
            "heightM": 12.8, "heightFt": 42.0,
            "crownWidthM": 8.5, "crownWidthFt": 27.9,
            "numStems": 1,
        }

    def test_partial_results(self):
        species = SpeciesResult(common="Oak", scientific="Quercus sp.", genus="Quercus", confidence=0.40)
        result = _build_ai_result(species, None, None)
        assert result.species is not None
        assert result.health is None
        assert result.measurements is None

    def test_all_none(self):
        result = _build_ai_result(None, None, None)
        assert result.species is None
        assert result.health is None
        assert result.measurements is None


class TestPostAIResult:
    @pytest.mark.asyncio
    async def test_successful_post(self):
        ai_result = AIResult(
            species={"common": "Oak", "scientific": "Quercus", "genus": "Quercus", "confidence": 0.8},
            health={"conditionStructural": "good", "conditionLeaf": "good", "confidence": 0.7, "observations": [], "notes": []},
            measurements={"dbhCm": 30, "dbhIn": 11.8, "heightM": 10, "heightFt": 32.8, "crownWidthM": None, "crownWidthFt": None, "numStems": 1},
        )

        resp = httpx.Response(200, request=httpx.Request("POST", f"{API_URL}/api/internal/observations/{OBS_ID}/ai-result"))
        mock_post = AsyncMock(return_value=resp)

        with patch("src.pipeline.settings") as mock_settings:
            mock_settings.api_base_url = API_URL
            mock_settings.internal_api_key = "test-key"
            with patch("src.pipeline.httpx.AsyncClient") as MockClient:
                MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
                MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

                success = await post_ai_result(OBS_ID, ai_result)

        assert success is True
        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args
        assert call_kwargs.kwargs["headers"]["X-Internal-API-Key"] == "test-key"
        payload = call_kwargs.kwargs["json"]
        assert payload["species"]["common"] == "Oak"

    @pytest.mark.asyncio
    async def test_auth_failure_no_retry(self):
        ai_result = AIResult(species={"common": "Oak", "scientific": "Quercus", "genus": "Quercus", "confidence": 0.5})

        resp = httpx.Response(401, request=httpx.Request("POST", f"{API_URL}/api/internal/observations/{OBS_ID}/ai-result"))
        resp.raise_for_status = MagicMock(side_effect=httpx.HTTPStatusError(
            "401", request=resp.request, response=resp
        ))
        mock_post = AsyncMock(return_value=resp)

        with patch("src.pipeline.settings") as mock_settings:
            mock_settings.api_base_url = API_URL
            mock_settings.internal_api_key = "bad-key"
            with patch("src.pipeline.httpx.AsyncClient") as MockClient:
                MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
                MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

                success = await post_ai_result(OBS_ID, ai_result)

        assert success is False
        assert mock_post.call_count == 1  # no retry on 401

    @pytest.mark.asyncio
    async def test_retries_on_server_error(self):
        ai_result = AIResult(species={"common": "Oak", "scientific": "Quercus", "genus": "Quercus", "confidence": 0.5})

        error_resp = httpx.Response(500, request=httpx.Request("POST", f"{API_URL}/x"))
        error_resp.raise_for_status = MagicMock(side_effect=httpx.HTTPStatusError(
            "500", request=error_resp.request, response=error_resp
        ))
        ok_resp = httpx.Response(200, request=httpx.Request("POST", f"{API_URL}/x"))

        mock_post = AsyncMock(side_effect=[error_resp, ok_resp])

        with patch("src.pipeline.settings") as mock_settings:
            mock_settings.api_base_url = API_URL
            mock_settings.internal_api_key = "key"
            with patch("src.pipeline.httpx.AsyncClient") as MockClient:
                MockClient.return_value.__aenter__ = AsyncMock(return_value=MagicMock(post=mock_post))
                MockClient.return_value.__aexit__ = AsyncMock(return_value=False)
                with patch("src.pipeline.asyncio.sleep", new_callable=AsyncMock):
                    success = await post_ai_result(OBS_ID, ai_result)

        assert success is True
        assert mock_post.call_count == 2


class TestRunPipeline:
    @pytest.mark.asyncio
    @patch("src.pipeline.post_ai_result")
    @patch("src.pipeline.analyze_measurements")
    @patch("src.pipeline.analyze_health")
    @patch("src.pipeline.analyze_species")
    @patch("src.pipeline.fetch_observation_photos")
    async def test_full_pipeline_success(self, mock_fetch, mock_species, mock_health, mock_measurements, mock_post):
        mock_fetch.return_value = (_observation(), [_downloaded_photo("full_tree_angle1"), _downloaded_photo("bark_closeup")])
        mock_species.return_value = _species()
        mock_health.return_value = _health()
        mock_measurements.return_value = _measurements()
        mock_post.return_value = True

        pool = AsyncMock()
        success = await run_pipeline(OBS_ID, pool)

        assert success is True
        mock_fetch.assert_called_once_with(pool, OBS_ID)
        mock_species.assert_called_once()
        mock_health.assert_called_once()
        mock_measurements.assert_called_once()
        assert mock_measurements.call_args.kwargs["species_scientific"] == "Quercus virginiana"
        mock_post.assert_called_once()

    @pytest.mark.asyncio
    @patch("src.pipeline.fetch_observation_photos")
    async def test_observation_not_found(self, mock_fetch):
        mock_fetch.return_value = None

        pool = AsyncMock()
        success = await run_pipeline(OBS_ID, pool)

        assert success is False

    @pytest.mark.asyncio
    @patch("src.pipeline.fetch_observation_photos")
    async def test_no_photos(self, mock_fetch):
        mock_fetch.return_value = (_observation(), [])

        pool = AsyncMock()
        success = await run_pipeline(OBS_ID, pool)

        assert success is False

    @pytest.mark.asyncio
    @patch("src.pipeline.post_ai_result")
    @patch("src.pipeline.analyze_measurements")
    @patch("src.pipeline.analyze_health")
    @patch("src.pipeline.analyze_species")
    @patch("src.pipeline.fetch_observation_photos")
    async def test_partial_results_still_posted(self, mock_fetch, mock_species, mock_health, mock_measurements, mock_post):
        """If species fails but health succeeds, still post partial results."""
        mock_fetch.return_value = (_observation(), [_downloaded_photo()])
        mock_species.return_value = None
        mock_health.return_value = HealthResult(
            condition_structural="good", condition_leaf="good",
            confidence=0.75, observations=[], notes=[],
        )
        mock_measurements.return_value = None
        mock_post.return_value = True

        pool = AsyncMock()
        success = await run_pipeline(OBS_ID, pool)

        assert success is True
        mock_post.assert_called_once()
        ai_result = mock_post.call_args.args[1]
        assert ai_result.species is None
        assert ai_result.health is not None
        assert ai_result.measurements is None

    @pytest.mark.asyncio
    @patch("src.pipeline.analyze_measurements")
    @patch("src.pipeline.analyze_health")
    @patch("src.pipeline.analyze_species")
    @patch("src.pipeline.fetch_observation_photos")
    async def test_all_analyses_fail(self, mock_fetch, mock_species, mock_health, mock_measurements):
        """If all analyses fail, don't post anything."""
        mock_fetch.return_value = (_observation(), [_downloaded_photo()])
        mock_species.return_value = None
        mock_health.return_value = None
        mock_measurements.return_value = None

        pool = AsyncMock()
        success = await run_pipeline(OBS_ID, pool)

        assert success is False

    @pytest.mark.asyncio
    @patch("src.pipeline.post_ai_result")
    @patch("src.pipeline.analyze_measurements")
    @patch("src.pipeline.analyze_health")
    @patch("src.pipeline.analyze_species")
    @patch("src.pipeline.fetch_observation_photos")
    async def test_species_and_health_run_in_parallel(self, mock_fetch, mock_species, mock_health, mock_measurements, mock_post):
        """Species and health should be called before measurements."""
        call_order = []

        async def track_species(*args, **kwargs):
            call_order.append("species")
            return SpeciesResult(common="Oak", scientific="Quercus alba", genus="Quercus", confidence=0.8)

        async def track_health(*args, **kwargs):
            call_order.append("health")
            return HealthResult(
                condition_structural="good", condition_leaf="good",
                confidence=0.7, observations=[], notes=[],
            )

        async def track_measurements(*args, **kwargs):
            call_order.append("measurements")
            return MeasurementResult(
                dbh_cm=30, dbh_in=11.8, height_m=10, height_ft=32.8,
                crown_width_m=None, crown_width_ft=None, num_stems=1,
            )

        mock_fetch.return_value = (_observation(), [_downloaded_photo()])
        mock_species.side_effect = track_species
        mock_health.side_effect = track_health
        mock_measurements.side_effect = track_measurements
        mock_post.return_value = True

        pool = AsyncMock()
        await run_pipeline(OBS_ID, pool)

        assert "measurements" in call_order
        assert call_order.index("measurements") > call_order.index("species")

    @pytest.mark.asyncio
    @patch("src.pipeline.post_ai_result")
    @patch("src.pipeline.analyze_measurements")
    @patch("src.pipeline.analyze_health")
    @patch("src.pipeline.analyze_species")
    @patch("src.pipeline.fetch_observation_photos")
    async def test_post_failure_returns_false(self, mock_fetch, mock_species, mock_health, mock_measurements, mock_post):
        mock_fetch.return_value = (_observation(), [_downloaded_photo()])
        mock_species.return_value = SpeciesResult(common="Oak", scientific="Quercus", genus="Quercus", confidence=0.5)
        mock_health.return_value = None
        mock_measurements.return_value = None
        mock_post.return_value = False

        pool = AsyncMock()
        success = await run_pipeline(OBS_ID, pool)

        assert success is False
