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
  Timer
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
  dispatchPortalEmailNotification
} from '../../lib/portalEmailService';

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
      showHalaqahQuestion: true,
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

  // Registration Closing & Deadline Controls
  const [registrationDeadline, setRegistrationDeadline] = useState<string>(
    initialConfig.registrationDeadline ? initialConfig.registrationDeadline.substring(0, 16) : ''
  );
  const [isRegistrationClosedManually, setIsRegistrationClosedManually] = useState<boolean>(
    Boolean(initialConfig.isRegistrationClosedManually)
  );
  const [closedMessage, setClosedMessage] = useState<string>(
    initialConfig.closedMessage || 'عذراً، تم إغلاق باب التسجيل وتقديم الطلبات للفترة الحالية لاكتمال المقاعد المتاحة في حلقات المجمع.'
  );

  // Halaqah Question Advanced Control
  const [showHalaqahQuestion, setShowHalaqahQuestion] = useState<boolean>(
    initialConfig.fieldConfig.showHalaqahQuestion !== false
  );
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
  const [appFilter, setAppFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
  const [appSearch, setAppSearch] = useState('');
  const [selectedHalaqahFilter, setSelectedHalaqahFilter] = useState<string>('all');

  // Selected Application for Accept / Reject / View Details Modal
  const [appToAccept, setAppToAccept] = useState<StudentRegistrationApplication | null>(null);
  const [targetHalaqahId, setTargetHalaqahId] = useState<string>(halaqahs[0]?.id || '');
  const [appToReject, setAppToReject] = useState<StudentRegistrationApplication | null>(null);
  const [rejectionReason, setRejectionReason] = useState('نعتذر، اكتملت المقاعد المتاحة في هذه الفترة.');
  const [appDetailsToView, setAppDetailsToView] = useState<StudentRegistrationApplication | null>(null);
  const [appToDelete, setAppToDelete] = useState<StudentRegistrationApplication | null>(null);
  const [isProcessingApp, setIsProcessingApp] = useState(false);

  // Share link state
  const [copiedLink, setCopiedLink] = useState(false);

  // Compute portal direct URL
  const portalUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?complexPortal=${complex.id}`
    : `?complexPortal=${complex.id}`;

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

    return () => unsub();
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
        registrationDeadline: registrationDeadline ? new Date(registrationDeadline).toISOString() : null,
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
          showHalaqahQuestion,
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
        portalConfig: updatedConfig
      };

      await OmranDataService.saveComplex(updatedComplex);
      await onUpdateComplex(updatedComplex);
      setSaveSuccessMsg('تم حفظ وتحديث إعدادات البوابة والأسئلة بنجاح!');
      setTimeout(() => setSaveSuccessMsg(null), 3500);
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

      const maxJuz = appToAccept.memorizedJuzList && appToAccept.memorizedJuzList.length > 0
        ? Math.max(...appToAccept.memorizedJuzList)
        : 30;

      // Extract custom answers summary into student notes if present
      const customNotesSummary = appToAccept.customQuestionResponses && appToAccept.customQuestionResponses.length > 0
        ? ` • إجابات التسجيل: ${appToAccept.customQuestionResponses.map(r => `${r.questionLabel}: ${Array.isArray(r.answer) ? r.answer.join(', ') : r.answer}`).join(' | ')}`
        : '';

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
        notes: `تم قبوله عبر بوابة المجمع الإلكترونية • الأجزاء المحفوظة: ${appToAccept.memorizedJuzList?.join(', ') || 'لا يوجد'}${customNotesSummary}`,
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

      // 3. Dispatch Acceptance Email to Student with direct confirmation action
      if (updatedApp.email) {
        const acceptedEmail = buildApplicationAcceptedEmail(
          complex,
          updatedApp,
          targetHalaqah?.name || 'الحلقة القرآنية',
          portalUrl
        );
        dispatchPortalEmailNotification(acceptedEmail);
      }

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
        rejectionReason: rejectionReason.trim() || 'نعتذر، اكتملت المقاعد المتاحة في هذه الفترة.',
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
    } catch (e) {
      console.error('Error deleting application:', e);
    } finally {
      setIsProcessingApp(false);
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
                  {/* Halaqah Question Configuration Card */}
                  <div
                    className="p-4 sm:p-5 rounded-2xl border-2 border-b-4 space-y-4 shadow-md"
                    style={{
                      backgroundColor: theme.backgroundColor || '#131f24',
                      borderColor: showHalaqahQuestion ? themeAccent : themeCardBorder,
                      borderBottomColor: showHalaqahQuestion ? themeAccentShadow : themeCardShadow
                    }}
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center font-black"
                          style={{
                            backgroundColor: `${themeAccent}25`,
                            color: themeAccent
                          }}
                        >
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-white">سؤال اختيار الحلقة في استمارة التسجيل</h4>
                          <p className="text-[11px] text-slate-300 font-bold">
                            التحكم الكامل في ظهور سؤال الحلقة، أو تحديد حلقات معينة فقط تظهر للطلاب
                          </p>
                        </div>
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-1.5 rounded-xl border border-white/10 bg-white/5">
                        <span className="text-xs font-black text-white">
                          {showHalaqahQuestion ? 'السؤال مفعل وظاهر' : 'السؤال محذوف / مخفي'}
                        </span>
                        <input
                          type="checkbox"
                          checked={showHalaqahQuestion}
                          onChange={e => setShowHalaqahQuestion(e.target.checked)}
                          className="w-4 h-4 accent-amber-400 cursor-pointer"
                        />
                      </label>
                    </div>

                    {!showHalaqahQuestion ? (
                      <div className="p-3 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-200 text-xs font-bold leading-relaxed">
                        💡 <strong>ملاحظة:</strong> تم إخفاء سؤال اختيار الحلقة تماماً من استمارة التسجيل. سيسجل الطالب دون مطالبته باختيار حلقة معينة، وسيقوم المشرف بتعيين حلقته لاحقاً عند اعتماد الطلب.
                      </div>
                    ) : (
                      <div className="space-y-4 pt-2 border-t border-white/10">
                        {/* Custom label for halaqah question */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-black text-slate-200 block">
                            صيغة وتسمية سؤال الحلقة في الاستمارة:
                          </label>
                          <input
                            type="text"
                            value={halaqahQuestionLabel}
                            onChange={e => setHalaqahQuestionLabel(e.target.value)}
                            placeholder="مثال: اختر الحلقة المرغوبة في المجمع..."
                            className="w-full border-2 rounded-xl py-2 px-3 text-xs text-white font-bold outline-none"
                            style={{
                              backgroundColor: themeCard,
                              borderColor: themeCardBorder
                            }}
                          />
                        </div>

                        {/* Halaqah Visibility Mode */}
                        <div className="space-y-2">
                          <label className="text-xs font-black text-slate-200 block">
                            الحلقات التي تظهر للمسجلين في القائمة:
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <label
                              className={`p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer ${
                                halaqahSelectionMode === 'all' ? 'border-amber-400 bg-amber-400/10' : 'border-white/10 bg-white/5'
                              }`}
                            >
                              <div>
                                <span className="text-xs font-black text-white block">جميع حلقات المجمع</span>
                                <span className="text-[10px] text-slate-300 font-bold">
                                  إتاحة كل الحلقات المقيدة بالمجمع ({halaqahs.length} حلقات)
                                </span>
                              </div>
                              <input
                                type="radio"
                                name="halaqahSelectionMode"
                                checked={halaqahSelectionMode === 'all'}
                                onChange={() => setHalaqahSelectionMode('all')}
                                className="w-4 h-4 accent-amber-400 cursor-pointer"
                              />
                            </label>

                            <label
                              className={`p-3 rounded-xl border-2 flex items-center justify-between cursor-pointer ${
                                halaqahSelectionMode === 'specific' ? 'border-amber-400 bg-amber-400/10' : 'border-white/10 bg-white/5'
                              }`}
                            >
                              <div>
                                <span className="text-xs font-black text-white block">تحديد حلقات معينة فقط</span>
                                <span className="text-[10px] text-slate-300 font-bold">
                                  إظهار الحلقات المفتوحة واستبعاد الحلقات المكتملة
                                </span>
                              </div>
                              <input
                                type="radio"
                                name="halaqahSelectionMode"
                                checked={halaqahSelectionMode === 'specific'}
                                onChange={() => setHalaqahSelectionMode('specific')}
                                className="w-4 h-4 accent-amber-400 cursor-pointer"
                              />
                            </label>
                          </div>
                        </div>

                        {/* Specific Halaqahs Selector */}
                        {halaqahSelectionMode === 'specific' && (
                          <div className="space-y-2 pt-2 border-t border-white/10">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-amber-300">
                                اختر الحلقات المسموح بظهورها في الاستمارة ({allowedHalaqahIds.length} من {halaqahs.length}):
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setAllowedHalaqahIds(halaqahs.map(h => h.id))}
                                  className="text-[11px] font-bold text-slate-300 hover:text-white underline cursor-pointer"
                                >
                                  تحديد الكل
                                </button>
                                <span>•</span>
                                <button
                                  type="button"
                                  onClick={() => setAllowedHalaqahIds([])}
                                  className="text-[11px] font-bold text-slate-300 hover:text-red-300 underline cursor-pointer"
                                >
                                  إلغاء التحديد
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                              {halaqahs.map(h => {
                                const isChecked = allowedHalaqahIds.includes(h.id);
                                return (
                                  <label
                                    key={h.id}
                                    className={`p-2.5 rounded-xl border text-xs font-black flex items-center justify-between gap-2 cursor-pointer transition-all ${
                                      isChecked
                                        ? 'bg-amber-400/20 border-amber-400 text-white'
                                        : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/20'
                                    }`}
                                  >
                                    <div className="truncate">
                                      <span className="block truncate">{h.name}</span>
                                      {h.primaryTeacherName && (
                                        <span className="text-[10px] text-slate-400 font-bold block truncate">
                                          {h.primaryTeacherName}
                                        </span>
                                      )}
                                    </div>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleToggleHalaqahAllowed(h.id)}
                                      className="w-4 h-4 accent-amber-400 shrink-0 cursor-pointer"
                                    />
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Allow Auto Placement Option */}
                        <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
                          <div>
                            <span className="text-xs font-black text-white block">إتاحة خيار "توجيه تلقائي من المشرف"</span>
                            <span className="text-[10px] text-slate-400 font-bold">
                              يسمح للطالب باختيار توجيهه للحلقة الأنسب لمستواه إذا لم يكن يعرف الحلقة المناسبة
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            checked={allowAutoPlacement}
                            onChange={e => setAllowAutoPlacement(e.target.checked)}
                            className="w-4 h-4 accent-amber-400 cursor-pointer"
                          />
                        </label>
                      </div>
                    )}
                  </div>

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
                            <h4 className="text-sm sm:text-base font-black text-white">{app.studentName}</h4>
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
                  ))}
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
      </div>
    </div>
  );
};
