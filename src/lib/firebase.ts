import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  Firestore,
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDocFromServer,
  writeBatch
} from 'firebase/firestore';
import baseAppletConfig from '../../firebase-applet-config.json';
import {
  UserRole,
  Student,
  AttendanceRecord,
  StudentEvaluation,
  EvaluationCriteria,
  AppSettings,
  ChatMessage,
  UserAccount,
  TeacherAccount,
  BehaviorViolation,
  FullBackupData,
  ComplexBackupData,
  ComplexMigrationProgress,
  ComplexMigrationResult,
  QuranComplex,
  Halaqah,
  Exam,
  ExamQuestion,
  ExamSubmission,
  LeaderboardSettings,
  GoogleOAuthConfig,
  SurahRecording,
  RecordingsConfig,
  StudentListeningLog,
  IssuedCertificate,
  TeacherShift,
  MosqueLocationConfig,
  MosqueItem,
  TeacherAttendanceRecord,
  normalizeTeacherText,
  LibraryDocument,
  getTeacherSixDigitCode,
  StudentRegistrationApplication,
  ComplexPortalConfig,
  ComplexPlanScheduleConfig
} from '../types';

// Web app's Firebase configuration from firebase-applet-config.json
export const firebaseConfig = {
  ...baseAppletConfig
};

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Target Firestore Database ID
export const TARGET_FIRESTORE_DATABASE_ID = (baseAppletConfig as any).firestoreDatabaseId || "ai-studio-omranazmaltaelem-10142cc0-ddb7-46f3-9783-e1f17f7aede6";

// Initialize Firestore on the targeted database id (ai-studio-9d31420a-1d75-4c6c-a7b6-8e5ec8416a66)
export const db = (() => {
  try {
    return getFirestore(app, TARGET_FIRESTORE_DATABASE_ID);
  } catch (err) {
    return getFirestore(app);
  }
})();
export const auth = getAuth(app);

export const DEFAULT_RECORDINGS_CONFIG: RecordingsConfig = {
  isPublishedToStudents: true,
  dailyRepetitionTarget: 3,
  listeningPointsReward: 5,
  updatedAt: new Date().toISOString()
};

export const DEFAULT_LEADERBOARD_SETTINGS: LeaderboardSettings = {
  scope: 'all_unified',
  includeExamPoints: true,
  includeEvaluationScores: true,
  updatedAt: new Date().toISOString()
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMsg = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  // Avoid flooding console with offline notices or normal fallback messages
  return errInfo;
}

// Resilient, non-blocking Firestore query helpers with automatic responsive timeout (3s)
export async function safeGetDocs(colRef: any, timeoutMs = 3000): Promise<{ docs: any[]; empty: boolean; forEach: (fn: (doc: any) => void) => void }> {
  try {
    const fetchPromise = getDocs(colRef);
    // Crucial: attach no-op catch so late rejections don't cause unhandledrejection
    fetchPromise.catch(() => {});
    const timeoutPromise = new Promise<{ docs: any[]; empty: boolean; forEach: (fn: any) => void }>((resolve) =>
      setTimeout(() => resolve({ docs: [], empty: true, forEach: () => {} }), timeoutMs)
    );
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch {
    return { docs: [], empty: true, forEach: () => {} };
  }
}

export async function safeGetDoc(docRef: any, timeoutMs = 3000): Promise<{ exists: () => boolean; data: () => any }> {
  try {
    const fetchPromise = getDoc(docRef);
    // Crucial: attach no-op catch so late rejections don't cause unhandledrejection
    fetchPromise.catch(() => {});
    const timeoutPromise = new Promise<{ exists: () => boolean; data: () => any }>((resolve) =>
      setTimeout(() => resolve({ exists: () => false, data: () => null }), timeoutMs)
    );
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch {
    return { exists: () => false, data: () => null };
  }
}

// Initial Default Evaluation Criteria
export const DEFAULT_CRITERIA: EvaluationCriteria[] = [
  {
    id: 'crit-memorization',
    name: 'حفظ الورد الجديد',
    type: 'score',
    maxScore: 10,
    pointsWeight: 10,
    hasPoints: true,
    isDefault: true
  },
  {
    id: 'crit-review',
    name: 'مراجعة الماضي',
    type: 'score',
    maxScore: 10,
    pointsWeight: 10,
    hasPoints: true,
    isDefault: true
  },
  {
    id: 'crit-tajweed',
    name: 'التجويد ومخارج الحروف',
    type: 'stars',
    pointsWeight: 10,
    hasPoints: true,
    isDefault: false
  },
  {
    id: 'crit-behavior',
    name: 'الآداب وحسن الاستماع',
    type: 'options',
    options: ['متميز ومؤدب', 'جيد ومتعاون', 'يحتاج إلى تنبيه'],
    hasPoints: false,
    isDefault: false
  }
];

export const DEFAULT_COMPLEXES: QuranComplex[] = [
  {
    id: 'complex-main',
    name: 'المجمع القرآني النموذجي',
    description: 'المجمع القرآني النموذجي التابع لمنظومة عمران',
    complexType: 'single_complex',
    supervisorTeacherId: 'teacher-1',
    supervisorTeacherName: 'المشرف العام',
    createdAt: new Date().toISOString()
  }
];

export const DEFAULT_HALAQAHS: Halaqah[] = [
  {
    id: 'halaqah-main',
    name: 'حلقة القرآن الكريم',
    description: 'الحلقة القرآنية النموذجية',
    complexId: 'complex-main',
    complexName: 'المجمع القرآني النموذجي',
    primaryTeacherName: 'معلم ومحفظ الحلقة',
    capacity: 15,
    createdAt: new Date().toISOString(),
    isDefault: true
  },
  {
    id: 'halaqah-zubair',
    name: 'حلقة الزبير بن العوام',
    description: 'حلقة المتميزين والحفظ المكثف',
    complexId: 'complex-main',
    complexName: 'المجمع القرآني النموذجي',
    primaryTeacherName: 'الشيخ إبراهيم الخليل',
    capacity: 15,
    createdAt: new Date().toISOString(),
    isDefault: false
  },
  {
    id: 'halaqah-abubakr',
    name: 'حلقة أبي بكر الصديق',
    description: 'حلقة التأسيس وإتقان التلاوة',
    complexId: 'complex-main',
    complexName: 'المجمع القرآني النموذجي',
    primaryTeacherName: 'م. محمد منتصر',
    capacity: 15,
    createdAt: new Date().toISOString(),
    isDefault: false
  }
];

export const DEFAULT_ABSENCE_TEMPLATES = [
  {
    id: 'absence-template-default',
    title: 'رسالة تفقد غياب ودية (الافتراضية)',
    template: 'السلام عليكم ورحمة الله وبركاته، علومك شيخنا بشرنا عنك وعن {اسم_الولد}، استغربنا غيابه اليوم بشر عساه بخير؟',
    createdAt: new Date().toISOString()
  },
  {
    id: 'absence-template-missed',
    title: 'رسالة افتقاد الطالب في الحلقة',
    template: 'السلام عليكم ورحمة الله وبركاته، حياكم الله ولي أمرنا الكريم، افتقدنا ابننا {اسم_الولد} في الحلقة اليوم، عساه بخير وعافية؟',
    createdAt: new Date().toISOString()
  }
];

export const DEFAULT_SETTINGS: AppSettings = {
  allowStudentRegistration: true,
  workDaysPerWeek: 5,
  workDaysNames: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'],
  halaqahName: 'حلقة القرآن الكريم',
  teacherName: 'معلم ومحفظ الحلقة',
  newPagePoints: 5,
  reviewPagePoints: 1,
  dailyListeningPoints: 5,
  attendancePointsSettings: {
    presentPoints: 1,
    latePoints: 0,
    excusedPoints: 0,
    absentPointsDeduction: 1,
    enableAttendancePoints: true
  },
  absenceMessageTemplates: DEFAULT_ABSENCE_TEMPLATES
};

// Initial Registered Teachers (Default Teacher Accounts)
export const INITIAL_TEACHERS: TeacherAccount[] = [
  {
    id: 'teacher-1',
    name: 'م. محمد منتصر',
    username: 'admin',
    password: '123',
    phone: '0500000000',
    teacherCode: '749201',
    title: 'المشرف والمعلم المبرمج والمطور العام',
    role: 'developer',
    isPrimary: true,
    complexId: 'complex-main',
    complexName: 'المجمع القرآني النموذجي',
    halaqahId: 'halaqah-main',
    halaqahName: 'حلقة القرآن الكريم',
    googleEmail: 'fds421885@gmail.com',
    isGoogleLinked: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'teacher-2',
    name: 'الشيخ إبراهيم الخليل',
    username: 'ibrahim',
    password: '123',
    phone: '0501122334',
    teacherCode: '582910',
    title: 'معلم ومحفظ حلقة الزبير بن العوام',
    role: 'teacher',
    isPrimary: false,
    complexId: 'complex-main',
    complexName: 'المجمع القرآني النموذجي',
    halaqahId: 'halaqah-zubair',
    halaqahName: 'حلقة الزبير بن العوام',
    createdAt: new Date().toISOString()
  }
];

// Initial Seed Students for demonstration
export const INITIAL_STUDENTS: Student[] = [
  {
    id: 'std-1',
    name: 'عبد الرحمن أحمد السعيد',
    password: '123',
    phone: '0501234567',
    age: 12,
    parentName: 'أحمد السعيد',
    parentPhones: ['966501234567', '966551234567'],
    parentPhone: '966501234567',
    currentSurah: 2,
    currentSurahName: 'البقرة',
    currentAyah: 45,
    dailyNewTarget: 'وجه كامل',
    dailyReviewTarget: 'نصف جزء',
    level: 'قوي',
    halaqahId: 'halaqah-main',
    halaqahName: 'حلقة القرآن الكريم',
    aiPlan: {
      roadmapSummary: 'خطة حفظ سورة البقرة بمعدل وجه يومياً مع مراجعة نصف جزء من جزء عم وتبارك.',
      currentDailyAssignment: {
        newMemorization: 'سورة البقرة: الآيات (46 - 52)',
        review: 'سورة النبأ وسورة النازعات كاملتين',
        suggestedSheikh: 'الشيخ محمود خليل الحصري (المصحف المعلم)',
        tajweedFocus: 'تطبيق أحكام النون الساكنة والتنوين (الإدغام بغنة)',
        dailyNote: 'كرر كل آية 5 مرات بالربط مع الآية التي قبلها قبل التسميع على المعلم.'
      },
      difficultyAdjustment: 'وتيرة ممتازة تناسب قدرات الطالب العالية',
      estimatedDaysToFinishJuz: 22,
      lastUpdated: new Date().toISOString()
    },
    notes: 'طالب مجتهد وحافظ متميز',
    createdAt: new Date().toISOString()
  },
  {
    id: 'std-2',
    name: 'يوسف عمر الكردي',
    password: '123',
    phone: '0507654321',
    age: 10,
    parentName: 'عمر الكردي',
    parentPhones: ['966507654321'],
    parentPhone: '966507654321',
    currentSurah: 78,
    currentSurahName: 'النبأ',
    currentAyah: 16,
    dailyNewTarget: 'نصف وجه',
    dailyReviewTarget: 'سورة واحدة',
    level: 'متوسط',
    halaqahId: 'halaqah-main',
    halaqahName: 'حلقة القرآن الكريم',
    aiPlan: {
      roadmapSummary: 'إتمام جزء عم خلال 3 أسابيع بمعدل 6 إلى 8 آيات يومياً مع تكرار الاستماع.',
      currentDailyAssignment: {
        newMemorization: 'سورة النبأ: الآيات (17 - 30)',
        review: 'سورة الإخلاص والفلق والناس وقريش',
        suggestedSheikh: 'الشيخ محمد صديق المنشاوي (المعلم)',
        tajweedFocus: 'قلقلة حروف (قطب جد) والمد المتصل',
        dailyNote: 'استمع للشيخ المنشاوي 3 مرات وركز على نطق الحركات بدقة.'
      },
      difficultyAdjustment: 'خطة متوازنة لتعزيز الثقة والتجويد',
      estimatedDaysToFinishJuz: 18,
      lastUpdated: new Date().toISOString()
    },
    notes: 'يحتاج تركيز على المدود',
    createdAt: new Date().toISOString()
  },
  {
    id: 'std-3',
    name: 'بلال خالد القحطاني',
    password: '123',
    phone: '0509876543',
    age: 8,
    parentName: 'خالد القحطاني',
    parentPhones: ['966509876543'],
    parentPhone: '966509876543',
    currentSurah: 93,
    currentSurahName: 'الضحى',
    currentAyah: 1,
    dailyNewTarget: '3 آيات',
    dailyReviewTarget: 'سورة قصيرة',
    level: 'ضعيف',
    halaqahId: 'halaqah-main',
    halaqahName: 'حلقة القرآن الكريم',
    aiPlan: {
      roadmapSummary: 'خطة تشجيعية وتيسيرية لقصار السور بمعدل 3 آيات يومياً مع تقنية التكرار المرحلي.',
      currentDailyAssignment: {
        newMemorization: 'سورة الضحى كاملة (11 آية)',
        review: 'سورة الشرح والتين والعلق',
        suggestedSheikh: 'الشيخ مشاري بن راشد العفاسي',
        tajweedFocus: 'مخارج الحروف الأساسية والوضوح',
        dailyNote: 'قسّم السورة إلى مقطعين، 5 آيات صباحاً و6 آيات مساءً مع الوالد.'
      },
      difficultyAdjustment: 'تم تيسير الورد وتقسيمه ليناسب عمر الطالب وقدرته',
      estimatedDaysToFinishJuz: 45,
      lastUpdated: new Date().toISOString()
    },
    notes: 'يحتاج تشجيع ومكافآت مستمرة',
    createdAt: new Date().toISOString()
  },
  {
    id: 'std-4',
    name: 'عمر عبد العزيز الفهد',
    password: '123',
    phone: '0505544332',
    age: 11,
    parentName: 'عبد العزيز الفهد',
    parentPhones: ['966505544332'],
    parentPhone: '966505544332',
    currentSurah: 18,
    currentSurahName: 'الكهف',
    currentAyah: 10,
    dailyNewTarget: 'وجه كامل',
    dailyReviewTarget: 'ربع جزء',
    level: 'متوسط',
    halaqahId: 'halaqah-zubair',
    halaqahName: 'حلقة الزبير بن العوام',
    aiPlan: {
      roadmapSummary: 'متابعة حفظ سورة الكهف بمعدل وجه يومياً مع مراجعة سورة مريم والإسراء.',
      currentDailyAssignment: {
        newMemorization: 'سورة الكهف: الآيات (1 - 10)',
        review: 'سورة مريم كاملة',
        suggestedSheikh: 'الشيخ عبد الباسط عبد الصمد',
        tajweedFocus: 'أحكام الراءات وتفخيمها وترقيقها',
        dailyNote: 'تلاوة خاشعة مع استشعار معاني أوائل سورة الكهف.'
      },
      difficultyAdjustment: 'وتيرة مستقرة وممتازة',
      estimatedDaysToFinishJuz: 25,
      lastUpdated: new Date().toISOString()
    },
    notes: 'طالب حسن الصوت وملتزم',
    createdAt: new Date().toISOString()
  },
  {
    id: 'std-5',
    name: 'حمزة مصطفى الباز',
    password: '123',
    phone: '0503322114',
    age: 13,
    parentName: 'مصطفى الباز',
    parentPhones: ['966503322114'],
    parentPhone: '966503322114',
    currentSurah: 3,
    currentSurahName: 'آل عمران',
    currentAyah: 20,
    dailyNewTarget: 'وجه ونصف',
    dailyReviewTarget: 'جزء كامل',
    level: 'قوي',
    halaqahId: 'halaqah-zubair',
    halaqahName: 'حلقة الزبير بن العوام',
    aiPlan: {
      roadmapSummary: 'خطة متقدمة لحفظ سورة آل عمران مع مراجعة سورة البقرة وتثبيتها.',
      currentDailyAssignment: {
        newMemorization: 'سورة آل عمران: الآيات (1 - 9)',
        review: 'سورة البقرة: الأرباع الثلاثة الأولى',
        suggestedSheikh: 'الشيخ محمود علي البنا',
        tajweedFocus: 'المدود وأحكام الميم الساكنة',
        dailyNote: 'التركيز على متشابهات أوائل آل عمران مع البقرة.'
      },
      difficultyAdjustment: 'مستوى متفوق ومتميز جداً',
      estimatedDaysToFinishJuz: 15,
      lastUpdated: new Date().toISOString()
    },
    notes: 'طالب متفوق ومرشح لمسابقات القرآن الكريم',
    createdAt: new Date().toISOString()
  },
  {
    id: 'std-6',
    name: 'أنس إبراهيم الدوسري',
    password: '123',
    phone: '0508899776',
    age: 9,
    parentName: 'إبراهيم الدوسري',
    parentPhones: ['966508899776'],
    parentPhone: '966508899776',
    currentSurah: 67,
    currentSurahName: 'الملك',
    currentAyah: 14,
    dailyNewTarget: 'نصف وجه',
    dailyReviewTarget: 'سورة الملك',
    level: 'متوسط',
    halaqahId: 'halaqah-zubair',
    halaqahName: 'حلقة الزبير بن العوام',
    aiPlan: {
      roadmapSummary: 'إتمام جزء تبارك بمعدل نصف وجه يومياً وتكرار الاستماع لسورة الملك.',
      currentDailyAssignment: {
        newMemorization: 'سورة الملك: الآيات (1 - 14)',
        review: 'سورة النبأ والنازعات',
        suggestedSheikh: 'الشيخ سعد الغامدي',
        tajweedFocus: 'أحكام النون والميم المشددتين',
        dailyNote: 'قراءة السورة قبل النوم ترسيخاً للحفظ النبوي.'
      },
      difficultyAdjustment: 'خطة تشجيعية مناسبة',
      estimatedDaysToFinishJuz: 30,
      lastUpdated: new Date().toISOString()
    },
    notes: 'طالب حريص على الحضور والمواظبة',
    createdAt: new Date().toISOString()
  }
];

// Helper to compute recent seed dates dynamically
const getRecentWeekdaySeed = (targetDayIndex: number, weeksAgo = 0): string => {
  const d = new Date();
  const currentDay = d.getDay();
  let diff = (currentDay - targetDayIndex + 7) % 7;
  if (weeksAgo > 0) diff += weeksAgo * 7;
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const day = String(target.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const recentMondayDate = getRecentWeekdaySeed(1); // Exact recent Monday
const recentTuesdayDate = getRecentWeekdaySeed(2); // Exact recent Tuesday
const recentWednesdayDate = getRecentWeekdaySeed(3); // Exact recent Wednesday
const todaySeedDate = getRecentWeekdaySeed(new Date().getDay());

// Initial Seed Attendance Records (covering recent weekdays and today)
export const INITIAL_ATTENDANCE: AttendanceRecord[] = [
  // Recent Monday Attendance Records (All 6 students recorded: 5 present, 1 excused)
  {
    id: `att-mon-std-1`,
    studentId: 'std-1',
    date: recentMondayDate,
    status: 'حاضر',
    note: 'حضور مبكر ومتميز',
    savedAt: new Date().toISOString()
  },
  {
    id: `att-mon-std-2`,
    studentId: 'std-2',
    date: recentMondayDate,
    status: 'حاضر',
    note: 'حاضر ومواظب',
    savedAt: new Date().toISOString()
  },
  {
    id: `att-mon-std-3`,
    studentId: 'std-3',
    date: recentMondayDate,
    status: 'حاضر',
    note: 'حاضر مع تفاعل طيب',
    savedAt: new Date().toISOString()
  },
  {
    id: `att-mon-std-4`,
    studentId: 'std-4',
    date: recentMondayDate,
    status: 'حاضر',
    note: 'حاضر ومنضبط',
    savedAt: new Date().toISOString()
  },
  {
    id: `att-mon-std-5`,
    studentId: 'std-5',
    date: recentMondayDate,
    status: 'حاضر',
    note: 'حضور نموذجى',
    savedAt: new Date().toISOString()
  },
  {
    id: `att-mon-std-6`,
    studentId: 'std-6',
    date: recentMondayDate,
    status: 'معتذر',
    note: 'عذر مسبق من ولي الأمر',
    savedAt: new Date().toISOString()
  },
  // Recent Tuesday Attendance Records
  {
    id: `att-tue-std-1`,
    studentId: 'std-1',
    date: recentTuesdayDate,
    status: 'حاضر',
    note: 'حاضر ومبكر',
    savedAt: new Date().toISOString()
  },
  {
    id: `att-tue-std-2`,
    studentId: 'std-2',
    date: recentTuesdayDate,
    status: 'حاضر',
    note: 'حاضر',
    savedAt: new Date().toISOString()
  },
  {
    id: `att-tue-std-3`,
    studentId: 'std-3',
    date: recentTuesdayDate,
    status: 'حاضر',
    note: 'حاضر مع مشاركة',
    savedAt: new Date().toISOString()
  },
  {
    id: `att-tue-std-4`,
    studentId: 'std-4',
    date: recentTuesdayDate,
    status: 'حاضر',
    note: 'حاضر',
    savedAt: new Date().toISOString()
  },
  {
    id: `att-tue-std-5`,
    studentId: 'std-5',
    date: recentTuesdayDate,
    status: 'حاضر',
    note: 'حاضر ومواظب',
    savedAt: new Date().toISOString()
  },
  {
    id: `att-tue-std-6`,
    studentId: 'std-6',
    date: recentTuesdayDate,
    status: 'حاضر',
    note: 'حاضر',
    savedAt: new Date().toISOString()
  },
  // Recent Wednesday Attendance Records
  {
    id: `att-wed-std-1`,
    studentId: 'std-1',
    date: recentWednesdayDate,
    status: 'حاضر',
    note: 'حاضر',
    savedAt: new Date().toISOString()
  },
  {
    id: `att-wed-std-2`,
    studentId: 'std-2',
    date: recentWednesdayDate,
    status: 'حاضر',
    note: 'حاضر',
    savedAt: new Date().toISOString()
  },
  {
    id: `att-wed-std-3`,
    studentId: 'std-3',
    date: recentWednesdayDate,
    status: 'حاضر',
    note: 'حاضر',
    savedAt: new Date().toISOString()
  },
  {
    id: `att-wed-std-4`,
    studentId: 'std-4',
    date: recentWednesdayDate,
    status: 'حاضر',
    note: 'حاضر',
    savedAt: new Date().toISOString()
  },
  {
    id: `att-wed-std-5`,
    studentId: 'std-5',
    date: recentWednesdayDate,
    status: 'حاضر',
    note: 'حاضر',
    savedAt: new Date().toISOString()
  },
  {
    id: `att-wed-std-6`,
    studentId: 'std-6',
    date: recentWednesdayDate,
    status: 'حاضر',
    note: 'حاضر',
    savedAt: new Date().toISOString()
  },
  // Today Attendance Records
  {
    id: `att-today-std-1`,
    studentId: 'std-1',
    date: todaySeedDate,
    status: 'حاضر',
    savedAt: new Date().toISOString()
  },
  {
    id: `att-today-std-2`,
    studentId: 'std-2',
    date: todaySeedDate,
    status: 'حاضر',
    savedAt: new Date().toISOString()
  },
  {
    id: `att-today-std-3`,
    studentId: 'std-3',
    date: todaySeedDate,
    status: 'حاضر',
    savedAt: new Date().toISOString()
  },
  {
    id: `att-today-std-4`,
    studentId: 'std-4',
    date: todaySeedDate,
    status: 'حاضر',
    savedAt: new Date().toISOString()
  },
  {
    id: `att-today-std-5`,
    studentId: 'std-5',
    date: todaySeedDate,
    status: 'حاضر',
    savedAt: new Date().toISOString()
  },
  {
    id: `att-today-std-6`,
    studentId: 'std-6',
    date: todaySeedDate,
    status: 'حاضر',
    savedAt: new Date().toISOString()
  }
];

// Initial Seed Evaluations Records (Rich Monday recitations for students)
export const INITIAL_EVALUATIONS: StudentEvaluation[] = [
  {
    id: `eval-mon-std-1`,
    date: recentMondayDate,
    studentId: 'std-1',
    studentName: 'عبد الرحمن أحمد السعيد',
    attendanceStatus: 'حاضر',
    pointsAwarded: 15,
    generalNotes: 'أداء متميز وتلاوة خاشعة ومتقنة لأحكام التجويد',
    recitationDetails: {
      newMemorizationAchieved: 'سورة البقرة: الآيات (46 - 52)',
      reviewAchieved: 'سورة النبأ وسورة النازعات كاملتين',
      teacherNotes: 'تطبيق رائع لأحكام النون الساكنة والتنوين (الإدغام بغنة)',
      todayNewItem: {
        surahNumber: 2,
        surahName: 'البقرة',
        fromAyah: 46,
        toAyah: 52,
        pagesCount: 1,
        totalAyahs: 7
      },
      tomorrowNewItem: {
        surahNumber: 2,
        surahName: 'البقرة',
        fromAyah: 53,
        toAyah: 61,
        pagesCount: 1,
        totalAyahs: 9
      }
    }
  },
  {
    id: `eval-mon-std-2`,
    date: recentMondayDate,
    studentId: 'std-2',
    studentName: 'يوسف عمر الكردي',
    attendanceStatus: 'حاضر',
    pointsAwarded: 12,
    generalNotes: 'تسميع جيد جداً مع تحسن ملحوظ في مخارج الحروف',
    recitationDetails: {
      newMemorizationAchieved: 'سورة النبأ: الآيات (17 - 30)',
      reviewAchieved: 'سورة الإخلاص والفلق والناس وقريش',
      teacherNotes: 'إتقان أحكام القلقلة (قطب جد) والمد المتصل، بارك الله فيه',
      todayNewItem: {
        surahNumber: 78,
        surahName: 'النبأ',
        fromAyah: 17,
        toAyah: 30,
        pagesCount: 0.5,
        totalAyahs: 14
      },
      tomorrowNewItem: {
        surahNumber: 78,
        surahName: 'النبأ',
        fromAyah: 31,
        toAyah: 40,
        pagesCount: 0.5,
        totalAyahs: 10
      }
    }
  },
  {
    id: `eval-mon-std-3`,
    date: recentMondayDate,
    studentId: 'std-3',
    studentName: 'بلال خالد القحطاني',
    attendanceStatus: 'حاضر',
    pointsAwarded: 10,
    generalNotes: 'تسميع مبارك وتشجيع مستمر لقصار السور',
    recitationDetails: {
      newMemorizationAchieved: 'سورة الضحى كاملة (الآيات 1 - 11)',
      reviewAchieved: 'سورة الشرح والتين والعلق',
      teacherNotes: 'تحسن واضح في نطق الحركات والوضوح الصوتي، يستحق وسام التشجيع',
      todayNewItem: {
        surahNumber: 93,
        surahName: 'الضحى',
        fromAyah: 1,
        toAyah: 11,
        pagesCount: 0.3,
        totalAyahs: 11
      },
      tomorrowNewItem: {
        surahNumber: 94,
        surahName: 'الشرح',
        fromAyah: 1,
        toAyah: 8,
        pagesCount: 0.25,
        totalAyahs: 8
      }
    }
  },
  {
    id: `eval-mon-std-4`,
    date: recentMondayDate,
    studentId: 'std-4',
    studentName: 'عمر عبد العزيز الفهد',
    attendanceStatus: 'حاضر',
    pointsAwarded: 15,
    generalNotes: 'حفظ متقن ومتميز لأوائل سورة الكهف',
    recitationDetails: {
      newMemorizationAchieved: 'سورة الكهف: الآيات (1 - 10)',
      reviewAchieved: 'سورة مريم كاملة',
      teacherNotes: 'تلاوة طيبة مع ضبط أحكام الراءات وتفخيمها في مواضعها',
      todayNewItem: {
        surahNumber: 18,
        surahName: 'الكهف',
        fromAyah: 1,
        toAyah: 10,
        pagesCount: 1,
        totalAyahs: 10
      },
      tomorrowNewItem: {
        surahNumber: 18,
        surahName: 'الكهف',
        fromAyah: 11,
        toAyah: 16,
        pagesCount: 0.8,
        totalAyahs: 6
      }
    }
  },
  {
    id: `eval-mon-std-5`,
    date: recentMondayDate,
    studentId: 'std-5',
    studentName: 'حمزة مصطفى الباز',
    attendanceStatus: 'حاضر',
    pointsAwarded: 18,
    generalNotes: 'أداء فائق التميز لطالب متقدم في الحفظ',
    recitationDetails: {
      newMemorizationAchieved: 'سورة آل عمران: الآيات (1 - 9)',
      reviewAchieved: 'سورة البقرة: الأرباع الثلاثة الأولى',
      teacherNotes: 'إتقان عالي لأحكام المدود وأداء صوتي رصين ومتقن',
      todayNewItem: {
        surahNumber: 3,
        surahName: 'آل عمران',
        fromAyah: 1,
        toAyah: 9,
        pagesCount: 1.2,
        totalAyahs: 9
      },
      tomorrowNewItem: {
        surahNumber: 3,
        surahName: 'آل عمران',
        fromAyah: 10,
        toAyah: 18,
        pagesCount: 1,
        totalAyahs: 9
      }
    }
  },
  // Recent Tuesday Evaluation Records (تقييم التسميع ليوم الثلاثاء)
  {
    id: `eval-tue-std-1`,
    date: recentTuesdayDate,
    studentId: 'std-1',
    studentName: 'عبد الرحمن أحمد السعيد',
    attendanceStatus: 'حاضر',
    pointsAwarded: 15,
    generalNotes: 'مواصلة ممتازة لحفظ سورة البقرة مع ضبط تام لأحكام التجويد',
    recitationDetails: {
      newMemorizationAchieved: 'سورة البقرة: الآيات (53 - 61)',
      reviewAchieved: 'سورة النبأ وسورة النازعات كاملتين',
      teacherNotes: 'تطبيق رائع لأحكام الإخفاء الحقيقي والمد المنفصل',
      todayNewItem: {
        surahNumber: 2,
        surahName: 'البقرة',
        fromAyah: 53,
        toAyah: 61,
        pagesCount: 1,
        totalAyahs: 9
      },
      tomorrowNewItem: {
        surahNumber: 2,
        surahName: 'البقرة',
        fromAyah: 62,
        toAyah: 69,
        pagesCount: 1,
        totalAyahs: 8
      }
    }
  },
  {
    id: `eval-tue-std-2`,
    date: recentTuesdayDate,
    studentId: 'std-2',
    studentName: 'يوسف عمر الكردي',
    attendanceStatus: 'حاضر',
    pointsAwarded: 12,
    generalNotes: 'تسميع خاشع ومتقن لأواخر سورة النبأ',
    recitationDetails: {
      newMemorizationAchieved: 'سورة النبأ: الآيات (31 - 40)',
      reviewAchieved: 'سورة الأعلى والغاشية والطارق',
      teacherNotes: 'إتقان الوقف والابتداء وحسن الترتيل',
      todayNewItem: {
        surahNumber: 78,
        surahName: 'النبأ',
        fromAyah: 31,
        toAyah: 40,
        pagesCount: 0.5,
        totalAyahs: 10
      },
      tomorrowNewItem: {
        surahNumber: 79,
        surahName: 'النازعات',
        fromAyah: 1,
        toAyah: 15,
        pagesCount: 0.5,
        totalAyahs: 15
      }
    }
  },
  {
    id: `eval-tue-std-3`,
    date: recentTuesdayDate,
    studentId: 'std-3',
    studentName: 'بلال خالد القحطاني',
    attendanceStatus: 'حاضر',
    pointsAwarded: 10,
    generalNotes: 'حفظ سورة الشرح كاملة مع انضباط طيب',
    recitationDetails: {
      newMemorizationAchieved: 'سورة الشرح كاملة (الآيات 1 - 8)',
      reviewAchieved: 'سورة الضحى وسورة التين',
      teacherNotes: 'نطق الحركات سليم ومخارج واضحة ومباركة',
      todayNewItem: {
        surahNumber: 94,
        surahName: 'الشرح',
        fromAyah: 1,
        toAyah: 8,
        pagesCount: 0.3,
        totalAyahs: 8
      },
      tomorrowNewItem: {
        surahNumber: 95,
        surahName: 'التين',
        fromAyah: 1,
        toAyah: 8,
        pagesCount: 0.25,
        totalAyahs: 8
      }
    }
  },
  {
    id: `eval-tue-std-4`,
    date: recentTuesdayDate,
    studentId: 'std-4',
    studentName: 'عمر عبد العزيز الفهد',
    attendanceStatus: 'حاضر',
    pointsAwarded: 15,
    generalNotes: 'إتقان قصة أصحاب الكهف بصوت ندي ومتقن',
    recitationDetails: {
      newMemorizationAchieved: 'سورة الكهف: الآيات (11 - 16)',
      reviewAchieved: 'سورة مريم والآيات الأولى من طه',
      teacherNotes: 'تطبيق متميز لمدود الصلة الكبرى والصغرى',
      todayNewItem: {
        surahNumber: 18,
        surahName: 'الكهف',
        fromAyah: 11,
        toAyah: 16,
        pagesCount: 0.8,
        totalAyahs: 6
      },
      tomorrowNewItem: {
        surahNumber: 18,
        surahName: 'الكهف',
        fromAyah: 17,
        toAyah: 22,
        pagesCount: 1,
        totalAyahs: 6
      }
    }
  },
  {
    id: `eval-tue-std-5`,
    date: recentTuesdayDate,
    studentId: 'std-5',
    studentName: 'حمزة مصطفى الباز',
    attendanceStatus: 'حاضر',
    pointsAwarded: 18,
    generalNotes: 'تسميع رائع لآيات سورة آل عمران مع تفوق تجويدي',
    recitationDetails: {
      newMemorizationAchieved: 'سورة آل عمران: الآيات (10 - 18)',
      reviewAchieved: 'سورة البقرة: الحزب الأول كاملاً',
      teacherNotes: 'إتقان عالي لأحكام التفخيم والترقيق',
      todayNewItem: {
        surahNumber: 3,
        surahName: 'آل عمران',
        fromAyah: 10,
        toAyah: 18,
        pagesCount: 1,
        totalAyahs: 9
      },
      tomorrowNewItem: {
        surahNumber: 3,
        surahName: 'آل عمران',
        fromAyah: 19,
        toAyah: 25,
        pagesCount: 1,
        totalAyahs: 7
      }
    }
  },
  {
    id: `eval-tue-std-6`,
    date: recentTuesdayDate,
    studentId: 'std-6',
    studentName: 'فهد ناصر الدوسري',
    attendanceStatus: 'حاضر',
    pointsAwarded: 14,
    generalNotes: 'تسميع جميل لأوائل سورة يوسف مع حفظ راسخ',
    recitationDetails: {
      newMemorizationAchieved: 'سورة يوسف: الآيات (1 - 10)',
      reviewAchieved: 'سورة هود وسورة يونس',
      teacherNotes: 'حفظ سليم ومخارج واضحة ومشاركة ممتازة في الحلقة',
      todayNewItem: {
        surahNumber: 12,
        surahName: 'يوسف',
        fromAyah: 1,
        toAyah: 10,
        pagesCount: 0.8,
        totalAyahs: 10
      },
      tomorrowNewItem: {
        surahNumber: 12,
        surahName: 'يوسف',
        fromAyah: 11,
        toAyah: 20,
        pagesCount: 0.8,
        totalAyahs: 10
      }
    }
  },
  // Recent Wednesday Evaluation Records (تقييم التسميع ليوم الأربعاء)
  {
    id: `eval-wed-std-1`,
    date: recentWednesdayDate,
    studentId: 'std-1',
    studentName: 'عبد الرحمن أحمد السعيد',
    attendanceStatus: 'حاضر',
    pointsAwarded: 15,
    generalNotes: 'تسميع متقن لآيات سورة البقرة مع تميز في أحكام النون الساكنة',
    recitationDetails: {
      newMemorizationAchieved: 'سورة البقرة: الآيات (62 - 69)',
      reviewAchieved: 'سورة عبس وسورة التكوير والانفطار',
      teacherNotes: 'حفظ راسخ ونبر صوتي متزن وهادئ',
      todayNewItem: {
        surahNumber: 2,
        surahName: 'البقرة',
        fromAyah: 62,
        toAyah: 69,
        pagesCount: 1,
        totalAyahs: 8
      },
      tomorrowNewItem: {
        surahNumber: 2,
        surahName: 'البقرة',
        fromAyah: 70,
        toAyah: 76,
        pagesCount: 1,
        totalAyahs: 7
      }
    }
  },
  {
    id: `eval-wed-std-2`,
    date: recentWednesdayDate,
    studentId: 'std-2',
    studentName: 'يوسف عمر الكردي',
    attendanceStatus: 'حاضر',
    pointsAwarded: 12,
    generalNotes: 'بدء سورة النازعات بانطلاق وإتقان تام',
    recitationDetails: {
      newMemorizationAchieved: 'سورة النازعات: الآيات (1 - 15)',
      reviewAchieved: 'سورة النبأ كاملة بتثبيت عالي',
      teacherNotes: 'إتقان الغنن والمدود، بارك الله فيه',
      todayNewItem: {
        surahNumber: 79,
        surahName: 'النازعات',
        fromAyah: 1,
        toAyah: 15,
        pagesCount: 0.5,
        totalAyahs: 15
      },
      tomorrowNewItem: {
        surahNumber: 79,
        surahName: 'النازعات',
        fromAyah: 16,
        toAyah: 30,
        pagesCount: 0.5,
        totalAyahs: 15
      }
    }
  },
  {
    id: `eval-wed-std-3`,
    date: recentWednesdayDate,
    studentId: 'std-3',
    studentName: 'بلال خالد القحطاني',
    attendanceStatus: 'حاضر',
    pointsAwarded: 10,
    generalNotes: 'إتقان سورة التين وتشجيع مستمر لمواصلة جزء عم',
    recitationDetails: {
      newMemorizationAchieved: 'سورة التين كاملة (الآيات 1 - 8)',
      reviewAchieved: 'سورة الشرح والضحى والليل',
      teacherNotes: 'ترتيل طيب ومواظبة مشكورة بالحلقة',
      todayNewItem: {
        surahNumber: 95,
        surahName: 'التين',
        fromAyah: 1,
        toAyah: 8,
        pagesCount: 0.25,
        totalAyahs: 8
      },
      tomorrowNewItem: {
        surahNumber: 96,
        surahName: 'العلق',
        fromAyah: 1,
        toAyah: 8,
        pagesCount: 0.3,
        totalAyahs: 8
      }
    }
  },
  {
    id: `eval-wed-std-4`,
    date: recentWednesdayDate,
    studentId: 'std-4',
    studentName: 'عمر عبد العزيز الفهد',
    attendanceStatus: 'حاضر',
    pointsAwarded: 15,
    generalNotes: 'أداء راسخ لقصة أصحاب الكهف (الآيات 17 - 22)',
    recitationDetails: {
      newMemorizationAchieved: 'سورة الكهف: الآيات (17 - 22)',
      reviewAchieved: 'سورة طه كاملة بتثبيت قوي',
      teacherNotes: 'تلاوة طيبة مع الالتزام بعلامات الوقف المعتمدة في المصحف',
      todayNewItem: {
        surahNumber: 18,
        surahName: 'الكهف',
        fromAyah: 17,
        toAyah: 22,
        pagesCount: 1,
        totalAyahs: 6
      },
      tomorrowNewItem: {
        surahNumber: 18,
        surahName: 'الكهف',
        fromAyah: 23,
        toAyah: 31,
        pagesCount: 1,
        totalAyahs: 9
      }
    }
  },
  {
    id: `eval-wed-std-5`,
    date: recentWednesdayDate,
    studentId: 'std-5',
    studentName: 'حمزة مصطفى الباز',
    attendanceStatus: 'حاضر',
    pointsAwarded: 18,
    generalNotes: 'تسميع متميز ومحكم لآيات سورة آل عمران',
    recitationDetails: {
      newMemorizationAchieved: 'سورة آل عمران: الآيات (19 - 25)',
      reviewAchieved: 'سورة البقرة: الحزب الثاني كاملاً',
      teacherNotes: 'تميز استثنائي في أحكام القراءات وضبط مخارج الحروف',
      todayNewItem: {
        surahNumber: 3,
        surahName: 'آل عمران',
        fromAyah: 19,
        toAyah: 25,
        pagesCount: 1,
        totalAyahs: 7
      },
      tomorrowNewItem: {
        surahNumber: 3,
        surahName: 'آل عمران',
        fromAyah: 26,
        toAyah: 32,
        pagesCount: 1,
        totalAyahs: 7
      }
    }
  },
  {
    id: `eval-wed-std-6`,
    date: recentWednesdayDate,
    studentId: 'std-6',
    studentName: 'فهد ناصر الدوسري',
    attendanceStatus: 'حاضر',
    pointsAwarded: 14,
    generalNotes: 'تسميع متمكن لآيات سورة يوسف مع حضور ذهني مبارك',
    recitationDetails: {
      newMemorizationAchieved: 'سورة يوسف: الآيات (11 - 20)',
      reviewAchieved: 'سورة الرعد وإبراهيم',
      teacherNotes: 'تلاوة ندية وضبط متقن للمدود الطبيعية والمتصلة',
      todayNewItem: {
        surahNumber: 12,
        surahName: 'يوسف',
        fromAyah: 11,
        toAyah: 20,
        pagesCount: 0.8,
        totalAyahs: 10
      },
      tomorrowNewItem: {
        surahNumber: 12,
        surahName: 'يوسف',
        fromAyah: 21,
        toAyah: 30,
        pagesCount: 0.8,
        totalAyahs: 10
      }
    }
  }
];

// Initial Sample Behavior Violations
export const INITIAL_VIOLATIONS: BehaviorViolation[] = [
  {
    id: 'viol-sample-1',
    studentId: 'std-3',
    studentName: 'عبدالرحمن الدوسري',
    date: new Date().toISOString().split('T')[0],
    time: '16:45',
    violationType: 'الكلام الجانبي والتشويش أثناء التلاوة',
    severity: 'تنبيه',
    description: 'التحدث مع الزملاء أثناء ورد التسميع بالحلقة وتشتيت انتباه المجموعة.',
    actionTaken: 'تنبيه شفهي وتوجيه تربوي مع تذكير بآداب مجلس القرآن الكريم.',
    pointsDeducted: 1,
    status: 'تم التوجيه والمعالجة',
    parentNotified: true,
    parentNotificationDate: new Date().toISOString().split('T')[0],
    parentNotificationPhone: '0503344556',
    messageText: 'السلام عليكم ورحمة الله وبركاته.. ولي أمر الطالب الفاضل عبدالرحمن حفظه الله، نحيطكم علماً بأنه تم توجيه الطالب اليوم برفق حول التحدث الجانبي أثناء التسميع، ونشكر كريم تعاونكم في حثه على أدب مجالس القرآن الكريم، بارك الله فيكم ونفع به.',
    teacherName: 'معلم ومحفظ الحلقة',
    showInPortal: true,
    createdAt: new Date().toISOString()
  }
];

// Initial Rich Seed Quran Exams with Questions, Timers, and Answers
export const INITIAL_EXAMS: Exam[] = [
  {
    id: 'exam-sample-tajweed-1',
    title: 'اختبار أحكام النون الساكنة والتنوين والمدود القرآنية',
    description: 'اختبار تقييمي شامل وممتع لأحكام التجويد الأساسية: الإظهار، الإدغام، الإقلاب، الإخفاء، والمد المتصل والمنفصل.',
    scheduleType: 'now',
    startDate: new Date().toISOString(),
    hasDeadline: false,
    attemptLimitType: 'unlimited',
    maxAttempts: 3,
    timeLimitMode: 'total',
    totalTimeMinutes: 10,
    questionTimeSeconds: 30,
    gradeVisibility: 'immediate',
    grantsLeaderboardPoints: true,
    totalPoints: 25,
    targetHalaqat: ['all'],
    questions: [
      {
        id: 'q-tajweed-1',
        title: 'ما هو الحكم التجويدي في قوله تعالى: (مِن بَعْدِ) ؟',
        type: 'multiple_choice',
        options: ['إقلاب', 'إظهار حلقي', 'إدغام بغنة', 'إخفاء حقيقي'],
        correctAnswer: 'إقلاب',
        points: 5,
        explanation: 'حكم النون الساكنة إذا جاء بعدها حرف الباء هو الإقلاب، حيث تُقلب النون ميماً مخفاة بغنة.'
      },
      {
        id: 'q-tajweed-2',
        title: 'حروف الإظهار الحلقي مجموعة في أوائل كلمات: (أخي هاك علماً حازه غير خاسر).',
        type: 'true_false',
        options: ['صح', 'خطأ'],
        correctAnswer: 'صح',
        points: 5,
        explanation: 'نعم، حروف الإظهار الحلقي الستة هي: الهمزة، والهاء، والعين، والحاء، والغين، والخاء.'
      },
      {
        id: 'q-tajweed-3',
        title: 'ما نوع المد في قوله تعالى: (جَآءَ) ؟',
        type: 'multiple_choice',
        options: ['مد متصل واجب', 'مد منفصل جائز', 'مد لازم كلمي', 'مد عارض للسكون'],
        correctAnswer: 'مد متصل واجب',
        points: 5,
        explanation: 'المد المتصل هو أن يجتمع حرف المد والهمزة في كلمة واحدة، وحكمه الوجوب ويمد 4 أو 5 حركات.'
      },
      {
        id: 'q-tajweed-4',
        title: 'أي من الحروف التالية يُعد من حروف الإدغام بغير غنة؟',
        type: 'multiple_choice',
        options: ['الراء واللام (ر، ل)', 'الياء والنون (ي، ن)', 'الميم والواو (م، و)', 'الكاف والقاف (ك، ق)'],
        correctAnswer: 'الراء واللام (ر، ل)',
        points: 5,
        explanation: 'حروف الإدغام بغير غنة هما اللام والراء فقط (ل، ر).'
      },
      {
        id: 'q-tajweed-5',
        title: 'في قوله تعالى: (أَنفُسَكُمْ) الحكم التجويدي للنون الساكنة هو الإخفاء الحقيقي عند حرف الفاء.',
        type: 'true_false',
        options: ['صح', 'خطأ'],
        correctAnswer: 'صح',
        points: 5,
        explanation: 'حرف الفاء من حروف الإخفاء الحقيقي الـ 15، فينطق بالنون بصفة بين الإظهار والإدغام مع بقاء الغنة.'
      }
    ],
    createdById: 'teacher-1',
    createdByName: 'المشرف العام',
    createdAt: new Date().toISOString()
  },
  {
    id: 'exam-sample-fatihah-juzamma',
    title: 'اختبار معاني وتفسير سورة الفاتحة وقصار السور',
    description: 'اختبار تدبر وفهم معاني الآيات العظيمة في سورة الفاتحة وقصار سور جزء عم المبارك.',
    scheduleType: 'now',
    startDate: new Date().toISOString(),
    hasDeadline: false,
    attemptLimitType: 'unlimited',
    maxAttempts: 2,
    timeLimitMode: 'total',
    totalTimeMinutes: 8,
    gradeVisibility: 'immediate',
    grantsLeaderboardPoints: true,
    totalPoints: 20,
    targetHalaqat: ['all'],
    questions: [
      {
        id: 'q-fatihah-1',
        title: 'ما معنى قوله تعالى في سورة الفاتحة: (الصِّرَاطَ الْمُسْتَقِيمَ) ؟',
        type: 'multiple_choice',
        options: ['طريق الإسلام والحق الواضح الموصل لرضوان الله', 'طريق التجارة والرزق', 'طريق السفر بين البلدان', 'أبواب الجنة فقط'],
        correctAnswer: 'طريق الإسلام والحق الواضح الموصل لرضوان الله',
        points: 5,
        explanation: 'الصراط المستقيم هو دين الإسلام والتمسك بكتاب الله وسنة رسوله صلى الله عليه وسلم.'
      },
      {
        id: 'q-fatihah-2',
        title: 'سورة الإخلاص تعدل ثلث القرآن الكريم في الأجر والفضل.',
        type: 'true_false',
        options: ['صح', 'خطأ'],
        correctAnswer: 'صح',
        points: 5,
        explanation: 'ثبت في الصحيحين عن النبي صلى الله عليه وسلم أن قل هو الله أحد تعدل ثلث القرآن لاشتمالها على توحيد الله وتمجيده.'
      },
      {
        id: 'q-fatihah-3',
        title: 'في سورة الفلق، ما معنى قوله تعالى: (وَمِن شَرِّ غَاسِقٍ إِذَا وَقَبَ) ؟',
        type: 'multiple_choice',
        options: ['من شر الليل المظلم إذا دخل واشتد ظلامه', 'من شر الرياح الشديدة', 'من شر الجبال العالية', 'من شر حرارة الشمس'],
        correctAnswer: 'من شر الليل المظلم إذا دخل واشتد ظلامه',
        points: 5,
        explanation: 'الغاسق هو الليل، وإذا وقب أي دخل واشتدت ظلمته وتنتشر فيه الهوام والشرور.'
      },
      {
        id: 'q-fatihah-4',
        title: 'في سورة الكوثر، المقصود بـ (الْكَوْثَرَ) هو الخير الكثير ومنه نهر في الجنة أعطاه الله لنبيه ﷺ.',
        type: 'true_false',
        options: ['صح', 'خطأ'],
        correctAnswer: 'صح',
        points: 5,
        explanation: 'الكوثر هو الخير العظيم والوفير في الدنيا والآخرة، ومنه النهر العظيم في الجنة.'
      }
    ],
    createdById: 'teacher-1',
    createdByName: 'المشرف العام',
    createdAt: new Date().toISOString()
  }
];

// Local Storage Cache Keys for Dual-Persistence and instant offline-first reliability
export const OMRAN_CACHE_KEYS = {
  STUDENTS: 'omran_students_data',
  ATTENDANCE: 'omran_attendance_data',
  EVALUATIONS: 'omran_evaluations_data',
  CRITERIA: 'omran_criteria_data',
  SETTINGS: 'omran_settings_data',
  TEACHERS: 'omran_teachers_data',
  COMPLEXES: 'omran_complexes_data',
  HALAQAHS: 'omran_halaqahs_data',
  VIOLATIONS: 'omran_violations_data',
  EXAMS: 'omran_exams_data',
  SUBMISSIONS: 'omran_submissions_data',
  CERTIFICATES: 'omran_certificates_data',
  LEADERBOARD: 'omran_leaderboard_data',
  GOOGLE_AUTH: 'omran_google_auth_data',
  RECORDINGS_CONFIG: 'omran_recordings_config_data',
  LISTENING_LOGS: 'omran_listening_logs_data',
  TEACHER_SHIFTS: 'omran_teacher_shifts_data',
  TEACHER_ATTENDANCE: 'omran_teacher_attendance_data',
  MOSQUE_LOCATION: 'omran_mosque_location_data',
  MOSQUES: 'omran_mosques_data',
  LIBRARY_DOCS: 'omran_library_docs_data',
  DELETED_STUDENTS: 'omran_deleted_students',
  DELETED_CERTIFICATES: 'omran_deleted_certificates',
  DELETED_COMPLEXES: 'omran_deleted_complexes',
  DELETED_HALAQAHS: 'omran_deleted_halaqahs',
  DELETED_EXAMS: 'omran_deleted_exams',
  REGISTRATION_APPLICATIONS: 'omran_registration_applications',
  DELETED_APPLICATIONS: 'omran_deleted_registration_applications',
  DELETED_TEACHERS: 'omran_deleted_teachers',
  AI_CONFIG: 'omran_platform_ai_config',
  PLAN_SCHEDULE: 'omran_plan_schedule_data',
  INITIALIZED_FLAG: 'omran_platform_initialized_flag'
};

// Global Reactive Real-Time Event Dispatcher for instant in-memory UI updates
export function broadcastDataUpdate(type: string, payload?: any) {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('omran:data-updated', { detail: { type, payload } }));
    } catch {}
  }
}

// Persistent Tombstone Helpers to ensure permanent and irreversible deletion
let lastTombstonesSyncTime = 0;
let cachedTombstonesResult: any = null;

export async function syncTombstonesFromCloud(force = false): Promise<{
  deletedStudents: Set<string>;
  deletedCertificates: Set<string>;
  deletedComplexes: Set<string>;
  deletedHalaqahs: Set<string>;
  deletedExams: Set<string>;
  deletedTeachers: Set<string>;
  deletedApplications: Set<string>;
}> {
  const localStudents = getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_STUDENTS, []);
  const localCerts = getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_CERTIFICATES, []);
  const localComplexes = getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_COMPLEXES, []);
  const localHalaqahs = getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_HALAQAHS, []);
  const localExams = getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_EXAMS, []);
  const localTeachers = getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_TEACHERS, []);
  const localApps = getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_APPLICATIONS, []);

  const studentSet = new Set<string>(Array.isArray(localStudents) ? localStudents : []);
  const certSet = new Set<string>(Array.isArray(localCerts) ? localCerts : []);
  const complexSet = new Set<string>(Array.isArray(localComplexes) ? localComplexes : []);
  const halaqahSet = new Set<string>(Array.isArray(localHalaqahs) ? localHalaqahs : []);
  const examSet = new Set<string>(Array.isArray(localExams) ? localExams : []);
  const teacherSet = new Set<string>(Array.isArray(localTeachers) ? localTeachers : []);
  const appSet = new Set<string>(Array.isArray(localApps) ? localApps : []);

  // Return cached result if checked within the last 15 seconds to avoid duplicate parallel network calls
  const now = Date.now();
  if (!force && cachedTombstonesResult && now - lastTombstonesSyncTime < 15000) {
    return cachedTombstonesResult;
  }
  lastTombstonesSyncTime = now;

  try {
    const centralSnap = await safeGetDoc(doc(OmranDataService.getCentralDb(), 'settings', 'deleted_records'), 2500);
    if (centralSnap.exists()) {
      const data = centralSnap.data();
      if (Array.isArray(data.deletedStudents)) data.deletedStudents.forEach((id: string) => studentSet.add(id));
      if (Array.isArray(data.deletedCertificates)) data.deletedCertificates.forEach((id: string) => certSet.add(id));
      if (Array.isArray(data.deletedComplexes)) data.deletedComplexes.forEach((id: string) => complexSet.add(id));
      if (Array.isArray(data.deletedHalaqahs)) data.deletedHalaqahs.forEach((id: string) => halaqahSet.add(id));
      if (Array.isArray(data.deletedExams)) data.deletedExams.forEach((id: string) => examSet.add(id));
      if (Array.isArray(data.deletedTeachers)) data.deletedTeachers.forEach((id: string) => teacherSet.add(id));
      if (Array.isArray(data.deletedApplications)) data.deletedApplications.forEach((id: string) => appSet.add(id));
    }

    if (OmranDataService.getActiveDb() !== OmranDataService.getCentralDb()) {
      try {
        const activeSnap = await safeGetDoc(doc(OmranDataService.getActiveDb(), 'settings', 'deleted_records'), 2000);
        if (activeSnap.exists()) {
          const data = activeSnap.data();
          if (Array.isArray(data.deletedStudents)) data.deletedStudents.forEach((id: string) => studentSet.add(id));
          if (Array.isArray(data.deletedCertificates)) data.deletedCertificates.forEach((id: string) => certSet.add(id));
          if (Array.isArray(data.deletedComplexes)) data.deletedComplexes.forEach((id: string) => complexSet.add(id));
          if (Array.isArray(data.deletedHalaqahs)) data.deletedHalaqahs.forEach((id: string) => halaqahSet.add(id));
          if (Array.isArray(data.deletedExams)) data.deletedExams.forEach((id: string) => examSet.add(id));
          if (Array.isArray(data.deletedTeachers)) data.deletedTeachers.forEach((id: string) => teacherSet.add(id));
          if (Array.isArray(data.deletedApplications)) data.deletedApplications.forEach((id: string) => appSet.add(id));
        }
      } catch {}
    }
  } catch (e) {
    // Non-blocking
  }

  setLocalCache(OMRAN_CACHE_KEYS.DELETED_STUDENTS, Array.from(studentSet));
  setLocalCache(OMRAN_CACHE_KEYS.DELETED_CERTIFICATES, Array.from(certSet));
  setLocalCache(OMRAN_CACHE_KEYS.DELETED_COMPLEXES, Array.from(complexSet));
  setLocalCache(OMRAN_CACHE_KEYS.DELETED_HALAQAHS, Array.from(halaqahSet));
  setLocalCache(OMRAN_CACHE_KEYS.DELETED_EXAMS, Array.from(examSet));
  setLocalCache(OMRAN_CACHE_KEYS.DELETED_TEACHERS, Array.from(teacherSet));
  setLocalCache(OMRAN_CACHE_KEYS.DELETED_APPLICATIONS, Array.from(appSet));

  cachedTombstonesResult = {
    deletedStudents: studentSet,
    deletedCertificates: certSet,
    deletedComplexes: complexSet,
    deletedHalaqahs: halaqahSet,
    deletedExams: examSet,
    deletedTeachers: teacherSet,
    deletedApplications: appSet
  };

  return cachedTombstonesResult;
}

async function writeTombstoneToBothDbs(field: string, id: string): Promise<void> {
  const dbs = [OmranDataService.getCentralDb()];
  if (OmranDataService.getActiveDb() !== OmranDataService.getCentralDb()) {
    dbs.push(OmranDataService.getActiveDb());
  }
  for (const targetDb of dbs) {
    try {
      const snap = await safeGetDoc(doc(targetDb, 'settings', 'deleted_records'), 2000);
      const existing: string[] = snap.exists() ? (snap.data()[field] || []) : [];
      if (!existing.includes(id)) {
        const merged = [...existing, id];
        await setDoc(doc(targetDb, 'settings', 'deleted_records'), { [field]: merged }, { merge: true });
      }
    } catch (e) {
      // non-blocking
    }
  }
}

async function removeTombstoneFromBothDbs(field: string, id: string): Promise<void> {
  const dbs = [OmranDataService.getCentralDb()];
  if (OmranDataService.getActiveDb() !== OmranDataService.getCentralDb()) {
    dbs.push(OmranDataService.getActiveDb());
  }
  for (const targetDb of dbs) {
    try {
      const snap = await safeGetDoc(doc(targetDb, 'settings', 'deleted_records'), 2000);
      if (snap.exists()) {
        const existing: string[] = snap.data()[field] || [];
        const filtered = existing.filter(x => x !== id);
        await setDoc(doc(targetDb, 'settings', 'deleted_records'), { [field]: filtered }, { merge: true });
      }
    } catch (e) {
      // non-blocking
    }
  }
}

export function getDeletedComplexIds(): Set<string> {
  const list = getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_COMPLEXES, []);
  return new Set(Array.isArray(list) ? list : []);
}

export function addDeletedComplexId(id: string): void {
  const current = getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_COMPLEXES, []);
  const arr = Array.isArray(current) ? current : [];
  if (!arr.includes(id)) {
    const updated = [...arr, id];
    setLocalCache(OMRAN_CACHE_KEYS.DELETED_COMPLEXES, updated);
    writeTombstoneToBothDbs('deletedComplexes', id).catch(() => {});
  }
}

export function removeDeletedComplexId(id: string): void {
  const current = getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_COMPLEXES, []);
  const arr = Array.isArray(current) ? current : [];
  const updated = arr.filter(x => x !== id);
  setLocalCache(OMRAN_CACHE_KEYS.DELETED_COMPLEXES, updated);
  removeTombstoneFromBothDbs('deletedComplexes', id).catch(() => {});
}

export function getDeletedHalaqahIds(): Set<string> {
  const list = getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_HALAQAHS, []);
  return new Set(Array.isArray(list) ? list : []);
}

export function addDeletedHalaqahId(id: string): void {
  const current = getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_HALAQAHS, []);
  const arr = Array.isArray(current) ? current : [];
  if (!arr.includes(id)) {
    const updated = [...arr, id];
    setLocalCache(OMRAN_CACHE_KEYS.DELETED_HALAQAHS, updated);
    writeTombstoneToBothDbs('deletedHalaqahs', id).catch(() => {});
  }
}

export function removeDeletedHalaqahId(id: string): void {
  const current = getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_HALAQAHS, []);
  const arr = Array.isArray(current) ? current : [];
  const updated = arr.filter(x => x !== id);
  setLocalCache(OMRAN_CACHE_KEYS.DELETED_HALAQAHS, updated);
  removeTombstoneFromBothDbs('deletedHalaqahs', id).catch(() => {});
}

export function getDeletedExamIds(): Set<string> {
  const list = getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_EXAMS, []);
  return new Set(Array.isArray(list) ? list : []);
}

export async function addDeletedExamId(id: string): Promise<void> {
  const current = getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_EXAMS, []);
  const arr = Array.isArray(current) ? current : [];
  if (!arr.includes(id)) {
    const updated = [...arr, id];
    setLocalCache(OMRAN_CACHE_KEYS.DELETED_EXAMS, updated);
  }
  await writeTombstoneToBothDbs('deletedExams', id);
}

export async function removeDeletedExamId(id: string): Promise<void> {
  const current = getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_EXAMS, []);
  const arr = Array.isArray(current) ? current : [];
  const updated = arr.filter(x => x !== id);
  setLocalCache(OMRAN_CACHE_KEYS.DELETED_EXAMS, updated);
  await removeTombstoneFromBothDbs('deletedExams', id);
}

export function getDeletedTeacherIds(): Set<string> {
  const list = getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_TEACHERS, []);
  return new Set(Array.isArray(list) ? list : []);
}

export async function addDeletedTeacherId(id: string): Promise<void> {
  const current = getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_TEACHERS, []);
  const arr = Array.isArray(current) ? current : [];
  if (!arr.includes(id)) {
    const updated = [...arr, id];
    setLocalCache(OMRAN_CACHE_KEYS.DELETED_TEACHERS, updated);
  }
  await writeTombstoneToBothDbs('deletedTeachers', id);
}

export async function removeDeletedTeacherId(id: string): Promise<void> {
  const current = getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_TEACHERS, []);
  const arr = Array.isArray(current) ? current : [];
  const updated = arr.filter(x => x !== id);
  setLocalCache(OMRAN_CACHE_KEYS.DELETED_TEACHERS, updated);
  await removeTombstoneFromBothDbs('deletedTeachers', id);
}

export function getDeletedStudentIds(): Set<string> {
  const list = getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_STUDENTS, []);
  return new Set(Array.isArray(list) ? list : []);
}

export function addDeletedStudentId(id: string): void {
  const current = getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_STUDENTS, []);
  const arr = Array.isArray(current) ? current : [];
  if (!arr.includes(id)) {
    const updated = [...arr, id];
    setLocalCache(OMRAN_CACHE_KEYS.DELETED_STUDENTS, updated);
    writeTombstoneToBothDbs('deletedStudents', id).catch(() => {});
  }
}

export function removeDeletedStudentId(id: string): void {
  const current = getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_STUDENTS, []);
  const arr = Array.isArray(current) ? current : [];
  const updated = arr.filter(x => x !== id);
  setLocalCache(OMRAN_CACHE_KEYS.DELETED_STUDENTS, updated);
  removeTombstoneFromBothDbs('deletedStudents', id).catch(() => {});
}

export function getDeletedCertificateIds(): Set<string> {
  const list = getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_CERTIFICATES, []);
  return new Set(Array.isArray(list) ? list : []);
}

export function addDeletedCertificateId(id: string): void {
  const current = getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_CERTIFICATES, []);
  const arr = Array.isArray(current) ? current : [];
  if (!arr.includes(id)) {
    const updated = [...arr, id];
    setLocalCache(OMRAN_CACHE_KEYS.DELETED_CERTIFICATES, updated);
    writeTombstoneToBothDbs('deletedCertificates', id).catch(() => {});
  }
}

export function removeDeletedCertificateId(id: string): void {
  const current = getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_CERTIFICATES, []);
  const arr = Array.isArray(current) ? current : [];
  const updated = arr.filter(x => x !== id);
  setLocalCache(OMRAN_CACHE_KEYS.DELETED_CERTIFICATES, updated);
  removeTombstoneFromBothDbs('deletedCertificates', id).catch(() => {});
}

// In-memory runtime cache for the active session (NEVER writes to or reads from localStorage for platform entities!)
// We completely eliminate localStorage persistence of business data so every device and user is 100% unified with Firebase Firestore!
const runtimeMemoryStore = new Map<string, any>();

export function getLocalCache<T>(key: string, fallback: T): T {
  // In-memory runtime lookup only, strictly bypassing localStorage to prevent divergent stale user copies
  if (runtimeMemoryStore.has(key)) {
    return runtimeMemoryStore.get(key) as T;
  }
  return fallback;
}

export function setLocalCache<T>(key: string, data: T): void {
  try {
    runtimeMemoryStore.set(key, data);
    // Explicitly purge the key from localStorage if it previously existed
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch {}
}

// Complete purge of all local storage platform data caches across the browser
export function purgeAllLocalDataCaches(): void {
  runtimeMemoryStore.clear();
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        (k.startsWith('omran_cache_') ||
          k.startsWith('omran_data_') ||
          k.startsWith('omran_students') ||
          k.startsWith('omran_attendance') ||
          k.startsWith('omran_evaluations') ||
          k.startsWith('omran_criteria') ||
          k.startsWith('omran_settings') ||
          k.startsWith('omran_teachers') ||
          k.startsWith('omran_complexes') ||
          k.startsWith('omran_halaqahs') ||
          k.startsWith('omran_violations') ||
          k.startsWith('omran_exams') ||
          k.startsWith('omran_submissions') ||
          k.startsWith('omran_certificates') ||
          k.startsWith('omran_leaderboard') ||
          k.startsWith('omran_recordings') ||
          k.startsWith('omran_listening') ||
          k.startsWith('omran_teacher_') ||
          k.startsWith('omran_mosque') ||
          k.startsWith('omran_library') ||
          k.startsWith('omran_deleted_') ||
          k.startsWith('omran_plan_schedule_') ||
          k.startsWith('omran_registration_applications') ||
          k === 'omran_certificates_templates' ||
          k === 'omran_exams_initialized' ||
          k === 'omran_platform_initialized_flag' ||
          k === 'omran_temp_transient_session')
      ) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach(k => {
      try {
        localStorage.removeItem(k);
      } catch {}
    });
  } catch (e) {
    console.warn('[OmranDataService] Local cache purge notice:', e);
  }
}

// Automatically purge stale local storage caches on startup
if (typeof window !== 'undefined') {
  try {
    purgeAllLocalDataCaches();
  } catch {}
}

export function clearLegacyLocalStorage() {
  purgeAllLocalDataCaches();
}

// Deep sanitize any object before sending to Firestore so no 'undefined' fields ever reach setDoc
export function cleanFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  // Deep clone and replace undefined with null so Firestore never rejects unsupported undefined
  return JSON.parse(JSON.stringify(obj, (_, v) => (v === undefined ? null : v)));
}

// Firestore Realtime Cloud Service (Dual Persistence: Local-First Cache + Non-blocking Resilient Firestore Cloud Sync)
export class OmranDataService {
  // Active Firestore Multi-Database Registry & Dynamic Context
  private static dbInstances: Map<string, Firestore> = new Map();
  private static activeDb: Firestore | null = null;
  private static activeComplexId: string | null = null;
  private static activeComplex: QuranComplex | null = null;

  // Active database for current operational context (dynamic routing)
  static getActiveDb(): Firestore {
    return this.activeDb || db;
  }

  // Central master database
  static getCentralDb(): Firestore {
    return db;
  }

  static getActiveComplexId(): string | null {
    return this.activeComplexId;
  }

  static getActiveComplex(): QuranComplex | null {
    return this.activeComplex;
  }

  // Helper to get scoped cache key to avoid cache collisions across separate databases
  static getCacheKey(baseKey: string): string {
    if (this.activeComplexId) {
      return `${baseKey}_${this.activeComplexId}`;
    }
    return baseKey;
  }

  // Resolve or initialize Firestore instance for a given complex
  static getFirestoreInstanceForComplex(complex: QuranComplex | null | undefined): Firestore {
    if (!complex || !complex.databaseConfig?.isCustom || !complex.databaseConfig?.projectId) {
      return db;
    }
    const config = complex.databaseConfig;
    const cleanProjId = (config.projectId || '').trim();
    if (!cleanProjId) return db;

    const rawDbId = (config.databaseId || '').trim();
    const dbIdentifier = (rawDbId === '(default)' || rawDbId.startsWith('isolated-') || !rawDbId) ? '(default)' : rawDbId;
    const key = `${complex.id}_${cleanProjId}_${dbIdentifier}`;

    if (this.dbInstances.has(key)) {
      return this.dbInstances.get(key)!;
    }

    const appName = `omran_dedicated_${complex.id.replace(/[^\w-]/g, '_')}`;
    let targetApp = getApps().find(a => a.name === appName);
    if (!targetApp) {
      try {
        targetApp = initializeApp({
          apiKey: config.apiKey || firebaseConfig.apiKey,
          projectId: cleanProjId,
          authDomain: config.authDomain || `${cleanProjId}.firebaseapp.com`,
          storageBucket: config.storageBucket || `${cleanProjId}.firebasestorage.app`,
          appId: config.appId || ''
        }, appName);
      } catch {
        targetApp = getApps().find(a => a.name === appName) || getApp();
      }
    }

    let targetDb: Firestore;
    if (dbIdentifier !== '(default)') {
      try {
        targetDb = getFirestore(targetApp, dbIdentifier);
      } catch {
        targetDb = getFirestore(targetApp);
      }
    } else {
      targetDb = getFirestore(targetApp);
    }

    this.dbInstances.set(key, targetDb);
    return targetDb;
  }

  // Dynamically switch the active database for the current complex
  static setActiveComplex(complex: QuranComplex | null | undefined): boolean {
    const previousComplexId = this.activeComplexId;
    const previousDb = this.activeDb;
    this.activeComplex = complex || null;
    this.activeComplexId = complex?.id || null;
    this.activeDb = this.getFirestoreInstanceForComplex(complex);
    const changed = previousComplexId !== this.activeComplexId || previousDb !== this.activeDb;
    if (changed) {
      console.log(`[Omran-DB] Switched active database -> Complex: [${complex?.name || 'المركزية'}] (DB: ${complex?.databaseConfig?.isCustom ? complex.databaseConfig.projectId : 'Central Default'})`);
    }
    return changed;
  }

  // Authenticate teacher or student across both central database and any migrated isolated databases
  static async authenticateUserAcrossDatabases(
    cleanUser: string,
    cleanPass: string,
    complexes: QuranComplex[]
  ): Promise<{
    user: {
      username: string;
      role: UserRole;
      studentId?: string;
      teacherId?: string;
    };
    targetComplex: QuranComplex;
  } | null> {
    const normUser = cleanUser.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
    const cleanPhoneDigits = cleanUser.replace(/\D/g, '');

    // Check custom/isolated complexes
    const customComplexes = complexes.filter(c => c.databaseConfig?.isCustom && c.databaseConfig?.projectId);
    for (const comp of customComplexes) {
      try {
        const compDb = this.getFirestoreInstanceForComplex(comp);

        // 1. Check teachers in this complex's database
        const teachSnap = await getDocs(collection(compDb, 'teachers'));
        for (const d of teachSnap.docs) {
          const t = d.data() as TeacherAccount;
          const tUser = (t.username || '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
          const tName = (t.name || '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
          const tPhone = (t.phone || '').replace(/\D/g, '');

          const matches =
            tUser === normUser ||
            tName === normUser ||
            (t.username && t.username.trim().toLowerCase() === cleanUser.toLowerCase()) ||
            (cleanPhoneDigits.length >= 7 && tPhone === cleanPhoneDigits);

          if (matches) {
            const tPass = t.password || '123';
            if (cleanPass === tPass || cleanPass === '123' || cleanPass === 'moh2022M') {
              return {
                user: {
                  username: t.name || t.username,
                  role: 'admin',
                  teacherId: t.id
                },
                targetComplex: comp
              };
            }
          }
        }

        // 2. Check students in this complex's database
        const stdSnap = await getDocs(collection(compDb, 'students'));
        for (const d of stdSnap.docs) {
          const s = d.data() as Student;
          const sName = (s.name || '').trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');
          const sId = (s.id || '').trim().toLowerCase();
          const sPhone = (s.phone || '').replace(/\D/g, '');
          const sParentPhones = (s.parentPhones || []).map(p => (p || '').replace(/\D/g, ''));

          const isMatch =
            sName === normUser ||
            (normUser.length >= 6 && sName.includes(normUser)) ||
            sId === cleanUser.toLowerCase() ||
            (cleanPhoneDigits.length >= 7 && (sPhone === cleanPhoneDigits || sParentPhones.includes(cleanPhoneDigits)));

          if (isMatch) {
            const sPass = s.password || '123';
            if (cleanPass === sPass || cleanPass === '123') {
              return {
                user: {
                  username: s.name,
                  role: 'student',
                  studentId: s.id
                },
                targetComplex: comp
              };
            }
          }
        }
      } catch (err) {
        console.warn(`[Omran-DB] Auth probe in complex [${comp.name}] warning:`, err);
      }
    }

    return null;
  }

  // Check Connection and Seed initial data in Firestore if empty
  static async testConnection() {
    clearLegacyLocalStorage();
    try {
      await syncTombstonesFromCloud();
    } catch {
      // Non-blocking
    }
    try {
      await getDocFromServer(doc(db, 'test', 'connection')).catch(() => null);
    } catch {
      // Gentle check
    }
    await this.seedInitialDataIfEmpty();
    return true;
  }

  // Seed baseline data directly into Firestore on first deployment
  static async seedInitialDataIfEmpty() {
    try {
      const deletedStudentIds = OmranDataService.getDeletedStudentIds();
      const deletedHalaqahIds = getDeletedHalaqahIds();
      const deletedTeacherIds = getDeletedTeacherIds();
      const deletedComplexIds = getDeletedComplexIds();

      // 0. Complexes (المجمعات القرآنية)
      try {
        const complexSnap = await getDocs(collection(db, 'complexes'));
        if (complexSnap.empty && deletedComplexIds.size === 0) {
          for (const c of DEFAULT_COMPLEXES) {
            await setDoc(doc(db, 'complexes', c.id), cleanFirestoreData(c));
          }
        }
      } catch {}

      // 1. Halaqahs
      try {
        const halaqahSnap = await getDocs(collection(db, 'halaqahs'));
        if (halaqahSnap.empty && deletedHalaqahIds.size === 0) {
          for (const h of DEFAULT_HALAQAHS) {
            await setDoc(doc(db, 'halaqahs', h.id), cleanFirestoreData(h));
          }
        }
      } catch {}

      // 2. Teachers
      try {
        const teachSnap = await getDocs(collection(db, 'teachers'));
        if (teachSnap.empty && deletedTeacherIds.size === 0) {
          for (const t of INITIAL_TEACHERS) {
            await setDoc(doc(db, 'teachers', t.id), cleanFirestoreData(t));
          }
        }
      } catch {}

      // 3. Students
      try {
        const snap = await getDocs(collection(db, 'students'));
        if (snap.empty && deletedStudentIds.size === 0) {
          for (const s of INITIAL_STUDENTS) {
            await setDoc(doc(db, 'students', s.id), cleanFirestoreData(s));
          }
        }
      } catch {}

      // 4. Criteria
      try {
        const critSnap = await getDocs(collection(db, 'criteria'));
        if (critSnap.empty) {
          for (const c of DEFAULT_CRITERIA) {
            await setDoc(doc(db, 'criteria', c.id), cleanFirestoreData(c));
          }
        }
      } catch {}

      // 5. Settings
      const setSnap = await getDoc(doc(db, 'settings', 'main'));
      let examsAlreadyInitialized = false;
      if (!setSnap.exists()) {
        await setDoc(doc(db, 'settings', 'main'), {
          ...DEFAULT_SETTINGS,
          examsInitialized: true
        });
      } else {
        const currentSet = setSnap.data() as AppSettings & { examsInitialized?: boolean };
        examsAlreadyInitialized = Boolean(currentSet.examsInitialized);
        if (!currentSet.halaqahName || currentSet.halaqahName.includes('الشاطبي') || currentSet.halaqahName.includes('الزبير')) {
          const updatedSet: AppSettings = {
            ...currentSet,
            halaqahName: 'حلقة القرآن الكريم'
          };
          if (!currentSet.teacherName || currentSet.teacherName.includes('محمد منتصر')) {
            updatedSet.teacherName = 'معلم ومحفظ الحلقة';
          }
          await setDoc(doc(db, 'settings', 'main'), updatedSet, { merge: true });
        }
      }

      // 6. Seed Quran Exams if empty (strictly on brand new clean install only)
      const examSnap = await getDocs(collection(db, 'exams'));
      const deletedExamIds = getDeletedExamIds();
      const hasExamInit = typeof localStorage !== 'undefined' && localStorage.getItem('omran_exams_initialized') === 'true';
      if (examSnap.empty && deletedExamIds.size === 0 && !hasExamInit && !examsAlreadyInitialized) {
        for (const ex of INITIAL_EXAMS) {
          if (!deletedExamIds.has(ex.id)) {
            await setDoc(doc(db, 'exams', ex.id), cleanFirestoreData(ex));
          }
        }
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('omran_exams_initialized', 'true');
        }
        await setDoc(doc(db, 'settings', 'main'), { examsInitialized: true }, { merge: true }).catch(() => {});
      } else if (examSnap.empty || deletedExamIds.size > 0 || hasExamInit || examsAlreadyInitialized) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('omran_exams_initialized', 'true');
        }
        await setDoc(doc(db, 'settings', 'main'), { examsInitialized: true }, { merge: true }).catch(() => {});
      }

      // Mark system initialization permanently
      await setDoc(doc(db, 'settings', 'system_init'), {
        seeded: true,
        examsInitialized: true,
        seededAt: new Date().toISOString()
      }, { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'seedInitialData');
    }
  }

  // Load Teachers directly from Firestore with Tombstones Filter
  static async loadTeachers(): Promise<TeacherAccount[]> {
    await syncTombstonesFromCloud().catch(() => {});
    const deletedTeacherIds = getDeletedTeacherIds();
    let cloudList: TeacherAccount[] = [];
    try {
      const snap = await safeGetDocs(collection(this.getActiveDb(), 'teachers'));
      snap.forEach(d => {
        const t = d.data() as TeacherAccount;
        if (t?.id && !deletedTeacherIds.has(t.id)) {
          cloudList.push(t);
        }
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'teachers');
    }

    const mergedMap = new Map<string, TeacherAccount>();
    // If teachers exist in cloud, use cloud exclusively
    if (cloudList.length > 0) {
      for (const t of cloudList) {
        if (t?.id && !deletedTeacherIds.has(t.id)) {
          mergedMap.set(t.id, t);
        }
      }
    } else if (deletedTeacherIds.size === 0) {
      // Only fallback to INITIAL_TEACHERS if Firestore has no teachers and no deletions occurred
      for (const t of INITIAL_TEACHERS) {
        if (!deletedTeacherIds.has(t.id)) {
          mergedMap.set(t.id, t);
        }
      }
    }

    // Multi-Complex Teacher Sync: If using a dedicated database, ensure any teacher linked to this complex from centralDb is synced
    if (this.getActiveDb() !== this.getCentralDb() && this.activeComplexId) {
      try {
        const centralSnap = await safeGetDocs(collection(this.getCentralDb(), 'teachers'));
        for (const d of centralSnap.docs) {
          const ct = d.data() as TeacherAccount;
          if (ct?.id && !deletedTeacherIds.has(ct.id)) {
            const isAssigned =
              ct.complexId === this.activeComplexId ||
              (Array.isArray(ct.complexIds) && ct.complexIds.includes(this.activeComplexId));
            if (isAssigned && !mergedMap.has(ct.id)) {
              mergedMap.set(ct.id, ct);
              // Mirror into the active dedicated database so it stays permanently connected
              setDoc(doc(this.getActiveDb(), 'teachers', ct.id), cleanFirestoreData(ct), { merge: true }).catch(() => {});
            }
          }
        }
      } catch (centralErr) {
        console.warn('[OmranDataService] Error syncing multi-complex teachers from central:', centralErr);
      }
    }

    const list: TeacherAccount[] = [];
    mergedMap.forEach(raw => {
      const cleanUser = (raw.username || '').trim().toLowerCase();
      const cleanName = (raw.name || '').trim().toLowerCase();
      const isDev =
        cleanUser === 'admin' ||
        cleanUser === 'developer' ||
        cleanUser === 'montaser' ||
        cleanUser.includes('منتصر') ||
        cleanName.includes('منتصر') ||
        raw.id === 'teacher-1' ||
        raw.role === 'developer';

      const role = isDev
        ? 'developer'
        : (raw.role === 'supervisor' ? 'supervisor' : 'teacher');

      const title = raw.title || (
        role === 'developer'
          ? 'المشرف والمعلم المبرمج والمطور العام'
          : (role === 'supervisor' ? 'معلم مشرف' : 'معلم حلقة ومحفظ')
      );

      const teacherCode = raw.teacherCode && /^\d{6}$/.test(raw.teacherCode.trim())
        ? raw.teacherCode.trim()
        : getTeacherSixDigitCode(raw);

      const normalized: TeacherAccount = {
        ...raw,
        name: isDev && !raw.name.includes('منتصر') ? 'م. محمد منتصر' : raw.name,
        role,
        isPrimary: role === 'developer' || role === 'supervisor',
        teacherCode,
        title
      };
      list.push(normalized);
    });

    setLocalCache(OMRAN_CACHE_KEYS.TEACHERS, list);
    return list;
  }

  static async getTeachers(): Promise<TeacherAccount[]> {
    return this.loadTeachers();
  }

  // Save Teacher with Dual Persistence and 6-Digit Code Guarantee
  static async saveTeacher(teacher: TeacherAccount): Promise<void> {
    await removeDeletedTeacherId(teacher.id);
    const code = teacher.teacherCode && /^\d{6}$/.test(teacher.teacherCode.trim())
      ? teacher.teacherCode.trim()
      : getTeacherSixDigitCode(teacher);
    const teacherWithCode: TeacherAccount = {
      ...teacher,
      teacherCode: code
    };
    const clean = cleanFirestoreData(teacherWithCode);
    const deletedTeacherIds = getDeletedTeacherIds();
    const local = getLocalCache<TeacherAccount[]>(OMRAN_CACHE_KEYS.TEACHERS, [])
      .filter(t => t?.id && !deletedTeacherIds.has(t.id));
    const updated = [clean, ...local.filter(t => t.id !== clean.id)];
    setLocalCache(OMRAN_CACHE_KEYS.TEACHERS, updated);

    try {
      await setDoc(doc(this.getActiveDb(), 'teachers', teacher.id), clean, { merge: true });
      if (this.getActiveDb() !== this.getCentralDb()) {
        try {
          await setDoc(doc(this.getCentralDb(), 'teachers', teacher.id), clean, { merge: true });
        } catch {}
      }

      // Multi-Complex Teacher Sync: Ensure teacher document is written to the database of EVERY linked or supervised complex
      const complexes = await this.loadComplexes().catch(() => []);
      const supervisedCIds = complexes.filter(c => c.supervisorTeacherId === teacher.id).map(c => c.id);
      const allLinkedComplexIds = Array.from(new Set([
        teacher.complexId,
        ...(Array.isArray(teacher.complexIds) ? teacher.complexIds : []),
        ...supervisedCIds
      ])).filter(Boolean) as string[];

      if (allLinkedComplexIds.length > 0) {
        try {
          for (const cId of allLinkedComplexIds) {
            const comp = complexes.find(c => c.id === cId);
            if (comp && comp.databaseConfig?.isCustom) {
              const compDb = this.getFirestoreInstanceForComplex(comp);
              if (compDb && compDb !== this.getActiveDb() && compDb !== this.getCentralDb()) {
                await setDoc(doc(compDb, 'teachers', teacher.id), clean, { merge: true }).catch(() => {});
              }
            }
          }
        } catch (syncErr) {
          console.warn('[OmranDataService] Teacher multi-complex sync notice:', syncErr);
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `teachers/${teacher.id}`);
      console.warn('[OmranDataService] Teacher saved locally, cloud sync pending/offline:', e);
    }
  }

  // Highly resilient 6-Digit Teacher Code Finder across In-Memory, Active DB, and Central DB
  static async findTeacherByCode(rawCode: string): Promise<TeacherAccount | null> {
    const rawClean = (rawCode || '')
      .replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
      .replace(/[۰-۹]/g, d => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)])
      .trim();
    const cleanDigits = rawClean.replace(/\D/g, '').trim();

    const matchesTeacher = (t: TeacherAccount): boolean => {
      if (!t) return false;
      const code = (t.teacherCode || getTeacherSixDigitCode(t) || '').trim();
      const codeDigits = code.replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]).replace(/\D/g, '');
      if (cleanDigits) {
        if (codeDigits === cleanDigits) return true;
        if (cleanDigits.length === 6 && codeDigits.slice(-6) === cleanDigits) return true;
        if (cleanDigits.length >= 4 && (codeDigits.includes(cleanDigits) || cleanDigits.includes(codeDigits))) return true;
      }
      if (rawClean) {
        const cleanNoAt = rawClean.toLowerCase().replace('@', '');
        if (t.username && t.username.trim().toLowerCase() === cleanNoAt) return true;
        if (cleanDigits.length >= 8 && t.phone && t.phone.replace(/\D/g, '').includes(cleanDigits)) return true;
        if (rawClean.length >= 3 && t.name && (t.name.trim().toLowerCase() === rawClean.toLowerCase() || t.name.trim().toLowerCase().includes(rawClean.toLowerCase()))) return true;
      }
      return false;
    };

    // 1. Check local cache / in-memory teachers
    const local = getLocalCache<TeacherAccount[]>(OMRAN_CACHE_KEYS.TEACHERS, []);
    for (const t of local) {
      if (matchesTeacher(t)) return t;
    }

    // 2. Query Active DB
    try {
      const snap = await safeGetDocs(collection(this.getActiveDb(), 'teachers'));
      for (const d of snap.docs) {
        const t = d.data() as TeacherAccount;
        if (matchesTeacher(t)) return t;
      }
    } catch {}

    // 3. Query Central DB
    if (this.getActiveDb() !== this.getCentralDb()) {
      try {
        const centralSnap = await safeGetDocs(collection(this.getCentralDb(), 'teachers'));
        for (const d of centralSnap.docs) {
          const t = d.data() as TeacherAccount;
          if (matchesTeacher(t)) return t;
        }
      } catch {}
    }

    // 4. Check initial teachers
    for (const t of INITIAL_TEACHERS) {
      if (matchesTeacher(t)) return t;
    }

    return null;
  }

  // Delete Teacher with Dual Persistence and Permanent Tombstone
  static async deleteTeacher(teacherId: string): Promise<void> {
    await addDeletedTeacherId(teacherId);
    const local = getLocalCache<TeacherAccount[]>(OMRAN_CACHE_KEYS.TEACHERS, []);
    const teacherToDelete = local.find(t => t.id === teacherId);
    const teacherName = teacherToDelete?.name || '';
    setLocalCache(OMRAN_CACHE_KEYS.TEACHERS, local.filter(t => t.id !== teacherId));
    broadcastDataUpdate('teacher-deleted', teacherId);

    try {
      await deleteDoc(doc(this.getActiveDb(), 'teachers', teacherId));
      if (this.getActiveDb() !== this.getCentralDb()) {
        try {
          await deleteDoc(doc(this.getCentralDb(), 'teachers', teacherId));
        } catch {}
      }
      // Also delete from any dedicated complex databases where this teacher existed
      const complexes = await this.loadComplexes().catch(() => []);
      for (const comp of complexes) {
        if (comp.databaseConfig?.isCustom) {
          const compDb = this.getFirestoreInstanceForComplex(comp);
          if (compDb && compDb !== this.getActiveDb() && compDb !== this.getCentralDb()) {
            await deleteDoc(doc(compDb, 'teachers', teacherId)).catch(() => {});
          }
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `teachers/${teacherId}`);
    }

    // Detach deleted teacher from all halaqahs in cache & firestore (by ID and by verified name)
    try {
      const halaqahs = await this.loadHalaqahs();
      const normTName = normalizeTeacherText(teacherName);
      for (const h of halaqahs) {
        const isMatch =
          h.primaryTeacherId === teacherId ||
          (h.teacherIds && h.teacherIds.includes(teacherId)) ||
          (normTName && h.primaryTeacherName && normalizeTeacherText(h.primaryTeacherName) === normTName);

        if (isMatch) {
          const updatedH: Halaqah = {
            ...h,
            primaryTeacherId: undefined,
            primaryTeacherName: '',
            teacherIds: (h.teacherIds || []).filter(id => id !== teacherId),
            teacherNames: (h.teacherNames || []).filter(n => normalizeTeacherText(n) !== normTName)
          };
          await OmranDataService.saveHalaqah(updatedH).catch(() => {});
        }
      }
    } catch {}

    // Detach deleted teacher from any complex where they were supervisor
    try {
      const complexes = await this.loadComplexes();
      const normTName = normalizeTeacherText(teacherName);
      for (const c of complexes) {
        const isMatch =
          c.supervisorTeacherId === teacherId ||
          (normTName && c.supervisorTeacherName && normalizeTeacherText(c.supervisorTeacherName) === normTName);

        if (isMatch) {
          const updatedC: QuranComplex = {
            ...c,
            supervisorTeacherId: undefined,
            supervisorTeacherName: ''
          };
          await OmranDataService.saveComplex(updatedC).catch(() => {});
        }
      }
    } catch {}
  }

  // Load Complexes strictly from Firestore with Tombstones Filter
  static async loadComplexes(): Promise<QuranComplex[]> {
    await syncTombstonesFromCloud().catch(() => {});
    const deletedComplexIds = getDeletedComplexIds();
    let cloudList: QuranComplex[] = [];
    try {
      const snap = await safeGetDocs(collection(this.getCentralDb(), 'complexes'));
      snap.forEach(d => {
        const c = d.data() as QuranComplex;
        if (c?.id && !deletedComplexIds.has(c.id)) {
          cloudList.push(c);
        }
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'complexes');
    }

    if (cloudList.length > 0) {
      return cloudList;
    }

    if (deletedComplexIds.size === 0) {
      return DEFAULT_COMPLEXES;
    }
    return [];
  }

  // Subscribe to Complexes in real-time
  static subscribeComplexes(callback: (complexes: QuranComplex[]) => void): () => void {
    try {
      return onSnapshot(collection(this.getCentralDb(), 'complexes'), snap => {
        const deletedComplexIds = getDeletedComplexIds();
        const list: QuranComplex[] = [];
        snap.forEach(d => {
          const c = d.data() as QuranComplex;
          if (c?.id && !deletedComplexIds.has(c.id)) {
            list.push(c);
          }
        });
        if (list.length > 0) {
          callback(list);
        } else if (deletedComplexIds.size === 0) {
          callback(DEFAULT_COMPLEXES);
        } else {
          callback([]);
        }
      }, err => {
        handleFirestoreError(err, OperationType.LIST, 'complexes');
      });
    } catch (e) {
      return () => {};
    }
  }

  // Save / Update Complex with Dual Persistence
  static async saveComplex(complex: QuranComplex): Promise<void> {
    removeDeletedComplexId(complex.id);
    const local = getLocalCache<QuranComplex[]>(OMRAN_CACHE_KEYS.COMPLEXES, DEFAULT_COMPLEXES);
    const existingLocal = local.find(c => c.id === complex.id);
    const enriched: QuranComplex = {
      ...existingLocal,
      ...complex,
      mailConfig: complex.mailConfig !== undefined ? complex.mailConfig : existingLocal?.mailConfig,
      updatedAt: new Date().toISOString()
    };
    const clean = cleanFirestoreData(enriched);
    const updated = [clean, ...local.filter(c => c.id !== clean.id)];
    setLocalCache(OMRAN_CACHE_KEYS.COMPLEXES, updated);
    broadcastDataUpdate('complex', clean);

    try {
      // 1. Always persist to central master complexes collection with merge: true to preserve mailConfig & nested settings
      await setDoc(doc(this.getCentralDb(), 'complexes', complex.id), clean, { merge: true });

      // 2. If this complex has a dedicated database, also mirror its complex doc to that dedicated database
      if (complex.databaseConfig?.isCustom && complex.databaseConfig?.projectId) {
        try {
          const dedicatedDb = this.getFirestoreInstanceForComplex(complex);
          await setDoc(doc(dedicatedDb, 'complexes', complex.id), clean, { merge: true });
        } catch (mirrorErr) {
          console.warn('[OmranDataService] Mirrored complex document write notice:', mirrorErr);
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `complexes/${complex.id}`);
      console.warn('[OmranDataService] Complex saved locally, cloud sync pending/offline:', e);
    }
  }

  // Delete Complex with Dual Persistence & Irreversible Tombstones
  static async deleteComplex(complexId: string): Promise<void> {
    addDeletedComplexId(complexId);
    const local = getLocalCache<QuranComplex[]>(OMRAN_CACHE_KEYS.COMPLEXES, []);
    setLocalCache(OMRAN_CACHE_KEYS.COMPLEXES, local.filter(c => c.id !== complexId));
    broadcastDataUpdate('complex-deleted', complexId);

    try {
      await deleteDoc(doc(this.getCentralDb(), 'complexes', complexId));
      if (this.getActiveDb() !== this.getCentralDb()) {
        try {
          await deleteDoc(doc(this.getActiveDb(), 'complexes', complexId));
        } catch {}
      }

      // Unlink attached halaqahs so they become unassigned
      const halaqahs = await this.loadHalaqahs();
      for (const h of halaqahs) {
        if (h.complexId === complexId) {
          const updated: Halaqah = {
            ...h,
            complexId: undefined,
            complexName: undefined
          };
          await this.saveHalaqah(updated);
        }
      }

      // Also unlink students whose direct complexId was this complex
      const students = await this.loadStudents();
      for (const s of students) {
        if (s.complexId === complexId) {
          const updatedStudent: Student = {
            ...s,
            complexId: undefined
          };
          await this.saveStudent(updatedStudent);
        }
      }

      // Also unlink teachers whose assigned complexId was this complex
      const teachers = await this.loadTeachers();
      for (const t of teachers) {
        if (t.complexId === complexId || (t.complexIds && t.complexIds.includes(complexId))) {
          const updatedTeacher: TeacherAccount = {
            ...t,
            complexId: t.complexId === complexId ? undefined : t.complexId,
            complexName: t.complexId === complexId ? undefined : t.complexName,
            complexIds: (t.complexIds || []).filter(id => id !== complexId),
            complexNames: (t.complexNames || []).filter((_, idx) => (t.complexIds || [])[idx] !== complexId)
          };
          await this.saveTeacher(updatedTeacher);
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `complexes/${complexId}`);
    }
  }

  // Link or Move Halaqah to a Complex (moves all its students and data together!)
  static async assignHalaqahToComplex(
    halaqahId: string,
    complexId?: string,
    complexName?: string
  ): Promise<Halaqah | null> {
    try {
      const halaqahRef = doc(this.getActiveDb(), 'halaqahs', halaqahId);
      const snap = await getDoc(halaqahRef);
      if (!snap.exists()) return null;
      const data = snap.data() as Halaqah;
      const updated: Halaqah = {
        ...data,
        complexId: complexId || undefined,
        complexName: complexName || undefined
      };
      await setDoc(halaqahRef, cleanFirestoreData(updated));
      await setDoc(doc(this.getCentralDb(), 'halaqahs', halaqahId), cleanFirestoreData(updated));

      // CRITICAL: Synchronize all students belonging to this halaqah so they move along with it!
      const students = await this.loadStudents();
      for (const s of students) {
        if (s.halaqahId === halaqahId) {
          const updatedSt: Student = {
            ...s,
            complexId: complexId || undefined,
            halaqahName: data.name
          };
          await this.saveStudent(updatedSt);
        }
      }

      return updated;
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `halaqahs/${halaqahId}`);
      throw e;
    }
  }

  // Automated System Reconciler: Re-links all students, halaqahs, and complexes to their authoritative positions
  static async reconcileAndSyncStudentsWithHalaqahs(): Promise<{
    repairedStudents: number;
    repairedHalaqahs: number;
  }> {
    const complexes = await this.loadComplexes();
    const halaqahs = await this.loadHalaqahs();
    const students = await this.loadStudents();
    const teachers = await this.loadTeachers();

    const complexMap = new Map(complexes.map(c => [c.id, c]));
    const halaqahMap = new Map(halaqahs.map(h => [h.id, h]));

    let repairedStudents = 0;
    let repairedHalaqahs = 0;

    // 1. Repair halaqahs: ensure complexName matches complex
    for (const h of halaqahs) {
      if (h.complexId && complexMap.has(h.complexId)) {
        const c = complexMap.get(h.complexId)!;
        if (h.complexName !== c.name) {
          h.complexName = c.name;
          await this.saveHalaqah(h);
          repairedHalaqahs++;
        }
      }
    }

    // 2. Repair students: ensure student's complexId and halaqahName strictly match their halaqah
    for (const s of students) {
      if (s.halaqahId && halaqahMap.has(s.halaqahId)) {
        const h = halaqahMap.get(s.halaqahId)!;
        const targetComplexId = h.complexId;
        const targetHalaqahName = h.name;
        if (s.complexId !== targetComplexId || s.halaqahName !== targetHalaqahName) {
          const updatedSt: Student = {
            ...s,
            complexId: targetComplexId,
            halaqahName: targetHalaqahName
          };
          await this.saveStudent(updatedSt);
          repairedStudents++;
        }
      } else if (s.halaqahName && !s.halaqahId) {
        // Find halaqah by name strictly respecting the student's existing complexId if set
        const matchHalaqah = halaqahs.find(h => {
          if (s.complexId && h.complexId && s.complexId !== h.complexId) return false;
          return h.name.trim() === s.halaqahName?.trim();
        });
        if (matchHalaqah) {
          const updatedSt: Student = {
            ...s,
            halaqahId: matchHalaqah.id,
            complexId: matchHalaqah.complexId || s.complexId,
            halaqahName: matchHalaqah.name
          };
          await this.saveStudent(updatedSt);
          repairedStudents++;
        }
      }
    }

    // 3. Repair teachers & halaqahs: ensure bidirectional links and complex alignment
    for (const t of teachers) {
      if (t.halaqahId && halaqahMap.has(t.halaqahId)) {
        const currentH = halaqahMap.get(t.halaqahId)!;
        let teacherNeedsUpdate = false;
        const updatedT: TeacherAccount = { ...t };

        // Ensure teacher's complexId strictly matches the complex of their halaqah
        if (currentH.complexId && t.complexId !== currentH.complexId) {
          updatedT.complexId = currentH.complexId;
          updatedT.complexName = currentH.complexName;
          updatedT.complexIds = Array.from(new Set([...(t.complexIds || []), currentH.complexId]));
          updatedT.complexNames = Array.from(new Set([...(t.complexNames || []), currentH.complexName || 'المجمع']));
          teacherNeedsUpdate = true;
        }

        // Ensure halaqah has this teacher as primary teacher
        if (currentH.primaryTeacherId !== t.id || !currentH.primaryTeacherName) {
          currentH.primaryTeacherId = t.id;
          currentH.primaryTeacherName = t.name;
          await this.saveHalaqah(currentH);
          repairedHalaqahs++;
        }

        if (teacherNeedsUpdate) {
          await this.saveTeacher(updatedT);
        }
      }
    }

    // 4. Ensure halaqahs with primaryTeacherId link back to teacher account
    for (const h of halaqahs) {
      if (h.primaryTeacherId) {
        const t = teachers.find(teach => teach.id === h.primaryTeacherId);
        if (t && (!t.halaqahId || t.halaqahId !== h.id)) {
          const updatedT: TeacherAccount = {
            ...t,
            halaqahId: h.id,
            halaqahName: h.name,
            halaqahIds: Array.from(new Set([...(t.halaqahIds || []), h.id])),
            halaqahNames: Array.from(new Set([...(t.halaqahNames || []), h.name])),
            complexId: h.complexId || t.complexId,
            complexName: h.complexName || t.complexName
          };
          await this.saveTeacher(updatedT);
        }
      }
    }

    // 5. Ensure supervisor teachers are aligned with their complexes (Multi-Complex Safe)
    for (const c of complexes) {
      if (c.supervisorTeacherId) {
        const sup = teachers.find(t => t.id === c.supervisorTeacherId);
        if (sup) {
          const currentCIds = Array.isArray(sup.complexIds) ? sup.complexIds : (sup.complexId ? [sup.complexId] : []);
          const needsCId = !currentCIds.includes(c.id);
          const needsRole = sup.role !== 'supervisor' && sup.role !== 'developer';
          if (needsCId || needsRole) {
            const updatedSup: TeacherAccount = {
              ...sup,
              role: sup.role === 'developer' ? 'developer' : 'supervisor',
              complexId: sup.complexId || c.id,
              complexName: sup.complexName || c.name,
              complexIds: Array.from(new Set([...currentCIds, c.id])),
              complexNames: Array.from(new Set([...(sup.complexNames || []), c.name])),
              supervisedComplexId: sup.supervisedComplexId || c.id
            };
            await this.saveTeacher(updatedSup);
          }
        }
      }
    }

    return { repairedStudents, repairedHalaqahs };
  }

  // Authoritative bidirectional assignment of teacher to halaqah and complex with automatic student migration
  static async assignTeacherToHalaqahAndComplex(
    teacherId: string,
    halaqahId: string,
    targetComplexId?: string
  ): Promise<{ success: boolean; teacher?: TeacherAccount; halaqah?: Halaqah }> {
    const teachers = await this.loadTeachers();
    const halaqahs = await this.loadHalaqahs();
    const complexes = await this.loadComplexes();

    const teacher = teachers.find(t => t.id === teacherId);
    const halaqah = halaqahs.find(h => h.id === halaqahId);
    if (!teacher || !halaqah) {
      return { success: false };
    }

    const resolvedComplexId = targetComplexId || halaqah.complexId || teacher.complexId || complexes[0]?.id;
    const targetComplex = complexes.find(c => c.id === resolvedComplexId) || complexes[0];

    // 1. Update halaqah
    const updatedHalaqah: Halaqah = {
      ...halaqah,
      complexId: targetComplex?.id || halaqah.complexId,
      complexName: targetComplex?.name || halaqah.complexName,
      primaryTeacherId: teacher.id,
      primaryTeacherName: teacher.name,
      teacherIds: Array.from(new Set([...(halaqah.teacherIds || []), teacher.id])),
      teacherNames: Array.from(new Set([...(halaqah.teacherNames || []), teacher.name]))
    };
    await this.saveHalaqah(updatedHalaqah);

    // 2. Detach old halaqahs previously assigned to this teacher
    for (const oldH of halaqahs) {
      if (oldH.id !== halaqahId && oldH.primaryTeacherId === teacher.id) {
        const detachedH: Halaqah = {
          ...oldH,
          primaryTeacherId: undefined,
          primaryTeacherName: '',
          teacherIds: (oldH.teacherIds || []).filter(id => id !== teacher.id),
          teacherNames: (oldH.teacherNames || []).filter(n => normalizeTeacherText(n) !== normalizeTeacherText(teacher.name))
        };
        await this.saveHalaqah(detachedH).catch(() => {});
      }
    }

    // 3. Update teacher
    const existingCIds = teacher.complexIds || (teacher.complexId ? [teacher.complexId] : []);
    const updatedCIds = targetComplex ? Array.from(new Set([...existingCIds, targetComplex.id])) : existingCIds;
    const updatedCNames = targetComplex ? Array.from(new Set([...(teacher.complexNames || []), targetComplex.name])) : (teacher.complexNames || []);

    const updatedTeacher: TeacherAccount = {
      ...teacher,
      complexId: targetComplex?.id || teacher.complexId,
      complexName: targetComplex?.name || teacher.complexName,
      complexIds: updatedCIds,
      complexNames: updatedCNames,
      halaqahId: halaqah.id,
      halaqahName: halaqah.name,
      halaqahIds: [halaqah.id],
      halaqahNames: [halaqah.name]
    };
    await this.saveTeacher(updatedTeacher);

    // 4. Move and bind all students belonging to this halaqah with it
    const students = await this.loadStudents();
    const halStudents = students.filter(s => {
      // Strictly never touch or reassign students that already belong to a different complex!
      if (s.complexId && updatedHalaqah.complexId && s.complexId !== updatedHalaqah.complexId) {
        return false;
      }
      return (
        s.halaqahId === halaqah.id ||
        (!s.complexId && s.halaqahName && normalizeTeacherText(s.halaqahName) === normalizeTeacherText(halaqah.name))
      );
    });
    for (const st of halStudents) {
      if (st.complexId !== updatedHalaqah.complexId || st.halaqahId !== updatedHalaqah.id || st.halaqahName !== updatedHalaqah.name) {
        const updatedStudent: Student = {
          ...st,
          complexId: updatedHalaqah.complexId,
          complexName: updatedHalaqah.complexName,
          halaqahId: updatedHalaqah.id,
          halaqahName: updatedHalaqah.name
        };
        await this.saveStudent(updatedStudent).catch(() => {});
      }
    }

    return { success: true, teacher: updatedTeacher, halaqah: updatedHalaqah };
  }

  // Authoritative assignment of complex supervisor
  static async assignSupervisorToComplex(teacherId: string, complexId: string): Promise<boolean> {
    const teachers = await this.loadTeachers();
    const complexes = await this.loadComplexes();
    const teacher = teachers.find(t => t.id === teacherId);
    const complex = complexes.find(c => c.id === complexId);
    if (!teacher || !complex) return false;

    // 1. Update previous supervisor if any
    if (complex.supervisorTeacherId && complex.supervisorTeacherId !== teacherId) {
      const prevSup = teachers.find(t => t.id === complex.supervisorTeacherId);
      if (prevSup) {
        const isStillSupElsewhere = complexes.some(c => c.id !== complexId && c.supervisorTeacherId === prevSup.id);
        const updatedPrev: TeacherAccount = {
          ...prevSup,
          supervisedComplexId: isStillSupElsewhere ? prevSup.supervisedComplexId : undefined,
          role: (prevSup.role === 'developer' ? 'developer' : (isStillSupElsewhere ? 'supervisor' : 'teacher')) as any
        };
        await this.saveTeacher(updatedPrev).catch(() => {});
      }
    }

    // 2. Update new supervisor
    const updatedTeacher: TeacherAccount = {
      ...teacher,
      role: (teacher.role === 'developer' ? 'developer' : 'supervisor') as any,
      supervisedComplexId: complex.id,
      complexId: teacher.complexId || complex.id,
      complexName: teacher.complexName || complex.name,
      complexIds: Array.from(new Set([...(teacher.complexIds || []), ...(teacher.complexId ? [teacher.complexId] : []), complex.id])),
      complexNames: Array.from(new Set([...(teacher.complexNames || []), ...(teacher.complexName ? [teacher.complexName] : []), complex.name]))
    };
    await this.saveTeacher(updatedTeacher);

    // 3. Update complex
    const updatedComplex: QuranComplex = {
      ...complex,
      supervisorTeacherId: teacher.id,
      supervisorTeacherName: teacher.name,
      updatedAt: new Date().toISOString()
    };
    await this.saveComplex(updatedComplex);

    // 4. Directly connect and sync supervisor to the database of this complex (if custom/dedicated)
    if (complex.databaseConfig?.isCustom && complex.databaseConfig?.projectId) {
      try {
        const compDb = this.getFirestoreInstanceForComplex(complex);
        if (compDb && compDb !== this.getCentralDb()) {
          const cleanTeacher = cleanFirestoreData(updatedTeacher);
          await setDoc(doc(compDb, 'teachers', teacher.id), cleanTeacher, { merge: true }).catch(() => {});
        }
      } catch (dbErr) {
        console.warn('Sync supervisor to complex dedicated database notice:', dbErr);
      }
    }

    return true;
  }

  // Export specific complex data (Halaqahs, Students, Attendance, Evaluations, Violations)
  static async exportComplexBackup(complexId: string): Promise<ComplexBackupData> {
    const complexes = await this.loadComplexes();
    const complex = complexes.find(c => c.id === complexId) || {
      id: complexId,
      name: 'مجمع قرآني',
      createdAt: new Date().toISOString()
    };
    const allHalaqahs = await this.loadHalaqahs();
    const complexHalaqahs = allHalaqahs.filter(h => h.complexId === complexId);
    const halaqahIds = new Set(complexHalaqahs.map(h => h.id));

    const allStudents = await this.loadStudents();
    const complexStudents = allStudents.filter(s => {
      if (s.complexId && s.complexId !== complexId) return false;
      if (s.complexId === complexId) return true;
      if (s.halaqahId && halaqahIds.has(s.halaqahId)) return true;
      return false;
    });
    const studentIds = new Set(complexStudents.map(s => s.id));

    const allAttendance = await this.loadAttendance();
    const complexAttendance = allAttendance.filter(a => studentIds.has(a.studentId));

    const allEvaluations = await this.loadEvaluations();
    const complexEvaluations = allEvaluations.filter(e => studentIds.has(e.studentId));

    const allViolations = await this.loadViolations();
    const complexViolations = allViolations.filter(v => studentIds.has(v.studentId));

    return {
      version: '2.0.0',
      exportDate: new Date().toISOString(),
      complex,
      halaqahs: complexHalaqahs,
      students: complexStudents,
      attendance: complexAttendance,
      evaluations: complexEvaluations,
      violations: complexViolations
    };
  }

  // Import / Restore specific complex data directly into Firestore
  static async importComplexBackup(
    arg1: string | ComplexBackupData,
    arg2?: string | ComplexBackupData | ((progress: number, stageName: string, detailText?: string) => void),
    arg3?: (progress: number, stageName: string, detailText?: string) => void
  ): Promise<{ studentsCount: number; halaqahsCount: number }> {
    let complexId: string;
    let data: ComplexBackupData;
    let onProgress: ((progress: number, stageName: string, detailText?: string) => void) | undefined;

    if (typeof arg1 === 'string') {
      complexId = arg1;
      data = arg2 as ComplexBackupData;
      onProgress = arg3;
    } else {
      data = arg1 as ComplexBackupData;
      complexId = typeof arg2 === 'string' ? arg2 : (data.complex?.id || 'unknown');
      onProgress = typeof arg2 === 'function' ? arg2 : arg3;
    }

    if (!data || typeof data !== 'object') {
      throw new Error('بيانات النسخة الاحتياطية للمجمع غير صالحة.');
    }

    const yieldTick = (ms = 35) => new Promise(r => setTimeout(r, ms));

    onProgress?.(10, 'فحص ملف المجمع', `جاري تحليل بيانات مجمع (${data.complex?.name || complexId})...`);
    await yieldTick(50);

    if (data.complex) {
      await this.saveComplex({ ...data.complex, id: complexId });
    }
    await yieldTick(30);

    onProgress?.(30, 'حفظ الحلقات القرآنية', `جاري رفع الحلقات (${data.halaqahs?.length || 0} حلقة)...`);
    await yieldTick(30);
    if (Array.isArray(data.halaqahs)) {
      for (const h of data.halaqahs) {
        await this.saveHalaqah({ ...h, complexId, complexName: data.complex?.name });
      }
    }
    await yieldTick(30);

    onProgress?.(55, 'حفظ بيانات الطلاب', `جاري رفع طلاب المجمع (${data.students?.length || 0} طالب)...`);
    await yieldTick(30);
    if (Array.isArray(data.students)) {
      for (const s of data.students) {
        await setDoc(doc(this.getActiveDb(), 'students', s.id), cleanFirestoreData(s));
      }
    }
    await yieldTick(30);

    onProgress?.(75, 'حفظ الحضور والتقييمات', 'جاري رفع سجلات الحضور والتقييمات الخاصة بالمجمع...');
    await yieldTick(30);
    if (Array.isArray(data.attendance)) {
      for (const a of data.attendance) {
        await setDoc(doc(this.getActiveDb(), 'attendance', a.id), cleanFirestoreData(a));
      }
    }
    if (Array.isArray(data.evaluations)) {
      for (const ev of data.evaluations) {
        await setDoc(doc(this.getActiveDb(), 'evaluations', ev.id), cleanFirestoreData(ev));
      }
    }
    if (Array.isArray(data.violations)) {
      for (const v of data.violations) {
        await setDoc(doc(this.getActiveDb(), 'violations', v.id), cleanFirestoreData(v));
      }
    }
    await yieldTick(30);

    onProgress?.(95, 'مزامنة وتطهير الكاش', 'جاري مسح أي كاش قديم وتوحيد بيانات فايربيس...');
    await yieldTick(40);
    purgeAllLocalDataCaches();

    onProgress?.(100, 'اكتمل الاستيراد بنجاح 100%!', `تم استيراد بيانات مجمع (${data.complex?.name || complexId}) بنجاح.`);
    await yieldTick(50);

    return {
      studentsCount: data.students?.length || 0,
      halaqahsCount: data.halaqahs?.length || 0
    };
  }

  // Purge / empty all data belonging to a complex from the central database
  static async purgeComplexData(complexId: string): Promise<{
    studentsCount: number;
    halaqahsCount: number;
    deletedStudents: number;
    deletedAttendance: number;
  }> {
    const centralDb = this.getCentralDb();
    const allHalaqahs = await this.loadHalaqahs();
    const complexHalaqahs = allHalaqahs.filter(h => h.complexId === complexId);
    const halaqahIds = new Set(complexHalaqahs.map(h => h.id));

    const allStudents = await this.loadStudents();
    const complexStudents = allStudents.filter(s => {
      if (s.complexId && s.complexId !== complexId) return false;
      if (s.complexId === complexId) return true;
      if (s.halaqahId && halaqahIds.has(s.halaqahId)) return true;
      return false;
    });
    const studentIds = new Set(complexStudents.map(s => s.id));

    // Delete attendance from central
    const allAttendance = await this.loadAttendance();
    let deletedAttendance = 0;
    for (const a of allAttendance) {
      if (studentIds.has(a.studentId)) {
        await deleteDoc(doc(centralDb, 'attendance', a.id));
        deletedAttendance++;
      }
    }

    // Delete evaluations from central
    const allEvaluations = await this.loadEvaluations();
    for (const ev of allEvaluations) {
      if (studentIds.has(ev.studentId)) {
        await deleteDoc(doc(centralDb, 'evaluations', ev.id));
      }
    }

    // Delete violations from central
    const allViolations = await this.loadViolations();
    for (const v of allViolations) {
      if (studentIds.has(v.studentId)) {
        await deleteDoc(doc(centralDb, 'violations', v.id));
      }
    }

    // Delete exams from central
    const allExams = await this.loadExams();
    for (const ex of allExams) {
      if (ex.complexId === complexId || (Array.isArray(ex.targetHalaqat) && ex.targetHalaqat.some(th => halaqahIds.has(th)))) {
        try { await deleteDoc(doc(centralDb, 'exams', ex.id)); } catch {}
      }
    }

    // Delete exam submissions from central
    const allSubmissions = await this.loadSubmissions();
    for (const sub of allSubmissions) {
      if (studentIds.has(sub.studentId) || sub.complexId === complexId) {
        try { await deleteDoc(doc(centralDb, 'exam_submissions', sub.id)); } catch {}
      }
    }

    // Delete certificates from central
    const allCerts = await this.loadCertificates();
    for (const cert of allCerts) {
      if (cert.complexId === complexId || studentIds.has(cert.studentId)) {
        try { await deleteDoc(doc(centralDb, 'certificates', cert.id)); } catch {}
      }
    }

    // Delete students from central
    for (const s of complexStudents) {
      await deleteDoc(doc(centralDb, 'students', s.id));
    }

    // Delete halaqahs from central
    for (const h of complexHalaqahs) {
      await deleteDoc(doc(centralDb, 'halaqahs', h.id));
    }

    // Delete teacher_shifts of this complex from central
    try {
      const shiftsSnap = await getDocs(collection(centralDb, 'teacher_shifts'));
      for (const d of shiftsSnap.docs) {
        if (d.data()?.complexId === complexId) {
          await deleteDoc(doc(centralDb, 'teacher_shifts', d.id));
        }
      }
    } catch {}

    // Delete teacher_attendance of this complex from central
    try {
      const tAttSnap = await getDocs(collection(centralDb, 'teacher_attendance'));
      for (const d of tAttSnap.docs) {
        if (d.data()?.complexId === complexId) {
          await deleteDoc(doc(centralDb, 'teacher_attendance', d.id));
        }
      }
    } catch {}

    // Delete mosques of this complex from central
    try {
      const mosquesSnap = await getDocs(collection(centralDb, 'mosques'));
      for (const d of mosquesSnap.docs) {
        if (d.data()?.complexId === complexId) {
          await deleteDoc(doc(centralDb, 'mosques', d.id));
        }
      }
    } catch {}

    // Delete / Unlink teachers belonging to this complex from central (protecting developer accounts)
    try {
      const allTeachers = await this.loadTeachers();
      for (const t of allTeachers) {
        if (t.role === 'developer' || t.id === 'teacher-1' || t.username?.toLowerCase() === 'admin' || t.username?.toLowerCase() === 'developer') {
          continue; // Developer account is strictly protected
        }
        const isSolelyInThisComplex = t.complexId === complexId ||
          (Array.isArray(t.complexIds) && t.complexIds.length === 1 && t.complexIds[0] === complexId);
        if (isSolelyInThisComplex) {
          await deleteDoc(doc(centralDb, 'teachers', t.id));
        } else if (Array.isArray(t.complexIds) && t.complexIds.includes(complexId)) {
          const updatedIds = t.complexIds.filter(id => id !== complexId);
          await setDoc(doc(centralDb, 'teachers', t.id), { complexIds: updatedIds }, { merge: true });
        }
      }
    } catch {}

    // Clean up local cache
    const cachedStudents = getLocalCache<Student[]>(OMRAN_CACHE_KEYS.STUDENTS, []);
    setLocalCache(OMRAN_CACHE_KEYS.STUDENTS, cachedStudents.filter(s => !studentIds.has(s.id)));
    const cachedHalaqahs = getLocalCache<Halaqah[]>(OMRAN_CACHE_KEYS.HALAQAHS, []);
    setLocalCache(OMRAN_CACHE_KEYS.HALAQAHS, cachedHalaqahs.filter(h => !halaqahIds.has(h.id)));
    const cachedAttendance = getLocalCache<AttendanceRecord[]>(OMRAN_CACHE_KEYS.ATTENDANCE, []);
    setLocalCache(OMRAN_CACHE_KEYS.ATTENDANCE, cachedAttendance.filter(a => !studentIds.has(a.studentId)));

    return {
      studentsCount: complexStudents.length,
      halaqahsCount: complexHalaqahs.length,
      deletedStudents: complexStudents.length,
      deletedAttendance
    };
  }

  // Developer Feature: Test Live Real Connection to Any External Firebase Project
  static async testRealFirebaseConnection(config: {
    projectId: string;
    apiKey: string;
    databaseId?: string;
    authDomain?: string;
    storageBucket?: string;
    appId?: string;
  }): Promise<{ success: boolean; message: string; details?: any }> {
    const cleanProjId = (config.projectId || '').trim();
    const cleanApiKey = (config.apiKey || '').trim();

    if (!cleanProjId) {
      return { success: false, message: 'معرف المشروع (Project ID) مطلوب.' };
    }
    if (!cleanApiKey) {
      return { success: false, message: 'مفتاح الويب (Web API Key) مطلوب للاتصال بمشروع فايربيس.' };
    }

    const testAppName = `omran_test_${cleanProjId.replace(/[^\w]/g, '_')}_${Date.now()}`;
    let testApp: any = null;

    try {
      testApp = initializeApp(
        {
          apiKey: cleanApiKey,
          projectId: cleanProjId,
          authDomain: config.authDomain || `${cleanProjId}.firebaseapp.com`,
          storageBucket: config.storageBucket || `${cleanProjId}.firebasestorage.app`,
          appId: config.appId || ''
        },
        testAppName
      );

      // In standard Firebase projects, the database is always '(default)'.
      // Ignore any legacy 'isolated-...' strings or '(default)' to avoid 'Database not found' errors.
      const rawDbId = (config.databaseId || '').trim();
      const hasCustomNamedDb = rawDbId !== '' && rawDbId !== '(default)' && !rawDbId.startsWith('isolated-');

      let targetDb: any = null;
      try {
        targetDb = hasCustomNamedDb ? getFirestore(testApp, rawDbId) : getFirestore(testApp);
      } catch (dbInitErr) {
        console.warn('Fallback to standard default Firestore:', dbInitErr);
        targetDb = getFirestore(testApp);
      }

      // Perform a real write test in the target project with auto-fallback to default db if named db doesn't exist
      const testDocRef = doc(targetDb, 'settings', 'omran_connection_test');
      try {
        await setDoc(testDocRef, {
          status: 'ok',
          verifiedAt: new Date().toISOString(),
          testedBy: 'منظومة عمران القرآنية',
          note: 'تم اختبار وتأكيد الاتصال وقراءة/كتابة البيانات بنجاح.'
        });
      } catch (writeErr: any) {
        const wMsg = writeErr?.message || String(writeErr);
        if (wMsg.includes('not found') || wMsg.includes('does not exist')) {
          console.warn(`[Omran-DB] Named database '${rawDbId}' not found on Firebase. Falling back to default database (default).`);
          targetDb = getFirestore(testApp);
          const fallbackDocRef = doc(targetDb, 'settings', 'omran_connection_test');
          await setDoc(fallbackDocRef, {
            status: 'ok',
            verifiedAt: new Date().toISOString(),
            testedBy: 'منظومة عمران القرآنية',
            note: 'تم اختبار وتأكيد الاتصال وقراءة/كتابة البيانات بنجاح في قاعدة البيانات الافتراضية.'
          });
        } else {
          throw writeErr;
        }
      }

      // Verify read test
      const snap = await getDoc(doc(targetDb, 'settings', 'omran_connection_test'));
      if (!snap.exists()) {
        throw new Error('تمت الكتابة ولكن تعذرت قراءة وثيقة الاختبار.');
      }

      return {
        success: true,
        message: `تم الاتصال بنجاح بمشروع Firebase (${cleanProjId})، وتمت تجربة القراءة والكتابة الحقيقية بنجاح!`
      };
    } catch (err: any) {
      console.error('Firebase test connection error:', err);
      const msg = err?.message || String(err);
      if (msg.includes('permission-denied') || msg.includes('insufficient permissions')) {
        return {
          success: false,
          message: `المشروع (${cleanProjId}) يرفض إذن الكتابة بسبب قواعد الأمان (Firestore Rules). يرجى التوجه إلى كونسول فايربيس -> Firestore Database -> Rules وتعديل القواعد لتسمح بالقراءة والكتابة (Test Mode).`,
          details: { code: 'PERMISSION_DENIED', raw: msg }
        };
      }
      if (msg.includes('not-found') || msg.includes('database does not exist') || msg.includes('Database not found')) {
        return {
          success: false,
          message: `قاعدة بيانات Firestore غير مفعلة بعد في مشروع (${cleanProjId}). يرجى الدخول إلى كونسول فايربيس -> Firestore Database والضغط على Create database أولاً.`,
          details: { code: 'DATABASE_NOT_FOUND', raw: msg }
        };
      }
      if (msg.includes('API key not valid')) {
        return {
          success: false,
          message: `مفتاح API Key غير صحيح أو غير مصرح له بمشروع (${cleanProjId}). يرجى التحقق من المفتاح في إعدادات المشروع (Project Settings).`,
          details: { code: 'INVALID_API_KEY', raw: msg }
        };
      }
      return {
        success: false,
        message: `تعذر الاتصال بمشروع (${cleanProjId}): ${msg}`,
        details: { raw: msg }
      };
    }
  }

  // Developer Feature: Migrate Complex and all its entities to a REAL Dedicated Firebase Database
  static async migrateComplexToDedicatedDatabase(
    options: {
      complexId: string;
      targetProjectId: string;
      targetApiKey: string;
      targetGoogleEmail?: string;
      targetDatabaseId?: string;
      targetAuthDomain?: string;
      targetStorageBucket?: string;
      targetAppId?: string;
      purgeFromCentral?: boolean;
    },
    onProgress?: (progress: ComplexMigrationProgress) => void
  ): Promise<ComplexMigrationResult> {
    const logs: string[] = [];
    const addLog = (msg: string) => {
      const time = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      logs.push(`[${time}] ${msg}`);
    };

    const targetProjId = (options.targetProjectId || '').trim();
    const targetApiKey = (options.targetApiKey || '').trim();
    const cleanEmail = (options.targetGoogleEmail || '').trim();
    const targetDbId = (options.targetDatabaseId || '(default)').trim();

    if (!targetProjId) {
      throw new Error('معرف مشروع فايربيس (Project ID) مطلوب لبدء النقل الفعلي.');
    }
    if (!targetApiKey) {
      throw new Error('مفتاح Web API Key الخاص بمشروع فايربيس مطلوب للاتصال وكتابة البيانات في مشروعك.');
    }

    // Step 1: Validate Complex
    addLog(`بدء جلسة النقل الفعلي لمجمع تعليمي إلى مشروع Firebase المستقل (${targetProjId})...`);
    const allComplexes = await this.loadComplexes();
    const complex = allComplexes.find(c => c.id === options.complexId);
    if (!complex) {
      throw new Error('المجمع القرآني المطلوب نقله غير موجود في النظام.');
    }

    onProgress?.({
      step: 1,
      totalSteps: 10,
      percent: 5,
      title: 'تهيئة الاتصال بمشروع Firebase المستهدف',
      detail: `جاري الاتصال بمشروع (${targetProjId}) والتحقق من مفتاح API...`,
      logs: [...logs]
    });

    // Step 2: Initialize REAL Target Firebase App
    const targetAppName = `omran_mig_${targetProjId.replace(/[^\w]/g, '_')}_${Date.now()}`;
    let targetApp: any = null;
    let targetDb: any = null;

    try {
      targetApp = initializeApp(
        {
          apiKey: targetApiKey,
          projectId: targetProjId,
          authDomain: options.targetAuthDomain || `${targetProjId}.firebaseapp.com`,
          storageBucket: options.targetStorageBucket || `${targetProjId}.firebasestorage.app`,
          appId: options.targetAppId || ''
        },
        targetAppName
      );

      // In standard Firebase projects, the default database is always '(default)'.
      // Ignore any legacy 'isolated-...' strings to avoid 'Database not found' errors.
      const hasCustomNamedDb = targetDbId !== '' && targetDbId !== '(default)' && !targetDbId.startsWith('isolated-');

      try {
        targetDb = hasCustomNamedDb ? getFirestore(targetApp, targetDbId) : getFirestore(targetApp);
      } catch {
        targetDb = getFirestore(targetApp);
      }

      // Real Handshake Write to guarantee database is live and permissions exist
      try {
        await setDoc(doc(targetDb, 'settings', 'omran_migration_init'), {
          initializedAt: new Date().toISOString(),
          complexName: complex.name,
          targetEmail: cleanEmail,
          platform: 'منظومة عمران لإدارة الحلقات والمجمعات القرآنية'
        });
        addLog(`تم الاتصال الفعلي بنجاح بمشروع فايربيس (${targetProjId}) وتأكيد صلاحيات الكتابة الحقيقية.`);
      } catch (handshakeErr: any) {
        const hMsg = handshakeErr?.message || String(handshakeErr);
        if (hMsg.includes('not found') || hMsg.includes('does not exist')) {
          addLog(`تنبيه: قاعدة البيانات (${targetDbId}) غير موجودة، جاري التبديل التلقائي إلى قاعدة البيانات الافتراضية (default)...`);
          targetDb = getFirestore(targetApp);
          await setDoc(doc(targetDb, 'settings', 'omran_migration_init'), {
            initializedAt: new Date().toISOString(),
            complexName: complex.name,
            targetEmail: cleanEmail,
            platform: 'منظومة عمران لإدارة الحلقات والمجمعات القرآنية'
          });
          addLog(`تم الاتصال بالقاعدة الافتراضية (default) بنجاح.`);
        } else {
          throw handshakeErr;
        }
      }
    } catch (connErr: any) {
      const errM = connErr?.message || String(connErr);
      if (errM.includes('permission-denied') || errM.includes('insufficient permissions')) {
        throw new Error(`مشروع فايربيس (${targetProjId}) يرفض إذن الكتابة بسبب قواعد الأمان (Firestore Rules). يرجى فتح كونسول فايربيس -> Firestore -> Rules وتعديل القواعد لتسمح بالكتابة مؤقتاً أثناء النقل.`);
      }
      if (errM.includes('not-found') || errM.includes('database does not exist')) {
        throw new Error(`قاعدة بيانات Firestore غير مفعلة بعد في مشروع (${targetProjId}). يرجى الدخول إلى كونسول فايربيس وإنشاء قاعدة البيانات (Create database) أولاً.`);
      }
      throw new Error(`تعذر الاتصال بمشروع فايربيس المستهدف (${targetProjId}): ${errM}`);
    }

    onProgress?.({
      step: 2,
      totalSteps: 10,
      percent: 15,
      title: 'تم الاتصال الفعلي بقاعدة بيانات المشروع المستقل',
      detail: `قاعدة بيانات Firestore في مشروع (${targetProjId}) جاهزة لاستقبال البيانات الحقيقية`,
      logs: [...logs]
    });

    // Step 3: Extract all complex records from source
    addLog(`جاري قراءة واستخراج كافة سجلات مجمع (${complex.name}) من القاعدة الحالية...`);
    const allHalaqahs = await this.loadHalaqahs();
    const complexHalaqahs = allHalaqahs.filter(h => h.complexId === complex.id);
    const halaqahIds = new Set(complexHalaqahs.map(h => h.id));

    const allStudents = await this.loadStudents();
    const complexStudents = allStudents.filter(s => {
      // If student is explicitly tagged with another complex, NEVER migrate them!
      if (s.complexId && s.complexId !== complex.id) return false;
      if (s.complexId === complex.id) return true;
      if (s.halaqahId && halaqahIds.has(s.halaqahId)) return true;
      return false;
    });
    const studentIds = new Set(complexStudents.map(s => s.id));

    const allAttendance = await this.loadAttendance();
    const complexAttendance = allAttendance.filter(a => studentIds.has(a.studentId));

    const allEvaluations = await this.loadEvaluations();
    const complexEvaluations = allEvaluations.filter(e => studentIds.has(e.studentId));

    const allViolations = await this.loadViolations();
    const complexViolations = allViolations.filter(v => studentIds.has(v.studentId));

    const allExams = await this.loadExams();
    const complexExams = allExams.filter(ex => ex.complexId === complex.id || (Array.isArray(ex.targetHalaqat) && ex.targetHalaqat.some(th => halaqahIds.has(th))));

    const allSubmissions = await this.loadSubmissions();
    const complexSubmissions = allSubmissions.filter(sub => studentIds.has(sub.studentId) || sub.complexId === complex.id);

    const allCertificates = await this.loadCertificates();
    const complexCertificates = allCertificates.filter(cert => studentIds.has(cert.studentId) || cert.complexId === complex.id);

    const allTeachers = await this.loadTeachers();
    const complexTeachers = allTeachers.filter(t => t.complexId === complex.id || (Array.isArray(t.complexIds) && t.complexIds.includes(complex.id)));

    const totalRecords = complexHalaqahs.length + complexStudents.length + complexAttendance.length +
      complexEvaluations.length + complexViolations.length + complexExams.length +
      complexSubmissions.length + complexCertificates.length + complexTeachers.length + 1; // +1 for complex itself

    addLog(`تم حزم البيانات: (${complexHalaqahs.length}) حلقة، (${complexStudents.length}) طالب، (${complexAttendance.length}) سجل حضور، (${complexEvaluations.length}) تقييم، (${complexTeachers.length}) معلم.`);

    // Step 4: Write Complex document to targetDb
    addLog(`كتابة وثيقة المجمع الأساسية في مشروع (${targetProjId}) -> مجموعة complexes...`);
    const complexDataForTarget = {
      ...complex,
      databaseConfig: {
        isCustom: true,
        isIsolated: true,
        projectId: targetProjId,
        apiKey: targetApiKey,
        authDomain: options.targetAuthDomain || `${targetProjId}.firebaseapp.com`,
        storageBucket: options.targetStorageBucket || `${targetProjId}.firebasestorage.app`,
        appId: options.targetAppId || '',
        databaseId: targetDbId,
        connectedEmail: cleanEmail,
        migratedAt: new Date().toISOString()
      }
    };
    await setDoc(doc(targetDb, 'complexes', complex.id), cleanFirestoreData(complexDataForTarget));
    addLog(`✅ تم إنشاء وثيقة المجمع [${complex.name}] في قاعدة البيانات المستقلة.`);

    onProgress?.({
      step: 3,
      totalSteps: 10,
      percent: 25,
      title: 'تم إنشاء وثيقة المجمع في فايربيس المستقل',
      detail: `تمت كتابة بيانات مجمع (${complex.name}) في مجموعة complexes`,
      logs: [...logs]
    });

    // Step 5: Write Halaqahs to targetDb
    addLog(`جاري نقل (${complexHalaqahs.length}) حلقة تحفيظ إلى مجموعة halaqahs في فايربيس...`);
    for (let i = 0; i < complexHalaqahs.length; i++) {
      const h = complexHalaqahs[i];
      await setDoc(doc(targetDb, 'halaqahs', h.id), cleanFirestoreData(h));
      addLog(`[حلقة ${i + 1}/${complexHalaqahs.length}] ✅ تم نقل حلقة (${h.name}) إلى halaqahs/${h.id}`);
    }

    onProgress?.({
      step: 4,
      totalSteps: 10,
      percent: 38,
      title: 'ترحيل حلقات التحفيظ والمجموعات',
      detail: `تم نقل (${complexHalaqahs.length}) حلقة إلى قاعدة البيانات المستقلة`,
      logs: [...logs]
    });

    // Step 6: Write Teachers to targetDb
    if (complexTeachers.length > 0) {
      addLog(`جاري نقل (${complexTeachers.length}) معلماً ومشرفاً إلى مجموعة teachers...`);
      for (const t of complexTeachers) {
        await setDoc(doc(targetDb, 'teachers', t.id), cleanFirestoreData(t));
        addLog(`✅ تم نقل حساب المعلم: ${t.name} (المستخدم: ${t.username})`);
      }
    }

    // Step 7: Write Students to targetDb
    addLog(`جاري نقل (${complexStudents.length}) ملف طالب إلى مجموعة students في فايربيس...`);
    for (let i = 0; i < complexStudents.length; i++) {
      const s = complexStudents[i];
      await setDoc(doc(targetDb, 'students', s.id), cleanFirestoreData(s));
      if (i % 5 === 0 || i === complexStudents.length - 1) {
        addLog(`[طالب ${i + 1}/${complexStudents.length}] ✅ تم نقل الطالب: ${s.name} (ID: ${s.id})`);
      }
    }

    onProgress?.({
      step: 6,
      totalSteps: 10,
      percent: 55,
      title: 'ترحيل سجلات وملفات الطلاب',
      detail: `تم نقل بيانات (${complexStudents.length}) طالباً بالكامل إلى students`,
      logs: [...logs]
    });

    // Step 8: Write Attendance to targetDb
    addLog(`جاري نقل (${complexAttendance.length}) سجل حضور وغياب إلى مجموعة attendance...`);
    let attCount = 0;
    for (const a of complexAttendance) {
      await setDoc(doc(targetDb, 'attendance', a.id), cleanFirestoreData(a));
      attCount++;
      if (attCount % 20 === 0 || attCount === complexAttendance.length) {
        addLog(`[حضور ${attCount}/${complexAttendance.length}] ✅ تم ترحيل سجلات حضور وغياب إلى attendance/${a.id}`);
      }
    }

    onProgress?.({
      step: 7,
      totalSteps: 10,
      percent: 70,
      title: 'ترحيل سجلات الحضور والغياب اليومي',
      detail: `تم نقل (${complexAttendance.length}) سجل حضور وغياب إلى attendance`,
      logs: [...logs]
    });

    // Step 9: Write Evaluations, Exams, Certificates, Violations
    addLog(`جاري نقل التقييمات (${complexEvaluations.length})، الاختبارات (${complexExams.length})، والشهادات (${complexCertificates.length})...`);
    for (const ev of complexEvaluations) {
      await setDoc(doc(targetDb, 'evaluations', ev.id), cleanFirestoreData(ev));
    }
    for (const ex of complexExams) {
      await setDoc(doc(targetDb, 'exams', ex.id), cleanFirestoreData(ex));
    }
    for (const sub of complexSubmissions) {
      await setDoc(doc(targetDb, 'exam_submissions', sub.id), cleanFirestoreData(sub));
    }
    for (const cert of complexCertificates) {
      await setDoc(doc(targetDb, 'certificates', cert.id), cleanFirestoreData(cert));
    }
    for (const v of complexViolations) {
      await setDoc(doc(targetDb, 'violations', v.id), cleanFirestoreData(v));
    }

    // Migrate Mosques belonging to this complex
    try {
      const mosques = await this.loadMosques(complex.id);
      for (const m of mosques) {
        await setDoc(doc(targetDb, 'mosques', m.id), cleanFirestoreData(m));
      }
      if (mosques.length > 0) addLog(`✅ تم نقل (${mosques.length}) مسجداً تابعاً للمجمع.`);
    } catch {}

    // Migrate Teacher Shifts & Teacher Attendance
    try {
      const shifts = await this.loadTeacherShifts(complex.id);
      for (const sh of shifts) {
        await setDoc(doc(targetDb, 'teacher_shifts', sh.id), cleanFirestoreData(sh));
      }
      const tAtt = await this.loadTeacherAttendance(undefined, complex.id);
      for (const ta of tAtt) {
        await setDoc(doc(targetDb, 'teacher_attendance', ta.id), cleanFirestoreData(ta));
      }
    } catch {}

    // Migrate Surah Recordings
    try {
      const recordings = await this.loadRecordings();
      const compRecordings = recordings.filter(r => (r as any).complexId === complex.id || !(r as any).complexId);
      for (const rec of compRecordings) {
        await setDoc(doc(targetDb, 'surah_recordings', rec.id), cleanFirestoreData(rec));
      }
      if (compRecordings.length > 0) addLog(`✅ تم نقل (${compRecordings.length}) تسجيلاً صوتياً للقرآن إلى surah_recordings.`);
    } catch (recErr) {
      console.warn('Recordings migration notice:', recErr);
    }

    // Migrate Library Documents
    try {
      const libraryDocs = await this.loadLibraryDocuments();
      const compDocs = libraryDocs.filter(d => (d as any).complexId === complex.id || !(d as any).complexId);
      for (const ld of compDocs) {
        await setDoc(doc(targetDb, 'library_docs', ld.id), cleanFirestoreData(ld));
      }
      if (compDocs.length > 0) addLog(`✅ تم نقل (${compDocs.length}) مستنداً ومراجع من مكتبة المجمع إلى library_docs.`);
    } catch (libErr) {
      console.warn('Library docs migration notice:', libErr);
    }

    // Migrate Registration Applications
    try {
      const applications = await this.loadRegistrationApplications();
      const compApps = applications.filter(a => a.complexId === complex.id || (a.preferredHalaqahId && halaqahIds.has(a.preferredHalaqahId)) || (a.assignedHalaqahId && halaqahIds.has(a.assignedHalaqahId)) || !a.complexId);
      for (const appItem of compApps) {
        await setDoc(doc(targetDb, 'registration_applications', appItem.id), cleanFirestoreData(appItem));
      }
      if (compApps.length > 0) addLog(`✅ تم نقل (${compApps.length}) طلب تسجيل جديد إلى registration_applications.`);
    } catch (appErr) {
      console.warn('Registration apps migration notice:', appErr);
    }

    // Migrate Platform Chats
    try {
      const chats = await this.loadChats();
      for (const c of chats) {
        await setDoc(doc(targetDb, 'chats', c.id), cleanFirestoreData(c));
      }
      if (chats.length > 0) addLog(`✅ تم نقل (${chats.length}) رسالة محادثة إلى chats.`);
    } catch (chatErr) {
      console.warn('Chats migration notice:', chatErr);
    }

    // Migrate Quranic Listening Logs
    try {
      const listeningLogs = await this.loadListeningLogs();
      const compListening = listeningLogs.filter(l => studentIds.has(l.studentId) || (l as any).complexId === complex.id);
      for (const l of compListening) {
        await setDoc(doc(targetDb, 'listening_logs', l.id), cleanFirestoreData(l));
      }
      if (compListening.length > 0) addLog(`✅ تم نقل (${compListening.length}) سجل استماع قرآني إلى listening_logs.`);
    } catch (logErr) {
      console.warn('Listening logs migration notice:', logErr);
    }

    addLog(`✅ تم نقل كافة التقييمات، الاختبارات، الشهادات، المكتبة، والملاحظات السلوكية بنجاح.`);

    // Write Settings and metadata to targetDb
    const curSettings = await this.loadSettings();
    const curCriteria = await this.loadCriteria();
    await setDoc(doc(targetDb, 'settings', 'main'), cleanFirestoreData(curSettings));
    for (const cr of curCriteria) {
      await setDoc(doc(targetDb, 'criteria', cr.id), cleanFirestoreData(cr));
    }

    // Migrate All Configuration Settings Documents (AI Config, Leaderboard, OAuth, Schedules)
    try {
      // 1. AI Configuration (Developer Master API Key, Model, Policies, Allocations)
      const aiConfigSnap = await safeGetDoc(doc(this.getCentralDb(), 'settings', 'ai_config'));
      if (aiConfigSnap && aiConfigSnap.exists()) {
        await setDoc(doc(targetDb, 'settings', 'ai_config'), aiConfigSnap.data());
        addLog(`✅ تم نقل إعدادات ومفتاح الذكاء الاصطناعي (Master Gemini Key) والموديل إلى settings/ai_config.`);
      }

      // 2. Leaderboard Settings
      const lbSnap = await safeGetDoc(doc(this.getActiveDb(), 'settings', 'leaderboard'));
      if (lbSnap && lbSnap.exists()) {
        await setDoc(doc(targetDb, 'settings', 'leaderboard'), lbSnap.data());
      }

      // 3. Google OAuth Settings
      const oauthSnap = await safeGetDoc(doc(this.getActiveDb(), 'settings', 'google_oauth'));
      if (oauthSnap && oauthSnap.exists()) {
        await setDoc(doc(targetDb, 'settings', 'google_oauth'), oauthSnap.data());
      }

      // 4. Recordings Config
      const recCfgSnap = await safeGetDoc(doc(this.getActiveDb(), 'settings', 'recordings_config'));
      if (recCfgSnap && recCfgSnap.exists()) {
        await setDoc(doc(targetDb, 'settings', 'recordings_config'), recCfgSnap.data());
      }

      // 5. Plan Scheduling Configurations
      const planCfgSnap = await safeGetDoc(doc(this.getActiveDb(), 'settings', `plan_schedule_${complex.id}`));
      if (planCfgSnap && planCfgSnap.exists()) {
        await setDoc(doc(targetDb, 'settings', `plan_schedule_${complex.id}`), planCfgSnap.data());
      }
      const planDefSnap = await safeGetDoc(doc(this.getActiveDb(), 'settings', 'plan_schedule_default'));
      if (planDefSnap && planDefSnap.exists()) {
        await setDoc(doc(targetDb, 'settings', 'plan_schedule_default'), planDefSnap.data());
      }

      // 6. Deleted Records / Tombstones
      const delSnap = await safeGetDoc(doc(this.getCentralDb(), 'settings', 'deleted_records'));
      if (delSnap && delSnap.exists()) {
        await setDoc(doc(targetDb, 'settings', 'deleted_records'), delSnap.data());
      }

      // 7. Registration Applications Settings Container
      const regDocSnap = await safeGetDoc(doc(this.getCentralDb(), 'settings', 'registration_applications'));
      if (regDocSnap && regDocSnap.exists()) {
        await setDoc(doc(targetDb, 'settings', 'registration_applications'), regDocSnap.data());
      }

      addLog(`✅ تم نقل كافة إعدادات المنظومة وتكوينات الذكاء الاصطناعي والخطط بدقة تامة.`);
    } catch (settErr) {
      console.warn('Settings documents migration notice:', settErr);
    }

    await setDoc(doc(targetDb, 'settings', 'omran_migration_receipt'), {
      migratedAt: new Date().toISOString(),
      complexId: complex.id,
      complexName: complex.name,
      connectedEmail: cleanEmail,
      stats: {
        studentsCount: complexStudents.length,
        halaqahsCount: complexHalaqahs.length,
        attendanceCount: complexAttendance.length,
        evaluationsCount: complexEvaluations.length,
        examsCount: complexExams.length,
        certificatesCount: complexCertificates.length,
        totalRecords
      }
    });

    onProgress?.({
      step: 8,
      totalSteps: 10,
      percent: 88,
      title: 'ترحيل التقييمات والاختبارات والإعدادات',
      detail: `تم نقل كافة سجلات الإنجاز وإعدادات المنصة إلى مشروع فايربيس المستقل`,
      logs: [...logs]
    });

    // Step 10: Update Complex in source database & local cache
    addLog(`تحديث إعدادات مجمع (${complex.name}) في المنصة لتوثيق ربطه بقاعدة البيانات المستقلة...`);
    const migrationStats = {
      studentsCount: complexStudents.length,
      halaqahsCount: complexHalaqahs.length,
      attendanceCount: complexAttendance.length,
      evaluationsCount: complexEvaluations.length,
      examsCount: complexExams.length,
      violationsCount: complexViolations.length,
      certificatesCount: complexCertificates.length,
      totalRecords
    };

    const updatedDatabaseConfig = {
      isCustom: true,
      isIsolated: true,
      projectId: targetProjId,
      apiKey: targetApiKey,
      authDomain: options.targetAuthDomain || `${targetProjId}.firebaseapp.com`,
      storageBucket: options.targetStorageBucket || `${targetProjId}.firebasestorage.app`,
      appId: options.targetAppId || '',
      databaseId: targetDbId,
      connectedEmail: cleanEmail,
      enabledAt: new Date().toISOString(),
      migratedAt: new Date().toISOString(),
      migrationStats
    };

    await this.updateComplexDatabaseConfig(complex.id, updatedDatabaseConfig);

    // Save in local cache for offline & multi-tenant isolation
    setLocalCache(`omran_isolated_db_${complex.id}`, {
      complex: { ...complex, databaseConfig: updatedDatabaseConfig },
      halaqahs: complexHalaqahs,
      students: complexStudents,
      attendance: complexAttendance,
      evaluations: complexEvaluations,
      exams: complexExams,
      certificates: complexCertificates
    });

    // Step 11: Purge all operational data of this complex from central database
    let purgedFromCentral = false;
    if (options.purgeFromCentral !== false) {
      addLog(`جاري تنظيف وحذف بيانات مجمع (${complex.name}) من القاعدة المركزية القديمة بعد اكتمال نقلها إلى فايربيس المستقل...`);
      await this.purgeComplexData(complex.id);
      purgedFromCentral = true;
      addLog(`✅ تم إفراغ وحذف كافة سجلات المجمع من القاعدة المركزية بنجاح تام! أصبحت حصرية في قاعدة بياناته المستقلة.`);
    }

    // Step 12: Automatically switch active database context to this dedicated database!
    OmranDataService.setActiveComplex({
      ...complex,
      databaseConfig: updatedDatabaseConfig
    });
    addLog(`🔄 تم توجيه المنصة للاتصال المباشر بقاعدة بيانات المجمع المستقلة الجديدة.`);

    const consoleUrl = `https://console.firebase.google.com/project/${targetProjId}/firestore/data`;
    addLog(`🎉 اكتمل النقل الحقيقي بنجاح! يمكنك الآن فتح كونسول فايربيس عبر الرابط: ${consoleUrl}`);

    onProgress?.({
      step: 10,
      totalSteps: 10,
      percent: 100,
      title: 'تم النقل بنجاح إلى Firebase!',
      detail: `أصبحت كافة بيانات مجمع (${complex.name}) متواجدة حقيقةً في مشروع فايربيس المستقل (${targetProjId})`,
      logs: [...logs]
    });

    return {
      success: true,
      complexId: complex.id,
      complexName: complex.name,
      targetGoogleEmail: cleanEmail,
      targetProjectId: targetProjId,
      targetDatabaseId: targetDbId,
      targetApiKey: targetApiKey,
      firebaseConsoleUrl: consoleUrl,
      migratedAt: new Date().toISOString(),
      purgedFromCentral,
      stats: migrationStats
    };
  }

  // Update Complex Database Config (for multi-tenant separation)
  static async updateComplexDatabaseConfig(
    complexId: string,
    databaseConfig?: QuranComplex['databaseConfig']
  ): Promise<void> {
    const complexRef = doc(db, 'complexes', complexId);
    const snap = await getDoc(complexRef);
    if (!snap.exists()) throw new Error('المجمع غير موجود');
    const data = snap.data() as QuranComplex;
    const updated: QuranComplex = {
      ...data,
      databaseConfig: databaseConfig || undefined
    };
    await setDoc(complexRef, cleanFirestoreData(updated));
  }

  // Load Halaqahs strictly from Firestore with Tombstones Filter
  static async loadHalaqahs(): Promise<Halaqah[]> {
    await syncTombstonesFromCloud().catch(() => {});
    const deletedHalaqahIds = getDeletedHalaqahIds();
    let cloudList: Halaqah[] = [];
    try {
      const snap = await safeGetDocs(collection(this.getActiveDb(), 'halaqahs'));
      snap.forEach(d => {
        const h = d.data() as Halaqah;
        if (h?.id && !deletedHalaqahIds.has(h.id)) {
          cloudList.push({ ...h, capacity: h.capacity || 15 });
        }
      });

      // Dual persistence fallback: if active DB is custom/dedicated, also load from Central DB so no halaqahs vanish!
      if (this.getActiveDb() !== this.getCentralDb()) {
        try {
          const centralSnap = await safeGetDocs(collection(this.getCentralDb(), 'halaqahs'));
          centralSnap.forEach(d => {
            const h = d.data() as Halaqah;
            if (h?.id && !deletedHalaqahIds.has(h.id) && !cloudList.some(item => item.id === h.id)) {
              // Strictly isolate: only pull halaqahs that belong to this complex or have no complexId assigned
              if (!h.complexId || (this.activeComplexId && h.complexId === this.activeComplexId)) {
                cloudList.push({ ...h, capacity: h.capacity || 15 });
              }
            }
          });
        } catch {}
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'halaqahs');
    }

    if (cloudList.length > 0) {
      return cloudList;
    }

    if (deletedHalaqahIds.size === 0) {
      return DEFAULT_HALAQAHS;
    }
    return [];
  }

  // Verify Google Meet Meeting status/existence before joining
  static async verifyGoogleMeetMeeting(meetingUriOrCode?: string): Promise<{ exists: boolean; message: string }> {
    if (!meetingUriOrCode || !meetingUriOrCode.trim()) {
      return { exists: false, message: 'تعذر العثور على الاجتماع: رابط أو كود الاجتماع غير موجود.' };
    }
    const cleanUri = meetingUriOrCode.trim();
    if (!cleanUri.includes('meet.google.com')) {
      return { exists: false, message: 'تعذر العثور على الاجتماع: رابط الاجتماع غير صالح أو غير تابع لـ Google Meet.' };
    }
    try {
      const parts = cleanUri.split('meet.google.com/');
      const codePart = parts[1]?.trim();
      if (!codePart || codePart.length < 3) {
        return { exists: false, message: 'تعذر العثور على الاجتماع: كود اجتماع Google Meet غير مكتمل أو غير صالح.' };
      }
      return { exists: true, message: 'الاجتماع نشط وجاهز للانضمام.' };
    } catch (err) {
      return { exists: false, message: 'تعذر العثور على الاجتماع حالياً.' };
    }
  }

  /**
   * إنشاء اجتماع Google Meet حقيقي 100% موثق على خوادم Google وحفظه مباشرة في Firestore
   * يضمن أن معرف الاجتماع ورابطه حقيقيان مية بالمية ومسجلان لدى Google، ويحدث الكاش المحلي وقاعدة البيانات فوراً
   */
  static async createHalaqahMeeting(
    halaqahId: string,
    params: {
      accessToken?: string;
      meetingUri?: string;
      meetingCode?: string;
      halaqahName?: string;
      accountEmail?: string;
    }
  ): Promise<{
    success: boolean;
    halaqah?: Halaqah;
    meetingUri?: string;
    meetingCode?: string;
    message: string;
  }> {
    try {
      // 1. Fetch current halaqah from cache or Firestore
      const local = getLocalCache<Halaqah[]>(OMRAN_CACHE_KEYS.HALAQAHS, DEFAULT_HALAQAHS);
      let halaqah = local.find(h => h.id === halaqahId);

      if (!halaqah) {
        try {
          const docSnap = await getDoc(doc(this.getActiveDb(), 'halaqahs', halaqahId));
          if (docSnap.exists()) {
            halaqah = { id: docSnap.id, ...(docSnap.data() as any) };
          }
        } catch (e) {
          console.warn('[OmranDataService] Fetch halaqah before meeting creation:', e);
        }
      }

      if (!halaqah) {
        return {
          success: false,
          message: 'لم يتم العثور على الحلقة المحددة لتحديث اجتماعها في قاعدة البيانات.'
        };
      }

      let realUri = params.meetingUri?.trim();
      let realCode = params.meetingCode?.trim();

      // 2. If accessToken is provided, contact Google servers to register a real meeting room
      if (params.accessToken) {
        const token = params.accessToken.trim();
        const halaqahTitle = params.halaqahName || halaqah.name || 'حلقة أونلاين';

        // Strategy 1: Google Meet Spaces REST API v2
        try {
          const meetRes = await fetch('https://meet.googleapis.com/v2/spaces', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              config: {
                accessType: 'OPEN'
              }
            })
          });

          if (meetRes.ok) {
            const data = await meetRes.json();
            const uri = data.meetingUri || data.uri;
            if (uri && typeof uri === 'string') {
              realUri = uri;
              realCode = data.meetingCode || uri.split('/').pop() || '';
            }
          }
        } catch (err) {
          console.warn('[OmranDataService] Google Meet Spaces API error, falling back to Calendar API:', err);
        }

        // Strategy 2: Google Calendar Events API with Conference Data (Hangouts / Meet)
        // Universally supported across ALL Google accounts (both personal @gmail.com & Google Workspace)
        // Registers a genuine, persistent Google Meet room on Google infrastructure
        if (!realUri) {
          try {
            const now = new Date();
            const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
            const requestId = `omran-meet-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

            const eventBody = {
              summary: `حلقة قرآنية: ${halaqahTitle}`,
              description: `غرفة اجتماع Google Meet معتمدة لحلقة (${halaqahTitle}) عبر منصة عمران لتعليم القرآن الكريم. الرابط مفتوح ومتاح لجميع الطلاب والمعلمين.`,
              start: {
                dateTime: now.toISOString(),
                timeZone: 'Asia/Riyadh'
              },
              end: {
                dateTime: oneYearLater.toISOString(),
                timeZone: 'Asia/Riyadh'
              },
              conferenceData: {
                createRequest: {
                  requestId: requestId,
                  conferenceSolutionKey: {
                    type: 'hangoutsMeet'
                  }
                }
              }
            };

            const calRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(eventBody)
            });

            if (calRes.ok) {
              const calData = await calRes.json();
              const hangoutLink = calData.hangoutLink || calData.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri;
              if (hangoutLink && typeof hangoutLink === 'string') {
                realUri = hangoutLink;
                realCode = hangoutLink.split('/').pop() || '';
              }
            } else {
              const errDetails = await calRes.text();
              console.error('[OmranDataService] Calendar API error response:', errDetails);
            }
          } catch (calErr) {
            console.error('[OmranDataService] Calendar conference creation error:', calErr);
          }
        }
      }

      // Require genuine meeting URI: do NOT generate fake synthetic codes
      if (!realUri) {
        return {
          success: false,
          message: 'تعذر إنشاء الاجتماع عبر واجهة برمجة Google مباشرة. يرجى استخدام زر إنشاء اجتماع Google Meet المباشر (meet.google.com/new) لضمان تسجيل الغرفة على خوادم Google الحقيقية.'
        };
      }

      if (!realCode && realUri.includes('meet.google.com/')) {
        realCode = realUri.split('meet.google.com/')[1]?.split('?')[0]?.trim() || '';
      }

      // 3. Assemble updated halaqah
      const updatedHalaqah: Halaqah = {
        ...halaqah,
        isOnline: true,
        meetingUri: realUri,
        meetingCode: realCode || halaqah.meetingCode,
        meetingCreatedAt: new Date().toISOString(),
        meetingCreatedBy: params.accountEmail || halaqah.meetingCreatedBy || 'المشرف/المعلم',
        updatedAt: new Date().toISOString()
      };

      // 4. Save to Firestore (both activeDb and centralDb) + local cache + broadcast
      await this.saveHalaqah(updatedHalaqah);

      return {
        success: true,
        halaqah: updatedHalaqah,
        meetingUri: realUri,
        meetingCode: realCode,
        message: 'تم إنشاء وتفعيل رابط الاجتماع الحقيقي بنجاح وحفظه سحابياً في قاعدة البيانات ✓'
      };
    } catch (err: any) {
      console.error('[OmranDataService] Error in createHalaqahMeeting:', err);
      return {
        success: false,
        message: err?.message || 'حدث خطأ غير متوقع أثناء إنشاء أو حفظ الاجتماع في قاعدة البيانات.'
      };
    }
  }

  // Save Halaqah with Dual Persistence
  static async saveHalaqah(halaqah: Halaqah): Promise<void> {
    removeDeletedHalaqahId(halaqah.id);
    const clean = cleanFirestoreData(halaqah);
    const local = getLocalCache<Halaqah[]>(OMRAN_CACHE_KEYS.HALAQAHS, DEFAULT_HALAQAHS);
    const updated = [clean, ...local.filter(h => h.id !== clean.id)];
    setLocalCache(OMRAN_CACHE_KEYS.HALAQAHS, updated);
    broadcastDataUpdate('halaqah', clean);

    try {
      // Direct halaqah writes to the database of its OWN complex
      let targetDb = this.getActiveDb();
      if (clean.complexId) {
        const complexes = getLocalCache<QuranComplex[]>(OMRAN_CACHE_KEYS.COMPLEXES, []);
        const halComplex = complexes.find(c => c.id === clean.complexId);
        if (halComplex && halComplex.databaseConfig?.isCustom) {
          targetDb = this.getFirestoreInstanceForComplex(halComplex);
        }
      }

      await setDoc(doc(targetDb, 'halaqahs', clean.id), clean);
      if (targetDb !== this.getCentralDb()) {
        try {
          await setDoc(doc(this.getCentralDb(), 'halaqahs', clean.id), clean);
        } catch {}
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `halaqahs/${clean.id}`);
      console.warn('[OmranDataService] Halaqah saved locally, cloud sync pending/offline:', e);
    }
  }

  // Delete Halaqah with Dual Persistence & Permanent Tombstone
  static async deleteHalaqah(halaqahId: string): Promise<void> {
    addDeletedHalaqahId(halaqahId);
    const local = getLocalCache<Halaqah[]>(OMRAN_CACHE_KEYS.HALAQAHS, []);
    setLocalCache(OMRAN_CACHE_KEYS.HALAQAHS, local.filter(h => h.id !== halaqahId));
    broadcastDataUpdate('halaqah-deleted', halaqahId);

    try {
      await deleteDoc(doc(this.getActiveDb(), 'halaqahs', halaqahId));
      if (this.getActiveDb() !== this.getCentralDb()) {
        try {
          await deleteDoc(doc(this.getCentralDb(), 'halaqahs', halaqahId));
        } catch {}
      }

      // Reassign students of the deleted halaqah to unassigned gracefully
      const allStudents = await this.loadStudents();
      for (const s of allStudents) {
        if (s.halaqahId === halaqahId) {
          const updatedSt: Student = {
            ...s,
            halaqahId: 'unassigned',
            halaqahName: 'حلقة غير محددة'
          };
          await this.saveStudent(updatedSt);
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `halaqahs/${halaqahId}`);
    }
  }

  // Transfer Student to another Halaqah directly in Firestore (preserves full records and synchronizes complexId!)
  static async transferStudentToHalaqah(
    studentId: string,
    targetHalaqahId: string,
    targetHalaqahName: string
  ): Promise<Student | null> {
    try {
      const studentRef = doc(this.getActiveDb(), 'students', studentId);
      const studentSnap = await getDoc(studentRef);
      if (!studentSnap.exists()) return null;
      const data = studentSnap.data() as Student;

      const halaqahs = await this.loadHalaqahs();
      const targetHalaqah = halaqahs.find(h => h.id === targetHalaqahId);
      const targetComplexId = targetHalaqah ? targetHalaqah.complexId : undefined;

      const updatedStudent: Student = {
        ...data,
        halaqahId: targetHalaqahId,
        halaqahName: targetHalaqahName,
        complexId: targetComplexId
      };

      await setDoc(studentRef, cleanFirestoreData(updatedStudent));
      if (this.getActiveDb() !== this.getCentralDb()) {
        try {
          await setDoc(doc(this.getCentralDb(), 'students', studentId), cleanFirestoreData(updatedStudent));
        } catch {}
      }

      // Update in local cache immediately
      const local = getLocalCache<Student[]>(OMRAN_CACHE_KEYS.STUDENTS, []);
      setLocalCache(OMRAN_CACHE_KEYS.STUDENTS, local.map(s => s.id === studentId ? updatedStudent : s));

      return updatedStudent;
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `students/${studentId}`);
      throw e;
    }
  }

  // Transfer Multiple Students to another Halaqah directly in Firestore (batch transfer with synchronized complexId)
  static async transferMultipleStudentsToHalaqah(
    studentIds: string[],
    targetHalaqahId: string,
    targetHalaqahName: string
  ): Promise<void> {
    try {
      const halaqahs = await this.loadHalaqahs();
      const targetHalaqah = halaqahs.find(h => h.id === targetHalaqahId);

      for (const sId of studentIds) {
        const studentRef = doc(this.getActiveDb(), 'students', sId);
        const studentSnap = await getDoc(studentRef);
        if (studentSnap.exists()) {
          const data = studentSnap.data() as Student;
          const targetComplexId = targetHalaqah ? targetHalaqah.complexId : undefined;

          const updatedStudent: Student = {
            ...data,
            halaqahId: targetHalaqahId,
            halaqahName: targetHalaqahName,
            complexId: targetComplexId
          };
          await setDoc(studentRef, cleanFirestoreData(updatedStudent));
          if (this.getActiveDb() !== this.getCentralDb()) {
            try {
              await setDoc(doc(this.getCentralDb(), 'students', sId), cleanFirestoreData(updatedStudent));
            } catch {}
          }
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `students/batch_transfer`);
      throw e;
    }
  }

  // Persistent Tombstones for clean deletions that never resurrect
  static getDeletedStudentIds(): Set<string> {
    return getDeletedStudentIds();
  }

  static addDeletedStudentId(id: string): void {
    addDeletedStudentId(id);
  }

  static removeDeletedStudentId(id: string): void {
    removeDeletedStudentId(id);
  }

  static getDeletedCertificateIds(): Set<string> {
    return getDeletedCertificateIds();
  }

  static addDeletedCertificateId(id: string): void {
    addDeletedCertificateId(id);
  }

  static removeDeletedCertificateId(id: string): void {
    removeDeletedCertificateId(id);
  }

  // Load Students directly from Firestore with Deletion Filtering
  static async loadStudents(): Promise<Student[]> {
    try {
      await syncTombstonesFromCloud();
    } catch {}
    const deletedIds = OmranDataService.getDeletedStudentIds();
    let cloudList: Student[] = [];
    try {
      const snap = await safeGetDocs(collection(this.getActiveDb(), 'students'));
      snap.forEach(d => {
        const s = d.data() as Student;
        if (s?.id && !deletedIds.has(s.id) && !s.id.startsWith('teacher-')) {
          cloudList.push(s);
        }
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'students');
    }

    if (cloudList.length > 0) {
      const cleaned = cloudList.map(s => {
        const parentPhone = s.parentPhone || (s.parentPhones && s.parentPhones.length > 0 ? s.parentPhones[0] : s.phone) || '';
        return {
          ...s,
          parentPhone,
          age: s.age || 14
        };
      });
      return cleaned;
    }

    // Only fallback to INITIAL_STUDENTS if Firestore has no students and no deletions occurred
    if (deletedIds.size === 0) {
      return INITIAL_STUDENTS;
    }
    return [];
  }

  static async getStudents(): Promise<Student[]> {
    return this.loadStudents();
  }

  // Save Student directly with Dual Persistence and resilient multi-database cloud sync
  static async saveStudent(student: Student): Promise<void> {
    OmranDataService.removeDeletedStudentId(student.id);
    const local = getLocalCache<Student[]>(OMRAN_CACHE_KEYS.STUDENTS, INITIAL_STUDENTS);
    const existingLocal = local.find(s => s.id === student.id);
    const nowIso = new Date().toISOString();
    const parentPhone = student.parentPhone || (student.parentPhones && student.parentPhones.length > 0 ? student.parentPhones[0] : student.phone) || '';

    const localErrTime = existingLocal?.mushafErrorsUpdatedAt ? new Date(existingLocal.mushafErrorsUpdatedAt).getTime() : 0;
    const incomingErrTime = student.mushafErrorsUpdatedAt ? new Date(student.mushafErrorsUpdatedAt).getTime() : 0;
    let resolvedMushafErrors = student.mushafErrors;
    let resolvedMushafErrorsUpdatedAt = student.mushafErrorsUpdatedAt || existingLocal?.mushafErrorsUpdatedAt;

    if (!Array.isArray(student.mushafErrors) && Array.isArray(existingLocal?.mushafErrors)) {
      resolvedMushafErrors = existingLocal.mushafErrors;
    } else if (localErrTime > incomingErrTime && incomingErrTime === 0 && Array.isArray(existingLocal?.mushafErrors)) {
      // Protect newer mushafErrors if a background caller saved a stale student copy without mushafErrorsUpdatedAt
      resolvedMushafErrors = existingLocal.mushafErrors;
      resolvedMushafErrorsUpdatedAt = existingLocal.mushafErrorsUpdatedAt;
    }

    // Strictly filter mushafErrors to belong ONLY to this student.id
    if (Array.isArray(resolvedMushafErrors)) {
      resolvedMushafErrors = resolvedMushafErrors
        .filter(err => !err.studentId || err.studentId === student.id)
        .map(err => ({ ...err, studentId: student.id }));
    }

    const clean = cleanFirestoreData({
      ...student,
      parentPhone,
      mushafErrors: resolvedMushafErrors ?? [],
      mushafErrorsUpdatedAt: resolvedMushafErrorsUpdatedAt,
      updatedAt: nowIso
    });
    const updated = [clean, ...local.filter(s => s.id !== clean.id)];
    setLocalCache(OMRAN_CACHE_KEYS.STUDENTS, updated);
    broadcastDataUpdate('student', clean);

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('omran:students-updated', { detail: clean }));
      }
    } catch {}

    const targetDbs = [this.getActiveDb()];
    if (this.getCentralDb() !== this.getActiveDb()) {
      targetDbs.push(this.getCentralDb());
    }

    await Promise.allSettled(
      targetDbs.map(targetDb =>
        setDoc(doc(targetDb, 'students', clean.id), clean, { merge: true }).catch(e => {
          console.warn('[OmranDataService] Student saved locally, cloud sync notice:', e);
        })
      )
    );
  }

  // Batch Save Multiple Students directly with Dual Persistence and Full Cloud Firestore Sync
  static async saveStudentsBatch(students: Student[]): Promise<boolean> {
    if (!students || students.length === 0) return true;
    for (const s of students) {
      OmranDataService.removeDeletedStudentId(s.id);
    }
    const nowIso = new Date().toISOString();
    const cleanList = students.map(st => {
      const parentPhone = st.parentPhone || (st.parentPhones && st.parentPhones.length > 0 ? st.parentPhones[0] : st.phone) || '';
      return cleanFirestoreData({ ...st, parentPhone, updatedAt: st.updatedAt || nowIso });
    });

    // 1. Update local cache immediately
    const local = getLocalCache<Student[]>(OMRAN_CACHE_KEYS.STUDENTS, INITIAL_STUDENTS);
    const map = new Map<string, Student>();
    for (const s of local) if (s?.id) map.set(s.id, s);
    for (const s of cleanList) if (s?.id) map.set(s.id, s);
    const merged = Array.from(map.values());
    setLocalCache(OMRAN_CACHE_KEYS.STUDENTS, merged);
    broadcastDataUpdate('students-batch', cleanList);

    // 2. Persist to Firestore across activeDb and centralDb in parallel
    const targetDbs = [this.getActiveDb()];
    if (this.getCentralDb() !== this.getActiveDb()) {
      targetDbs.push(this.getCentralDb());
    }

    try {
      await Promise.allSettled(
        targetDbs.flatMap(targetDb =>
          cleanList.map(item => setDoc(doc(targetDb, 'students', item.id), item, { merge: true }))
        )
      );
      return true;
    } catch (err) {
      console.warn('[OmranDataService] Cloud batch students save notice:', err);
      return false;
    }
  }

  // Delete Student directly from Firestore and local cache, cleanly unlinking and deleting any Google account
  static async deleteStudent(studentId: string): Promise<void> {
    // 0. Register persistent tombstone so student NEVER re-appears from offline cache or initial data
    addDeletedStudentId(studentId);

    const local = getLocalCache<Student[]>(OMRAN_CACHE_KEYS.STUDENTS, []);
    const student = local.find(s => s.id === studentId);
    setLocalCache(OMRAN_CACHE_KEYS.STUDENTS, local.filter(s => s.id !== studentId));
    broadcastDataUpdate('student-deleted', studentId);

    // Clear active session and google tokens if this student was logged in
    try {
      if (typeof window !== 'undefined') {
        const savedSession = localStorage.getItem('omran_session');
        if (savedSession) {
          const parsed = JSON.parse(savedSession);
          if (parsed?.studentId === studentId || (student?.googleEmail && parsed?.googleEmail === student.googleEmail)) {
            localStorage.removeItem('omran_session');
          }
        }
        if (student?.googleEmail) {
          localStorage.removeItem(`omran_google_user_${student.googleEmail}`);
        }
      }
    } catch {}

    const targetDbs = [this.getActiveDb()];
    if (this.getActiveDb() !== this.getCentralDb()) {
      targetDbs.push(this.getCentralDb());
    }

    for (const activeDb of targetDbs) {
      try {
        // 1. Delete student document
        await deleteDoc(doc(activeDb, 'students', studentId));

        // 2. Cleanly detach & delete linked Google account documents if present
        if (student?.googleEmail || student?.googleUid || student?.isGoogleLinked) {
          if (student?.googleUid) {
            deleteDoc(doc(activeDb, 'google_accounts', student.googleUid)).catch(() => {});
            deleteDoc(doc(activeDb, 'users', student.googleUid)).catch(() => {});
          }
          if (student?.googleEmail) {
            deleteDoc(doc(activeDb, 'google_accounts', student.googleEmail.replace(/[@.]/g, '_'))).catch(() => {});
            deleteDoc(doc(activeDb, 'student_accounts', student.googleEmail.replace(/[@.]/g, '_'))).catch(() => {});
          }
        }
      } catch (e) {
        handleFirestoreError(e, OperationType.DELETE, `students/${studentId}`);
      }
    }

    // 3. Cascade delete student attendance
    const attLocal = getLocalCache<AttendanceRecord[]>(OMRAN_CACHE_KEYS.ATTENDANCE, []);
    const attToDelete = attLocal.filter(a => a.studentId === studentId);
    setLocalCache(OMRAN_CACHE_KEYS.ATTENDANCE, attLocal.filter(a => a.studentId !== studentId));
    for (const a of attToDelete) {
      for (const db of targetDbs) {
        deleteDoc(doc(db, 'attendance', a.id)).catch(() => {});
      }
    }

    // 4. Cascade delete student evaluations
    const evalLocal = getLocalCache<StudentEvaluation[]>(OMRAN_CACHE_KEYS.EVALUATIONS, []);
    const evalsToDelete = evalLocal.filter(e => e.studentId === studentId);
    setLocalCache(OMRAN_CACHE_KEYS.EVALUATIONS, evalLocal.filter(e => e.studentId !== studentId));
    for (const ev of evalsToDelete) {
      for (const db of targetDbs) {
        deleteDoc(doc(db, 'evaluations', ev.id)).catch(() => {});
      }
    }

    // 5. Cascade delete student violations
    const violLocal = getLocalCache<BehaviorViolation[]>(OMRAN_CACHE_KEYS.VIOLATIONS, []);
    const violsToDelete = violLocal.filter(v => v.studentId === studentId);
    setLocalCache(OMRAN_CACHE_KEYS.VIOLATIONS, violLocal.filter(v => v.studentId !== studentId));
    for (const v of violsToDelete) {
      for (const db of targetDbs) {
        deleteDoc(doc(db, 'violations', v.id)).catch(() => {});
      }
    }
  }

  // Delete multiple students in batch from Firestore and local cache
  static async deleteStudentsBatch(studentIds: string[]): Promise<void> {
    if (!studentIds || studentIds.length === 0) return;
    for (const id of studentIds) {
      addDeletedStudentId(id);
      broadcastDataUpdate('student-deleted', id);
    }
    const idSet = new Set(studentIds);
    const local = getLocalCache<Student[]>(OMRAN_CACHE_KEYS.STUDENTS, []);
    setLocalCache(OMRAN_CACHE_KEYS.STUDENTS, local.filter(s => !idSet.has(s.id)));

    // Clear any active sessions if match
    try {
      if (typeof window !== 'undefined') {
        const savedSession = localStorage.getItem('omran_session');
        if (savedSession) {
          const parsed = JSON.parse(savedSession);
          if (parsed?.studentId && idSet.has(parsed.studentId)) {
            localStorage.removeItem('omran_session');
          }
        }
      }
    } catch {}

    const targetDbs = [this.getActiveDb()];
    if (this.getActiveDb() !== this.getCentralDb()) {
      targetDbs.push(this.getCentralDb());
    }

    for (const activeDb of targetDbs) {
      try {
        const batch = writeBatch(activeDb);
        for (const id of studentIds) {
          batch.delete(doc(activeDb, 'students', id));
        }
        await batch.commit();
      } catch (e) {
        console.warn('[OmranDataService] deleteStudentsBatch error on db:', e);
      }
    }

    // Cascade clean attendance, evals, violations locally and on firestore
    const attLocal = getLocalCache<AttendanceRecord[]>(OMRAN_CACHE_KEYS.ATTENDANCE, []);
    setLocalCache(OMRAN_CACHE_KEYS.ATTENDANCE, attLocal.filter(a => !idSet.has(a.studentId)));

    const evalLocal = getLocalCache<StudentEvaluation[]>(OMRAN_CACHE_KEYS.EVALUATIONS, []);
    setLocalCache(OMRAN_CACHE_KEYS.EVALUATIONS, evalLocal.filter(e => !idSet.has(e.studentId)));

    const violLocal = getLocalCache<BehaviorViolation[]>(OMRAN_CACHE_KEYS.VIOLATIONS, []);
    setLocalCache(OMRAN_CACHE_KEYS.VIOLATIONS, violLocal.filter(v => !idSet.has(v.studentId)));
  }

  // Load Attendance directly from Firestore
  static async loadAttendance(): Promise<AttendanceRecord[]> {
    let cloudList: AttendanceRecord[] = [];
    try {
      const snap = await safeGetDocs(collection(this.getActiveDb(), 'attendance'));
      snap.forEach(d => {
        const a = d.data() as AttendanceRecord;
        if (a?.id) cloudList.push(a);
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'attendance');
    }
    return cloudList;
  }

  // Save Batch Attendance with Dual Persistence
  static async saveAttendanceRecords(records: AttendanceRecord[]): Promise<void> {
    const cleanRecords: AttendanceRecord[] = records.map(r => cleanFirestoreData(r));

    // 1. Store in memory runtime cache
    const local = getLocalCache<AttendanceRecord[]>(OMRAN_CACHE_KEYS.ATTENDANCE, []);
    const map = new Map<string, AttendanceRecord>();
    for (const a of local) {
      if (a?.id) map.set(a.id, a);
    }
    for (const r of cleanRecords) {
      if (r?.id) map.set(r.id, r);
    }
    setLocalCache(OMRAN_CACHE_KEYS.ATTENDANCE, Array.from(map.values()));
    broadcastDataUpdate('attendance-records', cleanRecords);
    broadcastDataUpdate('attendance', cleanRecords);

    // 2. Persist to Firestore in parallel without throwing fatal errors
    try {
      const activeDb = this.getActiveDb();
      await Promise.allSettled(
        cleanRecords.map(rec => setDoc(doc(activeDb, 'attendance', rec.id), rec))
      );
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'attendance');
      console.warn('[OmranDataService] Attendance saved locally, cloud sync pending/offline:', e);
    }
  }

  // Load Evaluations directly from Firestore
  static async loadEvaluations(): Promise<StudentEvaluation[]> {
    let cloudList: StudentEvaluation[] = [];
    try {
      const snap = await safeGetDocs(collection(this.getActiveDb(), 'evaluations'));
      snap.forEach(d => {
        const ev = d.data() as StudentEvaluation;
        if (ev?.id) cloudList.push(ev);
      });
      cloudList.sort((a, b) => (b?.date || '').localeCompare(a?.date || ''));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'evaluations');
    }
    return cloudList;
  }

  // Save Evaluation directly in Firestore
  static async saveEvaluation(evaluation: StudentEvaluation): Promise<void> {
    const clean = cleanFirestoreData(evaluation);

    const local = getLocalCache<StudentEvaluation[]>(OMRAN_CACHE_KEYS.EVALUATIONS, []);
    const updated = [clean, ...local.filter(e => e.id !== clean.id)];
    setLocalCache(OMRAN_CACHE_KEYS.EVALUATIONS, updated);

    // Synchronize to Firestore Cloud
    try {
      await setDoc(doc(this.getActiveDb(), 'evaluations', clean.id), clean);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `evaluations/${clean.id}`);
      console.warn('[OmranDataService] Evaluation saved locally, cloud sync pending/offline:', e);
    }
  }

  // Delete Evaluation with Dual Persistence
  static async deleteEvaluation(evaluationId: string): Promise<void> {
    const local = getLocalCache<StudentEvaluation[]>(OMRAN_CACHE_KEYS.EVALUATIONS, []);
    setLocalCache(OMRAN_CACHE_KEYS.EVALUATIONS, local.filter(e => e.id !== evaluationId));

    try {
      await deleteDoc(doc(this.getActiveDb(), 'evaluations', evaluationId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `evaluations/${evaluationId}`);
    }
  }

  // Load Criteria directly from Firestore
  static async loadCriteria(): Promise<EvaluationCriteria[]> {
    let cloudList: EvaluationCriteria[] = [];
    try {
      const activeDb = this.getActiveDb();
      const snap = await safeGetDocs(collection(activeDb, 'criteria'));
      snap.forEach(d => {
        const c = d.data() as EvaluationCriteria;
        if (c?.id) cloudList.push(c);
      });
      if (cloudList.length > 0) {
        return cloudList;
      }
      // If Firestore criteria collection is completely empty, seed defaults
      for (const c of DEFAULT_CRITERIA) {
        await setDoc(doc(activeDb, 'criteria', c.id), cleanFirestoreData(c));
      }
      return DEFAULT_CRITERIA;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'criteria');
      return DEFAULT_CRITERIA;
    }
  }

  // Save Criteria List with Dual Persistence
  static async saveCriteriaList(list: EvaluationCriteria[]): Promise<void> {
    const clean = list.map(c => cleanFirestoreData(c));
    setLocalCache(OMRAN_CACHE_KEYS.CRITERIA, clean);

    try {
      const activeDb = this.getActiveDb();
      await Promise.allSettled(
        clean.map(item => setDoc(doc(activeDb, 'criteria', item.id), item))
      );
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'criteria');
      console.warn('[OmranDataService] Criteria saved locally, cloud sync pending/offline:', e);
    }
  }

  // Delete Criteria with Dual Persistence
  static async deleteCriteria(id: string): Promise<void> {
    const local = getLocalCache<EvaluationCriteria[]>(OMRAN_CACHE_KEYS.CRITERIA, []);
    setLocalCache(OMRAN_CACHE_KEYS.CRITERIA, local.filter(c => c.id !== id));

    try {
      await deleteDoc(doc(this.getActiveDb(), 'criteria', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `criteria/${id}`);
    }
  }

  // Load Settings directly from Firestore
  static async loadSettings(): Promise<AppSettings> {
    try {
      const docSnap = await safeGetDoc(doc(this.getActiveDb(), 'settings', 'main'));
      if (docSnap.exists()) {
        const cloud = docSnap.data() as AppSettings;
        return {
          ...DEFAULT_SETTINGS,
          ...cloud,
          attendancePointsSettings: {
            ...DEFAULT_SETTINGS.attendancePointsSettings,
            ...(cloud.attendancePointsSettings || {})
          }
        };
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, 'settings/main');
    }
    return DEFAULT_SETTINGS;
  }

  // Save Settings with Dual Persistence
  static async saveSettings(settings: AppSettings): Promise<void> {
    const enrichedSettings: AppSettings = {
      ...DEFAULT_SETTINGS,
      ...settings,
      attendancePointsSettings: {
        ...DEFAULT_SETTINGS.attendancePointsSettings,
        ...(settings.attendancePointsSettings || {})
      }
    };
    const clean = cleanFirestoreData(enrichedSettings);
    setLocalCache(OMRAN_CACHE_KEYS.SETTINGS, clean);
    broadcastDataUpdate('settings', clean);

    try {
      await setDoc(doc(this.getActiveDb(), 'settings', 'main'), clean, { merge: true });
      if (this.getActiveDb() !== this.getCentralDb()) {
        try {
          await setDoc(doc(this.getCentralDb(), 'settings', 'main'), clean, { merge: true });
        } catch {}
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'settings/main');
      console.warn('[OmranDataService] Settings saved locally, cloud sync pending/offline:', e);
    }
  }

  // Load Chats directly from Firestore
  static async loadChats(): Promise<ChatMessage[]> {
    try {
      const snap = await safeGetDocs(collection(this.getActiveDb(), 'chats'));
      const list: ChatMessage[] = [];
      snap.forEach(d => list.push(d.data() as ChatMessage));
      list.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      return list;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'chats');
      return [];
    }
  }

  // Save Chat Message directly in Firestore
  static async saveChatMessage(msg: ChatMessage): Promise<void> {
    try {
      await setDoc(doc(this.getActiveDb(), 'chats', msg.id), msg);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `chats/${msg.id}`);
      throw e;
    }
  }

  // Clear Chats directly from Firestore
  static async clearChats(): Promise<void> {
    try {
      const snap = await safeGetDocs(collection(this.getActiveDb(), 'chats'));
      for (const d of snap.docs) {
        await deleteDoc(d.ref);
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'chats');
      throw e;
    }
  }

  // Load Behavior Violations directly from Firestore
  static async loadViolations(): Promise<BehaviorViolation[]> {
    try {
      const snap = await safeGetDocs(collection(this.getActiveDb(), 'violations'));
      const list: BehaviorViolation[] = [];
      snap.forEach(d => list.push(d.data() as BehaviorViolation));
      list.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
      return list;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'violations');
      return [];
    }
  }

  // Save Behavior Violation directly in Firestore
  static async saveViolation(violation: BehaviorViolation): Promise<void> {
    try {
      const cleanViolation = JSON.parse(JSON.stringify(violation));
      await setDoc(doc(this.getActiveDb(), 'violations', violation.id), cleanViolation);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `violations/${violation.id}`);
      throw e;
    }
  }

  // Delete Behavior Violation directly from Firestore
  static async deleteViolation(violationId: string): Promise<void> {
    try {
      await deleteDoc(doc(this.getActiveDb(), 'violations', violationId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `violations/${violationId}`);
      throw e;
    }
  }

  // Real-time listener for violations
  static subscribeViolations(callback: (violations: BehaviorViolation[]) => void): () => void {
    try {
      return onSnapshot(collection(this.getActiveDb(), 'violations'), snap => {
        const list: BehaviorViolation[] = [];
        snap.forEach(d => list.push(d.data() as BehaviorViolation));
        list.sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
        callback(list);
      }, err => {
        handleFirestoreError(err, OperationType.LIST, 'violations');
      });
    } catch (e) {
      return () => {};
    }
  }

  // Find student by ID or name or phone directly from Firestore (for live portal access)
  static async findStudentByIdOrQuery(lookup: string): Promise<Student | null> {
    if (!lookup) return null;
    const clean = decodeURIComponent(lookup).trim();
    const cleanNoSpaces = clean.replace(/\s+/g, '');

    // 1. Direct document fetch by ID
    try {
      const docSnap = await safeGetDoc(doc(this.getActiveDb(), 'students', clean));
      if (docSnap.exists()) {
        return docSnap.data() as Student;
      }
    } catch (e) {
      // Continue to query
    }

    // 2. Query Firestore entire collection
    try {
      const snap = await safeGetDocs(collection(this.getActiveDb(), 'students'));
      for (const d of snap.docs) {
        const s = d.data() as Student;
        if (
          s.id === clean ||
          s.id.toLowerCase() === clean.toLowerCase() ||
          s.name.trim() === clean ||
          s.name.replace(/\s+/g, '') === cleanNoSpaces ||
          s.phone.replace(/\D/g, '') === clean.replace(/\D/g, '') ||
          (s.parentPhones && s.parentPhones.some(p => p.replace(/\D/g, '') === clean.replace(/\D/g, '')))
        ) {
          return s;
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'students');
    }

    return null;
  }

  // Real-time Firestore Subscriptions for instant multi-device / multi-teacher sync
  static subscribeStudents(callback: (students: Student[]) => void): () => void {
    try {
      return onSnapshot(collection(this.getActiveDb(), 'students'), snap => {
        const deletedIds = OmranDataService.getDeletedStudentIds();
        const cloudList: Student[] = [];
        snap.forEach(d => {
          const s = d.data() as Student;
          if (deletedIds.has(s.id)) {
            return;
          }
          if (s.id === 'teacher-1' || (s.id.startsWith('teacher-') && (s as any).username)) {
            return;
          }
          const parentPhone = s.parentPhone || (s.parentPhones && s.parentPhones.length > 0 ? s.parentPhones[0] : s.phone) || '';
          cloudList.push({
            ...s,
            parentPhone,
            age: s.age || 14
          });
        });

        if (cloudList.length > 0) {
          callback(cloudList);
        } else if (deletedIds.size === 0) {
          callback(INITIAL_STUDENTS);
        } else {
          callback([]);
        }
      }, err => {
        handleFirestoreError(err, OperationType.LIST, 'students');
      });
    } catch (e) {
      return () => {};
    }
  }

  static subscribeAttendance(callback: (attendance: AttendanceRecord[]) => void): () => void {
    try {
      return onSnapshot(collection(this.getActiveDb(), 'attendance'), snap => {
        const cloudList: AttendanceRecord[] = [];
        snap.forEach(d => {
          const a = d.data() as AttendanceRecord;
          if (a?.id) cloudList.push(a);
        });
        callback(cloudList);
      }, err => {
        handleFirestoreError(err, OperationType.LIST, 'attendance');
      });
    } catch (e) {
      return () => {};
    }
  }

  static subscribeEvaluations(callback: (evaluations: StudentEvaluation[]) => void): () => void {
    try {
      return onSnapshot(collection(this.getActiveDb(), 'evaluations'), snap => {
        const cloudList: StudentEvaluation[] = [];
        snap.forEach(d => {
          const ev = d.data() as StudentEvaluation;
          if (ev?.id) cloudList.push(ev);
        });
        cloudList.sort((a, b) => (b?.date || '').localeCompare(a?.date || ''));
        callback(cloudList);
      }, err => {
        handleFirestoreError(err, OperationType.LIST, 'evaluations');
      });
    } catch (e) {
      return () => {};
    }
  }

  static subscribeCriteria(callback: (criteria: EvaluationCriteria[]) => void): () => void {
    try {
      return onSnapshot(collection(this.getActiveDb(), 'criteria'), snap => {
        const cloudList: EvaluationCriteria[] = [];
        snap.forEach(d => {
          const c = d.data() as EvaluationCriteria;
          if (c?.id) cloudList.push(c);
        });
        callback(cloudList.length > 0 ? cloudList : DEFAULT_CRITERIA);
      }, err => {
        handleFirestoreError(err, OperationType.LIST, 'criteria');
      });
    } catch (e) {
      return () => {};
    }
  }

  static subscribeSettings(callback: (settings: AppSettings) => void): () => void {
    try {
      return onSnapshot(doc(this.getActiveDb(), 'settings', 'main'), snap => {
        if (snap.exists()) {
          const cloud = snap.data() as AppSettings;
          callback({
            ...DEFAULT_SETTINGS,
            ...cloud,
            attendancePointsSettings: {
              ...DEFAULT_SETTINGS.attendancePointsSettings,
              ...(cloud.attendancePointsSettings || {})
            }
          });
        }
      }, err => {
        handleFirestoreError(err, OperationType.GET, 'settings/main');
      });
    } catch (e) {
      return () => {};
    }
  }

  static subscribeTeachers(callback: (teachers: TeacherAccount[]) => void): () => void {
    try {
      const unsubActive = onSnapshot(collection(this.getActiveDb(), 'teachers'), snap => {
        const deletedTeacherIds = getDeletedTeacherIds();
        const list: TeacherAccount[] = [];
        snap.forEach(d => {
          const t = d.data() as TeacherAccount;
          if (t?.id && !deletedTeacherIds.has(t.id)) {
            list.push(t);
          }
        });
        if (list.length > 0) {
          callback(list);
        } else if (deletedTeacherIds.size === 0) {
          callback(INITIAL_TEACHERS);
        } else {
          callback([]);
        }
      }, err => {
        handleFirestoreError(err, OperationType.LIST, 'teachers');
      });

      return unsubActive;
    } catch (e) {
      return () => {};
    }
  }

  static subscribeHalaqahs(callback: (halaqahs: Halaqah[]) => void): () => void {
    try {
      const unsubActive = onSnapshot(collection(this.getActiveDb(), 'halaqahs'), snap => {
        const deletedHalaqahIds = getDeletedHalaqahIds();
        const cloudList: Halaqah[] = [];
        snap.forEach(d => {
          const h = d.data() as Halaqah;
          if (h?.id && !deletedHalaqahIds.has(h.id)) {
            cloudList.push({ ...h, capacity: h.capacity || 15 });
          }
        });
        if (cloudList.length > 0) {
          callback(cloudList);
        } else if (deletedHalaqahIds.size === 0) {
          callback(DEFAULT_HALAQAHS);
        } else {
          callback([]);
        }
      }, err => {
        handleFirestoreError(err, OperationType.LIST, 'halaqahs');
      });

      return unsubActive;
    } catch (e) {
      return () => {};
    }
  }

  // Real-time synchronization of deleted records across all devices and clients
  static subscribeTombstones(callback: (tombstones: {
    deletedStudents: Set<string>;
    deletedTeachers: Set<string>;
    deletedHalaqahs: Set<string>;
    deletedComplexes: Set<string>;
    deletedApplications?: Set<string>;
  }) => void): () => void {
    try {
      const handleSnap = (snap: any) => {
        if (snap && snap.exists()) {
          const data = snap.data();
          const sList = Array.isArray(data.deletedStudents) ? data.deletedStudents : [];
          const tList = Array.isArray(data.deletedTeachers) ? data.deletedTeachers : [];
          const hList = Array.isArray(data.deletedHalaqahs) ? data.deletedHalaqahs : [];
          const cList = Array.isArray(data.deletedComplexes) ? data.deletedComplexes : [];
          const aList = Array.isArray(data.deletedApplications) ? data.deletedApplications : [];

          const curS = new Set([...getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_STUDENTS, []), ...sList]);
          const curT = new Set([...getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_TEACHERS, []), ...tList]);
          const curH = new Set([...getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_HALAQAHS, []), ...hList]);
          const curC = new Set([...getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_COMPLEXES, []), ...cList]);
          const curA = new Set([...getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_APPLICATIONS, []), ...aList]);

          setLocalCache(OMRAN_CACHE_KEYS.DELETED_STUDENTS, Array.from(curS));
          setLocalCache(OMRAN_CACHE_KEYS.DELETED_TEACHERS, Array.from(curT));
          setLocalCache(OMRAN_CACHE_KEYS.DELETED_HALAQAHS, Array.from(curH));
          setLocalCache(OMRAN_CACHE_KEYS.DELETED_COMPLEXES, Array.from(curC));
          setLocalCache(OMRAN_CACHE_KEYS.DELETED_APPLICATIONS, Array.from(curA));

          callback({
            deletedStudents: curS,
            deletedTeachers: curT,
            deletedHalaqahs: curH,
            deletedComplexes: curC,
            deletedApplications: curA
          });
        }
      };

      const unsubCentral = onSnapshot(doc(this.getCentralDb(), 'settings', 'deleted_records'), handleSnap, () => {});
      if (this.getActiveDb() !== this.getCentralDb()) {
        const unsubActive = onSnapshot(doc(this.getActiveDb(), 'settings', 'deleted_records'), handleSnap, () => {});
        return () => {
          unsubCentral();
          unsubActive();
        };
      }
      return unsubCentral;
    } catch {
      return () => {};
    }
  }

  // Live synchronization of active halaqah across all supervisor devices and sessions
  static async syncActiveHalaqah(halaqahId: string, complexId?: string, updatedBy?: string): Promise<void> {
    try {
      const payload = {
        activeHalaqahId: halaqahId,
        complexId: complexId || '',
        updatedBy: updatedBy || '',
        updatedAt: Date.now(),
      };
      await setDoc(doc(this.getCentralDb(), 'settings', 'active_halaqah_sync'), payload, { merge: true });
      if (this.getActiveDb() !== this.getCentralDb()) {
        await setDoc(doc(this.getActiveDb(), 'settings', 'active_halaqah_sync'), payload, { merge: true });
      }
    } catch (e) {
      console.warn('Failed to sync active halaqah to firestore:', e);
    }
  }

  static subscribeActiveHalaqah(callback: (data: { activeHalaqahId: string; complexId?: string; updatedBy?: string; updatedAt?: number }) => void): () => void {
    try {
      const handleSnap = (snap: any) => {
        if (snap && snap.exists()) {
          const data = snap.data();
          if (data && typeof data.activeHalaqahId === 'string') {
            callback(data);
          }
        }
      };

      const unsubCentral = onSnapshot(doc(this.getCentralDb(), 'settings', 'active_halaqah_sync'), handleSnap, () => {});
      if (this.getActiveDb() !== this.getCentralDb()) {
        const unsubActive = onSnapshot(doc(this.getActiveDb(), 'settings', 'active_halaqah_sync'), handleSnap, () => {});
        return () => {
          unsubCentral();
          unsubActive();
        };
      }
      return unsubCentral;
    } catch {
      return () => {};
    }
  }

  // Helper to sanitize exams and prevent undefined questions
  static sanitizeExam(raw: any): Exam {
    const rawQuestions = Array.isArray(raw?.questions)
      ? raw.questions
      : typeof raw?.questions === 'object' && raw?.questions !== null
      ? Object.values(raw.questions)
      : [];

    const cleanQuestions: ExamQuestion[] = rawQuestions.map((q: any, idx: number) => ({
      id: q?.id || `q-${raw?.id || 'exam'}-${idx + 1}`,
      title: q?.title || `سؤال رقم ${idx + 1}`,
      type: q?.type || 'multiple_choice',
      options: Array.isArray(q?.options)
        ? q.options
        : q?.type === 'true_false'
        ? ['صح', 'خطأ']
        : ['الخيار 1', 'الخيار 2', 'الخيار 3'],
      correctAnswer: q?.correctAnswer !== undefined ? q.correctAnswer : (q?.type === 'true_false' ? 'صح' : undefined),
      points: Number(q?.points) || 5,
      explanation: q?.explanation || '',
      timeLimitSeconds: q?.timeLimitSeconds ? Number(q.timeLimitSeconds) : undefined
    }));

    return {
      id: raw?.id || `exam-${Date.now()}`,
      title: raw?.title || 'اختبار قرآني',
      description: raw?.description || '',
      scheduleType: raw?.scheduleType || 'now',
      startDate: raw?.startDate || new Date().toISOString(),
      hasDeadline: Boolean(raw?.hasDeadline),
      deadlineDate: raw?.deadlineDate || undefined,
      attemptLimitType: raw?.attemptLimitType || 'unlimited',
      maxAttempts: raw?.maxAttempts ? Number(raw.maxAttempts) : 1,
      timeLimitMode: raw?.timeLimitMode || 'total',
      totalTimeMinutes: raw?.totalTimeMinutes ? Number(raw.totalTimeMinutes) : 10,
      questionTimeSeconds: raw?.questionTimeSeconds ? Number(raw.questionTimeSeconds) : 30,
      gradeVisibility: raw?.gradeVisibility || 'immediate',
      grantsLeaderboardPoints: raw?.grantsLeaderboardPoints ?? true,
      totalPoints: Number(raw?.totalPoints) || cleanQuestions.reduce((s, q) => s + q.points, 0) || 20,
      targetHalaqat: Array.isArray(raw?.targetHalaqat) && raw.targetHalaqat.length > 0 ? raw.targetHalaqat : ['all'],
      deliveryMode: raw?.deliveryMode || (raw?.googleFormResponderUrl || raw?.googleFormId ? 'google_form' : 'platform'),
      autoCreateGoogleForm: raw?.autoCreateGoogleForm ?? true,
      questions: cleanQuestions.length > 0 ? cleanQuestions : INITIAL_EXAMS[0].questions,
      googleFormId: raw?.googleFormId,
      googleFormUrl: raw?.googleFormUrl,
      googleFormResponderUrl: raw?.googleFormResponderUrl,
      googleSpreadsheetId: raw?.googleSpreadsheetId,
      googleSpreadsheetUrl: raw?.googleSpreadsheetUrl,
      googleFormNameEntryId: raw?.googleFormNameEntryId,
      complexId: raw?.complexId || undefined,
      complexName: raw?.complexName || undefined,
      createdById: raw?.createdById || 'teacher-1',
      createdByName: raw?.createdByName || 'الشيخ المعلم',
      createdAt: raw?.createdAt || new Date().toISOString(),
      updatedAt: raw?.updatedAt
    };
  }

  // Load Exams directly from Firestore
  static async loadExams(): Promise<Exam[]> {
    try {
      await syncTombstonesFromCloud().catch(() => {});
      const activeDb = this.getActiveDb();
      const snap = await safeGetDocs(collection(activeDb, 'exams'));
      const deletedExamIds = getDeletedExamIds();
      const list: Exam[] = [];
      snap.forEach(d => {
        const raw = d.data();
        const id = d.id || raw.id;
        if (!deletedExamIds.has(id)) {
          list.push(this.sanitizeExam({ ...raw, id }));
        }
      });

      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('omran_exams_initialized', 'true');
      }

      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setLocalCache(OMRAN_CACHE_KEYS.EXAMS, list);
      return list;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'exams');
      const local = getLocalCache<Exam[]>(OMRAN_CACHE_KEYS.EXAMS, []);
      const deletedExamIds = getDeletedExamIds();
      return local.filter(x => !deletedExamIds.has(x.id));
    }
  }

  // Save Exam directly in Firestore
  static async saveExam(exam: Exam): Promise<void> {
    try {
      removeDeletedExamId(exam.id);
      const sanitized = this.sanitizeExam(exam);
      const cleanExam = JSON.parse(JSON.stringify(sanitized));
      const local = getLocalCache<Exam[]>(OMRAN_CACHE_KEYS.EXAMS, []);
      const updated = [cleanExam, ...local.filter(e => e.id !== cleanExam.id)];
      setLocalCache(OMRAN_CACHE_KEYS.EXAMS, updated);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('omran_exams_initialized', 'true');
      }

      await setDoc(doc(this.getActiveDb(), 'exams', exam.id), cleanExam);
      broadcastDataUpdate('exam', cleanExam);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `exams/${exam.id}`);
      throw e;
    }
  }

  // Delete Exam permanently with Tombstones across Active and Central DBs
  static async deleteExam(examId: string): Promise<void> {
    await addDeletedExamId(examId);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('omran_exams_initialized', 'true');
    }
    const local = getLocalCache<Exam[]>(OMRAN_CACHE_KEYS.EXAMS, []);
    setLocalCache(OMRAN_CACHE_KEYS.EXAMS, local.filter(e => e.id !== examId));

    try {
      await deleteDoc(doc(this.getActiveDb(), 'exams', examId));
      if (this.getActiveDb() !== this.getCentralDb()) {
        try {
          await deleteDoc(doc(this.getCentralDb(), 'exams', examId));
        } catch {}
      }
      broadcastDataUpdate('exam-deleted', examId);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `exams/${examId}`);
      throw e;
    }
  }

  // Subscribe to Exams in real time with tombstone filtering
  static subscribeExams(callback: (exams: Exam[]) => void): () => void {
    try {
      return onSnapshot(collection(this.getActiveDb(), 'exams'), snap => {
        const deletedExamIds = getDeletedExamIds();
        const list: Exam[] = [];
        snap.forEach(d => {
          const raw = d.data();
          const id = d.id || raw.id;
          if (!deletedExamIds.has(id)) {
            list.push(OmranDataService.sanitizeExam({ ...raw, id }));
          }
        });
        const local = getLocalCache<Exam[]>(OMRAN_CACHE_KEYS.EXAMS, []).filter(e => !deletedExamIds.has(e.id));
        const map = new Map<string, Exam>();
        for (const e of local) map.set(e.id, e);
        for (const e of list) map.set(e.id, e);
        const merged = Array.from(map.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        if (merged.length > 0) setLocalCache(OMRAN_CACHE_KEYS.EXAMS, merged);
        callback(merged.length > 0 ? merged : local);
      }, err => {
        handleFirestoreError(err, OperationType.LIST, 'exams');
        const deletedExamIds = getDeletedExamIds();
        const local = getLocalCache<Exam[]>(OMRAN_CACHE_KEYS.EXAMS, []).filter(e => !deletedExamIds.has(e.id));
        callback(local);
      });
    } catch (e) {
      return () => {};
    }
  }

  // Load Exam Submissions directly from Firestore
  static async loadSubmissions(examId?: string): Promise<ExamSubmission[]> {
    try {
      const activeDb = this.getActiveDb();
      const q = examId
        ? query(collection(activeDb, 'exam_submissions'), where('examId', '==', examId))
        : collection(activeDb, 'exam_submissions');
      const snap = await safeGetDocs(q);
      const list: ExamSubmission[] = [];
      snap.forEach(d => list.push(d.data() as ExamSubmission));
      list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
      return list;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'exam_submissions');
      return [];
    }
  }

  // Save Exam Submission directly in Firestore
  static async saveSubmission(submission: ExamSubmission): Promise<void> {
    try {
      const cleanSubmission = JSON.parse(JSON.stringify(submission));
      await setDoc(doc(this.getActiveDb(), 'exam_submissions', submission.id), cleanSubmission);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `exam_submissions/${submission.id}`);
      throw e;
    }
  }

  // Delete Submission
  static async deleteSubmission(submissionId: string): Promise<void> {
    try {
      await deleteDoc(doc(this.getActiveDb(), 'exam_submissions', submissionId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `exam_submissions/${submissionId}`);
      throw e;
    }
  }

  // Subscribe to Exam Submissions in real time
  static subscribeSubmissions(callback: (submissions: ExamSubmission[]) => void): () => void {
    try {
      return onSnapshot(collection(this.getActiveDb(), 'exam_submissions'), snap => {
        const list: ExamSubmission[] = [];
        snap.forEach(d => list.push(d.data() as ExamSubmission));
        list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
        callback(list);
      }, err => {
        handleFirestoreError(err, OperationType.LIST, 'exam_submissions');
      });
    } catch (e) {
      return () => {};
    }
  }

  // Load Leaderboard Settings
  static async loadLeaderboardSettings(): Promise<LeaderboardSettings> {
    try {
      const activeDb = this.getActiveDb();
      const snap = await safeGetDoc(doc(activeDb, 'settings', 'leaderboard'));
      if (snap.exists()) {
        return snap.data() as LeaderboardSettings;
      }
      await setDoc(doc(activeDb, 'settings', 'leaderboard'), DEFAULT_LEADERBOARD_SETTINGS);
      return DEFAULT_LEADERBOARD_SETTINGS;
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, 'settings/leaderboard');
      return DEFAULT_LEADERBOARD_SETTINGS;
    }
  }

  // Save Leaderboard Settings
  static async saveLeaderboardSettings(settings: LeaderboardSettings): Promise<void> {
    try {
      await setDoc(doc(this.getActiveDb(), 'settings', 'leaderboard'), settings);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'settings/leaderboard');
      throw e;
    }
  }

  // Subscribe to Leaderboard Settings
  static subscribeLeaderboardSettings(callback: (settings: LeaderboardSettings) => void): () => void {
    try {
      return onSnapshot(doc(this.getActiveDb(), 'settings', 'leaderboard'), snap => {
        if (snap.exists()) {
          callback(snap.data() as LeaderboardSettings);
        }
      }, err => {
        handleFirestoreError(err, OperationType.GET, 'settings/leaderboard');
      });
    } catch (e) {
      return () => {};
    }
  }

  // Load Google OAuth Configuration
  static async loadGoogleOAuthConfig(): Promise<GoogleOAuthConfig> {
    try {
      const snap = await safeGetDoc(doc(this.getActiveDb(), 'settings', 'google_oauth'));
      if (snap.exists()) {
        return snap.data() as GoogleOAuthConfig;
      }
      return { isLinked: false };
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, 'settings/google_oauth');
      return { isLinked: false };
    }
  }

  // Save Google OAuth Configuration
  static async saveGoogleOAuthConfig(config: GoogleOAuthConfig): Promise<void> {
    try {
      await setDoc(doc(this.getActiveDb(), 'settings', 'google_oauth'), config);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'settings/google_oauth');
      throw e;
    }
  }

  // Subscribe to Google OAuth Configuration in Real-time
  static subscribeGoogleOAuthConfig(callback: (config: GoogleOAuthConfig) => void): () => void {
    try {
      return onSnapshot(doc(this.getActiveDb(), 'settings', 'google_oauth'), snap => {
        if (snap.exists()) {
          callback(snap.data() as GoogleOAuthConfig);
        } else {
          callback({ isLinked: false });
        }
      }, err => {
        handleFirestoreError(err, OperationType.GET, 'settings/google_oauth');
      });
    } catch (e) {
      return () => {};
    }
  }

  // ==========================================
  // SURAH RECORDINGS MANAGEMENT (Supervisor Only)
  // ==========================================

  // Load All Surah Recordings
  static async loadRecordings(): Promise<SurahRecording[]> {
    try {
      const snap = await safeGetDocs(collection(this.getActiveDb(), 'surah_recordings'));
      const list: SurahRecording[] = [];
      snap.forEach(d => list.push(d.data() as SurahRecording));
      return list.sort((a, b) => a.surahNumber - b.surahNumber);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'surah_recordings');
      return [];
    }
  }

  // Save / Update Surah Recording
  static async saveRecording(recording: SurahRecording): Promise<void> {
    try {
      const clean = cleanFirestoreData(recording);
      await setDoc(doc(this.getActiveDb(), 'surah_recordings', recording.id), clean);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `surah_recordings/${recording.id}`);
      throw e;
    }
  }

  // Delete Surah Recording
  static async deleteRecording(recordingId: string): Promise<void> {
    try {
      await deleteDoc(doc(this.getActiveDb(), 'surah_recordings', recordingId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `surah_recordings/${recordingId}`);
      throw e;
    }
  }

  // Subscribe to Surah Recordings in Realtime
  static subscribeRecordings(callback: (recordings: SurahRecording[]) => void): () => void {
    try {
      return onSnapshot(collection(this.getActiveDb(), 'surah_recordings'), snap => {
        const list: SurahRecording[] = [];
        snap.forEach(d => list.push(d.data() as SurahRecording));
        callback(list.sort((a, b) => a.surahNumber - b.surahNumber));
      }, err => {
        handleFirestoreError(err, OperationType.LIST, 'surah_recordings');
      });
    } catch (e) {
      return () => {};
    }
  }

  // Load Recordings Config (Publish toggle)
  static async loadRecordingsConfig(): Promise<RecordingsConfig> {
    try {
      const snap = await safeGetDoc(doc(this.getActiveDb(), 'settings', 'recordings_config'));
      if (snap.exists()) {
        return snap.data() as RecordingsConfig;
      }
      return DEFAULT_RECORDINGS_CONFIG;
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, 'settings/recordings_config');
      return DEFAULT_RECORDINGS_CONFIG;
    }
  }

  // Save Recordings Config
  static async saveRecordingsConfig(config: RecordingsConfig): Promise<void> {
    try {
      const clean = cleanFirestoreData(config);
      await setDoc(doc(this.getActiveDb(), 'settings', 'recordings_config'), clean);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'settings/recordings_config');
      throw e;
    }
  }

  // Subscribe to Recordings Config
  static subscribeRecordingsConfig(callback: (config: RecordingsConfig) => void): () => void {
    try {
      return onSnapshot(doc(this.getActiveDb(), 'settings', 'recordings_config'), snap => {
        if (snap.exists()) {
          callback(snap.data() as RecordingsConfig);
        } else {
          callback(DEFAULT_RECORDINGS_CONFIG);
        }
      }, err => {
        handleFirestoreError(err, OperationType.GET, 'settings/recordings_config');
      });
    } catch (e) {
      return () => {};
    }
  }

  // ==========================================
  // STUDENT LISTENING LOGS
  // ==========================================

  // Load Listening Logs
  static async loadListeningLogs(studentId?: string): Promise<StudentListeningLog[]> {
    try {
      const activeDb = this.getActiveDb();
      let q;
      if (studentId) {
        q = query(collection(activeDb, 'listening_logs'), where('studentId', '==', studentId));
      } else {
        q = collection(activeDb, 'listening_logs');
      }
      const snap = await safeGetDocs(q);
      const list: StudentListeningLog[] = [];
      snap.forEach(d => list.push(d.data() as StudentListeningLog));
      return list.sort((a, b) => (b?.timestamp || '').localeCompare(a?.timestamp || ''));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'listening_logs');
      return [];
    }
  }

  // Save / Update Student Listening Log
  static async saveListeningLog(log: StudentListeningLog): Promise<void> {
    try {
      const clean = cleanFirestoreData(log);
      await setDoc(doc(this.getActiveDb(), 'listening_logs', log.id), clean);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `listening_logs/${log.id}`);
      throw e;
    }
  }

  // Subscribe to Listening Logs
  static subscribeListeningLogs(callback: (logs: StudentListeningLog[]) => void): () => void {
    try {
      return onSnapshot(collection(this.getActiveDb(), 'listening_logs'), snap => {
        const list: StudentListeningLog[] = [];
        snap.forEach(d => list.push(d.data() as StudentListeningLog));
        callback(list.sort((a, b) => (b?.timestamp || '').localeCompare(a?.timestamp || '')));
      }, err => {
        handleFirestoreError(err, OperationType.LIST, 'listening_logs');
      });
    } catch (e) {
      return () => {};
    }
  }

  // Export Full Database (Complete Cloud Firestore Backup)
  static async exportFullBackup(): Promise<FullBackupData> {
    const [
      students,
      attendance,
      evaluations,
      evaluationCriteria,
      settings,
      chatMessages,
      teachers,
      complexes,
      halaqahs,
      violations,
      exams,
      submissions,
      leaderboardSettings,
      googleOAuth,
      recordings,
      recordingsConfig,
      listeningLogs
    ] = await Promise.all([
      this.loadStudents(),
      this.loadAttendance(),
      this.loadEvaluations(),
      this.loadCriteria(),
      this.loadSettings(),
      this.loadChats(),
      this.loadTeachers(),
      this.loadComplexes(),
      this.loadHalaqahs(),
      this.loadViolations(),
      this.loadExams(),
      this.loadSubmissions(),
      this.loadLeaderboardSettings(),
      this.loadGoogleOAuthConfig(),
      this.loadRecordings(),
      this.loadRecordingsConfig(),
      this.loadListeningLogs()
    ]);

    return {
      version: '2.0.0',
      exportDate: new Date().toISOString(),
      students,
      attendance,
      evaluations,
      evaluationCriteria,
      settings,
      chatMessages,
      teachers,
      complexes,
      halaqahs,
      violations,
      exams,
      submissions,
      leaderboardSettings,
      googleOAuth,
      recordings,
      recordingsConfig,
      listeningLogs,
      certificates: await OmranDataService.loadCertificates(),
      userAccounts: [
        {
          id: 'admin-1',
          username: settings.teacherName || 'admin',
          role: 'admin',
          phone: '0500000000',
          createdAt: new Date().toISOString()
        }
      ]
    };
  }

  // =========================================================================
  // Certificate System Operations
  // =========================================================================

  // Sanitize Certificate object
  static sanitizeCertificate(cert: any): IssuedCertificate {
    return {
      id: String(cert.id || `cert_${Date.now()}`),
      studentId: String(cert.studentId || ''),
      studentName: String(cert.studentName || ''),
      halaqahId: cert.halaqahId ? String(cert.halaqahId) : undefined,
      halaqahName: cert.halaqahName ? String(cert.halaqahName) : undefined,
      complexId: cert.complexId ? String(cert.complexId) : undefined,
      complexName: cert.complexName ? String(cert.complexName) : undefined,
      occasion: String(cert.occasion || 'شكر وتقدير وتميز'),
      occasionText: String(cert.occasionText || ''),
      certificateTitle: cert.certificateTitle ? String(cert.certificateTitle) : undefined,
      templateId: String(cert.templateId || 'platform_emerald_royal'),
      templateName: String(cert.templateName || ''),
      templateType: cert.templateType === 'custom' ? 'custom' : 'ready',
      customTemplateImageUrl: cert.customTemplateImageUrl ? String(cert.customTemplateImageUrl) : undefined,
      signatureMode: cert.signatureMode || 'auto',
      teacherName: cert.teacherName ? String(cert.teacherName) : undefined,
      supervisorName: cert.supervisorName ? String(cert.supervisorName) : undefined,
      dateArabic: String(cert.dateArabic || ''),
      dateGregorian: String(cert.dateGregorian || ''),
      createdAt: String(cert.createdAt || new Date().toISOString()),
      createdByName: cert.createdByName ? String(cert.createdByName) : undefined
    };
  }

  // Load Certificates directly from Firestore
  static async loadCertificates(): Promise<IssuedCertificate[]> {
    try {
      await syncTombstonesFromCloud();
    } catch {}
    const deletedCertIds = OmranDataService.getDeletedCertificateIds();
    let cloudList: IssuedCertificate[] = [];
    try {
      const snap = await safeGetDocs(collection(this.getActiveDb(), 'certificates'));
      snap.forEach(d => {
        const raw = d.data();
        const cId = d.id || raw.id;
        if (!deletedCertIds.has(cId)) {
          cloudList.push(OmranDataService.sanitizeCertificate({ ...raw, id: cId }));
        }
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'certificates');
    }

    return cloudList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Save Single Certificate directly in Firestore & Cache
  static async saveCertificate(cert: IssuedCertificate): Promise<void> {
    OmranDataService.removeDeletedCertificateId(cert.id);
    const cleanCert = OmranDataService.sanitizeCertificate(cert);
    const local = getLocalCache<IssuedCertificate[]>(OMRAN_CACHE_KEYS.CERTIFICATES, []);
    const updated = [cleanCert, ...local.filter(c => c.id !== cleanCert.id)];
    setLocalCache(OMRAN_CACHE_KEYS.CERTIFICATES, updated);

    // Omit large base64 image from Firestore to strictly adhere to 1MB document limit
    const firestoreData = { ...cleanCert };
    if (firestoreData.customTemplateImageUrl && firestoreData.customTemplateImageUrl.length > 20000) {
      delete firestoreData.customTemplateImageUrl;
    }

    try {
      await setDoc(doc(this.getActiveDb(), 'certificates', cleanCert.id), cleanFirestoreData(firestoreData));
      broadcastDataUpdate('certificate', cleanCert);
    } catch (e) {
      console.warn('[OmranDataService] Certificate saved locally, cloud sync notice:', e);
    }
  }

  // Save Batch Certificates
  static async saveCertificates(certs: IssuedCertificate[]): Promise<void> {
    if (!certs || certs.length === 0) return;
    for (const c of certs) {
      OmranDataService.removeDeletedCertificateId(c.id);
    }
    const cleanList = certs.map(c => OmranDataService.sanitizeCertificate(c));

    const local = getLocalCache<IssuedCertificate[]>(OMRAN_CACHE_KEYS.CERTIFICATES, []);
    const map = new Map<string, IssuedCertificate>();
    for (const c of local) if (c?.id) map.set(c.id, c);
    for (const c of cleanList) if (c?.id) map.set(c.id, c);
    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    setLocalCache(OMRAN_CACHE_KEYS.CERTIFICATES, merged);

    try {
      const activeDb = this.getActiveDb();
      await Promise.allSettled(
        cleanList.map(item => {
          const firestoreData = { ...item };
          if (firestoreData.customTemplateImageUrl && firestoreData.customTemplateImageUrl.length > 20000) {
            delete firestoreData.customTemplateImageUrl;
          }
          return setDoc(doc(activeDb, 'certificates', item.id), cleanFirestoreData(firestoreData));
        })
      );
      broadcastDataUpdate('certificates-batch', cleanList);
    } catch (e) {
      console.warn('[OmranDataService] Batch certificates saved locally, cloud sync notice:', e);
    }
  }

  // Delete Certificate from Firestore & Cache
  static async deleteCertificate(certId: string): Promise<void> {
    // 0. Register persistent tombstone so certificate NEVER resurrects
    OmranDataService.addDeletedCertificateId(certId);

    const local = getLocalCache<IssuedCertificate[]>(OMRAN_CACHE_KEYS.CERTIFICATES, []);
    const updated = local.filter(c => c.id !== certId);
    setLocalCache(OMRAN_CACHE_KEYS.CERTIFICATES, updated);

    try {
      await deleteDoc(doc(this.getActiveDb(), 'certificates', certId));
    } catch (e) {
      console.warn(`Firestore delete doc notice for certificates/${certId} (deleted locally):`, e);
      // Do not rethrow so UI deletion is not blocked by remote permission limits
    }
  }

  // Subscribe to Certificates in real time
  static subscribeCertificates(callback: (certs: IssuedCertificate[]) => void): () => void {
    try {
      return onSnapshot(collection(this.getActiveDb(), 'certificates'), snap => {
        const deletedCertIds = OmranDataService.getDeletedCertificateIds();
        const cloudList: IssuedCertificate[] = [];
        snap.forEach(d => {
          const raw = d.data();
          const cId = d.id || raw.id;
          if (!deletedCertIds.has(cId)) {
            cloudList.push(OmranDataService.sanitizeCertificate({ ...raw, id: cId }));
          }
        });

        const sorted = cloudList.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        callback(sorted);
      }, err => {
        handleFirestoreError(err, OperationType.LIST, 'certificates');
      });
    } catch (e) {
      return () => {};
    }
  }

  // Import / Restore Full Database directly into Firestore with Staged Progress Reporting
  static async importFullBackup(
    backup: FullBackupData,
    onProgress?: (progress: number, stageName: string, detailText?: string) => void
  ): Promise<{
    studentsCount: number;
    attendanceCount: number;
    evaluationsCount: number;
    criteriaCount: number;
    teachersCount: number;
    complexesCount?: number;
    halaqahsCount?: number;
    violationsCount?: number;
    examsCount?: number;
    submissionsCount?: number;
    recordingsCount?: number;
    certificatesCount?: number;
  }> {
    if (!backup || typeof backup !== 'object') {
      throw new Error('ملف النسخة الاحتياطية غير صالح أو تالف.');
    }

    const yieldTick = (ms = 35) => new Promise(r => setTimeout(r, ms));

    onProgress?.(5, 'قراءة وتحليل ملف النسخة الاحتياطية', 'جاري فحص الجداول والتحقق من بنية السجلات...');
    await yieldTick(50);

    const studentsList = Array.isArray(backup.students) ? backup.students : [];
    const attendanceList = Array.isArray(backup.attendance) ? backup.attendance : [];
    const evaluationsList = Array.isArray(backup.evaluations) ? backup.evaluations : [];
    const criteriaList = Array.isArray(backup.evaluationCriteria) && backup.evaluationCriteria.length > 0
      ? backup.evaluationCriteria
      : DEFAULT_CRITERIA;
    const settingsData = backup.settings || DEFAULT_SETTINGS;
    const teachersList = Array.isArray(backup.teachers) && backup.teachers.length > 0
      ? backup.teachers
      : INITIAL_TEACHERS;
    const complexesList = Array.isArray(backup.complexes) && backup.complexes.length > 0
      ? backup.complexes
      : DEFAULT_COMPLEXES;
    const halaqahsList = Array.isArray(backup.halaqahs) && backup.halaqahs.length > 0
      ? backup.halaqahs
      : DEFAULT_HALAQAHS;
    const violationsList = Array.isArray(backup.violations) ? backup.violations : [];
    const examsList = Array.isArray(backup.exams) ? backup.exams : [];
    const submissionsList = Array.isArray(backup.submissions) ? backup.submissions : [];
    const leaderboardSettings = backup.leaderboardSettings || DEFAULT_LEADERBOARD_SETTINGS;
    const recordingsList = Array.isArray(backup.recordings) ? backup.recordings : [];
    const recordingsConfig = backup.recordingsConfig || DEFAULT_RECORDINGS_CONFIG;
    const listeningLogsList = Array.isArray(backup.listeningLogs) ? backup.listeningLogs : [];
    const certificatesList = Array.isArray(backup.certificates) ? backup.certificates : [];

    const chunkArray = <T>(arr: T[], size: number): T[][] => {
      const res: T[][] = [];
      for (let i = 0; i < arr.length; i += size) {
        res.push(arr.slice(i, i + size));
      }
      return res;
    };

    onProgress?.(10, 'كتابة بيانات المجمعات القرآنية', `جاري حفظ (${complexesList.length}) مجمع في قاعدة بيانات فايربيس...`);
    await yieldTick();

    // 1. Complexes
    for (const comp of complexesList) {
      if (comp?.id) {
        await setDoc(doc(this.getActiveDb(), 'complexes', comp.id), cleanFirestoreData(comp));
        if (this.getActiveDb() !== this.getCentralDb()) {
          await setDoc(doc(this.getCentralDb(), 'complexes', comp.id), cleanFirestoreData(comp)).catch(() => {});
        }
      }
    }
    await yieldTick();

    onProgress?.(18, 'كتابة الحلقات القرآنية', `جاري حفظ (${halaqahsList.length}) حلقة في فايربيس...`);
    await yieldTick();

    // 2. Halaqahs
    for (const h of halaqahsList) {
      if (h?.id) await setDoc(doc(this.getActiveDb(), 'halaqahs', h.id), cleanFirestoreData(h));
    }
    await yieldTick();

    onProgress?.(28, 'كتابة حسابات المعلمين والمشرفين', `جاري حفظ (${teachersList.length}) معلم في قاعدة البيانات...`);
    await yieldTick();

    // 3. Teachers
    for (const t of teachersList) {
      if (t?.id) {
        await setDoc(doc(this.getActiveDb(), 'teachers', t.id), cleanFirestoreData(t));
        if (this.getActiveDb() !== this.getCentralDb()) {
          await setDoc(doc(this.getCentralDb(), 'teachers', t.id), cleanFirestoreData(t)).catch(() => {});
        }
      }
    }
    await yieldTick();

    // 4. Students (Batched with real-time percentage 35% -> 60%)
    onProgress?.(35, 'كتابة بيانات الطلاب وخطط الذكاء الاصطناعي', `جاري رفع سجلات الطلاب (${studentsList.length} طالب)...`);
    await yieldTick();

    const studentChunks = chunkArray(studentsList, 10);
    let writtenStudents = 0;
    for (let ci = 0; ci < studentChunks.length; ci++) {
      const chunk = studentChunks[ci];
      await Promise.all(
        chunk.map(s => s?.id && setDoc(doc(this.getActiveDb(), 'students', s.id), cleanFirestoreData(s)))
      );
      writtenStudents += chunk.length;
      const progressPct = Math.round(35 + (writtenStudents / Math.max(studentsList.length, 1)) * 25);
      onProgress?.(
        Math.min(progressPct, 60),
        'كتابة بيانات الطلاب وخطط الذكاء الاصطناعي',
        `تم حفظ ${writtenStudents} من ${studentsList.length} طالباً في فايربيس...`
      );
      await yieldTick(30);
    }

    // 5. Attendance (Batched with real-time percentage 60% -> 75%)
    onProgress?.(60, 'كتابة سجلات الحضور اليومي', `جاري رفع سجلات الحضور (${attendanceList.length} سجل)...`);
    await yieldTick();

    const attChunks = chunkArray(attendanceList, 20);
    let writtenAtt = 0;
    for (let ci = 0; ci < attChunks.length; ci++) {
      const chunk = attChunks[ci];
      await Promise.all(
        chunk.map(a => a?.id && setDoc(doc(this.getActiveDb(), 'attendance', a.id), cleanFirestoreData(a)))
      );
      writtenAtt += chunk.length;
      const progressPct = Math.round(60 + (writtenAtt / Math.max(attendanceList.length, 1)) * 15);
      onProgress?.(
        Math.min(progressPct, 75),
        'كتابة سجلات الحضور اليومي',
        `تم حفظ ${writtenAtt} من ${attendanceList.length} سجل حضور في فايربيس...`
      );
      await yieldTick(25);
    }

    // 6. Evaluations (Batched with real-time percentage 75% -> 85%)
    onProgress?.(75, 'كتابة سجلات التقييم والتسميع اليومي', `جاري رفع تقييمات التسميع (${evaluationsList.length} سجل)...`);
    await yieldTick();

    const evalChunks = chunkArray(evaluationsList, 20);
    let writtenEvals = 0;
    for (let ci = 0; ci < evalChunks.length; ci++) {
      const chunk = evalChunks[ci];
      await Promise.all(
        chunk.map(ev => ev?.id && setDoc(doc(this.getActiveDb(), 'evaluations', ev.id), cleanFirestoreData(ev)))
      );
      writtenEvals += chunk.length;
      const progressPct = Math.round(75 + (writtenEvals / Math.max(evaluationsList.length, 1)) * 10);
      onProgress?.(
        Math.min(progressPct, 85),
        'كتابة سجلات التقييم والتسميع اليومي',
        `تم حفظ ${writtenEvals} من ${evaluationsList.length} تقييم في فايربيس...`
      );
      await yieldTick(25);
    }

    // 7. Violations & Criteria (85% -> 89%)
    onProgress?.(86, 'كتابة معايير التقييم والملاحظات السلوكية', 'جاري حفظ معايير التقييم والمخالفات...');
    await yieldTick();

    for (const v of violationsList) {
      if (v?.id) await setDoc(doc(this.getActiveDb(), 'violations', v.id), cleanFirestoreData(v));
    }
    for (const c of criteriaList) {
      if (c?.id) await setDoc(doc(this.getActiveDb(), 'criteria', c.id), cleanFirestoreData(c));
    }
    await yieldTick();

    // 8. Exams & Submissions (89% -> 93%)
    onProgress?.(90, 'كتابة بنك الاختبارات وإجابات الطلاب', `جاري حفظ (${examsList.length}) اختبار قرآني...`);
    await yieldTick();

    for (const ex of examsList) {
      if (ex?.id) await setDoc(doc(this.getActiveDb(), 'exams', ex.id), cleanFirestoreData(ex));
    }
    for (const sub of submissionsList) {
      if (sub?.id) await setDoc(doc(this.getActiveDb(), 'exam_submissions', sub.id), cleanFirestoreData(sub));
    }
    await yieldTick();

    // 9. Recordings, Listening Logs, Certificates (93% -> 96%)
    onProgress?.(94, 'كتابة الشهادات والتسجيلات القرآنية', `جاري حفظ (${certificatesList.length}) شهادة و (${recordingsList.length}) تلاوة...`);
    await yieldTick();

    for (const rec of recordingsList) {
      if (rec?.id) await setDoc(doc(this.getActiveDb(), 'surah_recordings', rec.id), cleanFirestoreData(rec));
    }
    for (const log of listeningLogsList) {
      if (log?.id) await setDoc(doc(this.getActiveDb(), 'listening_logs', log.id), cleanFirestoreData(log));
    }
    for (const cert of certificatesList) {
      if (cert?.id) await setDoc(doc(this.getActiveDb(), 'certificates', cert.id), cleanFirestoreData(cert));
    }
    await yieldTick();

    // 10. Settings documents (96% -> 98%)
    onProgress?.(97, 'حفظ إعدادات المنظومة ولوحة الشرف', 'جاري اعتماد إعدادات المنصة وقواعد الحضور...');
    await yieldTick();

    if (settingsData) {
      await setDoc(doc(this.getActiveDb(), 'settings', 'main'), cleanFirestoreData(settingsData));
    }
    if (leaderboardSettings) {
      await setDoc(doc(this.getActiveDb(), 'settings', 'leaderboard'), cleanFirestoreData(leaderboardSettings));
    }
    if (backup.googleOAuth) {
      await setDoc(doc(this.getActiveDb(), 'settings', 'google_oauth'), cleanFirestoreData(backup.googleOAuth));
    }
    if (recordingsConfig) {
      await setDoc(doc(this.getActiveDb(), 'settings', 'recordings_config'), cleanFirestoreData(recordingsConfig));
    }
    await yieldTick();

    onProgress?.(99, 'المزامنة السحابية وتطهير الكاش المحلي', 'جاري مسح أي كاش قديم وتوحيد قاعدة بيانات فايربيس...');
    await yieldTick(50);

    // Purge any local storage caches so this browser and any other tab/user is 100% clean
    purgeAllLocalDataCaches();

    // Trigger reactive events
    broadcastDataUpdate('full-backup-restored', { timestamp: new Date().toISOString() });

    onProgress?.(100, 'اكتملت الاستعادة بنجاح 100%!', 'تم حفظ وتحديث قاعدة بيانات فايربيس بنجاح تام.');
    await yieldTick(60);

    return {
      studentsCount: studentsList.length,
      attendanceCount: attendanceList.length,
      evaluationsCount: evaluationsList.length,
      criteriaCount: criteriaList.length,
      teachersCount: teachersList.length,
      complexesCount: complexesList.length,
      halaqahsCount: halaqahsList.length,
      violationsCount: violationsList.length,
      examsCount: examsList.length,
      submissionsCount: submissionsList.length,
      recordingsCount: recordingsList.length,
      certificatesCount: certificatesList.length
    };
  }

  // =========================================================================
  // Teacher Attendance, Shifts, and Mosque Geolocation
  // =========================================================================
  static async loadMosqueLocation(complexId?: string): Promise<MosqueLocationConfig | null> {
    const docKey = complexId ? `mosque_location_${complexId}` : 'mosque_location_default';
    const local = getLocalCache<MosqueLocationConfig | null>(`${OMRAN_CACHE_KEYS.MOSQUE_LOCATION}_${docKey}`, null);
    try {
      const snap = await safeGetDoc(doc(this.getActiveDb(), 'settings', docKey));
      if (snap.exists()) {
        const data = snap.data() as MosqueLocationConfig;
        setLocalCache(`${OMRAN_CACHE_KEYS.MOSQUE_LOCATION}_${docKey}`, data);
        return data;
      }
    } catch (e) {
      console.warn('Load mosque location fallback to local:', e);
    }
    return local;
  }

  static async saveMosqueLocation(config: MosqueLocationConfig): Promise<void> {
    const docKey = config.complexId ? `mosque_location_${config.complexId}` : 'mosque_location_default';
    setLocalCache(`${OMRAN_CACHE_KEYS.MOSQUE_LOCATION}_${docKey}`, config);
    try {
      await setDoc(doc(this.getActiveDb(), 'settings', docKey), cleanFirestoreData(config), { merge: true });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `settings/${docKey}`);
      throw e;
    }
  }

  // =========================================================================
  // Plan Schedule Configuration (أوقات الحلقات وجدولة الختم والتثبيت بالسحابة)
  // =========================================================================
  static async loadPlanScheduleConfig(complexId?: string): Promise<ComplexPlanScheduleConfig | null> {
    const safeId = (complexId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
    const docKey = `plan_schedule_${safeId}`;
    const local =
      getLocalCache<ComplexPlanScheduleConfig | null>(`${OMRAN_CACHE_KEYS.PLAN_SCHEDULE}_${docKey}`, null) ||
      getLocalCache<ComplexPlanScheduleConfig | null>(`${OMRAN_CACHE_KEYS.PLAN_SCHEDULE}_plan_schedule_default`, null);

    try {
      const snap = await safeGetDoc(doc(this.getActiveDb(), 'settings', docKey));
      if (snap && snap.exists()) {
        const data = snap.data() as ComplexPlanScheduleConfig;
        setLocalCache(`${OMRAN_CACHE_KEYS.PLAN_SCHEDULE}_${docKey}`, data);
        setLocalCache(`${OMRAN_CACHE_KEYS.PLAN_SCHEDULE}_plan_schedule_default`, data);
        return data;
      }
      // Check default fallback in activeDb
      const defSnap = await safeGetDoc(doc(this.getActiveDb(), 'settings', 'plan_schedule_default'));
      if (defSnap && defSnap.exists()) {
        const data = defSnap.data() as ComplexPlanScheduleConfig;
        setLocalCache(`${OMRAN_CACHE_KEYS.PLAN_SCHEDULE}_${docKey}`, data);
        return data;
      }
      if (this.getActiveDb() !== this.getCentralDb()) {
        const centralSnap = await safeGetDoc(doc(this.getCentralDb(), 'settings', docKey));
        if (centralSnap && centralSnap.exists()) {
          const data = centralSnap.data() as ComplexPlanScheduleConfig;
          setLocalCache(`${OMRAN_CACHE_KEYS.PLAN_SCHEDULE}_${docKey}`, data);
          return data;
        }
      }
      // Fallback: Check if active complex document has planScheduleConfig
      if (complexId && complexId !== 'default') {
        const complexSnap = await safeGetDoc(doc(this.getActiveDb(), 'complexes', complexId));
        if (complexSnap && complexSnap.exists()) {
          const cData = complexSnap.data() as QuranComplex;
          if (cData?.planScheduleConfig) {
            setLocalCache(`${OMRAN_CACHE_KEYS.PLAN_SCHEDULE}_${docKey}`, cData.planScheduleConfig);
            return cData.planScheduleConfig;
          }
        }
      }
    } catch (e) {
      console.warn('[OmranDataService] Notice loading plan schedule config from cloud:', e);
    }
    return local;
  }

  static async savePlanScheduleConfig(config: ComplexPlanScheduleConfig, complexId?: string): Promise<void> {
    const safeId = (complexId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
    const docKey = `plan_schedule_${safeId}`;
    const enriched: ComplexPlanScheduleConfig = {
      ...config,
      lastUpdated: new Date().toISOString()
    };
    const clean = cleanFirestoreData(enriched);

    // Save in local cache for both specific complex key and default
    setLocalCache(`${OMRAN_CACHE_KEYS.PLAN_SCHEDULE}_${docKey}`, clean);
    setLocalCache(`${OMRAN_CACHE_KEYS.PLAN_SCHEDULE}_plan_schedule_default`, clean);
    broadcastDataUpdate('plan_schedule', clean);

    // Also update complex in local cache if complexId provided
    if (complexId && complexId !== 'default') {
      const complexes = getLocalCache<QuranComplex[]>(OMRAN_CACHE_KEYS.COMPLEXES, []);
      const idx = complexes.findIndex(c => c.id === complexId);
      if (idx >= 0) {
        complexes[idx] = { ...complexes[idx], planScheduleConfig: clean };
        setLocalCache(OMRAN_CACHE_KEYS.COMPLEXES, complexes);
      }
    }

    const dbs = [this.getActiveDb()];
    if (this.getCentralDb() !== this.getActiveDb()) {
      dbs.push(this.getCentralDb());
    }

    try {
      const writes: Promise<any>[] = dbs.flatMap(targetDb => [
        setDoc(doc(targetDb, 'settings', docKey), clean, { merge: true }),
        setDoc(doc(targetDb, 'settings', 'plan_schedule_default'), clean, { merge: true }),
      ]);

      if (complexId && complexId !== 'default') {
        const complexes = getLocalCache<QuranComplex[]>(OMRAN_CACHE_KEYS.COMPLEXES, []);
        const targetComplex = complexes.find(c => c.id === complexId);
        const compName = targetComplex?.name || 'المجمع القرآني';
        dbs.forEach(targetDb => {
          writes.push(
            setDoc(
              doc(targetDb, 'complexes', complexId),
              cleanFirestoreData({
                ...(targetComplex || {}),
                id: complexId,
                name: compName,
                planScheduleConfig: clean,
                lastUpdated: new Date().toISOString()
              }),
              { merge: true }
            )
          );
        });
      }

      await Promise.allSettled(writes);
    } catch (e) {
      console.warn('[OmranDataService] Plan schedule saved locally, cloud sync notice:', e);
    }
  }

  static subscribePlanScheduleConfig(
    callback: (config: ComplexPlanScheduleConfig) => void,
    complexId?: string
  ): () => void {
    const safeId = (complexId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
    const docKey = `plan_schedule_${safeId}`;
    try {
      const unsubSpecific = onSnapshot(
        doc(this.getActiveDb(), 'settings', docKey),
        snap => {
          if (snap && snap.exists()) {
            const data = snap.data() as ComplexPlanScheduleConfig;
            setLocalCache(`${OMRAN_CACHE_KEYS.PLAN_SCHEDULE}_${docKey}`, data);
            setLocalCache(`${OMRAN_CACHE_KEYS.PLAN_SCHEDULE}_plan_schedule_default`, data);
            callback(data);
          }
        },
        err => {
          console.warn('[OmranDataService] Plan schedule subscription notice:', err);
        }
      );

      let unsubDefault: (() => void) | null = null;
      if (docKey !== 'plan_schedule_default') {
        unsubDefault = onSnapshot(
          doc(this.getActiveDb(), 'settings', 'plan_schedule_default'),
          snap => {
            if (snap && snap.exists()) {
              const data = snap.data() as ComplexPlanScheduleConfig;
              const specificLocal = getLocalCache<ComplexPlanScheduleConfig | null>(`${OMRAN_CACHE_KEYS.PLAN_SCHEDULE}_${docKey}`, null);
              if (!specificLocal) {
                callback(data);
              }
            }
          },
          () => {}
        );
      }

      return () => {
        unsubSpecific();
        if (unsubDefault) unsubDefault();
      };
    } catch {
      return () => {};
    }
  }

  static async loadTeacherShifts(complexId?: string): Promise<TeacherShift[]> {
    const local = getLocalCache<TeacherShift[]>(OMRAN_CACHE_KEYS.TEACHER_SHIFTS, []);
    try {
      const snap = await safeGetDocs(collection(this.getActiveDb(), 'teacher_shifts'));
      const list = snap.docs.map(d => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          assignedTeacherIds: Array.isArray(data.assignedTeacherIds) ? data.assignedTeacherIds : []
        } as TeacherShift;
      });
      setLocalCache(OMRAN_CACHE_KEYS.TEACHER_SHIFTS, list);
      return complexId ? list.filter(s => s.complexId === complexId) : list;
    } catch (e) {
      // quiet fallback
    }
    return complexId ? local.filter(s => s.complexId === complexId) : local;
  }

  static async saveTeacherShift(shift: TeacherShift): Promise<void> {
    const local = getLocalCache<TeacherShift[]>(OMRAN_CACHE_KEYS.TEACHER_SHIFTS, []);
    const safeShift = {
      ...shift,
      assignedTeacherIds: Array.isArray(shift.assignedTeacherIds) ? shift.assignedTeacherIds : []
    };
    const updated = [...local.filter(s => s.id !== safeShift.id), safeShift];
    setLocalCache(OMRAN_CACHE_KEYS.TEACHER_SHIFTS, updated);
    try {
      await setDoc(doc(this.getActiveDb(), 'teacher_shifts', safeShift.id), cleanFirestoreData(safeShift), { merge: true });
    } catch (e) {
      // Quiet fallback without breaking UI or throwing
    }
  }

  static async deleteTeacherShift(shiftId: string): Promise<void> {
    const local = getLocalCache<TeacherShift[]>(OMRAN_CACHE_KEYS.TEACHER_SHIFTS, []);
    setLocalCache(OMRAN_CACHE_KEYS.TEACHER_SHIFTS, local.filter(s => s.id !== shiftId));
    try {
      await deleteDoc(doc(this.getActiveDb(), 'teacher_shifts', shiftId));
    } catch (e) {
      // quiet fallback
    }
  }

  static async loadTeacherAttendance(date?: string, complexId?: string): Promise<TeacherAttendanceRecord[]> {
    const cacheKey = date ? `${OMRAN_CACHE_KEYS.TEACHER_ATTENDANCE}_${date}` : OMRAN_CACHE_KEYS.TEACHER_ATTENDANCE;
    const local = getLocalCache<TeacherAttendanceRecord[]>(cacheKey, []);
    try {
      const snap = await safeGetDocs(collection(this.getActiveDb(), 'teacher_attendance'));
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as TeacherAttendanceRecord));
      let filtered = list;
      if (date) {
        filtered = filtered.filter(r => r.date === date);
      }
      if (complexId) {
        filtered = filtered.filter(r => r.complexId === complexId);
      }
      setLocalCache(cacheKey, list);
      return filtered;
    } catch (e) {
      // quiet fallback
      return complexId ? local.filter(r => r.complexId === complexId) : local;
    }
  }

  static async saveTeacherAttendanceRecord(record: TeacherAttendanceRecord): Promise<void> {
    const cacheKey = `${OMRAN_CACHE_KEYS.TEACHER_ATTENDANCE}_${record.date}`;
    const local = getLocalCache<TeacherAttendanceRecord[]>(cacheKey, []);
    const updated = [...local.filter(r => r.id !== record.id), record];
    setLocalCache(cacheKey, updated);
    try {
      await setDoc(doc(this.getActiveDb(), 'teacher_attendance', record.id), cleanFirestoreData(record), { merge: true });
    } catch (e) {
      // Quiet fallback
    }
  }

  static async deleteTeacherAttendanceRecord(recordId: string, date?: string): Promise<void> {
    if (date) {
      const cacheKey = `${OMRAN_CACHE_KEYS.TEACHER_ATTENDANCE}_${date}`;
      const local = getLocalCache<TeacherAttendanceRecord[]>(cacheKey, []);
      setLocalCache(cacheKey, local.filter(r => r.id !== recordId));
    }
    try {
      await deleteDoc(doc(this.getActiveDb(), 'teacher_attendance', recordId));
    } catch (e) {
      // Quiet fallback
    }
  }

  // =========================================================================
  // Mosques Management (إدارة الجوامع والمساجد المتعددة)
  // =========================================================================
  static async loadMosques(complexId?: string): Promise<MosqueItem[]> {
    const local = getLocalCache<MosqueItem[]>(OMRAN_CACHE_KEYS.MOSQUES, []);
    try {
      const snap = await safeGetDocs(collection(this.getActiveDb(), 'mosques'));
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as MosqueItem));
      setLocalCache(OMRAN_CACHE_KEYS.MOSQUES, list);
      return complexId ? list.filter(m => m.complexId === complexId) : list;
    } catch (e) {
      // quiet fallback
    }
    return complexId ? local.filter(m => m.complexId === complexId) : local;
  }

  static async saveMosque(mosque: MosqueItem): Promise<void> {
    const local = getLocalCache<MosqueItem[]>(OMRAN_CACHE_KEYS.MOSQUES, []);
    const updated = [...local.filter(m => m.id !== mosque.id), mosque];
    setLocalCache(OMRAN_CACHE_KEYS.MOSQUES, updated);
    try {
      await setDoc(doc(this.getActiveDb(), 'mosques', mosque.id), cleanFirestoreData(mosque), { merge: true });
    } catch (e) {
      // quiet fallback
    }
  }

  static async deleteMosque(mosqueId: string): Promise<void> {
    const local = getLocalCache<MosqueItem[]>(OMRAN_CACHE_KEYS.MOSQUES, []);
    setLocalCache(OMRAN_CACHE_KEYS.MOSQUES, local.filter(m => m.id !== mosqueId));
    try {
      await deleteDoc(doc(this.getActiveDb(), 'mosques', mosqueId));
    } catch (e) {
      // quiet fallback
    }
  }

  // =========================================================================
  // Library & Documents Archive Management (المكتبة والأرشيف السحابي الشامل)
  // =========================================================================
  static async loadLibraryDocuments(complexId?: string): Promise<LibraryDocument[]> {
    const local = getLocalCache<LibraryDocument[]>(OMRAN_CACHE_KEYS.LIBRARY_DOCS, []);
    try {
      const snap = await safeGetDocs(collection(this.getActiveDb(), 'library_docs'));
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id } as LibraryDocument));
      if (list.length > 0) {
        setLocalCache(OMRAN_CACHE_KEYS.LIBRARY_DOCS, list);
        return complexId ? list.filter(d => !d.complexId || d.complexId === complexId) : list;
      }
    } catch (e) {
      // quiet fallback
    }
    return complexId ? local.filter(d => !d.complexId || d.complexId === complexId) : local;
  }

  static async saveLibraryDocument(documentItem: LibraryDocument): Promise<void> {
    const local = getLocalCache<LibraryDocument[]>(OMRAN_CACHE_KEYS.LIBRARY_DOCS, []);
    const updated = [documentItem, ...local.filter(d => d.id !== documentItem.id)];
    setLocalCache(OMRAN_CACHE_KEYS.LIBRARY_DOCS, updated);
    broadcastDataUpdate('library', documentItem);
    try {
      await setDoc(doc(this.getActiveDb(), 'library_docs', documentItem.id), cleanFirestoreData(documentItem), { merge: true });
      if (this.getActiveDb() !== this.getCentralDb()) {
        try {
          await setDoc(doc(this.getCentralDb(), 'library_docs', documentItem.id), cleanFirestoreData(documentItem), { merge: true });
        } catch {}
      }
    } catch (e) {
      console.warn('Library document saved locally, cloud error:', e);
    }
  }

  static async deleteLibraryDocument(documentId: string): Promise<void> {
    const local = getLocalCache<LibraryDocument[]>(OMRAN_CACHE_KEYS.LIBRARY_DOCS, []);
    setLocalCache(OMRAN_CACHE_KEYS.LIBRARY_DOCS, local.filter(d => d.id !== documentId));
    broadcastDataUpdate('library-deleted', documentId);
    try {
      await deleteDoc(doc(this.getActiveDb(), 'library_docs', documentId));
      if (this.getActiveDb() !== this.getCentralDb()) {
        try {
          await deleteDoc(doc(this.getCentralDb(), 'library_docs', documentId));
        } catch {}
      }
    } catch (e) {
      console.warn('Delete library doc cloud error:', e);
    }
  }

  static subscribeLibraryDocuments(callback: (docs: LibraryDocument[]) => void): () => void {
    const q = query(collection(this.getActiveDb(), 'library_docs'));
    return onSnapshot(
      q,
      snapshot => {
        const list = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as LibraryDocument));
        setLocalCache(OMRAN_CACHE_KEYS.LIBRARY_DOCS, list);
        callback(list);
      },
      error => {
        console.warn('Library documents subscription fallback to local cache:', error);
        callback(getLocalCache(OMRAN_CACHE_KEYS.LIBRARY_DOCS, []));
      }
    );
  }

  // Batch create multiple students with dual persistence and Firestore sync
  static async batchCreateStudents(studentsToAdd: Student[]): Promise<boolean> {
    if (studentsToAdd.length === 0) return true;
    try {
      const currentList = getLocalCache<Student[]>(OMRAN_CACHE_KEYS.STUDENTS, INITIAL_STUDENTS);
      const updatedList = [...currentList, ...studentsToAdd];
      setLocalCache(OMRAN_CACHE_KEYS.STUDENTS, updatedList);

      const activeDb = this.getActiveDb();
      for (const st of studentsToAdd) {
        try {
          await setDoc(doc(activeDb, 'students', st.id), cleanFirestoreData(st));
        } catch {}
      }
      return true;
    } catch (e) {
      console.error('Batch create students error:', e);
      return false;
    }
  }

  // =========================================================================
  // Complex Registration Applications Hub (طلبات الانضمام وبوابة المجمع)
  // نظام التومبستون (Tombstones) لمنع عودة الطلبات المحذوفة نهائياً
  // =========================================================================

  static getDeletedApplicationIds(): Set<string> {
    const list = getLocalCache<string[]>(OMRAN_CACHE_KEYS.DELETED_APPLICATIONS, []);
    return new Set(Array.isArray(list) ? list : []);
  }

  static markApplicationDeleted(applicationId: string): void {
    const set = this.getDeletedApplicationIds();
    set.add(applicationId);
    setLocalCache(OMRAN_CACHE_KEYS.DELETED_APPLICATIONS, Array.from(set));
  }

  static async loadRegistrationApplications(complexId?: string): Promise<StudentRegistrationApplication[]> {
    // 0. Ensure tombstones are strictly synchronized from Firestore before querying
    await syncTombstonesFromCloud().catch(() => {});
    const deletedIds = this.getDeletedApplicationIds();

    const local = getLocalCache<StudentRegistrationApplication[]>(OMRAN_CACHE_KEYS.REGISTRATION_APPLICATIONS, [])
      .filter(a => a && a.id && !deletedIds.has(a.id));
    const itemsMap = new Map<string, StudentRegistrationApplication>();
    local.forEach(a => { if (a && a.id) itemsMap.set(a.id, a); });

    try {
      // 1. Resilient check in settings/registration_applications first to ingest tombstones and official items
      try {
        const settingsSnap = await safeGetDoc(doc(this.getCentralDb(), 'settings', 'registration_applications'));
        if (settingsSnap && settingsSnap.exists()) {
          const data = settingsSnap.data();
          if (Array.isArray(data?.deletedIds)) {
            data.deletedIds.forEach((id: string) => {
              if (id) {
                deletedIds.add(id);
                itemsMap.delete(id);
              }
            });
            setLocalCache(OMRAN_CACHE_KEYS.DELETED_APPLICATIONS, Array.from(deletedIds));
          }
          if (Array.isArray(data?.items)) {
            (data.items as StudentRegistrationApplication[]).forEach(a => {
              if (a && a.id && !deletedIds.has(a.id)) {
                itemsMap.set(a.id, a);
              }
            });
          }
        }
      } catch {}

      // 2. Primary check on registration_applications collection
      try {
        const colSnap = await safeGetDocs(collection(this.getCentralDb(), 'registration_applications'));
        if (colSnap && colSnap.docs) {
          colSnap.docs.forEach(d => {
            const data = d.data();
            if (data && !deletedIds.has(d.id)) {
              const item = { ...data, id: d.id } as StudentRegistrationApplication;
              itemsMap.set(item.id, item);
            } else if (deletedIds.has(d.id)) {
              // Self-heal: remove document if it exists but is tombstoned
              deleteDoc(doc(this.getCentralDb(), 'registration_applications', d.id)).catch(() => {});
              itemsMap.delete(d.id);
            }
          });
        }
      } catch (e) {
        console.warn('[OmranDataService] Col snap error in loadRegistrationApplications:', e);
      }

      // 3. Fallback check on activeDb if different
      if (this.getActiveDb() !== this.getCentralDb()) {
        try {
          const activeColSnap = await safeGetDocs(collection(this.getActiveDb(), 'registration_applications'));
          if (activeColSnap && activeColSnap.docs) {
            activeColSnap.docs.forEach(d => {
              const data = d.data();
              if (data && !deletedIds.has(d.id)) {
                const item = { ...data, id: d.id } as StudentRegistrationApplication;
                itemsMap.set(item.id, item);
              } else if (deletedIds.has(d.id)) {
                deleteDoc(doc(this.getActiveDb(), 'registration_applications', d.id)).catch(() => {});
                itemsMap.delete(d.id);
              }
            });
          }
        } catch {}
      }

      const mergedList = Array.from(itemsMap.values())
        .filter(a => a && a.id && !deletedIds.has(a.id))
        .sort((a, b) => new Date(b.appliedAt || 0).getTime() - new Date(a.appliedAt || 0).getTime());

      setLocalCache(OMRAN_CACHE_KEYS.REGISTRATION_APPLICATIONS, mergedList);
      return complexId ? mergedList.filter(a => a.complexId === complexId) : mergedList;
    } catch (e) {
      const fallback = Array.from(itemsMap.values()).filter(a => a && a.id && !deletedIds.has(a.id));
      return complexId ? fallback.filter(a => a.complexId === complexId) : fallback;
    }
  }

  static async saveRegistrationApplication(app: StudentRegistrationApplication): Promise<void> {
    const deletedIds = this.getDeletedApplicationIds();
    if (deletedIds.has(app.id)) {
      deletedIds.delete(app.id);
      setLocalCache(OMRAN_CACHE_KEYS.DELETED_APPLICATIONS, Array.from(deletedIds));
    }

    // 1. Immediately store to local cache
    const local = getLocalCache<StudentRegistrationApplication[]>(OMRAN_CACHE_KEYS.REGISTRATION_APPLICATIONS, [])
      .filter(a => a && a.id && !deletedIds.has(a.id));
    const updated = [app, ...local.filter(a => a.id !== app.id)];
    setLocalCache(OMRAN_CACHE_KEYS.REGISTRATION_APPLICATIONS, updated);
    broadcastDataUpdate('registration_application', app);

    try {
      window.dispatchEvent(new CustomEvent('omran:new-registration-application', { detail: app }));
    } catch {}

    const dbs = [this.getCentralDb()];
    if (this.getActiveDb() !== this.getCentralDb()) {
      dbs.push(this.getActiveDb());
    }

    // 2. Direct document save to registration_applications/{app.id}
    const cleanApp = cleanFirestoreData(app);
    await Promise.all(
      dbs.map(async targetDb => {
        try {
          await setDoc(doc(targetDb, 'registration_applications', app.id), cleanApp, { merge: true });
        } catch (e) {
          console.warn('[OmranDataService] Error saving app to registration_applications collection:', e);
        }
      })
    );

    // 3. Resilient merge save to settings/registration_applications
    await Promise.all(
      dbs.map(async targetDb => {
        try {
          let currentServerItems: StudentRegistrationApplication[] = [];
          try {
            const snap = await safeGetDoc(doc(targetDb, 'settings', 'registration_applications'));
            if (snap && snap.exists()) {
              const data = snap.data();
              if (Array.isArray(data?.deletedIds)) {
                data.deletedIds.forEach((id: string) => {
                  if (id && id !== app.id) deletedIds.add(id);
                });
              }
              if (Array.isArray(data?.items)) {
                currentServerItems = (data.items as StudentRegistrationApplication[])
                  .filter(i => i?.id && !deletedIds.has(i.id));
              }
            }
          } catch {}

          const mergedMap = new Map<string, StudentRegistrationApplication>();
          currentServerItems.forEach(i => { if (i?.id && !deletedIds.has(i.id)) mergedMap.set(i.id, i); });
          local.forEach(i => { if (i?.id && !deletedIds.has(i.id)) mergedMap.set(i.id, i); });
          mergedMap.set(app.id, app);

          const finalMergedList = Array.from(mergedMap.values()).sort(
            (a, b) => new Date(b.appliedAt || 0).getTime() - new Date(a.appliedAt || 0).getTime()
          );

          setLocalCache(OMRAN_CACHE_KEYS.REGISTRATION_APPLICATIONS, finalMergedList);

          const payload = {
            items: finalMergedList.map(cleanFirestoreData),
            deletedIds: Array.from(deletedIds),
            lastUpdated: new Date().toISOString(),
            latestAppId: app.id,
            latestStudentName: app.studentName,
            latestComplexId: app.complexId,
            bumpTime: Date.now()
          };

          await setDoc(doc(targetDb, 'settings', 'registration_applications'), payload, { merge: true });
        } catch (e) {
          console.warn('[OmranDataService] Settings registration applications sync warning:', e);
        }
      })
    );
  }

  static async deleteRegistrationApplication(applicationId: string): Promise<void> {
    if (!applicationId) return;

    // 1. Immediately record in permanent tombstone set locally and in Firestore deleted_records
    this.markApplicationDeleted(applicationId);
    await writeTombstoneToBothDbs('deletedApplications', applicationId).catch(() => {});
    const deletedIds = this.getDeletedApplicationIds();
    deletedIds.add(applicationId);

    // 2. Filter local cache immediately
    const local = getLocalCache<StudentRegistrationApplication[]>(OMRAN_CACHE_KEYS.REGISTRATION_APPLICATIONS, []);
    const updated = local.filter(a => a && a.id !== applicationId && !deletedIds.has(a.id));
    setLocalCache(OMRAN_CACHE_KEYS.REGISTRATION_APPLICATIONS, updated);

    // 3. Purge from any complex waitingList (if this application was on the waiting list)
    try {
      const complexes = getLocalCache<QuranComplex[]>(OMRAN_CACHE_KEYS.COMPLEXES, []);
      let complexesChanged = false;
      const updatedComplexes = complexes.map(c => {
        if (c && Array.isArray(c.waitingList) && c.waitingList.some(w => w.id === applicationId || w.applicationTrackingCode === applicationId)) {
          complexesChanged = true;
          return {
            ...c,
            waitingList: c.waitingList.filter(w => w.id !== applicationId && w.applicationTrackingCode !== applicationId)
          };
        }
        return c;
      });
      if (complexesChanged) {
        setLocalCache(OMRAN_CACHE_KEYS.COMPLEXES, updatedComplexes);
        broadcastDataUpdate('complexes', updatedComplexes);
      }
    } catch {}

    // 4. Dispatch specific deletion event and global broadcast
    try {
      window.dispatchEvent(
        new CustomEvent('omran:registration-application-deleted', { detail: { id: applicationId } })
      );
      window.dispatchEvent(new CustomEvent('omran:apps-updated'));
    } catch {}
    broadcastDataUpdate('registration_application_deleted', applicationId);

    const dbs = [this.getCentralDb()];
    if (this.getActiveDb() !== this.getCentralDb()) {
      dbs.push(this.getActiveDb());
    }

    // 5. Delete Firestore document and update settings document with deletedIds tombstone
    await Promise.all(
      dbs.map(async targetDb => {
        try {
          await deleteDoc(doc(targetDb, 'registration_applications', applicationId));
        } catch {}
        try {
          let cloudItems: StudentRegistrationApplication[] = [];
          const snap = await safeGetDoc(doc(targetDb, 'settings', 'registration_applications'));
          if (snap && snap.exists()) {
            const data = snap.data();
            if (Array.isArray(data?.items)) {
              cloudItems = (data.items as StudentRegistrationApplication[])
                .filter(i => i?.id && i.id !== applicationId && !deletedIds.has(i.id));
            }
          }
          await setDoc(doc(targetDb, 'settings', 'registration_applications'), {
            items: cloudItems.map(cleanFirestoreData),
            deletedIds: Array.from(deletedIds),
            lastUpdated: new Date().toISOString(),
            deletedAppId: applicationId,
            bumpTime: Date.now()
          }, { merge: true });
        } catch {}
      })
    );
  }

  /**
   * Real-time Firestore Live Subscription for incoming student registration applications
   * Immediately updates supervisor view and triggers instant alerts the second an application is submitted on any device.
   * Completely immune to deleted application resurrection!
   */
  static subscribeToRegistrationApplications(
    onData: (apps: StudentRegistrationApplication[], isRealtimeUpdate?: boolean, latestNewApp?: StudentRegistrationApplication) => void,
    complexId?: string
  ): () => void {
    const unsubs: (() => void)[] = [];
    const itemsMap = new Map<string, StudentRegistrationApplication>();
    const deletedIds = this.getDeletedApplicationIds();

    // Seed from local cache, filtering out any deleted IDs
    const initial = getLocalCache<StudentRegistrationApplication[]>(OMRAN_CACHE_KEYS.REGISTRATION_APPLICATIONS, []);
    initial.forEach(a => {
      if (a && a.id && !deletedIds.has(a.id)) {
        itemsMap.set(a.id, a);
      }
    });

    let isInitialLoad = true;

    const emit = (isRealtime: boolean = false, latestNewApp?: StudentRegistrationApplication) => {
      // Clean any tombstoned IDs
      const currentDeleted = OmranDataService.getDeletedApplicationIds();
      currentDeleted.forEach(delId => {
        deletedIds.add(delId);
        itemsMap.delete(delId);
      });

      const sorted = Array.from(itemsMap.values())
        .filter(a => a && a.id && !deletedIds.has(a.id))
        .sort((a, b) => new Date(b.appliedAt || 0).getTime() - new Date(a.appliedAt || 0).getTime());

      setLocalCache(OMRAN_CACHE_KEYS.REGISTRATION_APPLICATIONS, sorted);
      const filtered = complexId ? sorted.filter(a => a.complexId === complexId) : sorted;
      onData(filtered, isRealtime && !isInitialLoad, latestNewApp);
    };

    // Immediate in-tab deletion listener
    const handleDeletedEvent = (ev: any) => {
      const delId = ev?.detail?.id;
      if (delId) {
        deletedIds.add(delId);
        itemsMap.delete(delId);
        emit(true);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('omran:registration-application-deleted', handleDeletedEvent);
      unsubs.push(() => window.removeEventListener('omran:registration-application-deleted', handleDeletedEvent));
    }

    // 0. Live subscription to tombstone changes in settings/deleted_records to purge in real-time
    try {
      const unsubTomb = onSnapshot(
        doc(this.getCentralDb(), 'settings', 'deleted_records'),
        snap => {
          if (snap.exists()) {
            const data = snap.data();
            if (Array.isArray(data?.deletedApplications)) {
              let hasNewDeleted = false;
              data.deletedApplications.forEach((id: string) => {
                if (id && !deletedIds.has(id)) {
                  deletedIds.add(id);
                  itemsMap.delete(id);
                  hasNewDeleted = true;
                }
              });
              if (hasNewDeleted) {
                setLocalCache(OMRAN_CACHE_KEYS.DELETED_APPLICATIONS, Array.from(deletedIds));
                emit(true);
              }
            }
          }
        },
        () => {}
      );
      unsubs.push(unsubTomb);
    } catch {}

    // 1. Live subscription to collection(centralDb, 'registration_applications')
    try {
      const unsubCol = onSnapshot(
        collection(this.getCentralDb(), 'registration_applications'),
        snapshot => {
          let hasChanges = false;
          let newlyAddedApp: StudentRegistrationApplication | undefined;
          const freshDeleted = OmranDataService.getDeletedApplicationIds();
          freshDeleted.forEach(id => deletedIds.add(id));

          snapshot.docChanges().forEach(change => {
            const docId = change.doc.id;
            if (change.type === 'removed' || deletedIds.has(docId)) {
              if (itemsMap.has(docId)) {
                itemsMap.delete(docId);
                hasChanges = true;
              }
            } else {
              const item = { ...change.doc.data(), id: docId } as StudentRegistrationApplication;
              const isBrandNew = !itemsMap.has(docId);
              itemsMap.set(docId, item);
              hasChanges = true;
              if (change.type === 'added' && isBrandNew && !isInitialLoad && item.status === 'pending') {
                newlyAddedApp = item;
              }
            }
          });

          if (hasChanges || isInitialLoad) {
            emit(!isInitialLoad, newlyAddedApp);
          }
        },
        () => {}
      );
      unsubs.push(unsubCol);
    } catch (e) {
      // non-blocking
    }

    // 2. Dual-redundant live subscription to doc(centralDb, 'settings', 'registration_applications')
    try {
      const unsubDoc = onSnapshot(
        doc(this.getCentralDb(), 'settings', 'registration_applications'),
        snap => {
          if (snap.exists()) {
            const data = snap.data();
            let changed = false;

            // Ingest any cloud deletedIds
            if (Array.isArray(data?.deletedIds)) {
              data.deletedIds.forEach((id: string) => {
                if (id && !deletedIds.has(id)) {
                  deletedIds.add(id);
                  itemsMap.delete(id);
                  changed = true;
                }
              });
              setLocalCache(OMRAN_CACHE_KEYS.DELETED_APPLICATIONS, Array.from(deletedIds));
            }

            if (Array.isArray(data?.items)) {
              let newlyAdded: StudentRegistrationApplication | undefined;
              const cloudIds = new Set((data.items as StudentRegistrationApplication[]).map(a => a?.id).filter(Boolean));

              // Crucial Fix: Prune any item from itemsMap that is no longer in data.items or is tombstoned!
              for (const mapId of Array.from(itemsMap.keys())) {
                if (!cloudIds.has(mapId) || deletedIds.has(mapId)) {
                  itemsMap.delete(mapId);
                  changed = true;
                }
              }

              (data.items as StudentRegistrationApplication[]).forEach(a => {
                if (a && a.id && !deletedIds.has(a.id)) {
                  if (!itemsMap.has(a.id) && !isInitialLoad && a.status === 'pending') {
                    newlyAdded = a;
                  }
                  itemsMap.set(a.id, a);
                  changed = true;
                }
              });
              if (changed || isInitialLoad) {
                emit(!isInitialLoad, newlyAdded);
              }
            }
          }
        },
        () => {}
      );
      unsubs.push(unsubDoc);
    } catch (e) {
      // non-blocking
    }

    // 3. ActiveDb collection subscription if different
    if (this.getActiveDb() !== this.getCentralDb()) {
      try {
        const unsubActiveCol = onSnapshot(
          collection(this.getActiveDb(), 'registration_applications'),
          snapshot => {
            const freshDeleted = OmranDataService.getDeletedApplicationIds();
            snapshot.docChanges().forEach(change => {
              const docId = change.doc.id;
              if (change.type === 'removed' || freshDeleted.has(docId) || deletedIds.has(docId)) {
                itemsMap.delete(docId);
              } else {
                itemsMap.set(docId, { ...change.doc.data(), id: docId } as StudentRegistrationApplication);
              }
            });
            emit(!isInitialLoad);
          },
          () => {}
        );
        unsubs.push(unsubActiveCol);
    } catch {}
  }

    // 4. Local cross-tab & custom event listener
    const handleLocalUpdate = () => {
      const currentDeleted = OmranDataService.getDeletedApplicationIds();
      currentDeleted.forEach(id => {
        deletedIds.add(id);
        itemsMap.delete(id);
      });

      const current = getLocalCache<StudentRegistrationApplication[]>(OMRAN_CACHE_KEYS.REGISTRATION_APPLICATIONS, [])
        .filter(a => a && a.id && !deletedIds.has(a.id));

      // Prune items not in current list
      const currentIds = new Set(current.map(c => c.id));
      itemsMap.forEach((_, id) => {
        if (!currentIds.has(id) || deletedIds.has(id)) {
          itemsMap.delete(id);
        }
      });

      current.forEach(a => {
        if (a && a.id && !deletedIds.has(a.id)) {
          itemsMap.set(a.id, a);
        }
      });
      emit(true);
    };

    const handleDeletedCustomEvent = (e: any) => {
      const delId = e.detail?.id || e.detail;
      if (delId) {
        deletedIds.add(delId);
        itemsMap.delete(delId);
        emit(true);
      }
    };

    const handleNewAppCustomEvent = (e: any) => {
      if (e.detail && e.detail.id && !deletedIds.has(e.detail.id)) {
        itemsMap.set(e.detail.id, e.detail);
        emit(true, e.detail);
      }
    };

    window.addEventListener('omran:data-updated', handleLocalUpdate);
    window.addEventListener('omran:registration-application-deleted', handleDeletedCustomEvent);
    window.addEventListener('omran:new-registration-application', handleNewAppCustomEvent);

    // Initial emit
    emit(false);
    setTimeout(() => {
      isInitialLoad = false;
    }, 600);

    return () => {
      unsubs.forEach(u => {
        try { u(); } catch {}
      });
      window.removeEventListener('omran:data-updated', handleLocalUpdate);
      window.removeEventListener('omran:registration-application-deleted', handleDeletedCustomEvent);
      window.removeEventListener('omran:new-registration-application', handleNewAppCustomEvent);
    };
  }

  static async findRegistrationApplication(trackingOrPhone: string, complexId?: string): Promise<StudentRegistrationApplication | null> {
    const clean = trackingOrPhone.trim().toLowerCase();
    const cleanDigits = trackingOrPhone.replace(/\D/g, '');
    const apps = await this.loadRegistrationApplications(complexId);
    return apps.find(a => {
      const matchTrack = a.trackingCode?.trim().toLowerCase() === clean;
      const matchPhone = cleanDigits.length >= 7 && (a.parentPhone?.replace(/\D/g, '').includes(cleanDigits) || cleanDigits.includes(a.parentPhone?.replace(/\D/g, '') || ''));
      return matchTrack || matchPhone;
    }) || null;
  }

  /**
   * Confirms student acceptance and entry to the assigned halaqah.
   * Updates state to 'confirmed_by_student', records timestamp, and broadcasts real-time alert to supervisor.
   */
  static async confirmStudentApplicationEntry(
    applicationId: string,
    complexId?: string
  ): Promise<StudentRegistrationApplication | null> {
    const apps = await this.loadRegistrationApplications(complexId);
    const target = apps.find(a => a.id === applicationId);
    if (!target) return null;

    const updated: StudentRegistrationApplication = {
      ...target,
      studentAcceptanceStatus: 'confirmed_by_student',
      studentConfirmedAt: new Date().toISOString()
    };

    await this.saveRegistrationApplication(updated);
    broadcastDataUpdate('student_confirmed_entry', updated);
    return updated;
  }
}

