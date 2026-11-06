import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Flame, AlertCircle, Sparkles, CheckCircle2, Zap } from 'lucide-react';
import {
  parseStoreDateMs,
  getSyncedServerTimeMs,
  isServerTimeCalibrated
} from '../lib/storeTimeUtils';
import { toArabicDigits } from './ParentPortalView';

export interface CountdownTimerProps {
  /** The target timestamp string, date, or epoch ms (e.g. startsAt or endsAt) */
  targetDate: string | number | Date | null | undefined;
  /** Countdown mode:
   * 'appearance': waiting for product to appear / start
   * 'expiration': active product ticking down to expiration
   * 'auto': detects based on targetDate
   */
  mode?: 'appearance' | 'expiration' | 'auto';
  /** Display style variant */
  variant?: 'card' | 'badge' | 'compact';
  /** Optional callback fired when countdown reaches zero */
  onZero?: () => void;
  /** Optional theme accent color (defaults to amber/gold) */
  accentColor?: string;
  /** Custom label above the timer */
  customLabel?: string;
  /** Hide or show server synchronization status indicator */
  showSyncBadge?: boolean;
  /** Additional CSS class names */
  className?: string;
}

/**
 * High-Precision Duolingo 3D Countdown Timer
 * Synchronized with Firestore servers across all devices down to the second.
 */
export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  targetDate,
  mode = 'auto',
  variant = 'card',
  onZero,
  accentColor = '#f59e0b',
  customLabel,
  showSyncBadge = true,
  className = ''
}) => {
  const targetMs = useMemo(() => {
    if (!targetDate) return null;
    if (typeof targetDate === 'number') return targetDate;
    if (targetDate instanceof Date) return targetDate.getTime();
    return parseStoreDateMs(targetDate);
  }, [targetDate]);

  // Current server-synchronized time
  const [currentServerMs, setCurrentServerMs] = useState<number>(() => getSyncedServerTimeMs());
  const hasFiredZeroRef = useRef(false);

  // Sub-second reactive ticker (every 100ms for perfectly synchronized second transitions)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentServerMs(getSyncedServerTimeMs());
    }, 100);
    return () => clearInterval(timer);
  }, []);

  // Calculate remaining time
  const remainingMs = useMemo(() => {
    if (!targetMs) return 0;
    return Math.max(0, targetMs - currentServerMs);
  }, [targetMs, currentServerMs]);

  // Handle onZero trigger
  useEffect(() => {
    if (targetMs && remainingMs <= 0) {
      if (!hasFiredZeroRef.current) {
        hasFiredZeroRef.current = true;
        onZero?.();
      }
    } else {
      hasFiredZeroRef.current = false;
    }
  }, [remainingMs, targetMs, onZero]);

  // Time components
  const timeUnits = useMemo(() => {
    const totalSecs = Math.floor(remainingMs / 1000);
    const days = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;

    const pad = (n: number) => String(n).padStart(2, '0');

    return {
      days,
      hours,
      minutes,
      seconds,
      daysStr: toArabicDigits(String(days)),
      hoursStr: toArabicDigits(pad(hours)),
      minutesStr: toArabicDigits(pad(minutes)),
      secondsStr: toArabicDigits(pad(seconds))
    };
  }, [remainingMs]);

  if (!targetMs) return null;

  // Urgency classification
  const isUrgent = remainingMs > 0 && remainingMs <= 5 * 60 * 1000; // < 5 mins
  const isWarning = remainingMs > 0 && remainingMs <= 60 * 60 * 1000; // < 1 hour
  const isFinished = remainingMs <= 0;

  // Resolved mode
  const resolvedMode = mode === 'auto'
    ? (targetMs > currentServerMs ? 'expiration' : 'expiration')
    : mode;

  // Header Title
  const headerText = customLabel || (
    resolvedMode === 'appearance'
      ? (isFinished ? 'بدأ العرض الآن!' : 'قيد الانتظار — وقت الظهور التلقائي')
      : (isFinished ? 'انتهى وقت المنتج' : isUrgent ? 'عرض وشيك الانتهاء جداً!' : 'الوقت المتبقي لانتهاء المنتج')
  );

  // Theme palettes based on mode & urgency
  const getThemeClasses = () => {
    if (isFinished) {
      return {
        bg: 'bg-slate-900/90',
        border: 'border-slate-700',
        borderB: 'border-b-slate-800',
        text: 'text-slate-400',
        blockBg: 'bg-slate-800/90',
        blockBorder: 'border-slate-700',
        blockBorderB: 'border-b-slate-800',
        blockText: 'text-slate-400',
        badgeBg: 'bg-slate-800',
        badgeText: 'text-slate-400'
      };
    }
    if (resolvedMode === 'appearance') {
      return {
        bg: 'bg-sky-950/60',
        border: 'border-sky-500/50',
        borderB: 'border-b-sky-600',
        text: 'text-sky-300',
        blockBg: 'bg-sky-900/80',
        blockBorder: 'border-sky-500/70',
        blockBorderB: 'border-b-sky-700',
        blockText: 'text-white',
        badgeBg: 'bg-sky-500/20',
        badgeText: 'text-sky-300'
      };
    }
    if (isUrgent) {
      return {
        bg: 'bg-rose-950/70',
        border: 'border-rose-500/80',
        borderB: 'border-b-rose-700',
        text: 'text-rose-300',
        blockBg: 'bg-rose-900/90',
        blockBorder: 'border-rose-400',
        blockBorderB: 'border-b-rose-600',
        blockText: 'text-white',
        badgeBg: 'bg-rose-500/30',
        badgeText: 'text-rose-200'
      };
    }
    if (isWarning) {
      return {
        bg: 'bg-amber-950/70',
        border: 'border-amber-500/70',
        borderB: 'border-b-amber-700',
        text: 'text-amber-300',
        blockBg: 'bg-amber-900/80',
        blockBorder: 'border-amber-400',
        blockBorderB: 'border-b-amber-600',
        blockText: 'text-white',
        badgeBg: 'bg-amber-500/25',
        badgeText: 'text-amber-300'
      };
    }
    return {
      bg: 'bg-black/40',
      border: 'border-amber-500/40',
      borderB: 'border-b-amber-600',
      text: 'text-amber-300',
      blockBg: 'bg-amber-950/70',
      blockBorder: 'border-amber-500/50',
      blockBorderB: 'border-b-amber-700',
      blockText: 'text-amber-100',
      badgeBg: 'bg-amber-500/20',
      badgeText: 'text-amber-300'
    };
  };

  const theme = getThemeClasses();

  // =========================================================================
  // 1. COMPACT VARIANT (Single line inline badge)
  // =========================================================================
  if (variant === 'compact') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black border-2 border-b-3 transition-all select-none ${theme.bg} ${theme.border} ${theme.borderB} ${theme.text} ${className}`}
        dir="rtl"
      >
        {isUrgent ? (
          <Flame className="w-3.5 h-3.5 text-rose-400 animate-bounce" />
        ) : resolvedMode === 'appearance' ? (
          <Clock className="w-3.5 h-3.5 text-sky-400" />
        ) : (
          <Clock className="w-3.5 h-3.5 text-amber-400" />
        )}
        <span className="font-mono text-xs font-black tracking-tight" dir="ltr">
          {timeUnits.days > 0 && `${timeUnits.daysStr}د : `}
          {timeUnits.hoursStr}:{timeUnits.minutesStr}:{timeUnits.secondsStr}
        </span>
      </div>
    );
  }

  // =========================================================================
  // 2. BADGE VARIANT (Floating Pill with 3D tactile feel)
  // =========================================================================
  if (variant === 'badge') {
    return (
      <div
        className={`px-3 py-1.5 rounded-2xl shadow-lg border-2 border-b-4 flex items-center gap-2 select-none backdrop-blur-md transition-all ${theme.bg} ${theme.border} ${theme.borderB} ${className} ${
          isUrgent ? 'animate-pulse' : ''
        }`}
        dir="rtl"
      >
        {isUrgent ? (
          <Flame className="w-4 h-4 text-rose-400 shrink-0 animate-bounce" />
        ) : (
          <Clock className="w-4 h-4 text-current shrink-0" />
        )}
        <div className="flex items-center gap-1 font-mono text-xs sm:text-sm font-black text-white dir-ltr">
          {timeUnits.days > 0 && (
            <>
              <span className="bg-black/30 px-1.5 py-0.5 rounded-md">{timeUnits.daysStr}</span>
              <span className="text-[10px] text-slate-300">يوم</span>
              <span className="text-amber-400 font-bold">:</span>
            </>
          )}
          <span className="bg-black/30 px-1.5 py-0.5 rounded-md">{timeUnits.hoursStr}</span>
          <span className="text-amber-400 font-bold">:</span>
          <span className="bg-black/30 px-1.5 py-0.5 rounded-md">{timeUnits.minutesStr}</span>
          <span className="text-amber-400 font-bold">:</span>
          <span className={`bg-black/30 px-1.5 py-0.5 rounded-md ${isUrgent ? 'text-rose-300 font-black' : ''}`}>
            {timeUnits.secondsStr}
          </span>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3. CARD VARIANT (Full Duolingo 3D Tactile Card)
  // =========================================================================
  return (
    <div
      className={`rounded-2xl p-3 sm:p-3.5 border-2 border-b-[4px] shadow-md transition-all select-none ${theme.bg} ${theme.border} ${theme.borderB} ${className} ${
        isUrgent ? 'ring-2 ring-rose-500/40 ring-offset-1 ring-offset-slate-950' : ''
      }`}
      dir="rtl"
    >
      {/* Header: Title and Firestore Sync Badge */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          {isUrgent ? (
            <Flame className="w-4 h-4 text-rose-400 animate-bounce" />
          ) : resolvedMode === 'appearance' ? (
            <Sparkles className="w-4 h-4 text-sky-400" />
          ) : (
            <Clock className="w-4 h-4 text-amber-400" />
          )}
          <span className={`text-xs font-black ${theme.text}`}>
            {headerText}
          </span>
        </div>

        {/* Real-time Status Indicator (without text) */}
        {showSyncBadge && (
          <div
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/40 border border-white/10"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
          </div>
        )}
      </div>

      {/* Duolingo 3D Number Blocks */}
      <div className="grid grid-cols-4 gap-1 sm:gap-1.5 text-center min-w-0" dir="ltr">
        {/* Days Block */}
        <div className="flex flex-col items-center min-w-0">
          <div
            className={`w-full py-1 sm:py-1.5 md:py-2 rounded-lg sm:rounded-xl border-2 border-b-3 flex items-center justify-center font-mono font-black text-xs sm:text-sm md:text-base shadow-inner min-w-0 ${theme.blockBg} ${theme.blockBorder} ${theme.blockBorderB} ${theme.blockText}`}
          >
            {timeUnits.daysStr}
          </div>
          <span className="text-[9px] sm:text-[10px] text-slate-300 mt-0.5 font-bold truncate">يوم</span>
        </div>

        {/* Hours Block */}
        <div className="flex flex-col items-center min-w-0">
          <div
            className={`w-full py-1 sm:py-1.5 md:py-2 rounded-lg sm:rounded-xl border-2 border-b-3 flex items-center justify-center font-mono font-black text-xs sm:text-sm md:text-base shadow-inner min-w-0 ${theme.blockBg} ${theme.blockBorder} ${theme.blockBorderB} ${theme.blockText}`}
          >
            {timeUnits.hoursStr}
          </div>
          <span className="text-[9px] sm:text-[10px] text-slate-300 mt-0.5 font-bold truncate">ساعة</span>
        </div>

        {/* Minutes Block */}
        <div className="flex flex-col items-center min-w-0">
          <div
            className={`w-full py-1 sm:py-1.5 md:py-2 rounded-lg sm:rounded-xl border-2 border-b-3 flex items-center justify-center font-mono font-black text-xs sm:text-sm md:text-base shadow-inner min-w-0 ${theme.blockBg} ${theme.blockBorder} ${theme.blockBorderB} ${theme.blockText}`}
          >
            {timeUnits.minutesStr}
          </div>
          <span className="text-[9px] sm:text-[10px] text-slate-300 mt-0.5 font-bold truncate">دقيقة</span>
        </div>

        {/* Seconds Block */}
        <div className="flex flex-col items-center min-w-0">
          <div
            className={`w-full py-1 sm:py-1.5 md:py-2 rounded-lg sm:rounded-xl border-2 border-b-3 flex items-center justify-center font-mono font-black text-xs sm:text-sm md:text-base shadow-inner min-w-0 ${theme.blockBg} ${theme.blockBorder} ${theme.blockBorderB} ${
              isUrgent ? 'text-rose-300 animate-pulse font-black' : theme.blockText
            }`}
          >
            {timeUnits.secondsStr}
          </div>
          <span className={`text-[9px] sm:text-[10px] mt-0.5 font-bold truncate ${isUrgent ? 'text-rose-400 font-black' : 'text-slate-300'}`}>
            ثانية
          </span>
        </div>
      </div>
    </div>
  );
};
