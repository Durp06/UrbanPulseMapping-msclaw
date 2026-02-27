"""DBH + height + crown width estimation analyzer — uses LLM vision for measurements."""

import logging
from dataclasses import dataclass
from pathlib import Path

from src.clients.llm import query as llm_query, extract_json

logger = logging.getLogger(__name__)

PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "measurement_estimation.txt"

# Conversion constants
CM_PER_INCH = 2.54
FT_PER_METER = 3.28084


@dataclass
class MeasurementResult:
    """Physical measurement result matching the municipal API contract.

    Stores both metric (for internal use) and imperial (for Austin municipal export).
    """

    dbh_cm: float
    dbh_in: float
    height_m: float
    height_ft: float
    crown_width_m: float | None
    crown_width_ft: float | None
    num_stems: int


def parse_measurement_response(text: str) -> MeasurementResult | None:
    """Parse LLM response into a MeasurementResult.

    The LLM returns metric values; we compute imperial conversions here.

    Args:
        text: Raw text from LLM response.

    Returns:
        MeasurementResult or None if parsing fails.
    """
    data = extract_json(text)
    if data is None:
        logger.warning("Failed to extract JSON from measurement response")
        return None

    dbh_cm = data.get("dbhCm")
    height_m = data.get("heightM")

    if dbh_cm is None or height_m is None:
        logger.warning("Missing dbhCm or heightM in measurement response: %s", data)
        return None

    try:
        dbh_cm = float(dbh_cm)
        height_m = float(height_m)
    except (ValueError, TypeError):
        logger.warning("Non-numeric measurement values: dbhCm=%s, heightM=%s", dbh_cm, height_m)
        return None

    if dbh_cm <= 0 or height_m <= 0:
        logger.warning("Measurements must be positive: dbhCm=%.2f, heightM=%.2f", dbh_cm, height_m)
        return None

    # Crown width (optional — LLM may not be able to estimate from photos)
    crown_width_m: float | None = None
    raw_crown = data.get("crownWidthM")
    if raw_crown is not None:
        try:
            crown_width_m = float(raw_crown)
            if crown_width_m <= 0:
                crown_width_m = None
        except (ValueError, TypeError):
            crown_width_m = None

    # Number of stems
    num_stems = 1
    raw_stems = data.get("numStems", 1)
    try:
        num_stems = max(1, int(raw_stems))
    except (ValueError, TypeError):
        num_stems = 1

    # Compute imperial conversions
    dbh_in = round(dbh_cm / CM_PER_INCH, 1)
    height_ft = round(height_m * FT_PER_METER, 1)
    crown_width_ft = round(crown_width_m * FT_PER_METER, 1) if crown_width_m else None

    return MeasurementResult(
        dbh_cm=round(dbh_cm, 1),
        dbh_in=dbh_in,
        height_m=round(height_m, 1),
        height_ft=height_ft,
        crown_width_m=round(crown_width_m, 1) if crown_width_m else None,
        crown_width_ft=crown_width_ft,
        num_stems=num_stems,
    )


async def analyze_measurements(
    photos: list[tuple[bytes, str]],
    species_scientific: str | None = None,
) -> MeasurementResult | None:
    """Estimate tree physical measurements from photos.

    Args:
        photos: List of (image_bytes, photo_type) tuples.
        species_scientific: Known species for allometric cross-reference (optional).

    Returns:
        MeasurementResult or None if estimation fails.
    """
    prompt = PROMPT_PATH.read_text()

    if species_scientific:
        prompt += f"\n\nNote: This tree has been identified as {species_scientific}. "
        prompt += "Use species-typical proportions to validate your estimates."

    llm_images = [(img_bytes, "image/jpeg") for img_bytes, _ in photos]

    try:
        response = await llm_query(prompt, images=llm_images)
        result = parse_measurement_response(response.text)
        if result:
            logger.info(
                "Measurements: DBH=%.1fcm (%.1fin), Height=%.1fm (%.1fft), "
                "Crown=%.1fm, Stems=%d",
                result.dbh_cm, result.dbh_in,
                result.height_m, result.height_ft,
                result.crown_width_m or 0, result.num_stems,
            )
        else:
            logger.warning("Failed to parse measurement response")
        return result
    except Exception:
        logger.exception("Measurement estimation failed")
        return None
