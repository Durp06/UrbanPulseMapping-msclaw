import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { PhotoCapture } from '../../components/PhotoCapture';
import { CompassIndicator } from '../../components/CompassIndicator';
import { useScanStore } from '../../lib/store';

export default function Angle2Screen() {
  const addPhoto = useScanStore((s) => s.addPhoto);
  const angle1Heading = useScanStore((s) => s.angle1Heading);

  return (
    <View className="flex-1">
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
      {/* Feature 10: Compass indicator overlay */}
      <View className="absolute top-28 left-4 right-4 z-10">
        <CompassIndicator targetHeading={angle1Heading} />
      </View>
    </View>
  );
}
