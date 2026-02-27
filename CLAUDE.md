# CLAUDE.md — Agent Instructions

## Project

Urban Pulse Mapping — crowdsourced urban tree inventory. Turborepo monorepo with three apps.

## Architecture

| App | Stack | Entry Point |
|-----|-------|-------------|
| `apps/api` | Fastify v4 + TypeScript + Drizzle ORM + PostGIS | `src/index.ts` |
| `apps/mobile` | Expo SDK 52 + React Native + NativeWind v4 + Expo Router | `app/_layout.tsx` |
| `apps/ai-pipeline` | Python 3.11+ + asyncio + BullMQ + Anthropic + Pl@ntNet | `src/main.py` |

Shared packages: `packages/shared-types` (TS interfaces), `packages/shared-schemas` (Zod).

## Data Flow

Mobile → API (observation + presigned upload) → BullMQ Redis queue → AI Pipeline → POST results back to API → Tree record updated.

Observation statuses: `submitted → pending_ai → pending_review → verified | rejected`

## Commands

```bash
# Install
pnpm install

# API (port 3000)
pnpm --filter @urban-pulse/api run dev

# Mobile (iOS simulator)
cd apps/mobile && npx expo run:ios

# AI Pipeline
cd apps/ai-pipeline && source .venv/bin/activate && python -m src.main

# DB
pnpm --filter @urban-pulse/api run db:migrate
pnpm --filter @urban-pulse/api run db:seed
pnpm --filter @urban-pulse/api run db:generate  # after schema changes

# Tests
pytest apps/ai-pipeline/tests/test_e2e_real_photos.py -v -s
bash scripts/test-api.sh
```

## Critical Rules

- **pnpm only.** Never npm or yarn.
- **Never modify existing migration files** in `apps/api/drizzle/`. Generate new ones.
- **Never commit .env files.** Use .env.example as template.
- **Photos upload direct to R2/MinIO** via presigned URLs. Never through the API server.
- **All API responses validated** with Zod schemas from `packages/shared-schemas`.
- **PostGIS spatial queries** use Drizzle `sql` template. Tree dedup = 5m radius via `ST_DWithin`.
- **AI pipeline is Python.** Don't mix Node.js AI code into the API.
- **Image resizing** is handled in `ai-pipeline/src/clients/llm.py` before sending to Anthropic (max 1568px).

## Key Files

| File | What It Does |
|------|-------------|
| `apps/api/src/db/schema.ts` | All Drizzle table definitions (trees, observations, photos, zones, bounties) |
| `apps/api/src/routes/observations.ts` | Observation CRUD + internal AI result endpoint |
| `apps/api/src/services/dedup.service.ts` | 5m tree deduplication logic |
| `apps/ai-pipeline/src/pipeline.py` | AI orchestration (fetch photos → analyze → POST results) |
| `apps/ai-pipeline/src/analyzers/species.py` | Dual-source species consensus (Pl@ntNet + LLM) |
| `apps/ai-pipeline/src/clients/llm.py` | Multimodal LLM client (Anthropic/OpenAI/Google) |
| `apps/mobile/app/index.tsx` | Map screen (home) |
| `apps/mobile/app/scan/` | Guided 3-photo capture flow |

## Environment

| Service | Local | Port |
|---------|-------|------|
| PostgreSQL 16 + PostGIS | Docker or brew | 5432 |
| Redis | Docker or brew | 6379 |
| MinIO (S3-compatible) | Docker | 9000 (API), 9001 (console) |
| API | Node.js | 3000 |

Dev mode: no Firebase needed. Any Bearer token works with mock auth. Mobile auto-logs in when `__DEV__`.

## Testing

- **AI pipeline**: 47 real tree photos from iNaturalist covering 12 Austin street tree species. 100% genus accuracy.
- **API**: `bash scripts/test-api.sh` smoke tests all endpoints.
- **Quality filter tests** run without API keys: `pytest tests/test_e2e_real_photos.py::TestQualityFilter`

## Gotchas

- Docker via Colima needs `DOCKER_HOST=unix://$HOME/.colima/docker.sock`
- `pnpm --filter api dev` (tsx watch) can have process-killing issues — use `node --import tsx src/index.ts` directly
- ARM64 Macs: use `postgis/postgis:16-3.4` (not alpine) with `platform: linux/arm64`
- Large photos (4000x3000+) must be resized before Anthropic API — handled automatically in `llm.py`
- Fine-grained GitHub PATs can't access collaborator repos — use classic PAT (`ghp_`)
