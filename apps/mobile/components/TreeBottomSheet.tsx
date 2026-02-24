import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { colors } from '../constants/colors';
import type { Tree } from '@urban-pulse/shared-types';

interface TreeBottomSheetProps {
  tree: Tree;
  onClose: () => void;
  onViewDetails?: (tree: Tree) => void;
}

function getStatusInfo(tree: Tree): { label: string; color: string } {
  const now = new Date();
  if (tree.cooldownUntil && new Date(tree.cooldownUntil) > now) {
    return { label: 'On Cooldown', color: colors.cooldown };
  }
  if (tree.verificationTier === 'unverified') {
    return { label: 'Pending', color: colors.warning };
  }
  if (
    tree.verificationTier === 'ai_verified' ||
    tree.verificationTier === 'community_verified' ||
    tree.verificationTier === 'expert_verified'
  ) {
    return { label: 'Verified', color: colors.primary };
  }
  return { label: 'Unverified', color: colors.cooldown };
}

function getRelativeTime(dateString: string | null): string {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

function getCooldownRemaining(cooldownUntil: string | null): string | null {
  if (!cooldownUntil) return null;
  const until = new Date(cooldownUntil);
  const now = new Date();
  if (until <= now) return null;

  const diffMs = until.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return `Available again in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
}

export function TreeBottomSheet({
  tree,
  onClose,
  onViewDetails,
}: TreeBottomSheetProps) {
  const status = getStatusInfo(tree);
  const speciesName =
    tree.speciesCommon || tree.speciesScientific || 'Unknown Species';
  const scientificName = tree.speciesScientific;
  const cooldownText = getCooldownRemaining(tree.cooldownUntil);

  return (
    <Pressable
      className="absolute inset-0 justify-end"
      onPress={onClose}
    >
      <Pressable
        className="bg-white rounded-t-3xl px-5 pt-3 pb-8 shadow-2xl"
        onPress={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <View className="items-center mb-4">
          <View className="w-10 h-1 rounded-full bg-gray-300" />
        </View>

        <View className="flex-row">
          {/* Photo thumbnail */}
          <View className="w-20 h-20 rounded-xl bg-gray-100 mr-4 overflow-hidden items-center justify-center">
            {tree.speciesCommon ? (
              <Text className="text-3xl">🌳</Text>
            ) : (
              <Text className="text-3xl">🌿</Text>
            )}
          </View>

          {/* Info */}
          <View className="flex-1">
            <View className="flex-row items-center mb-1">
              <Text
                className="text-lg font-bold text-gray-900 flex-1 mr-2"
                numberOfLines={1}
              >
                {speciesName}
              </Text>
              <View
                className="px-2.5 py-0.5 rounded-full"
                style={{ backgroundColor: status.color }}
              >
                <Text className="text-xs font-semibold text-white">
                  {status.label}
                </Text>
              </View>
            </View>

            {scientificName && scientificName !== speciesName && (
              <Text
                className="text-sm italic text-gray-500 mb-1"
                numberOfLines={1}
              >
                {scientificName}
              </Text>
            )}

            <Text className="text-sm text-gray-500">
              Observed {tree.observationCount} time
              {tree.observationCount !== 1 ? 's' : ''}
            </Text>

            <Text className="text-xs text-gray-400 mt-0.5">
              Last seen {getRelativeTime(tree.lastObservedAt)}
            </Text>
          </View>
        </View>

        {/* Cooldown info */}
        {cooldownText && (
          <View className="mt-3 bg-gray-50 rounded-xl px-4 py-2.5">
            <Text className="text-sm text-gray-500">{cooldownText}</Text>
          </View>
        )}

        {/* View Details button */}
        <Pressable
          className="mt-4 py-3.5 rounded-xl items-center"
          style={{ backgroundColor: colors.primary }}
          onPress={() => onViewDetails?.(tree)}
        >
          <Text className="text-white font-semibold text-base">
            View Details
          </Text>
        </Pressable>
      </Pressable>
    </Pressable>
  );
}
