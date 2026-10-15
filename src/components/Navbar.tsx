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
  X,
  UserCog
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
      className="sticky top-0 z-30 backdrop-blur-xl border-b-4 px-3 sm:px-4 lg:px-8 py-2.5 sm:py-3 shadow-xl transition-all w-full max-w-full overflow-hidden"
      style={{
        backgroundColor: `${themeSecondary}f6`,
        borderColor: themeBorder,
        borderBottomColor: themeBorderBottom
      }}
    >
      <div className="max-w-7xl mx-auto flex flex-col gap-2 w-full max-w-full overflow-hidden">
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
                منظومة إدارة الحلقات والمجمعات القرآنية
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

            {/* Google Account Linking for Teachers and Supervisors */}
            {currentUser?.role === 'admin' && currentTeacher && (
              <div className="flex items-center">
                {currentTeacher.isGoogleLinked && currentTeacher.googleEmail ? (
                  <div
                    className="flex items-center gap-1 sm:gap-1.5 py-1.5 px-2.5 rounded-2xl border-2 border-b-4 text-xs shadow-sm transition-all"
                    style={{
                      backgroundColor: themeCard,
                      borderColor: `${themeAccent}50`,
                      borderBottomColor: themeBorderBottom,
                    }}
                    title={`حساب Google المرتبط: ${currentTeacher.googleEmail}`}
                  >
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span className="text-[11px] font-bold text-slate-200 hidden md:inline">
                      مربوط بـ Google
                    </span>
                    <CheckCircle className="w-3.5 h-3.5 shrink-0" style={{ color: themeAccent }} />
                    {onUnlinkGoogleTeacher && (
                      <button
                        type="button"
                        onClick={onUnlinkGoogleTeacher}
                        title="إلغاء ربط حساب Google"
                        className="text-slate-400 hover:text-red-400 p-0.5 rounded transition-colors cursor-pointer mr-0.5"
                      >
                        <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </button>
                    )}
                  </div>
                ) : (
                  onLinkGoogleTeacher && (
                    <button
                      type="button"
                      onClick={onLinkGoogleTeacher}
                      disabled={isLinkingGoogleTeacher}
                      title="ربط حسابك الحالي بحساب Google لتسجيل الدخول السريع لاحقاً"
                      className="flex items-center gap-1 sm:gap-1.5 py-1.5 px-2.5 rounded-2xl text-xs font-black border-2 border-b-4 active:translate-y-[2px] active:border-b-2 shadow-sm transition-all cursor-pointer disabled:opacity-60 hover:brightness-110"
                      style={{
                        backgroundColor: themeCard,
                        borderColor: themeBorder,
                        borderBottomColor: themeBorderBottom,
                        color: '#ffffff'
                      }}
                    >
                      <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span className="font-heading font-extrabold hidden xs:inline" style={{ color: themeAccent }}>
                        {isLinkingGoogleTeacher ? 'جاري الربط...' : 'ربط Google'}
                      </span>
                    </button>
                  )
                )}
              </div>
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
                {/* Profile Pill */}
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

        {/* ROW 2: Smooth Horizontal Slider for Complex & Halaqah Selectors and Quick Info */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none slider-horizontal py-1 px-0.5 w-full border-t border-[#2b4550]/60 shrink-0">
          {/* Complex Switcher / Badge */}
          {canSwitchComplex && availableComplexes.length > 1 && onSwitchComplex ? (
            <div
              className="flex items-center gap-1.5 rounded-2xl px-2.5 py-1.5 shadow-sm transition-all border-2 border-b-4 shrink-0"
              style={{
                backgroundColor: themeCard,
                borderColor: themeBorder,
                borderBottomColor: themeBorderBottom
              }}
            >
              <Building2
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: themeAccent }}
              />
              <select
                value={activeComplexId || availableComplexes[0]?.id || ''}
                onChange={e => onSwitchComplex(e.target.value)}
                className="text-xs text-white font-black bg-transparent border-none focus:outline-none cursor-pointer pr-1 max-w-[160px] sm:max-w-xs truncate"
                title={isDeveloper ? "التبديل بين كافة المجمعات القرآنية (إشراف شامل للمبرمج)" : "التبديل بين المجمعات المرتبط بها"}
              >
                {availableComplexes.map(c => (
                  <option
                    key={c.id}
                    value={c.id}
                    className="bg-[#203843] text-white py-1"
                  >
                    {c.name}{isDeveloper ? (c.databaseConfig?.isCustom ? ` ⚡ [مستقل: ${c.databaseConfig.projectId}]` : ' (المركزية)') : ''}
                  </option>
                ))}
              </select>
              {onOpenMultiComplexModal && (
                <button
                  type="button"
                  onClick={onOpenMultiComplexModal}
                  title="عرض بطاقات المجمعات والحلقات التابعة لك"
                  className="p-1 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
                  style={{ color: themeAccent }}
                >
                  <Layers className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : null}

          {/* Halaqah selector / label */}
          {currentUser?.role === 'admin' && (
            <div className="shrink-0">
              {isSupervisor ? (
                halaqahs.length > 0 && onSwitchHalaqah ? (
                  <div
                    className="flex items-center gap-1.5 border-2 border-b-4 rounded-2xl px-2.5 py-1 shadow-sm"
                    style={{
                      backgroundColor: themeCard,
                      borderColor: themeBorder,
                      borderBottomColor: themeBorderBottom
                    }}
                  >
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span
                        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                        style={{ backgroundColor: themeAccent }}
                      />
                      <span
                        className="relative inline-flex rounded-full h-2 w-2"
                        style={{ backgroundColor: themeAccent }}
                      />
                    </span>
                    <span
                      className="text-[10px] font-black hidden sm:inline shrink-0"
                      style={{ color: themeAccent }}
                    >
                      الحلقة الحالية:
                    </span>
                    <select
                      value={activeHalaqahId || 'all'}
                      onChange={e => onSwitchHalaqah(e.target.value)}
                      className="text-xs text-white font-bold bg-transparent border-none cursor-pointer focus:outline-none max-w-[150px] sm:max-w-[210px] truncate"
                      title="التبديل بين حلقات العمل"
                    >
                      <option value="all" className="bg-[#203843] text-white">
                        {isDeveloper ? 'الكل (جميع المجمعات)' : `الكل (جميع حلقات ${complexName || 'المجمع'})`} ({studentsCount} طالب)
                      </option>
                      {halaqahs.map(h => (
                        <option key={h.id} value={h.id} className="bg-[#203843] text-white">
                          {h.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <p
                    className="text-xs text-slate-200 font-bold px-2.5 py-1 rounded-2xl border-2 border-b-4 flex items-center gap-1.5"
                    style={{
                      backgroundColor: themeCard,
                      borderColor: themeBorder,
                      borderBottomColor: themeBorderBottom
                    }}
                  >
                    <span className="text-[10px] font-black" style={{ color: themeAccent }}>الحلقة الحالية:</span>
                    <span>{displayHalaqahName}</span>
                  </p>
                )
              ) : (
                assignedHalaqahs.length > 1 && onSwitchHalaqah ? (
                  <div
                    className="flex items-center gap-1.5 border-2 border-b-4 rounded-2xl px-2.5 py-1 shadow-sm"
                    style={{
                      backgroundColor: themeCard,
                      borderColor: themeBorder,
                      borderBottomColor: themeBorderBottom
                    }}
                  >
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span
                        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                        style={{ backgroundColor: themeAccent }}
                      />
                      <span
                        className="relative inline-flex rounded-full h-2 w-2"
                        style={{ backgroundColor: themeAccent }}
                      />
                    </span>
                    <span
                      className="text-[10px] font-black hidden sm:inline shrink-0"
                      style={{ color: themeAccent }}
                    >
                      الحلقة الحالية:
                    </span>
                    <select
                      value={activeHalaqahId || assignedHalaqahs[0]?.id || ''}
                      onChange={e => onSwitchHalaqah(e.target.value)}
                      className="text-xs text-white font-bold bg-transparent border-none cursor-pointer focus:outline-none max-w-[170px] sm:max-w-[240px] truncate"
                      title="التبديل بين مساحات حلقاتك المخصصة"
                    >
                      {assignedHalaqahs.map(h => (
                        <option key={h.id} value={h.id} className="bg-[#203843] text-white">
                          {h.name} {h.complexName ? `(${h.complexName})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : assignedHalaqahs.length === 1 ? (
                  <div
                    className="inline-flex items-center gap-1.5 text-xs text-white font-bold px-2.5 py-1 rounded-2xl border-2 border-b-4 shadow-sm shrink-0"
                    style={{
                      backgroundColor: themeCard,
                      borderColor: themeBorder,
                      borderBottomColor: themeBorderBottom
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: themeAccent }}
                    />
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
              <UserCheck className="w-3.5 h-3.5" />
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
