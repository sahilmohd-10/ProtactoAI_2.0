import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import {
  getAuth,
  sendPasswordResetEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  type ApplicationVerifier
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
