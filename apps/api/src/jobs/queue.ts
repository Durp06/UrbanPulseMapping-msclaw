import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import type { ProcessObservationJob } from './types';
import { JOB_NAMES } from './types';

let connection: IORedis | null = null;
let observationQueue: Queue | null = null;

function getConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}

function getQueue(): Queue {
  if (!observationQueue) {
    observationQueue = new Queue(
      JOB_NAMES.PROCESS_OBSERVATION,
      {
        connection: getConnection() as any,
      }
    );
  }
  return observationQueue;
}

export async function addProcessingJob(observationId: string) {
  try {
    const queue = getQueue();
    await queue.add(JOB_NAMES.PROCESS_OBSERVATION, { observationId } satisfies ProcessObservationJob);
  } catch (error) {
    // Don't fail the request if Redis is unavailable
    console.warn('Failed to add job to queue (Redis may be unavailable):', error);
  }
}

export async function closeQueue() {
  if (observationQueue) {
    await observationQueue.close();
    observationQueue = null;
  }
  if (connection) {
    connection.disconnect();
    connection = null;
  }
}
