import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { updateUserSchema } from '@urban-pulse/shared-schemas';
import * as userService from '../services/user.service';

export async function userRoutes(fastify: FastifyInstance) {
  // GET /api/users/me
  fastify.get(
    '/api/users/me',
    { preHandler: [authMiddleware] },
    async (request, _reply) => {
      const user = await userService.getUserById(request.user.id);
      return { user };
    }
  );

  // GET /api/users/me/stats
  fastify.get(
    '/api/users/me/stats',
    { preHandler: [authMiddleware] },
    async (request, _reply) => {
      const stats = await userService.getUserStats(request.user.id);
      return stats;
    }
  );

  // GET /api/users/me/observations — user's observations with coordinates
  fastify.get(
    '/api/users/me/observations',
    { preHandler: [authMiddleware] },
    async (request, _reply) => {
      const observations = await userService.getUserObservations(request.user.id);
      return { observations };
    }
  );

  // GET /api/users/me/weekly-activity — scans per day for last 7 days
  fastify.get(
    '/api/users/me/weekly-activity',
    { preHandler: [authMiddleware] },
    async (request, _reply) => {
      const activity = await userService.getWeeklyActivity(request.user.id);
      return { activity };
    }
  );

  // PATCH /api/users/me
  fastify.patch(
    '/api/users/me',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const parsed = updateUserSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Validation Error',
          message: parsed.error.issues.map((i) => i.message).join(', '),
        });
      }

      const user = await userService.updateUser(request.user.id, parsed.data);
      return { user };
    }
  );
}
