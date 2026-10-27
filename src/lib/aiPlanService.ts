/**
 * Omran Intelligent Quran AI Plan & Placement Engine
 * Powered by Google Gemini 3.8 Flash & Pedagogical Quranic Rules
 * 
 * Enforces the core Quranic pedagogy:
 * "الهدف ليس السرعة في الختم، بل الختم بتثبيت وإتقان تام"
 */

import { Student, StudentMemorizationPlan, Halaqah, QuranComplex, StudentEvaluation, QuranRecitationItem } from '../types';
import { ApiConfig } from './apiConfig';
import { calculatePortionFromPace, SURAH_START_PAGE_MAP } from '../data/quranPagesData';
import { getSurahInfo } from '../data/quranData';
import { OmranAIService } from './omranAIService';

/**
 * Calculates student memorized Juz precisely from currentSurah or memorizedJuzCount/List
 * using King Fahd 604-page Mushaf page boundaries (Surah 1 = page 1, Surah 114 = page 604).
 */
export function calculateStudentMemorizedJuz(student: { currentSurah?: number; memorizedJuzCount?: number; memorizedJuzList?: number[] }): number {
  if (typeof student?.memorizedJuzCount === 'number' && student.memorizedJuzCount > 0) {
    return Math.min(30, Math.max(0, student.memorizedJuzCount));
  }
  if (Array.isArray(student?.memorizedJuzList) && student.memorizedJuzList.length > 0) {
    return Math.min(30, Math.max(0, Math.max(...student.memorizedJuzList)));
  }
  if (student?.currentSurah) {
    const startPage = SURAH_START_PAGE_MAP[student.currentSurah] || 1;
    const currentPagesReached = Math.max(0, startPage - 1);
    return Math.min(30, Math.max(0, Math.floor(currentPagesReached / 20)));
  }
  return 0; // Default: beginner starting from beginning of Quran (0 Juz memorized)
}

export interface DynamicInterviewQuestion {
  questionId: string;
  questionText: string;
  category: 'memorization_depth' | 'tajweed' | 'mutashabihat' | 'psychology_commitment' | 'live_test';
  options?: Array<{ label: string; value: any; subtext?: string }>;
  isLiveRecitationTest?: boolean;
  surahNumber?: number;
  ayahNumber?: number;
  expectedAnswer?: string;
  explanation?: string;
}

export interface DynamicInterviewResponse {
  replyText: string;
  isCompleted: boolean;
  nextQuestion?: DynamicInterviewQuestion;
  aiInsights?: {
    studentLevel: 'مبتدئ' | 'متوسط' | 'متقدم' | 'خاتم ومتقن';
    psychologicalProfile: string;
    commitmentAssessment: string;
    recommendedHalaqahLevel: string;
    suggestedDailyNewPages: number;
    suggestedDailyReviewPages: number;
  };
  generatedPlan?: StudentMemorizationPlan;
}

/**
 * Calculates a 100% realistic, mathematically and pedagogically sound Khatm date
 * taking into account:
 * 1. Remaining pages (604 total)
 * 2. Halaqah operating days per week (e.g. 5 days for Sun-Thu, 3 days for 3-days/week)
 * 3. Daily new pace
 * 4. Periodic mandatory Consolidation Halts (وقفات تثبيت دورية):
 *    - After every 5 Juz: 10 halaqah days of pure revision
 *    - After every 10 Juz: 15 halaqah days of cumulative test
 *    - Final Khatm revision: 25 halaqah days
 */
export function getExactTodayArabicInfo(d: Date = new Date()): {
  dateIso: string;
  dayName: string;
  formattedArabic: string;
  timeArabic: string;
  hijriEstimate: string;
} {
  const dayName = d.toLocaleDateString('ar-SA', { weekday: 'long' });
  const formattedArabic = d.toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const timeArabic = d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  const dateIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  let hijriEstimate = '';
  try {
    hijriEstimate = d.toLocaleDateString('ar-SA-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch {
    hijriEstimate = '';
  }

  return {
    dateIso,
    dayName,
    formattedArabic,
    timeArabic,
    hijriEstimate
  };
}

export function calculateRealisticKhatmTimeline(params: {
  memorizedJuz: number;
  consolidatedJuz?: number;
  dailyNewPages: number;
  dailyReviewPages: number;
  weeklyDaysCount?: number; // e.g. 5
  dailyHoursCount?: number; // e.g. 2
  startDate?: Date | string; // تاريخ اليوم المعتمد للبدء
}): {
  targetCompletionDate: string;
  targetDateObj: Date;
  estimatedDaysRemaining: number;
  estimatedMonths: number;
  progressPercentage: number;
  tathbeetStopsCount: number;
  milestones: Array<{ juz: number; targetDate: string; isCompleted: boolean; label: string }>;
  pedagogicalNote: string;
  calculatedFromDate: string;
} {
  const totalPagesInQuran = 604;
  const memorizedJuz = Math.max(0, Math.min(30, Number(params.memorizedJuz) || 0));
  const consolidatedJuz = Math.max(0, Math.min(memorizedJuz, Number(params.consolidatedJuz) || 0));
  const weeklyDays = Math.max(1, Math.min(7, Number(params.weeklyDaysCount) || 5));
  const dailyNewPages = Math.max(0.25, Math.min(5, Number(params.dailyNewPages) || 1));

  const baseDate = params.startDate ? new Date(params.startDate) : new Date();
  const safeBaseDate = isNaN(baseDate.getTime()) ? new Date() : baseDate;
  const calculatedFromDate = safeBaseDate.toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Current memorized pages approx
  const currentMemorizedPages = memorizedJuz * 20;
  const remainingPages = Math.max(0, totalPagesInQuran - currentMemorizedPages);

  if (remainingPages <= 0) {
    // Student already memorized all 30 Juz (خاتم)! Focus is 100% on Consolidation & Sanad
    const consolidationDays = Math.ceil((30 - consolidatedJuz) * 12);
    const targetDate = new Date(safeBaseDate.getTime());
    targetDate.setDate(targetDate.getDate() + Math.max(60, Math.round((consolidationDays / weeklyDays) * 7)));

    return {
      targetCompletionDate: targetDate.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' }),
      targetDateObj: targetDate,
      estimatedDaysRemaining: Math.round((consolidationDays / weeklyDays) * 7),
      estimatedMonths: Math.max(2, Math.round(((consolidationDays / weeklyDays) * 7) / 30)),
      progressPercentage: 100,
      tathbeetStopsCount: 6,
      milestones: [
        { juz: 10, targetDate: 'بعد شهرين', isCompleted: consolidatedJuz >= 10, label: 'تثبيت الثلث الأول' },
        { juz: 20, targetDate: 'بعد 4 أشهر', isCompleted: consolidatedJuz >= 20, label: 'تثبيت الثلث الثاني' },
        { juz: 30, targetDate: 'ختام الختمة وسرد السند', isCompleted: consolidatedJuz >= 30, label: 'سرد المصحف غيباً كاملاً' },
      ],
      pedagogicalNote: 'الطالب خاتم لكتاب الله المبارك. الخطة تركز بنسبة 100% على تثبيت المتشابهات وضبط الوقف والابتداء والسرد غيباً للحصول على الإجازة والسند المتصل.',
      calculatedFromDate
    };
  }

  // Pure study sessions needed for new memorization
  const sessionsNeededForNew = Math.ceil(remainingPages / dailyNewPages);

  // Mandatory Tathbeet halts:
  // Every 5 Juz passed triggers a halt for pure consolidation
  const remainingJuz = Math.ceil(remainingPages / 20);
  const fiveJuzStops = Math.floor(remainingJuz / 5);
  const tenJuzStops = Math.floor(remainingJuz / 10);
  
  const haltSessions = (fiveJuzStops * 8) + (tenJuzStops * 12) + 20; // 20 sessions for final Khatm revision
  const totalHalaqahSessions = sessionsNeededForNew + haltSessions;

  // Convert sessions to calendar days using weekly days (e.g. 5 halaqah days per 7 calendar days)
  const calendarDays = Math.ceil((totalHalaqahSessions / weeklyDays) * 7);

  const targetDate = new Date(safeBaseDate.getTime());
  targetDate.setDate(targetDate.getDate() + calendarDays);

  const estimatedMonths = Math.max(1, Math.round(calendarDays / 30.5));
  const progressPercentage = Math.min(99, Math.round((currentMemorizedPages / totalPagesInQuran) * 100));

  // Compute milestones for each remaining 5 Juz
  const milestones: Array<{ juz: number; targetDate: string; isCompleted: boolean; label: string }> = [];
  let accumJuz = memorizedJuz;
  let accumDays = 0;
  while (accumJuz < 30) {
    const nextJuz = Math.min(30, accumJuz + 5);
    const juzSpan = nextJuz - accumJuz;
    const pagesSpan = juzSpan * 20;
    const spanSessions = Math.ceil(pagesSpan / dailyNewPages) + 8;
    const spanDays = Math.ceil((spanSessions / weeklyDays) * 7);
    accumDays += spanDays;

    const mDate = new Date(safeBaseDate.getTime());
    mDate.setDate(mDate.getDate() + accumDays);

    milestones.push({
      juz: nextJuz,
      targetDate: mDate.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short' }),
      isCompleted: false,
      label: `إتقان وتثبيت حتى الجزء ${nextJuz}`
    });
    accumJuz = nextJuz;
  }

  const targetDateStr = targetDate.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const pedagogicalNote = `حُسب موعد الختم ابتداءً من تاريخ اليوم المعتمد (${calculatedFromDate}) بواقع (${weeklyDays} أيام أسبوعياً) مع تضمين ${fiveJuzStops + tenJuzStops + 1} وقفات تثبيت ومراجعة تراكمية لضمان رسوخ الحفظ وعدم التفلت، تحقيقاً لقاعدة: "الختم بتثبيت خير من التعجل بالتفلت".`;

  return {
    targetCompletionDate: targetDateStr,
    targetDateObj: targetDate,
    estimatedDaysRemaining: calendarDays,
    estimatedMonths,
    progressPercentage,
    tathbeetStopsCount: fiveJuzStops + tenJuzStops + 1,
    milestones,
    pedagogicalNote,
    calculatedFromDate
  };
}

/**
 * Adaptive Monthly AI Progression Analyzer
 * Evaluates student recitation history over ~3-4 weeks (or 8+ evaluations):
 * - If the student has progressed with excellence (high avg score >= 8.5, low errors <= 2, good attendance),
 *   the AI recommends elevating their daily new target by +0.5 page (e.g. from 0.5 to 1.0 page)!
 * - If performance is still developing or struggling ("مش ولا بد"), it maintains current pace with reinforcement notes.
 */
export function analyzeMonthlyProgression(
  evaluations: any[] = [],
  currentDailyNewPages: number = 0.5,
  ayahErrorsCount: number = 0
): {
  shouldIncreasePace: boolean;
  recommendedPace: number;
  reasoning: string;
  isStruggling: boolean;
  evaluationsCount: number;
  daysSpan: number;
} {
  const currentPace = Math.max(0.25, Number(currentDailyNewPages) || 0.5);
  if (!Array.isArray(evaluations) || evaluations.length < 3) {
    return {
      shouldIncreasePace: false,
      recommendedPace: currentPace,
      reasoning: 'الفترة المسجلة ما زالت في بدايتها؛ الاستمرار في الورد الحالي لضمان التأسيس والتثبيت.',
      isStruggling: false,
      evaluationsCount: evaluations?.length || 0,
      daysSpan: 0
    };
  }

  const validDates = evaluations
    .map(e => e.date ? new Date(e.date).getTime() : 0)
    .filter(t => t > 0)
    .sort((a, b) => a - b);
  const daysSpan = validDates.length >= 2
    ? Math.round((validDates[validDates.length - 1] - validDates[0]) / (1000 * 60 * 60 * 24))
    : evaluations.length * 2;

  let totalScoreSum = 0;
  let scoreCount = 0;
  evaluations.forEach(ev => {
    if (ev.criteriaValues && typeof ev.criteriaValues === 'object') {
      Object.values(ev.criteriaValues).forEach((val: any) => {
        if (typeof val === 'number') {
          totalScoreSum += val;
          scoreCount++;
        }
      });
    }
  });

  const avgScore = scoreCount > 0 ? (totalScoreSum / scoreCount) : 8.5;
  const isStruggling = avgScore < 7.2 || ayahErrorsCount >= 3;
  // Excelling if consistent high scores, low errors, and at least 5 sessions
  const isExcelling = avgScore >= 8.5 && ayahErrorsCount <= 1 && (evaluations.length >= 5 || daysSpan >= 14);

  if (isExcelling) {
    const recommendedPace = Math.min(3.0, currentPace + 0.5);
    return {
      shouldIncreasePace: true,
      recommendedPace,
      reasoning: `🌟 ترقية استثنائية بالذكاء الاصطناعي: أظهر الطالب تفوقاً والتزاماً عالياً على مدار (${evaluations.length} جلسة خلال قرابة ${Math.max(1, Math.round(daysSpan / 30))} شهر) بمتوسط تقييم ممتاز (${avgScore.toFixed(1)}/10)؛ يوصي الذكاء الاصطناعي برفع ورد الحفظ اليومي بمقدار (نصف وجه إضافي) ليصبح (${recommendedPace} وجه) لمواكبة تطوره وإتقانه.`,
      isStruggling: false,
      evaluationsCount: evaluations.length,
      daysSpan
    };
  }

  if (isStruggling) {
    return {
      shouldIncreasePace: false,
      recommendedPace: currentPace,
      reasoning: `مستوى الطالب يحتاج مزيداً من التثبيت والتكرار (متوسط التقييم ${avgScore.toFixed(1)}/10 مع وجود ملاحظات)؛ تقرر الإبقاء على المقدار الحالي (${currentPace} وجه) مع تكثيف المراجعة التراكمية، عملاً بقاعدة: «الختم بتثبيت خير من التعجل بالتفلت».`,
      isStruggling: true,
      evaluationsCount: evaluations.length,
      daysSpan
    };
  }

  return {
    shouldIncreasePace: false,
    recommendedPace: currentPace,
    reasoning: `أداء الطالب منتظم ومستقر؛ الاستمرار في الورد الحالي (${currentPace} وجه) مع المراجعة الموازية حتى تمام ترسيخ المحفوظ.`,
    isStruggling: false,
    evaluationsCount: evaluations.length,
    daysSpan
  };
}

/**
 * Async AI progression caller that queries Gemini API with pedagogical fallback
 */
export async function evaluateMonthlyProgressionWithGemini(
  student: Student,
  evaluations: any[] = [],
  ayahErrors: any[] = []
): Promise<{
  shouldIncreasePace: boolean;
  recommendedPace: number;
  reasoning: string;
  isStruggling: boolean;
  pedagogicalAdvice: string;
}> {
  return executeMonthlyProgressionAnalysis({
    student,
    evaluations: evaluations as StudentEvaluation[],
    ayahErrors: ayahErrors as QuranRecitationItem[]
  });
}

export async function executeMonthlyProgressionAnalysis(params: {
  student: Student;
  evaluations: StudentEvaluation[];
  ayahErrors: QuranRecitationItem[];
}): Promise<{
  shouldIncreasePace: boolean;
  recommendedPace: number;
  reasoning: string;
  isStruggling: boolean;
  pedagogicalAdvice: string;
}> {
  const { student, evaluations, ayahErrors } = params;
  const currentPace = student.memorizationPlan?.dailyNewPages || 
    (student.dailyNewTarget?.includes('وجهين') ? 2.0 :
     student.dailyNewTarget?.includes('ربع') ? 0.25 :
     student.dailyNewTarget?.includes('وجه واحد') ? 1.0 : 0.5);

  const localRes = analyzeMonthlyProgression(evaluations, currentPace, ayahErrors.length);

  // 1. Direct Client-side Execution via OmranAIService (works on Netlify & static hosting)
  try {
    const config = await OmranAIService.loadConfig();
    if (config.masterApiKey || config.groupAllocations.some(g => g.isEnabled && g.apiKey)) {
      const prompt = `أنت الموجه القرآني والتربوي الذكي في منصة عمران لتحفيظ القرآن الكريم.
المطلوب تحليل مستوى تقدم الطالب القرآني وتحديد مدى استحقاقه لزيادة مقدار الحفظ اليومي (الترقية التدريجية) وفق القواعد التربوية القرآنية:
- «الختم بتثبيت خير من التعجل بالتفلت»
- إذا كان الطالب متميزاً وثابتاً (متوسط درجاته 9 فأعلى والأخطاء قليلة جداً) يقترح زيادة نصف وجه.
- إذا كان يعاني من تفلت أو أخطاء، يوصى بالبقاء على ورده أو تكثيف المراجعة.

بيانات الطالب: ${student.name}، الورد الحالي: ${currentPace} وجه.
عدد التقييمات المسجلة: ${evaluations.length} تقييم، عدد أخطاء الآيات: ${ayahErrors.length}.
النتيجة الحسابية الأولية: ${JSON.stringify(localRes)}

أعد إجابتك حصراً بصيغة JSON بالمفاتيح التالية:
{
  "shouldIncreasePace": boolean,
  "recommendedPace": number,
  "reasoning": "نص التوجيه التربوي والتعليل باللغة العربية",
  "isStruggling": boolean,
  "pedagogicalAdvice": "نصيحة بيداغوجية موجهة للمعلم والطالب"
}`;
      const aiRes = await OmranAIService.generateContent({
        prompt,
        role: 'teachers',
        jsonMode: true,
        temperature: 0.3
      });
      if (aiRes.success && aiRes.text) {
        try {
          const parsed = JSON.parse(aiRes.text.replace(/```json\n?|\n?```/g, '').trim());
          if (parsed && typeof parsed.shouldIncreasePace === 'boolean') {
            return parsed;
          }
        } catch {}
      }
    }
  } catch (directErr) {
    console.warn('Direct AI progression notice:', directErr);
  }

  // 2. Server Proxy Fallback (if server.ts is active)
  try {
    const res = await fetch(ApiConfig.getEndpoint('/api/gemini/analyze-monthly-progression'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student,
        evaluations,
        ayahErrors,
        currentPace
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data.shouldIncreasePace === 'boolean') {
        return data;
      }
    }
  } catch (err) {
    console.warn('Backend monthly progression note, using pedagogical engine:', err);
  }

  return {
    shouldIncreasePace: localRes.shouldIncreasePace,
    recommendedPace: localRes.recommendedPace,
    reasoning: localRes.reasoning,
    isStruggling: localRes.isStruggling,
    pedagogicalAdvice: localRes.reasoning
  };
}

/**
 * Runs a dynamic turn of the AI placement interview
 * Direct client-side Google Gemini integration + Server Fallback + Pedagogical Engine
 */
export async function executeDynamicInterviewTurn(params: {
  studentInitialData: {
    studentName: string;
    age: number;
    memorizedJuzList: number[];
    notes?: string;
  };
  complex: QuranComplex;
  turnIndex: number;
  chatHistory: Array<{ sender: 'ai' | 'user'; text: string }>;
  lastUserAnswer?: string;
  accumulatedData: {
    memorizedCount: number;
    consolidatedCount: number;
    tajweedScore: number;
    hasIjazah: boolean;
    goal: string;
    dailyNewPages: number;
    dailyReviewPages: number;
  };
}): Promise<DynamicInterviewResponse> {
  const { studentInitialData, complex, turnIndex, accumulatedData, lastUserAnswer } = params;
  const isKhatim = (studentInitialData.memorizedJuzList?.length || 0) >= 30 || accumulatedData.memorizedCount >= 30;
  const isBeginner = (studentInitialData.memorizedJuzList?.length || 0) <= 2;
  const isChild = studentInitialData.age <= 11;

  // 1. Direct Client-side Execution via OmranAIService (works seamlessly on Netlify without server!)
  try {
    const config = await OmranAIService.loadConfig();
    if (config.masterApiKey || config.groupAllocations.some(g => g.isEnabled && g.apiKey)) {
      const prompt = `أنت «المساعد القرآني والتربوي الذكي» لمجمع «${complex.name}».
قم بإجراء الجولة رقم (${turnIndex}) من المقابلة التشخيصية لتحديد موضع الحفظ ومستوى الإتقان للطالب:
بيانات الطالب: ${JSON.stringify(studentInitialData)}
البيانات التراكمية: ${JSON.stringify(accumulatedData)}
آخر إجابة من الطالب: "${lastUserAnswer || 'بداية المقابلة'}"
تاريخ المحادثة: ${JSON.stringify(params.chatHistory.slice(-4))}
الحالة: خاتم=${isKhatim}، مبتدئ=${isBeginner}، طفل=${isChild}.

قواعد:
1. الجولة 1: الترحيب وسؤال الطالب أين وصل في سور القرآن الكريم (سورة وآية).
2. الجولة 2: للخاتم سؤاله هل يحب البدء من البقرة أم من الناس، ولغير الخاتم سؤاله عن اتجاه حفظه.
3. الجولات اللاحقة: فحص تجويدي أو متشابهات أو قياس الهمة، وخيارات متباينة غير مكررة.
4. الجولة 5: خاتمة المقابلة وإعلان التسكين وخطة الحفظ المقترحة (isCompleted: true).

أعد الإجابة بصيغة JSON حصراً:
{
  "replyText": "النص التشجيعي والتربوي",
  "isCompleted": boolean,
  "nextQuestion": {
    "questionId": "q_id",
    "questionText": "نص السؤال",
    "category": "memorization_depth",
    "options": [
      { "label": "خيار 1", "value": "val1", "subtext": "توضيح" },
      { "label": "خيار 2", "value": "val2", "subtext": "توضيح" }
    ]
  },
  "aiInsights": {
    "studentLevel": "متوسط",
    "psychologicalProfile": "...",
    "commitmentAssessment": "ممتاز",
    "recommendedHalaqahLevel": "...",
    "suggestedDailyNewPages": 1,
    "suggestedDailyReviewPages": 5
  }
}`;
      const aiRes = await OmranAIService.generateContent({
        prompt,
        role: 'public_placement',
        jsonMode: true,
        temperature: 0.4
      });
      if (aiRes.success && aiRes.text) {
        try {
          const parsed = JSON.parse(aiRes.text.replace(/```json\n?|\n?```/g, '').trim());
          if (parsed && parsed.replyText) {
            return parsed as DynamicInterviewResponse;
          }
        } catch {}
      }
    }
  } catch (directErr) {
    console.warn('Direct AI placement execution note:', directErr);
  }

  // 2. Server Proxy Fallback (if backend is running)
  try {
    const res = await fetch(ApiConfig.getEndpoint('/api/gemini/dynamic-placement-turn'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentInitialData,
        complexName: complex.name,
        turnIndex,
        chatHistory: params.chatHistory.slice(-6),
        lastUserAnswer,
        accumulatedData,
        isKhatim,
        isBeginner,
        isChild
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.replyText) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Backend dynamic interview call note, using pedagogical engine fallback:', err);
  }

  // 3. Smart Pedagogical Fallback Engine tailored to student profile!
  return getPedagogicalTurnFallback(params);
}

// Helper to shuffle options so correct answer is NOT always option A or index 0!
export function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 2-Week Post-Completion Daily Consolidation Rule:
 * "والسورة اللي يخلصها خليها قاعدة عنده مثلا الطالب عليه مراجعة اليوم ١٠ اوجه يحط معاها اليوم مثلا هو لسه مخلص سورة جديد يخليه يراجعها بشكل يومي لمدة اسبوعين"
 * "طيب في الاسبوعين لا والله خلص سورتين يصبح ينوع مرة ده ومرة ده واللي مثبتة اكثر تكون مراتها قليلة بعكس اللي اخطاءها كثيرة"
 * "طيب لو قصار السور لا هنا يجمعهم مش هيسمعها لوحدها مثلا لا بالاضافة الى المراجعة هيسمع اخر السور اللي حفظها اخر اسبوعين بحيث يثبت بالاضافة الى المراجعة الغير مثبتة والتي يحددها ال ai"
 */
export function calculateRecentlyCompletedSurahsReview(params: {
  recentlyCompletedSurahs?: Array<{
    surahNumber: number;
    surahName: string;
    completedDate: string;
    errorCount?: number;
    totalAyahs?: number;
  }>;
  currentDate?: string;
  activeErrorsMap?: Record<string, number>;
}): {
  reviewItems: any[];
  summaryNote: string;
} {
  const { recentlyCompletedSurahs = [], currentDate = new Date().toISOString().split('T')[0], activeErrorsMap = {} } = params;
  if (!recentlyCompletedSurahs || recentlyCompletedSurahs.length === 0) {
    return { reviewItems: [], summaryNote: '' };
  }

  const nowMs = new Date(currentDate).getTime();
  const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;

  // Filter surahs completed within the last 14 days
  const activeCompleted = recentlyCompletedSurahs.filter(s => {
    if (!s.completedDate) return true;
    const compMs = new Date(s.completedDate).getTime();
    return !isNaN(compMs) && (nowMs - compMs) <= twoWeeksMs;
  });

  if (activeCompleted.length === 0) {
    return { reviewItems: [], summaryNote: '' };
  }

  // Split into Short Surahs (قصار السور <= 15 verses or Juz Amma surahs 90-114) vs Regular Surahs
  const shortSurahs = activeCompleted.filter(s => s.surahNumber >= 90 || (s.totalAyahs && s.totalAyahs <= 15));
  const regularSurahs = activeCompleted.filter(s => s.surahNumber < 90 && (!s.totalAyahs || s.totalAyahs > 15));

  const items: any[] = [];
  const notes: string[] = [];

  // RULE A: Short surahs are CLUSTERED together as a single unified group, never a 3-verse surah alone!
  if (shortSurahs.length > 0) {
    const surahNames = shortSurahs.map(s => `سورة ${s.surahName}`).join('، ');
    const minS = Math.min(...shortSurahs.map(s => s.surahNumber));
    const maxS = Math.max(...shortSurahs.map(s => s.surahNumber));
    const firstInfo = getSurahInfo(minS);
    const lastInfo = getSurahInfo(maxS);

    items.push({
      id: `two_week_qisar_${Date.now()}`,
      type: 'تثبيت السور حديثة الحفظ',
      surahNumber: minS,
      surahName: shortSurahs.length === 1 ? firstInfo.name : `باقة قصار السور (${shortSurahs.length} سور)`,
      fromAyah: 1,
      toSurahNumber: maxS,
      toSurahName: lastInfo.name,
      toAyah: lastInfo.numberOfAyahs,
      isFullSurah: true,
      notes: `تثبيت ومراجعة قصار السور المنجزة خلال الأسبوعين الماضيين (${surahNames}) لربطها وتثبيتها بالصدر.`
    });
    notes.push(`تثبيت باقة قصار السور حديثة الحفظ: ${surahNames}`);
  }

  // RULE B: Regular surahs
  if (regularSurahs.length === 1) {
    const s = regularSurahs[0];
    const sInfo = getSurahInfo(s.surahNumber);
    items.push({
      id: `two_week_reg_${Date.now()}_${s.surahNumber}`,
      type: 'تثبيت السور حديثة الحفظ',
      surahNumber: s.surahNumber,
      surahName: sInfo.name,
      fromAyah: 1,
      toSurahNumber: s.surahNumber,
      toSurahName: sInfo.name,
      toAyah: sInfo.numberOfAyahs,
      isFullSurah: true,
      notes: `قاعدة التثبيت اليومي للسورة حديثة الإتمام (لمدة أسبوعين) لسورة ${sInfo.name} لترسيخها بعد الختام.`
    });
    notes.push(`تثبيت سورة ${sInfo.name} يومياً لمدة أسبوعين من تاريخ إتمامها.`);
  } else if (regularSurahs.length >= 2) {
    // Calculate error counts for each surah
    const scoredSurahs = regularSurahs.map(s => {
      let errs = s.errorCount || 0;
      Object.entries(activeErrorsMap).forEach(([key, count]) => {
        if (key.startsWith(`${s.surahNumber}:`)) {
          errs += count;
        }
      });
      return { ...s, totalErrors: errs };
    });

    // Sort descending by error count: more errors = higher priority!
    scoredSurahs.sort((a, b) => b.totalErrors - a.totalErrors);

    // Pick the most error-prone for today, while logging alternation
    const chosenSurah = scoredSurahs[0];
    const secondarySurah = scoredSurahs[1];
    const cInfo = getSurahInfo(chosenSurah.surahNumber);
    const sInfo = getSurahInfo(secondarySurah.surahNumber);

    items.push({
      id: `two_week_alt_${Date.now()}_${chosenSurah.surahNumber}`,
      type: 'تثبيت السور حديثة الحفظ',
      surahNumber: chosenSurah.surahNumber,
      surahName: cInfo.name,
      fromAyah: 1,
      toSurahNumber: chosenSurah.surahNumber,
      toSurahName: cInfo.name,
      toAyah: cInfo.numberOfAyahs,
      isFullSurah: true,
      notes: `تنويع السور حديثة الإتمام (أسبوعين): تم ترجيح سورة ${cInfo.name} اليوم لكثرة أخطائها (${chosenSurah.totalErrors} خطأ) لضبطها، بالتناوب مع سورة ${sInfo.name}.`
    });
    notes.push(`تنويع السور حديثة الإتمام: مراجعة سورة ${cInfo.name} اليوم مع جدولة سورة ${sInfo.name} بالتناوب.`);
  }

  return {
    reviewItems: items,
    summaryNote: notes.join(' • ')
  };
}

/**
 * Intelligent Ayah Error Tracking & Distribution Engine:
 * "وعايزه يتبع يعني الاخطاء اللي يحطها المعلم ولو لاحظ تحسن والله في التاريخ الفلااني كان عنده خطأ في الاية ده بس انلهارده لا بس السورة الثانية لا والله اكثر الاخطاء زي ماهي فيزود على السورة الثانية... مش هيخليها كلها في يوم واحد لا يخلي مثلا كم خطأ كل يوم بحيث يخلص السور الضعيفة اللي عنده في اقرب مدة"
 */
export function analyzeAndDistributeAyahErrors(params: {
  existingErrors: any[];
  todayEvaluatedRange?: { fromSurah: number; fromAyah: number; toSurah: number; toAyah: number };
  todayReportedErrors?: Record<string, number>;
  dailyMaxErrorVerses?: number;
}): {
  updatedErrorsList: any[];
  improvedCount: number;
  targetedReviewItem: any | null;
  rationale: string;
} {
  const {
    existingErrors = [],
    todayEvaluatedRange,
    todayReportedErrors = {},
    dailyMaxErrorVerses = 3
  } = params;

  let improvedCount = 0;
  const updatedErrorsList: any[] = [];

<<<<<<< HEAD
  // 1. Sync existing errors with authoritative active Mushaf errors (todayReportedErrors)
=======
  // 1. Check each past error: did today's recitation cover it without error?
>>>>>>> fe1326044c44ff41cee71f10bb01b26f4533f2d4
  existingErrors.forEach(err => {
    const s = Number(err.surahNumber);
    const a = Number(err.ayahNumber);
    const key = `${s}:${a}`;

    const wasRecitedToday = todayEvaluatedRange &&
      todayEvaluatedRange.fromSurah === s &&
      todayEvaluatedRange.toSurah === s &&
      a >= todayEvaluatedRange.fromAyah &&
      a <= todayEvaluatedRange.toAyah;

<<<<<<< HEAD
    const reportedCount = todayReportedErrors[key] || 0;
    const hadErrorToday = reportedCount > 0;

    if (hadErrorToday) {
      // Active error currently marked in this student's personal Mushaf
      updatedErrorsList.push({
        ...err,
        errorCount: reportedCount,
        lastErrorDate: new Date().toISOString(),
        cleared: false
      });
    } else if (err.cleared) {
      // Already cleared previously — never resurrect!
      updatedErrorsList.push({
        ...err,
        errorCount: 0,
        cleared: true
      });
    } else if (wasRecitedToday) {
      // Recited today without error — improved!
      improvedCount++;
      updatedErrorsList.push({
        ...err,
        errorCount: 0,
=======
    const hadErrorToday = todayReportedErrors[key] !== undefined && todayReportedErrors[key] > 0;

    if (wasRecitedToday && !hadErrorToday) {
      // Improved!
      improvedCount++;
      updatedErrorsList.push({
        ...err,
>>>>>>> fe1326044c44ff41cee71f10bb01b26f4533f2d4
        cleared: true,
        improvedDate: new Date().toISOString(),
        notes: 'تحسن الطالب في هذا الموضع وتم التثبيت بنجاح'
      });
    } else {
<<<<<<< HEAD
      // Removed by teacher from Mushaf badge (not in todayReportedErrors)
      updatedErrorsList.push({
        ...err,
        errorCount: 0,
        cleared: true,
        improvedDate: new Date().toISOString()
=======
      const additionalCount = todayReportedErrors[key] || 0;
      updatedErrorsList.push({
        ...err,
        errorCount: (err.errorCount || 1) + additionalCount,
        lastErrorDate: hadErrorToday ? new Date().toISOString() : err.lastErrorDate,
        cleared: false
>>>>>>> fe1326044c44ff41cee71f10bb01b26f4533f2d4
      });
    }
  });

  // Add any brand new errors from today
  Object.entries(todayReportedErrors).forEach(([key, count]) => {
    if (count > 0) {
      const [s, a] = key.split(':').map(Number);
<<<<<<< HEAD
      const existingIdx = updatedErrorsList.findIndex(e => Number(e.surahNumber) === s && Number(e.ayahNumber) === a);
      if (existingIdx >= 0) {
        updatedErrorsList[existingIdx] = {
          ...updatedErrorsList[existingIdx],
          errorCount: count,
          cleared: false,
          lastErrorDate: new Date().toISOString()
        };
      } else {
=======
      const alreadyIn = updatedErrorsList.some(e => e.surahNumber === s && e.ayahNumber === a);
      if (!alreadyIn) {
>>>>>>> fe1326044c44ff41cee71f10bb01b26f4533f2d4
        updatedErrorsList.push({
          id: `err_${Date.now()}_${s}_${a}`,
          surahNumber: s,
          ayahNumber: a,
          surahName: getSurahInfo(s).name,
          errorCount: count,
          lastErrorDate: new Date().toISOString(),
          cleared: false
        });
      }
    }
  });

  // 2. Identify active / uncleared errors grouped by surah
  const activeErrors = updatedErrorsList.filter(e => !e.cleared && e.errorCount > 0);
  if (activeErrors.length === 0) {
    return {
      updatedErrorsList,
      improvedCount,
      targetedReviewItem: null,
      rationale: improvedCount > 0 ? `ما شاء الله، تم معالجة وتثبيت (${improvedCount}) مواضع أخطاء سابقة بنجاح اليوم!` : 'لا توجد أخطاء مرصودة.'
    };
  }

  // Count active errors per surah to find which surah has lingering/repeated errors
  const surahErrorMap: Record<number, { count: number; ayahs: number[]; surahName: string }> = {};
  activeErrors.forEach(e => {
    if (!surahErrorMap[e.surahNumber]) {
      surahErrorMap[e.surahNumber] = {
        count: 0,
        ayahs: [],
        surahName: e.surahName || getSurahInfo(e.surahNumber).name
      };
    }
    surahErrorMap[e.surahNumber].count += e.errorCount || 1;
    surahErrorMap[e.surahNumber].ayahs.push(e.ayahNumber);
  });

  // Sort surahs by error count descending
  const sortedSurahs = Object.entries(surahErrorMap).sort((a, b) => b[1].count - a[1].count);
  const highestSurahEntry = sortedSurahs[0];
  const targetSurahNum = Number(highestSurahEntry[0]);
  const targetSurahData = highestSurahEntry[1];

  // Pick up to dailyMaxErrorVerses (e.g. 2-3 ayahs)
  const targetAyahs = targetSurahData.ayahs.slice(0, dailyMaxErrorVerses);
  const minA = Math.min(...targetAyahs);
  const maxA = Math.max(...targetAyahs);
  const sInfo = getSurahInfo(targetSurahNum);

  const fromRange = Math.max(1, minA - 1);
  const toRange = Math.min(sInfo.numberOfAyahs, maxA + 1);

  const targetedReviewItem = {
    id: `err_target_${Date.now()}`,
    type: 'تثبيت الأخطاء ومواضع الضعف',
    surahNumber: targetSurahNum,
    surahName: sInfo.name,
    fromAyah: fromRange,
    toSurahNumber: targetSurahNum,
    toSurahName: sInfo.name,
    toAyah: toRange,
    isFullSurah: false,
    notes: `معالجة مواضع الضعف المسجلة من المعلم في سورة ${sInfo.name} (الآيات ${targetAyahs.join('، ')}) بالتدرج اليومي لتصفية الأخطاء دون إرهاق.`
  };

  const rationale = `لوحظ وجود أخطاء متكررة في سورة ${sInfo.name} (${targetSurahData.count} أخطاء)؛ تم جدولة (${targetAyahs.length}) آيات لغد لمعالجتها وتثبيتها بالتدريج.${improvedCount > 0 ? ` (مع تسجيل تحسن في ${improvedCount} مواضع أخرى).` : ''}`;

  return {
    updatedErrorsList,
    improvedCount,
    targetedReviewItem,
    rationale
  };
}

/**
 * Unified Adaptive Daily Review Planner Engine:
 * Generates the complete review schedule for Today or Tomorrow according to the pedagogical rules:
 * 1. Day 1 protocol: No reviews on the first day (new recitation only); tomorrow begins with what was recited today.
 * 2. Day 2+: Yesterday's recitation review item + Continuous Review Quota (from An-Nas or Al-Baqarah).
 * 3. Two-week daily consolidation for recently completed surahs (short surahs clustered, 2+ surahs alternated by errors).
 * 4. Progressive weak-point / error targeting (2-3 ayahs per day from the weakest surah).
 */
export function generateAdaptiveDailyReviews(params: {
  student: Student;
  evaluationsHistory: StudentEvaluation[];
  isTomorrow?: boolean;
  todayRecitedPortion?: {
    fromSurah: number;
    fromAyah: number;
    toSurah: number;
    toAyah: number;
  };
  mushafErrors?: Record<string, number>;
}): {
  reviewItems: QuranRecitationItem[];
  rationaleNotes: string[];
  targetedErrorItem?: QuranRecitationItem | null;
  recentlyCompletedReviewItem?: QuranRecitationItem | null;
} {
  const { student, evaluationsHistory = [], isTomorrow = false, todayRecitedPortion, mushafErrors = {} } = params;
  const isFirstDay = student.isFirstSession || evaluationsHistory.length === 0;
  const rationaleNotes: string[] = [];
  const reviewItems: QuranRecitationItem[] = [];

  // RULE 1: First Day Protocol
  // "واريد انه اول يوم للقارئ وهيبدأ لو خاتم مش هيكون فيه مراجعة اول يوم ﻷنه لسه هيبدأ وهيسمع لكن بكرة لا خلاص اللي سمعه يحب يبدأ عليه المراجعة من الحفظ اللي سمعه امبارح مع جديد اليوم وهكذا كل يوم"
  if (!isTomorrow && isFirstDay) {
    rationaleNotes.push('اليوم الأول للقارئ: لا توجد مراجعة في اليوم الأول (تسميع الورد الجديد فقط)، وستنطلق المراجعة التراكمية والتثبيت غداً مما يُسمّع اليوم.');
    return {
      reviewItems: [],
      rationaleNotes,
      targetedErrorItem: null,
      recentlyCompletedReviewItem: null
    };
  }

  // If tomorrow and first day: review of today's recited portion
  if (isTomorrow && isFirstDay) {
    if (todayRecitedPortion) {
      const sInfo = getSurahInfo(todayRecitedPortion.fromSurah);
      const toInfo = getSurahInfo(todayRecitedPortion.toSurah);
      const isFull = todayRecitedPortion.fromSurah === todayRecitedPortion.toSurah &&
        todayRecitedPortion.fromAyah === 1 &&
        todayRecitedPortion.toAyah >= toInfo.numberOfAyahs;

      reviewItems.push({
        id: `tom_rev_day1_${Date.now()}`,
        type: 'مراجعة تثبيت',
        surahNumber: todayRecitedPortion.fromSurah,
        surahName: sInfo.name,
        fromAyah: todayRecitedPortion.fromAyah,
        toSurahNumber: todayRecitedPortion.toSurah,
        toSurahName: toInfo.name,
        toAyah: todayRecitedPortion.toAyah,
        isFullSurah: isFull,
        notes: 'مراجعة وسرد ما تم حفظه اليوم في أول جلسة لتثبيته في الصدر وربطه بالجديد'
      });
      rationaleNotes.push(`انطلاق مراجعة الغد مما تم حفظه اليوم: سورة ${sInfo.name} (${todayRecitedPortion.fromAyah}-${todayRecitedPortion.toAyah})`);
    }

    return {
      reviewItems,
      rationaleNotes,
      targetedErrorItem: null,
      recentlyCompletedReviewItem: null
    };
  }

  // RULE 2: Previous Day Recitation Review Item (سرد ومراجعة ما تم حفظه في الجلسة السابقة)
  if (!isTomorrow) {
    const lastEval = evaluationsHistory[0];
    const prevNew = lastEval?.recitationDetails?.todayNewItem;
    if (prevNew && prevNew.surahNumber) {
      const sInfo = getSurahInfo(prevNew.surahNumber);
      const toInfo = getSurahInfo(prevNew.toSurahNumber || prevNew.surahNumber);
      reviewItems.push({
        id: `rev_prev_new_${Date.now()}`,
        type: 'مراجعة تراكمية',
        surahNumber: prevNew.surahNumber,
        surahName: sInfo.name,
        fromAyah: prevNew.fromAyah || 1,
        toSurahNumber: prevNew.toSurahNumber || prevNew.surahNumber,
        toSurahName: toInfo.name,
        toAyah: prevNew.toAyah || toInfo.numberOfAyahs,
        isFullSurah: prevNew.isFullSurah || false,
        notes: 'سرد ومراجعة ما تم تسميعه في الجلسة السابقة لربط المحفوظ الجديد وتثبيته في الصدر'
      });
      rationaleNotes.push(`مراجعة ما تم حفظه أمس: سورة ${sInfo.name}`);
    }
  } else if (todayRecitedPortion) {
    const sInfo = getSurahInfo(todayRecitedPortion.fromSurah);
    const toInfo = getSurahInfo(todayRecitedPortion.toSurah);
    const isFull = todayRecitedPortion.fromSurah === todayRecitedPortion.toSurah &&
      todayRecitedPortion.fromAyah === 1 &&
      todayRecitedPortion.toAyah >= toInfo.numberOfAyahs;

    reviewItems.push({
      id: `tom_rev_today_new_${Date.now()}`,
      type: 'مراجعة تراكمية',
      surahNumber: todayRecitedPortion.fromSurah,
      surahName: sInfo.name,
      fromAyah: todayRecitedPortion.fromAyah,
      toSurahNumber: todayRecitedPortion.toSurah,
      toSurahName: toInfo.name,
      toAyah: todayRecitedPortion.toAyah,
      isFullSurah: isFull,
      notes: 'سرد ومراجعة ما تم حفظه اليوم لتثبيته في الصدر مع ورد الغد'
    });
    rationaleNotes.push(`مراجعة ما تم حفظه اليوم غداً: سورة ${sInfo.name}`);
  }

  // RULE 3: Regular Cumulative Review Quota (ورد المراجعة اليومي المقرر)
  // "ولازم يكمل الورد الويمي للمراجعة يعني مثلا عليه ١٠ اوجه مراجعة ده غير الاخطاء"
  // "المراجعة دايما ستبدأ من الناس الا لو كان هو بادئ من فوق"
  const revPace = student.memorizationPlan?.dailyReviewPages || 5;
  const isFromBaqarah = student.reviewStartDirection === 'from_baqarah';
  let quotaStartS = isFromBaqarah ? 2 : 114;
  let quotaStartA = 1;

  // If student has persistent review items or previous reviews, advance sequentially
  const lastRev = evaluationsHistory[0]?.recitationDetails?.todayReviewItems?.[0];
  if (lastRev && lastRev.toSurahNumber) {
    if (isFromBaqarah) {
      quotaStartS = lastRev.toSurahNumber < 114 ? lastRev.toSurahNumber : 2;
    } else {
      quotaStartS = lastRev.toSurahNumber > 1 ? lastRev.toSurahNumber - 1 : 114;
    }
  }

  const quotaPortion = calculatePortionFromPace(quotaStartS, quotaStartA, Math.max(1, Math.min(20, revPace)));
  const quotaSInfo = getSurahInfo(quotaPortion.fromSurah);
  const quotaToInfo = getSurahInfo(quotaPortion.toSurah);

  reviewItems.push({
    id: `rev_quota_${Date.now()}`,
    type: 'مراجعة صغرى',
    surahNumber: quotaPortion.fromSurah,
    surahName: quotaSInfo.name,
    fromAyah: quotaPortion.fromAyah,
    toSurahNumber: quotaPortion.toSurah,
    toSurahName: quotaToInfo.name,
    toAyah: quotaPortion.toAyah,
    isFullSurah: quotaPortion.fromSurah === quotaPortion.toSurah && quotaPortion.fromAyah === 1 && quotaPortion.toAyah >= quotaToInfo.numberOfAyahs,
    notes: `الورد اليومي المستمر للمراجعة (${revPace} أوجه) ابتداءً ${isFromBaqarah ? 'من البقرة نزولاً' : 'من الناس صعوداً'}`
  });
  rationaleNotes.push(`الورد اليومي للمراجعة: ${quotaPortion.description}`);

  // RULE 4: Two-Week Daily Consolidation for Recently Completed Surahs
  // "والسورة اللي يخلصها خليها قاعدة عنده مثلا الطالب عليه مراجعة اليوم ١٠ اوجه يحط معاها اليوم مثلا هو لسه مخلص سورة جديد يخليه يراجعها بشكل يومي لمدة اسبوعين... طيب لو قصار السور لا هنا يجمعهم مش هيسمعها لوحدها"
  let recentlyCompletedReviewItem: QuranRecitationItem | null = null;
  if (student.recentlyCompletedSurahs && student.recentlyCompletedSurahs.length > 0) {
    const twoWeekResult = calculateRecentlyCompletedSurahsReview({
      recentlyCompletedSurahs: student.recentlyCompletedSurahs,
      activeErrorsMap: mushafErrors
    });
    if (twoWeekResult.reviewItems && twoWeekResult.reviewItems.length > 0) {
      recentlyCompletedReviewItem = twoWeekResult.reviewItems[0];
      reviewItems.push(recentlyCompletedReviewItem);
      rationaleNotes.push(twoWeekResult.summaryNote);
    }
  }

  // RULE 5: Progressive Weak-Point / Ayah Error Targeting
  // "وعايزه يتبع يعني الاخطاء اللي يحطها المعلم ولو لاحظ تحسن والله في التاريخ الفلااني كان عنده خطأ في الاية ده بس انلهارده لا بس السورة الثانية لا والله اكثر الاخطاء زي ماهي فيزود على السورة الثانية... مش هيخليها كلها في يوم واحد لا يخلي مثلا كم خطأ كل يوم بحيث يخلص السور الضعيفة اللي عنده في اقرب مدة"
  let targetedErrorItem: QuranRecitationItem | null = null;
  const errorDistribution = analyzeAndDistributeAyahErrors({
    existingErrors: student.mushafErrors || [],
    todayEvaluatedRange: todayRecitedPortion,
    todayReportedErrors: mushafErrors,
    dailyMaxErrorVerses: 3
  });

  if (errorDistribution.targetedReviewItem) {
    targetedErrorItem = errorDistribution.targetedReviewItem;
    reviewItems.push(targetedErrorItem);
    rationaleNotes.push(errorDistribution.rationale);
  }

  return {
    reviewItems,
    rationaleNotes,
    targetedErrorItem,
    recentlyCompletedReviewItem
  };
}

function getPedagogicalTurnFallback(params: {
  studentInitialData: {
    studentName: string;
    age: number;
    memorizedJuzList: number[];
    notes?: string;
  };
  complex: QuranComplex;
  turnIndex: number;
  chatHistory: Array<{ sender: 'ai' | 'user'; text: string }>;
  lastUserAnswer?: string;
  accumulatedData: {
    memorizedCount: number;
    consolidatedCount: number;
    tajweedScore: number;
    hasIjazah: boolean;
    goal: string;
    dailyNewPages: number;
    dailyReviewPages: number;
    reachedSurah?: number;
    reachedAyah?: number;
    reviewDirection?: 'from_baqarah' | 'from_nas';
  };
}): DynamicInterviewResponse {
  const { studentInitialData, turnIndex, accumulatedData } = params;
  const memCount = studentInitialData.memorizedJuzList?.length || accumulatedData.memorizedCount || 1;
  const isKhatim = memCount >= 30;

  // Turn 1: Quran Surah & Ayah Reached Picker!
  // "اين وصل في سور القرءان والطالب يختار من قائمة منسدلة من كل سور القرءان ويمكنه البحث ويحدد اي اي وصل"
  if (turnIndex === 1) {
    return {
      replyText: `أهلاً وسهلاً بك يا ${studentInitialData.studentName} في مجمع «${params.complex.name}»! 🌟\n\nأنا المساعد القرآني والتربوي الذكي، ومهمتي هي التعرف على موضع حفظك الحالي بدقة وضبط جدولك القرآني المتقن.\n\n📖 **أين وصلت في سور القرآن الكريم؟**\nاختر السورة والآية التي تقف عندها من القائمة المنسدلة بالأسفل لنبدأ معك منها مباشرة:`,
      isCompleted: false,
      nextQuestion: {
        questionId: 'quran_position_reached',
        questionText: 'موضع الوصول الحالي في سور القرآن الكريم:',
        category: 'memorization_depth',
        options: [] // Managed via customWidget
      }
    };
  }

  // Turn 2: Review Direction (Khatim: Al-Baqarah vs An-Nas / Non-Khatim: Starting direction)
  // "يسأل الطالب هل يحب يبدأ مراجعة من البقرة ام من الناس طبعا للخاتم"
  if (turnIndex === 2) {
    if (isKhatim) {
      const khatimOptions = shuffleArray([
        { label: 'البدء من سورة البقرة (تدرج من أول المصحف للأمام)', value: 'from_baqarah', subtext: 'مسار السرد الكلاسيكي المنهجي' },
        { label: 'البدء من سورة الناس (صعوداً من جزء عم وقصار السور)', value: 'from_nas', subtext: 'تثبيت قصار السور ثم الأطول' }
      ]);

      return {
        replyText: `ما شاء الله تبارك الرحمن! هنيئاً لك ختم كتاب الله كاملاً، جعله الله لك شفيعاً ونوراً في الدارين.\n\nبما أنك خاتم وتريد مراجعة القرآن كاملاً وتثبيته لنيل السند والإجازة بإذن الله:\n**هل تفضل أن تبدأ مراجعتك الشاملة من سورة البقرة أم من سورة الناس؟**`,
        isCompleted: false,
        nextQuestion: {
          questionId: 'khatim_review_direction',
          questionText: 'مسار انطلاق مراجعة المصحف كاملاً:',
          category: 'memorization_depth',
          options: khatimOptions
        }
      };
    } else {
      const nonKhatimOptions = shuffleArray([
        { label: 'بدأت من سورة الناس صعوداً (المسار المعتاد من جزء عم)', value: 'from_nas', subtext: 'البدء من قصار السور صعوداً' },
        { label: 'بدأت من سورة البقرة ونزولاً في المصحف', value: 'from_baqarah', subtext: 'البدء من طوال السور للأمام' }
      ]);

      return {
        replyText: `أحسنت الاختيار! موضع بداية مبارك بإذن الله.\n\nلتحديد اتجاه المراجعة التراكمية اليومية:\n**هل بدأت حفظك سابقاً من سورة الناس (صعوداً من جزء عم) أم بدأت من سورة البقرة ونزولاً؟**`,
        isCompleted: false,
        nextQuestion: {
          questionId: 'non_khatim_review_direction',
          questionText: 'اتجاه مسار الحفظ والمراجعة السابق:',
          category: 'memorization_depth',
          options: nonKhatimOptions
        }
      };
    }
  }

  // Turn 3: Diagnostic Tajweed / Mutashabihat Test with SHUFFLED options!
  // Options are explicitly shuffled so the answer is NEVER statically (A) or first!
  if (turnIndex === 3) {
    if (isKhatim) {
      const mutashabihOptions = shuffleArray([
        { label: 'في البقرة حصر وتأكيد لمواجهة ادعاء اليهود والنصارى، وفي آل عمران تأكيد أن الهدى بيد الله', value: 'correct', subtext: 'فهم بلاغي وتفسيري دقيق' },
        { label: 'لا يوجد فرق معنوي بينهما، هو مجرد تنويع لفظي فقط', value: 'wrong', subtext: 'توجد دلالة بلاغية دقيقة في كل موضع' },
        { label: 'الموضعان وردا بالتقديم في آل عمران والتأخير في البقرة بالعكس', value: 'wrong', subtext: 'عكس للموضعين' }
      ]);

      return {
        replyText: `ممتاز جداً! بما أن هدفك الإتقان والسند المتصل، دعنا نجري فحصاً سريعاً في المتشابهات اللفظية:\n\nفي قوله تعالى: ﴿قُلْ إِنَّ هُدَى اللَّهِ هُوَ الْهُدَىٰ﴾ بسورة البقرة، بينما في آل عمران: ﴿قُلْ إِنَّ الْهُدَىٰ هُدَى اللَّهِ﴾.\nما السر الدقيق في تقديم وتأخير لفظ (هو) و(الهدى) بين السورتين؟`,
        isCompleted: false,
        nextQuestion: {
          questionId: 'mutashabihat_test',
          questionText: 'ضبط المتشابهات اللفظية وتوجيهها:',
          category: 'mutashabihat',
          options: mutashabihOptions
        }
      };
    } else {
      const tajweedOptions = shuffleArray([
        { label: 'إدغام بغنة ناقص', value: 'correct', subtext: 'الياء من حروف الإدغام بغنة (ينمو)' },
        { label: 'إظهار حلقي', value: 'wrong', subtext: 'ليس من حروف الحلق الستة' },
        { label: 'إخفاء حقيقي', value: 'wrong', subtext: 'الياء ليست من حروف الإخفاء' },
        { label: 'إقلاب بميم مخفاة', value: 'wrong', subtext: 'الإقلاب خاص بحرف الباء فقط' }
      ]);

      return {
        replyText: `أحسنت! ننتقل الآن لفحص سريع لأحكام التلاوة والتجويد العملي:\n\nفي قوله تعالى: ﴿مَن يَقُولُ﴾، ما هو الحكم التجويدي الصحيح للنون الساكنة هنا؟`,
        isCompleted: false,
        nextQuestion: {
          questionId: 'tajweed_quick',
          questionText: 'الحكم التجويدي للنون الساكنة في (مَن يقول):',
          category: 'tajweed',
          options: tajweedOptions
        }
      };
    }
  }

  // Turn 4: Pace and Daily Commitment with SHUFFLED options!
  if (turnIndex === 4) {
    const commitmentOptions = shuffleArray([
      { label: 'نصف وجه جديد + ٥ أوجه مراجعة يومياً', value: { newPages: 0.5, reviewPages: 5 }, subtext: 'مسار التثبيت المتأنّي المتين' },
      { label: 'وجه واحد جديد + ١٠ أوجه مراجعة يومياً', value: { newPages: 1.0, reviewPages: 10 }, subtext: 'المعدل الذهبي المتوازن والموصى به' },
      { label: 'وجهان جديدان + ٢٠ وجهاً مراجعة يومياً', value: { newPages: 2.0, reviewPages: 20 }, subtext: 'لأصحاب التفرغ والهمم العالية' }
    ]);

    return {
      replyText: `عزيمتك مباركة ووعيك طيب يا ${studentInitialData.studentName}! 🌿\n\nأخبرنا عن طاقتك اليومية المريحة في مجلس الشيخ والمنزل:\nكم مقدار الحفظ الجديد والمراجعة اليومية الذي تستطيع الالتزام به بإتقان دون انقطاع؟`,
      isCompleted: false,
      nextQuestion: {
        questionId: 'pace_and_commitment',
        questionText: 'المعدل اليومي المفضل لديك:',
        category: 'psychology_commitment',
        options: commitmentOptions
      }
    };
  }

  // Final Turn (Turn 5): Complete assessment and generate realistic Khatm plan!
  const weeklyDays = 5;
  const newPages = accumulatedData.dailyNewPages || 1;
  const reviewPages = accumulatedData.dailyReviewPages || 10;
  const reachedS = accumulatedData.reachedSurah || (isKhatim ? (accumulatedData.reviewDirection === 'from_nas' ? 114 : 2) : 78);
  const reachedA = accumulatedData.reachedAyah || 1;

  const timeline = calculateRealisticKhatmTimeline({
    memorizedJuz: memCount,
    consolidatedJuz: accumulatedData.consolidatedCount,
    dailyNewPages: newPages,
    dailyReviewPages: reviewPages,
    weeklyDaysCount: weeklyDays,
    dailyHoursCount: 2
  });

  const startPortion = calculatePortionFromPace(reachedS, reachedA, newPages);

  // Day 1 Protocol:
  // "اول يوم للقارئ وهيبدأ لو خاتم مش هيكون فيه مراجعة اول يوم ﻷنه لسه هيبدأ وهيسمع لكن بكرة لا خلاص اللي سمعه يحب يبدأ عليه المراجعة من الحفظ اللي سمعه امبارح"
  const studentPlan: StudentMemorizationPlan = {
    dailyNewPages: newPages,
    dailyReviewPages: reviewPages,
    consolidatedJuzCount: accumulatedData.consolidatedCount || Math.max(0, memCount - 2),
    memorizedJuzCount: memCount,
    targetJuz: 30,
    targetCompletionDate: timeline.targetCompletionDate,
    estimatedDaysRemaining: timeline.estimatedDaysRemaining,
    progressPercentage: timeline.progressPercentage,
    status: 'on_track',
    weeklyDaysCount: weeklyDays,
    dailyHoursCount: 2,
    tathbeetStopsCount: timeline.tathbeetStopsCount,
    milestones: timeline.milestones,
    nextDayAssignment: {
      newMemorization: startPortion.description,
      review: isKhatim
        ? 'لا توجد مراجعة في اليوم الأول (انطلاقة التسميع الأولى - وتبدأ المراجعة غداً مما يتم تسميعه اليوم)'
        : 'اليوم الأول مخصص للتسميع الجديد (وتبدأ المراجعة التراكمية غداً مما يُسمّع اليوم)',
      action: 'advance_page',
      reason: 'انطلاقة تأسيسية ذكية تبدأ من موضع الوصول المحدد بدقة مع بروتوكول اليوم الأول',
      surahNumber: startPortion.fromSurah,
      fromAyah: startPortion.fromAyah,
      toSurahNumber: startPortion.toSurah,
      toAyah: startPortion.toAyah
    },
    aiNotes: timeline.pedagogicalNote,
    lastUpdated: new Date().toISOString()
  };

  return {
    replyText: `🎉 الحمد لله الذي بنعمته تتم الصالحات! تم تحليل مستواك القرآني وتحديد موضع البداية بدقة.\n\n📊 **الخلاصة التقييمية لمسارك:**\n• موضع الانطلاق: سورة ${getSurahInfo(reachedS).name} (الآية ${reachedA})\n• اتجاه المراجعة: ${accumulatedData.reviewDirection === 'from_nas' ? 'من سورة الناس صعوداً' : 'من سورة البقرة نزولاً'}\n• بروتوكول اليوم الأول: تسميع الورد الجديد فقط، وتبدأ المراجعة التراكمية من الغد لربط ما يُسمّع اليوم.\n• موعد الختم المتوقع: **${timeline.targetCompletionDate}**\n\n📌 **مبدأ الخطة:** ${timeline.pedagogicalNote}\n\nنبحث لك الآن عن الحلقة والمسجد الأنسب في مجمع ${params.complex.name}...`,
    isCompleted: true,
    aiInsights: {
      studentLevel: isKhatim ? 'خاتم ومتقن' : memCount > 5 ? 'متوسط' : 'مبتدئ',
      psychologicalProfile: 'طالب حريص وجاهز للالتزام بجدول التثبيت اليومي وبروتوكول المراجعة التراكمية.',
      commitmentAssessment: 'ممتاز',
      recommendedHalaqahLevel: isKhatim ? 'حلقة الإتقان والسند المتصل' : 'حلقة الحفظ والمراجعة التراكمية',
      suggestedDailyNewPages: newPages,
      suggestedDailyReviewPages: reviewPages
    },
    generatedPlan: studentPlan
  };
}
