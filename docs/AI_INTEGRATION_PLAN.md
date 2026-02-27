# AI Pipeline Integration Plan

## Overview

Merge the Python AI pipeline from `UrbanPulseMapping-backendDevmsclaw-main` into our working `urban-pulse` monorepo, align the schemas, and add an arborist-facing AI toggle in the mobile app.

---

## Current State

### Our App (`urban-pulse`)
- Working Fastify API + Expo mobile app
- Trees schema has: `healthStatus`, `speciesCommon`, `speciesScientific`, `speciesConfidence`, `estimatedDbhCm`, `estimatedHeightM`
- Level 1 inspection fields (conditionRating, crownDieback, trunkDefects, etc.)
- Stub `POST /api/internal/observations/:id/ai-result` endpoint
- BullMQ job queue (`process-observation`) but NO worker or AI pipeline
- Photos table exists but no presigned upload flow connected

### Backend Repo (`UrbanPulseMapping-backendDevmsclaw-main`)
- Full Python AI pipeline (`apps/ai-pipeline/`) — complete and tested
- Tree schema has MORE fields: `speciesGenus`, `conditionStructural`, `conditionLeaf`, `estimatedDbhIn`, `estimatedHeightFt`, `estimatedCrownWidthM/Ft`, `numStems`, `observations` (JSON)
- BullMQ worker that bridges `process-observation` → `ai-process-observation` queue
- `observation.service.ts` with full `updateObservationAIResult()` handler
- Proper `photos` table with metadata (width, height, fileSize, device, etc.)
- Services: dedup, cooldown, zone spatial lookup, bounty auto-claim

---

## Schema Differences (Must Reconcile)

| Field | Our App | Backend | Action |
|-------|---------|---------|--------|
| `species_genus` | ❌ missing | ✅ | **ADD** to trees |
| `health_status` | ✅ (our name) | ❌ (uses `condition_structural` + `condition_leaf`) | **REPLACE** with backend's dual-field approach |
| `condition_structural` | ❌ | ✅ | **ADD** to trees |
| `condition_leaf` | ❌ | ✅ | **ADD** to trees |
| `observations` (JSON) | ❌ | ✅ | **ADD** to trees (structured health observation codes) |
| `estimated_dbh_in` | ❌ | ✅ | **ADD** to trees |
| `estimated_height_ft` | ❌ | ✅ | **ADD** to trees |
| `estimated_crown_width_m/ft` | ❌ | ✅ | **ADD** to trees |
| `num_stems` | ❌ | ✅ | **ADD** to trees |
| Level 1 inspection fields | ✅ (16 fields) | ❌ | **KEEP** (our addition) |
| Photo metadata | minimal | full (width, height, device, etc.) | **ADD** missing columns to photos |

### Migration Strategy
- Create new migration `0004_ai_pipeline_fields.sql`
- Add all missing columns as nullable (no data loss)
- Drop `health_status` and replace with `condition_structural` + `condition_leaf`
- Keep all Level 1 inspection fields (they complement the AI data)

---

## Integration Steps

### Phase 1: Schema Alignment & API Updates

#### 1.1 Database Migration
- Add missing tree columns: `species_genus`, `condition_structural`, `condition_leaf`, `observations`, `estimated_dbh_in`, `estimated_height_ft`, `estimated_crown_width_m`, `estimated_crown_width_ft`, `num_stems`
- Add missing photo columns: `width_px`, `height_px`, `file_size_bytes`, `mime_type`, `captured_at`, `device_model`, `os_version`
- Add observation columns: `ai_species_result`, `ai_health_result`, `ai_measurement_result` (if not already present)

#### 1.2 Update Drizzle Schema
- Align `apps/api/src/db/schema.ts` with the backend's schema + our Level 1 fields

#### 1.3 Update API Routes
- Replace our stub `observations.ts` routes with the backend's full implementation
- Add the `updateObservationAIResult()` service from the backend
- Add BullMQ worker (`apps/api/src/jobs/worker.ts`) that bridges to `ai-process-observation` queue

#### 1.4 Add Shared Schemas
- Import `aiResultSchema` from backend's `packages/shared-schemas`
- This validates the AI pipeline's POST body

### Phase 2: AI Pipeline Integration

#### 2.1 Copy AI Pipeline
- Copy `apps/ai-pipeline/` directory into our monorepo
- Add `ai-pipeline` service to `docker-compose.yml`
- Add required env vars: `PLANTNET_API_KEY`, `ANTHROPIC_API_KEY`, `INTERNAL_API_KEY`, `LLM_MODEL`

#### 2.2 Pipeline Components (Already Built)
The backend repo has these complete:
- `consumer.py` — BullMQ job listener on `ai-process-observation` queue
- `pipeline.py` — Orchestrator: fetch photos → analyze → POST results
- `clients/plantnet.py` — Pl@ntNet species ID
- `clients/llm.py` — Claude/GPT-4o multimodal analysis
- `clients/storage.py` — MinIO/S3 photo download
- `analyzers/species.py` — Dual-source consensus (Pl@ntNet + LLM)
- `analyzers/health.py` — Structured health assessment
- `analyzers/measurements.py` — DBH + height estimation
- `utils/quality.py` — Blur/quality pre-check

#### 2.3 Test the Flow
- Submit observation → worker queues to `ai-process-observation` → Python pipeline picks up → downloads photos → runs AI → POSTs result back → observation moves to `pending_review`

### Phase 3: AI Toggle (Mobile App)

#### 3.1 AI Mode Toggle — User Preference
- Add `aiEnabled` boolean to the auth/user store (persisted locally)
- Small toggle button on the **Review screen** (after photos are taken, before submission)
- Toggle applies to ALL AI data fields — it's all or nothing
- Default: **ON** (AI enabled)

#### 3.2 UI Design
```
┌─────────────────────────────┐
│  Review Your Scan           │
│                             │
│  [photo1] [photo2] [photo3] │
│                             │
│  📍 30.2630, -97.7453       │
│                             │
│  ┌─────────────────────┐    │
│  │ 🤖 AI Analysis  [ON]│    │  ← Small toggle, top-right of section
│  └─────────────────────┘    │
│                             │
│  [ Submit Observation ]     │
│                             │
└─────────────────────────────┘
```

#### 3.3 How the Toggle Works
- **ON**: Observation is submitted normally → queued for AI → pipeline runs all analyzers → results posted back
- **OFF**: Observation is submitted with `skipAi: true` flag → API sets status directly to `pending_review` (skips the queue entirely) → arborist fills in all fields manually via the inspection form
- API change: `POST /api/observations` accepts optional `skipAi: boolean` field
- If `skipAi`, don't call `addProcessingJob()` — go straight to `pending_review`

#### 3.4 Handling Blank/Unfillable Fields
- If AI can't determine a field, it returns `null` for that section
- The `_build_ai_result` in `pipeline.py` already handles this — each of `species`, `health`, `measurements` can independently be `null`
- Frontend displays blank/empty for any null field — no "N/A" or placeholder text
- The inspection form shows whatever AI filled in as pre-populated defaults, arborist can override any field

### Phase 4: Services from Backend

#### 4.1 Copy These Services
- `dedup.service.ts` — 5m radius tree deduplication
- `cooldown.service.ts` — Prevents duplicate observations too quickly
- `upload.service.ts` — Presigned URL generation for R2/MinIO

#### 4.2 Update Observation Flow
Current: Simple insert
New: Full flow from backend:
1. Check dedup (find nearby tree within 5m)
2. Check cooldown
3. Create/link tree
4. Auto-assign contract zone (spatial lookup)
5. Create observation + photo records
6. Queue for AI (unless `skipAi`)
7. Auto-create bounty claim if applicable

---

## File Changes Summary

### New Files
- `apps/ai-pipeline/` — entire directory (copy from backend)
- `apps/api/drizzle/migrations/0004_ai_pipeline_fields.sql`
- `apps/api/src/services/dedup.service.ts`
- `apps/api/src/services/cooldown.service.ts`
- `apps/api/src/services/upload.service.ts`
- `apps/mobile/components/AIToggle.tsx`

### Modified Files
- `apps/api/src/db/schema.ts` — add missing columns
- `apps/api/src/routes/observations.ts` — full implementation
- `apps/api/src/services/observation.service.ts` — full flow + skipAi
- `apps/api/src/jobs/worker.ts` — bridge to AI queue
- `apps/api/src/jobs/queue.ts` — add AI queue
- `apps/mobile/app/scan/review.tsx` — add AI toggle
- `apps/mobile/lib/store.ts` — add aiEnabled preference
- `docker-compose.yml` — add ai-pipeline service
- `.env.example` — add AI-related env vars

### Env Vars Needed
```
PLANTNET_API_KEY=<from plantnet.org>
ANTHROPIC_API_KEY=<your key>
INTERNAL_API_KEY=<shared secret between API and AI pipeline>
LLM_PROVIDER=anthropic
LLM_MODEL=claude-sonnet-4-5-20250929
```

---

## Execution Order

1. **Schema migration** — Add columns, update Drizzle schema
2. **Copy services** — dedup, cooldown, upload from backend
3. **Update observation flow** — Full create + AI result handler
4. **Add BullMQ worker** — Bridge to AI queue
5. **Copy AI pipeline** — `apps/ai-pipeline/` + Docker config
6. **Mobile: AI toggle** — Review screen toggle + `skipAi` flag
7. **Test end-to-end** — Submit observation → AI processes → results appear
8. **Manual field entry** — When AI off, inspection form is the primary data entry

---

## Open Questions

1. **API keys** — Do you have a Pl@ntNet API key? (Free tier = 500 requests/day)
2. **Anthropic key** — Use your existing Claude key for the LLM analysis?
3. **LLM model** — Backend defaults to Claude Sonnet 4.5. Good with that?
4. **Photo upload** — Currently photos don't actually upload to R2/MinIO from the app. Need to wire up presigned URLs. Do this as part of this integration or separately?
