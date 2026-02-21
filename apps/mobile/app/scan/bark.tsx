import React from 'react';
import { router } from 'expo-router';
import { PhotoCapture } from '../../components/PhotoCapture';
import { useScanStore } from '../../lib/store';

export default function BarkScreen() {
  const addPhoto = useScanStore((s) => s.addPhoto);

  return (
    <PhotoCapture
      instruction="Move close and photograph the bark at chest height"
      tips="Hold phone 6-12 inches from the trunk. Focus on a section about 1 foot square. Include bark texture detail."
      overlayType="bark"
      onCapture={(uri) => {
        addPhoto({ uri, type: 'bark_closeup' });
        router.push('/scan/review');
      }}
      onCancel={() => router.back()}
    />
  );
}
