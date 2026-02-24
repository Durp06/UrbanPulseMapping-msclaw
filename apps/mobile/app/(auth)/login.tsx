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
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../hooks/useAuth';
import { colors } from '../../constants/colors';

function getFirebaseErrorMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'Invalid email address.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
      return 'No account found with this email.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Invalid email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection.';
    default:
      return 'Sign in failed. Please try again.';
  }
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signInWithApple, signInWithGoogle } = useAuth();

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
      style={{ flex: 1 }}
      className="flex-1"
    >
      <SafeAreaView style={{ flex: 1 }} className="flex-1">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24 }}
          className="flex-1 justify-center px-6"
        >
          {/* Logo */}
          <View className="items-center mb-8">
            <Text className="text-5xl mb-2">🌳</Text>
            <Text className="text-3xl font-bold text-white">Urban Pulse</Text>
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
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              editable={!loading}
            />

            <TextInput
              className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-base text-gray-900 mb-4"
              placeholder="Password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              editable={!loading}
            />

            <Pressable
              className="py-4 rounded-xl items-center mb-4"
              style={{
                backgroundColor: loading ? colors.cooldown : colors.primary,
              }}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-semibold text-lg">
                  Sign In
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
    </LinearGradient>
  );
}
