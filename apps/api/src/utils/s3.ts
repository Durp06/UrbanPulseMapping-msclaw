import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.S3_REGION || 'auto',
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true, // Needed for MinIO
});

const bucket = process.env.S3_BUCKET || 'urban-pulse-photos';
const publicUrl = process.env.S3_PUBLIC_URL || '';

export async function generatePresignedUploadUrl(
  storageKey: string,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    ContentType: contentType,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  return url;
}

export function getPublicUrl(storageKey: string): string {
  return `${publicUrl}/${storageKey}`;
}

export { s3Client, bucket };
