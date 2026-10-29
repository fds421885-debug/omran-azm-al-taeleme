import React from 'react';
import {
  BookOpen,
  LogOut,
  UserCheck,
  Calendar,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Moon,
  Clock,
  Users,
  Settings,
  Layers,
  ChevronDown,
  Building2,
  Workflow,
  CheckCircle,
  Check,
  X,
  UserCog,
  UserPlus
} from 'lucide-react';
import { UserRole, AppSettings, Halaqah, QuranComplex, TeacherAccount } from '../types';
import { darkenHex, lightenHex } from '../lib/themeUtils';

interface NavbarProps {
  currentUser: { username: string; role: UserRole; studentId?: string } | null;
  currentTeacher?: TeacherAccount | null;
  onLinkGoogleTeacher?: () => Promise<void>;
  onUnlinkGoogleTeacher?: () => Promise<void>;
  isLinkingGoogleTeacher?: boolean;
  onLogout: () => void;
  settings: AppSettings;
  studentsCount: number;
  teachersCount?: number;
  complexesCount?: number;
  complexName?: string;
  activeComplex?: QuranComplex | null;
  availableComplexes?: QuranComplex[];
  activeComplexId?: string;
  onSwitchComplex?: (complexId: string) => void;
  onOpenMultiComplexModal?: () => void;
  canSwitchComplex?: boolean;
  halaqahs?: Halaqah[];
  assignedHalaqahs?: Halaqah[];
  isSupervisor?: boolean;
  isDeveloper?: boolean;
  pendingApplicationsCount?: number;
  onOpenApplications?: () => void;
  activeHalaqahId?: string;
  onSwitchHalaqah?: (halaqahId: string) => void;
  onOpenTeacherManagement?: () => void;
  onOpenSettings?: () => void;
  onOpenComplexManagement?: () => void;
  onOpenPrivacyPolicy?: () => void;
  onOpenEditAccount?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  currentTeacher,
  onLinkGoogleTeacher,
  onUnlinkGoogleTeacher,
  isLinkingGoogleTeacher = false,
  onLogout,
  settings,
  studentsCount,
  teachersCount = 1,
  complexesCount = 1,
  complexName,
  activeComplex,
  availableComplexes = [],
  activeComplexId,
  onSwitchComplex,
  onOpenMultiComplexModal,
  canSwitchComplex = false,
  halaqahs = [],
  assignedHalaqahs = [],
  isSupervisor = false,
  isDeveloper = false,
  pendingApplicationsCount = 0,
  onOpenApplications,
  activeHalaqahId,
  onSwitchHalaqah,
  onOpenTeacherManagement,
  onOpenSettings,
  onOpenComplexManagement,
  onOpenPrivacyPolicy,
  onOpenEditAccount
}) => {
  const effectiveLogoUrl = (activeComplex?.logoUrl || settings?.themeLogoUrl || '').trim();
  const [logoImgFailed, setLogoImgFailed] = React.useState(false);

  React.useEffect(() => {
    setLogoImgFailed(false);
  }, [effectiveLogoUrl]);

  const [isComplexMenuOpen, setIsComplexMenuOpen] = React.useState(false);
  const [isHalaqahMenuOpen, setIsHalaqahMenuOpen] = React.useState(false);
  const complexMenuRef = React.useRef<HTMLDivElement>(null);
  const halaqahMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (complexMenuRef.current && !complexMenuRef.current.contains(e.target as Node)) {
        setIsComplexMenuOpen(false);
      }
      if (halaqahMenuRef.current && !halaqahMenuRef.current.contains(e.target as Node)) {
        setIsHalaqahMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const todayArabic = new Intl.DateTimeFormat('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date());

  // Determine which halaqahs can be selected by this user
  const selectableHalaqahs = isSupervisor ? halaqahs : assignedHalaqahs;
  const currentHalaqah = halaqahs.find(h => h.id === activeHalaqahId) || selectableHalaqahs[0] || halaqahs[0];
  const displayHalaqahName = currentHalaqah ? currentHalaqah.name : settings.halaqahName;
  const displayComplexName = activeComplex?.name || complexName || settings.complexName || 'مجمع تحفيظ القرآن الكريم';
  const complexInitial = displayComplexName.replace(/^(مجمع|مراكز|حلقات|جمعية)\s+/i, '').trim().charAt(0) || 'ق';

  const currentComplex = availableComplexes.find(c => c.id === activeComplexId) || availableComplexes[0];
  const currentComplexTitle = currentComplex ? currentComplex.name : displayComplexName;

  const selectedHalaqahItem = halaqahs.find(h => h.id === activeHalaqahId);
  const selectedHalaqahTitle = (activeHalaqahId === 'all' || !activeHalaqahId)
    ? (isDeveloper ? 'الكل (جميع المجمعات)' : `الكل (${complexName || 'المجمع'})`)
    : (selectedHalaqahItem ? selectedHalaqahItem.name : displayHalaqahName);

  const selectedAssignedHalaqah = assignedHalaqahs.find(h => h.id === activeHalaqahId) || assignedHalaqahs[0];
  const selectedAssignedTitle = selectedAssignedHalaqah
    ? `${selectedAssignedHalaqah.name} ${selectedAssignedHalaqah.complexName ? `(${selectedAssignedHalaqah.complexName})` : ''}`
    : 'اختر الحلقة';

  const currentTheme = activeComplex?.theme || settings?.theme;
  const themePrimary = currentTheme?.primaryColor || '#131f24';
  const themeSecondary = currentTheme?.secondaryColor || '#1b2e35';
  const themeAccent = currentTheme?.accentColor || '#ffc800';
  const themeCard = currentTheme?.cardColor || '#203843';
  const themeBorder = lightenHex(themeCard, 0.18);
  const themeBorderBottom = darkenHex(themeCard, 0.35);
  const themeAccentShadow = darkenHex(themeAccent, 0.28);

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-xl border-b-4 px-3 sm:px-4 lg:px-8 py-2.5 sm:py-3 shadow-xl transition-all w-full max-w-full overflow-visible"
      style={{
        backgroundColor: `${themeSecondary}f6`,
        borderColor: themeBorder,
        borderBottomColor: themeBorderBottom
      }}
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-2 w-full max-w-full overflow-visible">
        {/* ROW 1: Brand (Logo + Complex Name) & Quick User Actions */}
        <div className="flex items-center justify-between gap-2 sm:gap-4 w-full">
          {/* Brand & Logo: Complex Name and Logo */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div
              className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-2xl shadow-lg border-2 border-b-4 overflow-hidden shrink-0 transition-transform duration-200 hover:scale-105"
              style={{
                backgroundColor: themeCard,
                borderColor: `${themeAccent}80`,
                borderBottomColor: themeAccentShadow,
                color: themeAccent
              }}
            >
              {effectiveLogoUrl && !logoImgFailed ? (
                <img
                  src={effectiveLogoUrl}
                  alt="منظومة عُمْرَان"
                  onError={() => setLogoImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="relative flex flex-col items-center justify-center w-full h-full p-1 shadow-inner"
                  style={{ backgroundColor: themeCard }}
                >
                  <div
                    className="flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 rounded-lg border shadow-inner"
                    style={{
                      backgroundColor: themePrimary,
                      borderColor: `${themeAccent}50`
                    }}
                  >
                    <span
                      className="font-black text-xs sm:text-sm tracking-tight leading-none drop-shadow-sm font-heading"
                      style={{ color: themeAccent }}
                    >
                      ع
                    </span>
                  </div>
                  <span
                    className="text-[7px] sm:text-[7.5px] font-bold tracking-tight mt-0.5"
                    style={{ color: themeAccent }}
                  >
                    عمران
                  </span>
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h1
                className="text-sm sm:text-base lg:text-lg font-black font-heading tracking-tight text-white truncate"
                title="منظومة عُمْرَان"
              >
                منظومة عُمْرَان
              </h1>
              <p
                className="text-[10px] sm:text-xs font-bold truncate hidden sm:block"
                style={{ color: themeAccent }}
              >
                {displayComplexName} • منظومة إدارة الحلقات والمجمعات القرآنية
              </p>
            </div>
          </div>

          {/* Right User & Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">

            {/* Quranic AI Assistant Button */}
            {currentUser?.role === 'admin' && (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('omran:open_ai_assistant'))}
                title="المساعد القرآني الذكي (AI) - انقر لفتح المحادثة والتقارير والشهادات"
                className="flex items-center gap-1 sm:gap-1.5 py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-2xl text-xs font-black border-2 border-b-4 active:translate-y-[2px] active:border-b-2 shadow-sm transition-all cursor-pointer"
                style={{
                  backgroundColor: themeAccent,
                  color: themePrimary,
                  borderColor: themeAccent,
                  borderBottomColor: themeAccentShadow,
                  boxShadow: `0 4px 12px ${themeAccent}30`
                }}
              >
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-pulse shrink-0" />
                <span className="hidden xs:inline">المساعد الذكي</span>
              </button>
            )}

            {/* Live Registration Applications Button for Supervisor / Developer */}
            {currentUser?.role === 'admin' && (isSupervisor || isDeveloper) && onOpenApplications && (
              <button
                type="button"
                onClick={onOpenApplications}
                title="طلبات الانضمام والتسجيل الواردة إلى المجمع"
                className="relative flex items-center gap-1 sm:gap-1.5 py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-2xl text-xs font-black border-2 border-b-4 active:translate-y-[2px] active:border-b-2 shadow-sm transition-all cursor-pointer hover:brightness-110"
                style={{
                  backgroundColor: pendingApplicationsCount > 0 ? themeAccent : themeCard,
                  color: pendingApplicationsCount > 0 ? themePrimary : '#ffffff',
                  borderColor: pendingApplicationsCount > 0 ? themeAccent : `${themeAccent}70`,
                  borderBottomColor: pendingApplicationsCount > 0 ? themeAccentShadow : themeBorderBottom
                }}
              >
                <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" style={{ color: pendingApplicationsCount > 0 ? themePrimary : themeAccent }} />
                <span className="hidden sm:inline">الطلبات</span>
                {pendingApplicationsCount > 0 && (
                  <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-black bg-red-600 text-white shadow-sm animate-bounce">
                    {pendingApplicationsCount}
                  </span>
                )}
              </button>
            )}

            {/* Top Settings Button */}
            {currentUser?.role === 'admin' && isSupervisor && onOpenSettings && (
              <button
                onClick={onOpenSettings}
                title="إعدادات الحلقات والمعلمين ونقل الطلاب وتخصيص هوية وثيم المجمع"
                className="flex items-center gap-1 sm:gap-1.5 py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-2xl text-xs font-black border-2 border-b-4 active:translate-y-[2px] active:border-b-2 shadow-sm transition-all cursor-pointer hover:brightness-110"
                style={{
                  backgroundColor: themeCard,
                  color: '#ffffff',
                  borderColor: `${themeAccent}70`,
                  borderBottomColor: themeAccentShadow
                }}
              >
                <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" style={{ color: themeAccent }} />
                <span className="hidden sm:inline">الإعدادات</span>
              </button>
            )}

            {/* Complex Management Button for Developer & Supervisor */}
            {currentUser?.role === 'admin' && (isDeveloper || isSupervisor) && onOpenComplexManagement && (
              <button
                type="button"
                onClick={onOpenComplexManagement}
                title="إدارة المجمعات القرآنية وإضافة مجمع جديد"
                className="flex items-center gap-1 sm:gap-1.5 py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-2xl text-xs font-black border-2 border-b-4 active:translate-y-[2px] active:border-b-2 shadow-sm transition-all cursor-pointer hover:brightness-110"
                style={{
                  backgroundColor: themeCard,
                  color: themeAccent,
                  borderColor: `${themeAccent}70`,
                  borderBottomColor: themeAccentShadow
                }}
              >
                <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" style={{ color: themeAccent }} />
                <span className="hidden sm:inline">إدارة المجمعات</span>
              </button>
            )}

            {currentUser?.role === 'admin' && isSupervisor && !onOpenSettings && onOpenTeacherManagement && (
              <button
                onClick={onOpenTeacherManagement}
                title="إدارة حسابات المعلمين"
                className="flex items-center gap-1.5 py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-2xl border-2 border-b-4 text-xs font-black shadow-sm transition-all cursor-pointer active:translate-y-[2px] active:border-b-2 hover:brightness-110"
                style={{
                  backgroundColor: themeCard,
                  borderColor: `${themeAccent}50`,
                  borderBottomColor: themeBorderBottom,
                  color: '#ffffff'
                }}
              >
                <Users className="w-3.5 h-3.5" style={{ color: themeAccent }} />
                <span className="hidden sm:inline">إدارة المعلمين</span>
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold"
                  style={{
                    backgroundColor: `${themePrimary}90`,
                    color: themeAccent
                  }}
                >
                  {teachersCount}
                </span>
              </button>
            )}


            {/* Privacy Policy Quick In-App Button */}
            {onOpenPrivacyPolicy && (
              <button
                onClick={onOpenPrivacyPolicy}
                title="سياسة الخصوصية وحماية البيانات (Privacy Policy)"
                className="p-2 rounded-2xl border-2 border-b-4 transition-all cursor-pointer shadow-sm flex items-center gap-1 active:translate-y-[2px] active:border-b-2 hover:brightness-110"
                style={{
                  backgroundColor: themeCard,
                  borderColor: themeBorder,
                  borderBottomColor: themeBorderBottom,
                  color: '#ffffff'
                }}
              >
                <ShieldCheck className="w-4 h-4" style={{ color: themeAccent }} />
                <span className="hidden xl:inline text-xs font-bold">الخصوصية</span>
              </button>
            )}

            {currentUser && (
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Profile Pill with natural platform theme & Duolingo 3D styling */}
                <div
                  className="flex items-center gap-1.5 sm:gap-2 border-2 border-b-4 rounded-2xl px-2.5 sm:px-3 py-1.5 shadow-sm shrink-0 transition-all"
                  style={{
                    backgroundColor: themeCard,
                    borderColor: `${themeAccent}40`,
                    borderBottomColor: themeBorderBottom,
                  }}
                >
                  <div
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center text-xs sm:text-sm font-black shrink-0 shadow-sm transition-colors border border-black/20"
                    style={{
                      backgroundColor: themeAccent,
                      color: themePrimary
                    }}
                  >
                    {currentUser.username.charAt(0)}
                  </div>
                  <div className="text-right hidden md:block">
                    <div className="text-xs font-bold text-white flex items-center gap-1">
                      {currentUser.username}
                    </div>
                    <div
                      className="text-[9px] font-bold"
                      style={{ color: themeAccent }}
                    >
                      {currentUser.role === 'admin' ? (isDeveloper ? 'معلم ومشرف ومبرمج' : isSupervisor ? 'المعلم المشرف' : 'معلم') : 'طالب'}
                    </div>
                  </div>

                  {/* Edit Account Button */}
                  {currentUser.role === 'admin' && onOpenEditAccount && (
                    <button
                      type="button"
                      onClick={onOpenEditAccount}
                      title="تعديل بيانات الحساب (اسم المستخدم، كلمة المرور، والاسم الرباعي)"
                      className="p-1 sm:p-1.5 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer flex items-center gap-1 text-[10px] sm:text-[11px] font-bold mr-1"
                      style={{ color: themeAccent }}
                    >
                      <UserCog className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="hidden lg:inline">الحساب</span>
                    </button>
                  )}
                </div>

                {/* Google Account Sign-In / Link Button: Official Google G Shape + Duolingo 3D Tactile Theme */}
                {currentUser?.role === 'admin' && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (currentTeacher?.isGoogleLinked) {
                        if (confirm(`هل تريد بالتأكيد فصل حساب Google (${currentTeacher.googleEmail || 'المربوط'})؟`)) {
                          if (onUnlinkGoogleTeacher) await onUnlinkGoogleTeacher();
                        }
                      } else {
                        if (onLinkGoogleTeacher) await onLinkGoogleTeacher();
                      }
                    }}
                    disabled={isLinkingGoogleTeacher}
                    className={`flex items-center gap-1.5 sm:gap-2 py-1.5 sm:py-2 px-2.5 sm:px-3.5 rounded-2xl border-2 border-b-4 text-xs font-black shadow-md transition-all cursor-pointer active:translate-y-[2px] active:border-b-2 font-heading ${
                      currentTeacher?.isGoogleLinked
                        ? 'bg-[#1e7e34] hover:bg-[#1b6d2e] text-white border-[#34A853] border-b-[#145222] shadow-[#34A853]/25'
                        : 'bg-white hover:bg-slate-50 text-slate-900 border-slate-200 border-b-[#4285F4] shadow-[#4285F4]/20'
                    }`}
                    title={
                      currentTeacher?.isGoogleLinked
                        ? `مربوط بحساب Google: ${currentTeacher.googleEmail} (انقر للفصل)`
                        : 'تسجيل الدخول وربط حساب Google للحصول على المزايا السحابية وتكامل Meet و Gmail'
                    }
                  >
                    {/* Official Multi-Colored Google G Icon */}
                    <div className="relative shrink-0 flex items-center justify-center">
                      <svg className="w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      {currentTeacher?.isGoogleLinked && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#34A853] border-2 border-white shadow-xs" />
                      )}
                    </div>
                    <span className="whitespace-nowrap font-heading font-black">
                      {isLinkingGoogleTeacher
                        ? 'جاري الربط...'
                        : currentTeacher?.isGoogleLinked
                        ? 'Google متصل ✓'
                        : 'تسجيل الدخول بـ Google'}
                    </span>
                  </button>
                )}

                {/* Duolingo 3D Themed Logout Button */}
                <button
                  onClick={onLogout}
                  title="تسجيل الخروج الآمن"
                  className="flex items-center gap-1.5 py-1.5 sm:py-2 px-2.5 sm:px-3 rounded-2xl border-2 border-b-4 text-xs font-black shadow-sm transition-all cursor-pointer active:translate-y-[2px] active:border-b-2 hover:bg-red-500/20"
                  style={{
                    backgroundColor: themeCard,
                    borderColor: 'rgba(239, 68, 68, 0.45)',
                    borderBottomColor: '#dc2626',
                    color: '#fca5a5'
                  }}
                >
                  <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400 shrink-0" />
                  <span className="hidden sm:inline">خروج</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ROW 2: Header Selectors & Quick Info */}
        <div className="relative z-40 flex items-center gap-2 py-1.5 px-0.5 w-full border-t border-[#2b4550]/60 shrink-0 overflow-visible flex-wrap sm:flex-nowrap">
          {/* Complex Switcher / Badge with Platform Theme & Duolingo 3D style */}
          {canSwitchComplex && availableComplexes.length > 1 && onSwitchComplex ? (
            <div
              className="relative flex items-center gap-1.5 rounded-2xl p-1 shadow-sm transition-all border-2 border-b-4 shrink-0 font-heading"
              style={{
                backgroundColor: themeCard,
                borderColor: `${themeAccent}70`,
                borderBottomColor: themeAccentShadow
              }}
            >
              <div
                className="flex items-center justify-center w-8 h-8 rounded-xl border-2 border-b-4 shrink-0 shadow-sm transition-transform duration-150 active:translate-y-[1px]"
                style={{
                  backgroundColor: themeSecondary,
                  borderColor: `${themeAccent}80`,
                  borderBottomColor: themeAccentShadow,
                  color: themeAccent
                }}
                title="المجمع القرآني"
              >
                <Building2
                  className="w-4 h-4 shrink-0 transition-transform duration-150 hover:scale-110"
                  style={{ color: themeAccent }}
                />
              </div>
              <div className="relative flex items-center" ref={complexMenuRef}>
                <select
                  value={activeComplexId || availableComplexes[0]?.id || ''}
                  onChange={e => onSwitchComplex(e.target.value)}
                  className="sr-only pointer-events-none"
                  aria-hidden="true"
                  tabIndex={-1}
                >
                  {availableComplexes.map(c => (
                    <option
                      key={c.id}
                      value={c.id}
                      className="py-2.5 px-3 font-bold"
                      style={{ backgroundColor: themeCard, color: '#ffffff' }}
                    >
                      {c.name}{isDeveloper ? (c.databaseConfig?.isCustom ? ` ⚡ [مستقل: ${c.databaseConfig.projectId}]` : ' (المركزية)') : ''}
                    </option>
                  ))}
                </select>

                {/* Duolingo in-platform trigger button */}
                <button
                  type="button"
                  onClick={() => {
                    setIsComplexMenuOpen(prev => !prev);
                    setIsHalaqahMenuOpen(false);
                  }}
                  className="flex items-center gap-2 text-xs text-white font-black rounded-xl px-2.5 py-1.5 cursor-pointer focus:outline-none border-2 border-b-4 transition-all active:translate-y-[1px] active:border-b-2 font-heading shadow-inner max-w-[170px] sm:max-w-xs"
                  style={{
                    backgroundColor: themeSecondary,
                    borderColor: isComplexMenuOpen ? themeAccent : `${themeAccent}80`,
                    borderBottomColor: isComplexMenuOpen ? themeAccentShadow : themeAccentShadow
                  }}
                  title={isDeveloper ? "التبديل بين كافة المجمعات القرآنية (إشراف شامل للمبرمج)" : "التبديل بين المجمعات المرتبط بها"}
                >
                  <Building2 className="w-3.5 h-3.5 shrink-0" style={{ color: themeAccent }} />
                  <span className="truncate">{currentComplexTitle}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${isComplexMenuOpen ? 'rotate-180' : ''}`}
                    style={{ color: themeAccent }}
                  />
                </button>

                {/* Custom in-platform Duolingo dropdown popup with backdrop */}
                {isComplexMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px]"
                      onClick={() => setIsComplexMenuOpen(false)}
                    />
                    <div
                      className="absolute top-full mt-2 right-0 z-[70] min-w-[280px] max-w-[340px] rounded-2xl border-2 border-b-4 shadow-2xl p-2.5 animate-in fade-in zoom-in-95 duration-150"
                      style={{
                        backgroundColor: themeCard,
                        borderColor: themeBorder,
                        borderBottomColor: themeBorderBottom,
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                      }}
                    >
                      <div className="flex items-center justify-between px-2 py-1 mb-2 border-b border-white/10 pb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="flex items-center justify-center w-7 h-7 rounded-xl border-2 border-b-4 shadow-sm shrink-0"
                            style={{
                              backgroundColor: themeSecondary,
                              borderColor: `${themeAccent}80`,
                              borderBottomColor: themeAccentShadow,
                              color: themeAccent
                            }}
                          >
                            <Building2 className="w-4 h-4" style={{ color: themeAccent }} />
                          </div>
                          <span className="text-[12px] font-black" style={{ color: themeAccent }}>
                            اختر المجمع القرآني
                          </span>
                        </div>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-b-2"
                          style={{
                            backgroundColor: `${themeAccent}20`,
                            borderColor: `${themeAccent}40`,
                            borderBottomColor: themeAccentShadow,
                            color: themeAccent
                          }}
                        >
                          {availableComplexes.length} مجمعات
                        </span>
                      </div>
                      <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto scrollbar-thin">
                        {availableComplexes.map(c => {
                          const isSelected = (activeComplexId || availableComplexes[0]?.id) === c.id;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                onSwitchComplex(c.id);
                                setIsComplexMenuOpen(false);
                              }}
                              className={`w-full text-right px-3 py-2.5 rounded-xl font-black text-xs flex items-center justify-between border-2 transition-all cursor-pointer ${
                                isSelected
                                  ? 'border-b-4 text-white shadow-md'
                                  : 'border-b-2 hover:border-b-4 hover:-translate-y-0.5 text-slate-200'
                              }`}
                              style={{
                                backgroundColor: isSelected ? themeSecondary : `${themeSecondary}80`,
                                borderColor: isSelected ? themeAccent : themeBorder,
                                borderBottomColor: isSelected ? themeAccentShadow : themeBorderBottom
                              }}
                            >
                              <div className="flex items-center gap-2.5 truncate">
                                <div
                                  className="flex items-center justify-center w-6 h-6 rounded-lg border-2 border-b-2 shrink-0 transition-all"
                                  style={{
                                    backgroundColor: isSelected ? `${themeAccent}25` : themeSecondary,
                                    borderColor: isSelected ? themeAccent : themeBorder,
                                    borderBottomColor: isSelected ? themeAccentShadow : themeBorderBottom,
                                    color: themeAccent
                                  }}
                                >
                                  <Building2 className="w-3.5 h-3.5" />
                                </div>
                                <span className="truncate">{c.name}</span>
                                {isDeveloper && c.databaseConfig?.isCustom && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold shrink-0">مستقل</span>
                                )}
                              </div>
                              {isSelected && <Check className="w-4 h-4 shrink-0" style={{ color: themeAccent }} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
              {onOpenMultiComplexModal && (
                <button
                  type="button"
                  onClick={onOpenMultiComplexModal}
                  title="عرض بطاقات المجمعات والحلقات التابعة لك"
                  className="p-1.5 rounded-xl border-2 border-b-2 hover:border-b-4 active:translate-y-[1px] transition-all cursor-pointer shrink-0"
                  style={{
                    backgroundColor: themeSecondary,
                    borderColor: `${themeAccent}50`,
                    borderBottomColor: themeAccentShadow,
                    color: themeAccent
                  }}
                >
                  <Layers className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            <div
              className="flex items-center gap-1.5 rounded-2xl px-2.5 py-1.5 shadow-sm transition-all border-2 border-b-4 shrink-0 font-heading"
              style={{
                backgroundColor: themeCard,
                borderColor: `${themeAccent}70`,
                borderBottomColor: themeAccentShadow
              }}
              title={`المجمع القرآني: ${activeComplex?.name || complexName || 'المجمع الرئيسي'}`}
            >
              <div
                className="flex items-center justify-center w-8 h-8 rounded-xl border-2 border-b-4 shrink-0 shadow-sm"
                style={{
                  backgroundColor: themeSecondary,
                  borderColor: `${themeAccent}80`,
                  borderBottomColor: themeAccentShadow,
                  color: themeAccent
                }}
              >
                <Building2
                  className="w-4 h-4 shrink-0"
                  style={{ color: themeAccent }}
                />
              </div>
              <span className="text-xs text-white font-black max-w-[160px] sm:max-w-xs truncate">
                {activeComplex?.name || complexName || 'المجمع الرئيسي'}
              </span>
            </div>
          )}

          {/* Halaqah selector / label */}
          {currentUser?.role === 'admin' && (
            <div className="shrink-0">
              {isSupervisor ? (
                halaqahs.length > 0 && onSwitchHalaqah ? (
                  <div
                    className="relative flex items-center gap-1.5 border-2 border-b-4 rounded-2xl p-1 shadow-sm transition-all"
                    style={{
                      backgroundColor: themeCard,
                      borderColor: themeBorder,
                      borderBottomColor: themeBorderBottom
                    }}
                  >
                    <div className="relative flex items-center" ref={halaqahMenuRef}>
                      <select
                        value={activeHalaqahId || 'all'}
                        onChange={e => onSwitchHalaqah(e.target.value)}
                        className="sr-only pointer-events-none"
                        aria-hidden="true"
                        tabIndex={-1}
                      >
                        <option
                          value="all"
                          className="font-bold py-2.5 px-3"
                          style={{ backgroundColor: themeCard, color: '#ffffff' }}
                        >
                          {isDeveloper ? 'الكل (جميع المجمعات)' : `الكل (جميع حلقات ${complexName || 'المجمع'})`} ({studentsCount} طالب)
                        </option>
                        {halaqahs.map(h => (
                          <option
                            key={h.id}
                            value={h.id}
                            className="font-bold py-2.5 px-3"
                            style={{ backgroundColor: themeCard, color: '#ffffff' }}
                          >
                            {h.name}
                          </option>
                        ))}
                      </select>

                      <div
                        className="flex items-center justify-center w-8 h-8 rounded-xl border-2 border-b-4 shrink-0 shadow-sm transition-transform duration-150 active:translate-y-[1px]"
                        style={{
                          backgroundColor: themeSecondary,
                          borderColor: `${themeAccent}80`,
                          borderBottomColor: themeAccentShadow,
                          color: themeAccent
                        }}
                        title="الحلقة القرآنية"
                      >
                        <BookOpen
                          className="w-4 h-4 shrink-0 transition-transform duration-150 hover:scale-110"
                          style={{ color: themeAccent }}
                        />
                      </div>

                      <span className="relative flex h-2.5 w-2.5 mr-0.5 shrink-0">
                        <span
                          className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                          style={{ backgroundColor: themeAccent }}
                        />
                        <span
                          className="relative inline-flex rounded-full h-2.5 w-2.5"
                          style={{ backgroundColor: themeAccent }}
                        />
                      </span>
                      <span
                        className="text-[10px] font-black hidden sm:inline shrink-0 pr-0.5 pl-1"
                        style={{ color: themeAccent }}
                      >
                        الحلقة:
                      </span>

                      {/* Duolingo in-platform trigger button */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsHalaqahMenuOpen(prev => !prev);
                          setIsComplexMenuOpen(false);
                        }}
                        className="flex items-center gap-2 text-xs text-white font-black rounded-xl px-2.5 py-1.5 cursor-pointer focus:outline-none border-2 border-b-4 transition-all active:translate-y-[1px] active:border-b-2 font-heading shadow-inner max-w-[160px] sm:max-w-[220px]"
                        style={{
                          backgroundColor: themeSecondary,
                          borderColor: isHalaqahMenuOpen ? themeAccent : themeBorder,
                          borderBottomColor: isHalaqahMenuOpen ? themeAccent : themeBorderBottom
                        }}
                        title="التبديل بين حلقات العمل"
                      >
                        <BookOpen className="w-3.5 h-3.5 shrink-0" style={{ color: themeAccent }} />
                        <span className="truncate">{selectedHalaqahTitle}</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${isHalaqahMenuOpen ? 'rotate-180' : ''}`}
                          style={{ color: themeAccent }}
                        />
                      </button>

                      {/* Custom in-platform Duolingo dropdown popup with backdrop */}
                      {isHalaqahMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px]"
                            onClick={() => setIsHalaqahMenuOpen(false)}
                          />
                          <div
                            className="absolute top-full mt-2 right-0 z-[70] min-w-[280px] max-w-[340px] rounded-2xl border-2 border-b-4 shadow-2xl p-2.5 animate-in fade-in zoom-in-95 duration-150"
                            style={{
                              backgroundColor: themeCard,
                              borderColor: themeBorder,
                              borderBottomColor: themeBorderBottom,
                              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                            }}
                          >
                            <div className="flex items-center justify-between px-2 py-1 mb-2 border-b border-white/10 pb-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className="flex items-center justify-center w-7 h-7 rounded-xl border-2 border-b-4 shadow-sm shrink-0"
                                  style={{
                                    backgroundColor: themeSecondary,
                                    borderColor: `${themeAccent}80`,
                                    borderBottomColor: themeAccentShadow,
                                    color: themeAccent
                                  }}
                                >
                                  <BookOpen className="w-4 h-4" style={{ color: themeAccent }} />
                                </div>
                                <span className="text-[12px] font-black" style={{ color: themeAccent }}>
                                  اختر الحلقة القرآنية
                                </span>
                              </div>
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-b-2"
                                style={{
                                  backgroundColor: `${themeAccent}20`,
                                  borderColor: `${themeAccent}40`,
                                  borderBottomColor: themeAccentShadow,
                                  color: themeAccent
                                }}
                              >
                                {halaqahs.length} حلقات
                              </span>
                            </div>
                            <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto scrollbar-thin">
                              <button
                                type="button"
                                onClick={() => {
                                  onSwitchHalaqah('all');
                                  setIsHalaqahMenuOpen(false);
                                }}
                                className={`w-full text-right px-3 py-2.5 rounded-xl font-black text-xs flex items-center justify-between border-2 transition-all cursor-pointer ${
                                  activeHalaqahId === 'all' || !activeHalaqahId
                                    ? 'border-b-4 text-white shadow-md'
                                    : 'border-b-2 hover:border-b-4 hover:-translate-y-0.5 text-slate-200'
                                }`}
                                style={{
                                  backgroundColor: (activeHalaqahId === 'all' || !activeHalaqahId) ? themeSecondary : `${themeSecondary}80`,
                                  borderColor: (activeHalaqahId === 'all' || !activeHalaqahId) ? themeAccent : themeBorder,
                                  borderBottomColor: (activeHalaqahId === 'all' || !activeHalaqahId) ? themeAccentShadow : themeBorderBottom
                                }}
                              >
                                <div className="flex items-center gap-2.5 truncate">
                                  <div
                                    className="flex items-center justify-center w-6 h-6 rounded-lg border-2 border-b-2 shrink-0 transition-all"
                                    style={{
                                      backgroundColor: (activeHalaqahId === 'all' || !activeHalaqahId) ? `${themeAccent}25` : themeSecondary,
                                      borderColor: (activeHalaqahId === 'all' || !activeHalaqahId) ? themeAccent : themeBorder,
                                      borderBottomColor: (activeHalaqahId === 'all' || !activeHalaqahId) ? themeAccentShadow : themeBorderBottom,
                                      color: themeAccent
                                    }}
                                  >
                                    <Layers className="w-3.5 h-3.5" />
                                  </div>
                                  <span className="truncate">
                                    {isDeveloper ? 'الكل (جميع المجمعات)' : `الكل (جميع حلقات ${complexName || 'المجمع'})`}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[10px] opacity-75 font-bold">({studentsCount} طالب)</span>
                                  {(activeHalaqahId === 'all' || !activeHalaqahId) && (
                                    <Check className="w-4 h-4 shrink-0" style={{ color: themeAccent }} />
                                  )}
                                </div>
                              </button>

                              {halaqahs.map(h => {
                                const isSelected = activeHalaqahId === h.id;
                                return (
                                  <button
                                    key={h.id}
                                    type="button"
                                    onClick={() => {
                                      onSwitchHalaqah(h.id);
                                      setIsHalaqahMenuOpen(false);
                                    }}
                                    className={`w-full text-right px-3 py-2.5 rounded-xl font-black text-xs flex items-center justify-between border-2 transition-all cursor-pointer ${
                                      isSelected
                                        ? 'border-b-4 text-white shadow-md'
                                        : 'border-b-2 hover:border-b-4 hover:-translate-y-0.5 text-slate-200'
                                    }`}
                                    style={{
                                      backgroundColor: isSelected ? themeSecondary : `${themeSecondary}80`,
                                      borderColor: isSelected ? themeAccent : themeBorder,
                                      borderBottomColor: isSelected ? themeAccentShadow : themeBorderBottom
                                    }}
                                  >
                                    <div className="flex items-center gap-2.5 truncate">
                                      <div
                                        className="flex items-center justify-center w-6 h-6 rounded-lg border-2 border-b-2 shrink-0 transition-all"
                                        style={{
                                          backgroundColor: isSelected ? `${themeAccent}25` : themeSecondary,
                                          borderColor: isSelected ? themeAccent : themeBorder,
                                          borderBottomColor: isSelected ? themeAccentShadow : themeBorderBottom,
                                          color: themeAccent
                                        }}
                                      >
                                        <BookOpen className="w-3.5 h-3.5" />
                                      </div>
                                      <span className="truncate">{h.name}</span>
                                    </div>
                                    {isSelected && <Check className="w-4 h-4 shrink-0" style={{ color: themeAccent }} />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <p
                    className="text-xs text-slate-200 font-bold px-2.5 py-1.5 rounded-2xl border-2 border-b-4 flex items-center gap-2 shadow-sm"
                    style={{
                      backgroundColor: themeCard,
                      borderColor: themeBorder,
                      borderBottomColor: themeBorderBottom
                    }}
                  >
                    <BookOpen className="w-3.5 h-3.5 shrink-0" style={{ color: themeAccent }} />
                    <span className="text-[10px] font-black" style={{ color: themeAccent }}>الحلقة الحالية:</span>
                    <span className="font-black text-white">{displayHalaqahName}</span>
                  </p>
                )
              ) : (
                assignedHalaqahs.length > 1 && onSwitchHalaqah ? (
                  <div
                    className="relative flex items-center gap-1.5 border-2 border-b-4 rounded-2xl p-1 shadow-sm transition-all"
                    style={{
                      backgroundColor: themeCard,
                      borderColor: themeBorder,
                      borderBottomColor: themeBorderBottom
                    }}
                  >
                    <div className="relative flex items-center" ref={halaqahMenuRef}>
                      <select
                        value={activeHalaqahId || assignedHalaqahs[0]?.id || ''}
                        onChange={e => onSwitchHalaqah(e.target.value)}
                        className="sr-only pointer-events-none"
                        aria-hidden="true"
                        tabIndex={-1}
                      >
                        {assignedHalaqahs.map(h => (
                          <option
                            key={h.id}
                            value={h.id}
                            className="font-bold py-2.5 px-3"
                            style={{ backgroundColor: themeCard, color: '#ffffff' }}
                          >
                            {h.name} {h.complexName ? `(${h.complexName})` : ''}
                          </option>
                        ))}
                      </select>

                      <div
                        className="flex items-center justify-center w-8 h-8 rounded-xl border-2 border-b-4 shrink-0 shadow-sm transition-transform duration-150 active:translate-y-[1px]"
                        style={{
                          backgroundColor: themeSecondary,
                          borderColor: `${themeAccent}80`,
                          borderBottomColor: themeAccentShadow,
                          color: themeAccent
                        }}
                        title="الحلقة القرآنية"
                      >
                        <BookOpen
                          className="w-4 h-4 shrink-0 transition-transform duration-150 hover:scale-110"
                          style={{ color: themeAccent }}
                        />
                      </div>

                      <span className="relative flex h-2.5 w-2.5 mr-0.5 shrink-0">
                        <span
                          className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                          style={{ backgroundColor: themeAccent }}
                        />
                        <span
                          className="relative inline-flex rounded-full h-2.5 w-2.5"
                          style={{ backgroundColor: themeAccent }}
                        />
                      </span>
                      <span
                        className="text-[10px] font-black hidden sm:inline shrink-0 pr-0.5 pl-1"
                        style={{ color: themeAccent }}
                      >
                        الحلقة:
                      </span>

                      {/* Duolingo in-platform trigger button */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsHalaqahMenuOpen(prev => !prev);
                          setIsComplexMenuOpen(false);
                        }}
                        className="flex items-center gap-2 text-xs text-white font-black rounded-xl px-2.5 py-1.5 cursor-pointer focus:outline-none border-2 border-b-4 transition-all active:translate-y-[1px] active:border-b-2 font-heading shadow-inner max-w-[180px] sm:max-w-[250px]"
                        style={{
                          backgroundColor: themeSecondary,
                          borderColor: isHalaqahMenuOpen ? themeAccent : themeBorder,
                          borderBottomColor: isHalaqahMenuOpen ? themeAccent : themeBorderBottom
                        }}
                        title="التبديل بين مساحات حلقاتك المخصصة"
                      >
                        <BookOpen className="w-3.5 h-3.5 shrink-0" style={{ color: themeAccent }} />
                        <span className="truncate">{selectedAssignedTitle}</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${isHalaqahMenuOpen ? 'rotate-180' : ''}`}
                          style={{ color: themeAccent }}
                        />
                      </button>

                      {/* Custom in-platform Duolingo dropdown popup with backdrop */}
                      {isHalaqahMenuOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-[1px]"
                            onClick={() => setIsHalaqahMenuOpen(false)}
                          />
                          <div
                            className="absolute top-full mt-2 right-0 z-[70] min-w-[280px] max-w-[340px] rounded-2xl border-2 border-b-4 shadow-2xl p-2.5 animate-in fade-in zoom-in-95 duration-150"
                            style={{
                              backgroundColor: themeCard,
                              borderColor: themeBorder,
                              borderBottomColor: themeBorderBottom,
                              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                            }}
                          >
                            <div className="flex items-center justify-between px-2 py-1 mb-2 border-b border-white/10 pb-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className="flex items-center justify-center w-7 h-7 rounded-xl border-2 border-b-4 shadow-sm shrink-0"
                                  style={{
                                    backgroundColor: themeSecondary,
                                    borderColor: `${themeAccent}80`,
                                    borderBottomColor: themeAccentShadow,
                                    color: themeAccent
                                  }}
                                >
                                  <BookOpen className="w-4 h-4" style={{ color: themeAccent }} />
                                </div>
                                <span className="text-[12px] font-black" style={{ color: themeAccent }}>
                                  اختر الحلقة المخصصة
                                </span>
                              </div>
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-b-2"
                                style={{
                                  backgroundColor: `${themeAccent}20`,
                                  borderColor: `${themeAccent}40`,
                                  borderBottomColor: themeAccentShadow,
                                  color: themeAccent
                                }}
                              >
                                {assignedHalaqahs.length} حلقات
                              </span>
                            </div>
                            <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto scrollbar-thin">
                              {assignedHalaqahs.map(h => {
                                const isSelected = (activeHalaqahId || assignedHalaqahs[0]?.id) === h.id;
                                return (
                                  <button
                                    key={h.id}
                                    type="button"
                                    onClick={() => {
                                      onSwitchHalaqah(h.id);
                                      setIsHalaqahMenuOpen(false);
                                    }}
                                    className={`w-full text-right px-3 py-2.5 rounded-xl font-black text-xs flex items-center justify-between border-2 transition-all cursor-pointer ${
                                      isSelected
                                        ? 'border-b-4 text-white shadow-md'
                                        : 'border-b-2 hover:border-b-4 hover:-translate-y-0.5 text-slate-200'
                                    }`}
                                    style={{
                                      backgroundColor: isSelected ? themeSecondary : `${themeSecondary}80`,
                                      borderColor: isSelected ? themeAccent : themeBorder,
                                      borderBottomColor: isSelected ? themeAccentShadow : themeBorderBottom
                                    }}
                                  >
                                    <div className="flex items-center gap-2.5 truncate">
                                      <div
                                        className="flex items-center justify-center w-6 h-6 rounded-lg border-2 border-b-2 shrink-0 transition-all"
                                        style={{
                                          backgroundColor: isSelected ? `${themeAccent}25` : themeSecondary,
                                          borderColor: isSelected ? themeAccent : themeBorder,
                                          borderBottomColor: isSelected ? themeAccentShadow : themeBorderBottom,
                                          color: themeAccent
                                        }}
                                      >
                                        <BookOpen className="w-3.5 h-3.5" />
                                      </div>
                                      <span className="truncate">{h.name} {h.complexName ? `(${h.complexName})` : ''}</span>
                                    </div>
                                    {isSelected && <Check className="w-4 h-4 shrink-0" style={{ color: themeAccent }} />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ) : assignedHalaqahs.length === 1 ? (
                  <div
                    className="inline-flex items-center gap-2 text-xs text-white font-bold px-2.5 py-1.5 rounded-2xl border-2 border-b-4 shadow-sm shrink-0"
                    style={{
                      backgroundColor: themeCard,
                      borderColor: themeBorder,
                      borderBottomColor: themeBorderBottom
                    }}
                  >
                    <div
                      className="flex items-center justify-center w-6 h-6 rounded-lg border border-b-2 shrink-0"
                      style={{
                        backgroundColor: themeSecondary,
                        borderColor: `${themeAccent}70`,
                        borderBottomColor: themeAccentShadow,
                        color: themeAccent
                      }}
                    >
                      <BookOpen className="w-3.5 h-3.5" style={{ color: themeAccent }} />
                    </div>
                    <span
                      className="font-black shrink-0"
                      style={{ color: themeAccent }}
                    >
                      الحلقة:
                    </span>
                    <span className="truncate max-w-[160px] sm:max-w-none">
                      {assignedHalaqahs[0].name} {assignedHalaqahs[0].complexName ? `(${assignedHalaqahs[0].complexName})` : ''}
                    </span>
                  </div>
                ) : (
                  <span
                    className="text-[11px] font-bold border-2 border-b-4 px-2.5 py-1 rounded-2xl shrink-0"
                    style={{
                      backgroundColor: themeCard,
                      borderColor: themeBorder,
                      borderBottomColor: themeBorderBottom,
                      color: themeAccent
                    }}
                  >
                    لم يتم تعيينك في حلقة بعد
                  </span>
                )
              )}
            </div>
          )}

          {/* Student count pill */}
          {currentUser?.role === 'admin' && (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-2xl border-2 border-b-4 text-xs font-black shrink-0"
              style={{
                backgroundColor: themeCard,
                borderColor: themeBorder,
                borderBottomColor: themeBorderBottom,
                color: themeAccent
              }}
            >
              <UserCheck className="w-3.5 h-3.5" style={{ color: themeAccent }} />
              <span>{studentsCount} طالباً</span>
            </div>
          )}

          {/* Date pill */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-2xl border-2 border-b-4 text-xs text-slate-300 font-bold shrink-0"
            style={{
              backgroundColor: themeCard,
              borderColor: themeBorder,
              borderBottomColor: themeBorderBottom
            }}
          >
            <Calendar
              className="w-3.5 h-3.5"
              style={{ color: themeAccent }}
            />
            <span className="truncate">{todayArabic}</span>
          </div>

          {/* Database indicator badge */}
          {isDeveloper && (
            activeComplex?.databaseConfig?.isCustom ? (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-2xl text-[10px] font-black border-2 border-b-4 shadow-sm shrink-0"
                style={activeComplex?.theme ? {
                  backgroundColor: activeComplex.theme.cardColor || '#203843',
                  color: activeComplex.theme.accentColor || '#ffc800',
                  borderColor: `${activeComplex.theme.accentColor || '#ffc800'}80`,
                  borderBottomColor: darkenHex(activeComplex.theme.accentColor || '#ffc800', 0.3)
                } : {
                  backgroundColor: '#203843',
                  color: '#ffc800',
                  borderColor: '#ffc80080',
                  borderBottomColor: '#e5a500'
                }}
                title={`المجمع متصل ومستقل 100% بمشروع فايربيس: ${activeComplex.databaseConfig.projectId}`}
              >
                <span className="relative flex h-2 w-2">
                  <span
                    className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                    style={{ backgroundColor: activeComplex?.theme?.accentColor || '#ffc800' }}
                  />
                  <span
                    className="relative inline-flex rounded-full h-2 w-2"
                    style={{ backgroundColor: activeComplex?.theme?.accentColor || '#ffc800' }}
                  />
                </span>
                <span>قاعدة: {activeComplex.databaseConfig.projectId}</span>
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-2xl text-[10px] font-bold border-2 border-b-4 shrink-0"
                style={activeComplex?.theme ? {
                  backgroundColor: activeComplex.theme.cardColor || '#203843',
                  borderColor: activeComplex.theme.secondaryColor || '#2b4550',
                  borderBottomColor: darkenHex(activeComplex.theme.primaryColor || '#131f24', 0.25),
                  color: '#cbd5e1'
                } : {
                  backgroundColor: '#203843',
                  borderColor: '#2b4550',
                  borderBottomColor: '#16262e',
                  color: '#cbd5e1'
                }}
                title="متصل بالقاعدة المركزية المشتركة للمنظومة"
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: activeComplex?.theme?.accentColor || '#ffc800' }}
                />
                <span>القاعدة المركزية</span>
              </div>
            )
          )}
        </div>
      </div>
    </header>
  );
};
