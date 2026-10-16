import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Share2,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  Building2,
  CheckCircle2,
  XCircle,
  Clock,
  UserPlus,
  Sliders,
  Settings,
  Users,
  Search,
  BookOpen,
  Phone,
  Calendar,
  AlertCircle,
  Trash2,
  Sparkles,
  Link as LinkIcon
} from 'lucide-react';
import {
  QuranComplex,
  Halaqah,
  ComplexPortalConfig,
  ComplexPortalMode,
  StudentRegistrationApplication,
  RegistrationApplicationStatus,
  Student,
  TeacherAccount
} from '../../types';
import { OmranDataService } from '../../lib/firebase';
import { darkenHex, lightenHex, getContrastTextColor } from '../../lib/themeUtils';

interface ComplexPortalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  complex: QuranComplex;
  halaqahs: Halaqah[];
  teachers?: TeacherAccount[];
  onUpdateComplex: (updated: QuranComplex) => void | Promise<void>;
  onStudentCreatedFromApp?: (newStudent: Student) => void;
  initialTab?: 'link_and_config' | 'applications';
}

export const ComplexPortalSettingsModal: React.FC<ComplexPortalSettingsModalProps> = ({
  isOpen,
  onClose,
  complex,
  halaqahs,
  teachers,
  onUpdateComplex,
  onStudentCreatedFromApp,
  initialTab = 'link_and_config'
}) => {
  if (!isOpen) return null;

  // Active Tab inside settings modal: 'link_and_config' vs 'applications'
  const [modalTab, setModalTab] = useState<'link_and_config' | 'applications'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setModalTab(initialTab);
    }
  }, [initialTab]);

  // Theme styling
  const theme = complex.theme || {
    primaryColor: '#131f24',
    secondaryColor: '#1b2e35',
    accentColor: '#58cc02',
    backgroundColor: '#131f24',
    cardColor: '#203843',
    textColor: '#ffffff'
  };

  const themeAccent = theme.accentColor || '#58cc02';
  const themeAccentShadow = darkenHex(themeAccent, 0.28);
  const themeCard = theme.cardColor || '#203843';
  const themeCardBorder = lightenHex(themeCard, 0.2);
  const themeCardShadow = darkenHex(themeCard, 0.35);
  const accentTextColor = getContrastTextColor(themeAccent);

  // Portal Configuration state
  const initialConfig: ComplexPortalConfig = complex.portalConfig || {
    isEnabled: true,
    portalMode: 'login_and_register',
    portalTitle: `بوابة ${complex.name}`,
    welcomeMessage: complex.description || `مرحباً بكم في بوابة التسجيل والخدمات الإلكترونية لمجمع ${complex.name}`,
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

  const [portalMode, setPortalMode] = useState<ComplexPortalMode>(initialConfig.portalMode || 'login_and_register');
  const [welcomeMessage, setWelcomeMessage] = useState(initialConfig.welcomeMessage || '');
  const [studentNameRequired, setStudentNameRequired] = useState(initialConfig.fieldConfig.studentNameRequired);
  const [ageRequired, setAgeRequired] = useState(initialConfig.fieldConfig.ageRequired);
  const [parentNameRequired, setParentNameRequired] = useState(initialConfig.fieldConfig.parentNameRequired);
  const [parentPhoneRequired, setParentPhoneRequired] = useState(initialConfig.fieldConfig.parentPhoneRequired);
  const [memorizedJuzRequired, setMemorizedJuzRequired] = useState(initialConfig.fieldConfig.memorizedJuzRequired);
  const [preferredHalaqahRequired, setPreferredHalaqahRequired] = useState(initialConfig.fieldConfig.preferredHalaqahRequired);
  const [notesAllowed, setNotesAllowed] = useState(initialConfig.fieldConfig.notesAllowed);

  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Applications State
  const [applications, setApplications] = useState<StudentRegistrationApplication[]>([]);
  const [isLoadingApps, setIsLoadingApps] = useState(false);
  const [appFilter, setAppFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
  const [appSearch, setAppSearch] = useState('');

  // Selected Application for Accept / Reject Modal
  const [appToAccept, setAppToAccept] = useState<StudentRegistrationApplication | null>(null);
  const [targetHalaqahId, setTargetHalaqahId] = useState<string>(halaqahs[0]?.id || '');
  const [appToReject, setAppToReject] = useState<StudentRegistrationApplication | null>(null);
  const [rejectionReason, setRejectionReason] = useState('نعتذر، اكتملت المقاعد المتاحة في هذه الفترة.');
  const [isProcessingApp, setIsProcessingApp] = useState(false);

  // Share link state
  const [copiedLink, setCopiedLink] = useState(false);

  // Compute portal direct URL
  const portalUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?complexPortal=${complex.id}`
    : `?complexPortal=${complex.id}`;

  // Load applications for this complex
  const loadApps = async () => {
    setIsLoadingApps(true);
    try {
      const list = await OmranDataService.loadRegistrationApplications(complex.id);
      setApplications(list);
    } catch {
      setApplications([]);
    } finally {
      setIsLoadingApps(false);
    }
  };

  useEffect(() => {
    setIsLoadingApps(true);
    const unsub = OmranDataService.subscribeToRegistrationApplications(apps => {
      setApplications(apps);
      setIsLoadingApps(false);
    }, complex.id);

    return () => unsub();
  }, [complex.id]);

  // Save Portal Configuration
  const handleSavePortalConfig = async () => {
    setIsSavingConfig(true);
    setSaveSuccessMsg(null);
    try {
      const updatedConfig: ComplexPortalConfig = {
        isEnabled: true,
        portalMode,
        portalTitle: `بوابة ${complex.name}`,
        welcomeMessage,
        fieldConfig: {
          studentNameRequired,
          ageRequired,
          parentNameRequired,
          parentPhoneRequired,
          memorizedJuzRequired,
          preferredHalaqahRequired,
          notesAllowed
        },
        updatedAt: new Date().toISOString()
      };

      const updatedComplex: QuranComplex = {
        ...complex,
        portalConfig: updatedConfig
      };

      await OmranDataService.saveComplex(updatedComplex);
      await onUpdateComplex(updatedComplex);
      setSaveSuccessMsg('تم حفظ وتحديث إعدادات البوابة والرابط بنجاح!');
      setTimeout(() => setSaveSuccessMsg(null), 3000);
    } catch (e) {
      console.error('Error saving portal config:', e);
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Copy Link
  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(portalUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  // Share via WhatsApp
  const handleShareWhatsApp = () => {
    const text = `يسر مجمع ${complex.name} دعوة أولياء الأمور والطلاب للتسجيل أو تسجيل الدخول عبر البوابة الإلكترونية المخصصة للمجمع:\n${portalUrl}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Accept an application and create student record
  const handleConfirmAcceptApplication = async () => {
    if (!appToAccept) return;
    setIsProcessingApp(true);
    try {
      const targetHalaqah = halaqahs.find(h => h.id === targetHalaqahId) || halaqahs[0];
      const newStudentId = `std_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      // Calculate initial Surah / Ayah based on memorized juz or default
      const maxJuz = appToAccept.memorizedJuzList && appToAccept.memorizedJuzList.length > 0
        ? Math.max(...appToAccept.memorizedJuzList)
        : 30;

      const newStudent: Student = {
        id: newStudentId,
        name: appToAccept.studentName,
        password: '123',
        phone: appToAccept.parentPhone || '0500000000',
        age: appToAccept.age || 10,
        parentName: appToAccept.parentName || 'ولي الأمر',
        parentPhones: [appToAccept.parentPhone].filter(Boolean),
        parentPhone: appToAccept.parentPhone,
        currentSurah: maxJuz === 30 ? 78 : 2,
        currentSurahName: maxJuz === 30 ? 'النبأ' : 'البقرة',
        currentAyah: 1,
        dailyNewTarget: 'نصف وجه',
        dailyReviewTarget: 'ربع جزء',
        level: 'متوسط',
        complexId: complex.id,
        complexName: complex.name,
        halaqahId: targetHalaqah?.id,
        halaqahName: targetHalaqah?.name,
        notes: `تم قبوله عبر بوابة المجمع الإلكترونية • الأجزاء المحفوظة: ${appToAccept.memorizedJuzList?.join(', ') || 'لا يوجد'}`,
        createdAt: new Date().toISOString()
      };

      // 1. Save student in Firestore and local state
      await OmranDataService.saveStudent(newStudent);
      if (onStudentCreatedFromApp) {
        onStudentCreatedFromApp(newStudent);
      }

      // 2. Update Application status
      const updatedApp: StudentRegistrationApplication = {
        ...appToAccept,
        status: 'accepted',
        assignedHalaqahId: targetHalaqah?.id,
        assignedHalaqahName: targetHalaqah?.name,
        createdStudentId: newStudentId,
        reviewedAt: new Date().toISOString(),
        reviewedByName: complex.supervisorTeacherName || 'مشرف المجمع'
      };

      await OmranDataService.saveRegistrationApplication(updatedApp);
      setApplications(prev => prev.map(a => (a.id === updatedApp.id ? updatedApp : a)));
      setAppToAccept(null);
    } catch (e) {
      console.error('Error accepting application:', e);
    } finally {
      setIsProcessingApp(false);
    }
  };

  // Reject an application
  const handleConfirmRejectApplication = async () => {
    if (!appToReject) return;
    setIsProcessingApp(true);
    try {
      const updatedApp: StudentRegistrationApplication = {
        ...appToReject,
        status: 'rejected',
        rejectionReason,
        reviewedAt: new Date().toISOString(),
        reviewedByName: complex.supervisorTeacherName || 'مشرف المجمع'
      };

      await OmranDataService.saveRegistrationApplication(updatedApp);
      setApplications(prev => prev.map(a => (a.id === updatedApp.id ? updatedApp : a)));
      setAppToReject(null);
    } catch (e) {
      console.error('Error rejecting application:', e);
    } finally {
      setIsProcessingApp(false);
    }
  };

  // Filtered applications
  const filteredApps = applications.filter(a => {
    if (appFilter !== 'all' && a.status !== appFilter) return false;
    if (appSearch.trim()) {
      const q = appSearch.trim().toLowerCase();
      return (
        a.studentName?.toLowerCase().includes(q) ||
        a.trackingCode?.toLowerCase().includes(q) ||
        a.parentPhone?.includes(q) ||
        a.parentName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pendingCount = applications.filter(a => a.status === 'pending').length;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto"
    >
      <div
        className="relative w-full max-w-4xl rounded-[32px] border-2 border-b-4 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in zoom-in-95 duration-200"
        style={{
          backgroundColor: themeCard,
          borderColor: themeCardBorder,
          borderBottomColor: themeCardShadow
        }}
      >
        {/* Pinned Header */}
        <div
          className="p-5 sm:p-6 border-b-2 flex items-center justify-between gap-4 shrink-0"
          style={{
            backgroundColor: `${themeCard}f2`,
            borderColor: themeCardBorder
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl border-2 border-b-4 flex items-center justify-center shadow-md font-black shrink-0"
              style={{
                backgroundColor: `${themeAccent}25`,
                borderColor: themeAccent,
                borderBottomColor: themeAccentShadow,
                color: themeAccent
              }}
            >
              <LinkIcon className="w-6 h-6 stroke-[2.3]" />
            </div>
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
                  خاص بمشرف المجمع
                </span>
                <span className="text-xs text-slate-300">منظومة عمران</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black font-heading text-white">
                بوابة ورابط تسجيل {complex.name}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Switcher inside Modal */}
        <div
          className="flex items-center gap-2 p-2 border-b-2 shrink-0"
          style={{
            backgroundColor: `${theme.secondaryColor || '#1b2e35'}99`,
            borderColor: themeCardBorder
          }}
        >
          <button
            type="button"
            onClick={() => setModalTab('link_and_config')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer border-2 active:translate-y-0.5 ${
              modalTab === 'link_and_config'
                ? 'border-b-4 shadow-md'
                : 'border-transparent text-slate-300 hover:text-white hover:bg-white/5'
            }`}
            style={
              modalTab === 'link_and_config'
                ? {
                    backgroundColor: themeAccent,
                    borderColor: themeAccent,
                    borderBottomColor: themeAccentShadow,
                    color: accentTextColor
                  }
                : undefined
            }
          >
            <Sliders className="w-4 h-4" />
            <span>رابط البوابة وإعدادات النموذج</span>
          </button>

          <button
            type="button"
            onClick={() => setModalTab('applications')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer border-2 active:translate-y-0.5 relative ${
              modalTab === 'applications'
                ? 'border-b-4 shadow-md'
                : 'border-transparent text-slate-300 hover:text-white hover:bg-white/5'
            }`}
            style={
              modalTab === 'applications'
                ? {
                    backgroundColor: themeAccent,
                    borderColor: themeAccent,
                    borderBottomColor: themeAccentShadow,
                    color: accentTextColor
                  }
                : undefined
            }
          >
            <Users className="w-4 h-4" />
            <span>طلبات الانضمام الواردة</span>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-900 shadow-sm animate-pulse">
                {pendingCount} جديدة
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* TAB 1: Link & Questionnaire Config */}
          {modalTab === 'link_and_config' && (
            <div className="space-y-6">
              {/* Shareable Link Box */}
              <div
                className="rounded-2xl border-2 border-b-4 p-5 space-y-3 shadow-md"
                style={{
                  backgroundColor: theme.backgroundColor || '#131f24',
                  borderColor: themeAccent,
                  borderBottomColor: themeAccentShadow
                }}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" style={{ color: themeAccent }} />
                    <h3 className="text-sm font-black text-white">الرابط المباشر للبوابة الخاصة بهذا المجمع:</h3>
                  </div>
                  <span className="text-[11px] text-slate-300 font-bold">
                    ينقل المستخدم إلى بوابة مخصصة ومطرزة بثيم وشعار {complex.name}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={portalUrl}
                    className="flex-1 border-2 rounded-xl py-2 px-3 text-xs text-white font-mono outline-none select-all font-bold"
                    style={{
                      backgroundColor: themeCard,
                      borderColor: themeCardBorder
                    }}
                    dir="ltr"
                  />

                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="px-4 py-2.5 rounded-xl border-2 border-b-2 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:translate-y-0.5 shadow-sm hover:brightness-110 shrink-0"
                    style={{
                      backgroundColor: themeAccent,
                      borderColor: themeAccent,
                      color: accentTextColor
                    }}
                  >
                    {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'تم النسخ!' : 'نسخ الرابط'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="px-3.5 py-2.5 rounded-xl border-2 border-b-2 bg-[#25D366] text-white text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:translate-y-0.5 shadow-sm hover:brightness-110 shrink-0"
                    title="مشاركة الرابط مباشرة عبر واتساب"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">واتساب</span>
                  </button>

                  <a
                    href={portalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 rounded-xl border-2 border-b-2 text-slate-300 hover:text-white transition-all cursor-pointer shrink-0"
                    style={{
                      backgroundColor: themeCard,
                      borderColor: themeCardBorder
                    }}
                    title="معاينة وفتح البوابة في نافذة جديدة"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Mode Selector */}
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-200 block">
                  ١. نوع وصلاحيات البوابة (ماذا يتاح للزائر عبر هذا الرابط؟):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: 'login_and_register' as ComplexPortalMode,
                      title: 'تسجيل دخول + طلب انضمام معاً',
                      desc: 'يتيح للطلاب والمعلمين الدخول، وللطلاب الجدد تقديم طلب تسجيل'
                    },
                    {
                      id: 'register_only' as ComplexPortalMode,
                      title: 'تقديم طلبات الانضمام فقط',
                      desc: 'مخصص لاستقبال الطلاب الجدد وحصر الراغبين في التسجيل'
                    },
                    {
                      id: 'login_only' as ComplexPortalMode,
                      title: 'تسجيل الدخول فقط',
                      desc: 'مخصص للمعلمين والطلاب المقيدين في هذا المجمع فقط'
                    }
                  ].map(item => {
                    const isSelected = portalMode === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setPortalMode(item.id)}
                        className={`p-3.5 rounded-2xl text-right transition-all cursor-pointer border-2 active:translate-y-0.5 flex flex-col justify-between gap-2 ${
                          isSelected ? 'border-b-4 shadow-md' : 'border-transparent hover:bg-white/5 text-slate-300'
                        }`}
                        style={
                          isSelected
                            ? {
                                backgroundColor: `${themeAccent}20`,
                                borderColor: themeAccent,
                                borderBottomColor: themeAccentShadow
                              }
                            : {
                                backgroundColor: theme.backgroundColor || '#131f24',
                                borderColor: themeCardBorder
                              }
                        }
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs font-black ${isSelected ? 'text-white' : ''}`}>
                            {item.title}
                          </span>
                          {isSelected && <Check className="w-4 h-4" style={{ color: themeAccent }} />}
                        </div>
                        <p className="text-[11px] text-slate-400 font-bold leading-relaxed">{item.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Questionnaire Customizer (إذا كان مسموح بالتسجيل) */}
              {portalMode !== 'login_only' && (
                <div className="space-y-3 pt-3 border-t border-white/10">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-black text-slate-200 block">
                      ٢. تحديد الأسئلة والحقول المطلوبة في استمارة التسجيل:
                    </label>
                    <span className="text-[11px] text-slate-300 font-bold">
                      يمكنك تفعيل أو إلغاء الحقول حسب حاجة المجمع
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label
                      className="p-3 rounded-2xl border-2 flex items-center justify-between gap-3 cursor-pointer select-none"
                      style={{
                        backgroundColor: theme.backgroundColor || '#131f24',
                        borderColor: themeCardBorder
                      }}
                    >
                      <div>
                        <span className="text-xs font-black text-white block">اسم الطالب كاملاً (سؤال مقالي)</span>
                        <span className="text-[10px] text-slate-400 font-bold">إلزام الطالب بكتابة اسمه رباعياً</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={studentNameRequired}
                        onChange={e => setStudentNameRequired(e.target.checked)}
                        className="w-4 h-4 accent-amber-400 cursor-pointer"
                      />
                    </label>

                    <label
                      className="p-3 rounded-2xl border-2 flex items-center justify-between gap-3 cursor-pointer select-none"
                      style={{
                        backgroundColor: theme.backgroundColor || '#131f24',
                        borderColor: themeCardBorder
                      }}
                    >
                      <div>
                        <span className="text-xs font-black text-white block">عمر الطالب (أرقام 0 - 100)</span>
                        <span className="text-[10px] text-slate-400 font-bold">محدد أرقام لاختيار سن الطالب</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={ageRequired}
                        onChange={e => setAgeRequired(e.target.checked)}
                        className="w-4 h-4 accent-amber-400 cursor-pointer"
                      />
                    </label>

                    <label
                      className="p-3 rounded-2xl border-2 flex items-center justify-between gap-3 cursor-pointer select-none"
                      style={{
                        backgroundColor: theme.backgroundColor || '#131f24',
                        borderColor: themeCardBorder
                      }}
                    >
                      <div>
                        <span className="text-xs font-black text-white block">رقم هاتف ولي الأمر (واتساب)</span>
                        <span className="text-[10px] text-slate-400 font-bold">للتواصل وتأكيد القبول</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={parentPhoneRequired}
                        onChange={e => setParentPhoneRequired(e.target.checked)}
                        className="w-4 h-4 accent-amber-400 cursor-pointer"
                      />
                    </label>

                    <label
                      className="p-3 rounded-2xl border-2 flex items-center justify-between gap-3 cursor-pointer select-none"
                      style={{
                        backgroundColor: theme.backgroundColor || '#131f24',
                        borderColor: themeCardBorder
                      }}
                    >
                      <div>
                        <span className="text-xs font-black text-white block">اسم ولي الأمر</span>
                        <span className="text-[10px] text-slate-400 font-bold">اسم الأب أو القائم على رعاية الطالب</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={parentNameRequired}
                        onChange={e => setParentNameRequired(e.target.checked)}
                        className="w-4 h-4 accent-amber-400 cursor-pointer"
                      />
                    </label>

                    <label
                      className="p-3 rounded-2xl border-2 flex items-center justify-between gap-3 cursor-pointer select-none"
                      style={{
                        backgroundColor: theme.backgroundColor || '#131f24',
                        borderColor: themeCardBorder
                      }}
                    >
                      <div>
                        <span className="text-xs font-black text-white block">أجزاء القرآن الكريم (شبكة الـ 30 جزءاً)</span>
                        <span className="text-[10px] text-slate-400 font-bold">خيارات تفاعلية لأجزاء القرآن الـ 30</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={memorizedJuzRequired}
                        onChange={e => setMemorizedJuzRequired(e.target.checked)}
                        className="w-4 h-4 accent-amber-400 cursor-pointer"
                      />
                    </label>

                    <label
                      className="p-3 rounded-2xl border-2 flex items-center justify-between gap-3 cursor-pointer select-none"
                      style={{
                        backgroundColor: theme.backgroundColor || '#131f24',
                        borderColor: themeCardBorder
                      }}
                    >
                      <div>
                        <span className="text-xs font-black text-white block">اختيار الحلقة المفضلة</span>
                        <span className="text-[10px] text-slate-400 font-bold">قائمة حلقات هذا المجمع</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={preferredHalaqahRequired}
                        onChange={e => setPreferredHalaqahRequired(e.target.checked)}
                        className="w-4 h-4 accent-amber-400 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Welcome Message text area */}
              <div className="space-y-1.5 pt-3 border-t border-white/10">
                <label className="text-xs font-black text-slate-200 block">
                  ٣. رسالة الترحيب التي تظهر للزوار في رأس البوابة:
                </label>
                <textarea
                  rows={2}
                  value={welcomeMessage}
                  onChange={e => setWelcomeMessage(e.target.value)}
                  placeholder={`أهلاً بكم في بوابة التسجيل والخدمات الإلكترونية لمجمع ${complex.name}...`}
                  className="w-full border-2 rounded-2xl py-2.5 px-3.5 text-xs text-white placeholder-slate-400 outline-none font-bold transition-all focus:border-amber-400 resize-none"
                  style={{
                    backgroundColor: theme.backgroundColor || '#131f24',
                    borderColor: themeCardBorder
                  }}
                />
              </div>

              {saveSuccessMsg && (
                <div className="p-3 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500/40 text-emerald-200 text-xs font-black flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleSavePortalConfig}
                disabled={isSavingConfig}
                className="w-full py-3.5 rounded-2xl border-2 border-b-4 text-xs sm:text-sm font-black flex items-center justify-center gap-2 cursor-pointer transition-all active:translate-y-0.5 hover:brightness-110 shadow-lg disabled:opacity-50"
                style={{
                  backgroundColor: themeAccent,
                  borderColor: themeAccent,
                  borderBottomColor: themeAccentShadow,
                  color: accentTextColor
                }}
              >
                <Check className="w-4 h-4" />
                <span>{isSavingConfig ? 'جارٍ حفظ الإعدادات...' : 'حفظ واعتماد إعدادات البوابة'}</span>
              </button>
            </div>
          )}

          {/* TAB 2: Incoming Applications Review */}
          {modalTab === 'applications' && (
            <div className="space-y-4">
              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row gap-2.5 justify-between sm:items-center">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={appSearch}
                    onChange={e => setAppSearch(e.target.value)}
                    placeholder="بحث برقم الطلب أو اسم الطالب أو هاتف ولي الأمر..."
                    className="w-full border-2 rounded-2xl py-2 px-3.5 pr-10 text-xs text-white placeholder-slate-400 outline-none font-bold"
                    style={{
                      backgroundColor: theme.backgroundColor || '#131f24',
                      borderColor: themeCardBorder
                    }}
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-2.5" />
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {(['all', 'pending', 'accepted', 'rejected'] as const).map(f => {
                    const labels = {
                      all: `الكل (${applications.length})`,
                      pending: `قيد المراجعة (${applications.filter(a => a.status === 'pending').length})`,
                      accepted: `مقبول (${applications.filter(a => a.status === 'accepted').length})`,
                      rejected: `مرفوض (${applications.filter(a => a.status === 'rejected').length})`
                    };
                    const isActive = appFilter === f;
                    return (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setAppFilter(f)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border-2 active:translate-y-0.5 ${
                          isActive ? 'border-b-4 shadow-sm' : 'border-transparent text-slate-300 hover:bg-white/5'
                        }`}
                        style={
                          isActive
                            ? {
                                backgroundColor: themeAccent,
                                borderColor: themeAccent,
                                borderBottomColor: themeAccentShadow,
                                color: accentTextColor
                              }
                            : {
                                backgroundColor: theme.backgroundColor || '#131f24',
                                borderColor: themeCardBorder
                              }
                        }
                      >
                        {labels[f]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Applications List */}
              {isLoadingApps ? (
                <div className="p-12 text-center text-xs font-bold text-slate-300">
                  <Clock className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400" />
                  <span>جارٍ جلب وتحديث طلبات الانضمام...</span>
                </div>
              ) : filteredApps.length === 0 ? (
                <div
                  className="p-10 rounded-2xl border-2 text-center space-y-2"
                  style={{
                    backgroundColor: theme.backgroundColor || '#131f24',
                    borderColor: themeCardBorder
                  }}
                >
                  <Users className="w-8 h-8 text-slate-400 mx-auto opacity-40" />
                  <h4 className="text-sm font-black text-white">لا توجد طلبات انضمام مطابقة</h4>
                  <p className="text-xs text-slate-400 font-bold">
                    عندما يقوم أي طالب بالتقديم عبر رابط البوابة، سيظهر طلبه هنا فوراً للمشرف لاعتماده أو الاعتذار له.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredApps.map(app => (
                    <div
                      key={app.id}
                      className="rounded-2xl border-2 border-b-4 p-4.5 space-y-3 shadow-md transition-all"
                      style={{
                        backgroundColor: theme.backgroundColor || '#131f24',
                        borderColor:
                          app.status === 'accepted'
                            ? '#58cc02'
                            : app.status === 'rejected'
                            ? '#ff4b4b'
                            : themeCardBorder,
                        borderBottomColor:
                          app.status === 'accepted'
                            ? '#46a302'
                            : app.status === 'rejected'
                            ? '#ea2b2b'
                            : themeCardShadow
                      }}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-black text-white">{app.studentName}</h4>
                            <span className="text-[11px] font-bold text-slate-300">({app.age} سنة)</span>
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-lg border font-mono font-black"
                              style={{
                                backgroundColor: `${themeAccent}15`,
                                borderColor: `${themeAccent}40`,
                                color: themeAccent
                              }}
                            >
                              {app.trackingCode}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-slate-300 font-bold flex-wrap">
                            <span>ولي الأمر: {app.parentName}</span>
                            <span>•</span>
                            <a
                              href={`https://wa.me/${app.parentPhone?.replace(/\D/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[#25D366] hover:underline"
                            >
                              <Phone className="w-3 h-3" />
                              <span dir="ltr">{app.parentPhone}</span>
                            </a>
                            <span>•</span>
                            <span>الحلقة المطلوبة: {app.preferredHalaqahName || 'توجيه تلقائي'}</span>
                          </div>
                        </div>

                        {/* Status Label & Action Buttons */}
                        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                          {app.status === 'pending' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setAppToAccept(app);
                                  setTargetHalaqahId(app.preferredHalaqahId || halaqahs[0]?.id || '');
                                }}
                                className="px-3 py-1.5 rounded-xl border-2 border-b-2 text-xs font-black bg-[#58cc02] text-white border-[#58cc02] active:translate-y-0.5 shadow-sm hover:brightness-110 cursor-pointer flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>قبول واعتماد</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setAppToReject(app)}
                                className="px-3 py-1.5 rounded-xl border-2 border-b-2 text-xs font-black bg-red-600/20 text-red-300 border-red-500/40 active:translate-y-0.5 hover:bg-red-600/30 cursor-pointer flex items-center gap-1"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>اعتذار</span>
                              </button>
                            </>
                          ) : app.status === 'accepted' ? (
                            <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#58cc02]/20 border border-[#58cc02] text-[#58cc02] text-xs font-black">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>مقبول في: {app.assignedHalaqahName}</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/20 border border-red-500 text-red-300 text-xs font-black">
                              <XCircle className="w-3.5 h-3.5" />
                              <span>مرفوض</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Memorized Juz Details Strip */}
                      {app.memorizedJuzList && app.memorizedJuzList.length > 0 && (
                        <div className="pt-2 border-t border-white/10 flex items-center gap-1.5 flex-wrap text-xs">
                          <span className="text-[11px] text-slate-300 font-bold">الأجزاء المحفوظة:</span>
                          {app.memorizedJuzList.map(jNum => (
                            <span
                              key={jNum}
                              className="px-2 py-0.5 rounded-lg border text-[10px] font-bold"
                              style={{
                                backgroundColor: themeCard,
                                borderColor: themeCardBorder,
                                color: themeAccent
                              }}
                            >
                              جزء {jNum}
                            </span>
                          ))}
                        </div>
                      )}

                      {app.notes && (
                        <p className="text-[11px] text-slate-400 font-bold bg-white/5 p-2 rounded-xl border border-white/5">
                          ملاحظات الطالب: {app.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Sub-Dialog: Confirm Accept & Assign Halaqah */}
        {appToAccept && (
          <div className="fixed inset-0 z-[10005] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div
              className="w-full max-w-md rounded-3xl border-2 border-b-4 p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-150"
              style={{
                backgroundColor: themeCard,
                borderColor: '#58cc02',
                borderBottomColor: '#46a302'
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#58cc02] text-white flex items-center justify-center font-black">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">قبول واعتماد الطالب في المجمع</h3>
                  <p className="text-xs text-slate-300 font-bold">إلحاق الطالب بحلقة وبدء مسيرته القرآنية</p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-slate-200 font-bold">
                <p>
                  أنت على وشك قبول الطالب: <strong className="text-white text-sm">{appToAccept.studentName}</strong>
                </p>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-200 block">
                    اختر الحلقة التي ترغب بإلحاق الطالب بها:
                  </label>
                  <select
                    value={targetHalaqahId}
                    onChange={e => setTargetHalaqahId(e.target.value)}
                    className="w-full border-2 rounded-xl py-2.5 px-3 text-xs font-black text-white outline-none cursor-pointer"
                    style={{
                      backgroundColor: theme.backgroundColor || '#131f24',
                      borderColor: themeCardBorder
                    }}
                  >
                    {halaqahs.map(h => (
                      <option key={h.id} value={h.id}>
                        {h.name} {h.primaryTeacherName ? `(المعلم: ${h.primaryTeacherName})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={isProcessingApp}
                  onClick={handleConfirmAcceptApplication}
                  className="flex-1 py-3 rounded-xl border-2 border-b-2 text-xs font-black bg-[#58cc02] text-white border-[#58cc02] cursor-pointer transition-all active:translate-y-0.5 hover:brightness-110 shadow-md"
                >
                  {isProcessingApp ? 'جارٍ الاعتماد وإنشاء السجل...' : 'تأكيد القبول وإنشاء الطالب'}
                </button>
                <button
                  type="button"
                  onClick={() => setAppToAccept(null)}
                  className="py-3 px-4 rounded-xl border-2 border-b-2 text-xs font-black text-slate-300 hover:text-white cursor-pointer"
                  style={{
                    backgroundColor: themeCard,
                    borderColor: themeCardBorder
                  }}
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Sub-Dialog: Confirm Reject */}
        {appToReject && (
          <div className="fixed inset-0 z-[10005] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div
              className="w-full max-w-md rounded-3xl border-2 border-b-4 p-6 space-y-5 shadow-2xl animate-in zoom-in-95 duration-150"
              style={{
                backgroundColor: themeCard,
                borderColor: '#ff4b4b',
                borderBottomColor: '#ea2b2b'
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-600 text-white flex items-center justify-center font-black">
                  <XCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">الاعتذار عن قبول الطالب</h3>
                  <p className="text-xs text-slate-300 font-bold">تحديد سبب الاعتذار ليظهر للطالب عند تفقد الطلب</p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-slate-200 font-bold">
                  سيتم تعيين حالة الطلب إلى <strong className="text-red-400">مرفوض</strong> للطالب:{' '}
                  <strong className="text-white">{appToReject.studentName}</strong>
                </p>

                <div className="space-y-1.5">
                  <label className="text-xs font-black text-slate-200 block">سبب الاعتذار:</label>
                  <input
                    type="text"
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    className="w-full border-2 rounded-xl py-2 px-3 text-xs text-white outline-none font-bold"
                    style={{
                      backgroundColor: theme.backgroundColor || '#131f24',
                      borderColor: themeCardBorder
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={isProcessingApp}
                  onClick={handleConfirmRejectApplication}
                  className="flex-1 py-3 rounded-xl border-2 border-b-2 text-xs font-black bg-red-600 text-white border-red-600 cursor-pointer transition-all active:translate-y-0.5 hover:brightness-110 shadow-md"
                >
                  {isProcessingApp ? 'جارٍ الحفظ...' : 'تأكيد الرفض'}
                </button>
                <button
                  type="button"
                  onClick={() => setAppToReject(null)}
                  className="py-3 px-4 rounded-xl border-2 border-b-2 text-xs font-black text-slate-300 hover:text-white cursor-pointer"
                  style={{
                    backgroundColor: themeCard,
                    borderColor: themeCardBorder
                  }}
                >
                  تراجع
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
