import { sql } from 'drizzle-orm';
import { db } from '../db';

/**
 * Find trees within a given radius (meters) of a point using PostGIS ST_DWithin.
 */
export function stDWithin(lng: number, lat: number, radiusMeters: number) {
  return sql`ST_DWithin(
    location,
    ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
    ${radiusMeters}
  )`;
}

/**
 * Calculate distance between a point and the location column.
 */
export function stDistanceTo(lng: number, lat: number) {
  return sql<number>`ST_Distance(
    location,
    ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
  )`;
}

/**
 * Find nearby trees within a radius, ordered by distance.
 */
export async function findNearbyTrees(
  lng: number,
  lat: number,
  radiusMeters: number
) {
  const result = await db.execute(sql`
    SELECT *, ST_Distance(
      location,
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
    ) as distance
    FROM trees
    WHERE ST_DWithin(
      location,
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
      ${radiusMeters}
    )
    ORDER BY distance ASC
  `);
  return result;
}
