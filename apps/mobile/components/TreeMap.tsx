import React, { useRef, useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import MapView, { PROVIDER_DEFAULT, Marker, type Region } from 'react-native-maps';
import { TreePin } from './TreePin';
import { ZoneOverlay, BountyOverlay } from './ZoneOverlay';
import { MAP_DEFAULTS } from '../constants/config';
import { colors } from '../constants/colors';
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

function clusterTrees(trees: Tree[], region: Region | null) {
  if (!region || trees.length < 50) return { clusters: [], singles: trees };
  const cellSize = region.latitudeDelta / 10;
  const grid: Record<string, { trees: Tree[]; lat: number; lng: number }> = {};
  for (const tree of trees) {
    const key = `${Math.floor(tree.latitude / cellSize)}_${Math.floor(tree.longitude / cellSize)}`;
    if (!grid[key]) grid[key] = { trees: [], lat: 0, lng: 0 };
    grid[key].trees.push(tree);
    grid[key].lat += tree.latitude;
    grid[key].lng += tree.longitude;
  }
  const clusters: Array<{ id: string; latitude: number; longitude: number; count: number }> = [];
  const singles: Tree[] = [];
  for (const [key, cell] of Object.entries(grid)) {
    if (cell.trees.length >= 3) {
      clusters.push({
        id: `cluster_${key}`,
        latitude: cell.lat / cell.trees.length,
        longitude: cell.lng / cell.trees.length,
        count: cell.trees.length,
      });
    } else {
      singles.push(...cell.trees);
    }
  }
  return { clusters, singles };
}

export function TreeMap({
  trees, userLatitude, userLongitude, onRegionChange,
  zoneFeatures = [], showZones = false, onZonePress, onTreePress,
  zoneViewActive = false, bounties = [], showBounties = false, onBountyPress,
}: TreeMapProps) {
  const mapRef = useRef<MapView>(null);
  const [currentRegion, setCurrentRegion] = React.useState<Region | null>(null);

  const initialRegion = {
    latitude: userLatitude || MAP_DEFAULTS.latitude,
    longitude: userLongitude || MAP_DEFAULTS.longitude,
    latitudeDelta: MAP_DEFAULTS.latitudeDelta,
    longitudeDelta: MAP_DEFAULTS.longitudeDelta,
  };

  const { clusters, singles } = useMemo(
    () => clusterTrees(trees, currentRegion),
    [trees, currentRegion]
  );

  const handleRegionChange = (region: Region) => {
    setCurrentRegion(region);
    onRegionChange?.(region);
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
        onRegionChangeComplete={handleRegionChange}
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
        {clusters.map((cluster) => (
          <Marker
            key={cluster.id}
            coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
            onPress={() => {
              mapRef.current?.animateToRegion({
                latitude: cluster.latitude,
                longitude: cluster.longitude,
                latitudeDelta: (currentRegion?.latitudeDelta || 0.05) / 3,
                longitudeDelta: (currentRegion?.longitudeDelta || 0.05) / 3,
              }, 300);
            }}
          >
            <View style={{
              backgroundColor: colors.primary,
              borderRadius: 20,
              width: 40,
              height: 40,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: '#fff',
            }}>
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>
                {cluster.count}
              </Text>
            </View>
          </Marker>
        ))}
        {singles.map((tree) => (
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
