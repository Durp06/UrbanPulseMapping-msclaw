import { useEffect, useState } from 'react';
import { useAuthStore } from '../lib/store';
import {
  signIn,
  signUp,
  signOut,
  signInWithApple,
  signInWithGoogle,
  onAuthChange,
  refreshToken,
} from '../lib/auth';

export function useAuth() {
  const { user, isAuthenticated, token } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        const idToken = await firebaseUser.getIdToken();
        useAuthStore.getState().setAuth({
          token: idToken,
          user: {
            id: firebaseUser.uid,
            firebaseUid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            avatarUrl: firebaseUser.photoURL,
            role: useAuthStore.getState().user?.role || 'user',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        });
      } else {
        useAuthStore.getState().clearAuth();
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  // Refresh token every 50 minutes (Firebase tokens expire after 60)
  useEffect(() => {
    if (!isAuthenticated) return;
    const interval = setInterval(() => {
      refreshToken().catch(console.warn);
    }, 50 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  return {
    user,
    isAuthenticated,
    isLoading,
    token,
    signIn,
    signUp,
    signOut,
    signInWithApple,
    signInWithGoogle,
  };
}
