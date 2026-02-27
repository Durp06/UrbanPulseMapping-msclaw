"""Tests for the measurement estimation analyzer — imperial units, crown width, stems."""

import pytest
from unittest.mock import AsyncMock, patch

from src.analyzers.measurements import (
    analyze_measurements,
    parse_measurement_response,
    MeasurementResult,
    CM_PER_INCH,
    FT_PER_METER,
)
from src.clients.llm import LLMResponse


class TestParseMeasurementResponse:
    def test_valid_full_response(self):
        text = '{"dbhCm": 45.2, "heightM": 12.8, "crownWidthM": 8.5, "numStems": 1}'
        result = parse_measurement_response(text)
        assert result is not None
        assert result.dbh_cm == 45.2
        assert result.height_m == 12.8
        assert result.crown_width_m == 8.5
        assert result.num_stems == 1
        # Imperial conversions
        assert result.dbh_in == pytest.approx(45.2 / CM_PER_INCH, abs=0.15)
        assert result.height_ft == pytest.approx(12.8 * FT_PER_METER, abs=0.15)
        assert result.crown_width_ft == pytest.approx(8.5 * FT_PER_METER, abs=0.15)

    def test_minimal_response_no_crown_no_stems(self):
        text = '{"dbhCm": 30, "heightM": 10}'
        result = parse_measurement_response(text)
        assert result is not None
        assert result.dbh_cm == 30.0
        assert result.height_m == 10.0
        assert result.crown_width_m is None
        assert result.crown_width_ft is None
        assert result.num_stems == 1  # default

    def test_imperial_conversions_correct(self):
        text = '{"dbhCm": 25.4, "heightM": 3.048}'
        result = parse_measurement_response(text)
        assert result is not None
        assert result.dbh_in == 10.0  # 25.4cm = 10in exactly
        assert result.height_ft == 10.0  # 3.048m = 10ft exactly

    def test_multi_stem(self):
        text = '{"dbhCm": 60, "heightM": 15, "numStems": 3}'
        result = parse_measurement_response(text)
        assert result is not None
        assert result.num_stems == 3

    def test_null_crown_width(self):
        text = '{"dbhCm": 40, "heightM": 12, "crownWidthM": null}'
        result = parse_measurement_response(text)
        assert result is not None
        assert result.crown_width_m is None
        assert result.crown_width_ft is None

    def test_zero_crown_width_becomes_null(self):
        text = '{"dbhCm": 40, "heightM": 12, "crownWidthM": 0}'
        result = parse_measurement_response(text)
        assert result is not None
        assert result.crown_width_m is None

    def test_rounds_to_one_decimal(self):
        text = '{"dbhCm": 45.267, "heightM": 12.834, "crownWidthM": 9.456}'
        result = parse_measurement_response(text)
        assert result is not None
        assert result.dbh_cm == 45.3
        assert result.height_m == 12.8
        assert result.crown_width_m == 9.5

    def test_missing_dbh(self):
        text = '{"heightM": 12.8}'
        result = parse_measurement_response(text)
        assert result is None

    def test_missing_height(self):
        text = '{"dbhCm": 45.2}'
        result = parse_measurement_response(text)
        assert result is None

    def test_zero_values_rejected(self):
        text = '{"dbhCm": 0, "heightM": 12.8}'
        result = parse_measurement_response(text)
        assert result is None

    def test_negative_values_rejected(self):
        text = '{"dbhCm": -5, "heightM": 12.8}'
        result = parse_measurement_response(text)
        assert result is None

    def test_non_numeric_rejected(self):
        text = '{"dbhCm": "big", "heightM": "tall"}'
        result = parse_measurement_response(text)
        assert result is None

    def test_invalid_json(self):
        result = parse_measurement_response("The tree is about 45cm DBH and 13m tall.")
        assert result is None

    def test_json_in_code_block(self):
        text = '```json\n{"dbhCm": 50.0, "heightM": 15.0, "crownWidthM": 10.0, "numStems": 2}\n```'
        result = parse_measurement_response(text)
        assert result is not None
        assert result.dbh_cm == 50.0
        assert result.num_stems == 2

    def test_null_values_rejected(self):
        text = '{"dbhCm": null, "heightM": 12.0}'
        result = parse_measurement_response(text)
        assert result is None

    def test_stem_count_minimum_one(self):
        text = '{"dbhCm": 30, "heightM": 10, "numStems": 0}'
        result = parse_measurement_response(text)
        assert result is not None
        assert result.num_stems == 1  # clamped to 1

    def test_invalid_stem_count_defaults_one(self):
        text = '{"dbhCm": 30, "heightM": 10, "numStems": "many"}'
        result = parse_measurement_response(text)
        assert result is not None
        assert result.num_stems == 1


class TestAnalyzeMeasurements:
    @pytest.mark.asyncio
    @patch("src.analyzers.measurements.llm_query")
    async def test_successful_estimation(self, mock_llm):
        mock_llm.return_value = LLMResponse(
            text='{"dbhCm": 45.2, "heightM": 12.8, "crownWidthM": 8.5, "numStems": 1}',
            provider="anthropic", model="test",
        )

        result = await analyze_measurements([(b"fake-img", "full_tree_angle1")])
        assert result is not None
        assert result.dbh_cm == 45.2
        assert result.height_m == 12.8
        assert result.dbh_in > 0
        assert result.height_ft > 0
        assert result.crown_width_m == 8.5
        assert result.num_stems == 1

    @pytest.mark.asyncio
    @patch("src.analyzers.measurements.llm_query")
    async def test_with_species_context(self, mock_llm):
        mock_llm.return_value = LLMResponse(
            text='{"dbhCm": 40.0, "heightM": 11.0}',
            provider="anthropic", model="test",
        )

        result = await analyze_measurements(
            [(b"fake-img", "full_tree_angle1")],
            species_scientific="Quercus virginiana",
        )
        assert result is not None
        call_args = mock_llm.call_args
        assert "Quercus virginiana" in call_args.args[0]

    @pytest.mark.asyncio
    @patch("src.analyzers.measurements.llm_query")
    async def test_llm_failure(self, mock_llm):
        mock_llm.side_effect = Exception("API error")

        result = await analyze_measurements([(b"fake-img", "full_tree_angle1")])
        assert result is None

    @pytest.mark.asyncio
    @patch("src.analyzers.measurements.llm_query")
    async def test_unparseable_response(self, mock_llm):
        mock_llm.return_value = LLMResponse(
            text="The tree trunk diameter is roughly 45 centimeters.",
            provider="anthropic", model="test",
        )

        result = await analyze_measurements([(b"fake-img", "full_tree_angle1")])
        assert result is None
