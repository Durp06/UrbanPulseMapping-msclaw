import * as Location from 'expo-location';

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function getCurrentLocation(): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number | null;
}> {
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
  };
}

export function getAccuracyLevel(
  accuracyMeters: number | null
): 'good' | 'fair' | 'poor' {
  if (accuracyMeters === null) return 'poor';
  if (accuracyMeters <= 10) return 'good';
  if (accuracyMeters <= 20) return 'fair';
  return 'poor';
}
