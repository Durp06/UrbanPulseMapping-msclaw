import React from 'react';
import { View, Text } from 'react-native';
import { colors } from '../constants/colors';

interface WeeklyActivityChartProps {
  activity: Array<{ date: string; count: number }>;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getDayLabel(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDay();
  // getDay returns 0=Sun, 1=Mon, etc.
  return DAY_LABELS[day === 0 ? 6 : day - 1];
}

export function WeeklyActivityChart({ activity }: WeeklyActivityChartProps) {
  const maxCount = Math.max(1, ...activity.map((a) => a.count));
  const totalScans = activity.reduce((sum, a) => sum + a.count, 0);

  return (
    <View className="mt-4 bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-sm font-semibold text-gray-900">
          This Week's Activity
        </Text>
        <Text className="text-xs text-gray-500">
          {totalScans} scan{totalScans !== 1 ? 's' : ''}
        </Text>
      </View>

      <View className="flex-row items-end justify-between h-24 px-1">
        {activity.map((day, idx) => {
          const barHeight = day.count > 0 ? (day.count / maxCount) * 80 + 4 : 4;
          const isToday = idx === activity.length - 1;

          return (
            <View key={day.date} className="items-center flex-1">
              {/* Count label above bar */}
              {day.count > 0 && (
                <Text className="text-[10px] text-gray-500 mb-0.5">
                  {day.count}
                </Text>
              )}
              {/* Bar */}
              <View
                className="w-6 rounded-t-md"
                style={{
                  height: barHeight,
                  backgroundColor: day.count > 0
                    ? isToday
                      ? colors.primary
                      : colors.accentLight
                    : '#F3F4F6',
                }}
              />
              {/* Day label */}
              <Text
                className={`text-[10px] mt-1 ${
                  isToday ? 'font-bold text-gray-900' : 'text-gray-400'
                }`}
              >
                {getDayLabel(day.date)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
