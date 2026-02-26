import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { router, Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TreeMap } from '../components/TreeMap';
import { ScanButton } from '../components/ScanButton';
import { ZoneToggle, type ZoneViewMode } from '../components/ZoneToggle';
import { ZoneChipSelector } from '../components/ZoneChipSelector';
import { ZoneBottomSheet } from '../components/ZoneBottomSheet';
import { ActiveZoneBanner } from '../components/ActiveZoneBanner';
import { BountyBottomSheet } from '../components/BountyBottomSheet';
import { TreeBottomSheet } from '../components/TreeBottomSheet';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useLocation } from '../hooks/useLocation';
import { useTrees } from '../hooks/useTrees';
import { useContractZones } from '../hooks/useContractZones';
import { useBounties } from '../hooks/useBounties';
import { useAuth } from '../hooks/useAuth';
import { colors } from '../constants/colors';
import { MAP_DEFAULTS } from '../constants/config';
import type { Region } from 'react-native-maps';
import type { Tree, ZoneStatus } from '@urban-pulse/shared-types';

// Filter types
interface Filters {
  statuses: Set<string>;
  dateRange: 'all' | '7d' | '30d' | '90d';
}

const DEFAULT_FILTERS: Filters = {
  statuses: new Set(),
  dateRange: 'all',
};

function hasActiveFilters(filters: Filters): boolean {
  return filters.statuses.size > 0 || filters.dateRange !== 'all';
}

export default function MapScreen() {
  const { user, isAuthenticated } = useAuth();

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }
  const location = useLocation();
  const [mapCenter, setMapCenter] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [zoneViewMode, setZoneViewMode] = useState<ZoneViewMode>('all');
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedBountyId, setSelectedBountyId] = useState<string | null>(null);
  const [selectedTree, setSelectedTree] = useState<Tree | null>(null);
  const [isLoadingZoneSwitch, setIsLoadingZoneSwitch] = useState(false);

  // Feature 5: Filter state
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [tempFilters, setTempFilters] = useState<Filters>(DEFAULT_FILTERS);

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
    if (selectedZoneId) return undefined;
    if (zoneViewMode === 'zip_code') return 'zip_code';
    if (zoneViewMode === 'street_corridor') return 'street_corridor';
    return undefined;
  }, [zoneViewMode, selectedZoneId]);

  const { data: treesData, isFetching: isFetchingTrees } = useTrees(
    queryLat,
    queryLng,
    1000,
    treeZoneId,
    treeZoneType
  );
  const { data: zonesData } = useContractZones(
    zoneViewMode === 'active' ? { status: 'active' } : undefined
  );
  const { data: bountiesData } = useBounties();

  const handleRegionChange = useCallback((region: Region) => {
    setMapCenter({ lat: region.latitude, lng: region.longitude });
  }, []);

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

  const visibleZoneIds = useMemo(() => {
    if (!showZones) return new Set<string>();
    return new Set(filteredFeatures.map((f: any) => f.properties.id));
  }, [showZones, filteredFeatures]);

  // Apply client-side filters (Feature 5)
  const filteredTrees = useMemo(() => {
    let allTrees = treesData?.trees || [];

    // Zone-based filtering
    if (showZones && visibleZoneIds.size > 0 && !treeZoneId) {
      if (zoneViewMode === 'active') {
        allTrees = allTrees.filter(
          (t: any) => t.contractZoneId && visibleZoneIds.has(t.contractZoneId)
        );
      }
    }

    // Status filter
    if (filters.statuses.size > 0) {
      allTrees = allTrees.filter((t: Tree) => {
        const now = new Date();
        const isOnCooldown =
          t.cooldownUntil && new Date(t.cooldownUntil) > now;
        const isVerified =
          t.verificationTier !== 'unverified';
        const isPending = t.verificationTier === 'unverified' && !isOnCooldown;

        if (filters.statuses.has('verified') && isVerified) return true;
        if (filters.statuses.has('pending') && isPending) return true;
        if (filters.statuses.has('cooldown') && isOnCooldown) return true;
        if (filters.statuses.has('unverified') && t.verificationTier === 'unverified')
          return true;
        return false;
      });
    }

    // Date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
      const days = daysMap[filters.dateRange];
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      allTrees = allTrees.filter((t: Tree) => {
        if (!t.lastObservedAt) return false;
        return new Date(t.lastObservedAt) >= cutoff;
      });
    }

    return allTrees;
  }, [
    treesData,
    showZones,
    visibleZoneIds,
    treeZoneId,
    zoneViewMode,
    filters,
  ]);

  // Bounties
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

  const bountyChips = useMemo(() => {
    if (!bountiesData?.bounties) return [];
    return bountiesData.bounties.map((b: any) => ({
      id: b.id,
      displayName: `$${(b.bountyAmountCents / 100).toFixed(2)}/tree - ${b.title}`,
      status: 'active' as ZoneStatus,
      treesMappedCount: b.treesCompleted,
    }));
  }, [bountiesData]);

  const zoneChips = useMemo(() => {
    if (!filteredFeatures.length) return [];
    return filteredFeatures.map((f: any) => ({
      id: f.properties.id,
      displayName: f.properties.displayName,
      status: f.properties.status as ZoneStatus,
      treesMappedCount: f.properties.treesMappedCount,
    }));
  }, [filteredFeatures]);

  const selectedZone = useMemo(() => {
    if (!selectedZoneId || !zonesData?.features) return null;
    const feature = zonesData.features.find(
      (f: any) => f.properties.id === selectedZoneId
    );
    if (!feature) return null;
    return (feature as any).properties;
  }, [selectedZoneId, zonesData]);

  const selectedBounty = useMemo(() => {
    if (!selectedBountyId || !bountiesData?.bounties) return null;
    return (
      bountiesData.bounties.find((b: any) => b.id === selectedBountyId) || null
    );
  }, [selectedBountyId, bountiesData]);

  // Active zone user is in
  const activeUserZone = useMemo(() => {
    if (!location.latitude || !location.longitude || !zonesData?.features)
      return null;
    for (const feature of zonesData.features as any[]) {
      if (feature.properties.status !== 'active') continue;
      if (feature.geometry?.coordinates) {
        try {
          const coords =
            feature.geometry.type === 'MultiPolygon'
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
    setIsLoadingZoneSwitch(true);
    setZoneViewMode(mode);
    setSelectedZoneId(null);
    setSelectedBountyId(null);
    setSelectedTree(null);
    // Clear loading after a short delay to allow data to arrive
    setTimeout(() => setIsLoadingZoneSwitch(false), 600);
  };

  // Filter modal handlers
  const openFilterModal = () => {
    setTempFilters({ ...filters, statuses: new Set(filters.statuses) });
    setShowFilterModal(true);
  };

  const toggleTempStatus = (status: string) => {
    setTempFilters((prev) => {
      const newStatuses = new Set(prev.statuses);
      if (newStatuses.has(status)) {
        newStatuses.delete(status);
      } else {
        newStatuses.add(status);
      }
      return { ...prev, statuses: newStatuses };
    });
  };

  const applyFilters = () => {
    setFilters(tempFilters);
    setShowFilterModal(false);
  };

  const resetFilters = () => {
    const reset = { statuses: new Set<string>(), dateRange: 'all' as const };
    setTempFilters(reset);
    setFilters(reset);
    setShowFilterModal(false);
  };

  const userInitial = user?.displayName?.charAt(0)?.toUpperCase() || 'U';
  const filtersActive = hasActiveFilters(filters);

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <SafeAreaView
        edges={['top']}
        className="absolute top-0 left-0 right-0 z-10"
      >
        <View className="flex-row items-center justify-between px-4 py-2">
          {/* Feature 6: User avatar nav */}
          <Pressable
            className="w-10 h-10 rounded-full items-center justify-center shadow"
            style={{ backgroundColor: colors.primaryLight }}
            onPress={() => router.push('/profile')}
          >
            <Text className="text-base font-bold text-white">
              {userInitial}
            </Text>
          </Pressable>

          <View className="flex-row items-center gap-2">
            {location.loading && (
              <View className="bg-white/90 px-3 py-1.5 rounded-full shadow-sm">
                <Text className="text-xs text-gray-500">Locating...</Text>
              </View>
            )}

            {/* Feature 5: Filter button */}
            <Pressable
              className="w-10 h-10 rounded-full bg-white shadow items-center justify-center"
              onPress={openFilterModal}
            >
              <Text className="text-lg">⚙</Text>
              {filtersActive && (
                <View
                  className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full"
                  style={{ backgroundColor: colors.error }}
                />
              )}
            </Pressable>
          </View>
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

      {/* Feature 11: Loading overlay for zone switches */}
      {(isLoadingZoneSwitch || isFetchingTrees) && (
        <View className="absolute top-32 left-0 right-0 z-20 items-center">
          <View className="bg-white/90 px-4 py-2 rounded-full shadow-sm flex-row items-center">
            <ActivityIndicator size="small" color={colors.primary} />
            <Text className="text-xs text-gray-500 ml-2">Loading trees...</Text>
          </View>
        </View>
      )}

      {/* Map */}
      <ErrorBoundary>
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
      </ErrorBoundary>

      {/* Feature 3: Tree bottom sheet */}
      {selectedTree && !selectedZoneId && !selectedBountyId && (
        <TreeBottomSheet
          tree={selectedTree}
          onClose={() => setSelectedTree(null)}
          onViewDetails={() => {
            // Navigate to tree detail if screen exists, otherwise no-op
          }}
        />
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
      <SafeAreaView
        edges={['bottom']}
        className="bg-white border-t border-gray-100"
      >
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

      {/* Feature 5: Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <SafeAreaView className="flex-1 bg-white">
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
            <Text className="text-lg font-bold text-gray-900">
              Filter Trees
            </Text>
            <Pressable onPress={() => setShowFilterModal(false)}>
              <Text className="text-base text-gray-500">Close</Text>
            </Pressable>
          </View>

          <ScrollView className="flex-1 px-4 pt-4">
            {/* Status filters */}
            <Text className="text-sm font-semibold text-gray-500 mb-3">
              STATUS
            </Text>
            {[
              { key: 'verified', label: 'Verified', color: colors.primary },
              { key: 'pending', label: 'Pending', color: colors.warning },
              { key: 'cooldown', label: 'On Cooldown', color: colors.cooldown },
              {
                key: 'unverified',
                label: 'Unverified',
                color: colors.pinPending,
              },
            ].map((item) => (
              <Pressable
                key={item.key}
                className="flex-row items-center py-3 border-b border-gray-50"
                onPress={() => toggleTempStatus(item.key)}
              >
                <View
                  className="w-5 h-5 rounded border-2 mr-3 items-center justify-center"
                  style={{
                    borderColor: tempFilters.statuses.has(item.key)
                      ? item.color
                      : '#D1D5DB',
                    backgroundColor: tempFilters.statuses.has(item.key)
                      ? item.color
                      : 'transparent',
                  }}
                >
                  {tempFilters.statuses.has(item.key) && (
                    <Text className="text-white text-xs font-bold">✓</Text>
                  )}
                </View>
                <Text className="text-base text-gray-900">{item.label}</Text>
              </Pressable>
            ))}

            {/* Date range */}
            <Text className="text-sm font-semibold text-gray-500 mt-6 mb-3">
              DATE RANGE
            </Text>
            {[
              { key: '7d', label: 'Last 7 days' },
              { key: '30d', label: 'Last 30 days' },
              { key: '90d', label: 'Last 90 days' },
              { key: 'all', label: 'All time' },
            ].map((item) => (
              <Pressable
                key={item.key}
                className="flex-row items-center py-3 border-b border-gray-50"
                onPress={() =>
                  setTempFilters((prev) => ({
                    ...prev,
                    dateRange: item.key as Filters['dateRange'],
                  }))
                }
              >
                <View
                  className="w-5 h-5 rounded-full border-2 mr-3 items-center justify-center"
                  style={{
                    borderColor:
                      tempFilters.dateRange === item.key
                        ? colors.primary
                        : '#D1D5DB',
                  }}
                >
                  {tempFilters.dateRange === item.key && (
                    <View
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: colors.primary }}
                    />
                  )}
                </View>
                <Text className="text-base text-gray-900">{item.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Action buttons */}
          <View className="px-4 py-4 border-t border-gray-100 flex-row gap-3">
            <Pressable
              className="flex-1 py-3.5 rounded-xl items-center bg-gray-100"
              onPress={resetFilters}
            >
              <Text className="text-gray-700 font-semibold">Reset</Text>
            </Pressable>
            <Pressable
              className="flex-1 py-3.5 rounded-xl items-center"
              style={{ backgroundColor: colors.primary }}
              onPress={applyFilters}
            >
              <Text className="text-white font-semibold">Apply</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
