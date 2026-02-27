"""Species identification with consensus logic between Pl@ntNet and LLM."""

import asyncio
import logging
from dataclasses import dataclass
from pathlib import Path

from src.clients.plantnet import identify as plantnet_identify, PlantNetResult
from src.clients.llm import query as llm_query, extract_json, LLMResponse
from src.utils.geocode import reverse_geocode

logger = logging.getLogger(__name__)

PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "species_validation.txt"

# Confidence caps per bible Section 6a
CAP_BOTH_AGREE = 0.95
CAP_GENUS_AGREE = 0.70
CAP_DISAGREE = 0.40
GEOGRAPHIC_BOOST = 0.05


@dataclass
class SpeciesResult:
    """Final species identification result matching the API contract."""

    common: str
    scientific: str
    genus: str
    confidence: float


@dataclass
class LLMSpecies:
    """Parsed species identification from the LLM."""

    common: str
    scientific: str
    confidence: float
    genus: str


def _parse_llm_species(response: LLMResponse) -> LLMSpecies | None:
    """Parse LLM response into a species identification.

    Args:
        response: Raw LLM response.

    Returns:
        LLMSpecies or None if parsing fails.
    """
    data = extract_json(response.text)
    if data is None:
        logger.warning("Failed to parse species JSON from LLM response")
        return None

    common = data.get("common", "")
    scientific = data.get("scientific", "")
    confidence = data.get("confidence", 0.0)

    if not scientific:
        logger.warning("LLM returned empty scientific name")
        return None

    genus = scientific.split()[0] if scientific else ""

    return LLMSpecies(
        common=common,
        scientific=scientific,
        confidence=float(confidence),
        genus=genus,
    )


def consensus(
    plantnet: PlantNetResult | None,
    llm_species: LLMSpecies | None,
) -> SpeciesResult | None:
    """Apply consensus logic between Pl@ntNet and LLM results.

    Rules from bible Section 6a:
    - Both agree on species → confidence = average, capped at 0.95
    - Agree on genus, differ on species → use Pl@ntNet species, cap at 0.70
    - Total disagreement → use Pl@ntNet, cap at 0.40
    - If only one source available, use it with reduced confidence

    Args:
        plantnet: Pl@ntNet identification result (may be None).
        llm_species: LLM species identification (may be None).

    Returns:
        SpeciesResult or None if both sources failed.
    """
    pn_best = plantnet.best_match if plantnet else None

    # Both failed
    if pn_best is None and llm_species is None:
        logger.warning("Both Pl@ntNet and LLM failed — no species result")
        return None

    # Only LLM available (Pl@ntNet failed)
    if pn_best is None and llm_species is not None:
        logger.info("Pl@ntNet failed, using LLM-only result (capped at 0.60)")
        return SpeciesResult(
            common=llm_species.common,
            scientific=llm_species.scientific,
            genus=llm_species.genus,
            confidence=min(llm_species.confidence, 0.60),
        )

    # Only Pl@ntNet available (LLM failed)
    if pn_best is not None and llm_species is None:
        logger.info("LLM failed, using Pl@ntNet-only result (capped at 0.70)")
        common = pn_best.common_names[0] if pn_best.common_names else ""
        return SpeciesResult(
            common=common,
            scientific=pn_best.scientific_name,
            genus=pn_best.genus,
            confidence=min(pn_best.score, 0.70),
        )

    # Both available — apply consensus
    assert pn_best is not None and llm_species is not None

    pn_scientific = pn_best.scientific_name.lower().strip()
    llm_scientific = llm_species.scientific.lower().strip()
    pn_genus = pn_best.genus.lower().strip()
    llm_genus = llm_species.genus.lower().strip()

    common = pn_best.common_names[0] if pn_best.common_names else llm_species.common

    if pn_scientific == llm_scientific:
        # Full agreement
        avg_conf = (pn_best.score + llm_species.confidence) / 2
        confidence = min(avg_conf, CAP_BOTH_AGREE)
        logger.info(
            "Species consensus: AGREE on %s (conf=%.3f)",
            pn_best.scientific_name, confidence,
        )
        return SpeciesResult(
            common=common,
            scientific=pn_best.scientific_name,
            genus=pn_best.genus,
            confidence=round(confidence, 3),
        )

    if pn_genus == llm_genus:
        # Genus agreement, species disagreement
        confidence = min(pn_best.score, CAP_GENUS_AGREE)
        logger.info(
            "Species consensus: GENUS AGREE (%s) but species differ "
            "(Pl@ntNet=%s, LLM=%s, conf=%.3f)",
            pn_genus, pn_best.scientific_name, llm_species.scientific, confidence,
        )
        return SpeciesResult(
            common=common,
            scientific=pn_best.scientific_name,
            genus=pn_best.genus,
            confidence=round(confidence, 3),
        )

    # Total disagreement — use Pl@ntNet
    confidence = min(pn_best.score, CAP_DISAGREE)
    logger.info(
        "Species consensus: DISAGREE (Pl@ntNet=%s, LLM=%s, conf=%.3f)",
        pn_best.scientific_name, llm_species.scientific, confidence,
    )
    return SpeciesResult(
        common=common,
        scientific=pn_best.scientific_name,
        genus=pn_best.genus,
        confidence=round(confidence, 3),
    )


def apply_geographic_boost(result: SpeciesResult, common_species: list[str]) -> SpeciesResult:
    """Boost confidence if species is in local common species list.

    Args:
        result: Current species result.
        common_species: List of scientific names common to the area.

    Returns:
        SpeciesResult with potentially boosted confidence.
    """
    if result.scientific.lower() in [s.lower() for s in common_species]:
        boosted = min(result.confidence + GEOGRAPHIC_BOOST, CAP_BOTH_AGREE)
        logger.info(
            "Geographic boost applied: %s %.3f → %.3f",
            result.scientific, result.confidence, boosted,
        )
        return SpeciesResult(
            common=result.common,
            scientific=result.scientific,
            genus=result.genus,
            confidence=round(boosted, 3),
        )
    return result


async def analyze_species(
    photos: list[tuple[bytes, str]],
    latitude: float | None = None,
    longitude: float | None = None,
) -> SpeciesResult | None:
    """Run species identification pipeline.

    Calls Pl@ntNet and LLM in parallel, then applies consensus logic.

    Args:
        photos: List of (image_bytes, photo_type) tuples.
        latitude: GPS latitude for geographic context.
        longitude: GPS longitude for geographic context.

    Returns:
        SpeciesResult or None if identification fails completely.
    """
    # Resolve geographic region for prompt context
    region = "unknown"
    if latitude is not None and longitude is not None:
        region = await reverse_geocode(latitude, longitude)

    # Build LLM prompt
    prompt_template = PROMPT_PATH.read_text()
    prompt = prompt_template.format(
        latitude=latitude or "unknown",
        longitude=longitude or "unknown",
        region=region,
    )

    # Prepare image data for LLM
    llm_images = [(img_bytes, "image/jpeg") for img_bytes, _ in photos]

    # Run both in parallel
    plantnet_result: PlantNetResult | None = None
    llm_result: LLMSpecies | None = None

    async def _run_plantnet():
        nonlocal plantnet_result
        try:
            plantnet_result = await plantnet_identify(photos)
        except Exception:
            logger.exception("Pl@ntNet identification failed")

    async def _run_llm():
        nonlocal llm_result
        try:
            response = await llm_query(prompt, images=llm_images)
            llm_result = _parse_llm_species(response)
        except Exception:
            logger.exception("LLM species identification failed")

    await asyncio.gather(_run_plantnet(), _run_llm())

    return consensus(plantnet_result, llm_result)
