import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth';

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/api/auth/verify-token',
    { preHandler: [authMiddleware] },
    async (request, _reply) => {
      return { user: request.user };
    }
  );
}
