import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCreateBounty } from '../../hooks/useBounties';
import { useZonesSummary } from '../../hooks/useContractZones';
import { colors } from '../../constants/colors';

export default function CreateBountyScreen() {
  const createBounty = useCreateBounty();
  const { data: zonesSummary } = useZonesSummary();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [zoneType, setZoneType] = useState<'zip_code' | 'street_corridor'>('zip_code');
  const [zoneIdentifier, setZoneIdentifier] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [bountyAmount, setBountyAmount] = useState('');
  const [totalBudget, setTotalBudget] = useState('');
  const [treeTarget, setTreeTarget] = useState('');
  const [bonusThreshold, setBonusThreshold] = useState('');
  const [bonusAmount, setBonusAmount] = useState('');
  const [startsAt, setStartsAt] = useState(new Date().toISOString().slice(0, 10));
  const [expiresAt, setExpiresAt] = useState('');

  const activeZones = zonesSummary?.zones?.filter((z) => z.status === 'active') || [];

  const handleSubmit = async () => {
    if (!title || !description || !zoneIdentifier || !bountyAmount || !totalBudget || !treeTarget || !expiresAt) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }

    const amountCents = Math.round(parseFloat(bountyAmount) * 100);
    const budgetCents = Math.round(parseFloat(totalBudget) * 100);
    const target = parseInt(treeTarget, 10);

    if (isNaN(amountCents) || isNaN(budgetCents) || isNaN(target)) {
      Alert.alert('Invalid Numbers', 'Please enter valid numbers for amounts and target.');
      return;
    }

    try {
      await createBounty.mutateAsync({
        contractZoneId: selectedZoneId || undefined,
        title,
        description,
        zoneType,
        zoneIdentifier,
        bountyAmountCents: amountCents,
        bonusThreshold: bonusThreshold ? parseInt(bonusThreshold, 10) : undefined,
        bonusAmountCents: bonusAmount ? Math.round(parseFloat(bonusAmount) * 100) : undefined,
        totalBudgetCents: budgetCents,
        startsAt: new Date(startsAt).toISOString(),
        expiresAt: new Date(expiresAt).toISOString(),
        treeTargetCount: target,
      });

      Alert.alert('Bounty Created', 'Your bounty has been created successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create bounty');
    }
  };

  const inputClass = 'bg-white border border-gray-200 rounded-xl px-4 py-3 text-base text-gray-900';
  const labelClass = 'text-sm font-medium text-gray-700 mb-1';

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-2xl font-bold text-gray-900">Create Bounty</Text>
          <Pressable
            className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
            onPress={() => router.back()}
          >
            <Text className="text-lg">✕</Text>
          </Pressable>
        </View>

        {/* Form */}
        <View className="gap-4 mb-8">
          {/* Title */}
          <View>
            <Text className={labelClass}>Title *</Text>
            <TextInput
              className={inputClass}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Map East Austin Trees"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Description */}
          <View>
            <Text className={labelClass}>Description *</Text>
            <TextInput
              className={`${inputClass} min-h-[80px]`}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe what needs to be mapped..."
              placeholderTextColor="#9CA3AF"
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Zone Type */}
          <View>
            <Text className={labelClass}>Zone Type</Text>
            <View className="flex-row gap-2">
              <Pressable
                className={`flex-1 py-3 rounded-xl items-center border ${
                  zoneType === 'zip_code' ? 'border-transparent' : 'border-gray-200 bg-white'
                }`}
                style={zoneType === 'zip_code' ? { backgroundColor: colors.primary } : undefined}
                onPress={() => setZoneType('zip_code')}
              >
                <Text className={`text-sm font-medium ${zoneType === 'zip_code' ? 'text-white' : 'text-gray-700'}`}>
                  Zip Code
                </Text>
              </Pressable>
              <Pressable
                className={`flex-1 py-3 rounded-xl items-center border ${
                  zoneType === 'street_corridor' ? 'border-transparent' : 'border-gray-200 bg-white'
                }`}
                style={zoneType === 'street_corridor' ? { backgroundColor: colors.primary } : undefined}
                onPress={() => setZoneType('street_corridor')}
              >
                <Text className={`text-sm font-medium ${zoneType === 'street_corridor' ? 'text-white' : 'text-gray-700'}`}>
                  Street Corridor
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Zone Identifier */}
          <View>
            <Text className={labelClass}>Zone Identifier *</Text>
            <TextInput
              className={inputClass}
              value={zoneIdentifier}
              onChangeText={setZoneIdentifier}
              placeholder={zoneType === 'zip_code' ? 'e.g. 78741' : 'e.g. Congress Ave'}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Link to existing zone */}
          {activeZones.length > 0 && (
            <View>
              <Text className={labelClass}>Link to Existing Zone (optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  <Pressable
                    className={`px-3 py-2 rounded-full border ${
                      !selectedZoneId ? 'border-transparent' : 'border-gray-200 bg-white'
                    }`}
                    style={!selectedZoneId ? { backgroundColor: colors.cooldown } : undefined}
                    onPress={() => setSelectedZoneId(null)}
                  >
                    <Text className={`text-xs font-medium ${!selectedZoneId ? 'text-white' : 'text-gray-700'}`}>
                      None
                    </Text>
                  </Pressable>
                  {activeZones.map((zone) => (
                    <Pressable
                      key={zone.id}
                      className={`px-3 py-2 rounded-full border ${
                        selectedZoneId === zone.id ? 'border-transparent' : 'border-gray-200 bg-white'
                      }`}
                      style={selectedZoneId === zone.id ? { backgroundColor: colors.primary } : undefined}
                      onPress={() => setSelectedZoneId(zone.id)}
                    >
                      <Text className={`text-xs font-medium ${selectedZoneId === zone.id ? 'text-white' : 'text-gray-700'}`}>
                        {zone.displayName}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Bounty Amount */}
          <View>
            <Text className={labelClass}>Bounty per Tree ($) *</Text>
            <TextInput
              className={inputClass}
              value={bountyAmount}
              onChangeText={setBountyAmount}
              placeholder="0.50"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
            />
          </View>

          {/* Total Budget */}
          <View>
            <Text className={labelClass}>Total Budget ($) *</Text>
            <TextInput
              className={inputClass}
              value={totalBudget}
              onChangeText={setTotalBudget}
              placeholder="500.00"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
            />
          </View>

          {/* Tree Target */}
          <View>
            <Text className={labelClass}>Target Tree Count *</Text>
            <TextInput
              className={inputClass}
              value={treeTarget}
              onChangeText={setTreeTarget}
              placeholder="1000"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
            />
          </View>

          {/* Bonus */}
          <View>
            <Text className={labelClass}>Bonus Threshold (optional)</Text>
            <View className="flex-row gap-2">
              <TextInput
                className={`${inputClass} flex-1`}
                value={bonusThreshold}
                onChangeText={setBonusThreshold}
                placeholder="After N trees"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
              />
              <TextInput
                className={`${inputClass} flex-1`}
                value={bonusAmount}
                onChangeText={setBonusAmount}
                placeholder="$ per tree"
                placeholderTextColor="#9CA3AF"
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Dates */}
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Text className={labelClass}>Start Date *</Text>
              <TextInput
                className={inputClass}
                value={startsAt}
                onChangeText={setStartsAt}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9CA3AF"
              />
            </View>
            <View className="flex-1">
              <Text className={labelClass}>End Date *</Text>
              <TextInput
                className={inputClass}
                value={expiresAt}
                onChangeText={setExpiresAt}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>
        </View>

        {/* Submit */}
        <Pressable
          className="py-4 rounded-xl items-center mb-8"
          style={{
            backgroundColor: createBounty.isPending ? colors.cooldown : colors.bounty,
          }}
          onPress={handleSubmit}
          disabled={createBounty.isPending}
        >
          {createBounty.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-lg">
              Create Bounty
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
