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
