import React from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMyBounties } from '../../hooks/useBounties';
import { colors } from '../../constants/colors';
import type { BountyStatus } from '@urban-pulse/shared-types';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const STATUS_LABELS: Record<BountyStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: colors.cooldown },
  active: { label: 'Active', color: colors.primary },
  paused: { label: 'Paused', color: colors.warning },
  completed: { label: 'Completed', color: '#3B82F6' },
  expired: { label: 'Expired', color: colors.error },
};

export default function DeveloperDashboard() {
  const { data, isLoading } = useMyBounties();

  const bounties = data?.bounties || [];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4 pt-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <View>
            <Text className="text-2xl font-bold text-gray-900">
              Developer Dashboard
            </Text>
            <Text className="text-sm text-gray-500 mt-0.5">
              Manage your bounties
            </Text>
          </View>
          <Pressable
            className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
            onPress={() => router.back()}
          >
            <Text className="text-lg">✕</Text>
          </Pressable>
        </View>

        {/* Create Bounty CTA */}
        <Pressable
          className="py-4 rounded-xl items-center mb-6"
          style={{ backgroundColor: colors.bounty }}
          onPress={() => router.push('/developer/create-bounty')}
        >
          <Text className="text-white font-semibold text-lg">
            + Create New Bounty
          </Text>
        </Pressable>

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primary} className="mt-8" />
        ) : bounties.length === 0 ? (
          <View className="items-center mt-8">
            <Text className="text-5xl mb-4">📋</Text>
            <Text className="text-lg font-semibold text-gray-700">
              No Bounties Yet
            </Text>
            <Text className="text-sm text-gray-500 mt-1 text-center">
              Create your first bounty to start incentivizing tree mapping.
            </Text>
          </View>
        ) : (
          <View className="gap-3 mb-6">
            {bounties.map((bounty: any) => {
              const statusInfo = STATUS_LABELS[bounty.status as BountyStatus] || STATUS_LABELS.draft;
              const budgetRemaining = bounty.totalBudgetCents - bounty.spentCents;
              const progressPct = bounty.treeTargetCount > 0
                ? Math.min(100, Math.round((bounty.treesCompleted / bounty.treeTargetCount) * 100))
                : 0;

              return (
                <Pressable
                  key={bounty.id}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
                  onPress={() => {
                    // Could navigate to bounty detail/edit
                  }}
                >
                  {/* Title + status */}
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1 mr-2">
                      <Text className="text-base font-semibold text-gray-900">
                        {bounty.title}
                      </Text>
                      <Text className="text-xs text-gray-500 mt-0.5">
                        {formatCents(bounty.bountyAmountCents)}/tree
                      </Text>
                    </View>
                    <View
                      className="px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: statusInfo.color }}
                    >
                      <Text className="text-[10px] font-semibold text-white">
                        {statusInfo.label}
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
                          backgroundColor: statusInfo.color,
                        }}
                      />
                    </View>
                  </View>

                  {/* Stats */}
                  <View className="flex-row justify-between">
                    <Text className="text-xs text-gray-500">
                      {bounty.treesCompleted}/{bounty.treeTargetCount} trees ({progressPct}%)
                    </Text>
                    <Text className="text-xs text-gray-500">
                      Budget: {formatCents(bounty.spentCents)}/{formatCents(bounty.totalBudgetCents)}
                    </Text>
                  </View>
                  <View className="flex-row justify-between mt-1">
                    <Text className="text-xs text-gray-400">
                      {new Date(bounty.startsAt).toLocaleDateString()} — {new Date(bounty.expiresAt).toLocaleDateString()}
                    </Text>
                    <Text className="text-xs font-medium" style={{ color: colors.bounty }}>
                      {formatCents(budgetRemaining)} left
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
