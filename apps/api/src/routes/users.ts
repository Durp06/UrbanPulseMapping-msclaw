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
