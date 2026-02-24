import { db, schema } from '../db';
import { eq, sql } from 'drizzle-orm';
import { NotFoundError } from '../utils/errors';

export async function getUserById(id: string) {
  const user = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1);

  if (user.length === 0) throw new NotFoundError('User');
  return user[0];
}

export async function updateUser(
  id: string,
  data: { displayName?: string; avatarUrl?: string; role?: 'user' | 'developer' }
) {
  const [updated] = await db
    .update(schema.users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schema.users.id, id))
    .returning();

  if (!updated) throw new NotFoundError('User');
  return updated;
}

export async function getUserStats(userId: string) {
  const totalScansResult = await db.execute(sql`
    SELECT COUNT(*) as count FROM observations WHERE user_id = ${userId}
  `) as unknown as Array<{ count: string }>;
  const totalScans = parseInt(totalScansResult[0]?.count || '0', 10);

  const verifiedResult = await db.execute(sql`
    SELECT COUNT(DISTINCT tree_id) as count
    FROM observations
    WHERE user_id = ${userId} AND status = 'verified'
  `) as unknown as Array<{ count: string }>;
  const verifiedTrees = parseInt(verifiedResult[0]?.count || '0', 10);

  const pendingResult = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM observations
    WHERE user_id = ${userId} AND status IN ('pending_upload', 'pending_ai', 'pending_review')
  `) as unknown as Array<{ count: string }>;
  const pendingObservations = parseInt(pendingResult[0]?.count || '0', 10);

  const cooldownResult = await db.execute(sql`
    SELECT COUNT(DISTINCT t.id) as count
    FROM trees t
    JOIN observations o ON o.tree_id = t.id
    WHERE o.user_id = ${userId}
      AND t.cooldown_until IS NOT NULL
      AND t.cooldown_until > NOW()
  `) as unknown as Array<{ count: string }>;
  const treesOnCooldown = parseInt(cooldownResult[0]?.count || '0', 10);

  const streakResult = await db.execute(sql`
    WITH daily_scans AS (
      SELECT DISTINCT DATE(created_at) as scan_date
      FROM observations
      WHERE user_id = ${userId}
      ORDER BY scan_date DESC
    ),
    streaks AS (
      SELECT scan_date,
        scan_date - (ROW_NUMBER() OVER (ORDER BY scan_date DESC))::int * INTERVAL '1 day' as grp
      FROM daily_scans
    )
    SELECT COUNT(*) as streak
    FROM streaks
    WHERE grp = (SELECT grp FROM streaks LIMIT 1)
  `) as unknown as Array<{ streak: string }>;
  const contributionStreak = parseInt(streakResult[0]?.streak || '0', 10);

  return {
    totalScans,
    verifiedTrees,
    pendingObservations,
    treesOnCooldown,
    contributionStreak,
    neighborhoodsContributed: 0,
  };
}

export async function getUserObservations(userId: string) {
  const observations = await db
    .select({
      id: schema.observations.id,
      treeId: schema.observations.treeId,
      latitude: schema.observations.latitude,
      longitude: schema.observations.longitude,
      createdAt: schema.observations.createdAt,
    })
    .from(schema.observations)
    .where(eq(schema.observations.userId, userId));

  return observations;
}

export async function getWeeklyActivity(userId: string) {
  const result = await db.execute(sql`
    SELECT
      d.day::date as date,
      COALESCE(COUNT(o.id), 0)::int as count
    FROM generate_series(
      CURRENT_DATE - INTERVAL '6 days',
      CURRENT_DATE,
      '1 day'
    ) AS d(day)
    LEFT JOIN observations o
      ON DATE(o.created_at) = d.day::date
      AND o.user_id = ${userId}
    GROUP BY d.day
    ORDER BY d.day ASC
  `) as unknown as Array<{ date: string; count: number }>;

  return result.map((row) => ({
    date: row.date,
    count: Number(row.count),
  }));
}
