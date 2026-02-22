import { db, schema } from '../db';
import { eq, and, sql } from 'drizzle-orm';
import { NotFoundError } from '../utils/errors';

interface CreateBountyInput {
  creatorId: string;
  contractZoneId?: string;
  title: string;
  description: string;
  zoneType: 'zip_code' | 'street_corridor';
  zoneIdentifier: string;
  bountyAmountCents: number;
  bonusThreshold?: number;
  bonusAmountCents?: number;
  totalBudgetCents: number;
  startsAt: string;
  expiresAt: string;
  treeTargetCount: number;
}

export async function createBounty(input: CreateBountyInput) {
  const [bounty] = await db
    .insert(schema.bounties)
    .values({
      creatorId: input.creatorId,
      contractZoneId: input.contractZoneId || null,
      title: input.title,
      description: input.description,
      zoneType: input.zoneType,
      zoneIdentifier: input.zoneIdentifier,
      bountyAmountCents: input.bountyAmountCents,
      bonusThreshold: input.bonusThreshold || null,
      bonusAmountCents: input.bonusAmountCents || null,
      totalBudgetCents: input.totalBudgetCents,
      startsAt: new Date(input.startsAt),
      expiresAt: new Date(input.expiresAt),
      treeTargetCount: input.treeTargetCount,
    })
    .returning();

  // If linked to a contract zone, copy geometry from that zone
  if (input.contractZoneId) {
    await db.execute(sql`
      UPDATE bounties
      SET geometry = (
        SELECT ST_Multi(cz.geometry)
        FROM contract_zones cz
        WHERE cz.id = ${input.contractZoneId}::uuid
      )
      WHERE id = ${bounty.id}
    `);
  }

  return bounty;
}

export async function updateBounty(
  bountyId: string,
  creatorId: string,
  data: Record<string, unknown>
) {
  // Verify ownership
  const existing = await db
    .select({ creatorId: schema.bounties.creatorId })
    .from(schema.bounties)
    .where(eq(schema.bounties.id, bountyId))
    .limit(1);

  if (existing.length === 0) throw new NotFoundError('Bounty');
  if (existing[0].creatorId !== creatorId) {
    const err = new Error('You can only update your own bounties');
    (err as any).statusCode = 403;
    throw err;
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.bountyAmountCents !== undefined) updateData.bountyAmountCents = data.bountyAmountCents;
  if (data.bonusThreshold !== undefined) updateData.bonusThreshold = data.bonusThreshold;
  if (data.bonusAmountCents !== undefined) updateData.bonusAmountCents = data.bonusAmountCents;
  if (data.totalBudgetCents !== undefined) updateData.totalBudgetCents = data.totalBudgetCents;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.startsAt !== undefined) updateData.startsAt = new Date(data.startsAt as string);
  if (data.expiresAt !== undefined) updateData.expiresAt = new Date(data.expiresAt as string);
  if (data.treeTargetCount !== undefined) updateData.treeTargetCount = data.treeTargetCount;

  const [updated] = await db
    .update(schema.bounties)
    .set(updateData)
    .where(eq(schema.bounties.id, bountyId))
    .returning();

  return updated;
}

export async function getActiveBounties() {
  const result = await db.execute(sql`
    SELECT
      b.id,
      b.creator_id AS "creatorId",
      b.contract_zone_id AS "contractZoneId",
      b.title,
      b.description,
      b.zone_type AS "zoneType",
      b.zone_identifier AS "zoneIdentifier",
      ST_AsGeoJSON(b.geometry)::json AS geometry,
      b.bounty_amount_cents AS "bountyAmountCents",
      b.bonus_threshold AS "bonusThreshold",
      b.bonus_amount_cents AS "bonusAmountCents",
      b.total_budget_cents AS "totalBudgetCents",
      b.spent_cents AS "spentCents",
      b.status,
      b.starts_at AS "startsAt",
      b.expires_at AS "expiresAt",
      b.tree_target_count AS "treeTargetCount",
      b.trees_completed AS "treesCompleted",
      b.created_at AS "createdAt",
      b.updated_at AS "updatedAt"
    FROM bounties b
    WHERE b.status = 'active'
      AND b.starts_at <= NOW()
      AND b.expires_at > NOW()
    ORDER BY b.bounty_amount_cents DESC
  `);

  return result as unknown as Array<Record<string, unknown>>;
}

export async function getBountyById(id: string) {
  const result = await db.execute(sql`
    SELECT
      b.id,
      b.creator_id AS "creatorId",
      b.contract_zone_id AS "contractZoneId",
      b.title,
      b.description,
      b.zone_type AS "zoneType",
      b.zone_identifier AS "zoneIdentifier",
      ST_AsGeoJSON(b.geometry)::json AS geometry,
      b.bounty_amount_cents AS "bountyAmountCents",
      b.bonus_threshold AS "bonusThreshold",
      b.bonus_amount_cents AS "bonusAmountCents",
      b.total_budget_cents AS "totalBudgetCents",
      b.spent_cents AS "spentCents",
      b.status,
      b.starts_at AS "startsAt",
      b.expires_at AS "expiresAt",
      b.tree_target_count AS "treeTargetCount",
      b.trees_completed AS "treesCompleted",
      b.created_at AS "createdAt",
      b.updated_at AS "updatedAt"
    FROM bounties b
    WHERE b.id = ${id}
  `);

  const rows = result as unknown as Array<Record<string, unknown>>;
  if (rows.length === 0) throw new NotFoundError('Bounty');
  return rows[0];
}

export async function getMyBounties(creatorId: string) {
  const bounties = await db
    .select()
    .from(schema.bounties)
    .where(eq(schema.bounties.creatorId, creatorId))
    .orderBy(sql`created_at DESC`);

  return bounties;
}

export async function getBountyLeaderboard(bountyId: string) {
  const result = await db.execute(sql`
    SELECT
      bc.user_id AS "userId",
      u.display_name AS "displayName",
      COUNT(*)::int AS "treesCount",
      SUM(bc.amount_cents)::int AS "totalEarnedCents"
    FROM bounty_claims bc
    JOIN users u ON u.id = bc.user_id
    WHERE bc.bounty_id = ${bountyId}
      AND bc.status IN ('pending', 'approved', 'paid')
    GROUP BY bc.user_id, u.display_name
    ORDER BY "totalEarnedCents" DESC
    LIMIT 50
  `);

  return result as unknown as Array<Record<string, unknown>>;
}

/**
 * Check if a tree location falls within any active bounty zone.
 * If so, create a bounty claim automatically.
 */
export async function checkAndCreateBountyClaim(
  treeId: string,
  observationId: string,
  userId: string,
  lng: number,
  lat: number
): Promise<{ bountyId: string; bountyTitle: string; amountCents: number } | null> {
  // Find active bounties where the tree is within the bounty geometry
  const result = await db.execute(sql`
    SELECT
      b.id,
      b.title,
      b.bounty_amount_cents AS "bountyAmountCents",
      b.bonus_threshold AS "bonusThreshold",
      b.bonus_amount_cents AS "bonusAmountCents",
      b.trees_completed AS "treesCompleted",
      b.total_budget_cents AS "totalBudgetCents",
      b.spent_cents AS "spentCents"
    FROM bounties b
    WHERE b.status = 'active'
      AND b.starts_at <= NOW()
      AND b.expires_at > NOW()
      AND b.spent_cents < b.total_budget_cents
      AND b.geometry IS NOT NULL
      AND ST_Within(
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
        b.geometry
      )
    ORDER BY b.bounty_amount_cents DESC
    LIMIT 1
  `);

  const rows = result as unknown as Array<{
    id: string;
    title: string;
    bountyAmountCents: number;
    bonusThreshold: number | null;
    bonusAmountCents: number | null;
    treesCompleted: number;
    totalBudgetCents: number;
    spentCents: number;
  }>;

  if (rows.length === 0) return null;

  const bounty = rows[0];

  // Calculate amount: check if bonus threshold is met
  let amountCents = bounty.bountyAmountCents;
  if (
    bounty.bonusThreshold &&
    bounty.bonusAmountCents &&
    bounty.treesCompleted >= bounty.bonusThreshold
  ) {
    amountCents = bounty.bonusAmountCents;
  }

  // Don't exceed remaining budget
  const remaining = bounty.totalBudgetCents - bounty.spentCents;
  if (amountCents > remaining) amountCents = remaining;
  if (amountCents <= 0) return null;

  // Create claim
  await db.insert(schema.bountyClaims).values({
    bountyId: bounty.id,
    userId,
    treeId,
    observationId,
    amountCents,
    status: 'pending',
  });

  // Update bounty counters
  await db.execute(sql`
    UPDATE bounties
    SET spent_cents = spent_cents + ${amountCents},
        trees_completed = trees_completed + 1,
        updated_at = NOW()
    WHERE id = ${bounty.id}
  `);

  return {
    bountyId: bounty.id,
    bountyTitle: bounty.title,
    amountCents,
  };
}

/**
 * Get earnings summary for a user.
 */
export async function getUserEarnings(userId: string) {
  const totalResult = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN status IN ('approved', 'paid') THEN amount_cents ELSE 0 END), 0)::int AS "totalEarnedCents",
      COALESCE(SUM(CASE WHEN status = 'pending' THEN amount_cents ELSE 0 END), 0)::int AS "pendingCents"
    FROM bounty_claims
    WHERE user_id = ${userId}
  `) as unknown as Array<{ totalEarnedCents: number; pendingCents: number }>;

  const breakdownResult = await db.execute(sql`
    SELECT
      bc.bounty_id AS "bountyId",
      b.title AS "bountyTitle",
      COUNT(*)::int AS "claimsCount",
      SUM(bc.amount_cents)::int AS "earnedCents",
      bc.status
    FROM bounty_claims bc
    JOIN bounties b ON b.id = bc.bounty_id
    WHERE bc.user_id = ${userId}
    GROUP BY bc.bounty_id, b.title, bc.status
    ORDER BY "earnedCents" DESC
  `) as unknown as Array<Record<string, unknown>>;

  return {
    totalEarnedCents: totalResult[0]?.totalEarnedCents ?? 0,
    pendingCents: totalResult[0]?.pendingCents ?? 0,
    bountyBreakdown: breakdownResult,
  };
}
