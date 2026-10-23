/**
 * Omran Quran Adaptive Plan & Multi-Shift Capacity Engine
 * Pedagogical Framework:
 * "الهدف ليس السرعة في الختم، بل الختم بتثبيت وإتقان تام"
 * 
 * Implements:
 * 1. 5 Separated Review Streams:
 *    - مراجعة قريبة (Near Review)
 *    - مراجعة تراكمية (Cumulative Review)
 *    - مراجعة علاجية (Remedial Review)
 *    - سور حديثة الإتمام لأسبوعين (Recently Completed Surahs - 2 weeks consolidation buffer)
 *    - حفظ جديد (New Memorization)
 * 2. Day 1 Protocol (no past reviews on day 1)
 * 3. Khatim with gaps/loss (tathbeet & spaced retrieval mode)
 * 4. Hiatus detection (> 30 days absence)
 * 5. Halaqah multi-shift time capacity calculation (~2 min/face + buffer)
 * 6. Plan change audit logging
 */

import {
  Student,
  StudentMemorizationPlan,
  PlanChangeLogEntry,
  Halaqah,
  HalaqahShiftPeriod,
  AyahErrorLog,
  PlacementTestSummary
} from '../types';
import { QURAN_SURAHS, getSurahInfo } from '../data/quranData';
import { getPageOfAyah } from '../data/quranPagesData';

// ============================================================================
// 1. 5 SEPARATED REVIEW STREAMS GENERATOR
// ============================================================================

export interface FiveStreamPlanOutput {
  dayNumber: number;
  isDayOne: boolean;
  newMemorization: {
    surahNumber: number;
    surahName: string;
    fromAyah: number;
    toAyah: number;
    fromPage: number;
    toPage: number;
    facesCount: number;
    notes?: string;
  } | null;
  nearReview: {
    surahNumber: number;
    surahName: string;
    fromPage: number;
    toPage: number;
    facesCount: number;
    description: string;
  } | null;
  cumulativeReview: {
    fromJuz: number;
    toJuz: number;
    fromPage: number;
    toPage: number;
    facesCount: number;
    description: string;
  } | null;
  remedialReview: {
    targetSurahs: Array<{ number: number; name: string }>;
    targetAyahs?: Array<{ surahNumber: number; ayahNumber: number; errorType: string }>;
    facesCount: number;
    description: string;
  } | null;
  recentlyCompletedBuffer: {
    surahs: Array<{ number: number; name: string; completedDaysAgo: number }>;
    description: string;
  } | null;
  estimatedHalaqahMinutesNeeded: number;
}

export interface PlanGenerationInput {
  student: Partial<Student>;
  plan?: Partial<StudentMemorizationPlan>;
  isKhatim?: boolean;
  dayNumber?: number; // 1 = first day
  recentErrors?: AyahErrorLog[];
  completedSurahsInLast14Days?: Array<{ surahNumber: number; completedDate: string }>;
  currentDate?: Date;
}

/**
 * Generates the daily five-stream schedule adhering strictly to Quranic pedagogy
 */
export function generateFiveStreamDailySchedule(input: PlanGenerationInput): FiveStreamPlanOutput {
  const {
    student,
    plan,
    isKhatim = false,
    dayNumber = 1,
    recentErrors = [],
    completedSurahsInLast14Days = [],
    currentDate = new Date()
  } = input;

  const isDayOne = dayNumber === 1;

  // Pace configuration
  const dailyNewPages = plan?.dailyNewPages !== undefined ? plan.dailyNewPages : 1;
  const dailyReviewPages = plan?.dailyReviewPages !== undefined ? plan.dailyReviewPages : 3;
  const currentSurahNum = plan?.currentSurahNumber || (isKhatim ? 1 : 114);
  const currentAyahNum = plan?.currentAyahNumber || 1;

  // 1. DAY 1 PROTOCOL: No past reviews on day 1
  if (isDayOne) {
    const sInfo = getSurahInfo(currentSurahNum);
    const startPage = getPageOfAyah(currentSurahNum, currentAyahNum);

    return {
      dayNumber: 1,
      isDayOne: true,
      newMemorization: {
        surahNumber: currentSurahNum,
        surahName: sInfo.name,
        fromAyah: currentAyahNum,
        toAyah: Math.min(sInfo.numberOfAyahs, currentAyahNum + 5),
        fromPage: startPage,
        toPage: startPage,
        facesCount: 1,
        notes: 'اليوم الأول: بروتوكول البداية والتوجيه - لا توجد مراجعات ماضية في اليوم الأول لضمان التأسيس المتين.'
      },
      nearReview: null,
      cumulativeReview: null,
      remedialReview: null,
      recentlyCompletedBuffer: null,
      estimatedHalaqahMinutesNeeded: 10 // initial orientation & day 1 reading
    };
  }

  // 2. KHATIM WITH GAPS / LOSS: Focus completely on Tathbeet and Spaced Retrieval
  const isKhatimWithGaps = isKhatim && (plan?.pathType === 'tathbeet' || (student.retentionRate && student.retentionRate < 75));

  // Determine New Memorization portion
  let newMemorization: FiveStreamPlanOutput['newMemorization'] = null;
  if (!isKhatimWithGaps && dailyNewPages > 0) {
    const sInfo = getSurahInfo(currentSurahNum);
    const startPage = getPageOfAyah(currentSurahNum, currentAyahNum);
    const endPage = Math.min(604, startPage + Math.ceil(dailyNewPages) - 1);

    newMemorization = {
      surahNumber: currentSurahNum,
      surahName: sInfo.name,
      fromAyah: currentAyahNum,
      toAyah: Math.min(sInfo.numberOfAyahs, currentAyahNum + 7),
      fromPage: startPage,
      toPage: endPage,
      facesCount: dailyNewPages,
      notes: isKhatim ? 'مسار الإتقان العالي وسرد الختمة' : 'مسار الحفظ المتدرج'
    };
  }

  // 3. NEAR REVIEW (المراجعة القريبة: آخر جزء تم حفظه)
  const nearReviewPages = Math.max(2, Math.round(dailyReviewPages * 0.4));
  const nearSurahNum = Math.max(1, currentSurahNum > 1 ? currentSurahNum - 1 : 1);
  const nearPage = Math.max(1, getPageOfAyah(currentSurahNum, 1) - nearReviewPages);

  const nearReview: FiveStreamPlanOutput['nearReview'] = {
    surahNumber: nearSurahNum,
    surahName: getSurahInfo(nearSurahNum).name,
    fromPage: nearPage,
    toPage: nearPage + nearReviewPages - 1,
    facesCount: nearReviewPages,
    description: `مراجعة قريبة لآخر المحفوظ (سورة ${getSurahInfo(nearSurahNum).name}) لتثبيت العهد القريب.`
  };

  // 4. CUMULATIVE REVIEW (المراجعة التراكمية: نافذة دورية عبر الأجزاء المحفوظة)
  const cumulativePages = Math.max(2, Math.round(dailyReviewPages * 0.6));
  const cumulativeReview: FiveStreamPlanOutput['cumulativeReview'] = {
    fromJuz: isKhatim ? ((dayNumber % 30) + 1) : Math.max(1, (plan?.currentJuz || 30) - 2),
    toJuz: isKhatim ? ((dayNumber % 30) + 1) : Math.max(1, (plan?.currentJuz || 30) - 1),
    fromPage: Math.max(1, (dayNumber * 2) % 600),
    toPage: Math.max(1, ((dayNumber * 2) % 600) + cumulativePages),
    facesCount: cumulativePages,
    description: isKhatim
      ? `مراجعة تراكمية منتظمة للجزء رقم ${((dayNumber % 30) + 1)} وفق دورة الختم الشهري.`
      : `مراجعة تراكمية دورية للمحفوظ السابق لضمان عدم التفلت.`
  };

  // 5. REMEDIAL REVIEW (المراجعة العلاجية: معالجة السور الضعيفة وأخطاء المصحف المسجلة)
  let remedialReview: FiveStreamPlanOutput['remedialReview'] = null;
  const weakSurahNums = student.weakSurahs || [];
  const activeErrors = recentErrors.slice(0, 5);

  if (weakSurahNums.length > 0 || activeErrors.length > 0) {
    const targetSurahObjects = weakSurahNums.slice(0, 2).map(n => ({
      number: n,
      name: getSurahInfo(n).name
    }));

    const targetAyahs = activeErrors.map(e => ({
      surahNumber: e.surahNumber,
      ayahNumber: e.ayahNumber,
      errorType: e.errorType
    }));

    remedialReview = {
      targetSurahs: targetSurahObjects,
      targetAyahs: targetAyahs.length > 0 ? targetAyahs : undefined,
      facesCount: 1,
      description: `مراجعة علاجية موجهة لتصحيح ${activeErrors.length > 0 ? `${activeErrors.length} مواضع التبس فيها الحفظ` : 'السور المحددة ذات الصعوبة'}.`
    };
  }

  // 6. RECENTLY COMPLETED BUFFER (سور حديثة الإتمام لأسبوعين: تكرار يومي لمدة 14 يوماً)
  let recentlyCompletedBuffer: FiveStreamPlanOutput['recentlyCompletedBuffer'] = null;
  if (completedSurahsInLast14Days.length > 0) {
    const recentItems = completedSurahsInLast14Days.map(item => {
      const cDate = new Date(item.completedDate);
      const diffMs = Math.abs(currentDate.getTime() - cDate.getTime());
      const daysAgo = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      return {
        number: item.surahNumber,
        name: getSurahInfo(item.surahNumber).name,
        completedDaysAgo: daysAgo
      };
    }).filter(i => i.completedDaysAgo <= 14);

    if (recentItems.length > 0) {
      recentlyCompletedBuffer = {
        surahs: recentItems,
        description: `سور حديثة الإتمام: تخضع لحزام التثبيت المكثف لمدة 14 يوماً متواصلة قبل نقلها للمراجعة التراكمية البعيدة.`
      };
    }
  }

  // Calculate estimated halaqah time needed (~2 min per face + 3 min guidance + 1 min buffer)
  const totalFaces = (newMemorization ? newMemorization.facesCount : 0) +
    nearReview.facesCount +
    cumulativeReview.facesCount +
    (remedialReview ? remedialReview.facesCount : 0);

  const estimatedMinutes = Math.round((totalFaces * 2) + 4);

  return {
    dayNumber,
    isDayOne: false,
    newMemorization,
    nearReview,
    cumulativeReview,
    remedialReview,
    recentlyCompletedBuffer,
    estimatedHalaqahMinutesNeeded: Math.max(10, Math.min(35, estimatedMinutes))
  };
}

// ============================================================================
// 2. HIATUS DETECTION ENGINE (> 30 Days Absence)
// ============================================================================

export interface HiatusStatus {
  isHiatusDetected: boolean;
  hiatusDaysCount: number;
  lastActiveDate: string;
  retrievalSessionRequired: boolean;
  alertMessageArabic: string;
}

/**
 * Checks if student has been absent for more than 30 days
 */
export function checkStudentHiatusStatus(
  student: Partial<Student>,
  referenceDate: Date = new Date()
): HiatusStatus {
  const lastActiveStr = student.lastAttendanceDate || student.updatedAt || student.createdAt || '';
  if (!lastActiveStr) {
    return {
      isHiatusDetected: false,
      hiatusDaysCount: 0,
      lastActiveDate: '',
      retrievalSessionRequired: false,
      alertMessageArabic: ''
    };
  }

  const lastActive = new Date(lastActiveStr);
  const diffMs = referenceDate.getTime() - lastActive.getTime();
  const daysDiff = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  const isHiatusDetected = daysDiff >= 30;

  let alertMessageArabic = '';
  if (isHiatusDetected) {
    alertMessageArabic = `تنبيه انقطاع: الطالب متغيب منذ ${daysDiff} يوماً (أكثر من 30 يوماً). تم تفعيل بروتوكول الاسترجاع التثبيتي وإيقاف الحفظ الجديد حتى اجتياز جلسة الفحص التشخيصي.`;
  }

  return {
    isHiatusDetected,
    hiatusDaysCount: daysDiff,
    lastActiveDate: lastActiveStr,
    retrievalSessionRequired: isHiatusDetected,
    alertMessageArabic
  };
}

// ============================================================================
// 3. HALAQAH MULTI-SHIFT TIME CAPACITY ENGINE (~2 min / face + buffers)
// ============================================================================

export interface HalaqahCapacityReport {
  halaqahId: string;
  shiftPeriod: HalaqahShiftPeriod;
  totalShiftMinutes: number;
  enrolledStudentsCount: number;
  totalRequiredMinutes: number;
  isOverCapacity: boolean;
  overflowMinutes: number;
  remainingMinutes: number;
  maxRecommendedStudents: number;
  perStudentBreakdown: Array<{
    studentId: string;
    studentName: string;
    newFaces: number;
    reviewFaces: number;
    totalTimeNeededMinutes: number;
  }>;
  actionRecommendation: 'accept_ready' | 'overflow_warning' | 'suggest_new_shift' | 'suggest_waiting_list';
}

/**
 * Calculates deterministic halaqah time capacity per student and shift
 */
export function calculateHalaqahTimeCapacity(params: {
  halaqah: Partial<Halaqah>;
  enrolledStudents: Array<Partial<Student>>;
  shiftPeriod?: HalaqahShiftPeriod;
  newStudentCandidateTimeMinutes?: number;
}): HalaqahCapacityReport {
  const { halaqah, enrolledStudents, shiftPeriod = 'afternoon_asr', newStudentCandidateTimeMinutes = 0 } = params;

  // Pace standards
  const pacePerFace = halaqah.pacePerFaceMinutes || 2.0; // standard ~2 mins
  const guidanceBuffer = halaqah.guidanceMinutesPerStudent || 3.0; // standard 3 mins
  const transitionBuffer = halaqah.bufferMinutesBetweenStudents || 1.0; // standard 1 min

  // Shift duration
  const activeShift = halaqah.shifts?.find(s => s.period === shiftPeriod);
  const totalShiftMinutes = activeShift?.durationMinutes || 90; // default 90 mins

  let totalRequiredMinutes = newStudentCandidateTimeMinutes;
  const breakdown: HalaqahCapacityReport['perStudentBreakdown'] = [];

  for (const std of enrolledStudents) {
    const newFaces = std.dailyNewPages || 1;
    const reviewFaces = std.dailyReviewPages || 3;
    const recitationTime = (newFaces * pacePerFace) + (reviewFaces * (pacePerFace * 0.8));
    const totalStudentTime = Math.ceil(recitationTime + guidanceBuffer + transitionBuffer);

    totalRequiredMinutes += totalStudentTime;

    breakdown.push({
      studentId: std.id || '',
      studentName: std.name || 'طالب',
      newFaces,
      reviewFaces,
      totalTimeNeededMinutes: totalStudentTime
    });
  }

  // Average time per student
  const avgStudentMinutes = breakdown.length > 0
    ? Math.round(breakdown.reduce((acc, b) => acc + b.totalTimeNeededMinutes, 0) / breakdown.length)
    : 10;

  const maxRecommendedStudents = Math.max(1, Math.floor(totalShiftMinutes / (avgStudentMinutes || 10)));
  const isOverCapacity = totalRequiredMinutes > totalShiftMinutes;
  const overflowMinutes = isOverCapacity ? totalRequiredMinutes - totalShiftMinutes : 0;
  const remainingMinutes = !isOverCapacity ? totalShiftMinutes - totalRequiredMinutes : 0;

  let actionRecommendation: HalaqahCapacityReport['actionRecommendation'] = 'accept_ready';
  if (isOverCapacity) {
    if (overflowMinutes > 20) {
      actionRecommendation = 'suggest_new_shift';
    } else {
      actionRecommendation = 'suggest_waiting_list';
    }
  } else if (remainingMinutes < avgStudentMinutes) {
    actionRecommendation = 'overflow_warning';
  }

  return {
    halaqahId: halaqah.id || '',
    shiftPeriod,
    totalShiftMinutes,
    enrolledStudentsCount: enrolledStudents.length,
    totalRequiredMinutes,
    isOverCapacity,
    overflowMinutes,
    remainingMinutes,
    maxRecommendedStudents,
    perStudentBreakdown: breakdown,
    actionRecommendation
  };
}

// ============================================================================
// 4. PLAN CHANGE AUDIT LOG ENGINE
// ============================================================================

/**
 * Creates an immutable audit log entry for changes made to a student's plan
 */
export function createPlanChangeLogEntry(params: {
  changedBy: string;
  reason: string;
  previousStateSummary: string;
  newStateSummary: string;
  notes?: string;
}): PlanChangeLogEntry {
  const { changedBy, reason, previousStateSummary, newStateSummary, notes } = params;
  return {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    changedBy,
    reason,
    previousStateSummary,
    newStateSummary,
    notes
  };
}

// ============================================================================
// 5. COMPREHENSIVE ADAPTIVE PROPOSAL FROM PLACEMENT TEST
// ============================================================================

export interface AdaptivePlanProposal {
  studentId: string;
  pathType: 'khatim_itqan' | 'tathbeet' | 'standard_memorization' | 'tajweed_foundation';
  dailyNewPages: number;
  dailyReviewPages: number;
  recommendedHalaqahLevel: string;
  weeklyTargetFaces: number;
  estimatedKhatmMonths: number;
  summaryArabic: string;
  initialStreams: FiveStreamPlanOutput;
}

/**
 * Proposes a tailored Quran plan directly from the 10-question placement test results
 */
export function proposePlanFromPlacementResult(params: {
  studentId: string;
  testSummary: PlacementTestSummary;
  isKhatim: boolean;
  weakSurahs?: number[];
  startingDirection?: 'baqarah_to_nas' | 'nas_to_baqarah';
}): AdaptivePlanProposal {
  const { studentId, testSummary, isKhatim, weakSurahs = [], startingDirection = 'nas_to_baqarah' } = params;

  let pathType: AdaptivePlanProposal['pathType'] = 'standard_memorization';
  let dailyNewPages = 1;
  let dailyReviewPages = 3;
  let recommendedHalaqahLevel = 'متوسط';
  let estimatedKhatmMonths = 24;

  if (isKhatim) {
    if (testSummary.overallScore >= 85 && testSummary.tajweedScore >= 75) {
      pathType = 'khatim_itqan';
      dailyNewPages = 0; // Khatim focuses on Itqan recitations
      dailyReviewPages = 10; // 10 pages / half a juz daily
      recommendedHalaqahLevel = 'خاتم ومتقن';
      estimatedKhatmMonths = 3; // 2-3 months full khatm repetition
    } else {
      pathType = 'tathbeet';
      dailyNewPages = 0;
      dailyReviewPages = 6;
      recommendedHalaqahLevel = 'تثبيت ومراجعة مكثفة';
      estimatedKhatmMonths = 6;
    }
  } else {
    switch (testSummary.classifiedLevel) {
      case 'متقدم':
        pathType = 'standard_memorization';
        dailyNewPages = 2;
        dailyReviewPages = 5;
        recommendedHalaqahLevel = 'متقدم';
        estimatedKhatmMonths = 14;
        break;
      case 'متوسط مرتفع':
      case 'متوسط':
        pathType = 'standard_memorization';
        dailyNewPages = 1;
        dailyReviewPages = 3;
        recommendedHalaqahLevel = 'متوسط';
        estimatedKhatmMonths = 24;
        break;
      case 'مبتدئ واعد':
        pathType = 'standard_memorization';
        dailyNewPages = 0.5;
        dailyReviewPages = 2;
        recommendedHalaqahLevel = 'مبتدئ واعد';
        estimatedKhatmMonths = 36;
        break;
      case 'تأسيسي':
      default:
        pathType = 'tajweed_foundation';
        dailyNewPages = 0.5;
        dailyReviewPages = 1;
        recommendedHalaqahLevel = 'تأسيسي وتجويد';
        estimatedKhatmMonths = 40;
        break;
    }
  }

  // Calculate day 1 streams
  const initialStreams = generateFiveStreamDailySchedule({
    student: { id: studentId, weakSurahs },
    plan: {
      dailyNewPages,
      dailyReviewPages,
      pathType,
      currentSurahNumber: isKhatim ? 1 : (startingDirection === 'baqarah_to_nas' ? 2 : 114),
      currentAyahNumber: 1
    },
    isKhatim,
    dayNumber: 1
  });

  const summaryArabic = `الخطة المقترحة: مسار (${pathType === 'khatim_itqan' ? 'الإتقان العالي وسرد الختمة' : pathType === 'tathbeet' ? 'التثبيت والاسترجاع المتباعد' : pathType === 'tajweed_foundation' ? 'التأسيس النظري والتطبيقي' : 'الحفظ المتدرج'}). المعدل المقترح: ${dailyNewPages > 0 ? `${dailyNewPages} صفحة حفظ جديد يومياً` : 'بدون حفظ جديد (تركيز كامل على التثبيت)'} مع ${dailyReviewPages} صفحات مراجعة متعددة المسارات.`;

  return {
    studentId,
    pathType,
    dailyNewPages,
    dailyReviewPages,
    recommendedHalaqahLevel,
    weeklyTargetFaces: dailyNewPages * 5,
    estimatedKhatmMonths,
    summaryArabic,
    initialStreams
  };
}
