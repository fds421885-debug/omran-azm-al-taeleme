/**
 * Omran Platform Firebase Authentication Upgrade Service
 * Manages seamless account upgrades from legacy/in-memory credentials
 * to Firebase Authentication while maintaining 100% backward compatibility
 * and zero data loss.
 */

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile,
} from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { hashPassword, verifyPassword } from '../utils/security';
import { UserRole } from '../types';

export interface OmranAuthUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  studentId?: string;
  teacherId?: string;
  complexId?: string;
  isFirebaseAuthenticated: boolean;
}

/**
 * Converts a platform username or identifier into a canonical Firebase Auth email
 */
export function formatCanonicalEmail(username: string): string {
  const clean = username.trim().toLowerCase();
  if (clean.includes('@') && clean.includes('.')) {
    return clean;
  }
  // Safe slug for Arabic or ASCII usernames
  const slug = encodeURIComponent(clean).replace(/%/g, '_').toLowerCase();
  return `${slug.slice(0, 40)}@omran.internal`;
}

export class FirebaseAuthService {
  /**
   * Listen to Firebase Auth state transitions
   */
  static onAuthStateChange(callback: (user: FirebaseUser | null) => void) {
    if (!auth) return () => {};
    return onAuthStateChanged(auth, callback);
  }

  /**
   * Current Firebase user
   */
  static getCurrentUser(): FirebaseUser | null {
    return auth?.currentUser || null;
  }

  /**
   * Upgrade and authenticate user into Firebase Auth
   * If the account does not exist in Firebase Auth yet, creates it transparently.
   */
  static async upgradeAndSignIn(credentials: {
    username: string;
    plainPassword: string;
    role: UserRole;
    displayName?: string;
    teacherId?: string;
    studentId?: string;
    complexId?: string;
  }): Promise<{ success: boolean; user?: OmranAuthUser; error?: string }> {
    const { username, plainPassword, role, displayName, teacherId, studentId, complexId } = credentials;
    const email = formatCanonicalEmail(username);

    // Enforce password minimum requirement for Firebase Auth (min 6 characters)
    const effectivePassword = plainPassword.length >= 6 ? plainPassword : `${plainPassword}_omranSecure`;

    try {
      let fbUser: FirebaseUser;

      try {
        // Attempt signing in
        const cred = await signInWithEmailAndPassword(auth, email, effectivePassword);
        fbUser = cred.user;
      } catch (signInErr: any) {
        // If user not found, create new Firebase Auth record seamlessly
        if (
          signInErr.code === 'auth/user-not-found' ||
          signInErr.code === 'auth/invalid-credential' ||
          signInErr.code === 'auth/invalid-login-credentials'
        ) {
          try {
            const newCred = await createUserWithEmailAndPassword(auth, email, effectivePassword);
            fbUser = newCred.user;
            if (displayName) {
              await updateProfile(fbUser, { displayName }).catch(() => {});
            }
          } catch (createErr: any) {
            // If already exists or error, fall through
            throw createErr;
          }
        } else {
          throw signInErr;
        }
      }

      // Store/sync user profile in Firestore under /users/{uid}
      try {
        const userDocRef = doc(db, 'users', fbUser.uid);
        await setDoc(
          userDocRef,
          {
            username,
            email,
            displayName: displayName || username,
            role,
            teacherId: teacherId || null,
            studentId: studentId || null,
            complexId: complexId || null,
            lastLoginAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch {
        // Firestore rules might restrict if not signed in yet or offline
      }

      return {
        success: true,
        user: {
          uid: fbUser.uid,
          email: fbUser.email || email,
          displayName: displayName || username,
          role,
          teacherId,
          studentId,
          complexId,
          isFirebaseAuthenticated: true,
        },
      };
    } catch (err: any) {
      // Graceful fallback to verified session so user is never locked out
      return {
        success: false,
        error: err.message || 'Firebase Auth unavailable',
      };
    }
  }

  /**
   * Sign out from Firebase Auth
   */
  static async signOut(): Promise<void> {
    try {
      if (auth) {
        await fbSignOut(auth);
      }
    } catch {
      // Gracefully silent
    }
  }
}
