import React from 'react';
import { View, Text } from 'react-native';
import { colors } from '../constants/colors';

interface GPSIndicatorProps {
  accuracy: number | null;
  size?: 'small' | 'large';
}

export function GPSIndicator({ accuracy, size = 'small' }: GPSIndicatorProps) {
  let color = colors.error;
  let label = 'Poor GPS';

  if (accuracy !== null) {
    if (accuracy <= 10) {
      color = colors.accent;
      label = `GPS ±${Math.round(accuracy)}m`;
    } else if (accuracy <= 20) {
      color = colors.warning;
      label = `GPS ±${Math.round(accuracy)}m`;
    } else {
      label = `GPS ±${Math.round(accuracy)}m`;
    }
  }

  return (
    <View
      className={`flex-row items-center rounded-full ${
        size === 'large' ? 'px-4 py-2' : 'px-3 py-1'
      }`}
      style={{ backgroundColor: color + '20' }}
    >
      <View
        className="w-2 h-2 rounded-full mr-1.5"
        style={{ backgroundColor: color }}
      />
      <Text
        className={`font-medium ${
          size === 'large' ? 'text-sm' : 'text-xs'
        }`}
        style={{ color }}
      >
        {label}
      </Text>
    </View>
  );
}
