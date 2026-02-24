import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useAuthStore } from './store';

type FirebaseUser = FirebaseAuthTypes.User;

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
  const credential = await auth().signInWithEmailAndPassword(email, password);
  await setUserFromFirebase(credential.user);
}

export async function signUp(
  displayName: string,
  email: string,
  password: string
) {
  const credential = await auth().createUserWithEmailAndPassword(email, password);
  await credential.user.updateProfile({ displayName });
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

  const oauthCredential = auth.AppleAuthProvider.credential(
    appleCredential.identityToken,
    appleCredential.authorizationCode || ''
  );

  const result = await auth().signInWithCredential(oauthCredential);

  // Update display name from Apple if available
  if (appleCredential.fullName?.givenName && !result.user.displayName) {
    const name = [
      appleCredential.fullName.givenName,
      appleCredential.fullName.familyName,
    ]
      .filter(Boolean)
      .join(' ');
    await result.user.updateProfile({ displayName: name });
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

    const googleCredential = auth.GoogleAuthProvider.credential(idToken);
    const result = await auth().signInWithCredential(googleCredential);
    await setUserFromFirebase(result.user);
  } catch (error: any) {
    if (error?.code === 'SIGN_IN_CANCELLED') {
      return;
    }
    throw error;
  }
}

export async function signOut() {
  await auth().signOut();
  useAuthStore.getState().clearAuth();
}

export function onAuthChange(
  callback: (user: FirebaseUser | null) => void
) {
  return auth().onAuthStateChanged(callback);
}

export async function refreshToken(): Promise<string | null> {
  const currentUser = auth().currentUser;
  if (!currentUser) return null;
  const token = await currentUser.getIdToken(true);
  useAuthStore.getState().setAuth({
    token,
    user: useAuthStore.getState().user!,
  });
  return token;
}
