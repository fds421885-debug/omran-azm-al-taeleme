import assert from 'node:assert/strict';

function describe(name: string, fn: () => void | Promise<void>) {
  console.log(`\n📌 ${name}`);
  fn();
}

async function it(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
  } catch (err: any) {
    console.error(`  ❌ ${name}: ${err.message}`);
    throw err;
  }
}

function expect(actual: any) {
  return {
    toBe(expected: any) {
      assert.strictEqual(actual, expected);
    },
    toEqual(expected: any) {
      assert.deepStrictEqual(actual, expected);
    },
    toHaveLength(len: number) {
      assert.strictEqual(actual?.length, len);
    },
    toBeGreaterThan(val: number) {
      assert.ok(actual > val, `Expected ${actual} > ${val}`);
    },
    toBeGreaterThanOrEqual(val: number) {
      assert.ok(actual >= val, `Expected ${actual} >= ${val}`);
    },
    toBeDefined() {
      assert.ok(actual !== undefined && actual !== null, `Expected defined but got ${actual}`);
    },
    toBeUndefined() {
      assert.strictEqual(actual, undefined);
    },
    toBeTruthy() {
      assert.ok(!!actual, `Expected truthy but got ${actual}`);
    },
    toBeFalsy() {
      assert.ok(!actual, `Expected falsy but got ${actual}`);
    },
    toBeNull() {
      assert.strictEqual(actual, null);
    },
    not: {
      toBe(expected: any) {
        assert.notStrictEqual(actual, expected);
      },
      toBeNull() {
        assert.notStrictEqual(actual, null);
      },
      toContain(item: any) {
        assert.ok(!actual?.includes?.(item), `Expected ${actual} not to contain ${item}`);
      }
    },
    toContain(item: any) {
      assert.ok(actual?.includes?.(item), `Expected ${actual} to contain ${item}`);
    },
    toMatch(regex: RegExp) {
      assert.ok(regex.test(String(actual)), `Expected "${actual}" to match ${regex}`);
    }
  };
}

import {
  generatePlacementDiagnosticTest,
  evaluatePlacementDiagnostic,
  shuffleArray,
  normalizeQuranicArabic
} from '../src/lib/quranQuestionBankEngine';
import {
  generateFiveStreamDailySchedule,
  checkStudentHiatusStatus,
  calculateHalaqahTimeCapacity,
  proposePlanFromPlacementResult,
  createPlanChangeLogEntry
} from '../src/lib/quranAdaptivePlanEngine';
import { PlacementQuestionResult, Halaqah, Student } from '../src/types';

describe('Omran Quran Diagnostic & Adaptive Plan Engine Tests', () => {

  // =========================================================================
  // 1. Question Bank Generation (Khatim vs Non-Khatim & Anti-Repetition)
  // =========================================================================
  describe('Question Bank Generation', () => {
    it('generates 10 questions for Khatim with 7 Quran and 3 Tajweed', async () => {
      const questions = await generatePlacementDiagnosticTest({
        isKhatim: true,
        questionCount: 10
      });

      expect(questions).toHaveLength(10);
      const quranCount = questions.filter(q => q.skill === 'quran_memorization' || q.skill === 'mutashabihat').length;
      const tajweedCount = questions.filter(q => q.skill === 'tajweed_rules').length;

      expect(quranCount).toBe(7);
      expect(tajweedCount).toBe(3);

      // Verify Mutashabihat (hard questions) are included for Khatim
      const hardMut = questions.filter(q => q.skill === 'mutashabihat' && q.difficulty === 'hard');
      expect(hardMut.length).toBeGreaterThanOrEqual(1);

      // Verify all questions have options and correct answers
      questions.forEach(q => {
        expect(q.options.length).toBeGreaterThanOrEqual(2);
        expect(q.correctAnswer).toBeDefined();
        expect(q.questionText).toBeTruthy();
      });
    });

    it('generates 10 questions for Non-Khatim with 5 Quran and 5 Tajweed', async () => {
      const questions = await generatePlacementDiagnosticTest({
        isKhatim: false,
        memorizedJuzRange: { fromJuz: 28, toJuz: 30 },
        startingDirection: 'nas_to_baqarah',
        questionCount: 10
      });

      expect(questions).toHaveLength(10);
      const quranCount = questions.filter(q => q.skill === 'quran_memorization' || q.skill === 'mutashabihat').length;
      const tajweedCount = questions.filter(q => q.skill === 'tajweed_rules').length;

      expect(quranCount).toBe(5);
      expect(tajweedCount).toBe(5);
    });

    it('honors seenQuestionIds to prevent repeating recent questions', async () => {
      const firstRun = await generatePlacementDiagnosticTest({ isKhatim: true, questionCount: 10 });
      const firstIds = firstRun.map(q => q.questionId);

      // Request second run with seenQuestionIds
      const secondRun = await generatePlacementDiagnosticTest({
        isKhatim: true,
        seenQuestionIds: firstIds.slice(0, 5),
        questionCount: 10
      });

      const secondIds = secondRun.map(q => q.questionId);
      // None of the first 5 should be present in secondRun unless pool was exhausted
      firstIds.slice(0, 3).forEach(id => {
        expect(secondIds).not.toContain(id);
      });
    });

    it('decouples options and shuffles them correctly', () => {
      const original = ['أ', 'ب', 'ج', 'د'];
      const shuffled = shuffleArray(original);
      expect(shuffled).toHaveLength(4);
      expect(shuffled.sort()).toEqual(original.sort());
    });
  });

  // =========================================================================
  // 2. Multi-Dimensional Scoring Engine & 8-Second Timeout
  // =========================================================================
  describe('Multi-Dimensional Placement Scoring & 8s Timeout', () => {
    it('penalizes timeouts and marks timed-out questions as incorrect', () => {
      const mockAnswers: PlacementQuestionResult[] = [
        {
          questionId: 'q1',
          skill: 'quran_memorization',
          difficulty: 'medium',
          questionText: 'سؤال 1',
          optionsOrder: ['أ', 'ب'],
          selectedOption: 'لم يجب ضمن الوقت',
          correctAnswer: 'أ',
          isCorrect: false,
          timeTakenSeconds: 8.0,
          isTimedOut: true
        },
        {
          questionId: 'q2',
          skill: 'tajweed_rules',
          difficulty: 'easy',
          questionText: 'سؤال 2',
          optionsOrder: ['أ', 'ب'],
          selectedOption: 'أ',
          correctAnswer: 'أ',
          isCorrect: true,
          timeTakenSeconds: 2.5,
          isTimedOut: false
        }
      ];

      const summary = evaluatePlacementDiagnostic({
        answers: mockAnswers,
        isKhatim: false
      });

      expect(summary.totalQuestions).toBe(2);
      expect(summary.correctCount).toBe(1);
      expect(summary.incorrectCount).toBe(1);
      expect(summary.memorizationScore).toBe(0);
      expect(summary.tajweedScore).toBe(100);
    });

    it('correctly classifies levels across the 6 platform tiers', () => {
      // 10 all-correct answers
      const perfectAnswers: PlacementQuestionResult[] = Array.from({ length: 10 }, (_, i) => ({
        questionId: `q${i}`,
        skill: i < 7 ? 'quran_memorization' : 'tajweed_rules',
        difficulty: 'hard',
        questionText: `سؤال ${i}`,
        optionsOrder: ['صحيح', 'خطأ'],
        selectedOption: 'صحيح',
        correctAnswer: 'صحيح',
        isCorrect: true,
        timeTakenSeconds: 2.0,
        isTimedOut: false
      }));

      const khatimSummary = evaluatePlacementDiagnostic({
        answers: perfectAnswers,
        isKhatim: true
      });
      expect(khatimSummary.classifiedLevel).toBe('خاتم ومتقن');
      expect(khatimSummary.overallScore).toBe(100);
      expect(khatimSummary.confidenceRating).toBe('high');

      // Beginner answers (40%)
      const beginnerAnswers: PlacementQuestionResult[] = Array.from({ length: 10 }, (_, i) => ({
        questionId: `q${i}`,
        skill: i < 5 ? 'quran_memorization' : 'tajweed_rules',
        difficulty: 'easy',
        questionText: `سؤال ${i}`,
        optionsOrder: ['أ', 'ب'],
        selectedOption: i < 4 ? 'أ' : 'ب',
        correctAnswer: 'أ',
        isCorrect: i < 4,
        timeTakenSeconds: 6.0,
        isTimedOut: false
      }));

      const beginnerSummary = evaluatePlacementDiagnostic({
        answers: beginnerAnswers,
        isKhatim: false
      });
      expect(beginnerSummary.classifiedLevel).toBe('مبتدئ');
    });
  });

  // =========================================================================
  // 3. 5 Separated Review Streams & Day 1 Protocol
  // =========================================================================
  describe('5 Review Streams & Day 1 Protocol', () => {
    it('Day 1 Protocol: does not assign past reviews on day 1', () => {
      const schedule = generateFiveStreamDailySchedule({
        student: { id: 'std-test', weakSurahs: [2, 3] },
        plan: { dailyNewPages: 1, dailyReviewPages: 5, currentSurahNumber: 2, currentAyahNumber: 1 },
        isKhatim: false,
        dayNumber: 1
      });

      expect(schedule.isDayOne).toBe(true);
      expect(schedule.newMemorization).not.toBeNull();
      expect(schedule.nearReview).toBeNull();
      expect(schedule.cumulativeReview).toBeNull();
      expect(schedule.remedialReview).toBeNull();
      expect(schedule.recentlyCompletedBuffer).toBeNull();
    });

    it('Day 2+: Populates near review, cumulative review, and remedial review', () => {
      const schedule = generateFiveStreamDailySchedule({
        student: { id: 'std-test', weakSurahs: [2, 3] },
        plan: { dailyNewPages: 1, dailyReviewPages: 5, currentSurahNumber: 2, currentAyahNumber: 25 },
        isKhatim: false,
        dayNumber: 2,
        recentErrors: [
          {
            id: 'err-1',
            studentId: 'std-test',
            surahNumber: 2,
            ayahNumber: 25,
            errorType: 'mutashabih_confusion',
            errorCount: 1,
            timestamp: new Date().toISOString()
          }
        ]
      });

      expect(schedule.isDayOne).toBe(false);
      expect(schedule.newMemorization).not.toBeNull();
      expect(schedule.nearReview).not.toBeNull();
      expect(schedule.cumulativeReview).not.toBeNull();
      expect(schedule.remedialReview).not.toBeNull();
      expect(schedule.remedialReview?.targetSurahs.length).toBeGreaterThan(0);
    });

    it('Recently completed surahs within 14 days enter the 2-week consolidation buffer', () => {
      const now = new Date();
      const fourDaysAgo = new Date(now.getTime() - (4 * 24 * 60 * 60 * 1000)).toISOString();

      const schedule = generateFiveStreamDailySchedule({
        student: { id: 'std-test' },
        plan: { dailyNewPages: 1, dailyReviewPages: 3, currentSurahNumber: 67, currentAyahNumber: 1 },
        dayNumber: 5,
        completedSurahsInLast14Days: [
          { surahNumber: 67, completedDate: fourDaysAgo }
        ]
      });

      expect(schedule.recentlyCompletedBuffer).not.toBeNull();
      expect(schedule.recentlyCompletedBuffer?.surahs[0].number).toBe(67);
      expect(schedule.recentlyCompletedBuffer?.surahs[0].completedDaysAgo).toBe(4);
    });
  });

  // =========================================================================
  // 4. Hiatus Detection Engine (> 30 Days Absence)
  // =========================================================================
  describe('Hiatus Detection Engine', () => {
    it('flags absence > 30 days and requires a retrieval re-test session', () => {
      const refDate = new Date('2026-10-23T00:00:00Z');
      const studentWithHiatus: Partial<Student> = {
        id: 'std-absent',
        lastAttendanceDate: '2026-08-15T00:00:00Z' // 69 days ago
      };

      const status = checkStudentHiatusStatus(studentWithHiatus, refDate);
      expect(status.isHiatusDetected).toBe(true);
      expect(status.hiatusDaysCount).toBeGreaterThan(30);
      expect(status.retrievalSessionRequired).toBe(true);
      expect(status.alertMessageArabic).toContain('تنبيه انقطاع');
    });

    it('does not flag active students within 30 days', () => {
      const refDate = new Date('2026-10-23T00:00:00Z');
      const activeStudent: Partial<Student> = {
        id: 'std-active',
        lastAttendanceDate: '2026-10-20T00:00:00Z' // 3 days ago
      };

      const status = checkStudentHiatusStatus(activeStudent, refDate);
      expect(status.isHiatusDetected).toBe(false);
      expect(status.retrievalSessionRequired).toBe(false);
    });
  });

  // =========================================================================
  // 5. Halaqah Multi-Shift Time Capacity Calculation (~2 min/face + buffers)
  // =========================================================================
  describe('Halaqah Multi-Shift Time Capacity Calculation', () => {
    const mockHalaqah: Partial<Halaqah> = {
      id: 'hal-asr',
      name: 'حلقة العصر',
      pacePerFaceMinutes: 2.0,
      guidanceMinutesPerStudent: 3.0,
      bufferMinutesBetweenStudents: 1.0,
      shifts: [
        {
          id: 's-asr',
          period: 'afternoon_asr',
          startTime: '16:00',
          endTime: '17:30',
          durationMinutes: 90
        }
      ]
    };

    it('calculates available capacity and flags overflow when shift time is exceeded', () => {
      // 5 students, each ~10-12 minutes = ~55 minutes -> should be under 90 min capacity
      const smallCohort: Array<Partial<Student>> = Array.from({ length: 5 }, (_, i) => ({
        id: `s-${i}`,
        name: `طالب ${i}`,
        dailyNewPages: 1,
        dailyReviewPages: 3
      }));

      const reportOk = calculateHalaqahTimeCapacity({
        halaqah: mockHalaqah,
        enrolledStudents: smallCohort,
        shiftPeriod: 'afternoon_asr'
      });

      expect(reportOk.isOverCapacity).toBe(false);
      expect(reportOk.remainingMinutes).toBeGreaterThan(0);

      // 15 students, each ~11 mins = ~165 minutes -> over 90 min capacity!
      const largeCohort: Array<Partial<Student>> = Array.from({ length: 15 }, (_, i) => ({
        id: `s-${i}`,
        name: `طالب ${i}`,
        dailyNewPages: 1,
        dailyReviewPages: 3
      }));

      const reportOver = calculateHalaqahTimeCapacity({
        halaqah: mockHalaqah,
        enrolledStudents: largeCohort,
        shiftPeriod: 'afternoon_asr'
      });

      expect(reportOver.isOverCapacity).toBe(true);
      expect(reportOver.overflowMinutes).toBeGreaterThan(0);
      expect(reportOver.actionRecommendation).toMatch(/suggest_new_shift|suggest_waiting_list/);
    });
  });

  // =========================================================================
  // 6. Plan Change Audit History Logging
  // =========================================================================
  describe('Plan Change Audit Logging', () => {
    it('creates immutable plan change log entries', () => {
      const entry = createPlanChangeLogEntry({
        changedBy: 'المشرف العام',
        reason: 'تعديل وتيرة الحفظ بناءً على طلب ولي الأمر',
        previousStateSummary: 'وجه واحد جديد + 3 أوجه مراجعة',
        newStateSummary: 'وجهان جديد + 5 أوجه مراجعة'
      });

      expect(entry.id).toMatch(/^log-/);
      expect(entry.timestamp).toBeDefined();
      expect(entry.changedBy).toBe('المشرف العام');
      expect(entry.previousStateSummary).toContain('وجه واحد');
      expect(entry.newStateSummary).toContain('وجهان');
    });
  });
});
