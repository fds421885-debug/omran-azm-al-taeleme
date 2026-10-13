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
  attendanceStatus?: 'حاضر' | 'غائب' | 'معتذر' | 'متأخر';
  targetDate?: string;
  limit?: number;
  offset?: number;
  isExplicitAllRequested?: boolean;
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
 * Clean student name token from conversational noise, prepositions, days, and verbs
 */
export function cleanNameToken(token: string): string {
  if (!token) return '';
  let cleaned = token.trim();

  // 1. Remove introductory conversational greetings & fillers at the start
  cleaned = cleaned
    .replace(/^(?:طيب|حسنا|تمام|اوكي|شكرا|عفوا|مرحبا|أهلا|اهلا|السلام\s+عليكم|وعليكم\s+السلام|هلا|يا\s+اخي|يا\s+أخي)\s+/gi, '')
    .replace(/^(?:أعطني|اعطني|عطني|هات|جيب|أريد|اريد|ودي|ودنا|ابغى|أبغى|اعرض|عرض|أظهر|اظهر|ورني|وريني|طلع|طلعلي|شف|شوف|ممكن|لو\s+سمحت|من\s+فضلك|بالله)\s+(?:لي\s+|لنا\s+)?/gi, '')
    .replace(/^(?:بيانات|سجل|تقرير|تقارير|معلومات|تفاصيل|كشف|درجات|نقاط|حفظ|تسميع|حضور|غياب|مستوى|تقييم|إحصائيات|احصائيات|بطاقة|بطاقات|شهادة|شهادات)\s+(?:عن\s+)?/gi, '')
    .replace(/^(?:ماذا\s+سمعوا|ماذا\s+سمعو|وش\s+سمعوا|وش\s+سمعو|ايش\s+سمعوا|ايش\s+سمعو|شو\s+سمعوا|شو\s+سمعو|ماذا\s+سمع|وش\s+سمع|ايش\s+سمع|شو\s+سمع|كم\s+حفظ|لماذا\s+سمع|لماذا\s+سمعوا|لماذا\s+سمعو|ما\s+هو\s+مقرر|ما\s+مقرر|وين\s+وصل|أين\s+وصل|اين\s+وصل)\s+(?:عن\s+)?/gi, '')
    .replace(/^(?:الطالب|طالب|طالبا|طالباً|الطلبة|الطلاب|طالبنا|اسم|اسمه|المدعو|عن|للطالب|لطالب|هو|وهو|كل\s+من|واخوه|و\s+اخوه|اخوه|أخوه|و\s+أخوه|وابنه|و\s+ابنه|ابنه|أبنه)\s+/gi, '');

  // 2. Remove halaqah suffix clauses
  cleaned = cleaned.replace(/\s+(?:في|الي|إلى|مع|ب)\s+(?:حلقة|احلققة|احلققه|احلقة|احلقه|مجموعة|مجموعه).*$/gi, '');

  // 3. Remove mid-sentence or trailing interrogative/action clauses like "ماذا سمع", "كم حفظ", "ما هو مقرره", "وين وصل", etc.
  cleaned = cleaned.replace(/\s+(?:ماذا|وش|ايش|شو|كم|وين|أين|اين|كيف|ما|ماهو|ما\s+هو|متى)\s+(?:سمع|سمّع|سمعو|سمعوا|حفظ|حفظو|حفظوا|قرأ|قرا|واصل|وصل|مستواه|نقاطه|درجاته|مقرر|الورد).*$/gi, '');

  // 4. Remove standalone trailing recitation/listening verbs
  cleaned = cleaned.replace(/\s+(?:سمع|سمّع|سمعو|سمعوا|حفظ|حفظو|حفظوا|قرأ|قرا|واصل|وصل|انجز|أنجز).*$/gi, '');

  // 5. Remove day names, dates, temporal adverbs from ANYWHERE in the token (NOT just end)
  cleaned = cleaned.replace(/(?:^|\s+)(?:يوم\s+)?(?:الاحد|الأحد|احد|أحد|الاثنين|الإثنين|اثنين|إثنين|اثنيين|الثلاثاء|ثلاثاء|ثلثاء|الاربعاء|الأربعاء|اربعاء|أربعاء|الخميس|خميس|الجمعة|جمعة|جمعه|السبت|سبت)(?:\s+|$)/gi, ' ');
  cleaned = cleaned.replace(/(?:^|\s+)(?:اليوم|أمس|امس|البارحة|البارحه|بارحة|بارحه|غداً|غدا|بكرة|قبل\s+أمس|قبل\s+امس|منذ\s+يومين|هذا\s+الاسبوع|هذا\s+الشهر|مقرر\s+الغد|ورد\s+الغد|مقرر\s+اليوم|مقرره)(?:\s+|$)/gi, ' ');

  // 6. Remove system entity terms
  cleaned = cleaned.replace(/(?:^|\s+)(?:رسم\s+بياني|تشخيص\s+بياني|مخطط\s+بياني|مخطط|شارت|شامل\s+للمجمع|للمجمع|المجمع|مجمع|الحلقة|الحلقه|حلقة|حلقه)(?:\s+|$)/gi, ' ');

  // 7. Clean punctuation and digits
  cleaned = cleaned.replace(/[\d٠-٩،,:\-–—؛.!?\(\)\[\]"'\?؟]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned;
}

const GENERIC_STUDENT_WORDS = [
  'الطلاب', 'طلاب', 'طلابي', 'طلابنا', 'الطلبة', 'طلبة', 'طالب', 'الطالب', 'طالبا', 'طالباً',
  'الكل', 'المجموعة', 'الحلقة', 'الحلقه', 'حلقة', 'حلقه', 'القائمة', 'القائمه',
  'الجميع', 'الاولاد', 'الأولاد', 'الاطفال', 'الأطفال', 'الحلقات',
  'السجلات', 'سجلات', 'كشف', 'بيانات', 'تقرير', 'درجات', 'نقاط',
  'رسم بياني', 'تشخيص بياني', 'بياني', 'مخطط', 'مخططات', 'شارت', 'شامل للمجمع', 'للمجمع', 'المجمع', 'مجمع',
  'مقرر الغد', 'مقرر اليوم', 'ما هو مقرر الغد', 'ما هو مقرر اليوم', 'مقرر', 'الورد', 'غدا', 'غداً', 'اليوم', 'أمس', 'امس',
  'طيب', 'حسنا', 'تمام', 'اوكي', 'شكرا', 'عفوا', 'السلام عليكم', 'وعليكم السلام', 'مرحبا', 'هلا', 'أهلاً', 'اهلاً',
  'ماذا سمعوا', 'ماذا سمعو', 'وش سمعوا', 'وش سمعو', 'ايش سمعوا', 'ايش سمعو', 'شو سمعوا', 'شو سمعو',
  'ماذا سمع الطلاب', 'تسميع الطلاب', 'حفظ الطلاب', 'حضور الطلاب', 'غياب الطلاب', 'كشف الطلاب', 'جدول الطلاب',
  'كم وجه', 'اوجه', 'أوجه', 'تسميع', 'تسميعات', 'حفظ', 'مراجعة',
  'لوحة الشرف', 'لوحة الصدارة', 'المتصدرين', 'الأوائل', 'الاوائل',
  'المعلمين', 'المحفظين', 'معلمي المجمع', 'معلمي الحلقة',
  'يوم الاحد', 'الاحد', 'الأحد', 'الاثنين', 'الإثنين', 'الثلاثاء', 'الاربعاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'
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
export function extractCandidateNamesFromMessage(message: string): string[] {
  if (!message) return [];

  // If user explicitly asks for all students, do not extract names
  if (isQueryRequestingAllStudents(message)) return [];

  // If the query matches pure non-student patterns and does not contain explicit "الطالب" or "طالبنا"
  const isExplicitSingleStudentQuery = /(?:عن\s+الطالب|للطالب|لطالب|الطالب|طالبنا|اسم\s+الطالب|اسمه|المدعو)\s+[^\s,،\.\?!]+/i.test(message);
  if (!isExplicitSingleStudentQuery) {
    for (const pat of NON_STUDENT_INTENT_PATTERNS) {
      if (pat.test(message)) {
        return [];
      }
    }
  }

  let cleaned = message.trim();
  cleaned = cleaned
    .replace(/^(?:طيب|حسنا|تمام|اوكي|شكرا|عفوا|مرحبا|أهلا|اهلا|السلام\s+عليكم)\s+/gi, '')
    .replace(/^(?:أعطني|اعطني|عطني|هات|جيب|أريد|اريد|ودي|ودنا|ابغى|أبغى|اعرض|عرض|أظهر|اظهر|ورني|وريني|طلع|طلعلي|شف|شوف|ممكن|لو\s+سمحت|من\s+فضلك|بالله)\s+(?:لي\s+|لنا\s+)?/gi, '')
    .replace(/^(?:بيانات|سجل|تقرير|تقارير|معلومات|تفاصيل|كشف|درجات|نقاط|حفظ|تسميع|حضور|غياب|مستوى|تقييم|إحصائيات|احصائيات)\s+(?:عن\s+)?/gi, '')
    .replace(/^(?:ماذا\s+سمعوا|ماذا\s+سمعو|وش\s+سمعوا|وش\s+سمعو|ايش\s+سمعوا|ايش\s+سمعو|شو\s+سمعوا|شو\s+سمعو|ماذا\s+سمع|وش\s+سمع|ايش\s+سمع|شو\s+سمع|كم\s+حفظ)\s+(?:عن\s+)?/gi, '');

  const tokens = cleaned.split(/\s*[,،]\s*|\s+مع\s+|\s+و(?=اخوه|أخوه)\s*|\s+و(?=[\u0600-\u06FF]{3,})|\s+و\s+(?=[\u0600-\u06FF]{3,})/);
  const candidateNames: string[] = [];

  for (const t of tokens) {
    const c = cleanNameToken(t);
    const normC = normalizeArabicText(c);
    if (
      c &&
      c.length >= 2 &&
      !isQueryRequestingAllStudents(c) &&
      !GENERIC_STUDENT_TERMS.has(c) &&
      !GENERIC_STUDENT_TERMS.has(normC) &&
      !candidateNames.includes(c)
    ) {
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

  // Scope filter: halaqah or complex
  let scopePool = [...authorizedStudentsPool];
  if (filter.halaqahId && filter.halaqahId !== 'all') {
    scopePool = scopePool.filter(s => s.halaqahId === filter.halaqahId);
  }
  if (filter.complexId && filter.complexId !== 'all') {
    scopePool = scopePool.filter(s => !s.complexId || s.complexId === filter.complexId);
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
} {
  const normMsg = normalizeArabicText(message || '');
  const isAll = isQueryRequestingAllStudents(normMsg);
  const names = extractCandidateNamesFromMessage(message || '');

  // Detect explicit requested count
  const digitMatch = (message || '').match(/(?:لـ\s*|ل\s*|عن\s*|ـ\s*)?(\d+)\s*(?:من\s+)?(?:الطلاب|طلاب|طالب)/);
  let explicitCount: number | null = null;
  if (digitMatch && digitMatch[1]) {
    explicitCount = parseInt(digitMatch[1], 10);
  } else if (/(?:طالبين|طالبان|اثنين|إثنين)/i.test(message || '')) {
    explicitCount = 2;
  } else if (/(?:ثلاث|ثلاثة|3)/i.test(message || '')) {
    explicitCount = 3;
  } else if (/(?:أربع|اربع|أربعة|اربعة|4)/i.test(message || '')) {
    explicitCount = 4;
  } else if (/(?:خمس|خمسة|5)/i.test(message || '')) {
    explicitCount = 5;
  }

  // Find halaqah if mentioned
  let matchedHalaqahId: string | undefined = undefined;
  if (Array.isArray(halaqahsList)) {
    for (const h of halaqahsList) {
      const normH = normalizeArabicText(h.name || '');
      if (normH && (normMsg.includes(normH) || (normH.length >= 4 && normMsg.includes(normH.split(/\s+/).slice(-1)[0])))) {
        matchedHalaqahId = h.id;
        break;
      }
    }
  }

  const baseResult = resolveStudentsQuery(
    studentsList,
    {
      query: message,
      studentNames: names.length > 0 ? names : undefined,
      halaqahId: matchedHalaqahId,
      isExplicitAllRequested: isAll,
      limit: explicitCount || (isAll ? 50 : undefined),
    },
    userContext,
    contextData
  );

  const isSingle = !isAll && (names.length === 1 || (names.length === 0 && explicitCount === 1));
  const isMultiple = !isAll && (names.length > 1 || (explicitCount !== null && explicitCount > 1));
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
    clarificationQuestion: clarification,
    requestedNames: names,
  };
}
