import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { colors } from '../constants/colors';
import type { ZoneStatus } from '@urban-pulse/shared-types';

interface ZoneChip {
  id: string;
  displayName: string;
  status: ZoneStatus;
  treesMappedCount: number;
}

interface ZoneChipSelectorProps {
  zones: ZoneChip[];
  selectedId: string | null;
  onSelect: (zoneId: string | null) => void;
}

const STATUS_DOT_COLORS: Record<ZoneStatus, string> = {
  active: colors.primary,
  completed: '#3B82F6',
  upcoming: colors.warning,
  paused: colors.cooldown,
};

export function ZoneChipSelector({ zones, selectedId, onSelect }: ZoneChipSelectorProps) {
  if (zones.length === 0) return null;

  return (
    <View className="px-4">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 16 }}
      >
        {zones.map((zone) => {
          const isSelected = selectedId === zone.id;
          const dotColor = STATUS_DOT_COLORS[zone.status];

          return (
            <Pressable
              key={zone.id}
              className={`flex-row items-center px-3 py-1.5 rounded-full border ${
                isSelected ? 'border-transparent' : 'border-gray-200 bg-white/90'
              }`}
              style={isSelected ? { backgroundColor: colors.primary } : undefined}
              onPress={() => onSelect(isSelected ? null : zone.id)}
            >
              <View
                className="w-2 h-2 rounded-full mr-1.5"
                style={{ backgroundColor: isSelected ? '#fff' : dotColor }}
              />
              <Text
                className={`text-xs font-medium ${
                  isSelected ? 'text-white' : 'text-gray-700'
                }`}
                numberOfLines={1}
              >
                {zone.displayName}
              </Text>
              <Text
                className={`text-xs ml-1 ${
                  isSelected ? 'text-white/70' : 'text-gray-400'
                }`}
              >
                {zone.treesMappedCount}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
