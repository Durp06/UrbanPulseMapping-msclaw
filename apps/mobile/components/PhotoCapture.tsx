import React, { useRef, useState } from 'react';
import { View, Text, Pressable, Image, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Asset } from 'expo-asset';
import { colors } from '../constants/colors';
import { detectBlur } from '../lib/blur-detection';

interface PhotoCaptureProps {
  instruction: string;
  tips: string;
  overlayType: 'full_tree' | 'bark';
  onCapture: (uri: string) => void;
  onCancel: () => void;
}

const DEV_SAMPLE_MAP: Record<string, any> = {
  full_tree: require('../assets/dev/sample-tree-angle1.jpg'),
  bark: require('../assets/dev/sample-bark.jpg'),
};

export function PhotoCapture({
  instruction,
  tips,
  overlayType,
  onCapture,
  onCancel,
}: PhotoCaptureProps) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [preview, setPreview] = useState<string | null>(null);
  const [showTips, setShowTips] = useState(false);

  const checkBlurAndSetPreview = async (uri: string) => {
    const { isBlurry } = await detectBlur(uri);

    if (isBlurry) {
      Alert.alert(
        'Photo looks blurry',
        'This photo might be blurry. Would you like to retake it?',
        [
          { text: 'Retake', onPress: () => setPreview(null) },
          { text: 'Use Anyway', onPress: () => setPreview(uri) },
        ]
      );
    } else {
      setPreview(uri);
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) {
        await checkBlurAndSetPreview(photo.uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to capture photo');
    }
  };

  const handleUseSample = async () => {
    try {
      const asset = Asset.fromModule(DEV_SAMPLE_MAP[overlayType]);
      await asset.downloadAsync();
      if (asset.localUri) {
        setPreview(asset.localUri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load sample photo');
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await checkBlurAndSetPreview(result.assets[0].uri);
    }
  };

  // Preview mode
  if (preview) {
    return (
      <View className="flex-1 bg-black">
        <Image
          source={{ uri: preview }}
          className="flex-1"
          resizeMode="contain"
        />
        <View className="absolute bottom-10 left-0 right-0 flex-row justify-center gap-6 px-6">
          <Pressable
            className="flex-1 py-4 rounded-xl bg-gray-700 items-center"
            onPress={() => setPreview(null)}
          >
            <Text className="text-white font-semibold text-lg">Retake</Text>
          </Pressable>
          <Pressable
            className="flex-1 py-4 rounded-xl items-center"
            style={{ backgroundColor: colors.primary }}
            onPress={() => onCapture(preview)}
          >
            <Text className="text-white font-semibold text-lg">Use Photo</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Camera permission not granted
  if (!permission?.granted) {
    return (
      <View className="flex-1 bg-black items-center justify-center px-8">
        <Text className="text-white text-lg text-center mb-6">
          Camera access is needed to photograph trees.
        </Text>
        <Pressable
          className="py-3 px-8 rounded-xl"
          style={{ backgroundColor: colors.primary }}
          onPress={requestPermission}
        >
          <Text className="text-white font-semibold text-lg">
            Grant Camera Access
          </Text>
        </Pressable>
        {__DEV__ && (
          <Pressable
            className="mt-4 py-3 px-8 rounded-xl bg-gray-700"
            onPress={handleUseSample}
          >
            <Text className="text-white font-semibold">Use Sample Photo</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView
        ref={cameraRef}
        className="flex-1"
        facing="back"
      >
        {/* Instruction banner */}
        <View className="absolute top-12 left-4 right-4 bg-black/60 rounded-xl p-3">
          <Text className="text-white text-center font-semibold">
            {instruction}
          </Text>
        </View>

        {/* Overlay guides */}
        {overlayType === 'full_tree' && (
          <View className="absolute inset-0 items-center justify-center">
            <View className="w-48 h-80 border-2 border-white/40 rounded-3xl" />
          </View>
        )}
        {overlayType === 'bark' && (
          <View className="absolute inset-0 items-center justify-center">
            <View className="w-56 h-56 border-2 border-white/40 rounded-2xl" />
          </View>
        )}

        {/* Tips overlay */}
        {showTips && (
          <Pressable
            className="absolute inset-0 bg-black/80 items-center justify-center px-8"
            onPress={() => setShowTips(false)}
          >
            <Text className="text-white text-lg text-center leading-7">
              {tips}
            </Text>
            <Text className="text-gray-400 mt-4">Tap to dismiss</Text>
          </Pressable>
        )}

        {/* Bottom controls */}
        <View className="absolute bottom-8 left-0 right-0">
          <View className="flex-row items-center justify-between px-8">
            <Pressable onPress={onCancel}>
              <Text className="text-white text-lg">Cancel</Text>
            </Pressable>

            {/* Capture button */}
            <Pressable
              className="w-20 h-20 rounded-full border-4 border-white items-center justify-center"
              onPress={handleCapture}
            >
              <View
                className="w-16 h-16 rounded-full"
                style={{ backgroundColor: colors.primary }}
              />
            </Pressable>

            <Pressable onPress={() => setShowTips(true)}>
              <Text className="text-white text-lg">Tips</Text>
            </Pressable>
          </View>

          {/* Dev mode options */}
          {__DEV__ && (
            <View className="flex-row justify-center gap-4 mt-4">
              <Pressable
                className="py-2 px-4 rounded-lg bg-gray-700"
                onPress={handleUseSample}
              >
                <Text className="text-white text-sm">Use Sample</Text>
              </Pressable>
              <Pressable
                className="py-2 px-4 rounded-lg bg-gray-700"
                onPress={handlePickImage}
              >
                <Text className="text-white text-sm">Pick Image</Text>
              </Pressable>
            </View>
          )}
        </View>
      </CameraView>
    </View>
  );
}
