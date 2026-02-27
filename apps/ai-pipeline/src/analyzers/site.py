"""Site assessment analyzer — uses multimodal LLM to evaluate tree site conditions.

Covers Level 1 municipal inspection fields: condition rating, crown dieback,
trunk defects, location/site type, utilities, maintenance, sidewalk, mulch, risk.
"""

import logging
from dataclasses import dataclass, field
from pathlib import Path

from src.clients.llm import query as llm_query, extract_json

logger = logging.getLogger(__name__)

PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "site_assessment.txt"

VALID_CONDITION_RATINGS = {"excellent", "good", "fair", "poor", "critical", "dead"}
VALID_LOCATION_TYPES = {
    "street", "park", "yard", "median", "parking_lot",
    "commercial", "institutional", "natural_area", "other",
}
VALID_SITE_TYPES = {
    "tree_lawn", "cutout", "open_soil", "raised_planter",
    "container", "unrestricted", "other",
}
VALID_MAINTENANCE_FLAGS = {"none", "routine", "priority", "urgent"}
VALID_MULCH_CONDITIONS = {
    "good_mulch", "no_mulch", "volcano_mulch", "compacted",
    "bare_soil", "grass_to_trunk", "other",
}
VALID_TRUNK_DEFECTS = {
    "cavity", "crack", "decay", "lean", "wound", "conk",
    "bark_damage", "codominant_stems",
}


@dataclass
class SiteResult:
    """Site assessment result matching Level 1 inspection fields."""

    condition_rating: str | None = None
    crown_dieback: bool | None = None
    trunk_defects: list[str] = field(default_factory=list)
    location_type: str | None = None
    site_type: str | None = None
    overhead_utility_conflict: bool | None = None
    maintenance_flag: str | None = None
    sidewalk_damage: bool | None = None
    mulch_soil_condition: str | None = None
    risk_flag: bool | None = None


def _safe_str(val, valid_set: set[str]) -> str | None:
    """Validate a string value against a set of valid options."""
    if val is None:
        return None
    cleaned = str(val).strip().lower()
    return cleaned if cleaned in valid_set else None


def _safe_bool(val) -> bool | None:
    """Safely convert to bool or None."""
    if val is None:
        return None
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.strip().lower() in ("true", "yes", "1")
    return None


def parse_site_response(text: str) -> SiteResult | None:
    """Parse LLM response into a SiteResult.

    Args:
        text: Raw text from LLM response.

    Returns:
        SiteResult or None if parsing completely fails.
    """
    data = extract_json(text)
    if data is None:
        logger.warning("Failed to extract JSON from site assessment response")
        return None

    # Parse trunk defects
    raw_defects = data.get("trunkDefects", [])
    if not isinstance(raw_defects, list):
        raw_defects = []
    trunk_defects = [
        d.strip().lower() for d in raw_defects
        if isinstance(d, str) and d.strip().lower() in VALID_TRUNK_DEFECTS
    ]

    result = SiteResult(
        condition_rating=_safe_str(data.get("conditionRating"), VALID_CONDITION_RATINGS),
        crown_dieback=_safe_bool(data.get("crownDieback")),
        trunk_defects=trunk_defects,
        location_type=_safe_str(data.get("locationType"), VALID_LOCATION_TYPES),
        site_type=_safe_str(data.get("siteType"), VALID_SITE_TYPES),
        overhead_utility_conflict=_safe_bool(data.get("overheadUtilityConflict")),
        maintenance_flag=_safe_str(data.get("maintenanceFlag"), VALID_MAINTENANCE_FLAGS),
        sidewalk_damage=_safe_bool(data.get("sidewalkDamage")),
        mulch_soil_condition=_safe_str(data.get("mulchSoilCondition"), VALID_MULCH_CONDITIONS),
        risk_flag=_safe_bool(data.get("riskFlag")),
    )

    # Count how many fields we got
    filled = sum(1 for v in [
        result.condition_rating, result.crown_dieback, result.location_type,
        result.site_type, result.overhead_utility_conflict, result.maintenance_flag,
        result.sidewalk_damage, result.mulch_soil_condition, result.risk_flag,
    ] if v is not None) + (1 if result.trunk_defects else 0)

    if filled == 0:
        logger.warning("Site assessment returned no usable fields")
        return None

    logger.info("Site assessment: %d/10 fields filled", filled)
    return result


async def analyze_site(
    photos: list[tuple[bytes, str]],
) -> SiteResult | None:
    """Run site assessment on tree photos.

    Args:
        photos: List of (image_bytes, photo_type) tuples.

    Returns:
        SiteResult or None if assessment fails.
    """
    prompt = PROMPT_PATH.read_text()
    llm_images = [(img_bytes, "image/jpeg") for img_bytes, _ in photos]

    try:
        response = await llm_query(prompt, images=llm_images)
        result = parse_site_response(response.text)
        if result:
            logger.info(
                "Site: condition=%s, location=%s, site=%s, maintenance=%s, risk=%s",
                result.condition_rating, result.location_type,
                result.site_type, result.maintenance_flag, result.risk_flag,
            )
        else:
            logger.warning("Failed to parse site assessment response")
        return result
    except Exception:
        logger.exception("Site assessment failed")
        return None
