import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useScanStore } from '../../lib/store';
import { useSubmission } from '../../hooks/useSubmission';
import { colors } from '../../constants/colors';
import type {
  ConditionRating,
  LocationType,
  SiteType,
  MaintenanceFlag,
} from '@urban-pulse/shared-types';

// --- Reusable Components ---

function SectionHeader({ title }: { title: string }) {
  return (
    <View className="bg-gray-100 px-4 py-2 -mx-4 mb-3 mt-4">
      <Text className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
        {title}
      </Text>
    </View>
  );
}

function RequiredBadge() {
  return (
    <View className="bg-red-100 px-2 py-0.5 rounded ml-2">
      <Text className="text-red-600 text-xs font-medium">Required</Text>
    </View>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  labels,
}: {
  options: T[];
  value: T | null;
  onChange: (val: T) => void;
  labels?: Record<T, string>;
}) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 12, padding: 4 }}>
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <Pressable
            key={opt}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 8,
              alignItems: 'center',
              backgroundColor: selected ? '#fff' : 'transparent',
              ...(selected ? { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 } : {}),
            }}
            onPress={() => onChange(opt)}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '500',
                color: selected ? '#111827' : '#6B7280',
              }}
            >
              {labels ? labels[opt] : opt.charAt(0).toUpperCase() + opt.slice(1)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ChipSelector<T extends string>({
  options,
  selected,
  onToggle,
  labels,
}: {
  options: T[];
  selected: Set<T> | T | null;
  onToggle: (val: T) => void;
  labels?: Record<T, string>;
}) {
  const isSelected = (opt: T) => {
    if (selected instanceof Set) return selected.has(opt);
    return selected === opt;
  };

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((opt) => {
        const active = isSelected(opt);
        return (
          <Pressable
            key={opt}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 9999,
              borderWidth: 1,
              borderColor: active ? colors.primary : '#E5E7EB',
              backgroundColor: active ? `${colors.primary}15` : '#fff',
            }}
            onPress={() => onToggle(opt)}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '500',
                color: active ? colors.primary : '#4B5563',
              }}
            >
              {labels ? labels[opt] : opt.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (val: boolean) => void;
}) {
  return (
    <View className="flex-row items-center justify-between py-3 border-b border-gray-100">
      <Text className="text-base text-gray-800">{label}</Text>
      <Switch
        value={value === true}
        onValueChange={onChange}
        trackColor={{ false: '#E5E7EB', true: colors.accentLight }}
        thumbColor={value === true ? colors.primary : '#f4f3f4'}
      />
    </View>
  );
}

function AIPlaceholder({ label }: { label: string }) {
  return (
    <View className="flex-row items-center justify-between py-3 border-b border-gray-100">
      <Text className="text-base text-gray-800">{label}</Text>
      <View className="flex-row items-center">
        <ActivityIndicator size="small" color={colors.cooldown} />
        <Text className="ml-2 text-sm text-gray-400 italic">Pending AI analysis...</Text>
      </View>
    </View>
  );
}

// --- Main Screen ---

export default function InspectionScreen() {
  const scanState = useScanStore();
  const { inspection, setInspection } = scanState;
  const { submit, isSubmitting, uploadProgress, error } = useSubmission();

  // Reverse geocode on mount
  useEffect(() => {
    const reverseGeocode = async () => {
      if (!scanState.latitude || !scanState.longitude) return;
      try {
        const results = await Location.reverseGeocodeAsync({
          latitude: scanState.latitude,
          longitude: scanState.longitude,
        });
        if (results.length > 0) {
          const addr = results[0];
          const parts = [
            addr.streetNumber,
            addr.street,
            addr.city,
            addr.region,
            addr.postalCode,
          ].filter(Boolean);
          const addressStr = parts.join(' ');
          if (addressStr) {
            setInspection({ nearestAddress: addressStr });
          }
        }
      } catch {
        // Non-fatal — user can enter manually
      }
    };
    reverseGeocode();
  }, [scanState.latitude, scanState.longitude]);

  // Progress calculation
  const progress = useMemo(() => {
    let filled = 0;
    let total = 6; // Required + important fields
    if (inspection.conditionRating) filled++;
    if (inspection.crownDieback !== null) filled++;
    if (inspection.maintenanceFlag) filled++;
    if (inspection.locationType) filled++;
    if (inspection.siteType) filled++;
    if (inspection.riskFlag !== null) filled++;
    return { filled, total, pct: Math.round((filled / total) * 100) };
  }, [inspection]);

  const canSubmit = inspection.conditionRating !== null;

  const handleSubmit = () => {
    submit(undefined, {
      onSuccess: () => {
        router.replace('/scan/success');
      },
    });
  };

  // Trunk defect chip handling
  const activeDefects = useMemo(() => {
    const s = new Set<string>();
    if (inspection.trunkDefects.cavity) s.add('cavity');
    if (inspection.trunkDefects.crack) s.add('crack');
    if (inspection.trunkDefects.lean) s.add('lean');
    if (s.size === 0) s.add('none');
    return s;
  }, [inspection.trunkDefects]);

  const toggleDefect = (defect: string) => {
    if (defect === 'none') {
      setInspection({
        trunkDefects: { cavity: false, crack: false, lean: false },
      });
      return;
    }
    const current = inspection.trunkDefects;
    setInspection({
      trunkDefects: {
        ...current,
        [defect]: !current[defect as keyof typeof current],
      },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Progress bar */}
      <View className="px-4 pt-3 pb-1">
        <View className="flex-row items-center justify-between mb-1">
          <Text className="text-sm text-gray-500">
            Inspection Details
          </Text>
          <Text className="text-sm font-medium text-gray-600">
            {progress.filled}/{progress.total} fields
          </Text>
        </View>
        <View className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <View
            className="h-full rounded-full"
            style={{
              backgroundColor: colors.primary,
              width: `${progress.pct}%`,
            }}
          />
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Section 1: Tree Condition */}
        <SectionHeader title="Tree Condition" />

        <View className="mb-3">
          <View className="flex-row items-center mb-2">
            <Text className="text-base font-medium text-gray-800">
              Condition Rating
            </Text>
            <RequiredBadge />
          </View>
          <SegmentedControl<ConditionRating>
            options={['good', 'fair', 'poor', 'dead']}
            value={inspection.conditionRating}
            onChange={(val) => setInspection({ conditionRating: val })}
            labels={{ good: 'Good', fair: 'Fair', poor: 'Poor', dead: 'Dead' }}
          />
        </View>

        <ToggleRow
          label="Crown Dieback Visible"
          value={inspection.crownDieback}
          onChange={(val) => setInspection({ crownDieback: val })}
        />

        <View className="mt-3 mb-3">
          <Text className="text-base font-medium text-gray-800 mb-2">
            Trunk Defects
          </Text>
          <ChipSelector
            options={['cavity', 'crack', 'lean', 'none']}
            selected={activeDefects}
            onToggle={toggleDefect}
            labels={{
              cavity: 'Cavity',
              crack: 'Crack',
              lean: 'Lean',
              none: 'None',
            }}
          />
        </View>

        <ToggleRow
          label="Risk Flag (obvious structural defect)"
          value={inspection.riskFlag}
          onChange={(val) => setInspection({ riskFlag: val })}
        />

        <View className="mt-3 mb-3">
          <Text className="text-base font-medium text-gray-800 mb-2">
            Maintenance Needed
          </Text>
          <SegmentedControl<MaintenanceFlag>
            options={['prune', 'remove', 'none']}
            value={inspection.maintenanceFlag}
            onChange={(val) => setInspection({ maintenanceFlag: val })}
            labels={{ prune: 'Prune', remove: 'Remove', none: 'None' }}
          />
        </View>

        {/* Section 2: Location & Site */}
        <SectionHeader title="Location & Site" />

        <View className="mb-3">
          <Text className="text-base font-medium text-gray-800 mb-2">
            Location Type
          </Text>
          <ChipSelector<LocationType>
            options={['street_tree', 'park', 'median', 'row']}
            selected={inspection.locationType}
            onToggle={(val) => setInspection({ locationType: val })}
            labels={{
              street_tree: 'Street Tree',
              park: 'Park',
              median: 'Median',
              row: 'ROW',
            }}
          />
        </View>

        <View className="mb-3">
          <Text className="text-base font-medium text-gray-800 mb-2">
            Site Type
          </Text>
          <ChipSelector<SiteType>
            options={['tree_lawn', 'cutout', 'open_ground', 'planter']}
            selected={inspection.siteType}
            onToggle={(val) => setInspection({ siteType: val })}
            labels={{
              tree_lawn: 'Tree Lawn',
              cutout: 'Cutout',
              open_ground: 'Open Ground',
              planter: 'Planter',
            }}
          />
        </View>

        <ToggleRow
          label="Overhead Utility Conflict"
          value={inspection.overheadUtilityConflict}
          onChange={(val) => setInspection({ overheadUtilityConflict: val })}
        />

        <ToggleRow
          label="Sidewalk Damage from Roots"
          value={inspection.sidewalkDamage}
          onChange={(val) => setInspection({ sidewalkDamage: val })}
        />

        {/* Section 3: Additional Notes */}
        <SectionHeader title="Additional Notes" />

        <View className="mb-3">
          <Text className="text-base font-medium text-gray-800 mb-2">
            Mulch/Soil Condition
          </Text>
          <TextInput
            className="bg-white border border-gray-200 rounded-xl p-3 text-base text-gray-900"
            placeholder='e.g., "bare soil", "mulch ring", "compacted"'
            placeholderTextColor="#9CA3AF"
            value={inspection.mulchSoilCondition}
            onChangeText={(val) => setInspection({ mulchSoilCondition: val })}
            maxLength={100}
          />
        </View>

        <View className="mb-3">
          <Text className="text-base font-medium text-gray-800 mb-2">
            Nearest Address
          </Text>
          <TextInput
            className="bg-white border border-gray-200 rounded-xl p-3 text-base text-gray-900"
            placeholder="Auto-detected from GPS..."
            placeholderTextColor="#9CA3AF"
            value={inspection.nearestAddress}
            onChangeText={(val) => setInspection({ nearestAddress: val })}
            maxLength={500}
          />
        </View>

        {/* Section 4: AI Estimates (read-only) */}
        <SectionHeader title="AI Estimates" />

        <AIPlaceholder label="Species" />
        <AIPlaceholder label="DBH (cm)" />
        <AIPlaceholder label="Height (m)" />
        <AIPlaceholder label="Canopy Spread (m)" />

        <View className="h-4" />

        {/* Error */}
        {error && (
          <View className="bg-error/10 px-4 py-3 rounded-xl mb-3">
            <Text className="text-error text-sm">
              {error.message}. Your submission has been saved offline and will
              upload when connected.
            </Text>
          </View>
        )}

        {/* Upload progress */}
        {isSubmitting && (
          <View className="mb-3">
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

        {/* Bottom spacer for button */}
        <View className="h-24" />
      </ScrollView>

      {/* Bottom actions */}
      <View className="px-4 pb-4 bg-background border-t border-gray-100">
        <Pressable
          className="py-4 rounded-xl items-center mt-3 mb-2"
          style={{
            backgroundColor:
              !canSubmit || isSubmitting ? colors.cooldown : colors.primary,
          }}
          onPress={handleSubmit}
          disabled={!canSubmit || isSubmitting}
        >
          <Text className="text-white font-semibold text-lg">
            {isSubmitting ? 'Uploading...' : 'Submit Inspection'}
          </Text>
        </Pressable>
        <Pressable
          className="py-2 items-center"
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
