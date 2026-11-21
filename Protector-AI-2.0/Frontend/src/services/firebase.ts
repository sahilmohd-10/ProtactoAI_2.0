import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import {
  getAuth,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendEmailVerification,
  updateProfile,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  type ApplicationVerifier,
  type User
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "protectoai-8a951.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "protectoai-8a951",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "protectoai-8a951.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "191291950082",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:191291950082:web:4514d805d22a2aeaf7931b",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-FJVDTRMMLZ"
};

// Initialize Firebase App (singleton guard)
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Analytics if supported in this environment
export let analytics: any = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {
    // Analytics not supported in test / SSR environments
  });
}

// Initialize Auth
export const auth = getAuth(app);

/**
 * Register user with Firebase Auth and dispatch an official Email Verification
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

  // Send email verification link/message via Firebase
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
 * Dispatch Firebase Email Verification to current authenticated user
 */
export async function sendFirebaseEmailVerification(): Promise<boolean> {
  if (!auth.currentUser) {
    throw new Error("No active Firebase session found to verify.");
  }
  await sendEmailVerification(auth.currentUser);
  return true;
}

/**
 * Log in with Firebase email & password
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
 * 1-Click Google Sign-In with Firebase Popup
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
 * Log out of Firebase Auth
 */
export async function logoutFirebase(): Promise<void> {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn("Firebase sign out notice:", e);
  }
}

/**
 * Send real Password Reset Email directly via Firebase Auth
 */
export async function sendFirebasePasswordReset(email: string): Promise<boolean> {
  if (!email || !email.includes("@")) {
    throw new Error("Please provide a valid registered email address.");
  }
  await sendPasswordResetEmail(auth, email.trim());
  return true;
}

/**
 * Set up reCAPTCHA verifier for phone OTP
 */
export function setupRecaptcha(containerId: string = "recaptcha-container"): RecaptchaVerifier {
  if (typeof window === "undefined") {
    throw new Error("Window object is required for reCAPTCHA.");
  }
  return new RecaptchaVerifier(auth, containerId, {
    size: "invisible",
    callback: () => {
      // reCAPTCHA solved - will proceed with submit function
    }
  });
}

/**
 * Send SMS OTP to phone number using Firebase Auth
 */
export async function sendPhoneOtp(
  phoneNumber: string,
  verifier: ApplicationVerifier
): Promise<ConfirmationResult> {
  if (!phoneNumber) {
    throw new Error("Please provide a valid phone number with country code (e.g. +91XXXXXXXXXX).");
  }
  return await signInWithPhoneNumber(auth, phoneNumber.trim(), verifier);
}

/**
 * Confirm / Verify Phone OTP code
 */
export async function confirmPhoneOtp(
  confirmationResult: ConfirmationResult,
  code: string
) {
  if (!code || code.trim().length < 6) {
    throw new Error("Please enter a valid 6-digit OTP code.");
  }
  return await confirmationResult.confirm(code.trim());
}

export default app;
