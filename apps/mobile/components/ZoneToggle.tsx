import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { colors } from '../constants/colors';

export type ZoneViewMode = 'all' | 'zip_code' | 'street_corridor' | 'active' | 'bounties';

interface ZoneToggleProps {
  selected: ZoneViewMode;
  onChange: (mode: ZoneViewMode) => void;
}

const MODES: { key: ZoneViewMode; label: string; color?: string }[] = [
  { key: 'all', label: 'All Trees' },
  { key: 'zip_code', label: 'By Zip Code' },
  { key: 'street_corridor', label: 'By Street' },
  { key: 'active', label: 'Active Contracts' },
  { key: 'bounties', label: '$ Bounties', color: colors.bounty },
];

export function ZoneToggle({ selected, onChange }: ZoneToggleProps) {
  return (
    <View className="px-4">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6 }}
      >
        {MODES.map((mode) => {
          const isActive = selected === mode.key;
          const bgColor = isActive
            ? mode.color || colors.primary
            : undefined;
          return (
            <Pressable
              key={mode.key}
              className={`px-4 py-2 rounded-full ${
                isActive ? '' : 'bg-white/90'
              }`}
              style={isActive ? { backgroundColor: bgColor } : undefined}
              onPress={() => onChange(mode.key)}
            >
              <Text
                className={`text-sm font-semibold ${
                  isActive ? 'text-white' : 'text-gray-700'
                }`}
              >
                {mode.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
