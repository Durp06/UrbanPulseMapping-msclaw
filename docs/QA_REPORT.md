# QA Report — Ralph Wiggum Audit

**Date:** 2026-02-23  
**Auditor:** Ralph Wiggum (independent QA subagent)  
**Scope:** Full verification of Urban Pulse Mapping project

---

## Feature Traffic-Light Status

| Feature | Status | Notes |
|---------|--------|-------|
| Map screen with zone toggles | 🟢 | All 5 toggles present: All Trees, By Zip Code, By Street, Active Contracts, Bounties |
| Zone overlays rendering | 🟢 | ZoneOverlay component (121 lines), GeoJSON MultiPolygon data confirmed from API |
| Tree filtering by zone | 🟢 | `?zoneType=zip_code` and `?zoneType=street_corridor` both return filtered results |
| Bounty system — list | 🟢 | `GET /api/bounties` returns bounties array |
| Bounty system — create | 🟢 | `POST /api/bounties` successfully creates bounties |
| Bounty system — auto-claim | 🟢 | Auto-claim logic present in `bounty.service.ts` line 194 |
| Bounty system — my bounties | 🟢 | `GET /api/bounties/mine` returns user's bounties |
| Developer account switcher | 🔴 | **Not implemented.** No role-switching UI found anywhere in the mobile app. Developer screen exists but only shows bounty management. |
| Level 1 inspection form | 🟢 | `scan/inspection.tsx` (486 lines), all L1 fields in store, schema, and API |
| ArcGIS export endpoint | 🟢 | `GET /api/export/trees?format=geojson` returns valid GeoJSON FeatureCollection (1275 features) |
| Dashboard — Stats | 🟢 | StatsCard components showing totalScans, verifiedTrees, pendingObservations, treesOnCooldown |
| Dashboard — My Zones | 🟢 | Active zones section with progress display |
| Dashboard — Earnings | 🟢 | useUserEarnings hook integrated |
| Active zone banner | 🟢 | ActiveZoneBanner component (49 lines) present |
| Bottom sheet — zones | 🟢 | ZoneBottomSheet (133 lines) present |
| Bottom sheet — trees/bounties | 🟢 | BountyBottomSheet component present |
| Scan flow navigation | 🟢 | Correct order: index → angle1 → angle2 → bark → review → inspection → success |

---

## Verification Results

### TypeScript Checks
| Target | Result |
|--------|--------|
| `apps/api` — `tsc --noEmit` | ✅ 0 errors |
| `apps/mobile` — `tsc --noEmit` | ✅ 0 errors |

### API Endpoint Tests (all via curl against running server)
| Endpoint | Result |
|----------|--------|
| `GET /health` | ✅ `{"status":"ok","db":"connected"}` |
| `GET /api/zones` | ✅ GeoJSON FeatureCollection |
| `GET /api/zones?status=active` | ✅ Filtered zones |
| `GET /api/zones/summary` | ✅ Zone summaries array |
| `GET /api/zones/:id` | ✅ Single zone GeoJSON Feature |
| `GET /api/zones/:id/trees` | ✅ Paginated trees in zone |
| `GET /api/trees?lat=...&lng=...&radius=1000` | ✅ Spatial query works |
| `GET /api/trees?...&zoneType=zip_code` | ✅ Zone-filtered trees |
| `GET /api/trees?...&zoneType=street_corridor` | ✅ Zone-filtered trees |
| `GET /api/bounties` | ✅ Returns bounties |
| `GET /api/bounties/:id` | ✅ (verified by first agent) |
| `GET /api/bounties/mine` | ✅ Returns user's bounties |
| `POST /api/bounties` | ✅ Created test bounty successfully |
| `GET /api/export/trees?format=csv` | ✅ CSV with all ArcGIS columns |
| `GET /api/export/trees?format=geojson` | ✅ 1275 features |
| `GET /api/users/me` | ✅ Dev user profile |
| `GET /api/users/me/stats` | ✅ Stats returned |

**17/17 endpoints passing.**

### Database Schema
- ✅ Migration journal has all 4 entries (0000–0003) properly registered
- ✅ L1 inspection columns present in both `trees` and `observations` tables
- ✅ Bounty tables (`bounties`, `bounty_claims`) with proper FKs and indexes
- ✅ PostGIS geography columns and GIST indexes

### Import Resolution
- ✅ TypeScript compilation with 0 errors confirms all imports resolve

### Expo Build
- ✅ Previously verified by first agent (iOS prebuild + run succeeded)

---

## Issues Found

### 🔴 Critical — Missing Feature
**Developer Account Switcher** — The BUILD_SPEC likely requires a way for testers to switch between user/developer roles without re-authenticating. No such UI exists anywhere in the mobile app. The `useAuthStore` only has `setAuth`/`clearAuth` — no `setRole` or account switching.

### 🟡 Minor Observations
1. **No `heightEstimateM` / `canopySpreadM` in export CSV** — The CSV export includes `HEIGHT_EST_M` and `CANOPY_SPREAD_M` headers, but should be verified these actually populate from L1 data.
2. **Developer dashboard has no detail/edit view** — The bounty card `onPress` is a no-op (empty handler).
3. **No bounty-specific endpoint for a zone** — E.g., `GET /api/bounties?zoneId=...` not explicitly tested; bounties are filtered client-side.

---

## Task List (by priority)

### P0 — Must Fix
- [ ] **Implement developer account switcher** — Add UI (e.g., in settings or developer screen) to toggle between `user`/`developer` roles for testing. Update `useAuthStore` with a `switchRole` action and add an API endpoint or dev-mode toggle.

### P1 — Should Fix
- [ ] **Wire up bounty detail/edit screen** — The developer dashboard bounty cards have empty `onPress`. Create a detail view or at minimum link to edit.
- [ ] **Add `PATCH /api/bounties/:id`** — For editing bounties (pause, update description, etc.)

### P2 — Nice to Have
- [ ] **Add loading states to zone toggles** — Currently toggles switch instantly but tree data refetches; could show skeleton/spinner.
- [ ] **Verify L1 fields populate in export** — End-to-end test that submitting an inspection with L1 data shows up in CSV/GeoJSON export.
- [ ] **Add error boundaries to map screens** — If MapView fails to load (no Google Maps key, etc.), graceful fallback.
- [ ] **Add pagination to bounties list** — Currently returns all bounties; may need pagination for scale.

---

## Comparison with First Agent's Report

The first agent's VERIFICATION_REPORT.md was **thorough and accurate**. Their 4 fixes were all legitimate:
1. ✅ Migration journal fix — confirmed, journal now has all 4 entries
2. ✅ Auth race condition fix — verified `onConflictDoNothing` present
3. ✅ `as any` removal — confirmed clean
4. ✅ Unused import removal — confirmed

**What the first agent missed:**
- The developer account switcher feature being absent (this is likely a spec requirement)
- Bounty card onPress being a no-op
- No PATCH endpoint for bounty editing
