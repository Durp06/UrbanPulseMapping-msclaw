import React from 'react';
import { router } from 'expo-router';
import { PhotoCapture } from '../../components/PhotoCapture';
import { useScanStore } from '../../lib/store';

export default function Angle2Screen() {
  const addPhoto = useScanStore((s) => s.addPhoto);

  return (
    <PhotoCapture
      instruction="Now walk ~90° around the tree and capture from a second angle"
      tips="Walk about a quarter of the way around the tree. Capture from a different angle to provide depth information."
      overlayType="full_tree"
      onCapture={(uri) => {
        addPhoto({ uri, type: 'full_tree_angle2' });
        router.push('/scan/bark');
      }}
      onCancel={() => router.back()}
    />
  );
}
