import { db, schema } from '../db';
import { eq, sql } from 'drizzle-orm';

const COOLDOWN_THRESHOLD = 3; // unique observers needed
const COOLDOWN_DAYS = 90;

/**
 * Check if a tree is currently on cooldown.
 */
export function isOnCooldown(cooldownUntil: Date | null): boolean {
  if (!cooldownUntil) return false;
  return new Date(cooldownUntil) > new Date();
}

/**
 * After a new observation, check and potentially set cooldown on a tree.
 * Returns the updated cooldown_until timestamp if cooldown was triggered.
 */
export async function checkAndSetCooldown(treeId: string): Promise<Date | null> {
  // Count unique observers
  const result = await db.execute(sql`
    SELECT COUNT(DISTINCT user_id) as count
    FROM observations
    WHERE tree_id = ${treeId}
  `) as unknown as Array<{ count: string }>;

  const uniqueObservers = parseInt(result[0]?.count || '0', 10);

  // Update the tree's unique_observer_count
  await db
    .update(schema.trees)
    .set({ uniqueObserverCount: uniqueObservers, updatedAt: new Date() })
    .where(eq(schema.trees.id, treeId));

  // Check if we should trigger cooldown
  if (uniqueObservers >= COOLDOWN_THRESHOLD) {
    // Check if already on an active cooldown
    const tree = await db
      .select({ cooldownUntil: schema.trees.cooldownUntil })
      .from(schema.trees)
      .where(eq(schema.trees.id, treeId))
      .limit(1);

    if (!isOnCooldown(tree[0]?.cooldownUntil ?? null)) {
      const cooldownUntil = new Date();
      cooldownUntil.setDate(cooldownUntil.getDate() + COOLDOWN_DAYS);

      await db
        .update(schema.trees)
        .set({ cooldownUntil, updatedAt: new Date() })
        .where(eq(schema.trees.id, treeId));

      return cooldownUntil;
    }
  }

  return null;
}
