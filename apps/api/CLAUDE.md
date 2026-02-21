# Urban Pulse API

Fastify 4 + TypeScript + Drizzle ORM + PostGIS.

## Key Patterns
- Routes in src/routes/, services in src/services/
- All routes use Zod schemas for validation
- Firebase Auth middleware on all routes except /health
- Dev mode: auth is optional when NODE_ENV=development and no Firebase creds
- PostGIS spatial queries via Drizzle sql`` template literals
- Photos go direct to R2. API only manages presigned URLs and metadata.

## Database
- Drizzle schema in src/db/schema.ts
- Migrations via drizzle-kit: `pnpm run db:generate` then `pnpm run db:migrate`
- PostGIS geography column on trees table with GIST index
- Trigger auto-updates location from lat/lng

## Don't
- Don't implement AI processing — stub only
- Don't accept photo uploads through API — presigned URLs only
- Don't modify existing migration files
- Don't use raw pg client — always Drizzle
