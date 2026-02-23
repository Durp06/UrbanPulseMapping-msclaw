import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { colors } from '../../constants/colors';
import { useZonesSummary } from '../../hooks/useContractZones';
import { useScanStore } from '../../lib/store';
import type { GetUserStatsResponse } from '@urban-pulse/shared-types';

export default function SuccessScreen() {
  const { data: stats } = useQuery({
    queryKey: ['userStats'],
    queryFn: () => api.get<GetUserStatsResponse>('/users/me/stats'),
  });
  const { data: zonesSummary } = useZonesSummary();
  const scanState = useScanStore();
  const bountyClaim = useScanStore((s) => s.lastBountyClaim);

  // Check if the scanned tree location is in an active zone
  const activeZoneMatch = React.useMemo(() => {
    if (!scanState.latitude || !scanState.longitude || !zonesSummary?.zones) {
      return null;
    }
    const activeZones = zonesSummary.zones.filter((z) => z.status === 'active');
    return activeZones.length > 0 ? activeZones[0] : null;
  }, [scanState.latitude, scanState.longitude, zonesSummary]);

  return (
    <SafeAreaView className="flex-1 bg-background items-center justify-center px-6">
      <View className="items-center">
        {/* Animated checkmark */}
        <View className="w-24 h-24 rounded-full bg-accent/20 items-center justify-center mb-6">
          <Text className="text-5xl">✓</Text>
        </View>

        <Text className="text-2xl font-bold text-gray-900 text-center mb-2">
          Tree Submitted!
        </Text>

        <Text className="text-base text-gray-500 text-center mb-4">
          Your observation is being processed. Thanks for contributing to the
          urban tree inventory!
        </Text>

        {/* Bounty earning celebration */}
        {bountyClaim && (
          <View
            className="w-full rounded-2xl p-4 mb-4 border-2"
            style={{ backgroundColor: colors.bountyBg, borderColor: colors.bounty }}
          >
            <Text className="text-3xl text-center mb-1">💰</Text>
            <Text
              className="text-xl font-bold text-center"
              style={{ color: colors.bounty }}
            >
              You earned ${(bountyClaim.amountCents / 100).toFixed(2)}!
            </Text>
            <Text className="text-sm text-gray-600 text-center mt-1">
              from "{bountyClaim.bountyTitle}"
            </Text>
          </View>
        )}

        {/* Active zone celebration */}
        {activeZoneMatch && !bountyClaim && (
          <View
            className="w-full rounded-2xl p-4 mb-4"
            style={{ backgroundColor: colors.accentLightest }}
          >
            <Text className="text-base font-bold text-center" style={{ color: colors.primary }}>
              Zone Contribution!
            </Text>
            <Text className="text-sm text-gray-600 text-center mt-1">
              This tree counts toward {activeZoneMatch.displayName}
            </Text>
            <View className="flex-row justify-center gap-4 mt-2">
              <View className="items-center">
                <Text className="text-lg font-bold" style={{ color: colors.primary }}>
                  {activeZoneMatch.treesMappedCount}
                </Text>
                <Text className="text-xs text-gray-500">mapped</Text>
              </View>
              {activeZoneMatch.treeTargetCount && (
                <View className="items-center">
                  <Text className="text-lg font-bold" style={{ color: colors.primary }}>
                    {activeZoneMatch.treeTargetCount}
                  </Text>
                  <Text className="text-xs text-gray-500">target</Text>
                </View>
              )}
              <View className="items-center">
                <Text className="text-lg font-bold" style={{ color: colors.primary }}>
                  {activeZoneMatch.progressPercentage}%
                </Text>
                <Text className="text-xs text-gray-500">complete</Text>
              </View>
            </View>
          </View>
        )}

        {stats && (
          <View className="bg-white rounded-2xl p-6 w-full mb-8 shadow-sm">
            <Text className="text-sm text-gray-500 text-center mb-1">
              You've scanned
            </Text>
            <Text
              className="text-4xl font-bold text-center"
              style={{ color: colors.primary }}
            >
              {stats.totalScans}
            </Text>
            <Text className="text-sm text-gray-500 text-center">
              {stats.totalScans === 1 ? 'tree' : 'trees'}
            </Text>
          </View>
        )}
      </View>

      <View className="w-full">
        <Pressable
          className="py-4 rounded-xl items-center mb-3"
          style={{ backgroundColor: colors.primary }}
          onPress={() => {
            router.dismissAll();
            router.push('/scan');
          }}
        >
          <Text className="text-white font-semibold text-lg">
            Scan Another
          </Text>
        </Pressable>

        <Pressable
          className="py-4 rounded-xl items-center bg-gray-100"
          onPress={() => router.dismissAll()}
        >
          <Text className="text-gray-700 font-semibold text-lg">
            View on Map
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
