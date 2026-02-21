import 'dotenv/config';
import { buildApp } from './app';
import { startWorker } from './jobs/worker';

async function main() {
  const app = buildApp();
  const port = parseInt(process.env.API_PORT || '3000', 10);

  try {
    // Start BullMQ worker (non-blocking, won't crash if Redis is down)
    try {
      startWorker();
    } catch (error) {
      console.warn('Failed to start BullMQ worker (Redis may be unavailable):', error);
    }

    await app.listen({ port, host: '0.0.0.0' });
    console.log(`Urban Pulse API running on http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
