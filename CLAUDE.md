# Urban Pulse Mapping

Crowdsourced urban tree inventory: mobile app (Expo/React Native) + API (Fastify/TypeScript).

## Architecture
Turborepo monorepo. apps/mobile (Expo), apps/api (Fastify).
Shared types in packages/shared-types, Zod schemas in packages/shared-schemas.

## Commands
- Install: `pnpm install`
- Dev (all): `pnpm turbo run dev`
- Build (all): `pnpm turbo run build`
- Lint: `pnpm turbo run lint`
- DB migrate: `pnpm --filter @urban-pulse/api run db:migrate`
- DB seed: `pnpm --filter @urban-pulse/api run db:seed`
- Test API: `bash scripts/test-api.sh`

## Critical Rules
- NEVER implement AI/ML processing. The AI pipeline is built separately.
- All tree observation data starts as 'pending_ai' status.
- Use Drizzle ORM for all database queries. PostGIS via sql`` template.
- All API responses validated with Zod schemas from packages/shared-schemas.
- pnpm only. Never npm or yarn.
- Photos upload direct to R2 via presigned URLs. Never through our API server.

## Warnings
- drizzle/migrations/ — NEVER modify existing migration files
- .env files — NEVER commit. Use .env.example as template.
