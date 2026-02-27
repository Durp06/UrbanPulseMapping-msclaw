#!/usr/bin/env python3
"""End-to-end test of the AI pipeline using public domain tree photos.

Usage:
    cd apps/ai-pipeline && python scripts/test_e2e.py

Requires: PLANTNET_API_KEY and GOOGLE_API_KEY (or ANTHROPIC_API_KEY) in .env
"""

import asyncio
import logging
import sys
import traceback
from pathlib import Path

import httpx

# Ensure the ai-pipeline src is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.config import settings  # noqa: E402
from src.analyzers.species import analyze_species, SpeciesResult  # noqa: E402
from src.analyzers.health import analyze_health, HealthResult  # noqa: E402
from src.analyzers.measurements import analyze_measurements, MeasurementResult  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("e2e")

# Public domain tree photos (Quercus virginiana / Southern Live Oak)
# Using full-resolution URLs which are more stable than thumbnails
PHOTO_URLS = [
    (
        "https://upload.wikimedia.org/wikipedia/commons/d/d4/"
        "Big_tree_park_tree.JPG",
        "full_tree",
    ),
    (
        "https://upload.wikimedia.org/wikipedia/commons/6/sixty/"
        "Bark_of_Quercus_macrocarpa.jpg",
        "bark",
    ),
]

# Fallbacks if the primary URLs fail - using stable Unsplash URLs
FALLBACK_URLS = [
    (
        "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=800",
        "full_tree",
    ),
    (
        "https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=800",
        "bark",
    ),
]

AUSTIN_LAT = 30.2672
AUSTIN_LNG = -97.7431


async def download_photos() -> list[tuple[bytes, str]]:
    """Download test photos, falling back to alternates if needed."""
    photos: list[tuple[bytes, str]] = []
    headers = {"User-Agent": "UrbanPulseMapping/1.0 (https://github.com/urbanpulse; contact@urbanpulse.dev)"}
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True, headers=headers) as client:
        for url_set in [PHOTO_URLS, FALLBACK_URLS]:
            if photos:
                break
            attempt: list[tuple[bytes, str]] = []
            for url, label in url_set:
                try:
                    logger.info("Downloading %s photo: %s", label, url[:80] + "...")
                    resp = await client.get(url)
                    resp.raise_for_status()
                    content_type = resp.headers.get("content-type", "image/jpeg")
                    attempt.append((resp.content, content_type))
                    logger.info("  ✓ %s — %d bytes", label, len(resp.content))
                except Exception as exc:
                    logger.warning("  ✗ Failed to download %s: %s", label, exc)
                    break
            else:
                # All photos in this set downloaded successfully
                photos = attempt

    if not photos:
        logger.error("Could not download any test photos. Aborting.")
        sys.exit(1)

    return photos


def print_species(result: SpeciesResult | None) -> None:
    print("\n=== SPECIES ===")
    if result is None:
        print("  (analyzer returned None)")
        return
    print(f"  Common:     {result.common}")
    print(f"  Scientific: {result.scientific}")
    print(f"  Genus:      {result.genus}")
    print(f"  Confidence: {result.confidence:.2f}")


def print_health(result: HealthResult | None) -> None:
    print("\n=== HEALTH ===")
    if result is None:
        print("  (analyzer returned None)")
        return
    print(f"  Structural: {result.condition_structural}")
    print(f"  Leaf:       {result.condition_leaf}")
    print(f"  Confidence: {result.confidence:.2f}")
    print(f"  Observations: {result.observations}")
    print(f"  Notes:      {result.notes}")


def print_measurements(result: MeasurementResult | None) -> None:
    print("\n=== MEASUREMENTS ===")
    if result is None:
        print("  (analyzer returned None)")
        return
    print(f"  DBH:         {result.dbh_cm:.1f} cm ({result.dbh_in:.1f} in)")
    print(f"  Height:      {result.height_m:.1f} m ({result.height_ft:.1f} ft)")
    if result.crown_width_m is not None and result.crown_width_ft is not None:
        print(f"  Crown Width: {result.crown_width_m:.1f} m ({result.crown_width_ft:.1f} ft)")
    else:
        print("  Crown Width: N/A")
    print(f"  Stems:       {result.num_stems}")


async def main() -> None:
    print("=" * 60)
    print("  UrbanPulseMapping — AI Pipeline E2E Test")
    print("=" * 60)

    # Verify config
    if not settings.plantnet_api_key:
        logger.error("PLANTNET_API_KEY not set in .env")
        sys.exit(1)

    llm_key = settings.google_api_key or settings.anthropic_api_key or settings.openai_api_key
    if not llm_key:
        logger.error("No LLM API key set (GOOGLE_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY)")
        sys.exit(1)

    print(f"\nLLM provider: {settings.llm_provider} ({settings.llm_model})")
    print(f"Pl@ntNet key: ...{settings.plantnet_api_key[-6:]}")
    print(f"Location:     Austin, TX ({AUSTIN_LAT}, {AUSTIN_LNG})")

    # Step 1: Download photos
    print("\n--- Downloading test photos ---")
    photos = await download_photos()
    print(f"Downloaded {len(photos)} photos\n")

    # Step 2: Run species analyzer
    species_result: SpeciesResult | None = None
    try:
        print("--- Running species analyzer ---")
        species_result = await analyze_species(
            photos, latitude=AUSTIN_LAT, longitude=AUSTIN_LNG
        )
        print_species(species_result)
    except Exception:
        print("\n=== SPECIES ===")
        print(f"  ERROR: {traceback.format_exc()}")

    # Step 3: Run health analyzer
    health_result: HealthResult | None = None
    try:
        print("\n--- Running health analyzer ---")
        health_result = await analyze_health(photos)
        print_health(health_result)
    except Exception:
        print("\n=== HEALTH ===")
        print(f"  ERROR: {traceback.format_exc()}")

    # Step 4: Run measurements analyzer
    species_name = species_result.scientific if species_result else None
    try:
        print("\n--- Running measurements analyzer ---")
        measurement_result = await analyze_measurements(
            photos, species_scientific=species_name
        )
        print_measurements(measurement_result)
    except Exception:
        print("\n=== MEASUREMENTS ===")
        print(f"  ERROR: {traceback.format_exc()}")

    # Summary
    print("\n" + "=" * 60)
    passed = sum([
        species_result is not None,
        health_result is not None,
        measurement_result is not None,  # type: ignore[possibly-undefined]
    ])
    print(f"  Results: {passed}/3 analyzers succeeded")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
