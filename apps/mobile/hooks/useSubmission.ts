import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useScanStore } from '../lib/store';
import { savePendingSubmission, syncPendingSubmission } from '../lib/offline-queue';
import type {
  CreateObservationResponse,
  PresignedUrlResponse,
} from '@urban-pulse/shared-types';

export function useSubmission() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const queryClient = useQueryClient();
  const scanState = useScanStore();

  const mutation = useMutation({
    mutationFn: async (): Promise<CreateObservationResponse> => {
      const { photos, latitude, longitude, gpsAccuracy, notes, inspection, aiEnabled } = scanState;

      if (!latitude || !longitude) {
        throw new Error('Location not available');
      }

      if (photos.length !== 3) {
        throw new Error('All 3 photos are required');
      }

      try {
        // Upload photos via presigned URLs
        const photoKeys: Array<{ photoType: string; storageKey: string }> = [];
        let uploadedCount = 0;

        for (const photo of photos) {
          setUploadProgress(uploadedCount / photos.length);

          const presigned = await api.post<PresignedUrlResponse>(
            '/uploads/presigned-url',
            {
              filename: `${photo.type}.jpg`,
              contentType: 'image/jpeg',
              photoType: photo.type,
            }
          );

          await api.uploadFile(presigned.uploadUrl, photo.uri, 'image/jpeg');
          photoKeys.push({
            photoType: photo.type,
            storageKey: presigned.storageKey,
          });

          uploadedCount++;
          setUploadProgress(uploadedCount / photos.length);
        }

        // Build inspection payload (only include fields that were set)
        const inspectionPayload: Record<string, unknown> = {};
        if (inspection.conditionRating) inspectionPayload.conditionRating = inspection.conditionRating;
        if (inspection.crownDieback !== null) inspectionPayload.crownDieback = inspection.crownDieback;
        if (inspection.trunkDefects.cavity || inspection.trunkDefects.crack || inspection.trunkDefects.lean) {
          inspectionPayload.trunkDefects = inspection.trunkDefects;
        }
        if (inspection.riskFlag !== null) inspectionPayload.riskFlag = inspection.riskFlag;
        if (inspection.maintenanceFlag) inspectionPayload.maintenanceFlag = inspection.maintenanceFlag;
        if (inspection.locationType) inspectionPayload.locationType = inspection.locationType;
        if (inspection.siteType) inspectionPayload.siteType = inspection.siteType;
        if (inspection.overheadUtilityConflict !== null) inspectionPayload.overheadUtilityConflict = inspection.overheadUtilityConflict;
        if (inspection.sidewalkDamage !== null) inspectionPayload.sidewalkDamage = inspection.sidewalkDamage;
        if (inspection.mulchSoilCondition) inspectionPayload.mulchSoilCondition = inspection.mulchSoilCondition;
        if (inspection.nearestAddress) inspectionPayload.nearestAddress = inspection.nearestAddress;

        // Create observation
        const result = await api.post<CreateObservationResponse>(
          '/observations',
          {
            latitude,
            longitude,
            gpsAccuracyMeters: gpsAccuracy || 0,
            photos: photoKeys,
            notes: notes || undefined,
            inspection: Object.keys(inspectionPayload).length > 0 ? inspectionPayload : undefined,
            skipAi: aiEnabled ? undefined : true,
          }
        );

        return result;
      } catch (error) {
        // Save to offline queue on failure
        await savePendingSubmission({
          latitude,
          longitude,
          gpsAccuracyMeters: gpsAccuracy || 0,
          notes: notes || undefined,
          photos: photos.map((p) => ({ uri: p.uri, photoType: p.type })),
        });

        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['trees'] });
      queryClient.invalidateQueries({ queryKey: ['userStats'] });
      queryClient.invalidateQueries({ queryKey: ['earnings'] });
      // Store bounty claim info before reset for success screen
      if (data.bountyClaim) {
        scanState.setLastBountyClaim(data.bountyClaim);
      }
      setUploadProgress(0);
    },
  });

  return {
    submit: mutation.mutate,
    isSubmitting: mutation.isPending,
    error: mutation.error,
    uploadProgress,
    isSuccess: mutation.isSuccess,
  };
}
