import React from 'react';
import { View, Text } from 'react-native';
import { Marker } from 'react-native-maps';
import { colors } from '../constants/colors';
import type { Tree } from '@urban-pulse/shared-types';

interface TreePinProps {
  tree: Tree;
  onPress: (tree: Tree) => void;
  zoneViewActive?: boolean;
}

function getPinColor(tree: Tree, zoneViewActive: boolean): string {
  if (tree.cooldownUntil && new Date(tree.cooldownUntil) > new Date()) {
    return colors.pinCooldown;
  }

  // When zone view is active, color by zone assignment
  if (zoneViewActive) {
    if (tree.contractZoneId) {
      return colors.primary; // In a zone
    }
    return colors.cooldown; // Not in any zone
  }

  if (tree.verificationTier === 'unverified') {
    return colors.pinPending;
  }
  return colors.pinVerified;
}

export function TreePin({ tree, onPress, zoneViewActive = false }: TreePinProps) {
  const pinColor = getPinColor(tree, zoneViewActive);

  return (
    <Marker
      coordinate={{
        latitude: tree.latitude,
        longitude: tree.longitude,
      }}
      onPress={() => onPress(tree)}
      tracksViewChanges={false}
    >
      <View style={{ alignItems: 'center' }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 2,
            borderColor: '#fff',
            backgroundColor: pinColor,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
            {tree.observationCount}
          </Text>
        </View>
        <View
          style={{
            width: 8,
            height: 8,
            backgroundColor: pinColor,
            transform: [{ rotate: '45deg' }],
            marginTop: -4,
          }}
        />
      </View>
    </Marker>
  );
}
