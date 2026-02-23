import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { createBountySchema, updateBountySchema } from '@urban-pulse/shared-schemas';
import * as bountyService from '../services/bounty.service';

export async function bountyRoutes(fastify: FastifyInstance) {
  // GET /api/bounties — list active bounties (public, authenticated)
  fastify.get(
    '/api/bounties',
    { preHandler: [authMiddleware] },
    async (_request, _reply) => {
      const bounties = await bountyService.getActiveBounties();
      return { bounties };
    }
  );

  // GET /api/bounties/mine — developer's own bounties
  fastify.get(
    '/api/bounties/mine',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      if (request.user.role !== 'developer' && request.user.role !== 'admin') {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Developer role required',
        });
      }

      const bounties = await bountyService.getMyBounties(request.user.id);
      return { bounties };
    }
  );

  // GET /api/bounties/:id — bounty detail
  fastify.get(
    '/api/bounties/:id',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const bounty = await bountyService.getBountyById(id);
        return { bounty };
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

  // GET /api/bounties/:id/leaderboard — top earners for a bounty
  fastify.get(
    '/api/bounties/:id/leaderboard',
    { preHandler: [authMiddleware] },
    async (request, _reply) => {
      const { id } = request.params as { id: string };
      const leaderboard = await bountyService.getBountyLeaderboard(id);
      return { leaderboard };
    }
  );

  // POST /api/bounties — create a bounty (developer only)
  fastify.post(
    '/api/bounties',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      if (request.user.role !== 'developer' && request.user.role !== 'admin') {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Developer role required',
        });
      }

      const parsed = createBountySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Validation Error',
          message: parsed.error.issues.map((i) => i.message).join(', '),
        });
      }

      const bounty = await bountyService.createBounty({
        creatorId: request.user.id,
        ...parsed.data,
      });

      return reply.status(201).send({ bounty });
    }
  );

  // PATCH /api/bounties/:id — update a bounty (developer only, own bounties)
  fastify.patch(
    '/api/bounties/:id',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      if (request.user.role !== 'developer' && request.user.role !== 'admin') {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Developer role required',
        });
      }

      const { id } = request.params as { id: string };
      const parsed = updateBountySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Validation Error',
          message: parsed.error.issues.map((i) => i.message).join(', '),
        });
      }

      try {
        const bounty = await bountyService.updateBounty(
          id,
          request.user.id,
          parsed.data
        );
        return { bounty };
      } catch (error: any) {
        if (error.name === 'NotFoundError') {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: error.message,
          });
        }
        if (error.statusCode === 403) {
          return reply.status(403).send({
            statusCode: 403,
            error: 'Forbidden',
            message: error.message,
          });
        }
        if (error.statusCode === 400) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: error.message,
          });
        }
        throw error;
      }
    }
  );

  // GET /api/users/me/earnings — user earnings from bounties
  fastify.get(
    '/api/users/me/earnings',
    { preHandler: [authMiddleware] },
    async (request, _reply) => {
      const earnings = await bountyService.getUserEarnings(request.user.id);
      return earnings;
    }
  );
}
