import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { getTreesQuerySchema } from '@urban-pulse/shared-schemas';
import * as treeService from '../services/tree.service';

export async function treeRoutes(fastify: FastifyInstance) {
  // GET /api/trees
  fastify.get(
    '/api/trees',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const parsed = getTreesQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Validation Error',
          message: parsed.error.issues.map((i) => i.message).join(', '),
        });
      }

      const { lat, lng, radius, status } = parsed.data;
      const trees = await treeService.getTreesInRadius(lat, lng, radius, status);

      return { trees, count: trees.length };
    }
  );

  // GET /api/trees/:id
  fastify.get(
    '/api/trees/:id',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const tree = await treeService.getTreeById(id);
        const observations = await treeService.getTreeObservations(id);
        return { tree, observations };
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

  // GET /api/trees/:id/observations
  fastify.get(
    '/api/trees/:id/observations',
    { preHandler: [authMiddleware] },
    async (request, _reply) => {
      const { id } = request.params as { id: string };
      const observations = await treeService.getTreeObservations(id);
      return { observations };
    }
  );
}
