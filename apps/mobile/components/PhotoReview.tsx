import React from 'react';
import { View, Text, Image, Pressable } from 'react-native';

interface PhotoReviewProps {
  photos: Array<{ uri: string; type: string }>;
  onPhotoPress?: (index: number) => void;
}

const LABELS: Record<string, string> = {
  full_tree_angle1: 'Angle 1',
  full_tree_angle2: 'Angle 2',
  bark_closeup: 'Bark',
};

export function PhotoReview({ photos, onPhotoPress }: PhotoReviewProps) {
  return (
    <View className="flex-row gap-3">
      {photos.map((photo, index) => (
        <Pressable
          key={photo.type}
          className="flex-1"
          onPress={() => onPhotoPress?.(index)}
        >
          <Image
            source={{ uri: photo.uri }}
            className="w-full aspect-square rounded-xl"
            resizeMode="cover"
          />
          <Text className="text-center text-xs text-gray-500 mt-1">
            {LABELS[photo.type] || photo.type}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
