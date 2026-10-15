import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  RefreshCw,
  Sparkles,
  CheckCircle2,
  Calendar,
  Search,
  Users,
  UserCheck,
  BookOpen,
  Award,
  Trophy,
  ClipboardList,
  Sliders,
  Layers,
  Home,
  Clock,
  FileText,
  ShieldAlert,
  MessageCircle,
  FolderArchive,
  UserCog,
  Database,
  Radio,
  Check
} from 'lucide-react';
import { QuranComplex } from '../../types';
import { darkenHex, lightenHex, getContrastTextColor } from '../../lib/themeUtils';

/* ========================================================================= */
/* 1. Global Top Loading Bar (شريط التحميل العلوي فائق الأناقة والنعومة)      */
/* ========================================================================= */

interface TopProgressBarProps {
  isLoading: boolean;
  color?: string;
}

export const TopProgressBar: React.FC<TopProgressBarProps> = ({
  isLoading,
  color = '#ffc800'
}) => {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timer1: NodeJS.Timeout;
    let timer2: NodeJS.Timeout;
    let timer3: NodeJS.Timeout;
    let watchdogTimer: NodeJS.Timeout;

    if (isLoading) {
      setVisible(true);
      setProgress(25);
      timer1 = setTimeout(() => setProgress(60), 80);
      timer2 = setTimeout(() => setProgress(88), 200);
      timer3 = setTimeout(() => setProgress(96), 400);

      // Watchdog: Never let loading bar get stuck
      watchdogTimer = setTimeout(() => {
        setProgress(100);
        setTimeout(() => {
          setVisible(false);
          setProgress(0);
        }, 250);
      }, 1200);
    } else if (visible) {
      setProgress(100);
      const hideTimer = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 250);
      return () => clearTimeout(hideTimer);
    }

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(watchdogTimer);
    };
  }, [isLoading, visible]);

  if (!visible && progress === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] h-[3.5px] pointer-events-none overflow-hidden transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
      role="progressbar"
      aria-label="جارٍ تحميل ومزامنة البيانات"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-gradient-to-r from-[#1cb0f6] via-[#ffc800] to-[#58cc02] transition-all duration-300 ease-out shadow-[0_0_14px_rgba(255,200,0,0.9)] relative"
        style={{
          width: `${progress}%`
        }}
      >
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-amber-200 blur-[2px] -mr-1" />
      </div>
    </div>
  );
};

/* ========================================================================= */
/* 2. Live Sync Status & Refresh Button (مؤشر المزامنة الحية وزر التحديث)   */
/* ========================================================================= */

interface LiveSyncButtonProps {
  isSyncing: boolean;
  onRefresh: () => void | Promise<void>;
  lastSyncedText?: string;
  label?: string;
  compact?: boolean;
  activeComplex?: QuranComplex | null;
}

export const LiveSyncButton: React.FC<LiveSyncButtonProps> = ({
  isSyncing,
  onRefresh,
  lastSyncedText = 'مُحدّث سحابياً',
  label = 'تحديث مباشر',
  compact = false,
  activeComplex
}) => {
  const accentCol = activeComplex?.theme?.accentColor || 'var(--complex-accent, #ffc800)';
  const accentShadow = activeComplex?.theme ? darkenHex(activeComplex.theme.accentColor, 0.28) : 'var(--complex-accent-shadow, #e5a500)';
  const contrastText = activeComplex?.theme?.accentColor ? getContrastTextColor(activeComplex.theme.accentColor) : 'var(--complex-accent-text, #131f24)';

  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={isSyncing}
      className={`group flex items-center gap-2 rounded-2xl border-2 border-b-4 transition-all cursor-pointer font-black select-none active:translate-y-[2px] active:border-b-2 hover:brightness-110 shadow-md ${
        compact
          ? 'px-3 py-1.5 text-xs'
          : 'px-4 py-2 text-xs'
      } ${isSyncing ? 'opacity-85 pointer-events-none' : ''}`}
      style={{
        backgroundColor: accentCol,
        borderColor: accentCol,
        borderBottomColor: accentShadow,
        color: contrastText
      }}
      title="مزامنة وتأكيد البيانات فورياً مع قاعدة البيانات السحابية"
    >
      <RefreshCw
        className={`w-3.5 h-3.5 transition-transform duration-500 shrink-0 ${
          isSyncing ? 'animate-spin' : 'group-hover:rotate-180'
        }`}
        style={{ color: contrastText }}
      />
      <span className="whitespace-nowrap font-black">
        {isSyncing ? 'جارٍ المزامنة والتأكيد...' : label}
      </span>
      {!compact && lastSyncedText && (
        <span
          className="hidden sm:inline-block text-[10px] pr-2 border-r font-bold opacity-85"
          style={{ borderColor: 'rgba(0,0,0,0.2)', color: contrastText }}
        >
          {lastSyncedText}
        </span>
      )}
    </button>
  );
};

/* ========================================================================= */
/* 3. Modern Tab Header Loader Banner (رأس التحميل العصري لكل تبويب)        */
/* ========================================================================= */

const TAB_META_CONFIG: Record<string, { label: string; desc: string; icon: any; color: string; shadow: string }> = {
  home: {
    label: 'الرئيسية ولوحة المؤشرات',
    desc: 'جارٍ جلب إحصائيات الحضور ونسب إنجاز التسميع والخطط المعتمدة...',
    icon: Home,
    color: '#ffc800',
    shadow: '#e5a500'
  },
  students: {
    label: 'الطلاب والتسجيل',
    desc: 'جارٍ جلب سجلات الطلاب وأحدث مواضع الحفظ وربط الحلقات...',
    icon: Users,
    color: '#58cc02',
    shadow: '#46a302'
  },
  attendance: {
    label: 'حضور وغياب الطلاب',
    desc: 'جارٍ استدعاء كشوفات حضور وغياب اليوم وتأكيد المزامنة الفورية...',
    icon: UserCheck,
    color: '#1cb0f6',
    shadow: '#1899d6'
  },
  teacher_attendance: {
    label: 'تحضير المعلمين والمناوبات',
    desc: 'جارٍ مزامنة سجل حضور ومناوبات المعلمين وتأكيد السجلات...',
    icon: Clock,
    color: '#ff9600',
    shadow: '#e68300'
  },
  evaluation: {
    label: 'تقييم التسميع والمراجعة',
    desc: 'جارٍ استدعاء سجلات التسميع وتحديث مقررات الحفظ الجديد والمراجعة...',
    icon: BookOpen,
    color: '#ffc800',
    shadow: '#e5a500'
  },
  exams: {
    label: 'قسم الاختبارات والتجويد',
    desc: 'جارٍ تجهيز بنك الاختبارات والأسئلة ودرجات أداء الطلاب...',
    icon: FileText,
    color: '#1cb0f6',
    shadow: '#1899d6'
  },
  certificates: {
    label: 'قسم الشهادات والتكريم',
    desc: 'جارٍ تحميل قوالب الشهادات الفاخرة وسجلات الطلاب المكرمين...',
    icon: Award,
    color: '#ffc800',
    shadow: '#e5a500'
  },
  leaderboard: {
    label: 'لوحة الشرف والتميز',
    desc: 'جارٍ حساب نقاط الطلاب المعتمدة وتصنيف أبطال الحلقات...',
    icon: Trophy,
    color: '#ffc800',
    shadow: '#e5a500'
  },
  behavior: {
    label: 'المخالفات والتوجيهات السلوكية',
    desc: 'جارٍ مزامنة الملاحظات التربوية والتوجيهات وسجلات المتابعة...',
    icon: ShieldAlert,
    color: '#ff4b4b',
    shadow: '#ea2b2b'
  },
  parents: {
    label: 'رسائل وتقارير الواتساب',
    desc: 'جارٍ إعداد كشوفات الإنجاز اليومي وروابط متابعة أولياء الأمور...',
    icon: MessageCircle,
    color: '#25D366',
    shadow: '#1ea952'
  },
  reports: {
    label: 'التقارير الدورية والرسوم البيانية',
    desc: 'جارٍ استخراج وتجميع الإحصائيات التراكمية وسجلات الأداء...',
    icon: ClipboardList,
    color: '#ce82ff',
    shadow: '#a558dc'
  },
  library: {
    label: 'المكتبة والأرشيف السحابي',
    desc: 'جارٍ تحميل وثائق المكتبة ومقررات التجويد والأرشيف الموثق...',
    icon: FolderArchive,
    color: '#1cb0f6',
    shadow: '#1899d6'
  },
  accounts: {
    label: 'إدارة الحسابات والرتب',
    desc: 'جارٍ مزامنة حسابات المعلمين والمشرفين والصلاحيات...',
    icon: UserCog,
    color: '#58cc02',
    shadow: '#46a302'
  },
  backup: {
    label: 'النسخ الاحتياطي السحابي',
    desc: 'جارٍ فحص سلامة البيانات وقواعد التخزين السحابية...',
    icon: Database,
    color: '#1cb0f6',
    shadow: '#1899d6'
  }
};

export const TabHeaderLoaderBanner: React.FC<{ activeTab: string; activeComplex?: QuranComplex | null }> = ({
  activeTab,
  activeComplex
}) => {
  const meta = TAB_META_CONFIG[activeTab] || {
    label: 'المنظومة القرآنية',
    desc: 'جارٍ مزامنة وتأكيد أحدث البيانات القرآنية سحابياً ولحظياً...',
    icon: BookOpen,
    color: '#ffc800',
    shadow: '#e5a500'
  };
  const IconComp = meta.icon;
  const accentColor = activeComplex?.theme?.accentColor || meta.color;
  const accentShadow = darkenHex(accentColor, 0.25);

  return (
    <div
      className="p-4 sm:p-5 rounded-[28px] border-2 border-b-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all animate-pulse"
      dir="rtl"
      style={activeComplex?.theme ? {
        backgroundColor: activeComplex.theme.cardColor || '#203843',
        borderColor: activeComplex.theme.secondaryColor || '#2b4550',
        borderBottomColor: darkenHex(activeComplex.theme.primaryColor || '#131f24', 0.25)
      } : {
        backgroundColor: '#203843',
        borderColor: '#2b4550',
        borderBottomColor: '#16262e'
      }}
    >
      <div className="flex items-center gap-3.5">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center border-2 border-b-4 shadow-md shrink-0"
          style={{
            backgroundColor: `${accentColor}25`,
            borderColor: `${accentColor}60`,
            borderBottomColor: accentShadow,
            color: accentColor
          }}
        >
          <IconComp className="w-6 h-6 animate-pulse" />
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-black text-white font-heading">
              {meta.label}
            </h3>
            <span
              className="text-[10px] px-2.5 py-0.5 rounded-full font-black border-2 border-b-2 shadow-xs"
              style={{
                backgroundColor: `${accentColor}20`,
                borderColor: `${accentColor}50`,
                borderBottomColor: accentShadow,
                color: accentColor
              }}
            >
              تأكيد سحابي
            </span>
          </div>
          <p className="text-xs text-slate-300 font-bold">
            {meta.desc}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#58cc02] opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#58cc02]" />
        </span>
        <span className="text-xs text-[#58cc02] font-black">
          مزامنة مؤكدة ولحظية ✓
        </span>
      </div>
    </div>
  );
};

/* ========================================================================= */
/* 4. Domain-Specific Skeleton Loaders in Duolingo 3D Style                  */
/* ========================================================================= */

// Attendance Tab Skeleton
export const AttendanceSkeleton: React.FC<{ activeComplex?: QuranComplex | null }> = ({ activeComplex }) => {
  const cardBg = activeComplex?.theme?.cardColor || '#203843';
  const secondaryBg = activeComplex?.theme?.secondaryColor || '#1b2e35';
  const borderCol = lightenHex(cardBg, 0.18);
  const borderBottomCol = darkenHex(cardBg, 0.35);
  const shimmerBox = lightenHex(cardBg, 0.12);

  return (
    <div className="space-y-5 animate-pulse" dir="rtl">
      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {[1, 2, 3, 4].map(idx => (
          <div
            key={idx}
            className="border-2 border-b-4 rounded-[24px] p-4 sm:p-5 space-y-3"
            style={{
              backgroundColor: cardBg,
              borderColor: borderCol,
              borderBottomColor: borderBottomCol
            }}
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-20 rounded-xl" style={{ backgroundColor: shimmerBox }} />
              <div className="w-9 h-9 rounded-2xl" style={{ backgroundColor: shimmerBox }} />
            </div>
            <div className="h-7 w-16 rounded-xl" style={{ backgroundColor: shimmerBox }} />
            <div className="h-2 w-full rounded-full" style={{ backgroundColor: shimmerBox }} />
          </div>
        ))}
      </div>

      {/* Student Attendance Roster Card */}
      <div
        className="border-2 border-b-4 rounded-[28px] overflow-hidden p-3 space-y-3"
        style={{
          backgroundColor: cardBg,
          borderColor: borderCol,
          borderBottomColor: borderBottomCol
        }}
      >
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="p-3.5 sm:p-4 rounded-2xl border-2 border-b-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
            style={{
              backgroundColor: secondaryBg,
              borderColor: borderCol,
              borderBottomColor: borderBottomCol
            }}
          >
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="w-11 h-11 rounded-2xl shrink-0" style={{ backgroundColor: shimmerBox }} />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-40 rounded-xl" style={{ backgroundColor: shimmerBox }} />
                <div className="h-3 w-28 rounded-xl" style={{ backgroundColor: shimmerBox }} />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 w-full md:w-80">
              <div className="h-9 rounded-xl" style={{ backgroundColor: shimmerBox }} />
              <div className="h-9 rounded-xl" style={{ backgroundColor: shimmerBox }} />
              <div className="h-9 rounded-xl" style={{ backgroundColor: shimmerBox }} />
              <div className="h-9 rounded-xl" style={{ backgroundColor: shimmerBox }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Students Tab Skeleton
export const StudentsSkeleton: React.FC<{ activeComplex?: QuranComplex | null }> = ({ activeComplex }) => {
  const cardBg = activeComplex?.theme?.cardColor || '#203843';
  const secondaryBg = activeComplex?.theme?.secondaryColor || '#1b2e35';
  const borderCol = lightenHex(cardBg, 0.18);
  const borderBottomCol = darkenHex(cardBg, 0.35);
  const shimmerBox = lightenHex(cardBg, 0.12);

  return (
    <div className="space-y-5 animate-pulse" dir="rtl">
      {/* Header Filters & Add Button */}
      <div
        className="border-2 border-b-4 rounded-[28px] p-4 flex flex-col sm:flex-row items-center justify-between gap-4"
        style={{
          backgroundColor: cardBg,
          borderColor: borderCol,
          borderBottomColor: borderBottomCol
        }}
      >
        <div className="h-10 w-full sm:w-72 rounded-2xl" style={{ backgroundColor: shimmerBox }} />
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <div className="h-10 w-28 rounded-2xl" style={{ backgroundColor: shimmerBox }} />
          <div className="h-10 w-36 rounded-2xl" style={{ backgroundColor: shimmerBox }} />
        </div>
      </div>

      {/* Grid of Student Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div
            key={i}
            className="border-2 border-b-4 rounded-[24px] p-4 space-y-4"
            style={{
              backgroundColor: cardBg,
              borderColor: borderCol,
              borderBottomColor: borderBottomCol
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl shrink-0" style={{ backgroundColor: shimmerBox }} />
                <div className="space-y-2">
                  <div className="h-4 w-32 rounded-xl" style={{ backgroundColor: shimmerBox }} />
                  <div className="h-3 w-20 rounded-xl" style={{ backgroundColor: shimmerBox }} />
                </div>
              </div>
              <div className="h-6 w-16 rounded-full" style={{ backgroundColor: shimmerBox }} />
            </div>

            <div
              className="space-y-2 p-3 rounded-2xl border"
              style={{
                backgroundColor: secondaryBg,
                borderColor: borderCol
              }}
            >
              <div className="flex justify-between">
                <div className="h-3 w-20 rounded" style={{ backgroundColor: shimmerBox }} />
                <div className="h-3 w-12 rounded" style={{ backgroundColor: shimmerBox }} />
              </div>
              <div className="h-2 w-full rounded-full" style={{ backgroundColor: shimmerBox }} />
            </div>

            <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: borderCol }}>
              <div className="h-8 w-24 rounded-xl" style={{ backgroundColor: shimmerBox }} />
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-xl" style={{ backgroundColor: shimmerBox }} />
                <div className="w-8 h-8 rounded-xl" style={{ backgroundColor: shimmerBox }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Home Tab Skeleton
export const HomeSkeleton: React.FC<{ activeComplex?: QuranComplex | null }> = ({ activeComplex }) => {
  const cardBg = activeComplex?.theme?.cardColor || '#203843';
  const secondaryBg = activeComplex?.theme?.secondaryColor || '#1b2e35';
  const borderCol = lightenHex(cardBg, 0.18);
  const borderBottomCol = darkenHex(cardBg, 0.35);
  const shimmerBox = lightenHex(cardBg, 0.12);

  return (
    <div className="space-y-5 animate-pulse" dir="rtl">
      {/* 4 Large Metric Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {[1, 2, 3, 4].map(idx => (
          <div
            key={idx}
            className="border-2 border-b-4 rounded-[24px] p-4 sm:p-5 space-y-3"
            style={{
              backgroundColor: cardBg,
              borderColor: borderCol,
              borderBottomColor: borderBottomCol
            }}
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 rounded-xl" style={{ backgroundColor: shimmerBox }} />
              <div className="w-10 h-10 rounded-2xl" style={{ backgroundColor: shimmerBox }} />
            </div>
            <div className="h-8 w-16 rounded-xl" style={{ backgroundColor: shimmerBox }} />
            <div className="h-3 w-28 rounded-xl" style={{ backgroundColor: shimmerBox }} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-6 w-48 rounded-xl" style={{ backgroundColor: shimmerBox }} />
          <div
            className="border-2 border-b-4 rounded-[28px] p-3 space-y-3"
            style={{
              backgroundColor: cardBg,
              borderColor: borderCol,
              borderBottomColor: borderBottomCol
            }}
          >
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="h-18 rounded-2xl border"
                style={{
                  backgroundColor: secondaryBg,
                  borderColor: borderCol
                }}
              />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-6 w-36 rounded-xl" style={{ backgroundColor: shimmerBox }} />
          <div
            className="border-2 border-b-4 rounded-[28px] p-4 space-y-3"
            style={{
              backgroundColor: cardBg,
              borderColor: borderCol,
              borderBottomColor: borderBottomCol
            }}
          >
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="h-12 rounded-2xl"
                style={{ backgroundColor: secondaryBg }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Evaluation Tab Skeleton
export const EvaluationSkeleton: React.FC<{ activeComplex?: QuranComplex | null }> = ({ activeComplex }) => {
  const cardBg = activeComplex?.theme?.cardColor || '#203843';
  const secondaryBg = activeComplex?.theme?.secondaryColor || '#1b2e35';
  const borderCol = lightenHex(cardBg, 0.18);
  const borderBottomCol = darkenHex(cardBg, 0.35);
  const shimmerBox = lightenHex(cardBg, 0.12);

  return (
    <div className="space-y-5 animate-pulse" dir="rtl">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div
          className="border-2 border-b-4 rounded-[28px] p-4 space-y-3"
          style={{
            backgroundColor: cardBg,
            borderColor: borderCol,
            borderBottomColor: borderBottomCol
          }}
        >
          <div className="h-10 rounded-2xl" style={{ backgroundColor: shimmerBox }} />
          {[1, 2, 3, 4, 5].map(i => (
            <div
              key={i}
              className="h-16 rounded-2xl"
              style={{ backgroundColor: secondaryBg }}
            />
          ))}
        </div>

        <div
          className="lg:col-span-2 border-2 border-b-4 rounded-[28px] p-6 space-y-4"
          style={{
            backgroundColor: cardBg,
            borderColor: borderCol,
            borderBottomColor: borderBottomCol
          }}
        >
          <div className="h-8 w-60 rounded-xl" style={{ backgroundColor: shimmerBox }} />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-28 rounded-2xl" style={{ backgroundColor: secondaryBg }} />
            <div className="h-28 rounded-2xl" style={{ backgroundColor: secondaryBg }} />
          </div>
          <div className="space-y-3 pt-3">
            {[1, 2, 3].map(i => (
              <div
                key={i}
                className="h-12 rounded-2xl"
                style={{ backgroundColor: secondaryBg }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Generic Adaptive Tab Skeleton
export const GenericTabSkeleton: React.FC<{ activeTab?: string; title?: string; activeComplex?: QuranComplex | null }> = ({
  activeTab = 'general',
  activeComplex
}) => {
  const cardBg = activeComplex?.theme?.cardColor || '#203843';
  const secondaryBg = activeComplex?.theme?.secondaryColor || '#1b2e35';
  const borderCol = lightenHex(cardBg, 0.18);
  const borderBottomCol = darkenHex(cardBg, 0.35);
  const shimmerBox = lightenHex(cardBg, 0.12);

  return (
    <div className="space-y-5 animate-pulse" dir="rtl">
      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className="border-2 border-b-4 rounded-[24px] p-5 space-y-2"
            style={{
              backgroundColor: cardBg,
              borderColor: borderCol,
              borderBottomColor: borderBottomCol
            }}
          >
            <div className="h-4 w-24 rounded-xl" style={{ backgroundColor: shimmerBox }} />
            <div className="h-7 w-16 rounded-xl" style={{ backgroundColor: shimmerBox }} />
          </div>
        ))}
      </div>

      {/* Content Feed */}
      <div
        className="border-2 border-b-4 rounded-[28px] p-4 space-y-3"
        style={{
          backgroundColor: cardBg,
          borderColor: borderCol,
          borderBottomColor: borderBottomCol
        }}
      >
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="h-16 rounded-2xl border"
            style={{
              backgroundColor: secondaryBg,
              borderColor: borderCol
            }}
          />
        ))}
      </div>
    </div>
  );
};

/* ========================================================================= */
/* 5. Tab Skeleton Router / Renderer                                         */
/* ========================================================================= */

interface TabSkeletonProps {
  activeTab: string;
  activeComplex?: QuranComplex | null;
}

export const TabSkeleton: React.FC<TabSkeletonProps> = ({ activeTab, activeComplex }) => {
  return (
    <div className="space-y-5 animate-pulse" dir="rtl">
      <TabHeaderLoaderBanner activeTab={activeTab} activeComplex={activeComplex} />
      {(() => {
        switch (activeTab) {
          case 'attendance':
            return <AttendanceSkeleton activeComplex={activeComplex} />;
          case 'students':
            return <StudentsSkeleton activeComplex={activeComplex} />;
          case 'home':
            return <HomeSkeleton activeComplex={activeComplex} />;
          case 'evaluation':
            return <EvaluationSkeleton activeComplex={activeComplex} />;
          case 'teacher_attendance':
            return <AttendanceSkeleton activeComplex={activeComplex} />;
          case 'exams':
          case 'certificates':
          case 'leaderboard':
          case 'behavior':
          case 'parents':
          case 'reports':
          case 'accounts':
          case 'backup':
          case 'library':
          default:
            return <GenericTabSkeleton activeTab={activeTab} activeComplex={activeComplex} />;
        }
      })()}
    </div>
  );
};

/* ========================================================================= */
/* 6. Modern Login & Transition Overlay                                      */
/* ========================================================================= */

export const LoginSyncModalOverlay: React.FC<{
  isOpen: boolean;
  userName?: string;
  activeComplex?: QuranComplex | null;
}> = ({ isOpen, userName, activeComplex }) => {
  if (!isOpen) return null;

  const accentColor = activeComplex?.theme?.accentColor || 'var(--complex-accent, #ffc800)';
  const accentShadow = activeComplex?.theme ? darkenHex(activeComplex.theme.accentColor, 0.28) : 'var(--complex-accent-shadow, #e5a500)';
  const cardBg = activeComplex?.theme?.cardColor || 'var(--complex-card, #203843)';
  const borderCol = activeComplex?.theme ? lightenHex(activeComplex.theme.cardColor, 0.2) : 'var(--complex-border, #2b4550)';
  const borderBottomCol = activeComplex?.theme ? darkenHex(activeComplex.theme.primaryColor || activeComplex.theme.cardColor, 0.35) : 'var(--complex-card-shadow, #16262e)';

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md transition-all select-none"
      dir="rtl"
    >
      <div
        className="border-2 border-b-4 rounded-[36px] p-7 sm:p-8 max-w-sm w-full text-center space-y-6 shadow-2xl animate-in zoom-in-95 duration-200 relative overflow-hidden"
        style={{
          backgroundColor: cardBg,
          borderColor: borderCol,
          borderBottomColor: borderBottomCol
        }}
      >
        {/* Noble Holy Quran with Modern Orbital Rotating Ring */}
        <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
          {/* Orbital glowing ring spinning around the Holy Quran (The Holy Quran stays steadfast & does NOT spin) */}
          <svg className="absolute inset-0 w-full h-full animate-spin" viewBox="0 0 100 100" style={{ animationDuration: '2.4s' }}>
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              className="opacity-15 text-white"
            />
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke={accentColor}
              strokeWidth="4"
              strokeDasharray="140 100"
              strokeLinecap="round"
              className="drop-shadow-[0_0_12px_rgba(255,200,0,0.7)]"
            />
          </svg>

          {/* Steadfast Holy Quran Icon & Emblem (Fixed in center, dignified and beautiful) */}
          <div
            className="w-20 h-20 rounded-[22px] border-2 border-b-4 flex flex-col items-center justify-center shadow-2xl relative z-10 select-none group"
            style={{
              backgroundColor: 'var(--complex-primary, #131f24)',
              borderColor: `${accentColor}90`,
              borderBottomColor: accentShadow,
              color: accentColor
            }}
          >
            <BookOpen className="w-10 h-10 drop-shadow-md stroke-[2.2]" />
            <span className="text-[9px] font-black tracking-widest mt-0.5 opacity-90 font-quran">المصحف الشريف</span>
          </div>
        </div>

        {/* Clean, respectful loading title */}
        <div className="space-y-1.5">
          <h3 className="text-lg font-black text-white font-heading">
            {userName ? `مرحباً بك، ${userName}` : 'مرحباً بك في المنظومة القرآنية'}
          </h3>
          <p className="text-xs font-bold leading-relaxed" style={{ color: accentColor }}>
            جَارٍ تَحْمِيلُ المَنْظُومَةِ وتَأْكِيدُ السِّجِلاَّتِ سَحَابِيّاً...
          </p>
        </div>

        {/* Sleek modern progress bar */}
        <div className="w-full bg-[#131f24] h-2.5 rounded-full overflow-hidden p-0.5 border border-white/10 shadow-inner">
          <div
            className="h-full rounded-full animate-pulse transition-all duration-300"
            style={{
              backgroundColor: accentColor,
              width: '92%',
              boxShadow: `0 0 12px ${accentColor}`
            }}
          />
        </div>
      </div>
    </div>
  );
};

export const CloudLoadingScreen: React.FC<{
  isLoading?: boolean;
  onRetry?: () => void;
  onForceEnter?: () => void;
}> = ({ isLoading = true, onForceEnter }) => {
  useEffect(() => {
    if (onForceEnter) {
      const t = setTimeout(onForceEnter, 100);
      return () => clearTimeout(t);
    }
  }, [onForceEnter]);

  return <TopProgressBar isLoading={isLoading} />;
};

export const QuranInlineLoader: React.FC<{ message?: string }> = ({
  message = 'جَارٍ تَحْدِيثُ البَيَانَاتِ سَحَابِيّاً...'
}) => {
  return (
    <div className="flex items-center justify-center gap-3 py-6 px-4 text-center select-none" dir="rtl">
      <RefreshCw className="w-4 h-4 text-[#ffc800] animate-spin" />
      <span className="text-xs font-black text-[#ffd233] tracking-wide">{message}</span>
    </div>
  );
};
