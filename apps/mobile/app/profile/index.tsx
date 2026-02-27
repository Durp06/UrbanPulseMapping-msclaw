import React from 'react';
import { View, Text, Pressable, Switch, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useAuthStore } from '../../lib/store';
import { api } from '../../lib/api';
import { colors } from '../../constants/colors';
import type { GetUserResponse } from '@urban-pulse/shared-types';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const updateUser = useAuthStore((s) => s.updateUser);

  const roleMutation = useMutation({
    mutationFn: (role: 'user' | 'developer') =>
      api.patch<GetUserResponse>('/users/me', { role }),
    onSuccess: (data) => {
      updateUser(data.user);
    },
    onError: () => {
      Alert.alert('Error', 'Failed to update role. Please try again.');
    },
  });

  const isDeveloper = user?.role === 'developer' || user?.role === 'admin';

  const handleToggleDeveloper = (value: boolean) => {
    const newRole = value ? 'developer' : 'user';
    roleMutation.mutate(newRole);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (e) {
            console.warn('Sign out error:', e);
          }
          // Delay navigation to let state settle
          setTimeout(() => {
            router.replace('/(auth)/login');
          }, 100);
        },
      },
    ]);
  };

  const initial = user?.displayName?.charAt(0)?.toUpperCase() || 'U';

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-4 pt-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-2xl font-bold text-gray-900">Profile</Text>
          <Pressable
            className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
            onPress={() => router.back()}
          >
            <Text className="text-lg">✕</Text>
          </Pressable>
        </View>

        {/* Avatar + Info */}
        <View className="items-center mb-8">
          <View
            className="w-20 h-20 rounded-full items-center justify-center mb-3"
            style={{ backgroundColor: colors.primaryLight }}
          >
            <Text className="text-3xl font-bold text-white">{initial}</Text>
          </View>
          <Text className="text-xl font-semibold text-gray-900">
            {user?.displayName || 'Unknown User'}
          </Text>
          {user?.email && (
            <Text className="text-sm text-gray-500 mt-0.5">{user.email}</Text>
          )}
        </View>

        {/* Settings */}
        <View className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Developer Mode Toggle */}
          <View className="flex-row items-center justify-between px-4 py-4">
            <View className="flex-1 mr-4">
              <Text className="text-base font-medium text-gray-900">
                Developer Mode
              </Text>
              <Text className="text-xs text-gray-500 mt-0.5">
                Enable to create and manage bounties
              </Text>
            </View>
            {roleMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Switch
                value={isDeveloper}
                onValueChange={handleToggleDeveloper}
                trackColor={{ false: '#E5E7EB', true: colors.accentLight }}
                thumbColor={isDeveloper ? colors.primary : '#F3F4F6'}
              />
            )}
          </View>

          {/* Developer Dashboard Link */}
          {isDeveloper && (
            <Pressable
              className="flex-row items-center justify-between px-4 py-4 border-t border-gray-100"
              onPress={() => router.push('/developer')}
            >
              <View>
                <Text className="text-base font-medium text-gray-900">
                  Developer Dashboard
                </Text>
                <Text className="text-xs text-gray-500 mt-0.5">
                  Manage your bounties
                </Text>
              </View>
              <Text className="text-gray-400">›</Text>
            </Pressable>
          )}
        </View>

        {/* Sign Out */}
        <Pressable
          className="mt-6 py-4 rounded-xl items-center bg-gray-100"
          onPress={handleSignOut}
        >
          <Text className="text-base font-semibold text-red-600">
            Sign Out
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
