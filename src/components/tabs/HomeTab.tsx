import React from 'react';
import {
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  BookOpen,
  Send,
  Award,
  TrendingUp,
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Flame,
  Volume2,
  UserPlus,
  ShieldCheck,
  RefreshCw,
  ShieldAlert,
  MessageCircle,
  Trophy,
  CheckCircle2,
  FileText,
  FolderArchive
} from 'lucide-react';
import { Student, AttendanceRecord, StudentEvaluation, AppSettings, TeacherAccount, QuranComplex } from '../../types';
import { darkenHex, lightenHex, getContrastTextColor } from '../../lib/themeUtils';
import { StudentProgressAnalyticsSection } from './StudentProgressAnalyticsSection';

interface HomeTabProps {
  students: Student[];
  attendance: AttendanceRecord[];
  evaluations: StudentEvaluation[];
  settings: AppSettings;
  teachers?: TeacherAccount[];
  currentUserName?: string;
  isSupervisor?: boolean;
  isDeveloper?: boolean;
  pendingApplicationsCount?: number;
  onOpenApplications?: () => void;
  activeComplex?: QuranComplex | null;
  onNavigateTab: (tab: string) => void;
  onSelectStudentForEval?: (studentId: string) => void;
  onOpenTeacherManagement?: () => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({
  students,
  attendance,
  evaluations,
  settings,
  teachers = [],
  currentUserName,
  isSupervisor = false,
  isDeveloper = false,
  pendingApplicationsCount = 0,
  onOpenApplications,
  activeComplex,
  onNavigateTab,
  onSelectStudentForEval,
  onOpenTeacherManagement
}) => {
  // Local date helper to prevent timezone desync
  const getLocalDateStr = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const todayStr = getLocalDateStr();

  // Theme colors calculation with Duolingo defaults
  const currentTheme = activeComplex?.theme || settings?.theme;
  const themePrimary = currentTheme?.primaryColor || '#131f24';
  const themeSecondary = currentTheme?.secondaryColor || '#1b2e35';
  const themeAccent = currentTheme?.accentColor || '#ffc800';
  const themeCardBg = currentTheme?.cardColor || '#203843';
  const themeBorder = lightenHex(themeCardBg, 0.18);
  const themeBorderBottom = darkenHex(themeCardBg, 0.35);
  const themeAccentShadow = darkenHex(themeAccent, 0.28);
  const accentTextColor = getContrastTextColor(themeAccent);

  // Today's attendance calculation
  const todayAttendance = attendance.filter(a => a.date === todayStr);
  const presentCount = todayAttendance.filter(a => a.status === 'حاضر').length;
  const absentCount = todayAttendance.filter(a => a.status === 'غائب').length;
  const lateCount = todayAttendance.filter(a => a.status === 'متأخر').length;
  const excusedCount = todayAttendance.filter(a => a.status === 'معتذر').length;
  const unrecordedCount = Math.max(0, students.length - todayAttendance.length);

  const attendanceRate = students.length > 0
    ? Math.round(((presentCount + lateCount) / students.length) * 100)
    : 0;

  // Today's evaluations
  const todayEvals = evaluations.filter(e => e.date === todayStr);
  const evaluatedCount = todayEvals.length;
  const evalRate = presentCount > 0
    ? Math.round((evaluatedCount / presentCount) * 100)
    : 0;

  // Students by level
  const strongCount = students.filter(s => s.level === 'قوي').length;
  const mediumCount = students.filter(s => s.level === 'متوسط').length;
  const weakCount = students.filter(s => s.level === 'ضعيف').length;

  // Refined, dignified Arabic greeting calculation
  const rawTeacherName = (currentUserName || settings.teacherName || '').trim();
  let cleanName = rawTeacherName
    .replace(/^أ\/\s*/, '')
    .replace(/^الأستاذ\s*\/\s*/, '')
    .replace(/^الشيخ\s*\/\s*/, '')
    .trim();

  // If email was provided as username (e.g. azmaltaeleme@gmail.com)
  if (cleanName.includes('@')) {
    cleanName = cleanName.split('@')[0];
  }

  let formattedGreetingName = '';
  if (!cleanName || cleanName.toLowerCase() === 'admin' || cleanName.toLowerCase() === 'developer') {
    formattedGreetingName = isDeveloper ? 'المشرف والمطور العام' : isSupervisor ? 'مشرف المجمع القرآني' : 'معلم ومحفظ الحلقة';
  } else if (cleanName.includes('منتصر') || isDeveloper) {
    formattedGreetingName = cleanName.includes('منتصر') ? `المهندس ${cleanName}` : (cleanName || 'المشرف والمطور العام');
  } else if (isSupervisor) {
    formattedGreetingName = cleanName.startsWith('الشيخ') ? cleanName : `فضيلة الشيخ / ${cleanName}`;
  } else {
    formattedGreetingName = cleanName.startsWith('الشيخ') || cleanName.startsWith('الأستاذ') ? cleanName : `الأستاذ / ${cleanName}`;
  }

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* 1. Welcome Banner with Duolingo 3D Tactile Buttons & Dynamic Theme */}
      <div
        className="relative overflow-hidden rounded-[28px] border-2 border-b-4 p-6 sm:p-8 shadow-xl transition-all duration-300"
        style={{
          backgroundColor: themeSecondary,
          borderColor: themeBorder,
          borderBottomColor: themeBorderBottom
        }}
      >
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <div
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-2xl border-2 border-b-4 text-xs font-black shadow-sm"
                style={{
                  backgroundColor: `${themeAccent}20`,
                  borderColor: `${themeAccent}60`,
                  borderBottomColor: themeAccentShadow,
                  color: themeAccent
                }}
              >
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                <span>لوحة المتابعة اليومية • {activeComplex?.name || 'مجمع تحفيظ القرآن الكريم'}</span>
              </div>
              <span
                className="text-[11px] px-2.5 py-1 rounded-full font-black border-2 border-b-2"
                style={{
                  backgroundColor: `${themeAccent}15`,
                  borderColor: `${themeAccent}40`,
                  color: themeAccent
                }}
              >
                {isDeveloper ? 'المشرف والمطور العام' : isSupervisor ? 'المعلم المشرف' : 'معلم الحلقة'}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 flex-wrap">
                <h2 className="text-2xl sm:text-3xl md:text-4xl font-black font-heading text-white flex items-center gap-2.5 flex-wrap drop-shadow-md">
                  <span>مرحباً بك،</span>
                  <span className="text-amber-300 font-extrabold tracking-normal">
                    {formattedGreetingName}
                  </span>
                  <span className="text-2xl select-none inline-block hover:scale-125 transition-transform">👋</span>
                </h2>
              </div>
              <p className="text-slate-200 text-xs sm:text-sm font-bold flex items-center gap-2 leading-relaxed">
                <span>حفظك الله ورعاك وسدد خطاك في خدمة كتاب الله الكريم ✨</span>
              </p>
            </div>

            <p className="text-slate-200 text-xs sm:text-sm font-bold max-w-xl leading-relaxed">
              {activeComplex?.name || 'مجمع تحفيظ القرآن الكريم'} • لوحة المتابعة الشاملة للحلقات والتسميع اليومي.
            </p>
          </div>

          {/* Duolingo 3D Action Buttons (Prominent Attendance & Evaluation in Complex Theme) */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Attendance Button (تسجيل حضور اليوم) */}
            <button
              type="button"
              onClick={() => onNavigateTab('attendance')}
              className="px-5 py-3.5 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2.5 border-2 border-b-4 active:translate-y-[2px] active:border-b-2 shadow-xl cursor-pointer transition-all hover:brightness-110 select-none"
              style={unrecordedCount === 0 && students.length > 0 ? {
                backgroundColor: themeAccent,
                color: accentTextColor,
                borderColor: themeAccent,
                borderBottomColor: themeAccentShadow,
                boxShadow: `0 4px 14px ${themeAccent}40`
              } : {
                backgroundColor: themeCardBg,
                color: '#ffffff',
                borderColor: `${themeAccent}70`,
                borderBottomColor: themeBorderBottom,
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)'
              }}
              title={unrecordedCount === 0 && students.length > 0 ? 'تم تحضير جميع الطلاب لليوم بنجاح' : `تسجيل ومتابعة حضور اليوم`}
            >
              <CheckCircle
                className="w-5 h-5 shrink-0 stroke-[2.5]"
                style={{ color: unrecordedCount === 0 && students.length > 0 ? accentTextColor : themeAccent }}
              />
              <span className="text-sm font-black" style={{ color: unrecordedCount === 0 && students.length > 0 ? accentTextColor : '#ffffff' }}>
                {unrecordedCount === 0 && students.length > 0 ? 'تم تسجيل حضور اليوم' : 'تسجيل حضور اليوم'}
              </span>
              {students.length > 0 && (
                <span
                  className="px-2.5 py-1 rounded-xl text-xs font-black border shadow-xs bg-white/20 border-white/30 text-white"
                >
                  {unrecordedCount === 0 ? `مكتمل (${presentCount}/${students.length}) ✓` : `${todayAttendance.length}/${students.length} (متبقٍ ${unrecordedCount})`}
                </span>
              )}
            </button>


            {/* Evaluation Button */}
            <button
              onClick={() => onNavigateTab('evaluation')}
              className="px-5 py-3 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2.5 border-2 border-b-4 active:translate-y-[2px] active:border-b-2 shadow-lg cursor-pointer transition-all hover:brightness-110"
              style={{
                backgroundColor: themeCardBg,
                color: '#ffffff',
                borderColor: `${themeAccent}70`,
                borderBottomColor: themeBorderBottom
              }}
            >
              <BookOpen className="w-4 h-4" style={{ color: themeAccent }} />
              <span>تقييم التسميع اليوم</span>
            </button>

            {/* Teacher Management Button */}
            {(isSupervisor || isDeveloper) && onOpenTeacherManagement && (
              <button
                onClick={onOpenTeacherManagement}
                className="px-4 sm:px-5 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 border-2 border-b-4 active:translate-y-[2px] active:border-b-2 shadow-md transition-all cursor-pointer hover:brightness-110"
                style={{
                  backgroundColor: themeCardBg,
                  borderColor: `${themeAccent}70`,
                  borderBottomColor: themeBorderBottom,
                  color: '#ffffff'
                }}
              >
                <Users className="w-4 h-4" style={{ color: themeAccent }} />
                <span>إدارة المعلمين ({teachers.length})</span>
              </button>
            )}

            {/* Registration Applications Quick Action Button */}
            {(isSupervisor || isDeveloper) && onOpenApplications && (
              <button
                type="button"
                onClick={onOpenApplications}
                className="px-4 sm:px-5 py-2.5 rounded-2xl font-black text-xs sm:text-sm flex items-center gap-2 border-2 border-b-4 active:translate-y-[2px] active:border-b-2 shadow-md transition-all cursor-pointer hover:brightness-110"
                style={{
                  backgroundColor: pendingApplicationsCount > 0 ? themeAccent : themeCardBg,
                  borderColor: pendingApplicationsCount > 0 ? themeAccent : `${themeAccent}70`,
                  borderBottomColor: pendingApplicationsCount > 0 ? themeAccentShadow : themeBorderBottom,
                  color: pendingApplicationsCount > 0 ? accentTextColor : '#ffffff'
                }}
                title="تفقد طلبات الانضمام والتسجيل الواردة إلى المجمع"
              >
                <UserPlus className="w-4 h-4" style={{ color: pendingApplicationsCount > 0 ? accentTextColor : themeAccent }} />
                <span>طلبات الانضمام</span>
                {pendingApplicationsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-red-600 text-white animate-pulse">
                    {pendingApplicationsCount} جديد
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Decorative Duolingo Subtle Glow */}
        <div
          className="absolute -top-12 -left-12 w-64 h-64 pointer-events-none opacity-20 rounded-full blur-3xl"
          style={{ backgroundColor: themeAccent }}
        />
      </div>

      {/* Real-time Incoming Applications Alert Banner for Supervisor */}
      {(isSupervisor || isDeveloper) && pendingApplicationsCount > 0 && onOpenApplications && (
        <div
          className="p-4 sm:p-5 rounded-[24px] border-2 border-b-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg animate-in zoom-in-95 duration-200"
          style={{
            backgroundColor: 'rgba(var(--complex-accent-rgb, 255, 200, 0), 0.15)',
            borderColor: 'var(--complex-accent, #ffc800)',
            borderBottomColor: 'var(--complex-accent-shadow, #e5a500)'
          }}
        >
          <div className="flex items-center gap-3.5">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-xl border-2 border-b-4 shadow-md shrink-0"
              style={{
                backgroundColor: 'var(--complex-accent, #ffc800)',
                color: 'var(--complex-accent-text, #131f24)',
                borderColor: 'var(--complex-accent, #ffc800)',
                borderBottomColor: 'var(--complex-accent-shadow, #e5a500)'
              }}
            >
              <UserPlus className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm sm:text-base font-black text-white font-heading">
                  طلبات انضمام جديدة واردة إلى المجمع
                </h4>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-red-600 text-white animate-bounce shadow-sm">
                  {pendingApplicationsCount} طلبات بانتظار الاعتماد
                </span>
              </div>
              <p className="text-xs text-slate-200 font-bold mt-1">
                وصلت طلبات تسجيل طلاب جديدة عبر رابط بوابة المجمع، اضغط لمراجعتها واعتمادها وإلحاق الطلاب بالحلقات فوراً.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenApplications}
            className="px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-black border-2 border-b-4 active:translate-y-0.5 shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer hover:brightness-110 shrink-0 self-start sm:self-auto"
            style={{
              backgroundColor: 'var(--complex-accent, #ffc800)',
              color: 'var(--complex-accent-text, #131f24)',
              borderColor: 'var(--complex-accent, #ffc800)',
              borderBottomColor: 'var(--complex-accent-shadow, #e5a500)'
            }}
          >
            <span>مراجعة واعتماد الطلبات الآن</span>
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. Main Stats Grid (4 Cards in Duolingo 3D Style & Theme) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Total Students */}
        <div
          className="border-2 border-b-4 rounded-[24px] p-4 sm:p-5 transition-all shadow-md group hover:translate-y-[-2px]"
          style={{
            backgroundColor: themeCardBg,
            borderColor: `${themeAccent}50`,
            borderBottomColor: themeBorderBottom
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-200">إجمالي طلاب الحلقة</span>
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center border-2 border-b-4 shadow-inner"
              style={{
                backgroundColor: `${themeAccent}25`,
                borderColor: `${themeAccent}60`,
                borderBottomColor: themeAccentShadow,
                color: themeAccent
              }}
            >
              <Users className="w-5 h-5" style={{ color: themeAccent }} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-heading">
            {students.length}
          </div>
          <div className="text-[11px] mt-2.5 flex flex-wrap items-center gap-1.5 font-bold">
            <span
              className="px-2 py-0.5 rounded-xl border-2 border-b-2 font-black"
              style={{
                backgroundColor: `${themeAccent}25`,
                borderColor: `${themeAccent}70`,
                borderBottomColor: themeAccentShadow,
                color: themeAccent
              }}
            >
              {strongCount} متقدم
            </span>
            <span
              className="px-2 py-0.5 rounded-xl border-2 border-b-2 font-black"
              style={{
                backgroundColor: `${themeAccent}20`,
                borderColor: `${themeAccent}60`,
                borderBottomColor: themeAccentShadow,
                color: themeAccent
              }}
            >
              {mediumCount} متوسط
            </span>
            <span
              className="px-2 py-0.5 rounded-xl border-2 border-b-2 font-black"
              style={{
                backgroundColor: '#ff960020',
                borderColor: '#ff960060',
                borderBottomColor: '#e68300',
                color: '#ff9600'
              }}
            >
              {weakCount} متابعة
            </span>
          </div>
        </div>

        {/* Card 2: Today Attendance Rate */}
        <div
          className="border-2 border-b-4 rounded-[24px] p-4 sm:p-5 transition-all shadow-md group hover:translate-y-[-2px]"
          style={{
            backgroundColor: themeCardBg,
            borderColor: `${themeAccent}50`,
            borderBottomColor: themeBorderBottom
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-200">حضور اليوم ({todayStr})</span>
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center border-2 border-b-4 shadow-inner"
              style={{
                backgroundColor: `${themeAccent}25`,
                borderColor: `${themeAccent}60`,
                borderBottomColor: themeAccentShadow,
                color: themeAccent
              }}
            >
              <CalendarDays className="w-5 h-5" style={{ color: themeAccent }} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-heading">
            {presentCount} <span className="text-xs text-slate-300 font-normal">/ {students.length} طالب</span>
          </div>
          <div className="text-[11px] text-slate-200 mt-2.5 flex items-center gap-1.5 font-bold">
            <span>نسبة الحضور:</span>
            <span
              className="px-2.5 py-0.5 rounded-xl border-2 border-b-2 font-black"
              style={{
                backgroundColor: `${themeAccent}25`,
                borderColor: `${themeAccent}60`,
                borderBottomColor: themeAccentShadow,
                color: themeAccent
              }}
            >
              {attendanceRate}%
            </span>
          </div>
        </div>

        {/* Card 3: Today Recited */}
        <div
          className="border-2 border-b-4 rounded-[24px] p-4 sm:p-5 transition-all shadow-md group hover:translate-y-[-2px]"
          style={{
            backgroundColor: themeCardBg,
            borderColor: `${themeAccent}50`,
            borderBottomColor: themeBorderBottom
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-200">التسميع المنجز اليوم</span>
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center border-2 border-b-4 shadow-inner"
              style={{
                backgroundColor: `${themeAccent}25`,
                borderColor: `${themeAccent}60`,
                borderBottomColor: themeAccentShadow,
                color: themeAccent
              }}
            >
              <BookOpen className="w-5 h-5" style={{ color: themeAccent }} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-heading" style={{ color: themeAccent }}>
            {evaluatedCount} <span className="text-xs text-slate-300 font-normal">من {presentCount} حاضر</span>
          </div>
          <div className="text-[11px] text-slate-200 mt-2.5 flex items-center gap-1.5 font-bold">
            <span>نسبة إنجاز التسميع:</span>
            <span
              className="px-2.5 py-0.5 rounded-xl font-black border-2 border-b-2 shadow-sm"
              style={{
                backgroundColor: `${themeAccent}25`,
                borderColor: `${themeAccent}60`,
                borderBottomColor: themeAccentShadow,
                color: themeAccent
              }}
            >
              {evalRate}%
            </span>
          </div>
        </div>

        {/* Card 4: Approved Quran Plans Active */}
        <div
          className="border-2 border-b-4 rounded-[24px] p-4 sm:p-5 transition-all shadow-md group hover:translate-y-[-2px]"
          style={{
            backgroundColor: themeCardBg,
            borderColor: `${themeAccent}50`,
            borderBottomColor: themeBorderBottom
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-200">الخطط المنهجية المعتمدة</span>
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center border-2 border-b-4 shadow-inner"
              style={{
                backgroundColor: `${themeAccent}25`,
                borderColor: `${themeAccent}60`,
                borderBottomColor: themeAccentShadow,
                color: themeAccent
              }}
            >
              <Sparkles className="w-5 h-5" style={{ color: themeAccent }} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-heading" style={{ color: themeAccent }}>
            {students.filter(s => s.aiPlan).length}
          </div>
          <div className="text-[11px] text-slate-200 mt-2.5 font-bold">
            <span
              className="px-2.5 py-0.5 rounded-xl border-2 border-b-2 font-black inline-flex items-center gap-1"
              style={{
                backgroundColor: `${themeAccent}25`,
                borderColor: `${themeAccent}60`,
                borderBottomColor: themeAccentShadow,
                color: themeAccent
              }}
            >
              <Sparkles className="w-3 h-3" />
              <span>خطط مخصصة نشطة ومحدثة</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2.5 Student Progress Analytics & Daily Trend Charts Section in Complex Theme */}
      <StudentProgressAnalyticsSection
        students={students}
        evaluations={evaluations}
        activeComplex={activeComplex}
        settings={settings}
        onNavigateTab={onNavigateTab}
      />

      {/* 3. Main Content Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Today's Student Recitation Roster with Duolingo 3D Polish */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black font-heading text-white flex items-center gap-2">
              <Flame className="w-5 h-5" style={{ color: themeAccent }} />
              <span>متابعة تسميع طلاب الحلقة اليوم</span>
            </h3>
            <button
              onClick={() => onNavigateTab('evaluation')}
              className="text-xs flex items-center gap-1 font-black cursor-pointer hover:underline"
              style={{ color: themeAccent }}
            >
              <span>فتح شاشة التقييم الكاملة</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>

          <div
            className="border-2 border-b-4 rounded-[28px] overflow-hidden shadow-lg divide-y divide-[#2b4550]/80 p-2 sm:p-3"
            style={{
              backgroundColor: themeCardBg,
              borderColor: themeBorder,
              borderBottomColor: themeBorderBottom
            }}
          >
            {students.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm font-bold">
                لم يتم تسجيل أي طلاب بعد. يمكنك إضافة طلاب من تبويب "الطلاب والتسجيل".
              </div>
            ) : (
              students.map(student => {
                const att = todayAttendance.find(a => a.studentId === student.id);
                const isPresent = att?.status === 'حاضر';
                const isAbsent = att?.status === 'غائب';
                const isExcused = att?.status === 'معتذر';
                const isLate = att?.status === 'متأخر';
                const hasEvaluation = todayEvals.some(e => e.studentId === student.id);

                return (
                  <div
                    key={student.id}
                    className={`m-1.5 p-4 rounded-[22px] border-2 border-b-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-all shadow-md group ${
                      isAbsent ? 'opacity-65' : isExcused ? 'opacity-75' : 'hover:-translate-y-0.5'
                    }`}
                    style={{
                      backgroundColor: isAbsent ? themePrimary : isExcused ? themePrimary : themeSecondary,
                      borderColor: isAbsent ? 'rgba(255, 75, 75, 0.5)' : isExcused ? 'rgba(206, 130, 255, 0.5)' : themeBorder,
                      borderBottomColor: isAbsent ? '#ea2b2b' : isExcused ? '#a558dc' : themeBorderBottom
                    }}
                  >
                    {/* Student Identity and Quran Location */}
                    <div className="flex items-center gap-3.5">
                      <div
                        className="w-12 h-12 rounded-2xl border-2 border-b-4 flex items-center justify-center font-black text-base shadow-md shrink-0 group-hover:scale-105 transition-transform"
                        style={{
                          backgroundColor: `${themeAccent}25`,
                          borderColor: `${themeAccent}70`,
                          borderBottomColor: themeAccentShadow,
                          color: themeAccent
                        }}
                      >
                        {student.name.charAt(0)}
                      </div>

                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm sm:text-base font-black text-white truncate font-heading">{student.name}</h4>
                          <span
                            className={`text-[10px] px-2.5 py-0.5 rounded-xl font-black border-2 border-b-2 shadow-xs ${
                              student.level === 'قوي'
                                ? 'bg-amber-400/20 text-amber-300 border-amber-400/50 border-b-amber-600'
                                : student.level === 'متوسط'
                                ? 'bg-[#1cb0f6]/20 text-[#1cb0f6] border-[#1cb0f6]/50 border-b-[#1899d6]'
                                : 'bg-[#ff9600]/20 text-[#ff9600] border-[#ff9600]/50 border-b-[#e68300]'
                            }`}
                          >
                            {student.level}
                          </span>
                        </div>

                        {/* Recitation Location & Target In Duolingo 3D Mini-Pills */}
                        <div className="flex items-center gap-1.5 flex-wrap text-xs">
                          <span
                            className="px-3 py-1 rounded-xl font-bold border-2 border-b-2 flex items-center gap-1.5 shadow-xs"
                            style={{
                              backgroundColor: themePrimary,
                              borderColor: `${themeAccent}40`,
                              borderBottomColor: themeBorderBottom,
                              color: '#ffffff'
                            }}
                          >
                            <BookOpen className="w-3.5 h-3.5" style={{ color: themeAccent }} />
                            <span>سورة {student.currentSurahName} (الآية {student.currentAyah})</span>
                          </span>
                          <span
                            className="px-3 py-1 rounded-xl font-bold border-2 border-b-2 flex items-center gap-1.5 shadow-xs"
                            style={{
                              backgroundColor: `${themeAccent}25`,
                              borderColor: `${themeAccent}70`,
                              borderBottomColor: themeAccentShadow,
                              color: themeAccent
                            }}
                          >
                            <span className="text-slate-300 font-bold">ورد الحفظ:</span>
                            <strong className="font-black text-white">{student.dailyNewTarget}</strong>
                          </span>
                          {student.dailyReviewTarget && (
                            <span
                              className="px-3 py-1 rounded-xl font-bold border-2 border-b-2 flex items-center gap-1.5 shadow-xs"
                              style={{
                                backgroundColor: 'rgba(28, 176, 246, 0.2)',
                                borderColor: 'rgba(28, 176, 246, 0.6)',
                                borderBottomColor: '#1899d6',
                                color: '#38bdf8'
                              }}
                            >
                              <span className="text-slate-300 font-bold">ورد المراجعة:</span>
                              <strong className="font-black text-white">{student.dailyReviewTarget}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Badges & Recitation Button in Duolingo 3D */}
                    <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                      {/* Attendance Badge in Duolingo 3D style */}
                      <span
                        className="text-xs px-3.5 py-1.5 rounded-xl font-black border-2 border-b-4 shadow-sm select-none"
                        style={
                          isPresent
                            ? {
                                backgroundColor: `${themeAccent}25`,
                                borderColor: `${themeAccent}70`,
                                borderBottomColor: themeAccentShadow,
                                color: themeAccent
                              }
                            : isAbsent
                            ? {
                                backgroundColor: 'rgba(255, 75, 75, 0.2)',
                                borderColor: 'rgba(255, 75, 75, 0.6)',
                                borderBottomColor: '#ea2b2b',
                                color: '#ff4b4b'
                              }
                            : isExcused
                            ? {
                                backgroundColor: 'rgba(206, 130, 255, 0.2)',
                                borderColor: 'rgba(206, 130, 255, 0.6)',
                                borderBottomColor: '#a558dc',
                                color: '#ce82ff'
                              }
                            : isLate
                            ? {
                                backgroundColor: 'rgba(255, 150, 0, 0.2)',
                                borderColor: 'rgba(255, 150, 0, 0.6)',
                                borderBottomColor: '#e68300',
                                color: '#ff9600'
                              }
                            : {
                                backgroundColor: `${themeAccent}18`,
                                borderColor: `${themeAccent}50`,
                                borderBottomColor: themeAccentShadow,
                                color: themeAccent
                              }
                        }
                      >
                        {att?.status ? `سجل: ${att.status}` : 'لم يسجل بعد'}
                      </span>

                      {/* Recitation Evaluation Status in Complex Theme */}
                      {hasEvaluation ? (
                        <span
                          className="text-xs px-4 py-2 rounded-xl font-black border-2 border-b-4 flex items-center gap-1.5 shadow-sm"
                          style={{
                            backgroundColor: `${themeAccent}25`,
                            borderColor: `${themeAccent}80`,
                            borderBottomColor: themeAccentShadow,
                            color: themeAccent
                          }}
                        >
                          <CheckCircle2 className="w-4 h-4" style={{ color: themeAccent }} />
                          <span>تم التسميع اليوم ✓</span>
                        </span>
                      ) : isPresent ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectStudentForEval) {
                              onSelectStudentForEval(student.id);
                            }
                            onNavigateTab('evaluation');
                          }}
                          className="text-xs px-4 py-2 rounded-xl font-black border-2 border-b-4 active:translate-y-[2px] active:border-b-2 shadow-md transition-all cursor-pointer flex items-center gap-2 hover:brightness-110"
                          style={{
                            backgroundColor: themeAccent,
                            borderColor: themeAccent,
                            borderBottomColor: themeAccentShadow,
                            color: accentTextColor
                          }}
                        >
                          <BookOpen className="w-4 h-4" style={{ color: accentTextColor }} />
                          <span>تسميع الآن</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right 1 Col: Quick Access Tiles in Duolingo 3D & WhatsApp Spotlight */}
        <div className="space-y-5">
          {/* Quick Access Container */}
          <div
            className="border-2 border-b-4 rounded-[28px] p-5 shadow-lg space-y-3"
            style={{
              backgroundColor: themeCardBg,
              borderColor: `${themeAccent}40`,
              borderBottomColor: themeBorderBottom
            }}
          >
            <h3 className="text-sm font-black font-heading text-white flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4" style={{ color: themeAccent }} />
              <span>الوصول السريع للأقسام</span>
            </h3>

            <div className="space-y-2.5">
              {/* Teachers Management */}
              {(isSupervisor || isDeveloper) && onOpenTeacherManagement && (
                <button
                  onClick={onOpenTeacherManagement}
                  className="w-full p-3 rounded-2xl border-2 border-b-4 active:translate-y-[2px] active:border-b-2 flex items-center justify-between text-right transition-all cursor-pointer shadow-sm group hover:brightness-110"
                  style={{
                    backgroundColor: themeSecondary,
                    borderColor: `${themeAccent}40`,
                    borderBottomColor: themeBorderBottom
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl border-2 border-b-4 flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `${themeAccent}25`,
                        borderColor: `${themeAccent}60`,
                        borderBottomColor: themeAccentShadow,
                        color: themeAccent
                      }}
                    >
                      <Users className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black text-white">إدارة المعلمين والمعاونين ({teachers.length})</span>
                  </div>
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" style={{ color: themeAccent }} />
                </button>
              )}

              {/* Students Management */}
              <button
                onClick={() => onNavigateTab('students')}
                className="w-full p-3 rounded-2xl border-2 border-b-4 active:translate-y-[2px] active:border-b-2 flex items-center justify-between text-right transition-all cursor-pointer shadow-sm group hover:brightness-110"
                style={{
                  backgroundColor: themeSecondary,
                  borderColor: `${themeAccent}40`,
                  borderBottomColor: themeBorderBottom
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl border-2 border-b-4 flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: `${themeAccent}25`,
                      borderColor: `${themeAccent}60`,
                      borderBottomColor: themeAccentShadow,
                      color: themeAccent
                    }}
                  >
                    <Users className="w-4 h-4" style={{ color: themeAccent }} />
                  </div>
                  <span className="text-xs font-black text-white">إدارة الطلاب والتسجيل</span>
                </div>
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" style={{ color: themeAccent }} />
              </button>

              {/* Attendance */}
              <button
                onClick={() => onNavigateTab('attendance')}
                className="w-full p-3 rounded-2xl border-2 border-b-4 active:translate-y-[2px] active:border-b-2 flex items-center justify-between text-right transition-all cursor-pointer shadow-sm group hover:brightness-110"
                style={{
                  backgroundColor: themeSecondary,
                  borderColor: `${themeAccent}40`,
                  borderBottomColor: themeBorderBottom
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl border-2 border-b-4 flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: `${themeAccent}25`,
                      borderColor: `${themeAccent}60`,
                      borderBottomColor: themeAccentShadow,
                      color: themeAccent
                    }}
                  >
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-black text-white">تحضير حضور الطلاب</span>
                </div>
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" style={{ color: themeAccent }} />
              </button>

              {/* Teacher Attendance */}
              <button
                onClick={() => onNavigateTab('teacher_attendance')}
                className="w-full p-3 rounded-2xl border-2 border-b-4 active:translate-y-[2px] active:border-b-2 flex items-center justify-between text-right transition-all cursor-pointer shadow-sm group hover:brightness-110"
                style={{
                  backgroundColor: themeSecondary,
                  borderColor: `${themeAccent}40`,
                  borderBottomColor: themeBorderBottom
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl border-2 border-b-4 flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: '#ff960025',
                      borderColor: '#ff960060',
                      borderBottomColor: '#e68300',
                      color: '#ff9600'
                    }}
                  >
                    <Clock className="w-4 h-4 text-[#ff9600]" />
                  </div>
                  <span className="text-xs font-black text-white">تحضير المعلمين والمناوبات</span>
                </div>
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" style={{ color: themeAccent }} />
              </button>

              {/* Behavior & Violations */}
              <button
                onClick={() => onNavigateTab('behavior')}
                className="w-full p-3 rounded-2xl border-2 border-b-4 active:translate-y-[2px] active:border-b-2 flex items-center justify-between text-right transition-all cursor-pointer shadow-sm group hover:brightness-110"
                style={{
                  backgroundColor: themeSecondary,
                  borderColor: `${themeAccent}40`,
                  borderBottomColor: themeBorderBottom
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl border-2 border-b-4 flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: '#ff4b4b25',
                      borderColor: '#ff4b4b60',
                      borderBottomColor: '#ea2b2b',
                      color: '#ff4b4b'
                    }}
                  >
                    <ShieldAlert className="w-4 h-4 text-[#ff4b4b]" />
                  </div>
                  <span className="text-xs font-black text-white">المخالفات والتوجيهات السلوكية</span>
                </div>
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" style={{ color: themeAccent }} />
              </button>

              {/* Periodic Reports */}
              <button
                onClick={() => onNavigateTab('reports')}
                className="w-full p-3 rounded-2xl border-2 border-b-4 active:translate-y-[2px] active:border-b-2 flex items-center justify-between text-right transition-all cursor-pointer shadow-sm group hover:brightness-110"
                style={{
                  backgroundColor: themeSecondary,
                  borderColor: `${themeAccent}40`,
                  borderBottomColor: themeBorderBottom
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl border-2 border-b-4 flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: `${themeAccent}25`,
                      borderColor: `${themeAccent}60`,
                      borderBottomColor: themeAccentShadow,
                      color: themeAccent
                    }}
                  >
                    <Award className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-black text-white">التقارير الأسبوعية والشهرية</span>
                </div>
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" style={{ color: themeAccent }} />
              </button>
            </div>
          </div>

          {/* Prominent WhatsApp Reports Action Card in Duolingo 3D */}
          <div
            onClick={() => onNavigateTab('parents')}
            className="p-4 sm:p-5 rounded-[28px] border-2 border-b-4 cursor-pointer transition-all shadow-xl group active:translate-y-[2px] active:border-b-2 hover:brightness-105"
            style={{
              backgroundColor: themeCardBg,
              borderColor: `${themeAccent}70`,
              borderBottomColor: themeAccentShadow
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center border-2 border-b-4 shadow-lg shrink-0 group-hover:scale-105 transition-transform"
                  style={{
                    backgroundColor: `${themeAccent}25`,
                    borderColor: `${themeAccent}80`,
                    borderBottomColor: themeAccentShadow,
                    color: themeAccent
                  }}
                >
                  <MessageCircle className="w-6 h-6" style={{ color: themeAccent }} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white flex items-center gap-1.5 font-heading">
                    <span>إرسال تقارير ورسائل الواتساب</span>
                    <Sparkles className="w-3.5 h-3.5" style={{ color: themeAccent }} />
                  </h4>
                  <p className="text-xs text-slate-200 font-bold mt-0.5">
                    إرسال التقارير اليومية لأولياء الأمور بنقرة واحدة
                  </p>
                </div>
              </div>
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1.5 transition-transform shrink-0" style={{ color: themeAccent }} />
            </div>
          </div>

          {/* Reciter Recommendation Spotlight Card */}
          <div
            className="border-2 border-b-4 rounded-[28px] p-5 shadow-lg space-y-2"
            style={{
              backgroundColor: themeCardBg,
              borderColor: themeBorder,
              borderBottomColor: themeBorderBottom
            }}
          >
            <div className="flex items-center gap-2 text-xs font-black" style={{ color: themeAccent }}>
              <Volume2 className="w-4 h-4" />
              <span>القارئ الموصى به اليوم للحلقة</span>
            </div>
            <h4 className="text-sm font-black text-white">الشيخ محمود خليل الحصري (المصحف المعلم)</h4>
            <p className="text-xs text-slate-300 font-bold leading-relaxed">
              يوصى بالاستماع لقصار السور وأجزاء التلاوة بصوت الشيخ الحصري لترسيخ مخارج الحروف وأحكام التجويد والترتيل المتقن قبل التسميع.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
