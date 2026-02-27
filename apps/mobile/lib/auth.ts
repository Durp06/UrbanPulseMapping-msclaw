/**
 * Mock auth - Firebase removed temporarily to debug rendering issues.
 * Signs in with dev-token, persists in zustand store.
 */
import { useAuthStore } from './store';

type FirebaseUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
};

// Track mock auth state so onAuthChange doesn't fight signIn
let _mockUser: FirebaseUser | null = null;
let _authChangeCallback: ((user: FirebaseUser | null) => void) | null = null;

function notifyAuthChange() {
  if (_authChangeCallback) {
    _authChangeCallback(_mockUser);
  }
}

export async function signIn(_email: string, _password: string) {
  console.log('[auth-mock] signIn called');
  _mockUser = {
    uid: 'dev-user-123',
    email: _email,
    displayName: 'Dev User',
    photoURL: null,
    getIdToken: async () => 'dev-token',
  };
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
  notifyAuthChange();
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
  _mockUser = null;
  // Clear auth state — don't notify listener to avoid re-render race
  useAuthStore.getState().clearAuth();
}

export function onAuthChange(callback: (user: FirebaseUser | null) => void): () => void {
  _authChangeCallback = callback;
  // Fire with current state (null on first load = not authenticated)
  console.log('[auth-mock] onAuthChange - firing with current user:', _mockUser?.uid ?? 'null');
  setTimeout(() => callback(_mockUser), 100);
  return () => {
    _authChangeCallback = null;
  };
}

export async function refreshToken(): Promise<string | null> {
  return 'dev-token';
}
