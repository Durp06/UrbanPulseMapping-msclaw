import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth';
import { presignedUrlRequestSchema } from '@urban-pulse/shared-schemas';
import * as uploadService from '../services/upload.service';

export async function uploadRoutes(fastify: FastifyInstance) {
  // POST /api/uploads/presigned-url
  fastify.post(
    '/api/uploads/presigned-url',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const parsed = presignedUrlRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Validation Error',
          message: parsed.error.issues.map((i) => i.message).join(', '),
        });
      }

      const { filename, contentType, photoType } = parsed.data;
      const result = await uploadService.createPresignedUrl(
        request.user.id,
        filename,
        contentType,
        photoType
      );

      return result;
    }
  );
}
