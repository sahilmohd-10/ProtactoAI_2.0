import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  type User
} from "firebase/auth";

/**
 * Firebase Web SDK Configuration using Vite environment variables
 * Project: ProtectoAI (protectoai-8a951)
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "protectoai-8a951.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "protectoai-8a951",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "protectoai-8a951.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "191291950082",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:191291950082:web:4514d805d22a2aeaf7931b",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-FJVDTRMMLZ"
};

// Initialize Firebase App only once (singleton guard)
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Export the Firebase Auth instance
export const auth = getAuth(app);

/**
 * 1. Register with Firebase Email & Password
 * Automatically dispatches official Email Verification to the user's inbox
 */
export async function registerWithFirebase(
  email: string,
  password: string,
  displayName?: string
): Promise<{ user: User; idToken: string }> {
  if (!email || !email.includes("@")) {
    throw new Error("Please provide a valid email address.");
  }
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }

  const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const user = userCredential.user;

  if (displayName) {
    try {
      await updateProfile(user, { displayName });
    } catch (e) {
      console.warn("Could not set display name on Firebase profile:", e);
    }
  }

  // Dispatch official Email Verification
  try {
    await sendEmailVerification(user);
    console.info("✅ Firebase verification email dispatched to:", email);
  } catch (err: any) {
    console.warn("Firebase email verification notice:", err?.message || err);
  }

  const idToken = await user.getIdToken();
  return { user, idToken };
}

/**
 * 2. Log in with Firebase Email & Password
 */
export async function loginWithFirebase(
  email: string,
  password: string
): Promise<{ user: User; idToken: string }> {
  if (!email || !password) {
    throw new Error("Email and password are required.");
  }
  const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
  const user = userCredential.user;
  const idToken = await user.getIdToken();
  return { user, idToken };
}

/**
 * 3. 1-Click Google Sign-In with Firebase Popup
 */
export async function loginWithGooglePopup(): Promise<{ user: User; idToken: string }> {
  const provider = new GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");
  const result = await signInWithPopup(auth, provider);
  const user = result.user;
  const idToken = await user.getIdToken();
  return { user, idToken };
}

/**
 * 4. Send Email Verification to current authenticated user
 */
export async function sendFirebaseEmailVerification(): Promise<boolean> {
  if (!auth.currentUser) {
    throw new Error("No active Firebase session found to verify.");
  }
  await sendEmailVerification(auth.currentUser);
  return true;
}

/**
 * 5. Send Password Reset Email directly via Firebase Auth
 */
export async function sendFirebasePasswordReset(email: string): Promise<boolean> {
  if (!email || !email.includes("@")) {
    throw new Error("Please provide a valid registered email address.");
  }
  await sendPasswordResetEmail(auth, email.trim());
  return true;
}

/**
 * 6. Log out of Firebase Auth
 */
export async function logoutFirebase(): Promise<void> {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn("Firebase sign out notice:", e);
  }
}

/**
 * 7. Listen for Firebase Auth state changes
 */
export function onFirebaseAuthStateChanged(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export default app;
