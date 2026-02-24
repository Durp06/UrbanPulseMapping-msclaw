import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Magnetometer } from 'expo-sensors';
import { colors } from '../constants/colors';

interface CompassIndicatorProps {
  targetHeading: number | null; // heading from angle 1
}

function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

function getAngleDiff(current: number, target: number): number {
  let diff = normalizeAngle(target - current);
  if (diff > 180) diff -= 360;
  return diff;
}

export function CompassIndicator({ targetHeading }: CompassIndicatorProps) {
  const [heading, setHeading] = useState<number | null>(null);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let subscription: { remove: () => void } | null = null;

    const start = async () => {
      try {
        const isAvailable = await Magnetometer.isAvailableAsync();
        if (!isAvailable) {
          setAvailable(false);
          return;
        }

        Magnetometer.setUpdateInterval(200);
        subscription = Magnetometer.addListener((data) => {
          // Calculate heading from magnetometer data
          const { x, y } = data;
          let angle = Math.atan2(y, x) * (180 / Math.PI);
          angle = normalizeAngle(angle);
          setHeading(angle);
        });
      } catch {
        setAvailable(false);
      }
    };

    start();

    return () => {
      subscription?.remove();
    };
  }, []);

  if (!available || targetHeading === null) {
    // Fallback: text instruction
    return (
      <View className="bg-black/70 rounded-xl px-4 py-3 flex-row items-center">
        <Text className="text-xl mr-2">🧭</Text>
        <Text className="text-white text-sm font-medium flex-1">
          Rotate ~90° from your first position
        </Text>
      </View>
    );
  }

  const recommendedHeading = normalizeAngle(targetHeading + 90);
  const diff = heading !== null ? getAngleDiff(heading, recommendedHeading) : 0;
  const absDiff = Math.abs(diff);

  const isAligned = absDiff < 20;
  const direction = diff > 0 ? 'right' : 'left';

  return (
    <View className="bg-black/70 rounded-xl px-4 py-3">
      <View className="flex-row items-center mb-2">
        <Text className="text-xl mr-2">🧭</Text>
        <Text className="text-white text-sm font-medium flex-1">
          {isAligned
            ? 'Great position! Take the photo.'
            : `Rotate ${Math.round(absDiff)}° to the ${direction}`}
        </Text>
      </View>

      {/* Simple visual arc */}
      <View className="flex-row items-center justify-center">
        <View className="w-48 h-3 bg-gray-700 rounded-full overflow-hidden">
          <View
            className="h-full rounded-full"
            style={{
              width: `${Math.max(5, 100 - (absDiff / 180) * 100)}%`,
              backgroundColor: isAligned ? '#4ADE80' : colors.warning,
              alignSelf: diff > 0 ? 'flex-end' : 'flex-start',
            }}
          />
        </View>
      </View>

      <Text className="text-gray-400 text-[10px] text-center mt-1">
        {Math.round(heading || 0)}° → target {Math.round(recommendedHeading)}°
      </Text>
    </View>
  );
}
