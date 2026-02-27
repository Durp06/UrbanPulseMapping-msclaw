"""Tests for the species identification analyzer + consensus logic."""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from src.analyzers.species import (
    consensus,
    apply_geographic_boost,
    analyze_species,
    _parse_llm_species,
    SpeciesResult,
    LLMSpecies,
    CAP_BOTH_AGREE,
    CAP_GENUS_AGREE,
    CAP_DISAGREE,
    GEOGRAPHIC_BOOST,
)
from src.clients.plantnet import PlantNetResult, PlantNetSpecies
from src.clients.llm import LLMResponse


def _pn_result(scientific: str, common: str, score: float, genus: str | None = None) -> PlantNetResult:
    """Helper to build a PlantNetResult."""
    g = genus or scientific.split()[0]
    species = PlantNetSpecies(
        scientific_name=scientific,
        common_names=[common],
        score=score,
        genus=g,
    )
    return PlantNetResult(species=[species], best_match=species, remaining_identification_requests=None)


def _llm_species(scientific: str, common: str, confidence: float) -> LLMSpecies:
    genus = scientific.split()[0] if scientific else ""
    return LLMSpecies(common=common, scientific=scientific, confidence=confidence, genus=genus)


class TestParseLLMSpecies:
    def test_valid_json(self):
        resp = LLMResponse(text='{"common": "Live Oak", "scientific": "Quercus virginiana", "confidence": 0.85}', provider="anthropic", model="test")
        result = _parse_llm_species(resp)
        assert result is not None
        assert result.scientific == "Quercus virginiana"
        assert result.common == "Live Oak"
        assert result.confidence == 0.85
        assert result.genus == "Quercus"

    def test_empty_scientific(self):
        resp = LLMResponse(text='{"common": "Oak", "scientific": "", "confidence": 0.5}', provider="anthropic", model="test")
        result = _parse_llm_species(resp)
        assert result is None

    def test_invalid_json(self):
        resp = LLMResponse(text="I think it's an oak tree", provider="anthropic", model="test")
        result = _parse_llm_species(resp)
        assert result is None

    def test_json_in_code_block(self):
        resp = LLMResponse(
            text='```json\n{"common": "Oak", "scientific": "Quercus alba", "confidence": 0.7}\n```',
            provider="anthropic", model="test",
        )
        result = _parse_llm_species(resp)
        assert result is not None
        assert result.scientific == "Quercus alba"


class TestConsensus:
    def test_both_agree_species(self):
        """Full agreement → average confidence, capped at 0.95."""
        pn = _pn_result("Quercus virginiana", "Live Oak", 0.90)
        llm = _llm_species("Quercus virginiana", "Live Oak", 0.80)
        result = consensus(pn, llm)
        assert result is not None
        assert result.scientific == "Quercus virginiana"
        assert result.confidence == 0.85  # avg(0.90, 0.80)

    def test_both_agree_high_confidence_capped(self):
        """Agreement with very high scores → capped at 0.95."""
        pn = _pn_result("Quercus virginiana", "Live Oak", 0.99)
        llm = _llm_species("Quercus virginiana", "Live Oak", 0.98)
        result = consensus(pn, llm)
        assert result is not None
        assert result.confidence == CAP_BOTH_AGREE  # 0.95

    def test_genus_agree_species_differ(self):
        """Same genus, different species → Pl@ntNet species, capped at 0.70."""
        pn = _pn_result("Quercus virginiana", "Live Oak", 0.85)
        llm = _llm_species("Quercus fusiformis", "Plateau Live Oak", 0.75)
        result = consensus(pn, llm)
        assert result is not None
        assert result.scientific == "Quercus virginiana"  # uses Pl@ntNet
        assert result.confidence <= CAP_GENUS_AGREE

    def test_total_disagreement(self):
        """Different genus → Pl@ntNet, capped at 0.40."""
        pn = _pn_result("Quercus virginiana", "Live Oak", 0.80)
        llm = _llm_species("Ulmus americana", "American Elm", 0.70)
        result = consensus(pn, llm)
        assert result is not None
        assert result.scientific == "Quercus virginiana"
        assert result.confidence <= CAP_DISAGREE

    def test_only_plantnet(self):
        """LLM failed → Pl@ntNet only, capped at 0.70."""
        pn = _pn_result("Quercus virginiana", "Live Oak", 0.90)
        result = consensus(pn, None)
        assert result is not None
        assert result.scientific == "Quercus virginiana"
        assert result.confidence == 0.70  # capped

    def test_only_llm(self):
        """Pl@ntNet failed → LLM only, capped at 0.60."""
        llm = _llm_species("Quercus virginiana", "Live Oak", 0.85)
        result = consensus(None, llm)
        assert result is not None
        assert result.scientific == "Quercus virginiana"
        assert result.confidence == 0.60  # capped

    def test_both_failed(self):
        """Both sources failed → None."""
        result = consensus(None, None)
        assert result is None

    def test_case_insensitive_comparison(self):
        """Species comparison should be case-insensitive."""
        pn = _pn_result("Quercus Virginiana", "Live Oak", 0.85)
        llm = _llm_species("quercus virginiana", "Live Oak", 0.80)
        result = consensus(pn, llm)
        assert result is not None
        assert result.confidence == round((0.85 + 0.80) / 2, 3)  # agreement

    def test_plantnet_no_common_names(self):
        """Pl@ntNet with no common names should use LLM's common name."""
        species = PlantNetSpecies(
            scientific_name="Quercus virginiana",
            common_names=[],
            score=0.85,
            genus="Quercus",
        )
        pn = PlantNetResult(species=[species], best_match=species, remaining_identification_requests=None)
        llm = _llm_species("Quercus virginiana", "Live Oak", 0.80)
        result = consensus(pn, llm)
        assert result is not None
        assert result.common == "Live Oak"


class TestGeographicBoost:
    def test_boost_applied(self):
        result = SpeciesResult(common="Live Oak", scientific="Quercus virginiana", genus="Quercus", confidence=0.80)
        boosted = apply_geographic_boost(result, ["Quercus virginiana", "Ulmus americana"])
        assert boosted.confidence == pytest.approx(0.85)

    def test_no_boost_unknown_species(self):
        result = SpeciesResult(common="Live Oak", scientific="Quercus virginiana", genus="Quercus", confidence=0.80)
        boosted = apply_geographic_boost(result, ["Ulmus americana"])
        assert boosted.confidence == 0.80

    def test_boost_capped_at_max(self):
        result = SpeciesResult(common="Live Oak", scientific="Quercus virginiana", genus="Quercus", confidence=0.94)
        boosted = apply_geographic_boost(result, ["Quercus virginiana"])
        assert boosted.confidence == CAP_BOTH_AGREE  # 0.95, not 0.99

    def test_case_insensitive(self):
        result = SpeciesResult(common="Live Oak", scientific="Quercus virginiana", genus="Quercus", confidence=0.80)
        boosted = apply_geographic_boost(result, ["quercus virginiana"])
        assert boosted.confidence == pytest.approx(0.85)


class TestAnalyzeSpecies:
    @pytest.mark.asyncio
    @patch("src.analyzers.species.reverse_geocode", new_callable=AsyncMock, return_value="Austin, Texas, US")
    @patch("src.analyzers.species.llm_query")
    @patch("src.analyzers.species.plantnet_identify")
    async def test_parallel_calls(self, mock_pn, mock_llm, mock_geocode):
        """Both Pl@ntNet and LLM should be called."""
        mock_pn.return_value = _pn_result("Quercus virginiana", "Live Oak", 0.85)
        mock_llm.return_value = LLMResponse(
            text='{"common": "Live Oak", "scientific": "Quercus virginiana", "confidence": 0.80}',
            provider="anthropic", model="test",
        )

        photos = [(b"fake-img", "full_tree_angle1")]
        result = await analyze_species(photos, latitude=30.27, longitude=-97.74)

        assert result is not None
        assert result.scientific == "Quercus virginiana"
        mock_pn.assert_called_once()
        mock_llm.assert_called_once()
        mock_geocode.assert_called_once_with(30.27, -97.74)

    @pytest.mark.asyncio
    @patch("src.analyzers.species.reverse_geocode", new_callable=AsyncMock, return_value="unknown")
    @patch("src.analyzers.species.llm_query")
    @patch("src.analyzers.species.plantnet_identify")
    async def test_plantnet_fails_gracefully(self, mock_pn, mock_llm, mock_geocode):
        """If Pl@ntNet fails, should still use LLM result."""
        mock_pn.side_effect = Exception("API down")
        mock_llm.return_value = LLMResponse(
            text='{"common": "Live Oak", "scientific": "Quercus virginiana", "confidence": 0.80}',
            provider="anthropic", model="test",
        )

        photos = [(b"fake-img", "full_tree_angle1")]
        result = await analyze_species(photos)

        assert result is not None
        assert result.confidence <= 0.60  # LLM-only cap

    @pytest.mark.asyncio
    @patch("src.analyzers.species.reverse_geocode", new_callable=AsyncMock, return_value="unknown")
    @patch("src.analyzers.species.llm_query")
    @patch("src.analyzers.species.plantnet_identify")
    async def test_both_fail(self, mock_pn, mock_llm, mock_geocode):
        """If both fail, should return None."""
        mock_pn.side_effect = Exception("API down")
        mock_llm.side_effect = Exception("API down")

        photos = [(b"fake-img", "full_tree_angle1")]
        result = await analyze_species(photos)

        assert result is None
