import * as FileSystem from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { api } from './api';
import type { CreateObservationResponse, PresignedUrlResponse } from '@urban-pulse/shared-types';

const PENDING_DIR = `${FileSystem.documentDirectory}pending/`;

interface PendingSubmission {
  id: string;
  latitude: number;
  longitude: number;
  gpsAccuracyMeters: number;
  notes?: string;
  photos: Array<{
    uri: string;
    photoType: string;
  }>;
  createdAt: string;
}

export async function ensurePendingDir() {
  const info = await FileSystem.getInfoAsync(PENDING_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PENDING_DIR, { intermediates: true });
  }
}

export async function savePendingSubmission(
  submission: Omit<PendingSubmission, 'id' | 'createdAt'>
): Promise<string> {
  await ensurePendingDir();
  const id = randomUUID();
  const dir = `${PENDING_DIR}${id}/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

  // Copy photos to local storage
  const savedPhotos = [];
  for (const photo of submission.photos) {
    const filename = `${photo.photoType}.jpg`;
    const destUri = `${dir}${filename}`;
    await FileSystem.copyAsync({ from: photo.uri, to: destUri });
    savedPhotos.push({ uri: destUri, photoType: photo.photoType });
  }

  const metadata: PendingSubmission = {
    id,
    latitude: submission.latitude,
    longitude: submission.longitude,
    gpsAccuracyMeters: submission.gpsAccuracyMeters,
    notes: submission.notes,
    photos: savedPhotos,
    createdAt: new Date().toISOString(),
  };

  await FileSystem.writeAsStringAsync(
    `${dir}metadata.json`,
    JSON.stringify(metadata)
  );

  return id;
}

export async function getPendingSubmissions(): Promise<PendingSubmission[]> {
  await ensurePendingDir();
  const dirs = await FileSystem.readDirectoryAsync(PENDING_DIR);
  const submissions: PendingSubmission[] = [];

  for (const dir of dirs) {
    try {
      const metadataStr = await FileSystem.readAsStringAsync(
        `${PENDING_DIR}${dir}/metadata.json`
      );
      submissions.push(JSON.parse(metadataStr));
    } catch {
      // Skip corrupted entries
    }
  }

  return submissions;
}

export async function syncPendingSubmission(
  submission: PendingSubmission
): Promise<CreateObservationResponse> {
  // 1. Upload each photo via presigned URL
  const photoKeys: Array<{ photoType: string; storageKey: string }> = [];

  for (const photo of submission.photos) {
    const presigned = await api.post<PresignedUrlResponse>(
      '/uploads/presigned-url',
      {
        filename: `${photo.photoType}.jpg`,
        contentType: 'image/jpeg',
        photoType: photo.photoType,
      }
    );

    await api.uploadFile(presigned.uploadUrl, photo.uri, 'image/jpeg');
    photoKeys.push({
      photoType: photo.photoType,
      storageKey: presigned.storageKey,
    });
  }

  // 2. Create observation
  const result = await api.post<CreateObservationResponse>('/observations', {
    latitude: submission.latitude,
    longitude: submission.longitude,
    gpsAccuracyMeters: submission.gpsAccuracyMeters,
    photos: photoKeys,
    notes: submission.notes,
  });

  // 3. Clean up local files
  await FileSystem.deleteAsync(`${PENDING_DIR}${submission.id}/`, {
    idempotent: true,
  });

  return result;
}

export async function getPendingCount(): Promise<number> {
  const submissions = await getPendingSubmissions();
  return submissions.length;
}
