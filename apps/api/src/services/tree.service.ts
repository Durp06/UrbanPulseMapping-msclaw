import { db, schema } from '../db';
import { eq, sql } from 'drizzle-orm';
import { NotFoundError } from '../utils/errors';

export async function getTreesInRadius(
  lat: number,
  lng: number,
  radiusMeters: number,
  statusFilter?: string,
  zoneId?: string,
  zoneType?: string
) {
  let query = sql`
    SELECT
      t.id,
      t.latitude,
      t.longitude,
      t.species_common as "speciesCommon",
      t.species_scientific as "speciesScientific",
      t.species_confidence as "speciesConfidence",
      t.health_status as "healthStatus",
      t.health_confidence as "healthConfidence",
      t.estimated_dbh_cm as "estimatedDbhCm",
      t.estimated_height_m as "estimatedHeightM",
      t.observation_count as "observationCount",
      t.unique_observer_count as "uniqueObserverCount",
      t.last_observed_at as "lastObservedAt",
      t.cooldown_until as "cooldownUntil",
      t.verification_tier as "verificationTier",
      t.contract_zone_id as "contractZoneId",
      t.condition_rating as "conditionRating",
      t.height_estimate_m as "heightEstimateM",
      t.canopy_spread_m as "canopySpreadM",
      t.crown_dieback as "crownDieback",
      t.trunk_defects as "trunkDefects",
      t.location_type as "locationType",
      t.nearest_address as "nearestAddress",
      t.site_type as "siteType",
      t.overhead_utility_conflict as "overheadUtilityConflict",
      t.maintenance_flag as "maintenanceFlag",
      t.sidewalk_damage as "sidewalkDamage",
      t.vacant_planting_site as "vacantPlantingSite",
      t.land_use_type as "landUseType",
      t.mulch_soil_condition as "mulchSoilCondition",
      t.risk_flag as "riskFlag",
      t.created_at as "createdAt",
      t.updated_at as "updatedAt"
    FROM trees t
    WHERE ST_DWithin(
      t.location,
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
      ${radiusMeters}
    )
  `;

  if (statusFilter) {
    query = sql`${query} AND t.verification_tier = ${statusFilter}`;
  }

  if (zoneId) {
    query = sql`${query} AND t.contract_zone_id = ${zoneId}::uuid`;
  }

  if (zoneType) {
    query = sql`${query} AND t.contract_zone_id IN (
      SELECT cz.id FROM contract_zones cz WHERE cz.zone_type = ${zoneType}::zone_type
    )`;
  }

  query = sql`${query} ORDER BY ST_Distance(
    t.location,
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
