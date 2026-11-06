/**
 * Store Scheduling & High-Precision Time Synchronization Utilities
 * Handles exact second parsing, local datetime-local formatting,
 * and Arabic date-time display with hours, minutes, and seconds.
 */

import { toArabicDigits } from '../components/ParentPortalView';

/**
 * Safely parses any date string into milliseconds timestamp.
 */
export function parseStoreDateMs(dateStr?: string | null): number | null {
  if (!dateStr || typeof dateStr !== 'string' || !dateStr.trim()) return null;
  const trimmed = dateStr.trim();
  const num = Number(trimmed);
  if (!isNaN(num) && num > 1000000000000) return num;
  const parsed = new Date(trimmed).getTime();
  return isNaN(parsed) ? null : parsed;
}

/**
 * Formats a Date or ISO string into `YYYY-MM-DDTHH:mm:ss` for HTML `<input type="datetime-local" step="1" />`
 * in the user's LOCAL timezone without timezone shift.
 */
export function toLocalDatetimeInputValue(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';

  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

/**
 * Formats a date string into rich Arabic text showing both:
 * 1. The exact Gregorian date (day, month, year)
 * 2. The exact 12-hour time with hours, minutes, and seconds (e.g. 02:30:15 م)
 */
export function formatDateTimeArabicWithSeconds(dateStr?: string | null): {
  date: string;
  time: string;
  full: string;
} {
  if (!dateStr) return { date: '', time: '', full: '' };
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return { date: '', time: '', full: '' };

  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());

  let hours = d.getHours();
  const ampm = hours >= 12 ? 'م' : 'ص';
  hours = hours % 12 || 12;
  const hoursStr = pad(hours);
  const minutesStr = pad(d.getMinutes());
  const secondsStr = pad(d.getSeconds());

  const dateFormatted = `${year}/${month}/${day}`;
  const timeFormatted = `${hoursStr}:${minutesStr}:${secondsStr} ${ampm}`;

  const dateArabic = toArabicDigits(dateFormatted);
  const timeArabic = toArabicDigits(timeFormatted);
  const fullArabic = `${dateArabic} - ${timeArabic}`;

  return {
    date: dateArabic,
    time: timeArabic,
    full: fullArabic
  };
}

export interface StoreItemScheduleStatus {
  startsAtMs: number | null;
  endsAtMs: number | null;
  isUpcoming: boolean;
  isTimeExpired: boolean;
  isSoldOut: boolean;
  canPurchase: boolean;
  badgeLabel: string;
}

/**
 * Evaluates the real-time scheduling and stock status of a store item.
 */
export function getItemScheduleStatus(
  item: {
    startsAt?: string;
    endsAt?: string;
    quantity?: number;
    isUnderEdit?: boolean;
  },
  nowMs: number
): StoreItemScheduleStatus {
  const startsAtMs = parseStoreDateMs(item.startsAt);
  const endsAtMs = parseStoreDateMs(item.endsAt);

  const isUpcoming = Boolean(startsAtMs !== null && nowMs < startsAtMs);
  const isTimeExpired = Boolean(endsAtMs !== null && nowMs >= endsAtMs);
  const isSoldOut = (item.quantity || 0) <= 0;

  const canPurchase = !isUpcoming && !isTimeExpired && !isSoldOut;

  let badgeLabel = 'متاح';
  if (isUpcoming) badgeLabel = 'قيد الانتظار';
  else if (isTimeExpired) badgeLabel = 'انتهى وقت المنتج';
  else if (isSoldOut) badgeLabel = 'منتهي';

  return {
    startsAtMs,
    endsAtMs,
    isUpcoming,
    isTimeExpired,
    isSoldOut,
    canPurchase,
    badgeLabel
  };
}

// ============================================================================
// Firestore Server Time Synchronization & Clock Skew Calibration
// ============================================================================
let firestoreServerTimeOffsetMs = 0;
let isFirestoreTimeCalibrated = false;
const listeners = new Set<(offsetMs: number) => void>();

/**
 * Updates the estimated offset between client local clock and Firestore server clock.
 */
export function setFirestoreServerTimeOffset(offsetMs: number) {
  if (Math.abs(offsetMs) < 50) {
    firestoreServerTimeOffsetMs = 0;
  } else {
    firestoreServerTimeOffsetMs = Math.round(offsetMs);
  }
  isFirestoreTimeCalibrated = true;
  listeners.forEach(fn => fn(firestoreServerTimeOffsetMs));
}

/**
 * Returns whether Firestore server time has been calibrated.
 */
export function isServerTimeCalibrated(): boolean {
  return isFirestoreTimeCalibrated;
}

/**
 * Returns current Firestore server time offset in milliseconds.
 */
export function getFirestoreServerTimeOffset(): number {
  return firestoreServerTimeOffsetMs;
}

/**
 * Subscribes to changes in Firestore server time offset.
 */
export function subscribeServerTimeOffset(listener: (offsetMs: number) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Returns the current epoch timestamp synchronized with Firestore servers.
 * Eliminates any student device clock skew or manual time modification.
 */
export function getSyncedServerTimeMs(): number {
  return Date.now() + firestoreServerTimeOffsetMs;
}

