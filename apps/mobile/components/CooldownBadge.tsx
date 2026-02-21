import React from 'react';
import { View, Text } from 'react-native';
import { colors } from '../constants/colors';

interface CooldownBadgeProps {
  cooldownUntil: string;
}

export function CooldownBadge({ cooldownUntil }: CooldownBadgeProps) {
  const until = new Date(cooldownUntil);
  const now = new Date();
  const daysLeft = Math.ceil(
    (until.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysLeft <= 0) return null;

  return (
    <View
      className="flex-row items-center px-3 py-1 rounded-full"
      style={{ backgroundColor: colors.cooldown + '30' }}
    >
      <Text className="text-xs font-medium" style={{ color: colors.cooldown }}>
        Cooldown: {daysLeft}d left
      </Text>
    </View>
  );
}
