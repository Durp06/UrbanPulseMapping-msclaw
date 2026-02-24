import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  OAuthProvider,
  signInWithCredential,
  GoogleAuthProvider,
  type User as FirebaseUser,
} from 'firebase/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
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
const auth = getAuth(app);

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

  // Update display name from Apple if available and not already set
  if (
    appleCredential.fullName?.givenName &&
    !result.user.displayName
  ) {
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
  try {
    GoogleSignin.configure({
      iosClientId: process.env.EXPO_PUBLIC_FIREBASE_IOS_CLIENT_ID,
    });

    await GoogleSignin.hasPlayServices();
    const signInResult = await GoogleSignin.signIn();
    const idToken = signInResult.data?.idToken;

    if (!idToken) {
      throw new Error('Google sign-in failed: no ID token');
    }

    const googleCredential = GoogleAuthProvider.credential(idToken);
    const result = await signInWithCredential(auth, googleCredential);
    await setUserFromFirebase(result.user);
  } catch (error: any) {
    if (error?.code === 'SIGN_IN_CANCELLED') {
      return; // User cancelled — not an error
    }
    throw error;
  }
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

// Refresh the token periodically (Firebase tokens expire after 1 hour)
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
