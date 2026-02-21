import { db, schema } from '../db';
import { eq, sql } from 'drizzle-orm';
import { NotFoundError } from '../utils/errors';

export async function getTreesInRadius(
  lat: number,
  lng: number,
  radiusMeters: number,
  statusFilter?: string
) {
  let query = sql`
    SELECT
      id,
      latitude,
      longitude,
      species_common as "speciesCommon",
      species_scientific as "speciesScientific",
      species_confidence as "speciesConfidence",
      health_status as "healthStatus",
      health_confidence as "healthConfidence",
      estimated_dbh_cm as "estimatedDbhCm",
      estimated_height_m as "estimatedHeightM",
      observation_count as "observationCount",
      unique_observer_count as "uniqueObserverCount",
      last_observed_at as "lastObservedAt",
      cooldown_until as "cooldownUntil",
      verification_tier as "verificationTier",
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM trees
    WHERE ST_DWithin(
      location,
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
      ${radiusMeters}
    )
  `;

  if (statusFilter) {
    query = sql`${query} AND verification_tier = ${statusFilter}`;
  }

  query = sql`${query} ORDER BY ST_Distance(
    location,
    ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
  ) ASC`;

  const trees = await db.execute(query);
  return trees;
}

export async function getTreeById(id: string) {
  const tree = await db
    .select()
    .from(schema.trees)
    .where(eq(schema.trees.id, id))
    .limit(1);

  if (tree.length === 0) throw new NotFoundError('Tree');
  return tree[0];
}

export async function getTreeObservations(treeId: string) {
  const obs = await db
    .select()
    .from(schema.observations)
    .where(eq(schema.observations.treeId, treeId));
  return obs;
}

export async function createTree(latitude: number, longitude: number) {
  const [tree] = await db
    .insert(schema.trees)
    .values({
      latitude,
      longitude,
      observationCount: 1,
      uniqueObserverCount: 1,
      lastObservedAt: new Date(),
    })
    .returning();
  return tree;
}

export async function incrementTreeStats(treeId: string) {
  await db
    .update(schema.trees)
    .set({
      observationCount: sql`observation_count + 1`,
      lastObservedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.trees.id, treeId));
}
