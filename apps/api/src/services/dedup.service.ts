import { db } from '../db';
import { sql } from 'drizzle-orm';

const DEDUP_RADIUS_METERS = 5;

export interface NearbyTree {
  id: string;
  latitude: number;
  longitude: number;
  distance: number;
  cooldownUntil: Date | null;
  observationCount: number;
  uniqueObserverCount: number;
}

/**
 * Find the closest tree within 5 meters of the given coordinates.
 * Returns null if no tree is found nearby.
 */
export async function findNearestTree(
  lng: number,
  lat: number
): Promise<NearbyTree | null> {
  const result = await db.execute(sql`
    SELECT
      id,
      latitude,
      longitude,
      cooldown_until as "cooldownUntil",
      observation_count as "observationCount",
      unique_observer_count as "uniqueObserverCount",
      ST_Distance(
        location,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      ) as distance
    FROM trees
    WHERE ST_DWithin(
      location,
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
      ${DEDUP_RADIUS_METERS}
    )
    ORDER BY ST_Distance(
      location,
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
    ) ASC
    LIMIT 1
  `);

  const rows = result as unknown as NearbyTree[];
  if (rows.length === 0) return null;
  return rows[0];
}
