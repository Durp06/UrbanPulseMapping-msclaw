import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { db, schema } from '../db';
import { eq } from 'drizzle-orm';
import type { ProcessObservationJob } from './types';
import { JOB_NAMES } from './types';

let worker: Worker | null = null;
let aiQueue: Queue | null = null;

// Queue name for AI pipeline (must match Python consumer)
const AI_QUEUE_NAME = 'ai-process-observation';

export function startWorker() {
  const connection = new IORedis(
    process.env.REDIS_URL || 'redis://localhost:6379',
    { maxRetriesPerRequest: null }
  );

  // Create queue for AI pipeline
  aiQueue = new Queue(AI_QUEUE_NAME, { connection: connection.duplicate() });

  worker = new Worker(
    JOB_NAMES.PROCESS_OBSERVATION,
    async (job) => {
      const { observationId } = job.data as ProcessObservationJob;
      console.log(`Processing observation ${observationId}`);

      // Move status to pending_ai
      await db
        .update(schema.observations)
        .set({ status: 'pending_ai', updatedAt: new Date() })
        .where(eq(schema.observations.id, observationId));

      // Push to AI pipeline queue for Python consumer
      await aiQueue!.add('process', { observationId });
      console.log(`Observation ${observationId} moved to pending_ai and queued for AI processing`);
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
  if (aiQueue) {
    await aiQueue.close();
    aiQueue = null;
  }
  if (worker) {
    await worker.close();
    worker = null;
  }
}
