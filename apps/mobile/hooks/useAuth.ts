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
    let resolved = false;

    const unsubscribe = onAuthChange(async (firebaseUser) => {
      console.log('[useAuth] onAuthChange fired, user:', firebaseUser?.uid ?? 'null');
      resolved = true;
      if (firebaseUser) {
        try {
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
        } catch (err) {
          console.warn('[useAuth] getIdToken failed:', err);
          useAuthStore.getState().clearAuth();
        }
      } else {
        useAuthStore.getState().clearAuth();
      }
      setIsLoading(false);
    });

    // Safety timeout — if onAuthStateChanged never fires, stop loading after 3s
    const timeout = setTimeout(() => {
      if (!resolved) {
        console.warn('[useAuth] Auth listener timeout — forcing not-authenticated');
        useAuthStore.getState().clearAuth();
        setIsLoading(false);
      }
    }, 3000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
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
