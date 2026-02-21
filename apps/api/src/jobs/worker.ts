import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import type { ProcessObservationJob } from './types';
import { JOB_NAMES } from './types';

let worker: Worker | null = null;

export function startWorker() {
  const connection = new IORedis(
    process.env.REDIS_URL || 'redis://localhost:6379',
    { maxRetriesPerRequest: null }
  );

  worker = new Worker(
    JOB_NAMES.PROCESS_OBSERVATION,
    async (job) => {
      const { observationId } = job.data as ProcessObservationJob;
      console.log(`Processing observation ${observationId}`);

      // Currently just moves status to pending_ai
      // The external AI system will pick up from here
      await db
        .update(schema.observations)
        .set({ status: 'pending_ai', updatedAt: new Date() })
        .where(eq(schema.observations.id, observationId));

      console.log(`Observation ${observationId} moved to pending_ai`);
    },
    { connection: connection as any }
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err);
  });

  console.log('BullMQ worker started');
  return worker;
}

export async function stopWorker() {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
