import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useAuth } from '../hooks/useAuth';
import { signIn } from '../lib/auth';
import '../global.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 30_000,
    },
  },
});

function AuthAutoLogin() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // In dev mode, auto-login
    if (__DEV__ && !isAuthenticated) {
      signIn('dev@urbanpulse.test', 'dev').catch(console.warn);
    }
  }, [isAuthenticated]);

  return null;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthAutoLogin />
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen
          name="scan"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen name="dashboard/index" />
        <Stack.Screen name="bounties/index" />
        <Stack.Screen name="developer/index" />
        <Stack.Screen name="developer/create-bounty" />
        <Stack.Screen name="developer/bounty-detail" />
        <Stack.Screen name="profile/index" />
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="(auth)/register" />
      </Stack>
    </QueryClientProvider>
  );
}
