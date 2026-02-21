import { randomUUID } from 'crypto';
import { generatePresignedUploadUrl } from '../utils/s3';

export async function createPresignedUrl(
  userId: string,
  filename: string,
  contentType: string,
  photoType: string
) {
  const ext = contentType === 'image/heic' ? 'heic' : 'jpg';
  const storageKey = `observations/${userId}/${randomUUID()}/${photoType}.${ext}`;

  const uploadUrl = await generatePresignedUploadUrl(storageKey, contentType);

  return { uploadUrl, storageKey };
}
