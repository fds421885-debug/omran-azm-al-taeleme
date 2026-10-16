import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Building2,
  BookOpen,
  User,
  Phone,
  Calendar,
  Layers,
  CheckCircle2,
  Clock,
  XCircle,
  Copy,
  Check,
  Search,
  LogIn,
  UserPlus,
  Send,
  Sparkles,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Award,
  AlertCircle,
  Hash
} from 'lucide-react';
import {
  QuranComplex,
  Halaqah,
  StudentRegistrationApplication,
  ComplexPortalConfig,
  Student
} from '../../types';
import { OmranDataService } from '../../lib/firebase';
import { darkenHex, lightenHex, getContrastTextColor } from '../../lib/themeUtils';

// 30 Holy Quran Juz metadata (Part 1 to Part 30 with authentic names)
export const QURAN_JUZ_LIST = [
  { number: 1, name: 'الجزء الأول (الم)', surahRange: 'الفاتحة 1 - البقرة 141' },
  { number: 2, name: 'الجزء الثاني (سيقول)', surahRange: 'البقرة 142 - البقرة 252' },
  { number: 3, name: 'الجزء الثالث (تلك الرسل)', surahRange: 'البقرة 253 - آل عمران 92' },
  { number: 4, name: 'الجزء الرابع (لن تنالوا)', surahRange: 'آل عمران 93 - النساء 23' },
  { number: 5, name: 'الجزء الخامس (والمحصنات)', surahRange: 'النساء 24 - النساء 147' },
  { number: 6, name: 'الجزء السادس (لا يحب الله)', surahRange: 'النساء 148 - المائدة 81' },
  { number: 7, name: 'الجزء السابع (وإذا سمعوا)', surahRange: 'المائدة 82 - الأنعام 110' },
  { number: 8, name: 'الجزء الثامن (ولو أننا)', surahRange: 'الأنعام 111 - الأعراف 87' },
  { number: 9, name: 'الجزء التاسع (قال الملأ)', surahRange: 'الأعراف 88 - الأنفال 40' },
  { number: 10, name: 'الجزء العاشر (واعلموا)', surahRange: 'الأنفال 41 - التوبة 92' },
  { number: 11, name: 'الجزء الحادي عشر (يعتذرون)', surahRange: 'التوبة 93 - هود 5' },
  { number: 12, name: 'الجزء الثاني عشر (وما من دابة)', surahRange: 'هود 6 - يوسف 52' },
  { number: 13, name: 'الجزء الثالث عشر (وما أبرئ)', surahRange: 'يوسف 53 - إبراهيم 52' },
  { number: 14, name: 'الجزء الرابع عشر (ربما)', surahRange: 'الحجر 1 - النحل 128' },
  { number: 15, name: 'الجزء الخامس عشر (سبحان)', surahRange: 'الإسراء 1 - الكهف 74' },
  { number: 16, name: 'الجزء السادس عشر (قال ألم)', surahRange: 'الكهف 75 - طه 135' },
  { number: 17, name: 'الجزء السابع عشر (اقترب)', surahRange: 'الأنبياء 1 - الحج 78' },
  { number: 18, name: 'الجزء الثامن عشر (قد أفلح)', surahRange: 'المؤمنون 1 - الفرقان 20' },
  { number: 19, name: 'الجزء التاسع عشر (وقال الذين)', surahRange: 'الفرقان 21 - النمل 55' },
  { number: 20, name: 'الجزء العشرون (أمن خلق)', surahRange: 'النمل 56 - العنكبوت 45' },
  { number: 21, name: 'الجزء الحادي والعشرون (اتل ما أوحي)', surahRange: 'العنكبوت 46 - الأحزاب 30' },
  { number: 22, name: 'الجزء الثاني والعشرون (ومن يقنت)', surahRange: 'الأحزاب 31 - يس 27' },
  { number: 23, name: 'الجزء الثالث والعشرون (وما أنزلنا)', surahRange: 'يس 28 - الزمر 31' },
  { number: 24, name: 'الجزء الرابع والعشرون (فمن أظلم)', surahRange: 'الزمر 32 - فصلت 46' },
  { number: 25, name: 'الجزء الخامس والعشرون (إليه يرد)', surahRange: 'فصلت 47 - الجاثية 37' },
  { number: 26, name: 'الجزء السادس والعشرون (حم الأحقاف)', surahRange: 'الأحقاف 1 - الذاريات 30' },
  { number: 27, name: 'الجزء السابع والعشرون (قال فما خطبكم)', surahRange: 'الذاريات 31 - الحديد 29' },
  { number: 28, name: 'الجزء الثامن والعشرون (قد سمع)', surahRange: 'المجادلة 1 - التحريم 12' },
  { number: 29, name: 'الجزء التاسع والعشرون (تبارك)', surahRange: 'الملك 1 - المرسلات 50' },
  { number: 30, name: 'الجزء الثلاثون (عمّ يتساءلون)', surahRange: 'النبأ 1 - الناس 6' }
];

interface ComplexCustomPortalPageProps {
  complex: QuranComplex;
  halaqahs: Halaqah[];
  onLoginSuccess: (user: any, teacher?: any, student?: any) => void;
  onExitPortal: () => void;
}

export const ComplexCustomPortalPage: React.FC<ComplexCustomPortalPageProps> = ({
  complex,
  halaqahs,
  onLoginSuccess,
  onExitPortal
}) => {
  const portalConfig = complex.portalConfig || {
    isEnabled: true,
    portalMode: 'login_and_register',
    fieldConfig: {
      studentNameRequired: true,
      ageRequired: true,
      parentNameRequired: true,
      parentPhoneRequired: true,
      memorizedJuzRequired: true,
      preferredHalaqahRequired: true,
      notesAllowed: true
    }
  };

  const mode = portalConfig.portalMode || 'login_and_register';
  const showLogin = mode === 'login_and_register' || mode === 'login_only';
  const showRegister = mode === 'login_and_register' || mode === 'register_only';

  // Active top tab in the portal
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'track'>(() => {
    if (showRegister && !showLogin) return 'register';
    return 'login';
  });

  // Dynamic Theme Variables from Complex
  const theme = complex.theme || {
    primaryColor: '#131f24',
    secondaryColor: '#1b2e35',
    accentColor: '#58cc02',
    backgroundColor: '#131f24',
    cardColor: '#203843',
    textColor: '#ffffff'
  };

  const themeBg = theme.backgroundColor || '#131f24';
  const themeCard = theme.cardColor || '#203843';
  const themeSecondary = theme.secondaryColor || '#1b2e35';
  const themeAccent = theme.accentColor || '#58cc02';
  const themeAccentShadow = darkenHex(themeAccent, 0.28);
  const themeCardBorder = lightenHex(themeCard, 0.2);
  const themeCardShadow = darkenHex(themeCard, 0.35);
  const accentTextColor = getContrastTextColor(themeAccent);

  // Form State: Register / Join Request
  const [studentName, setStudentName] = useState('');
  const [studentAge, setStudentAge] = useState<number>(10);
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [selectedJuz, setSelectedJuz] = useState<number[]>([30]);
  const [preferredHalaqahId, setPreferredHalaqahId] = useState<string>(
    halaqahs.length > 0 ? halaqahs[0].id : ''
  );
  const [applicationNotes, setApplicationNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccessApp, setSubmitSuccessApp] = useState<StudentRegistrationApplication | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Form State: Track Request
  const [searchQuery, setSearchQuery] = useState('');
  const [isTracking, setIsTracking] = useState(false);
  const [trackedApplication, setTrackedApplication] = useState<StudentRegistrationApplication | null>(null);
  const [trackSearched, setTrackSearched] = useState(false);

  // Form State: Complex-scoped Login
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Quick Select Juz Helpers
  const handleToggleJuz = (juzNum: number) => {
    setSelectedJuz(prev =>
      prev.includes(juzNum) ? prev.filter(n => n !== juzNum) : [...prev, juzNum].sort((a, b) => b - a)
    );
  };

  const handleSelectAllJuz = () => {
    setSelectedJuz(Array.from({ length: 30 }, (_, i) => i + 1));
  };

  const handleSelectJuzAmmaOnly = () => {
    setSelectedJuz([30]);
  };

  const handleClearJuz = () => {
    setSelectedJuz([]);
  };

  // Handle Join Application Submission
  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (portalConfig.fieldConfig.studentNameRequired && (!studentName || studentName.trim().length < 4)) {
      setFormError('يرجى كتابة اسم الطالب كاملاً (ثلاثي أو رباعي) للتسجيل.');
      return;
    }

    if (portalConfig.fieldConfig.parentPhoneRequired && (!parentPhone || parentPhone.replace(/\D/g, '').length < 8)) {
      setFormError('يرجى إدخال رقم هاتف ولي الأمر (واتساب) للتواصل وتأكيد القبول.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Generate clean tracking code: OMR-[COMPLEX_INITIALS]-[RANDOM6]
      const complexInit = (complex.name || 'OMR')
        .replace(/[^\u0621-\u064A\w]/g, '')
        .slice(0, 3) || 'OMR';
      const randomDigits = Math.floor(100000 + Math.random() * 900000);
      const trackingCode = `OMR-${randomDigits}`;

      const selectedHalaqahObj = halaqahs.find(h => h.id === preferredHalaqahId);

      const newApp: StudentRegistrationApplication = {
        id: `app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        trackingCode,
        complexId: complex.id,
        complexName: complex.name,
        studentName: studentName.trim(),
        age: Number(studentAge) || 10,
        parentName: parentName.trim() || 'ولي الأمر',
        parentPhone: parentPhone.trim(),
        memorizedJuzList: selectedJuz,
        preferredHalaqahId: preferredHalaqahId || undefined,
        preferredHalaqahName: selectedHalaqahObj?.name || 'توجيه تلقائي من المشرف',
        notes: applicationNotes.trim() || undefined,
        status: 'pending',
        appliedAt: new Date().toISOString()
      };

      await OmranDataService.saveRegistrationApplication(newApp);
      setSubmitSuccessApp(newApp);
    } catch (err: any) {
      setFormError('تعذر إرسال الطلب حالياً، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Application Tracking Lookup
  const handleLookupApplication = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsTracking(true);
    setTrackSearched(true);
    try {
      const found = await OmranDataService.findRegistrationApplication(searchQuery, complex.id);
      setTrackedApplication(found);
    } catch (err) {
      setTrackedApplication(null);
    } finally {
      setIsTracking(false);
    }
  };

  // Handle Direct Login within this Complex
  const handlePerformLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const cleanIdent = loginIdentifier.trim().toLowerCase();
      const cleanIdentDigits = loginIdentifier.replace(/\D/g, '');

      // 1. Check if Teacher in this complex
      const teachers = await OmranDataService.loadTeachers();
      const matchedTeacher = teachers.find(t => {
        const matchUser = t.username.trim().toLowerCase() === cleanIdent;
        const matchPhone = t.phone && t.phone.replace(/\D/g, '') === cleanIdentDigits;
        const matchCode = t.teacherCode && t.teacherCode === cleanIdentDigits;
        const inThisComplex =
          t.complexId === complex.id ||
          (t.complexIds && t.complexIds.includes(complex.id)) ||
          t.role === 'developer';
        return (matchUser || matchPhone || matchCode) && inThisComplex;
      });

      if (matchedTeacher) {
        if (loginPassword && matchedTeacher.password && matchedTeacher.password !== loginPassword.trim()) {
          setLoginError('كلمة المرور غير صحيحة.');
          setIsLoggingIn(false);
          return;
        }
        onLoginSuccess(
          {
            username: matchedTeacher.name || matchedTeacher.username,
            role: 'admin',
            teacherId: matchedTeacher.id,
            complexId: complex.id
          },
          matchedTeacher,
          null
        );
        return;
      }

      // 2. Check if Student in this complex
      const students = await OmranDataService.loadStudents();
      const matchedStudent = students.find(s => {
        const inThisComplex = s.complexId === complex.id;
        const matchPhone = s.phone && s.phone.replace(/\D/g, '') === cleanIdentDigits;
        const matchParentPhone = s.parentPhones && s.parentPhones.some(p => p.replace(/\D/g, '') === cleanIdentDigits);
        const matchName = s.name.trim().toLowerCase() === cleanIdent;
        return inThisComplex && (matchPhone || matchParentPhone || matchName);
      });

      if (matchedStudent) {
        if (loginPassword && matchedStudent.password && matchedStudent.password !== loginPassword.trim()) {
          setLoginError('كلمة المرور غير صحيحة.');
          setIsLoggingIn(false);
          return;
        }
        onLoginSuccess(
          {
            username: matchedStudent.name,
            role: 'student',
            studentId: matchedStudent.id,
            complexId: complex.id
          },
          null,
          matchedStudent
        );
        return;
      }

      setLoginError('لم يتم العثور على حساب مطابق مقيد في هذا المجمع. إذا كنت طالباً جديداً، يمكنك تقديم طلب انضمام.');
    } catch (err: any) {
      setLoginError('حدث خطأ أثناء محاولة تسجيل الدخول.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const copyTrackingCode = () => {
    if (!submitSuccessApp) return;
    navigator.clipboard.writeText(submitSuccessApp.trackingCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen text-white font-sans flex flex-col justify-between selection:bg-amber-400 selection:text-slate-900 transition-colors duration-300 relative overflow-x-hidden"
      style={{ backgroundColor: themeBg }}
    >
      {/* Background Decorative Duolingo Grids */}
      <div className="absolute inset-0 pointer-events-none opacity-5">
        <div className="w-full h-full bg-[radial-gradient(#ffffff_1.5px,transparent_1.5px)] [background-size:24px_24px]" />
      </div>

      {/* Top Complex Branded Header */}
      <header
        className="relative z-10 border-b-2 shadow-lg px-4 sm:px-8 py-4 backdrop-blur-md"
        style={{
          backgroundColor: `${themeSecondary}e6`,
          borderColor: themeCardBorder
        }}
      >
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {complex.logoUrl ? (
              <img
                src={complex.logoUrl}
                alt={complex.name}
                className="w-12 h-12 rounded-2xl object-contain border-2 shadow-md bg-white/5 p-1"
                style={{ borderColor: themeAccent }}
              />
            ) : (
              <div
                className="w-12 h-12 rounded-2xl border-2 border-b-4 flex items-center justify-center shadow-md font-black"
                style={{
                  backgroundColor: `${themeAccent}25`,
                  borderColor: themeAccent,
                  borderBottomColor: themeAccentShadow,
                  color: themeAccent
                }}
              >
                <Building2 className="w-6 h-6 stroke-[2.3]" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-black border"
                  style={{
                    backgroundColor: `${themeAccent}20`,
                    borderColor: `${themeAccent}60`,
                    color: themeAccent
                  }}
                >
                  البوابة المخصصة للمجمع
                </span>
                <span className="text-xs text-slate-300 hidden sm:inline">• منظومة عمران</span>
              </div>
              <h1 className="text-lg sm:text-xl font-black font-heading tracking-wide text-white">
                {complex.name}
              </h1>
            </div>
          </div>

          {/* Exit / Return to Main Platform Button */}
          <button
            type="button"
            onClick={onExitPortal}
            className="px-3.5 py-2 rounded-2xl text-xs font-black border-2 border-b-4 active:translate-y-0.5 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:brightness-110"
            style={{
              backgroundColor: themeCard,
              borderColor: themeCardBorder,
              borderBottomColor: themeCardShadow,
              color: '#ffffff'
            }}
          >
            <span>المنصة الرئيسية</span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
          </button>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 md:p-8 relative z-10 flex flex-col justify-center">
        {/* Welcome Callout Banner */}
        <div
          className="rounded-[28px] border-2 border-b-4 p-5 sm:p-6 mb-6 shadow-xl relative overflow-hidden"
          style={{
            backgroundColor: themeSecondary,
            borderColor: themeCardBorder,
            borderBottomColor: themeCardShadow
          }}
        >
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-black font-heading text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 animate-pulse" style={{ color: themeAccent }} />
                <span>أهلاً بكم في رحاب {complex.name}</span>
              </h2>
              <p className="text-xs sm:text-sm text-slate-200 font-bold leading-relaxed max-w-xl">
                {portalConfig.welcomeMessage ||
                  complex.description ||
                  'منظومة قرآنية مباركة تعنى بحفظ كتاب الله تعالى وتعليم تلاوته وتجويده بأحدث الأساليب التربوية والتحفيزية.'}
              </p>
            </div>

            <div
              className="px-3.5 py-2 rounded-2xl border-2 border-b-2 text-center shrink-0 self-start sm:self-auto"
              style={{
                backgroundColor: `${themeAccent}18`,
                borderColor: `${themeAccent}50`,
                color: themeAccent
              }}
            >
              <span className="text-[10px] block font-bold">الحلقات التابعة للمجمع</span>
              <span className="text-sm font-black font-mono">{halaqahs.length} حلقات معتمدة</span>
            </div>
          </div>
        </div>

        {/* 3 Duolingo Tactile Navigation Switchers */}
        <div
          className="flex items-center gap-2 p-1.5 rounded-2xl border-2 border-b-4 mb-6 shadow-md"
          style={{
            backgroundColor: themeCard,
            borderColor: themeCardBorder,
            borderBottomColor: themeCardShadow
          }}
        >
          {showLogin && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setSubmitSuccessApp(null);
              }}
              className={`flex-1 py-3 px-3 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer border-2 active:translate-y-0.5 ${
                activeTab === 'login'
                  ? 'border-b-4 shadow-md'
                  : 'border-transparent text-slate-300 hover:text-white hover:bg-white/5'
              }`}
              style={
                activeTab === 'login'
                  ? {
                      backgroundColor: themeAccent,
                      borderColor: themeAccent,
                      borderBottomColor: themeAccentShadow,
                      color: accentTextColor
                    }
                  : undefined
              }
            >
              <LogIn className="w-4 h-4" />
              <span>تسجيل الدخول</span>
            </button>
          )}

          {showRegister && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                setSubmitSuccessApp(null);
              }}
              className={`flex-1 py-3 px-3 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer border-2 active:translate-y-0.5 ${
                activeTab === 'register'
                  ? 'border-b-4 shadow-md'
                  : 'border-transparent text-slate-300 hover:text-white hover:bg-white/5'
              }`}
              style={
                activeTab === 'register'
                  ? {
                      backgroundColor: themeAccent,
                      borderColor: themeAccent,
                      borderBottomColor: themeAccentShadow,
                      color: accentTextColor
                    }
                  : undefined
              }
            >
              <UserPlus className="w-4 h-4" />
              <span>طلب انضمام جديد</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setActiveTab('track');
              setSubmitSuccessApp(null);
            }}
            className={`flex-1 py-3 px-3 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer border-2 active:translate-y-0.5 ${
              activeTab === 'track'
                ? 'border-b-4 shadow-md'
                : 'border-transparent text-slate-300 hover:text-white hover:bg-white/5'
            }`}
            style={
              activeTab === 'track'
                ? {
                    backgroundColor: themeAccent,
                    borderColor: themeAccent,
                    borderBottomColor: themeAccentShadow,
                    color: accentTextColor
                  }
                : undefined
            }
          >
            <Search className="w-4 h-4" />
            <span>تفقد حالة الطلب</span>
          </button>
        </div>

        {/* Tab 1: Complex Login */}
        {activeTab === 'login' && showLogin && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[32px] border-2 border-b-4 p-6 sm:p-8 shadow-2xl space-y-6"
            style={{
              backgroundColor: themeCard,
              borderColor: themeCardBorder,
              borderBottomColor: themeCardShadow
            }}
          >
            <div className="space-y-1 text-center">
              <h3 className="text-lg sm:text-xl font-black text-white font-heading">
                تسجيل الدخول إلى {complex.name}
              </h3>
              <p className="text-xs text-slate-300 font-bold">
                خاص بالمعلمين والطلاب المسجلين رسمياً في حلقات هذا المجمع
              </p>
            </div>

            {loginError && (
              <div className="p-3.5 rounded-2xl bg-red-500/20 border-2 border-red-500/40 text-red-200 text-xs font-bold flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-300" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handlePerformLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-200 block">
                  اسم المستخدم أو رقم الهاتف أو كود المعلم:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={e => setLoginIdentifier(e.target.value)}
                    placeholder="مثال: 0501234567 أو اسم المستخدم..."
                    className="w-full border-2 rounded-2xl py-3 px-4 pr-11 text-sm text-white placeholder-slate-400 outline-none font-bold transition-all focus:border-amber-400"
                    style={{
                      backgroundColor: themeBg,
                      borderColor: themeCardBorder
                    }}
                  />
                  <User className="w-4 h-4 text-slate-400 absolute right-4 top-3.5" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-200 block">كلمة المرور:</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور (افتراضياً: 123)"
                  className="w-full border-2 rounded-2xl py-3 px-4 text-sm text-white placeholder-slate-400 outline-none font-bold transition-all focus:border-amber-400"
                  style={{
                    backgroundColor: themeBg,
                    borderColor: themeCardBorder
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-3.5 rounded-2xl border-2 border-b-4 text-sm font-black flex items-center justify-center gap-2 cursor-pointer transition-all active:translate-y-0.5 hover:brightness-110 shadow-lg disabled:opacity-50"
                style={{
                  backgroundColor: themeAccent,
                  borderColor: themeAccent,
                  borderBottomColor: themeAccentShadow,
                  color: accentTextColor
                }}
              >
                <LogIn className="w-4 h-4" />
                <span>{isLoggingIn ? 'جارٍ التحقق وتأكيد الدخول...' : 'تسجيل الدخول إلى المجمع'}</span>
              </button>
            </form>

            {showRegister && (
              <div className="pt-4 border-t border-white/10 text-center">
                <p className="text-xs text-slate-300 font-bold">
                  هل أنت طالب جديد وترغب بالانضمام إلى حلقات {complex.name}؟{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('register')}
                    className="underline font-black cursor-pointer hover:brightness-125"
                    style={{ color: themeAccent }}
                  >
                    قدّم طلب انضمامك الآن
                  </button>
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* Tab 2: Register / Join Request Form */}
        {activeTab === 'register' && showRegister && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[32px] border-2 border-b-4 p-6 sm:p-8 shadow-2xl space-y-6"
            style={{
              backgroundColor: themeCard,
              borderColor: themeCardBorder,
              borderBottomColor: themeCardShadow
            }}
          >
            {/* If Form Submitted Successfully: Show Congratulations & Tracking Code */}
            {submitSuccessApp ? (
              <div className="text-center space-y-6 py-6 animate-in zoom-in-95 duration-200">
                <div
                  className="w-20 h-20 rounded-3xl mx-auto border-2 border-b-4 flex items-center justify-center shadow-xl"
                  style={{
                    backgroundColor: `${themeAccent}25`,
                    borderColor: themeAccent,
                    borderBottomColor: themeAccentShadow,
                    color: themeAccent
                  }}
                >
                  <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
                </div>

                <div className="space-y-2">
                  <span
                    className="text-xs px-3 py-1 rounded-full font-black border"
                    style={{
                      backgroundColor: `${themeAccent}20`,
                      borderColor: `${themeAccent}60`,
                      color: themeAccent
                    }}
                  >
                    تم استلام طلبك بنجاح بارك الله فيك
                  </span>
                  <h3 className="text-2xl font-black text-white font-heading">
                    أهلاً بك يا {submitSuccessApp.studentName}!
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 font-bold max-w-md mx-auto leading-relaxed">
                    تم إرسال طلب انضمامك إلى مشرف مجمع {complex.name}. سيتم مراجعة الطلب والتواصل معكم قريباً عبر
                    الواتساب على الرقم ({submitSuccessApp.parentPhone}).
                  </p>
                </div>

                {/* Tracking Code Highlight Card */}
                <div
                  className="border-2 border-b-4 rounded-3xl p-5 max-w-sm mx-auto space-y-2 shadow-lg"
                  style={{
                    backgroundColor: themeBg,
                    borderColor: themeAccent,
                    borderBottomColor: themeAccentShadow
                  }}
                >
                  <span className="text-[11px] font-bold text-slate-300 block">
                    رقم متابعة وتفقد حالة الطلب:
                  </span>
                  <div
                    className="text-2xl sm:text-3xl font-black font-mono tracking-widest"
                    style={{ color: themeAccent }}
                  >
                    {submitSuccessApp.trackingCode}
                  </div>
                  <button
                    type="button"
                    onClick={copyTrackingCode}
                    className="w-full py-2 px-3 rounded-xl border-2 border-b-2 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:translate-y-0.5 mt-2"
                    style={{
                      backgroundColor: themeCard,
                      borderColor: themeCardBorder,
                      color: copiedCode ? themeAccent : '#ffffff'
                    }}
                  >
                    {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedCode ? 'تم نسخ رقم الطلب!' : 'نسخ رقم متابعة الطلب'}</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery(submitSuccessApp.trackingCode);
                      setActiveTab('track');
                      handleLookupApplication();
                    }}
                    className="px-5 py-3 rounded-2xl border-2 border-b-4 text-xs font-black flex items-center gap-2 cursor-pointer transition-all active:translate-y-0.5 hover:brightness-110 shadow-md"
                    style={{
                      backgroundColor: themeAccent,
                      borderColor: themeAccent,
                      borderBottomColor: themeAccentShadow,
                      color: accentTextColor
                    }}
                  >
                    <Search className="w-4 h-4" />
                    <span>تفقد حالة طلبي الآن</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSubmitSuccessApp(null);
                      setStudentName('');
                      setParentPhone('');
                      setParentName('');
                    }}
                    className="px-4 py-3 rounded-2xl border-2 border-b-2 text-xs font-black text-slate-300 hover:text-white cursor-pointer transition-all"
                    style={{
                      backgroundColor: themeCard,
                      borderColor: themeCardBorder
                    }}
                  >
                    تقديم طلب لطالب آخر
                  </button>
                </div>
              </div>
            ) : (
              /* Questionnaire Form */
              <form onSubmit={handleSubmitApplication} className="space-y-5">
                <div className="space-y-1">
                  <h3 className="text-lg sm:text-xl font-black text-white font-heading">
                    استمارة التسجيل وطلب الانضمام الذكي
                  </h3>
                  <p className="text-xs text-slate-300 font-bold">
                    يرجى تعبئة بيانات الطالب وولي الأمر لإلحاقه بالحلقة المناسبة
                  </p>
                </div>

                {formError && (
                  <div className="p-3.5 rounded-2xl bg-red-500/20 border-2 border-red-500/40 text-red-200 text-xs font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-300" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* 1. Student Full Name (سؤال مقالي) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-200 flex items-center justify-between">
                    <span>اسم الطالب كاملاً (رباعي):</span>
                    <span className="text-[10px] text-amber-400 font-bold">سؤال مقالي إلزامي *</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required={portalConfig.fieldConfig.studentNameRequired}
                      value={studentName}
                      onChange={e => setStudentName(e.target.value)}
                      placeholder="اكتب اسم الطالب رباعياً (مثال: عبد الرحمن أحمد محمد السعيد)"
                      className="w-full border-2 rounded-2xl py-3 px-4 pr-11 text-sm text-white placeholder-slate-400 outline-none font-bold transition-all focus:border-amber-400"
                      style={{
                        backgroundColor: themeBg,
                        borderColor: themeCardBorder
                      }}
                    />
                    <User className="w-4 h-4 text-slate-400 absolute right-4 top-3.5" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* 2. Age (أرقام من 0 - 100) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-200 flex items-center justify-between">
                      <span>عمر الطالب (سنوات):</span>
                      <span className="text-xs font-black font-mono text-amber-400">{studentAge} سنة</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="4"
                        max="80"
                        value={studentAge}
                        onChange={e => setStudentAge(Number(e.target.value))}
                        className="flex-1 accent-amber-400 cursor-pointer"
                      />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={studentAge}
                        onChange={e => setStudentAge(Math.min(100, Math.max(0, Number(e.target.value))))}
                        className="w-20 text-center border-2 rounded-xl py-1.5 px-2 text-sm font-black text-white outline-none"
                        style={{
                          backgroundColor: themeBg,
                          borderColor: themeCardBorder
                        }}
                      />
                    </div>
                  </div>

                  {/* 3. Parent Phone (واتساب) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-200 flex items-center justify-between">
                      <span>رقم هاتف ولي الأمر (واتساب):</span>
                      <span className="text-[10px] text-amber-400 font-bold">إلزامي للتواصل *</span>
                    </label>
                    <div className="relative">
                      <input
                        type="tel"
                        required={portalConfig.fieldConfig.parentPhoneRequired}
                        value={parentPhone}
                        onChange={e => setParentPhone(e.target.value)}
                        placeholder="مثال: 0501234567"
                        className="w-full border-2 rounded-2xl py-3 px-4 pr-11 text-sm text-white placeholder-slate-400 outline-none font-bold transition-all focus:border-amber-400"
                        style={{
                          backgroundColor: themeBg,
                          borderColor: themeCardBorder
                        }}
                        dir="ltr"
                      />
                      <Phone className="w-4 h-4 text-slate-400 absolute right-4 top-3.5" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* 4. Parent Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-200 block">اسم ولي الأمر:</label>
                    <input
                      type="text"
                      value={parentName}
                      onChange={e => setParentName(e.target.value)}
                      placeholder="مثال: أحمد محمد السعيد"
                      className="w-full border-2 rounded-2xl py-3 px-4 text-sm text-white placeholder-slate-400 outline-none font-bold transition-all focus:border-amber-400"
                      style={{
                        backgroundColor: themeBg,
                        borderColor: themeCardBorder
                      }}
                    />
                  </div>

                  {/* 5. Preferred Halaqah */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-200 block">
                      الحلقة المرغوبة في المجمع:
                    </label>
                    <select
                      value={preferredHalaqahId}
                      onChange={e => setPreferredHalaqahId(e.target.value)}
                      className="w-full border-2 rounded-2xl py-3 px-3.5 text-xs font-black text-white outline-none cursor-pointer"
                      style={{
                        backgroundColor: themeBg,
                        borderColor: themeCardBorder
                      }}
                    >
                      <option value="">توجيه تلقائي من المشرف حسب المستوى</option>
                      {halaqahs.map(h => (
                        <option key={h.id} value={h.id}>
                          {h.name} {h.primaryTeacherName ? `(المعلم: ${h.primaryTeacherName})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 6. Quranic Juz Memorization (أجزاء القرآن الكريم الـ 30) */}
                {portalConfig.fieldConfig.memorizedJuzRequired && (
                  <div className="space-y-2.5 pt-2 border-t border-white/10">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <label className="text-xs font-black text-slate-200 flex items-center gap-2">
                          <BookOpen className="w-4 h-4" style={{ color: themeAccent }} />
                          <span>أجزاء القرآن الكريم المحفوظة للطالب:</span>
                        </label>
                        <span className="text-[11px] text-slate-300 font-bold block">
                          تم تحديد <strong>{selectedJuz.length}</strong> من 30 جزءاً
                        </span>
                      </div>

                      {/* Quick helpers */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={handleSelectJuzAmmaOnly}
                          className="px-2.5 py-1 rounded-xl border text-[11px] font-bold cursor-pointer transition-all hover:bg-white/10"
                          style={{ borderColor: themeCardBorder }}
                        >
                          جزء عم فقط
                        </button>
                        <button
                          type="button"
                          onClick={handleSelectAllJuz}
                          className="px-2.5 py-1 rounded-xl border text-[11px] font-bold cursor-pointer transition-all hover:bg-white/10"
                          style={{ borderColor: themeCardBorder }}
                        >
                          القرآن كاملاً (30 جزءاً)
                        </button>
                        <button
                          type="button"
                          onClick={handleClearJuz}
                          className="px-2.5 py-1 rounded-xl border text-[11px] font-bold text-slate-400 hover:text-red-300 cursor-pointer"
                          style={{ borderColor: themeCardBorder }}
                        >
                          مسح
                        </button>
                      </div>
                    </div>

                    {/* Interactive 30 Quranic Juz Grid */}
                    <div
                      className="border-2 rounded-2xl p-3 max-h-52 overflow-y-auto scrollbar-thin grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2"
                      style={{
                        backgroundColor: themeBg,
                        borderColor: themeCardBorder
                      }}
                    >
                      {QURAN_JUZ_LIST.map(j => {
                        const isChosen = selectedJuz.includes(j.number);
                        return (
                          <button
                            key={j.number}
                            type="button"
                            onClick={() => handleToggleJuz(j.number)}
                            className={`p-2 rounded-xl text-right transition-all cursor-pointer border-2 text-[11px] font-black flex items-center justify-between gap-1 active:translate-y-0.5 ${
                              isChosen ? 'border-b-4 shadow-sm' : 'border-transparent text-slate-300 hover:bg-white/5'
                            }`}
                            style={
                              isChosen
                                ? {
                                    backgroundColor: themeAccent,
                                    borderColor: themeAccent,
                                    borderBottomColor: themeAccentShadow,
                                    color: accentTextColor
                                  }
                                : {
                                    backgroundColor: themeCard,
                                    borderColor: themeCardBorder
                                  }
                            }
                            title={j.surahRange}
                          >
                            <span className="line-clamp-1">{j.name}</span>
                            {isChosen ? (
                              <Check className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <span className="text-[10px] opacity-40 font-mono">#{j.number}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 7. Notes */}
                {portalConfig.fieldConfig.notesAllowed && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-200 block">
                      ملاحظات أو تزكيات سابقة (اختياري):
                    </label>
                    <textarea
                      rows={2}
                      value={applicationNotes}
                      onChange={e => setApplicationNotes(e.target.value)}
                      placeholder="اذكر أي ملاحظات عن قدرات الطالب أو أوقاته المفضلة..."
                      className="w-full border-2 rounded-2xl py-2.5 px-4 text-xs text-white placeholder-slate-400 outline-none font-bold transition-all focus:border-amber-400 resize-none"
                      style={{
                        backgroundColor: themeBg,
                        borderColor: themeCardBorder
                      }}
                    />
                  </div>
                )}

                {/* Submit Application Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 rounded-2xl border-2 border-b-4 text-sm font-black flex items-center justify-center gap-2 cursor-pointer transition-all active:translate-y-0.5 hover:brightness-110 shadow-xl disabled:opacity-50"
                  style={{
                    backgroundColor: themeAccent,
                    borderColor: themeAccent,
                    borderBottomColor: themeAccentShadow,
                    color: accentTextColor
                  }}
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? 'جارٍ تسجيل الطلب وإرساله للمشرف...' : 'إرسال طلب الانضمام إلى المجمع'}</span>
                </button>
              </form>
            )}
          </motion.div>
        )}

        {/* Tab 3: Track Application Status */}
        {activeTab === 'track' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[32px] border-2 border-b-4 p-6 sm:p-8 shadow-2xl space-y-6"
            style={{
              backgroundColor: themeCard,
              borderColor: themeCardBorder,
              borderBottomColor: themeCardShadow
            }}
          >
            <div className="space-y-1 text-center">
              <h3 className="text-lg sm:text-xl font-black text-white font-heading">
                تفقد ومتابعة حالة طلب الانضمام
              </h3>
              <p className="text-xs text-slate-300 font-bold">
                أدخل رقم الطلب الخاص بك أو رقم هاتف ولي الأمر لمعرفة قرار المشرف
              </p>
            </div>

            <form onSubmit={handleLookupApplication} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  required
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="أدخل رقم الطلب (مثل OMR-123456) أو رقم هاتف ولي الأمر..."
                  className="w-full border-2 rounded-2xl py-3 px-4 pr-11 text-sm text-white placeholder-slate-400 outline-none font-bold transition-all focus:border-amber-400"
                  style={{
                    backgroundColor: themeBg,
                    borderColor: themeCardBorder
                  }}
                />
                <Hash className="w-4 h-4 text-slate-400 absolute right-4 top-3.5" />
              </div>

              <button
                type="submit"
                disabled={isTracking}
                className="px-6 py-3 rounded-2xl border-2 border-b-4 text-xs sm:text-sm font-black flex items-center gap-2 cursor-pointer transition-all active:translate-y-0.5 hover:brightness-110 shadow-md shrink-0"
                style={{
                  backgroundColor: themeAccent,
                  borderColor: themeAccent,
                  borderBottomColor: themeAccentShadow,
                  color: accentTextColor
                }}
              >
                <Search className="w-4 h-4" />
                <span>{isTracking ? 'بحث...' : 'تفقد الطلب'}</span>
              </button>
            </form>

            {/* Tracking Result View */}
            {trackSearched && (
              <div className="pt-4 border-t border-white/10 animate-in fade-in duration-200">
                {!trackedApplication ? (
                  <div
                    className="p-6 rounded-2xl border-2 text-center space-y-2"
                    style={{
                      backgroundColor: themeBg,
                      borderColor: themeCardBorder
                    }}
                  >
                    <Clock className="w-8 h-8 text-amber-400 mx-auto opacity-70" />
                    <h4 className="text-sm font-black text-white">لم يتم العثور على طلب بهذا الرقم أو الهاتف</h4>
                    <p className="text-xs text-slate-300 font-bold">
                      تأكد من كتابة رقم الطلب بشكل صحيح كما أُعطي لك، أو تواصل مع إدارة المجمع.
                    </p>
                  </div>
                ) : (
                  <div
                    className="border-2 border-b-4 rounded-3xl p-6 space-y-5 shadow-xl"
                    style={{
                      backgroundColor: themeBg,
                      borderColor:
                        trackedApplication.status === 'accepted'
                          ? '#58cc02'
                          : trackedApplication.status === 'rejected'
                          ? '#ff4b4b'
                          : themeAccent,
                      borderBottomColor:
                        trackedApplication.status === 'accepted'
                          ? '#46a302'
                          : trackedApplication.status === 'rejected'
                          ? '#ea2b2b'
                          : themeAccentShadow
                    }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-slate-300">
                            رقم الطلب: <strong>{trackedApplication.trackingCode}</strong>
                          </span>
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-xs text-slate-300">
                            بتاريخ: {new Date(trackedApplication.appliedAt).toLocaleDateString('ar-SA')}
                          </span>
                        </div>
                        <h4 className="text-lg font-black text-white mt-1">
                          الطالب: {trackedApplication.studentName} ({trackedApplication.age} سنة)
                        </h4>
                      </div>

                      {/* Status Badge */}
                      <div>
                        {trackedApplication.status === 'accepted' && (
                          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#58cc02]/20 border border-[#58cc02] text-[#58cc02] text-xs font-black shadow-sm">
                            <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                            <span>مقبول ومعتمد 🎉</span>
                          </div>
                        )}
                        {trackedApplication.status === 'rejected' && (
                          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-red-500/20 border border-red-500 text-red-300 text-xs font-black shadow-sm">
                            <XCircle className="w-4 h-4 stroke-[2.5]" />
                            <span>نعتذر، لم يتم القبول</span>
                          </div>
                        )}
                        {trackedApplication.status === 'pending' && (
                          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-400 text-amber-300 text-xs font-black shadow-sm">
                            <Clock className="w-4 h-4 animate-spin" />
                            <span>قيد الدراسة والمراجعة</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status Message Content */}
                    <div className="space-y-3">
                      {trackedApplication.status === 'accepted' && (
                        <div className="space-y-3">
                          <div className="p-4 rounded-2xl bg-[#58cc02]/15 border border-[#58cc02]/30 text-white text-xs sm:text-sm font-bold leading-relaxed">
                            مبارك! تم اعتماد وقبول طلبك في <strong>{complex.name}</strong> وتم إلحاقك في{' '}
                            <strong>{trackedApplication.assignedHalaqahName || trackedApplication.preferredHalaqahName || 'الحلقة القرآنية'}</strong>.
                            نسأل الله لك التوفيق وحفظ كتابه الكريم.
                          </div>

                          {/* Instant Enter Button for accepted student */}
                          <button
                            type="button"
                            onClick={() => {
                              onLoginSuccess(
                                {
                                  username: trackedApplication.studentName,
                                  role: 'student',
                                  studentId: trackedApplication.createdStudentId,
                                  complexId: complex.id
                                },
                                null,
                                {
                                  id: trackedApplication.createdStudentId || `std_${trackedApplication.id}`,
                                  name: trackedApplication.studentName,
                                  halaqahId: trackedApplication.assignedHalaqahId,
                                  complexId: complex.id
                                } as Student
                              );
                            }}
                            className="w-full py-3.5 px-4 rounded-2xl border-2 border-b-4 text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer transition-all active:translate-y-0.5 hover:brightness-110 shadow-lg text-white"
                            style={{
                              backgroundColor: '#58cc02',
                              borderColor: '#58cc02',
                              borderBottomColor: '#46a302'
                            }}
                          >
                            <Sparkles className="w-4 h-4" />
                            <span>انقر هنا للدخول إلى حسابك والبدء في الحلقة الآن</span>
                          </button>
                        </div>
                      )}

                      {trackedApplication.status === 'rejected' && (
                        <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/30 text-white text-xs sm:text-sm font-bold leading-relaxed">
                          نعتذر منك، لم يتم قبول الطلب في هذه الدورة لاكتمال المقاعد المتاحة في حلقات المجمع.{' '}
                          {trackedApplication.rejectionReason && (
                            <div className="mt-2 text-red-200">
                              سبب الاعتذار: {trackedApplication.rejectionReason}
                            </div>
                          )}
                          نسأل الله لك التوفيق والبركة في طلب العلم.
                        </div>
                      )}

                      {trackedApplication.status === 'pending' && (
                        <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-400/30 text-white text-xs sm:text-sm font-bold leading-relaxed">
                          طلبكم قيد المراجعة والفرز من قِبل المشرف التعليمي للمجمع. سيتم تحديث حالة الطلب وإرسال
                          إشعار لكم بمجرد اعتماد الحلقة والتوقيت المناسب.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </main>

      {/* Footer Branded Note */}
      <footer
        className="relative z-10 border-t-2 py-4 px-6 text-center text-xs text-slate-400 font-bold"
        style={{
          backgroundColor: themeSecondary,
          borderColor: themeCardBorder
        }}
      >
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>{complex.name} • بوابة التسجيل والدخول الذكية الموحدة</span>
          <span className="text-[11px] text-slate-400 font-mono">
            نظام عُمْرَان لإدارة المجمعات والحلقات القرآنية
          </span>
        </div>
      </footer>
    </div>
  );
};
