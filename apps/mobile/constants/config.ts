export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export const MAP_DEFAULTS = {
  // Austin, TX
  latitude: 30.2672,
  longitude: -97.7431,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export const TREE_DEDUP_RADIUS_METERS = 5;
export const COOLDOWN_DAYS = 90;
export const GPS_ACCURACY_GOOD = 10; // meters
export const GPS_ACCURACY_FAIR = 20; // meters
