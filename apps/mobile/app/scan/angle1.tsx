import React, { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { Magnetometer } from 'expo-sensors';
import { PhotoCapture } from '../../components/PhotoCapture';
import { useScanStore } from '../../lib/store';

export default function Angle1Screen() {
  const addPhoto = useScanStore((s) => s.addPhoto);
  const setAngle1Heading = useScanStore((s) => s.setAngle1Heading);
  const [currentHeading, setCurrentHeading] = useState<number | null>(null);

  useEffect(() => {
    let subscription: { remove: () => void } | null = null;

    const start = async () => {
      try {
        const isAvailable = await Magnetometer.isAvailableAsync();
        if (!isAvailable) return;

        Magnetometer.setUpdateInterval(300);
        subscription = Magnetometer.addListener((data) => {
          const { x, y } = data;
          let angle = Math.atan2(y, x) * (180 / Math.PI);
          angle = ((angle % 360) + 360) % 360;
          setCurrentHeading(angle);
        });
      } catch {
        // Magnetometer not available — that's fine
      }
    };

    start();

    return () => {
      subscription?.remove();
    };
  }, []);

  return (
    <PhotoCapture
      instruction="Stand back and capture the full tree — Angle 1"
      tips="Stand 10-20 feet back. Include the full tree from ground to top of crown. Hold phone vertically."
      overlayType="full_tree"
      onCapture={(uri) => {
        addPhoto({ uri, type: 'full_tree_angle1' });
        // Save heading at capture time for compass indicator on angle 2
        setAngle1Heading(currentHeading);
        router.push('/scan/angle2');
      }}
      onCancel={() => router.back()}
    />
  );
}
