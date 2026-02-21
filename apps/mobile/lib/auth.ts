import { useAuthStore } from './store';

// In development mode, we use a mock auth system
// In production, this would be Firebase Auth

export async function signIn(email: string, _password: string) {
  if (__DEV__) {
    // Mock auth for development
    useAuthStore.getState().setAuth({
      token: 'dev-token',
      user: {
        id: '00000000-0000-0000-0000-000000000001',
        firebaseUid: 'dev-user-123',
        email,
        displayName: 'Dev User',
        avatarUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    return;
  }

  // Production Firebase Auth would go here
  throw new Error('Firebase Auth not configured');
}

export async function signUp(
  displayName: string,
  email: string,
  _password: string
) {
  if (__DEV__) {
    useAuthStore.getState().setAuth({
      token: 'dev-token',
      user: {
        id: '00000000-0000-0000-0000-000000000001',
        firebaseUid: 'dev-user-123',
        email,
        displayName,
        avatarUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
    return;
  }

  throw new Error('Firebase Auth not configured');
}

export async function signOut() {
  useAuthStore.getState().clearAuth();
}
