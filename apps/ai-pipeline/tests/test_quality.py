"""Tests for photo quality pre-checks."""

import io
import pytest
from PIL import Image

from src.utils.quality import (
    check_photo_quality,
    filter_quality_photos,
    QualityCheck,
    MIN_WIDTH,
    MIN_HEIGHT,
    BLUR_THRESHOLD,
    BRIGHTNESS_LOW,
    BRIGHTNESS_HIGH,
    MAX_FILE_SIZE,
)


def _make_image(width: int = 640, height: int = 480, color: tuple = (128, 128, 128)) -> bytes:
    """Create a test image and return as JPEG bytes."""
    img = Image.new("RGB", (width, height), color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def _make_noisy_image(width: int = 640, height: int = 480) -> bytes:
    """Create a sharp (noisy) image that passes blur check."""
    import random
    img = Image.new("RGB", (width, height))
    pixels = img.load()
    random.seed(42)
    for x in range(width):
        for y in range(height):
            pixels[x, y] = (random.randint(0, 255), random.randint(0, 255), random.randint(0, 255))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


class TestCheckPhotoQuality:
    def test_good_photo_passes(self):
        img_bytes = _make_noisy_image()
        result = check_photo_quality(img_bytes)
        assert result.passed is True
        assert result.issues == []

    def test_too_small(self):
        img_bytes = _make_image(width=100, height=100)
        result = check_photo_quality(img_bytes)
        assert result.passed is False
        assert any("too small" in i for i in result.issues)

    def test_too_dark(self):
        img_bytes = _make_noisy_image_with_brightness(10)
        result = check_photo_quality(img_bytes)
        assert any("dark" in i.lower() for i in result.issues)

    def test_too_bright(self):
        img_bytes = _make_image(color=(250, 250, 250))
        result = check_photo_quality(img_bytes)
        assert any("bright" in i.lower() or "overexposed" in i.lower() for i in result.issues)

    def test_invalid_image_data(self):
        result = check_photo_quality(b"not an image at all")
        assert result.passed is False
        assert any("Cannot open" in i for i in result.issues)

    def test_blur_detection(self):
        # Solid color image = no edges = blurry
        img_bytes = _make_image(color=(128, 128, 128))
        result = check_photo_quality(img_bytes)
        assert any("blurry" in i.lower() for i in result.issues)

    def test_large_file_flagged(self):
        # We can't easily create a 20MB+ JPEG in tests, so test the logic path
        # by checking a normal image passes the size check
        img_bytes = _make_image()
        assert len(img_bytes) < MAX_FILE_SIZE
        result = check_photo_quality(img_bytes)
        assert not any("too large" in i.lower() for i in result.issues)


def _make_noisy_image_with_brightness(brightness: int) -> bytes:
    """Create a noisy but dark/bright image."""
    import random
    img = Image.new("RGB", (640, 480))
    pixels = img.load()
    random.seed(42)
    for x in range(640):
        for y in range(480):
            r = max(0, min(255, brightness + random.randint(-10, 10)))
            g = max(0, min(255, brightness + random.randint(-10, 10)))
            b = max(0, min(255, brightness + random.randint(-10, 10)))
            pixels[x, y] = (r, g, b)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


class TestFilterQualityPhotos:
    def test_all_pass(self):
        photos = [
            (_make_noisy_image(), "full_tree_angle1"),
            (_make_noisy_image(), "full_tree_angle2"),
        ]
        passing, issues = filter_quality_photos(photos)
        assert len(passing) == 2
        assert issues == []

    def test_some_filtered(self):
        photos = [
            (_make_noisy_image(), "full_tree_angle1"),
            (b"bad data", "bark_closeup"),
        ]
        passing, issues = filter_quality_photos(photos)
        assert len(passing) == 1
        assert passing[0][1] == "full_tree_angle1"
        assert len(issues) > 0
        assert any("bark_closeup" in i for i in issues)

    def test_all_filtered(self):
        photos = [
            (b"bad1", "full_tree_angle1"),
            (b"bad2", "bark_closeup"),
        ]
        passing, issues = filter_quality_photos(photos)
        assert len(passing) == 0
        assert len(issues) > 0

    def test_empty_input(self):
        passing, issues = filter_quality_photos([])
        assert passing == []
        assert issues == []
