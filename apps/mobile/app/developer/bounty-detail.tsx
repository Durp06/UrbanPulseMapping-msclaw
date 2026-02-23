import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBounty, useBountyLeaderboard, useUpdateBounty } from '../../hooks/useBounties';
import { useAuth } from '../../hooks/useAuth';
import { colors } from '../../constants/colors';
import type { BountyStatus } from '@urban-pulse/shared-types';

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

const STATUS_LABELS: Record<BountyStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: colors.cooldown },
  active: { label: 'Active', color: colors.primary },
  paused: { label: 'Paused', color: colors.warning },
  completed: { label: 'Completed', color: '#3B82F6' },
  expired: { label: 'Expired', color: colors.error },
};

type StatusAction = { label: string; newStatus: BountyStatus; color: string };

function getStatusActions(status: BountyStatus): StatusAction[] {
  switch (status) {
    case 'draft':
      return [{ label: 'Activate', newStatus: 'active', color: colors.primary }];
    case 'active':
      return [
        { label: 'Pause', newStatus: 'paused', color: colors.warning },
        { label: 'Complete', newStatus: 'completed', color: '#3B82F6' },
      ];
    case 'paused':
      return [{ label: 'Resume', newStatus: 'active', color: colors.primary }];
    default:
      return [];
  }
}

export default function BountyDetailScreen() {
  const { id, readonly } = useLocalSearchParams<{ id: string; readonly?: string }>();
  const { user } = useAuth();
  const { data, isLoading } = useBounty(id ?? null);
  const { data: leaderboardData } = useBountyLeaderboard(id ?? null);
  const updateBounty = useUpdateBounty();

  const bounty = data?.bounty;
  const leaderboard = leaderboardData?.leaderboard || [];
  const isOwner = bounty && user && bounty.creatorId === user.id;
  const isReadOnly = readonly === 'true' || !isOwner;
  const isDraft = bounty?.status === 'draft';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amountCents, setAmountCents] = useState('');
  const [budgetCents, setBudgetCents] = useState('');
  const [targetCount, setTargetCount] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (bounty) {
      setTitle(bounty.title);
      setDescription(bounty.description);
      setAmountCents(String(bounty.bountyAmountCents));
      setBudgetCents(String(bounty.totalBudgetCents));
      setTargetCount(String(bounty.treeTargetCount));
    }
  }, [bounty]);

  if (isLoading || !bounty) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const statusInfo = STATUS_LABELS[bounty.status as BountyStatus] || STATUS_LABELS.draft;
  const progressPct = bounty.treeTargetCount > 0
    ? Math.min(100, Math.round((bounty.treesCompleted / bounty.treeTargetCount) * 100))
    : 0;

  const handleSave = () => {
    const updates: Record<string, unknown> = {};
    if (title !== bounty.title) updates.title = title;
    if (description !== bounty.description) updates.description = description;
    if (isDraft) {
      const amt = parseInt(amountCents, 10);
      if (!isNaN(amt) && amt !== bounty.bountyAmountCents) updates.bountyAmountCents = amt;
      const bud = parseInt(budgetCents, 10);
      if (!isNaN(bud) && bud !== bounty.totalBudgetCents) updates.totalBudgetCents = bud;
      const tgt = parseInt(targetCount, 10);
      if (!isNaN(tgt) && tgt !== bounty.treeTargetCount) updates.treeTargetCount = tgt;
    }

    if (Object.keys(updates).length === 0) {
      setEditing(false);
      return;
    }

    updateBounty.mutate(
      { id: bounty.id, data: updates },
      {
        onSuccess: () => setEditing(false),
        onError: () => Alert.alert('Error', 'Failed to update bounty.'),
      }
    );
  };

  const handleStatusChange = (newStatus: BountyStatus) => {
    const label = newStatus === 'active' ? 'activate' : newStatus;
    Alert.alert(
      'Confirm',
      `Are you sure you want to ${label} this bounty?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => {
            updateBounty.mutate(
              { id: bounty.id, data: { status: newStatus } },
              { onError: () => Alert.alert('Error', 'Failed to update status.') }
            );
          },
        },
      ]
    );
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Bounty',
      'This will permanently delete this draft bounty. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // Delete is a status change to completed/cancelled — for now just go back
            // A real delete endpoint could be added later
            router.back();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4 pt-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <Pressable
            className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center"
            onPress={() => router.back()}
          >
            <Text className="text-lg">←</Text>
          </Pressable>
          <View
            className="px-3 py-1 rounded-full"
            style={{ backgroundColor: statusInfo.color }}
          >
            <Text className="text-xs font-bold text-white">
              {statusInfo.label}
            </Text>
          </View>
          {!isReadOnly && !editing && (
            <Pressable
              className="px-3 py-2 rounded-lg bg-gray-100"
              onPress={() => setEditing(true)}
            >
              <Text className="text-sm font-medium text-gray-700">Edit</Text>
            </Pressable>
          )}
          {editing && (
            <Pressable
              className="px-3 py-2 rounded-lg"
              style={{ backgroundColor: colors.primary }}
              onPress={handleSave}
              disabled={updateBounty.isPending}
            >
              {updateBounty.isPending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-sm font-medium text-white">Save</Text>
              )}
            </Pressable>
          )}
          {isReadOnly && <View className="w-10" />}
        </View>

        {/* Title & Description */}
        {editing ? (
          <View className="mb-4">
            <Text className="text-xs font-medium text-gray-500 mb-1">Title</Text>
            <TextInput
              className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-900"
              value={title}
              onChangeText={setTitle}
            />
            <Text className="text-xs font-medium text-gray-500 mt-3 mb-1">Description</Text>
            <TextInput
              className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-900"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </View>
        ) : (
          <View className="mb-4">
            <Text className="text-xl font-bold text-gray-900">{bounty.title}</Text>
            <Text className="text-sm text-gray-600 mt-1">{bounty.description}</Text>
          </View>
        )}

        {/* Progress Card */}
        <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
          <Text className="text-sm font-medium text-gray-500 mb-2">Progress</Text>
          <View className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
            <View
              className="h-full rounded-full"
              style={{
                width: `${progressPct}%`,
                backgroundColor: statusInfo.color,
              }}
            />
          </View>
          <View className="flex-row justify-between">
            <Text className="text-sm font-semibold text-gray-900">
              {bounty.treesCompleted}/{bounty.treeTargetCount} trees
            </Text>
            <Text className="text-sm font-semibold" style={{ color: statusInfo.color }}>
              {progressPct}%
            </Text>
          </View>
        </View>

        {/* Financials */}
        <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
          <Text className="text-sm font-medium text-gray-500 mb-3">Financials</Text>
          {editing && isDraft ? (
            <View>
              <View className="flex-row gap-3 mb-3">
                <View className="flex-1">
                  <Text className="text-xs text-gray-500 mb-1">Amount/tree (cents)</Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    value={amountCents}
                    onChangeText={setAmountCents}
                    keyboardType="numeric"
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-gray-500 mb-1">Total budget (cents)</Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    value={budgetCents}
                    onChangeText={setBudgetCents}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <View>
                <Text className="text-xs text-gray-500 mb-1">Target tree count</Text>
                <TextInput
                  className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={targetCount}
                  onChangeText={setTargetCount}
                  keyboardType="numeric"
                />
              </View>
            </View>
          ) : (
            <View className="gap-2">
              <View className="flex-row justify-between">
                <Text className="text-sm text-gray-600">Per tree</Text>
                <Text className="text-sm font-semibold text-gray-900">
                  {formatCents(bounty.bountyAmountCents)}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-gray-600">Total budget</Text>
                <Text className="text-sm font-semibold text-gray-900">
                  {formatCents(bounty.totalBudgetCents)}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-gray-600">Spent</Text>
                <Text className="text-sm font-semibold text-gray-900">
                  {formatCents(bounty.spentCents)}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm text-gray-600">Remaining</Text>
                <Text className="text-sm font-semibold" style={{ color: colors.bounty }}>
                  {formatCents(bounty.totalBudgetCents - bounty.spentCents)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Dates */}
        <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
          <Text className="text-sm font-medium text-gray-500 mb-2">Schedule</Text>
          <View className="flex-row justify-between">
            <Text className="text-sm text-gray-600">Starts</Text>
            <Text className="text-sm font-medium text-gray-900">
              {new Date(bounty.startsAt).toLocaleDateString()}
            </Text>
          </View>
          <View className="flex-row justify-between mt-1">
            <Text className="text-sm text-gray-600">Expires</Text>
            <Text className="text-sm font-medium text-gray-900">
              {new Date(bounty.expiresAt).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Status Actions (owner only) */}
        {!isReadOnly && !editing && (
          <View className="mb-4">
            {getStatusActions(bounty.status as BountyStatus).length > 0 && (
              <View className="flex-row gap-3">
                {getStatusActions(bounty.status as BountyStatus).map((action) => (
                  <Pressable
                    key={action.newStatus}
                    className="flex-1 py-3 rounded-xl items-center"
                    style={{ backgroundColor: action.color }}
                    onPress={() => handleStatusChange(action.newStatus)}
                  >
                    <Text className="text-white font-semibold">{action.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
            <Text className="text-sm font-medium text-gray-500 mb-3">
              Top Contributors
            </Text>
            {leaderboard.map((entry: any, index: number) => (
              <View
                key={entry.userId}
                className="flex-row items-center justify-between py-2 border-b border-gray-50"
              >
                <View className="flex-row items-center gap-3">
                  <Text className="text-sm font-bold text-gray-400 w-6">
                    #{index + 1}
                  </Text>
                  <Text className="text-sm font-medium text-gray-900">
                    {entry.displayName || 'Anonymous'}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-sm font-semibold" style={{ color: colors.bounty }}>
                    {formatCents(entry.totalEarnedCents)}
                  </Text>
                  <Text className="text-xs text-gray-400">
                    {entry.treesCount} trees
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Read-only: View on Map button */}
        {isReadOnly && (
          <Pressable
            className="py-4 rounded-xl items-center mb-4"
            style={{ backgroundColor: colors.primary }}
            onPress={() => {
              router.dismissAll();
            }}
          >
            <Text className="text-white font-semibold text-base">View on Map</Text>
          </Pressable>
        )}

        {/* Delete (draft only, owner only) */}
        {!isReadOnly && isDraft && !editing && (
          <Pressable
            className="py-3 rounded-xl items-center mb-6 bg-red-50"
            onPress={handleDelete}
          >
            <Text className="text-red-600 font-semibold">Delete Draft</Text>
          </Pressable>
        )}

        <View className="h-6" />
      </ScrollView>
    </SafeAreaView>
  );
}
