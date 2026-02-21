import React from 'react';
import { View, Text } from 'react-native';

interface StatsCardProps {
  title: string;
  value: number | string;
  color: string;
  subtitle?: string;
}

export function StatsCard({ title, value, color, subtitle }: StatsCardProps) {
  return (
    <View className="flex-1 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <Text className="text-xs text-gray-500 font-medium uppercase tracking-wide">
        {title}
      </Text>
      <Text
        className="text-3xl font-bold mt-1"
        style={{ color }}
      >
        {value}
      </Text>
      {subtitle && (
        <Text className="text-xs text-gray-400 mt-0.5">{subtitle}</Text>
      )}
    </View>
  );
}
