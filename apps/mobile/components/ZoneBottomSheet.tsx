import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../constants/colors';
import type { ZoneStatus } from '@urban-pulse/shared-types';

interface ZoneBottomSheetProps {
  zone: {
    id: string;
    displayName: string;
    zoneType: string;
    status: ZoneStatus;
    progressPercentage: number;
    treeTargetCount: number | null;
    treesMappedCount: number;
    contractName?: string;
    corridorName?: string | null;
    startCrossStreet?: string | null;
    endCrossStreet?: string | null;
  };
  onClose: () => void;
}

const STATUS_LABELS: Record<ZoneStatus, { label: string; color: string }> = {
  active: { label: 'Active', color: colors.primary },
  completed: { label: 'Completed', color: '#3B82F6' },
  upcoming: { label: 'Upcoming', color: colors.warning },
  paused: { label: 'Paused', color: colors.cooldown },
};

export function ZoneBottomSheet({ zone, onClose }: ZoneBottomSheetProps) {
  const statusInfo = STATUS_LABELS[zone.status];
  const progressWidth = Math.min(100, Math.max(0, zone.progressPercentage));

  return (
    <View className="absolute bottom-24 left-4 right-4 bg-white rounded-2xl p-4 shadow-lg">
      {/* Header */}
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-1 mr-3">
          <Text className="text-lg font-bold text-gray-900">
            {zone.displayName}
          </Text>
          {zone.contractName && (
            <Text className="text-xs text-gray-500 mt-0.5">
              {zone.contractName}
            </Text>
          )}
        </View>
        <View className="flex-row items-center gap-2">
          <View
            className="px-3 py-1 rounded-full"
            style={{ backgroundColor: statusInfo.color }}
          >
            <Text className="text-xs font-semibold text-white">
              {statusInfo.label}
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

      {/* Corridor details */}
      {zone.corridorName && (
        <Text className="text-sm text-gray-600 mb-2">
          {zone.corridorName}
          {zone.startCrossStreet && zone.endCrossStreet
            ? ` (${zone.startCrossStreet} to ${zone.endCrossStreet})`
            : ''}
        </Text>
      )}

      {/* Progress bar */}
      <View className="mb-3">
        <View className="flex-row justify-between mb-1">
          <Text className="text-xs text-gray-500">Progress</Text>
          <Text className="text-xs font-semibold text-gray-700">
            {zone.progressPercentage}%
          </Text>
        </View>
        <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <View
            className="h-full rounded-full"
            style={{
              width: `${progressWidth}%`,
              backgroundColor: statusInfo.color,
            }}
          />
        </View>
      </View>

      {/* Stats */}
      <View className="flex-row gap-4 mb-3">
        <View>
          <Text className="text-xs text-gray-500">Trees Mapped</Text>
          <Text className="text-sm font-semibold">{zone.treesMappedCount}</Text>
        </View>
        {zone.treeTargetCount && (
          <View>
            <Text className="text-xs text-gray-500">Target</Text>
            <Text className="text-sm font-semibold">{zone.treeTargetCount}</Text>
          </View>
        )}
        <View>
          <Text className="text-xs text-gray-500">Type</Text>
          <Text className="text-sm font-semibold">
            {zone.zoneType === 'zip_code' ? 'Zip Code' : 'Street Corridor'}
          </Text>
        </View>
      </View>

      {/* CTA */}
      {zone.status === 'active' && (
        <Pressable
          className="py-3 rounded-xl items-center"
          style={{ backgroundColor: colors.primary }}
          onPress={() => {
            onClose();
            router.push('/scan');
          }}
        >
          <Text className="text-white font-semibold">
            Start Mapping Here
          </Text>
        </Pressable>
      )}
    </View>
  );
}
