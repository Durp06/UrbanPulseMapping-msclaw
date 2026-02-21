import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { getZonesQuerySchema, getZoneTreesQuerySchema } from '@urban-pulse/shared-schemas';
import * as zoneService from '../services/zone.service';

export async function zoneRoutes(fastify: FastifyInstance) {
  // GET /api/zones - GeoJSON FeatureCollection
  fastify.get(
    '/api/zones',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const parsed = getZonesQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Validation Error',
          message: parsed.error.issues.map((i) => i.message).join(', '),
        });
      }

      const geojson = await zoneService.getZonesGeoJson({
        contractId: parsed.data.contract_id,
        status: parsed.data.status,
        bounds: parsed.data.bounds,
      });

      return geojson;
    }
  );

  // GET /api/zones/summary - lightweight, no geometry
  fastify.get(
    '/api/zones/summary',
    { preHandler: [authMiddleware] },
    async (_request, _reply) => {
      const zones = await zoneService.getZonesSummary();
      return { zones };
    }
  );

  // GET /api/zones/:id - single zone detail
  fastify.get(
    '/api/zones/:id',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const feature = await zoneService.getZoneById(id);
        return feature;
      } catch (error: any) {
        if (error.name === 'NotFoundError') {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: error.message,
          });
        }
        throw error;
      }
    }
  );

  // GET /api/zones/:id/trees - paginated trees in zone
  fastify.get(
    '/api/zones/:id/trees',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = getZoneTreesQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Validation Error',
          message: parsed.error.issues.map((i) => i.message).join(', '),
        });
      }

      try {
        const result = await zoneService.getZoneTrees(
          id,
          parsed.data.page,
          parsed.data.limit
        );
        return result;
      } catch (error: any) {
        if (error.name === 'NotFoundError') {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: error.message,
          });
        }
        throw error;
      }
    }
  );
}
