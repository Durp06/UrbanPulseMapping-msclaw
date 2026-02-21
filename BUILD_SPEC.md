# Urban Pulse Mapping — Full Build Prompt for OpenClaw / Claude Code

> **Purpose**: This prompt instructs an AI coding agent to scaffold, build, and test the Urban Pulse Mapping mobile app (React Native / Expo) and its backend API (TypeScript / Fastify). The agent should be able to execute this end-to-end, producing a working app testable on an iPhone simulator on a Mac Mini M4 (16 GB).

> **Critical constraint**: Do NOT build or implement any AI/ML model for analyzing tree photos (species identification, health assessment, measurement estimation). The AI processing pipeline will be developed separately. Instead, create a clean interface/contract (types, API endpoints, queue job schema) that the AI system will plug into later. All tree observations should be stored as "pending_ai" status until the external AI system processes them.

---

## 1. Project Overview

Urban Pulse Mapping is a crowdsourced urban tree inventory app. Citizens photograph trees in their city, the app geotags and uploads the photos, and the data feeds into a municipal-grade tree database. Cities buy this data to track canopy coverage, verify tree plantings, and meet climate goals.

### What the app does (user flow)

1. **User opens app** → sees a map centered on their location showing all mapped trees nearby (color-coded pins by status: verified green, pending yellow, cooldown gray)
2. **User taps "Scan Tree" button** → guided photo capture flow:
   - Step 1: Full tree photo from Angle 1 (with overlay guide showing ideal framing)
   - Step 2: Full tree photo from Angle 2 (rotated ~90° from first angle)
   - Step 3: Close-up bark photo (with overlay guide showing ideal distance/framing)
   - GPS coordinates captured automatically with accuracy indicator
3. **User reviews & submits** → photos upload to cloud storage, observation record created
4. **User dashboard** → shows their stats: total scans, verified trees, pending reviews, contribution map

### Backend logic

- Trees are deduplicated: if a new observation is within ~5 meters of an existing tree, it's linked as a new observation of that tree rather than creating a new tree record
- **Cooldown system**: Once a tree has been observed by **3 unique users**, it enters a **seasonal cooldown** (90 days). During cooldown, the tree appears grayed out on the map and cannot be scanned again. This ensures data freshness without over-surveying.
- Observations are stored with status: `pending_upload` → `pending_ai` → `pending_review` → `verified`
- The `pending_ai` → `pending_review` transition will be handled by the external AI system (not built here). Just create the endpoint contract.

---

## 2. Tech Stack (Use exactly these — do not substitute)

### Mobile App
- **React Native** with **Expo SDK 52+** (managed workflow with dev build — NOT Expo Go)
- **Expo Router** for file-based navigation
- **Expo Camera** for photo capture
- **Expo Location** for GPS
- **Expo Image Picker** as fallback
- **React Native Maps** (`react-native-maps`) with Apple Maps on iOS for the main map view
- **Expo SecureStore** for token storage
- **Expo FileSystem** for offline photo queue
- **React Query (TanStack Query v5)** for data fetching and caching
- **Zustand** for local state management
- **NativeWind v4** (Tailwind CSS for React Native) for styling

### Backend API
- **Node.js 20+** with **TypeScript 5+**
- **Fastify v4** as the web framework
- **Drizzle ORM** with **drizzle-kit** for database schema and migrations
- **PostgreSQL 16** with **PostGIS** extension (Neon serverless in production, local Docker for dev)
- **Cloudflare R2** for photo storage (S3-compatible API)
- **Firebase Auth** for authentication (email/password + Apple Sign-In + Google Sign-In)
- **BullMQ** with **Redis** for job queue (processing pipeline)
- **Zod** for request/response validation
- **OpenAPI 3.1** spec auto-generated from Zod schemas via `@asteasolutions/zod-to-openapi`

### Monorepo Tooling
- **Turborepo** for monorepo task orchestration
- **pnpm** as package manager (NOT npm or yarn)
- Shared TypeScript types in `packages/shared-types`
- Shared Zod schemas in `packages/shared-schemas`

### Dev Environment
- **Docker Compose** via OrbStack for local Postgres+PostGIS, MinIO (S3-compatible), and Redis
- **Expo Dev Build** on iOS Simulator (NOT Expo Go — needed for react-native-maps)
- Xcode 16+ with iOS 18 Simulator

---

## 3. Project Structure

Create this exact directory structure:

```
urban-pulse/
├── turbo.json
├── package.json                    # Root workspace config
├── pnpm-workspace.yaml
├── .gitignore
├── .env.example
├── docker-compose.yml              # Local dev: Postgres+PostGIS, MinIO, Redis
├── CLAUDE.md                       # Agent instructions for the monorepo
│
├── apps/
│   ├── mobile/                     # Expo React Native app
│   │   ├── app/                    # Expo Router file-based routes
│   │   │   ├── _layout.tsx         # Root layout with auth guard
│   │   │   ├── index.tsx           # Map screen (home)
│   │   │   ├── scan/
│   │   │   │   ├── _layout.tsx     # Scan flow layout
│   │   │   │   ├── index.tsx       # Scan intro / tree proximity check
│   │   │   │   ├── angle1.tsx      # Full tree photo angle 1
│   │   │   │   ├── angle2.tsx      # Full tree photo angle 2
│   │   │   │   ├── bark.tsx        # Close-up bark photo
│   │   │   │   ├── review.tsx      # Review all photos + GPS + submit
│   │   │   │   └── success.tsx     # Submission confirmation
│   │   │   ├── dashboard/
│   │   │   │   └── index.tsx       # User stats dashboard
│   │   │   └── (auth)/
│   │   │       ├── login.tsx
│   │   │       └── register.tsx
│   │   ├── components/
│   │   │   ├── TreeMap.tsx          # Main map with tree pins
│   │   │   ├── TreePin.tsx         # Custom map marker component
│   │   │   ├── ScanButton.tsx      # Floating action button for scanning
│   │   │   ├── PhotoCapture.tsx    # Reusable camera capture with overlay guides
│   │   │   ├── PhotoReview.tsx     # Photo thumbnail grid for review screen
│   │   │   ├── GPSIndicator.tsx    # GPS accuracy badge
│   │   │   ├── CooldownBadge.tsx   # Shows cooldown timer on tree pins
│   │   │   └── StatsCard.tsx       # Reusable stat card for dashboard
│   │   ├── lib/
│   │   │   ├── api.ts              # API client (fetch wrapper with auth headers)
│   │   │   ├── auth.ts             # Firebase Auth setup + hooks
│   │   │   ├── location.ts         # GPS utilities
│   │   │   ├── offline-queue.ts    # Queue photos when offline, sync when back
│   │   │   └── store.ts            # Zustand store
│   │   ├── hooks/
│   │   │   ├── useLocation.ts      # Current location hook with accuracy
│   │   │   ├── useTrees.ts         # Fetch trees in viewport
│   │   │   ├── useSubmission.ts    # Manage scan submission state
│   │   │   └── useAuth.ts          # Auth state hook
│   │   ├── constants/
│   │   │   ├── colors.ts           # Brand colors
│   │   │   └── config.ts           # API URL, map defaults, etc.
│   │   ├── app.json
│   │   ├── eas.json
│   │   ├── babel.config.js
│   │   ├── metro.config.js
│   │   ├── tailwind.config.js      # NativeWind config
│   │   ├── tsconfig.json
│   │   ├── package.json
│   │   └── CLAUDE.md               # Mobile-specific agent notes
│   │
│   └── api/                        # Fastify backend
│       ├── src/
│       │   ├── index.ts            # Server entry point
│       │   ├── app.ts              # Fastify app factory
│       │   ├── routes/
│       │   │   ├── auth.ts         # POST /auth/verify-token
│       │   │   ├── trees.ts        # GET /trees, GET /trees/:id
│       │   │   ├── observations.ts # POST /observations, GET /observations/:id
│       │   │   ├── uploads.ts      # POST /uploads/presigned-url
│       │   │   ├── users.ts        # GET /users/me, GET /users/me/stats
│       │   │   └── health.ts       # GET /health
│       │   ├── middleware/
│       │   │   └── auth.ts         # Firebase token verification middleware
│       │   ├── services/
│       │   │   ├── tree.service.ts
│       │   │   ├── observation.service.ts
│       │   │   ├── upload.service.ts
│       │   │   ├── dedup.service.ts     # Tree deduplication logic
│       │   │   ├── cooldown.service.ts  # Seasonal cooldown logic
│       │   │   └── user.service.ts
│       │   ├── jobs/
│       │   │   ├── queue.ts             # BullMQ queue setup
│       │   │   ├── worker.ts            # Job worker (currently just moves to pending_ai)
│       │   │   └── types.ts             # Job type definitions
│       │   ├── db/
│       │   │   ├── index.ts             # Drizzle client
│       │   │   ├── schema.ts            # All table definitions
│       │   │   └── migrate.ts           # Migration runner
│       │   └── utils/
│       │       ├── geo.ts               # PostGIS helper functions
│       │       ├── s3.ts                # R2/S3 client setup
│       │       └── errors.ts            # Custom error classes
│       ├── drizzle/
│       │   └── migrations/              # Generated by drizzle-kit
│       ├── drizzle.config.ts
│       ├── tsconfig.json
│       ├── package.json
│       └── CLAUDE.md                    # API-specific agent notes
│
├── packages/
│   ├── shared-types/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── tree.ts            # Tree, Observation, Photo types
│   │   │   ├── user.ts            # User, UserStats types
│   │   │   └── api.ts             # API request/response types
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── shared-schemas/
│       ├── src/
│       │   ├── index.ts
│       │   ├── tree.schema.ts     # Zod schemas for trees
│       │   ├── observation.schema.ts
│       │   └── user.schema.ts
│       ├── tsconfig.json
│       └── package.json
│
└── scripts/
    ├── seed-trees.ts              # Seed dev database with sample trees in Austin
    ├── setup-dev.sh               # One-command dev setup script
    └── test-api.sh                # cURL smoke tests for all API endpoints
```

---

## 4. Database Schema (Drizzle + PostGIS)

Implement this schema in `apps/api/src/db/schema.ts`:

```typescript
import { pgTable, uuid, varchar, text, timestamp, doublePrecision, integer, boolean, index, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Custom PostGIS geometry column helper
// Use sql`geography(Point, 4326)` for location columns

export const observationStatusEnum = pgEnum('observation_status', [
  'pending_upload',   // Photos still uploading
  'pending_ai',       // Waiting for AI processing (external system)
  'pending_review',   // AI processed, awaiting human/community review
  'verified',         // Accepted into inventory
  'rejected'          // Flagged as bad data
]);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  firebaseUid: varchar('firebase_uid', { length: 128 }).notNull().unique(),
  email: varchar('email', { length: 255 }),
  displayName: varchar('display_name', { length: 100 }),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const trees = pgTable('trees', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Store lat/lng separately for easy querying + a PostGIS geography column for spatial ops
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  // location: geography(Point, 4326) — add via raw SQL in migration
  speciesCommon: varchar('species_common', { length: 200 }),  // Populated by AI later
  speciesScientific: varchar('species_scientific', { length: 200 }),
  speciesConfidence: doublePrecision('species_confidence'),    // 0.0 - 1.0
  healthStatus: varchar('health_status', { length: 50 }),      // Populated by AI later
  healthConfidence: doublePrecision('health_confidence'),
  estimatedDbhCm: doublePrecision('estimated_dbh_cm'),         // Populated by AI later
  estimatedHeightM: doublePrecision('estimated_height_m'),
  observationCount: integer('observation_count').default(0).notNull(),
  uniqueObserverCount: integer('unique_observer_count').default(0).notNull(),
  lastObservedAt: timestamp('last_observed_at'),
  cooldownUntil: timestamp('cooldown_until'),  // null = not on cooldown
  verificationTier: varchar('verification_tier', { length: 20 }).default('unverified'),
  // 'unverified' | 'ai_verified' | 'community_verified' | 'expert_verified'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Add spatial index via raw SQL in migration
  locationIdx: index('trees_location_idx').using('gist', sql`location`),
  cooldownIdx: index('trees_cooldown_idx').on(table.cooldownUntil),
}));

export const observations = pgTable('observations', {
  id: uuid('id').primaryKey().defaultRandom(),
  treeId: uuid('tree_id').references(() => trees.id),  // null if new tree not yet created
  userId: uuid('user_id').references(() => users.id).notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  gpsAccuracyMeters: doublePrecision('gps_accuracy_meters'),
  status: observationStatusEnum('status').default('pending_upload').notNull(),
  // AI results (populated by external system)
  aiSpeciesResult: text('ai_species_result'),     // JSON blob from AI
  aiHealthResult: text('ai_health_result'),       // JSON blob from AI
  aiMeasurementResult: text('ai_measurement_result'), // JSON blob from AI
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  treeIdx: index('observations_tree_idx').on(table.treeId),
  userIdx: index('observations_user_idx').on(table.userId),
  statusIdx: index('observations_status_idx').on(table.status),
}));

export const photos = pgTable('photos', {
  id: uuid('id').primaryKey().defaultRandom(),
  observationId: uuid('observation_id').references(() => observations.id).notNull(),
  photoType: varchar('photo_type', { length: 20 }).notNull(),
  // 'full_tree_angle1' | 'full_tree_angle2' | 'bark_closeup'
  storageKey: varchar('storage_key', { length: 500 }).notNull(),  // R2 object key
  storageUrl: text('storage_url'),    // Public or presigned URL
  widthPx: integer('width_px'),
  heightPx: integer('height_px'),
  fileSizeBytes: integer('file_size_bytes'),
  mimeType: varchar('mime_type', { length: 50 }),
  capturedAt: timestamp('captured_at'),
  // Photo metadata from device
  deviceModel: varchar('device_model', { length: 100 }),
  osVersion: varchar('os_version', { length: 50 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

**Important migration additions (raw SQL)**:
```sql
-- After table creation, add PostGIS geography column and populate from lat/lng
ALTER TABLE trees ADD COLUMN location geography(Point, 4326);
CREATE INDEX trees_location_gist_idx ON trees USING GIST (location);

-- Trigger to auto-update location from lat/lng on insert/update
CREATE OR REPLACE FUNCTION update_tree_location()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trees_location_trigger
BEFORE INSERT OR UPDATE OF latitude, longitude ON trees
FOR EACH ROW EXECUTE FUNCTION update_tree_location();
```

---

## 5. Core API Endpoints

Implement all endpoints in Fastify with Zod validation. Every endpoint requires Firebase Auth token in `Authorization: Bearer <token>` header (except `/health`).

### Trees
```
GET /api/trees
  Query params:
    - lat: number (required) — center latitude
    - lng: number (required) — center longitude  
    - radius: number (optional, default 500) — meters
    - status: string (optional) — filter by verification tier
  Response: { trees: Tree[], count: number }
  Notes: Uses PostGIS ST_DWithin for spatial query. Include cooldown status.

GET /api/trees/:id
  Response: Full tree record with observation history and photos

GET /api/trees/:id/observations
  Response: { observations: Observation[] }
```

### Observations (the core submission flow)
```
POST /api/observations
  Body: {
    latitude: number,
    longitude: number, 
    gpsAccuracyMeters: number,
    photos: [
      { photoType: 'full_tree_angle1', storageKey: string },
      { photoType: 'full_tree_angle2', storageKey: string },
      { photoType: 'bark_closeup', storageKey: string }
    ]
  }
  Logic:
    1. Validate all 3 required photos are present
    2. Run deduplication: find trees within 5m using PostGIS
    3. If match found AND tree is NOT on cooldown → link observation to existing tree
    4. If match found AND tree IS on cooldown → return 409 with cooldown_until timestamp
    5. If no match → create new tree record, link observation
    6. Update tree.observation_count, tree.unique_observer_count, tree.last_observed_at
    7. Check cooldown trigger: if unique_observer_count >= 3, set cooldown_until = NOW() + 90 days
    8. Queue job for AI processing (just sets status to pending_ai)
    9. Return observation with tree data
  Response: { observation: Observation, tree: Tree, isNewTree: boolean }

GET /api/observations/:id
  Response: Full observation with photos
```

### Uploads
```
POST /api/uploads/presigned-url
  Body: { 
    filename: string,
    contentType: string (image/jpeg or image/heic),
    photoType: 'full_tree_angle1' | 'full_tree_angle2' | 'bark_closeup'
  }
  Response: { 
    uploadUrl: string (presigned PUT URL for R2),
    storageKey: string (the key to reference in POST /observations)
  }
  Notes: Generate a unique storage key like `observations/{userId}/{uuid}/{photoType}.jpg`
```

### Users
```
GET /api/users/me
  Response: User profile

GET /api/users/me/stats
  Response: {
    totalScans: number,
    verifiedTrees: number,
    pendingObservations: number,
    treesOnCooldown: number,
    contributionStreak: number (consecutive days with at least 1 scan),
    neighborhoodsContributed: number
  }

PATCH /api/users/me
  Body: { displayName?: string, avatarUrl?: string }
```

### AI Processing Contract (stub — DO NOT IMPLEMENT AI LOGIC)
```
POST /api/internal/observations/:id/ai-result
  Body: {
    species: { common: string, scientific: string, confidence: number } | null,
    health: { status: string, confidence: number, issues: string[] } | null,
    measurements: { dbhCm: number, heightM: number } | null
  }
  Notes: This endpoint will be called BY the external AI system.
         It updates the observation's AI result fields and transitions
         status from pending_ai → pending_review.
         It also updates the parent tree's species/health/measurement fields
         if the AI confidence exceeds the existing values.
  Auth: Use a separate API key (X-Internal-API-Key header), not Firebase.
```

### Health
```
GET /health
  Response: { status: 'ok', timestamp: string, db: 'connected' | 'error' }
  No auth required.
```

---

## 6. Mobile App Design Specification

### Brand Colors (match urbanpulsemapping.com)

```typescript
// constants/colors.ts
export const colors = {
  // Primary greens
  primary: '#2D6A4F',        // Deep forest green — primary buttons, headers
  primaryLight: '#40916C',   // Lighter green — secondary elements
  primaryDark: '#1B4332',    // Darkest green — status bar, app background accents
  
  // Accent
  accent: '#52B788',         // Bright green — success states, verified badges
  accentLight: '#95D5B2',    // Soft green — backgrounds, cards
  accentLightest: '#D8F3DC', // Palest green — screen backgrounds, subtle tints
  
  // Functional
  warning: '#E9C46A',        // Amber — pending status
  error: '#E76F51',          // Warm red — errors, rejected
  cooldown: '#ADB5BD',       // Gray — cooldown state
  
  // Neutrals
  white: '#FFFFFF',
  background: '#F8FAF9',     // Very subtle green-tinted white
  surface: '#FFFFFF',
  text: '#1B1B1B',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  
  // Map pin colors
  pinVerified: '#2D6A4F',
  pinPending: '#E9C46A',
  pinCooldown: '#ADB5BD',
  pinNew: '#52B788',
};
```

### Screen-by-Screen Specifications

#### Map Screen (Home — `app/index.tsx`)
- Full-screen map centered on user's current location
- Tree pins color-coded: verified (deep green), pending (amber), cooldown (gray)
- Tapping a pin shows a bottom sheet with: species (if known), status badge, observation count, last observed date, and a thumbnail of the most recent photo
- Cluster markers when zoomed out (show count badge)
- User location blue dot with accuracy ring
- **Floating Action Button** in bottom-right: large green circle with tree/scan icon, labeled "Scan". This is the primary CTA.
- Top-left: hamburger menu or user avatar for navigation
- Top-right: filter icon (filter by status, date range)
- Bottom tab bar with 3 tabs: **Map** (home), **Dashboard** (stats), **Profile** (settings)

#### Scan Flow (`app/scan/` — modal stack)
This is a modal flow that slides up over the map. It has a progress stepper at top (3 dots: Tree Photo 1, Tree Photo 2, Bark Close-up).

**Step 1 — Proximity Check (`scan/index.tsx`)**
- Before opening camera, check GPS and query nearby trees
- If within 5m of an existing tree that's on cooldown → show message: "This tree was recently mapped and is on cooldown until [date]. Try another tree nearby!"
- If within 5m of an existing tree NOT on cooldown → show: "It looks like you're near a previously mapped tree. Would you like to add a new observation?" with "Yes, update this tree" and "No, this is a different tree" buttons
- If no nearby tree → proceed directly to camera
- Show GPS accuracy indicator (green if <10m, yellow if 10-20m, red if >20m)

**Step 2 — Full Tree Angle 1 (`scan/angle1.tsx`)**
- Full-screen camera viewfinder
- Semi-transparent overlay guide: a tree silhouette outline showing ideal framing (full tree from roots to crown)
- Text instruction at top: "Stand back and capture the full tree — Angle 1"
- GPS coordinates displayed in a small badge at bottom-left
- Capture button (large green circle) at bottom center
- "Tips" button that shows a brief overlay: "Stand 10-20 feet back. Include the full tree from ground to top of crown. Hold phone vertically."
- After capture → show preview with "Retake" and "Use Photo" buttons
- Detect and warn about blur before accepting

**Step 3 — Full Tree Angle 2 (`scan/angle2.tsx`)**
- Same layout as Angle 1
- Text instruction: "Now walk ~90° around the tree and capture from a second angle"
- Small compass indicator showing recommended rotation from first photo
- Same capture → preview → accept flow

**Step 4 — Bark Close-up (`scan/bark.tsx`)**
- Same camera layout but with different overlay: a rectangular frame showing ideal bark photo area (~1ft × 1ft section of trunk at chest height)
- Text instruction: "Move close and photograph the bark at chest height"
- Tips: "Hold phone 6-12 inches from the trunk. Focus on a section about 1 foot square. Include bark texture detail."
- Same capture → preview → accept flow

**Step 5 — Review & Submit (`scan/review.tsx`)**
- 3 photo thumbnails in a row (tap to enlarge)
- Map snippet showing pin at captured GPS location
- GPS accuracy readout
- Optional notes text field
- Large green "Submit Tree" button
- "Cancel" link to discard everything
- Show upload progress bar when submitting
- Handle offline: if no connection, save to offline queue with a "Will upload when connected" message

**Step 6 — Success (`scan/success.tsx`)**
- Animated checkmark or tree illustration
- "Tree submitted successfully!"  
- Stats update: "You've scanned X trees" 
- "Scan Another" and "View on Map" buttons

#### Dashboard (`app/dashboard/index.tsx`)
- Greeting: "Hey, {displayName}!"
- Stats grid (2×2 cards):
  - **Trees Scanned** (total count, with small chart showing weekly activity)
  - **Verified** (count with green badge)
  - **Pending** (count with amber badge)  
  - **On Cooldown** (count with gray badge)
- **Recent Activity** list: last 10 observations with thumbnail, status badge, date
- **Your Contribution Map**: small map showing only the user's scanned tree locations

#### Auth Screens (`app/(auth)/`)
- Clean, minimal design with Urban Pulse logo at top
- Green gradient background (primaryDark → primary)
- White card with auth form
- **Login**: Email + password fields, "Sign In" button, divider "OR", Apple Sign-In button (dark, full-width), Google Sign-In button (white with Google logo, full-width), "Don't have an account? Register" link
- **Register**: Display name, email, password, confirm password, same social sign-in buttons, "Already have an account? Sign In" link

---

## 7. Key Implementation Details

### Offline Queue System
```typescript
// lib/offline-queue.ts
// Store pending submissions in Expo FileSystem as JSON files
// Each submission is a directory: FileSystem.documentDirectory + 'pending/{uuid}/'
//   - metadata.json (lat, lng, accuracy, timestamp, status)
//   - angle1.jpg
//   - angle2.jpg  
//   - bark.jpg
// On app foreground or network recovery:
//   1. Check for pending submissions
//   2. Upload photos via presigned URLs
//   3. POST observation
//   4. On success, delete local files
//   5. Show badge on tab bar for pending count
```

### Tree Deduplication Service
```typescript
// services/dedup.service.ts
// Given a new observation's coordinates:
// 1. Query: SELECT * FROM trees WHERE ST_DWithin(location, ST_MakePoint(lng, lat)::geography, 5)
// 2. If results found, return the closest tree
// 3. Let the caller decide whether to link or create new
// 5m threshold is tight enough to distinguish individual trees in most urban contexts
```

### Cooldown Service
```typescript
// services/cooldown.service.ts
// After linking an observation to a tree:
// 1. Count unique user_ids in observations for that tree
// 2. If unique_observer_count >= 3 AND cooldown_until IS NULL or expired:
//    SET cooldown_until = NOW() + INTERVAL '90 days'
// 3. When querying trees for the map, include cooldown_until so the app can display status
// 4. When a new observation comes in for a tree on cooldown, return 409 Conflict
```

### Photo Upload Flow
```typescript
// Mobile side:
// 1. User captures photo → saved to local file system
// 2. On submit, for each photo:
//    a. POST /api/uploads/presigned-url → get uploadUrl + storageKey
//    b. PUT photo bytes to uploadUrl (direct to R2, bypasses our server)
//    c. Collect storageKeys
// 3. POST /api/observations with all storageKeys
// 
// This means photo bytes never go through our API server — they go direct to R2.
```

### Auth Flow
```typescript
// Mobile: Firebase Auth SDK handles sign-in UI and token management
// On every API request:
//   1. Get Firebase ID token: await auth().currentUser.getIdToken()
//   2. Send as Authorization: Bearer <token>
// 
// Backend middleware:
//   1. Extract Bearer token from Authorization header
//   2. Verify with Firebase Admin SDK: admin.auth().verifyIdToken(token)
//   3. Look up or create user in our DB by firebase_uid
//   4. Attach user to request context
```

---

## 8. Docker Compose for Local Development

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgis/postgis:16-3.4-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: urban_pulse_dev
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: devpassword
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev -d urban_pulse_dev"]
      interval: 5s
      timeout: 5s
      retries: 5

  minio:
    image: quay.io/minio/minio:latest
    ports:
      - "9000:9000"   # S3 API
      - "9001:9001"   # Console UI
    command: server --console-address ":9001" /data
    environment:
      MINIO_ROOT_USER: minioaccess
      MINIO_ROOT_PASSWORD: miniosecret
    volumes:
      - miniodata:/data

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  miniodata:
  redisdata:
```

---

## 9. Environment Variables

Create `.env.example` with all required variables:

```bash
# Database
DATABASE_URL=postgresql://dev:devpassword@localhost:5432/urban_pulse_dev

# Cloudflare R2 / S3 (use MinIO locally)
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioaccess
S3_SECRET_KEY=miniosecret
S3_BUCKET=urban-pulse-photos
S3_REGION=auto
S3_PUBLIC_URL=http://localhost:9000/urban-pulse-photos

# Firebase
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"

# Internal API (for AI system)
INTERNAL_API_KEY=dev-internal-key-change-in-production

# Redis
REDIS_URL=redis://localhost:6379

# App
API_PORT=3000
NODE_ENV=development
LOG_LEVEL=debug

# Mobile (in apps/mobile/.env)
EXPO_PUBLIC_API_URL=http://localhost:3000/api
EXPO_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-firebase-project-id
```

---

## 10. Setup & Testing Instructions

### One-Time Setup (run this FIRST after generating the project)

```bash
#!/bin/bash
# scripts/setup-dev.sh

set -e

echo "🌳 Urban Pulse Mapping — Development Setup"
echo "============================================"

# Check prerequisites
command -v node >/dev/null 2>&1 || { echo "❌ Node.js 20+ required. Install via nvm."; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm required. Run: npm install -g pnpm"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker (or OrbStack) required."; exit 1; }

# Check Xcode CLI tools and simulator
xcode-select -p >/dev/null 2>&1 || { echo "❌ Xcode CLI tools required. Run: xcode-select --install"; exit 1; }
xcrun simctl list devices available | grep -q "iPhone" || { echo "⚠️  No iOS simulators found. Open Xcode > Settings > Platforms > install iOS 18 Simulator."; }

# 1. Install all dependencies
echo "📦 Installing dependencies..."
pnpm install

# 2. Start infrastructure
echo "🐳 Starting Docker containers..."
docker compose up -d
echo "Waiting for Postgres to be ready..."
until docker compose exec -T postgres pg_isready -U dev -d urban_pulse_dev 2>/dev/null; do
  sleep 1
done
echo "✅ Postgres ready"

# 3. Create MinIO bucket
echo "🪣 Creating S3 bucket in MinIO..."
docker compose exec -T minio mc alias set local http://localhost:9000 minioaccess miniosecret 2>/dev/null || \
  docker run --rm --network host minio/mc alias set local http://localhost:9000 minioaccess miniosecret
docker compose exec -T minio mc mb local/urban-pulse-photos --ignore-existing 2>/dev/null || \
  docker run --rm --network host minio/mc mb local/urban-pulse-photos --ignore-existing
docker compose exec -T minio mc anonymous set download local/urban-pulse-photos 2>/dev/null || \
  docker run --rm --network host minio/mc anonymous set download local/urban-pulse-photos

# 4. Copy env files
echo "📋 Setting up environment files..."
cp .env.example .env 2>/dev/null || true
cp .env.example apps/api/.env 2>/dev/null || true

# 5. Run database migrations
echo "🗄️  Running database migrations..."
pnpm --filter @urban-pulse/api run db:migrate

# 6. Seed sample data
echo "🌱 Seeding sample tree data..."
pnpm --filter @urban-pulse/api run db:seed

# 7. Build the Expo dev client
echo "📱 Building Expo dev client for iOS Simulator..."
echo "   This takes 5-10 minutes on first run..."
cd apps/mobile
npx expo prebuild --platform ios --clean
npx expo run:ios --device "iPhone 16"
cd ../..

echo ""
echo "============================================"
echo "✅ Setup complete!"
echo ""
echo "To start developing:"
echo "  Terminal 1: docker compose up -d       (if not already running)"
echo "  Terminal 2: pnpm turbo run dev         (starts API + mobile)"
echo ""
echo "  API:     http://localhost:3000"
echo "  MinIO:   http://localhost:9001 (minioaccess/miniosecret)"
echo "  Mobile:  Opens in iOS Simulator automatically"
echo "============================================"
```

### Running the App Day-to-Day

```bash
# Start infrastructure (if not running)
docker compose up -d

# Start all dev servers (API + mobile)
pnpm turbo run dev

# Or start individually:
pnpm --filter @urban-pulse/api run dev     # API on port 3000
pnpm --filter @urban-pulse/mobile run dev  # Expo dev server

# The Expo dev server will connect to the iOS Simulator.
# If simulator isn't running, press 'i' in the Expo terminal to launch it.
```

### Testing the API

```bash
# scripts/test-api.sh — run after starting the API

BASE_URL="http://localhost:3000"

echo "Testing API endpoints..."

# Health check
echo "\n--- Health Check ---"
curl -s "$BASE_URL/health" | jq .

# Get trees (no auth needed for dev — make auth optional in dev mode)
echo "\n--- Get Trees Near Austin ---"
curl -s "$BASE_URL/api/trees?lat=30.2672&lng=-97.7431&radius=1000" | jq .

echo "\n--- API Smoke Tests Complete ---"
```

### Testing the Mobile App

After `pnpm turbo run dev` starts the Expo dev server:

1. The iOS Simulator should launch automatically with the dev build
2. If it doesn't, press `i` in the Expo dev server terminal
3. **If the app crashes on launch**: 
   - Run `cd apps/mobile && npx expo prebuild --platform ios --clean && npx expo run:ios`
   - This rebuilds the native iOS project
4. **If the map doesn't show**:
   - iOS Simulator uses Apple Maps — no API key needed
   - Check that Location Services are enabled: Simulator menu > Features > Location > Custom Location > set to Austin (30.2672, -97.7431)
5. **If photos can't be taken in simulator**:
   - The iOS Simulator doesn't have a real camera
   - Implement a dev-mode fallback: when `__DEV__` is true, the camera screen should offer a "Use Sample Photo" button that loads a bundled test image
   - Include 3 sample tree photos in `apps/mobile/assets/dev/` (sample-tree-angle1.jpg, sample-tree-angle2.jpg, sample-bark.jpg)
6. **If API calls fail from the simulator**:
   - The iOS Simulator can reach `localhost` on the host machine
   - Verify `EXPO_PUBLIC_API_URL=http://localhost:3000/api` in `apps/mobile/.env`

### Debugging Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `pnpm install` fails | Wrong Node version | Use Node 20+ (`nvm use 20`) |
| Postgres won't start | Port 5432 in use | `lsof -i :5432` and kill, or change docker port |
| Migrations fail | PostGIS not installed | The `postgis/postgis` Docker image includes it — restart container |
| Expo build fails | CocoaPods issue | `cd apps/mobile/ios && pod install --repo-update` |
| Simulator is slow | 16GB RAM pressure | Close other apps, especially Chrome and Docker Desktop (use OrbStack instead) |
| Map shows wrong location | Simulator GPS not set | Simulator > Features > Location > Custom Location |
| "Network request failed" | API not running | Ensure `pnpm --filter @urban-pulse/api run dev` is running |
| Firebase auth fails | No Firebase project | For dev testing, make auth middleware skip verification when `NODE_ENV=development` with a mock user |

---

## 11. Dev Mode Conveniences

To make development and testing frictionless without a real Firebase project initially:

### Mock Auth in Development
```typescript
// In apps/api/src/middleware/auth.ts
// When NODE_ENV === 'development' and no Firebase credentials configured:
// Accept any Bearer token and use a hardcoded dev user
// This lets the mobile app work immediately without Firebase setup

if (process.env.NODE_ENV === 'development' && !process.env.FIREBASE_PROJECT_ID) {
  // Skip token verification, use mock user
  request.user = {
    id: 'dev-user-uuid',
    firebaseUid: 'dev-user-123',
    email: 'dev@urbanpulse.test',
    displayName: 'Dev User'
  };
  return;
}
```

### Sample Data Seeder
```typescript
// scripts/seed-trees.ts
// Seed ~50 sample trees scattered around downtown Austin (30.26, -97.74)
// Mix of statuses: some verified, some pending, some on cooldown
// Include sample observation records and placeholder photo URLs
// This ensures the map has visible content on first launch
```

### Dev Camera Fallback
```typescript
// In PhotoCapture.tsx, when __DEV__ is true:
// Show a "Use Sample Photo" button alongside the real camera
// This loads bundled test images so the full scan flow can be tested
// without a physical camera
```

---

## 12. CLAUDE.md Files

### Root CLAUDE.md
```markdown
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
```

### apps/mobile/CLAUDE.md
```markdown
# Urban Pulse Mobile App

Expo SDK 52+ with React Native, Expo Router, NativeWind.

## Key Patterns
- File-based routing via Expo Router in app/ directory
- NativeWind (Tailwind) for all styling — no StyleSheet.create
- TanStack Query for all API calls (useQuery/useMutation)
- Zustand for local state (scan flow progress, auth state)
- Offline-first: all submissions queue locally, sync when online

## Dev Notes
- iOS Simulator only (no Android yet)
- Camera doesn't work in simulator — use dev fallback sample photos when __DEV__
- Set simulator location: Features > Location > Custom Location (30.2672, -97.7431)
- react-native-maps uses Apple Maps on iOS — no API key needed

## Don't
- Don't use StyleSheet.create — use NativeWind className prop
- Don't call API without going through the api.ts client
- Don't store auth tokens in AsyncStorage — use SecureStore
```

### apps/api/CLAUDE.md
```markdown
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
```

---

## 13. Package.json Scripts

### Root `package.json`
```json
{
  "name": "urban-pulse",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "clean": "turbo run clean",
    "setup": "bash scripts/setup-dev.sh"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.5.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

### `apps/api/package.json` scripts
```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src/",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/db/migrate.ts",
    "db:seed": "tsx scripts/seed-trees.ts",
    "db:studio": "drizzle-kit studio"
  }
}
```

### `apps/mobile/package.json` scripts
```json
{
  "scripts": {
    "dev": "expo start --dev-client",
    "ios": "expo run:ios",
    "build:dev": "expo prebuild --platform ios --clean && expo run:ios",
    "lint": "eslint app/ components/ lib/ hooks/"
  }
}
```

---

## 14. What NOT To Build

To be absolutely clear, **do not implement**:

1. ❌ AI species identification model or API calls to PlantNet/Claude Vision/GPT-4V
2. ❌ AI health assessment logic
3. ❌ AI measurement estimation (DBH, height)
4. ❌ Any machine learning model training or inference
5. ❌ The web dashboard (Next.js app — this comes later)
6. ❌ Push notifications
7. ❌ Social features (leaderboards, teams, community validation)
8. ❌ Admin panel
9. ❌ Stripe/payment integration
10. ❌ LiDAR scanning (stubbed interface only if time permits)

**Do build the interface contracts** so these can be plugged in later:
- ✅ The `POST /api/internal/observations/:id/ai-result` endpoint
- ✅ The `pending_ai` status in the observation lifecycle
- ✅ TypeScript types for AI results in `packages/shared-types`
- ✅ The BullMQ job queue structure (even though the worker just moves status to pending_ai)

---

## 15. Success Criteria

When this prompt has been fully executed, the following should be true:

1. ✅ `docker compose up -d` starts Postgres+PostGIS, MinIO, and Redis
2. ✅ `pnpm install` completes without errors
3. ✅ `pnpm turbo run dev` starts both the API server and Expo dev server
4. ✅ The API responds to `curl http://localhost:3000/health` with `{"status":"ok"}`
5. ✅ `curl http://localhost:3000/api/trees?lat=30.2672&lng=-97.7431&radius=1000` returns seeded trees
6. ✅ The iOS Simulator launches with the Urban Pulse app showing a map of Austin with tree pins
7. ✅ Tapping "Scan Tree" opens the guided photo capture flow
8. ✅ The full flow (camera → review → submit) creates an observation record in the database
9. ✅ The dashboard screen shows the user's stats
10. ✅ Trees with 3+ unique observers show cooldown status on the map
11. ✅ The app has the green-themed visual design matching the brand
12. ✅ All TypeScript compiles with zero errors (`pnpm turbo run build`)

---

## Final Notes for the Agent

- **Start with infrastructure**: docker-compose, database schema, migrations, seed data. Verify the API works standalone before touching mobile.
- **Then build the API**: routes, services, middleware. Test each endpoint with curl.
- **Then build the mobile app**: start with the map screen (most visual impact), then scan flow, then dashboard.
- **Test constantly**: after each major component, verify it works. Don't build everything and test at the end.
- **Memory management**: this is a 16GB Mac Mini. Keep Docker containers lean, close unnecessary processes, and prefer `expo start --dev-client` over full rebuilds.
- **When in doubt, keep it simple**: for the MVP, simple is better than clever. Use straightforward patterns. No premature optimization.
