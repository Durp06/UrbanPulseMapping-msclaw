import Fastify from 'fastify';
import cors from '@fastify/cors';
import { healthRoutes } from './routes/health';
import { authRoutes } from './routes/auth';
import { treeRoutes } from './routes/trees';
import { observationRoutes } from './routes/observations';
import { uploadRoutes } from './routes/uploads';
import { userRoutes } from './routes/users';
import { zoneRoutes } from './routes/zones';

export function buildApp() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
    },
  });

  // CORS
  fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  // Error handler
  fastify.setErrorHandler((error, _request, reply) => {
    const statusCode = error.statusCode || 500;
    fastify.log.error(error);

    reply.status(statusCode).send({
      statusCode,
      error: error.name || 'Internal Server Error',
      message: error.message || 'An unexpected error occurred',
    });
  });

  // Routes
  fastify.register(healthRoutes);
  fastify.register(authRoutes);
  fastify.register(treeRoutes);
  fastify.register(observationRoutes);
  fastify.register(uploadRoutes);
  fastify.register(userRoutes);
  fastify.register(zoneRoutes);

  return fastify;
}
