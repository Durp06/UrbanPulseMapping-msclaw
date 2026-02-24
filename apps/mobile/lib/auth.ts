import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  OAuthProvider,
  signInWithCredential,
  // @ts-ignore - available in firebase/auth for RN
  getReactNativePersistence,
  type User as FirebaseUser,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useAuthStore } from './store';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth with React Native persistence
let auth: ReturnType<typeof getAuth>;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  // Already initialized (hot reload)
  auth = getAuth(app);
}

export { auth };

async function setUserFromFirebase(firebaseUser: FirebaseUser) {
  const token = await firebaseUser.getIdToken();
  useAuthStore.getState().setAuth({
    token,
    user: {
      id: firebaseUser.uid,
      firebaseUid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      avatarUrl: firebaseUser.photoURL,
      role: 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });
}

export async function signIn(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  await setUserFromFirebase(credential.user);
}

export async function signUp(
  displayName: string,
  email: string,
  password: string
) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credential.user, { displayName });
  await setUserFromFirebase(credential.user);
}

export async function signInWithApple() {
  const appleCredential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!appleCredential.identityToken) {
    throw new Error('Apple sign-in failed: no identity token');
  }

  const provider = new OAuthProvider('apple.com');
  const oauthCredential = provider.credential({
    idToken: appleCredential.identityToken,
  });

  const result = await signInWithCredential(auth, oauthCredential);

  if (appleCredential.fullName?.givenName && !result.user.displayName) {
    const name = [
      appleCredential.fullName.givenName,
      appleCredential.fullName.familyName,
    ]
      .filter(Boolean)
      .join(' ');
    await updateProfile(result.user, { displayName: name });
  }

  await setUserFromFirebase(result.user);
}

export async function signInWithGoogle() {
  // Google Sign-In requires native module configuration
  // For now, show a friendly error
  throw new Error('Google Sign-In is not yet configured for this device');
}

export async function signOut() {
  await firebaseSignOut(auth);
  useAuthStore.getState().clearAuth();
}

export function onAuthChange(
  callback: (user: FirebaseUser | null) => void
) {
  return onAuthStateChanged(auth, callback);
}

export async function refreshToken(): Promise<string | null> {
  const currentUser = auth.currentUser;
  if (!currentUser) return null;
  const token = await currentUser.getIdToken(true);
  useAuthStore.getState().setAuth({
    token,
    user: useAuthStore.getState().user!,
  });
  return token;
}
