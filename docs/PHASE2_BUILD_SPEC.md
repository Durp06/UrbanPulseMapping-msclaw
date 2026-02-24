# Phase 2 Build Spec — 12 Remaining Features

## Context
- Monorepo at `/Users/macmini/projects/urban-pulse` (Turborepo + pnpm)
- Mobile: `apps/mobile/` (Expo SDK 52+, Expo Router, NativeWind className only — NO StyleSheet.create)
- API: `apps/api/` (Fastify v4, Drizzle ORM, PostGIS)
- Firebase credentials already configured in `apps/api/.env` and `apps/mobile/.env`
- GoogleService-Info.plist at `apps/mobile/GoogleService-Info.plist`
- Service account JSON at `apps/api/firebase-service-account.json`
- Firebase project ID: `urbanpulsemapping`
- iOS bundle ID: `Dev.UrbanPulseMapping-App`
- All existing features working (zones, bounties, scan flow, inspection, export, dashboard)
- pnpm ONLY. Never npm or yarn.

## CRITICAL RULES
- NativeWind `className` for ALL styling — never `StyleSheet.create`
- Photos upload direct to R2 via presigned URLs — never through API
- Don't modify existing migration files — generate new ones if needed
- Don't break existing features
- TypeScript must compile with zero errors for both apps/api and apps/mobile

---

## Feature 1: Real Firebase Auth (API side)

**What:** Replace mock auth middleware with real Firebase Admin SDK token verification. Keep mock auth as fallback when FIREBASE_PROJECT_ID is not set.

**Implementation:**
- Install `firebase-admin` in `apps/api/` if not already present
- Update `apps/api/src/middleware/auth.ts`:
  - Initialize Firebase Admin with credentials from env vars
  - When `FIREBASE_PROJECT_ID` is set: verify the Bearer token with `admin.auth().verifyIdToken(token)`
  - Extract `uid`, `email`, `name` from decoded token
  - Upsert user in DB by `firebase_uid`
  - When `FIREBASE_PROJECT_ID` is NOT set: keep existing mock auth behavior
- The API should handle both dev and prod auth seamlessly

**Verification checks:**
- [ ] `firebase-admin` in api package.json dependencies
- [ ] Auth middleware initializes Firebase Admin SDK when FIREBASE_PROJECT_ID is set
- [ ] Valid Firebase token → user created/found in DB, request proceeds
- [ ] Invalid/expired token → 401 response
- [ ] Missing Authorization header → 401 response
- [ ] Mock auth still works when FIREBASE_PROJECT_ID is unset
- [ ] User record upserted on first auth (no duplicate on repeated calls)
- [ ] `tsc --noEmit` passes for apps/api

---

## Feature 2: Real Firebase Auth (Mobile side) + Auth Screens

**What:** Build login/register screens with Email/Password + Apple Sign-In + Google Sign-In. Wire up real Firebase Auth SDK.

**Implementation:**
- Install `@react-native-firebase/app` and `@react-native-firebase/auth` in apps/mobile, OR use the JS Firebase SDK (`firebase/app`, `firebase/auth`) — pick whichever is more compatible with Expo SDK 52 dev builds
- If using React Native Firebase, the GoogleService-Info.plist is already at `apps/mobile/GoogleService-Info.plist` — configure in app.json/app.config
- If using JS SDK, initialize with env vars from `.env`
- Update `apps/mobile/lib/auth.ts` with real Firebase initialization
- Update `apps/mobile/hooks/useAuth.ts` to use real Firebase auth state listener (`onAuthStateChanged`)
- Store the Firebase ID token and send with all API requests
- Build `apps/mobile/app/(auth)/login.tsx`:
  - Urban Pulse logo at top
  - Green gradient background (primaryDark → primary from colors.ts)
  - White card with: Email field, Password field, "Sign In" button
  - Divider "OR"
  - Apple Sign-In button (dark, full-width) — only show on iOS
  - Google Sign-In button (white with Google colors, full-width)
  - "Don't have an account? Register" link → navigates to register
- Build `apps/mobile/app/(auth)/register.tsx`:
  - Same visual style as login
  - Fields: Display Name, Email, Password, Confirm Password
  - "Create Account" button
  - Same social sign-in buttons
  - "Already have an account? Sign In" link
- Update `apps/mobile/app/_layout.tsx` auth guard:
  - If not authenticated → redirect to /(auth)/login
  - If authenticated → show main app
  - Show loading spinner while checking auth state

**Verification checks:**
- [ ] Firebase packages installed and configured
- [ ] GoogleService-Info.plist referenced in app config (if using RN Firebase)
- [ ] Login screen renders with email/password fields
- [ ] Register screen renders with all fields
- [ ] Email/password registration creates Firebase user
- [ ] Email/password login works with existing Firebase user
- [ ] Apple Sign-In button present and functional (or gracefully hidden if not configured)
- [ ] Google Sign-In button present and functional
- [ ] Auth state persists across app restarts
- [ ] Logout clears auth state and redirects to login
- [ ] API requests include real Firebase ID token
- [ ] Auth guard redirects unauthenticated users to login
- [ ] Loading state while checking auth
- [ ] Error messages for invalid credentials, network errors, etc.
- [ ] "Confirm password" validation on register
- [ ] Green gradient background on auth screens
- [ ] NativeWind className only (no StyleSheet.create)
- [ ] `tsc --noEmit` passes for apps/mobile

---

## Feature 3: Tree Pin Bottom Sheet

**What:** Tapping a tree pin on the map shows a bottom sheet with tree details.

**Implementation:**
- Create `apps/mobile/components/TreeBottomSheet.tsx`
- On tree pin press, show bottom sheet with:
  - Species name (common + scientific) or "Unknown Species" if pending AI
  - Status badge (verified=green, pending=amber, cooldown=gray)
  - Observation count ("Observed X times")
  - Last observed date (relative: "3 days ago")
  - Thumbnail of most recent photo (or placeholder if no photos)
  - Cooldown timer if applicable ("Available again in X days")
  - "View Details" button (can be a no-op or navigate to a detail screen)
- Integrate into map screen (`apps/mobile/app/index.tsx`)

**Verification checks:**
- [ ] TreeBottomSheet component exists
- [ ] Tapping a tree pin opens the bottom sheet
- [ ] Species name displayed (or "Unknown Species")
- [ ] Status badge with correct color
- [ ] Observation count shown
- [ ] Last observed date shown (relative format)
- [ ] Photo thumbnail or placeholder
- [ ] Cooldown info shown for cooldown trees
- [ ] Bottom sheet dismissable (swipe down or tap outside)
- [ ] NativeWind className only
- [ ] `tsc --noEmit` passes

---

## Feature 4: Cluster Markers

**What:** When zoomed out, nearby tree pins cluster into a single marker showing the count.

**Implementation:**
- Use `react-native-map-clustering` or implement simple client-side clustering
- Cluster markers should show count badge (e.g., "42")
- Tapping a cluster zooms in to show individual pins
- Clustering threshold: zoom level based (cluster when >50 pins visible)

**Verification checks:**
- [ ] Clustering library installed or custom implementation
- [ ] Pins cluster when zoomed out
- [ ] Cluster marker shows count number
- [ ] Tapping cluster zooms into that area
- [ ] Individual pins show when zoomed in enough
- [ ] Performance acceptable with ~1000 pins
- [ ] `tsc --noEmit` passes

---

## Feature 5: Filter Icon (Status + Date Range)

**What:** Top-right filter button on map screen that opens a filter modal/sheet for filtering trees by status and date range.

**Implementation:**
- Add filter icon button in map screen header/overlay (top-right)
- On press, show a bottom sheet or modal with:
  - Status filter: checkboxes for Verified, Pending, On Cooldown, Unverified
  - Date range: "Last 7 days", "Last 30 days", "Last 90 days", "All time"
  - "Apply" and "Reset" buttons
- Pass filters to the trees API query
- Show active filter indicator (badge dot on the filter icon when filters active)

**Verification checks:**
- [ ] Filter icon visible on map screen (top-right area)
- [ ] Tapping opens filter sheet/modal
- [ ] Status checkboxes present and toggleable
- [ ] Date range options present and selectable
- [ ] "Apply" sends filters to API and refreshes map
- [ ] "Reset" clears all filters
- [ ] Active filter indicator shown when filters applied
- [ ] API accepts and respects filter params
- [ ] NativeWind className only
- [ ] `tsc --noEmit` passes

---

## Feature 6: User Avatar / Hamburger Nav

**What:** Top-left navigation element on the map screen — user avatar circle that opens a side menu or navigates to profile.

**Implementation:**
- Add user avatar (or initials fallback) in top-left of map screen
- On tap, navigate to profile/settings screen (existing profile screen)
- Show user's display name initial if no avatar URL
- Use the existing profile/developer screen as destination

**Verification checks:**
- [ ] Avatar/initials circle visible on map screen (top-left)
- [ ] Shows user's avatar image or initials
- [ ] Tapping navigates to profile screen
- [ ] Doesn't overlap with other map controls
- [ ] NativeWind className only
- [ ] `tsc --noEmit` passes

---

## Feature 7: Contribution Map on Dashboard

**What:** Small map on the dashboard showing only the current user's scanned tree locations.

**Implementation:**
- Add a map section to `apps/mobile/app/dashboard/index.tsx`
- Fetch user's observations with coordinates
- Render a small (200-250px tall) MapView with pins for the user's trees only
- Non-interactive or minimally interactive (just visual)
- Add API endpoint or query param: `GET /api/trees?userId=me` or use existing observations

**Verification checks:**
- [ ] Map section visible on dashboard screen
- [ ] Shows only the current user's scanned trees
- [ ] Map is appropriately sized (not full screen)
- [ ] Pins render at correct locations
- [ ] Handles zero trees gracefully ("Start scanning to see your trees here!")
- [ ] NativeWind className only
- [ ] `tsc --noEmit` passes

---

## Feature 8: Weekly Activity Chart on Stats

**What:** Small bar chart or sparkline in the stats section showing daily scan activity for the past week.

**Implementation:**
- Add a simple bar chart component (can use `react-native-svg` or simple View-based bars)
- Show last 7 days of scan activity (number of scans per day)
- Add API endpoint or extend `/api/users/me/stats` to include `weeklyActivity: [{date, count}]`
- Display below or alongside the "Trees Scanned" stat card

**Verification checks:**
- [ ] Activity chart/sparkline visible on dashboard
- [ ] Shows 7 bars/points for last 7 days
- [ ] API returns weekly activity data
- [ ] Days with zero scans show empty/zero bar
- [ ] Today included in the chart
- [ ] NativeWind className only
- [ ] `tsc --noEmit` passes

---

## Feature 9: Blur Detection on Photo Capture

**What:** Detect blurry photos and warn the user before accepting.

**Implementation:**
- After photo capture, analyze the image for blur using Laplacian variance or similar
- Can use a simple approach: check image sharpness via pixel analysis
- If blur detected, show warning: "This photo looks blurry. Retake?" with "Retake" and "Use Anyway" buttons
- Implement in `apps/mobile/components/PhotoCapture.tsx` or the individual scan step screens
- Note: A simple heuristic is fine — doesn't need to be perfect

**Verification checks:**
- [ ] Blur detection runs after photo capture
- [ ] Blurry photo triggers warning dialog
- [ ] "Retake" option goes back to camera
- [ ] "Use Anyway" accepts the photo
- [ ] Non-blurry photos proceed without warning
- [ ] Detection doesn't significantly delay the flow (< 1 second)
- [ ] Works with sample dev photos in simulator
- [ ] `tsc --noEmit` passes

---

## Feature 10: Compass Indicator on Angle 2

**What:** Show a compass/rotation indicator on the angle 2 capture screen suggesting the user rotate ~90° from their first photo position.

**Implementation:**
- In `apps/mobile/app/scan/angle2.tsx`, add a visual compass indicator
- Store the device heading from angle 1 capture
- On angle 2, show current heading vs recommended heading (90° offset)
- Visual: a simple compass rose or arc indicator showing "rotate this way"
- Use `expo-sensors` (Magnetometer) for device heading if available
- Fallback: just show text instruction "Rotate ~90° from your first position"

**Verification checks:**
- [ ] Compass/rotation indicator visible on angle 2 screen
- [ ] Shows recommended rotation direction
- [ ] Heading captured from angle 1 screen
- [ ] Visual is clear and intuitive
- [ ] Graceful fallback if magnetometer unavailable (text instruction)
- [ ] NativeWind className only
- [ ] `tsc --noEmit` passes

---

## Feature 11: Loading States for Zone Toggles

**What:** Show loading spinners/skeletons when switching zone view modes while data refetches.

**Implementation:**
- When user toggles between zone views (All Trees, By Zip, By Street, etc.), show a loading indicator
- Can be a small spinner overlay on the map or skeleton shimmer on the zone chips
- Loading state clears when new data arrives
- Update the zone toggle handler and tree fetching hooks

**Verification checks:**
- [ ] Loading indicator appears when switching zone views
- [ ] Loading clears when data arrives
- [ ] Map doesn't flash/jump during loading
- [ ] Works for all toggle options
- [ ] NativeWind className only
- [ ] `tsc --noEmit` passes

---

## Feature 12: Error Boundaries on Map Screens

**What:** Graceful error handling if MapView or other components fail to load.

**Implementation:**
- Create `apps/mobile/components/ErrorBoundary.tsx` (React error boundary class component)
- Wrap MapView and key components with error boundaries
- Fallback UI: "Something went wrong. Tap to retry." with a retry button
- Also handle API fetch errors gracefully in the map screen (show toast or inline error)
- Consider a top-level error boundary in `_layout.tsx`

**Verification checks:**
- [ ] ErrorBoundary component exists
- [ ] MapView wrapped in error boundary
- [ ] Fallback UI shows on error (not a crash)
- [ ] Retry button resets the error state
- [ ] API errors show user-friendly message (not raw error)
- [ ] Top-level boundary in _layout.tsx
- [ ] NativeWind className only
- [ ] `tsc --noEmit` passes

---

## Final Verification (run after all features complete)

- [ ] `cd apps/api && npx tsc --noEmit` — 0 errors
- [ ] `cd apps/mobile && npx tsc --noEmit` — 0 errors
- [ ] API starts without errors: `cd apps/api && npx tsx src/index.ts`
- [ ] All existing endpoints still work (run the test script)
- [ ] `cd apps/mobile && LANG=en_US.UTF-8 npx expo prebuild --platform ios --clean` succeeds
- [ ] `npx expo run:ios --device EE761761-0BD3-43AA-BC89-35DAE1953CE0` builds and installs
- [ ] No regressions in existing features (zones, bounties, scan flow, inspection, dashboard)
- [ ] git commit all changes with descriptive messages
