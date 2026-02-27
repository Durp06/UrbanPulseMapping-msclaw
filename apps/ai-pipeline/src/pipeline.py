"""Main pipeline orchestration — fetch photos → analyze → POST results."""

import asyncio
import json
import logging
from dataclasses import dataclass, asdict

import httpx

from src.config import settings
from src.clients.storage import (
    fetch_observation_photos,
    ObservationRecord,
    DownloadedPhoto,
)
from src.analyzers.species import analyze_species, SpeciesResult
from src.analyzers.health import analyze_health, HealthResult
from src.analyzers.measurements import analyze_measurements, MeasurementResult
from src.analyzers.site import analyze_site, SiteResult
from src.utils.quality import filter_quality_photos

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = 30.0
MAX_RETRIES = 3


@dataclass
class AIResult:
    """Full AI analysis result matching the API contract."""

    species: dict | None = None
    health: dict | None = None
    measurements: dict | None = None
    site: dict | None = None


def _build_ai_result(
    species: SpeciesResult | None,
    health: HealthResult | None,
    measurements: MeasurementResult | None,
    site: SiteResult | None,
) -> AIResult:
    """Assemble the AIResult payload.

    Args:
        species: Species identification result.
        health: Health assessment result.
        measurements: Physical measurement result.
        site: Site/inspection assessment result.

    Returns:
        AIResult with properly formatted dicts. Unfillable fields are null.
    """
    species_dict = None
    if species:
        species_dict = {
            "common": species.common,
            "scientific": species.scientific,
            "genus": species.genus,
            "confidence": species.confidence,
        }

    health_dict = None
    if health:
        health_dict = {
            "conditionStructural": health.condition_structural,
            "conditionLeaf": health.condition_leaf,
            "confidence": health.confidence,
            "observations": health.observations,
            "notes": health.notes,
        }

    measurements_dict = None
    if measurements:
        measurements_dict = {
            "dbhCm": measurements.dbh_cm,
            "dbhIn": measurements.dbh_in,
            "heightM": measurements.height_m,
            "heightFt": measurements.height_ft,
            "crownWidthM": measurements.crown_width_m,
            "crownWidthFt": measurements.crown_width_ft,
            "numStems": measurements.num_stems,
        }

    site_dict = None
    if site:
        site_dict = {
            "conditionRating": site.condition_rating,
            "crownDieback": site.crown_dieback,
            "trunkDefects": site.trunk_defects if site.trunk_defects else [],
            "locationType": site.location_type,
            "siteType": site.site_type,
            "overheadUtilityConflict": site.overhead_utility_conflict,
            "maintenanceFlag": site.maintenance_flag,
            "sidewalkDamage": site.sidewalk_damage,
            "mulchSoilCondition": site.mulch_soil_condition,
            "riskFlag": site.risk_flag,
        }

    return AIResult(
        species=species_dict,
        health=health_dict,
        measurements=measurements_dict,
        site=site_dict,
    )


async def post_ai_result(
    observation_id: str,
    result: AIResult,
    timeout: float = DEFAULT_TIMEOUT,
) -> bool:
    """POST AI results to the Fastify API.

    Args:
        observation_id: UUID of the observation.
        result: Assembled AIResult payload.
        timeout: Request timeout in seconds.

    Returns:
        True if the POST succeeded, False otherwise.
    """
    url = f"{settings.api_base_url}/api/internal/observations/{observation_id}/ai-result"
    headers = {
        "X-Internal-API-Key": settings.internal_api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "species": result.species,
        "health": result.health,
        "measurements": result.measurements,
        "site": result.site,
    }

    last_error: Exception | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            logger.info(
                "Posting AI result for observation %s (attempt %d/%d)",
                observation_id, attempt, MAX_RETRIES,
            )
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()

            logger.info(
                "AI result posted successfully for observation %s (status=%d)",
                observation_id, response.status_code,
            )
            return True

        except httpx.HTTPStatusError as e:
            last_error = e
            if e.response.status_code == 401:
                logger.error(
                    "Auth failed posting AI result (check INTERNAL_API_KEY): %d",
                    e.response.status_code,
                )
                return False
            if e.response.status_code >= 500:
                logger.warning(
                    "Server error %d posting AI result (attempt %d/%d)",
                    e.response.status_code, attempt, MAX_RETRIES,
                )
            else:
                logger.error(
                    "Client error %d posting AI result: %s",
                    e.response.status_code, e.response.text,
                )
                return False
        except (httpx.TimeoutException, httpx.RequestError) as e:
            last_error = e
            logger.warning(
                "Request error posting AI result (attempt %d/%d): %s",
                attempt, MAX_RETRIES, e,
            )

        if attempt < MAX_RETRIES:
            wait = 2 ** attempt
            await asyncio.sleep(wait)

    logger.error(
        "Failed to post AI result for observation %s after %d attempts",
        observation_id, MAX_RETRIES,
    )
    return False


async def run_pipeline(observation_id: str, pool) -> bool:
    """Run the full AI pipeline for an observation.

    1. Fetch observation + photos from DB/MinIO
    2. Run species + health + site analyzers in parallel
    3. Run measurements (after species, for allometric context)
    4. Assemble and POST results

    Args:
        observation_id: UUID of the observation to process.
        pool: asyncpg connection pool.

    Returns:
        True if pipeline completed and results were posted, False otherwise.
    """
    logger.info("Pipeline starting for observation %s", observation_id)

    # Step 1: Fetch observation and photos
    fetch_result = await fetch_observation_photos(pool, observation_id)
    if fetch_result is None:
        logger.error("Observation %s not found — aborting pipeline", observation_id)
        return False

    observation, downloaded_photos = fetch_result

    if not downloaded_photos:
        logger.error("No photos for observation %s — aborting pipeline", observation_id)
        return False

    # Prepare photo tuples for analyzers: (bytes, photo_type)
    raw_photos = [(p.data, p.record.photo_type) for p in downloaded_photos]

    logger.info(
        "Fetched observation %s: %d photos, lat=%.4f, lon=%.4f",
        observation_id, len(raw_photos), observation.latitude, observation.longitude,
    )

    # Quality filter
    photos, quality_issues = filter_quality_photos(raw_photos)
    if quality_issues:
        logger.warning("Quality issues for %s: %s", observation_id, quality_issues)
    if not photos:
        logger.error(
            "All photos failed quality checks for observation %s — aborting",
            observation_id,
        )
        return False

    # Step 2: Run species + health + site in parallel
    species_result: SpeciesResult | None = None
    health_result: HealthResult | None = None
    site_result: SiteResult | None = None

    async def _run_species():
        nonlocal species_result
        species_result = await analyze_species(
            photos,
            latitude=observation.latitude,
            longitude=observation.longitude,
        )

    async def _run_health():
        nonlocal health_result
        health_result = await analyze_health(photos)

    async def _run_site():
        nonlocal site_result
        site_result = await analyze_site(photos)

    await asyncio.gather(_run_species(), _run_health(), _run_site())

    # Step 3: Run measurements (after species for allometric context)
    species_name = species_result.scientific if species_result else None
    measurement_result = await analyze_measurements(photos, species_scientific=species_name)

    # Step 4: Assemble and POST
    ai_result = _build_ai_result(species_result, health_result, measurement_result, site_result)

    # Check if we got anything useful
    if (ai_result.species is None and ai_result.health is None
            and ai_result.measurements is None and ai_result.site is None):
        logger.error(
            "All analyses failed for observation %s — nothing to post",
            observation_id,
        )
        return False

    logger.info(
        "Pipeline results for %s: species=%s, health=%s, measurements=%s, site=%s",
        observation_id,
        "✓" if ai_result.species else "✗",
        "✓" if ai_result.health else "✗",
        "✓" if ai_result.measurements else "✗",
        "✓" if ai_result.site else "✗",
    )

    success = await post_ai_result(observation_id, ai_result)
    return success
