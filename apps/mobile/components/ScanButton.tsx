import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../constants/colors';

export function ScanButton() {
  return (
    <Pressable
      className="absolute bottom-28 right-6 w-16 h-16 rounded-full items-center justify-center shadow-lg active:opacity-80"
      style={{ backgroundColor: colors.primary }}
      onPress={() => router.push('/scan')}
    >
      <Text className="text-2xl">🌳</Text>
      <Text className="text-white text-[10px] font-bold -mt-0.5">Scan</Text>
    </Pressable>
  );
}
