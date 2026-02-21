import React from 'react';
import { router } from 'expo-router';
import { PhotoCapture } from '../../components/PhotoCapture';
import { useScanStore } from '../../lib/store';

export default function Angle1Screen() {
  const addPhoto = useScanStore((s) => s.addPhoto);

  return (
    <PhotoCapture
      instruction="Stand back and capture the full tree — Angle 1"
      tips="Stand 10-20 feet back. Include the full tree from ground to top of crown. Hold phone vertically."
      overlayType="full_tree"
      onCapture={(uri) => {
        addPhoto({ uri, type: 'full_tree_angle1' });
        router.push('/scan/angle2');
      }}
      onCancel={() => router.back()}
    />
  );
}
