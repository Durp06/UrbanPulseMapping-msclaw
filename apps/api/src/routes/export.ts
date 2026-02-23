import type { FastifyInstance } from 'fastify';
import { db, schema } from '../db';
import { sql } from 'drizzle-orm';

export async function exportRoutes(fastify: FastifyInstance) {
  // GET /api/export/trees
  fastify.get('/api/export/trees', async (request, reply) => {
    const { format = 'csv' } = request.query as { format?: string };

    const rows = await db.execute(sql`
      SELECT
        t.id as "TREE_ID",
        t.latitude as "LATITUDE",
        t.longitude as "LONGITUDE",
        ST_AsText(t.location) as "WKT_GEOM",
        t.species_common as "SPP_COMMON",
        t.species_scientific as "SPP_SCIENTIFIC",
        t.species_confidence as "SPP_CONFIDENCE",
        t.health_status as "HEALTH_STATUS",
        t.estimated_dbh_cm as "DBH_CM",
        t.estimated_height_m as "HEIGHT_M",
        t.condition_rating as "CONDITION",
        t.height_estimate_m as "HEIGHT_EST_M",
        t.canopy_spread_m as "CANOPY_SPREAD_M",
        t.crown_dieback as "CROWN_DIEBACK",
        t.trunk_defects as "TRUNK_DEFECTS",
        t.location_type as "LOCATION_TYPE",
        t.nearest_address as "ADDRESS",
        t.site_type as "SITE_TYPE",
        t.overhead_utility_conflict as "UTILITY_CONFLICT",
        t.maintenance_flag as "MAINTENANCE",
        t.sidewalk_damage as "SIDEWALK_DMG",
        t.vacant_planting_site as "VACANT_SITE",
        t.land_use_type as "LAND_USE",
        t.mulch_soil_condition as "MULCH_SOIL",
        t.risk_flag as "RISK_FLAG",
        t.observation_count as "OBS_COUNT",
        t.unique_observer_count as "OBSERVER_COUNT",
        t.verification_tier as "VERIFY_TIER",
        t.contract_zone_id as "ZONE_ID",
        t.created_at as "CREATED_AT",
        t.updated_at as "UPDATED_AT"
      FROM trees t
      ORDER BY t.created_at DESC
    `);

    if (format === 'geojson') {
      const features = (rows as any[]).map((row: any) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [row.LONGITUDE, row.LATITUDE],
        },
        properties: {
          TREE_ID: row.TREE_ID,
          SPP_COMMON: row.SPP_COMMON,
          SPP_SCIENTIFIC: row.SPP_SCIENTIFIC,
          SPP_CONFIDENCE: row.SPP_CONFIDENCE,
          HEALTH_STATUS: row.HEALTH_STATUS,
          DBH_CM: row.DBH_CM,
          HEIGHT_M: row.HEIGHT_M,
          CONDITION: row.CONDITION,
          HEIGHT_EST_M: row.HEIGHT_EST_M,
          CANOPY_SPREAD_M: row.CANOPY_SPREAD_M,
          CROWN_DIEBACK: row.CROWN_DIEBACK,
          TRUNK_DEFECTS: row.TRUNK_DEFECTS,
          LOCATION_TYPE: row.LOCATION_TYPE,
          ADDRESS: row.ADDRESS,
          SITE_TYPE: row.SITE_TYPE,
          UTILITY_CONFLICT: row.UTILITY_CONFLICT,
          MAINTENANCE: row.MAINTENANCE,
          SIDEWALK_DMG: row.SIDEWALK_DMG,
          VACANT_SITE: row.VACANT_SITE,
          LAND_USE: row.LAND_USE,
          MULCH_SOIL: row.MULCH_SOIL,
          RISK_FLAG: row.RISK_FLAG,
          OBS_COUNT: row.OBS_COUNT,
          OBSERVER_COUNT: row.OBSERVER_COUNT,
          VERIFY_TIER: row.VERIFY_TIER,
          ZONE_ID: row.ZONE_ID,
          CREATED_AT: row.CREATED_AT,
          UPDATED_AT: row.UPDATED_AT,
        },
      }));

      return reply.header('Content-Type', 'application/geo+json').send({
        type: 'FeatureCollection',
        features,
      });
    }

    // CSV format (default)
    const headers = [
      'TREE_ID', 'LATITUDE', 'LONGITUDE', 'WKT_GEOM',
      'SPP_COMMON', 'SPP_SCIENTIFIC', 'SPP_CONFIDENCE',
      'HEALTH_STATUS', 'DBH_CM', 'HEIGHT_M',
      'CONDITION', 'HEIGHT_EST_M', 'CANOPY_SPREAD_M',
      'CROWN_DIEBACK', 'TRUNK_DEFECTS',
      'LOCATION_TYPE', 'ADDRESS', 'SITE_TYPE',
      'UTILITY_CONFLICT', 'MAINTENANCE', 'SIDEWALK_DMG',
      'VACANT_SITE', 'LAND_USE', 'MULCH_SOIL', 'RISK_FLAG',
      'OBS_COUNT', 'OBSERVER_COUNT', 'VERIFY_TIER', 'ZONE_ID',
      'CREATED_AT', 'UPDATED_AT',
    ];

    const escapeCsv = (val: unknown): string => {
      if (val === null || val === undefined) return '';
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows = [headers.join(',')];
    for (const row of rows as any[]) {
      csvRows.push(headers.map((h) => escapeCsv(row[h])).join(','));
    }

    return reply
      .header('Content-Type', 'text/csv')
      .header('Content-Disposition', 'attachment; filename="trees_export.csv"')
      .send(csvRows.join('\n'));
  });
}
