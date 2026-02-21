import React, { useState, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TreeMap } from '../components/TreeMap';
import { ScanButton } from '../components/ScanButton';
import { ZoneToggle, type ZoneViewMode } from '../components/ZoneToggle';
import { ZoneChipSelector } from '../components/ZoneChipSelector';
import { ZoneBottomSheet } from '../components/ZoneBottomSheet';
import { ActiveZoneBanner } from '../components/ActiveZoneBanner';
import { useLocation } from '../hooks/useLocation';
import { useTrees } from '../hooks/useTrees';
import { useContractZones } from '../hooks/useContractZones';
import { useAuth } from '../hooks/useAuth';
import { colors } from '../constants/colors';
import { MAP_DEFAULTS } from '../constants/config';
import type { Region } from 'react-native-maps';
import type { Tree, ZoneStatus } from '@urban-pulse/shared-types';

export default function MapScreen() {
  const { user } = useAuth();
  const location = useLocation();
  const [mapCenter, setMapCenter] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [zoneViewMode, setZoneViewMode] = useState<ZoneViewMode>('all');
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedTree, setSelectedTree] = useState<Tree | null>(null);

  const queryLat = mapCenter?.lat ?? location.latitude ?? MAP_DEFAULTS.latitude;
  const queryLng = mapCenter?.lng ?? location.longitude ?? MAP_DEFAULTS.longitude;

  const { data: treesData } = useTrees(queryLat, queryLng, 1000);
  const { data: zonesData } = useContractZones(
    zoneViewMode === 'active' ? { status: 'active' } : undefined
  );

  const handleRegionChange = (region: Region) => {
    setMapCenter({ lat: region.latitude, lng: region.longitude });
  };

  const showZones = zoneViewMode !== 'all';

  // Filter zone features by view mode
  const filteredFeatures = useMemo(() => {
    if (!zonesData?.features) return [];
    if (zoneViewMode === 'all') return [];
    if (zoneViewMode === 'active') {
      return zonesData.features.filter(
        (f: any) => f.properties.status === 'active'
      );
    }
    return zonesData.features.filter(
      (f: any) => f.properties.zoneType === zoneViewMode
    );
  }, [zonesData, zoneViewMode]);

  // Chips for zone selection
  const zoneChips = useMemo(() => {
    if (!filteredFeatures.length) return [];
    return filteredFeatures.map((f: any) => ({
      id: f.properties.id,
      displayName: f.properties.displayName,
      status: f.properties.status as ZoneStatus,
      treesMappedCount: f.properties.treesMappedCount,
    }));
  }, [filteredFeatures]);

  // Selected zone detail for bottom sheet
  const selectedZone = useMemo(() => {
    if (!selectedZoneId || !zonesData?.features) return null;
    const feature = zonesData.features.find(
      (f: any) => f.properties.id === selectedZoneId
    );
    if (!feature) return null;
    return (feature as any).properties;
  }, [selectedZoneId, zonesData]);

  // Find active zone the user is currently in
  const activeUserZone = useMemo(() => {
    if (!location.latitude || !location.longitude || !zonesData?.features) return null;
    // Simple point-in-bbox check for zones
    for (const feature of zonesData.features as any[]) {
      if (feature.properties.status !== 'active') continue;
      // For simplicity, we check if user is roughly inside zone bounds
      // Real check would be point-in-polygon, but bbox is good enough for UX
      if (feature.geometry?.coordinates) {
        try {
          const coords = feature.geometry.type === 'MultiPolygon'
            ? feature.geometry.coordinates[0][0]
            : feature.geometry.coordinates[0];
          const lngs = coords.map((c: number[]) => c[0]);
          const lats = coords.map((c: number[]) => c[1]);
          const minLng = Math.min(...lngs);
          const maxLng = Math.max(...lngs);
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);
          if (
            location.longitude >= minLng &&
            location.longitude <= maxLng &&
            location.latitude >= minLat &&
            location.latitude <= maxLat
          ) {
            return feature.properties;
          }
        } catch {
          continue;
        }
      }
    }
    return null;
  }, [location.latitude, location.longitude, zonesData]);

  const handleZonePress = (zoneId: string) => {
    if (zoneId === '') {
      setSelectedZoneId(null);
      return;
    }
    setSelectedTree(null);
    setSelectedZoneId(zoneId);
  };

  const handleTreePress = (tree: Tree) => {
    if (!tree) {
      setSelectedTree(null);
      return;
    }
    setSelectedZoneId(null);
    setSelectedTree(tree);
  };

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <SafeAreaView edges={['top']} className="absolute top-0 left-0 right-0 z-10">
        <View className="flex-row items-center justify-between px-4 py-2">
          <Pressable
            className="w-10 h-10 rounded-full bg-white shadow items-center justify-center"
            onPress={() => router.push('/dashboard')}
          >
            <Text className="text-lg">
              {user?.displayName?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </Pressable>
          {location.loading && (
            <View className="bg-white/90 px-3 py-1.5 rounded-full shadow-sm">
              <Text className="text-xs text-gray-500">Locating...</Text>
            </View>
          )}
        </View>

        {/* Zone toggle */}
        <View className="mt-1">
          <ZoneToggle selected={zoneViewMode} onChange={setZoneViewMode} />
        </View>

        {/* Zone chips */}
        {showZones && zoneChips.length > 0 && (
          <View className="mt-2">
            <ZoneChipSelector
              zones={zoneChips}
              selectedId={selectedZoneId}
              onSelect={setSelectedZoneId}
            />
          </View>
        )}

        {/* Active zone banner */}
        {activeUserZone && zoneViewMode === 'all' && (
          <View className="mt-2">
            <ActiveZoneBanner
              zoneName={activeUserZone.displayName}
              progressPercentage={activeUserZone.progressPercentage}
              treesMappedCount={activeUserZone.treesMappedCount}
              treeTargetCount={activeUserZone.treeTargetCount}
            />
          </View>
        )}
      </SafeAreaView>

      {/* Map */}
      <TreeMap
        trees={treesData?.trees || []}
        userLatitude={location.latitude}
        userLongitude={location.longitude}
        onRegionChange={handleRegionChange}
        zoneFeatures={filteredFeatures}
        showZones={showZones}
        onZonePress={handleZonePress}
        onTreePress={handleTreePress}
        zoneViewActive={showZones}
      />

      {/* Selected tree bottom sheet */}
      {selectedTree && !selectedZoneId && (
        <View className="absolute bottom-24 left-4 right-4 bg-white rounded-2xl p-4 shadow-lg">
          <View className="flex-row justify-between items-start">
            <View className="flex-1">
              <Text className="text-lg font-bold text-gray-900">
                {selectedTree.speciesCommon || 'Unknown Species'}
              </Text>
              {selectedTree.speciesScientific && (
                <Text className="text-sm italic text-gray-500">
                  {selectedTree.speciesScientific}
                </Text>
              )}
            </View>
            <Pressable
              className="w-7 h-7 rounded-full bg-gray-100 items-center justify-center"
              onPress={() => setSelectedTree(null)}
            >
              <Text className="text-xs text-gray-500">✕</Text>
            </Pressable>
          </View>
          <View className="flex-row mt-3 gap-4">
            <View>
              <Text className="text-xs text-gray-500">Observations</Text>
              <Text className="text-sm font-semibold">
                {selectedTree.observationCount}
              </Text>
            </View>
            <View>
              <Text className="text-xs text-gray-500">Observers</Text>
              <Text className="text-sm font-semibold">
                {selectedTree.uniqueObserverCount}
              </Text>
            </View>
            {selectedTree.lastObservedAt && (
              <View>
                <Text className="text-xs text-gray-500">Last Seen</Text>
                <Text className="text-sm font-semibold">
                  {new Date(selectedTree.lastObservedAt).toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Selected zone bottom sheet */}
      {selectedZone && (
        <ZoneBottomSheet
          zone={selectedZone}
          onClose={() => setSelectedZoneId(null)}
        />
      )}

      {/* Scan FAB */}
      <ScanButton />

      {/* Bottom tab bar */}
      <SafeAreaView edges={['bottom']} className="bg-white border-t border-gray-100">
        <View className="flex-row items-center justify-around py-2">
          <Pressable className="items-center py-1 px-4">
            <Text className="text-xl">🗺</Text>
            <Text
              className="text-xs font-medium mt-0.5"
              style={{ color: colors.primary }}
            >
              Map
            </Text>
          </Pressable>
          <Pressable
            className="items-center py-1 px-4"
            onPress={() => router.push('/dashboard')}
          >
            <Text className="text-xl">📊</Text>
            <Text className="text-xs font-medium text-gray-400 mt-0.5">
              Dashboard
            </Text>
          </Pressable>
          <Pressable className="items-center py-1 px-4">
            <Text className="text-xl">👤</Text>
            <Text className="text-xs font-medium text-gray-400 mt-0.5">
              Profile
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
