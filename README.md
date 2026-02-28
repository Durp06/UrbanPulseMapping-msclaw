# 🌳 Urban Pulse Mapping

Crowdsourced urban tree inventory platform. Citizens photograph trees, the app geotags and uploads photos, an AI pipeline identifies species and assesses health, and the data feeds into a municipal-grade tree database. Cities buy this data to track canopy coverage, verify tree plantings, and meet climate goals.
Crowdsourced urban tree inventory. Citizens photograph trees, the app geotags and uploads photos, and the data feeds into a municipal-grade tree database. Cities buy this data to track canopy coverage, verify tree plantings, and meet climate goals. 

![React Native](https://img.shields.io/badge/React_Native-Expo_SDK_52-blue?logo=expo)
![Fastify](https://img.shields.io/badge/API-Fastify_v4-black?logo=fastify)
![Python](https://img.shields.io/badge/AI_Pipeline-Python_3.11+-3776AB?logo=python)
![PostGIS](https://img.shields.io/badge/DB-PostgreSQL_16_+_PostGIS-336791?logo=postgresql)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-3178C6?logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green)

---

## How It Works

```
📱 Mobile App          🖥️ API Server          🤖 AI Pipeline
─────────────          ──────────────          ──────────────
User opens app    →    Map tiles + tree data
                       served via PostGIS
                       spatial queries

Scans a tree      →    3 photos upload to
(2 angles + bark)      MinIO/R2 via presigned
                       URLs

Submits form      →    Observation saved,       Job queued via
(GPS + inspection)     tree dedup (5m radius),  BullMQ/Redis
                       status: pending_ai    →  ─────────────→
                                                Downloads photos,
                                                Pl@ntNet + Claude
                                                species ID, health,
                                                measurements, site
                                             ←  POSTs results back

                       Tree record updated,
                       status: pending_review
```

**Key features:**
- 🗺️ Interactive map with color-coded tree pins and contract zone overlays
- 📷 Guided 3-photo capture with overlay guides
- 🤖 Dual AI species ID: Pl@ntNet botanical API + Claude vision (consensus scoring)
- 🏥 Automated health assessment, physical measurements, and site analysis
- 📊 Level 1 municipal tree inspection fields (ArcGIS-compatible CSV export)
- 💰 Bounty system for incentivized mapping campaigns
- 🔒 5m deduplication + 90-day cooldown to prevent over-surveying

---

## Architecture

```
urban-pulse/
├── apps/
│   ├── api/             # Fastify v4 + TypeScript backend
│   ├── mobile/          # Expo SDK 52+ React Native app
│   └── ai-pipeline/     # Python AI analysis microservice
├── packages/
│   ├── shared-types/    # TypeScript interfaces
│   └── shared-schemas/  # Zod validation schemas
├── scripts/             # Setup, seed, and test scripts
└── docker-compose.yml
```

**Monorepo** managed with [Turborepo](https://turbo.build/) + [pnpm](https://pnpm.io/).

### Tech Stack

| Component | Technology |
|-----------|-----------|
| **Mobile** | React Native + Expo SDK 52, Expo Router, NativeWind v4, TanStack Query v5, Zustand, react-native-maps |
| **API** | Fastify v4, TypeScript, Drizzle ORM, PostgreSQL 16 + PostGIS, BullMQ + Redis, Zod |
| **AI Pipeline** | Python 3.11+, Pl@ntNet API, Anthropic Claude (vision), asyncio + BullMQ, MinIO/S3 |
| **Storage** | Cloudflare R2 / MinIO (S3-compatible), presigned URL uploads |
| **Auth** | Firebase Admin SDK (dev: mock auth, any token works) |
| **Monorepo** | Turborepo + pnpm |

---

## Quick Start

### Prerequisites

- **Node.js 20+** and **pnpm 9+** (`npm install -g pnpm`)
- **Python 3.11+** (for AI pipeline)
- **Docker** via [Colima](https://github.com/abiosoft/colima) or [OrbStack](https://orbstack.dev/)
- **Xcode 16+** with iOS Simulator (for mobile dev)
- macOS required (iOS builds)

### 1. Clone & Install

```bash
git clone https://github.com/Durp06/UrbanPulseMapping-msclaw.git
cd UrbanPulseMapping-msclaw
pnpm install
```

### 2. Start Infrastructure

```bash
docker compose up -d   # PostgreSQL + PostGIS, MinIO, Redis
```

Or with Colima:
```bash
colima start
export DOCKER_HOST=unix://$HOME/.colima/docker.sock
docker compose up -d
```

### 3. Configure Environment

```bash
# API
cp apps/api/.env.example apps/api/.env

# AI Pipeline
cp apps/ai-pipeline/.env.example apps/ai-pipeline/.env
# Fill in: ANTHROPIC_API_KEY, PLANTNET_API_KEY
```

### 4. Database Setup

```bash
pnpm --filter @urban-pulse/api run db:migrate
pnpm --filter @urban-pulse/api run db:seed
```

### 5. Run Everything

```bash
# API server (port 3000)
pnpm --filter @urban-pulse/api run dev

# AI pipeline (consumes from Redis queue)
cd apps/ai-pipeline && source .venv/bin/activate && python -m src.main

# Mobile (Expo dev server)
cd apps/mobile && npx expo run:ios
```

Set simulator location to Austin: **Simulator → Features → Location → Custom → `30.2672, -97.7431`**

---

## AI Pipeline

The AI pipeline is a standalone Python microservice that processes tree observations asynchronously.

### Pipeline Flow

1. **Job arrives** via BullMQ Redis queue (`ai-process-observation`)
2. **Photos downloaded** from MinIO/S3 (matched by storage key)
3. **Quality filter** — blur detection, brightness, dimensions (rejects poor photos)
4. **Four parallel analyzers run:**
   - **Species** — Pl@ntNet botanical API + Claude vision consensus
   - **Health** — structural condition, leaf condition, confidence score
   - **Measurements** — DBH (cm), height (m), crown width (m)
   - **Site** — condition rating, location type, risk assessment
5. **Results POST** back to API via internal endpoint
6. **Observation status** transitions `pending_ai → pending_review`

### Species Identification Accuracy

Tested against 12 common Austin, TX street tree species (47 real photos from iNaturalist):

| Metric | Result |
|--------|--------|
| **Genus accuracy** | **100%** (12/12 species) |
| **Best species-level** | Live Oak 93%, Bald Cypress 91%, Crepe Myrtle 84% |
| **Tested species** | Live Oak, Cedar Elm, Pecan, Bald Cypress, Crepe Myrtle, Texas Red Oak, Monterrey Oak, Ashe Juniper, Texas Ash |

### Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key for vision analysis |
| `PLANTNET_API_KEY` | Yes | Pl@ntNet species ID (free at [my.plantnet.org](https://my.plantnet.org)) |
| `GOOGLE_API_KEY` | No | Gemini as alternative LLM provider |
| `LLM_PROVIDER` | No | `anthropic` (default), `google`, or `openai` |
| `LLM_MODEL` | No | Model name (default: `claude-sonnet-4-5-20250929`) |
| `REDIS_URL` | Yes | Redis connection for BullMQ |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `S3_ENDPOINT` | Yes | MinIO/R2 endpoint |
| `API_BASE_URL` | Yes | API server URL for result callback |
| `INTERNAL_API_KEY` | Yes | Shared secret for API auth |

### Running Tests

```bash
cd apps/ai-pipeline
source .venv/bin/activate

# Quality filter tests only (no API keys needed)
pytest tests/test_e2e_real_photos.py::TestQualityFilter -v

# Pl@ntNet tests (needs PLANTNET_API_KEY)
pytest tests/test_e2e_real_photos.py::TestPlantNet -v

# Full suite (needs all API keys)
pytest tests/test_e2e_real_photos.py -v -s
```

---

## API Reference

Base URL: `http://localhost:3000`

All endpoints except `/health` require `Authorization: Bearer <token>`.

### Core Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/trees?lat=&lng=&radius=` | Spatial tree query |
| `GET` | `/api/trees/:id` | Tree detail with observations |
| `POST` | `/api/observations` | Submit observation |
| `POST` | `/api/uploads/presigned-url` | Get presigned upload URL |
| `GET` | `/api/users/me` | User profile |
| `GET` | `/api/users/me/stats` | User stats |

### Zone & Bounty Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/zones` | All zones (GeoJSON) |
| `GET` | `/api/zones/summary` | Zone list (no geometry) |
| `GET` | `/api/zones/:id/trees` | Trees in zone (paginated) |
| `GET` | `/api/bounties` | Active bounties |
| `POST` | `/api/bounties` | Create bounty (developer role) |
| `GET` | `/api/bounties/:id/leaderboard` | Bounty leaderboard |

### Export & Internal

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/export/trees?format=csv` | ArcGIS-compatible CSV export |
| `GET` | `/api/export/trees?format=geojson` | GeoJSON export |
| `POST` | `/api/internal/observations/:id/ai-result` | AI result callback (X-Internal-API-Key) |

---

## Observation Lifecycle

```
submitted → pending_ai → pending_review → verified
                │                             │
                │  AI Pipeline processes       │  Community/expert
                │  species, health, site,      │  review
                │  measurements                │
                └─────────────────────────────►└──► rejected
```

---

## Database

### Core Tables

| Table | Purpose |
|-------|---------|
| `users` | Firebase-linked accounts |
| `trees` | Deduplicated tree records with PostGIS geography |
| `observations` | Individual submissions (photos + GPS + inspection) |
| `photos` | Photo metadata (storage keys → R2/MinIO objects) |
| `contracts` | Municipal contracts |
| `contract_zones` | Geographic zones (zip polygons + street corridor buffers) |
| `bounties` | Mapping incentive campaigns |
| `bounty_claims` | Per-tree bounty claim records |

### Key Spatial Operations

```sql
-- Tree deduplication (5m radius)
SELECT * FROM trees WHERE ST_DWithin(location, ST_MakePoint(lng, lat)::geography, 5);

-- Trees within a contract zone
SELECT * FROM trees WHERE ST_Within(location::geometry, zone_geometry);

-- Zones intersecting map viewport
SELECT * FROM contract_zones
WHERE ST_Intersects(geometry, ST_MakeEnvelope(sw_lng, sw_lat, ne_lng, ne_lat, 4326));
```

### Migrations

```bash
pnpm --filter @urban-pulse/api run db:generate   # Generate migration from schema changes
pnpm --filter @urban-pulse/api run db:migrate    # Apply migrations
pnpm --filter @urban-pulse/api run db:studio     # Visual DB browser
```

---

## Project Structure

<details>
<summary><strong>apps/api/src/</strong> — Fastify API (29 files)</summary>

```
├── index.ts              # Server entry
├── app.ts                # Fastify factory
├── routes/               # HTTP endpoints
│   ├── observations.ts   # Observation CRUD + internal AI result
│   ├── trees.ts          # Spatial tree queries
│   ├── zones.ts          # Contract zone GeoJSON
│   ├── bounties.ts       # Bounty CRUD + leaderboard
│   ├── uploads.ts        # Presigned URL generation
│   └── users.ts          # Profile + stats
├── services/             # Business logic
│   ├── dedup.service.ts  # 5m tree deduplication
│   ├── cooldown.service.ts
│   └── zone.service.ts   # Spatial queries + Redis cache
├── db/
│   └── schema.ts         # Drizzle table definitions
├── jobs/
│   ├── queue.ts          # BullMQ setup
│   └── worker.ts         # Job processor
└── middleware/
    └── auth.ts           # Firebase token verification
```
</details>

<details>
<summary><strong>apps/mobile/</strong> — Expo React Native (53 files)</summary>

```
├── app/                  # Expo Router file-based routes
│   ├── index.tsx         # Map screen (home)
│   ├── scan/             # Guided photo capture flow
│   ├── dashboard/        # User stats + zones
│   └── (auth)/           # Login + register
├── components/
│   ├── TreeMap.tsx        # Map with markers + zone overlays
│   ├── PhotoCapture.tsx   # Camera with overlay guides
│   ├── ZoneOverlay.tsx    # Contract zone polygons
│   └── ZoneBottomSheet.tsx
├── hooks/
│   ├── useContractZones.ts
│   ├── useTrees.ts
│   └── useAuth.ts
└── lib/
    ├── api.ts             # API client
    └── offline-queue.ts   # Offline submission queue
```
</details>

<details>
<summary><strong>apps/ai-pipeline/src/</strong> — Python AI Service (17 files)</summary>

```
├── main.py          # Entry point
├── config.py        # Pydantic settings
├── consumer.py      # BullMQ Redis consumer
├── pipeline.py      # Orchestration
├── clients/
│   ├── plantnet.py  # Pl@ntNet species ID
│   ├── llm.py       # Claude/GPT-4o/Gemini multimodal
│   └── storage.py   # MinIO/S3 photo download + DB queries
├── analyzers/
│   ├── species.py   # Dual-source consensus (Pl@ntNet + LLM)
│   ├── health.py    # Structural + leaf condition
│   ├── measurements.py  # DBH, height, crown width
│   └── site.py      # Location type, risk, condition
├── prompts/         # LLM prompt templates
└── utils/
    └── quality.py   # Blur detection, brightness, size checks
```
</details>

---

## Development

### Dev Mode Features

- **Mock auth** — no Firebase needed; any Bearer token creates a dev user
- **Auto-login** — mobile app auto-signs in when `__DEV__` is true
- **Sample photos** — camera screens offer "Use Sample Photo" in dev mode
- **Simulated location** — set via Simulator → Features → Location

### Common Commands

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm turbo run dev` | Start API + mobile |
| `pnpm --filter @urban-pulse/api run dev` | API only |
| `pnpm --filter @urban-pulse/api run db:migrate` | Apply migrations |
| `pnpm --filter @urban-pulse/api run db:seed` | Seed sample data |
| `cd apps/ai-pipeline && python -m src.main` | Run AI pipeline |
| `pytest tests/test_e2e_real_photos.py -v` | AI pipeline E2E tests |

### Troubleshooting

| Problem | Solution |
|---------|----------|
| Postgres won't start | Check port 5432: `lsof -i :5432` |
| API port conflict | Kill old processes: `lsof -ti :3000 \| xargs kill` |
| Expo build fails | `cd apps/mobile/ios && pod install --repo-update` |
| AI pipeline 400 errors | Images too large — the auto-resize in `llm.py` handles this |
| MinIO photos not found | Verify storage keys in `photos` table match MinIO paths |
| Docker socket not found | `export DOCKER_HOST=unix://$HOME/.colima/docker.sock` |
| Firebase auth fails | Omit `FIREBASE_PROJECT_ID` for dev mode mock auth |

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Follow existing patterns (Drizzle for DB, Zod for validation, NativeWind for styling)
4. `pnpm turbo run build` must pass with zero TypeScript errors
5. Submit a PR

**Rules:**
- **pnpm only** — never npm or yarn
- **Never modify existing migration files**
- **Never commit `.env` files**
- **Photos upload direct to R2/MinIO** — never through the API server

---

## What's Next

- [ ] Web admin dashboard
- [ ] Push notifications for bounty zones
- [ ] Offline mode with local queue sync
- [ ] Android support
- [ ] LiDAR canopy scanning
- [ ] Payment integration for bounties

---

## License

MIT
