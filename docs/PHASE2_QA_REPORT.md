# Phase 2 QA Report — Urban Pulse Mapping

**Auditor:** Ralph Wiggum 🔍  
**Date:** 2026-02-23  
**API:** http://localhost:3000 (restarted with mock auth for testing)  
**Mobile:** Expo dev server on port 8081

## Summary

| # | Feature | Status |
|---|---------|--------|
| 1 | Firebase Auth (API) | 🟢 PASS |
| 2 | Auth Screens (Mobile) | 🟢 PASS |
| 3 | Tree Bottom Sheet | 🟢 PASS |
| 4 | Cluster Markers | 🟢 PASS |
| 5 | Filter Icon | 🟢 PASS |
| 6 | User Avatar Nav | 🟢 PASS |
| 7 | Contribution Map | 🟢 PASS |
| 8 | Weekly Activity Chart | 🟡 PARTIAL |
| 9 | Blur Detection | 🟢 PASS |
| 10 | Compass Indicator | 🟢 PASS |
| 11 | Loading States | 🟢 PASS |
| 12 | Error Boundaries | 🟢 PASS |

**Cross-cutting:** 🟡 PARTIAL (build artifact stale, one API endpoint issue)

---

## Feature Details

### Feature 1: Firebase Auth (API) 🟢

- [x] `firebase-admin` in `apps/api/package.json` (v12.2.0)
- [x] Auth middleware uses Firebase Admin SDK when `FIREBASE_PROJECT_ID` is set
- [x] Mock auth fallback works when `FIREBASE_PROJECT_ID` is unset (verified — dev-token accepted, all routes accessible)
- [x] User upsert logic on auth — `onConflictDoNothing()` handles race conditions, upserts by `firebase_uid`
- [x] `isFirebaseConfigured()` properly checks for placeholder values (`your-*`)

### Feature 2: Auth Screens (Mobile) 🟢

- [x] `(auth)/login.tsx` exists with email/password fields
- [x] Apple Sign-In button (iOS-only conditional)
- [x] Google Sign-In button
- [x] `(auth)/register.tsx` exists with display name, email, password, confirm password
- [x] Green gradient background (`expo-linear-gradient` with `LinearGradient`)
- [x] Auth guard in `_layout.tsx` — redirects unauthenticated users to `/(auth)/login`
- [x] Firebase SDK initialized in `lib/auth.ts` (full Firebase Auth SDK with `initializeApp`, `getAuth`)
- [x] `useAuth` hook uses `onAuthStateChanged` (line 134 in auth.ts)
- [x] **NO `StyleSheet.create` anywhere in mobile app** — verified via grep, 0 matches

### Feature 3: Tree Bottom Sheet 🟢

- [x] `TreeBottomSheet.tsx` exists
- [x] Shows species (`tree.sppCommon`), status badge (`getStatusInfo()`), observation count, last observed (`getRelativeTime()`), photo thumbnail
- [x] Integrated in map screen (`index.tsx`)

### Feature 4: Cluster Markers 🟢

- [x] `react-native-map-clustering` (v4.0.0) in package.json
- [x] Referenced in `index.tsx`
- [x] Cluster markers show count via library defaults
- [x] Tap to zoom behavior (library built-in)

### Feature 5: Filter Icon 🟢

- [x] Filter button on map screen
- [x] Filter modal with status checkboxes and date range
- [x] `hasActiveFilters()` function for active filter indicator
- [x] Client-side filtering applied via `filteredTrees` useMemo
- [x] Filter state managed with `showFilterModal`, `tempFilters`

### Feature 6: User Avatar Nav 🟢

- [x] Avatar/initials circle on map screen (comment at line 328: "Feature 6: User avatar nav")
- [x] Navigates to profile

### Feature 7: Contribution Map 🟢

- [x] Small `MapView` from `react-native-maps` on dashboard (`app/dashboard/index.tsx`)
- [x] Shows user's trees via `/api/users/me/observations` endpoint
- [x] API support for user-specific observation query (`getUserObservations` in user.service.ts)

### Feature 8: Weekly Activity Chart 🟡

- [x] `WeeklyActivityChart.tsx` component exists — bar chart with 7 days, day labels, total count
- [x] API has `getWeeklyActivity` service function and `/api/users/me/weekly-activity` route
- [x] Shows 7 days of data with proper date labels
- **⚠️ ISSUE:** The compiled `dist/routes/users.js` was stale — only had 3 of 5 routes (missing observations + weekly-activity). Running server was serving old build. After restart with `tsx` (source), route works correctly and returns `{"activity":[{"date":"2026-02-18","count":15},...]}`.

**Fix needed:** Rebuild dist before deploying: `cd apps/api && npm run build`

### Feature 9: Blur Detection 🟢

- [x] `lib/blur-detection.ts` exists — uses file size heuristic for blur detection
- [x] Integrated in `PhotoCapture.tsx` (imports `detectBlur`, calls it on captured photo URI)
- [x] Warning for blurry photos (line 35: checks `isBlurry` result)

### Feature 10: Compass Indicator 🟢

- [x] `CompassIndicator.tsx` exists — uses `Magnetometer` from `expo-sensors`
- [x] Integrated in `app/scan/angle2.tsx` (imported and rendered with `targetHeading` prop)
- [x] Uses expo-sensors magnetometer

### Feature 11: Loading States 🟢

- [x] `isLoadingZoneSwitch` state + `isFetchingTrees` used for loading overlay
- [x] `ActivityIndicator` shown with "Loading trees..." text
- [x] Clears when data arrives (via setTimeout fallback + query state)

### Feature 12: Error Boundaries 🟢

- [x] `ErrorBoundary.tsx` component exists (class component with `componentDidCatch`)
- [x] Wraps root layout in `_layout.tsx` (lines 51-79)
- [x] Wraps MapView in `index.tsx` (lines 413-428)
- [x] Fallback UI with retry (Pressable component)

---

## Cross-cutting Checks

- [x] `cd apps/api && npx tsc --noEmit` — **0 errors** ✅
- [x] `cd apps/mobile && npx tsc --noEmit` — **0 errors** ✅
- [x] **NO `StyleSheet.create` anywhere in mobile app** — confirmed via grep ✅
- [x] All existing endpoints work:
  - `GET /health` ✅
  - `GET /api/trees?lat=30.2672&lng=-97.7431&radius=1000` ✅ (273 trees)
  - `GET /api/zones` ✅
  - `GET /api/bounties` ✅ (2 bounties)
  - `GET /api/users/me` ✅
  - `GET /api/users/me/stats` ✅
  - `GET /api/users/me/weekly-activity` ✅ (after restart)
  - `GET /api/users/me/observations` ✅ (after restart)
  - `GET /api/export/trees?format=csv` ✅
  - `GET /api/export/trees?format=geojson` ✅ (1275 features)
  - `PATCH /api/users/me` ✅ (role switch works)
  - `PATCH /api/bounties/:id` ✅ (status update works)

---

## Issues Found / Fix List

### 🔴 Critical

None.

### 🟡 Medium

1. **Stale dist build** — `apps/api/dist/routes/users.js` only contains 3 of 5 routes. The `observations` and `weekly-activity` endpoints are missing from the compiled output. The source code is correct.
   - **Fix:** Run `cd apps/api && npm run build` to regenerate dist, then restart server
   - **Root cause:** Build wasn't run after adding the new routes
   - **Impact:** Production deployment would be missing 2 endpoints

2. **Firebase .env may block dev testing** — `.env` has `FIREBASE_PROJECT_ID=urbanpulsemapping` which activates real Firebase auth. Dev-token won't work when server loads .env.
   - **Fix:** Either remove/comment the Firebase vars in .env for local dev, or update the mock auth to also work when Firebase is configured but token is `dev-token`
   - **Impact:** Local dev workflow broken unless explicitly unsetting env vars

### 🟢 Low / Cosmetic

3. **Weekly activity endpoint path** — Mobile calls `/api/users/me/weekly-activity` (separate endpoint) rather than including it in `/api/users/me/stats`. This is fine architecturally but worth noting — the stats endpoint doesn't include `weeklyActivity` field as the spec suggested.

---

## Verdict

**11 of 12 features fully pass. 1 feature (Weekly Activity) passes with a note about stale build artifacts.**

All TypeScript compiles cleanly. No `StyleSheet.create` violations. No regressions in existing features. The codebase is solid — just needs a fresh `npm run build` before deployment.

🎉 **Phase 2 is QA-approved** pending the dist rebuild.
