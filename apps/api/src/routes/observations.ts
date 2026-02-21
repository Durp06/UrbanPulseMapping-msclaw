import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { createObservationSchema, aiResultSchema } from '@urban-pulse/shared-schemas';
import * as observationService from '../services/observation.service';

export async function observationRoutes(fastify: FastifyInstance) {
  // POST /api/observations
  fastify.post(
    '/api/observations',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const parsed = createObservationSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Validation Error',
          message: parsed.error.issues.map((i) => i.message).join(', '),
        });
      }

      try {
        const result = await observationService.createObservation({
          userId: request.user.id,
          ...parsed.data,
        });

        return reply.status(201).send(result);
      } catch (error: any) {
        if (error.name === 'ConflictError') {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: error.message,
            data: error.data,
          });
        }
        throw error;
      }
    }
  );

  // GET /api/observations/:id
  fastify.get(
    '/api/observations/:id',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const observation = await observationService.getObservationById(id);
        return { observation };
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

  // POST /api/internal/observations/:id/ai-result
  // Called by external AI system — uses internal API key auth
  fastify.post(
    '/api/internal/observations/:id/ai-result',
    async (request, reply) => {
      // Verify internal API key
      const apiKey = request.headers['x-internal-api-key'];
      if (apiKey !== process.env.INTERNAL_API_KEY) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid internal API key',
        });
      }

      const { id } = request.params as { id: string };
      const parsed = aiResultSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Validation Error',
          message: parsed.error.issues.map((i) => i.message).join(', '),
        });
      }

      try {
        const result = await observationService.updateObservationAIResult(
          id,
          parsed.data
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
