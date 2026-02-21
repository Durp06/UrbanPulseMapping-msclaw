import { useState, useEffect } from 'react';
import { requestLocationPermission, getCurrentLocation, getAccuracyLevel } from '../lib/location';

interface LocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  accuracyLevel: 'good' | 'fair' | 'poor';
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useLocation(): LocationState {
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLocation = async () => {
    setLoading(true);
    setError(null);

    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        setError('Location permission denied');
        setLoading(false);
        return;
      }

      const location = await getCurrentLocation();
      setLatitude(location.latitude);
      setLongitude(location.longitude);
      setAccuracy(location.accuracy);
    } catch (err: any) {
      setError(err.message || 'Failed to get location');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocation();
  }, []);

  return {
    latitude,
    longitude,
    accuracy,
    accuracyLevel: getAccuracyLevel(accuracy),
    loading,
    error,
    refresh: fetchLocation,
  };
}
