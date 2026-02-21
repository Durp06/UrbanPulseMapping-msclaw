import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { colors } from '../../constants/colors';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      router.replace('/');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.primaryDark }}>
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          className="flex-1 justify-center px-6"
        >
          {/* Logo */}
          <View className="items-center mb-8">
            <Text className="text-4xl mb-2">🌳</Text>
            <Text className="text-2xl font-bold text-white">
              Urban Pulse
            </Text>
            <Text className="text-sm text-white/70 mt-1">
              Map the urban forest
            </Text>
          </View>

          {/* Form card */}
          <View className="bg-white rounded-2xl p-6 shadow-lg">
            <Text className="text-xl font-bold text-gray-900 mb-4">
              Sign In
            </Text>

            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-base text-gray-900 mb-3"
              placeholder="Email"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />

            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-base text-gray-900 mb-4"
              placeholder="Password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <Pressable
              className="py-4 rounded-xl items-center mb-4"
              style={{
                backgroundColor: loading ? colors.cooldown : colors.primary,
              }}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text className="text-white font-semibold text-lg">
                {loading ? 'Signing In...' : 'Sign In'}
              </Text>
            </Pressable>

            {/* Divider */}
            <View className="flex-row items-center mb-4">
              <View className="flex-1 h-px bg-gray-200" />
              <Text className="mx-4 text-gray-400 text-sm">OR</Text>
              <View className="flex-1 h-px bg-gray-200" />
            </View>

            {/* Apple Sign-In */}
            <Pressable className="py-4 rounded-xl items-center bg-black mb-3">
              <Text className="text-white font-semibold text-lg">
                Continue with Apple
              </Text>
            </Pressable>

            {/* Google Sign-In */}
            <Pressable className="py-4 rounded-xl items-center bg-white border border-gray-200">
              <Text className="text-gray-700 font-semibold text-lg">
                Continue with Google
              </Text>
            </Pressable>
          </View>

          <Pressable
            className="mt-6 items-center"
            onPress={() => router.push('/(auth)/register')}
          >
            <Text className="text-white/80">
              Don't have an account?{' '}
              <Text className="font-bold text-white">Register</Text>
            </Text>
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
