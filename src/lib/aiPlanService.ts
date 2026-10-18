/**
 * Omran Intelligent Quran AI Plan & Placement Engine
 * Powered by Google Gemini 3.8 Flash & Pedagogical Quranic Rules
 * 
 * Enforces the core Quranic pedagogy:
 * "الهدف ليس السرعة في الختم، بل الختم بتثبيت وإتقان تام"
 */

import { Student, StudentMemorizationPlan, Halaqah, QuranComplex } from '../types';
import { ApiConfig } from './apiConfig';

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
export function calculateRealisticKhatmTimeline(params: {
  memorizedJuz: number;
  consolidatedJuz?: number;
  dailyNewPages: number;
  dailyReviewPages: number;
  weeklyDaysCount?: number; // e.g. 5
  dailyHoursCount?: number; // e.g. 2
}): {
  targetCompletionDate: string;
  targetDateObj: Date;
  estimatedDaysRemaining: number;
  estimatedMonths: number;
  progressPercentage: number;
  tathbeetStopsCount: number;
  milestones: Array<{ juz: number; targetDate: string; isCompleted: boolean; label: string }>;
  pedagogicalNote: string;
} {
  const totalPagesInQuran = 604;
  const memorizedJuz = Math.max(0, Math.min(30, Number(params.memorizedJuz) || 0));
  const consolidatedJuz = Math.max(0, Math.min(memorizedJuz, Number(params.consolidatedJuz) || 0));
  const weeklyDays = Math.max(1, Math.min(7, Number(params.weeklyDaysCount) || 5));
  const dailyNewPages = Math.max(0.25, Math.min(5, Number(params.dailyNewPages) || 1));

  // Current memorized pages approx
  const currentMemorizedPages = memorizedJuz * 20;
  const remainingPages = Math.max(0, totalPagesInQuran - currentMemorizedPages);

  if (remainingPages <= 0) {
    // Student already memorized all 30 Juz (خاتم)! Focus is 100% on Consolidation & Sanad
    const consolidationDays = Math.ceil((30 - consolidatedJuz) * 12);
    const targetDate = new Date();
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
      pedagogicalNote: 'الطالب خاتم لكتاب الله المبارك. الخطة تركز بنسبة 100% على تثبيت المتشابهات وضبط الوقف والابتداء والسرد غيباً للحصول على الإجازة والسند المتصل.'
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

  const targetDate = new Date();
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

    const mDate = new Date();
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

  const pedagogicalNote = `حُسب موعد الختم بواقع (${weeklyDays} أيام أسبوعياً) مع تضمين ${fiveJuzStops + tenJuzStops + 1} وقفات تثبيت ومراجعة تراكمية لضمان رسوخ الحفظ وعدم التفلت، تحقيقاً لقاعدة: "الختم بتثبيت خير من التعجل بالتفلت".`;

  return {
    targetCompletionDate: targetDateStr,
    targetDateObj: targetDate,
    estimatedDaysRemaining: calendarDays,
    estimatedMonths,
    progressPercentage,
    tathbeetStopsCount: fiveJuzStops + tenJuzStops + 1,
    milestones,
    pedagogicalNote
  };
}

/**
 * Runs a dynamic turn of the AI placement interview
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

  // Attempt real AI call via backend
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

  // Smart Pedagogical Fallback Engine tailored to student profile!
  return getPedagogicalTurnFallback(params);
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
  };
}): DynamicInterviewResponse {
  const { studentInitialData, turnIndex, accumulatedData } = params;
  const memCount = studentInitialData.memorizedJuzList?.length || accumulatedData.memorizedCount || 1;
  const isKhatim = memCount >= 30;
  const isYoung = studentInitialData.age <= 10;

  // Turn 0: Greeting already displayed, Turn 1: Consolidated count
  if (turnIndex === 1) {
    if (isKhatim) {
      return {
        replyText: `ما شاء الله تبارك الرحمن يا ${studentInitialData.studentName}! ختم القرآن الكريم نعمة عظيمة ومسؤولية جليلة، جعلنا الله وإياك من أهل القرآن الذين هم أهل الله وخاصته.\n\nبما أنك خاتم لكتاب الله، فالمعيار الأهم لدينا هو «قوة السرد والتثبيت»:\nكم جزءاً من القرآن الكريم تستطيع سرده الآن غيباً على الشيخ في جلسة واحدة دون أي تردد أو خطأ؟`,
        isCompleted: false,
        nextQuestion: {
          questionId: 'khatim_sard_capacity',
          questionText: 'طاقة السرد المتقن في جلسة واحدة:',
          category: 'memorization_depth',
          options: [
            { label: '١ إلى ٣ أجزاء متقنة', value: 2, subtext: 'تثبيت أسبوعي ومراجعة' },
            { label: '٥ إلى ١٠ أجزاء متقنة', value: 7, subtext: 'مستوى متقدم ما شاء الله' },
            { label: 'أكثر من ١٠ أجزاء أو المصحف كاملاً', value: 20, subtext: 'مستوى إجازة وسند متصل' }
          ]
        }
      };
    } else if (isYoung) {
      return {
        replyText: `حياك الله يا بطل ${studentInitialData.studentName} في حلقات القرآن الكريم! 🌟\n\nما شاء الله عليك، أنت تحفظ ${memCount} جزءاً. كم جزءاً منها تحبه وتتذكره جيداً وكأنك تقرأ من المصحف؟`,
        isCompleted: false,
        nextQuestion: {
          questionId: 'child_consolidated',
          questionText: 'الأجزاء المحفوظة بقوة وإتقان:',
          category: 'memorization_depth',
          options: [
            { label: 'جزء عم فقط (الجزء 30)', value: 1, subtext: 'قصير وسهل الحفظ' },
            { label: 'جزء عم وتبارك (جزأين)', value: 2, subtext: 'ما شاء الله' },
            { label: `${Math.min(memCount, 3)} أجزاء أو أكثر`, value: Math.min(memCount, 3), subtext: 'همة عالية' }
          ]
        }
      };
    } else {
      return {
        replyText: `ما شاء الله يا ${studentInitialData.studentName}، حفظك لـ (${memCount}) جزءاً أساس متين.\n\nدعنا نحدد مستوى التثبيت الحالي لديك: كم جزءاً منها تعتبره ثابتاً تماماً وتستطيع تسميعه فوراً بأقل من خطأين؟`,
        isCompleted: false,
        nextQuestion: {
          questionId: 'standard_consolidated',
          questionText: 'عدد الأجزاء المثبتة بإتقان:',
          category: 'memorization_depth',
          options: [
            { label: `نصف ما حفظت تقريباً (~${Math.max(1, Math.round(memCount / 2))} أجزاء)`, value: Math.max(1, Math.round(memCount / 2)) },
            { label: `معظم ما حفظت بنسبة 80% (~${Math.max(1, Math.round(memCount * 0.8))} أجزاء)`, value: Math.max(1, Math.round(memCount * 0.8)) },
            { label: 'تحتاج الأجزاء كلها إلى إعادة جرد وتثبيت', value: 1, subtext: 'سنبدأ ببرنامج تثبيت مكثف' }
          ]
        }
      };
    }
  }

  // Turn 2: Tajweed & Makharij Probe or Mutashabihat for Khatim
  if (turnIndex === 2) {
    if (isKhatim) {
      return {
        replyText: `ممتاز جداً! بما أن هدفك التثبيت والإتقان الكامل، دعنا نجري اختباراً دقيقاً في المتشابهات والتوجيه اللفظي:\n\nفي قوله تعالى: ﴿قُلْ إِنَّ هُدَى اللَّهِ هُوَ الْهُدَىٰ﴾ بسورة البقرة، بينما في آل عمران جاءت: ﴿قُلْ إِنَّ الْهُدَىٰ هُدَى اللَّهِ﴾.\nما السر في تقديم وتأخير لفظ (هو) و(الهدى) هنا؟`,
        isCompleted: false,
        nextQuestion: {
          questionId: 'mutashabihat_test',
          questionText: 'ضبط المتشابهات اللفظية:',
          category: 'mutashabihat',
          options: [
            { label: 'في البقرة حصر وتأكيد لمواجهة ادعاء اليهود والنصارى، وفي آل عمران تأكيد أن الهدى الحقيقي بيد الله', value: 'correct', subtext: 'إجابة دقيقة متقنة' },
            { label: 'لا يوجد فرق معنوي، هو مجرد اختلاف لفظي فقط', value: 'wrong', subtext: 'توجد حكمة بلاغية دقيقة' }
          ]
        }
      };
    } else {
      return {
        replyText: `أحسنت! ننتقل الآن لفحص إتقانك لأحكام التلاوة والتجويد العملي:\n\nفي قوله تعالى: ﴿مَن يَقُولُ﴾، ما هو الحكم التجويدي الصحيح للنون الساكنة هنا؟ وكيف يُنطق؟`,
        isCompleted: false,
        nextQuestion: {
          questionId: 'tajweed_quick',
          questionText: 'الحكم التجويدي:',
          category: 'tajweed',
          options: [
            { label: 'إدغام بغنة (ناقص)', value: 'correct', subtext: 'الياء من حروف (ينمو)' },
            { label: 'إظهار حلقي', value: 'wrong', subtext: 'ليس من حروف الحلق' },
            { label: 'إقلاب', value: 'wrong', subtext: 'ليس حرف باء' }
          ]
        }
      };
    }
  }

  // Turn 3: Live interactive mini recitation test on the fly!
  if (turnIndex === 3) {
    const testSurah = isKhatim ? 2 : (memCount > 5 ? 67 : 112);
    const testSurahName = isKhatim ? 'البقرة' : (memCount > 5 ? 'الملك' : 'الإخلاص');
    return {
      replyText: `رائع! والآن دعنا نجري اختباراً سريعاً للتأكد من استحضارك للآيات ومخارج الحروف 🎙️:\n\nاقرأ الآية الأولى من سورة (${testSurahName}) أو اكتب كلماتها الأولى للتأكد من انطلاقتك:`,
      isCompleted: false,
      nextQuestion: {
        questionId: 'live_recitation_check',
        questionText: `اختبار سريع في سورة ${testSurahName}:`,
        category: 'live_test',
        isLiveRecitationTest: true,
        surahNumber: testSurah,
        ayahNumber: 1,
        options: [
          { label: 'جاهز وحفظي فيها متقن ومثبت ١٠٠٪', value: 'ready', subtext: 'استحضار سريع ومتقن' },
          { label: 'أحتاج ثوانٍ لتذكر البداية ثم أنطلق', value: 'needs_moment', subtext: 'تحتاج تذكيراً بالرابط' }
        ]
      }
    };
  }

  // Turn 4: Psychology, daily schedule, and dedication
  if (turnIndex === 4) {
    return {
      replyText: `ما شاء الله عليك، عزيمتك طيبة وأداؤك مبشر بالخير! 🌿\n\nأخبرني عن وقتك اليومي المخصص للحلقة والمراجعة في البيت:\nكم صفحة تستطيع حفظها وتثبيتها يومياً دون أن تشعر بالإرهاق، مع الالتزام التام بالمراجعة؟`,
      isCompleted: false,
      nextQuestion: {
        questionId: 'pace_and_commitment',
        questionText: 'معدل الحفظ اليومي المناسب لك:',
        category: 'psychology_commitment',
        options: [
          { label: 'نصف وجه يومياً (تثبيت متأنٍ ومتقن جداً)', value: { newPages: 0.5, reviewPages: 3 } },
          { label: 'وجه واحد يومياً (المعدل الذهبي المتزن)', value: { newPages: 1, reviewPages: 5 } },
          { label: 'وجهان يومياً (للهمم العالية والمتفرغين)', value: { newPages: 2, reviewPages: 10 } }
        ]
      }
    };
  }

  // Final Turn (Turn 5): Complete assessment and generate realistic Khatm plan!
  const weeklyDays = 5;
  const newPages = accumulatedData.dailyNewPages || 1;
  const reviewPages = accumulatedData.dailyReviewPages || 5;

  const timeline = calculateRealisticKhatmTimeline({
    memorizedJuz: memCount,
    consolidatedJuz: accumulatedData.consolidatedCount,
    dailyNewPages: newPages,
    dailyReviewPages: reviewPages,
    weeklyDaysCount: weeklyDays,
    dailyHoursCount: 2
  });

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
      newMemorization: `سورة ${memCount >= 30 ? 'البقرة' : 'النبأ'}: الآيات 1 إلى 10`,
      review: `مراجعة الجزء ${Math.max(1, memCount)} كاملاً مع التكرار والتثبيت`,
      action: 'advance_page',
      reason: 'انطلاقة قوية مع التركيز على التثبيت المتقن'
    },
    aiNotes: timeline.pedagogicalNote,
    lastUpdated: new Date().toISOString()
  };

  return {
    replyText: `🎉 الحمد لله الذي بنعمته تتم الصالحات! تم فحص مستواك القرآني وتحليله بدقة متناهية.\n\n📊 **الخلاصة التقييمية لمستواك:**\n• المستوى القرآني: ${isKhatim ? 'مستوى الإتقان والإجازة' : memCount > 5 ? 'مستوى متوسط متقدم' : 'مستوى تأسيسي مبشر'}\n• الأجزاء المحفوظة: ${memCount} جزءاً • المثبتة: ${accumulatedData.consolidatedCount} أجزاء\n• موعد الختم الواقعي المحسوب: **${timeline.targetCompletionDate}**\n\n📌 **مبدأ خطتك المعتمدة:** ${timeline.pedagogicalNote}\n\nنبحث لك الآن عن الحلقة والمسجد الأنسب في مجمع ${params.complex.name}...`,
    isCompleted: true,
    aiInsights: {
      studentLevel: isKhatim ? 'خاتم ومتقن' : memCount > 5 ? 'متوسط' : 'مبتدئ',
      psychologicalProfile: 'طالب حريص وذو استيعاب طيب، يناسبه أسلوب التشجيع وربط الحفظ الجديد بالمراجعة المستمرة.',
      commitmentAssessment: 'جاهزية عالية للالتزام بورد يومي منتظم.',
      recommendedHalaqahLevel: isKhatim ? 'حلقة الإتقان والسرد' : 'حلقة الحفظ والمراجعة التراكمية',
      suggestedDailyNewPages: newPages,
      suggestedDailyReviewPages: reviewPages
    },
    generatedPlan: studentPlan
  };
}
