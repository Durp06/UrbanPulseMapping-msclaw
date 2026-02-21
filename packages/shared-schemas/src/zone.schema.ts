import { z } from 'zod';

export const zoneTypeSchema = z.enum(['zip_code', 'street_corridor']);

export const zoneStatusSchema = z.enum(['active', 'completed', 'paused', 'upcoming']);

export const contractZoneSchema = z.object({
  id: z.string().uuid(),
  contractId: z.string().uuid(),
  zoneType: zoneTypeSchema,
  zoneIdentifier: z.string(),
  displayName: z.string(),
  bufferMeters: z.number().int(),
  startCrossStreet: z.string().nullable(),
  endCrossStreet: z.string().nullable(),
  corridorName: z.string().nullable(),
  status: zoneStatusSchema,
  progressPercentage: z.number(),
  treeTargetCount: z.number().int().nullable(),
  treesMappedCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const contractSchema = z.object({
  id: z.string().uuid(),
  municipalityName: z.string(),
  contractName: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  status: z.string(),
  totalBudget: z.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const getZonesQuerySchema = z.object({
  contract_id: z.string().uuid().optional(),
  status: zoneStatusSchema.optional(),
  bounds: z.string().optional(), // sw_lat,sw_lng,ne_lat,ne_lng
});

export const getZoneTreesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
