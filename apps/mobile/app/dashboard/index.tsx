import React from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { StatsCard } from '../../components/StatsCard';
import { useAuth } from '../../hooks/useAuth';
import { useZonesSummary } from '../../hooks/useContractZones';
import { api } from '../../lib/api';
import { colors } from '../../constants/colors';
import type { GetUserStatsResponse, ZoneStatus } from '@urban-pulse/shared-types';

const ZONE_STATUS_COLORS: Record<ZoneStatus, string> = {
  active: colors.primary,
  completed: '#3B82F6',
  upcoming: colors.warning,
  paused: colors.cooldown,
};

export default function DashboardScreen() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['userStats'],
    queryFn: () => api.get<GetUserStatsResponse>('/users/me/stats'),
  });

  const { data: zonesSummary } = useZonesSummary();

  const activeZones = zonesSummary?.zones?.filter((z) => z.status === 'active') || [];
  const upcomingZones = zonesSummary?.zones?.filter((z) => z.status === 'upcoming') || [];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4 pt-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <View>
            <Text className="text-2xl font-bold text-gray-900">
              Hey, {user?.displayName || 'Explorer'}!
            </Text>
            <Text className="text-sm text-gray-500 mt-0.5">
              Your tree scanning dashboard
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
          <ActivityIndicator size="large" color={colors.primary} className="mt-8" />
        ) : stats ? (
          <>
            {/* Stats grid */}
            <View className="gap-3">
              <View className="flex-row gap-3">
                <StatsCard
                  title="Trees Scanned"
                  value={stats.totalScans}
                  color={colors.primary}
                />
                <StatsCard
                  title="Verified"
                  value={stats.verifiedTrees}
                  color={colors.accent}
                />
              </View>
              <View className="flex-row gap-3">
                <StatsCard
                  title="Pending"
                  value={stats.pendingObservations}
                  color={colors.warning}
                />
                <StatsCard
                  title="On Cooldown"
                  value={stats.treesOnCooldown}
                  color={colors.cooldown}
                />
              </View>
            </View>

            {/* Streak */}
            {stats.contributionStreak > 0 && (
              <View className="mt-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <View className="flex-row items-center">
                  <Text className="text-2xl mr-2">🔥</Text>
                  <View>
                    <Text className="text-lg font-bold text-gray-900">
                      {stats.contributionStreak} day streak!
                    </Text>
                    <Text className="text-sm text-gray-500">
                      Keep scanning to maintain your streak
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* My Zones section */}
            {activeZones.length > 0 && (
              <View className="mt-6">
                <Text className="text-lg font-bold text-gray-900 mb-3">
                  My Zones
                </Text>
                {activeZones.map((zone) => {
                  const statusColor = ZONE_STATUS_COLORS[zone.status];
                  const progressWidth = Math.min(100, Math.max(0, zone.progressPercentage));
                  return (
                    <Pressable
                      key={zone.id}
                      className="bg-white rounded-2xl p-4 mb-3 shadow-sm border border-gray-100"
                      onPress={() => router.back()}
                    >
                      <View className="flex-row items-start justify-between mb-2">
                        <View className="flex-1 mr-2">
                          <Text className="text-base font-semibold text-gray-900">
                            {zone.displayName}
                          </Text>
                          <Text className="text-xs text-gray-500 mt-0.5">
                            {zone.contractName}
                          </Text>
                        </View>
                        <View
                          className="px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: statusColor }}
                        >
                          <Text className="text-[10px] font-semibold text-white">
                            {zone.status.charAt(0).toUpperCase() + zone.status.slice(1)}
                          </Text>
                        </View>
                      </View>

                      {/* Progress bar */}
                      <View className="mb-2">
                        <View className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <View
                            className="h-full rounded-full"
                            style={{
                              width: `${progressWidth}%`,
                              backgroundColor: statusColor,
                            }}
                          />
                        </View>
                      </View>

                      <View className="flex-row justify-between">
                        <Text className="text-xs text-gray-500">
                          {zone.treesMappedCount}
                          {zone.treeTargetCount ? `/${zone.treeTargetCount}` : ''} trees
                        </Text>
                        <Text className="text-xs font-medium" style={{ color: statusColor }}>
                          {zone.progressPercentage}%
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Upcoming zones */}
            {upcomingZones.length > 0 && (
              <View className="mt-4">
                <Text className="text-sm font-semibold text-gray-500 mb-2">
                  Upcoming Zones
                </Text>
                {upcomingZones.map((zone) => (
                  <View
                    key={zone.id}
                    className="bg-white/60 rounded-xl p-3 mb-2 border border-gray-100"
                  >
                    <Text className="text-sm font-medium text-gray-700">
                      {zone.displayName}
                    </Text>
                    <Text className="text-xs text-gray-400">
                      {zone.zoneType === 'zip_code' ? 'Zip Code' : 'Street Corridor'}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Quick actions */}
            <View className="mt-6 mb-6">
              <Text className="text-lg font-bold text-gray-900 mb-3">
                Quick Actions
              </Text>
              <Pressable
                className="py-4 rounded-xl items-center mb-3"
                style={{ backgroundColor: colors.primary }}
                onPress={() => {
                  router.back();
                  router.push('/scan');
                }}
              >
                <Text className="text-white font-semibold text-lg">
                  Scan a Tree
                </Text>
              </Pressable>
              <Pressable
                className="py-4 rounded-xl items-center bg-gray-100"
                onPress={() => router.back()}
              >
                <Text className="text-gray-700 font-semibold text-lg">
                  View Map
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Text className="text-center text-gray-500 mt-8">
            Unable to load stats. Check your connection.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
