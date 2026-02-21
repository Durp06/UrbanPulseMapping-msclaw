import { z } from 'zod';

export const verificationTierSchema = z.enum([
  'unverified',
  'ai_verified',
  'community_verified',
  'expert_verified',
]);

export const observationStatusSchema = z.enum([
  'pending_upload',
  'pending_ai',
  'pending_review',
  'verified',
  'rejected',
]);

export const photoTypeSchema = z.enum([
  'full_tree_angle1',
  'full_tree_angle2',
  'bark_closeup',
]);

export const treeSchema = z.object({
  id: z.string().uuid(),
  latitude: z.number(),
  longitude: z.number(),
  speciesCommon: z.string().nullable(),
  speciesScientific: z.string().nullable(),
  speciesConfidence: z.number().min(0).max(1).nullable(),
  healthStatus: z.string().nullable(),
  healthConfidence: z.number().min(0).max(1).nullable(),
  estimatedDbhCm: z.number().nullable(),
  estimatedHeightM: z.number().nullable(),
  observationCount: z.number().int(),
  uniqueObserverCount: z.number().int(),
  lastObservedAt: z.string().nullable(),
  cooldownUntil: z.string().nullable(),
  verificationTier: verificationTierSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const photoSchema = z.object({
  id: z.string().uuid(),
  observationId: z.string().uuid(),
  photoType: photoTypeSchema,
  storageKey: z.string(),
  storageUrl: z.string().nullable(),
  widthPx: z.number().int().nullable(),
  heightPx: z.number().int().nullable(),
  fileSizeBytes: z.number().int().nullable(),
  mimeType: z.string().nullable(),
  capturedAt: z.string().nullable(),
  deviceModel: z.string().nullable(),
  osVersion: z.string().nullable(),
  createdAt: z.string(),
});

export const observationSchema = z.object({
  id: z.string().uuid(),
  treeId: z.string().uuid().nullable(),
  userId: z.string().uuid(),
  latitude: z.number(),
  longitude: z.number(),
  gpsAccuracyMeters: z.number().nullable(),
  status: observationStatusSchema,
  aiSpeciesResult: z.string().nullable(),
  aiHealthResult: z.string().nullable(),
  aiMeasurementResult: z.string().nullable(),
  notes: z.string().nullable(),
  photos: z.array(photoSchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Request schemas
export const getTreesQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(1).max(50000).default(500),
  status: verificationTierSchema.optional(),
});

export const createObservationPhotoSchema = z.object({
  photoType: photoTypeSchema,
  storageKey: z.string().min(1),
});

export const createObservationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  gpsAccuracyMeters: z.number().min(0),
  photos: z.array(createObservationPhotoSchema).length(3),
  notes: z.string().optional(),
});

export const presignedUrlRequestSchema = z.object({
  filename: z.string().min(1),
  contentType: z.enum(['image/jpeg', 'image/heic']),
  photoType: photoTypeSchema,
});

// AI result schema (internal endpoint)
export const aiSpeciesResultSchema = z.object({
  common: z.string(),
  scientific: z.string(),
  confidence: z.number().min(0).max(1),
});

export const aiHealthResultSchema = z.object({
  status: z.string(),
  confidence: z.number().min(0).max(1),
  issues: z.array(z.string()),
});

export const aiMeasurementResultSchema = z.object({
  dbhCm: z.number().positive(),
  heightM: z.number().positive(),
});

export const aiResultSchema = z.object({
  species: aiSpeciesResultSchema.nullable(),
  health: aiHealthResultSchema.nullable(),
  measurements: aiMeasurementResultSchema.nullable(),
});
