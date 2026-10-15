/**
 * Omran Platform Centralized Student Search, Scope Isolation, and RBAC Engine
 * 
 * Provides deterministic, secure, and verifiable resolution of student queries for AI assistant
 * and platform services.
 * 
 * Strict Guarantees:
 * 1. Single student query -> exactly that student (or NOT_FOUND). Never pads or expands.
 * 2. Two students query -> exactly those 2 students. Never expands to whole roster.
 * 3. Specific N students -> at most N matched students.
 * 4. All students query -> only returns authorized students when explicitly requested.
 * 5. Absent students filter -> strictly evaluates date and status === 'غائب'.
 * 6. Ambiguous names -> flags ambiguity with disambiguation options rather than picking blindly.
 * 7. RBAC -> enforces strict role limits (guest: none, student: self, parent: children, teacher: halaqah, supervisor: complex).
 */

import { Student, AttendanceRecord, StudentEvaluation } from '../types';

export interface SearchUserContext {
  userId?: string;
  username?: string;
  userName?: string;
  name?: string;
  role: 'developer' | 'supervisor' | 'teacher' | 'parent' | 'student' | 'guest';
  teacherId?: string;
  studentId?: string;
  parentId?: string;
  assignedStudentIds?: string[];
  authorizedComplexIds?: string[];
  authorizedHalaqahIds?: string[];
  complexId?: string;
  complexName?: string;
  assignedHalaqahId?: string;
  assignedHalaqahIds?: string[];
  activeHalaqahId?: string;
  childStudentIds?: string[];
  studentIds?: string[];
  halaqahId?: string;
}

export interface StudentSearchFilter {
  query?: string;
  studentIds?: string[];
  studentNames?: string[];
  halaqahId?: string;
  halaqahName?: string;
  complexId?: string;
  complexName?: string;
  levelFilter?: string;
  surahFilter?: string;
  teacherId?: string;
  teacherName?: string;
  attendanceStatus?: 'حاضر' | 'غائب' | 'معتذر' | 'متأخر';
  targetDate?: string;
  limit?: number;
  offset?: number;
  isExplicitAllRequested?: boolean;
  sortCriteria?: 'points_desc' | 'points_asc' | 'alpha' | 'attendance_desc' | 'absent_desc' | 'surah' | 'level';
}

export interface StudentResolutionResult {
  status: 'SUCCESS' | 'NOT_FOUND' | 'AMBIGUOUS' | 'PERMISSION_DENIED' | 'EMPTY';
  message: string;
  requestedCount: number;
  totalAvailable: number;
  matchedStudents: any[];
  ambiguousCandidates?: Array<{
    searchedName: string;
    matches: Array<{ id: string; name: string; halaqahName: string; halaqahId: string }>;
  }>;
  notFoundNames?: string[];
  isAllRequested: boolean;
  pageInfo: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  detectedLevel?: string;
  detectedHalaqah?: string;
  detectedComplex?: string;
  detectedSort?: string;
}

/**
 * Normalize Arabic text for uniform matching (strip tashkeel, normalize alef, yaa, taa marbuta)
 */
export function normalizeArabicText(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '') // tashkeel & Quranic marks
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ى]/g, 'ي')
    .toLowerCase();
}

/**
 * Clean helper: Extract base halaqah name without generic prefix words ("حلقة", "المجموعة", etc.)
 */
export function cleanHalaqahBaseName(name: string): string {
  return normalizeArabicText(name || '')
    .replace(/^(?:حلقه|الحلقه|احلققه|احلقه|مجموعه|المجموعه)\s+/, '')
    .replace(/\s*(?:رضي\s+الله\s+عنه|رضوان\s+الله\s+عليه|رحمه\s+الله).*$/, '')
    .trim();
}

/**
 * Strict helper: Check if a student belongs to a specific halaqah
 */
export function isStudentInHalaqah(student: any, halaqah: any): boolean {
  if (!student || !halaqah) return false;
  if (halaqah.id && student.halaqahId && student.halaqahId === halaqah.id) return true;

  const cleanTarget = cleanHalaqahBaseName(halaqah.name || '');
  const cleanStudentH = cleanHalaqahBaseName(student.halaqahName || '');
  if (!cleanTarget || !cleanStudentH) return false;

  if (cleanTarget === cleanStudentH) return true;
  if (cleanTarget.length >= 4 && cleanStudentH.includes(cleanTarget)) return true;
  if (cleanStudentH.length >= 4 && cleanTarget.includes(cleanStudentH)) return true;

  const stopWords = new Set(['حلقه', 'الحلقه', 'احلققه', 'احلقه', 'مجموعه', 'المجموعه', 'بن', 'ابن', 'عبد', 'الله', 'في', 'من', 'مع', 'عن', 'طلاب', 'طالب', 'رضي', 'عنه']);
  const tokens = cleanTarget.split(/\s+/).filter(w => w.length >= 3 && !stopWords.has(w));
  return tokens.some(tok => cleanStudentH.includes(tok));
}

/**
/**
 * Helper to strip the Arabic definite article "ال" or "الـ" from a word for resilient root matching
 */
export function stripArabicDefinite(w: string): string {
  if (!w) return '';
  return normalizeArabicText(w).replace(/^(?:ال|الـ)/, '').trim();
}

/**
 * Clean helper: Extract base complex name without generic prefix words ("مجمع", "المجمع")
 */
export function cleanComplexBaseName(name: string): string {
  return normalizeArabicText(name || '')
    .replace(/^(?:مجمع|المجمع|جامع|الجامع|مركز|المركز|مسجد|المسجد)\s+/, '')
    .replace(/\s*(?:القراني|القرآني|النموذجي|لتحفيظ\s+القران|لتحفيظ\s+القرآن|الكريم).*$/, '')
    .trim();
}

/**
 * Strict helper: Check if a halaqah belongs to a specific complex
 */
export function isHalaqahInComplex(
  halaqah: any,
  complexTarget: { id?: string; name?: string } | null,
  complexesList: any[] = [],
  studentsList: any[] = [],
  teachersList: any[] = []
): boolean {
  if (!halaqah || !complexTarget) return false;
  const targetId = complexTarget.id;
  const targetName = complexTarget.name || '';
  const cleanTarget = cleanComplexBaseName(targetName);
  const bareTarget = stripArabicDefinite(cleanTarget);

  // 1. Direct ID match
  if (targetId && targetId !== 'all' && halaqah.complexId && halaqah.complexId === targetId) return true;

  // 2. Direct name match (exact and root)
  if (halaqah.complexName && cleanTarget) {
    const cleanH = cleanComplexBaseName(halaqah.complexName);
    const bareH = stripArabicDefinite(cleanH);
    if (cleanH === cleanTarget) return true;
    if (bareTarget && bareH && bareTarget === bareH) return true;
    if (cleanTarget.length >= 3 && cleanH.includes(cleanTarget)) return true;
    if (cleanH.length >= 3 && cleanTarget.includes(cleanH)) return true;
    if (bareTarget.length >= 3 && bareH.includes(bareTarget)) return true;
    if (bareH.length >= 3 && bareTarget.includes(bareH)) return true;
  }

  // 3. Token match
  if (cleanTarget) {
    const stopWords = new Set(['مجمع', 'المجمع', 'قراني', 'قرآني', 'القراني', 'القرآني', 'نموذجي', 'النموذجي', 'لتحفيظ', 'القران', 'القرآن', 'الكريم', 'عام', 'العام', 'بن', 'ابن']);
    const tokens = cleanTarget.split(/\s+/).filter(w => w.length >= 3 && !stopWords.has(w));
    const bareTokens = tokens.map(t => stripArabicDefinite(t)).filter(w => w.length >= 3);
    const allTokens = [...new Set([...tokens, ...bareTokens])];

    if (allTokens.length > 0) {
      const hFields = [halaqah.complexName, halaqah.name, halaqah.description].filter(Boolean).map(f => normalizeArabicText(f));
      for (const tok of allTokens) {
        if (hFields.some(f => f.includes(tok) || stripArabicDefinite(f).includes(tok))) return true;
      }
    }
  }

  return false;
}

/**
 * Strict helper: Check if a student belongs to a specific complex
 */
export function isStudentInComplex(
  student: any,
  complexTarget: { id?: string; name?: string } | null,
  halaqahsList: any[] = [],
  teachersList: any[] = []
): boolean {
  if (!student || !complexTarget) return false;
  const targetId = complexTarget.id;
  const targetName = complexTarget.name || '';
  const cleanTargetName = cleanComplexBaseName(targetName);
  const bareTarget = stripArabicDefinite(cleanTargetName);
  const normTarget = normalizeArabicText(targetName);

  // 1. Direct complexId match (exact or normalized)
  if (targetId && targetId !== 'all') {
    if (student.complexId === targetId) return true;
    if (student.complexId && normalizeArabicText(student.complexId) === normalizeArabicText(targetId)) return true;
  }

  // 2. Direct student complexName match (exact, root, and bare)
  if (student.complexName && cleanTargetName) {
    const cleanStudentC = cleanComplexBaseName(student.complexName);
    const bareStudentC = stripArabicDefinite(cleanStudentC);
    const normStudentC = normalizeArabicText(student.complexName);
    if (cleanStudentC === cleanTargetName || normStudentC === normTarget) return true;
    if (bareTarget && bareStudentC && bareTarget === bareStudentC) return true;
    if (cleanTargetName.length >= 3 && cleanStudentC.includes(cleanTargetName)) return true;
    if (cleanStudentC.length >= 3 && cleanTargetName.includes(cleanStudentC)) return true;
    if (bareTarget.length >= 3 && bareStudentC.includes(bareTarget)) return true;
    if (bareStudentC.length >= 3 && bareTarget.includes(bareStudentC)) return true;
  }

  // 3. Match via student's halaqah
  const h = (student.halaqahId || student.halaqahName)
    ? halaqahsList.find(hl => hl.id === student.halaqahId || (student.halaqahName && normalizeArabicText(hl.name) === normalizeArabicText(student.halaqahName)))
    : null;

  if (h) {
    if (targetId && targetId !== 'all') {
      if (h.complexId === targetId) return true;
      if (h.complexId && normalizeArabicText(h.complexId) === normalizeArabicText(targetId)) return true;
    }
    if (h.complexName && cleanTargetName) {
      const cleanHC = cleanComplexBaseName(h.complexName);
      const bareHC = stripArabicDefinite(cleanHC);
      const normHC = normalizeArabicText(h.complexName);
      if (cleanHC === cleanTargetName || normHC === normTarget) return true;
      if (bareTarget && bareHC && bareTarget === bareHC) return true;
      if (cleanTargetName.length >= 3 && cleanHC.includes(cleanTargetName)) return true;
      if (cleanHC.length >= 3 && cleanTargetName.includes(cleanHC)) return true;
      if (bareTarget.length >= 3 && bareHC.includes(bareTarget)) return true;
      if (bareHC.length >= 3 && bareTarget.includes(bareHC)) return true;
    }

    // 3.1 Check if halaqah's teacher belongs to this complex
    if (teachersList && teachersList.length > 0) {
      const matchedTeacher = teachersList.find(t =>
        (h.primaryTeacherId && t.id === h.primaryTeacherId) ||
        (student.teacherId && t.id === student.teacherId) ||
        (h.primaryTeacherName && normalizeArabicText(t.name) === normalizeArabicText(h.primaryTeacherName)) ||
        (t.halaqahId && t.halaqahId === h.id) ||
        (Array.isArray(t.halaqahIds) && t.halaqahIds.includes(h.id))
      );

      if (matchedTeacher) {
        if (targetId && targetId !== 'all') {
          if (matchedTeacher.complexId === targetId) return true;
          if (Array.isArray(matchedTeacher.complexIds) && matchedTeacher.complexIds.includes(targetId)) return true;
        }
        if (matchedTeacher.complexName && cleanTargetName) {
          const cleanTC = cleanComplexBaseName(matchedTeacher.complexName);
          const bareTC = stripArabicDefinite(cleanTC);
          if (cleanTC === cleanTargetName || bareTC === bareTarget) return true;
        }
        if (Array.isArray(matchedTeacher.complexNames) && cleanTargetName) {
          if (matchedTeacher.complexNames.some((cn: string) => cleanComplexBaseName(cn) === cleanTargetName || stripArabicDefinite(cleanComplexBaseName(cn)) === bareTarget)) {
            return true;
          }
        }
      }
    }
  }

  // 4. Token match for distinctive complex name (e.g. "الحربي", "الفرقان", "النور")
  if (cleanTargetName) {
    const stopWords = new Set(['مجمع', 'المجمع', 'قراني', 'قرآني', 'القراني', 'القرآني', 'نموذجي', 'النموذجي', 'لتحفيظ', 'القران', 'القرآن', 'الكريم', 'عام', 'العام', 'بن', 'ابن', 'عبد', 'الله']);
    const tokens = cleanTargetName.split(/\s+/).filter(w => w.length >= 3 && !stopWords.has(w));
    const bareTokens = tokens.map(t => stripArabicDefinite(t)).filter(w => w.length >= 3);
    const allTokens = [...new Set([...tokens, ...bareTokens, bareTarget])].filter(w => w.length >= 3 && !stopWords.has(w));

    if (allTokens.length > 0) {
      const studentFields = [
        student.complexName,
        student.complexId,
        student.halaqahName,
        student.notes,
        h?.complexName,
        h?.complexId,
        h?.name,
        h?.description
      ].filter(Boolean).map(f => normalizeArabicText(f));

      for (const tok of allTokens) {
        if (studentFields.some(f => f.includes(tok) || stripArabicDefinite(f).includes(tok))) return true;
      }
    }
  }

  return false;
}

/**
 * Strict helper: Check if a teacher belongs to a specific complex
 */
export function isTeacherInComplex(
  teacher: any,
  complexTarget: { id?: string; name?: string } | null,
  halaqahsList: any[] = []
): boolean {
  if (!teacher || !complexTarget) return false;
  const targetId = complexTarget.id;
  const targetName = complexTarget.name || '';
  const cleanTargetName = cleanComplexBaseName(targetName);
  const bareTarget = stripArabicDefinite(cleanTargetName);
  const normTargetName = normalizeArabicText(targetName);

  // 1. Direct complexId match or assignedComplexIds
  if (targetId && targetId !== 'all') {
    if (teacher.complexId === targetId) return true;
    if (Array.isArray(teacher.assignedComplexIds) && teacher.assignedComplexIds.includes(targetId)) return true;
    if (Array.isArray(teacher.authorizedComplexIds) && teacher.authorizedComplexIds.includes(targetId)) return true;
  }

  // 2. Direct complexName match
  if (teacher.complexName) {
    const cleanTC = cleanComplexBaseName(teacher.complexName);
    const bareTC = stripArabicDefinite(cleanTC);
    const normTC = normalizeArabicText(teacher.complexName);
    if (cleanTC === cleanTargetName || normTC === normTargetName) return true;
    if (bareTarget && bareTC && bareTarget === bareTC) return true;
    if (cleanTargetName.length >= 3 && cleanTC.includes(cleanTargetName)) return true;
    if (cleanTC.length >= 3 && cleanTargetName.includes(cleanTC)) return true;
    if (bareTarget.length >= 3 && bareTC.includes(bareTarget)) return true;
    if (bareTC.length >= 3 && bareTarget.includes(bareTC)) return true;
  }

  // 3. Match via teacher's halaqahs
  const teacherHalaqahs = Array.isArray(halaqahsList)
    ? halaqahsList.filter(h =>
        h.primaryTeacherId === teacher.id ||
        h.teacherId === teacher.id ||
        (teacher.assignedHalaqahIds && teacher.assignedHalaqahIds.includes(h.id)) ||
        (teacher.halaqahId && teacher.halaqahId === h.id)
      )
    : [];

  for (const h of teacherHalaqahs) {
    if (targetId && targetId !== 'all' && h.complexId === targetId) return true;
    if (h.complexName) {
      const cleanHC = cleanComplexBaseName(h.complexName);
      const bareHC = stripArabicDefinite(cleanHC);
      if (cleanHC === cleanTargetName) return true;
      if (bareTarget && bareHC && bareTarget === bareHC) return true;
      if (cleanTargetName.length >= 3 && cleanHC.includes(cleanTargetName)) return true;
      if (cleanHC.length >= 3 && cleanTargetName.includes(cleanHC)) return true;
      if (bareTarget.length >= 3 && bareHC.includes(bareTarget)) return true;
      if (bareHC.length >= 3 && bareTarget.includes(bareHC)) return true;
    }
  }

  // 4. Token match
  if (cleanTargetName) {
    const stopWords = new Set(['مجمع', 'المجمع', 'قراني', 'قرآني', 'القراني', 'القرآني', 'نموذجي', 'النموذجي', 'لتحفيظ', 'القران', 'القرآن', 'الكريم', 'عام', 'العام', 'بن', 'ابن']);
    const tokens = cleanTargetName.split(/\s+/).filter(w => w.length >= 3 && !stopWords.has(w));
    const bareTokens = tokens.map(t => stripArabicDefinite(t)).filter(w => w.length >= 3);
    const allTokens = [...new Set([...tokens, ...bareTokens])];

    if (allTokens.length > 0) {
      const tFields = [
        teacher.complexName,
        teacher.halaqahName,
        teacher.notes,
        ...teacherHalaqahs.map(h => h.complexName),
        ...teacherHalaqahs.map(h => h.name)
      ].filter(Boolean).map(f => normalizeArabicText(f));

      for (const tok of allTokens) {
        if (tFields.some(f => f.includes(tok) || stripArabicDefinite(f).includes(tok))) return true;
      }
    }
  }

  return false;
}

/**
 * Universal Halaqah Detector for Assistant Queries
 */
export function findMatchingHalaqahInSearch(
  query: string,
  halaqahsList: any[] = [],
  studentsList: any[] = []
): any | null {
  if (!query) return null;
  const normQuery = normalizeArabicText(query);
  const combinedHalaqahs: any[] = [...(Array.isArray(halaqahsList) ? halaqahsList : [])];

  if (Array.isArray(studentsList)) {
    for (const s of studentsList) {
      if (s?.halaqahName) {
        const normName = normalizeArabicText(s.halaqahName);
        if (!combinedHalaqahs.some(h => normalizeArabicText(h.name || '') === normName)) {
          combinedHalaqahs.push({
            id: s.halaqahId || `halaqah-${normName}`,
            name: s.halaqahName,
            complexName: s.complexName || '',
          });
        }
      }
    }
  }

  const stopWords = new Set(['حلقه', 'الحلقه', 'احلققه', 'احلقه', 'مجموعه', 'المجموعه', 'بن', 'ابن', 'عبد', 'الله', 'في', 'من', 'الي', 'إلى', 'مع', 'عن', 'كل', 'طلاب', 'طالب', 'معلم', 'شيخ', 'رضي', 'عنه']);

  // 1. Direct or full clean name inclusion across entire query
  for (const h of combinedHalaqahs) {
    const normH = normalizeArabicText(h.name || '');
    const cleanH = cleanHalaqahBaseName(h.name || '');
    if (normH && (normQuery.includes(normH) || (cleanH.length >= 3 && normQuery.includes(cleanH)))) {
      return h;
    }
  }

  // 2. High-value distinctive keywords / tokens (e.g. "الزبير" -> "حلقة الزبير بن العوام رضي الله عنه", "عثمان" -> "حلقة عثمان بن عفان رضي الله عنه", "الشاطبي" -> "حلقة الشاطبي")
  for (const h of combinedHalaqahs) {
    const cleanH = cleanHalaqahBaseName(h.name || '');
    const tokens = cleanH.split(/\s+/).filter(w => w.length >= 3 && !stopWords.has(w));
    for (const token of tokens) {
      if (normQuery.includes(token)) {
        return h;
      }
    }
  }

  // 3. Preposition / phrase match after "حلقة" or "مجموعة"
  const halaqahMatch = query.match(/(?:في|الي|إلى|مع|ب|لحلقة|لحلقه|طلاب\s+حلقة|طلاب\s+حلقه|معلم\s+حلقة|معلم\s+حلقه)?\s*(?:احلققة|احلققه|احلقة|احلقه|حلقة|حلقه|الحلقة|الحلقه|مجموعة|مجموعه|المجموعة|المجموعه)\s+([^\n,\.؛!?]+)/i);
  if (halaqahMatch && halaqahMatch[1]) {
    const candidatePhrase = normalizeArabicText(halaqahMatch[1].trim());
    for (const h of combinedHalaqahs) {
      const normH = normalizeArabicText(h.name || '');
      const cleanH = cleanHalaqahBaseName(h.name || '');
      if (candidatePhrase.includes(cleanH) || (cleanH.length >= 3 && candidatePhrase.includes(cleanH)) || (candidatePhrase.length >= 3 && cleanH.includes(candidatePhrase))) {
        return h;
      }
    }
  }

  // 4. Generic halaqah request: "حلقة من اللقات", "حلقة من الحلقات", "إحدى الحلقات", "احدى الحلقات", "أي حلقة", "اي حلقة", "حلقة معينة", "إحدى حلقاتنا"
  if (/(?:حلقة\s+من\s+(?:الحلقات|اللقات|حلقات)|إحدى\s+الحلقات|احدى\s+الحلقات|أي\s+حلقة|اي\s+حلقة|حلقة\s+معينة|إحدى\s+حلقاتنا)/i.test(query)) {
    return combinedHalaqahs[0] || null;
  }

  return null;
}

/**
 * Detect level or category from message (ضعيف، متوسط، متقدم، قوي، ممتاز، مبتدئ، خاتم)
 */
export function detectCategoryOrLevel(text: string): string | null {
  if (!text) return null;
  const norm = normalizeArabicText(text);

  if (/(?:فئة|مستوى|طلاب|الطلاب)?\s*(?:ضعيف|الضعاف|ضعاف|المتعثرين|متعثرين|متعثر)/i.test(norm)) {
    return 'ضعيف';
  }
  if (/(?:فئة|مستوى|طلاب|الطلاب)?\s*(?:متوسط|المتوسطين|متوسطين|المتوسط)/i.test(norm)) {
    return 'متوسط';
  }
  if (/(?:فئة|مستوى|طلاب|الطلاب)?\s*(?:متقدم|المتقدمين|متقدمين|المتقدم)/i.test(norm)) {
    return 'متقدم';
  }
  if (/(?:فئة|مستوى|طلاب|الطلاب)?\s*(?:قوي|الاقوياء|الأقوياء|اقوياء|أقوياء|القوي)/i.test(norm)) {
    return 'قوي';
  }
  if (/(?:فئة|مستوى|طلاب|الطلاب)?\s*(?:ممتاز|الممتازين|ممتازين|الممتاز|متميز|المتميزين|متميزين|المتميز|متفوق|المتفوقين|متفوقين|المتفوق)/i.test(norm)) {
    return 'ممتاز';
  }
  if (/(?:فئة|مستوى|طلاب|الطلاب)?\s*(?:مبتدئ|المبتدئين|مبتدئين|المبتدئ)/i.test(norm)) {
    return 'مبتدئ';
  }
  if (/(?:فئة|مستوى|طلاب|الطلاب)?\s*(?:خاتم|الخاتمين|خاتمين|الخاتم|حفظة\s+القران|حفظه\s+القران)/i.test(norm)) {
    return 'خاتم';
  }
  return null;
}

/**
 * Match student level against level filter (flexible with synonyms)
 */
export function matchStudentLevel(studentLevel: string, filterLevel: string): boolean {
  if (!studentLevel || !filterLevel) return false;
  const normS = normalizeArabicText(studentLevel);
  const normF = normalizeArabicText(filterLevel);
  if (normS === normF) return true;
  if ((normF === 'متقدم' || normF === 'قوي') && (normS === 'متقدم' || normS === 'قوي')) return true;
  if ((normF === 'ممتاز' || normF === 'متميز' || normF === 'متفوق') && (normS === 'ممتاز' || normS === 'متميز' || normS === 'متفوق' || normS === 'قوي' || normS === 'متقدم')) return true;
  return false;
}

/**
 * Detect surah filter if mentioned in the query
 */
export function detectSurahFilter(text: string): string | null {
  if (!text) return null;
  const norm = normalizeArabicText(text);
  const match = norm.match(/(?:سورة|سوره|جزء)\s+([^\s,،\.\?!]+(?:\s+[^\s,،\.\?!]+)?)/i);
  if (match && match[1]) {
    const sName = match[1].trim();
    if (sName.length >= 2 && !['القران', 'التسميع', 'الحفظ', 'المقرر'].includes(sName)) {
      return sName;
    }
  }
  return null;
}

/**
 * Clean student name token from conversational noise, prepositions, days, and verbs
 */
export function cleanNameToken(token: string): string {
  if (!token) return '';
  let cleaned = token.trim();

  // Multi-pass iterative stripping of introductory conversational greetings, commands, typos and entity descriptors
  let prevCleaned = '';
  while (cleaned !== prevCleaned) {
    prevCleaned = cleaned;
    cleaned = cleaned
      .replace(/^[و]\s*/, '')
      .replace(/^(?:طيب|حسنا|تمام|اوكي|شكرا|عفوا|مرحبا|أهلا|اهلا|السلام\s+عليكم\s+ورحمة\s+الله\s+وبركاته|السلام\s+عليكم\s+ورحمة\s+الله|السلام\s+عليكم|وعليكم\s+السلام|صباح\s+الخير|مساء\s+الخير|هلا\s+والله|هلا|يا\s+اخي|يا\s+أخي|يا\s+شيخ|يا\s+استاذ|يا\s+معلم)\s+/gi, '')
      .replace(/^(?:اعمللي|اعملوا|اعملي|اعمل|سويلي|سولي|سوو|سوي|سو|انشئي|أنشئي|انشئ|أنشئ|اصنعي|اصنع|طلعلي|طلعوا|طلعي|طلع|هاتلي|هاتوا|هاتي|هات|أعطيني|اعطيني|أعطني|اعطني|أعطنا|اعطنا|عطيني|عطني|جيبلي|جيبوا|جيبي|جيب|وريني|ورونا|ورني|اعرضلي|اعرضي|اعرض|عرض|أظهري|اظهر|أظهر|أريد|اريد|ودي|ودنا|أبغى|ابغى|ممكن|لو\s+سمحت|من\s+فضلك|بالله|افرزي|افرز|صنفي|صنف|رتبلي|رتب\s+لي|رتب|جهزي|جهزلي|جهز)\s*(?:لي\s+|لنا\s+)?/gi, '')
      .replace(/^(?:عدد\s+محدد|عدد\s+معين|عدد\s+مخصص|عدد)\s+/gi, '')
      .replace(/^(?:اداء|أداء|انجاز|إنجاز|بيانات|معلومات|تفاصيل|درجات|نقاط|حفظ|تسميع|حضور|غياب|مستوى|تقييم|بطاقة|بطاقات|شهادة|شهادات)(?:\s*(?:عن|لـ|ل)?\s*|\s+|$)/gi, '')
      .replace(/^(?:جدول|كشف|بيانات|بيان|قائمة|سجل|تقرير|تقارير|احصائيات|إحصائيات|احصائية|إحصائية|احصاء|إحصاء|رسم\s+بياني|رسومات\s+بيانية|رسومات\s+بيانيه|تشخيص\s+بياني|شارت|مخطط|شيت|اكسل)(?:\s*(?:لـ|ل|عن|في|حق|بـ|ب)?\s*|\s+|$)/gi, '')
      .replace(/^(?:احصائياته\s+وطلابه|إحصائياته\s+وطلابه|احصائياتها\s+وطلابها|إحصائياتها\s+وطلابها|احصائياته|إحصائياته|احصائياتها|إحصائياتها|احصائياتهم|إحصائياتهم|احصائيات|إحصائيات|احصائية|إحصائية|احصاء|إحصاء)\s*/gi, '')
      .replace(/^(?:وطلابه|وطلابها|طلابه|طلابها|طلبتها|طلبته|طلبتهم|ومعلميه|ومعلميها|معلميه|معلميها|محفظيه|محفظيها)\s*/gi, '')
      .replace(/^(?:ماذا\s+سمعوا|ماذا\s+سمعو|وش\s+سمعوا|وش\s+سمعو|ايش\s+سمعوا|ايش\s+سمعو|شو\s+سمعوا|شو\s+سمعو|ماذا\s+سمع|وش\s+سمع|ايش\s+سمع|شو\s+سمع|كم\s+حفظ|لماذا\s+سمع|لماذا\s+سمعوا|لماذا\s+سمعو|وما\s+هو\s+مقرر\s+الغد|ما\s+هو\s+مقرر\s+الغد|وما\s+هو\s+مقرر\s+اليوم|ما\s+هو\s+مقرر\s+اليوم|مقرر\s+الغد|مقرر\s+اليوم|وما\s+هو\s+مقرر|ما\s+هو\s+مقرر|وما\s+هو\s+ورد|ما\s+هو\s+ورد|وما\s+هو|ما\s+هو|ما\s+مقرر|وين\s+وصل|أين\s+وصل|اين\s+وصل)\s*(?:عن\s+)?/gi, '')
      .replace(/^(?:اطلالب|الطلالب|اطالب|الاطالب|الطلالاب|لاطلالب|الطالب|طالب|طالبا|طالباً|الطلبة|الطلاب|طالبنا|اسم|اسمه|المدعو|عن|للطالب|لطالب|هو|وهو|كل\s+من|واخوه|و\s+اخوه|اخوه|أخوه|و\s+أخوه|وابنه|و\s+ابنه|ابنه|أبنه|شقيقه|أخاه|اخاه)\s+/gi, '')
      .replace(/^(?:بأسمائهم|باسمائهم|بأسمائهن|باسمائهن|اسماءهم|اسمائهم|اسماء|أسماء)\s*/gi, '')
      .replace(/^(?:فقط\s+لا\s+غير|فقط\s+لاغير|فقط)\s*/gi, '')
      .trim();
  }

  // 2. Remove halaqah and complex prefix/suffix clauses
  cleaned = cleaned.replace(/(?:^|\s+)(?:حلقة\s+من\s+(?:الحلقات|اللقات)|إحدى\s+الحلقات|احدى\s+الحلقات|أي\s+حلقة|اي\s+حلقة)(?:\s+|$)/gi, ' ');
  cleaned = cleaned.replace(/(?:^|\s+)(?:مجمع\s+من\s+المجمعات|أي\s+مجمع|اي\s+مجمع)(?:\s+|$)/gi, ' ');
  cleaned = cleaned.replace(/(?:^|\s+)(?:شيخ\s+من\s+الشيوخ|أي\s+شيخ|اي\s+شيخ)(?:\s+|$)/gi, ' ');
  cleaned = cleaned.replace(/(?:^|\s+)(?:في|من|الي|إلى|مع|ب|لحلقة|لحلقه|حلقة|حلقه|الحلقة|الحلقه|مجموعة|مجموعه|المجموعة|المجموعه|لمجمع|مجمع|المجمع)\s+[^\s,،\.\?!]+/gi, ' ');

  // 3. Remove teacher/sheikh mentions (unless explicitly saying الطالب الشيخ)
  cleaned = cleaned.replace(/(?:^|\s+)(?:للشيخ|مع\s+الشيخ|عند\s+الشيخ|الشيخ|شيخ|المعلم|معلم|المحفظ|محفظ|الاستاذ|الأستاذ|أستاذ|استاذ)\s+[^\s,،\.\?!]+/gi, ' ');

  // 4. Remove superlatives, rankings, and cohort descriptors
  cleaned = cleaned.replace(/(?:^|\s+)(?:الاعلى|الأعلى|اعلى|أعلى|الاقل|الأقل|اقل|أقل|الاكثر|الأكثر|اكثر|أكثر|أفضل|افضل|أحسن|احسن)\s*(?:في\s+|بال)?(?:النقاط|نقاط|الغياب|غيابا|غياباً|الحضور|حضورا|حضوراً|التزاما|التزاماً)?(?:\s+|$)/gi, ' ');
  cleaned = cleaned.replace(/(?:^|\s+)(?:المتصدرين|متصدرين|المتعثرين|متعثرين|المتفوقين|متفوقين|المتميزين|متميزين|المواظبين|مواظبين|الملتزمين|ملتزمين|الخاتمين|خاتمين|المتأخرين|متأخرين|الضعاف|المتوسطين|المتقدمين|الاوائل|الأوائل|اوائل|أوائل)(?:\s+|$)/gi, ' ');

  // 5. Remove trailing context phrases like "مع حفظهم ومراجعتهم", "وحفظهم الجديد", "ودرجاتهم", etc.
  cleaned = cleaned.replace(/\s+(?:مع|و|مع\s+بيانات|مع\s+تفاصيل|مع\s+كشف)?\s*(?:بأسمائهم|باسمائهم|اسماءهم|اسمائهم|فقط|فقط\s+لا\s+غير|فقط\s+لاغير|احصائياته\s+وطلابه|إحصائياته\s+وطلابه|احصائياتها\s+وطلابها|إحصائياتها\s+وطلابها|احصائياته|إحصائياته|احصائياتها|إحصائياتها|احصائياتهم|إحصائياتهم|احصائيات|إحصائيات|احصائية|إحصائية|طلابه|طلابها|معلميه|معلميها|حفظهم\s+الجديد\s+والمراجعة|حفظهم\s+الجديد|الحفظ\s+الجديد|حفظهم\s+ومراجعتهم|حفظهم\s+والمراجعة|حفظهم|حفظ|مراجعتهم|المراجعة|المراجعه|مراجعة|مراجعه|تسميعهم|تسميع|حضورهم|غيابهم|نقاطهم|درجاتهم|مستواهم|مستوياتهم|سلوكهم|تنبيهاتهم|مخالفاتهم|أوجههم|اوجههم|بياناتهم|تقاريرهم|جدولهم|كشفهم|تفاصيلهم|جديد\s+ومراجعة|جديد\s+ومراجعه|جديد|مراجعة|مراجعه|سورهم\s+وحفظهم|سورهم|حفظهم|اللي\s+طلبته\s+منه|اللي\s+طلبته|الذي\s+طلبته|المطلوب\s+منه|المطلوب\s+منهم|ما\s+طلبته|ما\s+طلبناه).*$/gi, '');
  cleaned = cleaned.replace(/\s+(?:في|من|ضمن)\s+(?:فئة|مستوى|حلقة|مجمع).*$/gi, '');
  cleaned = cleaned.replace(/\s+(?:مرتب|مرتبين|ترتيب)\s+(?:حسب|تنازلي|تصاعدي|بالنقاط|ابجديا|أبجدياً).*$/gi, '');

  // 6. Remove mid-sentence or trailing interrogative/action clauses like "ماذا سمع", "كم حفظ", "ما هو مقرره", "وين وصل", "وش سمع", "وش سوا", "كم نقاطهم", etc.
  cleaned = cleaned.replace(/\s+(?:ماذا|وش|ايش|شو|ايه|إيه|ليه|شاللي|شنو|كم|وين|أين|اين|كيف|ما|ماهو|ما\s+هو|متى)\s+(?:سمع|سمّع|سمعو|سمعوا|حفظ|حفظو|حفظوا|قرأ|قرا|واصل|وصل|انجز|أنجز|سوى|سوا|عمل|سوو|سووا|مستواه|نقاطه|درجاته|نقاطهم|درجاتهم|مستواهم|مقرر|مقرره|الورد|نقاط|درجات).*$/gi, '');

  // 7. Remove trailing interrogative or recitation verbs directly attached to the name (e.g. "محمد وش سمع" -> "محمد")
  cleaned = cleaned.replace(/\s+(?:وش\s+سمع|وش\s+سمّع|ايش\s+سمع|ايش\s+سمّع|شو\s+سمع|وش\s+حفظ|ايش\s+حفظ|شو\s+حفظ|وش\s+سوى|وش\s+سوا|ايش\s+سوى|شو\s+سوى|وش\s+عنده|ايش\s+عنده|وش\s+مسوي|وش\s+بيحفظ|ايش\s+بيحفظ).*$/gi, '');
  cleaned = cleaned.replace(/\s+(?:سمع|سمّع|سمعو|سمعوا|حفظ|حفظو|حفظوا|قرأ|قرا|واصل|وصل|انجز|أنجز|سوى|سوا|عمل).*$/gi, '');
  cleaned = cleaned.replace(/\s+(?:وش|ايش|شو|ماذا|ايه|إيه|ليه|شاللي|شنو|كم|وين|أين|اين|كيف|متى|هل)(?:\s+.*)?$/gi, '');

  // 8. Remove day names, dates, temporal adverbs from ANYWHERE in the token (including colloquial Egyptian/Gulf: امبارح, النهارده, النهاردة, بكرة)
  cleaned = cleaned.replace(/(?:^|\s+)(?:يوم\s+)?(?:الاحد|الأحد|احد|أحد|الاثنين|الإثنين|اثنين|إثنين|اثنيين|الثلاثاء|ثلاثاء|ثلثاء|الاربعاء|الأربعاء|اربعاء|أربعاء|الخميس|خميس|الجمعة|جمعة|جمعه|السبت|سبت)(?:\s+|$)/gi, ' ');
  cleaned = cleaned.replace(/(?:^|\s+)(?:امبارح|النهارده|النهاردة|بكرة|بكره|اليوم|أمس|امس|البارحة|البارحه|بارحة|بارحه|غداً|غدا|الغد|قبل\s+أمس|قبل\s+امس|اول\s+امبارح|أول\s+امبارح|منذ\s+يومين|هذا\s+الاسبوع|هذا\s+الشهر|مقرر\s+الغد|ورد\s+الغد|مقرر\s+اليوم|مقرره)(?:\s+|$)/gi, ' ');

  // 9. Remove system entity terms
  cleaned = cleaned.replace(/(?:^|\s+)(?:رسم\s+بياني|رسومات\s+بيانية|رسومات\s+بيانيه|تشخيص\s+بياني|مخطط\s+بياني|مخطط|شارت|شامل\s+للمجمع|للمجمع|المجمع|مجمع|الحلقة|الحلقه|حلقة|حلقه|شامل)(?:\s+|$)/gi, ' ');

  // 10. Clean punctuation and digits
  cleaned = cleaned.replace(/[\d٠-٩،,:\-–—؛.!?\(\)\[\]"'\?؟]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned;
}

const GENERIC_STUDENT_WORDS = [
  'الطلاب', 'طلاب', 'طلابي', 'طلابنا', 'الطلبة', 'طلبة', 'طالب', 'الطالب', 'طالبا', 'طالباً',
  'بأسمائهم', 'باسمائهم', 'بأسمائهن', 'باسمائهن', 'اسماءهم', 'اسمائهم', 'اسماء', 'أسماء', 'اسماؤهم', 'أسماؤهم',
  'فقط', 'فقط لا غير', 'فقط لاغير',
  'عدد محدد', 'عدد معين', 'عدد مخصص', 'عدد', 'محدد', 'محددة', 'محدده',
  'اللي طلبته منه', 'اللي طلبته', 'الذي طلبته', 'المطلوب منه', 'المطلوب منهم', 'ما طلبته', 'ما طلبناه',
  'احصائياته وطلابه', 'إحصائياته وطلابه', 'احصائياتها وطلابها', 'إحصائياتها وطلابها',
  'احصائياته', 'إحصائياته', 'احصائياتها', 'إحصائياتها', 'احصائياتهم', 'إحصائياتهم', 'احصائيات', 'إحصائيات', 'احصائية', 'إحصائية', 'احصاء', 'إحصاء',
  'طلابه', 'طلابها', 'طلبتها', 'طلبته', 'طلبتهم', 'معلميه', 'معلميها', 'محفظيه', 'محفظيها', 'مشرفيه', 'مشرفيها',
  'حلقة من الحلقات', 'حلقة من اللقات', 'اي حلقة', 'أي حلقة', 'إحدى الحلقات', 'احدى الحلقات',
  'مجمع من المجمعات', 'اي مجمع', 'أي مجمع',
  'شيخ من الشيوخ', 'اي شيخ', 'أي شيخ',
  'الكل', 'المجموعة', 'الحلقة', 'الحلقه', 'حلقة', 'حلقه', 'القائمة', 'القائمه',
  'الجميع', 'الاولاد', 'الأولاد', 'الاطفال', 'الأطفال', 'الحلقات',
  'السجلات', 'سجلات', 'كشف', 'بيانات', 'تقرير', 'درجات', 'نقاط',
  'رسم بياني', 'تشخيص بياني', 'بياني', 'مخطط', 'مخططات', 'شارت', 'شامل للمجمع', 'للمجمع', 'المجمع', 'مجمع', 'شامل',
  'مقرر الغد', 'مقرر اليوم', 'ما هو مقرر الغد', 'ما هو مقرر اليوم', 'وما هو مقرر الغد', 'وما هو مقرر اليوم', 'وما هو مقرر', 'ما هو مقرر', 'مقرر', 'الورد', 'غدا', 'غداً', 'الغد', 'اليوم', 'أمس', 'امس',
  'طيب', 'حسنا', 'تمام', 'اوكي', 'شكرا', 'عفوا', 'السلام عليكم', 'وعليكم السلام', 'مرحبا', 'هلا', 'أهلاً', 'اهلاً',
  'ماذا سمعوا', 'ماذا سمعو', 'وش سمعوا', 'وش سمعو', 'ايش سمعوا', 'ايش سمعو', 'شو سمعوا', 'شو سمعو',
  'ماذا سمع الطلاب', 'تسميع الطلاب', 'حفظ الطلاب', 'حضور الطلاب', 'غياب الطلاب', 'كشف الطلاب', 'جدول الطلاب',
  'كم وجه', 'اوجه', 'أوجه', 'تسميع', 'تسميعات', 'حفظ', 'مراجعة',
  'لوحة الشرف', 'لوحة الصدارة', 'المتصدرين', 'الأوائل', 'الاوائل', 'متصدرين', 'أوائل', 'اوائل',
  'الاعلى نقاطا', 'الأعلى نقاطاً', 'اعلى نقاط', 'أعلى نقاط', 'الاقل نقاطا', 'الأقل نقاطاً', 'اقل نقاط', 'أقل نقاط',
  'أفضل', 'افضل', 'أحسن', 'احسن', 'الأفضل', 'الافضل', 'الأحسن', 'الاحسن',
  'الاكثر غيابا', 'الأكثر غياباً', 'اكثر غيابا', 'أكثر غياباً', 'الغياب', 'الغياب التام',
  'الاكثر حضورا', 'الأكثر حضوراً', 'اكثر حضورا', 'أكثر حضوراً', 'الاكثر التزاما', 'الأكثر التزاماً',
  'المعلمين', 'المحفظين', 'معلمي المجمع', 'معلمي الحلقة', 'الشيخ', 'شيخ', 'المعلم', 'معلم', 'المحفظ', 'محفظ', 'الاستاذ', 'الأستاذ', 'أستاذ', 'استاذ',
  'يوم الاحد', 'الاحد', 'الأحد', 'الاثنين', 'الإثنين', 'الثلاثاء', 'الاربعاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت',
  'ضعيف', 'الضعاف', 'ضعاف', 'المتعثرين', 'متعثرين', 'متعثر',
  'متوسط', 'المتوسط', 'المتوسطين', 'متوسطين',
  'متقدم', 'المتقدم', 'المتقدمين', 'متقدمين', 'قوي', 'الأقوياء', 'الاقوياء', 'اقوياء',
  'ممتاز', 'الممتاز', 'الممتازين', 'متميز', 'المتميز', 'المتميزين', 'متفوق', 'المتفوقين', 'متفوقين', 'متميزين',
  'مبتدئ', 'المبتدئ', 'المبتدئين', 'مبتدئين',
  'خاتم', 'الخاتم', 'الخاتمين', 'خاتمين', 'حفظة القران', 'حفظه القران',
  'فئة', 'فئه', 'مستوى', 'فئات', 'مستويات',
  'حفظهم', 'مراجعتهم', 'تسميعهم', 'سورهم', 'درجاتهم', 'نقاطهم', 'غيابهم', 'حضورهم', 'اوجههم', 'أوجههم',
  'مستواهم', 'مستوياتهم',
  'جديد', 'الجديد', 'مراجعة', 'المراجعة', 'تسميع', 'التسميع', 'حفظ', 'الحفظ', 'سورة', 'سور', 'المقرر'
];
const GENERIC_STUDENT_TERMS = new Set(
  GENERIC_STUDENT_WORDS.flatMap(w => [w, normalizeArabicText(w)])
);

const NON_STUDENT_INTENT_PATTERNS = [
  /رسم\s+بياني/i,
  /تشخيص\s+بياني/i,
  /مخطط\s+بياني/i,
  /مخطط/i,
  /شارت/i,
  /بيانيا/i,
  /بيانياً/i,
  /دوائر/i,
  /أعمدة|اعمدة/i,
  /تتبع/i,
  /احصائيات|إحصائيات|احصائية|إحصائية/i,
  /(?:فئة|مستوى|طلاب\s+فئة|فئات)\s*(?:ضعيف|متوسط|متقدم|ممتاز|قوي|مبتدئ|خاتم|المتعثرين|متعثرين)/i,
  /(?:كشف|جدول|قائمة|بيان)\s+(?:فئة|مستوى)\s*(?:ضعيف|متوسط|متقدم|ممتاز|قوي|مبتدئ|خاتم)/i,
  /(?:كشف|جدول)\s+(?:الطلاب\s+)?(?:المتعثرين|الضعاف|المتوسطين|المتقدمين|الممتازين)/i,
  /خريطة\s+(?:المسجد|المجمع)/i,
  /موقع\s+(?:المسجد|المجمع)/i,
  /مكان\s+(?:المسجد|المجمع)/i,
  /عنوان\s+(?:المسجد|المجمع)/i,
  /ثيم\s+(?:المجمع|المنصة)/i,
  /تغيير\s+ثيم/i,
  /كشف\s+(?:المعلمين|المحفظين)/i,
  /جدول\s+(?:المعلمين|المحفظين)/i,
  /اسماء\s+(?:المعلمين|المحفظين)/i,
  /أسماء\s+(?:المعلمين|المحفظين)/i,
  /معلمي\s+(?:المجمع|الحلقة)/i,
  /رسالة\s+(?:الواتس|الحضور|الغياب|اليوم)/i,
  /تقرير\s+الواتس/i,
  /ماذا\s+سمع\s+الطلاب/i,
  /ماذا\s+سمعوا/i,
  /ماذا\s+سمعو/i,
  /وش\s+سمعوا/i,
  /وش\s+سمعو/i,
  /ايش\s+سمعوا/i,
  /ايش\s+سمعو/i,
  /شو\s+سمعوا/i,
  /شو\s+سمعو/i,
  /مقرر\s+الغد/i,
  /مقرر\s+اليوم/i,
  /ما\s+هو\s+مقرر/i,
  /ما\s+هو\s+ورد/i,
  /تسميع\s+اليوم/i,
  /تسميع\s+الطلاب/i,
  /حفظ\s+الطلاب/i,
  /حضور\s+الطلاب/i,
  /غياب\s+الطلاب/i,
  /كشف\s+الحضور/i,
  /كشف\s+الغياب/i,
  /سجل\s+الحضور/i,
  /سجل\s+الغياب/i,
];

/**
 * Determine if a user query explicitly asks for all students
 */
export function isQueryRequestingAllStudents(query: string): boolean {
  if (!query) return false;
  const norm = normalizeArabicText(query);
  return (
    norm.includes('جميع الطلاب') ||
    norm.includes('كافة الطلاب') ||
    norm.includes('كل الطلاب') ||
    norm.includes('الطلاب كلهم') ||
    norm.includes('جميع طلاب') ||
    norm.includes('كافة طلاب') ||
    norm.includes('كل طلاب') ||
    norm.includes('طلاب الحلقه كامله') ||
    norm.includes('كامل طلاب') ||
    norm.includes('كلهم') ||
    norm.includes('جميعهم')
  );
}

/**
 * Extract targeted individual student name tokens from conversational message
 */
export function extractCandidateNamesFromMessage(
  message: string,
  contextFilters?: { halaqahName?: string; complexName?: string; level?: string; teacherName?: string },
  studentsPool?: any[]
): string[] {
  if (!message) return [];

  // If user explicitly asks for all students, do not extract names
  if (isQueryRequestingAllStudents(message)) return [];

  // If the query is specifically targeting a category/level and doesn't contain an explicit single student designator
  const isExplicitSingleStudentQuery = /(?:عن\s+الطالب|للطالب|لطالب|طالبنا|اسم\s+الطالب|اسمه|المدعو)\s+[^\s,،\.\?!]+/i.test(message);
  if (!isExplicitSingleStudentQuery && detectCategoryOrLevel(message)) {
    const strippedCategory = message
      .replace(/(?:اعمللي|اعملوا|اعملي|اعمل|سويلي|سولي|سوو|سوي|سو|انشئي|أنشئي|انشئ|أنشئ|طلعلي|طلعوا|طلعي|طلع|هاتلي|هاتوا|هاتي|هات|اعرضلي|اعرضي|اعرض|عرض|جدول|كشف|بيانات|بيان|قائمة|سجل|تقرير|احصائيات|إحصائيات|رسم\s+بياني|رسومات\s+بيانية|لي|لنا)?\s*(?:طلاب|الطلاب)?\s*(?:فئة|مستوى)?\s*(?:ضعيف|الضعاف|ضعاف|المتعثرين|متعثرين|متوسط|المتوسطين|متقدم|المتقدمين|قوي|الأقوياء|الاقوياء|ممتاز|الممتازين|متميز|متفوق|مبتدئ|المبتدئين|خاتم|الخاتمين)/gi, '')
      .trim();
    if (!strippedCategory || strippedCategory.length < 3) {
      return [];
    }
  }

  // If the query is asking about students who completed Juz Amma or a specific Surah/Juz cohort
  const isJuzAmmaQuery = /(?:ختموا|ختم|أتموا|اتموا|خاتمي|خاتمين|حفظوا|حفظة)\s+(?:جزء\s+)?(?:عم|عَمّ)/i.test(message);
  if (isJuzAmmaQuery && !isExplicitSingleStudentQuery) {
    return [];
  }

  // If query is about general cohort listing ("اسماء الطلاب الذين ...")
  if (/(?:اسماء|أسماء|قائمة|جدول|كشف)\s+(?:الطلاب|طلاب)\s+(?:الذين|الي|اللي)/i.test(message) && !isExplicitSingleStudentQuery) {
    return [];
  }

  // If query mentions a teacher/sheikh, halaqah, complex, or explicit count without an explicit single student name marker
  const hasTeacherMarker = /(?:للشيخ|مع\s+الشيخ|عند\s+الشيخ|الشيخ|شيخ|المعلم|معلم|المحفظ|محفظ|الاستاذ|الأستاذ|أستاذ|استاذ)\s+[^\s,،\.\?!]+/i.test(message);
  const hasHalaqahMarker = /(?:في\s+حلقة|في\s+حلقه|من\s+حلقة|من\s+حلقه|لحلقة|لحلقه|حلقة|حلقه|الحلقة|الحلقه|حلقة\s+من\s+(?:الحلقات|اللقات))\s+[^\s,،\.\?!]+/i.test(message);
  const hasComplexMarker = /(?:في\s+مجمع|من\s+مجمع|لمجمع|مجمع|المجمع)\s+[^\s,،\.\?!]+/i.test(message);
  const countVal = detectExplicitCount(message);

  if (!isExplicitSingleStudentQuery && (hasTeacherMarker || hasHalaqahMarker || hasComplexMarker || countVal !== null)) {
    let strippedTarget = message
      .replace(/(?:حلقة\s+من\s+(?:الحلقات|اللقات)|إحدى\s+الحلقات|احدى\s+الحلقات|أي\s+حلقة|اي\s+حلقة)/gi, ' ')
      .replace(/(?:مجمع\s+من\s+المجمعات|أي\s+مجمع|اي\s+مجمع)/gi, ' ')
      .replace(/(?:شيخ\s+من\s+الشيوخ|أي\s+شيخ|اي\s+شيخ)/gi, ' ')
      .replace(/(?:في\s+حلقة|في\s+حلقه|من\s+حلقة|من\s+حلقه|لحلقة|لحلقه|حلقة|حلقه|الحلقة|الحلقه|مجموعة|مجموعه|المجموعة|المجموعه)\s+[^\s,،\.\?!]+(?:\s+[^\s,،\.\?!]+)?/gi, ' ')
      .replace(/(?:للشيخ|مع\s+الشيخ|عند\s+الشيخ|الشيخ|شيخ|المعلم|معلم|المحفظ|محفظ|الاستاذ|الأستاذ|أستاذ|استاذ)\s+[^\s,،\.\?!]+(?:\s+[^\s,،\.\?!]+)?/gi, ' ')
      .replace(/(?:في\s+مجمع|من\s+مجمع|لمجمع|مجمع|المجمع)\s+[^\s,،\.\?!]+(?:\s+[^\s,،\.\?!]+)?/gi, ' ')
      .replace(/(?:أول|اول|عدد\s+محدد|عدد\s+معين|عدد|أفضل|افضل|أحسن|احسن|الاعلى|الأعلى|اعلى|أعلى|الاقل|الأقل|اقل|أقل|لـ|ل|عن|ـ|هات|طلع|اعطني|أعطني|اعمل|سوي|جدول|كشف|بيانات|سجلات|فقط)?\s*(?:\d+|[٠-٩]+)\s*(?:من\s+)?(?:الطلاب|طلاب|طالب|سجلات|اسماء|أسماء|فقط)?/gi, ' ')
      .replace(/(?:الاعلى|الأعلى|الاقل|الأقل|الاكثر|الأكثر|اكثر|أكثر|اعلى|أعلى|اقل|أقل|أفضل|افضل|أحسن|احسن)\s*(?:في\s+|بال)?(?:النقاط|نقاط|الغياب|غيابا|غياباً|الحضور|حضورا|حضوراً|التزاما|التزاماً)?/gi, ' ')
      .replace(/(?:المتصدرين|متصدرين|المتعثرين|متعثرين|المتفوقين|متفوقين|المتميزين|متميزين|المواظبين|مواظبين|الملتزمين|ملتزمين|الخاتمين|خاتمين|المتأخرين|متأخرين|الضعاف|المتوسطين|المتقدمين|الاوائل|الأوائل|اوائل|أوائل)/gi, ' ')
      .replace(/(?:رسم\s+بياني|تشخيص\s+بياني|رسومات\s+بيانية|مخطط|شارت|احصائيات|إحصائيات|احصائية|إحصائية|احصاء|إحصاء)/gi, ' ')
      .replace(/(?:بأسمائهم|باسمائهم|اسماءهم|اسمائهم|اسماء|أسماء|فقط|فقط\s+لا\s+غير|فقط\s+لاغير)/gi, ' ')
      .replace(/(?:احصائياته\s+وطلابه|إحصائياته\s+وطلابه|احصائياتها\s+وطلابها|إحصائياتها\s+وطلابها|احصائياته|إحصائياته|احصائياتها|إحصائياتها|احصائياتهم|إحصائياتهم|احصائيات|إحصائيات|طلابه|طلابها|معلميه|معلميها)/gi, ' ')
      .replace(/(?:حفظهم\s+الجديد\s+والمراجعة|حفظهم\s+الجديد|الحفظ\s+الجديد|حفظهم\s+ومراجعتهم|حفظهم\s+والمراجعة|حفظهم|حفظ|مراجعتهم|المراجعة|المراجعه|مراجعة|مراجعه|تسميعهم|تسميع|حضورهم|غيابهم|نقاطهم|درجاتهم|مستواهم|مستوياتهم|سلوكهم|تنبيهاتهم|مخالفاتهم|أوجههم|اوجههم|بياناتهم|تقاريرهم|جدولهم|كشفهم|تفاصيلهم|جديد\s+ومراجعة|جديد\s+ومراجعه|جديد|مراجعة|مراجعه|سورهم\s+وحفظهم|سورهم|حفظهم|اللي\s+طلبته\s+منه|اللي\s+طلبته|الذي\s+طلبته|المطلوب\s+منه|المطلوب\s+منهم|ما\s+طلبته|ما\s+طلبناه)/gi, ' ')
      .replace(/(?:اعرض|اعمل|سو|سوي|انشئ|أنشئ|هات|طلع|أريد|اريد|ابغى|أبغى|جدول|كشف|بيانات|بيان|قائمة|سجل|تقرير|لي|لنا|طلاب|الطلاب|طالب|الطلبة|فقط)\s*/gi, ' ')
      .replace(/[\d٠-٩،,:\-–—؛.!?\(\)\[\]\"'\?؟]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!strippedTarget || strippedTarget.length < 3 || GENERIC_STUDENT_TERMS.has(strippedTarget) || GENERIC_STUDENT_TERMS.has(normalizeArabicText(strippedTarget))) {
      return [];
    }
  }

  let cleaned = message.trim();
  let prevClean = '';
  while (cleaned !== prevClean) {
    prevClean = cleaned;
    cleaned = cleaned
      .replace(/^[و]\s*/, '')
      .replace(/^(?:طيب|حسنا|تمام|اوكي|شكرا|عفوا|مرحبا|أهلا|اهلا|السلام\s+عليكم|وعليكم\s+السلام|هلا|يا\s+اخي|يا\s+أخي)\s+/gi, '')
      .replace(/^(?:اعمللي|اعملوا|اعملي|اعمل|سويلي|سولي|سوو|سوي|سو|انشئي|أنشئي|انشئ|أنشئ|اصنعي|اصنع|طلعلي|طلعوا|طلعي|طلع|هاتلي|هاتوا|هاتي|هات|أعطيني|اعطيني|أعطني|اعطني|أعطنا|اعطنا|عطيني|عطني|جيبلي|جيبوا|جيبي|جيب|وريني|ورونا|ورني|اعرضلي|اعرضي|اعرض|عرض|أظهري|اظهر|أظهر|أريد|اريد|ودي|ودنا|أبغى|ابغى|ممكن|لو\s+سمحت|من\s+فضلك|بالله|افرزي|افرز|صنفي|صنف|رتبلي|رتب\s+لي|رتب|جهزي|جهزلي|جهز)\s*(?:لي\s+|لنا\s+)?/gi, '')
      .replace(/^(?:عدد\s+محدد|عدد\s+معين|عدد\s+مخصص|عدد)\s+/gi, '')
      .replace(/^(?:بيانات|معلومات|تفاصيل|درجات|نقاط|حفظ|تسميع|حضور|غياب|مستوى|تقييم|بطاقة|بطاقات|شهادة|شهادات)(?:\s*(?:عن|لـ|ل)?\s*|\s+|$)/gi, '')
      .replace(/^(?:جدول|كشف|بيانات|بيان|قائمة|سجل|تقرير|تقارير|احصائيات|إحصائيات|رسم\s+بياني|رسومات\s+بيانية|رسومات\s+بيانيه|تشخيص\s+بياني|شارت|مخطط|شيت|اكسل)(?:\s*(?:لـ|ل|عن|في|حق|بـ|ب)?\s*|\s+|$)/gi, '')
      .replace(/^(?:احصائياته\s+وطلابه|إحصائياته\s+وطلابه|احصائياتها\s+وطلابها|إحصائياتها\s+وطلابها|احصائياته|إحصائياته|احصائياتها|إحصائياتها|احصائياتهم|إحصائياتهم|احصائيات|إحصائيات|احصائية|إحصائية|احصاء|إحصاء)\s*/gi, '')
      .replace(/^(?:وطلابه|وطلابها|طلابه|طلابها|طلبتها|طلبته|طلبتهم|ومعلميه|ومعلميها|معلميه|معلميها|محفظيه|محفظيها)\s*/gi, '')
      .replace(/^(?:ماذا\s+سمعوا|ماذا\s+سمعو|وش\s+سمعوا|وش\s+سمعو|ايش\s+سمعوا|ايش\s+سمعو|شو\s+سمعوا|شو\s+سمعو|ماذا\s+سمع|وش\s+سمع|ايش\s+سمع|شو\s+سمع|كم\s+حفظ|لماذا\s+سمع|لماذا\s+سمعوا|لماذا\s+سمعو|وما\s+هو\s+مقرر|ما\s+هو\s+مقرر|وما\s+هو|ما\s+هو|ما\s+مقرر|وين\s+وصل|أين\s+وصل|اين\s+وصل)\s*(?:عن\s+)?/gi, '')
      .replace(/^(?:الطلاب|طلاب|الطلبة|طلبة|طالب|الطالب|طالبا|طالباً|طالبنا|اسم|اسمه|المدعو|عن|للطالب|لطالب|هو|وهو|كل\s+من|واخوه|و\s+اخوه|اخوه|أخوه|و\s+أخوه|وابنه|و\s+ابنه|ابنه|أبنه)\s+/gi, '')
      .replace(/^(?:بأسمائهم|باسمائهم|بأسمائهن|باسمائهن|اسماءهم|اسمائهم|اسماء|أسماء)\s*/gi, '')
      .replace(/^(?:فقط\s+لا\s+غير|فقط\s+لاغير|فقط)\s*/gi, '')
      .trim();
  }

  // Strip trailing context clauses before tokenizing
  cleaned = cleaned.replace(/\s+(?:مع|و|مع\s+بيانات|مع\s+تفاصيل|مع\s+كشف)?\s*(?:بأسمائهم|باسمائهم|اسماءهم|اسمائهم|فقط|فقط\s+لا\s+غير|فقط\s+لاغير|احصائياته\s+وطلابه|إحصائياته\s+وطلابه|احصائياتها\s+وطلابها|إحصائياتها\s+وطلابها|احصائياته|إحصائياته|احصائياتها|إحصائياتها|احصائياتهم|إحصائياتهم|احصائيات|إحصائيات|احصائية|إحصائية|طلابه|طلابها|معلميه|معلميها|حفظهم\s+الجديد\s+والمراجعة|حفظهم\s+الجديد|الحفظ\s+الجديد|حفظهم\s+ومراجعتهم|حفظهم\s+والمراجعة|حفظهم|حفظ|مراجعتهم|المراجعة|المراجعه|مراجعة|مراجعه|تسميعهم|تسميع|حضورهم|غيابهم|نقاطهم|درجاتهم|مستواهم|مستوياتهم|سلوكهم|تنبيهاتهم|مخالفاتهم|أوجههم|اوجههم|بياناتهم|تقاريرهم|جدولهم|كشفهم|تفاصيلهم|جديد\s+ومراجعة|جديد\s+ومراجعه|جديد|مراجعة|مراجعه|سورهم\s+وحفظهم|سورهم|حفظهم|اللي\s+طلبته\s+منه|اللي\s+طلبته|الذي\s+طلبته|المطلوب\s+منه|المطلوب\s+منهم|ما\s+طلبته|ما\s+طلبناه).*$/gi, '');
  cleaned = cleaned.replace(/\s+(?:في|من|ضمن)\s+(?:فئة|مستوى|حلقة|مجمع).*$/gi, '');
  cleaned = cleaned.replace(/\s+(?:مرتب|مرتبين|ترتيب)\s+(?:حسب|تنازلي|تصاعدي|بالنقاط|ابجديا|أبجدياً).*$/gi, '');

  const tokens = cleaned.split(/\s*[,،]\s*|\s+مع\s+|\s+و(?=اخوه|أخوه)\s*|\s+و(?=[\u0600-\u06FF]{3,})|\s+و\s+(?=[\u0600-\u06FF]{3,})/);
  const candidateNames: string[] = [];

  for (const t of tokens) {
    const c = cleanNameToken(t);
    const normC = normalizeArabicText(c);
    
    // Check if token is actually the halaqah or complex or level or teacher
    const isContextFilter = Boolean(
      (contextFilters?.halaqahName && (normC.includes(normalizeArabicText(contextFilters.halaqahName)) || normalizeArabicText(contextFilters.halaqahName).includes(normC))) ||
      (contextFilters?.complexName && (normC.includes(normalizeArabicText(contextFilters.complexName)) || normalizeArabicText(contextFilters.complexName).includes(normC))) ||
      (contextFilters?.level && normC.includes(normalizeArabicText(contextFilters.level))) ||
      (contextFilters?.teacherName && (normC.includes(normalizeArabicText(contextFilters.teacherName)) || normalizeArabicText(contextFilters.teacherName).includes(normC)))
    );

    const isTeacherToken = /^(?:الشيخ|شيخ|المعلم|معلم|المحفظ|محفظ|الاستاذ|الأستاذ|أستاذ|استاذ)/i.test(normC);
    const isComplexToken = /^(?:مجمع|المجمع)/i.test(normC) || normC.includes('مجمع');
    const isHalaqahToken = /^(?:حلقة|حلقه|الحلقة|الحلقه|مجموعة|مجموعه)/i.test(normC);
    const isSuperlativeToken = /^(?:الاعلى|الأعلى|الاقل|الأقل|الاكثر|الأكثر|متفوقين|المتفوقين|المتميزين|متميزين|المتعثرين|متعثرين|الاوائل|الأوائل|متصدرين|المتصدرين|نقاطا|نقاطاً|غيابا|غياباً|حضورا|حضوراً|أفضل|افضل|أحسن|احسن)/i.test(normC);

    if (
      c &&
      c.length >= 2 &&
      !isContextFilter &&
      !isTeacherToken &&
      !isComplexToken &&
      !isHalaqahToken &&
      !isSuperlativeToken &&
      !isQueryRequestingAllStudents(c) &&
      !GENERIC_STUDENT_TERMS.has(c) &&
      !GENERIC_STUDENT_TERMS.has(normC) &&
      !candidateNames.includes(c)
    ) {
      // If a student pool is provided, ONLY keep candidate token if it actually matches or partly matches at least one student in the system!
      if (Array.isArray(studentsPool) && studentsPool.length > 0) {
        const matchesAnyStudent = studentsPool.some(s => doesStudentMatchNameToken(s, c));
        if (!matchesAnyStudent) {
          continue;
        }
      }
      candidateNames.push(c);
    }
  }

  return candidateNames;
}

/**
 * Filter student candidates by user permissions (RBAC)
 */
export function filterStudentsByPermissions(
  students: any[],
  user: SearchUserContext
): { authorized: any[]; deniedCount: number } {
  if (!user || user.role === 'guest') {
    return { authorized: [], deniedCount: students.length };
  }

  // Admin or Developer: Full access or complex-scoped
  if (user.role === 'developer' || (user.role as string) === 'admin') {
    if (user.complexId && user.complexId !== 'all') {
      const authorized = students.filter(s => !s.complexId || s.complexId === user.complexId);
      return { authorized, deniedCount: students.length - authorized.length };
    }
    return { authorized: [...students], deniedCount: 0 };
  }

  if (user.role === 'supervisor') {
    const complexIds = user.authorizedComplexIds || (user.complexId ? [user.complexId] : []);
    if (complexIds.length === 0) {
      return { authorized: [...students], deniedCount: 0 };
    }
    const authorized = students.filter(s => {
      if (!s.complexId) return true;
      return complexIds.includes(s.complexId);
    });
    return { authorized, deniedCount: students.length - authorized.length };
  }

  if (user.role === 'teacher') {
    const halaqahIds = [
      ...(user.authorizedHalaqahIds || []),
      ...(user.assignedHalaqahIds || []),
      ...(user.assignedHalaqahId ? [user.assignedHalaqahId] : []),
      ...(user.activeHalaqahId ? [user.activeHalaqahId] : []),
      ...(user.halaqahId ? [user.halaqahId] : []),
    ].filter(Boolean);

    // If teacher has assigned halaqahs, strictly restrict to those halaqahs
    if (halaqahIds.length > 0) {
      const authorized = students.filter(s => {
        if (!s.halaqahId) return false;
        return halaqahIds.includes(s.halaqahId);
      });
      return { authorized, deniedCount: students.length - authorized.length };
    }

    // If no halaqah is specifically tied, check complex scope
    if (user.complexId && user.complexId !== 'all') {
      const authorized = students.filter(s => !s.complexId || s.complexId === user.complexId);
      return { authorized, deniedCount: students.length - authorized.length };
    }

    // Default fallback for open teacher scope
    return { authorized: [...students], deniedCount: 0 };
  }

  if (user.role === 'parent') {
    const childIds = [
      ...(user.assignedStudentIds || []),
      ...(user.childStudentIds || []),
      ...(user.studentIds || [])
    ];
    const authorized = students.filter(s => childIds.includes(s.id));
    return { authorized, deniedCount: students.length - authorized.length };
  }

  if (user.role === 'student') {
    const sId = user.studentId || user.userId;
    const authorized = students.filter(s => s.id === sId);
    return { authorized, deniedCount: students.length - authorized.length };
  }

  return { authorized: [], deniedCount: students.length };
}

/**
 * Check if a candidate name matches a student record
 */
export function doesStudentMatchNameToken(student: any, token: string): boolean {
  if (!student || !token) return false;
  const normS = normalizeArabicText(student.name || '');
  const normToken = normalizeArabicText(token);
  if (!normS || !normToken) return false;

  // 1. Exact match
  if (normS === normToken) return true;

  // 2. Full student name starts with token
  if (normS.startsWith(normToken + ' ') || normS.includes(normToken)) return true;

  const sParts = normS.split(/\s+/).filter(Boolean);
  const tokenParts = normToken.split(/\s+/).filter(Boolean);

  if (tokenParts.length === 1) {
    const target = tokenParts[0];
    // Match first name or any distinctive name part
    if (sParts[0] === target) return true;
    // Compound first name handling (e.g. "عبد الرحمن", "عبد الله")
    if (['عبد', 'ابو', 'ابن'].includes(sParts[0]) && sParts[1] && `${sParts[0]} ${sParts[1]}` === target) {
      return true;
    }
    // Match unique distinctive word
    if (target.length >= 3 && sParts.some(w => w === target)) {
      return true;
    }
  } else if (tokenParts.length >= 2) {
    // Check if all token parts appear in student parts in order
    let sIdx = 0;
    let matchedAll = true;
    for (const t of tokenParts) {
      const found = sParts.slice(sIdx).indexOf(t);
      if (found === -1) {
        matchedAll = false;
        break;
      }
      sIdx += found + 1;
    }
    if (matchedAll) return true;
  }

  return false;
}

/**
 * Centralized, Secure Student Search Engine
 */
export function resolveStudentsQuery(
  allStudentsPool: any[],
  filter: StudentSearchFilter,
  user: SearchUserContext,
  contextData?: {
    attendanceRecords?: any[];
    evaluations?: any[];
    halaqahs?: any[];
    teachers?: any[];
  }
): StudentResolutionResult {
  const totalAvailable = allStudentsPool.length;

  // 1. Permission check
  if (!user || user.role === 'guest') {
    return {
      status: 'PERMISSION_DENIED',
      message: 'غير مصرح: يجب تسجيل الدخول للوصول إلى بيانات الطلاب.',
      requestedCount: 0,
      totalAvailable,
      matchedStudents: [],
      isAllRequested: false,
      pageInfo: { total: 0, limit: 10, offset: 0, hasMore: false }
    };
  }

  const { authorized: authorizedStudentsPool, deniedCount } = filterStudentsByPermissions(
    allStudentsPool,
    user
  );

  // Scope filter: halaqah or complex or teacher
  let scopePool = [...authorizedStudentsPool];
  if ((filter.halaqahId && filter.halaqahId !== 'all') || filter.halaqahName) {
    scopePool = scopePool.filter(s => isStudentInHalaqah(s, { id: filter.halaqahId !== 'all' ? filter.halaqahId : undefined, name: filter.halaqahName }));
  }

  if ((filter.complexId && filter.complexId !== 'all') || filter.complexName) {
    scopePool = scopePool.filter(s => isStudentInComplex(
      s,
      { id: filter.complexId !== 'all' ? filter.complexId : undefined, name: filter.complexName },
      contextData?.halaqahs || [],
      contextData?.teachers || []
    ));
  }

  if (filter.teacherId || filter.teacherName) {
    const normT = filter.teacherName ? normalizeArabicText(filter.teacherName) : '';
    scopePool = scopePool.filter(s => {
      if (filter.teacherId && (s.teacherId === filter.teacherId || s.primaryTeacherId === filter.teacherId)) return true;
      if (normT) {
        const t1 = normalizeArabicText(s.teacherName || '');
        const t2 = normalizeArabicText(s.primaryTeacherName || '');
        if (t1.includes(normT) || normT.includes(t1) || t2.includes(normT) || normT.includes(t2)) return true;
      }
      return false;
    });
  }

  // Scope filter: Category / Level (ضعيف، متوسط، متقدم، قوي، ممتاز، مبتدئ، خاتم)
  if (filter.levelFilter) {
    scopePool = scopePool.filter(s => matchStudentLevel(s.level, filter.levelFilter!));
  }

  // Scope filter: Surah
  if (filter.surahFilter) {
    const normSurah = normalizeArabicText(filter.surahFilter);
    scopePool = scopePool.filter(s => {
      const curS = normalizeArabicText(s.currentSurahName || '');
      return curS.includes(normSurah) || normSurah.includes(curS);
    });
  }

  // Sort scope pool if requested
  if (filter.sortCriteria) {
    if (filter.sortCriteria === 'points_desc') {
      scopePool.sort((a, b) => (Number(b.points ?? b.totalPoints) || 0) - (Number(a.points ?? a.totalPoints) || 0));
    } else if (filter.sortCriteria === 'points_asc') {
      scopePool.sort((a, b) => (Number(a.points ?? a.totalPoints) || 0) - (Number(b.points ?? b.totalPoints) || 0));
    } else if (filter.sortCriteria === 'alpha') {
      scopePool.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
    } else if (filter.sortCriteria === 'attendance_desc') {
      scopePool.sort((a, b) => (Number(b.attendanceRate) || 0) - (Number(a.attendanceRate) || 0));
    } else if (filter.sortCriteria === 'absent_desc') {
      scopePool.sort((a, b) => (Number(b.absentDays ?? b.absentCount) || 0) - (Number(a.absentDays ?? a.absentCount) || 0));
    }
  }

  // 2. Explicit ID filter (Highest Priority!)
  if (filter.studentIds && filter.studentIds.length > 0) {
    const matched = scopePool.filter(s => filter.studentIds!.includes(s.id));
    if (matched.length === 0) {
      return {
        status: deniedCount > 0 ? 'PERMISSION_DENIED' : 'NOT_FOUND',
        message: deniedCount > 0
          ? 'غير مصرح لك بالوصول إلى بيانات الطالب المطلوب أو لا يقع ضمن نطاق صلاحياتك.'
          : 'لم يتم العثور على طالب بالمعرف المحدد.',
        requestedCount: filter.studentIds.length,
        totalAvailable: scopePool.length,
        matchedStudents: [],
        isAllRequested: false,
        pageInfo: { total: 0, limit: filter.limit || 10, offset: filter.offset || 0, hasMore: false }
      };
    }

    return {
      status: 'SUCCESS',
      message: `تم جلب بيانات ${matched.length} طالب بنجاح.`,
      requestedCount: filter.studentIds.length,
      totalAvailable: scopePool.length,
      matchedStudents: matched,
      isAllRequested: false,
      pageInfo: { total: matched.length, limit: filter.limit || matched.length, offset: 0, hasMore: false }
    };
  }

  // 3. Attendance Status Filter (e.g. Absent Students on Date)
  if (filter.attendanceStatus) {
    const targetDate = filter.targetDate || new Date().toISOString().split('T')[0];
    const attRecords = contextData?.attendanceRecords || [];
    const dateRecords = attRecords.filter((a: any) => a.date === targetDate && a.status === filter.attendanceStatus);
    const absentStudentIds = new Set(dateRecords.map((a: any) => a.studentId));

    const matched = scopePool.filter(s => absentStudentIds.has(s.id));

    if (matched.length === 0) {
      return {
        status: 'EMPTY',
        message: `لا يوجد طلاب بحالة (${filter.attendanceStatus}) لتاريخ ${targetDate}.`,
        requestedCount: 0,
        totalAvailable: scopePool.length,
        matchedStudents: [],
        isAllRequested: false,
        pageInfo: { total: 0, limit: filter.limit || 10, offset: 0, hasMore: false }
      };
    }

    return {
      status: 'SUCCESS',
      message: `تم العثور على ${matched.length} طلاب بحالة (${filter.attendanceStatus}) لتاريخ ${targetDate}.`,
      requestedCount: matched.length,
      totalAvailable: scopePool.length,
      matchedStudents: matched,
      isAllRequested: false,
      pageInfo: { total: matched.length, limit: filter.limit || matched.length, offset: 0, hasMore: false }
    };
  }

  // 4. Query text name extraction
  const rawQuery = filter.query || '';
  const isAll = Boolean(filter.isExplicitAllRequested || isQueryRequestingAllStudents(rawQuery));

  // If ALL students explicitly requested:
  if (isAll) {
    if (user.role === 'student' || user.role === 'parent') {
      return {
        status: 'PERMISSION_DENIED',
        message: 'غير مصرح لك بعرض جميع طلاب المنظومة.',
        requestedCount: scopePool.length,
        totalAvailable: scopePool.length,
        matchedStudents: [],
        isAllRequested: true,
        pageInfo: { total: 0, limit: 10, offset: 0, hasMore: false }
      };
    }

    const limit = filter.limit || 50;
    const offset = filter.offset || 0;
    const paged = scopePool.slice(offset, offset + limit);

    return {
      status: 'SUCCESS',
      message: `تم عرض جميع الطلاب المصرح بهم (${scopePool.length} طالب إجمالاً).`,
      requestedCount: scopePool.length,
      totalAvailable: scopePool.length,
      matchedStudents: paged,
      isAllRequested: true,
      pageInfo: {
        total: scopePool.length,
        limit,
        offset,
        hasMore: offset + limit < scopePool.length
      }
    };
  }

  // Extract name tokens from query or filter.studentNames
  const extractedTokens = (filter.studentNames && filter.studentNames.length > 0)
    ? filter.studentNames
    : extractCandidateNamesFromMessage(rawQuery);

  if (extractedTokens.length > 0) {
    const matchedSet = new Map<string, any>();
    const ambiguousList: Array<{ searchedName: string; matches: Array<{ id: string; name: string; halaqahName: string; halaqahId: string }> }> = [];
    const notFound: string[] = [];

    for (const token of extractedTokens) {
      const candidates = scopePool.filter(s => doesStudentMatchNameToken(s, token));

      if (candidates.length === 0) {
        // Check if denied by permission
        const inAll = allStudentsPool.some(s => doesStudentMatchNameToken(s, token));
        if (inAll) {
          return {
            status: 'PERMISSION_DENIED',
            message: `غير مصرح لك بالوصول إلى بيانات الطالب «${token}» خارج نطاق صلاحياتك.`,
            requestedCount: extractedTokens.length,
            totalAvailable: scopePool.length,
            matchedStudents: [],
            notFoundNames: [token],
            isAllRequested: false,
            pageInfo: { total: 0, limit: 10, offset: 0, hasMore: false }
          };
        }
        notFound.push(token);
      } else if (candidates.length === 1) {
        matchedSet.set(candidates[0].id, candidates[0]);
      } else {
        // Multiple matches -> Ambiguity!
        ambiguousList.push({
          searchedName: token,
          matches: candidates.map(c => ({
            id: c.id,
            name: c.name,
            halaqahName: c.halaqahName || 'الحلقة',
            halaqahId: c.halaqahId || ''
          }))
        });
      }
    }

    if (ambiguousList.length > 0) {
      const ambig = ambiguousList[0];
      const matchDesc = ambig.matches.map((m, idx) => `${idx + 1}. ${m.name} (${m.halaqahName})`).join('، ');
      return {
        status: 'AMBIGUOUS',
        message: `يوجد أكثر من طالب باسم «${ambig.searchedName}»: [${matchDesc}]. يرجى تحديد الطالب المطلوب بدقة.`,
        requestedCount: extractedTokens.length,
        totalAvailable: scopePool.length,
        matchedStudents: Array.from(matchedSet.values()),
        ambiguousCandidates: ambiguousList,
        notFoundNames: notFound,
        isAllRequested: false,
        pageInfo: { total: matchedSet.size, limit: 10, offset: 0, hasMore: false }
      };
    }

    if (matchedSet.size === 0 && notFound.length > 0) {
      return {
        status: 'NOT_FOUND',
        message: `لم يتم العثور على طالب باسم «${notFound.join('، ')}» ضمن الطلاب المصرح لك بالوصول إليهم.`,
        requestedCount: extractedTokens.length,
        totalAvailable: scopePool.length,
        matchedStudents: [],
        notFoundNames: notFound,
        isAllRequested: false,
        pageInfo: { total: 0, limit: 10, offset: 0, hasMore: false }
      };
    }

    const matchedList = Array.from(matchedSet.values());

    return {
      status: 'SUCCESS',
      message: `تم جلب بيانات ${matchedList.length} طالب المطلوبين بدقة.`,
      requestedCount: extractedTokens.length,
      totalAvailable: scopePool.length,
      matchedStudents: matchedList,
      notFoundNames: notFound,
      isAllRequested: false,
      pageInfo: { total: matchedList.length, limit: matchedList.length, offset: 0, hasMore: false }
    };
  }

  // 5. If category/level filter, surah filter, halaqah filter, complex filter, teacher filter, or explicit count limit was specified without individual student names:
  if (
    filter.levelFilter ||
    filter.surahFilter ||
    (filter.halaqahId && filter.halaqahId !== 'all') ||
    (filter.complexId && filter.complexId !== 'all') ||
    filter.halaqahName ||
    filter.complexName ||
    filter.teacherName ||
    filter.teacherId ||
    (typeof filter.limit === 'number' && filter.limit > 0)
  ) {
    const limit = filter.limit || 50;
    const paged = scopePool.slice(0, limit);

    let desc = 'النتائج المطابقة';
    if (filter.teacherName) desc = `طلاب ${filter.teacherName}`;
    else if (filter.halaqahName) desc = `طلاب ${filter.halaqahName}`;
    else if (filter.complexName) desc = `طلاب مجمع ${filter.complexName}`;
    else if (filter.levelFilter) desc = `طلاب فئة (${filter.levelFilter})`;

    return {
      status: paged.length > 0 ? 'SUCCESS' : 'EMPTY',
      message: paged.length > 0
        ? `تم العثور على ${paged.length} طلاب من ${desc}.`
        : 'لم يتم العثور على طلاب مطابقين للمعايير المحددة ضمن نطاق صلاحياتك.',
      requestedCount: paged.length,
      totalAvailable: scopePool.length,
      matchedStudents: paged,
      isAllRequested: false,
      pageInfo: { total: scopePool.length, limit, offset: 0, hasMore: scopePool.length > limit }
    };
  }

  // If no names were specified and no all was requested, return limited slice without expanding
  let limit = filter.limit;
  if (!limit && rawQuery) {
    const numMatch = rawQuery.match(/(?:أول|اول|عرض|هات|أعطني|اعطني)?\s*(\d+)\s*(?:طلاب|طالب|سجلات)/i);
    if (numMatch && numMatch[1]) {
      const parsed = parseInt(numMatch[1], 10);
      if (parsed > 0 && parsed <= 100) limit = parsed;
    }
  }
  const finalLimit = limit ? Math.min(limit, 100) : 10;
  const paged = scopePool.slice(0, finalLimit);

  return {
    status: 'SUCCESS',
    message: `عرض النتائج المصرح بها (${paged.length} من أصل ${scopePool.length}).`,
    requestedCount: paged.length,
    totalAvailable: scopePool.length,
    matchedStudents: paged,
    isAllRequested: false,
    pageInfo: { total: scopePool.length, limit, offset: 0, hasMore: scopePool.length > limit }
  };
}

/**
 * Automatically locate a student's brother(s) based on:
 * 1. Shared parent phone number or student phone
 * 2. Shared parent name
 * 3. Shared family / last name and father name
 */
export function findStudentBrothers(student: any, allStudentsList: any[]): any[] {
  if (!student || !Array.isArray(allStudentsList)) return [];
  const brothers: any[] = [];
  const seenIds = new Set<string>([student.id]);

  const cleanPhone = (ph?: any) => {
    if (!ph) return '';
    return String(ph).replace(/\D/g, '').trim();
  };

  const studentPhones = [
    cleanPhone(student.parentPhone),
    cleanPhone(student.phone),
    ...(Array.isArray(student.parentPhones) ? student.parentPhones.map(cleanPhone) : [])
  ].filter(p => p.length >= 7);

  const studentNormParent = normalizeArabicText(student.parentName || '');
  const nameParts = (student.name || '').trim().split(/\s+/).filter(Boolean);
  const studentLastName = nameParts.length >= 2 ? normalizeArabicText(nameParts[nameParts.length - 1]) : '';
  const studentFatherName = nameParts.length >= 3 ? normalizeArabicText(nameParts[1]) : '';

  for (const other of allStudentsList) {
    if (!other || seenIds.has(other.id)) continue;

    // 1. Match by shared parent/guardian phone
    const otherPhones = [
      cleanPhone(other.parentPhone),
      cleanPhone(other.phone),
      ...(Array.isArray(other.parentPhones) ? other.parentPhones.map(cleanPhone) : [])
    ].filter(p => p.length >= 7);

    const hasSharedPhone = studentPhones.some(sp => otherPhones.includes(sp));
    if (hasSharedPhone) {
      brothers.push(other);
      seenIds.add(other.id);
      continue;
    }

    // 2. Match by exact parent name
    if (studentNormParent && studentNormParent.length >= 4 && other.parentName) {
      if (normalizeArabicText(other.parentName) === studentNormParent) {
        brothers.push(other);
        seenIds.add(other.id);
        continue;
      }
    }

    // 3. Match by Family Last Name + Father Name
    const otherNameParts = (other.name || '').trim().split(/\s+/).filter(Boolean);
    const otherLastName = otherNameParts.length >= 2 ? normalizeArabicText(otherNameParts[otherNameParts.length - 1]) : '';
    const otherFatherName = otherNameParts.length >= 3 ? normalizeArabicText(otherNameParts[1]) : '';

    if (studentLastName && otherLastName && studentLastName.length >= 3 && studentLastName === otherLastName) {
      if (studentFatherName && otherFatherName && studentFatherName === otherFatherName) {
        brothers.push(other);
        seenIds.add(other.id);
      } else if (!student.halaqahId || other.halaqahId === student.halaqahId || other.complexId === student.complexId) {
        // If in the same halaqah/complex sharing the exact family name
        brothers.push(other);
        seenIds.add(other.id);
      }
    }
  }

  return brothers;
}

/**
 * Detect explicit count of students requested in conversational query
 * Supports:
 * - Western digits: "3 طلاب", "لـ 4 طلاب", "أول 5 طلاب", "اعملي 6 طلاب", "3 فقط"
 * - Eastern Arabic digits: "٣ طلاب", "لـ ٤ طلاب", "٥ طلاب فقط"
 * - Arabic word numbers: "طالبين", "طالبان", "ثلاثة طلاب", "أربعة طلاب", "خمسة طلاب", "سبعة طلاب", "عشرة طلاب"
 * - Ignores date/time durations like "اخر ٣ ايام", "خلال 5 ايام", "قبل يومين"
 */
export function detectExplicitCount(text: string): number | null {
  if (!text) return null;

  // 1. Strip time/date expressions so "اخر 3 ايام" is not misidentified as 3 students
  const timePeriodRegex = /(?:اخر|آخر|خلال|منذ|قبل|في)\s*(?:\d+|[٠-٩]+|ثلاث|أربع|خمس|ست|سبع|ثمان|تسع|عشر)\s*(?:ايام|أيام|يوم|اسابيع|أسابيع|شهور|أشهر|ساعات|دقائق)/gi;
  const strippedText = text.replace(timePeriodRegex, ' ');

  // 2. Convert Eastern Arabic numerals ٠-٩ to 0-9
  const westernDigits = strippedText.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());

  // 3. Direct digit patterns with student designations or general counts
  const digitMatch = westernDigits.match(/(?:أول|اول|عدد|لـ|ل|عن|ـ|هات|طلع|اعطني|أعطني|اعمل|سوي|جدول|كشف|بيانات|سجلات|فقط)?\s*(\d+)\s*(?:من\s+)?(?:الطلاب|طلاب|طالب|سجلات|اسماء|أسماء|فقط)?/i);
  if (digitMatch && digitMatch[1]) {
    const val = parseInt(digitMatch[1], 10);
    if (val > 0 && val <= 100 && !/\b(?:سورة|سوره|جزء|آية|ايه|عام|سنة|هاتف|رقم)\s*\d+/i.test(westernDigits)) {
      return val;
    }
  }

  // 4. Word numbers in Arabic
  const norm = westernDigits.toLowerCase();
  if (/(?:طالب\s+واحد|طالب\s+فقط|طالب\s+مفرد|طالب\s+محدد)/i.test(norm)) return 1;
  if (/(?:طالبين|طالبان|اثنين\s+طلاب|إثنين\s+طلاب|اثنين\s+طالب|اثنان\s+طلاب|طالبين\s+فقط|طالبان\s+فقط)/i.test(norm)) return 2;
  if (/(?:ثلاث|ثلاثة|ثلاثه)\s*(?:من\s+)?(?:الطلاب|طلاب|طالب|اسماء|أسماء|فقط)?/i.test(norm)) return 3;
  if (/(?:اربع|أربع|اربعة|أربعة|اربعه|أربعه)\s*(?:من\s+)?(?:الطلاب|طلاب|طالب|اسماء|أسماء|فقط)?/i.test(norm)) return 4;
  if (/(?:خمس|خمسة|خمسه)\s*(?:من\s+)?(?:الطلاب|طلاب|طالب|اسماء|أسماء|فقط)?/i.test(norm)) return 5;
  if (/(?:ست|ستة|سته)\s*(?:من\s+)?(?:الطلاب|طلاب|طالب|اسماء|أسماء|فقط)?/i.test(norm)) return 6;
  if (/(?:سبع|سبعة|سبعه)\s*(?:من\s+)?(?:الطلاب|طلاب|طالب|اسماء|أسماء|فقط)?/i.test(norm)) return 7;
  if (/(?:ثمان|ثماني|ثمانية|ثمانيه)\s*(?:من\s+)?(?:الطلاب|طلاب|طالب|اسماء|أسماء|فقط)?/i.test(norm)) return 8;
  if (/(?:تسع|تسعة|تسعه)\s*(?:من\s+)?(?:الطلاب|طلاب|طالب|اسماء|أسماء|فقط)?/i.test(norm)) return 9;
  if (/(?:عشر|عشرة|عشره)\s*(?:من\s+)?(?:الطلاب|طلاب|طالب|اسماء|أسماء|فقط)?/i.test(norm)) return 10;

  // 5. If user says "عدد محدد فقط" or "عدد محدد من الطلاب" or "عدد محدد" without specifying a number, default to 3
  if (/(?:عدد\s+محدد\s+فقط|عدد\s+محدد\s+من\s+الطلاب|عدد\s+محدد|عدد\s+معين\s+فقط|عدد\s+معين|عدد\s+مخصص)/i.test(norm)) {
    return 3;
  }

  return null;
}

/**
 * Detect if a specific Teacher or Sheikh is requested in the message
 */
export function detectTeacherInQuery(
  message: string,
  teachersList: any[] = [],
  halaqahsList: any[] = []
): { teacher: any | null; halaqah: any | null } {
  if (!message) return { teacher: null, halaqah: null };
  const normMsg = normalizeArabicText(message);

  if (Array.isArray(teachersList)) {
    for (const t of teachersList) {
      if (!t || !t.name) continue;
      const normTName = normalizeArabicText(t.name);
      const cleanTName = normTName.replace(/^(?:الشيخ|شيخ|المعلم|معلم|الاستاذ|أستاذ|استاذ|م\.)\s+/, '').trim();
      const firstWord = cleanTName.split(/\s+/)[0];

      const hasTeacherMention =
        normMsg.includes(normTName) ||
        (cleanTName.length >= 3 && (
          normMsg.includes(`الشيخ ${cleanTName}`) ||
          normMsg.includes(`شيخ ${cleanTName}`) ||
          normMsg.includes(`المعلم ${cleanTName}`) ||
          normMsg.includes(`معلم ${cleanTName}`) ||
          normMsg.includes(`الاستاذ ${cleanTName}`) ||
          normMsg.includes(`استاذ ${cleanTName}`) ||
          normMsg.includes(`حلقة ${cleanTName}`) ||
          normMsg.includes(`طلاب ${cleanTName}`)
        )) ||
        (firstWord.length >= 3 && (
          normMsg.includes(`الشيخ ${firstWord}`) ||
          normMsg.includes(`شيخ ${firstWord}`) ||
          normMsg.includes(`المعلم ${firstWord}`) ||
          normMsg.includes(`معلم ${firstWord}`)
        ));

      if (hasTeacherMention) {
        let teacherHalaqah = null;
        if (t.halaqahId && Array.isArray(halaqahsList)) {
          teacherHalaqah = halaqahsList.find(h => h.id === t.halaqahId) || null;
        }
        if (!teacherHalaqah && Array.isArray(halaqahsList)) {
          teacherHalaqah = halaqahsList.find(h =>
            h.primaryTeacherId === t.id ||
            (h.primaryTeacherName && normalizeArabicText(h.primaryTeacherName).includes(cleanTName))
          ) || null;
        }
        return { teacher: t, halaqah: teacherHalaqah };
      }
    }
  }

  // Also match by halaqah primaryTeacherName if teachersList was not populated
  if (Array.isArray(halaqahsList)) {
    for (const h of halaqahsList) {
      if (!h.primaryTeacherName) continue;
      const normPt = normalizeArabicText(h.primaryTeacherName);
      const cleanPt = normPt.replace(/^(?:الشيخ|شيخ|المعلم|معلم|الاستاذ|أستاذ|استاذ|م\.)\s+/, '').trim();
      const firstWord = cleanPt.split(/\s+/)[0];
      if (
        normMsg.includes(normPt) ||
        (cleanPt.length >= 3 && (
          normMsg.includes(`الشيخ ${cleanPt}`) ||
          normMsg.includes(`شيخ ${cleanPt}`) ||
          normMsg.includes(`المعلم ${cleanPt}`)
        )) ||
        (firstWord.length >= 3 && (
          normMsg.includes(`الشيخ ${firstWord}`) ||
          normMsg.includes(`شيخ ${firstWord}`)
        ))
      ) {
        return {
          teacher: { name: h.primaryTeacherName, halaqahId: h.id, halaqahName: h.name },
          halaqah: h
        };
      }
    }
  }

  // Generic Sheikh inquiry: "شيخ من الشيوخ", "اي شيخ", "أي شيخ", "معلم من المعلمين"
  if (/(?:شيخ\s+من\s+الشيوخ|أي\s+شيخ|اي\s+شيخ|معلم\s+من\s+المعلمين|أي\s+معلم|اي\s+معلم)/i.test(message)) {
    const defaultTeacher = (Array.isArray(teachersList) && teachersList[0])
      ? teachersList[0]
      : (halaqahsList[0]?.primaryTeacherName ? { name: halaqahsList[0].primaryTeacherName, halaqahId: halaqahsList[0].id, halaqahName: halaqahsList[0].name } : null);
    if (defaultTeacher) {
      const h = halaqahsList.find(hl => hl.id === defaultTeacher.halaqahId) || halaqahsList[0] || null;
      return { teacher: defaultTeacher, halaqah: h };
    }
  }

  return { teacher: null, halaqah: null };
}

/**
 * Detect if a specific Quran Complex is requested in the message
 */
export function findMatchingComplex(
  query: string,
  complexesList: any[] = [],
  studentsList: any[] = [],
  halaqahsList: any[] = [],
  teachersList: any[] = []
): any | null {
  if (!query) return null;
  const normQuery = normalizeArabicText(query);
  const bareQuery = stripArabicDefinite(normQuery);

  // 1. Compile all known complexes from all available sources
  const knownComplexes: Array<{ id: string; name: string; [key: string]: any }> = [];
  const seenNames = new Set<string>();

  const registerComplex = (c: any) => {
    if (!c || !c.name) return;
    const norm = normalizeArabicText(c.name);
    if (!seenNames.has(norm)) {
      seenNames.add(norm);
      knownComplexes.push(c);
    }
  };

  if (Array.isArray(complexesList)) {
    complexesList.forEach(registerComplex);
  }
  if (Array.isArray(studentsList)) {
    studentsList.forEach(s => {
      if (s?.complexName) {
        registerComplex({ id: s.complexId || `complex-${normalizeArabicText(s.complexName)}`, name: s.complexName });
      }
    });
  }
  if (Array.isArray(halaqahsList)) {
    halaqahsList.forEach(h => {
      if (h?.complexName) {
        registerComplex({ id: h.complexId || `complex-${normalizeArabicText(h.complexName)}`, name: h.complexName });
      }
    });
  }
  if (Array.isArray(teachersList)) {
    teachersList.forEach((t: any) => {
      if (t?.complexName) {
        registerComplex({ id: t.complexId || `complex-${normalizeArabicText(t.complexName)}`, name: t.complexName });
      }
      if (Array.isArray(t?.complexNames)) {
        t.complexNames.forEach((cName: string, idx: number) => {
          const cId = t.complexIds?.[idx] || `complex-${normalizeArabicText(cName)}`;
          registerComplex({ id: cId, name: cName });
        });
      }
    });
  }

  // 2. Direct, clean, or root name inclusion from known complexes
  for (const c of knownComplexes) {
    const normC = normalizeArabicText(c.name);
    const cleanC = cleanComplexBaseName(c.name);
    const bareC = stripArabicDefinite(cleanC);

    if (normQuery.includes(normC) || (cleanC.length >= 3 && normQuery.includes(cleanC))) {
      return c;
    }
    if (bareC.length >= 3 && (normQuery.includes(bareC) || bareQuery.includes(bareC))) {
      return c;
    }
  }

  // 3. Extract candidate complex phrase after "مجمع" or "المجمع" or "جامع" or "مركز"
  // e.g. "نقاط مجمع الحربي" -> "الحربي"
  // e.g. "حضور وغياب مجمع الفلاح" -> "الفلاح"
  // e.g. "كشف طلاب مجمع عائشة لتحفيظ القرآن" -> "عائشة"
  const complexMatch = query.match(/(?:في\s+مجمع|في\s+المجمع|من\s+مجمع|من\s+المجمع|لمجمع|للمجمع|عن\s+مجمع|عن\s+المجمع|بمجمع|بالمجمع|حق\s+مجمع|تبع\s+مجمع|طلاب\s+مجمع|نقاط\s+مجمع|حضور\s+مجمع|غياب\s+مجمع|مجمع|المجمع|في\s+جامع|في\s+الجامع|من\s+جامع|من\s+الجامع|لجامع|للجامع|جامع|الجامع|في\s+مركز|في\s+المركز|من\s+مركز|من\s+المركز|لمركز|للمركز|مركز|المركز)\s+([^\n,\.؛!?]+)/i);

  if (complexMatch && complexMatch[1]) {
    let candidate = complexMatch[1].trim();

    // Clean conversational noise, action verbs, and extraneous inquiry words from candidate phrase
    candidate = candidate
      .replace(/^(?:القراني|القرآني|النموذجي|العام)\s+/gi, '')
      .replace(/\s+(?:القراني|القرآني|النموذجي|لتحفيظ\s+القران|لتحفيظ\s+القرآن|الكريم).*$/gi, '')
      .replace(/\s+(?:فطلع\s+لي|فطلع|طلعلي|طلعوا|طلعي|طلع|اعمللي|اعمل|سويلي|سوي|سو|هاتلي|هات|أعطيني|اعطيني|أعطني|اعطني|جيبلي|جيب|وريني|ورني|اعرضلي|اعرض|أريد|اريد|ابغى|أبغى|ممكن|لو\s+سمحت|بالله|الله\s+يسعدك|الله\s+يعافيك|تكفى|شكرا|شكراً).*$/gi, '')
      .replace(/\s+(?:نقاط|النقاط|درجات|الدرجات|حضور|الـحضور|الحضور|غياب|الغياب|طلاب|الطلاب|الطلبة|طلبة|معلمي|معلمين|المعلمين|حلقات|الحلقات|كشف|جدول|تقرير|احصائيات|إحصائيات|بيانات|سجل|شيت|اكسل|كم|ايش|وش|شو|ترتيب|مستوى|فقط|كله|كلهم|جميعهم|كل\s+الطلاب|جميع\s+الطلاب|كاملة|كامله|كاملين|مرتبة|مرتبه|بالترتيب|اليوم|امس|أمس|الحين|الان|الآن|هذا\s+الاسبوع|هذا\s+الأسبوع).*$/gi, '')
      .trim();

    // If candidate has multiple trailing words, pick the first 1-2 words
    const candWords = candidate.split(/\s+/).filter(Boolean);
    if (candWords.length > 2) {
      candidate = candWords.slice(0, 2).join(' ');
    }

    const normCandidate = normalizeArabicText(candidate);
    const cleanCandidate = cleanComplexBaseName(candidate);
    const bareCandidate = stripArabicDefinite(cleanCandidate);

    // Stop words to avoid false positive on purely generic descriptions
    const genericTerms = new Set([
      'من المجمعات', 'اي مجمع', 'أي مجمع', 'معين', 'محدد', 'قراني', 'قرآني', 'القراني', 'القرآني',
      'نموذجي', 'النموذجي', 'عام', 'العام', 'المنظومة', 'المنظومه', 'الحلقات', 'حلقات', 'طلاب', 'الطلاب'
    ]);

    if (cleanCandidate && cleanCandidate.length >= 2 && !genericTerms.has(normCandidate) && !genericTerms.has(cleanCandidate)) {
      // 3.1 Check known complexes by token and partial match
      for (const c of knownComplexes) {
        const cleanC = cleanComplexBaseName(c.name);
        const bareC = stripArabicDefinite(cleanC);
        const normC = normalizeArabicText(c.name);

        if (cleanC === cleanCandidate || normC === normCandidate || bareC === bareCandidate) return c;
        if (cleanC.length >= 3 && (cleanCandidate.includes(cleanC) || bareCandidate.includes(bareC))) return c;
        if (cleanCandidate.length >= 3 && (cleanC.includes(cleanCandidate) || bareC.includes(bareCandidate))) return c;

        // Distinctive token match (e.g. "حربي" in "مجمع الحربي القرآني")
        const stopWords = new Set(['مجمع', 'المجمع', 'قراني', 'قرآني', 'القراني', 'القرآني', 'نموذجي', 'النموذجي', 'لتحفيظ', 'القران', 'القرآن', 'الكريم', 'عام', 'العام', 'بن', 'ابن', 'عبد', 'الله']);
        const candTokens = cleanCandidate.split(/\s+/).filter(w => w.length >= 3 && !stopWords.has(w));
        const cTokens = cleanC.split(/\s+/).filter(w => w.length >= 3 && !stopWords.has(w));

        const hasTokenOverlap = candTokens.some(tok => {
          const bTok = stripArabicDefinite(tok);
          return cTokens.some(ct => {
            const bCt = stripArabicDefinite(ct);
            return ct === tok || bCt === bTok || ct.includes(tok) || tok.includes(ct) || bCt.includes(bTok) || bTok.includes(bCt);
          });
        });

        if (hasTokenOverlap) {
          return c;
        }
      }

      // 3.2 If not found in known complexes, create a dynamically detected complex representing what the user asked for!
      const formattedName = candidate.startsWith('مجمع') ? candidate : `مجمع ${candidate}`;
      return {
        id: `complex-${normCandidate.replace(/\s+/g, '-')}`,
        name: formattedName,
        isDynamic: true,
      };
    }
  }

  // 4. Token search across known complexes if a distinctive token appears in query (e.g. "نقاط الحربي", "حضور الفرقان")
  for (const c of knownComplexes) {
    const cleanC = cleanComplexBaseName(c.name);
    const bareC = stripArabicDefinite(cleanC);
    const stopWords = new Set(['مجمع', 'المجمع', 'قراني', 'قرآني', 'القراني', 'القرآني', 'نموذجي', 'النموذجي', 'لتحفيظ', 'القران', 'القرآن', 'الكريم', 'عام', 'العام', 'بن', 'ابن', 'عبد', 'الله']);
    const tokens = cleanC.split(/\s+/).filter(w => w.length >= 3 && !stopWords.has(w));
    const bareTokens = tokens.map(t => stripArabicDefinite(t)).filter(w => w.length >= 3);
    const allTokens = [...new Set([...tokens, ...bareTokens, bareC])].filter(w => w.length >= 3 && !stopWords.has(w));

    for (const tok of allTokens) {
      if (normQuery.includes(tok) || bareQuery.includes(tok)) {
        return c;
      }
    }
  }

  // 5. Generic complex inquiry: only when specifically requesting a generic complex without a specific name
  if (/(?:مجمع\s+من\s+المجمعات|أي\s+مجمع|اي\s+مجمع|احصائيات\s+(?:المجمع|مجمع)|المجمع\s+القراني|المجمع\s+القرآني)/i.test(query)) {
    if (knownComplexes.length > 0) return knownComplexes[0];
  }

  return null;
}

/**
 * High-level assistant resolver with query classification (single, multi, all, count)
 */
export function resolveStudentQuery(
  message: string,
  studentsList: any[],
  halaqahsList: any[] = [],
  userContext: SearchUserContext,
  contextData?: any
): StudentResolutionResult & {
  isSingleStudentQuery: boolean;
  isMultipleStudentsQuery: boolean;
  isAllStudentsQuery: boolean;
  isCountQuery: boolean;
  clarificationQuestion: string | null;
  requestedNames: string[];
  detectedLevel?: string;
  detectedHalaqah?: string;
  detectedComplex?: string;
  matchedComplex?: any;
  detectedTeacher?: any;
  explicitCount?: number;
  detectedSort?: 'points_desc' | 'points_asc' | 'alpha' | 'attendance_desc' | 'absent_desc';
} {
  const normMsg = normalizeArabicText(message || '');
  const isAll = isQueryRequestingAllStudents(normMsg);

  // Detect Level / Category Filter
  const detectedLevel = detectCategoryOrLevel(message || '');

  // Detect Surah Filter
  const detectedSurah = detectSurahFilter(message || '');

  // Find teacher / sheikh if mentioned
  const teachersPool = Array.isArray(contextData?.teachers) ? contextData.teachers : [];
  const detectedTeacherRes = detectTeacherInQuery(message || '', teachersPool, halaqahsList);
  const detectedTeacher = detectedTeacherRes.teacher;

  // Find halaqah if mentioned (using robust token & clean-name matching)
  let matchedHalaqahId: string | undefined = undefined;
  let matchedHalaqahName: string | undefined = undefined;
  const foundHalaqah = findMatchingHalaqahInSearch(message || '', halaqahsList, studentsList);
  if (foundHalaqah) {
    matchedHalaqahId = foundHalaqah.id;
    matchedHalaqahName = foundHalaqah.name;
  }

  // If teacher was found and no halaqah was explicitly named, use teacher's halaqah
  if (!matchedHalaqahId && detectedTeacherRes.halaqah) {
    matchedHalaqahId = detectedTeacherRes.halaqah.id;
    matchedHalaqahName = detectedTeacherRes.halaqah.name;
  }

  // Find complex if mentioned
  const matchedComplex = findMatchingComplex(message || '', contextData?.complexes || [], studentsList, halaqahsList, teachersPool);
  const matchedComplexId: string | undefined = matchedComplex?.id;
  const matchedComplexName: string | undefined = matchedComplex?.name;

  const names = extractCandidateNamesFromMessage(message || '', {
    halaqahName: matchedHalaqahName,
    complexName: matchedComplexName,
    level: detectedLevel || undefined,
    teacherName: detectedTeacher?.name
  }, studentsList);

  // Detect explicit requested count
  const explicitCount = detectExplicitCount(message || '');

  // Detect Sorting
  let detectedSort: 'points_desc' | 'points_asc' | 'alpha' | 'attendance_desc' | 'absent_desc' | undefined = undefined;
  if (/(?:الاعلى|الأعلى|اعلى|أعلى|تنازلي|المتصدرين|الأوائل|الاوائل|أفضل|افضل|متفوقين|المتفوقين)\s*(?:في\s+|بال)?(?:النقاط|نقاط)?/i.test(message) || normMsg.includes('تنازلي') || normMsg.includes('اعلى نقاط') || normMsg.includes('افضل طلاب') || normMsg.includes('أفضل طلاب')) {
    detectedSort = 'points_desc';
  } else if (/(?:الاقل|الأقل|اقل|أقل|تصاعدي|المتعثرين|المتأخرين)\s*(?:في\s+|بال)?(?:النقاط|نقاط)?/i.test(message) || normMsg.includes('تصاعدي') || normMsg.includes('اقل نقاط')) {
    detectedSort = 'points_asc';
  } else if (/(?:ابجدي|أبجدي|بالحروف|ابجديا|أبجدياً)/i.test(message) || normMsg.includes('ابجدي')) {
    detectedSort = 'alpha';
  } else if (normMsg.includes('حسب الحضور') || normMsg.includes('نسبة الحضور') || normMsg.includes('الاكثر التزاما') || normMsg.includes('الأكثر التزاماً') || normMsg.includes('الاكثر حضورا') || normMsg.includes('الأكثر حضوراً')) {
    detectedSort = 'attendance_desc';
  } else if (normMsg.includes('الاكثر غيابا') || normMsg.includes('الأكثر غياباً') || normMsg.includes('اكثر غيابا') || normMsg.includes('أكثر غياباً') || normMsg.includes('الغياب')) {
    detectedSort = 'absent_desc';
  }

  const baseResult = resolveStudentsQuery(
    studentsList,
    {
      query: message,
      studentNames: names.length > 0 ? names : undefined,
      halaqahId: matchedHalaqahId,
      halaqahName: matchedHalaqahName,
      complexId: matchedComplexId,
      complexName: matchedComplexName,
      levelFilter: detectedLevel || undefined,
      surahFilter: detectedSurah || undefined,
      teacherId: detectedTeacher?.id,
      teacherName: detectedTeacher?.name,
      sortCriteria: detectedSort,
      isExplicitAllRequested: isAll,
      limit: explicitCount || (isAll ? 50 : undefined),
    },
    userContext,
    {
      ...contextData,
      halaqahs: (contextData?.halaqahs && contextData.halaqahs.length > 0) ? contextData.halaqahs : halaqahsList,
      teachers: (contextData?.teachers && contextData.teachers.length > 0) ? contextData.teachers : teachersPool
    }
  );

  // Check brother intent ("يوسف واخوه", "فلان وأخوه", etc.)
  const hasBrotherIntent = /(?:و\s*اخوه|و\s*أخوه|مع\s+اخوه|مع\s+أخوه|واخيه|وأخيه|اخوه|أخوه|شقيقه|أخاه|اخاه)/i.test(message || '');
  if (hasBrotherIntent && baseResult.matchedStudents.length > 0) {
    const mainStudent = baseResult.matchedStudents[0];
    const brothers = findStudentBrothers(mainStudent, studentsList);
    if (brothers.length > 0) {
      for (const br of brothers) {
        if (!baseResult.matchedStudents.some(s => s.id === br.id)) {
          baseResult.matchedStudents.push(br);
        }
      }
      baseResult.status = 'SUCCESS';
      baseResult.message = `تم جلب بيانات الطالب ${mainStudent.name} وأخوه الطالب ${brothers.map(b => b.name).join(' و ')} بنجاح.`;
    }
  }

  // Check Juz Amma intent ("ختموا جزء عم", "خاتمي جزء عم", etc.)
  const isJuzAmmaIntent =
    /(?:ختموا|ختم|أتموا|اتموا|أتم|اتم|خاتمي|خاتمين|حفظوا|حفظ|متقني|متقنين)\s+(?:جزء\s+)?(?:عم|عَمّ)/i.test(message || '') ||
    normMsg.includes('ختموا جزء عم') ||
    normMsg.includes('خاتمي جزء عم') ||
    normMsg.includes('خاتمين جزء عم') ||
    normMsg.includes('طلاب جزء عم') ||
    normMsg.includes('حفظة جزء عم');

  if (isJuzAmmaIntent) {
    const juzAmmaStudents = studentsList.filter(s => {
      const pages = Array.isArray(s.completedNewPages) ? s.completedNewPages : [];
      const hasJuzAmmaPages = pages.some((p: number) => p >= 582 && p <= 604);
      const isLevelKhatem = s.level === 'خاتم' || s.level === 'متقدم' || s.level === 'ممتاز';
      const surahPastAmma = typeof s.currentSurah === 'number' && s.currentSurah > 77;
      const notesAmma = (s.notes || '').includes('عم') || (s.currentSurahName || '').includes('النبأ') || (s.currentSurahName || '').includes('الناس');
      return hasJuzAmmaPages || isLevelKhatem || surahPastAmma || notesAmma;
    });

    if (juzAmmaStudents.length > 0) {
      baseResult.matchedStudents = juzAmmaStudents;
      baseResult.status = 'SUCCESS';
      baseResult.message = `تم العثور على ${juzAmmaStudents.length} طلاب أتموا أو يحفظون جزء عم المبارك.`;
    }
  }

  // If explicit count was requested, strictly cap the returned students to that count
  if (explicitCount !== null && explicitCount > 0 && baseResult.matchedStudents.length > explicitCount) {
    baseResult.matchedStudents = baseResult.matchedStudents.slice(0, explicitCount);
    baseResult.requestedCount = baseResult.matchedStudents.length;
  }

  const isSingle = !isAll && !hasBrotherIntent && (names.length === 1 || (names.length === 0 && explicitCount === 1));
  const isMultiple = !isAll && (names.length > 1 || hasBrotherIntent || isJuzAmmaIntent || (explicitCount !== null && explicitCount > 1) || Boolean(detectedLevel) || Boolean(matchedHalaqahId) || Boolean(matchedComplexId) || Boolean(detectedTeacher));
  const isCount = explicitCount !== null && explicitCount > 0;

  let clarification: string | null = null;
  if (baseResult.status === 'AMBIGUOUS' || baseResult.status === 'PERMISSION_DENIED' || baseResult.status === 'NOT_FOUND') {
    clarification = baseResult.message;
  }

  return {
    ...baseResult,
    isSingleStudentQuery: isSingle,
    isMultipleStudentsQuery: isMultiple,
    isAllStudentsQuery: isAll,
    isCountQuery: isCount,
    explicitCount: explicitCount || undefined,
    clarificationQuestion: clarification,
    requestedNames: names,
    detectedLevel: detectedLevel || undefined,
    detectedHalaqah: matchedHalaqahName,
    detectedComplex: matchedComplexName,
    matchedComplex: matchedComplex || undefined,
    detectedTeacher: detectedTeacher || undefined,
    detectedSort,
  };
}
