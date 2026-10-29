import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Award,
  Calendar,
  Clock,
  ExternalLink,
  Trash2,
  Edit3,
  Search,
  Eye,
  Check,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  BarChart3,
  RefreshCw,
  Trophy,
  Filter,
  Users,
  Settings,
  AlertCircle,
  BookOpen,
  Send,
  FileSpreadsheet,
  ShieldCheck,
  CheckSquare,
  Hourglass,
  Timer,
  Copy,
  AlertTriangle,
  Flame,
  Medal,
  Crown,
  Download,
  Info,
  Printer,
  X,
  BookmarkCheck,
  Unlink,
  Loader2
} from 'lucide-react';
import jsPDF from 'jspdf';
import {
  Exam,
  ExamQuestion,
  ExamQuestionType,
  ExamSubmission,
  ExamTimeLimitMode,
  Student,
  Halaqah,
  LeaderboardSettings,
  LeaderboardScope,
  GoogleOAuthConfig,
  getStudentParentPhone,
  QuranComplex,
  LibraryDocument
} from '../../types';
import { GoogleWorkspaceService } from '../../lib/googleWorkspace';
import { OmranDataService } from '../../lib/firebase';
import { StudentExamTaker } from '../StudentExamTaker';
import { darkenHex, lightenHex, getContrastTextColor } from '../../lib/themeUtils';

interface ExamsTabProps {

  exams: Exam[];
  submissions: ExamSubmission[];
  students: Student[];
  halaqahs: Halaqah[];
  currentUserId: string;
  currentUserName: string;
  isSupervisor: boolean;
  googleAuthConfig?: GoogleOAuthConfig;
  leaderboardSettings?: LeaderboardSettings;
  activeComplex?: QuranComplex | null;
  onSaveExam: (exam: Exam) => Promise<void>;
  onDeleteExam: (examId: string) => Promise<void>;
  onSaveSubmission: (submission: ExamSubmission) => Promise<void>;
  onDeleteSubmission?: (submissionId: string) => Promise<void>;
  onSaveLeaderboardSettings: (settings: LeaderboardSettings) => Promise<void>;
  onRefreshGoogleAuth?: () => Promise<void>;
  onSaveCertificate?: (cert: any) => Promise<void>;
  onSaveLibraryDoc?: (
    doc: LibraryDocument,
    options?: { blob?: Blob; htmlContent?: string; mimeType?: string; fileExtension?: string }
  ) => Promise<void>;
}

// Helper to format Arabic date preview
function formatArabicDateTime(isoString: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('ar-SA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoString;
  }
}

export const ExamsTab: React.FC<ExamsTabProps> = ({
  exams,
  submissions,
  students,
  halaqahs,
  currentUserId,
  currentUserName,
  isSupervisor,
  googleAuthConfig,
  leaderboardSettings = {
    scope: 'all_unified',
    includeExamPoints: true,
    includeEvaluationScores: true,
    updatedAt: new Date().toISOString()
  },
  onSaveExam,
  onDeleteExam,
  onSaveSubmission,
  onDeleteSubmission,
  onSaveLeaderboardSettings,
  onRefreshGoogleAuth,
  activeComplex,
  onSaveCertificate,
  onSaveLibraryDoc
}) => {
  const currentTheme = activeComplex?.theme;
  const themePrimary = currentTheme?.primaryColor || 'var(--complex-primary, #131f24)';
  const themeSecondary = currentTheme?.secondaryColor || 'var(--complex-secondary, #1b2e35)';
  const themeAccent = currentTheme?.accentColor || 'var(--complex-accent, #ffc800)';
  const themeCardBg = currentTheme?.cardColor || 'var(--complex-card, #203843)';
  const themeBorder = currentTheme?.cardColor ? lightenHex(currentTheme.cardColor, 0.18) : 'var(--complex-border, #2b4550)';
  const themeBorderBottom = currentTheme?.cardColor ? darkenHex(currentTheme.cardColor, 0.35) : 'var(--complex-card-shadow, #16262e)';
  const themeAccentShadow = currentTheme?.accentColor ? darkenHex(currentTheme.accentColor, 0.28) : 'var(--complex-accent-shadow, #e5a500)';
  const accentTextColor = currentTheme?.accentColor ? getContrastTextColor(currentTheme.accentColor) : 'var(--complex-accent-text, #131f24)';

  const [activeSubTab, setActiveSubTab] = useState<'exams' | 'submissions' | 'google_sheets'>('exams');

  const [isCreatingExam, setIsCreatingExam] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [selectedExamForSubmissions, setSelectedExamForSubmissions] = useState<string>('all');
  const [filterHalaqah, setFilterHalaqah] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isExportingSheets, setIsExportingSheets] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string; linkUrl?: string } | null>(null);
  const [modelAnswerExam, setModelAnswerExam] = useState<Exam | null>(null);

  // Teachers and supervisors can manage Google Sheets & Library account linking for the complex
  const canManageGoogleAccount = Boolean(isSupervisor || currentUserName);

  // Deletion Confirmation Modal State (Exams & Submissions)
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null);
  const [submissionToDelete, setSubmissionToDelete] = useState<ExamSubmission | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingSubmission, setIsDeletingSubmission] = useState(false);
  const [isConfirmingBulkDelete, setIsConfirmingBulkDelete] = useState(false);
  const [isBulkDeletingSubmissions, setIsBulkDeletingSubmissions] = useState(false);

  // Student Exam Certificate Modal State
  const [selectedCertSubmission, setSelectedCertSubmission] = useState<ExamSubmission | null>(null);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);
  const [certNotification, setCertNotification] = useState<string | null>(null);

  // Correction Modal State
  const [selectedSubmissionForGrading, setSelectedSubmissionForGrading] = useState<ExamSubmission | null>(null);
  const [gradingDraftScores, setGradingDraftScores] = useState<Record<string, number>>({});
  const [gradingDraftFeedbacks, setGradingDraftFeedbacks] = useState<Record<string, string>>({});
  const [gradingGeneralFeedback, setGradingGeneralFeedback] = useState('');

  // Preview / Test Exam State for Teacher
  const [previewingExam, setPreviewingExam] = useState<Exam | null>(null);
  const [previewInteractive, setPreviewInteractive] = useState(false);

  // New Exam Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formScheduleType, setFormScheduleType] = useState<'now' | 'scheduled'>('now');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().slice(0, 16));
  const [formHasDeadline, setFormHasDeadline] = useState(false);
  const [formDeadlineDate, setFormDeadlineDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  );
  const [formAttemptType, setFormAttemptType] = useState<'unlimited' | 'limited'>('unlimited');
  const [formMaxAttempts, setFormMaxAttempts] = useState(1);
  const [formTimeLimitMode, setFormTimeLimitMode] = useState<ExamTimeLimitMode>('none');
  const [formTotalTimeMinutes, setFormTotalTimeMinutes] = useState<number>(15);
  const [formQuestionTimeSeconds, setFormQuestionTimeSeconds] = useState<number>(30);
  const [formGradeVisibility, setFormGradeVisibility] = useState<'immediate' | 'after_deadline' | 'manual'>('immediate');
  const [formGrantsPoints, setFormGrantsPoints] = useState(true);
  const [formTargetHalaqat, setFormTargetHalaqat] = useState<string[]>(['all']);

  // Linked Google Sheet for Exam Results (if exported)
  const [formGoogleSpreadsheetId, setFormGoogleSpreadsheetId] = useState('');
  const [formGoogleSpreadsheetUrl, setFormGoogleSpreadsheetUrl] = useState('');

  // Questions List in Exam Builder
  const [questions, setQuestions] = useState<ExamQuestion[]>([
    {
      id: 'q-1',
      title: 'ما هي أول سورة نزلت في القرآن الكريم؟',
      type: 'multiple_choice',
      options: ['سورة الفاتحة', 'سورة العلق', 'سورة المدثر', 'سورة البقرة'],
      correctAnswer: 'سورة العلق',
      points: 5,
      explanation: 'نزلت أول خمس آيات من سورة العلق في غار حراء (اقرأ باسم ربك الذي خلق).'
    }
  ]);

  // Domain Authorization Guide Modal State & Manual Token State
  const [showDomainHelpModal, setShowDomainHelpModal] = useState(false);
  const [showPopupHelpModal, setShowPopupHelpModal] = useState(false);
  const [lastActionContext, setLastActionContext] = useState<string>('');
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [isSavingManualToken, setIsSavingManualToken] = useState(false);
  const currentHostDomain = typeof window !== 'undefined' ? window.location.hostname : 'النطاق الحالي';
  const appFullUrl = typeof window !== 'undefined' ? window.location.href : 'https://ais-dev-4kuzr3pvta2ihiexw37644-587302540771.europe-west2.run.app';
  const firebaseConsoleUrl = 'https://console.firebase.google.com/project/omran-ffbad/authentication/settings';

  const handleCopyDomain = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(currentHostDomain);
    }
    setCopiedDomain(true);
    setTimeout(() => setCopiedDomain(false), 3000);
  };

  const [isUnlinkConfirmOpen, setIsUnlinkConfirmOpen] = useState(false);
  const [isUnlinkingGoogle, setIsUnlinkingGoogle] = useState(false);
  const [isSavingExamToLibrary, setIsSavingExamToLibrary] = useState(false);

  const handleSaveManualToken = async () => {
    if (!manualTokenInput.trim()) return;
    setIsSavingManualToken(true);
    try {
      await GoogleWorkspaceService.setManualAccessToken(
        manualTokenInput.trim(),
        undefined,
        activeComplex?.id,
        activeComplex?.name
      );
      if (onRefreshGoogleAuth) await onRefreshGoogleAuth();
      setShowDomainHelpModal(false);
      setShowPopupHelpModal(false);
      setManualTokenInput('');
      setStatusMessage({
        type: 'success',
        text: `تم حفظ وتفعيل رمز تفويض Google لمجمع (${activeComplex?.name || 'المجمع الحالي'}) بنجاح!`
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `فشل حفظ الرمز: ${err.message || err}` });
    } finally {
      setIsSavingManualToken(false);
    }
  };

  const handleGoogleAuthError = (err: any, contextName: string) => {
    const errMsg = typeof err?.message === 'string' ? err.message : String(err || '');

    const isDomainError =
      err?.isUnauthorizedDomain ||
      err?.code === 'auth/unauthorized-domain' ||
      errMsg.includes('auth/unauthorized-domain');

    if (isDomainError) {
      console.warn(`[Google Auth Notice] Domain (${currentHostDomain}) requires Firebase Auth authorization during ${contextName}.`);
      setShowDomainHelpModal(true);
      setStatusMessage({
        type: 'error',
        text: `يحتاج نطاق المنصة الحالي (${currentHostDomain}) إلى إضافة في قائمة النطاقات المصرح بها (Authorized Domains).`
      });
      return;
    }

    const isPopupClosed =
      err?.isPopupClosed ||
      err?.code === 'auth/popup-closed-by-user' ||
      errMsg.includes('auth/popup-closed-by-user') ||
      errMsg.includes('popup-closed');

    if (isPopupClosed) {
      console.warn(`[Google Auth Notice] Popup was closed by user or environment during ${contextName}.`);
      setLastActionContext(contextName);
      setShowPopupHelpModal(true);
      setStatusMessage({
        type: 'error',
        text: 'تم إغلاق نافذة تسجيل الدخول من Google قبل استكمال التفويض. افتح المنصة في تبويب جديد مستقل أو أعد المحاولة مع إبقاء النافذة مفتوحة.'
      });
      return;
    }

    const isPopupBlocked =
      err?.isPopupBlocked ||
      err?.code === 'auth/popup-blocked' ||
      errMsg.includes('auth/popup-blocked') ||
      errMsg.includes('popup-blocked');

    if (isPopupBlocked) {
      console.warn(`[Google Auth Notice] Popup was blocked by browser during ${contextName}.`);
      setLastActionContext(contextName);
      setShowPopupHelpModal(true);
      setStatusMessage({
        type: 'error',
        text: 'قام المتصفح بحظر نافذة تسجيل الدخول المنبثقة. يرجى السماح بالنوافذ المنبثقة أو فتح المنصة في تبويب جديد.'
      });
      return;
    }

    console.warn(`${contextName} error:`, err?.message || err);
    setStatusMessage({
      type: 'error',
      text: `تعذر ${contextName}: ${err?.message || 'يرجى المحاولة مجدداً.'}`
    });
  };

  // Open Exam Editor
  const handleOpenCreateModal = (examToEdit?: Exam) => {
    if (examToEdit) {
      setEditingExamId(examToEdit.id);
      setFormTitle(examToEdit.title);
      setFormDescription(examToEdit.description || '');
      setFormGoogleSpreadsheetId(examToEdit.googleSpreadsheetId || '');
      setFormGoogleSpreadsheetUrl(examToEdit.googleSpreadsheetUrl || '');
      setFormScheduleType(examToEdit.scheduleType);
      setFormStartDate(examToEdit.startDate || new Date().toISOString().slice(0, 16));
      setFormHasDeadline(examToEdit.hasDeadline);
      setFormDeadlineDate(examToEdit.deadlineDate || new Date().toISOString().slice(0, 16));
      setFormAttemptType(examToEdit.attemptLimitType);
      setFormMaxAttempts(examToEdit.maxAttempts || 1);
      setFormTimeLimitMode(examToEdit.timeLimitMode || 'none');
      setFormTotalTimeMinutes(examToEdit.totalTimeMinutes || 15);
      setFormQuestionTimeSeconds(examToEdit.questionTimeSeconds || 30);
      setFormGradeVisibility(examToEdit.gradeVisibility);
      setFormGrantsPoints(examToEdit.grantsLeaderboardPoints);
      setFormTargetHalaqat(examToEdit.targetHalaqat || ['all']);
      setQuestions(JSON.parse(JSON.stringify(examToEdit.questions || [])));
    } else {
      setEditingExamId(null);
      setFormTitle('');
      setFormDescription('');
      setFormGoogleSpreadsheetId('');
      setFormGoogleSpreadsheetUrl('');
      setFormScheduleType('now');
      setFormStartDate(new Date().toISOString().slice(0, 16));
      setFormHasDeadline(false);
      setFormDeadlineDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
      setFormAttemptType('unlimited');
      setFormMaxAttempts(1);
      setFormTimeLimitMode('none');
      setFormTotalTimeMinutes(15);
      setFormQuestionTimeSeconds(30);
      setFormGradeVisibility('immediate');
      setFormGrantsPoints(true);
      setFormTargetHalaqat(['all']);
      setQuestions([
        {
          id: `q-${Date.now()}-1`,
          title: '',
          type: 'multiple_choice',
          options: ['الخيار 1', 'الخيار 2', 'الخيار 3'],
          correctAnswer: 'الخيار 1',
          points: 5
        }
      ]);
    }
    setIsCreatingExam(true);
  };

  // Add a new question to current exam draft
  const handleAddQuestion = (type: ExamQuestionType = 'multiple_choice') => {
    const newQ: ExamQuestion = {
      id: `q-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title: '',
      type,
      options: type === 'true_false' ? ['صح', 'خطأ'] : type === 'multiple_choice' ? ['الخيار 1', 'الخيار 2', 'الخيار 3'] : undefined,
      correctAnswer: type === 'true_false' ? 'صح' : type === 'multiple_choice' ? 'الخيار 1' : undefined,
      points: 5
    };
    setQuestions([...questions, newQ]);
  };

  const handleUpdateQuestion = (qId: string, updates: Partial<ExamQuestion>) => {
    setQuestions(questions.map(q => (q.id === qId ? { ...q, ...updates } : q)));
  };

  const handleRemoveQuestion = (qId: string) => {
    if (questions.length <= 1) {
      setStatusMessage({ type: 'error', text: 'يجب أن يحتوي الاختبار على سؤال واحد على الأقل.' });
      return;
    }
    setQuestions(questions.filter(q => q.id !== qId));
  };

  // Save Exam directly to Firestore
  const handleSaveExamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setStatusMessage({ type: 'error', text: 'يرجى كتابة اسم الاختبار (إلزامي).' });
      return;
    }

    if (questions.length === 0) {
      setStatusMessage({ type: 'error', text: 'يرجى إضافة سؤال واحد على الأقل للاختبار.' });
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].title.trim()) {
        setStatusMessage({ type: 'error', text: `يرجى كتابة نص السؤال رقم (${i + 1}).` });
        return;
      }
    }

    setIsSaving(true);
    setStatusMessage(null);

    try {
      const totalPoints = questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);
      const examId = editingExamId || `exam-${Date.now()}`;
      const existingExam = editingExamId ? exams.find(ex => ex.id === editingExamId) : null;

      const targetSpreadsheetId = formGoogleSpreadsheetId || existingExam?.googleSpreadsheetId;

      const examObj: Exam = {
        id: examId,
        title: formTitle.trim(),
        description: formDescription.trim(),
        deliveryMode: 'platform',
        googleSpreadsheetId: targetSpreadsheetId,
        googleSpreadsheetUrl: formGoogleSpreadsheetUrl.trim() || existingExam?.googleSpreadsheetUrl || undefined,
        scheduleType: formScheduleType,
        startDate: formScheduleType === 'scheduled' ? formStartDate : new Date().toISOString(),
        hasDeadline: formHasDeadline,
        deadlineDate: formHasDeadline ? formDeadlineDate : undefined,
        attemptLimitType: formAttemptType,
        maxAttempts: formAttemptType === 'limited' ? Number(formMaxAttempts) : undefined,
        timeLimitMode: formTimeLimitMode,
        totalTimeMinutes: formTimeLimitMode === 'total' ? Math.max(1, Number(formTotalTimeMinutes)) : undefined,
        questionTimeSeconds: formTimeLimitMode === 'per_question' ? Math.max(5, Number(formQuestionTimeSeconds)) : undefined,
        gradeVisibility: formGradeVisibility,
        grantsLeaderboardPoints: formGrantsPoints,
        totalPoints,
        targetHalaqat: formTargetHalaqat.length > 0 ? formTargetHalaqat : ['all'],
        questions,
        createdById: currentUserId,
        createdByName: currentUserName,
        createdAt: editingExamId
          ? (existingExam?.createdAt || new Date().toISOString())
          : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await onSaveExam(examObj);
      setIsCreatingExam(false);
      setStatusMessage({
        type: 'success',
        text: `تم حفظ اختبار "${examObj.title}" بنجاح في المنصة`
      });
      setTimeout(() => setStatusMessage(null), 6000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `حدث خطأ أثناء حفظ الاختبار: ${err.message || err}` });
    } finally {
      setIsSaving(false);
    }
  };

  // Perform Real Cloud Deletion
  const handleConfirmDeleteExam = async () => {
    if (!examToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteExam(examToDelete.id);
      setStatusMessage({
        type: 'success',
        text: `تم حذف اختبار "${examToDelete.title}" وكافة بياناته من قاعدة البيانات السحابية بنجاح.`
      });
      setExamToDelete(null);
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `حدث خطأ أثناء حذف الاختبار: ${err.message || err}`
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Perform Real Cloud Deletion of Student Submission
  const handleConfirmDeleteSubmission = async () => {
    if (!submissionToDelete) return;
    setIsDeletingSubmission(true);
    try {
      if (onDeleteSubmission) {
        await onDeleteSubmission(submissionToDelete.id);
      } else {
        await OmranDataService.deleteSubmission(submissionToDelete.id);
      }
      setStatusMessage({
        type: 'success',
        text: `تم حذف تسليم الطالب "${submissionToDelete.studentName}" لاختبار "${submissionToDelete.examTitle}" بنجاح!`
      });
      setSubmissionToDelete(null);
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `حدث خطأ أثناء حذف التسليم: ${err.message || err}`
      });
    } finally {
      setIsDeletingSubmission(false);
    }
  };

  // Perform Bulk Deletion of Submissions
  const handleConfirmBulkDeleteSubmissions = async () => {
    if (filteredSubmissions.length === 0) return;
    setIsBulkDeletingSubmissions(true);
    try {
      const count = filteredSubmissions.length;
      for (const sub of filteredSubmissions) {
        if (onDeleteSubmission) {
          await onDeleteSubmission(sub.id);
        } else {
          await OmranDataService.deleteSubmission(sub.id);
        }
      }
      setStatusMessage({
        type: 'success',
        text: `تم حذف كافة الردود المحددة (${count}) بنجاح من قاعدة البيانات السحابية!`
      });
      setIsConfirmingBulkDelete(false);
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `حدث خطأ أثناء حذف الردود: ${err.message || err}`
      });
    } finally {
      setIsBulkDeletingSubmissions(false);
    }
  };

  // Connect Google Account strictly isolated for this Complex (used for Google Sheets + Drive Library)
  const handleConnectGoogle = async () => {
    if (!canManageGoogleAccount) {
      setStatusMessage({
        type: 'error',
        text: 'عذراً، يرجى تسجيل الدخول بحساب معلم أو مشرف لربط وتفويض حساب Google الخاص بالمجمع.'
      });
      return;
    }
    setIsSaving(true);
    try {
      const { email } = await GoogleWorkspaceService.linkGoogleAccount(activeComplex?.id, activeComplex?.name);
      await GoogleWorkspaceService.ensureComplexLibraryFolders(activeComplex?.id, activeComplex?.name).catch(() => {});
      if (onRefreshGoogleAuth) await onRefreshGoogleAuth();
      setStatusMessage({
        type: 'success',
        text: `تم ربط حساب Google (${email}) بمجمع "${activeComplex?.name || 'المجمع الحالي'}" بشكل مستقل وتفعيل المكتبة والاختبارات!`
      });
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err: any) {
      handleGoogleAuthError(err, 'ربط حساب Google للمجمع');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmUnlinkGoogle = async () => {
    setIsUnlinkingGoogle(true);
    try {
      await GoogleWorkspaceService.disconnectGoogleAccount(activeComplex?.id);
      if (onRefreshGoogleAuth) await onRefreshGoogleAuth();
      setIsUnlinkConfirmOpen(false);
      setStatusMessage({
        type: 'success',
        text: `تم إلغاء ربط حساب Google عن مجمع "${activeComplex?.name || 'المجمع الحالي'}" فقط دون المساس ببقية المجمعات.`
      });
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: `تعذر إلغاء الربط: ${err?.message || err}` });
    } finally {
      setIsUnlinkingGoogle(false);
    }
  };

  // Save Exam Results directly into Complex's Library (Google Drive -> مجلد الاختبارات)
  const handleSaveExamResultsToLibrary = async (targetExam?: Exam) => {
    if (!onSaveLibraryDoc || isSavingExamToLibrary) return;
    const relevantSubmissions = targetExam
      ? submissions.filter(s => s.examId === targetExam.id)
      : filteredSubmissions.length > 0 && !targetExam
      ? filteredSubmissions
      : submissions;

    const titleLabel = targetExam ? targetExam.title : 'كافة اختبارات المجمع';
    const todayIso = new Date().toISOString().split('T')[0];
    const complexLabel = activeComplex?.name || 'مجمع تحفيظ القرآن الكريم';

    setIsSavingExamToLibrary(true);
    try {
      const rowsHtml = relevantSubmissions
        .map(
          (sub, idx) => `<tr>
            <td style="padding:10px;border:1px solid #cbd5e1;text-align:center;font-weight:700;">${idx + 1}</td>
            <td style="padding:10px;border:1px solid #cbd5e1;font-weight:800;">${sub.studentName}</td>
            <td style="padding:10px;border:1px solid #cbd5e1;">${sub.halaqahName || 'الحلقة'}</td>
            <td style="padding:10px;border:1px solid #cbd5e1;">${sub.examTitle}</td>
            <td style="padding:10px;border:1px solid #cbd5e1;text-align:center;font-weight:800;">${sub.totalScoreEarned} / ${sub.maxPossibleScore}</td>
            <td style="padding:10px;border:1px solid #cbd5e1;text-align:center;font-weight:800;">${sub.percentage}%</td>
            <td style="padding:10px;border:1px solid #cbd5e1;text-align:center;">${sub.status === 'completed' ? 'معتمد' : 'قيد المراجعة'}</td>
          </tr>`
        )
        .join('');

      const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>كشف نتائج الاختبارات - ${titleLabel} - ${todayIso}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&display=swap" rel="stylesheet" />
</head>
<body style="font-family:'Cairo',sans-serif;background:#f8fafc;color:#0f172a;padding:32px;direction:rtl;">
  <div style="max-width:1000px;margin:0 auto;background:#ffffff;border:3px solid #065f46;border-radius:20px;padding:28px;">
    <h1 style="margin:0 0 8px;color:#064e3b;font-size:22px;font-weight:900;">${complexLabel} • كشف نتائج الاختبارات</h1>
    <p style="margin:0 0 18px;color:#475569;font-size:14px;font-weight:700;">الاختبار: ${titleLabel} • التاريخ: ${todayIso} • عدد التسليمات: ${relevantSubmissions.length}</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:#064e3b;color:#ffffff;">
          <th style="padding:10px;border:1px solid #064e3b;">#</th>
          <th style="padding:10px;border:1px solid #064e3b;text-align:right;">الطالب</th>
          <th style="padding:10px;border:1px solid #064e3b;text-align:right;">الحلقة</th>
          <th style="padding:10px;border:1px solid #064e3b;text-align:right;">الاختبار</th>
          <th style="padding:10px;border:1px solid #064e3b;">الدرجة</th>
          <th style="padding:10px;border:1px solid #064e3b;">النسبة</th>
          <th style="padding:10px;border:1px solid #064e3b;">الحالة</th>
        </tr>
      </thead>
      <tbody>${rowsHtml || '<tr><td colspan="7" style="padding:16px;text-align:center;">لا توجد تسليمات مسجلة بعد</td></tr>'}</tbody>
    </table>
  </div>
</body>
</html>`;

      const libDoc: LibraryDocument = {
        id: `lib_exam_res_${targetExam?.id || 'all'}_${Date.now()}`,
        title: `كشف نتائج الاختبار - ${titleLabel} - ${todayIso}`,
        type: 'pdf_report',
        sectionCategory: 'exams',
        complexId: activeComplex?.id,
        complexName: activeComplex?.name,
        createdAt: new Date().toISOString(),
        createdBy: currentUserName,
        createdByName: currentUserName,
        htmlContent,
        summaryText: `كشف نتائج (${relevantSubmissions.length}) تسليم لاختبار "${titleLabel}" بتاريخ ${todayIso}`
      };

      await onSaveLibraryDoc(libDoc, {
        htmlContent,
        mimeType: 'text/html',
        fileExtension: '.html'
      });

      setStatusMessage({
        type: 'success',
        text: `تم حفظ كشف نتائج "${titleLabel}" بنجاح في مكتبة المجمع داخل مجلد الاختبارات على Google Drive!`
      });
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err: any) {
      if (err?.message !== 'LIBRARY_NOT_LINKED') {
        setStatusMessage({ type: 'error', text: `تعذر الحفظ في المكتبة: ${err?.message || err}` });
      }
    } finally {
      setIsSavingExamToLibrary(false);
    }
  };

  // Export Results to Google Sheets
  const handleExportToGoogleSheet = async (targetExam?: Exam) => {
    const relevantSubmissions = targetExam
      ? submissions.filter(s => s.examId === targetExam.id)
      : submissions;

    if (relevantSubmissions.length === 0) {
      setStatusMessage({
        type: 'error',
        text: 'لا توجد تسليمات مسجلة لتصديرها حالياً.'
      });
      setTimeout(() => setStatusMessage(null), 4000);
      return;
    }

    setIsExportingSheets(true);
    setStatusMessage(null);

    try {
      let token = await GoogleWorkspaceService.getValidAccessToken(activeComplex?.id);
      if (!token) {
        const { accessToken } = await GoogleWorkspaceService.linkGoogleAccount(activeComplex?.id, activeComplex?.name);
        token = accessToken;
        if (onRefreshGoogleAuth) await onRefreshGoogleAuth();
      }

      const title = targetExam ? targetExam.title : 'كافة اختبارات المنصة';

      if (targetExam?.googleSpreadsheetId) {
        // Sync & update the existing sheet instead of creating a new one each time
        await GoogleWorkspaceService.syncSubmissionsToSheet(targetExam.googleSpreadsheetId, relevantSubmissions, token);
        const spreadsheetUrl = targetExam.googleSpreadsheetUrl || `https://docs.google.com/spreadsheets/d/${targetExam.googleSpreadsheetId}/edit`;
        setStatusMessage({
          type: 'success',
          text: `تم تحديث جدول Google Sheets المعمول مسبقاً وتصدير (${relevantSubmissions.length}) تسليم بنجاح!`,
          linkUrl: spreadsheetUrl
        });
      } else {
        // Create new sheet inside this Complex's 'exams' Drive folder and link to the exam
        const result = await GoogleWorkspaceService.exportExamResultsToGoogleSheet(
          title,
          relevantSubmissions,
          token,
          activeComplex?.id,
          activeComplex?.name
        );
        if (targetExam && onSaveExam) {
          await onSaveExam({
            ...targetExam,
            googleSpreadsheetId: result.spreadsheetId,
            googleSpreadsheetUrl: result.spreadsheetUrl
          });
        }

        // Save sheet document to library
        const targetHalaqahId = targetExam?.targetHalaqat && targetExam.targetHalaqat.length === 1 && targetExam.targetHalaqat[0] !== 'all' ? targetExam.targetHalaqat[0] : undefined;
        const targetHalaqahName = targetHalaqahId ? halaqahs.find(h => h.id === targetHalaqahId)?.name : 'كافة الحلقات';
        try {
          const sheetLibDoc: LibraryDocument = {
            id: `lib-sheet-${result.spreadsheetId}`,
            title: `جدول درجات: ${title}`,
            type: 'google_sheet',
            sectionCategory: 'exams',
            driveFileId: result.spreadsheetId,
            driveWebViewLink: result.spreadsheetUrl,
            date: new Date().toISOString().split('T')[0],
            description: `كشف درجات ونتائج (${relevantSubmissions.length}) طالب تم تصديره وأرشفته على Google Sheets`,
            fileUrl: result.spreadsheetUrl,
            googleUrl: result.spreadsheetUrl,
            googleSpreadsheetId: result.spreadsheetId,
            halaqahId: targetHalaqahId,
            halaqahName: targetHalaqahName,
            complexId: activeComplex?.id,
            complexName: activeComplex?.name,
            createdByName: currentUserName,
            createdAt: new Date().toISOString(),
            tags: ['اختبار', 'Google Sheets', targetHalaqahName || 'كافة الحلقات']
          };
          await OmranDataService.saveLibraryDocument(sheetLibDoc);
        } catch (libErr) {
          console.warn('Save exported sheet to library warning:', libErr);
        }

        setStatusMessage({
          type: 'success',
          text: `تم إنشاء جدول Google Sheets وحفظه في مكتبة المجمع (مجلد الاختبارات) وتصدير (${relevantSubmissions.length}) تسليم بنجاح!`,
          linkUrl: result.spreadsheetUrl
        });
      }
    } catch (err: any) {
      handleGoogleAuthError(err, 'تصدير النتائج إلى Google Sheets');
    } finally {
      setIsExportingSheets(false);
    }
  };

  // Instant CSV / Excel Download Fallback
  const handleDownloadCSV = (targetExam?: Exam) => {
    const relevantSubmissions = targetExam
      ? submissions.filter(s => s.examId === targetExam.id)
      : submissions;

    if (relevantSubmissions.length === 0) {
      setStatusMessage({ type: 'error', text: 'لا توجد تسليمات مسجلة للتحميل.' });
      return;
    }

    const headers = [
      'اسم الطالب',
      'الحلقة',
      'عنوان الاختبار',
      'رقم المحاولة',
      'تاريخ التسليم',
      'الدرجة المحصلة',
      'الدرجة القصوى',
      'النسبة المئوية',
      'نقاط لوحة الشرف',
      'حالة التصحيح',
      'ملاحظات المعلم'
    ];

    const rows = relevantSubmissions.map(sub => [
      `"${sub.studentName}"`,
      `"${sub.halaqahName || 'الحلقة'}"`,
      `"${sub.examTitle}"`,
      sub.attemptNumber,
      `"${new Date(sub.submittedAt).toLocaleString('ar-SA')}"`,
      sub.totalScoreEarned,
      sub.maxPossibleScore,
      `"${sub.percentage}%"`,
      sub.pointsGrantedForLeaderboard,
      sub.status === 'completed' ? '"معتمد"' : '"بانتظار التصحيح"',
      `"${(sub.teacherGeneralFeedback || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const compTag = activeComplex?.name ? activeComplex.name.replace(/\s+/g, '_') : 'المجمع';
    link.setAttribute('download', `نتائج_${targetExam ? targetExam.title : 'كافة_الاختبارات'}_${compTag}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open Submission Grading Modal
  const handleOpenGrading = (sub: ExamSubmission) => {
    setSelectedSubmissionForGrading(sub);
    const initialScores: Record<string, number> = {};
    const initialFeedbacks: Record<string, string> = {};

    sub.answers.forEach(ans => {
      initialScores[ans.questionId] = ans.pointsEarned;
      initialFeedbacks[ans.questionId] = ans.teacherFeedback || '';
    });

    setGradingDraftScores(initialScores);
    setGradingDraftFeedbacks(initialFeedbacks);
    setGradingGeneralFeedback(sub.teacherGeneralFeedback || '');
  };

  // Save Graded Submission
  const handleSaveGrading = async () => {
    if (!selectedSubmissionForGrading) return;
    setIsSaving(true);

    try {
      const updatedAnswers = selectedSubmissionForGrading.answers.map(ans => {
        const assignedScore = gradingDraftScores[ans.questionId] !== undefined
          ? Number(gradingDraftScores[ans.questionId])
          : ans.pointsEarned;
        const feedback = gradingDraftFeedbacks[ans.questionId] || '';

        return {
          ...ans,
          pointsEarned: Math.min(Math.max(0, assignedScore), ans.maxPoints),
          teacherFeedback: feedback
        };
      });

      const totalEarned = updatedAnswers.reduce((sum, a) => sum + a.pointsEarned, 0);
      const maxScore = selectedSubmissionForGrading.maxPossibleScore || 1;
      const percentage = Math.round((totalEarned / maxScore) * 100);

      const updatedSub: ExamSubmission = {
        ...selectedSubmissionForGrading,
        answers: updatedAnswers,
        totalScoreEarned: totalEarned,
        percentage,
        pointsGrantedForLeaderboard: totalEarned,
        status: 'completed',
        gradedAt: new Date().toISOString(),
        gradedByTeacherName: currentUserName,
        teacherGeneralFeedback: gradingGeneralFeedback
      };

      await onSaveSubmission(updatedSub);
      setSelectedSubmissionForGrading(null);
      setStatusMessage({ type: 'success', text: 'تم اعتماد وتصحيح تسليم الطالب وحفظ الدرجات سحابياً بنجاح.' });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch {
      setStatusMessage({ type: 'error', text: 'حدث خطأ أثناء حفظ التصحيح.' });
    } finally {
      setIsSaving(false);
    }
  };


  // Filtered Exams
  const filteredExams = exams.filter(ex => {
    if (filterHalaqah !== 'all') {
      const matches = ex.targetHalaqat.includes('all') || ex.targetHalaqat.includes(filterHalaqah);
      if (!matches) return false;
    }
    if (searchQuery.trim()) {
      return ex.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ex.description && ex.description.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return true;
  });

  // Filtered Submissions
  const filteredSubmissions = submissions.filter(sub => {
    if (selectedExamForSubmissions !== 'all' && sub.examId !== selectedExamForSubmissions) return false;
    if (filterHalaqah !== 'all' && sub.halaqahId !== filterHalaqah) return false;
    if (searchQuery.trim()) {
      return sub.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.examTitle.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Tab Header Banner */}
      <div
        className="relative overflow-hidden rounded-[28px] border-2 border-b-4 p-6 sm:p-7 shadow-xl transition-all select-none"
        style={{
          backgroundColor: themeSecondary,
          borderColor: themeBorder,
          borderBottomColor: themeBorderBottom
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div
              className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border-2 border-b-2 text-xs font-black mb-2"
              style={{
                backgroundColor: `${themeAccent}20`,
                color: themeAccent,
                borderColor: `${themeAccent}50`
              }}
            >
              <Sparkles className="w-3.5 h-3.5" style={{ color: themeAccent }} />
              <span>نظام الاختبارات والتقييمات المتكامل • {activeComplex?.name || 'المنظومة القرآنية'}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-heading text-white flex items-center gap-2">
              منظومة الاختبارات والتقييمات القرآنية السحابية
            </h2>
            <p className="text-slate-200 text-xs sm:text-sm font-bold mt-1.5 max-w-2xl leading-relaxed">
              إنشاء اختبارات إلكترونية تفاعلية، تحديد المؤقتات والمحاولات، تصحيح المقالي، مزامنة النتائج سحابياً، وتصديرها إلى Google Sheets.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => handleExportToGoogleSheet()}
              disabled={isExportingSheets}
              className="px-4 py-2.5 rounded-2xl border-2 border-b-4 font-black text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer active:translate-y-0.5"
              style={{
                backgroundColor: themeCardBg,
                borderColor: themeBorder,
                borderBottomColor: themeBorderBottom,
                color: '#ffffff'
              }}
              title="تصدير النتائج إلى جدول Google Sheets"
            >
              <FileSpreadsheet className={`w-4 h-4 ${isExportingSheets ? 'animate-spin' : ''}`} style={{ color: themeAccent }} />
              <span>{isExportingSheets ? 'جارٍ تصدير Sheets...' : 'تصدير إلى Google Sheets'}</span>
            </button>

            <button
              onClick={() => handleOpenCreateModal()}
              className="px-5 py-2.5 rounded-2xl border-2 border-b-4 font-black text-sm flex items-center gap-2 shadow-lg transition-all cursor-pointer active:translate-y-0.5 hover:brightness-110"
              style={{
                backgroundColor: themeAccent,
                borderColor: lightenHex(themeAccent, 0.18),
                borderBottomColor: themeAccentShadow,
                color: accentTextColor
              }}
            >
              <Plus className="w-5 h-5" style={{ color: accentTextColor }} />
              <span>إنشاء اختبار جديد</span>
            </button>
          </div>
        </div>

        {/* Sub-Tabs Selector */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t" style={{ borderColor: themeBorder }}>
          <button
            onClick={() => setActiveSubTab('exams')}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer border-2 active:translate-y-0.5"
            style={activeSubTab === 'exams' ? {
              backgroundColor: themeAccent,
              color: accentTextColor,
              borderColor: lightenHex(themeAccent, 0.18),
              borderBottomColor: themeAccentShadow,
              borderBottomWidth: '4px'
            } : {
              backgroundColor: themeCardBg,
              borderColor: themeBorder,
              borderBottomColor: themeBorderBottom,
              borderBottomWidth: '4px',
              color: '#ffffff'
            }}
          >
            <FileText className="w-4 h-4" style={{ color: activeSubTab === 'exams' ? accentTextColor : themeAccent }} />
            <span>قائمة الاختبارات ({exams.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('submissions')}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer border-2 active:translate-y-0.5"
            style={activeSubTab === 'submissions' ? {
              backgroundColor: themeAccent,
              color: accentTextColor,
              borderColor: lightenHex(themeAccent, 0.18),
              borderBottomColor: themeAccentShadow,
              borderBottomWidth: '4px'
            } : {
              backgroundColor: themeCardBg,
              borderColor: themeBorder,
              borderBottomColor: themeBorderBottom,
              borderBottomWidth: '4px',
              color: '#ffffff'
            }}
          >
            <CheckSquare className="w-4 h-4" style={{ color: activeSubTab === 'submissions' ? accentTextColor : themeAccent }} />
            <span>التسليمات والتصحيح ({submissions.length})</span>
            {submissions.filter(s => s.status === 'needs_grading').length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('google_sheets')}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-black flex items-center gap-2 transition-all cursor-pointer border-2 active:translate-y-0.5"
            style={activeSubTab === 'google_sheets' ? {
              backgroundColor: themeAccent,
              color: accentTextColor,
              borderColor: lightenHex(themeAccent, 0.18),
              borderBottomColor: themeAccentShadow,
              borderBottomWidth: '4px'
            } : {
              backgroundColor: themeCardBg,
              borderColor: themeBorder,
              borderBottomColor: themeBorderBottom,
              borderBottomWidth: '4px',
              color: '#ffffff'
            }}
          >
            <FileSpreadsheet className="w-4 h-4" style={{ color: activeSubTab === 'google_sheets' ? accentTextColor : themeAccent }} />
            <span>ربط وتصدير Google Sheets</span>
            {googleAuthConfig?.isLinked ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                حساب متصل
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                ربط الحساب
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Status Message Notification */}
      {statusMessage && (
        <div
          className={`p-4 rounded-2xl border text-sm font-semibold flex items-center justify-between gap-3 transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>

          {statusMessage.linkUrl && (
            <a
              href={statusMessage.linkUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 rounded-xl bg-[#fbbf24] text-[#064e3b] font-black text-xs flex items-center gap-1.5 shadow-md hover:bg-[#f59e0b] shrink-0"
            >
              <span>فتح جدول Google Sheets</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      )}

      {/* SUBTAB 1: EXAMS LIST */}
      {activeSubTab === 'exams' && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#022c22]/80 border border-[#065f46] p-4 rounded-2xl">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-emerald-400 absolute right-3.5 top-3.5" />
              <input
                type="text"
                placeholder="بحث باسم الاختبار أو الوصف..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-4 pr-10 py-2 rounded-xl bg-[#064e3b]/60 border border-[#065f46] text-white text-xs placeholder:text-emerald-300/50 focus:border-[#fbbf24] focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-emerald-200 font-bold shrink-0">تصفية الحلقة:</span>
              <select
                value={filterHalaqah}
                onChange={e => setFilterHalaqah(e.target.value)}
                className="text-xs text-emerald-100 bg-[#064e3b]/80 border border-[#065f46] rounded-xl px-3 py-2 focus:border-[#fbbf24] focus:outline-none cursor-pointer"
              >
                <option value="all">جميع الحلقات</option>
                {halaqahs.map(h => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Exams Grid */}
          {filteredExams.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-3xl bg-[#022c22]/50 border border-[#065f46] space-y-3">
              <FileText className="w-14 h-14 text-emerald-500/40 mx-auto" />
              <h3 className="text-base font-bold text-white">لا توجد اختبارات مسجلة حالياً</h3>
              <p className="text-xs text-emerald-200/70 max-w-sm mx-auto">
                قم بالضغط على زر "إنشاء اختبار جديد" لإعداد اختبار إلكتروني تفاعلي للطلاب في المنصة.
              </p>
              <button
                onClick={() => handleOpenCreateModal()}
                className="px-5 py-2 rounded-xl bg-[#fbbf24] text-[#064e3b] font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-lg"
              >
                <Plus className="w-4 h-4" />
                <span>إنشاء اختبار الآن</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredExams.map(exam => {
                const examSubmissions = submissions.filter(s => s.examId === exam.id);
                const isExpired = exam.hasDeadline && exam.deadlineDate && new Date(exam.deadlineDate) < new Date();

                return (
                  <div
                    key={exam.id}
                    className="rounded-3xl bg-[#022c22]/90 border border-[#065f46] p-5 shadow-xl hover:border-[#fbbf24]/50 transition-all flex flex-col justify-between gap-4"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                            <CheckSquare className="w-3 h-3 text-emerald-400" />
                            منصة عُمْرَان
                          </span>

                          {isExpired ? (
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-950/80 text-rose-300 border border-rose-600/40">
                              انتهى موعد التسليم
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              متاح ونشط للطلاب
                            </span>
                          )}

                          {exam.grantsLeaderboardPoints && (
                            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                              <Award className="w-3 h-3 text-amber-400" />
                              {exam.totalPoints} نقطة شرف
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] text-emerald-300/80 font-bold">
                          {exam.questions.length} أسئلة • {exam.totalPoints} درجة
                        </span>
                      </div>

                      {/* Title & Description */}
                      <h3 className="text-base font-bold text-white line-clamp-1">{exam.title}</h3>
                      {exam.description && (
                        <p className="text-xs text-emerald-200/80 mt-1 line-clamp-2">{exam.description}</p>
                      )}

                      {/* Info Pills */}
                      <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-emerald-900/60 text-[11px] text-emerald-200/90">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>
                            المحاولات: {exam.attemptLimitType === 'limited' ? `${exam.maxAttempts} محاولات` : 'غير محدود'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Hourglass className="w-3.5 h-3.5 text-emerald-400" />
                          <span>
                            {exam.timeLimitMode === 'total'
                              ? `الوقت: ${exam.totalTimeMinutes || 15} دقيقة`
                              : exam.timeLimitMode === 'per_question'
                              ? `الوقت: ${exam.questionTimeSeconds || 30} ث/سؤال`
                              : 'الوقت: غير مقيد'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                          <span>
                            {exam.hasDeadline && exam.deadlineDate
                              ? `الانتهاء: ${formatArabicDateTime(exam.deadlineDate)}`
                              : 'متاح دائماً'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-emerald-400" />
                          <span>
                            التسليمات: {examSubmissions.length} طالب
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Eye className="w-3.5 h-3.5 text-amber-400" />
                          <span>
                            النتيجة: {exam.gradeVisibility === 'immediate' ? 'فوري' : exam.gradeVisibility === 'after_deadline' ? 'بعد الانتهاء' : 'بعد التصحيح'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-emerald-400" />
                          <span>
                            {exam.targetHalaqat.includes('all') ? 'جميع الحلقات' : `${exam.targetHalaqat.length} حلقات`}
                          </span>
                        </div>
                      </div>

                      {/* Cloud & Export Actions for this exam */}
                      <div className="mt-4 pt-3 border-t border-emerald-900/60 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {exam.googleSpreadsheetUrl && (
                            <a
                              href={exam.googleSpreadsheetUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] px-2.5 py-1.5 rounded-xl bg-emerald-900/70 hover:bg-emerald-800 text-emerald-200 border border-emerald-600/50 flex items-center gap-1 font-bold transition-all"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5 text-[#fbbf24]" />
                              <span>جدول الدرجات</span>
                            </a>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {onSaveLibraryDoc && (
                            <button
                              type="button"
                              onClick={() => handleSaveExamResultsToLibrary(exam)}
                              disabled={isSavingExamToLibrary}
                              className="text-[11px] px-3 py-1.5 rounded-xl border border-b-2 border-emerald-400 border-b-emerald-700 bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1.5 transition-all cursor-pointer font-black shadow-sm active:translate-y-[1px]"
                              title="حفظ نتائج الاختبار في المكتبة (مجلد الاختبارات على Google Drive)"
                            >
                              <BookmarkCheck className="w-3.5 h-3.5" />
                              <span>حفظ في المكتبة</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleExportToGoogleSheet(exam)}
                            disabled={isExportingSheets}
                            className="text-[11px] px-3 py-1.5 rounded-xl bg-[#022c22] hover:bg-[#064e3b] text-[#f0f9f6] border border-[#fbbf24]/30 hover:border-[#fbbf24] flex items-center gap-1.5 transition-all cursor-pointer font-bold shadow-sm"
                            title="تصدير نتائج هذا الاختبار إلى Google Sheets"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-[#fbbf24]" />
                            <span>تصدير Sheets</span>
                          </button>

                          <button
                            onClick={() => handleDownloadCSV(exam)}
                            className="text-[11px] px-3 py-1.5 rounded-xl bg-[#022c22] hover:bg-[#064e3b] text-[#f0f9f6] border border-[#fbbf24]/30 hover:border-[#fbbf24] flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                            title="تحميل النتائج كملف Excel / CSV"
                          >
                            <Download className="w-3.5 h-3.5 text-[#fbbf24]" />
                            <span>CSV</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-[#fbbf24]/15">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setPreviewingExam(exam)}
                          className="px-3 py-1.5 rounded-xl bg-[#022c22] hover:bg-[#064e3b] text-[#f0f9f6] border border-[#fbbf24]/30 hover:border-[#fbbf24] text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                        >
                          <Eye className="w-3.5 h-3.5 text-[#fbbf24]" />
                          <span>معاينة وتجربة</span>
                        </button>
                        <button
                          onClick={() => setModelAnswerExam(exam)}
                          className="px-3 py-1.5 rounded-xl bg-[#064e3b] hover:bg-[#022c22] text-[#86efac] hover:text-white border border-emerald-500/40 hover:border-emerald-400 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                          title="عرض وتدقيق نموذج الإجابة النموذجي للاختبار وتوزيع الدرجات والشرح"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>نموذج الإجابة</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedExamForSubmissions(exam.id);
                            setActiveSubTab('submissions');
                          }}
                          className="px-3 py-1.5 rounded-xl bg-[#022c22] hover:bg-[#064e3b] text-[#fbbf24] border border-[#fbbf24]/40 hover:border-[#fbbf24] text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                        >
                          <CheckSquare className="w-3.5 h-3.5 text-[#fbbf24]" />
                          <span>التسليمات ({examSubmissions.length})</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenCreateModal(exam)}
                          className="p-2 rounded-xl text-emerald-300 hover:text-[#fbbf24] hover:bg-emerald-900/60 transition-all cursor-pointer"
                          title="تعديل الاختبار"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setExamToDelete(exam)}
                          className="p-2 rounded-xl text-rose-300 hover:text-rose-100 hover:bg-rose-950/60 transition-all cursor-pointer"
                          title="حذف الاختبار"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: SUBMISSIONS & GRADING */}
      {activeSubTab === 'submissions' && (
        <div className="space-y-4">
          {/* Submissions Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#022c22]/80 border border-[#065f46] p-4 rounded-2xl">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-2">
                <span className="text-xs text-emerald-200 font-bold shrink-0">تحديد الاختبار:</span>
                <select
                  value={selectedExamForSubmissions}
                  onChange={e => setSelectedExamForSubmissions(e.target.value)}
                  className="text-xs text-emerald-100 bg-[#064e3b]/80 border border-[#065f46] rounded-xl px-3 py-2 focus:border-[#fbbf24] focus:outline-none cursor-pointer"
                >
                  <option value="all">جميع الاختبارات</option>
                  {exams.map(ex => (
                    <option key={ex.id} value={ex.id}>
                      {ex.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-emerald-200 font-bold shrink-0">الحلقة:</span>
                <select
                  value={filterHalaqah}
                  onChange={e => setFilterHalaqah(e.target.value)}
                  className="text-xs text-emerald-100 bg-[#064e3b]/80 border border-[#065f46] rounded-xl px-3 py-2 focus:border-[#fbbf24] focus:outline-none cursor-pointer"
                >
                  <option value="all">جميع الحلقات</option>
                  {halaqahs.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>

              {onSaveLibraryDoc && (
                <button
                  type="button"
                  onClick={() => {
                    const targetEx = selectedExamForSubmissions !== 'all'
                      ? exams.find(ex => ex.id === selectedExamForSubmissions)
                      : undefined;
                    handleSaveExamResultsToLibrary(targetEx);
                  }}
                  disabled={isSavingExamToLibrary}
                  className="px-3.5 py-2 rounded-xl border-2 border-b-4 border-emerald-400 border-b-emerald-700 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:translate-y-[1px]"
                >
                  {isSavingExamToLibrary ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <BookmarkCheck className="w-3.5 h-3.5" />
                  )}
                  <span>حفظ في المكتبة</span>
                </button>
              )}

              <button
                onClick={() => handleExportToGoogleSheet()}
                disabled={isExportingSheets}
                className="px-3 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-emerald-100 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <FileSpreadsheet className={`w-3.5 h-3.5 text-[#fbbf24] ${isExportingSheets ? 'animate-spin' : ''}`} />
                <span>تصدير لـ Google Sheets</span>
              </button>

              <button
                onClick={() => handleDownloadCSV()}
                className="px-3 py-2 rounded-xl bg-[#064e3b] hover:bg-emerald-800 text-emerald-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>تحميل Excel / CSV</span>
              </button>

              {filteredSubmissions.length > 0 && (
                <button
                  onClick={() => setIsConfirmingBulkDelete(true)}
                  className="px-3 py-2 rounded-xl bg-rose-950/70 hover:bg-rose-900 text-rose-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-rose-600/40 shadow-sm"
                  title="حذف جميع الردود المعروضة حالياً لإتاحة الإعادة أو تفريغ الردود"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>حذف الردود ({filteredSubmissions.length})</span>
                </button>
              )}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-emerald-400 absolute right-3.5 top-3.5" />
              <input
                type="text"
                placeholder="بحث باسم الطالب أو الاختبار..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-4 pr-10 py-2 rounded-xl bg-[#064e3b]/60 border border-[#065f46] text-white text-xs placeholder:text-emerald-300/50 focus:border-[#fbbf24] focus:outline-none"
              />
            </div>
          </div>

          {/* Submissions List */}
          {filteredSubmissions.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-3xl bg-[#022c22]/50 border border-[#065f46] space-y-3">
              <CheckSquare className="w-14 h-14 text-emerald-500/40 mx-auto" />
              <h3 className="text-base font-bold text-white">لا توجد تسليمات مسجلة لهذا الاختبار</h3>
              <p className="text-xs text-emerald-200/70 max-w-sm mx-auto">
                عندما يُرسل الطلاب إجاباتهم عبر المنصة، ستظهر محاولاتهم وإجاباتهم هنا للتصحيح واعتماد الدرجات سحابياً.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-3xl border border-[#065f46] bg-[#022c22]/80">
              <table className="w-full text-right text-xs">
                <thead className="bg-[#064e3b] text-emerald-100 border-b border-[#065f46] font-bold">
                  <tr>
                    <th className="p-4">اسم الطالب</th>
                    <th className="p-4">الاختبار</th>
                    <th className="p-4">الحلقة</th>
                    <th className="p-4">المحاولة</th>
                    <th className="p-4">تاريخ التسليم</th>
                    <th className="p-4">الدرجة والنقاط</th>
                    <th className="p-4">الحالة</th>
                    <th className="p-4 text-center">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-900/40 text-emerald-100">
                  {filteredSubmissions.map(sub => {
                    const hasPendingEssay = sub.answers.some(a => a.questionType === 'essay' && sub.status === 'needs_grading');

                    return (
                      <tr key={sub.id} className="hover:bg-emerald-900/30 transition-all">
                        <td className="p-4 font-bold text-white">{sub.studentName}</td>
                        <td className="p-4 text-emerald-200">{sub.examTitle}</td>
                        <td className="p-4 text-emerald-300/80">{sub.halaqahName}</td>
                        <td className="p-4 font-semibold text-amber-300">#{sub.attemptNumber}</td>
                        <td className="p-4 text-emerald-300/80">
                          {formatArabicDateTime(sub.submittedAt)}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5 font-bold">
                            <span className="text-[#fbbf24] text-sm">{sub.totalScoreEarned}</span>
                            <span className="text-emerald-400 text-xs">/ {sub.maxPossibleScore}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900 text-emerald-200">
                              {sub.percentage}%
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          {hasPendingEssay ? (
                            <span className="text-[10px] px-2 py-1 rounded-full bg-amber-950 text-amber-300 border border-amber-600/40 font-bold">
                              بانتظار تصحيح المقالي
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-600/40 font-bold">
                              مكتمل ومصحح
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedCertSubmission(sub);
                                setIsCertModalOpen(true);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-[#fbbf24] hover:bg-[#f59e0b] text-[#064e3b] border border-[#fbbf24] font-black text-xs transition-all cursor-pointer shadow-md flex items-center gap-1.5"
                              title="استخراج شهادة اجتياز ونتيجة الاختبار للطالب"
                            >
                              <Award className="w-3.5 h-3.5" />
                              <span>استخراج شهادة</span>
                            </button>
                            <button
                              onClick={() => handleOpenGrading(sub)}
                              className="px-3 py-1.5 rounded-xl bg-[#022c22] hover:bg-[#064e3b] text-[#f0f9f6] border border-[#fbbf24]/40 hover:border-[#fbbf24] font-bold text-xs transition-all cursor-pointer shadow-sm flex items-center gap-1"
                            >
                              <CheckSquare className="w-3.5 h-3.5 text-[#fbbf24]" />
                              <span>تصحيح ومراجعة</span>
                            </button>
                            <button
                              onClick={() => setSubmissionToDelete(sub)}
                              className="p-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-rose-100 border border-rose-500/30 text-xs transition-all cursor-pointer"
                              title="حذف هذا التسليم لإتاحة الإعادة أو تصحيح الخطأ"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}


      {/* SUBTAB 4: GOOGLE SHEETS EXPORT */}
      {activeSubTab === 'google_sheets' && (
        <div className="p-6 rounded-3xl border border-[#fbbf24]/20 bg-[#022c22]/90 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#fbbf24]" />
                <span>تصدير بيانات ونتائج الاختبارات إلى Google Sheets</span>
              </h3>
              <p className="text-xs text-emerald-200/80 mt-1 max-w-xl">
                قم بربط حساب Google لتوليد جداول إلكترونية متزامنة سحابياً فورياً لدرجات الطلاب ونتائج الاختبارات والتقييمات، مع إمكانية التحميل المباشر بصيغة Excel/CSV.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {onSaveLibraryDoc && (
                <button
                  type="button"
                  onClick={() => handleSaveExamResultsToLibrary()}
                  disabled={isSavingExamToLibrary}
                  className="px-4 py-2.5 rounded-2xl border-2 border-b-4 border-emerald-400 border-b-emerald-700 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-md transition-all cursor-pointer active:translate-y-[2px]"
                >
                  {isSavingExamToLibrary ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <BookmarkCheck className="w-4 h-4" />
                  )}
                  <span>حفظ في المكتبة</span>
                </button>
              )}

              <button
                onClick={handleConnectGoogle}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-2xl bg-[#022c22] hover:bg-[#064e3b] text-[#f0f9f6] font-bold text-xs sm:text-sm flex items-center gap-2 border border-[#fbbf24]/40 hover:border-[#fbbf24] cursor-pointer shadow-sm transition-all"
              >
                <ShieldCheck className="w-4 h-4 text-[#fbbf24]" />
                <span>{googleAuthConfig?.isLinked ? 'تحديث ربط حساب Google للمجمع' : 'ربط حساب Google للمجمع'}</span>
              </button>

              {googleAuthConfig?.isLinked && (
                <button
                  type="button"
                  onClick={() => setIsUnlinkConfirmOpen(true)}
                  className="px-3.5 py-2.5 rounded-2xl border-2 border-b-4 border-rose-500/60 border-b-rose-800 bg-rose-950/70 hover:bg-rose-900 text-rose-200 font-black text-xs flex items-center gap-1.5 cursor-pointer transition-all active:translate-y-[2px]"
                  title="فك ربط حساب Google عن هذا المجمع فقط"
                >
                  <Unlink className="w-4 h-4" />
                  <span>إلغاء الربط</span>
                </button>
              )}

              <button
                onClick={() => handleExportToGoogleSheet()}
                disabled={isExportingSheets}
                className="px-5 py-2.5 rounded-2xl bg-[#fbbf24] hover:bg-[#f59e0b] text-[#064e3b] border border-[#fbbf24] font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>تصدير كافة النتائج الآن</span>
              </button>
            </div>
          </div>

          {/* Connection Status Card (Strictly Isolated Per Complex) */}
          <div className="p-5 rounded-2xl bg-[#064e3b]/50 border border-emerald-800/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-3.5 h-3.5 rounded-full ${
                  googleAuthConfig?.isLinked ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <div>
                <h4 className="text-xs font-bold text-white">
                  حالة ربط Google لمجمع ({activeComplex?.name || 'المجمع الحالي'}):{' '}
                  {googleAuthConfig?.isLinked ? 'مرتبط ومفعل للمكتبة والاختبارات' : 'غير مرتبط بهذا المجمع'}
                </h4>
                <p className="text-[11px] text-emerald-300/80 mt-0.5">
                  {googleAuthConfig?.isLinked
                    ? `${googleAuthConfig.connectedEmail || 'حساب Google مرتبط'} • مستقل تماماً عن أي مجمع آخر ومتصل تلقائياً بقسم المكتبة`
                    : 'لم يتم ربط حساب Google لهذا المجمع بعد (حساب هذا المجمع مستقل تماماً عن المجمعات الأخرى)'}
                </p>
              </div>
            </div>

            {googleAuthConfig?.connectedAt && (
              <span className="text-[10px] text-emerald-400/80">
                تاريخ الربط: {formatArabicDateTime(googleAuthConfig.connectedAt)}
              </span>
            )}
          </div>

          {/* Unlink Confirmation Modal for this Complex */}
          {isUnlinkConfirmOpen && (
            <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
              <div className="w-full max-w-md rounded-3xl border-2 border-b-4 border-rose-500/60 border-b-rose-900 bg-slate-900 p-6 text-right shadow-2xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                    <Unlink className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-white">تأكيد إلغاء ربط حساب Google للمجمع</h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      سيتم فك ربط الحساب ({googleAuthConfig?.connectedEmail}) عن مجمع <strong className="text-amber-300">{activeComplex?.name || 'المجمع الحالي'}</strong> فقط، وستتوقف المكتبة وتصدير النماذج في هذا المجمع إلى حين إعادة الربط.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsUnlinkConfirmOpen(false)}
                    className="px-4 py-2 rounded-xl border-2 border-b-4 border-slate-700 border-b-slate-950 bg-slate-800 text-slate-200 text-xs font-black cursor-pointer"
                  >
                    تراجع
                  </button>
                  <button
                    type="button"
                    disabled={isUnlinkingGoogle}
                    onClick={handleConfirmUnlinkGoogle}
                    className="px-4 py-2 rounded-xl border-2 border-b-4 border-rose-400 border-b-rose-800 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black cursor-pointer flex items-center gap-1.5"
                  >
                    {isUnlinkingGoogle && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>تأكيد إلغاء الربط</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quick Export Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="p-5 rounded-2xl bg-[#064e3b]/30 border border-emerald-800/80 space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>تصدير كافة تسليمات المنصة ({submissions.length} تسليم)</span>
              </h4>
              <p className="text-xs text-emerald-300/80">
                توليد جدول شامل يحتوي على اسم الطالب، الحلقة، اسم الاختبار، رقم المحاولة، والدرجات المحصلة.
              </p>
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => handleExportToGoogleSheet()}
                  disabled={isExportingSheets}
                  className="px-4 py-2 rounded-xl bg-[#fbbf24] text-[#064e3b] text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer hover:bg-[#f59e0b]"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>تصدير إلى Google Sheets</span>
                </button>
                <button
                  onClick={() => handleDownloadCSV()}
                  className="px-4 py-2 rounded-xl bg-emerald-900 text-emerald-200 text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-800 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تحميل ملف CSV</span>
                </button>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#064e3b]/30 border border-emerald-800/80 space-y-3">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#fbbf24]" />
                <span>الحفظ السحابي التلقائي المشفر</span>
              </h4>
              <p className="text-xs text-emerald-300/80">
                كافة الاختبارات والأسئلة والتسليمات ودرجات الطلاب محفوظة سحابياً في قاعدة البيانات المركزية ويتم مزامنتها لحظياً دون الحاجة لأي حفظ يدوي.
              </p>
              <div className="pt-2 text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>قاعدة البيانات السحابية تعمل بنجاح وبأعلى كفاءة</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT EXAM MODAL */}
      {isCreatingExam && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#022c22] border border-[#065f46] rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-emerald-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#fbbf24]" />
                  <span>{editingExamId ? 'تعديل بيانات الاختبار' : 'إنشاء وتجهيز اختبار إلكتروني جديد'}</span>
                </h3>
                <p className="text-xs text-emerald-300/80 mt-1">
                  إعداد أسئلة الاختبار، التوقيت، الحلقات المستهدفة والمحاولات سحابياً
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreatingExam(false)}
                className="p-2 rounded-xl text-emerald-300 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExamSubmit} className="space-y-6">
              {/* Basic Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-emerald-200 mb-1">
                    اسم / عنوان الاختبار <span className="text-rose-400">* (إلزامي)</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: الاختبار الفصلي في جزء عم - أحكام التجويد"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#064e3b] border border-[#065f46] text-white text-xs placeholder:text-emerald-300/50 focus:border-[#fbbf24] focus:outline-none font-bold"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-emerald-200 mb-1">
                    وصف أو تعليمات الاختبار
                  </label>
                  <textarea
                    rows={2}
                    placeholder="تعليمات الاختبار، المنهج المحدد، أو تنبيهات هامة للطلاب..."
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-[#064e3b] border border-[#065f46] text-white text-xs placeholder:text-emerald-300/50 focus:border-[#fbbf24] focus:outline-none"
                  />
                </div>

                {formGoogleSpreadsheetUrl && (
                  <div className="sm:col-span-2 p-3.5 rounded-2xl bg-[#064e3b]/50 border border-emerald-700/60">
                    <label className="block text-[11px] font-bold text-emerald-300 mb-1.5">
                      جدول Google Sheets المرتبط لنتائج هذا الاختبار:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="url"
                        readOnly
                        value={formGoogleSpreadsheetUrl}
                        className="w-full px-3 py-1.5 rounded-xl bg-[#064e3b]/80 border border-emerald-600/40 text-emerald-200 text-xs focus:outline-none"
                      />
                      <a
                        href={formGoogleSpreadsheetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shrink-0"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>فتح الجدول</span>
                      </a>
                    </div>
                  </div>
                )}

                {/* Scheduling */}
                <div>
                  <label className="block text-xs font-bold text-emerald-200 mb-1">
                    موعد ظهور الاختبار للطلاب
                  </label>
                  <select
                    value={formScheduleType}
                    onChange={e => setFormScheduleType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-[#064e3b] border border-[#065f46] text-white text-xs focus:border-[#fbbf24] focus:outline-none cursor-pointer"
                  >
                    <option value="now">يظهر الآن مباشرة للطلاب</option>
                    <option value="scheduled">مجدول (تاريخ ووقت محدد للظهور)</option>
                  </select>
                </div>

                {formScheduleType === 'scheduled' && (
                  <div>
                    <label className="block text-xs font-bold text-[#fbbf24] mb-1">
                      تاريخ ووقت ظهور الاختبار:
                    </label>
                    <input
                      type="datetime-local"
                      value={formStartDate}
                      onChange={e => setFormStartDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#064e3b] border border-[#fbbf24]/50 text-white text-xs focus:border-[#fbbf24] focus:outline-none"
                    />
                  </div>
                )}

                {/* Deadline */}
                <div>
                  <label className="block text-xs font-bold text-emerald-200 mb-1">
                    موعد انتهاء الاختبار
                  </label>
                  <select
                    value={formHasDeadline ? 'deadline' : 'forever'}
                    onChange={e => setFormHasDeadline(e.target.value === 'deadline')}
                    className="w-full px-3 py-2 rounded-xl bg-[#064e3b] border border-[#065f46] text-white text-xs focus:border-[#fbbf24] focus:outline-none cursor-pointer"
                  >
                    <option value="forever">متاح للأبد (بدون موعد انتهاء)</option>
                    <option value="deadline">له موعد انتهاء محدد وبعدها يقفل</option>
                  </select>
                </div>

                {formHasDeadline && (
                  <div>
                    <label className="block text-xs font-bold text-[#fbbf24] mb-1">
                      تاريخ ووقت انتهاء الاختبار:
                    </label>
                    <input
                      type="datetime-local"
                      value={formDeadlineDate}
                      onChange={e => setFormDeadlineDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#064e3b] border border-[#fbbf24]/50 text-white text-xs focus:border-[#fbbf24] focus:outline-none"
                    />
                  </div>
                )}

                {/* Attempts */}
                <div>
                  <label className="block text-xs font-bold text-emerald-200 mb-1">
                    عدد المحاولات المسموحة لكل طالب
                  </label>
                  <select
                    value={formAttemptType}
                    onChange={e => setFormAttemptType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-[#064e3b] border border-[#065f46] text-white text-xs focus:border-[#fbbf24] focus:outline-none cursor-pointer"
                  >
                    <option value="unlimited">محاولات غير محدودة</option>
                    <option value="limited">عدد محاولات محدد فقط</option>
                  </select>
                </div>

                {formAttemptType === 'limited' && (
                  <div>
                    <label className="block text-xs font-bold text-[#fbbf24] mb-1">
                      أقصى عدد محاولات مسموح بها:
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={formMaxAttempts}
                      onChange={e => setFormMaxAttempts(Math.max(1, Number(e.target.value)))}
                      className="w-full px-3 py-2 rounded-xl bg-[#064e3b] border border-[#065f46] text-white text-xs focus:border-[#fbbf24] focus:outline-none font-bold"
                    />
                  </div>
                )}

                {/* Grade Visibility */}
                <div>
                  <label className="block text-xs font-bold text-emerald-200 mb-1">
                    ظهور النتيجة للطالب بعد الحل
                  </label>
                  <select
                    value={formGradeVisibility}
                    onChange={e => setFormGradeVisibility(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-[#064e3b] border border-[#065f46] text-white text-xs focus:border-[#fbbf24] focus:outline-none cursor-pointer"
                  >
                    <option value="immediate">مباشرة وفوري بعد التسليم</option>
                    <option value="after_deadline">بعد نهاية موعد الاختبار</option>
                    <option value="manual">بعد تصحيح واعتماد المعلم للمقالي</option>
                  </select>
                </div>
              </div>

              {/* Exam Timing & Duration Settings */}
              <div className="p-5 rounded-2xl bg-[#064e3b]/60 border border-[#065f46] space-y-4">
                <div className="flex items-center gap-2">
                  <Timer className="w-5 h-5 text-[#fbbf24]" />
                  <div>
                    <h4 className="text-xs font-bold text-white">خيارات توقيت ومدة الاختبار (Timer)</h4>
                    <p className="text-[11px] text-emerald-300/80">
                      يمكنك جعل الاختبار مفتوحاً بدون وقت، أو تحديد وقت كلي للاختبار، أو وقت محدد لكل سؤال
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormTimeLimitMode('none')}
                    className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer ${
                      formTimeLimitMode === 'none'
                        ? 'bg-[#fbbf24] text-[#064e3b] border-[#fbbf24] shadow-md font-bold'
                        : 'bg-[#022c22] border-[#fbbf24]/30 text-[#f0f9f6]/80 hover:bg-[#064e3b] hover:border-[#fbbf24]/60'
                    }`}
                  >
                    <div className="text-xs font-black mb-1">بدون مؤقت زمني</div>
                    <div className={`text-[10px] ${formTimeLimitMode === 'none' ? 'text-emerald-950 font-semibold' : 'text-[#86efac]/80'}`}>
                      يحل الطالب الاختبار بأريحية تامة دون عد تنازلي.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormTimeLimitMode('total')}
                    className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer ${
                      formTimeLimitMode === 'total'
                        ? 'bg-[#fbbf24] text-[#064e3b] border-[#fbbf24] shadow-md font-bold'
                        : 'bg-[#022c22] border-[#fbbf24]/30 text-[#f0f9f6]/80 hover:bg-[#064e3b] hover:border-[#fbbf24]/60'
                    }`}
                  >
                    <div className="text-xs font-black mb-1">وقت كلي لكامل الاختبار</div>
                    <div className={`text-[10px] ${formTimeLimitMode === 'total' ? 'text-emerald-950 font-semibold' : 'text-[#86efac]/80'}`}>
                      مؤقت عام ينتهي عنده الاختبار ويُسلم تلقائياً.
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormTimeLimitMode('per_question')}
                    className={`p-3.5 rounded-xl border text-right transition-all cursor-pointer ${
                      formTimeLimitMode === 'per_question'
                        ? 'bg-[#fbbf24] text-[#064e3b] border-[#fbbf24] shadow-md font-bold'
                        : 'bg-[#022c22] border-[#fbbf24]/30 text-[#f0f9f6]/80 hover:bg-[#064e3b] hover:border-[#fbbf24]/60'
                    }`}
                  >
                    <div className="text-xs font-black mb-1">وقت مخصص لكل سؤال</div>
                    <div className={`text-[10px] ${formTimeLimitMode === 'per_question' ? 'text-emerald-950 font-semibold' : 'text-[#86efac]/80'}`}>
                      عداد ثوانٍ لكل سؤال، ينتقل تلقائياً للسؤال التالي.
                    </div>
                  </button>
                </div>

                {formTimeLimitMode === 'total' && (
                  <div className="p-3.5 rounded-xl bg-[#022c22] border border-emerald-700/60 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-bold text-[#fbbf24]">
                        إجمالي وقت الاختبار (بالدقائق):
                      </label>
                      <div className="flex items-center gap-1.5">
                        {[5, 10, 15, 20, 30, 45, 60].map(mins => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => setFormTotalTimeMinutes(mins)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                              formTotalTimeMinutes === mins
                                ? 'bg-[#fbbf24] text-[#064e3b]'
                                : 'bg-emerald-900/70 text-emerald-300 hover:bg-emerald-800'
                            }`}
                          >
                            {mins}د
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={300}
                        value={formTotalTimeMinutes}
                        onChange={e => setFormTotalTimeMinutes(Math.max(1, Number(e.target.value)))}
                        className="w-28 px-3 py-1.5 rounded-lg bg-[#064e3b] border border-[#065f46] text-white text-xs text-center font-bold focus:border-[#fbbf24] focus:outline-none"
                      />
                      <span className="text-xs text-emerald-300">دقيقة (سيتم تسليم الاختبار تلقائياً بعد انتهاء هذه المدة)</span>
                    </div>
                  </div>
                )}

                {formTimeLimitMode === 'per_question' && (
                  <div className="p-3.5 rounded-xl bg-[#022c22] border border-emerald-700/60 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-bold text-[#fbbf24]">
                        الوقت الافتراضي لكل سؤال (بالثواني):
                      </label>
                      <div className="flex items-center gap-1.5">
                        {[15, 20, 30, 45, 60, 90, 120].map(secs => (
                          <button
                            key={secs}
                            type="button"
                            onClick={() => setFormQuestionTimeSeconds(secs)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                              formQuestionTimeSeconds === secs
                                ? 'bg-[#fbbf24] text-[#064e3b]'
                                : 'bg-emerald-900/70 text-emerald-300 hover:bg-emerald-800'
                            }`}
                          >
                            {secs}ث
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={5}
                        max={600}
                        value={formQuestionTimeSeconds}
                        onChange={e => setFormQuestionTimeSeconds(Math.max(5, Number(e.target.value)))}
                        className="w-28 px-3 py-1.5 rounded-lg bg-[#064e3b] border border-[#065f46] text-white text-xs text-center font-bold focus:border-[#fbbf24] focus:outline-none"
                      />
                      <span className="text-xs text-emerald-300">ثانية لكل سؤال (يمكنك تخصيص وقت استثنائي لأي سؤال أدناه)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Target Halaqat Selection */}
              <div className="p-4 rounded-2xl bg-[#064e3b]/50 border border-[#fbbf24]/30 space-y-2">
                <label className="block text-xs font-bold text-[#fbbf24]">
                  تحديد الحلقات المستهدفة للاختبار
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setFormTargetHalaqat(['all'])}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      formTargetHalaqat.includes('all')
                        ? 'bg-[#fbbf24] text-[#064e3b] border border-[#fbbf24] shadow-sm font-black'
                        : 'bg-[#022c22] text-[#f0f9f6]/80 border border-[#fbbf24]/30 hover:border-[#fbbf24]/60'
                    }`}
                  >
                    جميع الحلقات
                  </button>

                  {halaqahs.map(h => {
                    const isSelected = formTargetHalaqat.includes(h.id);
                    return (
                      <button
                        key={h.id}
                        type="button"
                        onClick={() => {
                          let next = formTargetHalaqat.filter(x => x !== 'all');
                          if (isSelected) {
                            next = next.filter(x => x !== h.id);
                            if (next.length === 0) next = ['all'];
                          } else {
                            next.push(h.id);
                          }
                          setFormTargetHalaqat(next);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          isSelected && !formTargetHalaqat.includes('all')
                            ? 'bg-[#fbbf24] text-[#064e3b] border border-[#fbbf24] shadow-sm font-black'
                            : 'bg-[#022c22] text-[#f0f9f6]/80 border border-[#fbbf24]/30 hover:border-[#fbbf24]/60'
                        }`}
                      >
                        {h.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Questions Section */}
              <div className="space-y-4 pt-4 border-t border-emerald-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#fbbf24]" />
                    <span>أسئلة الاختبار ({questions.length})</span>
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddQuestion('multiple_choice')}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-800 text-emerald-100 text-xs font-bold hover:bg-emerald-700 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>اختيار من متعدد</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuestion('true_false')}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-800 text-emerald-100 text-xs font-bold hover:bg-emerald-700 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>صح وخطأ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddQuestion('essay')}
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-800 text-emerald-100 text-xs font-bold hover:bg-emerald-700 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>سؤال مقالي</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {questions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="p-4 rounded-2xl bg-[#064e3b]/40 border border-emerald-700/80 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#fbbf24]">
                          السؤال {idx + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-emerald-300">الدرجات:</span>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={q.points}
                            onChange={e =>
                              handleUpdateQuestion(q.id, { points: Math.max(1, Number(e.target.value)) })
                            }
                            className="w-16 px-2 py-1 rounded bg-[#022c22] border border-[#065f46] text-white text-xs text-center font-bold"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveQuestion(q.id)}
                            className="p-1.5 rounded-lg text-rose-300 hover:bg-rose-950/60"
                            title="حذف السؤال"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <input
                        type="text"
                        placeholder="اكتب نص السؤال هنا..."
                        value={q.title}
                        onChange={e => handleUpdateQuestion(q.id, { title: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-[#022c22] border border-[#065f46] text-white text-xs focus:border-[#fbbf24] focus:outline-none"
                      />

                      {/* Multiple Choice Options */}
                      {q.type === 'multiple_choice' && (
                        <div className="space-y-2 pt-1">
                          <span className="text-[11px] text-emerald-300 font-bold block">
                            الخيارات (حدد الإجابة الصحيحة):
                          </span>
                          {(q.options || []).map((opt, oIdx) => (
                            <div key={oIdx} className="flex items-center gap-2">
                              <input
                                type="radio"
                                name={`correct-${q.id}`}
                                checked={q.correctAnswer === opt}
                                onChange={() => handleUpdateQuestion(q.id, { correctAnswer: opt })}
                                className="accent-amber-400 w-4 h-4 cursor-pointer"
                              />
                              <input
                                type="text"
                                value={opt}
                                onChange={e => {
                                  const nextOptions = [...(q.options || [])];
                                  const oldVal = nextOptions[oIdx];
                                  nextOptions[oIdx] = e.target.value;
                                  const updates: Partial<ExamQuestion> = { options: nextOptions };
                                  if (q.correctAnswer === oldVal) {
                                    updates.correctAnswer = e.target.value;
                                  }
                                  handleUpdateQuestion(q.id, updates);
                                }}
                                className="flex-1 px-3 py-1.5 rounded-lg bg-[#022c22] border border-[#065f46] text-white text-xs"
                              />
                              {(q.options || []).length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextOptions = (q.options || []).filter((_, i) => i !== oIdx);
                                    handleUpdateQuestion(q.id, {
                                      options: nextOptions,
                                      correctAnswer: q.correctAnswer === opt ? nextOptions[0] : q.correctAnswer
                                    });
                                  }}
                                  className="p-1 text-rose-400 hover:text-rose-200"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              const nextOptions = [...(q.options || []), `الخيار ${(q.options || []).length + 1}`];
                              handleUpdateQuestion(q.id, { options: nextOptions });
                            }}
                            className="text-[11px] text-[#fbbf24] hover:underline font-bold pt-1 block cursor-pointer"
                          >
                            + إضافة خيار جديد
                          </button>
                        </div>
                      )}

                      {/* True / False Options */}
                      {q.type === 'true_false' && (
                        <div className="flex items-center gap-4 pt-1">
                          <span className="text-[11px] text-emerald-300 font-bold">الإجابة الصحيحة:</span>
                          <label className="flex items-center gap-1.5 text-xs text-white cursor-pointer">
                            <input
                              type="radio"
                              name={`correct-tf-${q.id}`}
                              checked={q.correctAnswer === 'صح'}
                              onChange={() => handleUpdateQuestion(q.id, { correctAnswer: 'صح' })}
                              className="accent-amber-400"
                            />
                            <span>صح</span>
                          </label>
                          <label className="flex items-center gap-1.5 text-xs text-white cursor-pointer">
                            <input
                              type="radio"
                              name={`correct-tf-${q.id}`}
                              checked={q.correctAnswer === 'خطأ'}
                              onChange={() => handleUpdateQuestion(q.id, { correctAnswer: 'خطأ' })}
                              className="accent-amber-400"
                            />
                            <span>خطأ</span>
                          </label>
                        </div>
                      )}

                      {/* Essay Info */}
                      {q.type === 'essay' && (
                        <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-[11px] text-amber-200">
                          هذا السؤال مقالي (كتابي)، سيقوم المعلم بمراجعته وتصحيحه يدوياً في قسم التسليمات.
                        </div>
                      )}

                      <div>
                        <input
                          type="text"
                          placeholder="توضيح أو تغذية راجعة للإجابة الصحيحة (اختياري)..."
                          value={q.explanation || ''}
                          onChange={e => handleUpdateQuestion(q.id, { explanation: e.target.value })}
                          className="w-full px-3 py-1.5 rounded-lg bg-[#022c22]/70 border border-emerald-900 text-emerald-100 text-xs placeholder:text-emerald-500/50"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-emerald-800">
                <button
                  type="button"
                  onClick={() => setIsCreatingExam(false)}
                  className="px-4 py-2.5 rounded-xl bg-emerald-900/60 text-emerald-200 text-xs font-bold hover:bg-emerald-800"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl bg-[#fbbf24] text-[#064e3b] text-xs font-black shadow-lg hover:bg-[#f59e0b] cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isSaving ? 'جارٍ الحفظ السحابي...' : 'حفظ ونشر الاختبار الآن'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {examToDelete && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#022c22] border border-rose-600/50 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-950 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/40">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">تأكيد حذف الاختبار سحابياً</h3>
              <p className="text-xs text-rose-200/80 mt-1">
                هل أنت متأكد من رغبتك في حذف اختبار "{examToDelete.title}"؟ سيتم حذفه نهائياً من قاعدة البيانات السحابية.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setExamToDelete(null)}
                className="px-4 py-2 rounded-xl bg-emerald-900/60 text-emerald-200 text-xs font-bold cursor-pointer hover:bg-emerald-800"
              >
                تراجع
              </button>
              <button
                onClick={handleConfirmDeleteExam}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg cursor-pointer"
              >
                {isDeleting ? 'جارٍ الحذف...' : 'نعم، حذف الاختبار'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE SUBMISSION CONFIRMATION MODAL */}
      {submissionToDelete && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#022c22] border border-rose-600/50 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-950 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/40">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">تأكيد حذف تسليم الطالب</h3>
              <p className="text-xs text-rose-200/80 mt-1">
                هل أنت متأكد من رغبتك في حذف تسليم الطالب <strong className="text-white font-bold">"{submissionToDelete.studentName}"</strong> لاختبار <strong className="text-[#fbbf24] font-bold">"{submissionToDelete.examTitle}"</strong> (المحاولة #{submissionToDelete.attemptNumber})؟
              </p>
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-[11px] text-amber-200 mt-2 text-right leading-relaxed flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-[#fbbf24] shrink-0" />
                <span>مفيد في حال رغب المعلم بتصحيح خطأ أو إعطاء الطالب فرصة لإعادة الاختبار.</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setSubmissionToDelete(null)}
                className="px-4 py-2 rounded-xl bg-emerald-900/60 text-emerald-200 text-xs font-bold cursor-pointer hover:bg-emerald-800"
              >
                تراجع
              </button>
              <button
                onClick={handleConfirmDeleteSubmission}
                disabled={isDeletingSubmission}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg cursor-pointer"
              >
                {isDeletingSubmission ? 'جارٍ الحذف...' : 'نعم، حذف التسليم'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK DELETE SUBMISSIONS CONFIRMATION MODAL */}
      {isConfirmingBulkDelete && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#022c22] border border-rose-600/50 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-950 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/40">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">تأكيد حذف الردود المحددة</h3>
              <p className="text-xs text-rose-200/80 mt-1">
                هل أنت متأكد من رغبتك في حذف <strong className="text-[#fbbf24] font-bold">({filteredSubmissions.length})</strong> تسليم/رد معروض حالياً؟
              </p>
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-[11px] text-rose-200 mt-2 text-right leading-relaxed">
                <span className="font-bold text-amber-300">تنبيه هام:</span> سيتم حذف جميع نتائج هذه التسليمات من السحابة وتفريغ الردود، مما يمكن الطلاب من إعادة الاختبار. لا يمكن التراجع عن هذا الإجراء.
              </div>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setIsConfirmingBulkDelete(false)}
                className="px-4 py-2 rounded-xl bg-emerald-900/60 text-emerald-200 text-xs font-bold cursor-pointer hover:bg-emerald-800"
              >
                تراجع
              </button>
              <button
                onClick={handleConfirmBulkDeleteSubmissions}
                disabled={isBulkDeletingSubmissions}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg cursor-pointer"
              >
                {isBulkDeletingSubmissions ? 'جارٍ حذف كافة الردود...' : `نعم، حذف (${filteredSubmissions.length}) رد`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUBMISSION GRADING MODAL */}
      {selectedSubmissionForGrading && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#022c22] border border-[#065f46] rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-emerald-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-[#fbbf24]" />
                  <span>تصحيح تسليم الطالب: {selectedSubmissionForGrading.studentName}</span>
                </h3>
                <p className="text-xs text-emerald-300/80 mt-1">
                  الاختبار: {selectedSubmissionForGrading.examTitle} • المحاولة رقم #{selectedSubmissionForGrading.attemptNumber}
                </p>
              </div>
              <button
                onClick={() => setSelectedSubmissionForGrading(null)}
                className="p-2 rounded-xl text-emerald-300 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Questions Inspection */}
            <div className="space-y-4">
              {selectedSubmissionForGrading.answers.map((ans, idx) => (
                <div
                  key={ans.questionId}
                  className="p-4 rounded-2xl bg-[#064e3b]/40 border border-emerald-800 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">
                      س {idx + 1}: {ans.questionTitle}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-emerald-300">الدرجة:</span>
                      <input
                        type="number"
                        min={0}
                        max={ans.maxPoints}
                        value={gradingDraftScores[ans.questionId] ?? ans.pointsEarned}
                        onChange={e =>
                          setGradingDraftScores({
                            ...gradingDraftScores,
                            [ans.questionId]: Number(e.target.value)
                          })
                        }
                        className="w-16 px-2 py-1 rounded bg-[#022c22] border border-[#065f46] text-white text-xs text-center font-bold"
                      />
                      <span className="text-xs text-emerald-400">/ {ans.maxPoints}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#022c22] border border-emerald-900/60 text-xs">
                    <span className="text-emerald-400 font-bold block mb-1">إجابة الطالب:</span>
                    <p className="text-white whitespace-pre-wrap">{ans.studentAnswer || 'لم تتم الإجابة'}</p>
                  </div>

                  <div>
                    <input
                      type="text"
                      placeholder="ملاحظات وتوجيه المعلم على هذا السؤال..."
                      value={gradingDraftFeedbacks[ans.questionId] || ''}
                      onChange={e =>
                        setGradingDraftFeedbacks({
                          ...gradingDraftFeedbacks,
                          [ans.questionId]: e.target.value
                        })
                      }
                      className="w-full px-3 py-1.5 rounded-lg bg-[#022c22] border border-emerald-900 text-emerald-100 text-xs placeholder:text-emerald-500/50"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* General Feedback */}
            <div>
              <label className="block text-xs font-bold text-emerald-200 mb-1">
                توجيه وكلمة عامة للطالب على المحاولة:
              </label>
              <textarea
                rows={2}
                placeholder="أحسنت يا بطل، بارك الله فيك ونفع بك..."
                value={gradingGeneralFeedback}
                onChange={e => setGradingGeneralFeedback(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#064e3b] border border-[#065f46] text-white text-xs focus:border-[#fbbf24] focus:outline-none"
              />
            </div>

            {/* Save Grading Button */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-emerald-800">
              <button
                type="button"
                onClick={() => setSelectedSubmissionForGrading(null)}
                className="px-4 py-2 rounded-xl bg-emerald-900/60 text-emerald-200 text-xs font-bold"
              >
                إغلاق
              </button>
              <button
                type="button"
                onClick={handleSaveGrading}
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl bg-[#fbbf24] text-[#064e3b] text-xs font-black shadow-lg cursor-pointer"
              >
                اعتماد وتحديث الدرجات سحابياً
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW / TEST EXAM MODAL FOR TEACHER */}
      {previewingExam && (
        <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#022c22] border border-[#fbbf24]/50 rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-y-auto p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-emerald-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-[#fbbf24] text-[#064e3b] font-black">
                    معاينة المعلم
                  </span>
                  {previewingExam.timeLimitMode === 'total' && (
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-800 text-amber-300 font-bold flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-400" />
                      مؤقت كلي: {previewingExam.totalTimeMinutes || 15} دقيقة
                    </span>
                  )}
                  {previewingExam.timeLimitMode === 'per_question' && (
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-800 text-amber-300 font-bold flex items-center gap-1">
                      <Hourglass className="w-3 h-3 text-amber-400" />
                      مؤقت لكل سؤال: {previewingExam.questionTimeSeconds || 30} ثانية
                    </span>
                  )}
                </div>
                <h3 className="text-lg font-bold text-white mt-1">{previewingExam.title}</h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewInteractive(!previewInteractive)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    previewInteractive
                      ? 'bg-[#fbbf24] text-[#064e3b] border border-[#fbbf24] shadow-sm font-black'
                      : 'bg-[#022c22] hover:bg-[#064e3b] text-[#f0f9f6]/80 hover:text-white border border-[#fbbf24]/30 hover:border-[#fbbf24]/60'
                  }`}
                >
                  {previewInteractive ? 'وضع التصفح السريع' : 'تجربة كطالب في المنصة'}
                </button>

                <button
                  onClick={() => {
                    setPreviewingExam(null);
                    setPreviewInteractive(false);
                  }}
                  className="p-2 rounded-xl text-emerald-300 hover:text-white"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            {previewInteractive ? (
              <StudentExamTaker
                exam={previewingExam}
                student={{
                  id: 'preview-teacher',
                  name: `تجربة المعلم (${currentUserName})`,
                  halaqahId: halaqahs[0]?.id || 'halaqah-1',
                  halaqahName: halaqahs[0]?.name || 'الحلقة',
                  points: 0,
                  level: 'المستوى الأول',
                  attendanceCount: 0,
                  completedParts: 0
                } as unknown as Student}
                currentAttemptNumber={1}
                onFinishSubmission={async sub => {
                  setStatusMessage({
                    type: 'success',
                    text: `تمت تجربة الاختبار بنجاح! الدرجة المحسوبة: ${sub.totalScoreEarned} من ${sub.maxPossibleScore} (${sub.percentage}%)`
                  });
                  setPreviewingExam(null);
                  setPreviewInteractive(false);
                }}
                onCancel={() => {
                  setPreviewInteractive(false);
                }}
              />
            ) : (
              <div className="space-y-4">
                {previewingExam.description && (
                  <div className="p-4 rounded-2xl bg-[#064e3b]/50 text-xs text-emerald-200 border border-emerald-800">
                    <span className="text-[#fbbf24] font-bold block mb-1">تعليمات الاختبار:</span>
                    {previewingExam.description}
                  </div>
                )}

                <div className="space-y-3">
                  {previewingExam.questions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="p-4 rounded-2xl bg-[#064e3b]/30 border border-emerald-800/80 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#fbbf24]">
                          السؤال {idx + 1} ({q.type === 'multiple_choice' ? 'اختيار من متعدد' : q.type === 'true_false' ? 'صح وخطأ' : 'سؤال مقالي'})
                        </span>
                        <span className="text-emerald-300 font-bold">{q.points} درجات</span>
                      </div>

                      <h4 className="text-sm font-bold text-white">{q.title}</h4>

                      {q.options && q.options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                          {q.options.map((opt, oIdx) => {
                            const isCorrect = q.correctAnswer === opt;
                            return (
                              <div
                                key={oIdx}
                                className={`p-2.5 rounded-xl text-xs flex items-center gap-2 border ${
                                  isCorrect
                                    ? 'bg-emerald-900/80 border-emerald-400 text-emerald-200 font-bold'
                                    : 'bg-[#022c22] border-emerald-900 text-emerald-300/80'
                                }`}
                              >
                                {isCorrect ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                ) : (
                                  <div className="w-3.5 h-3.5 rounded-full border border-emerald-700 shrink-0" />
                                )}
                                <span>{opt}</span>
                                {isCorrect && (
                                  <span className="text-[10px] text-[#fbbf24] mr-auto font-black">
                                    (الإجابة النموذجية)
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {q.explanation && (
                        <div className="p-2.5 rounded-xl bg-[#022c22]/60 text-[11px] text-emerald-300/90 border border-emerald-800/50 mt-2">
                          <span className="text-amber-400 font-bold">توضيح:</span> {q.explanation}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GOOGLE & FIREBASE DOMAIN AUTHORIZATION HELPER MODAL */}
      {showDomainHelpModal && (
        <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#022c22] border-2 border-[#fbbf24] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl p-6 sm:p-8 space-y-6 text-right">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-emerald-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-[#fbbf24]/20 border border-[#fbbf24]/50 text-[#fbbf24]">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-white">
                    تأكيد تفويض نطاق المنصة (Google Cloud)
                  </h3>
                  <p className="text-xs text-emerald-300/80">
                    خطوة واحدة سريعة لتفعيل ربط مكتبة Google Drive وجداول Google Sheets سحابياً
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDomainHelpModal(false)}
                className="p-2 rounded-xl bg-emerald-950/80 text-emerald-300 hover:text-white hover:bg-emerald-900 transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Explanation Alert */}
            <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-xs sm:text-sm text-amber-200/90 leading-relaxed space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>سبب ظهور هذا التنبيه (أمان Google Auth):</span>
              </div>
              <p>
                حماية أمان Google تتطلب إضافة اسم نطاق الموقع الحالي إلى قائمة{' '}
                <strong className="text-white font-mono">Authorized domains</strong> لمرة واحدة فقط في وحدة تحكم مشروعك.
              </p>
            </div>

            {/* Current Host Domain Box */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-emerald-200">
                نطاق المنصة الحالي المطلوب نسخه وإضافته:
              </label>
              <div className="flex items-center gap-2 p-3 rounded-xl bg-[#011d16] border border-emerald-700/60 font-mono text-xs sm:text-sm text-[#86efac] break-all">
                <span className="flex-1 select-all">{currentHostDomain}</span>
                <button
                  type="button"
                  onClick={handleCopyDomain}
                  className="px-3 py-1.5 rounded-lg bg-[#fbbf24] text-[#064e3b] text-xs font-black hover:bg-amber-300 transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow"
                >
                  {copiedDomain ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>تم النسخ!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ النطاق</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Step-by-Step Instructions */}
            <div className="p-4 rounded-2xl bg-[#064e3b]/50 border border-emerald-800 space-y-3">
              <h4 className="text-xs font-bold text-[#fbbf24] flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span>خطوات التفعيل في دقيقة واحدة:</span>
              </h4>
              <ol className="text-xs text-emerald-100 space-y-2 list-decimal list-inside pr-1">
                <li>
                  انسخ النطاق أعلاه ثم اضغط على زر{' '}
                  <strong className="text-white">"فتح إعدادات تفويض النطاق"</strong> بالأسفل.
                </li>
                <li>
                  في صفحة إعدادات الهوية والأمان، انزل إلى قسم <strong className="text-white font-mono">Authorized domains</strong>.
                </li>
                <li>
                  اضغط على <strong className="text-white">"Add domain"</strong> والصق النطاق، ثم احفظ.
                </li>
              </ol>

              <div className="pt-2">
                <a
                  href={firebaseConsoleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#fbbf24] to-amber-500 text-[#064e3b] font-black text-xs sm:text-sm hover:brightness-110 shadow-lg cursor-pointer transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>فتح إعدادات تفويض النطاقات (Authorized Domains) ↗</span>
                </a>
              </div>
            </div>

            {/* Alternative: Manual Access Token */}
            <div className="space-y-2 pt-1 border-t border-emerald-800/60">
              <label className="block text-xs font-bold text-emerald-200">
                أو إدخال رمز تفويض Google يدوياً (OAuth Access Token):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="ya29.a0..."
                  value={manualTokenInput}
                  onChange={e => setManualTokenInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-[#064e3b] border border-emerald-700 text-white font-mono text-xs focus:outline-none focus:border-[#fbbf24]"
                />
                <button
                  type="button"
                  onClick={handleSaveManualToken}
                  disabled={isSavingManualToken || !manualTokenInput.trim()}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs disabled:opacity-50 cursor-pointer shadow transition-all"
                >
                  {isSavingManualToken ? 'جارٍ الحفظ...' : 'حفظ وتفعيل'}
                </button>
              </div>
            </div>

            {/* Close Button */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowDomainHelpModal(false)}
                className="px-6 py-2.5 rounded-xl bg-emerald-900/80 text-emerald-200 hover:text-white hover:bg-emerald-800 text-xs font-bold transition-all cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GOOGLE POPUP CLOSED / BLOCKED HELPER MODAL */}
      {showPopupHelpModal && (
        <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#022c22] border-2 border-amber-400/80 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl p-6 sm:p-8 space-y-6 text-right">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-emerald-800/80 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-amber-400/20 border border-amber-400/50 text-amber-300">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg sm:text-xl font-black text-white">
                    نافذة تسجيل الدخول من Google أغلقت قبل إكمال التفويض
                  </h3>
                  <p className="text-xs text-amber-200/80">
                    {lastActionContext ? `أثناء محاولة: ${lastActionContext}` : 'لم يتم استكمال اختيار حساب Google ومنحه الصلاحيات'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPopupHelpModal(false)}
                className="p-2 rounded-xl bg-emerald-950/80 text-emerald-300 hover:text-white hover:bg-emerald-900 transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Why this happened */}
            <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-xs sm:text-sm text-amber-200/90 leading-relaxed space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>لماذا تظهر هذه الرسالة (auth/popup-closed-by-user)؟</span>
              </div>
              <p>
                هذا ليس عطلاً برمجياً في المنصة، بل يعني أن نافذة تسجيل الدخول المنبثقة تم إغلاقها قبل اكتمال المصادقة، أو أن المتصفح/إطار المعاينة (iframe) منعها من الاستمرار.
              </p>
            </div>

            {/* Action 1: Open in full new tab (Recommended) */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-[#064e3b] to-[#022c22] border-2 border-[#fbbf24] space-y-3 shadow-lg">
              <div className="flex items-center gap-2 text-sm font-black text-[#fbbf24]">
                <ExternalLink className="w-5 h-5" />
                <span>الحل الأول (الأسهل والأضمن): فتح المنصة في تبويب جديد</span>
              </div>
              <p className="text-xs text-emerald-100 leading-relaxed">
                إذا كنت تتصفح المنصة داخل نافذة المعاينة المضمنة، يقوم المتصفح بحماية الأمان وإغلاق النوافذ المنبثقة. فتح المنصة في تبويب متصفح مستقل يمنح Google حرية تسجيل الدخول دون أي قيود!
              </p>
              <div className="pt-1">
                <a
                  href={appFullUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 w-full py-3 px-5 rounded-xl bg-gradient-to-r from-[#fbbf24] to-amber-500 text-[#064e3b] font-black text-sm hover:brightness-110 shadow-xl cursor-pointer transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>فتح المنصة الآن في تبويب جديد كامل ↗</span>
                </a>
              </div>
            </div>

            {/* Action 2: Retry with popup allowed */}
            <div className="p-4 rounded-2xl bg-[#064e3b]/50 border border-emerald-800 space-y-2.5">
              <h4 className="text-xs font-bold text-emerald-200 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-[#fbbf24]" />
                <span>الحل الثاني: إعادة المحاولة مع إبقاء النافذة مفتوحة</span>
              </h4>
              <p className="text-xs text-emerald-300/90 leading-relaxed">
                اضغط بالأسفل لإعادة فتح نافذة Google، ثم اختر حسابك واضغط <strong className="text-white">"متابعة"</strong> و <strong className="text-white">"سماح بالأذونات"</strong> دون إغلاق النافذة حتى تختفي تلقائياً.
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowPopupHelpModal(false);
                  handleConnectGoogle();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow cursor-pointer transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>إعادة محاولة فتح نافذة Google الآن</span>
              </button>
            </div>

            {/* Action 3: Manual Access Token */}
            <div className="space-y-2 pt-1 border-t border-emerald-800/60">
              <label className="block text-xs font-bold text-emerald-200">
                أو إدخال رمز تفويض Google يدوياً (OAuth Access Token):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="ya29.a0..."
                  value={manualTokenInput}
                  onChange={e => setManualTokenInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-[#064e3b] border border-emerald-700 text-white font-mono text-xs focus:outline-none focus:border-[#fbbf24]"
                />
                <button
                  type="button"
                  onClick={handleSaveManualToken}
                  disabled={isSavingManualToken || !manualTokenInput.trim()}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs disabled:opacity-50 cursor-pointer shadow transition-all"
                >
                  {isSavingManualToken ? 'جارٍ الحفظ...' : 'حفظ وتفعيل'}
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowPopupHelpModal(false)}
                className="px-6 py-2.5 rounded-xl bg-emerald-900/80 text-emerald-200 hover:text-white hover:bg-emerald-800 text-xs font-bold transition-all cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EXAM CERTIFICATE MODAL                                                    */}
      {/* ========================================================================= */}
      {isCertModalOpen && selectedCertSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
          <div className="bg-[#022c22] border-2 border-[#fbbf24]/50 rounded-3xl w-full max-w-3xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden text-right">
            {/* Top Bar */}
            <div className="bg-gradient-to-r from-[#064e3b] via-[#022c22] to-[#064e3b] px-6 py-4 border-b border-[#065f46] flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#fbbf24]/20 border border-[#fbbf24]/40 text-[#fbbf24] flex items-center justify-center">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-heading">
                    شهادة اجتياز ونتيجة الاختبار القرآني
                  </h3>
                  <p className="text-[11px] text-[#86efac]">
                    للطالب: {selectedCertSubmission.studentName} • {selectedCertSubmission.examTitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCertModalOpen(false);
                  setSelectedCertSubmission(null);
                }}
                className="p-2 text-[#86efac] hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Certificate Preview Card */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex justify-center items-center bg-[#011a14]">
              {(() => {
                const sub = selectedCertSubmission;
                const pct = sub.percentage;
                const gradeLabel = pct >= 90 ? 'ممتاز مرتفع مع مرتبة الشرف' : (pct >= 80 ? 'جيد جداً مرتفع' : (pct >= 65 ? 'جيد' : 'اجتياز معتمد'));
                const studentObj = students.find(s => s.id === sub.studentId || s.name === sub.studentName);
                const parentPhone = studentObj ? getStudentParentPhone(studentObj) : '';
                const cleanPhone = parentPhone ? parentPhone.replace(/\D/g, '') : '';
                const todayFormatted = formatArabicDateTime(sub.submittedAt) || new Intl.DateTimeFormat('ar-SA', { dateStyle: 'long' }).format(new Date());

                return (
                  <div
                    id="exam-printable-certificate"
                    className="w-full max-w-[760px] min-h-[520px] sm:min-h-[560px] md:aspect-[1.414/1] rounded-3xl relative overflow-hidden shadow-2xl flex flex-col justify-between p-5 sm:p-8 md:p-10 text-center border-4 border-[#fbbf24] bg-gradient-to-br from-[#022c22] via-[#064e3b] to-[#022c22] text-white select-none shrink-0 my-auto"
                  >
                    {/* Header */}
                    <div className="flex flex-col items-center justify-center pt-2 sm:pt-1 pb-1">
                      <div className="font-quran text-sm sm:text-base md:text-lg font-bold text-[#fbbf24] tracking-wide leading-normal mb-1.5">
                        بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                      </div>
                      <div className="font-quran text-[11px] sm:text-xs md:text-sm text-[#86efac] opacity-95 leading-relaxed mb-3 sm:mb-4 px-2 text-center max-w-lg">
                        ﴿ يَرْفَعِ اللَّهُ الَّذِينَ آمَنُوا مِنكُمْ وَالَّذِينَ أُوتُوا الْعِلْمَ دَرَجَاتٍ ﴾
                      </div>
                      <h2 className="font-black text-xl sm:text-2xl md:text-3xl text-[#fbbf24] font-heading leading-normal py-1 tracking-normal">
                        شَهَادَةُ اجْتِيَازِ وَتَفَوُّقِ فِي الاخْتِبَارِ
                      </h2>
                    </div>

                    {/* Body */}
                    <div className="space-y-2 sm:space-y-3 my-auto py-2">
                      <p className="text-xs sm:text-sm text-emerald-100/90 font-medium">
                        تَشْهَدُ إِدَارَةُ المَجْمَعِ القُرْآنِيِّ بِأَنَّ الطَّالِبَ النَّجِيبَ:
                      </p>
                      <div className="font-quran text-2xl sm:text-4xl font-black text-[#fbbf24] py-1">
                        {sub.studentName}
                      </div>
                      <p className="text-xs sm:text-sm text-emerald-100/90 font-medium">
                        قَدِ اجْتَازَ بِتَفَوُّقٍ وَجَدَارَةٍ: <strong className="text-white font-bold">({sub.examTitle})</strong>
                      </p>
                      <div className="inline-block bg-[#022c22]/90 border border-[#fbbf24]/50 rounded-2xl px-6 py-2 shadow-inner">
                        <span className="text-xs text-[#86efac] block">النتيجة والتقدير العام:</span>
                        <div className="text-base sm:text-lg font-black text-[#fbbf24] mt-0.5">
                          {sub.totalScoreEarned} / {sub.maxPossibleScore} ({pct}%) • {gradeLabel}
                        </div>
                      </div>
                      <div className="text-[11px] text-[#86efac]/80">
                        الحلقة: {sub.halaqahName || 'الحلقة القرآنية'} • المحاولة #{sub.attemptNumber}
                      </div>
                    </div>

                    {/* Footer - Electronic Accreditation Only (No manual signature required as user requested) */}
                    <div className="pt-3 border-t border-white/20 flex items-center justify-between text-[10px] sm:text-[11px] text-[#86efac]">
                      <span>تاريخ التسليم والاعتماد: {todayFormatted}</span>
                      <div className="flex items-center gap-1.5 font-bold text-[#fbbf24]">
                        <Award className="w-4 h-4" />
                        <span>معتمد إلكترونياً • منصة عُمران</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Actions Bar */}
            <div className="p-4 bg-[#022c22] border-t border-[#fbbf24]/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const sub = selectedCertSubmission;
                    if (!sub) return;
                    try {
                      const canvas = document.createElement('canvas');
                      const width = 1754;
                      const height = 1240;
                      canvas.width = width;
                      canvas.height = height;
                      const ctx = canvas.getContext('2d');
                      if (!ctx) return;
                      try { await document.fonts.ready; } catch (e) {}

                      const grad = ctx.createLinearGradient(0, 0, width, height);
                      grad.addColorStop(0, '#022c22');
                      grad.addColorStop(0.5, '#064e3b');
                      grad.addColorStop(1, '#022c22');
                      ctx.fillStyle = grad;
                      ctx.fillRect(0, 0, width, height);

                      ctx.lineWidth = 18;
                      ctx.strokeStyle = '#fbbf24';
                      ctx.strokeRect(36, 36, width - 72, height - 72);

                      ctx.lineWidth = 3.5;
                      ctx.strokeStyle = '#ffffff44';
                      ctx.strokeRect(56, 56, width - 112, height - 112);

                      ctx.fillStyle = '#fbbf24';
                      ctx.textAlign = 'center';
                      ctx.font = "bold 34px 'Amiri', serif";
                      ctx.fillText('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', width / 2, 130);

                      ctx.fillStyle = '#86efac';
                      ctx.font = "24px 'Amiri', serif";
                      ctx.fillText('﴿ يَرْفَعِ اللَّهُ الَّذِينَ آمَنُوا مِنكُمْ وَالَّذِينَ أُوتُوا الْعِلْمَ دَرَجَاتٍ ﴾', width / 2, 195);

                      ctx.font = "900 58px 'Cairo', sans-serif";
                      ctx.fillStyle = '#fbbf24';
                      ctx.fillText('شَهَادَةُ اجْتِيَازِ وَتَفَوُّقِ فِي الاخْتِبَارِ', width / 2, 305);

                      ctx.font = "26px 'Cairo', sans-serif";
                      ctx.fillStyle = '#f0f9f6';
                      ctx.fillText('تَشْهَدُ إِدَارَةُ المَجْمَعِ القُرْآنِيِّ بِأَنَّ الطَّالِبَ النَّجِيبَ:', width / 2, 410);

                      ctx.font = "bold 70px 'Amiri', serif";
                      ctx.fillStyle = '#fbbf24';
                      ctx.fillText(sub.studentName, width / 2, 515);

                      ctx.font = "bold 30px 'Cairo', sans-serif";
                      ctx.fillStyle = '#ffffff';
                      ctx.fillText(`قَدِ اجْتَازَ بِتَفَوُّقٍ وَجَدَارَةٍ: (${sub.examTitle})`, width / 2, 610);

                      const pct = sub.percentage;
                      const gradeLabel = pct >= 90 ? 'ممتاز مرتفع مع مرتبة الشرف' : (pct >= 80 ? 'جيد جداً مرتفع' : (pct >= 65 ? 'جيد' : 'اجتياز معتمد'));
                      ctx.fillStyle = 'rgba(2, 44, 34, 0.9)';
                      ctx.strokeStyle = '#fbbf24';
                      ctx.lineWidth = 4;
                      ctx.beginPath();
                      ctx.roundRect(width / 2 - 320, 670, 640, 110, 24);
                      ctx.fill();
                      ctx.stroke();

                      ctx.fillStyle = '#86efac';
                      ctx.font = "20px 'Cairo', sans-serif";
                      ctx.fillText('النتيجة والتقدير العام:', width / 2, 710);
                      ctx.fillStyle = '#fbbf24';
                      ctx.font = "bold 32px 'Cairo', sans-serif";
                      ctx.fillText(`${sub.totalScoreEarned} / ${sub.maxPossibleScore} (${pct}%) • ${gradeLabel}`, width / 2, 755);

                      ctx.font = "24px 'Cairo', sans-serif";
                      ctx.fillStyle = '#86efac';
                      ctx.fillText(`الحلقة: ${sub.halaqahName || 'الحلقة القرآنية'} • المحاولة #${sub.attemptNumber}`, width / 2, 840);

                      const todayFmt = formatArabicDateTime(sub.submittedAt) || new Intl.DateTimeFormat('ar-SA', { dateStyle: 'long' }).format(new Date());
                      ctx.font = "20px 'Cairo', sans-serif";
                      ctx.fillStyle = '#86efac';
                      ctx.textAlign = 'right';
                      ctx.fillText(`تاريخ الاعتماد: ${todayFmt}`, width - 100, 1080);

                      ctx.textAlign = 'left';
                      ctx.fillStyle = '#fbbf24';
                      ctx.font = "bold 22px 'Cairo', sans-serif";
                      ctx.fillText(`معتمد إلكترونياً • ${activeComplex?.name || 'مجمع تحفيظ القرآن الكريم'}`, 100, 1080);

                      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
                      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 297, 210);
                      pdf.save(`شهادة_اختبار_${sub.studentName.replace(/\s+/g, '_')}.pdf`);
                    } catch (e) {
                      window.print();
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#fbbf24] hover:bg-[#f59e0b] text-[#064e3b] border border-[#fbbf24] font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
                >
                  <Printer className="w-4 h-4 text-[#064e3b]" />
                  <span>تنزيل كـ PDF فاخر</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const sub = selectedCertSubmission;
                    if (!sub) return;
                    const studentObj = students.find(s => s.id === sub.studentId || s.name === sub.studentName);
                    const parentPhone = studentObj ? getStudentParentPhone(studentObj) : '';
                    const cleanPhone = parentPhone ? parentPhone.replace(/\D/g, '') : '';
                    const message = `السلام عليكم ورحمة الله وبركاته،
نزف إليكم أطيب التهاني بمناسبة اجتياز ابنكم المتميز *(${sub.studentName})* لاختبار:
*(${sub.examTitle})*
بجدارة وتفوق، وحصوله على درجة: *${sub.totalScoreEarned} من ${sub.maxPossibleScore} (${sub.percentage}%)*.

📄 *مرفق مع هذه الرسالة ملف الشهادة المعتمدة (PDF).*
بارك الله في جهوده وجهودكم المباركة في تربيته على مائدة القرآن العظيم.
مع تحيات إدارة: ${activeComplex?.name || sub.halaqahName || 'مجمع تحفيظ القرآن الكريم'}`;

                    try {
                      const canvas = document.createElement('canvas');
                      const width = 1754;
                      const height = 1240;
                      canvas.width = width;
                      canvas.height = height;
                      const ctx = canvas.getContext('2d');
                      if (ctx) {
                        try { await document.fonts.ready; } catch (e) {}

                        const grad = ctx.createLinearGradient(0, 0, width, height);
                        grad.addColorStop(0, '#022c22');
                        grad.addColorStop(0.5, '#064e3b');
                        grad.addColorStop(1, '#022c22');
                        ctx.fillStyle = grad;
                        ctx.fillRect(0, 0, width, height);

                        ctx.lineWidth = 18;
                        ctx.strokeStyle = '#fbbf24';
                        ctx.strokeRect(36, 36, width - 72, height - 72);

                        ctx.lineWidth = 3.5;
                        ctx.strokeStyle = '#ffffff44';
                        ctx.strokeRect(56, 56, width - 112, height - 112);

                        ctx.fillStyle = '#fbbf24';
                        ctx.textAlign = 'center';
                        ctx.font = "bold 34px 'Amiri', serif";
                        ctx.fillText('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', width / 2, 130);

                        ctx.fillStyle = '#86efac';
                        ctx.font = "24px 'Amiri', serif";
                        ctx.fillText('﴿ يَرْفَعِ اللَّهُ الَّذِينَ آمَنُوا مِنكُمْ وَالَّذِينَ أُوتُوا الْعِلْمَ دَرَجَاتٍ ﴾', width / 2, 195);

                        ctx.font = "900 58px 'Cairo', sans-serif";
                        ctx.fillStyle = '#fbbf24';
                        ctx.fillText('شَهَادَةُ اجْتِيَازِ وَتَفَوُّقِ فِي الاخْتِبَارِ', width / 2, 305);

                        ctx.font = "26px 'Cairo', sans-serif";
                        ctx.fillStyle = '#f0f9f6';
                        ctx.fillText('تَشْهَدُ إِدَارَةُ المَجْمَعِ القُرْآنِيِّ بِأَنَّ الطَّالِبَ النَّجِيبَ:', width / 2, 410);

                        ctx.font = "bold 70px 'Amiri', serif";
                        ctx.fillStyle = '#fbbf24';
                        ctx.fillText(sub.studentName, width / 2, 515);

                        ctx.font = "bold 30px 'Cairo', sans-serif";
                        ctx.fillStyle = '#ffffff';
                        ctx.fillText(`قَدِ اجْتَازَ بِتَفَوُّقٍ وَجَدَارَةٍ: (${sub.examTitle})`, width / 2, 610);

                        const pct = sub.percentage;
                        const gradeLabel = pct >= 90 ? 'ممتاز مرتفع مع مرتبة الشرف' : (pct >= 80 ? 'جيد جداً مرتفع' : (pct >= 65 ? 'جيد' : 'اجتياز معتمد'));
                        ctx.fillStyle = 'rgba(2, 44, 34, 0.9)';
                        ctx.strokeStyle = '#fbbf24';
                        ctx.lineWidth = 4;
                        ctx.beginPath();
                        ctx.roundRect(width / 2 - 320, 670, 640, 110, 24);
                        ctx.fill();
                        ctx.stroke();

                        ctx.fillStyle = '#86efac';
                        ctx.font = "20px 'Cairo', sans-serif";
                        ctx.fillText('النتيجة والتقدير العام:', width / 2, 710);
                        ctx.fillStyle = '#fbbf24';
                        ctx.font = "bold 32px 'Cairo', sans-serif";
                        ctx.fillText(`${sub.totalScoreEarned} / ${sub.maxPossibleScore} (${pct}%) • ${gradeLabel}`, width / 2, 755);

                        ctx.font = "24px 'Cairo', sans-serif";
                        ctx.fillStyle = '#86efac';
                        ctx.fillText(`الحلقة: ${sub.halaqahName || 'الحلقة القرآنية'} • المحاولة #${sub.attemptNumber}`, width / 2, 840);

                        const todayFmt = formatArabicDateTime(sub.submittedAt) || new Intl.DateTimeFormat('ar-SA', { dateStyle: 'long' }).format(new Date());
                        ctx.font = "20px 'Cairo', sans-serif";
                        ctx.fillStyle = '#86efac';
                        ctx.textAlign = 'right';
                        ctx.fillText(`تاريخ الاعتماد: ${todayFmt}`, width - 100, 1080);

                        ctx.textAlign = 'left';
                        ctx.fillStyle = '#fbbf24';
                        ctx.font = "bold 22px 'Cairo', sans-serif";
                        ctx.fillText(`معتمد إلكترونياً • ${activeComplex?.name || 'مجمع تحفيظ القرآن الكريم'}`, 100, 1080);

                        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
                        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 297, 210);
                        const pdfBlob = pdf.output('blob');
                        const fileName = `شهادة_اختبار_${sub.studentName.replace(/\s+/g, '_')}.pdf`;
                        const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

                        if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
                          try {
                            await navigator.share({
                              files: [pdfFile],
                              title: `شهادة اختبار: ${sub.studentName}`,
                              text: message
                            });
                            return;
                          } catch (shErr: any) {
                            if (shErr.name === 'AbortError') return;
                          }
                        }

                        pdf.save(fileName);
                      }
                    } catch {
                      // Handled silently
                    }

                    const waUrl = cleanPhone
                      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
                      : `https://wa.me/?text=${encodeURIComponent(message)}`;
                    const waLink = document.createElement('a');
                    waLink.href = waUrl;
                    waLink.target = '_blank';
                    waLink.rel = 'noopener noreferrer';
                    document.body.appendChild(waLink);
                    waLink.click();
                    document.body.removeChild(waLink);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:brightness-110 text-white font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all"
                >
                  <Send className="w-4 h-4" />
                  <span>إرسال عبر واتساب (ملف PDF)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODEL ANSWER / SOLUTION KEY PREVIEW MODAL (معاينة نموذج الإجابة النموذجي) */}
      {modelAnswerExam && (
        <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto overscroll-contain">
          <div className="relative w-full max-w-4xl bg-[#064e3b] border border-emerald-400/50 rounded-3xl shadow-2xl shadow-emerald-950/90 flex flex-col max-h-[92vh] my-auto overflow-hidden animate-fadeIn text-[#f0f9f6]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[#065f46] shrink-0 bg-[#022c22]/95">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black font-heading text-white flex items-center gap-2">
                    <span>نموذج الإجابة والحل النموذجي: {modelAnswerExam.title}</span>
                    <span className="text-xs bg-[#fbbf24] text-[#064e3b] px-2.5 py-0.5 rounded-full font-sans font-bold">
                      دليل التصحيح
                    </span>
                  </h3>
                  <p className="text-xs text-[#86efac]/90 mt-0.5">
                    الأسئلة والإجابات الصحيحة المعتمدة وتوزيع الدرجات المخصص للمعلمين والمشرفين
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModelAnswerExam(null)}
                className="p-1.5 text-[#86efac] hover:text-white rounded-xl cursor-pointer hover:bg-[#064e3b] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Stats Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-[#022c22]/80 border-b border-[#065f46] text-xs">
              <div className="flex items-center gap-4">
                <span className="text-emerald-200">
                  عدد الأسئلة: <strong className="text-white font-mono text-sm">{modelAnswerExam.questions.length}</strong>
                </span>
                <span className="w-1 h-1 rounded-full bg-emerald-600" />
                <span className="text-emerald-200">
                  إجمالي الدرجات: <strong className="text-amber-300 font-mono text-sm">{modelAnswerExam.totalPoints}</strong> درجة
                </span>
                <span className="w-1 h-1 rounded-full bg-emerald-600" />
                <span className="text-emerald-200">
                  نمط الاختبار: <strong className="text-white">منصة عُمْرَان</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1 rounded-xl bg-[#064e3b] hover:bg-[#022c22] text-[#86efac] border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة نموذج الإجابة</span>
              </button>
            </div>

            {/* Modal Content / Questions List */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-right">
              {modelAnswerExam.questions.map((q, idx) => (
                <div
                  key={q.id || idx}
                  className="bg-[#022c22]/70 border border-[#065f46] hover:border-emerald-500/50 rounded-2xl p-4 sm:p-5 space-y-3 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className="w-7 h-7 rounded-lg bg-[#fbbf24]/20 border border-[#fbbf24]/40 text-[#fbbf24] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div>
                        <h4 className="font-bold text-white text-sm sm:text-base leading-relaxed">
                          {q.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-[#86efac]/80">
                          <span>النوع: {q.type === 'multiple_choice' ? 'اختيار من متعدد' : q.type === 'true_false' ? 'صح / خطأ' : q.type === 'short_answer' ? 'إجابة قصيرة' : 'سؤال مقالي'}</span>
                          <span>• الدرجة: {q.points} نقاط</span>
                        </div>
                      </div>
                    </div>
                    <span className="px-2 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-600/40 text-xs font-mono font-bold shrink-0">
                      +{q.points} درجات
                    </span>
                  </div>

                  {/* Options List with Highlighted Correct Answer */}
                  {(q.type === 'multiple_choice' || q.type === 'true_false') && q.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#065f46]/60">
                      {q.options.map((opt, optIdx) => {
                        const isCorrect = String(opt).trim() === String(q.correctAnswer).trim();
                        return (
                          <div
                            key={optIdx}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs transition-all ${
                              isCorrect
                                ? 'bg-emerald-900/60 border-emerald-400 text-white font-bold ring-2 ring-emerald-400/30'
                                : 'bg-[#064e3b]/40 border-[#065f46] text-emerald-200/70'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full border border-white/20 flex items-center justify-center text-[10px] font-mono">
                                {optIdx + 1}
                              </span>
                              <span>{opt}</span>
                            </span>
                            {isCorrect && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-300 bg-emerald-950 px-2 py-0.5 rounded-md border border-emerald-500/50">
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span>الإجابة الصحيحة</span>
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Text / Essay Correct Answer Display */}
                  {(q.type === 'short_answer' || q.type === 'essay') && (
                    <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-600/50 space-y-1">
                      <span className="text-[11px] font-bold text-amber-300 block">
                        الإجابة النموذجية المعتمدة:
                      </span>
                      <p className="text-xs text-emerald-100 font-semibold leading-relaxed">
                        {q.correctAnswer || 'تُصحح الإجابة تقديرياً بواسطة المعلم بناءً على فهم الطالب للمعنى ودقة التعبير.'}
                      </p>
                    </div>
                  )}

                  {/* Explanation note if present */}
                  {q.explanation && (
                    <div className="p-3 rounded-xl bg-[#064e3b]/50 border border-emerald-800 text-xs text-emerald-200 flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-[#fbbf24] shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-amber-300 block mb-0.5">الشرح والتوجيه التعليمي:</strong>
                        <span>{q.explanation}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-t border-[#065f46] shrink-0 bg-[#022c22]/95">
              <span className="text-xs text-[#86efac]/80">
                منظومة عُمْرَان • نموذج الإجابة السحابي المعتمد
              </span>
              <button
                type="button"
                onClick={() => setModelAnswerExam(null)}
                className="px-6 py-2 rounded-xl bg-[#fbbf24] hover:bg-[#f59e0b] text-[#064e3b] text-xs sm:text-sm font-black transition-all cursor-pointer shadow-md"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
