/**
 * King Fahd Complex Mushaf Page Mapping (مصحف مجمع الملك فهد لطباعة المصحف الشريف - 604 أوجه)
 * Maps each of the 604 pages of the King Fahd Mushaf to its exact starting and ending Ayah,
 * with complete 114 Surahs lookup and precise fractional face calculation.
 */

import { QURAN_SURAHS, getSurahInfo } from './quranData';
import type { StudentEvaluation } from '../types';

export interface QuranPageInfo {
  pageNumber: number; // 1 - 604
  juz: number; // 1 - 30
  startSurah: number;
  startAyah: number;
  endSurah: number;
  endAyah: number;
  surahNames: string[];
}

/**
 * Exact Starting Page for every Surah in the King Fahd 604-page Mushaf (مصحف المدينة النبوية)
 */
export const SURAH_START_PAGE_MAP: Record<number, number> = {
  1: 1,    // الفاتحة
  2: 2,    // البقرة
  3: 50,   // آل عمران
  4: 77,   // النساء
  5: 106,  // المائدة
  6: 128,  // الأنعام
  7: 151,  // الأعراف
  8: 177,  // الأنفال
  9: 187,  // التوبة
  10: 208, // يونس
  11: 221, // هود
  12: 235, // يوسف
  13: 249, // الرعد
  14: 255, // إبراهيم
  15: 262, // الحجر
  16: 267, // النحل
  17: 282, // الإسراء
  18: 293, // الكهف
  19: 305, // مريم
  20: 312, // طه
  21: 322, // الأنبياء
  22: 332, // الحج
  23: 342, // المؤمنون
  24: 350, // النور
  25: 359, // الفرقان
  26: 367, // الشعراء
  27: 377, // النمل
  28: 385, // القصص
  29: 396, // العنكبوت
  30: 404, // الروم
  31: 411, // لقمان
  32: 415, // السجدة
  33: 418, // الأحزاب
  34: 428, // سبأ
  35: 434, // فاطر
  36: 440, // يس
  37: 446, // الصافات
  38: 453, // ص
  39: 458, // الزمر
  40: 467, // غافر
  41: 477, // فصلت
  42: 483, // الشورى
  43: 489, // الزخرف
  44: 496, // الدخان
  45: 499, // الجاثية
  46: 502, // الأحقاف
  47: 507, // محمد
  48: 511, // الفتح
  49: 515, // الحجرات
  50: 518, // ق
  51: 520, // الذاريات
  52: 523, // الطور
  53: 526, // النجم
  54: 528, // القمر
  55: 531, // الرحمن
  56: 534, // الواقعة
  57: 537, // الحديد
  58: 542, // المجادلة
  59: 545, // الحشر
  60: 549, // الممتحنة
  61: 551, // الصف
  62: 553, // الجمعة
  63: 554, // المنافقون
  64: 556, // التغابن
  65: 558, // الطلاق
  66: 560, // التحريم
  67: 562, // الملك
  68: 564, // القلم
  69: 566, // الحاقة
  70: 568, // المعارج
  71: 570, // نوح
  72: 572, // الجن
  73: 574, // المزمل
  74: 575, // المدثر
  75: 577, // القيامة
  76: 578, // الإنسان
  77: 580, // المرسلات
  78: 582, // النبأ
  79: 583, // النازعات
  80: 585, // عبس
  81: 586, // التكوير
  82: 587, // الانفطار
  83: 587, // المطففين
  84: 589, // الانشقاق
  85: 590, // البروج
  86: 591, // الطارق
  87: 591, // الأعلى
  88: 592, // الغاشية
  89: 593, // الفجر
  90: 594, // البلد
  91: 595, // الشمس
  92: 595, // الليل
  93: 596, // الضحى
  94: 596, // الشرح
  95: 597, // التين
  96: 597, // العلق
  97: 598, // القدر
  98: 598, // البينة
  99: 599, // الزلزلة
  100: 599, // العاديات
  101: 600, // القارعة
  102: 600, // التكاثر
  103: 601, // العصر
  104: 601, // الهمزة
  105: 601, // الفيل
  106: 602, // قريش
  107: 602, // الماعون
  108: 602, // الكوثر
  109: 603, // الكافرون
  110: 603, // النصر
  111: 603, // المسد
  112: 604, // الإخلاص
  113: 604, // الفلق
  114: 604  // الناس
};

import { KING_FAHD_604_PAGE_BOUNDARIES } from './kingFahd604Boundaries';

/**
 * 100% Exact King Fahd Complex (مصحف مجمع الملك فهد لطباعة المصحف الشريف - 604 أوجه معتمدة)
 * Every single page from 1 to 604 with exact start/end surahs and ayahs.
 */
export const QURAN_PAGE_BOUNDARIES = KING_FAHD_604_PAGE_BOUNDARIES;

/**
 * Full 604 pages lookup with populated Arabic Surah names and Juz numbers
 */
export const ALL_PAGES: QuranPageInfo[] = [];

export function ensureAllPagesBuilt(): QuranPageInfo[] {
  if (ALL_PAGES.length === 0) {
    for (const entry of KING_FAHD_604_PAGE_BOUNDARIES) {
      const sNames: string[] = [];
      for (let s = entry.startSurah; s <= entry.endSurah; s++) {
        try {
          sNames.push(getSurahInfo(s).name);
        } catch {
          sNames.push(`سورة ${s}`);
        }
      }
      ALL_PAGES.push({
        pageNumber: entry.page,
        juz: entry.juz,
        startSurah: entry.startSurah,
        startAyah: entry.startAyah,
        endSurah: entry.endSurah,
        endAyah: entry.endAyah,
        surahNames: sNames.length > 0 ? sNames : [`سورة ${entry.startSurah}`]
      });
    }
  }
  return ALL_PAGES;
}

export function getKingFahdPageInfo(pageNumber: number): QuranPageInfo {
  ensureAllPagesBuilt();
  const found = ALL_PAGES.find(p => p.pageNumber === pageNumber);
  if (found) return found;
  return ALL_PAGES[0] || {
    pageNumber: 1,
    juz: 1,
    startSurah: 1,
    startAyah: 1,
    endSurah: 1,
    endAyah: 7,
    surahNames: ['الفاتحة']
  };
}

/**
 * Returns which page in the King Fahd Mushaf contains a given surah & ayah (1 - 604)
 * Grounded 100% in exact King Fahd Complex 604-page boundaries.
 */
export function getPageOfAyah(surahNumber: number, ayahNumber: number): number {
  const safeSurah = Math.max(1, Math.min(surahNumber || 1, 114));
  const safeAyah = Math.max(1, ayahNumber || 1);

  for (let i = 0; i < KING_FAHD_604_PAGE_BOUNDARIES.length; i++) {
    const p = KING_FAHD_604_PAGE_BOUNDARIES[i];
    if (p.startSurah === p.endSurah) {
      if (p.startSurah === safeSurah && safeAyah >= p.startAyah && safeAyah <= p.endAyah) {
        return p.page;
      }
    } else {
      if (safeSurah === p.startSurah && safeAyah >= p.startAyah) {
        return p.page;
      }
      if (safeSurah === p.endSurah && safeAyah <= p.endAyah) {
        return p.page;
      }
      if (safeSurah > p.startSurah && safeSurah < p.endSurah) {
        return p.page;
      }
    }
  }

  // Direct start page fallback if any out of bounds
  return SURAH_START_PAGE_MAP[safeSurah] || 1;
}

/**
<<<<<<< HEAD
 * Official King Fahd Medina Mushaf Arabic Juz Titles (الجُزْءُ الأَوَّلُ ... الجُزْءُ الثَّلَاثُونَ)
 */
export const KING_FAHD_JUZ_NAMES: Record<number, string> = {
  1: 'الجُزْءُ الأَوَّلُ',
  2: 'الجُزْءُ الثَّانِي',
  3: 'الجُزْءُ الثَّالِثُ',
  4: 'الجُزْءُ الرَّابِعُ',
  5: 'الجُزْءُ الخَامِسُ',
  6: 'الجُزْءُ السَّادِسُ',
  7: 'الجُزْءُ السَّابِعُ',
  8: 'الجُزْءُ الثَّامِنُ',
  9: 'الجُزْءُ التَّاسِعُ',
  10: 'الجُزْءُ العَاشِرُ',
  11: 'الجُزْءُ الحَادِي عَشَرَ',
  12: 'الجُزْءُ الثَّانِي عَشَرَ',
  13: 'الجُزْءُ الثَّالِثَ عَشَرَ',
  14: 'الجُزْءُ الرَّابِعَ عَشَرَ',
  15: 'الجُزْءُ الخَامِسَ عَشَرَ',
  16: 'الجُزْءُ السَّادِسَ عَشَرَ',
  17: 'الجُزْءُ السَّابِعَ عَشَرَ',
  18: 'الجُزْءُ الثَّامِنَ عَشَرَ',
  19: 'الجُزْءُ التَّاسِعَ عَشَرَ',
  20: 'الجُزْءُ العِشْرُونَ',
  21: 'الجُزْءُ الحَادِي وَالعِشْرُونَ',
  22: 'الجُزْءُ الثَّانِي وَالعِشْرُونَ',
  23: 'الجُزْءُ الثَّالِثُ وَالعِشْرُونَ',
  24: 'الجُزْءُ الرَّابِعُ وَالعِشْرُونَ',
  25: 'الجُزْءُ الخَامِسُ وَالعِشْرُونَ',
  26: 'الجُزْءُ السَّادِسُ وَالعِشْرُونَ',
  27: 'الجُزْءُ السَّابِعُ وَالعِشْرُونَ',
  28: 'الجُزْءُ الثَّامِنُ وَالعِشْرُونَ',
  29: 'الجُزْءُ التَّاسِعُ وَالعِشْرُونَ',
  30: 'الجُزْءُ الثَّلَاثُونَ'
};

export interface RecitationRangeBounds {
  surahNumber: number;
  fromAyah: number;
  toSurahNumber?: number;
  toAyah: number;
}

/**
 * Checks whether (surahNum, ayahNum) falls within a recitation range,
 * supporting single-surah AND multi-surah ranges in BOTH ascending order
 * (e.g. البقرة -> آل عمران, الإخلاص -> الناس) AND descending order
 * (e.g. من الناس 114 إلى الإخلاص 112 — highlighting الناس, الفلق, and الإخلاص completely!).
 */
export function isAyahInRecitationRange(
  surahNum: number,
  ayahNum: number,
  range?: RecitationRangeBounds | null
): boolean {
  if (!range) return false;
  const startS = range.surahNumber;
  const startA = range.fromAyah || 1;
  const endS = range.toSurahNumber || startS;
  const endA = range.toAyah || startA;

  if (startS === endS) {
    const minA = Math.min(startA, endA);
    const maxA = Math.max(startA, endA);
    return surahNum === startS && ayahNum >= minA && ayahNum <= maxA;
  }

  const minS = Math.min(startS, endS);
  const maxS = Math.max(startS, endS);

  // Every surah strictly between startS and endS is 100% included
  if (surahNum > minS && surahNum < maxS) {
    return true;
  }
  if (surahNum === startS) {
    return ayahNum >= startA;
  }
  if (surahNum === endS) {
    return ayahNum <= endA;
  }
  return false;
}

/**
 * Expands any single-surah or multi-surah range (ascending or descending surah order)
 * into an ordered sequence of { surah, ayah } pairs for audio recitation and counting.
 */
export function getExpandedAyahSequenceForRange(
  range: RecitationRangeBounds
): Array<{ surah: number; ayah: number }> {
  const startS = Math.max(1, Math.min(range.surahNumber || 1, 114));
  const endS = Math.max(1, Math.min(range.toSurahNumber || startS, 114));
  const sInfo = getSurahInfo(startS);
  const eInfo = getSurahInfo(endS);
  const startA = Math.max(1, Math.min(range.fromAyah || 1, sInfo.numberOfAyahs));
  const endA = Math.max(1, Math.min(range.toAyah || startA, eInfo.numberOfAyahs));

  const seq: Array<{ surah: number; ayah: number }> = [];

  if (startS === endS) {
    const minA = Math.min(startA, endA);
    const maxA = Math.max(startA, endA);
    for (let a = minA; a <= maxA; a++) {
      seq.push({ surah: startS, ayah: a });
    }
    return seq;
  }

  const step = startS < endS ? 1 : -1;
  for (let s = startS; step > 0 ? s <= endS : s >= endS; s += step) {
    const info = getSurahInfo(s);
    const from = s === startS ? startA : 1;
    const to = s === endS ? endA : info.numberOfAyahs;
    for (let a = from; a <= to; a++) {
      seq.push({ surah: s, ayah: a });
    }
  }
  return seq;
}

/**
=======
>>>>>>> fe1326044c44ff41cee71f10bb01b26f4533f2d4
 * Calculate precise fractional faces (أوجه القرآن الكريم) for any recitation portion.
 * Rules:
 * - 0.25 on quarter face (ربع وجه)
 * - 0.5 on half face (نصف وجه)
 * - 0.75 on three-quarters face (ثلاثة أرباع وجه)
 * - 1.0 on whole face (وجه كامل)
<<<<<<< HEAD
 * Supports single or multi-surah ranges (ascending & descending) and returns cleanly rounded fractions.
=======
 * Supports single or multi-surah ranges and returns cleanly rounded fractions.
>>>>>>> fe1326044c44ff41cee71f10bb01b26f4533f2d4
 */
export function calculateRecitationFractionalFaces(
  startSurah: number,
  startAyah: number,
  endSurah?: number,
  endAyah?: number
): number {
  const eSurah = endSurah || startSurah;
  const sInfo = getSurahInfo(startSurah);
  const eInfo = getSurahInfo(eSurah);

  const sAyah = Math.max(1, Math.min(startAyah || 1, sInfo.numberOfAyahs));
  const toAyah = Math.max(1, Math.min(endAyah || sAyah, eInfo.numberOfAyahs));

  const startPage = getPageOfAyah(startSurah, sAyah);
  const endPage = getPageOfAyah(eSurah, toAyah);

  // Single page range
  if (startPage === endPage) {
    if (startSurah === eSurah) {
<<<<<<< HEAD
      const ayahsRecited = Math.max(1, Math.abs(toAyah - sAyah) + 1);
=======
      const ayahsRecited = Math.max(1, toAyah - sAyah + 1);
>>>>>>> fe1326044c44ff41cee71f10bb01b26f4533f2d4
      const totalInSurah = sInfo.numberOfAyahs;

      if (ayahsRecited >= totalInSurah && totalInSurah <= 15) {
        return 1.0;
      }
      if (ayahsRecited <= 3 && totalInSurah >= 8) {
        return 0.25;
      }
      if (ayahsRecited <= 7 && totalInSurah >= 12) {
        return 0.5;
      }
      if (ayahsRecited <= 11 && totalInSurah >= 15) {
        return 0.75;
      }
      return 1.0;
    } else {
<<<<<<< HEAD
      // Multiple short surahs on the same page (e.g. Page 604: الإخلاص، الفلق، الناس)
      const pageAyahs = getAyahsOnPage(startPage);
      if (pageAyahs.length > 0) {
        const rangeObj: RecitationRangeBounds = {
          surahNumber: startSurah,
          fromAyah: sAyah,
          toSurahNumber: eSurah,
          toAyah
        };
        const coveredCount = pageAyahs.filter(pa =>
          isAyahInRecitationRange(pa.surah, pa.ayah, rangeObj)
        ).length;
        const ratio = coveredCount / pageAyahs.length;
        if (ratio >= 0.85) return 1.0;
        if (ratio >= 0.6) return 0.75;
        if (ratio >= 0.35) return 0.5;
        return 0.25;
      }
=======
      // Multiple short surahs on the same page (e.g. Al-Falaq & An-Nas on page 604)
>>>>>>> fe1326044c44ff41cee71f10bb01b26f4533f2d4
      return 1.0;
    }
  }

  // Multi-page range
  const fullPagesCount = Math.max(1, Math.abs(endPage - startPage) + 1);
  return fullPagesCount;
}

export function formatPageTitle(pageNumber: number): string {
  const page = getKingFahdPageInfo(pageNumber);
  if (page.startSurah === page.endSurah) {
    const sName = getSurahInfo(page.startSurah).name;
    return `الوجه ${pageNumber} (سورة ${sName} الآيات ${page.startAyah} - ${page.endAyah})`;
  }
  const s1 = getSurahInfo(page.startSurah).name;
  const s2 = getSurahInfo(page.endSurah).name;
  return `الوجه ${pageNumber} (من ${s1} ${page.startAyah} إلى ${s2} ${page.endAyah})`;
}

/**
 * Check if a specific page is completely covered by a list of recitation ranges
 */
export function isPageCovered(
  page: QuranPageInfo,
<<<<<<< HEAD
  ranges: Array<{ surahNumber: number; fromAyah: number; toSurahNumber?: number; toAyah: number }>
): boolean {
  if (!ranges || ranges.length === 0) return false;
  const ayahsOnPage = getAyahsOnPage(page.pageNumber);
  if (ayahsOnPage.length === 0) return false;

  return ayahsOnPage.every(({ surah, ayah }) =>
    ranges.some(r => isAyahInRecitationRange(surah, ayah, r))
  );
=======
  ranges: Array<{ surahNumber: number; fromAyah: number; toAyah: number }>
): boolean {
  if (!ranges || ranges.length === 0) return false;

  if (page.startSurah === page.endSurah) {
    for (let ayah = page.startAyah; ayah <= page.endAyah; ayah++) {
      const isAyahCovered = ranges.some(
        r => r.surahNumber === page.startSurah && ayah >= r.fromAyah && ayah <= r.toAyah
      );
      if (!isAyahCovered) return false;
    }
    return true;
  }

  const firstSurahInfo = getSurahInfo(page.startSurah);
  for (let a = page.startAyah; a <= firstSurahInfo.numberOfAyahs; a++) {
    const covered = ranges.some(
      r => r.surahNumber === page.startSurah && a >= r.fromAyah && a <= r.toAyah
    );
    if (!covered) return false;
  }

  for (let a = 1; a <= page.endAyah; a++) {
    const covered = ranges.some(
      r => r.surahNumber === page.endSurah && a >= r.fromAyah && a <= r.toAyah
    );
    if (!covered) return false;
  }

  return true;
>>>>>>> fe1326044c44ff41cee71f10bb01b26f4533f2d4
}

export interface PagePointsResult {
  completedNewPages: number[];
  completedReviewPages: number[];
  newCompletedPagesToday: number[];
  pointsEarnedToday: number;
  totalPagePoints: number;
}

export function evaluateStudentPageProgress(
  historicalNewRanges: Array<{ surahNumber: number; fromAyah: number; toAyah: number }>,
  historicalReviewRanges: Array<{ surahNumber: number; fromAyah: number; toAyah: number }>,
  todayNewRange?: { surahNumber: number; fromAyah: number; toAyah: number },
  todayReviewRanges?: Array<{ surahNumber: number; fromAyah: number; toAyah: number }>,
  previouslyCompletedNewPages: number[] = [],
  previouslyCompletedReviewPages: number[] = []
): PagePointsResult {
  const allNewRanges = todayNewRange
    ? [...historicalNewRanges, todayNewRange]
    : historicalNewRanges;

  const allReviewRanges = todayReviewRanges
    ? [...historicalReviewRanges, ...todayReviewRanges]
    : historicalReviewRanges;

  const completedNewPages: number[] = [];
  const completedReviewPages: number[] = [];
  const newCompletedPagesToday: number[] = [];

  for (const page of ALL_PAGES) {
    const pageNum = page.pageNumber;

    if (isPageCovered(page, allNewRanges)) {
      completedNewPages.push(pageNum);
      if (!previouslyCompletedNewPages.includes(pageNum)) {
        newCompletedPagesToday.push(pageNum);
      }
    }

    if (isPageCovered(page, allReviewRanges)) {
      completedReviewPages.push(pageNum);
    }
  }

  const totalNewPagePoints = completedNewPages.length * 1;
  const totalReviewPagePoints = completedReviewPages.length * 1;
  const totalPagePoints = totalNewPagePoints + totalReviewPagePoints;

  const newPagesTodayPoints = newCompletedPagesToday.length * 1;
  const newReviewPagesToday = completedReviewPages.filter(p => !previouslyCompletedReviewPages.includes(p));
  const pointsEarnedToday = newPagesTodayPoints + (newReviewPagesToday.length * 1);

  return {
    completedNewPages,
    completedReviewPages,
    newCompletedPagesToday,
    pointsEarnedToday,
    totalPagePoints
  };
}

/**
 * Calculates total completed/memorized pages for a student
 */
export function calculateStudentCompletedPages(
  student?: {
    id?: string;
    completedNewPages?: number[];
    completedReviewPages?: number[];
    currentSurah?: number;
    currentAyah?: number;
  } | null,
  evaluations: StudentEvaluation[] = []
): {
  newPagesCount: number;
  reviewPagesCount: number;
  totalPagesCount: number;
  uniqueNewPages: number[];
  uniqueReviewPages: number[];
  currentMushafPage?: number;
  currentJuz?: number;
  currentSurahName?: string;
} {
  if (!student) {
    return {
      newPagesCount: 0,
      reviewPagesCount: 0,
      totalPagesCount: 0,
      uniqueNewPages: [],
      uniqueReviewPages: [],
      currentMushafPage: 582,
      currentJuz: 30,
      currentSurahName: 'النبأ'
    };
  }

  const newPagesSet = new Set<number>(student.completedNewPages || []);
  const reviewPagesSet = new Set<number>(student.completedReviewPages || []);

  const studentEvals = (evaluations || []).filter(e => e && e.studentId === student.id);

  for (const ev of studentEvals) {
    const details = ev.recitationDetails;
    if (!details || typeof details !== 'object') continue;

    if (Array.isArray(details.pagesCompletedToday)) {
      details.pagesCompletedToday.forEach(p => {
        if (typeof p === 'number' && p >= 1 && p <= 604) {
          newPagesSet.add(p);
        }
      });
    }

    if (details.todayNewItem && typeof details.todayNewItem === 'object' && !details.todayNewItem.didNotRecite) {
      const startSurah = details.todayNewItem.surahNumber || 78;
      const startAyah = details.todayNewItem.fromAyah || 1;
      const endSurah = details.todayNewItem.toSurahNumber || startSurah;
      const endAyah = details.todayNewItem.toAyah || startAyah;

      const startPage = getPageOfAyah(startSurah, startAyah);
      const endPage = getPageOfAyah(endSurah, endAyah);
      const minP = Math.min(startPage, endPage);
      const maxP = Math.max(startPage, endPage);

      for (let p = minP; p <= maxP; p++) {
        newPagesSet.add(p);
      }
    }

    if (Array.isArray(details.todayReviewItems)) {
      for (const item of details.todayReviewItems) {
        if (item && typeof item === 'object' && !item.didNotRecite) {
          const sSurah = item.surahNumber || 78;
          const sAyah = item.fromAyah || 1;
          const eSurah = item.toSurahNumber || sSurah;
          const eAyah = item.toAyah || sAyah;

          const sPage = getPageOfAyah(sSurah, sAyah);
          const ePage = getPageOfAyah(eSurah, eAyah);
          const minP = Math.min(sPage, ePage);
          const maxP = Math.max(sPage, ePage);

          for (let p = minP; p <= maxP; p++) {
            reviewPagesSet.add(p);
          }
        }
      }
    }
  }

  const curSurah = student.currentSurah || 78;
  const curAyah = student.currentAyah || 1;
  const currentMushafPage = getPageOfAyah(curSurah, curAyah);
  const curPageInfo = getKingFahdPageInfo(currentMushafPage);

  if (newPagesSet.size === 0 && student.currentSurah) {
    if (currentMushafPage >= 582) {
      for (let p = 582; p <= currentMushafPage; p++) {
        newPagesSet.add(p);
      }
    } else {
      for (let p = 1; p <= currentMushafPage; p++) {
        newPagesSet.add(p);
      }
    }
  }

  const uniqueNewPages = Array.from(newPagesSet).sort((a, b) => a - b);
  const uniqueReviewPages = Array.from(reviewPagesSet).sort((a, b) => a - b);

  return {
    newPagesCount: uniqueNewPages.length,
    reviewPagesCount: uniqueReviewPages.length,
    totalPagesCount: uniqueNewPages.length,
    uniqueNewPages,
    uniqueReviewPages,
    currentMushafPage,
    currentJuz: curPageInfo.juz,
    currentSurahName: getSurahInfo(curSurah).name
  };
}

/**
 * Calculates exact Quran portion (starting and ending surah & ayah) from a given start point
 * and a daily page pace (e.g. 0.5 = نصف وجه, 1.0 = وجه كامل, 2.0 = وجهان).
 * Grounded 100% in the King Fahd 604-page Mushaf boundaries so the student gets realistic
 * verse ranges rather than arbitrary numbers.
 */
/**
 * Returns all ayahs located on a specific page of the King Fahd 604-page Mushaf
 */
export function getAyahsOnPage(pageNumber: number): Array<{ surah: number; ayah: number }> {
  const p = KING_FAHD_604_PAGE_BOUNDARIES[pageNumber - 1];
  if (!p) return [];
  const list: Array<{ surah: number; ayah: number }> = [];
  if (p.startSurah === p.endSurah) {
    for (let a = p.startAyah; a <= p.endAyah; a++) {
      list.push({ surah: p.startSurah, ayah: a });
    }
  } else {
    for (let s = p.startSurah; s <= p.endSurah; s++) {
      const sInfo = getSurahInfo(s);
      const startA = (s === p.startSurah) ? p.startAyah : 1;
      const endA = (s === p.endSurah) ? p.endAyah : sInfo.numberOfAyahs;
      for (let a = startA; a <= endA; a++) {
        list.push({ surah: s, ayah: a });
      }
    }
  }
  return list;
}

/**
 * Calculates exact Quran portion (starting and ending surah & ayah) from a given start point
 * and a daily page pace (e.g. 0.5 = نصف وجه, 1.0 = وجه كامل, 2.0 = وجهان).
 * Grounded 100% in the King Fahd 604-page Mushaf boundaries so the student gets realistic
 * verse ranges rather than arbitrary numbers.
 */
export function calculatePortionFromPace(
  startSurah: number = 78,
  startAyah: number = 1,
  pagePace: number = 0.5
): {
  fromSurah: number;
  fromAyah: number;
  toSurah: number;
  toAyah: number;
  pageCount: number;
  description: string;
} {
  let safeStartSurah = Math.max(1, Math.min(startSurah || 78, 114));
  let safeStartAyah = Math.max(1, startAyah || 1);
  let sInfo = getSurahInfo(safeStartSurah);

  if (safeStartAyah > sInfo.numberOfAyahs) {
    if (safeStartSurah < 114) {
      safeStartSurah += 1;
      safeStartAyah = 1;
      sInfo = getSurahInfo(safeStartSurah);
    } else {
      safeStartSurah = 1;
      safeStartAyah = 1;
      sInfo = getSurahInfo(1);
    }
  }

  const safePace = Math.max(0.25, Math.min(pagePace || 0.5, 5));
  const targetLines = Math.max(3.5, 15 * safePace); // 7.5 lines for half-page (15 lines per standard page)

  let curPage = getPageOfAyah(safeStartSurah, safeStartAyah);
  let pageAyahs = getAyahsOnPage(curPage);
  let startIdx = pageAyahs.findIndex(it => it.surah === safeStartSurah && it.ayah === safeStartAyah);
  if (startIdx === -1) startIdx = 0;

  let accumulatedLines = 0;
  let curIdx = startIdx;
  let lastItem = pageAyahs[curIdx] || { surah: safeStartSurah, ayah: safeStartAyah };

  while (accumulatedLines < targetLines && curPage <= 604) {
    const totalAyahsOnPage = Math.max(1, pageAyahs.length);
    const linesPerAyah = 15 / totalAyahsOnPage;

    while (curIdx < pageAyahs.length && accumulatedLines < targetLines) {
      accumulatedLines += linesPerAyah;
      lastItem = pageAyahs[curIdx];
      curIdx++;
    }

    if (accumulatedLines < targetLines) {
      curPage++;
      if (curPage > 604) break;
      pageAyahs = getAyahsOnPage(curPage);
      if (pageAyahs.length === 0) break;
      curIdx = 0;
    }
  }

  const targetItem = lastItem;
  const endSurahInfo = getSurahInfo(targetItem.surah);

  let paceLabel = `${safePace} وجه`;
  if (Math.abs(safePace - 0.25) < 0.05) paceLabel = 'ربع وجه';
  else if (Math.abs(safePace - 0.5) < 0.05) paceLabel = 'نصف وجه';
  else if (Math.abs(safePace - 0.75) < 0.05) paceLabel = 'ثلاثة أرباع وجه';
  else if (Math.abs(safePace - 1.0) < 0.05) paceLabel = 'وجه كامل';
  else if (Math.abs(safePace - 1.5) < 0.05) paceLabel = 'وجه ونصف';
  else if (Math.abs(safePace - 2.0) < 0.05) paceLabel = 'وجهان';

  const description = safeStartSurah === targetItem.surah
    ? `سورة ${sInfo.name}: من الآية (${safeStartAyah}) إلى الآية (${targetItem.ayah}) [${paceLabel}]`
    : `من سورة ${sInfo.name} (${safeStartAyah}) إلى سورة ${endSurahInfo.name} (${targetItem.ayah}) [${paceLabel}]`;

  return {
    fromSurah: safeStartSurah,
    fromAyah: safeStartAyah,
    toSurah: targetItem.surah,
    toAyah: targetItem.ayah,
    pageCount: safePace,
    description
  };
}
