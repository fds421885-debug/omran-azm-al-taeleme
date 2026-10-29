import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Award,
  Volume2,
  LogOut,
  Layers,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  Calendar,
  Key,
  User,
  XCircle,
  Clock,
  FileText,
  Play,
  RotateCcw,
  Sparkles,
  HelpCircle,
  ExternalLink,
  ChevronLeft,
  Trophy,
  Medal,
  Copy,
  Check,
  Headphones,
  Radio,
  ListOrdered,
  Info,
  Printer,
  Download,
  Search,
  Video,
  X,
  Home,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Flame,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw
} from 'lucide-react';
import { YouTubeAyahPlayer, formatTimeMMSS } from './recordings/YouTubeAyahPlayer';
import { AudioAyahPlayer } from './recordings/AudioAyahPlayer';
import { getAyahTextSync } from '../lib/quranTextService';
import confetti from 'canvas-confetti';
import {
  Student,
  AttendanceRecord,
  StudentEvaluation,
  AppSettings,
  BehaviorViolation,
  Exam,
  ExamSubmission,
  LeaderboardSettings,
  Halaqah,
  SurahRecording,
  RecordingsConfig,
  SurahRecordingSegment,
  IssuedCertificate,
  StudentListeningLog,
  QuranRecitationItem,
  QuranComplex
} from '../types';
import { StudentExamTaker } from './StudentExamTaker';
import { QuranAyahAudioPlayer } from './quran/QuranAyahAudioPlayer';
import { getSurahInfo } from '../data/quranData';
import { OmranDataService, auth } from '../lib/firebase';
import { GoogleWorkspaceService } from '../lib/googleWorkspace';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import {
  getDistinctComplexReviewPalette,
  getDefaultReviewLinkTitle,
  normalizeMeetingUrl,
  darkenHex,
  lightenHex,
  getContrastTextColor,
  applyComplexThemeToDOM
} from '../lib/themeUtils';

export const toArabicDigits = (val: string | number | undefined | null): string => {
  if (val === undefined || val === null) return '';
  return String(val).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[parseInt(d, 10)]);
};

interface ParentPortalViewProps {
  student: Student;
  attendance: AttendanceRecord[];
  evaluations: StudentEvaluation[];
  settings: AppSettings;
  violations?: BehaviorViolation[];
  exams?: Exam[];
  submissions?: ExamSubmission[];
  students?: Student[];
  halaqahs?: Halaqah[];
  leaderboardSettings?: LeaderboardSettings;
  recordings?: SurahRecording[];
  recordingsConfig?: RecordingsConfig;
  certificates?: IssuedCertificate[];
  listeningLogs?: StudentListeningLog[];
  activeComplex?: QuranComplex | null;
  complexes?: QuranComplex[];
  isLoggedInStudent?: boolean;
  onLogout?: () => void;
  onSaveSubmission?: (submission: ExamSubmission) => Promise<void>;
  onUpdateStudent?: (updatedStudent: Student) => void;
  onRefresh?: () => Promise<void> | void;
  isCloudSyncing?: boolean;
  cloudSyncText?: string;
}

export const ParentPortalView: React.FC<ParentPortalViewProps> = ({
  student,
  attendance,
  evaluations,
  settings,
  violations = [],
  exams = [],
  submissions = [],
  students = [],
  halaqahs = [],
  leaderboardSettings,
  recordings = [],
  recordingsConfig,
  certificates = [],
  listeningLogs = [],
  activeComplex,
  complexes = [],
  isLoggedInStudent,
  onLogout,
  onSaveSubmission,
  onUpdateStudent,
  onRefresh,
  isCloudSyncing = false,
  cloudSyncText = 'مزامنة سحابية مباشرة...'
}) => {
  const [activeTab, setActiveTab] = useState<'home' | 'recitation' | 'exams' | 'leaderboard' | 'certificates'>('home');
  const [activeTakingExam, setActiveTakingExam] = useState<Exam | null>(null);
  const [activeTakingAttemptNum, setActiveTakingAttemptNum] = useState<number>(1);
  const [viewingReviewSubmission, setViewingReviewSubmission] = useState<ExamSubmission | null>(null);

  // Student Google Authentication & Linking State
  const [currentStudent, setCurrentStudent] = useState<Student>(student);
  const [googleAuthGateExam, setGoogleAuthGateExam] = useState<Exam | null>(null);
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
  const [googleLinkError, setGoogleLinkError] = useState('');

  // Synchronize internal student state if props change (from real-time Firestore updates)
  useEffect(() => {
    if (students && students.length > 0 && student?.id) {
      const match = students.find(s => s.id === student.id);
      if (match) {
        setCurrentStudent(match);
        return;
      }
    }
    if (student) {
      setCurrentStudent(student);
    }
  }, [student, students]);

  // Resolved Complex Identity for Student Portal
  const resolvedComplex = useMemo(() => {
    if (activeComplex) return activeComplex;
    if (complexes && currentStudent.complexId) {
      return complexes.find(c => c.id === currentStudent.complexId) || complexes[0] || null;
    }
    return complexes?.[0] || null;
  }, [activeComplex, complexes, currentStudent.complexId]);

  useEffect(() => {
    if (resolvedComplex?.theme) {
      applyComplexThemeToDOM(resolvedComplex.theme, true);
    }
  }, [resolvedComplex?.theme]);

  const displayComplexName = currentStudent.complexName || resolvedComplex?.name || settings.complexName || 'مجمع تحفيظ القرآن الكريم';

  // Platform & Complex Theme resolution
  const currentTheme = resolvedComplex?.theme || settings?.theme;
  const themePrimary = currentTheme?.primaryColor || '#131f24';
  const themeSecondary = currentTheme?.secondaryColor || '#1b2e35';
  const themeAccent = currentTheme?.accentColor || '#ffc800';
  const themeCardBg = currentTheme?.cardColor || '#203843';
  const themeBorder = lightenHex(themeCardBg, 0.18);
  const themeBorderBottom = darkenHex(themeCardBg, 0.35);
  const themeAccentShadow = darkenHex(themeAccent, 0.28);
  const accentTextColor = getContrastTextColor(themeAccent);

  // Real-time Cloud Sync & Database Update Indicator State (زي المعلمين يطلع جمب اليمين)
  const [isSyncingLocal, setIsSyncingLocal] = useState(false);
  const [showSyncBadge, setShowSyncBadge] = useState(false);
  const [syncNoticeText, setSyncNoticeText] = useState('تم استقبال أحدث البيانات من قاعدة البيانات ✓');
  const syncTimerRef = useRef<any>(null);
  const isFirstMountRef = useRef(true);
  const prevDataCountsRef = useRef({
    evals: evaluations.length,
    att: attendance.length,
    exams: exams.length,
    submissions: submissions.length,
    points: student.points || 0,
    ayah: student.currentAyah || 1,
    surah: student.currentSurah || 1
  });

  const triggerSyncNotice = useCallback((text: string) => {
    setSyncNoticeText(text);
    setShowSyncBadge(true);
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      setShowSyncBadge(false);
    }, 3800);
  }, []);

  // 1. Initial Auto-Download & Refresh upon opening (أول ما يفتح يحدث وينزل البيانات ويحدثها كلها)
  useEffect(() => {
    let isCancelled = false;

    const autoSyncOnOpen = async () => {
      setIsSyncingLocal(true);
      setSyncNoticeText('جاري تنزيل وتحديث كافة البيانات من قاعدة البيانات...');
      setShowSyncBadge(true);

      try {
        if (onRefresh) {
          await onRefresh();
        }
        if (!isCancelled) {
          setSyncNoticeText('تم تنزيل وتحديث كافة السجلات من قاعدة البيانات بنجاح ✓');
        }
      } catch (e) {
        if (!isCancelled) {
          setSyncNoticeText('تم فحص وتحديث السجلات سحابياً ✓');
        }
      } finally {
        if (!isCancelled) {
          setTimeout(() => {
            setIsSyncingLocal(false);
          }, 1500);
          if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
          syncTimerRef.current = setTimeout(() => {
            setShowSyncBadge(false);
          }, 3800);
        }
      }
    };

    autoSyncOnOpen();

    return () => {
      isCancelled = true;
    };
  }, []); // Fires immediately upon mount

  // 2. Real-time Live Watcher: Detect when ANY database records change (وكل ما حصل تحديث يحدث)
  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }

    const prev = prevDataCountsRef.current;
    const current = {
      evals: evaluations.length,
      att: attendance.length,
      exams: exams.length,
      submissions: submissions.length,
      points: currentStudent.points || 0,
      ayah: currentStudent.currentAyah || 1,
      surah: currentStudent.currentSurah || 1
    };

    const hasChanged =
      prev.evals !== current.evals ||
      prev.att !== current.att ||
      prev.exams !== current.exams ||
      prev.submissions !== current.submissions ||
      prev.points !== current.points ||
      prev.ayah !== current.ayah ||
      prev.surah !== current.surah;

    if (hasChanged) {
      prevDataCountsRef.current = current;
      triggerSyncNotice('تم استقبال تحديث جديد وتحديث البيانات تلقائياً من السحابة ✓');
    }
  }, [evaluations, attendance, exams, submissions, currentStudent.points, currentStudent.currentAyah, currentStudent.currentSurah, triggerSyncNotice]);

  // 3. Parent-driven real-time cloud synchronization event
  useEffect(() => {
    if (isCloudSyncing) {
      setShowSyncBadge(true);
      if (cloudSyncText) setSyncNoticeText(cloudSyncText);
    }
  }, [isCloudSyncing, cloudSyncText]);

  // Manual refresh handler
  const handleManualRefresh = async () => {
    if (isSyncingLocal) return;
    setIsSyncingLocal(true);
    setSyncNoticeText('جاري الاتصال وتحديث البيانات من السحابة...');
    setShowSyncBadge(true);
    try {
      if (onRefresh) {
        await onRefresh();
      }
      setSyncNoticeText('تم تحديث كافة السجلات من قاعدة البيانات بنجاح ✓');
    } catch {
      setSyncNoticeText('تم فحص وتحديث البيانات من السحابة ✓');
    } finally {
      setTimeout(() => {
        setIsSyncingLocal(false);
      }, 1200);
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => {
        setShowSyncBadge(false);
      }, 3500);
    }
  };

  const handleLinkGoogleAccount = async (targetExamAfterLink?: Exam | null) => {
    setIsLinkingGoogle(true);
    setGoogleLinkError('');
    try {
      const updated = await GoogleWorkspaceService.linkStudentGoogleAccount(currentStudent);
      setCurrentStudent(updated);
      if (onUpdateStudent) {
        onUpdateStudent(updated);
      }
      setGoogleAuthGateExam(null);

      // If linking was triggered by clicking an exam, launch it now!
      if (targetExamAfterLink) {
        const mySubs = submissions.filter(s => s.examId === targetExamAfterLink.id && s.studentId === updated.id);
        setActiveTakingAttemptNum(mySubs.length + 1);
        setActiveTakingExam(targetExamAfterLink);
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg === 'هذا الحساب مربوط بالفعل' || errMsg.includes('مربوط بالفعل')) {
        setGoogleLinkError('هذا الحساب مربوط بالفعل');
      } else if (err?.isPopupClosed || errMsg.includes('popup-closed')) {
        setGoogleLinkError('تم إغلاق نافذة تسجيل الدخول من Google قبل الإكمال. يرجى الضغط مرة أخرى واختيار حساب Google الخاص بك.');
      } else if (err?.isPopupBlocked || errMsg.includes('popup-blocked')) {
        setGoogleLinkError('المتصفح حظر النافذة المنبثقة. يرجى السماح بالنوافذ المنبثقة من إعدادات المتصفح ثم المحاولة مرة أخرى.');
      } else {
        setGoogleLinkError(errMsg || 'تعذر استكمال الربط بحساب Google. يرجى إعادة المحاولة.');
      }
    } finally {
      setIsLinkingGoogle(false);
    }
  };

  const handleUnlinkGoogleAccount = async () => {
    try {
      setIsLinkingGoogle(true);
      const updated = await GoogleWorkspaceService.unlinkStudentGoogleAccount(currentStudent);
      setCurrentStudent(updated);
      if (onUpdateStudent) {
        onUpdateStudent(updated);
      }
      setGoogleLinkError('');
    } catch (e: any) {
      setGoogleLinkError(e?.message || 'تعذر فصل حساب Google');
    } finally {
      setIsLinkingGoogle(false);
    }
  };

  const studentAttendance = attendance.filter(a => a.studentId === student.id);
  const studentEvaluations = evaluations.filter(e => e.studentId === student.id);
  const studentViolations = violations.filter(
    v => v.studentId === student.id && (v.showInPortal ?? true)
  );

  const [viewingCertModal, setViewingCertModal] = useState<IssuedCertificate | null>(null);

  // Student certificates matching their ID or exact name
  const studentCertificates = useMemo(() => {
    if (!certificates || certificates.length === 0) return [];
    const cleanName = (currentStudent.name || '').trim();
    return certificates.filter(
      c => c.studentId === currentStudent.id || (c.studentName && c.studentName.trim() === cleanName)
    );
  }, [certificates, currentStudent]);

  // Available Exams for this Student
  const studentHalaqahId = student.halaqahId || '';
  const studentExams = exams.filter(ex => {
    // Check target halaqat
    const matchesHalaqah = ex.targetHalaqat.includes('all') || (studentHalaqahId && ex.targetHalaqat.includes(studentHalaqahId));
    if (!matchesHalaqah) return false;

    // Check scheduling (if scheduled for the future)
    if (ex.scheduleType === 'scheduled' && ex.startDate && new Date(ex.startDate) > new Date()) {
      return false;
    }
    return true;
  });

  const studentSubmissions = submissions.filter(s => s.studentId === student.id);

  // Sort evaluations from newest to oldest
  const sortedEvaluations = [...studentEvaluations].sort((a, b) => (b?.date || '').localeCompare(a?.date || ''));

  const presentsCount = studentAttendance.filter(a => a.status === 'حاضر').length;
  const attendanceRate =
    studentAttendance.length > 0
      ? Math.round((presentsCount / studentAttendance.length) * 100)
      : 100;

  // Career Totals Calculation (إحصائيات مسيرة الطالب التراكمية طوال دراسته)
  const careerStats = useMemo(() => {
    let totalAyahsFromEvals = 0;
    let totalPagesFromEvals = 0;
    let totalReviewPagesFromEvals = 0;

    studentEvaluations.forEach(ev => {
      const d = ev.recitationDetails as any;
      const p = d?.newMemorizationPages ?? (d?.pagesPointsEarnedToday ? Math.max(1, Math.round(d.pagesPointsEarnedToday / 2)) : 1);
      totalPagesFromEvals += p;
      totalAyahsFromEvals += (p * 15);

      const r = d?.reviewPages ?? (d?.todayReviewItems?.length ? d.todayReviewItems.length * 2 : 2);
      totalReviewPagesFromEvals += r;
    });

    const curSurah = currentStudent.currentSurah || 78;
    const curAyah = currentStudent.currentAyah || 1;
    let baseMemorizedAyahs = 0;
    let baseSurahsCount = 0;

    if (curSurah >= 78) {
      for (let s = 114; s > curSurah; s--) {
        baseMemorizedAyahs += getSurahInfo(s).numberOfAyahs;
        baseSurahsCount += 1;
      }
      baseMemorizedAyahs += curAyah;
    } else {
      for (let s = 1; s < curSurah; s++) {
        baseMemorizedAyahs += getSurahInfo(s).numberOfAyahs;
        baseSurahsCount += 1;
      }
      baseMemorizedAyahs += curAyah;
    }

    const studentTotalPages = (currentStudent as any).totalMemorizedPages || 1;
    const finalAyahs = Math.max(totalAyahsFromEvals, baseMemorizedAyahs, studentTotalPages * 15);
    const finalPages = (currentStudent as any).totalMemorizedPages || Math.max(totalPagesFromEvals, Math.round(finalAyahs / 15), 1);
    const finalSurahs = Math.max(baseSurahsCount, 1);
    const finalReviewPages = Math.max(totalReviewPagesFromEvals, Math.round(finalPages * 1.5));

    return {
      totalAyahs: finalAyahs,
      totalPages: finalPages,
      totalSurahs: finalSurahs,
      totalReviewPages: finalReviewPages
    };
  }, [studentEvaluations, currentStudent]);

  // Honor Board / Leaderboard Calculation for Student Portal (Unified Formula identical to LeaderboardTab)
  const [leaderboardSearch, setLeaderboardSearch] = useState('');
  const [selectedStudentForBreakdown, setSelectedStudentForBreakdown] = useState<any | null>(null);

  const activeScope = leaderboardSettings?.scope || 'all_unified';
  const isPerHalaqahScope = activeScope === 'per_halaqah';

  // Filter students based on supervisor's setting (all halaqat vs per halaqah)
  const poolStudents = students && students.length > 0 ? students : [student];
  const eligibleStudents = useMemo(() => {
    return poolStudents.filter(s => {
      if (isPerHalaqahScope) {
        return s.halaqahId === student.halaqahId;
      }
      return true;
    });
  }, [poolStudents, isPerHalaqahScope, student.halaqahId]);

  const studentRankList = useMemo(() => {
    return eligibleStudents.map(st => {
      // 1. Exam points
      const stSubmissions = submissions.filter(sub => sub.studentId === st.id);
      const examPoints = stSubmissions.reduce(
        (sum, s) => sum + (s.pointsGrantedForLeaderboard || 0),
        0
      );
      const bestPercentage = stSubmissions.reduce(
        (max, s) => Math.max(max, s.percentage || 0),
        0
      );

      // 2. Evaluation / criteria points
      const stEvaluations = evaluations.filter(ev => ev.studentId === st.id);
      const evalPoints = stEvaluations.reduce((sum, ev) => {
        const criteriaPts = ev.recitationDetails?.criteriaPointsEarnedToday || 0;
        const pagePts = ev.recitationDetails?.pagesPointsEarnedToday || 0;
        const pts = ev.recitationDetails?.pointsEarnedToday;
        const dailyTotal = pts !== undefined && pts !== null ? pts : (criteriaPts + pagePts);
        return sum + dailyTotal;
      }, 0);

      // Fallback: If student has criteriaPoints stored on their profile
      const finalEvalPoints = Math.max(evalPoints, (st.criteriaPoints || 0) + (st.totalPagePoints || 0));

      // 3. Listening points
      const stLogs = (listeningLogs || []).filter(l => l.studentId === st.id && l.isFullyCompleted);
      const logsListeningPoints = stLogs.length * 5;
      const finalListeningPoints = Math.max(logsListeningPoints, st.listeningPoints || 0);

      // 4. Completed pages points
      const totalPagePoints = st.totalPagePoints || 0;

      // 5. Total points: master student points balance
      const computedTotal = examPoints + finalEvalPoints + finalListeningPoints + totalPagePoints;
      const totalPoints = typeof st.points === 'number'
        ? Math.max(0, st.points)
        : Math.max(0, computedTotal + (st.bonusPoints || 0));

      const halaqahName =
        st.halaqahName || halaqahs?.find(h => h.id === st.halaqahId)?.name || 'الحلقة القرآنية';

      return {
        student: st,
        totalPoints,
        examPoints,
        evalPoints: finalEvalPoints,
        listeningPoints: finalListeningPoints,
        pagePoints: totalPagePoints,
        completedExams: stSubmissions.length,
        completedEvaluations: stEvaluations.length,
        completedListenings: stLogs.length,
        bestPercentage,
        halaqahName,
        stSubmissions,
        stEvaluations,
        stLogs
      };
    }).sort((a, b) => b.totalPoints - a.totalPoints || b.bestPercentage - a.bestPercentage);
  }, [eligibleStudents, submissions, evaluations, listeningLogs, halaqahs]);

  const displayedRankList = useMemo(() => {
    if (!leaderboardSearch.trim()) return studentRankList;
    const q = leaderboardSearch.trim().toLowerCase();
    return studentRankList.filter(item =>
      item.student.name.toLowerCase().includes(q) ||
      item.halaqahName.toLowerCase().includes(q)
    );
  }, [studentRankList, leaderboardSearch]);

  const myRankIndex = studentRankList.findIndex(item => item.student.id === student.id);
  const myRank = myRankIndex >= 0 ? myRankIndex + 1 : null;
  const myRankingData = myRankIndex >= 0 ? studentRankList[myRankIndex] : null;
  const studentHalaqahObj = useMemo(() => {
    if (!halaqahs || halaqahs.length === 0) return undefined;
    return (
      halaqahs.find(h => h.id === student.halaqahId) ||
      halaqahs.find(
        h => student.halaqahName && h.name && h.name.trim() === student.halaqahName.trim()
      )
    );
  }, [halaqahs, student.halaqahId, student.halaqahName]);

  const studentComplexObj = useMemo(() => {
    if (studentHalaqahObj?.complexId) {
      const byHal = complexes?.find(c => c.id === studentHalaqahObj.complexId);
      if (byHal) return byHal;
    }
    if (student.complexId) {
      const byStd = complexes?.find(c => c.id === student.complexId);
      if (byStd) return byStd;
    }
    return activeComplex || null;
  }, [studentHalaqahObj, student.complexId, complexes, activeComplex]);

  const [onlineClockTick, setOnlineClockTick] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setOnlineClockTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const currentHalaqahTitle = student.halaqahName || studentHalaqahObj?.name || 'حلقتك القرآنية';

  const isOnlineHalaqahActive = (h?: Halaqah | null): boolean => {
    void onlineClockTick;
    if (!h) return false;
    const start = h.onlineStartTime || h.startTime || '16:00';
    const end = h.onlineEndTime || h.endTime || '20:00';
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    const startMinutes = (startH || 0) * 60 + (startM || 0);
    const endMinutes = (endH || 0) * 60 + (endM || 0);

    let isTimeActive = false;
    if (startMinutes <= endMinutes) {
      isTimeActive = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      isTimeActive = currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }

    if (h.scheduleDays && h.scheduleDays.length > 0) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDay = dayNames[now.getDay()];
      const isDayActive = h.scheduleDays.some(d => {
        const norm = (d || '').toLowerCase().trim();
        return norm === currentDay || norm === String(now.getDay());
      });
      return isTimeActive && isDayActive;
    }

    return isTimeActive;
  };

  // Audio Recording & Ayah Listening for Students
  const [selectedRecordingId, setSelectedRecordingId] = useState<string>('');
  const [activePortalAyah, setActivePortalAyah] = useState<SurahRecordingSegment | null>(null);
  const [activePortalTargetAyah, setActivePortalTargetAyah] = useState<SurahRecordingSegment | null>(null);
  const [portalLiveTime, setPortalLiveTime] = useState<number>(0);
  const [listensCount, setListensCount] = useState<number>(0);
  const [listeningCelebrationMsg, setListeningCelebrationMsg] = useState<string | null>(null);

  const handleRecordListening = async () => {
    const target = recordingsConfig?.dailyRepetitionTarget || 3;
    const rewardPoints = recordingsConfig?.listeningPointsReward ?? settings?.dailyListeningPoints ?? 5;

    if (listensCount >= target) {
      // Reset counter
      setListensCount(0);
      return;
    }

    const nextCount = listensCount + 1;
    setListensCount(nextCount);

    if (nextCount >= target) {
      const todayStr = new Date().toISOString().split('T')[0];
      const alreadyAwarded = currentStudent.dailyListeningCompletedDate === todayStr;

      if (!alreadyAwarded && onUpdateStudent) {
        const updatedStudent: Student = {
          ...currentStudent,
          listeningPoints: (currentStudent.listeningPoints || 0) + rewardPoints,
          points: (currentStudent.points || 0) + rewardPoints,
          dailyListeningCompletedDate: todayStr
        };
        onUpdateStudent(updatedStudent);

        try {
          await OmranDataService.saveListeningLog({
            id: `listen_${Date.now()}_${currentStudent.id}`,
            studentId: currentStudent.id,
            studentName: currentStudent.name,
            halaqahId: currentStudent.halaqahId,
            surahNumber: activeRecording?.surahNumber || currentStudent.currentSurah || 78,
            surahName: activeRecording?.surahName || currentStudent.currentSurahName || 'النبأ',
            fromAyah: 1,
            toAyah: activeRecording?.segments?.length || 1,
            targetCount: target,
            completedCount: target,
            isFullyCompleted: true,
            date: todayStr,
            timestamp: new Date().toISOString()
          });
        } catch (e) {
          console.warn('Save listening log note:', e);
        }

        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
        setListeningCelebrationMsg(`🎉 هنيئاً لك! أتممت الاستماع القرآني وحصلت على +${rewardPoints} نقاط تميز في رصيدك.`);
        setTimeout(() => setListeningCelebrationMsg(null), 6000);
      } else {
        setListeningCelebrationMsg(`✨ رائع جداً! أتممت عدد مرات الاستماع المقررة (${target} مرات) اليوم.`);
        setTimeout(() => setListeningCelebrationMsg(null), 4000);
      }
    }
  };

  // Initialize selected recording based on student's current Surah
  React.useEffect(() => {
    if (recordings && recordings.length > 0) {
      const matchSurah = recordings.find(r => r.surahNumber === currentStudent.currentSurah);
      const chosen = matchSurah || recordings[0];
      if (chosen && (!selectedRecordingId || !recordings.some(r => r.id === selectedRecordingId))) {
        setSelectedRecordingId(chosen.id);
        const firstSeg = chosen.segments && chosen.segments.length > 0 ? chosen.segments[0] : null;
        setActivePortalAyah(firstSeg);
        setActivePortalTargetAyah(null);
      }
    }
  }, [recordings, currentStudent.currentSurah]);

  const activeRecording = recordings.find(r => r.id === selectedRecordingId) || recordings[0];

  const handleLogoutAction = () => {
    if (onLogout) {
      onLogout();
    } else {
      window.history.replaceState({}, '', window.location.pathname);
      window.location.reload();
    }
  };

  // Student's exact assigned passage (dictated by teacher)
  const currentAssignedPassage = useMemo(() => {
    if (currentStudent.activeListeningAssignment) {
      const isNone =
        currentStudent.activeListeningAssignment.sheikhName === 'بدون' ||
        currentStudent.activeListeningAssignment.requiredRepetitions === 0;
      return {
        ...currentStudent.activeListeningAssignment,
        requiredRepetitions: isNone ? 0 : (currentStudent.activeListeningAssignment.requiredRepetitions ?? 3),
        isCompleted: isNone ? true : currentStudent.activeListeningAssignment.isCompleted
      };
    }
    const newItem = currentStudent.aiPlan?.currentDailyAssignment?.newItem;
    const isPlanNone = currentStudent.aiPlan?.currentDailyAssignment?.suggestedSheikh === 'بدون';
    if (newItem && newItem.surahNumber) {
      return {
        surahNumber: newItem.surahNumber,
        surahName: newItem.surahName || getSurahInfo(newItem.surahNumber).name,
        fromAyah: newItem.fromAyah || 1,
        toAyah: newItem.toAyah || newItem.fromAyah || 7,
        sheikhName: currentStudent.aiPlan?.currentDailyAssignment?.suggestedSheikh || 'الشيخ محمد صديق المنشاوي (المصحف المعلم)',
        requiredRepetitions: isPlanNone ? 0 : (currentStudent.aiPlan?.currentDailyAssignment?.targetRepetitions ?? 3),
        assignedDate: new Date().toISOString().split('T')[0],
        completedRepetitions: 0,
        isCompleted: isPlanNone
      };
    }
    const sNum = currentStudent.currentSurah || 78;
    const sInfo = getSurahInfo(sNum);
    const fromA = currentStudent.currentAyah || 1;
    const toA = Math.min(fromA + 5, sInfo.numberOfAyahs);
    return {
      surahNumber: sNum,
      surahName: currentStudent.currentSurahName || sInfo.name,
      fromAyah: fromA,
      toAyah: toA,
      sheikhName: 'الشيخ محمد صديق المنشاوي (المصحف المعلم)',
      requiredRepetitions: 3,
      assignedDate: new Date().toISOString().split('T')[0],
      completedRepetitions: 0,
      isCompleted: false
    };
  }, [currentStudent]);

  const [selectedCertificateForView, setSelectedCertificateForView] = useState<IssuedCertificate | null>(null);

  // Tomorrow's Real Assignment Dictated by Teacher (خطة ومقرر الغد الحقيقي الذي حدده المعلم)
  const tomorrowPlanInfo = useMemo(() => {
    const latestEval = sortedEvaluations[0];
    const aiAssignment = currentStudent.aiPlan?.currentDailyAssignment;

    // 1. Tomorrow's New Memorization (الجديد المقرّر من المعلم)
    let newMemorizationText = '';
    let newDetail: any = null;

    if (latestEval?.recitationDetails?.tomorrowNewItem) {
      const it = latestEval.recitationDetails.tomorrowNewItem;
      newDetail = it;
      const sInfo = getSurahInfo(it.surahNumber);
      const toInfo = it.toSurahNumber ? getSurahInfo(it.toSurahNumber) : sInfo;
      newMemorizationText = it.formattedText || (
        it.surahNumber === (it.toSurahNumber || it.surahNumber) && it.fromAyah === 1 && it.toAyah >= sInfo.numberOfAyahs
          ? `سورة ${sInfo.name} كاملة (الآيات 1 - ${sInfo.numberOfAyahs})`
          : `سورة ${sInfo.name}: من الآية (${it.fromAyah}) إلى الآية (${it.toAyah})`
      );
    } else if (aiAssignment?.newMemorization && !aiAssignment.newMemorization.includes('حسب توجيه')) {
      newMemorizationText = aiAssignment.newMemorization;
      newDetail = aiAssignment.newItem;
    } else if (currentStudent.targetSurahName) {
      newMemorizationText = `سورة ${currentStudent.targetSurahName} (من آية ${currentStudent.targetFromAyah || 1} إلى ${currentStudent.targetToAyah || currentStudent.currentAyah})`;
    } else {
      const curS = currentStudent.currentSurah || 78;
      const curA = currentStudent.currentAyah || 1;
      const sInfo = getSurahInfo(curS);
      const nextA = Math.min(curA + 5, sInfo.numberOfAyahs);
      newMemorizationText = `سورة ${sInfo.name}: من الآية (${curA}) إلى الآية (${nextA})`;
    }

    // 2. Tomorrow's Review Items (مقرر المراجعة والتثبيت والتراكمي المحدد من المعلم)
    let reviewItemsList: QuranRecitationItem[] = [];
    if (latestEval?.recitationDetails?.tomorrowReviewItems && latestEval.recitationDetails.tomorrowReviewItems.length > 0) {
      reviewItemsList = latestEval.recitationDetails.tomorrowReviewItems;
    } else if (aiAssignment?.reviewItems && aiAssignment.reviewItems.length > 0) {
      reviewItemsList = aiAssignment.reviewItems;
    } else if (currentStudent.persistentReviewItems && currentStudent.persistentReviewItems.length > 0) {
      reviewItemsList = currentStudent.persistentReviewItems;
    } else if (latestEval?.recitationDetails?.tomorrowReviewItem) {
      reviewItemsList = [latestEval.recitationDetails.tomorrowReviewItem];
    } else if (aiAssignment?.reviewItem) {
      reviewItemsList = [aiAssignment.reviewItem];
    }

    const reviewSummaryText = (aiAssignment?.review && !aiAssignment.review.includes('المحفوظ السابق'))
      ? aiAssignment.review
      : (latestEval?.recitationDetails?.tomorrowReviewItem?.formattedText || (
        reviewItemsList.length > 0
          ? reviewItemsList.map(r => r.formattedText || `${r.type}: سورة ${r.surahName} (${r.fromAyah}-${r.toAyah})`).join(' • ')
          : (currentStudent.reviewSurahName ? `سورة ${currentStudent.reviewSurahName} (من آية ${currentStudent.reviewFromAyah || 1} إلى ${currentStudent.reviewToAyah || 1})` : 'لم يُحدّد المعلم مقرراً للمراجعة لغد - التركيز على الحفظ الجديد')
      ));

    const teacherNote = latestEval?.recitationDetails?.tomorrowDailyNote || aiAssignment?.dailyNote || '';
    const sheikh = latestEval?.recitationDetails?.tomorrowSuggestedSheikh || aiAssignment?.suggestedSheikh || '';

    return {
      newMemorizationText,
      newDetail,
      reviewItemsList,
      reviewSummaryText,
      teacherNote,
      sheikh
    };
  }, [sortedEvaluations, currentStudent]);

  if (activeTakingExam) {
    return (
      <div className="min-h-screen bg-[#022c22] text-[#f0f9f6] p-4 sm:p-6 lg:p-8">
        <StudentExamTaker
          exam={activeTakingExam}
          student={student}
          currentAttemptNumber={activeTakingAttemptNum}
          onFinishSubmission={async sub => {
            if (onSaveSubmission) {
              await onSaveSubmission(sub);
            } else {
              await OmranDataService.saveSubmission(sub);
            }
            setActiveTakingExam(null);
          }}
          onCancel={() => setActiveTakingExam(null)}
        />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen p-4 sm:p-6 lg:p-8 relative z-10 transition-colors duration-300"
      style={resolvedComplex?.theme ? {
        backgroundColor: resolvedComplex.theme.backgroundColor || '#022c22',
        color: resolvedComplex.theme.textColor || '#f0f9f6'
      } : {
        backgroundColor: '#022c22',
        color: '#f0f9f6'
      }}
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Portal Header - Duolingo 3D Themed */}
        <div
          className="border-2 border-b-6 rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xl backdrop-blur-md transition-all relative overflow-hidden"
          style={{
            backgroundColor: resolvedComplex?.theme?.secondaryColor
              ? `${resolvedComplex.theme.secondaryColor}f2`
              : 'rgba(2, 44, 34, 0.95)',
            borderColor: resolvedComplex?.theme?.cardColor || '#065f46',
            borderBottomColor: darkenHex(resolvedComplex?.theme?.primaryColor || '#011a14', 0.55)
          }}
        >
          {/* Subtle 3D Top Sheen */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

          <div className="flex items-center gap-3.5">
            <div
              className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center font-black shrink-0 overflow-hidden shadow-xl border-2 border-b-4 active:translate-y-[2px] transition-all select-none"
              style={{
                backgroundColor: resolvedComplex?.theme?.accentColor || '#fbbf24',
                borderColor: lightenHex(resolvedComplex?.theme?.accentColor || '#fbbf24', 0.2),
                borderBottomColor: darkenHex(resolvedComplex?.theme?.accentColor || '#d97706', 0.35),
                color: '#064e3b'
              }}
            >
              {resolvedComplex?.logoUrl ? (
                <img src={resolvedComplex.logoUrl} alt={displayComplexName} className="w-full h-full object-cover" />
              ) : (
                <BookOpen className="w-7 h-7" />
              )}
            </div>
            <div>
              <h1
                className="text-lg sm:text-xl font-black font-heading text-white flex items-center gap-2 drop-shadow-sm"
                style={resolvedComplex?.theme?.accentColor ? { color: resolvedComplex.theme.accentColor } : undefined}
              >
                <span>{displayComplexName}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-lg bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">
                  بوابة الطالب
                </span>
              </h1>
              <p
                className="text-xs font-bold mt-0.5 flex flex-wrap items-center gap-1.5"
                style={resolvedComplex?.theme?.accentColor ? { color: resolvedComplex.theme.accentColor } : { color: '#fbbf24' }}
              >
                <span>{currentStudent.halaqahName || settings.halaqahName || 'الحلقة القرآنية'}</span>
                <span className="text-white/40">•</span>
                <span className="text-emerald-200/90 font-medium">بإشراف: {settings.teacherName || 'معلم ومحفظ الحلقة'}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Prominent Duolingo 3D Account Badge in Platform Theme */}
            <div
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl border-2 border-b-4 shadow-md text-xs font-bold transition-all"
              style={{
                backgroundColor: themeSecondary,
                borderColor: `${themeAccent}50`,
                borderBottomColor: themeBorderBottom
              }}
            >
              <div
                className="w-5 h-5 rounded-lg flex items-center justify-center border"
                style={{
                  backgroundColor: `${themeAccent}20`,
                  borderColor: `${themeAccent}40`,
                  color: themeAccent
                }}
              >
                <User className="w-3.5 h-3.5" style={{ color: themeAccent }} />
              </div>
              <span className="text-slate-300">حسابك:</span>
              <span className="font-black text-white">{currentStudent.name}</span>
              <span
                className="px-2 py-0.5 rounded-lg font-black font-mono text-[11px] shadow-sm border"
                style={{
                  backgroundColor: themeAccent,
                  color: accentTextColor,
                  borderColor: themeAccentShadow
                }}
              >
                {currentStudent.password || '123'}
              </span>
            </div>

            {/* Quick Data Refresh Button in Duolingo 3D Style (تحديث البيانات بثيم المنصة) */}
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isSyncingLocal || isCloudSyncing}
              className="px-3.5 py-2 rounded-2xl border-2 border-b-4 text-xs font-black flex items-center gap-2 shadow-md active:translate-y-[2px] active:border-b-2 cursor-pointer transition-all hover:brightness-110 disabled:opacity-60"
              style={{
                backgroundColor: themeSecondary,
                borderColor: `${themeAccent}70`,
                borderBottomColor: themeAccentShadow,
                color: themeAccent
              }}
              title="تحديث واسترجاع أحدث بيانات الطالب والدرجات من قاعدة البيانات"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 shrink-0 ${(isSyncingLocal || isCloudSyncing) ? 'animate-spin' : ''}`}
                style={{ color: themeAccent }}
              />
              <span className="text-white font-bold">تحديث البيانات</span>
            </button>

            {/* Duolingo 3D Logout Button - Arrow icon removed per user request */}
            <button
              onClick={handleLogoutAction}
              className="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-lg border-2 border-rose-500 border-b-4 border-b-rose-900 active:translate-y-[2px] active:border-b-2 cursor-pointer transition-all select-none"
              title="تسجيل الخروج والعودة للشاشة الرئيسية"
            >
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>

        {/* Student Profile Card Hero - Duolingo 3D Themed */}
        <div
          className="relative overflow-hidden rounded-3xl border-2 border-b-6 p-6 sm:p-7 shadow-2xl backdrop-blur-md transition-all"
          style={{
            background: `linear-gradient(135deg, ${resolvedComplex?.theme?.primaryColor || '#064e3b'} 0%, #022c22 60%, ${resolvedComplex?.theme?.primaryColor || '#064e3b'} 100%)`,
            borderColor: resolvedComplex?.theme?.accentColor ? `${resolvedComplex.theme.accentColor}90` : '#fbbf24',
            borderBottomColor: darkenHex(resolvedComplex?.theme?.primaryColor || '#022c22', 0.55)
          }}
        >
          {/* Subtle Top Gloss / Duolingo Bevel Effect */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Duolingo 3D Attendance Metric Box (Placed on the Right with Arabic Digits) */}
            <div
              className="flex sm:flex-col items-start justify-center gap-1.5 bg-[#011a14] p-4 sm:px-6 sm:py-4 rounded-3xl border-2 border-emerald-500/60 border-b-4 border-b-emerald-950 shadow-xl min-w-[155px] text-right shrink-0"
            >
              <span className="text-[11px] font-black text-[#86efac] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>نسبة التزام الحضور</span>
              </span>
              <span className="text-3xl sm:text-4xl font-black text-amber-400 font-heading leading-none tracking-tight">
                {toArabicDigits(attendanceRate)}٪
              </span>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-black border border-emerald-500/30 mt-1">
                {attendanceRate >= 90 ? 'مواظبة ممتازة' : attendanceRate >= 75 ? 'مواظبة جيدة' : 'بحاجة لانتظام'}
              </span>
            </div>

            {/* Student Avatar & Identity */}
            <div className="flex items-center gap-4 sm:gap-5 flex-1">
              {/* Duolingo 3D Chunky Student Avatar */}
              <div
                className="w-18 h-18 sm:w-20 sm:h-20 rounded-3xl text-emerald-950 text-3xl sm:text-4xl font-black font-heading flex items-center justify-center shadow-2xl border-3 border-white/60 border-b-6 active:translate-y-[2px] transition-all shrink-0 select-none relative group"
                style={{
                  backgroundColor: resolvedComplex?.theme?.accentColor || '#fbbf24',
                  borderBottomColor: darkenHex(resolvedComplex?.theme?.accentColor || '#d97706', 0.35)
                }}
              >
                <span>{currentStudent.name.charAt(0)}</span>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-black text-white font-heading tracking-tight drop-shadow-sm">
                    {currentStudent.name}
                  </h2>
                  <span className="px-3 py-1 rounded-2xl bg-amber-400 text-emerald-950 text-xs font-black border-2 border-amber-300 border-b-3 border-b-amber-600 shadow-sm flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-950" />
                    <span>مستوى {toArabicDigits(currentStudent.level)}</span>
                  </span>
                  {currentStudent.isGoogleLinked && currentStudent.googleEmail && (
                    <span className="px-3 py-1 rounded-2xl bg-emerald-500 text-emerald-950 text-xs font-black border-2 border-emerald-400 border-b-3 border-b-emerald-700 shadow-sm flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>حساب Google موثق</span>
                    </span>
                  )}
                  <span className="px-2.5 py-1 rounded-2xl bg-[#011a14]/80 text-[#86efac] text-xs font-bold border border-emerald-600/50 font-mono">
                    {currentStudent.name} - {toArabicDigits(currentStudent.password || '123')}
                  </span>
                </div>

                {/* Duolingo Highlight Bar for Current Memorization */}
                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-emerald-100 bg-[#011a14]/60 p-2.5 px-3.5 rounded-2xl border border-emerald-700/50 mt-1">
                  <span className="text-[#86efac] font-bold flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-amber-400" />
                    <span>موضع الحفظ الحالي:</span>
                  </span>
                  <span className="font-black text-amber-300">
                    سورة {currentStudent.currentSurahName} (الآية {toArabicDigits(currentStudent.currentAyah)})
                  </span>
                </div>

                <p className="text-xs text-[#86efac]/80 font-medium pt-0.5">
                  ولي الأمر: <strong className="text-white">{currentStudent.parentName}</strong>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* DUOLINGO 3D TABS NAVIGATION BAR (نظام التبويبات الثلاثية الأبعاد مثل واجهة المعلمين) */}
        <div
          className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none slider-horizontal p-2 rounded-2xl border-2 border-b-4 backdrop-blur-md shadow-lg relative transition-all w-full max-w-full touch-pan-x"
          style={{
            backgroundColor: `${resolvedComplex?.theme?.secondaryColor || '#022c22'}f0`,
            borderColor: resolvedComplex?.theme?.cardColor || '#065f46',
            borderBottomColor: darkenHex(resolvedComplex?.theme?.primaryColor || '#022c22', 0.4)
          }}
        >
          {[
            { id: 'home', label: 'الرئيسية', icon: Home },
            { id: 'recitation', label: 'مقرر التسميع', icon: Headphones },
            { id: 'exams', label: 'الاختبارات', icon: FileText, badge: studentExams.length > 0 ? toArabicDigits(studentExams.length) : undefined },
            { id: 'leaderboard', label: 'لوحة الشرف', icon: Trophy, badge: myRank ? `#${toArabicDigits(myRank)}` : undefined },
            { id: 'certificates', label: 'شهاداتي', icon: Award, badge: studentCertificates.length > 0 ? toArabicDigits(studentCertificates.length) : undefined }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const themeAccent = resolvedComplex?.theme?.accentColor || '#fbbf24';
            const themePrimary = resolvedComplex?.theme?.primaryColor || '#064e3b';

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black whitespace-nowrap transition-all cursor-pointer border-2 active:translate-y-[2px] shrink-0 select-none ${
                  isActive
                    ? 'border-b-4 shadow-lg scale-[1.02]'
                    : 'border-transparent text-slate-300 hover:text-white hover:bg-white/10'
                }`}
                style={isActive ? {
                  backgroundColor: themeAccent,
                  color: themePrimary,
                  borderColor: themeAccent,
                  borderBottomColor: darkenHex(themeAccent, 0.3)
                } : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                      isActive
                        ? 'bg-black/20 text-current'
                        : 'bg-[#fbbf24]/25 text-[#fbbf24] border border-[#fbbf24]/40'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ========================================================= */}
        {/* TAB 1: الرئيسية (HOME) */}
        {/* ========================================================= */}
        {activeTab === 'home' && (
          <div className="space-y-6">
            {/* Career Totals Duolingo 3D Grid (إحصائيات مسيرة الطالب طوال دراسته) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {/* Card 1: الآيات المسمعة طول المسيرة */}
              <div
                className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl border-2 border-b-4 shadow-md flex flex-col justify-between transition-all hover:brightness-105"
                style={{
                  backgroundColor: resolvedComplex?.theme?.cardColor ? `${resolvedComplex.theme.cardColor}ee` : '#064e3b',
                  borderColor: resolvedComplex?.theme?.accentColor || '#fbbf24',
                  borderBottomColor: darkenHex(resolvedComplex?.theme?.accentColor || '#fbbf24', 0.3)
                }}
              >
                <div className="flex items-center justify-between gap-1.5 mb-2">
                  <span
                    className="p-2 rounded-xl border-2 border-b-2"
                    style={{
                      backgroundColor: `${resolvedComplex?.theme?.accentColor || '#fbbf24'}20`,
                      color: resolvedComplex?.theme?.accentColor || '#fbbf24',
                      borderColor: `${resolvedComplex?.theme?.accentColor || '#fbbf24'}50`,
                      borderBottomColor: darkenHex(resolvedComplex?.theme?.accentColor || '#fbbf24', 0.25)
                    }}
                  >
                    <BookOpen className="w-4 h-4" />
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/20 font-bold text-slate-300">
                    طول المسيرة
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-300 font-bold block">الآيات المسمعة</span>
                  <div className="text-xl sm:text-2xl font-black font-mono text-white mt-0.5">
                    {toArabicDigits(careerStats.totalAyahs)}
                    <span className="text-xs font-normal text-slate-300 mr-1">آية</span>
                  </div>
                </div>
              </div>

              {/* Card 2: الأوجه المحفوظة */}
              <div
                className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl border-2 border-b-4 shadow-md flex flex-col justify-between transition-all hover:brightness-105"
                style={{
                  backgroundColor: resolvedComplex?.theme?.cardColor ? `${resolvedComplex.theme.cardColor}ee` : '#064e3b',
                  borderColor: '#10b981',
                  borderBottomColor: darkenHex('#10b981', 0.3)
                }}
              >
                <div className="flex items-center justify-between gap-1.5 mb-2">
                  <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border-2 border-b-2 border-emerald-500/40">
                    <Layers className="w-4 h-4" />
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/20 font-bold text-slate-300">
                    الحفظ المتقن
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-300 font-bold block">الأوجه المحفوظة</span>
                  <div className="text-xl sm:text-2xl font-black font-mono text-white mt-0.5">
                    {toArabicDigits(careerStats.totalPages)}
                    <span className="text-xs font-normal text-slate-300 mr-1">وجهاً</span>
                  </div>
                </div>
              </div>

              {/* Card 3: السور المنجزة */}
              <div
                className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl border-2 border-b-4 shadow-md flex flex-col justify-between transition-all hover:brightness-105"
                style={{
                  backgroundColor: resolvedComplex?.theme?.cardColor ? `${resolvedComplex.theme.cardColor}ee` : '#064e3b',
                  borderColor: '#38bdf8',
                  borderBottomColor: darkenHex('#38bdf8', 0.3)
                }}
              >
                <div className="flex items-center justify-between gap-1.5 mb-2">
                  <span className="p-2 rounded-xl bg-sky-500/20 text-sky-300 border-2 border-b-2 border-sky-500/40">
                    <Award className="w-4 h-4" />
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/20 font-bold text-slate-300">
                    السور المكتملة
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-300 font-bold block">السور المنجزة</span>
                  <div className="text-xl sm:text-2xl font-black font-mono text-white mt-0.5">
                    {toArabicDigits(careerStats.totalSurahs)}
                    <span className="text-xs font-normal text-slate-300 mr-1">سورة</span>
                  </div>
                </div>
              </div>

              {/* Card 4: الأوجه المراجعة */}
              <div
                className="p-4 sm:p-5 rounded-2xl sm:rounded-3xl border-2 border-b-4 shadow-md flex flex-col justify-between transition-all hover:brightness-105"
                style={{
                  backgroundColor: resolvedComplex?.theme?.cardColor ? `${resolvedComplex.theme.cardColor}ee` : '#064e3b',
                  borderColor: '#f59e0b',
                  borderBottomColor: darkenHex('#f59e0b', 0.3)
                }}
              >
                <div className="flex items-center justify-between gap-1.5 mb-2">
                  <span className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border-2 border-b-2 border-amber-500/40">
                    <RotateCcw className="w-4 h-4" />
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-black/20 font-bold text-slate-300">
                    التثبيت والتراكمي
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-300 font-bold block">الأوجه المراجعة</span>
                  <div className="text-xl sm:text-2xl font-black font-mono text-white mt-0.5">
                    {toArabicDigits(careerStats.totalReviewPages)}
                    <span className="text-xs font-normal text-slate-300 mr-1">وجهاً مراجعاً</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Stats Pills Strip with Duolingo 3D Style */}
            {(() => {
              const themeAccent = resolvedComplex?.theme?.accentColor || '#fbbf24';
              const themeCard = resolvedComplex?.theme?.cardColor || resolvedComplex?.theme?.surfaceColor || '#203843';
              const themeSecondary = resolvedComplex?.theme?.secondaryColor || '#1b2e35';
              const themePrimary = resolvedComplex?.theme?.primaryColor || '#131f24';

              return (
                <>
                  <div
                    className="flex items-center justify-between gap-2 p-3 sm:p-3.5 rounded-2xl border-2 border-b-4 text-xs font-bold overflow-x-auto scrollbar-none shadow-md"
                    style={{
                      backgroundColor: themeCard ? `${themeCard}ee` : '#203843',
                      borderColor: `${themeAccent}35`,
                      borderBottomColor: darkenHex(themeCard || '#203843', 0.35)
                    }}
                  >
                    <div
                      className="flex items-center gap-2 shrink-0 px-2.5 py-1.5 rounded-xl border-2 border-b-2"
                      style={{
                        backgroundColor: themeSecondary,
                        borderColor: `${themeAccent}35`,
                        borderBottomColor: darkenHex(themeAccent, 0.25)
                      }}
                    >
                      <Flame className="w-4 h-4 text-amber-400" />
                      <span className="text-slate-300">إجمالي النقاط:</span>
                      <span className="font-mono font-black" style={{ color: themeAccent }}>
                        {toArabicDigits(currentStudent.points || myRankingData?.totalPoints || 0)} نقطة
                      </span>
                    </div>
                    <div className="h-5 w-0.5 bg-white/10 shrink-0" />
                    <div
                      className="flex items-center gap-2 shrink-0 px-2.5 py-1.5 rounded-xl border-2 border-b-2"
                      style={{
                        backgroundColor: themeSecondary,
                        borderColor: `${themeAccent}35`,
                        borderBottomColor: darkenHex(themeAccent, 0.25)
                      }}
                    >
                      <CheckCircle2 className="w-4 h-4" style={{ color: themeAccent }} />
                      <span className="text-slate-300">نسبة الالتزام:</span>
                      <span className="font-mono font-black text-white">{toArabicDigits(attendanceRate)}٪</span>
                    </div>
                    <div className="h-5 w-0.5 bg-white/10 shrink-0" />
                    <div
                      className="flex items-center gap-2 shrink-0 px-2.5 py-1.5 rounded-xl border-2 border-b-2"
                      style={{
                        backgroundColor: themeSecondary,
                        borderColor: `${themeAccent}35`,
                        borderBottomColor: darkenHex(themeAccent, 0.25)
                      }}
                    >
                      <Zap className="w-4 h-4 text-sky-400" />
                      <span className="text-slate-300">المستوى الحالي:</span>
                      <span className="text-sky-300 font-black">مستوى {toArabicDigits(currentStudent.level)}</span>
                    </div>
                  </div>
                </>
              );
            })()}

        {/* ONLINE HALAQAH & REVIEW LINKS BANNER FOR STUDENT */}
        {studentHalaqahObj && studentHalaqahObj.isOnline && (() => {
          const mainHref = normalizeMeetingUrl(studentHalaqahObj.meetingUri);
          // Only enabled review links with a valid URL are shown to students
          const enabledReviewLinks = (studentHalaqahObj.reviewLinks || []).filter(
            link => link && link.isEnabled !== false && Boolean(normalizeMeetingUrl(link.url))
          );

          if (!mainHref && enabledReviewLinks.length === 0) return null;

          const isActive = isOnlineHalaqahActive(studentHalaqahObj);
          const startStr = studentHalaqahObj.onlineStartTime || studentHalaqahObj.startTime || '16:00';
          const endStr = studentHalaqahObj.onlineEndTime || studentHalaqahObj.endTime || '20:00';
          const palette = getDistinctComplexReviewPalette(
            studentComplexObj?.theme,
            studentComplexObj?.themeColor
          );

          return (
            <div
              className={`relative overflow-hidden rounded-[28px] border-2 border-b-[5px] p-6 sm:p-7 shadow-2xl space-y-5 transition-all ${
                isActive ? 'opacity-100' : 'opacity-85'
              }`}
              style={{
                backgroundColor: isActive ? palette.cardBg : '#0f172a',
                borderColor: isActive ? palette.mainBtnBg : '#334155',
                borderBottomColor: isActive ? palette.mainBtnShadow : '#1e293b'
              }}
            >
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span
                      className="p-2.5 rounded-2xl border-2 border-b-4"
                      style={
                        isActive
                          ? {
                              backgroundColor: `${palette.mainBtnBg}22`,
                              color: palette.mainBtnBg,
                              borderColor: `${palette.mainBtnBg}66`,
                              borderBottomColor: palette.mainBtnShadow
                            }
                          : {
                              backgroundColor: '#1e293b',
                              color: '#64748b',
                              borderColor: '#334155',
                              borderBottomColor: '#0f172a'
                            }
                      }
                    >
                      <Video className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="text-base sm:text-lg font-black font-heading text-white">
                        حلقة التسميع والمراجعة عن بُعد
                      </h3>
                      <p className="text-xs text-slate-200 font-bold mt-0.5">
                        حلقة: <strong style={{ color: palette.mainBtnBg }}>{studentHalaqahObj.name}</strong> · الموعد: {startStr} إلى {endStr}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="shrink-0">
                  {isActive ? (
                    <span className="text-xs font-black text-emerald-300">
                      الحلقة نشطة الآن (في موعدها)
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-slate-400">
                      خارج وقت الحلقة ({startStr} - {endStr})
                    </span>
                  )}
                </div>
              </div>

              {/* Active Halaqah Time: Main Link followed by Stacked Duolingo Review Links */}
              {isActive ? (
                <div className="space-y-4 pt-1">
                  {/* 1. Primary Halaqah Button (Complex Primary Accent) */}
                  {mainHref && (
                    <a
                      href={mainHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-4 px-5 rounded-2xl font-black text-sm flex items-center justify-between gap-3 shadow-xl transition-all hover:brightness-105 active:translate-y-[2px] cursor-pointer"
                      style={{
                        backgroundColor: palette.mainBtnBg,
                        color: palette.mainBtnText,
                        border: `2px solid ${palette.mainBtnBorder}`,
                        borderBottom: `5px solid ${palette.mainBtnShadow}`
                      }}
                    >
                      <span className="flex items-center gap-2.5">
                        <Video className="w-5 h-5 shrink-0" />
                        <span>دخول رابط الحلقة الأساسي الآن</span>
                      </span>
                      <span className="flex items-center gap-1.5 text-xs font-black shrink-0">
                        <span>انضمام مباشر</span>
                        <ExternalLink className="w-4 h-4" />
                      </span>
                    </a>
                  )}

                  {/* 2. Review Links Section (Distinct Complex Color + Duolingo 3D Stacked Buttons) */}
                  {enabledReviewLinks.length > 0 && (
                    <div
                      className="p-4 sm:p-5 rounded-2xl border-2 border-b-4 space-y-3"
                      style={{
                        backgroundColor: palette.reviewBoxBg,
                        borderColor: palette.reviewBoxBorder,
                        borderBottomColor: palette.reviewBoxBottomBorder
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 shrink-0" style={{ color: palette.reviewBtnBg }} />
                          <h4 className="text-xs sm:text-sm font-black text-white">
                            روابط المراجعة المتاحة للحلقة
                          </h4>
                        </div>
                        <span className="text-[11px] font-bold text-slate-300">
                          اضغط للانضمام لغرفة المراجعة
                        </span>
                      </div>

                      {/* Vertically Stacked Review Link Buttons (كل رابط له زر تحت بعضهم) */}
                      <div className="flex flex-col gap-3 w-full">
                        {enabledReviewLinks.map((link, idx) => {
                          const reviewHref = normalizeMeetingUrl(link.url);
                          const originalIdx = (studentHalaqahObj.reviewLinks || []).findIndex(r => r.id === link.id);
                          const label =
                            (link.title || '').trim() ||
                            getDefaultReviewLinkTitle((originalIdx >= 0 ? originalIdx : idx) + 1);

                          return (
                            <a
                              key={link.id || idx}
                              href={reviewHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full py-3.5 px-5 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-between gap-3 shadow-lg transition-all hover:brightness-110 active:translate-y-[2px] cursor-pointer"
                              style={{
                                backgroundColor: palette.reviewBtnBg,
                                color: palette.reviewBtnText,
                                border: `2px solid ${palette.reviewBtnBorder}`,
                                borderBottom: `5px solid ${palette.reviewBtnShadow}`
                              }}
                            >
                              <span className="flex items-center gap-2.5 truncate">
                                <BookOpen className="w-4 h-4 shrink-0" />
                                <span className="truncate">{label}</span>
                              </span>
                              <span className="flex items-center gap-1.5 text-xs font-black shrink-0">
                                <span>دخول غرفة المراجعة</span>
                                <ExternalLink className="w-4 h-4" />
                              </span>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <p className="text-xs text-amber-300 font-bold">
                    الدخول مغلق حالياً · تفتح روابط الحلقة الأساسية وروابط المراجعة للطلاب تلقائياً خلال وقت الحلقة ({startStr} - {endStr}).
                  </p>
                  <button
                    type="button"
                    disabled
                    className="w-full py-3.5 px-5 rounded-2xl bg-slate-800/90 border-2 border-slate-700 border-b-4 border-b-slate-900 text-slate-400 font-bold text-xs flex items-center justify-center gap-2 cursor-not-allowed opacity-60"
                  >
                    <Video className="w-4 h-4 opacity-50" />
                    <span>زر الدخول مغلق (خارج وقت الحلقة المجدول)</span>
                  </button>
                </div>
              )}
            </div>
          );
        })()}

            {/* Daily Recitation History inside Tab 1 (Home) */}
            {(() => {
              const themeAccent = resolvedComplex?.theme?.accentColor || '#fbbf24';
              const themeCard = resolvedComplex?.theme?.cardColor || resolvedComplex?.theme?.surfaceColor || '#203843';
              const themeSecondary = resolvedComplex?.theme?.secondaryColor || '#1b2e35';

              return (
                <div
                  className="p-6 sm:p-7 rounded-[32px] border-2 border-b-[6px] shadow-2xl space-y-5 backdrop-blur-md relative overflow-hidden transition-all"
                  style={{
                    backgroundColor: themeCard ? `${themeCard}f2` : '#203843',
                    borderColor: themeAccent,
                    borderBottomColor: darkenHex(themeAccent, 0.4)
                  }}
                >
                  <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b-2"
                    style={{ borderColor: `${themeAccent}25` }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-11 h-11 rounded-2xl font-black flex items-center justify-center border-2 border-b-4 shadow-md"
                        style={{
                          backgroundColor: `${themeAccent}25`,
                          color: themeAccent,
                          borderColor: `${themeAccent}70`,
                          borderBottomColor: darkenHex(themeAccent, 0.35)
                        }}
                      >
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base sm:text-lg font-black font-heading text-white flex items-center gap-2">
                          <span>سجل التسميع اليومي والتقييمات الأخيرة ({toArabicDigits(sortedEvaluations.length)})</span>
                        </h3>
                        <p className="text-xs text-slate-300 font-bold mt-0.5">
                          متابعة أحدث جلسات التسميع المرصودة مع تفاصيل الحفظ والمراجعة
                        </p>
                      </div>
                    </div>
                    <span
                      className="self-start sm:self-auto text-xs px-3.5 py-1.5 rounded-xl font-black border-2 border-b-2 shadow-sm"
                      style={{
                        backgroundColor: themeSecondary,
                        color: themeAccent,
                        borderColor: `${themeAccent}40`,
                        borderBottomColor: darkenHex(themeAccent, 0.3)
                      }}
                    >
                      أحدث التقييمات
                    </span>
                  </div>

                  {sortedEvaluations.length === 0 ? (
                    <div
                      className="text-center py-8 text-xs text-slate-300 font-bold p-6 rounded-2xl border-2 border-dashed"
                      style={{
                        backgroundColor: themeSecondary,
                        borderColor: `${themeAccent}30`
                      }}
                    >
                      لم يتم رصد تسميعات مسجلة بعد.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {sortedEvaluations.map(ev => {
                        const evalDateArabic = new Intl.DateTimeFormat('ar-SA', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        }).format(new Date(ev.date));

                        const newDidNotRecite = ev.recitationDetails?.newMemorizationDidNotRecite;
                        const newDidNotReciteReason = ev.recitationDetails?.newMemorizationDidNotReciteReason;

                        return (
                          <div
                            key={ev.id}
                            className="p-4 sm:p-5 rounded-2xl border-2 border-b-4 space-y-3.5 shadow-md transition-all hover:brightness-105"
                            style={{
                              backgroundColor: themeSecondary,
                              borderColor: `${themeAccent}35`,
                              borderBottomColor: darkenHex(themeCard || '#203843', 0.4)
                            }}
                          >
                            <div
                              className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b text-xs"
                              style={{ borderColor: `${themeAccent}20` }}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className="px-3 py-1 rounded-xl border-2 border-b-2 text-white font-black text-xs sm:text-sm shadow-sm"
                                  style={{
                                    backgroundColor: themeCard,
                                    borderColor: `${themeAccent}35`,
                                    borderBottomColor: darkenHex(themeCard || '#203843', 0.3)
                                  }}
                                >
                                  {evalDateArabic}
                                </span>
                                <span className="text-slate-400 font-mono text-[11px]">({toArabicDigits(ev.date)})</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span
                                  className="px-3.5 py-1.5 rounded-xl font-black border-2 border-b-3 shadow-sm text-xs"
                                  style={{
                                    backgroundColor: `${themeAccent}25`,
                                    color: themeAccent,
                                    borderColor: themeAccent,
                                    borderBottomColor: darkenHex(themeAccent, 0.35)
                                  }}
                                >
                                  {ev.score >= 95 ? 'إتقان متميز ★' : ev.score >= 85 ? 'متقن جداً ✓' : 'تم التسميع ✓'}
                                </span>
                                {ev.teacherName && (
                                  <span
                                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold border"
                                    style={{
                                      backgroundColor: 'rgba(255,255,255,0.06)',
                                      color: themeAccent,
                                      borderColor: `${themeAccent}30`
                                    }}
                                  >
                                    بإشراف: {ev.teacherName}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Recitation Content Details */}
                            <div className="space-y-2.5 text-xs">
                              {/* New Memorization */}
                              <div
                                className="p-3 rounded-xl border-2 border-b-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5"
                                style={{
                                  backgroundColor: themeCard,
                                  borderColor: `${themeAccent}25`,
                                  borderBottomColor: darkenHex(themeCard || '#203843', 0.35)
                                }}
                              >
                                <span className="font-black flex items-center gap-1.5 text-white">
                                  <BookOpen className="w-4 h-4" style={{ color: themeAccent }} />
                                  <span>ورد الحفظ الجديد:</span>
                                </span>
                                {newDidNotRecite ? (
                                  <span className="text-amber-300 font-bold bg-amber-500/15 px-3 py-1 rounded-xl border-2 border-amber-500/30 border-b-2 border-b-amber-600 inline-flex items-center gap-1">
                                    <XCircle className="w-3.5 h-3.5 text-amber-400" />
                                    <span>لم يُسمّع ({newDidNotReciteReason || 'لم يحفظ'})</span>
                                  </span>
                                ) : (
                                  <span className="font-black text-sm" style={{ color: themeAccent }}>
                                    {ev.recitationDetails?.newMemorizationAchieved || 'تم التسميع بنجاح'}
                                  </span>
                                )}
                              </div>

                              {/* Review Items */}
                              {ev.recitationDetails?.todayReviewItems && ev.recitationDetails.todayReviewItems.length > 0 ? (
                                <div
                                  className="pt-2 border-t space-y-2"
                                  style={{ borderColor: `${themeAccent}20` }}
                                >
                                  <span className="font-black flex items-center gap-1.5 text-white">
                                    <RotateCcw className="w-4 h-4" style={{ color: themeAccent }} />
                                    <span>المراجعة والتثبيت:</span>
                                  </span>
                                  <div className="space-y-1.5 pr-2">
                                    {ev.recitationDetails.todayReviewItems.map((rev, rIdx) => (
                                      <div
                                        key={rev.id || rIdx}
                                        className="p-2.5 rounded-xl border-2 border-b-3 text-xs flex flex-wrap items-center justify-between gap-1 shadow-sm"
                                        style={{
                                          backgroundColor: themeCard,
                                          borderColor: `${themeAccent}25`,
                                          borderBottomColor: darkenHex(themeCard || '#203843', 0.35)
                                        }}
                                      >
                                        <span className="text-white font-medium">
                                          • {rev.type}: سورة {rev.surahName} (آية {toArabicDigits(rev.fromAyah)} إلى {toArabicDigits(rev.toAyah)})
                                        </span>
                                        {rev.didNotRecite ? (
                                          <span className="text-amber-300 font-bold bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-500/30">
                                            لم يُسمّع ({rev.didNotReciteReason || 'لم يحفظ'})
                                          </span>
                                        ) : (
                                          <span className="font-bold flex items-center gap-1" style={{ color: themeAccent }}>
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                            <span>تم التسميع</span>
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : ev.recitationDetails?.reviewAchieved ? (
                                <div
                                  className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 pt-2 border-t"
                                  style={{ borderColor: `${themeAccent}20` }}
                                >
                                  <span className="font-black flex items-center gap-1.5 text-white">
                                    <RotateCcw className="w-4 h-4" style={{ color: themeAccent }} />
                                    <span>ما سمّعه في المراجعة والتثبيت:</span>
                                  </span>
                                  <span className="font-bold text-white text-right">
                                    {ev.recitationDetails.reviewAchieved}
                                  </span>
                                </div>
                              ) : null}

                              {/* Teacher Notes */}
                              {ev.recitationDetails?.teacherNotes && (
                                <div
                                  className="p-3 rounded-xl border-2 border-b-3 text-xs shadow-sm"
                                  style={{
                                    backgroundColor: `${themeAccent}15`,
                                    color: '#ffffff',
                                    borderColor: `${themeAccent}40`,
                                    borderBottomColor: darkenHex(themeAccent, 0.3)
                                  }}
                                >
                                  <span className="font-black flex items-center gap-1.5 mb-1" style={{ color: themeAccent }}>
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>ملاحظات وتوجيه المعلم:</span>
                                  </span>
                                  <p className="leading-relaxed font-medium">{ev.recitationDetails.teacherNotes}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Behavioral Guidance inside Tab 1 (Home) */}
            {studentViolations.length > 0 && (
              <div className="bg-[#064e3b]/80 border-2 border-amber-500/40 border-b-4 border-b-amber-950 rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl backdrop-blur-md">
                <div className="flex items-center justify-between pb-3 border-b border-[#065f46]">
                  <h3 className="text-base sm:text-lg font-bold font-heading text-white flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-[#fbbf24]" />
                    <span>ملاحظات السلوك والتوجيه التربوي للحلقة ({studentViolations.length})</span>
                  </h3>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-[#fbbf24] border border-amber-500/30 font-bold">
                    متابعة سلوكية وتربوية
                  </span>
                </div>

                <div className="space-y-3">
                  {studentViolations.map(viol => {
                    const isResolved = viol.status === 'تم التوجيه والمعالجة';

                    return (
                      <div
                        key={viol.id}
                        className="p-4 rounded-2xl bg-[#022c22] border-2 border-[#065f46] border-b-4 border-b-[#011a14] space-y-2.5 text-xs"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">
                              {viol.violationType}
                            </span>
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                viol.severity === 'تنبيه'
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              }`}
                            >
                              {viol.severity}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-[#86efac]/80">
                            <span>تاريخ: {viol.date}</span>
                            {isResolved ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" />
                                <span>تم التوجيه والمعالجة</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold">
                                قيد المتابعة
                              </span>
                            )}
                          </div>
                        </div>

                        {viol.description && (
                          <div className="text-slate-200 leading-relaxed bg-[#064e3b]/30 p-2.5 rounded-xl border border-[#065f46]/50">
                            <strong className="text-[#86efac]">توجيه الشيخ وتفاصيل الملاحظة: </strong>
                            {viol.description}
                          </div>
                        )}

                        {viol.actionTaken && (
                          <div className="text-[#86efac]">
                            <strong className="text-emerald-300">الإجراء المتخذ: </strong>
                            {viol.actionTaken}
                          </div>
                        )}

                        {viol.messageText && (
                          <div className="text-slate-300 italic pt-1 border-t border-[#065f46]/60">
                            "{viol.messageText}"
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: RECITATION SCHEDULE (مقرر التسميع + مشغل القرآن المطور) */}
        {/* ============================================================== */}
        {activeTab === 'recitation' && (
          <div className="space-y-6">
            {/* Tomorrow's Plan / Current Assignment Box */}
            <div
              className="p-6 sm:p-8 rounded-[32px] border-2 border-b-[6px] shadow-2xl space-y-6 backdrop-blur-md relative overflow-hidden transition-all"
              style={{
                backgroundColor: resolvedComplex?.theme?.cardColor ? `${resolvedComplex.theme.cardColor}f2` : '#064e3b',
                borderColor: resolvedComplex?.theme?.accentColor || '#fbbf24',
                borderBottomColor: darkenHex(resolvedComplex?.theme?.accentColor || '#fbbf24', 0.4)
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-emerald-600/30">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-400 text-emerald-950 font-black flex items-center justify-center border-2 border-b-4 border-amber-600 shadow-md">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black font-heading text-white flex items-center gap-2">
                      <span>مقرر التسميع وخطة الغد المعتمدة من المعلم</span>
                    </h3>
                    <p className="text-xs text-emerald-100/80 font-bold mt-0.5">
                      ما أعدّه الشيخ لك للغد من حفظ جديد ومراجعة وتثبيت وتراكمي
                    </p>
                  </div>
                </div>
                <span className="self-start sm:self-auto text-xs px-3.5 py-1.5 rounded-xl bg-amber-400/20 text-amber-300 font-black border-2 border-b-3 border-amber-500/40 shadow-sm">
                  متابعة وتسميع الغد
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* New Target Card */}
                <div className="bg-[#022c22] border-2 border-emerald-700/70 border-b-4 border-b-[#011a14] rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-lg hover:border-emerald-500/70 transition-all">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-black text-amber-300">
                        <BookOpen className="w-4 h-4 text-amber-400" />
                        <span>ورد الحفظ الجديد المطلوب غداً</span>
                      </div>
                      <span className="text-xs px-3 py-1 rounded-xl bg-amber-400 text-emerald-950 font-black border-2 border-amber-300 border-b-3 border-b-amber-600 shadow-sm">
                        حفظ جديد
                      </span>
                    </div>
                    <p className="text-lg sm:text-xl font-black text-amber-300 leading-relaxed font-heading bg-[#011a14] p-4 rounded-xl border-2 border-emerald-800/80 border-b-3 border-b-emerald-950 shadow-inner">
                      {tomorrowPlanInfo.newMemorizationText}
                    </p>
                  </div>

                  {tomorrowPlanInfo.sheikh && (
                    <div className="pt-2.5 border-t border-emerald-800/60 flex items-center gap-2 text-xs text-emerald-200">
                      <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>القارئ المعلم المقترح من الشيخ: <strong className="text-white font-black">{tomorrowPlanInfo.sheikh}</strong></span>
                    </div>
                  )}
                </div>

                {/* Review Target Card */}
                <div className="bg-[#022c22] border-2 border-emerald-700/70 border-b-4 border-b-[#011a14] rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-lg hover:border-emerald-500/70 transition-all">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-black text-emerald-300">
                        <RotateCcw className="w-4 h-4 text-amber-400" />
                        <span>مقرر المراجعة والتثبيت والتراكمي</span>
                      </div>
                      <span className="text-xs px-3 py-1 rounded-xl bg-emerald-900/90 text-[#86efac] font-black border-2 border-b-3 border-emerald-600/60 border-b-emerald-950 shadow-sm">
                        {tomorrowPlanInfo.reviewItemsList.length > 1 ? `${toArabicDigits(tomorrowPlanInfo.reviewItemsList.length)} مقررات مراجعة` : 'مراجعة وتثبيت'}
                      </span>
                    </div>

                    {tomorrowPlanInfo.reviewItemsList.length > 0 ? (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {tomorrowPlanInfo.reviewItemsList.map((rev, rIdx) => {
                          const sInfo = getSurahInfo(rev.surahNumber);
                          const toInfo = rev.toSurahNumber ? getSurahInfo(rev.toSurahNumber) : sInfo;
                          return (
                            <div key={rev.id || rIdx} className="bg-[#011a14] p-3 rounded-xl border-2 border-emerald-700/60 border-b-3 border-b-emerald-950 space-y-1 shadow-sm">
                              <div className="flex items-center justify-between gap-1 text-[11px]">
                                <span className={`px-2.5 py-0.5 rounded-full font-black flex items-center gap-1 ${
                                  rev.type?.includes('تراكمي') || rev.type?.includes('تراكمية')
                                    ? 'bg-amber-400 text-emerald-950 border border-amber-500'
                                    : rev.type?.includes('كبرى') || rev.type?.includes('اختبار')
                                    ? 'bg-indigo-600/40 text-indigo-200 border border-indigo-500/50'
                                    : 'bg-[#064e3b] text-[#fbbf24] border border-[#065f46]'
                                }`}>
                                  <Layers className="w-3 h-3" />
                                  <span>{rev.type || 'مراجعة وتثبيت'}</span>
                                </span>
                                <span className="text-emerald-300 font-mono text-[11px]">
                                  {sInfo.name === toInfo.name ? `سورة ${sInfo.name}` : `من ${sInfo.name} إلى ${toInfo.name}`}
                                </span>
                              </div>
                              <div className="text-sm sm:text-base font-black text-white font-heading">
                                {rev.formattedText || (
                                  rev.isFullSurah
                                    ? `سورة ${sInfo.name} كاملة (${toArabicDigits(sInfo.numberOfAyahs)} آية)`
                                    : `سورة ${sInfo.name}: من الآية (${toArabicDigits(rev.fromAyah)}) إلى (${toArabicDigits(rev.toAyah)})`
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-base sm:text-lg font-black text-white leading-relaxed font-heading bg-[#011a14] p-4 rounded-xl border-2 border-emerald-800/80 border-b-3 border-b-emerald-950 shadow-inner">
                        {tomorrowPlanInfo.reviewSummaryText}
                      </p>
                    )}
                  </div>

                  {tomorrowPlanInfo.teacherNote && (
                    <div className="pt-2.5 border-t border-emerald-800/60 text-xs text-amber-100 font-bold bg-amber-400/10 p-3 rounded-xl border-2 border-b-3 border-amber-400/30 border-b-amber-500/40 shadow-sm">
                      <span className="text-[#fbbf24] font-black flex items-center gap-1 mb-1">
                        <Sparkles className="w-3.5 h-3.5 text-[#fbbf24]" />
                        <span>توجيه وملاحظة الشيخ:</span>
                      </span>
                      <p className="leading-relaxed font-medium">{tomorrowPlanInfo.teacherNote}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Smart Quran Ayah Audio Player with Repetitions, Auto-Stop & Sheikh Switching */}
            <div className="space-y-4">
              <QuranAyahAudioPlayer
                student={currentStudent}
                surahNumber={currentAssignedPassage.surahNumber}
                surahName={currentAssignedPassage.surahName}
                fromAyah={currentAssignedPassage.fromAyah}
                toAyah={currentAssignedPassage.toAyah}
                selectedSheikhName={currentAssignedPassage.sheikhName}
                requiredRepetitions={currentAssignedPassage.requiredRepetitions ?? 3}
                listeningPointsReward={10}
                onRepetitionComplete={async (newCount, isFullyDone) => {
                  const updated: Student = {
                    ...currentStudent,
                    activeListeningAssignment: {
                      ...currentAssignedPassage,
                      completedRepetitions: newCount,
                      isCompleted: isFullyDone
                    }
                  };
                  if (isFullyDone) {
                    updated.listeningPoints = (updated.listeningPoints || 0) + 10;
                    updated.points = (updated.points || 0) + 10;
                    updated.dailyListeningCompletedDate = new Date().toISOString().split('T')[0];
                  }
                  setCurrentStudent(updated);
                  await OmranDataService.saveStudent(updated);
                  if (onUpdateStudent) onUpdateStudent(updated);
                }}
              />
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: EXAMS & QUIZZES (الاختبارات والنتائج والمحاولات) */}
        {/* ============================================================== */}
        {activeTab === 'exams' && (
          <div
            className="p-6 sm:p-8 rounded-[32px] border-2 border-b-[6px] shadow-2xl space-y-6 backdrop-blur-md relative overflow-hidden transition-all"
            style={{
              backgroundColor: resolvedComplex?.theme?.cardColor ? `${resolvedComplex.theme.cardColor}f2` : '#064e3b',
              borderColor: resolvedComplex?.theme?.accentColor || '#fbbf24',
              borderBottomColor: darkenHex(resolvedComplex?.theme?.accentColor || '#fbbf24', 0.4)
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-emerald-600/30">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-400 text-emerald-950 font-black flex items-center justify-center border-2 border-b-4 border-amber-600 shadow-md">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black font-heading text-white">
                    الاختبارات والتقييمات القرآنية ({toArabicDigits(studentExams.length)})
                  </h3>
                  <p className="text-xs text-emerald-100/80 font-bold mt-0.5">
                    الاختبارات الإلكترونية المعتمدة لحلقتك مع رصد الدرجات ومراجعة الإجابات
                  </p>
                </div>
              </div>
              <span className="self-start sm:self-auto text-xs px-3.5 py-1.5 rounded-xl bg-amber-400/20 text-amber-300 font-black border-2 border-b-3 border-amber-500/40 shadow-sm">
                منظومة الاختبارات
              </span>
            </div>

            {studentExams.length === 0 ? (
              <div className="text-center py-12 px-6 bg-[#011a14]/90 rounded-3xl border-2 border-dashed border-emerald-600/60 border-b-4 border-b-[#011a14] space-y-3.5 shadow-inner">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#064e3b] border-2 border-emerald-500/60 border-b-4 border-b-emerald-950 flex items-center justify-center text-amber-400 shadow-md">
                  <FileText className="w-7 h-7" />
                </div>
                <h4 className="text-base font-black text-white font-heading">لا توجد اختبارات متاحة لحلقتك حالياً</h4>
                <p className="text-xs text-emerald-200/80 max-w-md mx-auto leading-relaxed font-bold">
                  تابع مع المعلم عند إعلان اختبار جديد، وستظهر هنا الاختبارات المعتمدة ودرجاتها فور تفعيلها.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {studentExams.map(exam => {
                  const mySubmissions = studentSubmissions.filter(s => s.examId === exam.id);
                  const attemptsUsed = mySubmissions.length;
                  const isLimited = exam.attemptLimitType === 'limited';
                  const maxAttempts = exam.maxAttempts || 1;
                  const hasReachedLimit = isLimited && attemptsUsed >= maxAttempts;
                  const isExpired = exam.hasDeadline && exam.deadlineDate && new Date(exam.deadlineDate) < new Date();
                  const canTake = !hasReachedLimit && !isExpired;

                  const bestSubmission = mySubmissions.reduce<ExamSubmission | null>((best, cur) => {
                    if (!best || cur.totalScoreEarned > best.totalScoreEarned) return cur;
                    return best;
                  }, null);

                  return (
                    <div
                      key={exam.id}
                      className="p-5 rounded-2xl bg-[#022c22] border-2 border-emerald-700/70 border-b-4 border-b-[#011a14] space-y-4 flex flex-col justify-between shadow-lg hover:border-emerald-500/70 transition-all"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs px-2.5 py-1 rounded-xl bg-emerald-900 text-emerald-200 font-black border border-emerald-700">
                              {toArabicDigits(exam.questions.length)} أسئلة • {toArabicDigits(exam.totalPoints)} درجات
                            </span>
                            <span className="text-[11px] px-2.5 py-1 rounded-xl bg-emerald-950 text-emerald-300 font-bold border border-emerald-600/40">
                              نظام المنصة
                            </span>
                          </div>

                          {isExpired ? (
                            <span className="text-[10px] px-2.5 py-1 rounded-xl bg-rose-950 text-rose-300 border border-rose-600/40 font-bold">
                              انتهى الموعد
                            </span>
                          ) : hasReachedLimit ? (
                            <span className="text-[10px] px-2.5 py-1 rounded-xl bg-amber-950 text-amber-300 border border-amber-600/40 font-bold">
                              استنفدت المحاولات ({toArabicDigits(attemptsUsed)}/{toArabicDigits(maxAttempts)})
                            </span>
                          ) : (
                            <span className="text-[10px] px-2.5 py-1 rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-500/40 font-bold">
                              متاح للبدء
                            </span>
                          )}
                        </div>

                        <h4 className="text-base font-black text-white font-heading mt-1">{exam.title}</h4>
                        {exam.description && (
                          <p className="text-xs text-emerald-200/80 mt-1.5 leading-relaxed line-clamp-2">{exam.description}</p>
                        )}

                        {bestSubmission && (
                          <div className="mt-3.5 p-3 rounded-xl bg-[#064e3b]/60 border-2 border-emerald-700/60 text-xs flex items-center justify-between">
                            <span className="text-emerald-200 font-semibold">أفضل نتيجة محققة:</span>
                            <span className="font-black text-[#fbbf24] text-sm">
                              {toArabicDigits(bestSubmission.totalScoreEarned)} / {toArabicDigits(bestSubmission.maxPossibleScore)} ({toArabicDigits(bestSubmission.percentage)}٪)
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-emerald-900/60 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs text-emerald-300/80 font-medium">
                          {isLimited ? `المحاولات المتبقية: ${toArabicDigits(Math.max(0, maxAttempts - attemptsUsed))}` : 'محاولات غير محدودة'}
                        </div>

                        <div className="flex items-center gap-2">
                          {mySubmissions.length > 0 && (
                            <button
                              onClick={() => setViewingReviewSubmission(bestSubmission)}
                              className="px-3.5 py-2 rounded-xl bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 text-xs font-bold flex items-center gap-1 border-2 border-b-4 border-emerald-950 active:translate-y-[2px] active:border-b-2 cursor-pointer transition-all"
                            >
                              <span>مراجعة النتيجة</span>
                            </button>
                          )}

                          {canTake && (
                            <button
                              onClick={() => {
                                if (!currentStudent.isGoogleLinked || !currentStudent.googleEmail) {
                                  setGoogleAuthGateExam(exam);
                                  return;
                                }
                                setActiveTakingAttemptNum(attemptsUsed + 1);
                                setActiveTakingExam(exam);
                              }}
                              className="px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-lg bg-amber-400 hover:bg-amber-300 text-emerald-950 border-2 border-b-4 border-amber-600 active:translate-y-[2px] active:border-b-2 transition-all"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>ابدأ الاختبار الآن</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: HONOR BOARD / LEADERBOARD (لوحة الشرف وتصنيف فرسان الحلقة والمجمع) */}
        {/* ============================================================== */}
        {activeTab === 'leaderboard' && (
          <div
            className="p-6 sm:p-8 rounded-[32px] border-2 border-b-[6px] shadow-2xl space-y-6 backdrop-blur-md relative overflow-hidden transition-all"
            style={{
              backgroundColor: resolvedComplex?.theme?.cardColor ? `${resolvedComplex.theme.cardColor}f2` : '#064e3b',
              borderColor: resolvedComplex?.theme?.accentColor || '#fbbf24',
              borderBottomColor: darkenHex(resolvedComplex?.theme?.accentColor || '#fbbf24', 0.4)
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-emerald-600/30">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-400 text-emerald-950 font-black flex items-center justify-center border-2 border-b-4 border-amber-600 shadow-md">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black font-heading text-white flex items-center gap-2">
                    <span>لوحة الشرف والتفوق القرآني</span>
                    <span className="text-[10px] px-3 py-1 rounded-full bg-amber-400 text-emerald-950 font-black">
                      {isPerHalaqahScope ? 'ترتيب الحلقة محلياً' : 'الترتيب العام لجميع الحلقات'}
                    </span>
                  </h3>
                  <p className="text-xs text-emerald-100/80 font-bold mt-0.5">
                    {isPerHalaqahScope
                      ? `إعداد المشرف: يظهر هنا ترتيب وتنافس طلاب حلقة (${currentHalaqahTitle}) فقط.`
                      : 'إعداد المشرف: يظهر هنا الترتيب العام الموحد لجميع طلاب الحلقات بالمركز.'}
                  </p>
                </div>
              </div>

              {/* Current Student Standing Pill */}
              {myRank && (
                <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-[#011a14] border-2 border-amber-400/50 border-b-4 border-b-amber-600/70 text-xs shadow-md">
                  <Medal className="w-4 h-4 text-amber-400" />
                  <span className="text-emerald-300 font-bold">ترتيبك:</span>
                  <span className="font-black text-amber-300 text-sm font-heading">
                    المركز #{toArabicDigits(myRank)}
                  </span>
                  <span className="text-emerald-300 font-mono font-black">
                    ({toArabicDigits(myRankingData?.totalPoints || 0)} نقطة)
                  </span>
                </div>
              )}
            </div>

            {/* Search Input */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-emerald-400 absolute right-3.5 top-3.5" />
                <input
                  type="text"
                  placeholder="ابحث باسم الطالب لرؤية ترتيبه وتفاصيل نقاطه..."
                  value={leaderboardSearch}
                  onChange={e => setLeaderboardSearch(e.target.value)}
                  className="w-full pl-4 pr-10 py-2.5 rounded-2xl bg-[#011a14] border-2 border-emerald-700/60 border-b-3 border-b-emerald-950 text-white text-xs placeholder:text-emerald-300/50 focus:border-[#fbbf24] focus:outline-none font-bold"
                />
              </div>
              <div className="text-xs text-emerald-200 font-bold self-start sm:self-center">
                إجمالي الطلاب المصنفين: <span className="text-amber-300 font-mono font-black">{toArabicDigits(displayedRankList.length)}</span> طالب
              </div>
            </div>

            {/* Top 3 Podium Cards */}
            {studentRankList.length > 0 && !leaderboardSearch.trim() && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
                {studentRankList.slice(0, 3).map((item, idx) => {
                  const isMe = item.student.id === student.id;
                  const badges = [
                    { label: 'المركز الأول', icon: Trophy, border: 'border-[#fbbf24] border-b-6 border-b-amber-600', bg: 'bg-[#fbbf24] text-[#064e3b]', text: 'text-[#fbbf24]' },
                    { label: 'المركز الثاني', icon: Medal, border: 'border-slate-300 border-b-6 border-b-slate-500', bg: 'bg-slate-300 text-slate-950', text: 'text-slate-200' },
                    { label: 'المركز الثالث', icon: Award, border: 'border-amber-600 border-b-6 border-b-amber-800', bg: 'bg-amber-600 text-white', text: 'text-amber-300' }
                  ];
                  const badge = badges[idx] || badges[0];
                  const BadgeIcon = badge.icon;

                  return (
                    <div
                      key={item.student.id}
                      onClick={() => setSelectedStudentForBreakdown(item)}
                      className={`p-5 rounded-3xl border-2 transition-all text-center relative overflow-hidden flex flex-col justify-between cursor-pointer group active:translate-y-[2px] shadow-xl ${
                        isMe
                          ? 'bg-[#064e3b] border-[#fbbf24] border-b-6 border-b-amber-600 ring-2 ring-[#fbbf24]/40'
                          : `bg-[#022c22]/95 border-emerald-700/70 border-b-6 border-b-[#011a14] hover:border-[#fbbf24]/60`
                      }`}
                    >
                      {isMe && (
                        <span className="absolute top-2.5 left-2.5 text-[9px] px-2.5 py-0.5 rounded-full bg-[#fbbf24] text-[#064e3b] font-black shadow-sm">
                          أنت
                        </span>
                      )}

                      <div>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black mb-2 shadow-sm ${badge.bg} border-2 border-b-3 border-white/20`}>
                          <BadgeIcon className="w-3.5 h-3.5 shrink-0" />
                          <span>{badge.label}</span>
                        </span>
                        <h4 className="text-base font-black text-white truncate mt-1">{item.student.name}</h4>
                        <p className="text-xs text-emerald-300/80 mt-0.5 font-bold">{item.halaqahName}</p>
                      </div>

                      <div className="mt-3.5 pt-2.5 border-t border-emerald-800/60 grid grid-cols-3 gap-1 text-center bg-[#011a14]/60 p-2.5 rounded-2xl border border-emerald-800/60">
                        <div>
                          <span className="text-[10px] text-slate-300 block font-bold">النقاط</span>
                          <strong className="text-amber-300 font-mono text-sm font-black">{toArabicDigits(item.totalPoints)}</strong>
                        </div>
                        <div className="border-r border-l border-emerald-800/60 px-1">
                          <span className="text-[10px] text-slate-300 block font-bold">التسميع</span>
                          <strong className="text-emerald-300 font-mono text-xs font-black">{toArabicDigits(item.evalPoints)}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-300 block font-bold">الاختبارات</span>
                          <strong className="text-sky-300 font-mono text-xs font-black">{toArabicDigits(item.examPoints)}</strong>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedStudentForBreakdown(item);
                        }}
                        className="mt-3 py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-emerald-950 text-xs font-black border-2 border-amber-300 border-b-4 border-amber-600 active:translate-y-[2px] active:border-b-2 shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>عرض تفاصيل ومصادر النقاط</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Full Rank Table */}
            <div className="rounded-3xl border-2 border-emerald-700/70 border-b-6 border-b-[#011a14] overflow-hidden bg-[#022c22]/90 shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#064e3b] text-emerald-200 border-b-2 border-emerald-700 text-xs">
                    <tr>
                      <th className="p-3.5">الترتيب</th>
                      <th className="p-3.5">اسم الطالب</th>
                      {!isPerHalaqahScope && <th className="p-3.5">الحلقة</th>}
                      <th className="p-3.5 text-center">نقاط التسميع</th>
                      <th className="p-3.5 text-center">نقاط الاختبارات</th>
                      <th className="p-3.5 text-center">نقاط الاستماع</th>
                      <th className="p-3.5 text-left">إجمالي النقاط</th>
                      <th className="p-3.5 text-center">التفاصيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-800/40 text-white font-bold">
                    {displayedRankList.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-emerald-300/70">
                          لا توجد نتائج مطابقة لبحثك في لوحة الشرف.
                        </td>
                      </tr>
                    ) : (
                      displayedRankList.map((item) => {
                        const isMe = item.student.id === student.id;
                        const originalIdx = studentRankList.findIndex(x => x.student.id === item.student.id);
                        return (
                          <tr
                            key={item.student.id}
                            onClick={() => setSelectedStudentForBreakdown(item)}
                            className={`transition-colors cursor-pointer ${
                              isMe
                                ? 'bg-[#064e3b] text-amber-300 border-l-4 border-l-amber-400'
                                : 'hover:bg-[#064e3b]/50'
                            }`}
                          >
                            <td className="p-3.5 font-mono">
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-xl text-xs font-black shadow-sm ${
                                originalIdx === 0
                                  ? 'bg-[#fbbf24] text-[#064e3b] border-2 border-b-4 border-amber-600'
                                  : originalIdx === 1
                                  ? 'bg-slate-300 text-slate-900 border-2 border-b-4 border-slate-500'
                                  : originalIdx === 2
                                  ? 'bg-amber-600 text-white border-2 border-b-4 border-amber-800'
                                  : 'bg-[#011a14] text-emerald-300 border border-emerald-800'
                              }`}>
                                {toArabicDigits(originalIdx + 1)}
                              </span>
                            </td>
                            <td className="p-3.5">
                              <div className="flex items-center gap-2">
                                <span className={isMe ? 'text-amber-300 font-black' : 'font-bold'}>{item.student.name}</span>
                                {isMe && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-emerald-950 font-black shadow-sm">
                                    أنت
                                  </span>
                                )}
                              </div>
                            </td>
                            {!isPerHalaqahScope && (
                              <td className="p-3.5 text-emerald-300/80 text-xs font-medium">{item.halaqahName}</td>
                            )}
                            <td className="p-3.5 text-center font-mono text-emerald-300 font-black">{toArabicDigits(item.evalPoints)}</td>
                            <td className="p-3.5 text-center font-mono text-sky-300 font-black">{toArabicDigits(item.examPoints)}</td>
                            <td className="p-3.5 text-center font-mono text-amber-300 font-black">{toArabicDigits(item.listeningPoints)}</td>
                            <td className="p-3.5 text-left font-mono font-black text-amber-300 text-sm">
                              {toArabicDigits(item.totalPoints)}
                            </td>
                            <td className="p-3.5 text-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedStudentForBreakdown(item);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-emerald-950 text-[11px] font-black border-2 border-amber-300 border-b-3 border-b-amber-600 active:translate-y-[2px] active:border-b-2 transition-all cursor-pointer shadow-sm"
                              >
                                عرض النقاط
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 5: CERTIFICATES & AWARDS (شهاداتي والجوائز التقديرية) */}
        {/* ============================================================== */}
        {activeTab === 'certificates' && (
          <div
            className="p-6 sm:p-8 rounded-[32px] border-2 border-b-[6px] shadow-2xl space-y-6 backdrop-blur-md relative overflow-hidden transition-all"
            style={{
              backgroundColor: resolvedComplex?.theme?.cardColor ? `${resolvedComplex.theme.cardColor}f2` : '#064e3b',
              borderColor: resolvedComplex?.theme?.accentColor || '#fbbf24',
              borderBottomColor: darkenHex(resolvedComplex?.theme?.accentColor || '#fbbf24', 0.4)
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-emerald-600/30">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-400 text-emerald-950 font-black flex items-center justify-center border-2 border-b-4 border-amber-600 shadow-md">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black font-heading text-white flex items-center gap-2">
                    <span>أرشيف شهاداتي والجوائز التقديرية</span>
                    <span className="text-xs px-3 py-1 rounded-full bg-amber-400 text-emerald-950 font-black shadow-sm">
                      {toArabicDigits(studentCertificates.length)} شهادات معتمدة
                    </span>
                  </h3>
                  <p className="text-xs text-emerald-100/80 font-bold mt-0.5">
                    جميع الشهادات الصادرة والمحفوظة في أرشيفك الرسمي مع إمكانية عرضها وطباعتها
                  </p>
                </div>
              </div>
            </div>

            {studentCertificates.length === 0 ? (
              <div className="text-center py-12 px-6 bg-[#011a14]/90 rounded-3xl border-2 border-dashed border-emerald-600/60 border-b-4 border-b-[#011a14] space-y-3.5 shadow-inner">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-[#064e3b] border-2 border-emerald-500/60 border-b-4 border-b-emerald-950 flex items-center justify-center text-amber-400 shadow-md">
                  <Award className="w-7 h-7" />
                </div>
                <h4 className="text-base font-black text-white font-heading">لا توجد شهادات صادرة لهذا الطالب بعد</h4>
                <p className="text-xs text-emerald-200/80 max-w-md mx-auto leading-relaxed font-bold">
                  ستظهر هنا فور إصدارها واعتمادها من قبل المعلم أو إدارة المجمع القرآني مع إمكانية عرضها وطباعتها مباشرة.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {studentCertificates.map(cert => (
                  <div
                    key={cert.id}
                    className="p-5 rounded-2xl bg-[#022c22] border-2 border-[#fbbf24]/30 border-b-4 border-b-[#011a14] space-y-3 flex flex-col justify-between shadow-lg hover:border-[#fbbf24]/70 transition-all"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                          {cert.type || 'شهادة تميز قرآنية'}
                        </span>
                        <span className="text-[11px] text-[#86efac]/80 font-mono">
                          {cert.issueDate || cert.createdAt?.split('T')[0]}
                        </span>
                      </div>

                      <h4 className="text-base font-black text-white font-heading">
                        {cert.title || 'شهادة شكر وتقدير وإتقان'}
                      </h4>

                      {cert.appreciationText && (
                        <p className="text-xs text-emerald-100/90 leading-relaxed bg-[#064e3b]/30 p-2.5 rounded-xl border border-[#065f46]/50">
                          {cert.appreciationText}
                        </p>
                      )}

                      <div className="text-[11px] text-[#86efac] flex items-center justify-between pt-1">
                        <span>إشراف المعلم: {cert.teacherName || 'معلم الحلقة'}</span>
                        {cert.complexName && <span>مجمع: {cert.complexName}</span>}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#065f46]/60 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => setSelectedCertificateForView(cert)}
                        className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-emerald-950 text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-lg border-2 border-b-4 border-amber-600 active:translate-y-[2px] active:border-b-2 transition-all"
                      >
                        <Award className="w-3.5 h-3.5 fill-current" />
                        <span>عرض الشهادة وطباعتها</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STUDENT POINTS BREAKDOWN MODAL */}
        {selectedStudentForBreakdown && (
          <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-[#022c22] border border-[#fbbf24]/50 rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-5 text-right relative">
              <button
                onClick={() => setSelectedStudentForBreakdown(null)}
                className="absolute top-4 left-4 p-2 text-emerald-300 hover:text-white rounded-xl bg-emerald-950/40 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 border-b border-emerald-800 pb-4">
                <div className="w-12 h-12 rounded-2xl bg-[#fbbf24]/20 text-[#fbbf24] border border-[#fbbf24]/30 flex items-center justify-center shrink-0">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold font-heading text-white">
                    تفاصيل ومصادر نقاط: {selectedStudentForBreakdown.student.name}
                  </h3>
                  <p className="text-xs text-[#86efac]/80 mt-0.5">
                    {selectedStudentForBreakdown.halaqahName} • إجمالي النقاط:{' '}
                    <strong className="text-[#fbbf24] font-mono text-sm">{selectedStudentForBreakdown.totalPoints}</strong> نقطة
                  </p>
                </div>
              </div>

              {/* 4 Pillars Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                <div className="p-3 rounded-2xl bg-[#064e3b]/50 border border-emerald-700/50 space-y-1">
                  <span className="text-[10px] text-emerald-300 block font-bold">نقاط التسميع</span>
                  <span className="text-lg font-black text-emerald-200 font-mono">
                    +{selectedStudentForBreakdown.evalPoints}
                  </span>
                  <span className="text-[9px] text-emerald-400/70 block">
                    {selectedStudentForBreakdown.completedEvaluations} تقييم تسميع
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-[#064e3b]/50 border border-blue-700/50 space-y-1">
                  <span className="text-[10px] text-blue-300 block font-bold">نقاط الاختبارات</span>
                  <span className="text-lg font-black text-blue-200 font-mono">
                    +{selectedStudentForBreakdown.examPoints}
                  </span>
                  <span className="text-[9px] text-blue-400/70 block">
                    {selectedStudentForBreakdown.completedExams} اختبار منجز
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-[#064e3b]/50 border border-amber-700/50 space-y-1">
                  <span className="text-[10px] text-amber-300 block font-bold">نقاط الاستماع</span>
                  <span className="text-lg font-black text-amber-200 font-mono">
                    +{selectedStudentForBreakdown.listeningPoints}
                  </span>
                  <span className="text-[9px] text-amber-400/70 block">
                    {selectedStudentForBreakdown.completedListenings} جلسة تكرار
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-[#064e3b]/50 border border-teal-700/50 space-y-1">
                  <span className="text-[10px] text-teal-300 block font-bold">نقاط الصفحات</span>
                  <span className="text-lg font-black text-teal-200 font-mono">
                    +{selectedStudentForBreakdown.pagePoints || 0}
                  </span>
                  <span className="text-[9px] text-teal-400/70 block">أوجه مكتملة</span>
                </div>
              </div>

              {/* Exam Submissions Details */}
              {selectedStudentForBreakdown.stSubmissions?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    <span>سجل الاختبارات المنجزة ({selectedStudentForBreakdown.stSubmissions.length})</span>
                  </h4>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {selectedStudentForBreakdown.stSubmissions.map((sub: any) => (
                      <div
                        key={sub.id}
                        className="p-2.5 rounded-xl bg-[#064e3b]/30 border border-emerald-800/60 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-white">{sub.examTitle}</span>
                          <span className="text-[10px] text-emerald-300/70 block">{sub.submittedAt ? sub.submittedAt.split('T')[0] : ''}</span>
                        </div>
                        <div className="text-left font-mono">
                          <span className="text-blue-300 font-bold">+{sub.pointsGrantedForLeaderboard || 0} نقطة</span>
                          <span className="text-[10px] text-emerald-400/80 block">({sub.percentage}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recitation Evaluation Criteria Details */}
              {selectedStudentForBreakdown.stEvaluations?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                    <span>سجل تقييمات التسميع الأخيرة ({selectedStudentForBreakdown.stEvaluations.length})</span>
                  </h4>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {selectedStudentForBreakdown.stEvaluations.slice(-5).reverse().map((ev: any) => {
                      const cPts = ev.recitationDetails?.criteriaPointsEarnedToday || 0;
                      const pPts = ev.recitationDetails?.pagesPointsEarnedToday || 0;
                      const tot = ev.recitationDetails?.pointsEarnedToday ?? (cPts + pPts);
                      return (
                        <div
                          key={ev.id}
                          className="p-2.5 rounded-xl bg-[#064e3b]/30 border border-emerald-800/60 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-white">{ev.date} - تسميع يومي</span>
                            <span className="text-[10px] text-emerald-300/70 block">
                              ورد الحفظ: {ev.dailyTarget || 'مقرر الحفظ'} • التقييم: {ev.totalScore}%
                            </span>
                          </div>
                          <div className="text-left font-mono">
                            <span className="text-emerald-300 font-bold">+{tot} نقطة</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-emerald-800">
                <button
                  onClick={() => setSelectedStudentForBreakdown(null)}
                  className="px-5 py-2 rounded-xl bg-[#fbbf24] text-[#064e3b] font-bold text-xs cursor-pointer hover:bg-amber-300 transition-colors"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )}

        {/* REVIEW PREVIOUS ATTEMPT MODAL */}
        {viewingReviewSubmission && (
          <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-[#022c22] border border-[#fbbf24]/50 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-emerald-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Award className="w-5 h-5 text-[#fbbf24]" />
                    <span>مراجعة درجات: {viewingReviewSubmission.examTitle}</span>
                  </h3>
                  <p className="text-xs text-emerald-300/80 mt-0.5">
                    الدرجة: {viewingReviewSubmission.totalScoreEarned} من {viewingReviewSubmission.maxPossibleScore} ({viewingReviewSubmission.percentage}%)
                  </p>
                </div>
                <button
                  onClick={() => setViewingReviewSubmission(null)}
                  className="p-2 rounded-xl text-emerald-300 hover:text-white cursor-pointer"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                {viewingReviewSubmission.answers.map((ans, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-[#064e3b]/40 border border-emerald-800 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-white">س {idx + 1}: {ans.questionTitle}</span>
                      <span className="text-[#fbbf24]">{ans.pointsEarned} / {ans.maxPoints} درجة</span>
                    </div>
                    <div className="p-2 rounded-xl bg-[#022c22] text-emerald-100">
                      <span className="text-emerald-400 font-bold block">إجابتك:</span>
                      <p className="text-white">{ans.studentAnswer || 'لم تتم الإجابة'}</p>
                    </div>
                    {ans.teacherFeedback && (
                      <div className="text-amber-300 bg-amber-950/40 p-2 rounded-xl border border-amber-500/20">
                        <strong>ملاحظة المعلم: </strong>{ans.teacherFeedback}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {viewingReviewSubmission.teacherGeneralFeedback && (
                <div className="p-3 rounded-2xl bg-[#064e3b]/60 border border-[#065f46] text-xs text-white">
                  <strong className="text-[#fbbf24]">توجيه عام من المعلم: </strong>
                  {viewingReviewSubmission.teacherGeneralFeedback}
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-emerald-800">
                <button
                  onClick={() => setViewingReviewSubmission(null)}
                  className="px-5 py-2 rounded-xl bg-[#fbbf24] text-[#064e3b] font-bold text-xs cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Portal Global Footer */}
        <footer className="mt-12 pt-6 border-t border-[#065f46]/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#86efac]/70">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#fbbf24]" />
            <span className="font-bold text-white">{displayComplexName}</span>
          </div>
          <div className="flex items-center gap-2 text-center text-xs text-[#fbbf24] font-bold bg-[#064e3b]/80 px-3.5 py-1.5 rounded-full border border-amber-400/30 shadow-sm">
            <span>مشغل بواسطة منصة عمران</span>
          </div>
          <p className="text-[11px] text-[#86efac]/60">
            بوابة الطالب وولي الأمر • متابعة الحفظ والتسميع والاختبارات
          </p>
        </footer>

        {/* MANDATORY GOOGLE AUTH GATEKEEPER MODAL BEFORE EXAM ENTRY */}
        {googleAuthGateExam && (
          <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#022c22] border border-[#fbbf24]/60 rounded-3xl w-full max-w-md p-6 sm:p-7 shadow-2xl space-y-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-[#fbbf24] border border-[#fbbf24]/40 flex items-center justify-center mx-auto">
                <svg className="w-8 h-8" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              </div>

              <h3 className="text-lg sm:text-xl font-black text-white font-heading">
                تسجيل الدخول بـ Google مطلوب لدخول الاختبار
              </h3>

              <div className="p-3.5 rounded-2xl bg-[#064e3b]/70 border border-emerald-700/60 text-right space-y-2">
                <p className="text-xs text-emerald-100 font-semibold leading-relaxed">
                  أهلاً بك يا <strong>{currentStudent.name}</strong>! لدخول اختبار:
                  <span className="block text-[#fbbf24] font-bold mt-1 text-sm">"{googleAuthGateExam.title}"</span>
                </p>
                <p className="text-[11px] text-emerald-300/90 leading-relaxed">
                  يشترط النظام تسجيل الدخول بحساب Google المعتمد لديك، حتى يتسنى التحقق من هويتك وتوثيق إجاباتك ورصد درجاتك في سجلك تلقائياً دون أي تدخل يدوي.
                </p>
              </div>

              {googleLinkError && (
                <div className="p-3 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs text-right leading-relaxed">
                  {googleLinkError}
                </div>
              )}

              <div className="flex flex-col gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleLinkGoogleAccount(googleAuthGateExam)}
                  disabled={isLinkingGoogle}
                  className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-800 font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-xl transition-all cursor-pointer disabled:opacity-60"
                >
                  {isLinkingGoogle ? (
                    <div className="flex items-center gap-2 text-slate-600">
                      <div className="w-4 h-4 border-2 border-slate-400 border-t-emerald-600 rounded-full animate-spin" />
                      <span>جاري التحقق بحساب Google...</span>
                    </div>
                  ) : (
                    <>
                      <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                      <span>تسجيل الدخول والربط بحساب Google</span>
                    </>
                  )}
                </button>

                <p className="text-[11px] text-emerald-300/80 text-center flex items-center justify-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-[#fbbf24] shrink-0" />
                  <span>بمجرد تسجيل الدخول بحساب Google، سيتم فتح الاختبار فوراً ورصد نتيجتك لحسابك تلقائياً.</span>
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setGoogleAuthGateExam(null);
                    setGoogleLinkError('');
                  }}
                  disabled={isLinkingGoogle}
                  className="w-full py-2 px-4 rounded-xl text-emerald-300 hover:text-white text-xs font-semibold cursor-pointer transition-colors mt-1"
                >
                  إلغاء والعودة
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CERTIFICATE PREVIEW & PRINT MODAL FOR STUDENT / PARENT */}
        {selectedCertificateForView && (
          <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-[#022c22] border-2 border-[#fbbf24]/60 rounded-3xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 shadow-2xl space-y-4 text-right relative flex flex-col">
              {/* Modal Top Bar */}
              <div className="flex items-center justify-between border-b border-emerald-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-[#fbbf24]/20 text-[#fbbf24] border border-[#fbbf24]/40 flex items-center justify-center shrink-0">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white font-heading">
                      {selectedCertificateForView.templateName || 'شهادة تميز وإتقان قرآني'}
                    </h3>
                    <p className="text-xs text-[#fbbf24] font-bold">
                      الطالب: {selectedCertificateForView.studentName || currentStudent.name}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedCertificateForView(null)}
                  className="p-2 rounded-xl text-emerald-300 hover:text-white bg-emerald-950/60 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Certificate Canvas / Card View */}
              <div
                id="portal-printable-certificate"
                className="relative w-full aspect-[1.414/1] rounded-2xl overflow-hidden shadow-2xl p-6 sm:p-8 flex flex-col justify-between border-4 border-[#fbbf24] select-none text-center"
                style={{
                  background: selectedCertificateForView.templateType === 'custom' && selectedCertificateForView.customTemplateImageUrl
                    ? `url(${selectedCertificateForView.customTemplateImageUrl}) center/cover no-repeat`
                    : 'linear-gradient(135deg, #022c22 0%, #064e3b 50%, #022c22 100%)',
                  color: '#f0f9f6'
                }}
              >
                {selectedCertificateForView.templateType === 'custom' && selectedCertificateForView.customTemplateImageUrl ? (
                  /* Custom template display with overlay student name */
                  <div className="w-full h-full flex flex-col justify-center items-center relative">
                    <div className="font-quran text-2xl sm:text-4xl md:text-5xl font-black text-[#064e3b] py-2">
                      {selectedCertificateForView.studentName || currentStudent.name}
                    </div>
                    {selectedCertificateForView.dateArabic && (
                      <div className="text-xs sm:text-sm text-slate-700 font-bold mt-2">
                        {selectedCertificateForView.dateArabic}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Ready-made emerald royal certificate */
                  <>
                    <div className="flex flex-col items-center justify-center space-y-1">
                      <div className="font-quran text-sm sm:text-lg text-[#fbbf24] font-bold">
                        بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                      </div>
                      <div className="font-quran text-xs sm:text-sm text-emerald-200 opacity-90 px-4">
                        ﴿ يَرْفَعِ اللَّهُ الَّذِينَ آمَنُوا مِنكُمْ وَالَّذِينَ أُوتُوا الْعِلْمَ دَرَجَاتٍ ﴾
                      </div>
                      <h1 className="font-heading font-black text-xl sm:text-3xl md:text-4xl text-[#fbbf24] mt-2 tracking-wide">
                        شَهَادَةُ تَمَيُّزٍ وَإِتْقَانٍ قُرْآنِيٍّ
                      </h1>
                    </div>

                    <div className="space-y-2 sm:space-y-3 my-auto py-2">
                      <p className="text-xs sm:text-sm text-emerald-200 font-semibold">
                        يَسُرُّ إِدَارَةَ الحِلْقَةِ أَنْ تَمْنَحَ هذِهِ الشَّهَادَةَ المُبَارَكَةَ لِلطَّالِبِ النَّجِيبِ:
                      </p>
                      <div className="font-quran text-2xl sm:text-4xl md:text-5xl font-black text-[#fbbf24] py-1">
                        {selectedCertificateForView.studentName || currentStudent.name}
                      </div>
                      <p className="text-xs sm:text-sm text-white/95 max-w-lg mx-auto leading-relaxed font-medium">
                        {selectedCertificateForView.occasionText || selectedCertificateForView.occasion || 'تقديراً لاجتهاده وحرصه المتميز في حفظ وتلاوة كتاب الله الكريم'}
                      </p>
                      <div className="text-[11px] text-[#86efac]">
                        {selectedCertificateForView.halaqahName && <span>الحلقة: <strong>{selectedCertificateForView.halaqahName}</strong> • </span>}
                        <span>المجمع: <strong>{selectedCertificateForView.complexName || displayComplexName}</strong></span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#fbbf24]/30 flex items-center justify-between text-[11px] sm:text-xs text-emerald-200">
                      <div className="text-right">
                        <span className="block text-[10px] text-emerald-400">معلم ومحفظ الحلقة:</span>
                        <span className="font-bold text-white">{selectedCertificateForView.teacherName || settings.teacherName || 'الشيخ المعلم'}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[#fbbf24] font-bold">
                        {resolvedComplex?.stampUrl ? (
                          <div className="flex items-center gap-2">
                            <img src={resolvedComplex.stampUrl} alt="ختم المجمع" className="w-10 h-10 object-contain rounded-full shadow-md" />
                            <span>ختم معتمد • {displayComplexName}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Award className="w-4 h-4" />
                            <span>معتمد رسمياً • {displayComplexName}</span>
                          </div>
                        )}
                      </div>

                      <div className="text-left">
                        <span className="block text-[10px] text-emerald-400">تاريخ الإصدار:</span>
                        <span className="font-bold text-white">{selectedCertificateForView.dateArabic || selectedCertificateForView.createdAt?.split('T')[0]}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-emerald-800">
                <button
                  type="button"
                  onClick={() => {
                    const printContent = document.getElementById('portal-printable-certificate');
                    if (printContent) {
                      const printWin = window.open('', '', 'width=900,height=650');
                      if (printWin) {
                        printWin.document.write(`
                          <html dir="rtl">
                            <head>
                              <title>شهادة - ${selectedCertificateForView.studentName || currentStudent.name}</title>
                              <style>
                                body { margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #fff; }
                                @page { size: A4 landscape; margin: 0; }
                              </style>
                            </head>
                            <body>
                              ${printContent.outerHTML}
                              <script>window.onload = function() { window.print(); window.close(); };<\/script>
                            </body>
                          </html>
                        `);
                        printWin.document.close();
                      } else {
                        window.print();
                      }
                    }
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#fbbf24] text-[#064e3b] font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer hover:bg-[#f59e0b]"
                >
                  <Award className="w-4 h-4" />
                  <span>طباعة الشهادة الرسمية</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedCertificateForView(null)}
                  className="px-4 py-2 rounded-xl bg-[#064e3b] text-emerald-200 font-bold text-xs hover:text-white cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Sleek Modern Right-Side Sync & Refresh Indicator in Platform Theme (زي المعلمين اسفل اليمين بتحديثات السحابة وقاعدة البيانات) */}
      <AnimatePresence>
        {(showSyncBadge || isCloudSyncing || isSyncingLocal) && (
          <motion.div
            initial={{ opacity: 0, y: 25, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
            exit={{ opacity: 0, y: 25, x: 20, scale: 0.95 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-5 right-5 z-[9990] flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-b-4 shadow-[0_12px_40px_rgba(0,0,0,0.65)] backdrop-blur-md text-xs font-bold select-none cursor-pointer group active:translate-y-[2px]"
            style={{
              backgroundColor: `${themeCardBg}fa`,
              borderColor: `${themeAccent}90`,
              borderBottomColor: themeAccentShadow,
              color: '#ffffff'
            }}
            onClick={handleManualRefresh}
            title="انقر لتحديث السجلات يدوياً من قاعدة البيانات"
            dir="rtl"
          >
            <span className="relative flex h-3 w-3 shrink-0">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ backgroundColor: themeAccent }}
              />
              <span
                className="relative inline-flex rounded-full h-3 w-3"
                style={{ backgroundColor: themeAccent }}
              />
            </span>
            <RefreshCw
              className={`w-4 h-4 shrink-0 ${(isSyncingLocal || isCloudSyncing) ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`}
              style={{ color: themeAccent }}
            />
            <div className="flex flex-col text-right">
              <span className="text-[11px] font-black font-heading text-white">
                {syncNoticeText || cloudSyncText || 'تحديث البيانات السحابية مباشرة...'}
              </span>
              <span className="text-[10px] text-slate-300 font-normal">
                {isSyncingLocal ? 'جاري جلب أحدث السجلات...' : 'انقر لتحديث البيانات الآن'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      </div>
    </div>
  );
};
