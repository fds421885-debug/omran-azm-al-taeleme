import React, { useState, useEffect, useMemo } from 'react';
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
  User,
  Search,
  BookOpen,
  Phone,
  Calendar,
  AlertCircle,
  Trash2,
  Sparkles,
  Link as LinkIcon,
  Plus,
  Edit3,
  ArrowUp,
  ArrowDown,
  HelpCircle,
  FileSpreadsheet,
  RefreshCw,
  Eye,
  Tag,
  ListFilter,
  CheckSquare,
  Layers,
  AlignLeft,
  Hash,
  List,
  RotateCcw,
  Lock,
  Timer,
  Mail,
  Key,
  Cloud,
  ShieldCheck,
  BrainCircuit,
  Award,
  Flame
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  QuranComplex,
  Halaqah,
  ComplexPortalConfig,
  ComplexPortalMode,
  StudentRegistrationApplication,
  RegistrationApplicationStatus,
  Student,
  TeacherAccount,
  PortalCustomQuestion,
  PortalQuestionType
} from '../../types';
import { OmranDataService } from '../../lib/firebase';
import { darkenHex, lightenHex, getContrastTextColor } from '../../lib/themeUtils';
import {
  buildApplicationAcceptedEmail,
  buildApplicationRejectedEmail,
  sendRealPortalEmail,
  loadSavedMailConfigFromCloud,
  SavedPortalMailConfig
} from '../../lib/portalEmailService';
import { QuickMailSetupModal } from './QuickMailSetupModal';
import { calculateRealisticKhatmTimeline, calculateStudentMemorizedJuz } from '../../lib/aiPlanService';
import { calculatePortionFromPace } from '../../data/quranPagesData';
import { toArabicNumerals } from '../quran/KingFahdQuranModal';

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

const QUESTION_TYPE_LABELS: Record<PortalQuestionType, { label: string; icon: string; desc: string }> = {
  text: { label: 'نص قصير', icon: 'Aa', desc: 'إجابة نصية من سطر واحد (مثل: المدرسة، الهواية)' },
  textarea: { label: 'نص مقالي وتفاصيل', icon: '¶', desc: 'نص متعدد الأسطر للتفاصيل والملاحظات' },
  number: { label: 'رقم / معدل', icon: '123', desc: 'أرقام عددية فقط (مثل: عدد الساعات، النسبة)' },
  select: { label: 'قائمة منسدلة', icon: '▼', desc: 'قائمة خيارات يختار منها خياراً واحداً' },
  radio: { label: 'اختيار فردي (أزرار)', icon: '◉', desc: 'خيارات متعددة يختار منها خياراً واحداً' },
  checkbox: { label: 'اختيار متعدد (مربعات)', icon: '☑', desc: 'خيارات متعددة يمكنه اختيار أكثر من خيار' },
  date: { label: 'تاريخ', icon: '📅', desc: 'محدد تاريخ ميلاد أو تاريخ بدء' },
  phone: { label: 'رقم هاتف بديل', icon: '📞', desc: 'حقل مخصص لأرقام الهواتف والتواصل' }
};

function toDatetimeLocalString(isoDateStr?: string | null): string {
  if (!isoDateStr) return '';
  const d = new Date(isoDateStr);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function fromDatetimeLocalString(localStr?: string): string | null {
  if (!localStr) return null;
  const d = new Date(localStr);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
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
      emailRequired: true,
      memorizedJuzRequired: true,
      preferredHalaqahRequired: true,
      notesAllowed: true,
      showHalaqahQuestion: false,
      halaqahQuestionLabel: 'الحلقة القرآنية المفضلة',
      halaqahSelectionMode: 'all',
      allowedHalaqahIds: [],
      allowAutoPlacement: true,
      customQuestions: []
    }
  };

  const [portalMode, setPortalMode] = useState<ComplexPortalMode>(initialConfig.portalMode || 'login_and_register');
  const [welcomeMessage, setWelcomeMessage] = useState(initialConfig.welcomeMessage || '');
  const [studentNameRequired, setStudentNameRequired] = useState(initialConfig.fieldConfig.studentNameRequired ?? true);
  const [ageRequired, setAgeRequired] = useState(initialConfig.fieldConfig.ageRequired ?? true);
  const [parentNameRequired, setParentNameRequired] = useState(initialConfig.fieldConfig.parentNameRequired ?? true);
  const [parentPhoneRequired, setParentPhoneRequired] = useState(initialConfig.fieldConfig.parentPhoneRequired ?? true);
  const [memorizedJuzRequired, setMemorizedJuzRequired] = useState(initialConfig.fieldConfig.memorizedJuzRequired ?? true);
  const [preferredHalaqahRequired, setPreferredHalaqahRequired] = useState(initialConfig.fieldConfig.preferredHalaqahRequired ?? true);
  const [notesAllowed, setNotesAllowed] = useState(initialConfig.fieldConfig.notesAllowed ?? true);

  // Registration Closing & Deadline Controls (100% Timezone-Accurate)
  const [registrationDeadline, setRegistrationDeadline] = useState<string>(
    toDatetimeLocalString(initialConfig.registrationDeadline)
  );
  const [isRegistrationClosedManually, setIsRegistrationClosedManually] = useState<boolean>(
    Boolean(initialConfig.isRegistrationClosedManually)
  );
  const [closedMessage, setClosedMessage] = useState<string>(
    initialConfig.closedMessage || 'عذراً، تم إغلاق باب التسجيل وتقديم الطلبات للفترة الحالية لاكتمال المقاعد المتاحة في حلقات المجمع.'
  );

  // Halaqah Question Advanced Control (Removed from registration form by request)
  const [showHalaqahQuestion, setShowHalaqahQuestion] = useState<boolean>(false);
  const [halaqahQuestionLabel, setHalaqahQuestionLabel] = useState<string>(
    initialConfig.fieldConfig.halaqahQuestionLabel || 'الحلقة القرآنية المفضلة'
  );
  const [halaqahSelectionMode, setHalaqahSelectionMode] = useState<'all' | 'specific'>(
    initialConfig.fieldConfig.halaqahSelectionMode || 'all'
  );
  const [allowedHalaqahIds, setAllowedHalaqahIds] = useState<string[]>(
    Array.isArray(initialConfig.fieldConfig.allowedHalaqahIds) ? initialConfig.fieldConfig.allowedHalaqahIds : []
  );
  const [allowAutoPlacement, setAllowAutoPlacement] = useState<boolean>(
    initialConfig.fieldConfig.allowAutoPlacement !== false
  );

  // Custom Questions List
  const [customQuestions, setCustomQuestions] = useState<PortalCustomQuestion[]>(() => {
    return Array.isArray(initialConfig.fieldConfig.customQuestions) ? initialConfig.fieldConfig.customQuestions : [];
  });

  // Modal / Editor State for Adding / Editing a Custom Question
  const [isQuestionEditorOpen, setIsQuestionEditorOpen] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [questionLabel, setQuestionLabel] = useState('');
  const [questionType, setQuestionType] = useState<PortalQuestionType>('text');
  const [questionDescription, setQuestionDescription] = useState('');
  const [questionPlaceholder, setQuestionPlaceholder] = useState('');
  const [questionRequired, setQuestionRequired] = useState(false);
  const [questionOptions, setQuestionOptions] = useState<string[]>([]);
  const [newOptionInput, setNewOptionInput] = useState('');

  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Applications State
  const [applications, setApplications] = useState<StudentRegistrationApplication[]>([]);
  const [isLoadingApps, setIsLoadingApps] = useState(false);
  const [isRefreshingApps, setIsRefreshingApps] = useState(false);
  const [lastRefreshedTime, setLastRefreshedTime] = useState<string>('مُحدّث');
  const [appFilter, setAppFilter] = useState<'all' | 'pending' | 'waiting' | 'accepted' | 'rejected'>('all');
  const [appSearch, setAppSearch] = useState('');
  const [selectedHalaqahFilter, setSelectedHalaqahFilter] = useState<string>('all');

  // Bulk Selection and Progress for Waiting List & Applications
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkProgressText, setBulkProgressText] = useState('');

  // Selected Application for Accept / Reject / View Details Modal
  const [appToAccept, setAppToAccept] = useState<StudentRegistrationApplication | null>(null);
  const [targetHalaqahId, setTargetHalaqahId] = useState<string>(halaqahs[0]?.id || '');
  const [appToReject, setAppToReject] = useState<StudentRegistrationApplication | null>(null);
  const [rejectionReason, setRejectionReason] = useState('نعتذر، اكتملت المقاعد المتاحة في هذه الفترة.');
  const [appDetailsToView, setAppDetailsToView] = useState<StudentRegistrationApplication | null>(null);
  const [appPlanToView, setAppPlanToView] = useState<StudentRegistrationApplication | null>(null);
  const [appDiagnosticToView, setAppDiagnosticToView] = useState<StudentRegistrationApplication | null>(null);
  const [appTranscriptToView, setAppTranscriptToView] = useState<StudentRegistrationApplication | null>(null);
  const [appPlanToEdit, setAppPlanToEdit] = useState<StudentRegistrationApplication | null>(null);
  const [editPlanNewFaces, setEditPlanNewFaces] = useState<number>(1);
  const [editPlanReviewFaces, setEditPlanReviewFaces] = useState<number>(3);
  const [editPlanPathType, setEditPlanPathType] = useState<string>('standard_memorization');
  const [editPlanHalaqahId, setEditPlanHalaqahId] = useState<string>('');
  const [appToDelete, setAppToDelete] = useState<StudentRegistrationApplication | null>(null);
  const [isProcessingApp, setIsProcessingApp] = useState(false);

  // Share link & Saved Cloud Mail state
  const [copiedLink, setCopiedLink] = useState(false);
  const [isMailModalOpen, setIsMailModalOpen] = useState(false);
  const [savedMailConfig, setSavedMailConfig] = useState<SavedPortalMailConfig | null>(() => {
    if (complex.mailConfig?.user && complex.mailConfig?.pass) {
      return {
        user: complex.mailConfig.user,
        pass: complex.mailConfig.pass,
        fromName: complex.mailConfig.fromName || `مجمع ${complex.name}`,
        fromEmail: complex.mailConfig.fromEmail || complex.mailConfig.user,
        updatedAt: complex.mailConfig.updatedAt
      };
    }
    return null;
  });

  useEffect(() => {
    let mounted = true;
    const syncMail = async () => {
      const cfg = await loadSavedMailConfigFromCloud(complex.id, complex);
      if (mounted && cfg?.user && cfg?.pass) {
        setSavedMailConfig(cfg);
      }
    };
    syncMail();
    const handleMailUpdated = () => {
      syncMail();
    };
    window.addEventListener('omran:mail-config-updated', handleMailUpdated);
    return () => {
      mounted = false;
      window.removeEventListener('omran:mail-config-updated', handleMailUpdated);
    };
  }, [complex.id]);

  // Compute direct registration link for this complex
  const portalUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname.replace(/\/+$/, '') || ''}/?complexPortal=${encodeURIComponent(complex.id)}&tab=register`
    : `?complexPortal=${encodeURIComponent(complex.id)}&tab=register`;

  // Load and sync all applications for this complex (merging previous and incoming)
  const refreshAllApps = async (isManualClick: boolean = false) => {
    if (isManualClick) setIsRefreshingApps(true);
    else setIsLoadingApps(true);
    try {
      const list = await OmranDataService.loadRegistrationApplications(complex.id);
      setApplications(list);
      setLastRefreshedTime(new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (e) {
      console.warn('Error loading applications:', e);
    } finally {
      setIsLoadingApps(false);
      setIsRefreshingApps(false);
    }
  };

  useEffect(() => {
    refreshAllApps();
    const unsub = OmranDataService.subscribeToRegistrationApplications(apps => {
      setApplications(apps);
      setLastRefreshedTime(new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }));
      setIsLoadingApps(false);
    }, complex.id);

    const handleAppsUpdated = () => {
      refreshAllApps();
    };

    const handleAppDeleted = (e: any) => {
      const deletedId = e.detail?.id;
      if (deletedId) {
        setApplications(prev => prev.filter(a => a.id !== deletedId));
      }
    };

    window.addEventListener('omran:students-updated', handleAppsUpdated);
    window.addEventListener('omran:apps-updated', handleAppsUpdated);
    window.addEventListener('omran:registration-application-deleted', handleAppDeleted);

    return () => {
      unsub();
      window.removeEventListener('omran:students-updated', handleAppsUpdated);
      window.removeEventListener('omran:apps-updated', handleAppsUpdated);
      window.removeEventListener('omran:registration-application-deleted', handleAppDeleted);
    };
  }, [complex.id]);

  // Open Question Editor for New Question
  const handleOpenAddQuestion = () => {
    setEditingQuestionId(null);
    setQuestionLabel('');
    setQuestionType('text');
    setQuestionDescription('');
    setQuestionPlaceholder('');
    setQuestionRequired(false);
    setQuestionOptions(['الخيار الأول', 'الخيار الثاني']);
    setNewOptionInput('');
    setIsQuestionEditorOpen(true);
  };

  // Open Question Editor to Edit an Existing Question
  const handleOpenEditQuestion = (q: PortalCustomQuestion) => {
    setEditingQuestionId(q.id);
    setQuestionLabel(q.label);
    setQuestionType(q.type);
    setQuestionDescription(q.description || '');
    setQuestionPlaceholder(q.placeholder || '');
    setQuestionRequired(q.required);
    setQuestionOptions(Array.isArray(q.options) && q.options.length > 0 ? q.options : ['الخيار الأول', 'الخيار الثاني']);
    setNewOptionInput('');
    setIsQuestionEditorOpen(true);
  };

  // Add Option to choice-based questions
  const handleAddOption = () => {
    const trimmed = newOptionInput.trim();
    if (!trimmed) return;
    if (questionOptions.includes(trimmed)) return;
    setQuestionOptions(prev => [...prev, trimmed]);
    setNewOptionInput('');
  };

  // Remove Option
  const handleRemoveOption = (optToRemove: string) => {
    setQuestionOptions(prev => prev.filter(o => o !== optToRemove));
  };

  // Save Custom Question from Editor
  const handleSaveQuestion = () => {
    const trimmedLabel = questionLabel.trim();
    if (!trimmedLabel) return;

    const needsOptions = questionType === 'select' || questionType === 'radio' || questionType === 'checkbox';
    const finalOptions = needsOptions
      ? questionOptions.filter(o => o.trim().length > 0)
      : undefined;

    if (needsOptions && (!finalOptions || finalOptions.length === 0)) {
      alert('يرجى إضافة خيارين على الأقل لهذا النوع من الأسئلة.');
      return;
    }

    if (editingQuestionId) {
      // Update existing
      setCustomQuestions(prev =>
        prev.map(q =>
          q.id === editingQuestionId
            ? {
                ...q,
                label: trimmedLabel,
                type: questionType,
                description: questionDescription.trim() || undefined,
                placeholder: questionPlaceholder.trim() || undefined,
                required: questionRequired,
                options: finalOptions
              }
            : q
        )
      );
    } else {
      // Add new
      const newQuestion: PortalCustomQuestion = {
        id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        label: trimmedLabel,
        type: questionType,
        description: questionDescription.trim() || undefined,
        placeholder: questionPlaceholder.trim() || undefined,
        required: questionRequired,
        options: finalOptions,
        order: customQuestions.length,
        isEnabled: true
      };
      setCustomQuestions(prev => [...prev, newQuestion]);
    }

    setIsQuestionEditorOpen(false);
  };

  // Delete Custom Question
  const handleDeleteQuestion = (qId: string) => {
    setCustomQuestions(prev => prev.filter(q => q.id !== qId));
  };

  // Toggle Custom Question Enabled/Disabled
  const handleToggleQuestionEnabled = (qId: string) => {
    setCustomQuestions(prev =>
      prev.map(q => (q.id === qId ? { ...q, isEnabled: q.isEnabled === false ? true : false } : q))
    );
  };

  // Move Question Up / Down
  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= customQuestions.length) return;
    const updated = [...customQuestions];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setCustomQuestions(updated);
  };

  // Toggle Allowed Halaqah in Specific Mode
  const handleToggleHalaqahAllowed = (hId: string) => {
    setAllowedHalaqahIds(prev =>
      prev.includes(hId) ? prev.filter(id => id !== hId) : [...prev, hId]
    );
  };

  // Save Entire Portal Configuration
  const handleSavePortalConfig = async () => {
    setIsSavingConfig(true);
    setSaveSuccessMsg(null);
    try {
      const updatedConfig: ComplexPortalConfig = {
        isEnabled: true,
        portalMode,
        portalTitle: `بوابة ${complex.name}`,
        welcomeMessage,
        registrationDeadline: fromDatetimeLocalString(registrationDeadline),
        isRegistrationClosedManually,
        closedMessage: closedMessage.trim(),
        fieldConfig: {
          studentNameRequired,
          ageRequired,
          parentNameRequired,
          parentPhoneRequired,
          emailRequired: true,
          memorizedJuzRequired,
          preferredHalaqahRequired,
          notesAllowed,
          showHalaqahQuestion: false,
          halaqahQuestionLabel: halaqahQuestionLabel.trim() || 'الحلقة القرآنية المفضلة',
          halaqahSelectionMode,
          allowedHalaqahIds: halaqahSelectionMode === 'specific' ? allowedHalaqahIds : [],
          allowAutoPlacement,
          customQuestions
        },
        updatedAt: new Date().toISOString()
      };

      const updatedComplex: QuranComplex = {
        ...complex,
        portalConfig: updatedConfig,
        mailConfig: savedMailConfig
          ? {
              user: savedMailConfig.user,
              pass: savedMailConfig.pass,
              fromName: savedMailConfig.fromName || `مجمع ${complex.name}`,
              fromEmail: savedMailConfig.fromEmail || savedMailConfig.user,
              isConfigured: true,
              updatedAt: savedMailConfig.updatedAt || new Date().toISOString()
            }
          : complex.mailConfig
      };

      await OmranDataService.saveComplex(updatedComplex);
      await onUpdateComplex(updatedComplex);
      setSaveSuccessMsg('تم حفظ وتحديث إعدادات البوابة والأسئلة بنجاح!');
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch {
      // Gracefully silent
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Copy Link directly and immediately
  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(portalUrl).then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      }).catch(() => {
        // Fallback for older browsers
        try {
          const textArea = document.createElement('textarea');
          textArea.value = portalUrl;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 2500);
        } catch {
          // Gracefully silent
        }
      });
    }
  };

  // Share via WhatsApp directly
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

      const maxJuz = appToAccept.memorizedJuzList && appToAccept.memorizedJuzList.length > 0
        ? Math.max(...appToAccept.memorizedJuzList)
        : 30;

      // Extract custom answers summary into student notes if present
      const customNotesSummary = appToAccept.customQuestionResponses && appToAccept.customQuestionResponses.length > 0
        ? ` • إجابات التسجيل: ${appToAccept.customQuestionResponses.map(r => `${r.questionLabel}: ${Array.isArray(r.answer) ? r.answer.join(', ') : r.answer}`).join(' | ')}`
        : '';

      const startSurah = maxJuz === 30 ? 78 : 2;
      const initialPortion = calculatePortionFromPace(startSurah, 1, 0.5);
      const memJuzCount = Math.min(30, Math.max(0, maxJuz));
      const timeline = calculateRealisticKhatmTimeline({
        memorizedJuz: memJuzCount,
        consolidatedJuz: Math.max(0, memJuzCount > 2 ? memJuzCount - 2 : 0),
        dailyNewPages: 0.5,
        dailyReviewPages: 3,
        weeklyDaysCount: 5,
        dailyHoursCount: 2
      });

      const newStudent: Student = {
        id: newStudentId,
        name: appToAccept.studentName,
        password: '123',
        phone: appToAccept.parentPhone || '0500000000',
        age: appToAccept.age || 10,
        parentName: appToAccept.parentName || 'ولي الأمر',
        parentPhones: [appToAccept.parentPhone].filter(Boolean),
        parentPhone: appToAccept.parentPhone,
        currentSurah: startSurah,
        currentSurahName: maxJuz === 30 ? 'النبأ' : 'البقرة',
        currentAyah: 1,
        dailyNewTarget: 'نصف وجه',
        dailyReviewTarget: 'ربع جزء',
        level: 'متوسط',
        complexId: complex.id,
        complexName: complex.name,
        halaqahId: targetHalaqah?.id,
        halaqahName: targetHalaqah?.name,
        notes: `تم قبوله عبر بوابة المجمع الإلكترونية • الأجزاء المحفوظة: ${appToAccept.memorizedJuzList?.join(', ') || 'لا يوجد'}${customNotesSummary}`,
        isGeneratingPlan: true,
        memorizationPlan: {
          dailyNewPages: 0.5,
          dailyReviewPages: 3,
          consolidatedJuzCount: 0,
          memorizedJuzCount: maxJuz === 30 ? 1 : 0,
          targetJuz: 30,
          targetCompletionDate: timeline.targetCompletionDate,
          estimatedDaysRemaining: timeline.estimatedDaysRemaining,
          progressPercentage: timeline.progressPercentage,
          status: 'on_track',
          weeklyDaysCount: 5,
          dailyHoursCount: 2,
          tathbeetStopsCount: timeline.tathbeetStopsCount,
          milestones: timeline.milestones,
          nextDayAssignment: {
            newMemorization: initialPortion.description,
            review: 'الفاتحة وتثبيت الحفظ',
            action: 'advance_page',
            reason: 'خطة تأسيسية منهجية متقنة بمعدل نصف وجه',
            surahNumber: initialPortion.fromSurah,
            fromAyah: initialPortion.fromAyah,
            toSurahNumber: initialPortion.toSurah,
            toAyah: initialPortion.toAyah
          },
          lastUpdated: new Date().toISOString()
        },
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
        studentAcceptanceStatus: 'pending_student_confirmation',
        reviewedAt: new Date().toISOString(),
        reviewedByName: complex.supervisorTeacherName || 'مشرف المجمع'
      };

      await OmranDataService.saveRegistrationApplication(updatedApp);
      setApplications(prev => prev.map(a => (a.id === updatedApp.id ? updatedApp : a)));

      // 3. Dispatch Real Acceptance Email to Student's personal inbox
      if (updatedApp.email) {
        const acceptedEmail = buildApplicationAcceptedEmail(
          complex,
          updatedApp,
          targetHalaqah?.name || 'الحلقة القرآنية',
          portalUrl
        );
        sendRealPortalEmail(acceptedEmail).catch(err => console.warn('Could not send acceptance email:', err));
      }

      setAppToAccept(null);
    } catch {
      // Gracefully silent
    } finally {
      setIsProcessingApp(false);
    }
  };

  // Reject an application
  const handleConfirmRejectApplication = async () => {
    if (!appToReject) return;
    setIsProcessingApp(true);
    try {
      const finalReason = rejectionReason.trim() || 'نعتذر، اكتملت المقاعد المتاحة في هذه الفترة.';
      const updatedApp: StudentRegistrationApplication = {
        ...appToReject,
        status: 'rejected',
        rejectionReason: finalReason,
        reviewedAt: new Date().toISOString(),
        reviewedByName: complex.supervisorTeacherName || 'مشرف المجمع'
      };

      await OmranDataService.saveRegistrationApplication(updatedApp);
      setApplications(prev => prev.map(a => (a.id === updatedApp.id ? updatedApp : a)));

      // Dispatch real polite rejection email to student's inbox if email exists
      if (updatedApp.email) {
        const rejectedEmail = buildApplicationRejectedEmail(
          complex,
          updatedApp,
          finalReason,
          portalUrl
        );
        sendRealPortalEmail(rejectedEmail).catch(err => console.warn('Could not send rejection email:', err));
      }

      setAppToReject(null);
    } catch {
      // Gracefully silent
    } finally {
      setIsProcessingApp(false);
    }
  };

  // Permanently Delete Application
  const handleConfirmDeleteApp = async () => {
    if (!appToDelete) return;
    setIsProcessingApp(true);
    try {
      await OmranDataService.deleteRegistrationApplication(appToDelete.id);
      setApplications(prev => prev.filter(a => a.id !== appToDelete.id));
      setAppToDelete(null);
      if (appDetailsToView?.id === appToDelete.id) {
        setAppDetailsToView(null);
      }
    } catch {
      // Gracefully silent
    } finally {
      setIsProcessingApp(false);
    }
  };

  // Accept a single application as an extra student beyond capacity
  const handleAcceptSingleAsExtra = async (app: StudentRegistrationApplication, specificHalaqahId?: string) => {
    setIsBulkProcessing(true);
    setBulkProgressText(`جارٍ قبول الطالب (${app.studentName}) كطالب إضافي وتوليد حسابه وإرسال بريد القبول...`);
    try {
      const hId = specificHalaqahId || app.preferredHalaqahId || halaqahs[0]?.id || '';
      const targetHalaqah = halaqahs.find(h => h.id === hId) || halaqahs[0];
      const newStudentId = `std_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const maxJuz = app.memorizedJuzList && app.memorizedJuzList.length > 0
        ? Math.max(...app.memorizedJuzList)
        : 30;

      const newStudent: Student = {
        id: newStudentId,
        name: app.studentName,
        password: '123',
        phone: app.parentPhone || '0500000000',
        age: app.age || 10,
        parentName: app.parentName || 'ولي الأمر',
        parentPhones: [app.parentPhone].filter(Boolean),
        parentPhone: app.parentPhone,
        currentSurah: maxJuz === 30 ? 78 : 2,
        currentSurahName: maxJuz === 30 ? 'النبأ' : 'البقرة',
        currentAyah: 1,
        dailyNewTarget: 'نصف وجه',
        dailyReviewTarget: 'ربع جزء',
        level: 'متوسط',
        isExtraStudent: true,
        complexId: complex.id,
        complexName: complex.name,
        halaqahId: targetHalaqah?.id,
        halaqahName: targetHalaqah?.name,
        notes: `تم قبوله كطالب إضافي زائد عن السعة الاستيعابية • الأجزاء المحفوظة: ${app.memorizedJuzList?.join(', ') || 'لا يوجد'}`,
        createdAt: new Date().toISOString()
      };

      await OmranDataService.saveStudent(newStudent);
      if (onStudentCreatedFromApp) onStudentCreatedFromApp(newStudent);

      try {
        window.dispatchEvent(new CustomEvent('omran:students-updated', { detail: newStudent }));
        window.dispatchEvent(new CustomEvent('omran:apps-updated'));
      } catch (e) {}

      const updatedApp: StudentRegistrationApplication = {
        ...app,
        status: 'accepted',
        isExtraStudent: true,
        assignedHalaqahId: targetHalaqah?.id,
        assignedHalaqahName: targetHalaqah?.name,
        createdStudentId: newStudentId,
        studentAcceptanceStatus: 'pending_student_confirmation',
        reviewedAt: new Date().toISOString(),
        reviewedByName: `${complex.supervisorTeacherName || 'مشرف المجمع'} (قبول إضافي)`
      };

      await OmranDataService.saveRegistrationApplication(updatedApp);
      setApplications(prev => prev.map(a => (a.id === updatedApp.id ? updatedApp : a)));

      if (updatedApp.email) {
        const acceptedEmail = buildApplicationAcceptedEmail(
          complex,
          updatedApp,
          targetHalaqah?.name || 'الحلقة القرآنية',
          portalUrl
        );
        await sendRealPortalEmail(acceptedEmail).catch(() => {});
      }
    } catch {
      // Gracefully silent
    } finally {
      setIsBulkProcessing(false);
      setBulkProgressText('');
    }
  };

  // Bulk accept selected applications as extra students
  const handleBulkAcceptSelectedAsExtra = async () => {
    if (selectedAppIds.length === 0) return;
    setIsBulkProcessing(true);
    const targetApps = applications.filter(a => selectedAppIds.includes(a.id));
    const total = targetApps.length;

    try {
      for (let i = 0; i < total; i++) {
        const app = targetApps[i];
        setBulkProgressText(`جارٍ قبول وتسكين الطالب (${app.studentName}) كطالب إضافي وإرسال بريد القبول (${i + 1} من ${total})...`);

        const hId = app.preferredHalaqahId || halaqahs[0]?.id || '';
        const targetHalaqah = halaqahs.find(h => h.id === hId) || halaqahs[0];
        const newStudentId = `std_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`;
        const maxJuz = app.memorizedJuzList && app.memorizedJuzList.length > 0 ? Math.max(...app.memorizedJuzList) : 30;

        const newStudent: Student = {
          id: newStudentId,
          name: app.studentName,
          password: '123',
          phone: app.parentPhone || '0500000000',
          age: app.age || 10,
          parentName: app.parentName || 'ولي الأمر',
          parentPhones: [app.parentPhone].filter(Boolean),
          parentPhone: app.parentPhone,
          currentSurah: maxJuz === 30 ? 78 : 2,
          currentSurahName: maxJuz === 30 ? 'النبأ' : 'البقرة',
          currentAyah: 1,
          dailyNewTarget: 'نصف وجه',
          dailyReviewTarget: 'ربع جزء',
          level: 'متوسط',
          isExtraStudent: true,
          complexId: complex.id,
          complexName: complex.name,
          halaqahId: targetHalaqah?.id,
          halaqahName: targetHalaqah?.name,
          notes: `تم قبوله كطالب إضافي زائد عن السعة الاستيعابية • الأجزاء المحفوظة: ${app.memorizedJuzList?.join(', ') || 'لا يوجد'}`,
          createdAt: new Date().toISOString()
        };

        await OmranDataService.saveStudent(newStudent);
        if (onStudentCreatedFromApp) onStudentCreatedFromApp(newStudent);
        try {
          window.dispatchEvent(new CustomEvent('omran:students-updated', { detail: newStudent }));
        } catch (e) {}

        const updatedApp: StudentRegistrationApplication = {
          ...app,
          status: 'accepted',
          isExtraStudent: true,
          assignedHalaqahId: targetHalaqah?.id,
          assignedHalaqahName: targetHalaqah?.name,
          createdStudentId: newStudentId,
          studentAcceptanceStatus: 'pending_student_confirmation',
          reviewedAt: new Date().toISOString(),
          reviewedByName: `${complex.supervisorTeacherName || 'مشرف المجمع'} (اعتماد إضافي جماعي)`
        };

        await OmranDataService.saveRegistrationApplication(updatedApp);
        setApplications(prev => prev.map(a => (a.id === updatedApp.id ? updatedApp : a)));

        if (updatedApp.email) {
          const acceptedEmail = buildApplicationAcceptedEmail(
            complex,
            updatedApp,
            targetHalaqah?.name || 'الحلقة القرآنية',
            portalUrl
          );
          await sendRealPortalEmail(acceptedEmail).catch(() => {});
        }
      }

      try {
        window.dispatchEvent(new CustomEvent('omran:apps-updated'));
      } catch (e) {}

      setSelectedAppIds([]);
    } catch {
      // Gracefully silent
    } finally {
      setIsBulkProcessing(false);
      setBulkProgressText('');
    }
  };

  // Bulk reject selected applications
  const handleBulkRejectSelected = async () => {
    if (selectedAppIds.length === 0) return;

    setIsBulkProcessing(true);
    const targetApps = applications.filter(a => selectedAppIds.includes(a.id));
    const total = targetApps.length;

    try {
      for (let i = 0; i < total; i++) {
        const app = targetApps[i];
        setBulkProgressText(`جارٍ تحديث وإرسال إشعار الاعتذار للطلب (${i + 1} من ${total})...`);

        const reason = 'نعتذر عن عدم توفر شاغر في الفترة الحالية لاكتمال السعة الاستيعابية.';
        const updatedApp: StudentRegistrationApplication = {
          ...app,
          status: 'rejected',
          rejectionReason: reason,
          reviewedAt: new Date().toISOString(),
          reviewedByName: complex.supervisorTeacherName || 'مشرف المجمع'
        };

        await OmranDataService.saveRegistrationApplication(updatedApp);
        setApplications(prev => prev.map(a => (a.id === updatedApp.id ? updatedApp : a)));

        if (updatedApp.email) {
          const rejectedEmail = buildApplicationRejectedEmail(
            complex,
            updatedApp,
            reason,
            portalUrl
          );
          sendRealPortalEmail(rejectedEmail).catch(() => {});
        }
      }

      setSelectedAppIds([]);
    } catch {
      // Gracefully silent
    } finally {
      setIsBulkProcessing(false);
      setBulkProgressText('');
    }
  };

  // Bulk delete selected applications permanently
  const handleBulkDeleteSelected = async () => {
    if (selectedAppIds.length === 0) return;

    setIsBulkProcessing(true);
    const targetApps = applications.filter(a => selectedAppIds.includes(a.id));
    const total = targetApps.length;

    try {
      for (let i = 0; i < total; i++) {
        const app = targetApps[i];
        setBulkProgressText(`جارٍ الحذف النهائي للطلب (${i + 1} من ${total})...`);
        await OmranDataService.deleteRegistrationApplication(app.id);
      }
      setApplications(prev => prev.filter(a => !selectedAppIds.includes(a.id)));
      setSelectedAppIds([]);
    } catch {
      // Gracefully silent
    } finally {
      setIsBulkProcessing(false);
      setBulkProgressText('');
    }
  };

  // Filtered applications across all historical and current requests
  const filteredApps = useMemo(() => {
    return applications.filter(a => {
      // 1. Status Filter
      if (appFilter !== 'all' && a.status !== appFilter) return false;

      // 2. Halaqah Filter
      if (selectedHalaqahFilter !== 'all') {
        const matchesPref = a.preferredHalaqahId === selectedHalaqahFilter;
        const matchesAssigned = a.assignedHalaqahId === selectedHalaqahFilter;
        if (!matchesPref && !matchesAssigned) return false;
      }

      // 3. Search query across all fields and custom responses
      if (appSearch.trim()) {
        const q = appSearch.trim().toLowerCase();
        const matchesName = a.studentName?.toLowerCase().includes(q);
        const matchesCode = a.trackingCode?.toLowerCase().includes(q);
        const matchesPhone = a.parentPhone?.includes(q);
        const matchesParent = a.parentName?.toLowerCase().includes(q);
        const matchesHalaqah = a.preferredHalaqahName?.toLowerCase().includes(q) || a.assignedHalaqahName?.toLowerCase().includes(q);
        const matchesCustom = a.customQuestionResponses?.some(r =>
          String(r.answer).toLowerCase().includes(q) || r.questionLabel.toLowerCase().includes(q)
        );
        return Boolean(matchesName || matchesCode || matchesPhone || matchesParent || matchesHalaqah || matchesCustom);
      }
      return true;
    });
  }, [applications, appFilter, selectedHalaqahFilter, appSearch]);

  const pendingCount = applications.filter(a => a.status === 'pending').length;
  const acceptedCount = applications.filter(a => a.status === 'accepted').length;
  const rejectedCount = applications.filter(a => a.status === 'rejected').length;

  // Export Applications to Excel
  const handleExportToExcel = () => {
    if (applications.length === 0) {
      alert('لا توجد طلبات لتصديرها.');
      return;
    }

    const rows = filteredApps.map((a, idx) => {
      const rowData: Record<string, any> = {
        '#': idx + 1,
        'رقم المتابعة': a.trackingCode,
        'اسم الطالب': a.studentName,
        'العمر': a.age,
        'اسم ولي الأمر': a.parentName,
        'هاتف ولي الأمر': a.parentPhone,
        'الحالة': a.status === 'accepted' ? 'مقبول' : a.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة',
        'الحلقة المرغوبة': a.preferredHalaqahName || 'توجيه تلقائي',
        'الحلقة المعتمدة': a.assignedHalaqahName || '-',
        'الأجزاء المحفوظة': a.memorizedJuzList?.join(', ') || 'لم يحدد',
        'تاريخ التقديم': a.appliedAt ? new Date(a.appliedAt).toLocaleDateString('ar-SA') : '-',
        'تاريخ المراجعة': a.reviewedAt ? new Date(a.reviewedAt).toLocaleDateString('ar-SA') : '-',
        'المراجع': a.reviewedByName || '-',
        'سبب الاعتذار': a.rejectionReason || '-'
      };

      // Add Custom Questions as dynamic columns
      if (a.customQuestionResponses && a.customQuestionResponses.length > 0) {
        a.customQuestionResponses.forEach(r => {
          rowData[`[سؤال] ${r.questionLabel}`] = Array.isArray(r.answer) ? r.answer.join(', ') : r.answer;
        });
      }

      return rowData;
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'طلبات الانضمام');
    XLSX.writeFile(workbook, `طلبات_انضمام_${complex.name.replace(/\s+/g, '_')}_${Date.now()}.xlsx`);
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-2.5 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto"
    >
      <div
        className="relative w-full max-w-4xl rounded-[32px] border-2 border-b-4 shadow-2xl overflow-hidden flex flex-col max-h-[94vh] my-auto animate-in zoom-in-95 duration-200"
        style={{
          backgroundColor: themeCard,
          borderColor: themeCardBorder,
          borderBottomColor: themeCardShadow
        }}
      >
        {/* Pinned Header */}
        <div
          className="p-4 sm:p-5 border-b-2 flex items-center justify-between gap-4 shrink-0"
          style={{
            backgroundColor: `${themeCard}f2`,
            borderColor: themeCardBorder
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl border-2 border-b-4 flex items-center justify-center shadow-md font-black shrink-0"
              style={{
                backgroundColor: `${themeAccent}25`,
                borderColor: themeAccent,
                borderBottomColor: themeAccentShadow,
                color: themeAccent
              }}
            >
              <LinkIcon className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.3]" />
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
                <span className="text-xs text-slate-300">منظومة عُمْرَان</span>
              </div>
              <h2 className="text-base sm:text-xl font-black font-heading text-white truncate max-w-md">
                إدارة استمارة التسجيل وطلبات الانضمام • {complex.name}
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
            <span>رابط البوابة وتصميم الأسئلة ({customQuestions.length + 6})</span>
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
            <span>مراجعة طلبات الانضمام ({applications.length})</span>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-900 shadow-sm animate-pulse">
                {pendingCount} جديدة
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsMailModalOpen(true)}
            className="py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer border-2 border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20 active:translate-y-0.5 shrink-0"
            title="تهيئة خدمة البريد الإلكتروني الفعلي (SMTP) للمجمع"
          >
            <Mail className="w-4 h-4 text-amber-300" />
            <span className="hidden sm:inline">خدمة البريد (SMTP)</span>
            <span className="sm:hidden">البريد</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* TAB 1: Link & Questionnaire Config */}
          {modalTab === 'link_and_config' && (
            <div className="space-y-6">
              {/* Shareable Link Box */}
              <div
                className="rounded-2xl border-2 border-b-4 p-4 sm:p-5 space-y-3 shadow-md"
                style={{
                  backgroundColor: theme.backgroundColor || '#131f24',
                  borderColor: themeAccent,
                  borderBottomColor: themeAccentShadow
                }}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4" style={{ color: themeAccent }} />
                    <h3 className="text-sm font-black text-white">الرابط المباشر لبوابة واستمارة تسجيل {complex.name}:</h3>
                  </div>
                  <span className="text-[11px] text-slate-300 font-bold">
                    ينقل الزوار مباشرة لاستمارة التسجيل الخاصة بهذا المجمع
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

                  <button
                    type="button"
                    onClick={() => window.open(portalUrl, '_blank')}
                    className="p-2.5 rounded-xl border-2 border-b-2 text-slate-300 hover:text-white transition-all cursor-pointer shrink-0"
                    style={{
                      backgroundColor: themeCard,
                      borderColor: themeCardBorder
                    }}
                    title="معاينة وفتح البوابة في نافذة جديدة"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>

                {/* Permanent Cloud Mail & Key Card for the Complex Link */}
                <div
                  className="mt-3 p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  style={{
                    backgroundColor: savedMailConfig?.user && savedMailConfig?.pass ? 'rgba(16,185,129,0.10)' : 'rgba(245,158,11,0.10)',
                    borderColor: savedMailConfig?.user && savedMailConfig?.pass ? 'rgba(16,185,129,0.35)' : 'rgba(245,158,11,0.35)'
                  }}
                >
                  <div className="flex items-start sm:items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        savedMailConfig?.user && savedMailConfig?.pass
                          ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                          : 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                      }`}
                    >
                      <Mail className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-black text-white">
                          بريد ومفتاح إرسال رموز التحقق والقبول لرابط المجمع
                        </span>
                        {savedMailConfig?.user && savedMailConfig?.pass ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            <Cloud className="w-3 h-3" />
                            <span>محفوظ وفعال في النظام السحابي ✓</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            <span>غير مربوط بعد</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-300 font-bold">
                        {savedMailConfig?.user && savedMailConfig?.pass ? (
                          <>
                            البريد المربوط: <span className="font-mono text-emerald-300" dir="ltr">{savedMailConfig.user}</span> • مفتاح التطبيقات (16 حرفاً) محفوظ ويعمل تلقائياً عند دخول أي طالب لرابط المجمع.
                          </>
                        ) : (
                          'أدخل بريد Gmail ومفتاح التطبيقات المكون من 16 حرفاً مرة واحدة ليُحفظ للأبد مع رابط تسجيل دخول المجمع.'
                        )}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsMailModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl border-2 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 hover:brightness-110"
                    style={{
                      backgroundColor: themeCard,
                      borderColor: themeAccent,
                      color: themeAccent
                    }}
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>
                      {savedMailConfig?.user && savedMailConfig?.pass
                        ? 'عرض أو تعديل البريد والمفتاح'
                        : 'إعداد وحفظ البريد والمفتاح للأبد'}
                    </span>
                  </button>
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

              {/* 2. Registration Closing & Schedule Card */}
              {portalMode !== 'login_only' && (
                <div
                  className="p-4 sm:p-5 rounded-2xl border-2 border-b-4 space-y-4 shadow-md"
                  style={{
                    backgroundColor: theme.backgroundColor || '#131f24',
                    borderColor: isRegistrationClosedManually ? '#ef4444' : registrationDeadline ? themeAccent : themeCardBorder,
                    borderBottomColor: isRegistrationClosedManually ? '#b91c1c' : registrationDeadline ? themeAccentShadow : themeCardShadow
                  }}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center font-black shrink-0"
                        style={{
                          backgroundColor: isRegistrationClosedManually ? '#ef444425' : `${themeAccent}25`,
                          color: isRegistrationClosedManually ? '#ef4444' : themeAccent
                        }}
                      >
                        <Timer className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-black text-white">توقيت إغلاق التسجيل وقفل الرابط</h4>
                          {isRegistrationClosedManually ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 font-black">
                              مغلق يدوياً حالياً ⛔
                            </span>
                          ) : registrationDeadline && new Date() > new Date(registrationDeadline) ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 font-black">
                              منتهي ومغلق تلقائياً ⛔
                            </span>
                          ) : registrationDeadline ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 font-black">
                              مؤقت للإغلاق ⏳
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black">
                              مفتوح دائماً 🟢
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-300 font-bold">
                          تحديد موعد زمني لإغلاق رابط التسجيل تلقائياً أو إيقاف استقبال الطلبات يدوياً
                        </p>
                      </div>
                    </div>

                    {/* Manual immediate toggle */}
                    <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors">
                      <span className="text-xs font-black text-white">
                        {isRegistrationClosedManually ? 'إغلاق فوري مفعل (الرابط مقفل)' : 'إغلاق فوري للرابط الآن'}
                      </span>
                      <input
                        type="checkbox"
                        checked={isRegistrationClosedManually}
                        onChange={e => setIsRegistrationClosedManually(e.target.checked)}
                        className="w-4 h-4 accent-red-500 cursor-pointer"
                      />
                    </label>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-white/10">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-200 block">
                          تاريخ وتوقيت الإغلاق التلقائي للرابط:
                        </label>
                        <input
                          type="datetime-local"
                          value={registrationDeadline}
                          onChange={e => setRegistrationDeadline(e.target.value)}
                          className="w-full border-2 rounded-xl py-2 px-3 text-xs text-white font-bold outline-none"
                          style={{
                            backgroundColor: themeCard,
                            borderColor: themeCardBorder
                          }}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-200 block">
                          محددات زمنية سريعة:
                        </label>
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              const d = new Date(Date.now() + 24 * 3600 * 1000);
                              setRegistrationDeadline(d.toISOString().substring(0, 16));
                            }}
                            className="px-2.5 py-1 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-[11px] font-bold text-slate-200 cursor-pointer"
                          >
                            بعد 24 ساعة
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const d = new Date(Date.now() + 3 * 24 * 3600 * 1000);
                              setRegistrationDeadline(d.toISOString().substring(0, 16));
                            }}
                            className="px-2.5 py-1 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-[11px] font-bold text-slate-200 cursor-pointer"
                          >
                            بعد 3 أيام
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const d = new Date(Date.now() + 7 * 24 * 3600 * 1000);
                              setRegistrationDeadline(d.toISOString().substring(0, 16));
                            }}
                            className="px-2.5 py-1 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-[11px] font-bold text-slate-200 cursor-pointer"
                          >
                            بعد أسبوع
                          </button>
                          {registrationDeadline && (
                            <button
                              type="button"
                              onClick={() => setRegistrationDeadline('')}
                              className="px-2.5 py-1 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-[11px] font-bold text-red-300 cursor-pointer"
                            >
                              إلغاء الموعد (مفتوح دائماً)
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Custom closed message */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-200 block">
                        رسالة إغلاق الرابط المخصصة (تظهر للزوار عند انتهاء الوقت أو القفل):
                      </label>
                      <input
                        type="text"
                        value={closedMessage}
                        onChange={e => setClosedMessage(e.target.value)}
                        placeholder="عذراً، تم إغلاق باب التسجيل للفترة الحالية لاكتمال المقاعد المتاحة..."
                        className="w-full border-2 rounded-xl py-2 px-3 text-xs text-white font-bold outline-none"
                        style={{
                          backgroundColor: themeCard,
                          borderColor: themeCardBorder
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Questionnaire Customizer (إذا كان مسموح بالتسجيل) */}
              {portalMode !== 'login_only' && (
                <div className="space-y-6 pt-3 border-t border-white/10">

                  {/* Standard Default Fields */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-black text-slate-200 block">
                        ٢. الحقول والأسئلة الأساسية في الاستمارة:
                      </label>
                      <span className="text-[11px] text-slate-300 font-bold">
                        تفعيل أو تعطيل الحقول الافتراضية
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
                          <span className="text-xs font-black text-white block">ملاحظات إضافية</span>
                          <span className="text-[10px] text-slate-400 font-bold">حقل مقالي إضافي لأي ملاحظات للطالب</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={notesAllowed}
                          onChange={e => setNotesAllowed(e.target.checked)}
                          className="w-4 h-4 accent-amber-400 cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>

                  {/* 3. DYNAMIC CUSTOM QUESTIONS BUILDER (إضافة أسئلة مخصصة بأنواع مختلفة) */}
                  <div className="space-y-4 pt-3 border-t border-white/10">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div>
                        <h4 className="text-sm font-black text-white flex items-center gap-2">
                          <Plus className="w-4 h-4 text-amber-400" />
                          <span>٣. الأسئلة الإضافية المخصصة للاستمارة ({customQuestions.length} أسئلة مضافة):</span>
                        </h4>
                        <p className="text-[11px] text-slate-300 font-bold">
                          يمكن للمشرف إضافة أسئلة بأي نوع (نص قصير، مقالي، قائمة منسدلة، اختيار فردي، مربعات اختيار، تاريخ، أرقام)
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleOpenAddQuestion}
                        className="px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:translate-y-0.5 shadow-md hover:brightness-110"
                        style={{
                          backgroundColor: themeAccent,
                          color: accentTextColor
                        }}
                      >
                        <Plus className="w-4 h-4" />
                        <span>إضافة سؤال جديد</span>
                      </button>
                    </div>

                    {customQuestions.length === 0 ? (
                      <div
                        className="p-6 rounded-2xl border-2 border-dashed text-center space-y-2"
                        style={{
                          borderColor: themeCardBorder,
                          backgroundColor: `${theme.backgroundColor || '#131f24'}80`
                        }}
                      >
                        <HelpCircle className="w-8 h-8 text-slate-400 mx-auto opacity-50" />
                        <p className="text-xs font-bold text-slate-300">
                          لم تقم بإضافة أي أسئلة مخصصة بعد.
                        </p>
                        <p className="text-[11px] text-slate-400 font-bold">
                          يمكنك إضافة أسئلة مثل: (المرحلة الدراسية، هل حفظت سابقاً في مجمع آخر؟، الفترة المناسبة للحضور، إلخ).
                        </p>
                        <button
                          type="button"
                          onClick={handleOpenAddQuestion}
                          className="mt-2 px-3 py-1.5 rounded-xl border border-white/20 text-xs font-black text-amber-300 hover:bg-white/5 cursor-pointer"
                        >
                          + أنشئ أول سؤال الآن
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {customQuestions.map((q, idx) => {
                          const typeMeta = QUESTION_TYPE_LABELS[q.type] || QUESTION_TYPE_LABELS.text;
                          const isInactive = q.isEnabled === false;

                          return (
                            <div
                              key={q.id}
                              className={`p-3.5 rounded-2xl border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                                isInactive ? 'opacity-60 bg-white/5 border-white/10' : 'bg-white/5 border-white/15 hover:border-white/25'
                              }`}
                            >
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-xs font-mono font-bold text-slate-300">
                                    {idx + 1}
                                  </span>
                                  <h5 className="text-xs sm:text-sm font-black text-white truncate">{q.label}</h5>
                                  <span className="text-[10px] px-2 py-0.5 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/30 font-black">
                                    {typeMeta.label}
                                  </span>
                                  {q.required ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 font-black">
                                      إلزامي *
                                    </span>
                                  ) : (
                                    <span className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-500/20 text-slate-300 font-bold">
                                      اختياري
                                    </span>
                                  )}
                                  {isInactive && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-lg bg-gray-600/30 text-gray-300 border border-gray-500/30 font-bold">
                                      معطل مؤقتاً
                                    </span>
                                  )}
                                </div>

                                {q.description && (
                                  <p className="text-[11px] text-slate-400 font-bold truncate">{q.description}</p>
                                )}

                                {q.options && q.options.length > 0 && (
                                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                    <span className="text-[10px] text-slate-400 font-bold">الخيارات:</span>
                                    {q.options.map((opt, oIdx) => (
                                      <span
                                        key={oIdx}
                                        className="text-[10px] px-2 py-0.5 rounded-md bg-white/10 text-slate-200 border border-white/10 font-bold"
                                      >
                                        {opt}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Controls */}
                              <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveQuestion(idx, 'up')}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                                  title="تحريك لأعلى"
                                >
                                  <ArrowUp className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === customQuestions.length - 1}
                                  onClick={() => handleMoveQuestion(idx, 'down')}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
                                  title="تحريك لأسفل"
                                >
                                  <ArrowDown className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditQuestion(q)}
                                  className="p-1.5 rounded-lg text-slate-300 hover:text-amber-400 cursor-pointer"
                                  title="تعديل السؤال"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleQuestionEnabled(q.id)}
                                  className="p-1.5 rounded-lg text-slate-300 hover:text-white cursor-pointer"
                                  title={isInactive ? 'تفعيل السؤال' : 'تعطيل السؤال مؤقتاً'}
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteQuestion(q.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 cursor-pointer"
                                  title="حذف السؤال"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Welcome Message text area */}
              <div className="space-y-1.5 pt-3 border-t border-white/10">
                <label className="text-xs font-black text-slate-200 block">
                  ٤. رسالة الترحيب التي تظهر للزوار في رأس البوابة:
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
                <span>{isSavingConfig ? 'جارٍ حفظ الإعدادات...' : 'حفظ واعتماد إعدادات البوابة والأسئلة'}</span>
              </button>
            </div>
          )}

          {/* TAB 2: Incoming & Historical Applications Review */}
          {modalTab === 'applications' && (
            <div className="space-y-4">
              {/* Header Stats & Cloud Sync Refresh Bar */}
              <div
                className="p-3.5 rounded-2xl border-2 border-b-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md"
                style={{
                  backgroundColor: theme.backgroundColor || '#131f24',
                  borderColor: themeCardBorder,
                  borderBottomColor: themeCardShadow
                }}
              >
                <div className="flex items-center gap-2 flex-wrap text-xs font-black">
                  <span className="text-white font-bold">سجل الطلبات:</span>
                  <span className="px-2.5 py-1 rounded-xl bg-white/10 text-white border border-white/10">
                    الإجمالي: {applications.length}
                  </span>
                  <span className="px-2.5 py-1 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/40">
                    قيد المراجعة: {pendingCount}
                  </span>
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    مقبولة: {acceptedCount}
                  </span>
                  <span className="px-2.5 py-1 rounded-xl bg-red-500/20 text-red-300 border border-red-500/40">
                    مرفوضة: {rejectedCount}
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => refreshAllApps(true)}
                    disabled={isRefreshingApps || isLoadingApps}
                    className="flex-1 sm:flex-none px-3 py-2 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:translate-y-0.5 disabled:opacity-50"
                    title="تحديث ومزامنة أحدث الطلبات من السحابة"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingApps ? 'animate-spin text-amber-400' : ''}`} />
                    <span>{isRefreshingApps ? 'جارٍ المزامنة...' : 'تحديث الطلبات الآن'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportToExcel}
                    className="px-3 py-2 rounded-xl border border-emerald-500/40 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:translate-y-0.5"
                    title="تصدير كشف الطلبات إلى ملف Excel"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>تصدير Excel</span>
                  </button>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row gap-2.5 justify-between sm:items-center">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={appSearch}
                    onChange={e => setAppSearch(e.target.value)}
                    placeholder="بحث برقم الطلب، اسم الطالب، هاتف ولي الأمر، أو إجابات الأسئلة..."
                    className="w-full border-2 rounded-2xl py-2 px-3.5 pr-10 text-xs text-white placeholder-slate-400 outline-none font-bold"
                    style={{
                      backgroundColor: theme.backgroundColor || '#131f24',
                      borderColor: themeCardBorder
                    }}
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-2.5" />
                </div>

                {/* Halaqah Filter */}
                <select
                  value={selectedHalaqahFilter}
                  onChange={e => setSelectedHalaqahFilter(e.target.value)}
                  className="border-2 rounded-2xl py-2 px-3 text-xs font-bold text-white outline-none cursor-pointer"
                  style={{
                    backgroundColor: theme.backgroundColor || '#131f24',
                    borderColor: themeCardBorder
                  }}
                >
                  <option value="all">كل الحلقات</option>
                  {halaqahs.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>

                {/* Status Switcher Tabs */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(['all', 'pending', 'accepted', 'rejected'] as const).map(f => {
                    const labels = {
                      all: `الكل (${applications.length})`,
                      pending: `قيد المراجعة (${pendingCount})`,
                      accepted: `مقبول (${acceptedCount})`,
                      rejected: `مرفوض (${rejectedCount})`
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
                  <span>جارٍ جلب وتحديث طلبات الانضمام السحابية...</span>
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
                  <p className="text-xs text-slate-400 font-bold max-w-md mx-auto">
                    {appSearch
                      ? 'لم يتم العثور على أي طلب يطابق معايير البحث الحالية.'
                      : 'عندما يقوم أي طالب بالتقديم عبر رابط البوابة، سيظهر طلبه هنا فوراً للمشرف للاعتماد أو الرفض أو المراجعة.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Bulk Selection Bar for Waiting List & Applications */}
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-200">
                        <input
                          type="checkbox"
                          checked={filteredApps.length > 0 && selectedAppIds.length === filteredApps.length}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedAppIds(filteredApps.map(a => a.id));
                            } else {
                              setSelectedAppIds([]);
                            }
                          }}
                          className="w-4 h-4 rounded text-emerald-500 cursor-pointer accent-emerald-500"
                        />
                        <span>تحديد الكل ({filteredApps.length})</span>
                      </label>
                      {selectedAppIds.length > 0 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-lg bg-amber-400/20 text-amber-300 font-bold">
                          تم تحديد {selectedAppIds.length} طلب
                        </span>
                      )}
                    </div>

                    {selectedAppIds.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={handleBulkAcceptSelectedAsExtra}
                          className="px-3.5 py-1.5 rounded-xl bg-[#58cc02] text-white font-black text-xs flex items-center gap-1.5 shadow-md hover:brightness-110 cursor-pointer"
                          title="قبول جميع الطلاب المحددين كطلاب إضافيين وإرسال بريد القبول لكل شخص"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>قبول الجميع كطلاب إضافيين ({selectedAppIds.length})</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleBulkRejectSelected}
                          className="px-3 py-1.5 rounded-xl bg-amber-600/30 text-amber-300 border border-amber-500/40 font-black text-xs flex items-center gap-1.5 shadow-md hover:bg-amber-600/40 cursor-pointer"
                          title="الاعتذار لجميع الطلبات المحددة"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>اعتذار ({selectedAppIds.length})</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleBulkDeleteSelected}
                          className="px-3 py-1.5 rounded-xl bg-red-700/80 text-white border border-red-500 font-black text-xs flex items-center gap-1.5 shadow-md hover:bg-red-700 cursor-pointer"
                          title="حذف جميع الطلبات المحددة نهائياً ومنع عودتها"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>حذف نهائي ({selectedAppIds.length})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedAppIds([])}
                          className="px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-white text-xs cursor-pointer"
                        >
                          إلغاء التحديد
                        </button>
                      </div>
                    )}
                  </div>

                  {filteredApps.map(app => {
                    const isSelected = selectedAppIds.includes(app.id);
                    return (
                    <div
                      key={app.id}
                      className={`rounded-2xl border-2 border-b-4 p-4.5 space-y-3 shadow-md transition-all ${
                        isSelected ? 'ring-2 ring-amber-400' : ''
                      }`}
                      style={{
                        backgroundColor: theme.backgroundColor || '#131f24',
                        borderColor:
                          isSelected
                            ? '#fbbf24'
                            : app.status === 'accepted'
                            ? '#58cc02'
                            : app.status === 'rejected'
                            ? '#ff4b4b'
                            : themeCardBorder,
                        borderBottomColor:
                          isSelected
                            ? '#d97706'
                            : app.status === 'accepted'
                            ? '#46a302'
                            : app.status === 'rejected'
                            ? '#ea2b2b'
                            : themeCardShadow
                      }}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              setSelectedAppIds(prev =>
                                prev.includes(app.id) ? prev.filter(id => id !== app.id) : [...prev, app.id]
                              );
                            }}
                            className="mt-1 w-4 h-4 rounded text-emerald-500 cursor-pointer accent-emerald-500 shrink-0"
                          />
                          <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm sm:text-base font-black text-white">{app.studentName}</h4>
                            <span className="text-[11px] font-bold text-slate-300">({app.age} سنة)</span>
                            {app.isExtraStudent && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                                طالب إضافي
                              </span>
                            )}
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
                            <span className="text-[10px] text-slate-400 font-mono">
                              {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString('ar-SA') : ''}
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
                        </div>

                        {/* Status Label & Action Buttons */}
                        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                          {app.status === 'pending' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleAcceptSingleAsExtra(app)}
                                className="px-3 py-1.5 rounded-xl border-2 border-b-2 text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 active:translate-y-0.5 shadow-sm cursor-pointer flex items-center gap-1.5"
                                title="قبول الطالب فوراً كطالب إضافي زائد عن السعة الاستيعابية وإرسال بريد القبول"
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                <span>قبول كطالب إضافي</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setAppToAccept(app);
                                  setTargetHalaqahId(app.preferredHalaqahId || halaqahs[0]?.id || '');
                                }}
                                className="px-3 py-1.5 rounded-xl border-2 border-b-2 text-xs font-black bg-[#58cc02] text-white border-[#58cc02] active:translate-y-0.5 shadow-sm hover:brightness-110 cursor-pointer flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>قبول وتحديد حلقة</span>
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
                            <div className="flex items-center gap-2 flex-wrap">
                              {app.studentAcceptanceStatus === 'confirmed_by_student' ? (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-300 text-xs font-black shadow-sm">
                                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                  <span>لقد دخل الطالب للحلقة وأكد الانضمام رسمياً 🎉</span>
                                  {app.studentConfirmedAt && (
                                    <span className="text-[10px] text-emerald-200 opacity-80 font-mono">
                                      ({new Date(app.studentConfirmedAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })})
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400 text-amber-300 text-xs font-black shadow-sm animate-pulse">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>في انتظار قبول وتأكيد الطالب للدخول</span>
                                </div>
                              )}
                              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300">
                                <span>الحلقة: {app.assignedHalaqahName}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setAppToAccept(app);
                                  setTargetHalaqahId(app.assignedHalaqahId || halaqahs[0]?.id || '');
                                }}
                                className="px-2.5 py-1 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-xs font-black text-slate-200 cursor-pointer"
                                title="تعديل الحلقة المخصصة للطالب"
                              >
                                نقل لحلقة أخرى
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/20 border border-red-500 text-red-300 text-xs font-black">
                                <XCircle className="w-3.5 h-3.5" />
                                <span>مرفوض: {app.rejectionReason}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setAppToAccept(app);
                                  setTargetHalaqahId(app.preferredHalaqahId || halaqahs[0]?.id || '');
                                }}
                                className="px-2.5 py-1 rounded-xl border border-emerald-500/40 bg-emerald-600/20 hover:bg-emerald-600/30 text-xs font-black text-emerald-300 cursor-pointer flex items-center gap-1"
                                title="إعادة فتح الطلب والموافقة عليه"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>إعادة فتح وقبول</span>
                              </button>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => setAppDiagnosticToView(app)}
                            className="px-2.5 py-1.5 rounded-xl border border-cyan-400/50 bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-300 hover:text-white text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                            title="معاينة الاختبار التشخيصي التفصيلي المكون من 10 أسئلة مع المؤقت وسجل الإجابات"
                          >
                            <BrainCircuit className="w-3.5 h-3.5 text-cyan-400" />
                            <span>فحص الاختبار {app.placementTestSummary ? `(${app.placementTestSummary.overallScore}%)` : ''}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setAppPlanToView(app)}
                            className="px-2.5 py-1.5 rounded-xl border border-amber-400/40 bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 hover:text-white text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                            title="عرض الخطة القرآنية المنهجية والتثبيت وموعد الختم"
                          >
                            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                            <span>عرض الخطة</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setAppPlanToEdit(app);
                              setEditPlanNewFaces(app.proposedPlanSummary?.dailyNewFaces || 1);
                              setEditPlanReviewFaces(app.proposedPlanSummary?.dailyReviewFaces || 3);
                              setEditPlanPathType(app.proposedPlanSummary?.pathType || 'standard_memorization');
                              setEditPlanHalaqahId(app.assignedHalaqahId || app.preferredHalaqahId || halaqahs[0]?.id || '');
                            }}
                            className="px-2.5 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 hover:text-white text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                            title="تعديل الخطة المقترحة وتخصيص الأوجه قبل الاعتماد"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>تعديل الخطة</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setAppDetailsToView(app)}
                            className="p-1.5 rounded-xl border border-white/10 text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer"
                            title="عرض تفاصيل الطلب الكاملة"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setAppToDelete(app)}
                            className="p-1.5 rounded-xl border border-red-500/20 text-slate-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                            title="حذف الطلب نهائياً"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Custom Questions Responses Strip (إذا وجدت إجابات مخصصة) */}
                      {app.customQuestionResponses && app.customQuestionResponses.length > 0 && (
                        <div className="pt-2 border-t border-white/10 flex items-center gap-2 flex-wrap text-xs">
                          <span className="text-[11px] text-amber-400 font-black">إجابات الأسئلة المخصصة:</span>
                          {app.customQuestionResponses.map((res, rIdx) => (
                            <span
                              key={rIdx}
                              className="px-2.5 py-1 rounded-xl border text-[11px] font-bold"
                              style={{
                                backgroundColor: themeCard,
                                borderColor: themeCardBorder,
                                color: '#ffffff'
                              }}
                            >
                              <strong className="text-amber-300 font-black">{res.questionLabel}:</strong>{' '}
                              <span>{Array.isArray(res.answer) ? res.answer.join(', ') : String(res.answer)}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Memorized Juz Details Strip */}
                      {app.memorizedJuzList && app.memorizedJuzList.length > 0 && (
                        <div className="pt-1.5 border-t border-white/5 flex items-center gap-1.5 flex-wrap text-xs">
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
                  );
                })}
              </div>
            )}
            </div>
          )}
        </div>

        {/* Modal Sub-Dialog: QUESTION BUILDER & EDITOR */}
        {isQuestionEditorOpen && (
          <div className="fixed inset-0 z-[10010] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
            <div
              className="w-full max-w-lg rounded-3xl border-2 border-b-4 p-5 sm:p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
              style={{
                backgroundColor: themeCard,
                borderColor: themeAccent,
                borderBottomColor: themeAccentShadow
              }}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center font-black"
                    style={{
                      backgroundColor: `${themeAccent}25`,
                      color: themeAccent
                    }}
                  >
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">
                      {editingQuestionId ? 'تعديل السؤال المخصص' : 'إضافة سؤال جديد للاستمارة'}
                    </h3>
                    <p className="text-[11px] text-slate-300 font-bold">صياغة السؤال وتحديد نوع الإجابة وخياراتها</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsQuestionEditorOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Question Label / Prompt */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-200 block">
                  نص وصيغة السؤال: <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  value={questionLabel}
                  onChange={e => setQuestionLabel(e.target.value)}
                  placeholder="مثال: المرحلة الدراسية أو اسم المدرسة..."
                  className="w-full border-2 rounded-xl py-2.5 px-3.5 text-xs text-white font-bold outline-none"
                  style={{
                    backgroundColor: theme.backgroundColor || '#131f24',
                    borderColor: themeCardBorder
                  }}
                />
              </div>

              {/* Question Type Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-200 block">نوع السؤال وحقل الإجابة:</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(Object.keys(QUESTION_TYPE_LABELS) as PortalQuestionType[]).map(t => {
                    const meta = QUESTION_TYPE_LABELS[t];
                    const isSelected = questionType === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setQuestionType(t)}
                        className={`p-2 rounded-xl border-2 text-right transition-all cursor-pointer flex flex-col justify-between gap-1 ${
                          isSelected
                            ? 'border-amber-400 bg-amber-400/20 text-white font-black shadow-sm'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-amber-400">{meta.icon}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-amber-400" />}
                        </div>
                        <span className="text-[11px] font-black">{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description / Placeholder */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 block">توضيح إضافي (اختياري):</label>
                  <input
                    type="text"
                    value={questionDescription}
                    onChange={e => setQuestionDescription(e.target.value)}
                    placeholder="إرشاد يظهر تحت السؤال"
                    className="w-full border rounded-xl py-2 px-3 text-xs text-white outline-none"
                    style={{
                      backgroundColor: theme.backgroundColor || '#131f24',
                      borderColor: themeCardBorder
                    }}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 block">نص إرشادي داخل الحقل:</label>
                  <input
                    type="text"
                    value={questionPlaceholder}
                    onChange={e => setQuestionPlaceholder(e.target.value)}
                    placeholder="مثال: اكتب الإجابة هنا..."
                    className="w-full border rounded-xl py-2 px-3 text-xs text-white outline-none"
                    style={{
                      backgroundColor: theme.backgroundColor || '#131f24',
                      borderColor: themeCardBorder
                    }}
                  />
                </div>
              </div>

              {/* Options Builder for Select / Radio / Checkbox */}
              {(questionType === 'select' || questionType === 'radio' || questionType === 'checkbox') && (
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <label className="text-xs font-black text-slate-200 block">
                    خيارات السؤال (أضف الخيارات التي سيختار منها الطالب):
                  </label>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newOptionInput}
                      onChange={e => setNewOptionInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddOption();
                        }
                      }}
                      placeholder="اكتب خياراً واضغط إضافة..."
                      className="flex-1 border rounded-xl py-2 px-3 text-xs text-white font-bold outline-none"
                      style={{
                        backgroundColor: theme.backgroundColor || '#131f24',
                        borderColor: themeCardBorder
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="px-3.5 py-2 rounded-xl text-xs font-black cursor-pointer shadow-sm hover:brightness-110"
                      style={{
                        backgroundColor: themeAccent,
                        color: accentTextColor
                      }}
                    >
                      إضافة
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {questionOptions.map((opt, oIdx) => (
                      <span
                        key={oIdx}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 text-white border border-white/15 text-xs font-bold"
                      >
                        <span>{opt}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(opt)}
                          className="text-slate-400 hover:text-red-400 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Required Question Checkbox */}
              <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer select-none">
                <div>
                  <span className="text-xs font-black text-white block">سؤال إلزامي (مطلوب)</span>
                  <span className="text-[10px] text-slate-400 font-bold">
                    لن يتمكن الطالب من إرسال الاستمارة دون الإجابة على هذا السؤال
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={questionRequired}
                  onChange={e => setQuestionRequired(e.target.checked)}
                  className="w-4 h-4 accent-amber-400 cursor-pointer"
                />
              </label>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleSaveQuestion}
                  disabled={!questionLabel.trim()}
                  className="flex-1 py-3 rounded-xl border-2 border-b-2 text-xs font-black cursor-pointer transition-all active:translate-y-0.5 hover:brightness-110 shadow-md disabled:opacity-50"
                  style={{
                    backgroundColor: themeAccent,
                    borderColor: themeAccent,
                    color: accentTextColor
                  }}
                >
                  {editingQuestionId ? 'حفظ التعديلات' : 'إضافة السؤال للاستمارة'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsQuestionEditorOpen(false)}
                  className="py-3 px-4 rounded-xl border text-xs font-black text-slate-300 hover:text-white cursor-pointer"
                  style={{ borderColor: themeCardBorder }}
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Sub-Dialog: FULL APPLICATION DETAILS MODAL */}
        {appDetailsToView && (
          <div className="fixed inset-0 z-[10005] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
            <div
              className="w-full max-w-lg rounded-3xl border-2 border-b-4 p-5 sm:p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto"
              style={{
                backgroundColor: themeCard,
                borderColor: themeCardBorder,
                borderBottomColor: themeCardShadow
              }}
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center font-black"
                    style={{
                      backgroundColor: `${themeAccent}25`,
                      color: themeAccent
                    }}
                  >
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">{appDetailsToView.studentName}</h3>
                    <p className="text-xs text-slate-300 font-mono font-bold">رقم الطلب: {appDetailsToView.trackingCode}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAppDetailsToView(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Banner */}
              <div
                className={`p-3 rounded-2xl border flex items-center justify-between gap-2 text-xs font-black ${
                  appDetailsToView.status === 'accepted'
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : appDetailsToView.status === 'rejected'
                    ? 'bg-red-500/20 border-red-500/40 text-red-300'
                    : 'bg-amber-400/20 border-amber-400/40 text-amber-300'
                }`}
              >
                <span>
                  الحالة: {appDetailsToView.status === 'accepted' ? 'تم القبول والاعتماد' : appDetailsToView.status === 'rejected' ? 'معتذر عنه / مرفوض' : 'قيد المراجعة'}
                </span>
                {appDetailsToView.assignedHalaqahName && (
                  <span>الحلقة: {appDetailsToView.assignedHalaqahName}</span>
                )}
              </div>

              {/* Student & Parent Info Grid */}
              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[10px] text-slate-400 block font-bold">العمر:</span>
                    <span className="font-black text-white">{appDetailsToView.age} سنة</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[10px] text-slate-400 block font-bold">اسم ولي الأمر:</span>
                    <span className="font-black text-white">{appDetailsToView.parentName}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold">هاتف ولي الأمر:</span>
                    <span className="font-black font-mono text-white text-sm" dir="ltr">{appDetailsToView.parentPhone}</span>
                  </div>
                  <a
                    href={`https://wa.me/${appDetailsToView.parentPhone?.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-[#25D366] text-white text-xs font-black flex items-center gap-1.5 hover:brightness-110"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>مراسلة واتساب</span>
                  </a>
                </div>

                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-[10px] text-slate-400 block font-bold">الحلقة المرغوبة:</span>
                  <span className="font-black text-white">{appDetailsToView.preferredHalaqahName || 'توجيه تلقائي من المشرف'}</span>
                </div>
              </div>

              {/* Custom Questions Answers */}
              {appDetailsToView.customQuestionResponses && appDetailsToView.customQuestionResponses.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <h4 className="text-xs font-black text-amber-400">إجابات الأسئلة المخصصة للطالب:</h4>
                  <div className="space-y-1.5">
                    {appDetailsToView.customQuestionResponses.map((res, idx) => (
                      <div key={idx} className="p-2 rounded-xl bg-white/5 border border-white/10 text-xs">
                        <span className="text-slate-400 font-bold block">{res.questionLabel}:</span>
                        <span className="font-black text-white">
                          {Array.isArray(res.answer) ? res.answer.join(', ') : String(res.answer)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Memorized Quran Juz List */}
              {appDetailsToView.memorizedJuzList && appDetailsToView.memorizedJuzList.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-white/10">
                  <h4 className="text-xs font-black text-slate-300">
                    أجزاء القرآن المحفوظة ({appDetailsToView.memorizedJuzList.length} جزء):
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {appDetailsToView.memorizedJuzList.map(j => (
                      <span key={j} className="px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-black">
                        جزء {j}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="pt-2 border-t border-white/10 text-[11px] text-slate-400 font-bold space-y-1">
                <div>تاريخ التقديم: {appDetailsToView.appliedAt ? new Date(appDetailsToView.appliedAt).toLocaleString('ar-SA') : '-'}</div>
                {appDetailsToView.reviewedAt && (
                  <div>تمت المراجعة: {new Date(appDetailsToView.reviewedAt).toLocaleString('ar-SA')} بواسطة {appDetailsToView.reviewedByName || 'المشرف'}</div>
                )}
                {appDetailsToView.rejectionReason && (
                  <div className="text-red-300">سبب الاعتذار: {appDetailsToView.rejectionReason}</div>
                )}
              </div>

              {/* Diagnostic Test & Plan Action Buttons */}
              {appDetailsToView.placementTestSummary && (
                <div className="pt-2 border-t border-white/10 space-y-2">
                  <div className="p-3 rounded-2xl bg-cyan-950/40 border border-cyan-500/40 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <BrainCircuit className="w-4 h-4 text-cyan-400" />
                      <div>
                        <span className="text-[11px] font-black text-cyan-300 block">
                          نتيجة الفحص التشخيصي المباشر: {appDetailsToView.placementTestSummary.overallScore || 0}%
                        </span>
                        <span className="text-[10px] text-slate-300 font-bold">
                          المستوى: {(appDetailsToView.placementTestSummary as any).classifiedLevel || (appDetailsToView.placementTestSummary as any).levelClassification || 'متوسط'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const target = appDetailsToView;
                        setAppDetailsToView(null);
                        setAppDiagnosticToView(target);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-black border border-cyan-400/40 flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all"
                    >
                      <BrainCircuit className="w-3.5 h-3.5 text-cyan-400" />
                      <span>معاينة الأسئلة والخيارات والزمن</span>
                    </button>
                  </div>
                </div>
              )}

              {/* View Full Plan Button */}
              <div className="pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    const target = appDetailsToView;
                    setAppDetailsToView(null);
                    setAppPlanToView(target);
                  }}
                  className="w-full py-2.5 px-3 rounded-2xl border-2 border-b-4 bg-amber-400/20 text-amber-300 border-amber-400/40 text-xs font-black flex items-center justify-center gap-2 cursor-pointer hover:bg-amber-400/30 shadow-md active:translate-y-0.5"
                >
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  <span>عرض الخطة القرآنية المنهجية والتثبيت وموعد الختم</span>
                </button>
              </div>

              {/* Action Buttons inside Details */}
              <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                {appDetailsToView.status === 'pending' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setAppToAccept(appDetailsToView);
                        setTargetHalaqahId(appDetailsToView.preferredHalaqahId || halaqahs[0]?.id || '');
                        setAppDetailsToView(null);
                      }}
                      className="flex-1 py-2.5 rounded-xl border-2 border-b-2 bg-[#58cc02] text-white border-[#58cc02] text-xs font-black flex items-center justify-center gap-1 cursor-pointer hover:brightness-110"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>قبول واعتماد الطالب</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAppToReject(appDetailsToView);
                        setAppDetailsToView(null);
                      }}
                      className="py-2.5 px-3 rounded-xl border-2 border-b-2 bg-red-600/20 text-red-300 border-red-500/40 text-xs font-black cursor-pointer hover:bg-red-600/30"
                    >
                      اعتذار
                    </button>
                  </>
                ) : appDetailsToView.status === 'rejected' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setAppToAccept(appDetailsToView);
                      setTargetHalaqahId(appDetailsToView.preferredHalaqahId || halaqahs[0]?.id || '');
                      setAppDetailsToView(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl border-2 border-b-2 bg-[#58cc02] text-white border-[#58cc02] text-xs font-black flex items-center justify-center gap-1 cursor-pointer hover:brightness-110"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>إعادة النظر وقبول الطالب</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAppToAccept(appDetailsToView);
                      setTargetHalaqahId(appDetailsToView.assignedHalaqahId || halaqahs[0]?.id || '');
                      setAppDetailsToView(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl border-2 border-b-2 bg-white/10 text-white border-white/20 text-xs font-black cursor-pointer hover:bg-white/15"
                  >
                    نقل الطالب لحلقة أخرى
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setAppDetailsToView(null)}
                  className="py-2.5 px-4 rounded-xl border text-xs font-black text-slate-300 hover:text-white cursor-pointer"
                  style={{ borderColor: themeCardBorder }}
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )}

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

        {/* Modal Sub-Dialog: Confirm Delete */}
        {appToDelete && (
          <div className="fixed inset-0 z-[10005] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div
              className="w-full max-w-sm rounded-3xl border-2 border-b-4 p-5 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150"
              style={{
                backgroundColor: themeCard,
                borderColor: '#ff4b4b',
                borderBottomColor: '#ea2b2b'
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-600/20 text-red-400 flex items-center justify-center font-black">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">حذف طلب الانضمام</h3>
                  <p className="text-[11px] text-slate-300 font-bold">سيتم حذف هذا الطلب نهائياً من النظام</p>
                </div>
              </div>

              <p className="text-xs text-slate-200 font-bold leading-relaxed">
                هل أنت متأكد من حذف طلب الطالب <strong className="text-white">({appToDelete.studentName})</strong> برقم المتابعة <strong className="text-amber-400">({appToDelete.trackingCode})</strong>؟
              </p>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={isProcessingApp}
                  onClick={handleConfirmDeleteApp}
                  className="flex-1 py-2.5 rounded-xl border-2 border-b-2 text-xs font-black bg-red-600 text-white border-red-600 cursor-pointer transition-all active:translate-y-0.5 hover:brightness-110 shadow-md"
                >
                  {isProcessingApp ? 'جارٍ الحذف...' : 'تأكيد الحذف نهائياً'}
                </button>
                <button
                  type="button"
                  onClick={() => setAppToDelete(null)}
                  className="py-2.5 px-3 rounded-xl border text-xs font-black text-slate-300 hover:text-white cursor-pointer"
                  style={{ borderColor: themeCardBorder }}
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Plan Dialog for Student Registration Application */}
        {appPlanToView && (() => {
          const memJuz = appPlanToView.memorizedJuzList?.length || 1;
          const consJuz = Math.max(0, memJuz - 2);
          const timeline = calculateRealisticKhatmTimeline({
            memorizedJuz: memJuz,
            consolidatedJuz: consJuz,
            dailyNewPages: 1,
            dailyReviewPages: 5,
            weeklyDaysCount: 5,
            dailyHoursCount: 2
          });

          return (
            <div className="fixed inset-0 z-[10010] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto" dir="rtl">
              <div
                className="w-full max-w-xl rounded-3xl border-2 border-b-4 p-5 sm:p-7 space-y-5 shadow-2xl my-auto animate-fadeIn text-right"
                style={{
                  backgroundColor: themeCard,
                  borderColor: themeAccent,
                  borderBottomColor: themeAccentShadow
                }}
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: themeCardBorder }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-amber-400/20 text-amber-300 flex items-center justify-center border border-amber-400/30">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-white">
                        الخطة القرآنية المنهجية للطالب: {appPlanToView.studentName}
                      </h3>
                      <p className="text-xs text-slate-300 font-bold">
                        {appPlanToView.assignedHalaqahName ? `الحلقة المعتمدة: ${appPlanToView.assignedHalaqahName}` : `الحلقة المرغوبة: ${appPlanToView.preferredHalaqahName || 'توجيه المشرف'}`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAppPlanToView(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="space-y-4 max-h-[68vh] overflow-y-auto pr-1 text-xs">
                  {/* Target Khatm Card */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#022c22] border-2 border-amber-400/40 space-y-2.5 shadow-md">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-[11px] font-black text-amber-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>موعد الختم المحسوب بالذكاء الاصطناعي:</span>
                      </span>
                      <span className="text-xs font-mono font-black px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40">
                        متبقي قرابة {toArabicNumerals(timeline.estimatedDaysRemaining)} يوماً
                      </span>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-white font-heading">
                      {timeline.targetCompletionDate}
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px] text-[#86efac] font-bold">
                        <span>نسبة الإنجاز نحو الختمة (30 جزء):</span>
                        <span className="font-mono font-black text-amber-300">{timeline.progressPercentage}%</span>
                      </div>
                      <div className="w-full h-3 rounded-full bg-black/40 border border-[#065f46] overflow-hidden p-0.5">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-amber-400 transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(5, timeline.progressPercentage))}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Pedagogical Note */}
                  <div className="p-4 rounded-2xl bg-[#022c22]/80 border border-white/10 space-y-1.5">
                    <span className="text-[11px] font-black text-amber-300 block">
                      خارطة الطريق ومنهجية التثبيت المعتمدة:
                    </span>
                    <p className="text-slate-200 leading-relaxed text-xs font-bold">
                      {timeline.pedagogicalNote}
                    </p>
                  </div>

                  {/* Daily Assignment */}
                  <div className="p-4 rounded-2xl bg-[#022c22]/80 border border-white/10 space-y-2">
                    <span className="text-[11px] font-black text-[#86efac] block">
                      مقرر الورد اليومي والتثبيت المبرمج:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-black/30 border border-white/10">
                        <span className="text-slate-400 font-bold block text-[10px]">الحفظ الجديد اليومي:</span>
                        <span className="font-black text-amber-300">وجه واحد يومياً (مع المراجعة)</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-black/30 border border-white/10">
                        <span className="text-slate-400 font-bold block text-[10px]">المراجعة والتثبيت:</span>
                        <span className="font-black text-emerald-300">5 أوجه يومياً من المحفوظ السابق</span>
                      </div>
                    </div>
                  </div>

                  {/* Milestones */}
                  {timeline.milestones && timeline.milestones.length > 0 && (
                    <div className="p-4 rounded-2xl bg-[#022c22]/80 border border-white/10 space-y-2">
                      <span className="text-[11px] font-black text-white block">
                        مراحل ووقفات التثبيت التراكمية ({timeline.tathbeetStopsCount} وقفات):
                      </span>
                      <div className="space-y-1.5">
                        {timeline.milestones.map((m, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-white/5 text-xs">
                            <span className="text-slate-200 font-bold">{m.label}</span>
                            <span className="text-amber-300 font-mono font-black">{m.targetDate}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex justify-end pt-2 border-t" style={{ borderColor: themeCardBorder }}>
                  <button
                    type="button"
                    onClick={() => setAppPlanToView(null)}
                    className="py-2.5 px-6 rounded-xl font-black text-xs cursor-pointer shadow-md"
                    style={{
                      backgroundColor: themeAccent,
                      color: accentTextColor
                    }}
                  >
                    إغلاق الخطة
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Full Diagnostic Test Inspector Modal */}
        {appDiagnosticToView && (
          <div className="fixed inset-0 z-[10010] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto" dir="rtl">
            <div
              className="w-full max-w-3xl rounded-3xl border-2 border-b-4 p-5 sm:p-7 space-y-5 shadow-2xl my-auto animate-fadeIn text-right text-white max-h-[90vh] flex flex-col"
              style={{
                backgroundColor: themeCard,
                borderColor: '#38bdf8',
                borderBottomColor: '#0284c7'
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b pb-3 shrink-0" style={{ borderColor: themeCardBorder }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center border border-cyan-400/40">
                    <BrainCircuit className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-white">
                        سجل الفحص التشخيصي الكامل: {appDiagnosticToView.studentName}
                      </h3>
                      <span className="text-xs font-mono px-2 py-0.5 rounded-lg bg-cyan-400/20 text-cyan-300 font-bold border border-cyan-400/30">
                        {appDiagnosticToView.trackingCode}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-bold">
                      {appDiagnosticToView.age} سنة • عام البدء: {appDiagnosticToView.startingYear || 'غير محدد'} • المسار: {appDiagnosticToView.previousDirection === 'from_baqarah' || (appDiagnosticToView.previousDirection as any) === 'baqarah_to_nas' ? 'من البقرة إلى الناس' : 'من الناس إلى البقرة'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAppDiagnosticToView(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
                {appDiagnosticToView.placementTestSummary ? (() => {
                  const summary = appDiagnosticToView.placementTestSummary as any;
                  const classifiedLevel = summary.classifiedLevel || summary.levelClassification || 'متوسط';
                  const memorizationScore = summary.memorizationScore ?? 0;
                  const tajweedScore = summary.tajweedScore ?? 0;
                  const retentionScore = summary.retentionScore ?? 0;
                  const overallScore = summary.overallScore ?? 0;
                  const recommendations: string[] = summary.recommendations || summary.initialReviewRecommendations || [];
                  const questionResults: any[] = summary.questionResults || summary.questionsHistory || [];

                  return (
                    <>
                      {/* Score Badges */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        <div className="p-3 rounded-2xl bg-[#022c22] border border-[#065f46]">
                          <span className="text-[10px] text-slate-300 block">دقة الحفظ</span>
                          <span className="text-lg font-black text-emerald-400 font-mono">
                            {memorizationScore}%
                          </span>
                        </div>
                        <div className="p-3 rounded-2xl bg-[#022c22] border border-[#065f46]">
                          <span className="text-[10px] text-slate-300 block">أحكام التجويد</span>
                          <span className="text-lg font-black text-amber-300 font-mono">
                            {tajweedScore}%
                          </span>
                        </div>
                        <div className="p-3 rounded-2xl bg-[#022c22] border border-[#065f46]">
                          <span className="text-[10px] text-slate-300 block">ثبات الاستحضار</span>
                          <span className="text-lg font-black text-cyan-300 font-mono">
                            {retentionScore}%
                          </span>
                        </div>
                        <div className="p-3 rounded-2xl bg-[#022c22] border border-[#065f46]">
                          <span className="text-[10px] text-slate-300 block">المستوى المصنف</span>
                          <span className="text-sm font-black text-amber-300">
                            {classifiedLevel}
                          </span>
                        </div>
                      </div>

                      {/* Overall Composite Score Bar */}
                      <div className="p-3 rounded-2xl bg-[#064e3b]/50 border border-[#065f46] flex items-center justify-between">
                        <span className="font-bold text-slate-200">المعدل العام المركب للفحص التشخيصي:</span>
                        <span className="text-base font-black text-amber-400 font-mono">{overallScore}%</span>
                      </div>

                      {/* Recommendations */}
                      {recommendations.length > 0 && (
                        <div className="p-3.5 rounded-2xl bg-black/40 border border-[#065f46] space-y-1.5">
                          <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4" />
                            التوصيات التربوية والمنهجية المعتمدة:
                          </span>
                          <ul className="list-disc list-inside space-y-1 text-slate-200 text-xs">
                            {recommendations.map((rec, rIdx) => (
                              <li key={rIdx}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Question by Question Inspector (All Questions with options, choice, correct answer, time) */}
                      {questionResults.length > 0 && (
                        <div className="space-y-3 pt-2">
                          <h4 className="font-heading font-black text-sm text-cyan-300 flex items-center gap-2">
                            <Award className="w-4 h-4 text-cyan-400" />
                            <span>سجل الأسئلة التفصيلي ({questionResults.length} أسئلة) مع خيارات العرض وزمن الإجابة:</span>
                          </h4>

                          <div className="space-y-3">
                            {questionResults.map((qRes, qIdx) => {
                              const isCorrect = Boolean(qRes.isCorrect);
                              const isTimedOut = Boolean(qRes.isTimedOut ?? qRes.isTimeout);
                              const timeSec = qRes.timeTakenSeconds ?? 0;
                              const optionsOrder: string[] = qRes.optionsOrder || qRes.options || [];
                              const selectedOption = qRes.selectedOption || qRes.selectedAnswer || '';
                              const correctAns = qRes.correctAnswer || '';
                              const explanation = qRes.explanation || qRes.sourceReference;

                              return (
                                <div
                                  key={qIdx}
                                  className={`p-4 rounded-2xl border-2 space-y-2.5 transition-all ${
                                    isCorrect
                                      ? 'bg-emerald-950/40 border-emerald-500/50'
                                      : 'bg-red-950/40 border-red-500/50'
                                  }`}
                                >
                                  {/* Question Title & Meta */}
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs font-mono ${
                                          isCorrect ? 'bg-emerald-500 text-[#022c22]' : 'bg-red-500 text-white'
                                        }`}
                                      >
                                        {qIdx + 1}
                                      </span>
                                      <span className="font-black text-white text-xs sm:text-sm">
                                        {qRes.questionText}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1.5 text-[11px] font-bold">
                                      {qRes.difficulty && (
                                        <span className="px-2 py-0.5 rounded-md bg-white/10 text-amber-300 text-[10px]">
                                          {qRes.difficulty === 'easy' ? 'سهل' : qRes.difficulty === 'hard' ? 'متقدم' : 'متوسط'}
                                        </span>
                                      )}
                                      <span className="px-2 py-0.5 rounded-md bg-white/10 text-slate-300 font-mono">
                                        {timeSec}ث
                                      </span>
                                      {isTimedOut && (
                                        <span className="px-2 py-0.5 rounded-md bg-red-500/30 text-red-300 border border-red-500/50">
                                          انتهت المهلة
                                        </span>
                                      )}
                                      <span
                                        className={`px-2 py-0.5 rounded-md font-black ${
                                          isCorrect
                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                            : 'bg-red-500/20 text-red-300 border border-red-500/40'
                                        }`}
                                      >
                                        {isCorrect ? 'إجابة صحيحة ✓' : 'إجابة خاطئة ✗'}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Options Display (Showing Actual Order Shown to Student) */}
                                  {optionsOrder.length > 0 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                                      {optionsOrder.map((opt, oIdx) => {
                                        const isStudentChoice = selectedOption === opt;
                                        const isCorrectAns = correctAns === opt;

                                        let optClass = 'bg-white/5 border-white/10 text-slate-300';
                                        if (isCorrectAns) {
                                          optClass = 'bg-emerald-500/20 border-emerald-500 text-emerald-200 font-black';
                                        } else if (isStudentChoice && !isCorrect) {
                                          optClass = 'bg-red-500/20 border-red-500 text-red-200 line-through';
                                        }

                                        return (
                                          <div
                                            key={oIdx}
                                            className={`p-2 rounded-xl border flex items-center justify-between text-xs ${optClass}`}
                                          >
                                            <span>{opt}</span>
                                            {isStudentChoice && (
                                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-amber-300 font-bold shrink-0">
                                                اختيار الطالب
                                              </span>
                                            )}
                                            {isCorrectAns && !isStudentChoice && (
                                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/40 text-emerald-200 font-bold shrink-0">
                                                الصواب المعتمد
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Pedagogical Explanation or Quran Reference */}
                                  {explanation && (
                                    <p className="text-[11px] text-slate-300 bg-black/30 p-2 rounded-xl border border-white/5 font-bold">
                                      💡 التوضيح القرآني والمرجع: {explanation}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Conversation Transcript with the AI Quran Assistant */}
                      {appDiagnosticToView.conversationTranscript && appDiagnosticToView.conversationTranscript.length > 0 && (
                        <div className="p-4 rounded-2xl bg-black/40 border border-[#065f46] space-y-3 pt-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <h4 className="font-heading font-black text-sm text-amber-300 flex items-center gap-2">
                              <MessageCircle className="w-4 h-4 text-amber-400" />
                              <span>سجل المحادثة والتفاعل الكامل مع المساعد القرآني الذكي ({appDiagnosticToView.conversationTranscript.length} رسالة):</span>
                            </h4>
                            <span className="text-[10px] text-slate-400 font-mono">
                              حوار تفاعلي موثق
                            </span>
                          </div>

                          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {appDiagnosticToView.conversationTranscript.map((msg, mIdx) => {
                              const isUser = (msg.sender as any) === 'user' || (msg.sender as any) === 'طالب';
                              return (
                                <div
                                  key={mIdx}
                                  className={`p-3 rounded-xl border text-xs space-y-1 ${
                                    isUser
                                      ? 'bg-amber-400/10 border-amber-400/30 text-amber-200 mr-4'
                                      : 'bg-white/5 border-white/10 text-slate-200 ml-4'
                                  }`}
                                >
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="font-black text-amber-300">
                                      {msg.sender === 'ai' ? '🤖 المساعد القرآني الذكي' : (typeof msg.sender === 'string' && msg.sender.includes('نظام') ? msg.sender : `👤 ${appDiagnosticToView.studentName}`)}
                                    </span>
                                    <span className="font-mono text-slate-400">{msg.timestamp}</span>
                                  </div>
                                  <p className="leading-relaxed font-bold whitespace-pre-wrap">{msg.text}</p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })() : (
                  <div className="p-8 text-center space-y-2 bg-black/30 rounded-2xl border border-white/10">
                    <p className="text-slate-300 font-bold">
                      هذا الطلب مسجل مسبقاً قبل تفعيل محرك الفحص التشخيصي المباشر.
                    </p>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-3 border-t shrink-0 flex-wrap gap-2" style={{ borderColor: themeCardBorder }}>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const app = appDiagnosticToView;
                      setAppDiagnosticToView(null);
                      handleAcceptSingleAsExtra(app);
                    }}
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>قبول كطالب إضافي</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const app = appDiagnosticToView;
                      setAppDiagnosticToView(null);
                      setAppToAccept(app);
                      setTargetHalaqahId(app.preferredHalaqahId || halaqahs[0]?.id || '');
                    }}
                    className="px-3 py-2 rounded-xl bg-[#58cc02] text-white text-xs font-black shadow-md cursor-pointer flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>قبول وتخصيص حلقة</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setAppDiagnosticToView(null)}
                  className="px-4 py-2 rounded-xl border text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
                  style={{ borderColor: themeCardBorder }}
                >
                  إغلاق الفحص
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Plan Editor Modal Before Approving */}
        {appPlanToEdit && (
          <div className="fixed inset-0 z-[10010] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto" dir="rtl">
            <div
              className="w-full max-w-lg rounded-3xl border-2 border-b-4 p-5 sm:p-7 space-y-4 shadow-2xl my-auto animate-fadeIn text-right text-white"
              style={{
                backgroundColor: themeCard,
                borderColor: '#10b981',
                borderBottomColor: '#059669'
              }}
            >
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: themeCardBorder }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center border border-emerald-500/30">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">
                      تعديل الخطة المقترحة: {appPlanToEdit.studentName}
                    </h3>
                    <p className="text-xs text-slate-300 font-bold">تخصيص الأوجه ومسار التسميع قبل الاعتماد</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAppPlanToEdit(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                {/* Halaqah Picker */}
                <div className="space-y-1">
                  <label className="font-bold text-emerald-300 block">الحلقة القرآنية:</label>
                  <select
                    value={editPlanHalaqahId}
                    onChange={e => setEditPlanHalaqahId(e.target.value)}
                    className="w-full bg-[#022c22] border border-[#065f46] text-white font-bold rounded-xl py-2 px-3 outline-none cursor-pointer"
                  >
                    {halaqahs.map(h => (
                      <option key={h.id} value={h.id}>
                        {h.name} {h.complexName ? `(${h.complexName})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Path Type */}
                <div className="space-y-1">
                  <label className="font-bold text-emerald-300 block">نوع المسار القرآني:</label>
                  <select
                    value={editPlanPathType}
                    onChange={e => setEditPlanPathType(e.target.value)}
                    className="w-full bg-[#022c22] border border-[#065f46] text-white font-bold rounded-xl py-2 px-3 outline-none cursor-pointer"
                  >
                    <option value="standard_memorization">الحفظ المتدرج القياسي</option>
                    <option value="khatim_itqan">الإتقان العالي وسرد الختمة</option>
                    <option value="tathbeet">التثبيت والاسترجاع المتباعد (سد الثغرات)</option>
                    <option value="tajweed_foundation">التأسيس القرآني والتجويد العملي</option>
                  </select>
                </div>

                {/* Daily New Faces */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-bold text-slate-300 block">أوجه الحفظ الجديد يومياً:</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="10"
                      value={editPlanNewFaces}
                      onChange={e => setEditPlanNewFaces(Number(e.target.value))}
                      className="w-full bg-[#022c22] border border-[#065f46] text-center font-bold text-amber-300 rounded-xl py-2 px-3 outline-none"
                    />
                  </div>

                  {/* Daily Review Faces */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-300 block">أوجه المراجعة اليومية:</label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max="40"
                      value={editPlanReviewFaces}
                      onChange={e => setEditPlanReviewFaces(Number(e.target.value))}
                      className="w-full bg-[#022c22] border border-[#065f46] text-center font-bold text-emerald-300 rounded-xl py-2 px-3 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t" style={{ borderColor: themeCardBorder }}>
                <button
                  type="button"
                  onClick={() => setAppPlanToEdit(null)}
                  className="px-3 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white"
                >
                  إلغاء
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    if (!appPlanToEdit) return;
                    const hName = halaqahs.find(h => h.id === editPlanHalaqahId)?.name || appPlanToEdit.preferredHalaqahName;
                    const updatedApp: StudentRegistrationApplication = {
                      ...appPlanToEdit,
                      assignedHalaqahId: editPlanHalaqahId,
                      assignedHalaqahName: hName,
                      proposedPlanSummary: {
                        pathType: editPlanPathType as any,
                        dailyNewFaces: editPlanNewFaces,
                        dailyReviewFaces: editPlanReviewFaces,
                        recommendedHalaqahLevel: editPlanPathType,
                        estimatedKhatmMonths: appPlanToEdit.proposedPlanSummary?.estimatedKhatmMonths || 12,
                        notes: `تم تحديث الخطة بواسطة المشرف: ${editPlanNewFaces} أوجه جديد، ${editPlanReviewFaces} أوجه مراجعة.`
                      }
                    };
                    await OmranDataService.saveRegistrationApplication(updatedApp);
                    setApplications(prev => prev.map(a => (a.id === updatedApp.id ? updatedApp : a)));
                    setAppPlanToEdit(null);
                  }}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#022c22] font-black text-xs shadow-md cursor-pointer"
                >
                  حفظ تعديل الخطة
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Quick Mail Setup Modal for Supervisor */}
        <QuickMailSetupModal
          isOpen={isMailModalOpen}
          onClose={() => setIsMailModalOpen(false)}
          complex={complex}
          complexId={complex.id}
          complexName={complex.name}
          onSaveComplex={onUpdateComplex}
          onConfigSaved={(cfg) => {
            if (cfg?.user && cfg?.pass) {
              setSavedMailConfig({
                user: cfg.user,
                pass: cfg.pass,
                fromName: cfg.fromName || `مجمع ${complex.name}`,
                fromEmail: cfg.user,
                updatedAt: new Date().toISOString()
              });
            }
            setSaveSuccessMsg('تم حفظ وتحديث البريد والمفتاح في النظام السحابي للأبد بنجاح! ✅');
            setTimeout(() => setSaveSuccessMsg(null), 4000);
          }}
        />
      </div>
    </div>
  );
};
