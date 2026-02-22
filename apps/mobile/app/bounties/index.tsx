import React from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBounties } from '../../hooks/useBounties';
import { useLocation } from '../../hooks/useLocation';
import { colors } from '../../constants/colors';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function getDistanceKm(
  lat1: number, lng1: number, lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function BountiesScreen() {
  const { data, isLoading } = useBounties();
  const location = useLocation();

  const bounties = React.useMemo(() => {
    if (!data?.bounties) return [];
    return data.bounties
      .map((b: any) => {
        // Calculate approximate center from geometry for distance
        let centerLat: number | null = null;
        let centerLng: number | null = null;
        if (b.geometry?.coordinates) {
          try {
            const coords = b.geometry.type === 'MultiPolygon'
              ? b.geometry.coordinates[0][0]
              : b.geometry.coordinates[0];
            const lngs = coords.map((c: number[]) => c[0]);
            const lats = coords.map((c: number[]) => c[1]);
            centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
            centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
          } catch {
            // ignore
          }
        }
        let distance: number | null = null;
        if (location.latitude && location.longitude && centerLat && centerLng) {
          distance = getDistanceKm(
            location.latitude, location.longitude, centerLat, centerLng
          );
        }
        return { ...b, distance };
      })
      .sort((a: any, b: any) => {
        // Sort by highest pay first, then nearest
        if (b.bountyAmountCents !== a.bountyAmountCents) {
          return b.bountyAmountCents - a.bountyAmountCents;
        }
        if (a.distance !== null && b.distance !== null) {
          return a.distance - b.distance;
        }
        return 0;
      });
  }, [data, location.latitude, location.longitude]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4 pt-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <View>
            <Text className="text-2xl font-bold text-gray-900">
              Bounties
            </Text>
            <Text className="text-sm text-gray-500 mt-0.5">
              Earn money mapping trees
            </Text>
          </View>
          <Pressable
            className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
            onPress={() => router.back()}
          >
            <Text className="text-lg">✕</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.bounty} className="mt-8" />
        ) : bounties.length === 0 ? (
          <View className="items-center mt-12">
            <Text className="text-5xl mb-4">💰</Text>
            <Text className="text-lg font-semibold text-gray-700">No Active Bounties</Text>
            <Text className="text-sm text-gray-500 mt-1 text-center">
              Check back soon — developers post bounties for mapping zones.
            </Text>
          </View>
        ) : (
          <View className="gap-3 mb-6">
            {bounties.map((bounty: any) => {
              const budgetRemaining = bounty.totalBudgetCents - bounty.spentCents;
              const progressPct = bounty.treeTargetCount > 0
                ? Math.min(100, Math.round((bounty.treesCompleted / bounty.treeTargetCount) * 100))
                : 0;

              return (
                <Pressable
                  key={bounty.id}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
                  onPress={() => {
                    router.back();
                    // Navigate to map with bounties view
                  }}
                >
                  {/* Title row */}
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1 mr-2">
                      <Text className="text-base font-semibold text-gray-900">
                        {bounty.title}
                      </Text>
                      <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={2}>
                        {bounty.description}
                      </Text>
                    </View>
                    <View
                      className="px-3 py-1 rounded-full"
                      style={{ backgroundColor: colors.bounty }}
                    >
                      <Text className="text-xs font-bold text-white">
                        {formatCents(bounty.bountyAmountCents)}/tree
                      </Text>
                    </View>
                  </View>

                  {/* Progress bar */}
                  <View className="mb-2">
                    <View className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <View
                        className="h-full rounded-full"
                        style={{
                          width: `${progressPct}%`,
                          backgroundColor: colors.bounty,
                        }}
                      />
                    </View>
                  </View>

                  {/* Stats row */}
                  <View className="flex-row justify-between items-center">
                    <View className="flex-row gap-3">
                      <Text className="text-xs text-gray-500">
                        {bounty.treesCompleted}/{bounty.treeTargetCount} trees
                      </Text>
                      <Text className="text-xs font-medium" style={{ color: colors.bounty }}>
                        {formatCents(budgetRemaining)} left
                      </Text>
                    </View>
                    {bounty.distance !== null && (
                      <Text className="text-xs text-gray-400">
                        {bounty.distance < 1
                          ? `${Math.round(bounty.distance * 1000)}m away`
                          : `${bounty.distance.toFixed(1)}km away`}
                      </Text>
                    )}
                  </View>

                  {/* Bonus badge */}
                  {bounty.bonusThreshold && bounty.bonusAmountCents && (
                    <View className="mt-2 bg-amber-50 rounded-lg px-3 py-1.5">
                      <Text className="text-xs font-medium" style={{ color: colors.bounty }}>
                        Bonus: {formatCents(bounty.bonusAmountCents)}/tree after {bounty.bonusThreshold} trees
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
