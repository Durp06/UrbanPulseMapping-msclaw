"""Tests for the Pl@ntNet API client."""

import pytest
import requests
from unittest.mock import AsyncMock, patch, MagicMock

from src.clients.plantnet import (
    identify,
    _parse_response,
    PlantNetResult,
    PlantNetSpecies,
    PLANTNET_URL,
    ORGAN_MAP,
)


SAMPLE_RESPONSE = {
    "results": [
        {
            "score": 0.85,
            "species": {
                "scientificNameWithoutAuthor": "Quercus virginiana",
                "commonNames": ["Live Oak", "Southern Live Oak"],
            },
        },
        {
            "score": 0.10,
            "species": {
                "scientificNameWithoutAuthor": "Quercus fusiformis",
                "commonNames": ["Plateau Live Oak"],
            },
        },
    ],
    "remainingIdentificationRequests": 495,
}

EMPTY_RESPONSE = {"results": [], "remainingIdentificationRequests": 499}

FAKE_PHOTO = b"\xff\xd8\xff\xe0fake-jpeg"


def _mock_response(status_code: int, json_data: dict) -> MagicMock:
    """Create a mock requests Response."""
    mock_resp = MagicMock(spec=requests.Response)
    mock_resp.status_code = status_code
    mock_resp.json.return_value = json_data
    if status_code >= 400:
        mock_resp.raise_for_status.side_effect = requests.HTTPError(response=mock_resp)
    else:
        mock_resp.raise_for_status.return_value = None
    return mock_resp


class TestParseResponse:
    def test_parses_species_list(self):
        result = _parse_response(SAMPLE_RESPONSE)
        assert len(result.species) == 2
        assert result.species[0].scientific_name == "Quercus virginiana"
        assert result.species[0].score == 0.85
        assert "Live Oak" in result.species[0].common_names
        assert result.species[0].genus == "Quercus"

    def test_best_match_is_first(self):
        result = _parse_response(SAMPLE_RESPONSE)
        assert result.best_match is not None
        assert result.best_match.scientific_name == "Quercus virginiana"

    def test_empty_results(self):
        result = _parse_response(EMPTY_RESPONSE)
        assert result.species == []
        assert result.best_match is None

    def test_remaining_requests(self):
        result = _parse_response(SAMPLE_RESPONSE)
        assert result.remaining_identification_requests == 495

    def test_genus_extraction(self):
        result = _parse_response(SAMPLE_RESPONSE)
        assert result.species[0].genus == "Quercus"
        assert result.species[1].genus == "Quercus"


class TestOrganMap:
    def test_full_tree_maps_to_habit(self):
        assert ORGAN_MAP["full_tree_angle1"] == "habit"
        assert ORGAN_MAP["full_tree_angle2"] == "habit"

    def test_bark_maps_to_bark(self):
        assert ORGAN_MAP["bark_closeup"] == "bark"

    def test_unknown_type_defaults_to_habit(self):
        assert ORGAN_MAP.get("unknown_type", "habit") == "habit"


class TestIdentify:
    @pytest.mark.asyncio
    async def test_no_api_key_raises(self):
        with patch("src.clients.plantnet.settings") as mock_settings:
            mock_settings.plantnet_api_key = ""
            with pytest.raises(ValueError, match="API key"):
                await identify([(FAKE_PHOTO, "full_tree_angle1")], api_key="")

    @pytest.mark.asyncio
    async def test_no_photos_raises(self):
        with pytest.raises(ValueError, match="photo"):
            await identify([], api_key="test-key")

    @pytest.mark.asyncio
    async def test_successful_identification(self):
        mock_response = _mock_response(200, SAMPLE_RESPONSE)
        mock_post = MagicMock(return_value=mock_response)

        with patch("src.clients.plantnet.requests.post", mock_post):
            with patch("src.clients.plantnet.asyncio.to_thread", new_callable=AsyncMock) as mock_to_thread:
                # Make to_thread call the function synchronously
                mock_to_thread.side_effect = lambda fn: fn()

                result = await identify(
                    [
                        (FAKE_PHOTO, "full_tree_angle1"),
                        (FAKE_PHOTO, "full_tree_angle2"),
                        (FAKE_PHOTO, "bark_closeup"),
                    ],
                    api_key="test-key",
                )

        assert result.best_match is not None
        assert result.best_match.scientific_name == "Quercus virginiana"
        assert len(result.species) == 2

    @pytest.mark.asyncio
    async def test_empty_results(self):
        mock_response = _mock_response(200, EMPTY_RESPONSE)
        mock_post = MagicMock(return_value=mock_response)

        with patch("src.clients.plantnet.requests.post", mock_post):
            with patch("src.clients.plantnet.asyncio.to_thread", new_callable=AsyncMock) as mock_to_thread:
                mock_to_thread.side_effect = lambda fn: fn()

                result = await identify(
                    [(FAKE_PHOTO, "full_tree_angle1")],
                    api_key="test-key",
                )

        assert result.best_match is None
        assert result.species == []

    @pytest.mark.asyncio
    async def test_sends_correct_params(self):
        mock_response = _mock_response(200, SAMPLE_RESPONSE)
        mock_post = MagicMock(return_value=mock_response)

        with patch("src.clients.plantnet.requests.post", mock_post):
            with patch("src.clients.plantnet.asyncio.to_thread", new_callable=AsyncMock) as mock_to_thread:
                mock_to_thread.side_effect = lambda fn: fn()

                await identify(
                    [(FAKE_PHOTO, "full_tree_angle1"), (FAKE_PHOTO, "bark_closeup")],
                    api_key="test-key",
                )

        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args
        assert call_kwargs.kwargs["params"] == {"api-key": "test-key"}

    @pytest.mark.asyncio
    async def test_client_error_no_retry(self):
        """4xx errors (except 429) should not be retried."""
        mock_response = _mock_response(401, {"error": "unauthorized"})
        mock_post = MagicMock(return_value=mock_response)

        with patch("src.clients.plantnet.requests.post", mock_post):
            with patch("src.clients.plantnet.asyncio.to_thread", new_callable=AsyncMock) as mock_to_thread:
                mock_to_thread.side_effect = lambda fn: fn()

                with pytest.raises(requests.HTTPError):
                    await identify(
                        [(FAKE_PHOTO, "full_tree_angle1")],
                        api_key="bad-key",
                    )

        # Should NOT retry on 401
        assert mock_post.call_count == 1

    @pytest.mark.asyncio
    async def test_retries_on_server_error(self):
        """5xx errors should be retried."""
        error_resp = _mock_response(500, {"error": "internal"})
        ok_resp = _mock_response(200, SAMPLE_RESPONSE)

        call_count = [0]
        def post_side_effect(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] < 3:
                return error_resp
            return ok_resp

        mock_post = MagicMock(side_effect=post_side_effect)

        with patch("src.clients.plantnet.requests.post", mock_post):
            with patch("src.clients.plantnet.asyncio.to_thread", new_callable=AsyncMock) as mock_to_thread:
                mock_to_thread.side_effect = lambda fn: fn()
                with patch("src.clients.plantnet.asyncio.sleep", new_callable=AsyncMock):
                    result = await identify(
                        [(FAKE_PHOTO, "full_tree_angle1")],
                        api_key="test-key",
                    )

        assert result.best_match is not None
        assert mock_post.call_count == 3

    @pytest.mark.asyncio
    async def test_retries_exhausted_raises(self):
        """After MAX_RETRIES failures, should raise last error."""
        error_resp = _mock_response(500, {"error": "down"})
        mock_post = MagicMock(return_value=error_resp)

        with patch("src.clients.plantnet.requests.post", mock_post):
            with patch("src.clients.plantnet.asyncio.to_thread", new_callable=AsyncMock) as mock_to_thread:
                mock_to_thread.side_effect = lambda fn: fn()
                with patch("src.clients.plantnet.asyncio.sleep", new_callable=AsyncMock):
                    with pytest.raises(requests.HTTPError):
                        await identify(
                            [(FAKE_PHOTO, "full_tree_angle1")],
                            api_key="test-key",
                        )

        assert mock_post.call_count == 3  # MAX_RETRIES

    @pytest.mark.asyncio
    async def test_retries_on_rate_limit(self):
        """429 should be retried."""
        rate_resp = _mock_response(429, {"error": "rate limited"})
        ok_resp = _mock_response(200, SAMPLE_RESPONSE)

        call_count = [0]
        def post_side_effect(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] < 2:
                return rate_resp
            return ok_resp

        mock_post = MagicMock(side_effect=post_side_effect)

        with patch("src.clients.plantnet.requests.post", mock_post):
            with patch("src.clients.plantnet.asyncio.to_thread", new_callable=AsyncMock) as mock_to_thread:
                mock_to_thread.side_effect = lambda fn: fn()
                with patch("src.clients.plantnet.asyncio.sleep", new_callable=AsyncMock):
                    result = await identify(
                        [(FAKE_PHOTO, "full_tree_angle1")],
                        api_key="test-key",
                    )

        assert result.best_match is not None
        assert mock_post.call_count == 2

    @pytest.mark.asyncio
    async def test_retries_on_timeout(self):
        """Timeout exceptions should be retried."""
        ok_resp = _mock_response(200, SAMPLE_RESPONSE)

        call_count = [0]
        def post_side_effect(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] < 2:
                raise requests.Timeout("timeout")
            return ok_resp

        mock_post = MagicMock(side_effect=post_side_effect)

        with patch("src.clients.plantnet.requests.post", mock_post):
            with patch("src.clients.plantnet.asyncio.to_thread", new_callable=AsyncMock) as mock_to_thread:
                mock_to_thread.side_effect = lambda fn: fn()
                with patch("src.clients.plantnet.asyncio.sleep", new_callable=AsyncMock):
                    result = await identify(
                        [(FAKE_PHOTO, "full_tree_angle1")],
                        api_key="test-key",
                    )

        assert result.best_match is not None
        assert mock_post.call_count == 2
