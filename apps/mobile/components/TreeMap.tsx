import React, { useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import MapView, { PROVIDER_DEFAULT, Region } from 'react-native-maps';
import { TreePin } from './TreePin';
import { ZoneOverlay, BountyOverlay } from './ZoneOverlay';
import { MAP_DEFAULTS } from '../constants/config';
import type { Tree, ZoneFeature } from '@urban-pulse/shared-types';

interface TreeMapProps {
  trees: Tree[];
  userLatitude: number | null;
  userLongitude: number | null;
  onRegionChange?: (region: Region) => void;
  zoneFeatures?: ZoneFeature[];
  showZones?: boolean;
  onZonePress?: (zoneId: string) => void;
  onTreePress?: (tree: Tree) => void;
  zoneViewActive?: boolean;
  bounties?: Array<{ id: string; geometry: any; bountyAmountCents: number }>;
  showBounties?: boolean;
  onBountyPress?: (bountyId: string) => void;
}

export function TreeMap({
  trees,
  userLatitude,
  userLongitude,
  onRegionChange,
  zoneFeatures = [],
  showZones = false,
  onZonePress,
  onTreePress,
  zoneViewActive = false,
  bounties = [],
  showBounties = false,
  onBountyPress,
}: TreeMapProps) {
  const mapRef = useRef<MapView>(null);

  const initialRegion = {
    latitude: userLatitude || MAP_DEFAULTS.latitude,
    longitude: userLongitude || MAP_DEFAULTS.longitude,
    latitudeDelta: MAP_DEFAULTS.latitudeDelta,
    longitudeDelta: MAP_DEFAULTS.longitudeDelta,
  };

  return (
    <View className="flex-1">
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={PROVIDER_DEFAULT}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton
        onRegionChangeComplete={onRegionChange}
        onPress={() => {
          onTreePress?.(null as unknown as Tree);
          onZonePress?.('');
        }}
      >
        {showZones && zoneFeatures.length > 0 && (
          <ZoneOverlay features={zoneFeatures} onZonePress={onZonePress} />
        )}
        {showBounties && bounties.length > 0 && (
          <BountyOverlay bounties={bounties} onBountyPress={onBountyPress} />
        )}
        {trees.map((tree) => (
          <TreePin
            key={tree.id}
            tree={tree}
            onPress={onTreePress || (() => {})}
            zoneViewActive={zoneViewActive}
          />
        ))}
      </MapView>
    </View>
  );
}
