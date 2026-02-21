import { db } from '../db';
import { sql } from 'drizzle-orm';
import IORedis from 'ioredis';
import { NotFoundError } from '../utils/errors';

const CACHE_TTL = 300; // 5 minutes

let redis: IORedis | null = null;

function getRedis(): IORedis | null {
  if (!redis) {
    try {
      redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });
      redis.connect().catch(() => {
        redis = null;
      });
    } catch {
      return null;
    }
  }
  return redis;
}

async function getCached(key: string): Promise<string | null> {
  try {
    const r = getRedis();
    if (!r) return null;
    return await r.get(key);
  } catch {
    return null;
  }
}

async function setCache(key: string, value: string): Promise<void> {
  try {
    const r = getRedis();
    if (!r) return;
    await r.set(key, value, 'EX', CACHE_TTL);
  } catch {
    // ignore cache errors
  }
}

interface GetZonesOptions {
  contractId?: string;
  status?: string;
  bounds?: string; // sw_lat,sw_lng,ne_lat,ne_lng
}

const ZONES_SELECT = sql`
  SELECT json_build_object(
    'type', 'FeatureCollection',
    'features', COALESCE(json_agg(
      json_build_object(
        'type', 'Feature',
        'id', cz.id,
        'geometry', ST_AsGeoJSON(ST_Simplify(cz.geometry, 0.0001))::json,
        'properties', json_build_object(
          'id', cz.id,
          'contractId', cz.contract_id,
          'zoneType', cz.zone_type,
          'zoneIdentifier', cz.zone_identifier,
          'displayName', cz.display_name,
          'bufferMeters', cz.buffer_meters,
          'startCrossStreet', cz.start_cross_street,
          'endCrossStreet', cz.end_cross_street,
          'corridorName', cz.corridor_name,
          'status', cz.status,
          'progressPercentage', cz.progress_percentage,
          'treeTargetCount', cz.tree_target_count,
          'treesMappedCount', cz.trees_mapped_count,
          'contractName', c.contract_name,
          'municipalityName', c.municipality_name,
          'createdAt', cz.created_at,
          'updatedAt', cz.updated_at
        )
      )
    ), '[]'::json)
  ) AS geojson
  FROM contract_zones cz
  JOIN contracts c ON c.id = cz.contract_id
`;

export async function getZonesGeoJson(options: GetZonesOptions) {
  const cacheKey = `zones:geojson:${JSON.stringify(options)}`;
  const cached = await getCached(cacheKey);
  if (cached) return JSON.parse(cached);

  let query;

  if (options.contractId && options.status && options.bounds) {
    const parts = options.bounds.split(',').map(Number);
    const [swLat, swLng, neLat, neLng] = parts;
    query = sql`${ZONES_SELECT} WHERE cz.contract_id = ${options.contractId}::uuid AND cz.status = ${options.status}::zone_status AND ST_Intersects(cz.geometry, ST_MakeEnvelope(${swLng}, ${swLat}, ${neLng}, ${neLat}, 4326))`;
  } else if (options.contractId && options.status) {
    query = sql`${ZONES_SELECT} WHERE cz.contract_id = ${options.contractId}::uuid AND cz.status = ${options.status}::zone_status`;
  } else if (options.contractId && options.bounds) {
    const parts = options.bounds.split(',').map(Number);
    const [swLat, swLng, neLat, neLng] = parts;
    query = sql`${ZONES_SELECT} WHERE cz.contract_id = ${options.contractId}::uuid AND ST_Intersects(cz.geometry, ST_MakeEnvelope(${swLng}, ${swLat}, ${neLng}, ${neLat}, 4326))`;
  } else if (options.status && options.bounds) {
    const parts = options.bounds.split(',').map(Number);
    const [swLat, swLng, neLat, neLng] = parts;
    query = sql`${ZONES_SELECT} WHERE cz.status = ${options.status}::zone_status AND ST_Intersects(cz.geometry, ST_MakeEnvelope(${swLng}, ${swLat}, ${neLng}, ${neLat}, 4326))`;
  } else if (options.contractId) {
    query = sql`${ZONES_SELECT} WHERE cz.contract_id = ${options.contractId}::uuid`;
  } else if (options.status) {
    query = sql`${ZONES_SELECT} WHERE cz.status = ${options.status}::zone_status`;
  } else if (options.bounds) {
    const parts = options.bounds.split(',').map(Number);
    const [swLat, swLng, neLat, neLng] = parts;
    query = sql`${ZONES_SELECT} WHERE ST_Intersects(cz.geometry, ST_MakeEnvelope(${swLng}, ${swLat}, ${neLng}, ${neLat}, 4326))`;
  } else {
    query = ZONES_SELECT;
  }

  const result = await db.execute(query);
  const rows = result as unknown as Array<{ geojson: unknown }>;
  const geojson = rows[0]?.geojson;

  await setCache(cacheKey, JSON.stringify(geojson));
  return geojson;
}

export async function getZoneById(id: string) {
  const cacheKey = `zones:detail:${id}`;
  const cached = await getCached(cacheKey);
  if (cached) return JSON.parse(cached);

  const result = await db.execute(sql`
    SELECT json_build_object(
      'type', 'Feature',
      'id', cz.id,
      'geometry', ST_AsGeoJSON(cz.geometry)::json,
      'properties', json_build_object(
        'id', cz.id,
        'contractId', cz.contract_id,
        'zoneType', cz.zone_type,
        'zoneIdentifier', cz.zone_identifier,
        'displayName', cz.display_name,
        'bufferMeters', cz.buffer_meters,
        'startCrossStreet', cz.start_cross_street,
        'endCrossStreet', cz.end_cross_street,
        'corridorName', cz.corridor_name,
        'status', cz.status,
        'progressPercentage', cz.progress_percentage,
        'treeTargetCount', cz.tree_target_count,
        'treesMappedCount', cz.trees_mapped_count,
        'contractName', c.contract_name,
        'municipalityName', c.municipality_name,
        'centerline', ST_AsGeoJSON(cz.centerline)::json,
        'createdAt', cz.created_at,
        'updatedAt', cz.updated_at
      )
    ) AS feature
    FROM contract_zones cz
    JOIN contracts c ON c.id = cz.contract_id
    WHERE cz.id = ${id}
  `);

  const rows = result as unknown as Array<{ feature: unknown }>;
  if (!rows[0]?.feature) throw new NotFoundError('Zone');

  const feature = rows[0].feature;
  await setCache(cacheKey, JSON.stringify(feature));
  return feature;
}

export async function getZoneTrees(zoneId: string, page: number, limit: number) {
  // Verify zone exists
  const zoneCheck = await db.execute(sql`
    SELECT id FROM contract_zones WHERE id = ${zoneId} LIMIT 1
  `);
  const zoneRows = zoneCheck as unknown as Array<{ id: string }>;
  if (zoneRows.length === 0) throw new NotFoundError('Zone');

  const offset = (page - 1) * limit;

  const countResult = await db.execute(sql`
    SELECT COUNT(*)::int AS total FROM trees WHERE contract_zone_id = ${zoneId}
  `);
  const total = (countResult as unknown as Array<{ total: number }>)[0].total;

  const trees = await db.execute(sql`
    SELECT
      id,
      latitude,
      longitude,
      species_common AS "speciesCommon",
      species_scientific AS "speciesScientific",
      species_confidence AS "speciesConfidence",
      health_status AS "healthStatus",
      health_confidence AS "healthConfidence",
      estimated_dbh_cm AS "estimatedDbhCm",
      estimated_height_m AS "estimatedHeightM",
      observation_count AS "observationCount",
      unique_observer_count AS "uniqueObserverCount",
      last_observed_at AS "lastObservedAt",
      cooldown_until AS "cooldownUntil",
      verification_tier AS "verificationTier",
      contract_zone_id AS "contractZoneId",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM trees
    WHERE contract_zone_id = ${zoneId}
    ORDER BY last_observed_at DESC NULLS LAST
    LIMIT ${limit} OFFSET ${offset}
  `);

  return { trees, total, page, limit };
}

export async function getZonesSummary() {
  const cacheKey = 'zones:summary';
  const cached = await getCached(cacheKey);
  if (cached) return JSON.parse(cached);

  const result = await db.execute(sql`
    SELECT
      cz.id,
      cz.contract_id AS "contractId",
      cz.zone_type AS "zoneType",
      cz.zone_identifier AS "zoneIdentifier",
      cz.display_name AS "displayName",
      cz.status,
      cz.progress_percentage AS "progressPercentage",
      cz.tree_target_count AS "treeTargetCount",
      cz.trees_mapped_count AS "treesMappedCount",
      c.contract_name AS "contractName"
    FROM contract_zones cz
    JOIN contracts c ON c.id = cz.contract_id
    ORDER BY cz.status, cz.display_name
  `);

  const zones = result as unknown as unknown[];
  await setCache(cacheKey, JSON.stringify(zones));
  return zones;
}

/**
 * Find the contract zone that contains a given point using ST_Within.
 * Returns the zone ID or null if point is outside all zones.
 */
export async function findZoneForPoint(lng: number, lat: number): Promise<string | null> {
  const result = await db.execute(sql`
    SELECT id FROM contract_zones
    WHERE ST_Within(
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
      geometry
    )
    AND status = 'active'
    ORDER BY zone_type ASC
    LIMIT 1
  `);

  const rows = result as unknown as Array<{ id: string }>;
  return rows.length > 0 ? rows[0].id : null;
}

/**
 * Increment the trees_mapped_count for a zone.
 */
export async function incrementZoneTreeCount(zoneId: string): Promise<void> {
  await db.execute(sql`
    UPDATE contract_zones
    SET trees_mapped_count = trees_mapped_count + 1,
        updated_at = NOW()
    WHERE id = ${zoneId}
  `);
}
