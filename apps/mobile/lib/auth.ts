/**
 * Mock auth - Firebase removed temporarily to debug rendering issues.
 * All auth operations are no-ops; user is always unauthenticated.
 */
import { useAuthStore } from './store';

type FirebaseUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
};

export async function signIn(_email: string, _password: string) {
  console.log('[auth-mock] signIn called');
  useAuthStore.getState().setAuth({
    token: 'dev-token',
    user: {
      id: 'dev-user-123',
      firebaseUid: 'dev-user-123',
      email: _email,
      displayName: 'Dev User',
      avatarUrl: null,
      role: 'developer',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });
}

export async function signUp(_displayName: string, _email: string, _password: string) {
  return signIn(_email, _password);
}

export async function signInWithApple() {
  throw new Error('Apple sign-in not available in mock mode');
}

export async function signInWithGoogle() {
  throw new Error('Google sign-in not available in mock mode');
}

export async function signOut() {
  useAuthStore.getState().clearAuth();
}

export function onAuthChange(callback: (user: FirebaseUser | null) => void): () => void {
  // Immediately fire with null (not authenticated)
  console.log('[auth-mock] onAuthChange - firing null');
  setTimeout(() => callback(null), 100);
  return () => {};
}

export async function refreshToken(): Promise<string | null> {
  return 'dev-token';
}
