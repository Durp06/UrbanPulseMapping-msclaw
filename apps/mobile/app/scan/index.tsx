import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GPSIndicator } from '../../components/GPSIndicator';
import { useLocation } from '../../hooks/useLocation';
import { useScanStore } from '../../lib/store';
import { api } from '../../lib/api';
import { colors } from '../../constants/colors';
import type { GetTreesResponse } from '@urban-pulse/shared-types';

export default function ScanIntro() {
  const location = useLocation();
  const scanStore = useScanStore();
  const [checking, setChecking] = useState(true);
  const [nearbyTree, setNearbyTree] = useState<any>(null);
  const [cooldownTree, setCooldownTree] = useState<any>(null);

  useEffect(() => {
    scanStore.reset();
  }, []);

  useEffect(() => {
    if (!location.latitude || !location.longitude) return;

    scanStore.setLocation(
      location.latitude,
      location.longitude,
      location.accuracy || 0
    );

    // Check for nearby trees
    const checkNearby = async () => {
      try {
        const data = await api.get<GetTreesResponse>('/trees', {
          lat: location.latitude!,
          lng: location.longitude!,
          radius: 10,
        });

        if (data.trees.length > 0) {
          const closest = data.trees[0];
          const isOnCooldown =
            closest.cooldownUntil &&
            new Date(closest.cooldownUntil) > new Date();

          if (isOnCooldown) {
            setCooldownTree(closest);
          } else {
            setNearbyTree(closest);
          }
        }
      } catch {
        // Proceed without nearby check
      } finally {
        setChecking(false);
      }
    };

    checkNearby();
  }, [location.latitude, location.longitude]);

  const proceedToCamera = (treeId?: string) => {
    if (treeId) {
      scanStore.setNearbyTree(treeId);
    }
    router.push('/scan/angle1');
  };

  if (location.loading || checking) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="mt-4 text-gray-500">
          {location.loading ? 'Getting your location...' : 'Checking nearby trees...'}
        </Text>
      </SafeAreaView>
    );
  }

  // Cooldown tree nearby
  if (cooldownTree) {
    return (
      <SafeAreaView className="flex-1 bg-background px-6">
        <View className="flex-1 items-center justify-center">
          <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-6">
            <Text className="text-4xl">⏳</Text>
          </View>
          <Text className="text-xl font-bold text-gray-900 text-center mb-3">
            Tree on Cooldown
          </Text>
          <Text className="text-base text-gray-500 text-center leading-6 mb-2">
            This tree was recently mapped and is on cooldown until{' '}
            {new Date(cooldownTree.cooldownUntil).toLocaleDateString()}.
          </Text>
          <Text className="text-base text-gray-500 text-center leading-6">
            Try another tree nearby!
          </Text>
          <GPSIndicator accuracy={location.accuracy} size="large" />
        </View>
        <Pressable
          className="py-4 rounded-xl mb-6 items-center"
          style={{ backgroundColor: colors.primary }}
          onPress={() => proceedToCamera()}
        >
          <Text className="text-white font-semibold text-lg">
            Scan a Different Tree
          </Text>
        </Pressable>
        <Pressable
          className="py-3 mb-4 items-center"
          onPress={() => router.back()}
        >
          <Text className="text-gray-500 font-medium">Cancel</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // Nearby existing tree (not on cooldown)
  if (nearbyTree) {
    return (
      <SafeAreaView className="flex-1 bg-background px-6">
        <View className="flex-1 items-center justify-center">
          <View className="w-20 h-20 rounded-full bg-accent/20 items-center justify-center mb-6">
            <Text className="text-4xl">🌳</Text>
          </View>
          <Text className="text-xl font-bold text-gray-900 text-center mb-3">
            Nearby Tree Found
          </Text>
          <Text className="text-base text-gray-500 text-center leading-6 mb-6">
            It looks like you're near a previously mapped tree. Would you like
            to add a new observation?
          </Text>
          <GPSIndicator accuracy={location.accuracy} size="large" />
        </View>
        <Pressable
          className="py-4 rounded-xl mb-3 items-center"
          style={{ backgroundColor: colors.primary }}
          onPress={() => proceedToCamera(nearbyTree.id)}
        >
          <Text className="text-white font-semibold text-lg">
            Yes, Update This Tree
          </Text>
        </Pressable>
        <Pressable
          className="py-4 rounded-xl mb-3 items-center bg-gray-100"
          onPress={() => proceedToCamera()}
        >
          <Text className="text-gray-700 font-semibold text-lg">
            No, This is a Different Tree
          </Text>
        </Pressable>
        <Pressable
          className="py-3 mb-4 items-center"
          onPress={() => router.back()}
        >
          <Text className="text-gray-500 font-medium">Cancel</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // No nearby tree — go directly to camera
  return (
    <SafeAreaView className="flex-1 bg-background px-6">
      <View className="flex-1 items-center justify-center">
        <View className="w-20 h-20 rounded-full bg-accent/20 items-center justify-center mb-6">
          <Text className="text-4xl">📸</Text>
        </View>
        <Text className="text-xl font-bold text-gray-900 text-center mb-3">
          Ready to Scan
        </Text>
        <Text className="text-base text-gray-500 text-center leading-6 mb-6">
          You'll take 3 photos: two full tree shots from different angles,
          and one close-up of the bark.
        </Text>
        <GPSIndicator accuracy={location.accuracy} size="large" />

        {/* Progress dots */}
        <View className="flex-row gap-2 mt-6">
          <View className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.primary }} />
          <View className="w-3 h-3 rounded-full bg-gray-200" />
          <View className="w-3 h-3 rounded-full bg-gray-200" />
        </View>
      </View>
      <Pressable
        className="py-4 rounded-xl mb-6 items-center"
        style={{ backgroundColor: colors.primary }}
        onPress={() => proceedToCamera()}
      >
        <Text className="text-white font-semibold text-lg">
          Start Scanning
        </Text>
      </Pressable>
      <Pressable
        className="py-3 mb-4 items-center"
        onPress={() => router.back()}
      >
        <Text className="text-gray-500 font-medium">Cancel</Text>
      </Pressable>
    </SafeAreaView>
  );
}
