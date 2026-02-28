# 🌳 Urban Pulse Mapping

Crowdsourced urban tree inventory. Citizens photograph trees, the app geotags and uploads photos, and the data feeds into a municipal-grade tree database. Cities buy this data to track canopy coverage, verify tree plantings, and meet climate goals. 

![React Native](https://img.shields.io/badge/React_Native-Expo_SDK_52-blue?logo=expo)
![Fastify](https://img.shields.io/badge/API-Fastify_v4-black?logo=fastify)
![PostGIS](https://img.shields.io/badge/DB-PostgreSQL_16_+_PostGIS-336791?logo=postgresql)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-3178C6?logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green)

---

## How It Works

1. **User opens the app** → sees a map centered on their location with color-coded tree pins
2. **Taps "Scan Tree"** → guided 3-photo capture flow (two angles + bark close-up)
3. **Photos upload direct to R2** via presigned URLs, observation record created
4. **Backend deduplicates** — if a tree exists within 5m, the observation links to it
5. **Cooldown system** — after 3 unique observers, a tree enters 90-day cooldown
6. **Contract zones** — map can be filtered by zip code or street corridor for municipal contracts

---

## Architecture

```
urban-pulse/
├── apps/
│   ├── api/          # Fastify v4 + TypeScript backend
│   └── mobile/       # Expo SDK 52+ React Native app
├── packages/
│   ├── shared-types/    # TypeScript interfaces
│   └── shared-schemas/  # Zod validation schemas
├── scripts/          # Setup, seed, and test scripts
└── docker-compose.yml
```

**Monorepo** managed with [Turborepo](https://turbo.build/) + [pnpm](https://pnpm.io/).

### Backend Stack
| Layer | Tech |
|-------|------|
| Framework | Fastify v4 |
| Language | TypeScript 5+ |
| Database | PostgreSQL 16 + PostGIS |
| ORM | Drizzle ORM + drizzle-kit |
| Object Storage | Cloudflare R2 (S3-compatible) / MinIO locally |
| Auth | Firebase Admin SDK |
| Job Queue | BullMQ + Redis |
| Validation | Zod (shared schemas) |
| Caching | Redis (5-min TTL on zone GeoJSON) |

### Mobile Stack
| Layer | Tech |
|-------|------|
| Framework | React Native + Expo SDK 52+ |
| Routing | Expo Router (file-based) |
| Styling | NativeWind v4 (Tailwind CSS) |
| Data Fetching | TanStack Query v5 |
| State | Zustand |
| Maps | react-native-maps (Apple Maps on iOS) |
| Camera | Expo Camera |
| Location | Expo Location |
| Offline | Expo FileSystem queue |

---

## Prerequisites

- **Node.js 20+** (recommend [nvm](https://github.com/nvm-sh/nvm))
- **pnpm 9+** — `npm install -g pnpm`
- **Docker** (via [OrbStack](https://orbstack.dev/) recommended, or Docker Desktop)
- **Xcode 16+** with iOS 18 Simulator (for mobile dev)
- macOS (mobile builds are iOS-only for now)

---

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/cristpierce/UrbanPulseMapping.git
cd UrbanPulseMapping
pnpm install
```

### 2. Start Infrastructure

```bash
docker compose up -d
```

This starts:
- **PostgreSQL 16 + PostGIS** on port 5432
- **MinIO** (S3-compatible storage) on ports 9000/9001
- **Redis** on port 6379

### 3. Configure Environment

```bash
cp .env.example .env
cp .env.example apps/api/.env
```

The defaults work for local development. For Firebase auth, see [Auth Setup](#authentication) below.

### 4. Run Migrations & Seed

```bash
# Run database migrations
pnpm --filter @urban-pulse/api run db:migrate

# Seed sample trees around Austin, TX
pnpm --filter @urban-pulse/api run db:seed

# Seed contract zones (zip codes + street corridors)
cd apps/api && npx tsx ../../scripts/seed-zones.ts
```

### 5. Start Development

```bash
# Start everything (API + mobile)
pnpm turbo run dev

# Or individually:
pnpm --filter @urban-pulse/api run dev       # API on :3000
pnpm --filter @urban-pulse/mobile run dev    # Expo dev server
```

### 6. iOS Simulator

The first time, you need to build the native dev client:

```bash
cd apps/mobile
npx expo prebuild --platform ios --clean
npx expo run:ios
```

After the first build, `pnpm turbo run dev` will connect to the existing dev build automatically.

**Set simulator location** to Austin: Simulator → Features → Location → Custom Location → `30.2672, -97.7431`

---

## API Reference

Base URL: `http://localhost:3000`

All endpoints except `/health` require `Authorization: Bearer <token>` (in dev mode with no Firebase config, any token works with a mock user).

### Core Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check (no auth) |
| `GET` | `/api/trees?lat=&lng=&radius=` | Trees near a point (PostGIS spatial query) |
| `GET` | `/api/trees/:id` | Single tree with observation history |
| `POST` | `/api/observations` | Submit a new tree observation |
| `POST` | `/api/uploads/presigned-url` | Get presigned URL for direct R2 upload |
| `GET` | `/api/users/me` | Current user profile |
| `GET` | `/api/users/me/stats` | User stats (scans, verified, streaks) |

### Zone Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/zones` | All zones as GeoJSON FeatureCollection |
| `GET` | `/api/zones?status=active` | Filter by zone status |
| `GET` | `/api/zones?bounds=sw_lat,sw_lng,ne_lat,ne_lng` | Viewport filter |
| `GET` | `/api/zones/summary` | Lightweight zone list (no geometry) |
| `GET` | `/api/zones/:id` | Single zone detail |
| `GET` | `/api/zones/:id/trees?page=1&limit=20` | Paginated trees in a zone |

### Bounty Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/bounties` | List active bounties (public) |
| `GET` | `/api/bounties/:id` | Bounty detail |
| `GET` | `/api/bounties/:id/leaderboard` | Top earners for a bounty |
| `GET` | `/api/bounties/mine` | Bounties created by current user (developer only) |
| `POST` | `/api/bounties` | Create a bounty (developer only) |
| `PATCH` | `/api/bounties/:id` | Update bounty — title, description, status transitions (developer only) |

### User Management Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `PATCH` | `/api/users/me` | Update user profile (role switching: `user` ↔ `developer`) |

### Export Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/export/trees?format=csv` | ArcGIS-compatible CSV with all L1 inspection fields |
| `GET` | `/api/export/trees?format=geojson` | GeoJSON FeatureCollection export |

### Internal Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/internal/observations/:id/ai-result` | AI processing results (X-Internal-API-Key auth) |

### Example Requests

```bash
# Health check
curl http://localhost:3000/health

# Get trees near downtown Austin
curl "http://localhost:3000/api/trees?lat=30.2672&lng=-97.7431&radius=1000" \
  -H "Authorization: Bearer dev-token"

# Get all active contract zones as GeoJSON
curl "http://localhost:3000/api/zones?status=active" \
  -H "Authorization: Bearer dev-token"

# Get zone summary (lightweight, no geometry)
curl http://localhost:3000/api/zones/summary \
  -H "Authorization: Bearer dev-token"
```

---

## Database Schema

### Core Tables

- **`users`** — Firebase-linked user accounts
- **`trees`** — Deduplicated tree records with PostGIS `geography(Point, 4326)` column
- **`observations`** — Individual tree observations (photos + GPS + status)
- **`photos`** — Photo metadata (storage keys reference R2 objects)

### Contract Zone Tables

- **`contracts`** — Municipal contracts (name, dates, budget, status)
- **`contract_zones`** — Geographic zones tied to contracts:
  - **Zip code zones** — `geometry` column stores `MultiPolygon` boundaries
  - **Street corridors** — `centerline` (LineString) + `buffer_meters` → polygon generated via `ST_Buffer`

### Key Spatial Operations

```sql
-- Tree deduplication: find trees within 5m
SELECT * FROM trees
WHERE ST_DWithin(location, ST_MakePoint(lng, lat)::geography, 5);

-- Trees within a zone
SELECT * FROM trees
WHERE ST_Within(location::geometry, zone_geometry);

-- Zones intersecting a viewport
SELECT * FROM contract_zones
WHERE ST_Intersects(geometry, ST_MakeEnvelope(sw_lng, sw_lat, ne_lng, ne_lat, 4326));
```

### Migrations

```bash
# Generate a new migration after schema changes
pnpm --filter @urban-pulse/api run db:generate

# Apply migrations
pnpm --filter @urban-pulse/api run db:migrate

# Open Drizzle Studio (visual DB browser)
pnpm --filter @urban-pulse/api run db:studio
```

---

## Contract Zones System

The map supports municipal contract scoping — cities define geographic zones where tree data is needed.

### Zone Types

**Zip Code Zones** — polygon boundaries for USPS zip codes. Stored as `MultiPolygon` in EPSG:4326.

**Street Corridor Zones** — defined by a centerline + buffer distance. The centerline is a `LineString` (e.g., Lamar Blvd from US-183 to Barton Springs), buffered by `buffer_meters` (default 50m) on each side.

### Zone Statuses

| Status | Map Color | Description |
|--------|-----------|-------------|
| `active` | Green (15% fill) | Currently accepting observations |
| `completed` | Blue (10% fill) | Target met, data collection done |
| `upcoming` | Yellow (10% fill) | Scheduled but not yet active |
| `paused` | Gray (10% fill) | Temporarily suspended |

### How Zone Assignment Works

1. User submits a tree observation with GPS coordinates
2. Backend runs `ST_Within(point, zone_geometry)` against active zones
3. If match found → `contract_zone_id` set on the tree, `trees_mapped_count` incremented
4. User sees "This tree counts toward [Contract Name]!" celebration
5. Trees outside zones are still accepted (all data is valuable)

### Seed Data

The project includes seed data for Austin, TX:
- **5 zip code zones**: 78701 (downtown), 78702 (east), 78704 (south/Zilker), 78741, 78745
- **3 street corridors**: South Congress, Lamar Blvd, E Cesar Chavez
- ~900 randomly generated tree points across all zones

---

## Mobile App Screens

### Map Screen (Home)
- Full-screen Apple Maps with tree pins (green=verified, yellow=pending, gray=cooldown)
- **Zone toggle**: All Trees / By Zip Code / By Street / Active Contracts
- **Zone overlays**: semi-transparent polygon fills with progress labels
- **Zone chips**: horizontal scrollable selector to filter specific zones
- **Active zone banner**: appears when user GPS is inside an active zone
- **Bottom sheet**: tap a zone to see details, progress bar, and "Start Mapping Here"

### Scan Flow (Modal Stack)
1. **Proximity check** — queries nearby trees, handles cooldown/dedup
2. **Angle 1** — full tree photo with overlay guide
3. **Angle 2** — rotated ~90° from first angle
4. **Bark close-up** — chest-height bark detail
5. **Review** — confirm photos + GPS + optional notes
6. **Success** — stats update + zone celebration if applicable

### Dashboard
- Stats grid: trees scanned, verified, pending, on cooldown
- Recent activity list
- **My Zones** section: zones contributed to with progress bars

### Dev Mode
- **Mock auth**: no Firebase project needed — any Bearer token creates a dev user
- **Sample photos**: when `__DEV__` is true, camera screens offer "Use Sample Photo"
- **Simulated location**: set via Simulator → Features → Location

---

## Authentication

### Development (default)

No setup needed. When `FIREBASE_PROJECT_ID` is not set, the API accepts any Bearer token and uses a mock user. The mobile app sends a hardcoded dev token.

### Production

1. Create a [Firebase project](https://console.firebase.google.com/)
2. Enable Email/Password, Apple Sign-In, and Google Sign-In
3. Download the service account key
4. Set environment variables:

```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
```

5. Update `apps/mobile/.env` with your Firebase web config:

```bash
EXPO_PUBLIC_FIREBASE_API_KEY=your-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
```

---

## Photo Upload Flow

Photos **never** go through the API server — they upload directly to R2/MinIO:

```
Mobile App                    API                     R2/MinIO
    │                          │                         │
    ├─ POST /uploads/presigned-url ──►                   │
    │◄── { uploadUrl, storageKey } ──┤                   │
    │                          │                         │
    ├──── PUT photo bytes ──────────────────────────────►│
    │                          │                         │
    ├─ POST /observations ────►│                         │
    │  (with storageKeys)      ├── validate + dedup ──►  │
    │◄── { observation, tree } ┤                         │
```

---

## Observation Lifecycle

```
pending_upload → pending_ai → pending_review → verified
                     │                              │
                     │ (external AI system)          │ (community/expert)
                     └──────────────────────────────►│
                                                     └──► rejected
```

The `pending_ai → pending_review` transition is handled by an **external AI system** (not built in this repo). The API exposes `POST /api/internal/observations/:id/ai-result` for the AI to push results.

---

## Project Structure

```
apps/api/src/
├── index.ts              # Server entry point
├── app.ts                # Fastify app factory
├── routes/
│   ├── auth.ts           # POST /auth/verify-token
│   ├── health.ts         # GET /health
│   ├── observations.ts   # Observation CRUD
│   ├── trees.ts          # Tree queries (spatial)
│   ├── uploads.ts        # Presigned URL generation
│   ├── users.ts          # User profile + stats
│   └── zones.ts          # Contract zone GeoJSON endpoints
├── services/
│   ├── cooldown.service.ts   # 90-day cooldown logic
│   ├── dedup.service.ts      # 5m tree deduplication
│   ├── observation.service.ts
│   ├── tree.service.ts
│   ├── upload.service.ts
│   ├── user.service.ts
│   └── zone.service.ts      # Spatial zone queries + caching
├── middleware/
│   └── auth.ts           # Firebase token verification
├── db/
│   ├── schema.ts         # Drizzle table definitions
│   ├── index.ts          # DB client
│   └── migrate.ts        # Migration runner
├── jobs/
│   ├── queue.ts          # BullMQ queue setup
│   ├── worker.ts         # Job processor
│   └── types.ts          # Job type definitions
└── utils/
    ├── geo.ts            # PostGIS helpers
    ├── s3.ts             # R2/S3 client
    └── errors.ts         # Custom error classes

apps/mobile/
├── app/                  # Expo Router file-based routes
│   ├── _layout.tsx       # Root layout + auth guard
│   ├── index.tsx         # Map screen (home)
│   ├── scan/             # Guided photo capture flow
│   ├── dashboard/        # User stats + My Zones
│   └── (auth)/           # Login + register
├── components/
│   ├── TreeMap.tsx        # Main map with markers
│   ├── TreePin.tsx        # Custom map marker
│   ├── ZoneOverlay.tsx    # Polygon rendering by status
│   ├── ZoneToggle.tsx     # View mode selector
│   ├── ZoneBottomSheet.tsx # Zone detail sheet
│   ├── ZoneChipSelector.tsx # Zone filter chips
│   ├── ActiveZoneBanner.tsx # GPS-aware zone banner
│   ├── ScanButton.tsx     # Floating action button
│   ├── PhotoCapture.tsx   # Camera with overlay guides
│   └── ...
├── hooks/
│   ├── useContractZones.ts # Zone data fetching
│   ├── useTrees.ts        # Tree data fetching
│   ├── useLocation.ts     # GPS hook
│   └── useAuth.ts         # Auth state
├── lib/
│   ├── api.ts             # API client
│   ├── auth.ts            # Firebase setup
│   ├── store.ts           # Zustand store
│   └── offline-queue.ts   # Offline submission queue
└── constants/
    ├── colors.ts          # Brand color palette
    └── config.ts          # API URL, map defaults
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm turbo run dev` | Start API + mobile dev servers |
| `pnpm turbo run build` | Build all packages |
| `pnpm turbo run lint` | Lint all packages |
| `pnpm --filter @urban-pulse/api run db:migrate` | Run DB migrations |
| `pnpm --filter @urban-pulse/api run db:seed` | Seed sample trees |
| `pnpm --filter @urban-pulse/api run db:studio` | Open Drizzle Studio |
| `bash scripts/test-api.sh` | Smoke test API endpoints |
| `bash scripts/setup-dev.sh` | Full one-time dev setup |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `pnpm install` fails | Use Node 20+ (`nvm use 20`) |
| Postgres won't start | Check port 5432: `lsof -i :5432` |
| Migrations fail | Ensure PostGIS image: `postgis/postgis:16-3.4-alpine` |
| Expo build fails | `cd apps/mobile/ios && pod install --repo-update` |
| Simulator slow | Close Chrome/Docker Desktop, use OrbStack |
| Map shows wrong location | Simulator → Features → Location → Custom |
| API calls fail from simulator | Verify `EXPO_PUBLIC_API_URL=http://localhost:3000/api` |
| Firebase auth fails | In dev mode, omit `FIREBASE_PROJECT_ID` for mock auth |
| No tree markers on map | Run seed scripts, check API returns data |

---

## Level 1 Tree Inspection

The scan flow includes a comprehensive Level 1 inspection form (see `docs/LEVEL1_INSPECTION_SPEC.md`):

**Scan Flow:** Photos (3 angles) → Review → **Inspection Form** → Success

**User-Input Fields:**
- Condition rating (good/fair/poor/dead)
- Crown dieback, trunk defects (cavity/crack/lean), risk flag
- Maintenance needed (prune/remove/none)
- Location type (street tree/park/median/ROW), site type
- Overhead utility conflict, sidewalk damage from roots
- Mulch/soil condition, notes

**AI-Estimated Fields** (populated asynchronously via internal endpoint):
- Species identification, DBH estimate
- Height estimate, canopy spread
- Additional defect detection

**Export:** `GET /api/export/trees?format=csv` produces ArcGIS-compatible output with all L1 fields.

---

## Bounty System

Developers can create mapping bounties — monetary incentives for mapping specific zones.

**How it works:**
1. Switch to Developer Mode in Profile
2. Create a bounty: set zone, $/tree, total budget, target count
3. Bounty appears as gold overlay on the map for all users
4. When a mapper submits a tree in a bounty zone → auto-claim created
5. Mapper sees "You earned $X.XX!" celebration

**Status transitions:** `draft → active → paused → active → completed`

**Financial fields** (amount, budget, target) are locked once a bounty leaves draft status.

---

## What's NOT Built (Yet)

These are scoped for future work:

- ❌ AI species identification / health assessment / measurement estimation
- ❌ Web dashboard (Next.js)
- ❌ Push notifications
- ❌ Social features (leaderboards, teams)
- ❌ Admin panel
- ❌ Payment integration
- ❌ Android support
- ❌ LiDAR scanning

**Interface contracts are in place** — the AI system can plug in via `POST /api/internal/observations/:id/ai-result` and the observation status pipeline.

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Follow existing patterns (Drizzle for DB, Zod for validation, NativeWind for styling)
4. Ensure `pnpm turbo run build` passes with zero TypeScript errors
5. Submit a PR

**Key rules:**
- **pnpm only** — never npm or yarn
- **Never modify existing migration files** — generate new ones
- **Never commit `.env` files** — use `.env.example`
- **Photos upload direct to R2** — never through the API server
- **NativeWind `className`** — no `StyleSheet.create`
- **Don't implement AI logic** — stub interfaces only

---

## License

MIT
