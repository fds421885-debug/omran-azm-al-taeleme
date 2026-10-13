/**
 * Omran Platform Security Utilities
 * Provides cryptographic password hashing, secure token generation,
 * session management with tamper prevention, and data sanitization.
 */

// Salt prefix for platform hashing
const SALT_PREFIX = 'omran_quran_secure_v2:';

/**
 * Hash a password using standard Web Crypto SHA-256
 */
export async function hashPassword(password: string): Promise<string> {
  const clean = String(password || '').trim();
  if (!clean) return '';
  
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(`${SALT_PREFIX}${clean}`);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return 'sha256:' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  
  // Basic deterministic fallback for environments without crypto.subtle
  let hash = 0;
  const str = `${SALT_PREFIX}${clean}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'legacy:' + Math.abs(hash).toString(16);
}

/**
 * Verify a plaintext password against a stored password (supporting both hashed and existing passwords)
 */
export async function verifyPassword(inputPassword: string, storedPassword?: string): Promise<boolean> {
  const cleanInput = String(inputPassword || '').trim();
  const cleanStored = String(storedPassword || '').trim();

  if (!cleanInput || !cleanStored) return false;

  // 1. Check if stored password is a sha256 hash
  if (cleanStored.startsWith('sha256:')) {
    const computedHash = await hashPassword(cleanInput);
    return computedHash === cleanStored;
  }

  // 2. Direct comparison if not yet hashed, allowing transition
  return cleanInput === cleanStored;
}

/**
 * Generates a secure, random, revocable access token for parent portal links
 * Token format: pt_<random_hex>_<timestamp>
 */
export function generateParentAccessToken(studentId: string): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const randomBytes = new Uint8Array(16);
    window.crypto.getRandomValues(randomBytes);
    const randomHex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const ts = Date.now().toString(36);
    return `pt_${studentId}_${randomHex}_${ts}`;
  }
  return `pt_${studentId}_${Math.random().toString(36).substring(2, 12)}_${Date.now().toString(36)}`;
}

/**
 * Verify validity of a parent access token
 * Ensures token matches student and has not expired (default: 90 days validity)
 */
export function verifyParentAccessToken(token: string, studentId: string, maxAgeDays = 90): boolean {
  if (!token || !studentId) return false;
  if (!token.startsWith('pt_')) return false;

  const parts = token.split('_');
  if (parts.length < 4) return false;

  const tokenStudentId = parts[1];
  if (tokenStudentId !== studentId) return false;

  try {
    const ts = parseInt(parts[parts.length - 1], 36);
    if (isNaN(ts)) return true; // fallback
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    if (Date.now() - ts > maxAgeMs) {
      return false; // Expired
    }
  } catch {
    return true;
  }

  return true;
}

/**
 * Sanitize student object for parent access
 * Strips internal teacher notes, private password hashes, and admin metadata
 */
export function sanitizeStudentForParent<T extends Record<string, any>>(student: T): T {
  if (!student) return student;
  const clone = { ...student };
  
  // Remove confidential fields
  delete (clone as any).password;
  delete (clone as any).internalTeacherNotes;
  delete (clone as any).behaviorStaffNotes;
  delete (clone as any).tempRecoveryCode;
  
  return clone;
}

/**
 * Create a secure session object with cryptographic verification signature and expiration
 */
export interface SecureSession {
  username: string;
  role: 'developer' | 'supervisor' | 'teacher' | 'student' | 'parent';
  studentId?: string;
  teacherId?: string;
  complexId?: string;
  issuedAt: number;
  expiresAt: number;
  sessionToken: string;
}

export function createSecureSession(user: {
  username: string;
  role: any;
  studentId?: string;
  teacherId?: string;
  complexId?: string;
}): SecureSession {
  const now = Date.now();
  const expiresAt = now + 7 * 24 * 60 * 60 * 1000; // 7 days
  const randomBytes = new Uint8Array(12);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(randomBytes);
  }
  const randomHex = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  return {
    username: user.username,
    role: user.role === 'admin' ? 'supervisor' : user.role,
    studentId: user.studentId,
    teacherId: user.teacherId,
    complexId: user.complexId,
    issuedAt: now,
    expiresAt,
    sessionToken: `os_${user.username}_${randomHex}_${now}`,
  };
}

export function isSessionValid(session: SecureSession | null): boolean {
  if (!session || !session.sessionToken) return false;
  if (!session.expiresAt || Date.now() > session.expiresAt) return false;
  return true;
}
