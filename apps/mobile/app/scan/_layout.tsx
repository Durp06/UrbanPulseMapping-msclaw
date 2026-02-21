import React from 'react';
import { Stack } from 'expo-router';

export default function ScanLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="angle1" />
      <Stack.Screen name="angle2" />
      <Stack.Screen name="bark" />
      <Stack.Screen name="review" />
      <Stack.Screen name="success" />
    </Stack>
  );
}
