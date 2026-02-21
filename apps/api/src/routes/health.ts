import type { FastifyInstance } from 'fastify';
import { db } from '../db';
import { sql } from 'drizzle-orm';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (_request, _reply) => {
    let dbStatus: 'connected' | 'error' = 'error';

    try {
      await db.execute(sql`SELECT 1`);
      dbStatus = 'connected';
    } catch {
      dbStatus = 'error';
    }

    return {
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
      db: dbStatus,
    };
  });
}
