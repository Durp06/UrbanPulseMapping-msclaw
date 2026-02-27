"""Health assessment analyzer — uses multimodal LLM to evaluate tree health.

Produces two separate condition ratings (structural and leaf/vigor) plus
structured observation codes matching municipal inventory standards.
"""

import logging
from dataclasses import dataclass, field
from pathlib import Path

from src.clients.llm import query as llm_query, extract_json

logger = logging.getLogger(__name__)

PROMPT_PATH = Path(__file__).parent.parent / "prompts" / "health_assessment.txt"

VALID_CONDITIONS = {"excellent", "good", "fair", "poor", "critical", "dead"}

# Mapping for common LLM deviations from our 6-tier scale
CONDITION_ALIASES: dict[str, str] = {
    "average": "fair",
    "moderate": "fair",
    "very poor": "critical",
    "severely declining": "critical",
    "dying": "critical",
    "healthy": "good",
    "very good": "good",
    "unhealthy": "poor",
    "bad": "poor",
}

# Structured observation codes matching municipal standards
VALID_OBSERVATIONS = {
    "deadwood",
    "decay",
    "cavities",
    "cracks",
    "root_damage",
    "lean",
    "codominant_stems",
    "included_bark",
    "canopy_dieback",
    "chlorosis",
    "pest_damage",
    "fungal_fruiting_bodies",
    "girdling_roots",
    "mechanical_damage",
    "poor_pruning",
    "soil_compaction",
    "limited_growing_space",
}

# Map common LLM phrasing to our observation codes
OBSERVATION_ALIASES: dict[str, str] = {
    "dead wood": "deadwood",
    "dead branches": "deadwood",
    "dieback": "canopy_dieback",
    "crown dieback": "canopy_dieback",
    "cavity": "cavities",
    "trunk cavity": "cavities",
    "crack": "cracks",
    "trunk crack": "cracks",
    "fungus": "fungal_fruiting_bodies",
    "fungi": "fungal_fruiting_bodies",
    "conks": "fungal_fruiting_bodies",
    "mushrooms": "fungal_fruiting_bodies",
    "leaning": "lean",
    "co-dominant stems": "codominant_stems",
    "co-dominant": "codominant_stems",
    "included bark": "included_bark",
    "bark inclusion": "included_bark",
    "yellowing": "chlorosis",
    "yellow leaves": "chlorosis",
    "pest": "pest_damage",
    "insect damage": "pest_damage",
    "insects": "pest_damage",
    "root damage": "root_damage",
    "exposed roots": "root_damage",
    "heaving": "root_damage",
    "girdling": "girdling_roots",
    "girdling root": "girdling_roots",
    "wound": "mechanical_damage",
    "mechanical": "mechanical_damage",
    "bark damage": "mechanical_damage",
    "bad pruning": "poor_pruning",
    "improper pruning": "poor_pruning",
    "topping": "poor_pruning",
    "compacted soil": "soil_compaction",
    "compaction": "soil_compaction",
    "limited space": "limited_growing_space",
    "restricted growing": "limited_growing_space",
}


@dataclass
class HealthResult:
    """Health assessment result matching the municipal API contract."""

    condition_structural: str
    condition_leaf: str
    confidence: float
    observations: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


def _normalize_condition(raw: str) -> str | None:
    """Normalize a condition string to our 6-tier scale.

    Args:
        raw: Raw condition string from LLM.

    Returns:
        Normalized condition string, or None if unmappable.
    """
    cleaned = raw.strip().lower()

    if cleaned in VALID_CONDITIONS:
        return cleaned

    if cleaned in CONDITION_ALIASES:
        mapped = CONDITION_ALIASES[cleaned]
        logger.info("Mapped condition '%s' → '%s'", raw, mapped)
        return mapped

    logger.warning("Unknown condition '%s' — cannot map", raw)
    return None


def _normalize_observations(raw_list: list) -> tuple[list[str], list[str]]:
    """Normalize LLM observation strings to structured codes.

    Args:
        raw_list: Raw observation strings from LLM.

    Returns:
        Tuple of (matched_codes, unmatched_notes).
        Matched codes go into the structured observations array.
        Unmatched strings are preserved as free-text notes.
    """
    codes: list[str] = []
    notes: list[str] = []

    for item in raw_list:
        if not isinstance(item, str):
            continue
        cleaned = item.strip().lower()

        if cleaned in VALID_OBSERVATIONS:
            if cleaned not in codes:
                codes.append(cleaned)
        elif cleaned in OBSERVATION_ALIASES:
            mapped = OBSERVATION_ALIASES[cleaned]
            if mapped not in codes:
                codes.append(mapped)
        else:
            # Try substring matching for compound descriptions
            matched = False
            for alias, code in OBSERVATION_ALIASES.items():
                if alias in cleaned:
                    if code not in codes:
                        codes.append(code)
                    matched = True
                    break
            if not matched:
                # Preserve as a free-text note
                notes.append(item.strip())

    return codes, notes


def parse_health_response(text: str) -> HealthResult | None:
    """Parse LLM response into a HealthResult.

    Args:
        text: Raw text from LLM response.

    Returns:
        HealthResult or None if parsing fails.
    """
    data = extract_json(text)
    if data is None:
        logger.warning("Failed to extract JSON from health assessment response")
        return None

    # Parse structural condition
    raw_structural = data.get("conditionStructural", data.get("condition_structural", ""))
    condition_structural = _normalize_condition(raw_structural)

    # Parse leaf/vigor condition
    raw_leaf = data.get("conditionLeaf", data.get("condition_leaf", ""))
    condition_leaf = _normalize_condition(raw_leaf)

    # Fallback: if only a single "status" or "condition" field, use for both
    if condition_structural is None and condition_leaf is None:
        raw_fallback = data.get("status", data.get("condition", ""))
        fallback = _normalize_condition(raw_fallback)
        if fallback:
            condition_structural = fallback
            condition_leaf = fallback
            logger.info("Used single condition '%s' for both structural and leaf", fallback)

    if condition_structural is None or condition_leaf is None:
        logger.warning(
            "Could not parse both conditions: structural=%s, leaf=%s",
            raw_structural, raw_leaf,
        )
        return None

    # Parse confidence
    confidence = data.get("confidence", 0.0)
    if not isinstance(confidence, (int, float)) or confidence < 0 or confidence > 1:
        logger.warning("Invalid health confidence: %s", confidence)
        confidence = max(0.0, min(1.0, float(confidence))) if isinstance(confidence, (int, float)) else 0.5

    # Parse observations — normalize to structured codes
    raw_observations = data.get("observations", data.get("issues", []))
    if not isinstance(raw_observations, list):
        raw_observations = [str(raw_observations)] if raw_observations else []

    observations, notes = _normalize_observations(raw_observations)

    return HealthResult(
        condition_structural=condition_structural,
        condition_leaf=condition_leaf,
        confidence=round(float(confidence), 3),
        observations=observations,
        notes=notes,
    )


async def analyze_health(
    photos: list[tuple[bytes, str]],
) -> HealthResult | None:
    """Run health assessment on tree photos.

    Args:
        photos: List of (image_bytes, photo_type) tuples.

    Returns:
        HealthResult or None if assessment fails.
    """
    prompt = PROMPT_PATH.read_text()
    llm_images = [(img_bytes, "image/jpeg") for img_bytes, _ in photos]

    try:
        response = await llm_query(prompt, images=llm_images)
        result = parse_health_response(response.text)
        if result:
            logger.info(
                "Health assessment: structural=%s, leaf=%s (conf=%.3f, observations=%d, notes=%d)",
                result.condition_structural, result.condition_leaf,
                result.confidence, len(result.observations), len(result.notes),
            )
        else:
            logger.warning("Failed to parse health assessment response")
        return result
    except Exception:
        logger.exception("Health assessment failed")
        return None
