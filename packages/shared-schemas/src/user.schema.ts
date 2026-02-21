import { z } from 'zod';

export const userSchema = z.object({
  id: z.string().uuid(),
  firebaseUid: z.string(),
  email: z.string().email().nullable(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const updateUserSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional(),
});

export const userStatsSchema = z.object({
  totalScans: z.number().int(),
  verifiedTrees: z.number().int(),
  pendingObservations: z.number().int(),
  treesOnCooldown: z.number().int(),
  contributionStreak: z.number().int(),
  neighborhoodsContributed: z.number().int(),
});
