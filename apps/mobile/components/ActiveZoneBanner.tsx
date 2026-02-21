import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../constants/colors';

interface ActiveZoneBannerProps {
  zoneName: string;
  progressPercentage: number;
  treesMappedCount: number;
  treeTargetCount: number | null;
}

export function ActiveZoneBanner({
  zoneName,
  progressPercentage,
  treesMappedCount,
  treeTargetCount,
}: ActiveZoneBannerProps) {
  return (
    <View
      className="mx-4 rounded-xl p-3 flex-row items-center"
      style={{ backgroundColor: colors.accentLightest }}
    >
      <View className="w-8 h-8 rounded-full items-center justify-center mr-3"
        style={{ backgroundColor: colors.primary }}
      >
        <Text className="text-white text-sm font-bold">!</Text>
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-gray-900">
          You're in {zoneName}
        </Text>
        <Text className="text-xs text-gray-600">
          {treesMappedCount}
          {treeTargetCount ? `/${treeTargetCount}` : ''} trees mapped
          {' · '}
          {progressPercentage}% complete
        </Text>
      </View>
      <Pressable
        className="px-3 py-1.5 rounded-full"
        style={{ backgroundColor: colors.primary }}
        onPress={() => router.push('/scan')}
      >
        <Text className="text-white text-xs font-semibold">Scan</Text>
      </Pressable>
    </View>
  );
}
