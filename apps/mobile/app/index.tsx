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
import { BountyBottomSheet } from '../components/BountyBottomSheet';
import { useLocation } from '../hooks/useLocation';
import { useTrees } from '../hooks/useTrees';
import { useContractZones } from '../hooks/useContractZones';
import { useBounties } from '../hooks/useBounties';
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
  const [selectedBountyId, setSelectedBountyId] = useState<string | null>(null);
  const [selectedTree, setSelectedTree] = useState<Tree | null>(null);

  const queryLat = mapCenter?.lat ?? location.latitude ?? MAP_DEFAULTS.latitude;
  const queryLng = mapCenter?.lng ?? location.longitude ?? MAP_DEFAULTS.longitude;

  // Determine zone filters for trees query
  const treeZoneId = useMemo(() => {
    if (zoneViewMode === 'all' || zoneViewMode === 'bounties') return undefined;
    if (selectedZoneId) return selectedZoneId;
    return undefined;
  }, [zoneViewMode, selectedZoneId]);

  const treeZoneType = useMemo(() => {
    if (zoneViewMode === 'all' || zoneViewMode === 'bounties') return undefined;
    if (selectedZoneId) return undefined; // specific zone takes precedence
    if (zoneViewMode === 'zip_code') return 'zip_code';
    if (zoneViewMode === 'street_corridor') return 'street_corridor';
    if (zoneViewMode === 'active') return undefined; // active uses status filter on zones, not type
    return undefined;
  }, [zoneViewMode, selectedZoneId]);

  const { data: treesData } = useTrees(queryLat, queryLng, 1000, treeZoneId, treeZoneType);
  const { data: zonesData } = useContractZones(
    zoneViewMode === 'active' ? { status: 'active' } : undefined
  );
  const { data: bountiesData } = useBounties();

  const handleRegionChange = (region: Region) => {
    setMapCenter({ lat: region.latitude, lng: region.longitude });
  };

  const showZones = zoneViewMode !== 'all' && zoneViewMode !== 'bounties';
  const showBounties = zoneViewMode === 'bounties';

  // Filter zone features by view mode
  const filteredFeatures = useMemo(() => {
    if (!zonesData?.features) return [];
    if (zoneViewMode === 'all' || zoneViewMode === 'bounties') return [];
    if (zoneViewMode === 'active') {
      return zonesData.features.filter(
        (f: any) => f.properties.status === 'active'
      );
    }
    return zonesData.features.filter(
      (f: any) => f.properties.zoneType === zoneViewMode
    );
  }, [zonesData, zoneViewMode]);

  // For zone view active modes, get list of visible zone IDs for filtering
  const visibleZoneIds = useMemo(() => {
    if (!showZones) return new Set<string>();
    return new Set(filteredFeatures.map((f: any) => f.properties.id));
  }, [showZones, filteredFeatures]);

  // Filter trees to only those in visible zones when zone view is active
  const filteredTrees = useMemo(() => {
    const allTrees = treesData?.trees || [];
    if (!showZones || visibleZoneIds.size === 0) return allTrees;
    // If a specific zone is selected, server already filters
    if (treeZoneId) return allTrees;
    // For "active" mode, filter client-side to only trees in active zones
    if (zoneViewMode === 'active') {
      return allTrees.filter(
        (t: any) => t.contractZoneId && visibleZoneIds.has(t.contractZoneId)
      );
    }
    return allTrees;
  }, [treesData, showZones, visibleZoneIds, treeZoneId, zoneViewMode]);

  // Bounties with geometry for map overlay
  const bountyOverlays = useMemo(() => {
    if (!bountiesData?.bounties) return [];
    return bountiesData.bounties
      .filter((b: any) => b.geometry)
      .map((b: any) => ({
        id: b.id,
        geometry: b.geometry,
        bountyAmountCents: b.bountyAmountCents,
      }));
  }, [bountiesData]);

  // Bounty chips for selection
  const bountyChips = useMemo(() => {
    if (!bountiesData?.bounties) return [];
    return bountiesData.bounties.map((b: any) => ({
      id: b.id,
      displayName: `$${(b.bountyAmountCents / 100).toFixed(2)}/tree - ${b.title}`,
      status: 'active' as ZoneStatus,
      treesMappedCount: b.treesCompleted,
    }));
  }, [bountiesData]);

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

  // Selected bounty for bottom sheet
  const selectedBounty = useMemo(() => {
    if (!selectedBountyId || !bountiesData?.bounties) return null;
    return bountiesData.bounties.find((b: any) => b.id === selectedBountyId) || null;
  }, [selectedBountyId, bountiesData]);

  // Find active zone the user is currently in
  const activeUserZone = useMemo(() => {
    if (!location.latitude || !location.longitude || !zonesData?.features) return null;
    for (const feature of zonesData.features as any[]) {
      if (feature.properties.status !== 'active') continue;
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
      setSelectedBountyId(null);
      return;
    }
    setSelectedTree(null);
    setSelectedBountyId(null);
    setSelectedZoneId(zoneId);
  };

  const handleBountyPress = (bountyId: string) => {
    setSelectedTree(null);
    setSelectedZoneId(null);
    setSelectedBountyId(bountyId);
  };

  const handleTreePress = (tree: Tree) => {
    if (!tree) {
      setSelectedTree(null);
      return;
    }
    setSelectedZoneId(null);
    setSelectedBountyId(null);
    setSelectedTree(tree);
  };

  const handleModeChange = (mode: ZoneViewMode) => {
    setZoneViewMode(mode);
    setSelectedZoneId(null);
    setSelectedBountyId(null);
    setSelectedTree(null);
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
          <ZoneToggle selected={zoneViewMode} onChange={handleModeChange} />
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

        {/* Bounty chips */}
        {showBounties && bountyChips.length > 0 && (
          <View className="mt-2">
            <ZoneChipSelector
              zones={bountyChips}
              selectedId={selectedBountyId}
              onSelect={setSelectedBountyId}
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
        trees={filteredTrees}
        userLatitude={location.latitude}
        userLongitude={location.longitude}
        onRegionChange={handleRegionChange}
        zoneFeatures={filteredFeatures}
        showZones={showZones}
        onZonePress={handleZonePress}
        onTreePress={handleTreePress}
        zoneViewActive={showZones}
        bounties={bountyOverlays}
        showBounties={showBounties}
        onBountyPress={handleBountyPress}
      />

      {/* Selected tree bottom sheet */}
      {selectedTree && !selectedZoneId && !selectedBountyId && (
        <View className="absolute bottom-24 left-4 right-4 bg-white rounded-2xl p-4 shadow-lg">
          <View className="flex-row justify-between items-start">
            <View className="flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="text-lg font-bold text-gray-900">
                  {selectedTree.speciesCommon || 'Unknown Species'}
                </Text>
                {selectedTree.conditionRating && (
                  <View
                    className="px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor:
                        selectedTree.conditionRating === 'good' ? '#D1FAE5' :
                        selectedTree.conditionRating === 'fair' ? '#FEF3C7' :
                        selectedTree.conditionRating === 'poor' ? '#FED7AA' :
                        '#FECACA',
                    }}
                  >
                    <Text
                      className="text-xs font-semibold capitalize"
                      style={{
                        color:
                          selectedTree.conditionRating === 'good' ? '#065F46' :
                          selectedTree.conditionRating === 'fair' ? '#92400E' :
                          selectedTree.conditionRating === 'poor' ? '#C2410C' :
                          '#991B1B',
                      }}
                    >
                      {selectedTree.conditionRating}
                    </Text>
                  </View>
                )}
              </View>
              {selectedTree.speciesScientific && (
                <Text className="text-sm italic text-gray-500">
                  {selectedTree.speciesScientific}
                </Text>
              )}
              {selectedTree.nearestAddress && (
                <Text className="text-xs text-gray-400 mt-0.5">
                  {selectedTree.nearestAddress}
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

          {/* Flags row */}
          {(selectedTree.riskFlag || selectedTree.maintenanceFlag || selectedTree.trunkDefects) && (
            <View className="flex-row flex-wrap gap-1.5 mt-2">
              {selectedTree.riskFlag && (
                <View className="bg-red-100 px-2 py-0.5 rounded-full">
                  <Text className="text-xs font-medium text-red-700">Risk Flag</Text>
                </View>
              )}
              {selectedTree.maintenanceFlag && selectedTree.maintenanceFlag !== 'none' && (
                <View className="bg-amber-100 px-2 py-0.5 rounded-full">
                  <Text className="text-xs font-medium text-amber-700">
                    {selectedTree.maintenanceFlag === 'prune' ? 'Needs Pruning' : 'Needs Removal'}
                  </Text>
                </View>
              )}
              {selectedTree.trunkDefects && typeof selectedTree.trunkDefects === 'object' && (
                <>
                  {(selectedTree.trunkDefects as any).cavity && (
                    <View className="bg-orange-100 px-2 py-0.5 rounded-full">
                      <Text className="text-xs font-medium text-orange-700">Cavity</Text>
                    </View>
                  )}
                  {(selectedTree.trunkDefects as any).crack && (
                    <View className="bg-orange-100 px-2 py-0.5 rounded-full">
                      <Text className="text-xs font-medium text-orange-700">Crack</Text>
                    </View>
                  )}
                  {(selectedTree.trunkDefects as any).lean && (
                    <View className="bg-orange-100 px-2 py-0.5 rounded-full">
                      <Text className="text-xs font-medium text-orange-700">Lean</Text>
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {/* Stats row */}
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

          {/* AI estimates row */}
          <View className="flex-row mt-3 gap-4 border-t border-gray-100 pt-3">
            <View>
              <Text className="text-xs text-gray-500">DBH</Text>
              <Text className="text-sm font-semibold">
                {selectedTree.estimatedDbhCm
                  ? `${selectedTree.estimatedDbhCm.toFixed(1)} cm`
                  : 'Pending'}
              </Text>
            </View>
            <View>
              <Text className="text-xs text-gray-500">Height</Text>
              <Text className="text-sm font-semibold">
                {(selectedTree.heightEstimateM || selectedTree.estimatedHeightM)
                  ? `${(selectedTree.heightEstimateM || selectedTree.estimatedHeightM)!.toFixed(1)} m`
                  : 'Pending'}
              </Text>
            </View>
            <View>
              <Text className="text-xs text-gray-500">Canopy</Text>
              <Text className="text-sm font-semibold">
                {selectedTree.canopySpreadM
                  ? `${selectedTree.canopySpreadM.toFixed(1)} m`
                  : 'Pending'}
              </Text>
            </View>
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

      {/* Selected bounty bottom sheet */}
      {selectedBounty && (
        <BountyBottomSheet
          bounty={selectedBounty}
          onClose={() => setSelectedBountyId(null)}
        />
      )}

      {/* Scan FAB */}
      <ScanButton />

      {/* Bottom tab bar */}
      <SafeAreaView edges={['bottom']} className="bg-white border-t border-gray-100">
        <View className="flex-row items-center justify-around py-2">
          <Pressable className="items-center py-1 px-3">
            <Text className="text-xl">🗺</Text>
            <Text
              className="text-xs font-medium mt-0.5"
              style={{ color: colors.primary }}
            >
              Map
            </Text>
          </Pressable>
          <Pressable
            className="items-center py-1 px-3"
            onPress={() => router.push('/dashboard')}
          >
            <Text className="text-xl">📊</Text>
            <Text className="text-xs font-medium text-gray-400 mt-0.5">
              Dashboard
            </Text>
          </Pressable>
          <Pressable
            className="items-center py-1 px-3"
            onPress={() => router.push('/bounties')}
          >
            <Text className="text-xl">💰</Text>
            <Text className="text-xs font-medium text-gray-400 mt-0.5">
              Bounties
            </Text>
          </Pressable>
          <Pressable
            className="items-center py-1 px-3"
            onPress={() => router.push('/profile')}
          >
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
