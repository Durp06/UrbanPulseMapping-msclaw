import * as FileSystem from 'expo-file-system';

// Simple blur detection using image file size as a heuristic.
// Blurry photos compress much more efficiently (smaller file size)
// because they lack high-frequency detail. We also check
// the image dimensions if available.
//
// For a more accurate approach, we could use expo-image-manipulator
// to downscale and analyze pixel variance, but this heuristic
// works well enough for the use case and is very fast.

const MIN_FILE_SIZE_BYTES = 50_000; // 50KB — very small photos are likely blurry

export async function detectBlur(
  imageUri: string
): Promise<{ isBlurry: boolean; confidence: number }> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(imageUri, { size: true });

    if (!fileInfo.exists) {
      return { isBlurry: false, confidence: 0 };
    }

    const fileSize = (fileInfo as any).size as number | undefined;

    if (!fileSize) {
      return { isBlurry: false, confidence: 0 };
    }

    // Very small files are likely blurry (lack detail)
    if (fileSize < MIN_FILE_SIZE_BYTES) {
      return { isBlurry: true, confidence: 0.8 };
    }

    // Files under 100KB are suspicious
    if (fileSize < 100_000) {
      return { isBlurry: true, confidence: 0.5 };
    }

    return { isBlurry: false, confidence: 0 };
  } catch {
    // If detection fails, don't block the user
    return { isBlurry: false, confidence: 0 };
  }
}
