import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../constants/colors';

interface BountyBottomSheetProps {
  bounty: {
    id: string;
    title: string;
    description: string;
    bountyAmountCents: number;
    bonusThreshold: number | null;
    bonusAmountCents: number | null;
    totalBudgetCents: number;
    spentCents: number;
    treeTargetCount: number;
    treesCompleted: number;
    startsAt: string;
    expiresAt: string;
  };
  onClose: () => void;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function BountyBottomSheet({ bounty, onClose }: BountyBottomSheetProps) {
  const budgetRemaining = bounty.totalBudgetCents - bounty.spentCents;
  const progressPct = bounty.treeTargetCount > 0
    ? Math.min(100, Math.round((bounty.treesCompleted / bounty.treeTargetCount) * 100))
    : 0;

  return (
    <View className="absolute bottom-24 left-4 right-4 bg-white rounded-2xl p-4 shadow-lg">
      {/* Header */}
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1 mr-3">
          <Text className="text-lg font-bold text-gray-900">
            {bounty.title}
          </Text>
          <Text className="text-sm text-gray-500 mt-0.5" numberOfLines={2}>
            {bounty.description}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View
            className="px-3 py-1 rounded-full"
            style={{ backgroundColor: colors.bounty }}
          >
            <Text className="text-xs font-semibold text-white">
              {formatCents(bounty.bountyAmountCents)}/tree
            </Text>
          </View>
          <Pressable
            className="w-7 h-7 rounded-full bg-gray-100 items-center justify-center"
            onPress={onClose}
          >
            <Text className="text-xs text-gray-500">✕</Text>
          </Pressable>
        </View>
      </View>

      {/* Progress bar */}
      <View className="mb-3">
        <View className="flex-row justify-between mb-1">
          <Text className="text-xs text-gray-500">Progress</Text>
          <Text className="text-xs font-semibold text-gray-700">
            {progressPct}%
          </Text>
        </View>
        <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <View
            className="h-full rounded-full"
            style={{
              width: `${progressPct}%`,
              backgroundColor: colors.bounty,
            }}
          />
        </View>
      </View>

      {/* Stats */}
      <View className="flex-row gap-4 mb-3">
        <View>
          <Text className="text-xs text-gray-500">Trees Mapped</Text>
          <Text className="text-sm font-semibold">
            {bounty.treesCompleted}/{bounty.treeTargetCount}
          </Text>
        </View>
        <View>
          <Text className="text-xs text-gray-500">Budget Left</Text>
          <Text className="text-sm font-semibold" style={{ color: colors.bounty }}>
            {formatCents(budgetRemaining)}
          </Text>
        </View>
        {bounty.bonusThreshold && bounty.bonusAmountCents && (
          <View>
            <Text className="text-xs text-gray-500">Bonus</Text>
            <Text className="text-sm font-semibold">
              {formatCents(bounty.bonusAmountCents)} after {bounty.bonusThreshold}
            </Text>
          </View>
        )}
      </View>

      {/* CTA */}
      <Pressable
        className="py-3 rounded-xl items-center"
        style={{ backgroundColor: colors.bounty }}
        onPress={() => {
          onClose();
          router.push('/scan');
        }}
      >
        <Text className="text-white font-semibold">
          Start Mapping — Earn {formatCents(bounty.bountyAmountCents)}/tree
        </Text>
      </Pressable>
    </View>
  );
}
