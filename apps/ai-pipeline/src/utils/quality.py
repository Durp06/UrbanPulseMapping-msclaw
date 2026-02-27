"""Photo quality pre-checks — blur detection, brightness, size validation."""

import io
import logging
from dataclasses import dataclass

from PIL import Image, ImageFilter, ImageStat

logger = logging.getLogger(__name__)

# Thresholds
MIN_WIDTH = 200
MIN_HEIGHT = 200
MAX_FILE_SIZE = 20 * 1024 * 1024  # 20MB
BLUR_THRESHOLD = 200.0  # Laplacian variance below this = blurry
BRIGHTNESS_LOW = 30.0  # Mean brightness below this = too dark
BRIGHTNESS_HIGH = 240.0  # Mean brightness above this = too bright


@dataclass
class QualityCheck:
    """Result of a photo quality check."""

    passed: bool
    issues: list[str]


def _laplacian_variance(image: Image.Image) -> float:
    """Compute Laplacian variance as a blur metric.

    Higher values = sharper image. Low values = blurry.

    Args:
        image: PIL Image (will be converted to grayscale).

    Returns:
        Laplacian variance score.
    """
    gray = image.convert("L")
    # Apply Laplacian-like edge detection via FIND_EDGES
    edges = gray.filter(ImageFilter.FIND_EDGES)
    stat = ImageStat.Stat(edges)
    # Variance of edge intensities
    return stat.var[0]


def _mean_brightness(image: Image.Image) -> float:
    """Compute mean brightness of an image.

    Args:
        image: PIL Image.

    Returns:
        Mean brightness (0-255).
    """
    gray = image.convert("L")
    stat = ImageStat.Stat(gray)
    return stat.mean[0]


def check_photo_quality(image_bytes: bytes) -> QualityCheck:
    """Run quality pre-checks on a photo.

    Checks:
    - File size (not too large)
    - Image dimensions (minimum width/height)
    - Blur detection (Laplacian variance)
    - Brightness (not too dark or too bright)

    Args:
        image_bytes: Raw image bytes.

    Returns:
        QualityCheck with pass/fail and list of issues.
    """
    issues: list[str] = []

    # File size check
    if len(image_bytes) > MAX_FILE_SIZE:
        issues.append(f"File too large: {len(image_bytes) / 1024 / 1024:.1f}MB (max {MAX_FILE_SIZE / 1024 / 1024:.0f}MB)")

    # Try to open the image
    try:
        image = Image.open(io.BytesIO(image_bytes))
    except Exception as e:
        issues.append(f"Cannot open image: {e}")
        return QualityCheck(passed=False, issues=issues)

    # Dimension check
    width, height = image.size
    if width < MIN_WIDTH or height < MIN_HEIGHT:
        issues.append(f"Image too small: {width}x{height} (min {MIN_WIDTH}x{MIN_HEIGHT})")

    # Blur check
    try:
        blur_score = _laplacian_variance(image)
        if blur_score < BLUR_THRESHOLD:
            issues.append(f"Image appears blurry (score={blur_score:.1f}, threshold={BLUR_THRESHOLD})")
    except Exception as e:
        logger.warning("Blur check failed: %s", e)

    # Brightness check
    try:
        brightness = _mean_brightness(image)
        if brightness < BRIGHTNESS_LOW:
            issues.append(f"Image too dark (brightness={brightness:.1f}, min={BRIGHTNESS_LOW})")
        elif brightness > BRIGHTNESS_HIGH:
            issues.append(f"Image too bright/overexposed (brightness={brightness:.1f}, max={BRIGHTNESS_HIGH})")
    except Exception as e:
        logger.warning("Brightness check failed: %s", e)

    passed = len(issues) == 0
    if not passed:
        logger.warning("Photo quality issues: %s", issues)

    return QualityCheck(passed=passed, issues=issues)


def filter_quality_photos(
    photos: list[tuple[bytes, str]],
) -> tuple[list[tuple[bytes, str]], list[str]]:
    """Filter photos by quality, returning only those that pass.

    Args:
        photos: List of (image_bytes, photo_type) tuples.

    Returns:
        Tuple of (passing_photos, all_quality_issues).
    """
    passing: list[tuple[bytes, str]] = []
    all_issues: list[str] = []

    for img_bytes, photo_type in photos:
        check = check_photo_quality(img_bytes)
        if check.passed:
            passing.append((img_bytes, photo_type))
        else:
            all_issues.extend([f"[{photo_type}] {issue}" for issue in check.issues])
            logger.warning("Skipping %s: %s", photo_type, check.issues)

    logger.info("Quality filter: %d/%d photos passed", len(passing), len(photos))
    return passing, all_issues
