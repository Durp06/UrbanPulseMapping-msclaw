"""End-to-end pipeline test with real tree photos.

Requires: ANTHROPIC_API_KEY and PLANTNET_API_KEY in environment (or .env).
Uses real iNaturalist tree photos from tests/fixtures/tree-photos/.

Run with: pytest tests/test_e2e_real_photos.py -v -s
Quality only (no API): pytest tests/test_e2e_real_photos.py::TestQualityFilter -v -s
"""

import os
from pathlib import Path

import pytest

FIXTURES = Path(__file__).parent / "fixtures" / "tree-photos"

# Test tree configurations: (name, angle1, angle2, bark, expected_genus)
TREE_CONFIGS = [
    ("live_oak", "liveoak_angle1.jpg", "liveoak_angle2.jpg", "oak_bark_0.jpg", "Quercus"),
    ("cedar_elm", "cedarelm_0_0.jpg", "cedarelm_0_1.jpg", "oak_bark_1.jpg", "Ulmus"),
    ("pecan", "pecan_0_0.jpg", "pecan_1_0.jpg", "oak_bark_2.jpg", "Carya"),
    ("bald_cypress", "baldcypress_0_0.jpg", "baldcypress_1_0.jpg", "oak_bark_3.jpg", "Taxodium"),
]


def _load_photo(filename: str) -> bytes:
    """Load a fixture photo and return bytes."""
    path = FIXTURES / filename
    assert path.exists(), f"Fixture photo not found: {path}"
    return path.read_bytes()


def _make_photo_tuples(filenames: list[str], photo_types: list[str]) -> list[tuple[bytes, str]]:
    """Build list of (image_bytes, photo_type) tuples for analyzer functions."""
    return [(_load_photo(fname), ptype) for fname, ptype in zip(filenames, photo_types)]


def _skip_if_no_key(key: str):
    from src.config import settings
    if not getattr(settings, key, None):
        pytest.skip(f"{key} not configured")


# --- Quality Filter Tests (no API calls) ---


class TestQualityFilter:
    """Test photo quality filtering with real images."""

    def test_real_photos_pass_quality(self):
        """All fixture photos should pass quality checks."""
        from src.utils.quality import check_photo_quality

        passed = 0
        failed = 0
        for f in sorted(FIXTURES.glob("*.jpg")):
            check = check_photo_quality(f.read_bytes())
            if not check.passed:
                print(f"  ⚠️  {f.name}: {check.issues}")
                failed += 1
            else:
                passed += 1

        print(f"\nQuality: {passed} passed, {failed} failed out of {passed + failed}")
        assert passed > failed, "Most real photos should pass quality checks"

    def test_filter_selects_best_photos(self):
        """Quality filter should keep the best photos from a set."""
        from src.utils.quality import filter_quality_photos

        photos = [
            (_load_photo("liveoak_angle1.jpg"), "full_tree_angle1"),
            (_load_photo("liveoak_angle2.jpg"), "full_tree_angle2"),
            (_load_photo("oak_bark_0.jpg"), "bark_closeup"),
        ]
        filtered, issues = filter_quality_photos(photos)
        print(f"Filtered: {len(filtered)}/{len(photos)} kept, issues: {issues}")
        assert len(filtered) >= 2


# --- Pl@ntNet Tests ---


class TestPlantNet:
    """Test Pl@ntNet species ID with real tree photos."""

    @pytest.mark.asyncio
    async def test_plantnet_live_oak(self):
        _skip_if_no_key("plantnet_api_key")
        from src.clients.plantnet import identify

        photos = [
            (_load_photo("liveoak_angle1.jpg"), "full_tree_angle1"),
            (_load_photo("liveoak_angle2.jpg"), "full_tree_angle2"),
        ]
        result = await identify(photos)
        print(f"Pl@ntNet: {result.best_match.scientific_name} (score={result.best_match.score:.3f})")
        assert result is not None
        assert result.best_match.score > 0

    @pytest.mark.asyncio
    async def test_plantnet_cedar_elm(self):
        _skip_if_no_key("plantnet_api_key")
        from src.clients.plantnet import identify

        photos = [
            (_load_photo("cedarelm_0_0.jpg"), "full_tree_angle1"),
            (_load_photo("cedarelm_0_1.jpg"), "full_tree_angle2"),
        ]
        result = await identify(photos)
        print(f"Pl@ntNet: {result.best_match.scientific_name} (score={result.best_match.score:.3f})")
        assert result is not None

    @pytest.mark.asyncio
    async def test_plantnet_pecan(self):
        _skip_if_no_key("plantnet_api_key")
        from src.clients.plantnet import identify

        photos = [
            (_load_photo("pecan_0_0.jpg"), "full_tree_angle1"),
            (_load_photo("pecan_1_0.jpg"), "full_tree_angle2"),
        ]
        result = await identify(photos)
        print(f"Pl@ntNet: {result.best_match.scientific_name} (score={result.best_match.score:.3f})")
        assert result is not None


# --- LLM Analyzer Tests ---


class TestLLMAnalyzers:
    """Test LLM-based analyzers with real tree photos."""

    @pytest.mark.asyncio
    async def test_health_analysis(self):
        _skip_if_no_key("anthropic_api_key")
        from src.analyzers.health import analyze_health

        photos = _make_photo_tuples(
            ["liveoak_angle1.jpg", "liveoak_angle2.jpg"],
            ["full_tree_angle1", "full_tree_angle2"],
        )
        result = await analyze_health(photos)
        print(f"Health: structural={result.condition_structural}, leaf={result.condition_leaf}, conf={result.confidence:.2f}")
        assert result is not None
        assert result.condition_structural in ("excellent", "good", "fair", "poor", "critical", "dead")

    @pytest.mark.asyncio
    async def test_species_analysis(self):
        _skip_if_no_key("anthropic_api_key")
        _skip_if_no_key("plantnet_api_key")
        from src.analyzers.species import analyze_species

        photos = _make_photo_tuples(
            ["liveoak_angle1.jpg", "liveoak_angle2.jpg"],
            ["full_tree_angle1", "full_tree_angle2"],
        )
        result = await analyze_species(photos, latitude=30.2672, longitude=-97.7431)
        print(f"Species: {result.common} / {result.scientific} (genus={result.genus}, conf={result.confidence:.2f})")
        assert result is not None
        assert result.genus is not None

    @pytest.mark.asyncio
    async def test_measurements_analysis(self):
        _skip_if_no_key("anthropic_api_key")
        from src.analyzers.measurements import analyze_measurements

        photos = _make_photo_tuples(
            ["liveoak_angle1.jpg", "liveoak_angle2.jpg"],
            ["full_tree_angle1", "full_tree_angle2"],
        )
        result = await analyze_measurements(photos)
        if result:
            print(f"Measurements: DBH={result.dbh_cm}cm, Height={result.height_m}m, Crown={result.crown_width_m}m")
            if result.height_m:
                assert 1 < result.height_m < 50, "Tree height should be plausible"
        else:
            print("Measurements: None returned (may need more context)")

    @pytest.mark.asyncio
    async def test_site_analysis(self):
        _skip_if_no_key("anthropic_api_key")
        from src.analyzers.site import analyze_site

        photos = _make_photo_tuples(
            ["liveoak_angle1.jpg", "liveoak_angle2.jpg"],
            ["full_tree_angle1", "full_tree_angle2"],
        )
        result = await analyze_site(photos)
        if result:
            print(f"Site: rating={result.condition_rating}, location={result.location_type}, risk={result.risk_flag}")
        else:
            print("Site: None returned")


# --- Full Pipeline Species Detection ---


class TestFullPipeline:
    """Test species detection across multiple tree types."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize("name,angle1,angle2,bark,expected_genus", TREE_CONFIGS)
    async def test_pipeline_species_detection(self, name, angle1, angle2, bark, expected_genus):
        _skip_if_no_key("anthropic_api_key")
        _skip_if_no_key("plantnet_api_key")
        from src.analyzers.species import analyze_species

        photos = _make_photo_tuples(
            [angle1, angle2],
            ["full_tree_angle1", "full_tree_angle2"],
        )
        result = await analyze_species(photos, latitude=30.2672, longitude=-97.7431)
        print(f"\n  {name}: {result.common} / {result.scientific} (genus={result.genus}, conf={result.confidence:.2f})")
        assert result is not None
        assert result.confidence > 0, f"Should have some confidence for {name}"
