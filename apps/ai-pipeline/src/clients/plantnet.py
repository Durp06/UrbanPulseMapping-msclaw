"""Pl@ntNet API v2 client for plant species identification."""

import asyncio
import logging
from dataclasses import dataclass

import requests

from src.config import settings

logger = logging.getLogger(__name__)

PLANTNET_URL = "https://my-api.plantnet.org/v2/identify/all"

# Map our photo types to Pl@ntNet organ tags
ORGAN_MAP: dict[str, str] = {
    "full_tree_angle1": "habit",
    "full_tree_angle2": "habit",
    "bark_closeup": "bark",
}

DEFAULT_TIMEOUT = 30.0
MAX_RETRIES = 3


@dataclass
class PlantNetSpecies:
    """A single species result from Pl@ntNet."""

    scientific_name: str
    common_names: list[str]
    score: float
    genus: str


@dataclass
class PlantNetResult:
    """Full Pl@ntNet identification result."""

    species: list[PlantNetSpecies]
    best_match: PlantNetSpecies | None
    remaining_identification_requests: int | None


def _parse_response(data: dict) -> PlantNetResult:
    """Parse Pl@ntNet API response into structured result.

    Args:
        data: Raw JSON response from the API.

    Returns:
        Parsed PlantNetResult.
    """
    species_list: list[PlantNetSpecies] = []

    for result in data.get("results", []):
        species_info = result.get("species", {})
        scientific = species_info.get("scientificNameWithoutAuthor", "")
        common = list(species_info.get("commonNames", []))
        score = result.get("score", 0.0)

        # Extract genus from scientific name (first word)
        genus = scientific.split()[0] if scientific else ""

        species_list.append(
            PlantNetSpecies(
                scientific_name=scientific,
                common_names=common,
                score=score,
                genus=genus,
            )
        )

    remaining = data.get("remainingIdentificationRequests")

    return PlantNetResult(
        species=species_list,
        best_match=species_list[0] if species_list else None,
        remaining_identification_requests=remaining,
    )


async def identify(
    photos: list[tuple[bytes, str]],
    api_key: str | None = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> PlantNetResult:
    """Send photos to Pl@ntNet for species identification.

    Args:
        photos: List of (image_bytes, photo_type) tuples.
            photo_type should be one of: full_tree_angle1, full_tree_angle2, bark_closeup.
        api_key: Pl@ntNet API key. Uses settings if not provided.
        timeout: Request timeout in seconds.

    Returns:
        PlantNetResult with ranked species identifications.

    Raises:
        requests.HTTPError: If the API returns an error status.
        requests.Timeout: If the request times out.
        ValueError: If no photos are provided or API key is missing.
    """
    key = api_key or settings.plantnet_api_key
    if not key:
        raise ValueError("Pl@ntNet API key is required (set PLANTNET_API_KEY)")

    if not photos:
        raise ValueError("At least one photo is required")

    # Build multipart form data
    organs: list[str] = []
    for _img_bytes, photo_type in photos:
        organ = ORGAN_MAP.get(photo_type, "habit")
        organs.append(organ)

    params = {
        "api-key": key,
    }

    # Build multipart data - stored as (bytes, filename) for each request
    photo_data: list[tuple[bytes, str]] = []
    for i, (img_bytes, _pt) in enumerate(photos):
        photo_data.append((img_bytes, f"photo_{i}.jpg"))

    data_list: list[tuple[str, str]] = [("organs", organ) for organ in organs]

    def _sync_post() -> requests.Response:
        """Synchronous POST using requests - works around Python 3.14 httpx multipart bug."""
        # Build files list for requests library
        files_list = [
            ("images", (filename, img_bytes, "image/jpeg"))
            for img_bytes, filename in photo_data
        ]
        return requests.post(
            PLANTNET_URL,
            params=params,
            files=files_list,
            data=data_list,
            timeout=timeout,
        )

    last_error: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            logger.info(
                "Pl@ntNet request attempt %d/%d (%d photos, organs=%s)",
                attempt, MAX_RETRIES, len(photos), organs,
            )
            # Use asyncio.to_thread to run sync requests in thread pool
            # This works around a Python 3.14 + httpx multipart bug
            response = await asyncio.to_thread(_sync_post)
            response.raise_for_status()
            result_data = response.json()

            result = _parse_response(result_data)

            if result.remaining_identification_requests is not None:
                logger.info(
                    "Pl@ntNet remaining requests today: %d",
                    result.remaining_identification_requests,
                )

            if result.best_match:
                logger.info(
                    "Pl@ntNet best match: %s (score=%.3f)",
                    result.best_match.scientific_name,
                    result.best_match.score,
                )
            else:
                logger.warning("Pl@ntNet returned no results")

            return result

        except requests.Timeout as e:
            last_error = e
            logger.warning("Pl@ntNet request timed out (attempt %d/%d)", attempt, MAX_RETRIES)
        except requests.HTTPError as e:
            last_error = e
            if e.response is not None:
                if e.response.status_code == 429:
                    logger.warning("Pl@ntNet rate limited (attempt %d/%d)", attempt, MAX_RETRIES)
                elif e.response.status_code >= 500:
                    logger.warning("Pl@ntNet server error %d (attempt %d/%d)", e.response.status_code, attempt, MAX_RETRIES)
                else:
                    # Client errors (400, 401, etc.) — don't retry
                    raise
            else:
                raise
        except requests.RequestException as e:
            last_error = e
            logger.warning("Pl@ntNet request failed (attempt %d/%d): %s", attempt, MAX_RETRIES, e)

        # Exponential backoff before retry
        if attempt < MAX_RETRIES:
            wait = 2 ** attempt
            logger.info("Retrying in %ds...", wait)
            await asyncio.sleep(wait)

    # All retries exhausted
    logger.error("Pl@ntNet identification failed after %d attempts", MAX_RETRIES)
    raise last_error  # type: ignore[misc]
