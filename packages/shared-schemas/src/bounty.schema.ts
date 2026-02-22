import { z } from 'zod';

export const bountyStatusSchema = z.enum([
  'draft',
  'active',
  'paused',
  'completed',
  'expired',
]);

export const bountyClaimStatusSchema = z.enum([
  'pending',
  'approved',
  'paid',
  'rejected',
]);

export const createBountySchema = z.object({
  contractZoneId: z.string().uuid().optional(),
  title: z.string().min(1).max(300),
  description: z.string().min(1),
  zoneType: z.enum(['zip_code', 'street_corridor']),
  zoneIdentifier: z.string().min(1),
  bountyAmountCents: z.number().int().positive(),
  bonusThreshold: z.number().int().positive().optional(),
  bonusAmountCents: z.number().int().positive().optional(),
  totalBudgetCents: z.number().int().positive(),
  startsAt: z.string(),
  expiresAt: z.string(),
  treeTargetCount: z.number().int().positive(),
});

export const updateBountySchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().min(1).optional(),
  bountyAmountCents: z.number().int().positive().optional(),
  bonusThreshold: z.number().int().positive().nullable().optional(),
  bonusAmountCents: z.number().int().positive().nullable().optional(),
  totalBudgetCents: z.number().int().positive().optional(),
  status: bountyStatusSchema.optional(),
  startsAt: z.string().optional(),
  expiresAt: z.string().optional(),
  treeTargetCount: z.number().int().positive().optional(),
});
