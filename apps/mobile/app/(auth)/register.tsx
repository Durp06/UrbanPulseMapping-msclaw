import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../hooks/useAuth';
import { colors } from '../../constants/colors';

function getFirebaseErrorMessage(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/invalid-email':
      return 'Invalid email address.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection.';
    default:
      return 'Registration failed. Please try again.';
  }
}

export default function RegisterScreen() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp, signInWithApple, signInWithGoogle } = useAuth();

  const handleRegister = async () => {
    if (!displayName || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await signUp(displayName, email, password);
      router.replace('/');
    } catch (error: any) {
      Alert.alert('Error', getFirebaseErrorMessage(error.code));
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithApple();
      router.replace('/');
    } catch (error: any) {
      if (error.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Error', error.message || 'Apple sign-in failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[colors.primaryDark, colors.primary]}
      className="flex-1"
    >
      <SafeAreaView className="flex-1">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="justify-center px-6"
          >
            {/* Logo */}
            <View className="items-center mb-6">
              <Text className="text-5xl mb-2">🌳</Text>
              <Text className="text-3xl font-bold text-white">
                Urban Pulse
              </Text>
            </View>

            {/* Form card */}
            <View className="bg-white rounded-2xl p-6 shadow-lg">
              <Text className="text-xl font-bold text-gray-900 mb-4">
                Create Account
              </Text>

              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-base text-gray-900 mb-3"
                placeholder="Display Name"
                placeholderTextColor="#9CA3AF"
                value={displayName}
                onChangeText={setDisplayName}
                editable={!loading}
              />

              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-base text-gray-900 mb-3"
                placeholder="Email"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                editable={!loading}
              />

              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-base text-gray-900 mb-3"
                placeholder="Password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                editable={!loading}
              />

              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-base text-gray-900 mb-4"
                placeholder="Confirm Password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!loading}
              />

              <Pressable
                className="py-4 rounded-xl items-center mb-4"
                style={{
                  backgroundColor: loading ? colors.cooldown : colors.primary,
                }}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold text-lg">
                    Create Account
                  </Text>
                )}
              </Pressable>

              {/* Divider */}
              <View className="flex-row items-center mb-4">
                <View className="flex-1 h-px bg-gray-200" />
                <Text className="mx-4 text-gray-400 text-sm">OR</Text>
                <View className="flex-1 h-px bg-gray-200" />
              </View>

              {/* Apple Sign-In (iOS only) */}
              {Platform.OS === 'ios' && (
                <Pressable
                  className="py-4 rounded-xl items-center bg-black mb-3"
                  onPress={handleAppleSignIn}
                  disabled={loading}
                >
                  <Text className="text-white font-semibold text-lg">
                     Continue with Apple
                  </Text>
                </Pressable>
              )}

              {/* Google Sign-In */}
              <Pressable
                className="py-4 rounded-xl items-center bg-white border border-gray-200"
                onPress={handleGoogleSignIn}
                disabled={loading}
              >
                <Text className="text-gray-700 font-semibold text-lg">
                  Continue with Google
                </Text>
              </Pressable>
            </View>

            <Pressable className="mt-6 items-center mb-8" onPress={() => router.back()}>
              <Text className="text-white/80">
                Already have an account?{' '}
                <Text className="font-bold text-white">Sign In</Text>
              </Text>
            </Pressable>
          </KeyboardAvoidingView>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
