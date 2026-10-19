import React, { useState, useEffect, useMemo } from 'react';
import {
  Star,
  BookOpen,
  Sparkles,
  Award,
  CheckCircle2,
  Plus,
  Trash2,
  Pencil,
  AlertCircle,
  Clock,
  Volume2,
  Headphones,
  Sliders,
  ChevronRight,
  ChevronLeft,
  Calendar,
  History,
  Send,
  X,
  Layers,
  RotateCcw,
  Check,
  Compass,
  FileText,
  ArrowLeftRight,
  XCircle,
  Info,
  ShieldAlert,
  AlertTriangle,
  Trophy,
  Flame,
  TrendingUp,
  Zap,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  Student,
  AttendanceRecord,
  StudentEvaluation,
  EvaluationCriteria,
  CriteriaType,
  QuranRecitationItem,
  AppSettings,
  QuranComplex
} from '../../types';
import {
  QURAN_SURAHS,
  FAMOUS_RECITERS,
  REVIEW_TYPES,
  getSurahInfo,
  formatQuranPortion
} from '../../data/quranData';
import { KingFahdQuranModal, QuranHighlightItem } from '../quran/KingFahdQuranModal';
import {
  getPageOfAyah,
  calculateStudentCompletedPages,
  calculateRecitationFractionalFaces,
  calculatePortionFromPace
} from '../../data/quranPagesData';
import { analyzeMonthlyProgression } from '../../lib/aiPlanService';
import { OmranDataService } from '../../lib/firebase';
import { darkenHex, lightenHex, getContrastTextColor } from '../../lib/themeUtils';
import { ApiConfig } from '../../lib/apiConfig';

interface EvaluationTabProps {
  students: Student[];
  attendance: AttendanceRecord[];
  evaluations: StudentEvaluation[];
  criteria: EvaluationCriteria[];
  isSupervisor?: boolean;
  activeComplexId?: string;
  activeComplex?: QuranComplex | null;
  selectedStudentId?: string;
  onSaveEvaluation: (
    evaluation: StudentEvaluation,
    newAssignment?: any,
    updatedPosition?: { surahNumber: number; surahName: string; ayah: number },
    listeningAssignment?: any
  ) => Promise<void>;
  onSaveCriteria: (criteriaList: EvaluationCriteria[]) => Promise<void>;
  onDeleteCriteria: (id: string) => Promise<void>;
  onUpdateStudentAIPlan: (
    studentId: string,
    newAssignment: any,
    updatedPosition?: { surahNumber: number; surahName: string; ayah: number },
    listeningAssignment?: any
  ) => Promise<void>;
  onNavigateToWhatsApp?: (studentId: string) => void;
  onNavigateToBehavior?: (studentId: string) => void;
  settings?: AppSettings;
}

export const EvaluationTab: React.FC<EvaluationTabProps> = ({
  students,
  attendance,
  evaluations,
  criteria,
  isSupervisor = false,
  activeComplexId,
  activeComplex,
  selectedStudentId,
  onSaveEvaluation,
  onSaveCriteria,
  onDeleteCriteria,
  onUpdateStudentAIPlan,
  onNavigateToWhatsApp,
  onNavigateToBehavior,
  settings
}) => {
  const currentTheme = activeComplex?.theme || settings?.theme;
  const themePrimary = currentTheme?.primaryColor || '#131f24';
  const themeSecondary = currentTheme?.secondaryColor || '#1b2e35';
  const themeAccent = currentTheme?.accentColor || '#ffc800';
  const themeCardBg = currentTheme?.cardColor || '#203843';
  const themeBorder = lightenHex(themeCardBg, 0.18);
  const themeBorderBottom = darkenHex(themeCardBg, 0.35);
  const themeAccentShadow = darkenHex(themeAccent, 0.28);
  const accentTextColor = getContrastTextColor(themeAccent);

  const todayStr = new Date().toISOString().split('T')[0];

  // Selected Date for evaluation view & entry (Default: Today)
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Active student selection
  const [activeStudentId, setActiveStudentId] = useState<string>(
    selectedStudentId || (students.length > 0 ? students[0].id : '')
  );

  // Instantly update active student when students list changes (e.g. switching activeHalaqahId)
  useEffect(() => {
    if (selectedStudentId && students.some(s => s.id === selectedStudentId)) {
      setActiveStudentId(selectedStudentId);
    } else if (students.length > 0) {
      if (!activeStudentId || !students.some(s => s.id === activeStudentId)) {
        setActiveStudentId(students[0].id);
      }
    } else {
      setActiveStudentId('');
    }
  }, [students, selectedStudentId, activeStudentId]);

  const activeStudent = students.find(s => s.id === activeStudentId);

  // History Drawer toggle
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false);

  // Auto-fill notice from yesterday
  const [autoFilledNotice, setAutoFilledNotice] = useState<string>('');

  // "لم يُسمّع" (Did not recite) for Today's New Memorization
  const [todayNewDidNotRecite, setTodayNewDidNotRecite] = useState<boolean>(false);
  const [todayNewDidNotReciteReason, setTodayNewDidNotReciteReason] = useState<string>('');

  // ----------------------------------------------------
  // 1. RECITATION STATE (ما سمعه الطالب)
  // Supports multi-surah ranges
  // ----------------------------------------------------
  // Today's New Memorization
  const [todayNewSurah, setTodayNewSurah] = useState<number>(78);
  const [todayNewFromAyah, setTodayNewFromAyah] = useState<number>(1);
  const [todayNewToSurah, setTodayNewToSurah] = useState<number>(78);
  const [todayNewToAyah, setTodayNewToAyah] = useState<number>(10);

  // Today's Review Items
  const [todayReviews, setTodayReviews] = useState<QuranRecitationItem[]>([
    {
      id: 'rev_1',
      type: REVIEW_TYPES[0],
      surahNumber: 78,
      surahName: 'النبأ',
      fromAyah: 1,
      toSurahNumber: 78,
      toSurahName: 'النبأ',
      toAyah: 40,
      isFullSurah: true
    }
  ]);

  // ----------------------------------------------------
  // 2. TOMORROW'S REQUIRED ASSIGNMENT (مقرر الغد يحدده المعلم)
  // Supports multi-surah ranges & persistent multiple review items
  // ----------------------------------------------------
  const [tomNewSurah, setTomNewSurah] = useState<number>(78);
  const [tomNewFromAyah, setTomNewFromAyah] = useState<number>(11);
  const [tomNewToSurah, setTomNewToSurah] = useState<number>(78);
  const [tomNewToAyah, setTomNewToAyah] = useState<number>(20);

  // Tomorrow's Review Items (can have multiple items: review, cumulative, test, etc.)
  const [tomReviews, setTomReviews] = useState<QuranRecitationItem[]>([
    {
      id: 'tom_rev_1',
      type: REVIEW_TYPES[0],
      surahNumber: 79,
      surahName: 'النازعات',
      fromAyah: 1,
      toSurahNumber: 79,
      toSurahName: 'النازعات',
      toAyah: 46,
      isFullSurah: true
    }
  ]);

  const [selectedSheikh, setSelectedSheikh] = useState<string>(FAMOUS_RECITERS[0].name);
  const [targetRepetitions, setTargetRepetitions] = useState<number>(3);
  const [dailyHomeNote, setDailyHomeNote] = useState<string>(
    'الاستماع للقارئ المتقن 3 مرات، وتكرار الآيات غيباً 5 مرات قبل النوم والتسميع على ولي الأمر.'
  );

  // Criteria values & Teacher notes
  const [criteriaValues, setCriteriaValues] = useState<Record<string, any>>({});
  const [teacherNotes, setTeacherNotes] = useState<string>('أداء طيب ومتقن ما شاء الله، نسأل الله له التوفيق والرفعة.');

  // Configured Points for Pages & Listening (from criteria or default)
  const pointsPerNewPage = useMemo(() => {
    const found = criteria.find(c => c.id === 'crit-points-new-page');
    return typeof found?.pointsWeight === 'number' ? found.pointsWeight : 5;
  }, [criteria]);

  const pointsPerReviewPage = useMemo(() => {
    const found = criteria.find(c => c.id === 'crit-points-review-page');
    return typeof found?.pointsWeight === 'number' ? found.pointsWeight : 1;
  }, [criteria]);

  const pointsPerListening = useMemo(() => {
    const found = criteria.find(c => c.id === 'crit-points-listening');
    return typeof found?.pointsWeight === 'number' ? found.pointsWeight : 5;
  }, [criteria]);

  // General evaluation criteria (excluding internal page point definitions)
  const displayCriteria = useMemo(() => {
    return criteria.filter(c => !c.id.startsWith('crit-points-'));
  }, [criteria]);

  // Live calculation of criteria points earned today
  const liveCriteriaPoints = useMemo(() => {
    let calculated = 0;
    displayCriteria.forEach(crit => {
      const val = criteriaValues[crit.id];
      const weight = typeof crit.pointsWeight === 'number' ? crit.pointsWeight : 10;
      if (val !== undefined && val !== null && val !== '') {
        if (crit.type === 'stars') {
          const stars = Number(val) || 0;
          calculated += Math.round((stars / 5) * weight);
        } else if (crit.type === 'score') {
          const score = Number(val) || 0;
          const maxScore = crit.maxScore || 10;
          calculated += Math.round((score / maxScore) * weight);
        } else if (crit.type === 'options') {
          const opts = crit.options || [];
          const idx = opts.indexOf(String(val));
          if (idx === 0) calculated += weight;
          else if (idx === 1) calculated += Math.round(weight * 0.75);
          else if (idx === 2) calculated += Math.round(weight * 0.5);
          else if (idx >= 3) calculated += Math.round(weight * 0.25);
        }
      }
    });
    return calculated;
  }, [displayCriteria, criteriaValues]);

  // Live calculation of fractional faces recited today (0.25, 0.5, 0.75, 1.0, etc.)
  const liveNewFacesCount = useMemo(() => {
    if (todayNewDidNotRecite) return 0;
    return calculateRecitationFractionalFaces(todayNewSurah, todayNewFromAyah, todayNewToSurah, todayNewToAyah);
  }, [todayNewDidNotRecite, todayNewSurah, todayNewFromAyah, todayNewToSurah, todayNewToAyah]);

  const liveReviewFacesCount = useMemo(() => {
    let count = 0;
    todayReviews.forEach(r => {
      if (!r.didNotRecite) {
        count += calculateRecitationFractionalFaces(r.surahNumber, r.fromAyah, r.toSurahNumber || r.surahNumber, r.toAyah);
      }
    });
    return count;
  }, [todayReviews]);

  // Attendance status of active student on the selected date
  const selectedDateAtt = attendance.find(
    a => a.date === selectedDate && a.studentId === activeStudentId
  );
  const isAbsent = selectedDateAtt?.status === 'غائب';
  const isExcused = selectedDateAtt?.status === 'معتذر';

  // Point multipliers taken from settings (لوحة الشرف وإعدادات المجمع)
  const newPageMultiplier = typeof settings?.newPagePoints === 'number' ? settings.newPagePoints : 5;
  const reviewPageMultiplier = typeof settings?.reviewPagePoints === 'number' ? settings.reviewPagePoints : 1;

  // Attendance points calculation for selected date
  const attendancePoints = useMemo(() => {
    const attSettings = settings?.attendancePointsSettings;
    if (attSettings && attSettings.enableAttendancePoints === false) return 0;
    if (!selectedDateAtt) return 0;
    if (selectedDateAtt.status === 'حاضر') return attSettings?.presentPoints ?? 1;
    if (selectedDateAtt.status === 'غائب') return -(attSettings?.absentPointsDeduction ?? 1);
    if (selectedDateAtt.status === 'متأخر') return attSettings?.latePoints ?? 0;
    if (selectedDateAtt.status === 'معتذر') return attSettings?.excusedPoints ?? 0;
    return 0;
  }, [settings?.attendancePointsSettings, selectedDateAtt]);

  const liveNewPagePoints = Math.round(liveNewFacesCount * newPageMultiplier * 10) / 10;
  const liveReviewPagePoints = Math.round(liveReviewFacesCount * reviewPageMultiplier * 10) / 10;
  const livePagesTotalPoints = Math.round((liveNewPagePoints + liveReviewPagePoints) * 10) / 10;

  // Points calculated automatically from today's recitation + criteria + attendance
  const calculatedRecitationPoints = useMemo(() => {
    const total = livePagesTotalPoints + liveCriteriaPoints + attendancePoints;
    return Math.max(0, Math.round(total * 10) / 10);
  }, [livePagesTotalPoints, liveCriteriaPoints, attendancePoints]);

  // Dedicated Student Points for Today State (Adjustable by Teacher: - / + / custom)
  const [studentPointsToday, setStudentPointsToday] = useState<number>(0);
  const [isManualPointsModified, setIsManualPointsModified] = useState<boolean>(false);

  // Sync studentPointsToday with calculatedRecitationPoints when not manually overridden
  useEffect(() => {
    if (!isManualPointsModified) {
      setStudentPointsToday(calculatedRecitationPoints);
    }
  }, [calculatedRecitationPoints, isManualPointsModified]);

  const liveTotalPointsToday = studentPointsToday;

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [isGeneratingTomPlan, setIsGeneratingTomPlan] = useState<boolean>(false);

  // Criteria Management Modal state
  const [isManageCriteriaListOpen, setIsManageCriteriaListOpen] = useState(false);
  const [isCriteriaModalOpen, setIsCriteriaModalOpen] = useState(false);
  const [editingCriteriaId, setEditingCriteriaId] = useState<string | null>(null);
  const [critToDelete, setCritToDelete] = useState<EvaluationCriteria | null>(null);
  const [newCritName, setNewCritName] = useState('');
  const [newCritType, setNewCritType] = useState<CriteriaType>('score');
  const [newCritMaxScore, setNewCritMaxScore] = useState<number>(10);
  const [newCritOptions, setNewCritOptions] = useState<string>('ممتاز, جيد جدا, جيد, ضعيف');
  const [newCritPointsWeight, setNewCritPointsWeight] = useState<number>(10);

  // King Fahd Mushaf Viewer Modal State
  const [isMushafOpen, setIsMushafOpen] = useState<boolean>(false);
  const [mushafInitialSurah, setMushafInitialSurah] = useState<number>(78);
  const [mushafInitialAyah, setMushafInitialAyah] = useState<number>(1);
  const [mushafActiveItemId, setMushafActiveItemId] = useState<string>('new_today');
  const [mushafAyahErrors, setMushafAyahErrors] = useState<Record<string, number>>({});

  const handleRecordAyahError = (surah: number, ayah: number, errorCount: number) => {
    const key = `${surah}:${ayah}`;
    setMushafAyahErrors(prev => {
      if (errorCount <= 0) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: errorCount };
    });

    const sInfo = getSurahInfo(surah);
    const surahName = sInfo?.name || `سورة ${surah}`;
    const errorNote = `[رصد خطأ تسميع بالنقر المزدوج ⚡]: سورة ${surahName} الآية ${ayah} (${errorCount} ${errorCount === 1 ? 'خطأ' : 'أخطاء'}).`;

    setTeacherNotes(prev => {
      const cleanPrev = (prev || '').split('\n').filter(line => !line.includes(`سورة ${surahName} الآية ${ayah}`)).join('\n');
      if (errorCount <= 0) return cleanPrev;
      return cleanPrev ? `${cleanPrev}\n• ${errorNote}` : `• ${errorNote}`;
    });
  };

  const openMushafReader = (surah: number, ayah: number, itemId?: string) => {
    setMushafInitialSurah(surah);
    setMushafInitialAyah(ayah);
    if (itemId) setMushafActiveItemId(itemId);
    setIsMushafOpen(true);
  };

  // Metadata Helpers
  const startTodaySurahInfo = getSurahInfo(todayNewSurah);
  const endTodaySurahInfo = getSurahInfo(todayNewToSurah);

  const startTomNewSurahInfo = getSurahInfo(tomNewSurah);
  const endTomNewSurahInfo = getSurahInfo(tomNewToSurah);

  const firstTomRev = tomReviews[0];
  const startTomRevSurahInfo = getSurahInfo(firstTomRev?.surahNumber || 79);
  const endTomRevSurahInfo = getSurahInfo(firstTomRev?.toSurahNumber || firstTomRev?.surahNumber || 79);

  // Dynamic King Fahd Mushaf Highlight Items for the current student & recitation state
  const mushafHighlightItems: QuranHighlightItem[] = useMemo(() => {
    const items: QuranHighlightItem[] = [];

    // 1. Today's New
    items.push({
      id: 'new_today',
      title: `الحفظ الجديد (${startTodaySurahInfo.name} ${todayNewFromAyah}-${todayNewToAyah})`,
      surahNumber: todayNewSurah,
      fromAyah: todayNewFromAyah,
      toSurahNumber: todayNewToSurah,
      toAyah: todayNewToAyah
    });

    // 2. Today's Reviews
    todayReviews.forEach(r => {
      items.push({
        id: r.id,
        title: `${r.type} (${r.surahName || getSurahInfo(r.surahNumber).name} ${r.fromAyah}-${r.toAyah})`,
        surahNumber: r.surahNumber,
        fromAyah: r.fromAyah,
        toSurahNumber: r.toSurahNumber || r.surahNumber,
        toAyah: r.toAyah
      });
    });

    // 3. Tomorrow's New
    items.push({
      id: 'new_tomorrow',
      title: `مقرر الغد جديد (${startTomNewSurahInfo.name} ${tomNewFromAyah}-${tomNewToAyah})`,
      surahNumber: tomNewSurah,
      fromAyah: tomNewFromAyah,
      toSurahNumber: tomNewToSurah,
      toAyah: tomNewToAyah
    });

    // 4. Tomorrow's Reviews
    tomReviews.forEach(r => {
      items.push({
        id: r.id,
        title: `مقرر غد (${r.surahName || getSurahInfo(r.surahNumber).name} ${r.fromAyah}-${r.toAyah})`,
        surahNumber: r.surahNumber,
        fromAyah: r.fromAyah,
        toSurahNumber: r.toSurahNumber || r.surahNumber,
        toAyah: r.toAyah
      });
    });

    return items;
  }, [
    todayNewSurah,
    todayNewFromAyah,
    todayNewToSurah,
    todayNewToAyah,
    startTodaySurahInfo.name,
    todayReviews,
    tomNewSurah,
    tomNewFromAyah,
    tomNewToSurah,
    tomNewToAyah,
    startTomNewSurahInfo.name,
    tomReviews
  ]);

  // All evaluations for the currently active student (sorted latest first)
  const studentEvaluationsHistory = evaluations
    .filter(e => e.studentId === activeStudentId)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Adaptive Monthly Progression Analyzer
  const monthlyProgression = useMemo(() => {
    if (!activeStudent) return null;
    return analyzeMonthlyProgression(
      studentEvaluationsHistory,
      activeStudent.memorizationPlan?.dailyNewPages || 0.5,
      Object.keys(mushafAyahErrors).length
    );
  }, [activeStudent, studentEvaluationsHistory, mushafAyahErrors]);

  const [isUpgradingPace, setIsUpgradingPace] = useState(false);
  const handleUpgradeMonthlyPace = async () => {
    if (!activeStudent || !monthlyProgression?.shouldIncreasePace) return;
    setIsUpgradingPace(true);
    try {
      const newPace = monthlyProgression.recommendedPace;
      const newTargetLabel = newPace === 1.0 ? 'وجه واحد' : newPace === 1.5 ? 'وجه ونصف' : newPace === 2.0 ? 'وجهان' : `${newPace} أوجه`;
      const updatedPortion = calculatePortionFromPace(tomNewSurah, tomNewFromAyah, newPace);
      setTomNewToSurah(updatedPortion.toSurah);
      setTomNewToAyah(updatedPortion.toAyah);

      const updatedStudent: Student = {
        ...activeStudent,
        dailyNewTarget: newTargetLabel,
        memorizationPlan: {
          ...activeStudent.memorizationPlan!,
          dailyNewPages: newPace,
          nextDayAssignment: {
            ...activeStudent.memorizationPlan?.nextDayAssignment!,
            newMemorization: updatedPortion.description
          },
          aiNotes: `🌟 تم ترقية ورد الحفظ بنصف وجه إضافي بفضل التميز والتطور في التسميع الشهري (${newPace} وجه).`,
          lastUpdated: new Date().toISOString()
        }
      };

      await OmranDataService.saveStudent(updatedStudent);
      window.dispatchEvent(new CustomEvent('omran:students-updated', { detail: updatedStudent }));
    } catch (e) {
      console.warn('Upgrade pace notice:', e);
    } finally {
      setIsUpgradingPace(false);
    }
  };

  const [isManualGeneratingPlan, setIsManualGeneratingPlan] = useState(false);
  const handleForceGeneratePlan = async () => {
    if (!activeStudent) return;
    setIsManualGeneratingPlan(true);
    try {
      const pace = activeStudent.memorizationPlan?.dailyNewPages ||
        (activeStudent.dailyNewTarget?.includes('وجهين') ? 2.0 :
         activeStudent.dailyNewTarget?.includes('ربع') ? 0.25 :
         activeStudent.dailyNewTarget?.includes('وجه واحد') ? 1.0 : 0.5);

      const sNum = activeStudent.currentSurah || 78;
      const sAyah = activeStudent.currentAyah || 1;
      const initialPortion = calculatePortionFromPace(sNum, sAyah, pace);

      let aiPlanObj: any = null;
      let aiPortion = initialPortion;

      try {
        const res = await fetch(ApiConfig.getEndpoint('/api/gemini/generate-plan'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student: activeStudent })
        });
        if (res.ok) {
          const data = await res.json();
          aiPlanObj = data?.plan;
          aiPortion = data?.portion || initialPortion;
        }
      } catch (e) {
        console.warn('Manual plan generation notice:', e);
      }

      const updatedStd: Student = {
        ...activeStudent,
        isGeneratingPlan: false,
        aiPlan: aiPlanObj ? {
          ...aiPlanObj,
          lastUpdated: new Date().toISOString()
        } : activeStudent.aiPlan,
        memorizationPlan: {
          ...activeStudent.memorizationPlan!,
          dailyNewPages: pace,
          nextDayAssignment: {
            ...activeStudent.memorizationPlan?.nextDayAssignment!,
            newMemorization: aiPlanObj?.currentDailyAssignment?.newMemorization || aiPortion.description,
            review: aiPlanObj?.currentDailyAssignment?.review || activeStudent.memorizationPlan?.nextDayAssignment?.review || 'مراجعة وتثبيت المحفوظ',
            suggestedSheikh: aiPlanObj?.currentDailyAssignment?.suggestedSheikh || 'الشيخ محمود خليل الحصري',
            surahNumber: aiPortion.fromSurah,
            fromAyah: aiPortion.fromAyah,
            toSurahNumber: aiPortion.toSurah,
            toAyah: aiPortion.toAyah
          },
          aiNotes: aiPlanObj?.roadmapSummary || activeStudent.memorizationPlan?.aiNotes,
          lastUpdated: new Date().toISOString()
        }
      };

      await OmranDataService.saveStudent(updatedStd);
      window.dispatchEvent(new CustomEvent('omran:student-plan-ready', { detail: updatedStd }));
      window.dispatchEvent(new CustomEvent('omran:students-updated', { detail: updatedStd }));

      setTodayNewSurah(aiPortion.fromSurah);
      setTodayNewFromAyah(aiPortion.fromAyah);
      setTodayNewToSurah(aiPortion.toSurah);
      setTodayNewToAyah(aiPortion.toAyah);

      const toInfo = getSurahInfo(aiPortion.toSurah);
      let nextS = aiPortion.toSurah;
      let nextA = aiPortion.toAyah + 1;
      if (nextA > toInfo.numberOfAyahs) {
        nextS = aiPortion.toSurah < 114 ? aiPortion.toSurah + 1 : 1;
        nextA = 1;
      }
      const tomPortion = calculatePortionFromPace(nextS, nextA, pace);
      setTomNewSurah(tomPortion.fromSurah);
      setTomNewFromAyah(tomPortion.fromAyah);
      setTomNewToSurah(tomPortion.toSurah);
      setTomNewToAyah(tomPortion.toAyah);

      setAutoFilledNotice(`✨ تم إعداد واعتماد خطة الطالب القرآنية بنجاح: ${aiPortion.description}`);
    } catch (e) {
      console.error('Error generating plan manually:', e);
    } finally {
      setIsManualGeneratingPlan(false);
    }
  };

  // Listen for plan-ready event when background AI finishes student initial plan
  useEffect(() => {
    const handlePlanReady = (e: any) => {
      const updatedStd = e.detail as Student;
      if (updatedStd && activeStudent && updatedStd.id === activeStudent.id) {
        const planAssignment = updatedStd.memorizationPlan?.nextDayAssignment;
        if (planAssignment?.surahNumber) {
          const fromS = planAssignment.surahNumber;
          const fromA = planAssignment.fromAyah || 1;
          const toS = planAssignment.toSurahNumber || planAssignment.surahNumber;
          const toA = planAssignment.toAyah || 10;
          setTodayNewSurah(fromS);
          setTodayNewFromAyah(fromA);
          setTodayNewToSurah(toS);
          setTodayNewToAyah(toA);

          const toInfo = getSurahInfo(toS);
          let nextS = toS;
          let nextA = toA + 1;
          if (nextA > toInfo.numberOfAyahs) {
            nextS = toS < 114 ? toS + 1 : 1;
            nextA = 1;
          }
          const pace = updatedStd.memorizationPlan?.dailyNewPages || 0.5;
          const tomPortion = calculatePortionFromPace(nextS, nextA, pace);
          setTomNewSurah(tomPortion.fromSurah);
          setTomNewFromAyah(tomPortion.fromAyah);
          setTomNewToSurah(tomPortion.toSurah);
          setTomNewToAyah(tomPortion.toAyah);

          setAutoFilledNotice(`✨ اكتملت خطة الذكاء الاصطناعي بنجاح: ${planAssignment.newMemorization}`);
        }
      }
    };
    window.addEventListener('omran:student-plan-ready', handlePlanReady);
    return () => window.removeEventListener('omran:student-plan-ready', handlePlanReady);
  }, [activeStudent?.id]);

  // Initialize or load student evaluation when active student or selected date changes
  useEffect(() => {
    if (!activeStudent) return;
    setAutoFilledNotice('');

    // If student has no plan at all, automatically trigger background AI plan generation
    if (!activeStudent.memorizationPlan && !activeStudent.aiPlan && !activeStudent.isGeneratingPlan && !isManualGeneratingPlan) {
      handleForceGeneratePlan();
      return;
    }

    // 1. Check if an evaluation already exists for the selectedDate
    const existing = evaluations.find(
      e => e.date === selectedDate && e.studentId === activeStudent.id
    );

    if (existing) {
      setCriteriaValues(existing.criteriaValues || {});
      setTeacherNotes(existing.recitationDetails?.teacherNotes || '');

      // Load today's new item
      if (existing.recitationDetails?.todayNewItem) {
        const item = existing.recitationDetails.todayNewItem;
        const sNum = item.surahNumber || 78;
        const toSNum = item.toSurahNumber || sNum;
        setTodayNewSurah(sNum);
        setTodayNewFromAyah(item.fromAyah || 1);
        setTodayNewToSurah(toSNum);
        setTodayNewToAyah(item.toAyah || 10);
        setTodayNewDidNotRecite(!!item.didNotRecite);
        setTodayNewDidNotReciteReason(item.didNotReciteReason || '');
      } else {
        setTodayNewDidNotRecite(false);
        setTodayNewDidNotReciteReason('');
      }

      // Load today's review items
      if (existing.recitationDetails?.todayReviewItems && existing.recitationDetails.todayReviewItems.length > 0) {
        setTodayReviews(existing.recitationDetails.todayReviewItems);
      }

      // Load tomorrow's assignment recorded on that day
      if (existing.recitationDetails?.tomorrowNewItem) {
        const tNew = existing.recitationDetails.tomorrowNewItem;
        const sNum = tNew.surahNumber || 78;
        const toSNum = tNew.toSurahNumber || sNum;
        setTomNewSurah(sNum);
        setTomNewFromAyah(tNew.fromAyah || 1);
        setTomNewToSurah(toSNum);
        setTomNewToAyah(tNew.toAyah || 10);
      }
      if (existing.recitationDetails?.tomorrowReviewItems && existing.recitationDetails.tomorrowReviewItems.length > 0) {
        setTomReviews(existing.recitationDetails.tomorrowReviewItems);
      } else if (existing.recitationDetails?.tomorrowReviewItem) {
        setTomReviews([existing.recitationDetails.tomorrowReviewItem]);
      }
      if (existing.recitationDetails?.tomorrowSuggestedSheikh) {
        setSelectedSheikh(existing.recitationDetails.tomorrowSuggestedSheikh);
      }
      if (existing.recitationDetails?.tomorrowTargetRepetitions !== undefined) {
        setTargetRepetitions(existing.recitationDetails.tomorrowTargetRepetitions);
      }
      if (existing.recitationDetails?.tomorrowDailyNote) {
        setDailyHomeNote(existing.recitationDetails.tomorrowDailyNote);
      }
      if (existing.recitationDetails?.pointsEarnedToday !== undefined) {
        setStudentPointsToday(existing.recitationDetails.pointsEarnedToday);
        setIsManualPointsModified(true);
      } else {
        setIsManualPointsModified(false);
      }
    } else {
      setIsManualPointsModified(false);
      // 2. No evaluation exists for this date yet!
      if (activeStudent.activeListeningAssignment?.requiredRepetitions !== undefined) {
        setTargetRepetitions(activeStudent.activeListeningAssignment.requiredRepetitions);
      } else if (activeStudent.aiPlan?.currentDailyAssignment?.targetRepetitions !== undefined) {
        setTargetRepetitions(activeStudent.aiPlan.currentDailyAssignment.targetRepetitions);
      }
      if (activeStudent.activeListeningAssignment?.sheikhName) {
        setSelectedSheikh(activeStudent.activeListeningAssignment.sheikhName);
      } else if (activeStudent.aiPlan?.currentDailyAssignment?.suggestedSheikh) {
        setSelectedSheikh(activeStudent.aiPlan.currentDailyAssignment.suggestedSheikh);
      }
      setTodayNewDidNotRecite(false);
      setTodayNewDidNotReciteReason('');

      // Check for the LAST ACTUAL recitation record before selectedDate,
      // intentionally bypassing empty days, unexpected trips, or sudden holidays!
      const actualPastEvals = evaluations
        .filter(e => e.studentId === activeStudent.id && e.date < selectedDate && (
          e.recitationDetails?.tomorrowNewItem ||
          e.recitationDetails?.todayNewItem ||
          e.recitationDetails?.newMemorizationAchieved
        ))
        .sort((a, b) => b.date.localeCompare(a.date));

      const latestActualRecord = actualPastEvals[0];

      // If in previous record student DID NOT recite, re-assign the exact same portion today
      if (latestActualRecord && latestActualRecord.recitationDetails?.todayNewItem?.didNotRecite) {
        const unrecited = latestActualRecord.recitationDetails.todayNewItem;
        const sNum = unrecited.surahNumber || 78;
        const toSNum = unrecited.toSurahNumber || sNum;
        const fAyah = unrecited.fromAyah || 1;
        const tAyah = unrecited.toAyah || 10;

        setTodayNewSurah(sNum);
        setTodayNewFromAyah(fAyah);
        setTodayNewToSurah(toSNum);
        setTodayNewToAyah(tAyah);

        setAutoFilledNotice(`تم تثبيت نفس الورد المقرر ليوم (${latestActualRecord.date}) نظراً لعدم تسميع الطالب له سابقاً: ${getSurahInfo(sNum).name} (${fAyah}-${tAyah})`);

        // Tomorrow new also set to repeat until recited
        setTomNewSurah(sNum);
        setTomNewFromAyah(fAyah);
        setTomNewToSurah(toSNum);
        setTomNewToAyah(tAyah);

        // Load reviews
        const prevReviews = latestActualRecord.recitationDetails?.tomorrowReviewItems ||
          latestActualRecord.recitationDetails?.todayReviewItems ||
          activeStudent.persistentReviewItems;
        if (prevReviews && prevReviews.length > 0) {
          setTodayReviews(prevReviews.map((r, idx) => ({ ...r, id: `rev_${Date.now()}_${idx}`, didNotRecite: false, didNotReciteReason: undefined })));
          setTomReviews(prevReviews.map((r, idx) => ({ ...r, id: `tom_rev_${Date.now()}_${idx}` })));
        }
      } else if (latestActualRecord && latestActualRecord.recitationDetails?.tomorrowNewItem) {
        // AUTOMATIC PLAN LOADING FROM LAST ACTUAL RECORD'S PLANNED TOMORROW!
        const yNew = latestActualRecord.recitationDetails.tomorrowNewItem;
        const sNum = yNew.surahNumber || 78;
        const toSNum = yNew.toSurahNumber || sNum;
        const fAyah = yNew.fromAyah || 1;
        const tAyah = yNew.toAyah || 10;

        setTodayNewSurah(sNum);
        setTodayNewFromAyah(fAyah);
        setTodayNewToSurah(toSNum);
        setTodayNewToAyah(tAyah);

        const loadedPortionText = formatQuranPortion(
          getSurahInfo(sNum).name,
          fAyah,
          tAyah,
          getSurahInfo(sNum).numberOfAyahs,
          'حفظ جديد',
          getSurahInfo(toSNum).name,
          getSurahInfo(toSNum).numberOfAyahs
        );

        setAutoFilledNotice(`تم ضبط المقرر تلقائياً بناءً على آخر تسجيل تسميع للطالب بتاريخ (${latestActualRecord.date}): ${loadedPortionText}`);

        // Load review items: if tomorrowReviewItems existed in last record, or student's persistentReviewItems
        const loadedReviews = latestActualRecord.recitationDetails?.tomorrowReviewItems ||
          (latestActualRecord.recitationDetails?.tomorrowReviewItem ? [latestActualRecord.recitationDetails.tomorrowReviewItem] : null) ||
          activeStudent.persistentReviewItems;

        if (loadedReviews && loadedReviews.length > 0) {
          setTodayReviews(loadedReviews.map((r, idx) => ({
            ...r,
            id: `rev_auto_${Date.now()}_${idx}`,
            didNotRecite: false,
            didNotReciteReason: undefined
          })));

          // Prepare tomorrow's reviews by advancing any cumulative review automatically!
          setTomReviews(loadedReviews.map((r, idx) => {
            if (r.type === 'مراجعة تراكمية') {
              const itemSurah = r.toSurahNumber || r.surahNumber;
              const itemAyah = r.toAyah;
              const sInfo = getSurahInfo(itemSurah);
              const revStep = 15;
              if (itemAyah < sInfo.numberOfAyahs) {
                return {
                  ...r,
                  id: `tom_rev_${Date.now()}_${idx}`,
                  fromAyah: itemAyah + 1,
                  toAyah: Math.min(itemAyah + revStep, sInfo.numberOfAyahs),
                  isFullSurah: false
                };
              } else {
                const nextS = itemSurah < 114 ? itemSurah + 1 : 1;
                const nextInfo = getSurahInfo(nextS);
                return {
                  ...r,
                  id: `tom_rev_${Date.now()}_${idx}`,
                  surahNumber: nextS,
                  surahName: nextInfo.name,
                  fromAyah: 1,
                  toSurahNumber: nextS,
                  toSurahName: nextInfo.name,
                  toAyah: Math.min(revStep, nextInfo.numberOfAyahs),
                  isFullSurah: revStep >= nextInfo.numberOfAyahs
                };
              }
            }
            return {
              ...r,
              id: `tom_rev_${Date.now()}_${idx}`
            };
          }));
        }

        // Auto-calculate tomorrow's continuation step using exact Medina portion
        const toSurahInfo = getSurahInfo(toSNum);
        const studentPace = activeStudent.memorizationPlan?.dailyNewPages || 
          (activeStudent.dailyNewTarget?.includes('وجهين') ? 2.0 :
           activeStudent.dailyNewTarget?.includes('ربع') ? 0.25 :
           activeStudent.dailyNewTarget?.includes('وجه واحد') ? 1.0 : 0.5);

        let nextStartS = toSNum;
        let nextStartA = tAyah + 1;
        if (nextStartA > toSurahInfo.numberOfAyahs) {
          nextStartS = toSNum < 114 ? toSNum + 1 : 1;
          nextStartA = 1;
        }

        const tomPortion = calculatePortionFromPace(nextStartS, nextStartA, studentPace);
        setTomNewSurah(tomPortion.fromSurah);
        setTomNewFromAyah(tomPortion.fromAyah);
        setTomNewToSurah(tomPortion.toSurah);
        setTomNewToAyah(tomPortion.toAyah);
      } else if (latestActualRecord && latestActualRecord.recitationDetails?.todayNewItem) {
        // Fallback to continuing directly from what student recited on their last active recitation session
        const lastRecited = latestActualRecord.recitationDetails.todayNewItem;
        const curSurah = lastRecited.toSurahNumber || lastRecited.surahNumber || 78;
        const lastAyah = lastRecited.toAyah || 1;
        const curSurahInfo = getSurahInfo(curSurah);
        const studentPace = activeStudent.memorizationPlan?.dailyNewPages || 
          (activeStudent.dailyNewTarget?.includes('وجهين') ? 2.0 :
           activeStudent.dailyNewTarget?.includes('ربع') ? 0.25 :
           activeStudent.dailyNewTarget?.includes('وجه واحد') ? 1.0 : 0.5);

        let startS = curSurah;
        let startA = lastAyah + 1;
        if (startA > curSurahInfo.numberOfAyahs) {
          startS = curSurah < 114 ? curSurah + 1 : 1;
          startA = 1;
        }

        const portion = calculatePortionFromPace(startS, startA, studentPace);
        startS = portion.fromSurah;
        startA = portion.fromAyah;
        const endS = portion.toSurah;
        const endA = portion.toAyah;

        setTodayNewSurah(startS);
        setTodayNewFromAyah(startA);
        setTodayNewToSurah(endS);
        setTodayNewToAyah(endA);

        const loadedPortionText = formatQuranPortion(
          getSurahInfo(startS).name,
          startA,
          endA,
          getSurahInfo(startS).numberOfAyahs,
          'حفظ جديد',
          getSurahInfo(endS).name,
          getSurahInfo(endS).numberOfAyahs
        );

        setAutoFilledNotice(`تم ضبط المقرر تلقائياً استناداً إلى آخر جلسة تسميع مسجلة بتاريخ (${latestActualRecord.date}): ${loadedPortionText}`);

        // Set tomorrow from today using exact Medina portion
        const endInfo = getSurahInfo(endS);

        let nextS = endS;
        let nextA = endA + 1;
        if (nextA > endInfo.numberOfAyahs) {
          nextS = endS < 114 ? endS + 1 : 1;
          nextA = 1;
        }

        const tomPortion = calculatePortionFromPace(nextS, nextA, studentPace);
        setTomNewSurah(tomPortion.fromSurah);
        setTomNewFromAyah(tomPortion.fromAyah);
        setTomNewToSurah(tomPortion.toSurah);
        setTomNewToAyah(tomPortion.toAyah);

        setTomReviews([
          {
            id: `tom_rev_${Date.now()}`,
            type: REVIEW_TYPES[0],
            surahNumber: startS,
            surahName: getSurahInfo(startS).name,
            fromAyah: startA,
            toSurahNumber: endS,
            toSurahName: endInfo.name,
            toAyah: endA,
            isFullSurah: false
          }
        ]);
      } else {
        // Check if student has an active AI Plan or Memorization Plan first!
        const aiAssignment = activeStudent.aiPlan?.currentDailyAssignment;
        const planAssignment = activeStudent.memorizationPlan?.nextDayAssignment;
        
        let todayStartS = activeStudent.currentSurah || 78;
        let todayStartA = activeStudent.currentAyah || 1;
        let todayEndS = todayStartS;
        let todayEndA = 10;
        let planNotice = '';

        if (planAssignment?.surahNumber) {
          todayStartS = planAssignment.surahNumber;
          todayStartA = planAssignment.fromAyah || 1;
          todayEndS = planAssignment.toSurahNumber || todayStartS;
          todayEndA = planAssignment.toAyah || 10;
          const sInfo = getSurahInfo(todayStartS);
          const toInfo = getSurahInfo(todayEndS);
          const loadedText = formatQuranPortion(sInfo.name, todayStartA, todayEndA, sInfo.numberOfAyahs, 'حفظ جديد', toInfo.name, toInfo.numberOfAyahs);
          planNotice = `✨ تم تحميل وتجهيز ورد اليوم ومقرر الغد بنجاح وفق الخطة المنهجية للطالب: ${loadedText}`;
        } else if (aiAssignment?.newItem) {
          todayStartS = aiAssignment.newItem.surahNumber || activeStudent.currentSurah || 78;
          todayStartA = aiAssignment.newItem.fromAyah || activeStudent.currentAyah || 1;
          todayEndS = aiAssignment.newItem.toSurahNumber || todayStartS;
          todayEndA = aiAssignment.newItem.toAyah || (todayStartA + 7);
          const sInfo = getSurahInfo(todayStartS);
          const toInfo = getSurahInfo(todayEndS);
          const loadedText = formatQuranPortion(sInfo.name, todayStartA, todayEndA, sInfo.numberOfAyahs, 'حفظ جديد', toInfo.name, toInfo.numberOfAyahs);
          planNotice = `تم تحميل وتجهيز ورد اليوم ومقرر الغد مباشرة من الخطة القرآنية الذكية للطالب: ${loadedText}`;
        } else {
          // Precise King Fahd Medina Mushaf portion calculation
          todayStartS = activeStudent.currentSurah || 78;
          todayStartA = activeStudent.currentAyah || 1;
          const studentPace = activeStudent.memorizationPlan?.dailyNewPages || 
            (activeStudent.dailyNewTarget?.includes('وجهين') ? 2.0 :
             activeStudent.dailyNewTarget?.includes('ربع') ? 0.25 :
             activeStudent.dailyNewTarget?.includes('وجه واحد') ? 1.0 : 0.5);

          const portion = calculatePortionFromPace(todayStartS, todayStartA, studentPace);
          todayStartS = portion.fromSurah;
          todayStartA = portion.fromAyah;
          todayEndS = portion.toSurah;
          todayEndA = portion.toAyah;
          planNotice = `تم ضبط وتجهيز ورد اليوم ومقرر الغد بدقة مصحف المدينة وفق خطة الطالب (${portion.description})`;
        }

        // Apply Today's New
        setTodayNewSurah(todayStartS);
        setTodayNewFromAyah(todayStartA);
        setTodayNewToSurah(todayEndS);
        setTodayNewToAyah(todayEndA);
        setAutoFilledNotice(planNotice);

        // Apply Tomorrow's New (Continuous sequential progression using exact Medina portion)
        const curEndInfo = getSurahInfo(todayEndS);
        const studentPace = activeStudent.memorizationPlan?.dailyNewPages || 
          (activeStudent.dailyNewTarget?.includes('وجهين') ? 2.0 :
           activeStudent.dailyNewTarget?.includes('ربع') ? 0.25 :
           activeStudent.dailyNewTarget?.includes('وجه واحد') ? 1.0 : 0.5);

        let tomStartS = todayEndS;
        let tomStartA = todayEndA + 1;
        if (tomStartA > curEndInfo.numberOfAyahs) {
          tomStartS = todayEndS < 114 ? todayEndS + 1 : 1;
          tomStartA = 1;
        }

        const tomPortion = calculatePortionFromPace(tomStartS, tomStartA, studentPace);
        setTomNewSurah(tomPortion.fromSurah);
        setTomNewFromAyah(tomPortion.fromAyah);
        setTomNewToSurah(tomPortion.toSurah);
        setTomNewToAyah(tomPortion.toAyah);

        // Reviews for Today and Tomorrow
        if (activeStudent.persistentReviewItems && activeStudent.persistentReviewItems.length > 0) {
          setTodayReviews(activeStudent.persistentReviewItems.map((r, idx) => ({ ...r, id: `rev_${Date.now()}_${idx}` })));
          setTomReviews(activeStudent.persistentReviewItems.map((r, idx) => ({ ...r, id: `tom_rev_${Date.now()}_${idx}` })));
        } else if (aiAssignment?.reviewItems && aiAssignment.reviewItems.length > 0) {
          setTodayReviews(aiAssignment.reviewItems.map((r, idx) => ({ ...r, id: `rev_plan_${Date.now()}_${idx}` })));
          setTomReviews(aiAssignment.reviewItems.map((r, idx) => ({ ...r, id: `tom_plan_${Date.now()}_${idx}` })));
        } else {
          const revS = todayStartS < 114 ? todayStartS + 1 : 113;
          const revInfo = getSurahInfo(revS);
          setTodayReviews([
            {
              id: `rev_${Date.now()}`,
              type: REVIEW_TYPES[0],
              surahNumber: revS,
              surahName: revInfo.name,
              fromAyah: 1,
              toSurahNumber: revS,
              toSurahName: revInfo.name,
              toAyah: revInfo.numberOfAyahs,
              isFullSurah: true
            }
          ]);
          setTomReviews([
            {
              id: `tom_rev_${Date.now()}`,
              type: REVIEW_TYPES[0],
              surahNumber: todayStartS,
              surahName: getSurahInfo(todayStartS).name,
              fromAyah: todayStartA,
              toSurahNumber: todayEndS,
              toSurahName: curEndInfo.name,
              toAyah: todayEndA,
              isFullSurah: todayStartS === todayEndS && todayStartA === 1 && todayEndA >= curEndInfo.numberOfAyahs,
              notes: 'سرد ومراجعة ما تم حفظه اليوم لتثبيته في الصدر'
            }
          ]);
        }
      }

      // Initialize criteria defaults
      const defaults: Record<string, any> = {};
      criteria.forEach(c => {
        if (c.type === 'stars') defaults[c.id] = 5;
        if (c.type === 'score') defaults[c.id] = c.maxScore || 10;
        if (c.type === 'options' && c.options && c.options.length > 0) defaults[c.id] = c.options[0];
        if (c.type === 'text') defaults[c.id] = '';
      });
      setCriteriaValues(defaults);
      setTeacherNotes('أداء طيب ومتقن ما شاء الله، نسأل الله له التوفيق والرفعة.');
    }
  }, [activeStudentId, selectedDate, evaluations, criteria]);

  // Date Navigation Helpers
  const handleDateShift = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const getYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  };

  const getDayBeforeYesterdayStr = () => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return d.toISOString().split('T')[0];
  };

  // Synchronize Tomorrow's New Portion from Today's recitation range
  const recalculateTomorrowFromToday = (
    fromS: number,
    fromA: number,
    toS: number,
    toA: number,
    didNotRecite: boolean
  ) => {
    if (didNotRecite) {
      setTomNewSurah(fromS);
      setTomNewFromAyah(fromA);
      setTomNewToSurah(toS);
      setTomNewToAyah(toA);
      return;
    }
    const curEndInfo = getSurahInfo(toS);
    let nextStartS = toS;
    let nextStartA = toA + 1;
    if (nextStartA > curEndInfo.numberOfAyahs) {
      nextStartS = toS < 114 ? toS + 1 : 1;
      nextStartA = 1;
    }
    const pace = activeStudent?.memorizationPlan?.dailyNewPages ||
      (activeStudent?.dailyNewTarget?.includes('وجهين') ? 2.0 :
       activeStudent?.dailyNewTarget?.includes('ربع') ? 0.25 :
       activeStudent?.dailyNewTarget?.includes('وجه واحد') ? 1.0 : 0.5);

    const tomPortion = calculatePortionFromPace(nextStartS, nextStartA, pace);
    setTomNewSurah(tomPortion.fromSurah);
    setTomNewFromAyah(tomPortion.fromAyah);
    setTomNewToSurah(tomPortion.toSurah);
    setTomNewToAyah(tomPortion.toAyah);

    // Automatically set tomorrow's review to include today's recited portion for reinforcement
    const fromInfo = getSurahInfo(fromS);
    const toInfo = getSurahInfo(toS);
    setTomReviews([
      {
        id: `tom_rev_${Date.now()}`,
        type: 'مراجعة صغرى',
        surahNumber: fromS,
        surahName: fromInfo.name,
        fromAyah: fromA,
        toSurahNumber: toS,
        toSurahName: toInfo.name,
        toAyah: toA,
        isFullSurah: false,
        notes: 'تثبيت ومراجعة ما تم حفظه وتسميعه اليوم في الصدر'
      }
    ]);
  };

  // Handlers for Today's New
  const handleTodayStartSurahChange = (surahNum: number) => {
    setTodayNewSurah(surahNum);
    setTodayNewFromAyah(1);
    const studentPace = activeStudent?.memorizationPlan?.dailyNewPages ||
      (activeStudent?.dailyNewTarget?.includes('وجهين') ? 2.0 :
       activeStudent?.dailyNewTarget?.includes('ربع') ? 0.25 :
       activeStudent?.dailyNewTarget?.includes('وجه واحد') ? 1.0 : 0.5);
    const portion = calculatePortionFromPace(surahNum, 1, studentPace);
    setTodayNewToSurah(portion.toSurah);
    setTodayNewToAyah(portion.toAyah);
    recalculateTomorrowFromToday(surahNum, 1, portion.toSurah, portion.toAyah, todayNewDidNotRecite);
  };

  const handleTodayEndSurahChange = (surahNum: number) => {
    setTodayNewToSurah(surahNum);
    const info = getSurahInfo(surahNum);
    const targetToAyah = Math.min(todayNewToAyah, info.numberOfAyahs);
    setTodayNewToAyah(targetToAyah);
    recalculateTomorrowFromToday(todayNewSurah, todayNewFromAyah, surahNum, targetToAyah, todayNewDidNotRecite);
  };

  // Handlers for Tomorrow's New
  const handleTomNewStartSurahChange = (surahNum: number) => {
    setTomNewSurah(surahNum);
    setTomNewFromAyah(1);
    const studentPace = activeStudent?.memorizationPlan?.dailyNewPages || 0.5;
    const portion = calculatePortionFromPace(surahNum, 1, studentPace);
    setTomNewToSurah(portion.toSurah);
    setTomNewToAyah(portion.toAyah);
  };

  const handleTomNewEndSurahChange = (surahNum: number) => {
    setTomNewToSurah(surahNum);
    const info = getSurahInfo(surahNum);
    setTomNewToAyah(Math.min(tomNewToAyah, info.numberOfAyahs));
  };

  // Add Review Item for Today
  const handleAddReviewItem = () => {
    const defaultSurahNum = 114;
    const info = getSurahInfo(defaultSurahNum);
    const newItem: QuranRecitationItem = {
      id: `rev_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type: REVIEW_TYPES[2] || 'مراجعة تراكمية',
      surahNumber: defaultSurahNum,
      surahName: info.name,
      fromAyah: 1,
      toSurahNumber: defaultSurahNum,
      toSurahName: info.name,
      toAyah: info.numberOfAyahs,
      isFullSurah: true
    };
    setTodayReviews(prev => [...prev, newItem]);
  };

  // Update Review Item for Today
  const handleUpdateReviewItem = (id: string, updates: Partial<QuranRecitationItem>) => {
    setTodayReviews(prev =>
      prev.map(item => {
        if (item.id === id) {
          const updated = { ...item, ...updates };
          if (updates.surahNumber !== undefined) {
            const sInfo = getSurahInfo(updates.surahNumber);
            updated.surahName = sInfo.name;
            updated.fromAyah = 1;
            if (updated.toSurahNumber === undefined || updated.toSurahNumber === item.surahNumber) {
              updated.toSurahNumber = updates.surahNumber;
              updated.toSurahName = sInfo.name;
              updated.toAyah = sInfo.numberOfAyahs;
            }
          }
          if (updates.toSurahNumber !== undefined) {
            const toSInfo = getSurahInfo(updates.toSurahNumber);
            updated.toSurahName = toSInfo.name;
            updated.toAyah = toSInfo.numberOfAyahs;
          }
          return updated;
        }
        return item;
      })
    );
  };

  // Remove Review Item for Today
  const handleRemoveReviewItem = (id: string) => {
    setTodayReviews(prev => prev.filter(item => item.id !== id));
  };

  // Add Review Item for Tomorrow
  const handleAddTomReviewItem = () => {
    const defaultSurahNum = 114;
    const info = getSurahInfo(defaultSurahNum);
    const newItem: QuranRecitationItem = {
      id: `tom_rev_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type: REVIEW_TYPES[2] || 'مراجعة تراكمية',
      surahNumber: defaultSurahNum,
      surahName: info.name,
      fromAyah: 1,
      toSurahNumber: defaultSurahNum,
      toSurahName: info.name,
      toAyah: info.numberOfAyahs,
      isFullSurah: true
    };
    setTomReviews(prev => [...prev, newItem]);
  };

  // Update Review Item for Tomorrow
  const handleUpdateTomReviewItem = (id: string, updates: Partial<QuranRecitationItem>) => {
    setTomReviews(prev =>
      prev.map(item => {
        if (item.id === id) {
          const updated = { ...item, ...updates };
          if (updates.surahNumber !== undefined) {
            const sInfo = getSurahInfo(updates.surahNumber);
            updated.surahName = sInfo.name;
            updated.fromAyah = 1;
            if (updated.toSurahNumber === undefined || updated.toSurahNumber === item.surahNumber) {
              updated.toSurahNumber = updates.surahNumber;
              updated.toSurahName = sInfo.name;
              updated.toAyah = sInfo.numberOfAyahs;
            }
          }
          if (updates.toSurahNumber !== undefined) {
            const toSInfo = getSurahInfo(updates.toSurahNumber);
            updated.toSurahName = toSInfo.name;
            updated.toAyah = toSInfo.numberOfAyahs;
          }
          return updated;
        }
        return item;
      })
    );
  };

  // Remove Review Item for Tomorrow
  const handleRemoveTomReviewItem = (id: string) => {
    setTomReviews(prev => prev.filter(item => item.id !== id));
  };

  // AI-Powered Tomorrow Plan Generator
  const handleGenerateTomorrowPlanWithAI = async () => {
    if (!activeStudent) return;
    setIsGeneratingTomPlan(true);

    try {
      // 1. Compile today's error list from Mushaf clicks
      const errorsList = Object.entries(mushafAyahErrors).map(([key, count]) => {
        const [s, a] = key.split(':').map(Number);
        return {
          surahNumber: s,
          ayahNumber: a,
          errorCount: count,
          surahName: getSurahInfo(s).name
        };
      });

      const halaqahHours = activeStudent.memorizationPlan?.dailyHoursCount || 2.0;

      const payload = {
        student: activeStudent,
        todayEvaluation: {
          todayNewSurah,
          todayNewSurahName: startTodaySurahInfo.name,
          todayNewFromAyah,
          todayNewToSurah,
          todayNewToSurahName: endTodaySurahInfo.name,
          todayNewToAyah,
          didNotRecite: todayNewDidNotRecite,
          todayReviewsSummary: todayReviews.map(r => `${r.type}: ${r.surahName} (${r.fromAyah}-${r.toAyah})`).join('، ')
        },
        ayahErrors: errorsList,
        evaluationsHistory: studentEvaluationsHistory.slice(0, 5),
        halaqahDailyHours: halaqahHours
      };

      let result: any = null;
      try {
        const res = await fetch(ApiConfig.getEndpoint('/api/gemini/generate-tomorrow-plan'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          result = await res.json();
        }
      } catch (e) {
        console.warn('Backend tomorrow plan call note, using local engine:', e);
      }

      if (result && result.tomNewSurah) {
        setTomNewSurah(Number(result.tomNewSurah));
        setTomNewFromAyah(Number(result.tomNewFromAyah) || 1);
        setTomNewToSurah(Number(result.tomNewToSurah) || Number(result.tomNewSurah));
        setTomNewToAyah(Number(result.tomNewToAyah) || 10);

        if (Array.isArray(result.tomReviews) && result.tomReviews.length > 0) {
          setTomReviews(result.tomReviews.map((r: any, idx: number) => {
            const sInfo = getSurahInfo(Number(r.surahNumber) || 78);
            const toInfo = getSurahInfo(Number(r.toSurahNumber) || Number(r.surahNumber) || 78);
            return {
              id: r.id || `tom_rev_ai_${Date.now()}_${idx}`,
              type: r.type || 'مراجعة صغرى',
              surahNumber: Number(r.surahNumber) || 78,
              surahName: r.surahName || sInfo.name,
              fromAyah: Number(r.fromAyah) || 1,
              toSurahNumber: Number(r.toSurahNumber) || Number(r.surahNumber) || 78,
              toSurahName: r.toSurahName || toInfo.name,
              toAyah: Number(r.toAyah) || sInfo.numberOfAyahs,
              isFullSurah: !!r.isFullSurah,
              notes: r.note || ''
            };
          }));
        }

        const rationale = result.rationale || 'تم وضع خطة غد لضمان التثبيت والإتقان وفق زمن وتوقيت الحلقة.';
        setAutoFilledNotice(`✨ تم وضع خطة غد بالذكاء الاصطناعي: ${rationale}`);
        setTeacherNotes(prev => {
          const aiNote = `[خطة الغد بالذكاء الاصطناعي 🌟]: ${rationale}`;
          const cleanPrev = (prev || '').split('\n').filter(line => !line.includes('[خطة الغد بالذكاء الاصطناعي')).join('\n');
          return cleanPrev ? `${cleanPrev}\n• ${aiNote}` : `• ${aiNote}`;
        });
      } else {
        runLocalPedagogicalTomorrowPlan(errorsList, halaqahHours);
      }

      confetti({
        particleCount: 50,
        spread: 65,
        origin: { y: 0.6 }
      });
    } catch (err: any) {
      console.error('Error generating tomorrow plan:', err);
    } finally {
      setIsGeneratingTomPlan(false);
    }
  };

  const runLocalPedagogicalTomorrowPlan = (
    errorsList: Array<{ surahNumber: number; ayahNumber: number; errorCount: number; surahName: string }>,
    halaqahHours: number
  ) => {
    const curEndSurah = todayNewToSurah;
    const curEndAyah = todayNewToAyah;
    const endSurahInfo = getSurahInfo(curEndSurah);

    let targetTomSurah = curEndSurah;
    let targetTomFromAyah = 1;
    let targetTomToSurah = curEndSurah;
    let targetTomToAyah = curEndAyah;
    let rationale = '';

    if (todayNewDidNotRecite) {
      targetTomSurah = todayNewSurah;
      targetTomFromAyah = todayNewFromAyah;
      targetTomToSurah = todayNewToSurah;
      targetTomToAyah = todayNewToAyah;
      rationale = 'نظراً لتعذر التسميع اليوم، تقرر تثبيت وإبقاء نفس الورد لمجلس الغد لضبطه وحفظه أولاً قبل مراكمة حفظ جديد.';
    } else if (errorsList.length >= 2) {
      targetTomSurah = curEndSurah;
      targetTomFromAyah = todayNewFromAyah;
      targetTomToSurah = curEndSurah;
      targetTomToAyah = curEndAyah;
      rationale = `لوحظ وجود (${errorsList.length}) أخطاء اليوم؛ قاعدة المنظومة: «الختم بتثبيت أولى من الاستعجال»، فخُصص غد لتكرار وتثبيت هذا الموضع ليرسخ بالصدر.`;
    } else {
      const studentPace = activeStudent?.memorizationPlan?.dailyNewPages || 
        (activeStudent?.dailyNewTarget?.includes('وجهين') ? 2.0 :
         activeStudent?.dailyNewTarget?.includes('ربع') ? 0.25 :
         activeStudent?.dailyNewTarget?.includes('وجه واحد') ? 1.0 : 0.5);

      let advanceStartSurah = curEndSurah;
      let advanceStartAyah = curEndAyah + 1;
      if (advanceStartAyah > endSurahInfo.numberOfAyahs) {
        advanceStartSurah = curEndSurah < 114 ? curEndSurah + 1 : 1;
        advanceStartAyah = 1;
      }

      const tomPortion = calculatePortionFromPace(advanceStartSurah, advanceStartAyah, studentPace);
      targetTomSurah = tomPortion.fromSurah;
      targetTomFromAyah = tomPortion.fromAyah;
      targetTomToSurah = tomPortion.toSurah;
      targetTomToAyah = tomPortion.toAyah;
      rationale = `أداء طيب ومتقن؛ تم التقدم في الحفظ الجديد بمقدار متزن (${tomPortion.description}) مع إدراج ما حُفظ اليوم في مراجعة الغد بما يناسب زمن وتوقيت الحلقة (${halaqahHours} ساعة).`;
    }

    setTomNewSurah(targetTomSurah);
    setTomNewFromAyah(targetTomFromAyah);
    setTomNewToSurah(targetTomToSurah);
    setTomNewToAyah(targetTomToAyah);

    const newTomReviews: QuranRecitationItem[] = [];

    const sInfo = getSurahInfo(todayNewSurah);
    const toInfo = getSurahInfo(todayNewToSurah);
    newTomReviews.push({
      id: `tom_rev_today_${Date.now()}`,
      type: 'مراجعة صغرى',
      surahNumber: todayNewSurah,
      surahName: sInfo.name,
      fromAyah: todayNewFromAyah,
      toSurahNumber: todayNewToSurah,
      toSurahName: toInfo.name,
      toAyah: todayNewToAyah,
      isFullSurah: todayNewSurah === todayNewToSurah && todayNewFromAyah === 1 && todayNewToAyah >= sInfo.numberOfAyahs,
      notes: 'سرد ما تم حفظه اليوم لتثبيته في الصدر'
    });

    if (errorsList.length > 0) {
      const err = errorsList[0];
      const errSurahInfo = getSurahInfo(err.surahNumber);
      newTomReviews.push({
        id: `tom_rev_err_${Date.now()}`,
        type: 'تثبيت الأخطاء والمتشابهات',
        surahNumber: err.surahNumber,
        surahName: errSurahInfo.name,
        fromAyah: Math.max(1, err.ayahNumber - 2),
        toSurahNumber: err.surahNumber,
        toSurahName: errSurahInfo.name,
        toAyah: Math.min(err.ayahNumber + 2, errSurahInfo.numberOfAyahs),
        isFullSurah: false,
        notes: `تكرار وتثبيت الآيات التي وقع فيها خطأ (تكرر ${err.errorCount} مرات)`
      });
    }

    if (todayReviews.length > 0) {
      const firstPastRev = todayReviews.find(r => r.type !== 'مراجعة صغرى') || todayReviews[0];
      if (firstPastRev) {
        newTomReviews.push({
          ...firstPastRev,
          id: `tom_rev_cumul_${Date.now()}`,
          type: 'مراجعة كبرى',
          notes: 'مراجعة تراكمية منتظمة لربط المحفوظ'
        });
      }
    }

    setTomReviews(newTomReviews);
    setAutoFilledNotice(`✨ تم وضع خطة غد بالذكاء الاصطناعي: ${rationale}`);
    setTeacherNotes(prev => {
      const aiNote = `[خطة الغد بالذكاء الاصطناعي 🌟]: ${rationale}`;
      const cleanPrev = (prev || '').split('\n').filter(line => !line.includes('[خطة الغد بالذكاء الاصطناعي')).join('\n');
      return cleanPrev ? `${cleanPrev}\n• ${aiNote}` : `• ${aiNote}`;
    });
  };

  // Save complete evaluation and update student's current position permanently
  const handleSaveEvaluationRecord = async () => {
    if (!activeStudent) return;
    setIsSaving(true);
    setSaveSuccessMsg('');

    try {
      const todayStartSurahInfo = getSurahInfo(todayNewSurah);
      const todayEndSurahInfo = getSurahInfo(todayNewToSurah);

      const todayNewFormatted = formatQuranPortion(
        todayStartSurahInfo.name,
        todayNewFromAyah,
        todayNewToAyah,
        todayStartSurahInfo.numberOfAyahs,
        'حفظ جديد',
        todayEndSurahInfo.name,
        todayEndSurahInfo.numberOfAyahs
      );

      const reviewStrings = todayReviews.map(r => {
        const sInfo = getSurahInfo(r.surahNumber);
        const toInfo = r.toSurahNumber ? getSurahInfo(r.toSurahNumber) : sInfo;
        const portionText = formatQuranPortion(
          sInfo.name,
          r.fromAyah,
          r.toAyah,
          sInfo.numberOfAyahs,
          r.type,
          toInfo.name,
          toInfo.numberOfAyahs
        );
        return r.didNotRecite ? `${portionText} (لم يُسمّع: ${r.didNotReciteReason || 'لم يتقن'})` : portionText;
      });
      const reviewAchievedSummary = reviewStrings.length > 0 ? reviewStrings.join(' • ') : 'أتم المراجعة والتثبيت المقرر';

      const tomStartSurahInfo = getSurahInfo(tomNewSurah);
      const tomEndSurahInfo = getSurahInfo(tomNewToSurah);

      const tomNewFormatted = formatQuranPortion(
        tomStartSurahInfo.name,
        tomNewFromAyah,
        tomNewToAyah,
        tomStartSurahInfo.numberOfAyahs,
        'حفظ جديد',
        tomEndSurahInfo.name,
        tomEndSurahInfo.numberOfAyahs
      );

      const tomRevStrings = tomReviews.map(r => {
        const sInfo = getSurahInfo(r.surahNumber);
        const toInfo = r.toSurahNumber ? getSurahInfo(r.toSurahNumber) : sInfo;
        return formatQuranPortion(
          sInfo.name,
          r.fromAyah,
          r.toAyah,
          sInfo.numberOfAyahs,
          r.type,
          toInfo.name,
          toInfo.numberOfAyahs
        );
      });
      const tomRevFormatted = tomRevStrings.length > 0 ? tomRevStrings.join(' • ') : 'المراجعة المقررة';

      const todayNewItem: QuranRecitationItem = {
        id: `new_${Date.now()}`,
        type: 'حفظ جديد',
        surahNumber: todayNewSurah,
        surahName: todayStartSurahInfo.name,
        fromAyah: todayNewFromAyah,
        toSurahNumber: todayNewToSurah,
        toSurahName: todayEndSurahInfo.name,
        toAyah: todayNewToAyah,
        isFullSurah: todayNewSurah === todayNewToSurah && todayNewFromAyah === 1 && todayNewToAyah >= todayStartSurahInfo.numberOfAyahs,
        didNotRecite: todayNewDidNotRecite,
        didNotReciteReason: todayNewDidNotRecite ? (todayNewDidNotReciteReason || 'لم يحفظ الورد المقرر') : ''
      };

      const tomorrowNewItem: QuranRecitationItem = {
        id: `tom_new_${Date.now()}`,
        type: 'حفظ جديد',
        surahNumber: tomNewSurah,
        surahName: tomStartSurahInfo.name,
        fromAyah: tomNewFromAyah,
        toSurahNumber: tomNewToSurah,
        toSurahName: tomEndSurahInfo.name,
        toAyah: tomNewToAyah,
        isFullSurah: tomNewSurah === tomNewToSurah && tomNewFromAyah === 1 && tomNewToAyah >= tomStartSurahInfo.numberOfAyahs
      };

      let pagesCompletedToday: number[] = [];
      if (!todayNewDidNotRecite && todayNewItem) {
        const startP = getPageOfAyah(todayNewItem.surahNumber, todayNewItem.fromAyah);
        const endP = getPageOfAyah(todayNewItem.toSurahNumber || todayNewItem.surahNumber, todayNewItem.toAyah);
        const minP = Math.min(startP, endP);
        const maxP = Math.max(startP, endP);
        for (let p = minP; p <= maxP; p++) {
          pagesCompletedToday.push(p);
        }
      }

      const isNoneSheikh = selectedSheikh === 'بدون' || selectedSheikh === 'لا يوجد' || targetRepetitions === 0;
      const finalSuggestedSheikh = isNoneSheikh ? 'بدون' : (selectedSheikh || FAMOUS_RECITERS[0].name);
      const finalTargetReps = isNoneSheikh ? 0 : (targetRepetitions || 3);
      const finalDailyNote = isNoneSheikh
        ? 'معفى من الاستماع لهذه الجلسة (بدون استماع)'
        : (dailyHomeNote || `تكرار الاستماع والمراجعة ${finalTargetReps} مرات`);

      // Points earned today is directly taken from the recitation points counter
      const finalPointsToday = Math.max(0, studentPointsToday);

      const fullEvaluation: StudentEvaluation = {
        id: `eval_${selectedDate}_${activeStudent.id}`,
        date: selectedDate,
        studentId: activeStudent.id,
        criteriaValues: {},
        recitationDetails: {
          newMemorizationAchieved: todayNewDidNotRecite
            ? `لم يُسمّع: ${todayNewFormatted} (${todayNewDidNotReciteReason || 'لم يحفظ الورد المقرر'})`
            : todayNewFormatted,
          reviewAchieved: reviewAchievedSummary || '',
          teacherNotes: '',
          todayNewItem,
          todayReviewItems: todayReviews || [],
          tomorrowNewItem,
          tomorrowReviewItem: tomReviews[0] || null,
          tomorrowReviewItems: tomReviews || [],
          tomorrowSuggestedSheikh: finalSuggestedSheikh,
          tomorrowTargetRepetitions: finalTargetReps,
          tomorrowDailyNote: finalDailyNote,
          criteriaPointsEarnedToday: liveCriteriaPoints,
          pagesPointsEarnedToday: livePagesTotalPoints,
          attendancePointsEarnedToday: attendancePoints,
          pointsEarnedToday: finalPointsToday,
          pagesCompletedToday
        },
        evaluatedAt: new Date().toISOString()
      };

      // Update student's current position:
      // If student did not recite, keep current position unchanged!
      const targetSurahNumber = todayNewDidNotRecite ? (activeStudent.currentSurah || 78) : todayNewToSurah;
      const targetSurahName = todayNewDidNotRecite ? (activeStudent.currentSurahName || getSurahInfo(targetSurahNumber).name) : todayEndSurahInfo.name;
      const targetAyah = todayNewDidNotRecite ? (activeStudent.currentAyah || 1) : todayNewToAyah;

      const updatedPosition = {
        surahNumber: targetSurahNumber,
        surahName: targetSurahName,
        ayah: targetAyah
      };

      const newDailyAssignment = {
        newMemorization: tomNewFormatted,
        review: tomRevFormatted,
        suggestedSheikh: finalSuggestedSheikh,
        dailyNote: finalDailyNote,
        targetRepetitions: finalTargetReps,
        newItem: tomorrowNewItem,
        reviewItem: tomReviews[0] || null,
        reviewItems: tomReviews || []
      };

      const listeningAssignmentForStudent = {
        surahNumber: tomNewSurah,
        surahName: startTomNewSurahInfo.name,
        fromAyah: tomNewFromAyah,
        toAyah: tomNewToAyah,
        sheikhName: finalSuggestedSheikh,
        requiredRepetitions: finalTargetReps,
        assignedDate: selectedDate,
        completedRepetitions: 0,
        isCompleted: isNoneSheikh
      };

      // 1. Save evaluation and atomically update student's points, position, and assignments
      await onSaveEvaluation(fullEvaluation, newDailyAssignment, updatedPosition, listeningAssignmentForStudent);

      // 2. Also ensure onUpdateStudentAIPlan is notified for backwards compatibility
      if (onUpdateStudentAIPlan) {
        onUpdateStudentAIPlan(activeStudent.id, newDailyAssignment, updatedPosition, listeningAssignmentForStudent).catch(() => {});
      }

      // 3. Dispatch background AI plan optimization event
      try {
        const errorsList = Object.entries(mushafAyahErrors).map(([key, count]) => {
          const [s, a] = key.split(':').map(Number);
          return { surahNumber: s, ayahNumber: a, errorCount: count, surahName: getSurahInfo(s).name };
        });
        window.dispatchEvent(
          new CustomEvent('omran:ai-tune-plan', {
            detail: {
              student: activeStudent,
              todayEvaluation: fullEvaluation,
              ayahErrors: errorsList,
              didNotRecite: todayNewDidNotRecite,
              newDailyAssignment,
              updatedPosition
            }
          })
        );
      } catch (err) {}

      setSaveSuccessMsg(
        todayNewDidNotRecite
          ? `تم حفظ التقييم وتثبيت موضع الطالب عند سورة ${targetSurahName} (الآية ${targetAyah}) لعدم التسميع بنجاح!`
          : `تم حفظ التسميع والتقييم ليوم (${selectedDate}) وتحديث موضع الطالب إلى سورة ${todayEndSurahInfo.name} (الآية ${todayNewToAyah}) بنجاح!`
      );

      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.7 }
      });
    } catch (e: any) {
      console.error('Save evaluation error:', e);
      const detail = e?.message || e?.code || '';
      setSaveSuccessMsg(`حدث خطأ أثناء حفظ التقييم ${detail ? `(${detail})` : ''}`);
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveSuccessMsg(''), 4500);
    }
  };

  // Criteria Management Handlers
  const handleOpenAddCriteria = () => {
    setEditingCriteriaId(null);
    setNewCritName('');
    setNewCritType('score');
    setNewCritMaxScore(10);
    setNewCritOptions('ممتاز, جيد جدا, جيد, ضعيف');
    setNewCritPointsWeight(10);
    setIsCriteriaModalOpen(true);
  };

  const handleOpenEditCriteria = (crit: EvaluationCriteria) => {
    setEditingCriteriaId(crit.id);
    setNewCritName(crit.name);
    setNewCritType(crit.type);
    setNewCritMaxScore(crit.maxScore || 10);
    setNewCritOptions(crit.options ? crit.options.join(', ') : '');
    setNewCritPointsWeight(crit.pointsWeight ?? 10);
    setIsCriteriaModalOpen(true);
  };

  const handleSaveCriteriaForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCritName.trim()) return;

    const optionsArray =
      newCritType === 'options'
        ? newCritOptions
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
        : undefined;

    let updatedList: EvaluationCriteria[];

    if (editingCriteriaId) {
      updatedList = criteria.map(c =>
        c.id === editingCriteriaId
          ? {
              ...c,
              name: newCritName.trim(),
              type: newCritType,
              maxScore: newCritType === 'score' ? newCritMaxScore : undefined,
              options: optionsArray,
              pointsWeight: newCritPointsWeight,
              hasPoints: true
            }
          : c
      );
    } else {
      const newCrit: EvaluationCriteria = {
        id: `crit_${Date.now()}`,
        name: newCritName.trim(),
        type: newCritType,
        maxScore: newCritType === 'score' ? newCritMaxScore : undefined,
        options: optionsArray,
        pointsWeight: newCritPointsWeight,
        hasPoints: true,
        complexId: activeComplexId || undefined,
        isDefault: false
      };
      updatedList = [...criteria, newCrit];
    }

    await onSaveCriteria(updatedList);
    setIsCriteriaModalOpen(false);
  };

  // State for editing page points in criteria manager
  const [newPagePtsState, setNewPagePtsState] = useState<number>(pointsPerNewPage);
  const [reviewPagePtsState, setReviewPagePtsState] = useState<number>(pointsPerReviewPage);
  const [listeningPtsState, setListeningPtsState] = useState<number>(pointsPerListening);

  useEffect(() => {
    setNewPagePtsState(pointsPerNewPage);
    setReviewPagePtsState(pointsPerReviewPage);
    setListeningPtsState(pointsPerListening);
  }, [pointsPerNewPage, pointsPerReviewPage, pointsPerListening]);

  const handleSavePagePointsConfig = async () => {
    const complexId = activeComplexId || undefined;
    const baseList = criteria.filter(c => !c.id.startsWith('crit-points-'));

    const newPageCrit: EvaluationCriteria = {
      id: 'crit-points-new-page',
      name: 'معيار نقاط الوجه الجديد',
      type: 'score',
      pointsWeight: newPagePtsState,
      maxScore: newPagePtsState,
      hasPoints: true,
      complexId
    };

    const revPageCrit: EvaluationCriteria = {
      id: 'crit-points-review-page',
      name: 'معيار نقاط وجه المراجعة',
      type: 'score',
      pointsWeight: reviewPagePtsState,
      maxScore: reviewPagePtsState,
      hasPoints: true,
      complexId
    };

    const listeningCrit: EvaluationCriteria = {
      id: 'crit-points-listening',
      name: 'معيار نقاط الاستماع اليومي',
      type: 'score',
      pointsWeight: listeningPtsState,
      maxScore: listeningPtsState,
      hasPoints: true,
      complexId
    };

    const updatedList = [...baseList, newPageCrit, revPageCrit, listeningCrit];
    await onSaveCriteria(updatedList);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Date / Criteria Controls */}
      <div className="bg-[#064e3b]/60 border border-[#065f46] rounded-[32px] p-6 shadow-xl backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-heading text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#fbbf24]" />
            <span>تسجيل التسميع وتقييم الطلاب وتحديد مقرر الغد</span>
          </h2>
          <p className="text-xs text-[#86efac]/90 mt-1">
            تسجيل التسميع الفعلي والرجوع للأيام السابقة، وضبط مقرر الغد تلقائياً بالذكاء الاصطناعي مع تحديث موضع الحفظ فوراً
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => openMushafReader(todayNewSurah, todayNewFromAyah, 'new_today')}
            className="px-4 py-2.5 rounded-2xl border-2 border-b-4 text-xs font-black flex items-center gap-2 cursor-pointer transition-all shadow-md active:translate-y-[2px] active:border-b-2 hover:brightness-110"
            style={{
              backgroundColor: 'var(--complex-card, #203843)',
              borderColor: 'var(--complex-accent, #ffc800)',
              borderBottomColor: 'var(--complex-accent-shadow, #e5a500)',
              color: 'var(--complex-accent, #ffc800)'
            }}
            title="فتح مصحف مجمع الملك فهد كاملاً"
          >
            <BookOpen className="w-4 h-4" style={{ color: 'var(--complex-accent, #ffc800)' }} />
            <span>المصحف الشريف (طبعة الملك فهد)</span>
          </button>

          <button
            onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
            className={`px-3.5 py-2 rounded-2xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
              showHistoryDrawer
                ? 'bg-[#fbbf24] text-[#064e3b] border-[#fbbf24] font-black shadow-md'
                : 'bg-[#022c22] hover:bg-[#064e3b] text-[#f0f9f6] border-[#fbbf24]/30 hover:border-[#fbbf24]/60'
            }`}
          >
            <History className="w-4 h-4 text-[#fbbf24]" />
            <span>أرشيف الأيام السابقة للطالب ({studentEvaluationsHistory.length})</span>
          </button>

          {/* Criteria Management: Exclusively for Supervisors */}
          {isSupervisor && (
            <button
              onClick={() => setIsManageCriteriaListOpen(true)}
              className="px-3.5 py-2 rounded-2xl bg-[#022c22] hover:bg-[#064e3b] border border-[#fbbf24]/30 hover:border-[#fbbf24]/60 text-[#f0f9f6] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-md"
              title="إدارة معايير التقييم للمجمع (خاص بالمشرفين)"
            >
              <Sliders className="w-4 h-4 text-[#fbbf24]" />
              <span>معايير التقييم ({criteria.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Real-time background AI processing indicator on the top right (الميمن) */}
      {(isSaving || saveSuccessMsg) && (
        <div className="flex items-center justify-between p-3.5 px-5 rounded-2xl bg-[#064e3b] border-2 border-amber-400 text-white shadow-xl animate-fadeIn" dir="rtl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center border border-amber-400/30">
              <Sparkles className="w-4 h-4 animate-spin text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-black text-white">
                {isSaving ? 'جارٍ تسجيل التسميع وتحليل أخطاء الطالب بالذكاء الاصطناعي...' : saveSuccessMsg}
              </p>
              <p className="text-[11px] text-emerald-300 font-bold">
                يمكنك مواصلة العمل وإجراءاتك، الذكاء الاصطناعي يظبط الخطة ومقرر الغد في الخلفية ⚡
              </p>
            </div>
          </div>
          {isSaving && (
            <div className="flex items-center gap-2 text-xs text-amber-300 font-mono font-bold">
              <span>جارٍ المعالجة...</span>
              <RefreshCw className="w-4 h-4 animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* DATE SELECTOR & NAVIGATION BAR */}
      <div className="bg-[#022c22]/90 border border-[#065f46] rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-[#86efac] flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-[#fbbf24]" />
            <span>تاريخ التسميع المعروض:</span>
          </span>

          <div className="flex items-center gap-1.5 bg-[#064e3b]/80 p-1 rounded-xl border border-[#065f46]">
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedDate === todayStr
                  ? 'bg-[#fbbf24] text-[#064e3b] font-black shadow-sm'
                  : 'text-[#86efac] hover:text-white'
              }`}
            >
              اليوم ({todayStr})
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(getYesterdayStr())}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedDate === getYesterdayStr()
                  ? 'bg-[#fbbf24] text-[#064e3b] font-black shadow-sm'
                  : 'text-[#86efac] hover:text-white'
              }`}
            >
              الأمس
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(getDayBeforeYesterdayStr())}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedDate === getDayBeforeYesterdayStr()
                  ? 'bg-[#fbbf24] text-[#064e3b] font-black shadow-sm'
                  : 'text-[#86efac] hover:text-white'
              }`}
            >
              قبل أمس
            </button>
          </div>

          {/* Custom Date Input */}
          <div className="flex items-center gap-1 bg-[#064e3b] px-2.5 py-1 rounded-xl border border-[#065f46]">
            <span className="text-[11px] text-[#86efac]">تاريخ مخصص:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs text-white outline-none font-bold cursor-pointer"
            />
          </div>
        </div>

        {/* Previous / Next Day Steppers */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => handleDateShift(-1)}
            className="px-2.5 py-1.5 rounded-xl bg-[#022c22] hover:bg-[#064e3b] text-[#f0f9f6] text-xs font-bold flex items-center gap-1 border border-[#fbbf24]/30 hover:border-[#fbbf24] cursor-pointer transition-colors shadow-sm"
            title="الانتقال لليوم السابق"
          >
            <ChevronRight className="w-4 h-4 text-[#fbbf24]" />
            <span>اليوم السابق</span>
          </button>

          <button
            type="button"
            onClick={() => handleDateShift(1)}
            className="px-2.5 py-1.5 rounded-xl bg-[#022c22] hover:bg-[#064e3b] text-[#f0f9f6] text-xs font-bold flex items-center gap-1 border border-[#fbbf24]/30 hover:border-[#fbbf24] cursor-pointer transition-colors shadow-sm"
            title="الانتقال لليوم التالي"
          >
            <span>اليوم التالي</span>
            <ChevronLeft className="w-4 h-4 text-[#fbbf24]" />
          </button>
        </div>
      </div>

      {/* Past Date Notice Banner */}
      {selectedDate !== todayStr && (
        <div className="p-3.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-bold flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[#fbbf24] shrink-0" />
            <span>
              أنت الآن تستعرض سجل تسميع يوم <span className="text-white underline font-black">{selectedDate}</span> {evaluations.some(e => e.date === selectedDate && e.studentId === activeStudentId) ? '(سجل تم حفظه مسبقاً)' : '(لم يتم رصد تسميع في هذا اليوم بعد)'}.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedDate(todayStr)}
            className="px-3 py-1 rounded-xl bg-[#fbbf24] text-[#064e3b] font-black text-xs shrink-0 cursor-pointer shadow-sm hover:bg-[#f59e0b]"
          >
            العودة لتسميع اليوم
          </button>
        </div>
      )}

      {/* Auto-filled from yesterday notice */}
      {autoFilledNotice && selectedDate === todayStr && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center justify-between gap-2 animate-fadeIn">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#fbbf24] shrink-0" />
            <span>{autoFilledNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setAutoFilledNotice('')}
            className="text-xs text-emerald-300 hover:text-white p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Expandable History Drawer (Previous Days Archive) */}
      {showHistoryDrawer && activeStudent && (
        <div className="bg-[#022c22] border border-[#fbbf24]/30 rounded-3xl p-5 space-y-4 animate-fadeIn shadow-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-[#065f46]">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-[#fbbf24]" />
              <h3 className="text-sm font-bold text-white font-heading">
                سجل التسميعات السابقة للطالب: <span className="text-[#fbbf24]">{activeStudent.name}</span> ({studentEvaluationsHistory.length} يوم مسجل)
              </h3>
            </div>
            <button
              onClick={() => setShowHistoryDrawer(false)}
              className="p-1 text-[#86efac] hover:text-white rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {studentEvaluationsHistory.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#86efac]/70">
              لا توجد سجلات تسميع سابقة مسجلة لهذا الطالب حتى الآن.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[320px] overflow-y-auto pr-1">
              {studentEvaluationsHistory.map(ev => {
                const isCurrentView = ev.date === selectedDate;
                return (
                  <div
                    key={ev.id}
                    className={`p-3.5 rounded-2xl border transition-all space-y-2 text-right ${
                      isCurrentView
                        ? 'bg-[#064e3b] border-[#fbbf24] shadow-md ring-1 ring-[#fbbf24]'
                        : 'bg-[#064e3b]/40 border-[#065f46] hover:bg-[#064e3b]/70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-[#fbbf24] flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-[#86efac]" />
                        <span>{ev.date}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedDate(ev.date)}
                        className={`text-[11px] px-2.5 py-0.5 rounded-lg font-bold cursor-pointer transition-colors ${
                          isCurrentView
                            ? 'bg-[#fbbf24] text-[#064e3b] font-black'
                            : 'bg-[#022c22] text-[#86efac] hover:text-white border border-[#065f46]'
                        }`}
                      >
                        {isCurrentView ? 'المعروض حالياً' : 'عرض هذا اليوم'}
                      </button>
                    </div>

                    <div className="text-[11px] text-[#f0f9f6] space-y-1">
                      <div>
                        <span className="text-[#86efac] font-bold">الجديد: </span>
                        <span>{ev.recitationDetails?.newMemorizationAchieved || 'لم يحدد'}</span>
                      </div>
                      <div>
                        <span className="text-[#86efac] font-bold">المراجعة: </span>
                        <span className="line-clamp-1">{ev.recitationDetails?.reviewAchieved || 'لم يحدد'}</span>
                      </div>
                      {ev.recitationDetails?.teacherNotes && (
                        <div className="text-[10px] text-amber-200/90 italic line-clamp-1">
                          "{ev.recitationDetails.teacherNotes}"
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Students List */}
        <div className="lg:col-span-4 bg-[#064e3b]/60 border border-[#065f46] rounded-[32px] p-5 space-y-4 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between pb-3 border-b border-[#065f46]">
            <h3 className="text-sm font-bold text-white font-heading">
              قائمة طلاب الحلقة ({students.length})
            </h3>
            <span className="text-[11px] text-[#86efac] font-bold">
              تاريخ: {selectedDate}
            </span>
          </div>

          <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
            {students.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#86efac]/70">
                لا يوجد طلاب مسجلين في الحلقة حالياً.
              </div>
            ) : (
              students.map(student => {
                const isSelected = student.id === activeStudentId;
                const studentAtt = attendance.find(
                  a => a.date === selectedDate && a.studentId === student.id
                );
                const isStudentAbsent = studentAtt?.status === 'غائب';
                const isStudentExcused = studentAtt?.status === 'معتذر';
                const hasEvaluatedOnSelectedDate = evaluations.some(
                  e => e.date === selectedDate && e.studentId === student.id
                );

                return (
                  <button
                    key={student.id}
                    onClick={() => setActiveStudentId(student.id)}
                    className={`w-full p-3.5 rounded-2xl text-right transition-all flex items-center justify-between gap-3 cursor-pointer border-2 border-b-4 active:translate-y-0.5 ${
                      isSelected
                        ? 'shadow-md'
                        : isStudentAbsent
                        ? 'opacity-60'
                        : isStudentExcused
                        ? 'opacity-80'
                        : 'hover:brightness-105'
                    }`}
                    style={isSelected ? {
                      backgroundColor: 'var(--complex-accent, #ffc800)',
                      borderColor: 'var(--complex-accent, #ffc800)',
                      borderBottomColor: 'var(--complex-accent-shadow, #e5a500)',
                      color: 'var(--complex-primary, #131f24)'
                    } : {
                      backgroundColor: 'var(--complex-card, #203843)',
                      borderColor: 'var(--complex-border, #2b4550)',
                      borderBottomColor: 'var(--complex-card-shadow, #16262e)',
                      color: 'var(--complex-text, #ffffff)'
                    }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-9 h-9 rounded-xl border-2 border-b-2 flex items-center justify-center font-black text-xs shrink-0 shadow-xs duo-avatar"
                        style={isSelected ? {
                          backgroundColor: themeAccent,
                          borderColor: themeAccent,
                          color: accentTextColor
                        } : {
                          backgroundColor: themePrimary,
                          borderColor: themeBorder,
                          color: themeAccent
                        }}
                      >
                        {student.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs line-clamp-1">{student.name}</div>
                        <div
                          className="text-[10px] mt-0.5"
                          style={{ color: isSelected ? themePrimary : `${themeAccent}dd` }}
                        >
                          سورة {student.currentSurahName || getSurahInfo(student.currentSurah || 78).name} (آية {student.currentAyah || 1})
                        </div>
                        {/* Mini Surah Progress Bar */}
                        {(() => {
                          const sInfo = getSurahInfo(student.currentSurah || 78);
                          const total = sInfo.numberOfAyahs || 1;
                          const current = Math.min(Math.max(student.currentAyah || 1, 1), total);
                          const pct = Math.min(100, Math.round((current / total) * 100));
                          return (
                            <div className="w-full mt-1.5 flex items-center gap-1.5">
                              <div
                                className="h-1.5 flex-1 rounded-full overflow-hidden"
                                style={{ backgroundColor: isSelected ? 'rgba(0,0,0,0.2)' : themePrimary }}
                              >
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor: isSelected ? themePrimary : themeAccent
                                  }}
                                />
                              </div>
                              <span
                                className="text-[9px] font-mono shrink-0 font-bold"
                                style={{ color: isSelected ? themePrimary : themeAccent }}
                              >
                                {pct}%
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {hasEvaluatedOnSelectedDate && (
                        <span
                          className={`p-1 rounded-lg ${
                            isSelected ? 'bg-[#064e3b]/20 text-[#064e3b]' : 'text-[#fbbf24]'
                          }`}
                          title={`تم تسجيل التسميع في ${selectedDate}`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </span>
                      )}
                      {isStudentAbsent && (
                        <span className="text-[10px] px-2 py-0.5 rounded-lg bg-red-500/20 text-red-300 font-bold">
                          غائب
                        </span>
                      )}
                      {isStudentExcused && (
                        <span className="text-[10px] px-2 py-0.5 rounded-lg bg-emerald-500/20 text-[#86efac] font-bold">
                          معتذر
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Teacher Recitation & Assignment Workspace */}
        <div className="lg:col-span-8">
          {!activeStudent ? (
            <div
              className="border-2 border-b-4 rounded-[32px] p-12 text-center text-slate-400 backdrop-blur-md"
              style={{
                backgroundColor: 'var(--complex-card, #203843)',
                borderColor: 'var(--complex-border, #2b4550)',
                borderBottomColor: 'var(--complex-card-shadow, #16262e)'
              }}
            >
              اختر طالباً من القائمة للبدء في تسجيل التسميع ومقرر الغد
            </div>
          ) : (
            <div
              className="border-2 border-b-4 rounded-[32px] p-6 sm:p-8 space-y-6 shadow-xl backdrop-blur-md"
              style={{
                backgroundColor: 'var(--complex-card, #203843)',
                borderColor: 'var(--complex-border, #2b4550)',
                borderBottomColor: 'var(--complex-card-shadow, #16262e)'
              }}
            >
              {/* Header: Student Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl border-2 border-b-4 flex items-center justify-center font-black text-lg shadow-lg duo-avatar shrink-0"
                    style={{
                      backgroundColor: themePrimary,
                      borderColor: themeAccent,
                      borderBottomColor: themeAccentShadow,
                      color: themeAccent
                    }}
                  >
                    {activeStudent.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white font-heading">
                        {activeStudent.name}
                      </h3>
                      <span
                        className="text-xs px-2.5 py-0.5 rounded-full font-black border"
                        style={{
                          backgroundColor: `${themeAccent}25`,
                          borderColor: `${themeAccent}70`,
                          color: themeAccent
                        }}
                      >
                        مستوى: {activeStudent.level}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 font-bold mt-0.5">
                      موضع الحفظ الحالي: سورة {activeStudent.currentSurahName || getSurahInfo(activeStudent.currentSurah || 78).name} (الآية {activeStudent.currentAyah || 1})
                    </p>

                    {/* Active AI Plan & Target Completion Date */}
                    {activeStudent.memorizationPlan?.targetCompletionDate && (
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-400/40 flex items-center gap-1 shadow-sm">
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          <span>الختم المستهدف: <strong>{activeStudent.memorizationPlan.targetCompletionDate}</strong></span>
                        </span>
                        <span className="text-[10px] text-slate-300 font-bold">
                          • المثبت: {activeStudent.memorizationPlan.consolidatedJuzCount || 0} أجزاء • نسبة المسار: {activeStudent.memorizationPlan.progressPercentage || 0}%
                        </span>
                      </div>
                    )}

                    {/* Ayah Mistakes Recorded Indicator */}
                    {Object.values(mushafAyahErrors).reduce((s, c) => s + c, 0) > 0 && (
                      <div className="mt-1.5 px-3 py-1 rounded-xl bg-rose-500/20 border border-rose-500/50 text-rose-300 text-[11px] font-bold flex items-center gap-1.5 shadow-sm">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>تم رصد ({Object.values(mushafAyahErrors).reduce((s, c) => s + c, 0)}) أخطاء تسميع في المصحف (بالنقر المزدوج) • سيتم تخصيص ورد تثبيت وتكرار غداً بالذكاء الاصطناعي</span>
                      </div>
                    )}
                  </div>
                </div>

                {isAbsent ? (
                  <div className="px-3.5 py-2 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    <span>الطالب مسجل غائب في {selectedDate}</span>
                  </div>
                ) : isExcused ? (
                  <div className="px-3.5 py-2 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-[#86efac] text-xs font-bold flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    <span>الطالب معتذر ({selectedDateAtt?.note || 'عذر مقبول'})</span>
                  </div>
                ) : null}
              </div>

              {/* ============================================================ */}
              {/* TOP MOTIVATIONAL SURAH PROGRESS BAR (شريط تقدم السورة الحالية) */}
              {/* ============================================================ */}
              {(() => {
                const sNumber = activeStudent.currentSurah || 78;
                const sInfo = getSurahInfo(sNumber);
                const totalAyahs = sInfo.numberOfAyahs || 1;
                const currentAyah = Math.min(Math.max(activeStudent.currentAyah || 1, 1), totalAyahs);
                const percent = Math.min(100, Math.round((currentAyah / totalAyahs) * 100));
                const remainingAyahs = Math.max(0, totalAyahs - currentAyah);
                const isCompleted = currentAyah >= totalAyahs;
                const isNearing = percent >= 75 && !isCompleted;
                const isHalfway = percent >= 50 && percent < 75;
                const pagesInfo = calculateStudentCompletedPages(activeStudent, evaluations);

                const triggerCelebrationConfetti = () => {
                  try {
                    confetti({
                      particleCount: 80,
                      spread: 70,
                      origin: { y: 0.6 }
                    });
                  } catch (e) {}
                };

                return (
                  <motion.div
                    key={`surah-prog-${activeStudent.id}-${sNumber}-${currentAyah}`}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className={`p-4 sm:p-5 rounded-3xl border transition-all shadow-lg backdrop-blur-md relative overflow-hidden ${
                      isCompleted
                        ? 'bg-gradient-to-r from-emerald-950/70 via-[#064e3b] to-emerald-900/60 border-amber-400/50 shadow-[0_0_20px_rgba(251,191,36,0.15)]'
                        : isNearing
                        ? 'bg-gradient-to-r from-[#022c22] via-[#064e3b]/80 to-[#022c22] border-amber-400/40 shadow-[0_0_15px_rgba(251,191,36,0.1)]'
                        : 'bg-[#022c22]/90 border-[#065f46]'
                    }`}
                  >
                    {/* Background subtle glow decoration */}
                    <div className="absolute -top-12 -left-12 w-32 h-32 bg-[#fbbf24]/5 rounded-full blur-2xl pointer-events-none" />

                    {/* Progress Bar Header Info */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 relative z-10">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0 border shadow-sm ${
                            isCompleted
                              ? 'bg-amber-400 text-[#064e3b] border-amber-300'
                              : isNearing
                              ? 'bg-amber-500/20 text-[#fbbf24] border-amber-400/40'
                              : 'bg-emerald-500/20 text-[#86efac] border-emerald-500/30'
                          }`}
                        >
                          {isCompleted ? (
                            <Trophy className="w-5 h-5 text-[#064e3b]" />
                          ) : isNearing ? (
                            <Flame className="w-5 h-5 text-orange-400 animate-pulse" />
                          ) : (
                            <Award className="w-5 h-5 text-[#fbbf24]" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-[#86efac] font-bold">
                              التقدم في سورة {sInfo.name}:
                            </span>
                            <span className="text-[11px] px-2 py-0.2 rounded-full bg-[#064e3b] text-slate-300 border border-[#065f46]">
                              {sInfo.revelationType || 'مكية'}
                            </span>

                            {isCompleted ? (
                              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-400/20 text-[#fbbf24] font-black border border-amber-400/40 flex items-center gap-1 shadow-sm">
                                <Sparkles className="w-3 h-3 text-amber-300" />
                                <span>مكتملة بحمد الله</span>
                              </span>
                            ) : isNearing ? (
                              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-[#fbbf24] font-black border border-amber-400/50 flex items-center gap-1 shadow-sm">
                                <Flame className="w-3 h-3 text-orange-400 animate-bounce" />
                                <span>على وشك الختام!</span>
                              </span>
                            ) : null}
                          </div>

                          <div className="text-xs font-bold text-white mt-1 flex items-center gap-2 flex-wrap">
                            <span>
                              أنجز الآية <span className="text-[#fbbf24] font-extrabold text-sm font-mono">{currentAyah}</span> من أصل <span className="font-mono text-slate-300 font-bold">{totalAyahs}</span> آية
                            </span>
                            {!isCompleted && (
                              <span className="text-[#86efac] font-medium text-[11px]">
                                (متبقٍ <strong className="text-[#fbbf24]">{remainingAyahs}</strong> {remainingAyahs === 1 ? 'آية واحدة' : remainingAyahs === 2 ? 'آيتان' : remainingAyahs <= 10 ? 'آيات' : 'آية'} للإتمام)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Percentage & Quick Action */}
                      <div className="flex items-center gap-3 self-end sm:self-center">
                        <div className="text-left">
                          <div className="text-xl sm:text-2xl font-black text-[#fbbf24] font-mono tracking-tight flex items-center gap-1.5 justify-end">
                            <span>{percent}%</span>
                            {isCompleted ? (
                              <Sparkles className="w-5 h-5 text-amber-300" />
                            ) : (
                              <TrendingUp className="w-4 h-4 text-emerald-400" />
                            )}
                          </div>
                          <div className="text-[10px] text-[#86efac] font-medium text-left">
                            {isCompleted ? 'إتمام مبارك' : isNearing ? 'اقترب الختام' : 'مسيرة الحفظ'}
                          </div>
                        </div>

                        {isCompleted ? (
                          <button
                            type="button"
                            onClick={triggerCelebrationConfetti}
                            className="px-3 py-1.5 rounded-xl bg-[#fbbf24] hover:bg-[#f59e0b] text-[#064e3b] text-xs font-black transition-all cursor-pointer shadow-md flex items-center gap-1.5"
                            title="إطلاق ألعاب نارية احتفالاً بالطالب"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>احتفال</span>
                          </button>
                        ) : isNearing ? (
                          <button
                            type="button"
                            onClick={() => {
                              setTodayNewSurah(sNumber);
                              setTodayNewToSurah(sNumber);
                              setTodayNewFromAyah(Math.min(currentAyah + 1, totalAyahs));
                              setTodayNewToAyah(totalAyahs);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 text-[#fbbf24] border border-amber-400/40 text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                            title="تحديد نهاية السورة لتسميع اليوم لختمها الآن"
                          >
                            <Zap className="w-3 h-3 text-amber-300" />
                            <span>ختم السورة اليوم</span>
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {/* Calculated Recited Pages Strip (احتساب دقيق للأوجه المسمعة من واقع السجل) */}
                    <div className="my-2.5 p-2.5 rounded-2xl bg-[#011a14]/80 border border-[#065f46] flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-[#fbbf24] shrink-0" />
                        <span className="text-[#86efac] font-semibold">إجمالي الأوجه المسمّعة من السجل:</span>
                        <span className="font-mono font-black text-amber-300 text-sm px-2 py-0.5 rounded-lg bg-[#064e3b] border border-[#065f46]">
                          {pagesInfo.totalPagesCount} وجه
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-emerald-200">
                        <span className="bg-[#022c22] px-2 py-0.5 rounded-lg border border-[#065f46]">
                          حفظ جديد: <strong className="text-white font-mono">{pagesInfo.newPagesCount}</strong> وجه
                        </span>
                        <span className="bg-[#022c22] px-2 py-0.5 rounded-lg border border-[#065f46]">
                          مراجعة: <strong className="text-white font-mono">{pagesInfo.reviewPagesCount}</strong> وجه
                        </span>
                        <span className="bg-[#022c22] px-2 py-0.5 rounded-lg border border-[#065f46]">
                          موضع المصحف: <strong className="text-[#fbbf24] font-mono">الوجه {pagesInfo.currentMushafPage}</strong> (الجزء {pagesInfo.currentJuz})
                        </span>
                      </div>
                    </div>

                    {/* The Visual Progress Bar Track */}
                    <div className="space-y-1.5 relative z-10">
                      <div
                        className="h-4 sm:h-5 w-full rounded-full p-0.5 relative overflow-hidden shadow-inner border-2 border-b-2"
                        style={{
                          backgroundColor: themePrimary,
                          borderColor: themeBorder
                        }}
                      >
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percent}%` }}
                          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                          className="h-full rounded-full relative overflow-hidden transition-all shadow-md"
                          style={{
                            width: `${percent}%`,
                            backgroundColor: isCompleted ? '#58cc02' : themeAccent,
                            boxShadow: `0 0 14px ${isCompleted ? '#58cc02' : themeAccent}`
                          }}
                        >
                          {/* Shimmer light sweep */}
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 animate-[pulse_2s_infinite]" />
                        </motion.div>
                      </div>

                      {/* Milestone Indicators under progress bar */}
                      <div className="flex items-center justify-between text-[11px] px-1 font-bold" style={{ color: `${themeAccent}cc` }}>
                        <span>بداية السورة (آية 1)</span>
                        <span className="hidden sm:inline">نصف السورة ({Math.round(totalAyahs / 2)})</span>
                        <span className={isCompleted ? 'font-black' : ''} style={isCompleted ? { color: '#58cc02' } : undefined}>
                          ختام السورة (آية {totalAyahs})
                        </span>
                      </div>
                    </div>

                    {/* Motivational Encouragement Banner */}
                    <div className="mt-2.5 pt-2.5 border-t border-[#065f46]/60 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 text-xs">
                        {isCompleted ? (
                          <p className="text-amber-300 font-bold flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-[#fbbf24] shrink-0" />
                            <span>مبارك للطالب {activeStudent.name}! أتم سورة {sInfo.name} بالكامل بحفظ متقن ومبارك، هنيئاً له هذا الشرف العظيم!</span>
                          </p>
                        ) : isNearing ? (
                          <p className="text-amber-200 font-bold flex items-center gap-1.5">
                            <Flame className="w-4 h-4 text-orange-400 shrink-0 animate-bounce" />
                            <span>همّة وثبات يا بطل! اقتربت جداً من ختام سورة {sInfo.name}؛ بقيت {remainingAyahs} آيات فقط لتتوج بإتمامها!</span>
                          </p>
                        ) : isHalfway ? (
                          <p className="text-emerald-200 font-medium flex items-center gap-1.5">
                            <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>رائع! تجاوزت منتصف سورة {sInfo.name}، استمر بنفس العزيمة نحو إتمام السورة بإذن الله!</span>
                          </p>
                        ) : (
                          <p className="text-emerald-200/80 font-medium flex items-center gap-1.5">
                            <BookOpen className="w-4 h-4 text-[#fbbf24] shrink-0" />
                            <span>بداية مباركة في سورة {sInfo.name}، كل آية تحفظها نور في صدرك ورفعة لدرجاتك في الجنة.</span>
                          </p>
                        )}
                      </div>

                      {/* Surah Verses Counter Chip */}
                      <div className="text-[11px] font-mono text-[#86efac]/90 bg-[#064e3b]/80 px-2 py-0.5 rounded-lg border border-[#065f46] shrink-0 hidden sm:block">
                        السورة {sNumber} من 114
                      </div>
                    </div>
                  </motion.div>
                );
              })()}

              {/* AI Plan Generating Card (Blocks recitation until plan is finalized) */}
              {(activeStudent.isGeneratingPlan || isManualGeneratingPlan) && (
                <div className="bg-gradient-to-r from-amber-500/20 via-emerald-600/25 to-teal-500/20 border-2 border-amber-400/80 rounded-3xl p-6 text-center space-y-4 shadow-[0_0_35px_rgba(251,191,36,0.25)] animate-pulse">
                  <div className="w-16 h-16 rounded-full bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center mx-auto text-amber-300">
                    <Sparkles className="w-8 h-8 animate-spin" style={{ animationDuration: '3s' }} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-black text-amber-300 font-heading">
                      جاري صياغة وبناء الخطة القرآنية الذكية للطالب بواسطة الذكاء الاصطناعي (Gemini)...
                    </h3>
                    <p className="text-sm text-emerald-100 max-w-xl mx-auto leading-relaxed">
                      يقوم الذكاء الاصطناعي الآن بضبط موضع البداية وحساب وتيرة الحفظ وضبط ورد الغد بدقة مصحف المدينة (604 أوجه). يرجى الانتظار ثوانٍ معدودة حتى تكتمل الخطة ويُفتح تسجيل التسميع تلقائياً.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-400/10 border border-amber-400/30 text-amber-200 text-xs font-bold">
                      <Clock className="w-4 h-4 text-amber-300 animate-pulse" />
                      <span>التسجيل موقوف مؤقتاً لحين اكتمال الخطة لضمان دقة مواضع التسميع</span>
                    </div>

                    <button
                      type="button"
                      disabled={isManualGeneratingPlan}
                      onClick={handleForceGeneratePlan}
                      className="px-4 py-2 rounded-2xl bg-[#fbbf24] hover:bg-[#f59e0b] disabled:opacity-50 text-[#064e3b] text-xs font-black shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95"
                    >
                      {isManualGeneratingPlan ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>جاري توليد الخطة بالذكاء الاصطناعي...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>توليد واعتماد الخطة الآن فوراً</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Monthly AI Progression Elevation Card */}
              {monthlyProgression?.shouldIncreasePace && (
                <div className="bg-gradient-to-r from-amber-500/25 via-[#064e3b] to-emerald-600/25 border-2 border-amber-400 rounded-3xl p-4.5 space-y-3 shadow-lg">
                  <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-amber-400/25 border border-amber-400/50 flex items-center justify-center text-amber-300 shrink-0">
                        <Trophy className="w-5 h-5 text-amber-300 animate-bounce" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-lg bg-amber-400 text-[#064e3b] text-[11px] font-black">
                            ترقية استثنائية بالذكاء الاصطناعي
                          </span>
                          <span className="text-xs font-bold text-amber-200">
                            تطور وتميز الطالب على مدار شهر ({monthlyProgression.evaluationsCount} جلسة)
                          </span>
                        </div>
                        <p className="text-xs text-emerald-100 leading-relaxed">
                          {monthlyProgression.reasoning}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isUpgradingPace}
                      onClick={handleUpgradeMonthlyPace}
                      className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-[#064e3b] text-xs font-black shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all shrink-0 w-full sm:w-auto"
                    >
                      <Zap className="w-4 h-4 text-[#064e3b]" />
                      <span>{isUpgradingPace ? 'جاري الترقية...' : `اعتماد ترقية الورد إلى (${monthlyProgression.recommendedPace} وجه)`}</span>
                    </button>
                  </div>
                </div>
              )}

              {monthlyProgression?.isStruggling && (
                <div className="bg-emerald-950/40 border border-emerald-600/40 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs">
                  <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-bold text-emerald-200">توجيه الذكاء الاصطناعي لمسار الطالب:</span>
                    <p className="text-emerald-100/90 leading-relaxed">
                      {monthlyProgression.reasoning}
                    </p>
                  </div>
                </div>
              )}

              {/* ============================================================ */}
              {/* SECTION 1: TODAY'S RECITATION (ما تم تسميعه بالتفصيل) */}
              {/* ============================================================ */}
              <div className={`bg-[#022c22] border border-[#065f46] rounded-3xl p-5 space-y-5 transition-opacity ${(activeStudent.isGeneratingPlan || isManualGeneratingPlan) ? 'opacity-40 pointer-events-none select-none' : ''}`}>
                <div className="flex items-center justify-between pb-3 border-b border-[#065f46]">
                  <h4 className="text-sm font-bold text-[#fbbf24] font-heading flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#fbbf24]" />
                    <span>1. ما سمّعه الطالب في الحلقة (التسميع الفعلي):</span>
                  </h4>
                  <span className="text-[11px] text-[#86efac] font-bold">
                    تاريخ التسميع: {selectedDate}
                  </span>
                </div>

                {/* Student Active Plan Overview & Quick Apply Button */}
                {activeStudent && (activeStudent.memorizationPlan || activeStudent.aiPlan) && (
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-[#064e3b] to-amber-500/15 border border-amber-400/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-md">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-400/30">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-black text-amber-300">الخطة القرآنية المنهجية المعتمدة:</span>
                          {activeStudent.memorizationPlan?.targetCompletionDate && (
                            <span className="text-white font-bold">
                              الختم المتوقع: <strong className="text-emerald-300">{activeStudent.memorizationPlan.targetCompletionDate}</strong>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#86efac]/90 font-bold">
                          المقرر: {activeStudent.memorizationPlan?.dailyNewPages || 1} وجه جديد • {activeStudent.memorizationPlan?.dailyReviewPages || 5} أوجه مراجعة وتثبيت
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const plan = activeStudent.memorizationPlan;
                        const aiPlan = activeStudent.aiPlan;
                        const aiAssignment = aiPlan?.currentDailyAssignment;
                        const planAssignment = plan?.nextDayAssignment;
                        if (planAssignment?.surahNumber) {
                          setTodayNewSurah(planAssignment.surahNumber);
                          setTodayNewFromAyah(planAssignment.fromAyah || 1);
                          setTodayNewToSurah(planAssignment.toSurahNumber || planAssignment.surahNumber);
                          setTodayNewToAyah(planAssignment.toAyah || 10);
                        } else if (aiAssignment?.newItem) {
                          setTodayNewSurah(aiAssignment.newItem.surahNumber || activeStudent.currentSurah || 78);
                          setTodayNewFromAyah(aiAssignment.newItem.fromAyah || activeStudent.currentAyah || 1);
                          setTodayNewToSurah(aiAssignment.newItem.toSurahNumber || activeStudent.currentSurah || 78);
                          setTodayNewToAyah(aiAssignment.newItem.toAyah || 10);
                        } else if (plan?.dailyNewPages) {
                          const sNum = activeStudent.currentSurah || 78;
                          const fAyah = activeStudent.currentAyah || 1;
                          const portion = calculatePortionFromPace(sNum, fAyah, plan.dailyNewPages);
                          setTodayNewSurah(portion.fromSurah);
                          setTodayNewFromAyah(portion.fromAyah);
                          setTodayNewToSurah(portion.toSurah);
                          setTodayNewToAyah(portion.toAyah);
                        }
                        setAutoFilledNotice(`✨ تم تطبيق وضبط الورد اليومي بنجاح استناداً إلى الخطة المنهجية المعتمدة للطالب (${activeStudent.name})`);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#064e3b] font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95 self-start sm:self-auto shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>تطبيق وضبط الورد فوراً من الخطة</span>
                    </button>
                  </div>
                )}

                {/* Real-time Indicator: Did the student listen to yesterday's / current assignment? */}
                {activeStudent && (
                  <div className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs font-bold transition-all shadow-sm ${
                    activeStudent.activeListeningAssignment?.isCompleted
                      ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'
                      : (activeStudent.activeListeningAssignment?.completedRepetitions || 0) > 0
                        ? 'bg-amber-950/60 border-amber-500/50 text-amber-200'
                        : 'bg-rose-950/50 border-rose-500/40 text-rose-300'
                  }`}>
                    <div className="flex items-center gap-2">
                      <Headphones className="w-4 h-4 text-[#fbbf24] shrink-0" />
                      <span>حالة استماع الطالب للورد المنزلي:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeStudent.activeListeningAssignment?.isCompleted ? (
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>استمع للمقطع المقرر بالكامل ({activeStudent.activeListeningAssignment.completedRepetitions || activeStudent.activeListeningAssignment.requiredRepetitions} من {activeStudent.activeListeningAssignment.requiredRepetitions} مرات)</span>
                        </span>
                      ) : (activeStudent.activeListeningAssignment?.completedRepetitions || 0) > 0 ? (
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>استمع جزئياً ({activeStudent.activeListeningAssignment.completedRepetitions} من {activeStudent.activeListeningAssignment.requiredRepetitions} مرات)</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          <XCircle className="w-3.5 h-3.5 text-rose-400" />
                          <span>لم يستمع للمقطع المقرر</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* 1.1 New Memorization (Flexible Multi-Surah Range) */}
                <div className="space-y-3 bg-[#064e3b]/40 p-4 rounded-2xl border border-[#065f46]">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#fbbf24]" />
                        <span>الحفظ الجديد (بداية ونهاية التسميع):</span>
                      </span>
                      {activeStudent?.activeListeningAssignment?.isCompleted || (activeStudent?.dailyListeningCompletedDate && activeStudent?.dailyListeningCompletedDate >= (activeStudent?.activeListeningAssignment?.assignedDate || '')) ? (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold inline-flex items-center gap-1 shadow-sm">
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>استمع للمقطع المقرر ({activeStudent.activeListeningAssignment?.completedRepetitions || activeStudent.activeListeningAssignment?.requiredRepetitions || 3} مرات)</span>
                        </span>
                      ) : (
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold inline-flex items-center gap-1 shadow-sm">
                          <XCircle className="w-3 h-3 text-rose-400" />
                          <span>لم يستمع للمقطع المقرر</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setTodayNewToSurah(todayNewSurah);
                          setTodayNewFromAyah(1);
                          setTodayNewToAyah(startTodaySurahInfo.numberOfAyahs);
                          recalculateTomorrowFromToday(todayNewSurah, 1, todayNewSurah, startTodaySurahInfo.numberOfAyahs, todayNewDidNotRecite);
                        }}
                        className="px-2.5 py-1 rounded-xl bg-[#022c22] hover:bg-[#064e3b] text-[#fbbf24] border border-[#065f46] text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        كامل سورة {startTodaySurahInfo.name} ({startTodaySurahInfo.numberOfAyahs} آية)
                      </button>
                      {todayNewSurah !== todayNewToSurah && (
                        <button
                          type="button"
                          onClick={() => {
                            setTodayNewToSurah(todayNewSurah);
                            setTodayNewToAyah(startTodaySurahInfo.numberOfAyahs);
                            recalculateTomorrowFromToday(todayNewSurah, todayNewFromAyah, todayNewSurah, startTodaySurahInfo.numberOfAyahs, todayNewDidNotRecite);
                          }}
                          className="px-2.5 py-1 rounded-xl bg-[#022c22] text-[#86efac] border border-[#065f46] text-[11px] font-bold cursor-pointer"
                        >
                          نفس السورة
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Multi-Surah Range Selector Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#022c22]/70 p-3.5 rounded-2xl border border-[#065f46]">
                    {/* START POINT */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-[#fbbf24]">نقطة البداية (من):</span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-[#86efac] block mb-1">من سورة:</label>
                          <select
                            value={todayNewSurah}
                            onChange={e => handleTodayStartSurahChange(Number(e.target.value))}
                            className="w-full bg-[#064e3b] border border-[#065f46] focus:border-[#fbbf24] rounded-xl py-1.5 px-2.5 text-xs text-white outline-none"
                          >
                            {QURAN_SURAHS.map(s => (
                              <option key={s.number} value={s.number}>
                                {s.number}. سورة {s.name} ({s.numberOfAyahs} آية)
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] text-[#86efac] block mb-1">من الآية:</label>
                          <select
                            value={todayNewFromAyah}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setTodayNewFromAyah(val);
                              let targetTo = todayNewToAyah;
                              if (todayNewSurah === todayNewToSurah && todayNewToAyah < val) {
                                targetTo = val;
                                setTodayNewToAyah(val);
                              }
                              recalculateTomorrowFromToday(todayNewSurah, val, todayNewToSurah, targetTo, todayNewDidNotRecite);
                            }}
                            className="w-full bg-[#064e3b] border border-[#065f46] focus:border-[#fbbf24] rounded-xl py-1.5 px-2.5 text-xs text-white outline-none"
                          >
                            {Array.from({ length: startTodaySurahInfo.numberOfAyahs }, (_, i) => i + 1).map(ayahNum => (
                              <option key={ayahNum} value={ayahNum}>
                                آية {ayahNum}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* END POINT */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-[#86efac]">نقطة النهاية (إلى):</span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-[#86efac] block mb-1">إلى سورة:</label>
                          <select
                            value={todayNewToSurah}
                            onChange={e => handleTodayEndSurahChange(Number(e.target.value))}
                            className="w-full bg-[#064e3b] border border-[#065f46] focus:border-[#fbbf24] rounded-xl py-1.5 px-2.5 text-xs text-white outline-none"
                          >
                            {QURAN_SURAHS.map(s => (
                              <option key={s.number} value={s.number}>
                                {s.number}. سورة {s.name} ({s.numberOfAyahs} آية)
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] text-[#86efac] block mb-1">
                            إلى الآية (حتى {endTodaySurahInfo.numberOfAyahs}):
                          </label>
                          <select
                            value={todayNewToAyah}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setTodayNewToAyah(val);
                              recalculateTomorrowFromToday(todayNewSurah, todayNewFromAyah, todayNewToSurah, val, todayNewDidNotRecite);
                            }}
                            className="w-full bg-[#064e3b] border border-[#065f46] focus:border-[#fbbf24] rounded-xl py-1.5 px-2.5 text-xs text-white outline-none"
                          >
                            {Array.from({ length: endTodaySurahInfo.numberOfAyahs }, (_, i) => i + 1)
                              .filter(ayahNum => todayNewSurah !== todayNewToSurah || ayahNum >= todayNewFromAyah)
                              .map(ayahNum => (
                                <option key={ayahNum} value={ayahNum}>
                                  آية {ayahNum}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Live preview banner */}
                  <div className="p-3 rounded-2xl bg-[#022c22] border border-[#065f46] text-xs text-[#fbbf24] flex items-center justify-between">
                    <span className="text-[#86efac] font-bold">صيغة التسميع المعتمدة:</span>
                    <span className="font-bold text-sm">
                      {formatQuranPortion(
                        startTodaySurahInfo.name,
                        todayNewFromAyah,
                        todayNewToAyah,
                        startTodaySurahInfo.numberOfAyahs,
                        'حفظ جديد',
                        endTodaySurahInfo.name,
                        endTodaySurahInfo.numberOfAyahs
                      )}
                    </span>
                  </div>

                  {/* Read in King Fahd Mushaf Button */}
                  <button
                    type="button"
                    onClick={() => openMushafReader(todayNewSurah, todayNewFromAyah, 'new_today')}
                    className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600/30 via-[#064e3b] to-emerald-600/30 hover:from-emerald-600/50 hover:to-emerald-600/50 border border-emerald-500/40 text-emerald-200 hover:text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm group"
                  >
                    <BookOpen className="w-4 h-4 text-[#fbbf24] group-hover:scale-110 transition-transform" />
                    <span>قراءة ومتابعة في مصحف مجمع الملك فهد (سورة {startTodaySurahInfo.name} - الآيات {todayNewFromAyah} إلى {todayNewToAyah} - الوجه {getPageOfAyah(todayNewSurah, todayNewFromAyah)})</span>
                  </button>

                  {/* Did not recite toggle */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-[#022c22]/90 border border-[#065f46]">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold select-none">
                      <input
                        type="checkbox"
                        checked={todayNewDidNotRecite}
                        onChange={e => {
                          const checked = e.target.checked;
                          setTodayNewDidNotRecite(checked);
                          if (checked) {
                            setTomNewSurah(todayNewSurah);
                            setTomNewFromAyah(todayNewFromAyah);
                            setTomNewToSurah(todayNewToSurah);
                            setTomNewToAyah(todayNewToAyah);
                          } else {
                            const curSurahInfo = getSurahInfo(todayNewToSurah);
                            let nextStartS = todayNewToSurah;
                            let nextStartA = todayNewToAyah + 1;
                            if (nextStartA > curSurahInfo.numberOfAyahs) {
                              nextStartS = todayNewToSurah < 114 ? todayNewToSurah + 1 : 1;
                              nextStartA = 1;
                            }
                            const pace = activeStudent?.memorizationPlan?.dailyNewPages ||
                              (activeStudent?.dailyNewTarget?.includes('وجهين') ? 2.0 :
                               activeStudent?.dailyNewTarget?.includes('ربع') ? 0.25 :
                               activeStudent?.dailyNewTarget?.includes('وجه واحد') ? 1.0 : 0.5);

                            const tomPortion = calculatePortionFromPace(nextStartS, nextStartA, pace);
                            setTomNewSurah(tomPortion.fromSurah);
                            setTomNewFromAyah(tomPortion.fromAyah);
                            setTomNewToSurah(tomPortion.toSurah);
                            setTomNewToAyah(tomPortion.toAyah);
                          }
                        }}
                        className="w-4 h-4 rounded text-red-500 bg-[#064e3b] border-[#065f46] focus:ring-red-400 focus:ring-offset-0 cursor-pointer"
                      />
                      <span className={todayNewDidNotRecite ? "text-red-400 font-black" : "text-emerald-200"}>
                        لم يُسمّع الطالب هذا الورد اليوم (تثبيت نفس الورد لليوم التالي وعدم تقدمه)
                      </span>
                    </label>
                    {todayNewDidNotRecite && (
                      <div className="flex-1 max-w-sm">
                        <input
                          type="text"
                          value={todayNewDidNotReciteReason}
                          onChange={e => setTodayNewDidNotReciteReason(e.target.value)}
                          placeholder="سبب عدم التسميع (مثال: لم يحفظ، تعثر شديد، غياب...)"
                          className="w-full bg-[#064e3b] border border-red-500/40 focus:border-red-400 rounded-xl py-1.5 px-3 text-xs text-red-200 outline-none placeholder:text-red-300/40"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* 1.2 Today's Reviews */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-[#86efac]" />
                      <span>المراجعة والتثبيت والاختبارات ({todayReviews.length}):</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleAddReviewItem}
                      className="px-3 py-1.5 rounded-xl bg-[#064e3b] hover:bg-[#064e3b]/80 border border-[#065f46] text-[#86efac] hover:text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة مراجعة أو اختبار آخر</span>
                    </button>
                  </div>

                  {todayReviews.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-[#064e3b]/20 border border-dashed border-[#065f46] text-center text-xs text-[#86efac]/70">
                      لا توجد مراجعات مسجلة. اضغط على "إضافة مراجعة" لإضافة موضع مراجعة أو اختبار.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {todayReviews.map((rev, index) => {
                        const revStartSurahInfo = getSurahInfo(rev.surahNumber);
                        const revEndSurahInfo = rev.toSurahNumber ? getSurahInfo(rev.toSurahNumber) : revStartSurahInfo;

                        return (
                          <div
                            key={rev.id}
                            className="bg-[#064e3b]/30 p-4 rounded-2xl border border-[#065f46] space-y-3 relative"
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-[#86efac]">
                                  بند مراجعة #{index + 1}
                                </span>
                                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold select-none">
                                  <input
                                    type="checkbox"
                                    checked={!!rev.didNotRecite}
                                    onChange={e => handleUpdateReviewItem(rev.id, {
                                      didNotRecite: e.target.checked,
                                      didNotReciteReason: e.target.checked ? (rev.didNotReciteReason || 'لم يتقن الورد') : undefined
                                    })}
                                    className="w-3.5 h-3.5 rounded text-red-500 bg-[#022c22] border-[#065f46]"
                                  />
                                  <span className={rev.didNotRecite ? "text-red-400 font-bold" : "text-[#86efac]/80"}>
                                    لم يُسمّع
                                  </span>
                                </label>
                                {rev.didNotRecite && (
                                  <input
                                    type="text"
                                    value={rev.didNotReciteReason || ''}
                                    onChange={e => handleUpdateReviewItem(rev.id, { didNotReciteReason: e.target.value })}
                                    placeholder="السبب..."
                                    className="bg-[#022c22] border border-red-500/40 rounded-lg py-0.5 px-2 text-[11px] text-red-200 outline-none w-28 placeholder:text-red-300/40"
                                  />
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateReviewItem(rev.id, {
                                      toSurahNumber: rev.surahNumber,
                                      toSurahName: revStartSurahInfo.name,
                                      fromAyah: 1,
                                      toAyah: revStartSurahInfo.numberOfAyahs,
                                      isFullSurah: true
                                    })
                                  }
                                  className="px-2 py-0.5 rounded-lg bg-[#022c22] text-[#fbbf24] text-[10px] font-bold border border-[#065f46] cursor-pointer"
                                >
                                  كامل السورة ({revStartSurahInfo.numberOfAyahs})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveReviewItem(rev.id)}
                                  className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer"
                                  title="حذف هذا البند"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                              {/* Review Type */}
                              <div className="sm:col-span-1">
                                <label className="text-[10px] font-semibold text-[#86efac] block mb-1">
                                  نوع المراجعة:
                                </label>
                                <select
                                  value={rev.type}
                                  onChange={e => handleUpdateReviewItem(rev.id, { type: e.target.value })}
                                  className="w-full bg-[#022c22] border border-[#065f46] focus:border-[#fbbf24] rounded-xl py-1.5 px-2 text-xs text-white outline-none"
                                >
                                  {REVIEW_TYPES.map(t => (
                                    <option key={t} value={t}>
                                      {t}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Start Surah */}
                              <div>
                                <label className="text-[10px] font-semibold text-[#86efac] block mb-1">
                                  من سورة:
                                </label>
                                <select
                                  value={rev.surahNumber}
                                  onChange={e => handleUpdateReviewItem(rev.id, { surahNumber: Number(e.target.value) })}
                                  className="w-full bg-[#022c22] border border-[#065f46] focus:border-[#fbbf24] rounded-xl py-1.5 px-2 text-xs text-white outline-none"
                                >
                                  {QURAN_SURAHS.map(s => (
                                    <option key={s.number} value={s.number}>
                                      {s.number}. {s.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* From Ayah */}
                              <div>
                                <label className="text-[10px] font-semibold text-[#86efac] block mb-1">
                                  من الآية:
                                </label>
                                <select
                                  value={rev.fromAyah}
                                  onChange={e => {
                                    const val = Number(e.target.value);
                                    handleUpdateReviewItem(rev.id, {
                                      fromAyah: val,
                                      toAyah: (rev.toSurahNumber || rev.surahNumber) === rev.surahNumber && rev.toAyah < val ? val : rev.toAyah
                                    });
                                  }}
                                  className="w-full bg-[#022c22] border border-[#065f46] focus:border-[#fbbf24] rounded-xl py-1.5 px-2 text-xs text-white outline-none"
                                >
                                  {Array.from({ length: revStartSurahInfo.numberOfAyahs }, (_, i) => i + 1).map(ayahNum => (
                                    <option key={ayahNum} value={ayahNum}>
                                      آية {ayahNum}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* End Surah */}
                              <div>
                                <label className="text-[10px] font-semibold text-[#86efac] block mb-1">
                                  إلى سورة:
                                </label>
                                <select
                                  value={rev.toSurahNumber || rev.surahNumber}
                                  onChange={e => handleUpdateReviewItem(rev.id, { toSurahNumber: Number(e.target.value) })}
                                  className="w-full bg-[#022c22] border border-[#065f46] focus:border-[#fbbf24] rounded-xl py-1.5 px-2 text-xs text-white outline-none"
                                >
                                  {QURAN_SURAHS.map(s => (
                                    <option key={s.number} value={s.number}>
                                      {s.number}. {s.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* To Ayah */}
                              <div>
                                <label className="text-[10px] font-semibold text-[#86efac] block mb-1">
                                  إلى الآية:
                                </label>
                                <select
                                  value={rev.toAyah}
                                  onChange={e => handleUpdateReviewItem(rev.id, { toAyah: Number(e.target.value) })}
                                  className="w-full bg-[#022c22] border border-[#065f46] focus:border-[#fbbf24] rounded-xl py-1.5 px-2 text-xs text-white outline-none"
                                >
                                   {Array.from({ length: revEndSurahInfo.numberOfAyahs }, (_, i) => i + 1)
                                    .filter(ayahNum => (rev.toSurahNumber || rev.surahNumber) !== rev.surahNumber || ayahNum >= rev.fromAyah)
                                    .map(ayahNum => (
                                      <option key={ayahNum} value={ayahNum}>
                                        آية {ayahNum}
                                      </option>
                                    ))}
                                </select>
                              </div>
                            </div>

                            <div className="text-[11px] text-[#fbbf24] bg-[#022c22] p-2.5 rounded-xl border border-[#065f46] font-bold">
                              {formatQuranPortion(
                                revStartSurahInfo.name,
                                rev.fromAyah,
                                rev.toAyah,
                                revStartSurahInfo.numberOfAyahs,
                                rev.type,
                                revEndSurahInfo.name,
                                revEndSurahInfo.numberOfAyahs
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => openMushafReader(rev.surahNumber, rev.fromAyah, rev.id)}
                              className="w-full py-2 px-3 rounded-xl bg-[#064e3b]/50 hover:bg-[#064e3b] border border-[#065f46] text-[#86efac] hover:text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                            >
                              <BookOpen className="w-3.5 h-3.5 text-[#fbbf24]" />
                              <span>قراءة في المصحف ({revStartSurahInfo.name} {rev.fromAyah}-{rev.toAyah} • الوجه {getPageOfAyah(rev.surahNumber, rev.fromAyah)})</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* ============================================================ */}
              {/* SECTION 2: TOMORROW'S ASSIGNMENT & MULTI-REVIEWS             */}
              {/* ============================================================ */}
              <div className="bg-[#022c22] border border-[#065f46] rounded-3xl p-5 space-y-5 shadow-xl relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#065f46]">
                  <div>
                    <h4 className="text-sm font-bold text-[#fbbf24] font-heading flex items-center gap-2">
                      <Compass className="w-4 h-4 text-[#fbbf24]" />
                      <span>2. المقرر المطلوب تسميعه غداً (حفظ جديد + مراجعات وتراكميات محفوظة):</span>
                    </h4>
                    <p className="text-[11px] text-[#86efac]/80 mt-0.5">
                      يبقى الورد والمراجعات والتراكميات محفوظة للغد وثابتة للأبد حتى يقوم المعلم بتعديلها أو حذفها
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={isGeneratingTomPlan}
                    onClick={handleGenerateTomorrowPlanWithAI}
                    className="px-4 py-2.5 rounded-2xl bg-[#064e3b] hover:bg-[#047857] border-2 border-amber-400 text-[#fbbf24] text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-md active:translate-y-0.5 hover:brightness-110 disabled:opacity-50"
                    title="الذكاء الاصطناعي يحلل ما سمعه الطالب وأخطاءه اليوم مقارنة بالأيام السابقة ويضع خطة ومقرر غد مع مراعاة زمن وتوقيت الحلقة"
                  >
                    {isGeneratingTomPlan ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                        <span>الذكاء الاصطناعي يحلل ويضع خطة غد...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                        <span>وضع خطة غد</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 2.1 Tomorrow's New Memorization */}
                <div className="space-y-3 bg-[#064e3b]/40 p-4 rounded-2xl border border-[#065f46]">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#fbbf24]" />
                      <span>ورد الحفظ الجديد المطلوب لغد (بداية ونهاية المقرر):</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const pace = activeStudent?.memorizationPlan?.dailyNewPages || 0.5;
                        const p = calculatePortionFromPace(tomNewSurah, tomNewFromAyah, pace);
                        setTomNewToSurah(p.toSurah);
                        setTomNewToAyah(p.toAyah);
                      }}
                      className="px-2.5 py-1 rounded-xl bg-[#022c22] hover:bg-[#064e3b] text-[#fbbf24] border border-[#065f46] text-[11px] font-bold cursor-pointer transition-colors"
                    >
                      ضبط بمعدل الورد ({activeStudent?.dailyNewTarget || 'نصف وجه'})
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#022c22]/70 p-3.5 rounded-2xl border border-[#065f46]">
                    {/* START POINT */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-[#fbbf24]">نقطة البداية (من):</span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-[#86efac] block mb-1">من سورة:</label>
                          <select
                            value={tomNewSurah}
                            onChange={e => handleTomNewStartSurahChange(Number(e.target.value))}
                            className="w-full bg-[#064e3b] border border-[#065f46] focus:border-[#fbbf24] rounded-xl py-1.5 px-2.5 text-xs text-white outline-none"
                          >
                            {QURAN_SURAHS.map(s => (
                              <option key={s.number} value={s.number}>
                                {s.number}. {s.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] text-[#86efac] block mb-1">من الآية:</label>
                          <select
                            value={tomNewFromAyah}
                            onChange={e => {
                              const val = Number(e.target.value);
                              setTomNewFromAyah(val);
                              if (tomNewSurah === tomNewToSurah && tomNewToAyah < val) {
                                setTomNewToAyah(val);
                              }
                            }}
                            className="w-full bg-[#064e3b] border border-[#065f46] focus:border-[#fbbf24] rounded-xl py-1.5 px-2.5 text-xs text-white outline-none"
                          >
                            {Array.from({ length: startTomNewSurahInfo.numberOfAyahs }, (_, i) => i + 1).map(ayahNum => (
                              <option key={ayahNum} value={ayahNum}>
                                آية {ayahNum}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* END POINT */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-[#86efac]">نقطة النهاية (إلى):</span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-[#86efac] block mb-1">إلى سورة:</label>
                          <select
                            value={tomNewToSurah}
                            onChange={e => handleTomNewEndSurahChange(Number(e.target.value))}
                            className="w-full bg-[#064e3b] border border-[#065f46] focus:border-[#fbbf24] rounded-xl py-1.5 px-2.5 text-xs text-white outline-none"
                          >
                            {QURAN_SURAHS.map(s => (
                              <option key={s.number} value={s.number}>
                                {s.number}. {s.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] text-[#86efac] block mb-1">
                            إلى الآية (حتى {endTomNewSurahInfo.numberOfAyahs}):
                          </label>
                          <select
                            value={tomNewToAyah}
                            onChange={e => setTomNewToAyah(Number(e.target.value))}
                            className="w-full bg-[#064e3b] border border-[#065f46] focus:border-[#fbbf24] rounded-xl py-1.5 px-2.5 text-xs text-white outline-none"
                          >
                            {Array.from({ length: endTomNewSurahInfo.numberOfAyahs }, (_, i) => i + 1)
                              .filter(ayahNum => tomNewSurah !== tomNewToSurah || ayahNum >= tomNewFromAyah)
                              .map(ayahNum => (
                                <option key={ayahNum} value={ayahNum}>
                                  آية {ayahNum}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#022c22] border border-[#065f46] text-xs text-[#fbbf24] flex items-center justify-between">
                    <span className="text-[#86efac] font-bold">المقرر الجديد لغد:</span>
                    <span className="font-bold text-sm">
                      {formatQuranPortion(
                        startTomNewSurahInfo.name,
                        tomNewFromAyah,
                        tomNewToAyah,
                        startTomNewSurahInfo.numberOfAyahs,
                        'حفظ جديد',
                        endTomNewSurahInfo.name,
                        endTomNewSurahInfo.numberOfAyahs
                      )}
                    </span>
                  </div>

                  {/* Read in King Fahd Mushaf Button */}
                  <button
                    type="button"
                    onClick={() => openMushafReader(tomNewSurah, tomNewFromAyah, 'new_tomorrow')}
                    className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600/30 via-[#064e3b] to-emerald-600/30 hover:from-emerald-600/50 hover:to-emerald-600/50 border border-emerald-500/40 text-emerald-200 hover:text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm group"
                  >
                    <BookOpen className="w-4 h-4 text-[#fbbf24] group-hover:scale-110 transition-transform" />
                    <span>قراءة في مصحف الملك فهد (سورة {startTomNewSurahInfo.name} - الآيات {tomNewFromAyah} إلى {tomNewToAyah} - الوجه {getPageOfAyah(tomNewSurah, tomNewFromAyah)})</span>
                  </button>
                </div>

                {/* 2.2 Tomorrow's Reviews (Multi-item) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-[#86efac]" />
                      <span>ورد المراجعة والتثبيت والاختبارات لغد ({tomReviews.length}):</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleAddTomReviewItem}
                      className="px-3 py-1.5 rounded-xl bg-[#064e3b] hover:bg-[#064e3b]/80 border border-[#065f46] text-[#86efac] hover:text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة مراجعة أو اختبار لغد</span>
                    </button>
                  </div>

                  {tomReviews.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-[#064e3b]/20 border border-dashed border-[#065f46] text-center text-xs text-[#86efac]/70">
                      لا توجد مراجعات مقررة لغد. اضغط على "إضافة مراجعة أو اختبار لغد" لتحديد المقرر.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {tomReviews.map((rev, index) => {
                        const revStartSurahInfo = getSurahInfo(rev.surahNumber);
                        const revEndSurahInfo = rev.toSurahNumber ? getSurahInfo(rev.toSurahNumber) : revStartSurahInfo;

                        return (
                          <div
                            key={rev.id}
                            className="bg-[#064e3b]/30 p-4 rounded-2xl border border-[#065f46] space-y-3 relative"
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-xs font-bold text-[#86efac]">
                                مقرر مراجعة لغد #{index + 1}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateTomReviewItem(rev.id, {
                                      toSurahNumber: rev.surahNumber,
                                      toSurahName: revStartSurahInfo.name,
                                      fromAyah: 1,
                                      toAyah: revStartSurahInfo.numberOfAyahs,
                                      isFullSurah: true
                                    })
                                  }
                                  className="px-2 py-0.5 rounded-lg bg-[#022c22] text-[#fbbf24] text-[10px] font-bold border border-[#065f46] cursor-pointer"
                                >
                                  كامل السورة ({revStartSurahInfo.numberOfAyahs})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTomReviewItem(rev.id)}
                                  className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer"
                                  title="حذف هذا المقرر لغد"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                              {/* Review Type */}
                              <div className="sm:col-span-1">
                                <label className="text-[10px] font-semibold text-[#86efac] block mb-1">
                                  نوع المراجعة:
                                </label>
                                <select
                                  value={rev.type}
                                  onChange={e => handleUpdateTomReviewItem(rev.id, { type: e.target.value })}
                                  className="w-full bg-[#022c22] border border-[#065f46] focus:border-[#fbbf24] rounded-xl py-1.5 px-2 text-xs text-white outline-none"
                                >
                                  {REVIEW_TYPES.map(t => (
                                    <option key={t} value={t}>
                                      {t}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Start Surah */}
                              <div>
                                <label className="text-[10px] font-semibold text-[#86efac] block mb-1">
                                  من سورة:
                                </label>
                                <select
                                  value={rev.surahNumber}
                                  onChange={e => handleUpdateTomReviewItem(rev.id, { surahNumber: Number(e.target.value) })}
                                  className="w-full bg-[#022c22] border border-[#065f46] focus:border-[#fbbf24] rounded-xl py-1.5 px-2 text-xs text-white outline-none"
                                >
                                  {QURAN_SURAHS.map(s => (
                                    <option key={s.number} value={s.number}>
                                      {s.number}. {s.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* From Ayah */}
                              <div>
                                <label className="text-[10px] font-semibold text-[#86efac] block mb-1">
                                  من الآية:
                                </label>
                                <select
                                  value={rev.fromAyah}
                                  onChange={e => {
                                    const val = Number(e.target.value);
                                    handleUpdateTomReviewItem(rev.id, {
                                      fromAyah: val,
                                      toAyah: (rev.toSurahNumber || rev.surahNumber) === rev.surahNumber && rev.toAyah < val ? val : rev.toAyah
                                    });
                                  }}
                                  className="w-full bg-[#022c22] border border-[#065f46] focus:border-[#fbbf24] rounded-xl py-1.5 px-2 text-xs text-white outline-none"
                                >
                                  {Array.from({ length: revStartSurahInfo.numberOfAyahs }, (_, i) => i + 1).map(ayahNum => (
                                    <option key={ayahNum} value={ayahNum}>
                                      آية {ayahNum}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* End Surah */}
                              <div>
                                <label className="text-[10px] font-semibold text-[#86efac] block mb-1">
                                  إلى سورة:
                                </label>
                                <select
                                  value={rev.toSurahNumber || rev.surahNumber}
                                  onChange={e => handleUpdateTomReviewItem(rev.id, { toSurahNumber: Number(e.target.value) })}
                                  className="w-full bg-[#022c22] border border-[#065f46] focus:border-[#fbbf24] rounded-xl py-1.5 px-2 text-xs text-white outline-none"
                                >
                                  {QURAN_SURAHS.map(s => (
                                    <option key={s.number} value={s.number}>
                                      {s.number}. {s.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* To Ayah */}
                              <div>
                                <label className="text-[10px] font-semibold text-[#86efac] block mb-1">
                                  إلى الآية:
                                </label>
                                <select
                                  value={rev.toAyah}
                                  onChange={e => handleUpdateTomReviewItem(rev.id, { toAyah: Number(e.target.value) })}
                                  className="w-full bg-[#022c22] border border-[#065f46] focus:border-[#fbbf24] rounded-xl py-1.5 px-2 text-xs text-white outline-none"
                                >
                                  {Array.from({ length: revEndSurahInfo.numberOfAyahs }, (_, i) => i + 1)
                                    .filter(ayahNum => (rev.toSurahNumber || rev.surahNumber) !== rev.surahNumber || ayahNum >= rev.fromAyah)
                                    .map(ayahNum => (
                                      <option key={ayahNum} value={ayahNum}>
                                        آية {ayahNum}
                                      </option>
                                    ))}
                                </select>
                              </div>
                            </div>

                            <div className="text-[11px] text-[#fbbf24] bg-[#022c22] p-2.5 rounded-xl border border-[#065f46] font-bold">
                              {formatQuranPortion(
                                revStartSurahInfo.name,
                                rev.fromAyah,
                                rev.toAyah,
                                revStartSurahInfo.numberOfAyahs,
                                rev.type,
                                revEndSurahInfo.name,
                                revEndSurahInfo.numberOfAyahs
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => openMushafReader(rev.surahNumber, rev.fromAyah, rev.id)}
                              className="w-full py-2 px-3 rounded-xl bg-[#064e3b]/50 hover:bg-[#064e3b] border border-[#065f46] text-[#86efac] hover:text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                            >
                              <BookOpen className="w-3.5 h-3.5 text-[#fbbf24]" />
                              <span>قراءة في المصحف ({revStartSurahInfo.name} {rev.fromAyah}-{rev.toAyah} • الوجه {getPageOfAyah(rev.surahNumber, rev.fromAyah)})</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2.3 Reciter & Repetitions Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[#86efac] block mb-1 flex items-center gap-1.5">
                      <Volume2 className="w-4 h-4 text-[#fbbf24]" />
                      <span>القارئ المقترح للاستماع له بالمنزل:</span>
                    </label>
                    <select
                      value={selectedSheikh}
                      onChange={e => {
                        const val = e.target.value;
                        setSelectedSheikh(val);
                        if (val === 'بدون') {
                          setTargetRepetitions(0);
                        } else if (targetRepetitions === 0) {
                          setTargetRepetitions(3);
                        }
                      }}
                      className="w-full bg-[#064e3b] border border-[#065f46] focus:border-[#fbbf24] rounded-2xl py-2 px-3 text-xs text-white outline-none cursor-pointer"
                    >
                      <option value="بدون">بدون (لا يتطلب استماع - ٠ مرات)</option>
                      {FAMOUS_RECITERS.filter(r => (r as any).hasAudio).map(r => (
                        <option key={r.id} value={r.name}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#86efac] block mb-1 flex items-center gap-1.5">
                      <RotateCcw className="w-4 h-4 text-[#fbbf24]" />
                      <span>مرات التكرار المقررة للطالب (0 - 20):</span>
                    </label>
                    <select
                      value={targetRepetitions}
                      onChange={e => {
                        const count = Number(e.target.value);
                        setTargetRepetitions(count);
                        if (count === 0) {
                          setSelectedSheikh('بدون');
                        } else if (selectedSheikh === 'بدون') {
                          setSelectedSheikh(FAMOUS_RECITERS[0].name);
                        }
                      }}
                      className="w-full bg-[#064e3b] border border-[#065f46] focus:border-[#fbbf24] rounded-2xl py-2 px-3 text-xs text-white outline-none font-bold cursor-pointer"
                    >
                      <option value={0}>0 (معفى - لا يحتاج استماع)</option>
                      {Array.from({ length: 20 }, (_, i) => i + 1).map(num => (
                        <option key={num} value={num}>
                          {num === 1 ? 'مرة واحدة' : num === 2 ? 'مرتان' : `${num} مرات`}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* ============================================================ */}
              {/* SECTION 3: DAILY STUDENT POINTS (نقاط الطالب اليوم)          */}
              {/* ============================================================ */}
              <div className="bg-[#022c22] border-2 border-[#fbbf24]/50 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#065f46]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#fbbf24]/20 border border-[#fbbf24]/40 text-[#fbbf24] flex items-center justify-center shrink-0 shadow-sm">
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-[#fbbf24] font-heading flex items-center gap-2">
                        <span>نقاط الطالب اليوم</span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700">
                          {studentPointsToday.toFixed(2).replace(/\.00$/, '')} نقطة
                        </span>
                      </h3>
                      <p className="text-xs text-[#86efac]/80">
                        تُحسب تلقائياً من أوجه التسميع (الجديد والمراجعات) مع إمكانية التعديل والخصم والزيادة من قبل المعلم.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center px-3.5 py-1.5 rounded-2xl bg-[#064e3b] border border-[#fbbf24]/30 text-xs text-amber-200">
                    <Sparkles className="w-4 h-4 text-[#fbbf24]" />
                    <span>رصيد الطالب الإجمالي: <strong className="text-white font-mono font-black text-sm">{activeStudent.points || 0}</strong> نقطة</span>
                  </div>
                </div>

                {/* Main Points Stepper / Counter */}
                <div className="bg-[#011a14] border border-[#065f46] rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center gap-4">
                  <span className="text-xs font-bold text-[#86efac]">
                    العداد اليومي لنقاط الطالب (يمكنك الخصم والزيادة حسب إتقان الطالب):
                  </span>

                  <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-center">
                    {/* Decrement Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setStudentPointsToday(prev => Math.max(0, parseFloat((prev - 1).toFixed(2))));
                          setIsManualPointsModified(true);
                        }}
                        className="px-2.5 sm:px-3 py-2 rounded-xl bg-[#064e3b] hover:bg-rose-950/60 hover:text-rose-300 border border-[#065f46] text-white text-xs font-black transition-all cursor-pointer"
                        title="خصم نقطة واحدة"
                      >
                        -1.0
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setStudentPointsToday(prev => Math.max(0, parseFloat((prev - 0.5).toFixed(2))));
                          setIsManualPointsModified(true);
                        }}
                        className="px-2.5 sm:px-3 py-2 rounded-xl bg-[#064e3b] hover:bg-rose-950/60 hover:text-rose-300 border border-[#065f46] text-white text-xs font-black transition-all cursor-pointer"
                        title="خصم نصف نقطة"
                      >
                        -0.5
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setStudentPointsToday(prev => Math.max(0, parseFloat((prev - 0.25).toFixed(2))));
                          setIsManualPointsModified(true);
                        }}
                        className="px-2.5 sm:px-3 py-2 rounded-xl bg-[#064e3b] hover:bg-rose-950/60 hover:text-rose-300 border border-[#065f46] text-white text-xs font-black transition-all cursor-pointer"
                        title="خصم ربع نقطة"
                      >
                        -0.25
                      </button>
                    </div>

                    {/* Prominent Score Counter Display / Direct Input */}
                    <div className="flex items-center gap-2 bg-[#064e3b] border-2 border-[#fbbf24] rounded-2xl px-4 py-2 shadow-[0_0_20px_rgba(251,191,36,0.25)]">
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        value={studentPointsToday}
                        onChange={e => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          setStudentPointsToday(val);
                          setIsManualPointsModified(true);
                        }}
                        className="w-20 sm:w-24 bg-transparent text-center font-black text-2xl sm:text-3xl text-[#fbbf24] font-mono outline-none"
                      />
                      <span className="text-xs sm:text-sm font-black text-emerald-300 font-heading">
                        نقطة
                      </span>
                    </div>

                    {/* Increment Buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setStudentPointsToday(prev => parseFloat((prev + 0.25).toFixed(2)));
                          setIsManualPointsModified(true);
                        }}
                        className="px-2.5 sm:px-3 py-2 rounded-xl bg-[#064e3b] hover:bg-emerald-700 hover:text-white border border-[#065f46] text-emerald-300 text-xs font-black transition-all cursor-pointer"
                        title="إضافة ربع نقطة"
                      >
                        +0.25
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setStudentPointsToday(prev => parseFloat((prev + 0.5).toFixed(2)));
                          setIsManualPointsModified(true);
                        }}
                        className="px-2.5 sm:px-3 py-2 rounded-xl bg-[#064e3b] hover:bg-emerald-700 hover:text-white border border-[#065f46] text-emerald-300 text-xs font-black transition-all cursor-pointer"
                        title="إضافة نصف نقطة"
                      >
                        +0.5
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setStudentPointsToday(prev => parseFloat((prev + 1).toFixed(2)));
                          setIsManualPointsModified(true);
                        }}
                        className="px-2.5 sm:px-3 py-2 rounded-xl bg-[#064e3b] hover:bg-emerald-700 hover:text-white border border-[#065f46] text-emerald-300 text-xs font-black transition-all cursor-pointer"
                        title="إضافة نقطة واحدة"
                      >
                        +1.0
                      </button>
                    </div>
                  </div>

                  {/* Fast Preset Options and Reset Button */}
                  <div className="flex items-center gap-2 flex-wrap justify-center pt-2 border-t border-[#065f46]/60 w-full">
                    <span className="text-[11px] text-[#86efac]/70">خيارات سريعة:</span>
                    {[0, 0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 5].map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setStudentPointsToday(preset);
                          setIsManualPointsModified(true);
                        }}
                        className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                          studentPointsToday === preset
                            ? 'bg-[#fbbf24] text-[#064e3b] font-black shadow-md'
                            : 'bg-[#064e3b]/80 hover:bg-[#064e3b] text-[#86efac] border border-[#065f46]'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        setStudentPointsToday(calculatedRecitationPoints);
                        setIsManualPointsModified(false);
                      }}
                      className="px-3 py-1 rounded-lg text-xs font-bold bg-[#022c22] hover:bg-[#064e3b] text-[#fbbf24] border border-[#fbbf24]/30 hover:border-[#fbbf24] transition-all cursor-pointer flex items-center gap-1.5 mr-auto"
                      title="استعادة النقاط المحسوبة تلقائياً من أوجه التسميع"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#fbbf24]" />
                      <span>إعادة ضبط للمحسوب ({calculatedRecitationPoints.toFixed(2).replace(/\.00$/, '')})</span>
                    </button>
                  </div>
                </div>

                {/* Detailed Automatic Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-3 rounded-2xl bg-[#064e3b]/50 border border-[#065f46] flex flex-col justify-between gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-300 font-bold">الحفظ الجديد:</span>
                      <span className="text-[#fbbf24] font-mono font-bold">
                        {liveNewFacesCount.toFixed(2).replace(/\.00$/, '')} وجه
                      </span>
                    </div>
                    <div className="text-[11px] text-[#86efac]/80 flex justify-between">
                      <span>نقاط الوجه (×{newPageMultiplier}):</span>
                      <strong className="text-white font-mono">+{liveNewPagePoints.toFixed(2).replace(/\.00$/, '')}</strong>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#064e3b]/50 border border-[#065f46] flex flex-col justify-between gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-300 font-bold">المراجعات:</span>
                      <span className="text-[#fbbf24] font-mono font-bold">
                        {liveReviewFacesCount.toFixed(2).replace(/\.00$/, '')} وجه
                      </span>
                    </div>
                    <div className="text-[11px] text-[#86efac]/80 flex justify-between">
                      <span>نقاط المراجعة (×{reviewPageMultiplier}):</span>
                      <strong className="text-white font-mono">+{liveReviewPagePoints.toFixed(2).replace(/\.00$/, '')}</strong>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#064e3b]/50 border border-[#065f46] flex flex-col justify-between gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-300 font-bold">معايير التقييم والنجوم:</span>
                      <span className="text-amber-300 font-mono font-bold">
                        +{liveCriteriaPoints} نقطة
                      </span>
                    </div>
                    <div className="text-[11px] text-[#86efac]/80 flex justify-between">
                      <span>الحضور ({selectedDateAtt?.status || 'حاضر'}):</span>
                      <strong className="text-white font-mono">{attendancePoints >= 0 ? `+${attendancePoints}` : attendancePoints} نقطة</strong>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-[#064e3b]/80 border border-[#fbbf24]/30 flex flex-col justify-between gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-amber-300 font-bold">الرصيد الكلي:</span>
                      <span className="text-[#fbbf24] font-mono font-black text-sm">
                        {((activeStudent.points || 0) + studentPointsToday).toFixed(2).replace(/\.00$/, '')}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#86efac]/80 flex justify-between">
                      <span>المستحق لليوم:</span>
                      <strong className="text-emerald-300 font-mono">+{studentPointsToday.toFixed(2).replace(/\.00$/, '')}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {saveSuccessMsg && (
                <div className="p-4 rounded-2xl bg-[#fbbf24]/20 border border-[#fbbf24]/40 text-[#fbbf24] text-xs sm:text-sm font-bold text-center animate-fadeIn flex items-center justify-center gap-2">
                  <Check className="w-5 h-5 text-[#fbbf24]" />
                  <span>{saveSuccessMsg}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#065f46]">
                <div className="flex flex-wrap items-center gap-2">
                  {onNavigateToWhatsApp && (
                    <button
                      type="button"
                      onClick={() => onNavigateToWhatsApp(activeStudent.id)}
                      className="px-4 py-3 rounded-2xl bg-[#022c22] hover:bg-[#022c22]/80 border border-[#065f46] text-[#fbbf24] text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Send className="w-4 h-4 text-[#fbbf24]" />
                      <span>رسالة واتساب اليومية</span>
                    </button>
                  )}

                  {onNavigateToBehavior && (
                    <button
                      type="button"
                      onClick={() => onNavigateToBehavior(activeStudent.id)}
                      className="px-4 py-3 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <ShieldAlert className="w-4 h-4 text-amber-400" />
                      <span>تسجيل مخالفة/ملاحظة سلوكية</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  disabled={isSaving || !!activeStudent.isGeneratingPlan || isManualGeneratingPlan}
                  onClick={handleSaveEvaluationRecord}
                  className="px-8 py-3.5 rounded-2xl bg-[#fbbf24] hover:bg-[#f59e0b] disabled:opacity-50 text-[#064e3b] text-sm font-black shadow-[0_0_25px_rgba(251,191,36,0.35)] flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  {isSaving ? (
                    <span>جاري حفظ السجل وتحديث البيانات...</span>
                  ) : (activeStudent.isGeneratingPlan || isManualGeneratingPlan) ? (
                    <span className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#064e3b] animate-spin" />
                      <span>يرجى الانتظار حتى اكتمال خطة الذكاء الاصطناعي...</span>
                    </span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-[#064e3b]" />
                      <span>حفظ التسميع والتقييم وتثبيت مقرر الغد</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Manage Criteria List Modal for Supervisors */}
      {isManageCriteriaListOpen && (
        <div className="fixed inset-0 z-[9998] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg bg-[#064e3b] border-2 border-[#fbbf24]/50 rounded-3xl shadow-2xl flex flex-col max-h-[90vh] my-auto overflow-hidden animate-fadeIn text-right">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[#065f46] shrink-0 bg-[#064e3b]">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-[#fbbf24]/20 border border-[#fbbf24]/40 text-[#fbbf24] flex items-center justify-center">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-heading">
                    إدارة معايير التقييم الخاصة بالمجمع
                  </h3>
                  <p className="text-xs text-[#86efac]/80">
                    خاصة بالمشرفين: إضافة، تعديل، وحذف معايير التقييم
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsManageCriteriaListOpen(false)}
                className="p-1.5 text-[#86efac] hover:text-white rounded-xl cursor-pointer hover:bg-[#022c22]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Criteria List */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* 1. Page Points & Review Points & Listening Criteria Configuration Card */}
              <div className="bg-[#022c22] border-2 border-[#fbbf24]/40 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 border-b border-[#065f46] pb-2">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-[#fbbf24]" />
                    <span className="text-xs font-black text-white font-heading">
                      معايير نقاط الأوجه والاستماع اليومي للمجمع
                    </span>
                  </div>
                  <span className="text-[10px] text-amber-300 font-bold bg-[#064e3b] px-2 py-0.5 rounded-md border border-[#065f46]">
                    تُحسب تلقائياً
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-[#86efac] block mb-1">
                      نقاط الوجه الجديد:
                    </label>
                    <div className="flex items-center gap-1 bg-[#064e3b] p-1.5 rounded-xl border border-[#065f46]">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={newPagePtsState}
                        onChange={e => setNewPagePtsState(Number(e.target.value))}
                        className="w-full bg-transparent text-xs font-black text-white font-mono text-center outline-none"
                      />
                      <span className="text-[10px] text-[#86efac] font-bold shrink-0">نقطة</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#86efac] block mb-1">
                      نقاط وجه المراجعة:
                    </label>
                    <div className="flex items-center gap-1 bg-[#064e3b] p-1.5 rounded-xl border border-[#065f46]">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={reviewPagePtsState}
                        onChange={e => setReviewPagePtsState(Number(e.target.value))}
                        className="w-full bg-transparent text-xs font-black text-white font-mono text-center outline-none"
                      />
                      <span className="text-[10px] text-[#86efac] font-bold shrink-0">نقطة</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-[#86efac] block mb-1">
                      نقاط الاستماع اليومي:
                    </label>
                    <div className="flex items-center gap-1 bg-[#064e3b] p-1.5 rounded-xl border border-[#065f46]">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={listeningPtsState}
                        onChange={e => setListeningPtsState(Number(e.target.value))}
                        className="w-full bg-transparent text-xs font-black text-white font-mono text-center outline-none"
                      />
                      <span className="text-[10px] text-[#86efac] font-bold shrink-0">نقطة</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleSavePagePointsConfig}
                    className="px-3 py-1.5 rounded-xl bg-[#fbbf24] hover:bg-[#f59e0b] text-[#064e3b] font-black text-xs cursor-pointer shadow-sm flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>حفظ معايير نقاط الأوجه</span>
                  </button>
                </div>
              </div>

              {/* 2. Custom Evaluation Criteria */}
              <div className="flex items-center justify-between pb-2 border-t border-[#065f46] pt-3">
                <span className="text-xs font-bold text-[#86efac]">
                  معايير جودة التسميع والتجويد ({displayCriteria.length})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsManageCriteriaListOpen(false);
                    handleOpenAddCriteria();
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-[#fbbf24] hover:bg-[#f59e0b] text-[#064e3b] text-xs font-black flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة معيار جديد</span>
                </button>
              </div>

              {displayCriteria.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#86efac]/70 bg-[#022c22]/60 rounded-2xl border border-[#065f46]">
                  لا توجد معايير مخصصة بعد. اضغط على "إضافة معيار جديد" لإنشاء معايير المجمع.
                </div>
              ) : (
                displayCriteria.map(crit => (
                  <div
                    key={crit.id}
                    className="p-3.5 rounded-2xl bg-[#022c22] border border-[#065f46] flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        <span>{crit.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30">
                          {crit.type === 'score'
                            ? `درجات (من ${crit.maxScore || 10})`
                            : crit.type === 'stars'
                            ? 'نجوم (5 نجوم)'
                            : crit.type === 'options'
                            ? 'خيارات مخصصة'
                            : 'نصي'}
                        </span>
                      </div>
                      {crit.type === 'options' && crit.options && (
                        <div className="text-[11px] text-[#86efac]/70 mt-1">
                          الخيارات: {crit.options.join(' ، ')}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setIsManageCriteriaListOpen(false);
                          handleOpenEditCriteria(crit);
                        }}
                        className="p-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-colors cursor-pointer"
                        title="تعديل المعيار"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsManageCriteriaListOpen(false);
                          setCritToDelete(crit);
                        }}
                        className="p-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 transition-colors cursor-pointer"
                        title="حذف المعيار"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-[#065f46] shrink-0 bg-[#022c22]/95 flex justify-end">
              <button
                type="button"
                onClick={() => setIsManageCriteriaListOpen(false)}
                className="px-5 py-2.5 rounded-2xl bg-[#064e3b] text-[#86efac] hover:text-white border border-[#065f46] text-xs font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Criteria Modal */}
      {isCriteriaModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain">
          <div className="relative w-full max-w-md bg-[#064e3b] border border-[#fbbf24]/40 rounded-2xl sm:rounded-[32px] shadow-2xl flex flex-col max-h-[92vh] my-auto overflow-hidden overscroll-contain animate-fadeIn">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[#065f46] shrink-0 bg-[#064e3b]">
              <h3 className="text-sm sm:text-base font-bold text-[#fbbf24] font-heading">
                {editingCriteriaId ? 'تعديل معيار التقييم' : 'إضافة معيار تقييم جديد'}
              </h3>
              <button
                type="button"
                onClick={() => setIsCriteriaModalOpen(false)}
                className="p-1.5 text-[#86efac] hover:text-white rounded-lg cursor-pointer hover:bg-[#022c22]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCriteriaForm} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-[#86efac] mb-1.5 text-right">
                    اسم المعيار <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newCritName}
                    onChange={e => setNewCritName(e.target.value)}
                    placeholder="مثال: أحكام التجويد، الصوت والترتيل، الآداب"
                    className="w-full bg-[#022c22] border border-[#065f46] focus:border-[#fbbf24] rounded-2xl py-2.5 px-3.5 text-xs text-[#f0f9f6] outline-none"
                    dir="rtl"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#86efac] mb-1.5 text-right">
                    نوع التقييم
                  </label>
                  <select
                    value={newCritType}
                    onChange={e => setNewCritType(e.target.value as CriteriaType)}
                    className="w-full bg-[#022c22] border border-[#065f46] focus:border-[#fbbf24] rounded-2xl py-2.5 px-3.5 text-xs text-[#f0f9f6] outline-none"
                  >
                    <option value="score">تقييم بالدرجات (مثلاً من 10 أو 7 أو 100)</option>
                    <option value="stars">تقييم بالنجوم (1 إلى 5 نجوم)</option>
                    <option value="options">خيارات مخصصة (ممتاز، جيد، إلخ)</option>
                    <option value="text">ملاحظات نصية حرة</option>
                  </select>
                </div>

                {newCritType === 'score' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#86efac] mb-1.5 text-right">
                      الدرجة العظمى (الحد الأقصى)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={newCritMaxScore}
                      onChange={e => setNewCritMaxScore(Number(e.target.value))}
                      className="w-full bg-[#022c22] border border-[#065f46] focus:border-[#fbbf24] rounded-2xl py-2.5 px-3.5 text-xs text-[#f0f9f6] outline-none"
                    />
                  </div>
                )}

                {newCritType === 'options' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#86efac] mb-1.5 text-right">
                      الخيارات المتاحة (افصل بينها بفاصلة ,)
                    </label>
                    <input
                      type="text"
                      value={newCritOptions}
                      onChange={e => setNewCritOptions(e.target.value)}
                      placeholder="مثال: ممتاز, جيد جدا, جيد, ضعيف"
                      className="w-full bg-[#022c22] border border-[#065f46] focus:border-[#fbbf24] rounded-2xl py-2.5 px-3.5 text-xs text-[#f0f9f6] outline-none"
                      dir="rtl"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#86efac] mb-1.5 text-right">
                    النقاط المكتسبة لهذا المعيار (عند الدرجة الكاملة أو 5 نجوم)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={newCritPointsWeight}
                      onChange={e => setNewCritPointsWeight(Number(e.target.value))}
                      className="w-full bg-[#022c22] border border-[#065f46] focus:border-[#fbbf24] rounded-2xl py-2.5 px-3.5 text-xs text-[#fbbf24] font-black outline-none"
                    />
                    <span className="text-xs text-[#86efac] shrink-0 font-bold">نقاط</span>
                  </div>
                  <p className="text-[11px] text-[#86efac]/70 mt-1">
                    خاص بالمشرف: تحدد كم نقطة يستحقها الطالب عند نيل 5 نجوم أو الدرجة الكاملة في هذا المعيار (مثلاً: 10 أو 5 نقاط).
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 p-4 sm:p-5 border-t border-[#065f46] shrink-0 bg-[#022c22]/95">
                <button
                  type="button"
                  onClick={() => setIsCriteriaModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl text-xs font-bold text-[#86efac] hover:bg-[#064e3b] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-2xl bg-[#fbbf24] hover:bg-[#f59e0b] text-[#064e3b] text-xs font-black shadow-md cursor-pointer"
                >
                  {editingCriteriaId ? 'حفظ التعديلات' : 'إضافة المعيار'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Criteria Confirmation Modal */}
      {critToDelete && (
        <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain">
          <div className="relative w-full max-w-sm bg-[#064e3b] border border-red-500/50 rounded-2xl sm:rounded-[32px] p-5 sm:p-6 shadow-2xl space-y-4 text-center my-auto overscroll-contain animate-fadeIn">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto border border-red-500/30">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-heading">تأكيد حذف معيار التقييم</h3>
              <p className="text-xs text-[#86efac]/90 mt-1">
                هل أنت متأكد من رغبتك في حذف معيار <span className="text-[#fbbf24] font-bold">"{critToDelete.name}"</span>؟
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2 flex-col sm:flex-row">
              <button
                type="button"
                onClick={() => setCritToDelete(null)}
                className="w-full sm:flex-1 py-2.5 rounded-2xl text-xs font-bold bg-[#022c22] text-[#86efac] hover:text-white border border-[#065f46] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (critToDelete) {
                    const id = critToDelete.id;
                    setCritToDelete(null);
                    await onDeleteCriteria(id);
                  }
                }}
                className="w-full sm:flex-1 py-2.5 rounded-2xl text-xs font-black bg-red-600 hover:bg-red-700 text-white shadow-lg cursor-pointer transition-all"
              >
                نعم، احذف المعيار
              </button>
            </div>
          </div>
        </div>
      )}

      {/* King Fahd Holy Quran Modal Reader with 2.5s Long-Press Recitation Error Recording */}
      <KingFahdQuranModal
        isOpen={isMushafOpen}
        onClose={() => setIsMushafOpen(false)}
        initialSurah={mushafInitialSurah}
        initialAyah={mushafInitialAyah}
        highlightItems={mushafHighlightItems}
        activeItemId={mushafActiveItemId}
        studentName={activeStudent?.name}
        recordedAyahErrors={mushafAyahErrors}
        onRecordAyahError={handleRecordAyahError}
      />
    </div>
  );
};
