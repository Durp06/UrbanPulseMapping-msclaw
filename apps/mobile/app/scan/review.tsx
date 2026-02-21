import React from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { PhotoReview } from '../../components/PhotoReview';
import { GPSIndicator } from '../../components/GPSIndicator';
import { useScanStore } from '../../lib/store';
import { useSubmission } from '../../hooks/useSubmission';
import { colors } from '../../constants/colors';

export default function ReviewScreen() {
  const scanState = useScanStore();
  const { submit, isSubmitting, uploadProgress, error } = useSubmission();

  const handleSubmit = () => {
    submit(undefined, {
      onSuccess: () => {
        router.replace('/scan/success');
      },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-4 pt-4">
        {/* Header */}
        <Text className="text-2xl font-bold text-gray-900 mb-4">
          Review & Submit
        </Text>

        {/* Photo thumbnails */}
        <PhotoReview
          photos={scanState.photos.map((p) => ({
            uri: p.uri,
            type: p.type,
          }))}
        />

        {/* Map snippet */}
        {scanState.latitude && scanState.longitude && (
          <View className="mt-4 h-36 rounded-xl overflow-hidden">
            <MapView
              className="flex-1"
              provider={PROVIDER_DEFAULT}
              initialRegion={{
                latitude: scanState.latitude,
                longitude: scanState.longitude,
                latitudeDelta: 0.002,
                longitudeDelta: 0.002,
              }}
              scrollEnabled={false}
              zoomEnabled={false}
            >
              <Marker
                coordinate={{
                  latitude: scanState.latitude,
                  longitude: scanState.longitude,
                }}
              />
            </MapView>
          </View>
        )}

        {/* GPS accuracy */}
        <View className="mt-3">
          <GPSIndicator accuracy={scanState.gpsAccuracy} size="large" />
        </View>

        {/* Notes */}
        <TextInput
          className="mt-4 bg-white border border-gray-200 rounded-xl p-4 text-base text-gray-900 min-h-[80px]"
          placeholder="Optional notes about this tree..."
          placeholderTextColor="#9CA3AF"
          multiline
          value={scanState.notes}
          onChangeText={scanState.setNotes}
        />

        {/* Error */}
        {error && (
          <View className="mt-3 bg-error/10 px-4 py-3 rounded-xl">
            <Text className="text-error text-sm">
              {error.message}. Your submission has been saved offline and will
              upload when connected.
            </Text>
          </View>
        )}

        {/* Upload progress */}
        {isSubmitting && (
          <View className="mt-3">
            <View className="flex-row items-center mb-2">
              <ActivityIndicator size="small" color={colors.primary} />
              <Text className="ml-2 text-sm text-gray-500">
                Uploading... {Math.round(uploadProgress * 100)}%
              </Text>
            </View>
            <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <View
                className="h-full rounded-full"
                style={{
                  backgroundColor: colors.primary,
                  width: `${uploadProgress * 100}%`,
                }}
              />
            </View>
          </View>
        )}
      </View>

      {/* Bottom actions */}
      <View className="px-4 pb-4">
        <Pressable
          className="py-4 rounded-xl items-center mb-3"
          style={{
            backgroundColor: isSubmitting ? colors.cooldown : colors.primary,
          }}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          <Text className="text-white font-semibold text-lg">
            {isSubmitting ? 'Uploading...' : 'Submit Tree'}
          </Text>
        </Pressable>
        <Pressable
          className="py-3 items-center"
          onPress={() => {
            scanState.reset();
            router.dismissAll();
          }}
          disabled={isSubmitting}
        >
          <Text className="text-gray-500 font-medium">Cancel</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
