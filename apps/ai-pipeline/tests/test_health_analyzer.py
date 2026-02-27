"""Tests for the health assessment analyzer — dual conditions + structured observations."""

import pytest
from unittest.mock import AsyncMock, patch

from src.analyzers.health import (
    analyze_health,
    parse_health_response,
    _normalize_condition,
    _normalize_observations,
    HealthResult,
    VALID_CONDITIONS,
    CONDITION_ALIASES,
    VALID_OBSERVATIONS,
    OBSERVATION_ALIASES,
)
from src.clients.llm import LLMResponse


class TestNormalizeCondition:
    @pytest.mark.parametrize("condition", list(VALID_CONDITIONS))
    def test_valid_conditions_pass_through(self, condition):
        assert _normalize_condition(condition) == condition

    def test_case_insensitive(self):
        assert _normalize_condition("Good") == "good"
        assert _normalize_condition("EXCELLENT") == "excellent"

    def test_strips_whitespace(self):
        assert _normalize_condition("  good  ") == "good"

    @pytest.mark.parametrize("alias,expected", list(CONDITION_ALIASES.items()))
    def test_aliases_map_correctly(self, alias, expected):
        assert _normalize_condition(alias) == expected

    def test_unknown_returns_none(self):
        assert _normalize_condition("amazing") is None
        assert _normalize_condition("") is None


class TestNormalizeObservations:
    def test_valid_codes_pass_through(self):
        codes, notes = _normalize_observations(["deadwood", "cavities", "lean"])
        assert codes == ["deadwood", "cavities", "lean"]
        assert notes == []

    def test_aliases_mapped(self):
        codes, notes = _normalize_observations(["dead branches", "yellowing", "conks"])
        assert "deadwood" in codes
        assert "chlorosis" in codes
        assert "fungal_fruiting_bodies" in codes
        assert notes == []

    def test_unknown_becomes_note(self):
        codes, notes = _normalize_observations(["deadwood", "unusual bark pattern"])
        assert codes == ["deadwood"]
        assert notes == ["unusual bark pattern"]

    def test_deduplication(self):
        codes, notes = _normalize_observations(["deadwood", "dead branches", "dead wood"])
        assert codes.count("deadwood") == 1

    def test_empty_list(self):
        codes, notes = _normalize_observations([])
        assert codes == []
        assert notes == []

    def test_substring_matching(self):
        codes, notes = _normalize_observations(["some dead branches visible in crown"])
        assert "deadwood" in codes

    def test_non_string_items_skipped(self):
        codes, notes = _normalize_observations(["deadwood", 42, None, "cavities"])
        assert codes == ["deadwood", "cavities"]
        assert notes == []


class TestParseHealthResponse:
    def test_valid_dual_condition_response(self):
        text = '{"conditionStructural": "good", "conditionLeaf": "fair", "confidence": 0.82, "observations": ["deadwood", "chlorosis"]}'
        result = parse_health_response(text)
        assert result is not None
        assert result.condition_structural == "good"
        assert result.condition_leaf == "fair"
        assert result.confidence == 0.82
        assert "deadwood" in result.observations
        assert "chlorosis" in result.observations

    def test_empty_observations(self):
        text = '{"conditionStructural": "excellent", "conditionLeaf": "excellent", "confidence": 0.95, "observations": []}'
        result = parse_health_response(text)
        assert result is not None
        assert result.observations == []
        assert result.notes == []

    def test_condition_aliases(self):
        text = '{"conditionStructural": "average", "conditionLeaf": "healthy", "confidence": 0.7, "observations": []}'
        result = parse_health_response(text)
        assert result is not None
        assert result.condition_structural == "fair"
        assert result.condition_leaf == "good"

    def test_fallback_to_single_status(self):
        """If LLM returns old-style single 'status', use for both conditions."""
        text = '{"status": "good", "confidence": 0.8, "observations": []}'
        result = parse_health_response(text)
        assert result is not None
        assert result.condition_structural == "good"
        assert result.condition_leaf == "good"

    def test_fallback_to_issues_key(self):
        """Should also accept 'issues' as alias for 'observations'."""
        text = '{"conditionStructural": "good", "conditionLeaf": "good", "confidence": 0.8, "issues": ["deadwood"]}'
        result = parse_health_response(text)
        assert result is not None
        assert "deadwood" in result.observations

    def test_invalid_both_conditions(self):
        text = '{"conditionStructural": "amazing", "conditionLeaf": "fantastic", "confidence": 0.9, "observations": []}'
        result = parse_health_response(text)
        assert result is None

    def test_invalid_json(self):
        result = parse_health_response("The tree looks healthy with good crown density.")
        assert result is None

    def test_json_in_code_block(self):
        text = '```json\n{"conditionStructural": "poor", "conditionLeaf": "fair", "confidence": 0.6, "observations": ["cavities", "lean"]}\n```'
        result = parse_health_response(text)
        assert result is not None
        assert result.condition_structural == "poor"
        assert "cavities" in result.observations

    def test_confidence_clamped(self):
        text = '{"conditionStructural": "good", "conditionLeaf": "good", "confidence": 1.5, "observations": []}'
        result = parse_health_response(text)
        assert result is not None
        assert result.confidence <= 1.0

    def test_observation_aliases_normalized(self):
        text = '{"conditionStructural": "fair", "conditionLeaf": "fair", "confidence": 0.7, "observations": ["dead branches", "yellowing", "fungi"]}'
        result = parse_health_response(text)
        assert result is not None
        assert "deadwood" in result.observations
        assert "chlorosis" in result.observations
        assert "fungal_fruiting_bodies" in result.observations

    def test_unrecognized_observations_become_notes(self):
        text = '{"conditionStructural": "good", "conditionLeaf": "good", "confidence": 0.8, "observations": ["deadwood", "unusual bark discoloration"]}'
        result = parse_health_response(text)
        assert result is not None
        assert "deadwood" in result.observations
        assert "unusual bark discoloration" in result.notes

    def test_snake_case_keys(self):
        """Should accept snake_case as well as camelCase."""
        text = '{"condition_structural": "good", "condition_leaf": "fair", "confidence": 0.8, "observations": []}'
        result = parse_health_response(text)
        assert result is not None
        assert result.condition_structural == "good"
        assert result.condition_leaf == "fair"


class TestAnalyzeHealth:
    @pytest.mark.asyncio
    @patch("src.analyzers.health.llm_query")
    async def test_successful_assessment(self, mock_llm):
        mock_llm.return_value = LLMResponse(
            text='{"conditionStructural": "good", "conditionLeaf": "fair", "confidence": 0.82, "observations": ["deadwood", "chlorosis"]}',
            provider="anthropic", model="test",
        )

        result = await analyze_health([(b"fake-img", "full_tree_angle1")])
        assert result is not None
        assert result.condition_structural == "good"
        assert result.condition_leaf == "fair"
        assert result.confidence == 0.82
        assert "deadwood" in result.observations
        mock_llm.assert_called_once()

    @pytest.mark.asyncio
    @patch("src.analyzers.health.llm_query")
    async def test_llm_failure(self, mock_llm):
        mock_llm.side_effect = Exception("API error")

        result = await analyze_health([(b"fake-img", "full_tree_angle1")])
        assert result is None

    @pytest.mark.asyncio
    @patch("src.analyzers.health.llm_query")
    async def test_unparseable_response(self, mock_llm):
        mock_llm.return_value = LLMResponse(
            text="The tree appears to be in good health with a full crown.",
            provider="anthropic", model="test",
        )

        result = await analyze_health([(b"fake-img", "full_tree_angle1")])
        assert result is None
