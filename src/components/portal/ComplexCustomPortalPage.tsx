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
  Hash,
  HelpCircle,
  CheckSquare,
  Mail,
  Timer,
  Lock,
  RefreshCw
} from 'lucide-react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import {
  QuranComplex,
  Halaqah,
  StudentRegistrationApplication,
  ComplexPortalConfig,
  Student,
  PortalCustomQuestion
} from '../../types';
import { OmranDataService, auth } from '../../lib/firebase';
import { darkenHex, lightenHex, getContrastTextColor } from '../../lib/themeUtils';
import {
  validateEmailAuthenticity,
  generateEmailOtp,
  verifyEmailOtp,
  buildOtpVerificationEmail,
  buildApplicationReceivedEmail,
  dispatchPortalEmailNotification
} from '../../lib/portalEmailService';
import { PortalEmailNotificationToast } from './PortalEmailNotificationToast';

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
      emailRequired: true,
      memorizedJuzRequired: true,
      preferredHalaqahRequired: true,
      notesAllowed: true,
      showHalaqahQuestion: true,
      halaqahQuestionLabel: 'الحلقة القرآنية المفضلة',
      halaqahSelectionMode: 'all',
      allowedHalaqahIds: [],
      allowAutoPlacement: true,
      customQuestions: []
    }
  };

  const mode = portalConfig.portalMode || 'login_and_register';
  const showLogin = mode === 'login_and_register' || mode === 'login_only';
  const showRegister = mode === 'login_and_register' || mode === 'register_only';

  // Registration Closing & Deadline Logic
  const isClosedManually = Boolean(portalConfig.isRegistrationClosedManually);
  const deadlineDate = portalConfig.registrationDeadline ? new Date(portalConfig.registrationDeadline) : null;
  const isPastDeadline = deadlineDate ? new Date() > deadlineDate : false;
  const isRegistrationClosed = isClosedManually || isPastDeadline;

  // Active top tab in the portal
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'track'>(() => {
    // If URL has track parameter
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('track') || params.get('trackCode')) {
        return 'track';
      }
    }
    if (showRegister && !showLogin && !isRegistrationClosed) return 'register';
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

  // Compute Allowed Halaqahs for the Registration Dropdown
  const showHalaqahQuestion = portalConfig.fieldConfig.showHalaqahQuestion !== false;
  const halaqahQuestionLabel = portalConfig.fieldConfig.halaqahQuestionLabel || 'الحلقة المرغوبة في المجمع:';
  const allowAutoPlacement = portalConfig.fieldConfig.allowAutoPlacement !== false;

  const visibleHalaqahs = useMemo(() => {
    if (!showHalaqahQuestion) return [];
    if (portalConfig.fieldConfig.halaqahSelectionMode === 'specific' && Array.isArray(portalConfig.fieldConfig.allowedHalaqahIds) && portalConfig.fieldConfig.allowedHalaqahIds.length > 0) {
      const allowedSet = new Set(portalConfig.fieldConfig.allowedHalaqahIds);
      return halaqahs.filter(h => allowedSet.has(h.id));
    }
    return halaqahs;
  }, [showHalaqahQuestion, portalConfig.fieldConfig.halaqahSelectionMode, portalConfig.fieldConfig.allowedHalaqahIds, halaqahs]);

  // Form State: Register / Join Request
  const [studentName, setStudentName] = useState('');
  const [studentAge, setStudentAge] = useState<number>(10);
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');

  // Email Question & Verification States (سؤال البريد الإلكتروني الإلزامي الموثق)
  const [studentEmail, setStudentEmail] = useState('');
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [emailVerificationMethod, setEmailVerificationMethod] = useState<'google' | 'otp' | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);

  // Countdown timer for resending OTP
  useEffect(() => {
    let timer: any;
    if (otpCountdown > 0) {
      timer = setInterval(() => {
        setOtpCountdown(prev => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [otpCountdown]);

  const [selectedJuz, setSelectedJuz] = useState<number[]>([30]);
  const [preferredHalaqahId, setPreferredHalaqahId] = useState<string>(() => {
    if (visibleHalaqahs.length > 0) return visibleHalaqahs[0].id;
    return '';
  });
  const [applicationNotes, setApplicationNotes] = useState('');

  // Custom Questions State
  const activeCustomQuestions: PortalCustomQuestion[] = useMemo(() => {
    const list = portalConfig.fieldConfig.customQuestions;
    if (!Array.isArray(list)) return [];
    return list.filter(q => q.isEnabled !== false);
  }, [portalConfig.fieldConfig.customQuestions]);

  const [customAnswers, setCustomAnswers] = useState<Record<string, any>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccessApp, setSubmitSuccessApp] = useState<StudentRegistrationApplication | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Form State: Track Request
  const [searchQuery, setSearchQuery] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('track') || params.get('trackCode') || '';
    }
    return '';
  });
  const [isTracking, setIsTracking] = useState(false);
  const [trackedApplication, setTrackedApplication] = useState<StudentRegistrationApplication | null>(null);
  const [trackSearched, setTrackSearched] = useState(false);
  const [isConfirmingEntry, setIsConfirmingEntry] = useState(false);

  // Auto lookup if query param exists
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('track') || params.get('trackCode');
      if (code) {
        setSearchQuery(code);
        setActiveTab('track');
        handleLookupApplication(undefined, code);
      }
    }
  }, []);

  // Form State: Complex-scoped Login
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Compute portal direct URL for email links
  const portalUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?complexPortal=${complex.id}`
    : `?complexPortal=${complex.id}`;

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

  // Handle Custom Question Value Change
  const handleCustomAnswerChange = (questionId: string, val: any) => {
    setCustomAnswers(prev => ({
      ...prev,
      [questionId]: val
    }));
  };

  // Toggle Checkbox Item in multi-selection
  const handleToggleCheckboxOption = (questionId: string, option: string) => {
    const currentList: string[] = Array.isArray(customAnswers[questionId]) ? customAnswers[questionId] : [];
    const updated = currentList.includes(option)
      ? currentList.filter(o => o !== option)
      : [...currentList, option];
    handleCustomAnswerChange(questionId, updated);
  };

  // 1. Google Fast Sign-in & Email Verification
  const handleGoogleSignInVerification = async () => {
    setEmailError(null);
    setIsGoogleSigningIn(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (user && user.email) {
        setStudentEmail(user.email);
        setIsEmailVerified(true);
        setEmailVerificationMethod('google');
        setOtpSent(false);

        // Auto-fill student name if empty
        if (!studentName && user.displayName) {
          setStudentName(user.displayName);
        }
      }
    } catch (err: any) {
      console.warn('Google Sign In note:', err);
      // If popup was blocked or closed
      if (err?.code === 'auth/popup-blocked') {
        setEmailError('تم حجب النافذة المنبثقة من قِبل المتصفح. يمكنك إدخال بريدك يدوياً بالأسفل والتحقق برمز التفعيل.');
      } else if (err?.code !== 'auth/popup-closed-by-user') {
        setEmailError('تعذر التحقق عبر حساب Google حالياً. يرجى إدخال بريدك الإلكتروني يدوياً بالأسفل والتحقق بالرمز.');
      }
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  // 2. Send OTP to Manual Email
  const handleSendEmailOtp = () => {
    setEmailError(null);
    const check = validateEmailAuthenticity(studentEmail);
    if (!check.isValid) {
      setEmailError(check.error || 'يرجى إدخال بريد إلكتروني صحيح.');
      return;
    }

    setIsSendingOtp(true);
    try {
      // Generate 6-digit OTP
      const code = generateEmailOtp(studentEmail);

      // Build Branded Email from support@omran.com
      const emailPayload = buildOtpVerificationEmail(complex, studentEmail.trim().toLowerCase(), code);

      // Dispatch real-time in-app email toast with copy action
      dispatchPortalEmailNotification(emailPayload);

      setOtpSent(true);
      setOtpCountdown(60); // 60 seconds cooldown for resending
    } catch (e) {
      setEmailError('حدث خطأ أثناء إنشاء رمز التحقق. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  // 3. Verify OTP Code
  const handleVerifyOtpCode = () => {
    setEmailError(null);
    if (!enteredOtp || enteredOtp.trim().length < 6) {
      setEmailError('يرجى كتابة رمز التحقق المكون من 6 أرقام كاملاً.');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const res = verifyEmailOtp(studentEmail, enteredOtp);
      if (res.success) {
        setIsEmailVerified(true);
        setEmailVerificationMethod('otp');
        setEmailError(null);
      } else {
        setEmailError(res.error || 'رمز التحقق غير صحيح.');
      }
    } catch {
      setEmailError('تعذر التحقق من الرمز حالياً.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Handle Join Application Submission
  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (isRegistrationClosed) {
      setFormError('عذراً، باب التسجيل مغلق حالياً ولا يمكن استقبال طلبات جديدة.');
      return;
    }

    if (portalConfig.fieldConfig.studentNameRequired && (!studentName || studentName.trim().length < 4)) {
      setFormError('يرجى كتابة اسم الطالب كاملاً (ثلاثي أو رباعي) للتسجيل.');
      return;
    }

    if (portalConfig.fieldConfig.parentPhoneRequired && (!parentPhone || parentPhone.replace(/\D/g, '').length < 8)) {
      setFormError('يرجى إدخال رقم هاتف ولي الأمر (واتساب) للتواصل وتأكيد القبول.');
      return;
    }

    // MANDATORY EMAIL VERIFICATION CHECK
    if (!studentEmail || !isEmailVerified) {
      setFormError('البريد الإلكتروني إلزامي ومهم جداً. يرجى توثيق بريدك الإلكتروني عبر Google أو برمز التفعيل أولاً لمتابعة دورك وتلقي إشعار القبول.');
      return;
    }

    // Validate Required Custom Questions
    for (const q of activeCustomQuestions) {
      if (q.required) {
        const ans = customAnswers[q.id];
        if (ans === undefined || ans === null || ans === '' || (Array.isArray(ans) && ans.length === 0)) {
          setFormError(`يرجى الإجابة على السؤال الإلزامي: "${q.label}".`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const randomDigits = Math.floor(100000 + Math.random() * 900000);
      const trackingCode = `OMR-${randomDigits}`;

      const selectedHalaqahObj = halaqahs.find(h => h.id === preferredHalaqahId);

      // Build structured custom responses
      const customQuestionResponses = activeCustomQuestions
        .filter(q => customAnswers[q.id] !== undefined && customAnswers[q.id] !== '')
        .map(q => ({
          questionId: q.id,
          questionLabel: q.label,
          questionType: q.type,
          answer: customAnswers[q.id]
        }));

      // Calculate queue number & pending ahead count for this complex
      const allExisting = await OmranDataService.loadRegistrationApplications(complex.id);
      const pendingAhead = allExisting.filter(a => a.status === 'pending').length;
      const queueNumber = pendingAhead + 1;

      const newApp: StudentRegistrationApplication = {
        id: `app_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        trackingCode,
        complexId: complex.id,
        complexName: complex.name,
        studentName: studentName.trim(),
        age: Number(studentAge) || 10,
        parentName: parentName.trim() || 'ولي الأمر',
        parentPhone: parentPhone.trim(),
        email: studentEmail.trim().toLowerCase(),
        isEmailVerified: true,
        emailVerificationMethod: emailVerificationMethod || 'otp',
        queueNumber,
        pendingAheadCount: pendingAhead,
        memorizedJuzList: selectedJuz,
        preferredHalaqahId: showHalaqahQuestion && preferredHalaqahId ? preferredHalaqahId : undefined,
        preferredHalaqahName: showHalaqahQuestion
          ? selectedHalaqahObj?.name || 'توجيه تلقائي من المشرف'
          : 'توجيه تلقائي من المشرف (سؤال الحلقة معطل)',
        notes: applicationNotes.trim() || undefined,
        status: 'pending',
        appliedAt: new Date().toISOString(),
        customAnswers,
        customQuestionResponses
      };

      await OmranDataService.saveRegistrationApplication(newApp);

      // Send Queue Status & Tracking Email to student/parent
      const receivedEmailPayload = buildApplicationReceivedEmail(complex, newApp, portalUrl);
      dispatchPortalEmailNotification(receivedEmailPayload);

      setSubmitSuccessApp(newApp);
    } catch (err: any) {
      setFormError('تعذر إرسال الطلب حالياً، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Application Tracking Lookup
  const handleLookupApplication = async (e?: React.FormEvent, directCode?: string) => {
    if (e) e.preventDefault();
    const query = directCode || searchQuery;
    if (!query.trim()) return;

    setIsTracking(true);
    setTrackSearched(true);
    try {
      const found = await OmranDataService.findRegistrationApplication(query, complex.id);
      setTrackedApplication(found);
    } catch (err) {
      setTrackedApplication(null);
    } finally {
      setIsTracking(false);
    }
  };

  // Handle Student Acceptance Confirmation & Entry into Halaqah
  const handleStudentConfirmEntry = async () => {
    if (!trackedApplication) return;
    setIsConfirmingEntry(true);
    try {
      const updated = await OmranDataService.confirmStudentApplicationEntry(trackedApplication.id, complex.id);
      if (updated) {
        setTrackedApplication(updated);
      }
    } catch (err) {
      console.error('Error confirming student entry:', err);
    } finally {
      setIsConfirmingEntry(false);
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
      {/* Floating In-App Email & OTP Simulation Toast */}
      <PortalEmailNotificationToast />

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
                  البوابة الإلكترونية المعتمدة
                </span>
                <span className="text-xs text-slate-300">منظومة عُمْرَان القرآنية</span>
              </div>
              <h1 className="text-base sm:text-xl font-black font-heading text-white truncate max-w-sm sm:max-w-md">
                {portalConfig.portalTitle || `بوابة ${complex.name}`}
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={onExitPortal}
            className="px-3.5 py-2 rounded-xl border-2 border-b-2 text-xs font-black text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
            style={{
              backgroundColor: themeCard,
              borderColor: themeCardBorder
            }}
          >
            <span>الرئيسية العامة</span>
            <ArrowRight className="w-4 h-4 rotate-180" />
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="relative z-10 flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 my-4">
        {/* Welcome & Info Card */}
        <div
          className="rounded-3xl border-2 border-b-4 p-5 sm:p-6 mb-6 shadow-xl relative overflow-hidden"
          style={{
            backgroundColor: themeCard,
            borderColor: themeCardBorder,
            borderBottomColor: themeCardShadow
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4" style={{ color: themeAccent }} />
                <h2 className="text-sm sm:text-base font-black text-white">
                  مرحباً بكم في {complex.name}
                </h2>
              </div>
              <p className="text-xs text-slate-300 font-bold leading-relaxed max-w-xl">
                {portalConfig.welcomeMessage ||
                  `بوابة التسجيل والخدمات الإلكترونية الموحدة لمجمع ${complex.name} لتعليم القرآن الكريم وتجويده.`}
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
              {isRegistrationClosed && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-500 text-white font-black">
                  مغلق
                </span>
              )}
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
                <label className="text-xs font-black text-slate-200 block">
                  كلمة المرور (إذا تم تعيينها):
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="كلمة المرور المسجلة بالمجمع..."
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
                className="w-full py-4 rounded-2xl border-2 border-b-4 text-sm font-black flex items-center justify-center gap-2 cursor-pointer transition-all active:translate-y-0.5 hover:brightness-110 shadow-lg disabled:opacity-50"
                style={{
                  backgroundColor: themeAccent,
                  borderColor: themeAccent,
                  borderBottomColor: themeAccentShadow,
                  color: accentTextColor
                }}
              >
                <LogIn className="w-4 h-4" />
                <span>{isLoggingIn ? 'جارٍ تسجيل الدخول...' : 'دخول إلى بوابة المجمع'}</span>
              </button>
            </form>

            {showRegister && (
              <div className="pt-4 border-t border-white/10 text-center">
                <p className="text-xs text-slate-300 font-bold">
                  طالب جديد ترغب في الالتحاق بالحلقات؟{' '}
                  <button
                    type="button"
                    onClick={() => setActiveTab('register')}
                    className="text-amber-400 hover:underline font-black cursor-pointer"
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
            {/* If Registration is CLOSED (Time expired or manually locked by supervisor) */}
            {isRegistrationClosed ? (
              <div className="text-center space-y-6 py-8 animate-in zoom-in-95 duration-200">
                <div
                  className="w-20 h-20 rounded-3xl mx-auto border-2 border-b-4 flex items-center justify-center shadow-xl bg-red-500/20 text-red-400 border-red-500 border-b-red-700"
                >
                  <Lock className="w-10 h-10 stroke-[2.3]" />
                </div>

                <div className="space-y-2 max-w-lg mx-auto">
                  <span className="text-xs px-3 py-1 rounded-full font-black border bg-red-500/20 border-red-500/40 text-red-300">
                    التسجيل مقفل حالياً ⛔
                  </span>
                  <h3 className="text-2xl font-black text-white font-heading">
                    عذراً، باب التسجيل مغلق حالياً
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 font-bold leading-relaxed">
                    {portalConfig.closedMessage ||
                      'تم إغلاق استقبال طلبات الانضمام الجديدة للفترة الحالية لاكتمال المقاعد المتاحة في حلقات المجمع.'}
                  </p>
                  {deadlineDate && (
                    <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-400 font-bold mt-2">
                      انتهت فترة التسجيل بتاريخ: {deadlineDate.toLocaleDateString('ar-SA')} الساعة {deadlineDate.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setActiveTab('track')}
                    className="px-6 py-3.5 rounded-2xl border-2 border-b-4 text-xs sm:text-sm font-black flex items-center gap-2 cursor-pointer transition-all active:translate-y-0.5 hover:brightness-110 shadow-lg text-white"
                    style={{
                      backgroundColor: themeAccent,
                      borderColor: themeAccent,
                      borderBottomColor: themeAccentShadow
                    }}
                  >
                    <Search className="w-4 h-4" />
                    <span>متابعة وتفقد طلب تم تقديمه مسبقاً</span>
                  </button>

                  {showLogin && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('login')}
                      className="px-5 py-3.5 rounded-2xl border-2 border-b-2 text-xs sm:text-sm font-black text-slate-200 hover:text-white cursor-pointer"
                      style={{
                        backgroundColor: themeCard,
                        borderColor: themeCardBorder
                      }}
                    >
                      تسجيل الدخول للطلاب الحاليين
                    </button>
                  )}
                </div>
              </div>
            ) : submitSuccessApp ? (
              /* If Form Submitted Successfully: Show Congratulations, Queue Position & Tracking Code */
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
                    تم استلام طلبك بنجاح وهو قيد المراجعة في الدور 🎉
                  </span>
                  <h3 className="text-2xl font-black text-white font-heading">
                    أهلاً بك يا {submitSuccessApp.studentName}!
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 font-bold max-w-md mx-auto leading-relaxed">
                    تم إرسال طلب انضمامك إلى مشرف مجمع {complex.name}. تم إرسال رسالة تأكيد إلى بريدك الإلكتروني الموثق (
                    <strong>{submitSuccessApp.email}</strong>) برقم متابعة طلبك ودورك في قائمة الانتظار.
                  </p>
                </div>

                {/* Queue Position and Tracking Code Highlight Card */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
                  {/* Queue Position */}
                  <div
                    className="border-2 border-b-4 rounded-3xl p-4 text-center space-y-1 shadow-lg"
                    style={{
                      backgroundColor: themeBg,
                      borderColor: '#ffc800',
                      borderBottomColor: '#d69e00'
                    }}
                  >
                    <span className="text-[11px] font-bold text-slate-300 block">
                      دورك في قائمة المراجعة:
                    </span>
                    <div className="text-2xl font-black text-amber-400 font-mono">
                      الترتيب #{submitSuccessApp.queueNumber || 1}
                    </div>
                    <span className="text-[10px] text-slate-400 block font-bold">
                      {(submitSuccessApp.pendingAheadCount || 0) > 0
                        ? `يوجد ${submitSuccessApp.pendingAheadCount} طلبات قيد الفرز قبلك`
                        : 'طلبك في مقدمة قائمة المراجعة الحالية'}
                    </span>
                  </div>

                  {/* Tracking Code */}
                  <div
                    className="border-2 border-b-4 rounded-3xl p-4 text-center space-y-1 shadow-lg"
                    style={{
                      backgroundColor: themeBg,
                      borderColor: themeAccent,
                      borderBottomColor: themeAccentShadow
                    }}
                  >
                    <span className="text-[11px] font-bold text-slate-300 block">
                      رقم متابعة الطلب:
                    </span>
                    <div
                      className="text-2xl font-black font-mono tracking-wider"
                      style={{ color: themeAccent }}
                    >
                      {submitSuccessApp.trackingCode}
                    </div>
                    <button
                      type="button"
                      onClick={copyTrackingCode}
                      className="w-full py-1.5 px-2 rounded-xl border text-[11px] font-black flex items-center justify-center gap-1 transition-all cursor-pointer mt-1"
                      style={{
                        backgroundColor: themeCard,
                        borderColor: themeCardBorder,
                        color: copiedCode ? themeAccent : '#ffffff'
                      }}
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? 'تم النسخ!' : 'نسخ الرقم'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery(submitSuccessApp.trackingCode);
                      setActiveTab('track');
                      handleLookupApplication(undefined, submitSuccessApp.trackingCode);
                    }}
                    className="px-6 py-3.5 rounded-2xl border-2 border-b-4 text-xs sm:text-sm font-black flex items-center gap-2 cursor-pointer transition-all active:translate-y-0.5 hover:brightness-110 shadow-md"
                    style={{
                      backgroundColor: themeAccent,
                      borderColor: themeAccent,
                      borderBottomColor: themeAccentShadow,
                      color: accentTextColor
                    }}
                  >
                    <Search className="w-4 h-4" />
                    <span>متابعة حالة طلبي مباشرة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSubmitSuccessApp(null);
                      setStudentName('');
                      setParentPhone('');
                      setParentName('');
                      setStudentEmail('');
                      setIsEmailVerified(false);
                      setEmailVerificationMethod(null);
                      setCustomAnswers({});
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
                    يرجى تعبئة بيانات الطالب وتوثيق البريد الإلكتروني لتلقي إشعارات الدور والقبول
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

                {/* 2. MANDATORY EMAIL VERIFICATION QUESTION (سؤال البريد الإلكتروني الإلزامي الموثق) */}
                <div
                  className="p-4 sm:p-5 rounded-2xl border-2 border-b-4 space-y-4 shadow-md bg-white/5"
                  style={{
                    borderColor: isEmailVerified ? '#58cc02' : emailError ? '#ef4444' : themeAccent,
                    borderBottomColor: isEmailVerified ? '#46a302' : emailError ? '#b91c1c' : themeAccentShadow
                  }}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" style={{ color: isEmailVerified ? '#58cc02' : themeAccent }} />
                      <label className="text-xs font-black text-white flex items-center gap-2">
                        <span>البريد الإلكتروني للتوثيق والإشعارات:</span>
                      </label>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 font-black">
                      سؤال إلزامي مهم جداً *
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 font-bold leading-relaxed">
                    اختر بريدك الإلكتروني لتلقي ترتيبك في الدور ورابط متابعة الطلب وإشعار القبول الرسمي.
                  </p>

                  {/* Verification Status Banner if already verified */}
                  {isEmailVerified ? (
                    <div className="p-3.5 rounded-2xl bg-[#58cc02]/20 border-2 border-[#58cc02] text-white flex items-center justify-between gap-3 animate-in fade-in duration-200">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CheckCircle2 className="w-5 h-5 text-[#58cc02] shrink-0" />
                        <div className="min-w-0">
                          <span className="text-xs font-black text-[#58cc02] block">
                            تم توثيق البريد الإلكتروني بنجاح ✅
                          </span>
                          <span className="text-xs font-mono text-white truncate block">
                            {studentEmail}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setIsEmailVerified(false);
                          setEmailVerificationMethod(null);
                          setOtpSent(false);
                          setEnteredOtp('');
                        }}
                        className="text-[11px] text-slate-300 hover:text-white underline font-bold cursor-pointer shrink-0"
                      >
                        تغيير البريد
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Option 1: Fast Google Sign-in */}
                      <button
                        type="button"
                        onClick={handleGoogleSignInVerification}
                        disabled={isGoogleSigningIn}
                        className="w-full py-3 px-4 rounded-2xl border-2 border-b-4 bg-white text-slate-900 font-black text-xs sm:text-sm flex items-center justify-center gap-3 cursor-pointer transition-all active:translate-y-0.5 hover:bg-slate-50 shadow-md disabled:opacity-50"
                      >
                        {/* Google Multi-Color SVG Icon */}
                        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                          />
                        </svg>
                        <span>
                          {isGoogleSigningIn ? 'جارٍ التوثيق بحساب Google...' : 'التسجيل والتوثيق السريع بحساب Google'}
                        </span>
                      </button>

                      {/* Divider */}
                      <div className="flex items-center gap-3">
                        <div className="flex-1 border-t border-white/10" />
                        <span className="text-[11px] text-slate-400 font-bold">أو أدخل بريدك الإلكتروني يدوياً</span>
                        <div className="flex-1 border-t border-white/10" />
                      </div>

                      {/* Option 2: Manual Email & OTP Verification */}
                      <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row gap-2">
                          <div className="relative flex-1">
                            <input
                              type="email"
                              value={studentEmail}
                              onChange={e => {
                                setStudentEmail(e.target.value);
                                setEmailError(null);
                              }}
                              placeholder="أدخل بريدك الإلكتروني (مثل: name@gmail.com)..."
                              className="w-full border-2 rounded-2xl py-2.5 px-4 pr-11 text-xs sm:text-sm text-white placeholder-slate-400 outline-none font-bold transition-all focus:border-amber-400"
                              style={{
                                backgroundColor: themeBg,
                                borderColor: themeCardBorder
                              }}
                              dir="ltr"
                            />
                            <Mail className="w-4 h-4 text-slate-400 absolute right-4 top-3" />
                          </div>

                          <button
                            type="button"
                            onClick={handleSendEmailOtp}
                            disabled={isSendingOtp || (otpSent && otpCountdown > 0)}
                            className="px-5 py-2.5 rounded-2xl border-2 border-b-2 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all active:translate-y-0.5 hover:brightness-110 shadow-sm shrink-0 disabled:opacity-50"
                            style={{
                              backgroundColor: themeAccent,
                              borderColor: themeAccent,
                              color: accentTextColor
                            }}
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>
                              {isSendingOtp
                                ? 'جارٍ الإرسال...'
                                : otpSent && otpCountdown > 0
                                ? `إعادة الإرسال (${otpCountdown})`
                                : otpSent
                                ? 'إعادة إرسال الرمز'
                                : 'تحقق وإرسال الرمز'}
                            </span>
                          </button>
                        </div>

                        {/* OTP Verification Input Box */}
                        {otpSent && (
                          <div
                            className="p-3.5 rounded-2xl border-2 space-y-2.5 animate-in fade-in duration-150 bg-black/30"
                            style={{ borderColor: `${themeAccent}70` }}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-black text-amber-300">
                                أدخل رمز التحقق المكون من 6 أرقام:
                              </span>
                              <span className="text-[10px] text-slate-300 font-bold">
                                تم الإرسال من support@omran.com
                              </span>
                            </div>

                            <div className="flex gap-2">
                              <input
                                type="text"
                                maxLength={6}
                                value={enteredOtp}
                                onChange={e => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                                placeholder="• • • • • •"
                                className="w-40 text-center tracking-widest text-lg font-mono font-black border-2 rounded-xl py-2 px-3 text-white outline-none focus:border-amber-400"
                                style={{
                                  backgroundColor: themeBg,
                                  borderColor: themeCardBorder
                                }}
                              />

                              <button
                                type="button"
                                onClick={handleVerifyOtpCode}
                                disabled={isVerifyingOtp || enteredOtp.length < 6}
                                className="px-5 py-2 rounded-xl border-2 border-b-2 text-xs font-black flex items-center gap-1.5 cursor-pointer transition-all active:translate-y-0.5 shadow-sm hover:brightness-110 disabled:opacity-50"
                                style={{
                                  backgroundColor: themeAccent,
                                  borderColor: themeAccent,
                                  color: accentTextColor
                                }}
                              >
                                <Check className="w-4 h-4" />
                                <span>{isVerifyingOtp ? 'جارٍ التحقق...' : 'تأكيد الرمز'}</span>
                              </button>
                            </div>
                            <span className="text-[10px] text-slate-400 block font-bold">
                              💡 يظهر رمز التحقق أيضاً في الإشعار التفاعلي أعلى الشاشة ويمكن نسخه بضغطة زر.
                            </span>
                          </div>
                        )}

                        {emailError && (
                          <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-bold flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 text-red-300" />
                            <span>{emailError}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* 3. Age (أرقام من 0 - 100) */}
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

                  {/* 4. Parent Phone (واتساب) */}
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

                <div className={`grid grid-cols-1 ${showHalaqahQuestion ? 'sm:grid-cols-2' : ''} gap-4`}>
                  {/* 5. Parent Name */}
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

                  {/* 6. Preferred Halaqah (يظهر فقط إذا كان مفعلاً من المشرف) */}
                  {showHalaqahQuestion && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-200 block">
                        {halaqahQuestionLabel}
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
                        {allowAutoPlacement && (
                          <option value="">توجيه تلقائي من المشرف حسب المستوى</option>
                        )}
                        {visibleHalaqahs.map(h => (
                          <option key={h.id} value={h.id}>
                            {h.name} {h.primaryTeacherName ? `(المعلم: ${h.primaryTeacherName})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* 7. DYNAMIC CUSTOM QUESTIONS (الأسئلة الإضافية المخصصة من المشرف) */}
                {activeCustomQuestions.length > 0 && (
                  <div className="space-y-4 pt-3 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <h4 className="text-xs font-black text-amber-300">أسئلة إضافية خاصة بالمجمع:</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {activeCustomQuestions.map(q => {
                        const val = customAnswers[q.id];

                        return (
                          <div
                            key={q.id}
                            className={`space-y-1.5 ${
                              q.type === 'textarea' || q.type === 'checkbox' || q.type === 'radio'
                                ? 'sm:col-span-2'
                                : ''
                            }`}
                          >
                            <label className="text-xs font-black text-slate-200 flex items-center justify-between">
                              <span>{q.label}</span>
                              {q.required ? (
                                <span className="text-[10px] text-amber-400 font-bold">مطلوب *</span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-bold">اختياري</span>
                              )}
                            </label>

                            {q.description && (
                              <p className="text-[11px] text-slate-400 font-bold">{q.description}</p>
                            )}

                            {/* TEXT INPUT */}
                            {q.type === 'text' && (
                              <input
                                type="text"
                                required={q.required}
                                value={val || ''}
                                onChange={e => handleCustomAnswerChange(q.id, e.target.value)}
                                placeholder={q.placeholder || 'اكتب الإجابة هنا...'}
                                className="w-full border-2 rounded-2xl py-2.5 px-3.5 text-xs text-white placeholder-slate-400 outline-none font-bold transition-all focus:border-amber-400"
                                style={{
                                  backgroundColor: themeBg,
                                  borderColor: themeCardBorder
                                }}
                              />
                            )}

                            {/* TEXTAREA INPUT */}
                            {q.type === 'textarea' && (
                              <textarea
                                rows={2}
                                required={q.required}
                                value={val || ''}
                                onChange={e => handleCustomAnswerChange(q.id, e.target.value)}
                                placeholder={q.placeholder || 'اكتب التفاصيل والملاحظات هنا...'}
                                className="w-full border-2 rounded-2xl py-2.5 px-3.5 text-xs text-white placeholder-slate-400 outline-none font-bold transition-all focus:border-amber-400 resize-none"
                                style={{
                                  backgroundColor: themeBg,
                                  borderColor: themeCardBorder
                                }}
                              />
                            )}

                            {/* NUMBER INPUT */}
                            {q.type === 'number' && (
                              <input
                                type="number"
                                required={q.required}
                                value={val !== undefined ? val : ''}
                                onChange={e => handleCustomAnswerChange(q.id, e.target.value === '' ? '' : Number(e.target.value))}
                                placeholder={q.placeholder || 'أدخل الرقم...'}
                                className="w-full border-2 rounded-2xl py-2.5 px-3.5 text-xs text-white placeholder-slate-400 outline-none font-bold transition-all focus:border-amber-400"
                                style={{
                                  backgroundColor: themeBg,
                                  borderColor: themeCardBorder
                                }}
                              />
                            )}

                            {/* PHONE INPUT */}
                            {q.type === 'phone' && (
                              <input
                                type="tel"
                                required={q.required}
                                value={val || ''}
                                onChange={e => handleCustomAnswerChange(q.id, e.target.value)}
                                placeholder={q.placeholder || '05xxxxxxxx'}
                                className="w-full border-2 rounded-2xl py-2.5 px-3.5 text-xs text-white placeholder-slate-400 outline-none font-bold transition-all focus:border-amber-400"
                                style={{
                                  backgroundColor: themeBg,
                                  borderColor: themeCardBorder
                                }}
                                dir="ltr"
                              />
                            )}

                            {/* DATE INPUT */}
                            {q.type === 'date' && (
                              <input
                                type="date"
                                required={q.required}
                                value={val || ''}
                                onChange={e => handleCustomAnswerChange(q.id, e.target.value)}
                                className="w-full border-2 rounded-2xl py-2.5 px-3.5 text-xs text-white outline-none font-bold transition-all focus:border-amber-400"
                                style={{
                                  backgroundColor: themeBg,
                                  borderColor: themeCardBorder
                                }}
                              />
                            )}

                            {/* SELECT DROPDOWN */}
                            {q.type === 'select' && (
                              <select
                                required={q.required}
                                value={val || ''}
                                onChange={e => handleCustomAnswerChange(q.id, e.target.value)}
                                className="w-full border-2 rounded-2xl py-2.5 px-3.5 text-xs text-white font-bold outline-none cursor-pointer"
                                style={{
                                  backgroundColor: themeBg,
                                  borderColor: themeCardBorder
                                }}
                              >
                                <option value="">{q.placeholder || '-- اختر إجابتك --'}</option>
                                {q.options?.map((opt, oIdx) => (
                                  <option key={oIdx} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            )}

                            {/* RADIO BUTTONS */}
                            {q.type === 'radio' && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                {q.options?.map((opt, oIdx) => {
                                  const isChecked = val === opt;
                                  return (
                                    <label
                                      key={oIdx}
                                      className={`p-2.5 rounded-xl border-2 flex items-center justify-between text-xs font-bold cursor-pointer transition-all ${
                                        isChecked ? 'border-amber-400 bg-amber-400/10 text-white' : 'border-white/10 bg-white/5 text-slate-300'
                                      }`}
                                    >
                                      <span>{opt}</span>
                                      <input
                                        type="radio"
                                        name={`q_${q.id}`}
                                        checked={isChecked}
                                        onChange={() => handleCustomAnswerChange(q.id, opt)}
                                        className="w-4 h-4 accent-amber-400 cursor-pointer"
                                      />
                                    </label>
                                  );
                                })}
                              </div>
                            )}

                            {/* CHECKBOXES (MULTI-SELECT) */}
                            {q.type === 'checkbox' && (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                {q.options?.map((opt, oIdx) => {
                                  const list = Array.isArray(val) ? val : [];
                                  const isChecked = list.includes(opt);
                                  return (
                                    <button
                                      key={oIdx}
                                      type="button"
                                      onClick={() => handleToggleCheckboxOption(q.id, opt)}
                                      className={`p-2.5 rounded-xl border-2 flex items-center justify-between text-xs font-bold cursor-pointer transition-all text-right ${
                                        isChecked ? 'border-amber-400 bg-amber-400/10 text-white' : 'border-white/10 bg-white/5 text-slate-300'
                                      }`}
                                    >
                                      <span>{opt}</span>
                                      <CheckSquare
                                        className={`w-4 h-4 ${isChecked ? 'text-amber-400' : 'text-slate-500'}`}
                                      />
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 8. Quranic Juz Memorization (أجزاء القرآن الكريم الـ 30) */}
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

                {/* 9. Notes */}
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
                أدخل رقم الطلب الخاص بك أو هاتف ولي الأمر لمعرفة قرار المشرف وتأكيد الدخول
              </p>
            </div>

            <form onSubmit={handleLookupApplication} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  required
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="أدخل رقم الطلب (مثل OMR-123456) أو هاتف ولي الأمر..."
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
                      تأكد من كتابة رقم الطلب بشكل صحيح كما أُعطي لك بالبريد أو الرسالة، أو تواصل مع إدارة المجمع.
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
                        <div className="flex items-center gap-2 flex-wrap">
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
                            <span>قيد الدراسة والمراجعة في الدور</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status Message Content */}
                    <div className="space-y-4">
                      {/* PENDING STATUS WITH QUEUE POSITION */}
                      {trackedApplication.status === 'pending' && (
                        <div className="space-y-3">
                          <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-400/30 text-white text-xs sm:text-sm font-bold leading-relaxed space-y-2">
                            <div className="flex items-center gap-2 text-amber-300 font-black">
                              <Clock className="w-4 h-4" />
                              <span>طلبكم قيد المراجعة والفرز التربوي لدى المشرف:</span>
                            </div>
                            <p>
                              سيتم مراجعة الطلب وتسكين الطالب في الحلقة المناسبة لحفظه ومستواه. ستصلك رسالة بريد إلكتروني فور اعتماد القبول.
                            </p>
                          </div>

                          {/* Queue Badge */}
                          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between gap-3 text-xs">
                            <span className="text-slate-300 font-bold">موقع طلبك في الدور:</span>
                            <span className="font-black text-amber-400 font-mono text-sm">
                              الترتيب #{trackedApplication.queueNumber || 1}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* ACCEPTED STATUS WITH STUDENT CONFIRMATION BUTTON */}
                      {trackedApplication.status === 'accepted' && (
                        <div className="space-y-4">
                          <div className="p-4 rounded-2xl bg-[#58cc02]/15 border border-[#58cc02]/30 text-white text-xs sm:text-sm font-bold leading-relaxed space-y-2">
                            <div className="flex items-center gap-2 text-[#58cc02] font-black text-sm">
                              <Sparkles className="w-5 h-5 text-amber-400" />
                              <span>تهانينا! تم اعتماد وقبول طلبك في {complex.name} 🎉</span>
                            </div>
                            <p>
                              تم إلحاق الطالب في:{' '}
                              <strong className="text-amber-300 underline font-black">
                                {trackedApplication.assignedHalaqahName || trackedApplication.preferredHalaqahName || 'الحلقة القرآنية المعتمدة'}
                              </strong>.
                            </p>
                          </div>

                          {/* Student Confirmation Step */}
                          {trackedApplication.studentAcceptanceStatus !== 'confirmed_by_student' ? (
                            <div className="p-4 rounded-2xl border-2 border-amber-400 bg-amber-400/10 text-white space-y-3">
                              <div className="flex items-center gap-2 text-amber-300 font-black text-xs sm:text-sm">
                                <Clock className="w-4 h-4" />
                                <span>مطلوب تأكيد قبولك للدخول واستلام المقعد في الحلقة:</span>
                              </div>
                              <p className="text-xs text-slate-200 leading-relaxed font-bold">
                                اضغط على زر "أوافق وأؤكد دخولي للحلقة" لتأكيد انضمامك رسمياً، وسيتم تحديث حالتك فوراً لدى مشرف المجمع.
                              </p>

                              <button
                                type="button"
                                disabled={isConfirmingEntry}
                                onClick={handleStudentConfirmEntry}
                                className="w-full py-4 px-4 rounded-2xl border-2 border-b-4 text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer transition-all active:translate-y-0.5 hover:brightness-110 shadow-xl text-white"
                                style={{
                                  backgroundColor: '#58cc02',
                                  borderColor: '#58cc02',
                                  borderBottomColor: '#46a302'
                                }}
                              >
                                <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                                <span>
                                  {isConfirmingEntry ? 'جارٍ تأكيد الدخول وتحديث النظام...' : 'أوافق وأؤكد دخولي للحلقة الآن ✅'}
                                </span>
                              </button>
                            </div>
                          ) : (
                            /* Already Confirmed: Show confirmation badge & direct entry */
                            <div className="space-y-3">
                              <div className="p-3.5 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500 text-emerald-200 text-xs font-black flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-amber-400" />
                                <span>
                                  تم تأكيد الدخول في الحلقة بنجاح! تم قيدك رسمياً في حلقة {trackedApplication.assignedHalaqahName}.
                                </span>
                              </div>

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
                                <span>انقر هنا للدخول إلى حسابك ومتابعة دروس الحلقة الآن</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* REJECTED STATUS */}
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

                      {/* Display Custom Question Responses if any */}
                      {trackedApplication.customQuestionResponses && trackedApplication.customQuestionResponses.length > 0 && (
                        <div className="pt-3 border-t border-white/10 space-y-1.5">
                          <span className="text-[11px] font-black text-amber-400 block">بيانات وإجابات النموذج:</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            {trackedApplication.customQuestionResponses.map((r, idx) => (
                              <div key={idx} className="p-2 rounded-xl bg-white/5 border border-white/10">
                                <span className="text-slate-400 font-bold block">{r.questionLabel}:</span>
                                <span className="font-black text-white">
                                  {Array.isArray(r.answer) ? r.answer.join(', ') : String(r.answer)}
                                </span>
                              </div>
                            ))}
                          </div>
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
