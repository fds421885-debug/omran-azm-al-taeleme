import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bot,
  User,
  Sparkles,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  MapPin,
  Compass,
  BookOpen,
  Calendar,
  Award,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Volume2,
  RotateCcw,
  Check,
  Mic,
  BrainCircuit,
  MessageSquare,
  Search,
  Timer,
  AlertTriangle,
  Flame,
  CheckSquare,
  FileText,
  List,
  Layers,
  ArrowRight,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Student,
  Halaqah,
  QuranComplex,
  Mosque,
  WaitingListStudent,
  StudentMemorizationPlan,
  StudentRegistrationApplication,
  QuestionBankItem,
  PlacementQuestionResult,
  PlacementTestSummary
} from '../../types';
import { OmranDataService } from '../../lib/firebase';
import { QURAN_SURAHS, getSurahInfo } from '../../data/quranData';
import { getPageOfAyah, calculatePortionFromPace } from '../../data/quranPagesData';
import {
  generatePlacementDiagnosticTest,
  evaluatePlacementDiagnostic
} from '../../lib/quranQuestionBankEngine';
import {
  buildApplicationAcceptedEmail,
  buildWaitingListEmail,
  sendRealPortalEmail
} from '../../lib/portalEmailService';

interface AIStudentPlacementInterviewProps {
  studentInitialData: {
    studentName: string;
    age: number;
    phone: string;
    parentName: string;
    parentPhone: string;
    email?: string;
    memorizedJuzList: number[];
    notes?: string;
    preferredHalaqahId?: string;
    trackingCode: string;
    startingYear?: string;
    previousDirection?: 'baqarah_to_nas' | 'nas_to_baqarah';
    weakSurahs?: number[];
    healthOrEducationalNotes?: string;
  };
  complex: QuranComplex;
  halaqahs: Halaqah[];
  existingStudents: Student[];
  onPlacementSuccess: (student: Student) => void;
  onWaitingListAdded: (entry: WaitingListStudent) => void;
  onCancel: () => void;
}

// 7-Stage Pipeline Definitions
const POST_TEST_STAGES = [
  { id: 1, title: 'تحليل دقة الحفظ القرآني والتثبيت', icon: BookOpen, desc: 'فحص صحة استحضار الآيات وترتيب السور' },
  { id: 2, title: 'تدقيق أحكام التجويد ومخارج الحروف', icon: Flame, desc: 'معايرة أحكام النون والميم والمدود والقلقلة' },
  { id: 3, title: 'تقييم المتشابهات اللفظية ومواضع الاستدراك', icon: BrainCircuit, desc: 'رصد مواضع الالتباس الدقيقة وفواصل الآيات' },
  { id: 4, title: 'تحديد المستوى القرآني المعتمد وفق معايير المنصة', icon: Award, desc: 'تصنيف الطالب ضمن المستويات الستة القياسية' },
  { id: 5, title: 'فحص الحلقات القرآنية المتاحة بالمجمع', icon: Clock, desc: 'تحديد الحلقات والمسجد الأنسب جغرافياً وتنظيمياً' },
  { id: 6, title: 'إعداد الملف التشخيصي وتجهيز طلب القبول للمشرف', icon: TrendingUp, desc: 'حصر مؤشرات التجويد والمتشابهات وتوثيق ملف الطالب لاعتماد المشرف' },
  { id: 7, title: 'إصدار تذكرة القبول وتأكيد إرسال الطلب', icon: CheckCircle2, desc: 'توليد كود التذكرة وإرسال ملف المقابلة إلى لوحة المشرف' }
];

export const AIStudentPlacementInterview: React.FC<AIStudentPlacementInterviewProps> = ({
  studentInitialData,
  complex,
  halaqahs,
  existingStudents,
  onPlacementSuccess,
  onWaitingListAdded,
  onCancel
}) => {
  // Phase management
  // 'setup' -> 'test' -> 'processing' -> 'result'
  const [currentPhase, setCurrentPhase] = useState<'setup' | 'test' | 'processing' | 'result'>('setup');

  // Registration profile fields
  const [startingYear, setStartingYear] = useState<string>(studentInitialData.startingYear || '2023');
  const [direction, setDirection] = useState<'baqarah_to_nas' | 'nas_to_baqarah'>(
    studentInitialData.previousDirection || ((studentInitialData.memorizedJuzList?.length || 1) >= 30 ? 'baqarah_to_nas' : 'nas_to_baqarah')
  );
  const [selectedWeakSurahs, setSelectedWeakSurahs] = useState<number[]>(studentInitialData.weakSurahs || []);
  const [healthNotes, setHealthNotes] = useState<string>(studentInitialData.healthOrEducationalNotes || '');
  const [surahSearchTerm, setSurahSearchTerm] = useState<string>('');
  const [isWeakSurahsModalOpen, setIsWeakSurahsModalOpen] = useState<boolean>(false);

  // Position reached
  const [reachedSurah, setReachedSurah] = useState<number>(
    (studentInitialData.memorizedJuzList?.length || 1) >= 30 ? 2 : 78
  );
  const [reachedAyah, setReachedAyah] = useState<number>(1);

  // Placement Test State
  const [diagnosticQuestions, setDiagnosticQuestions] = useState<QuestionBankItem[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState<number>(0);
  const [questionResults, setQuestionResults] = useState<PlacementQuestionResult[]>([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(8); // Strict 8-second timer
  const [timerActive, setTimerActive] = useState<boolean>(false);
  const questionStartTimeRef = useRef<number>(Date.now());
  const timerIntervalRef = useRef<any>(null);

  // 7-Stage Processing State
  const [processingStage, setProcessingStage] = useState<number>(1);
  const [ticketCode, setTicketCode] = useState<string>('');

  // Results State
  const [testSummary, setTestSummary] = useState<PlacementTestSummary | null>(null);
  const [matchedHalaqah, setMatchedHalaqah] = useState<Halaqah | null>(null);
  const [matchedMosque, setMatchedMosque] = useState<Mosque | null>(null);
  const [isWaitingList, setIsWaitingList] = useState<boolean>(false);
  const [waitingEntry, setWaitingEntry] = useState<WaitingListStudent | null>(null);
  const [generatedPlan, setGeneratedPlan] = useState<StudentMemorizationPlan | null>(null);
  const [createdStudent, setCreatedStudent] = useState<Student | null>(null);
  const [conversationTranscript, setConversationTranscript] = useState<Array<{ sender: string; text: string; timestamp: string }>>([]);

  const isKhatim = useMemo(() => {
    return (studentInitialData.memorizedJuzList?.length || 0) >= 30;
  }, [studentInitialData]);

  // Idempotent ticket generator (OMR-XXXXXX)
  const generateIdempotentTicket = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `OMR-${code}`;
  };

  // Helper for Year options: last 15 years + "لا أتذكر"
  const yearOptions = useMemo(() => {
    const currentG = new Date().getFullYear();
    const list: Array<{ label: string; value: string }> = [];
    for (let y = currentG; y >= currentG - 15; y--) {
      list.push({ label: `عام ${y}م`, value: String(y) });
    }
    list.push({ label: 'لا أتذكر عام البدء تحديداً', value: 'unknown' });
    return list;
  }, []);

  // Filtered 114 Surahs for Weak Surahs Selector
  const filteredSurahs = useMemo(() => {
    const clean = surahSearchTerm.trim().toLowerCase();
    if (!clean) return QURAN_SURAHS;
    return QURAN_SURAHS.filter(s =>
      s.name.includes(clean) ||
      s.number.toString() === clean ||
      s.englishName.toLowerCase().includes(clean)
    );
  }, [surahSearchTerm]);

  // Start Diagnostic Test
  const handleLaunchTest = async () => {
    setIsLoadingQuestions(true);
    try {
      const questions = await generatePlacementDiagnosticTest({
        isKhatim,
        startingDirection: direction,
        weakSurahs: selectedWeakSurahs,
        questionCount: 10
      });

      setDiagnosticQuestions(questions);
      setCurrentQuestionIdx(0);
      setQuestionResults([]);
      setCurrentPhase('test');
      setIsLoadingQuestions(false);

      // Start 8-second timer for question 1
      startTimerForQuestion();
    } catch {
      setIsLoadingQuestions(false);
    }
  };

  // Timer Controller
  const startTimerForQuestion = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setTimeLeft(8);
    setTimerActive(true);
    questionStartTimeRef.current = Date.now();

    timerIntervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current);
          handleTimeoutExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Handle Question Timeout (Strict 8 seconds expired)
  const handleTimeoutExpired = () => {
    setTimerActive(false);
    const q = diagnosticQuestions[currentQuestionIdx];
    if (!q) return;

    const timeoutResult: PlacementQuestionResult = {
      questionId: q.questionId,
      skill: q.skill,
      difficulty: q.difficulty,
      questionText: q.questionText,
      optionsOrder: (q.options || []).map(opt => typeof opt === 'string' ? opt : (opt as any).text),
      selectedOption: 'لم يجب ضمن الوقت',
      correctAnswer: q.correctAnswer,
      isCorrect: false,
      timeTakenSeconds: 8.0,
      isTimedOut: true,
      explanation: q.explanation
    };

    recordAndProceed(timeoutResult);
  };

  // Handle Option Click
  const handleAnswerOption = (selectedOpt: string) => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    setTimerActive(false);

    const q = diagnosticQuestions[currentQuestionIdx];
    if (!q) return;

    const timeSpent = Math.min(8.0, parseFloat(((Date.now() - questionStartTimeRef.current) / 1000).toFixed(1)));
    const isCorrect = selectedOpt.trim() === q.correctAnswer.trim();

    const res: PlacementQuestionResult = {
      questionId: q.questionId,
      skill: q.skill,
      difficulty: q.difficulty,
      questionText: q.questionText,
      optionsOrder: (q.options || []).map(opt => typeof opt === 'string' ? opt : (opt as any).text),
      selectedOption: selectedOpt,
      correctAnswer: q.correctAnswer,
      isCorrect,
      timeTakenSeconds: timeSpent,
      isTimedOut: false,
      explanation: q.explanation
    };

    recordAndProceed(res);
  };

  // Proceed to next question or 7-stage processing
  const recordAndProceed = (res: PlacementQuestionResult) => {
    const updated = [...questionResults, res];
    setQuestionResults(updated);

    if (currentQuestionIdx + 1 < diagnosticQuestions.length) {
      setCurrentQuestionIdx(prev => prev + 1);
      setTimeout(() => {
        startTimerForQuestion();
      }, 300);
    } else {
      // Completed all 10 questions!
      finishPlacementTest(updated);
    }
  };

  // Finish test & execute 7-stage post-test pipeline
  const finishPlacementTest = async (allResults: PlacementQuestionResult[]) => {
    setCurrentPhase('processing');
    setProcessingStage(1);

    // 1. Evaluate Multi-Dimensional Score
    const summary = evaluatePlacementDiagnostic({
      answers: allResults,
      isKhatim,
      studentInfo: {
        weakSurahs: selectedWeakSurahs,
        startingYear,
        previousDirection: direction,
        healthOrEducationalNotes: healthNotes
      }
    });
    setTestSummary(summary);

    // 2. Generate Unique Idempotent Ticket
    const generatedTicket = generateIdempotentTicket();
    setTicketCode(generatedTicket);

    // 3. Run 7 animated stages sequentially with smooth pacing
    for (let st = 1; st <= 7; st++) {
      setProcessingStage(st);
      await new Promise(res => setTimeout(res, 500));
    }

    // 4. Candidate halaqah recommendation: prioritize preferred halaqah if chosen, or match within complex
    const candidateHalaqahs = halaqahs.filter(h => !h.complexId || h.complexId === complex.id);
    let candidateHalaqah: Halaqah | null = null;
    if (studentInitialData.preferredHalaqahId) {
      candidateHalaqah = candidateHalaqahs.find(h => h.id === studentInitialData.preferredHalaqahId) || null;
    }
    if (!candidateHalaqah) {
      candidateHalaqah = candidateHalaqahs[0] || null;
    }

    const matchedM = complex.mosques?.find(m => m.id === candidateHalaqah?.mosqueId) || null;
    setMatchedHalaqah(candidateHalaqah);
    setMatchedMosque(matchedM);

    // 5. Create transcript
    const transcript = allResults.map((r, i) => ({
      sender: 'نظام الفحص القرآني التكيفي',
      text: `السؤال (${i + 1}): ${r.questionText} | إجابة الطالب: ${r.selectedOption} | النتيجة: ${r.isCorrect ? 'صحيحة' : 'خاطئة'} (${r.timeTakenSeconds} ثانية)${r.isTimedOut ? ' [انتهت المهلة]' : ''}`,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
    }));
    setConversationTranscript(transcript);

    // 6. Check if candidate halaqah is full ("لو فل يحطه في طابور الانتظار")
    const enrolledStudentsInHalaqah = candidateHalaqah
      ? existingStudents.filter(s => s.halaqahId === candidateHalaqah.id)
      : [];
    const halaqahCapacity = candidateHalaqah?.capacity || 15;
    const isFull = candidateHalaqah ? enrolledStudentsInHalaqah.length >= halaqahCapacity : false;

    if (isFull && candidateHalaqah) {
      setIsWaitingList(true);
      const existingWait = complex.waitingList || [];
      const queueNumber = existingWait.length + 1;
      const waitingObj: WaitingListStudent = {
        id: `wait_${Date.now()}_${Math.floor(Math.random() * 9000 + 1000)}`,
        applicationTrackingCode: generatedTicket,
        studentName: studentInitialData.studentName,
        age: studentInitialData.age,
        phone: studentInitialData.phone,
        parentName: studentInitialData.parentName,
        parentPhone: studentInitialData.parentPhone,
        memorizedJuz: studentInitialData.memorizedJuzList?.length || 1,
        consolidatedJuz: Math.round(((studentInitialData.memorizedJuzList?.length || 1) * (summary.memorizationScore || 80)) / 100),
        tajweedLevel: summary.classifiedLevel || 'متوسط',
        hasIjazah: isKhatim,
        queueNumber: queueNumber,
        complexId: complex.id,
        complexName: complex.name,
        mosqueId: matchedM?.id,
        mosqueName: matchedM?.name,
        targetHalaqahId: candidateHalaqah.id,
        targetHalaqahName: candidateHalaqah.name,
        notes: `تم الإدراج تلقائياً في طابور الانتظار لاكتمال الطاقة الاستيعابية للحلقة المرشحة (${candidateHalaqah.name}) [${enrolledStudentsInHalaqah.length}/${halaqahCapacity} طالب] بالدور رقم #${queueNumber}.`,
        status: 'waiting',
        addedAt: new Date().toISOString()
      };
      setWaitingEntry(waitingObj);
      setCreatedStudent(null);
    } else {
      setIsWaitingList(false);
      setWaitingEntry(null);
      const newStdId = `std_${Date.now()}_${Math.floor(Math.random() * 9000 + 1000)}`;
      const studentObj: Student = {
        id: newStdId,
        name: studentInitialData.studentName,
        password: '123',
        phone: studentInitialData.phone,
        age: studentInitialData.age,
        parentName: studentInitialData.parentName,
        parentPhones: [studentInitialData.parentPhone],
        parentPhone: studentInitialData.parentPhone,
        googleEmail: studentInitialData.email || null,
        currentSurah: reachedSurah,
        currentSurahName: getSurahInfo(reachedSurah).name,
        currentAyah: reachedAyah,
        startSurahReached: reachedSurah,
        startAyahReached: reachedAyah,
        reviewStartDirection: direction === 'baqarah_to_nas' ? 'from_baqarah' : 'from_nas',
        isFirstSession: true,
        dailyNewTarget: 'وجه يومياً',
        dailyReviewTarget: '3 أوجه يومياً',
        level: summary.classifiedLevel as any,
        complexId: complex.id,
        complexName: complex.name,
        halaqahId: candidateHalaqah?.id || '',
        halaqahName: candidateHalaqah?.name || 'الحلقة القرآنية',
        assignedMosqueId: matchedM?.id,
        assignedMosqueName: matchedM?.name,
        weakSurahs: selectedWeakSurahs,
        notes: healthNotes ? `ملاحظات: ${healthNotes}` : 'تم إتمام الفحص بنجاح وبانتظار اعتماد المشرف',
        createdAt: new Date().toISOString()
      };
      setCreatedStudent(studentObj);
    }

    setCurrentPhase('result');
  };

  // Toggle Weak Surah selection
  const toggleWeakSurah = (surahNum: number) => {
    setSelectedWeakSurahs(prev =>
      prev.includes(surahNum) ? prev.filter(n => n !== surahNum) : [...prev, surahNum]
    );
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md select-none" dir="rtl">
      <div className="w-full max-w-3xl bg-[#022c22] border-2 border-amber-400/60 rounded-3xl shadow-2xl flex flex-col h-[90vh] max-h-[820px] overflow-hidden">
        
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-[#064e3b] via-[#022c22] to-[#064e3b] border-b border-[#065f46] px-5 py-3.5 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#fbbf24] to-amber-300 text-[#064e3b] flex items-center justify-center shadow-lg font-bold">
                <Bot className="w-6 h-6 animate-pulse" />
              </div>
              <span className="absolute -bottom-1 -left-1 w-3.5 h-3.5 bg-emerald-400 border-2 border-[#022c22] rounded-full"></span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-black text-sm sm:text-base text-white">
                  محرك الفحص القرآني والتسكين
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#fbbf24] text-[#064e3b]">
                  {isKhatim ? 'مسار الخاتمين والإتقان' : 'مسار الحفظ والتثبيت'}
                </span>
              </div>
              <p className="text-xs text-[#86efac]/80">
                مجمع {complex.name} • الطالب: {studentInitialData.studentName} ({studentInitialData.age} سنة)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            title="إلغاء الجلسة ومغادرة المقابلة"
            className="text-xs text-amber-200/90 hover:text-white px-3 py-1.5 rounded-xl border border-amber-400/30 hover:border-amber-400/60 bg-amber-500/10 hover:bg-amber-500/20 transition-all cursor-pointer font-bold"
          >
            إلغاء الجلسة والخروج
          </button>
        </div>

        {/* =========================================================================
            PHASE 1: REGISTRATION & DIAGNOSTIC SETUP
           ========================================================================= */}
        {currentPhase === 'setup' && (
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-gradient-to-b from-[#022c22] via-[#01221a] to-[#022c22] text-white">
            <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-400/40 space-y-1 text-center">
              <h4 className="font-heading font-black text-base text-amber-300 flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                التهيئة للفحص التشخيصي المباشر
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                حدد خلفية مسيرتك القرآنية لنصمم لك اختباراً دقيقاً من 10 أسئلة أصيلة مع مهلة 8 ثوانٍ لكل سؤال.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 1. Starting Year Dropdown */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-[#86efac] flex items-center justify-between">
                  <span>عام بداية حفظ القرآن الكريم:</span>
                  <span className="text-[10px] text-amber-400">قائمة معتمدة *</span>
                </label>
                <select
                  value={startingYear}
                  onChange={e => setStartingYear(e.target.value)}
                  className="w-full bg-[#064e3b] border border-[#065f46] focus:border-[#fbbf24] text-amber-300 font-bold rounded-2xl py-3 px-3.5 text-xs outline-none cursor-pointer shadow-md"
                >
                  {yearOptions.map(y => (
                    <option key={y.value} value={y.value} className="bg-[#022c22] text-white">
                      {y.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Direction: Baqarah vs Nas */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-[#86efac] flex items-center justify-between">
                  <span>اتجاه السير في الحفظ والمراجعة:</span>
                  <span className="text-[10px] text-amber-400">المسار المتبع *</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDirection('nas_to_baqarah')}
                    className={`p-3 rounded-2xl border-2 text-xs font-black transition-all cursor-pointer ${
                      direction === 'nas_to_baqarah'
                        ? 'bg-amber-400 text-[#064e3b] border-amber-300 shadow-md'
                        : 'bg-[#064e3b] text-slate-300 border-[#065f46] hover:bg-[#065f46]'
                    }`}
                  >
                    من الناس إلى البقرة
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirection('baqarah_to_nas')}
                    className={`p-3 rounded-2xl border-2 text-xs font-black transition-all cursor-pointer ${
                      direction === 'baqarah_to_nas'
                        ? 'bg-amber-400 text-[#064e3b] border-amber-300 shadow-md'
                        : 'bg-[#064e3b] text-slate-300 border-[#065f46] hover:bg-[#065f46]'
                    }`}
                  >
                    من البقرة إلى الناس
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Position Reached (سورة وآية الوصول) */}
            <div className="p-4 rounded-2xl bg-[#064e3b]/50 border border-[#065f46] space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  <span>الموضع الذي وصلت إليه في القرآن الكريم حالياً:</span>
                </label>
                <span className="text-[11px] text-[#86efac] font-bold">
                  سورة {getSurahInfo(reachedSurah).name} (آية {reachedAyah})
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={reachedSurah}
                  onChange={e => {
                    const s = Number(e.target.value);
                    setReachedSurah(s);
                    setReachedAyah(1);
                  }}
                  className="w-full bg-[#022c22] border border-[#065f46] text-amber-300 font-bold rounded-xl py-2 px-3 text-xs outline-none cursor-pointer"
                >
                  {QURAN_SURAHS.map(s => (
                    <option key={s.number} value={s.number} className="bg-[#022c22] text-white">
                      {s.number}. سورة {s.name} ({s.numberOfAyahs} آية)
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-300 font-bold shrink-0">رقم الآية:</span>
                  <input
                    type="number"
                    min={1}
                    max={getSurahInfo(reachedSurah).numberOfAyahs}
                    value={reachedAyah}
                    onChange={e => setReachedAyah(Math.max(1, Math.min(getSurahInfo(reachedSurah).numberOfAyahs, Number(e.target.value))))}
                    className="flex-1 bg-[#022c22] border border-[#065f46] text-center font-bold text-amber-300 rounded-xl py-2 px-3 text-xs outline-none"
                  />
                </div>
              </div>
            </div>

            {/* 4. Multi-Select Weak Surahs Picker (من الـ 114 سورة كاملة) */}
            <div className="p-4 rounded-2xl bg-[#064e3b]/50 border border-[#065f46] space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <label className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                    <BrainCircuit className="w-4 h-4" />
                    <span>السور التي تستشعر فيها ضعفاً أو تفلتاً (من الـ 114 سورة):</span>
                  </label>
                  <p className="text-[11px] text-slate-300 font-bold">
                    سيتم إدراج هذه السور تلقائياً في مسار المراجعة العلاجية واختبار تمكنك منها
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsWeakSurahsModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#064e3b] font-black text-xs flex items-center gap-1 shadow-md cursor-pointer transition-all active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>تحديد من قائمة الـ 114 سورة ({selectedWeakSurahs.length})</span>
                </button>
              </div>

              {/* Selected Pills */}
              {selectedWeakSurahs.length > 0 ? (
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {selectedWeakSurahs.map(sNum => (
                    <span
                      key={sNum}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/40 text-xs font-bold"
                    >
                      <span>سورة {getSurahInfo(sNum).name}</span>
                      <button
                        type="button"
                        onClick={() => toggleWeakSurah(sNum)}
                        className="text-amber-400 hover:text-white cursor-pointer ml-1"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedWeakSurahs([])}
                    className="text-[11px] text-slate-400 hover:text-red-300 underline font-bold cursor-pointer mr-2"
                  >
                    مسح الكل
                  </button>
                </div>
              ) : (
                <p className="text-xs text-slate-400 font-bold italic">
                  لم يتم تحديد سور ضعيفة حتى الآن (اختياري).
                </p>
              )}
            </div>

            {/* 5. Health or Educational Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-[#86efac] block">
                ملاحظات صحية أو صعوبات تعلم أو توصيات خاصة (اختياري):
              </label>
              <textarea
                rows={2}
                value={healthNotes}
                onChange={e => setHealthNotes(e.target.value)}
                placeholder="مثال: صعوبة في النطق، بطء في الحفظ، ظروف صحية تستدعي وقتاً إضافياً..."
                className="w-full bg-[#064e3b] border border-[#065f46] focus:border-[#fbbf24] text-white rounded-2xl py-2 px-3 text-xs outline-none resize-none font-bold placeholder-slate-400"
              />
            </div>

            {/* Launch Diagnostic Button */}
            <button
              type="button"
              disabled={isLoadingQuestions}
              onClick={handleLaunchTest}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:brightness-110 text-[#064e3b] font-black text-sm shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
            >
              <Sparkles className="w-5 h-5 text-[#064e3b]" />
              <span>
                {isLoadingQuestions ? 'جارٍ توليد أسئلة الفحص الأصيلة...' : 'بدء الفحص التشخيصي المباشر (10 أسئلة • 8 ثوانٍ للآية) ➔'}
              </span>
            </button>
          </div>
        )}

        {/* =========================================================================
            PHASE 2: 10-QUESTION LIVE DIAGNOSTIC TEST (8s Strict Countdown Timer)
           ========================================================================= */}
        {currentPhase === 'test' && diagnosticQuestions.length > 0 && (
          <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 bg-gradient-to-b from-[#022c22] via-[#01221a] to-[#022c22] text-white flex flex-col justify-between">
            {/* Top Bar: Progress + 8s Circular Countdown */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span className="flex items-center gap-1.5 text-amber-300 font-black">
                  <Award className="w-4 h-4" />
                  السؤال {currentQuestionIdx + 1} من {diagnosticQuestions.length}
                </span>

                <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white text-[11px] font-mono">
                  {diagnosticQuestions[currentQuestionIdx].skill === 'quran_memorization'
                    ? '📖 حفظ واستحضار قرآني'
                    : diagnosticQuestions[currentQuestionIdx].skill === 'mutashabihat'
                    ? '⚡ ضبط المتشابهات اللفظية'
                    : '💎 أحكام التجويد ومخارج الحروف'}
                </span>
              </div>

              {/* Linear Progress Bar */}
              <div className="w-full bg-[#064e3b] rounded-full h-2 overflow-hidden border border-[#065f46]">
                <div
                  className="bg-gradient-to-r from-emerald-400 to-amber-400 h-full rounded-full transition-all duration-300"
                  style={{ width: `${((currentQuestionIdx + 1) / diagnosticQuestions.length) * 100}%` }}
                />
              </div>

              {/* 8-Second Strict Countdown Timer Bar */}
              <div className="p-3 rounded-2xl bg-black/40 border border-[#065f46] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Timer className={`w-5 h-5 ${timeLeft <= 3 ? 'text-rose-400 animate-ping' : 'text-amber-400'}`} />
                  <span className="text-xs font-bold text-slate-200">الوقت المتبقي للإجابة:</span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-lg font-black font-mono px-3 py-0.5 rounded-xl border ${
                      timeLeft <= 3
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500 animate-pulse'
                        : 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                    }`}
                  >
                    00:0{timeLeft}
                  </span>
                  {timeLeft <= 3 && (
                    <span className="text-[11px] text-rose-400 font-bold hidden sm:inline">
                      أسرع قبل انتهاء المهلة!
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Question Card */}
            <div className="p-6 rounded-3xl bg-[#064e3b]/70 border-2 border-[#065f46] shadow-xl space-y-4 text-center my-auto">
              <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/40">
                مستوى السؤال: {diagnosticQuestions[currentQuestionIdx].difficulty === 'hard' ? 'متقدم ودقيق' : 'متوسط متزن'}
              </span>

              <h3 className="font-heading font-black text-base sm:text-lg text-white leading-relaxed whitespace-pre-line">
                {diagnosticQuestions[currentQuestionIdx].questionText}
              </h3>
            </div>

            {/* Decoupled Shuffled Options Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {diagnosticQuestions[currentQuestionIdx].options.map((optionText, optIdx) => (
                <button
                  key={optIdx}
                  type="button"
                  onClick={() => handleAnswerOption(optionText)}
                  className="text-right p-4 rounded-2xl bg-[#064e3b] hover:bg-[#065f46] border-2 border-[#065f46] hover:border-amber-400 text-white text-xs sm:text-sm font-bold transition-all shadow-md cursor-pointer flex items-center justify-between gap-3 active:scale-[0.98] group"
                >
                  <span className="leading-relaxed group-hover:text-amber-300">{optionText}</span>
                  <span className="w-7 h-7 rounded-xl bg-[#022c22] text-amber-400 flex items-center justify-center text-xs font-mono font-black shrink-0 border border-amber-400/30">
                    {optIdx + 1}
                  </span>
                </button>
              ))}
            </div>

            <p className="text-[11px] text-center text-slate-400 font-bold pt-2">
              💡 الفحص يقيس الدقة وسرعة الاستحضار؛ إن انقضت الـ 8 ثوانٍ دون إجابة يتم تسجيلها آلياً وتخطي السؤال.
            </p>
          </div>
        )}

        {/* =========================================================================
            PHASE 3: 7-STAGE POST-TEST THEMED PROCESSING SCREEN
           ========================================================================= */}
        {currentPhase === 'processing' && (
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 bg-gradient-to-b from-[#022c22] via-[#01221a] to-[#022c22] text-white flex flex-col justify-center items-center text-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-400 to-amber-200 text-[#064e3b] flex items-center justify-center shadow-2xl font-black">
                <BrainCircuit className="w-10 h-10 animate-spin" />
              </div>
              <span className="absolute -bottom-1 -left-1 w-5 h-5 bg-emerald-400 border-2 border-[#022c22] rounded-full animate-ping"></span>
            </div>

            <div className="space-y-1">
              <h3 className="font-heading font-black text-lg sm:text-xl text-amber-300">
                جارٍ تشغيل محرك المعالجة القرآنية خماسي المسارات...
              </h3>
              <p className="text-xs text-slate-300">
                نحلل الآن أداء الطالب في الأسئلة الـ 10 ونطابق طاقة الحلقات المتاحة
              </p>
            </div>

            {/* Stages Stack */}
            <div className="w-full max-w-md space-y-2.5 text-right">
              {POST_TEST_STAGES.map(st => {
                const isPassed = processingStage > st.id;
                const isCurrent = processingStage === st.id;
                const IconComp = st.icon;

                return (
                  <div
                    key={st.id}
                    className={`p-3 rounded-2xl border-2 flex items-center justify-between gap-3 transition-all duration-300 ${
                      isPassed
                        ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                        : isCurrent
                        ? 'bg-amber-500/20 border-amber-400 text-white shadow-lg animate-pulse'
                        : 'bg-white/5 border-white/10 text-slate-400 opacity-40'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isPassed
                            ? 'bg-emerald-500 text-[#022c22]'
                            : isCurrent
                            ? 'bg-amber-400 text-[#064e3b]'
                            : 'bg-white/10 text-slate-400'
                        }`}
                      >
                        <IconComp className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-black">{st.title}</p>
                        <p className="text-[10px] opacity-80">{st.desc}</p>
                      </div>
                    </div>

                    <div>
                      {isPassed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : isCurrent ? (
                        <span className="text-[10px] font-mono font-bold text-amber-300 bg-black/40 px-2 py-0.5 rounded-md border border-amber-400/30">
                          جارٍ الفحص...
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-slate-500">#{st.id}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* =========================================================================
            PHASE 4: PLACEMENT RESULT & ADAPTIVE CARD (Direct Admission / Waiting List)
           ========================================================================= */}
        {currentPhase === 'result' && testSummary && (
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 bg-gradient-to-b from-[#022c22] via-[#01221a] to-[#022c22] text-white">
            
            {/* Ticket & Classification Header Card */}
            <div className="p-5 rounded-3xl bg-gradient-to-r from-[#064e3b] to-[#022c22] border-2 border-amber-400 shadow-2xl space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-amber-400 text-[#064e3b] flex items-center justify-center font-black shadow-lg">
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-heading font-black text-base text-amber-300">
                      تذكرة التسكين القرآني المعتمدة: [{ticketCode}]
                    </h3>
                    <p className="text-xs text-[#86efac]">
                      الطالب: {studentInitialData.studentName} • المجمع: {complex.name}
                    </p>
                  </div>
                </div>

                <span className="px-3 py-1 rounded-xl bg-amber-400 text-[#064e3b] font-black text-xs shadow-md">
                  المستوى المصنف: {testSummary.classifiedLevel}
                </span>
              </div>

              {/* 4 Score Badges Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-center">
                <div className="p-2.5 rounded-xl bg-[#022c22] border border-[#065f46]">
                  <span className="text-[10px] text-slate-300 block">دقة الحفظ القرآني</span>
                  <span className="text-base font-black text-emerald-400 font-mono">{testSummary.memorizationScore}%</span>
                </div>

                <div className="p-2.5 rounded-xl bg-[#022c22] border border-[#065f46]">
                  <span className="text-[10px] text-slate-300 block">أحكام التجويد</span>
                  <span className="text-base font-black text-amber-300 font-mono">{testSummary.tajweedScore}%</span>
                </div>

                <div className="p-2.5 rounded-xl bg-[#022c22] border border-[#065f46]">
                  <span className="text-[10px] text-slate-300 block">معدل ثبات الاستحضار</span>
                  <span className="text-base font-black text-cyan-300 font-mono">{testSummary.retentionScore}%</span>
                </div>

                <div className="p-2.5 rounded-xl bg-[#022c22] border border-[#065f46]">
                  <span className="text-[10px] text-slate-300 block">المعدل العام المركب</span>
                  <span className="text-base font-black text-amber-400 font-mono">{testSummary.overallScore}%</span>
                </div>
              </div>
            </div>

            {/* Admission Request Submitted OR Waiting List Card */}
            {isWaitingList && waitingEntry ? (
              <div className="p-5 rounded-3xl bg-amber-950/40 border-2 border-amber-400/80 shadow-2xl space-y-4 animate-in fade-in duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-400 text-amber-950 flex items-center justify-center font-bold shadow-lg shrink-0">
                    <Clock className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-heading font-black text-base text-amber-300">
                        تم إدراجك في طابور الانتظار الرسمي للمجمع
                      </h4>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-amber-950">
                        طابور الانتظار #{waitingEntry.queueNumber}
                      </span>
                    </div>
                    <p className="text-xs text-slate-200">
                      كود المتابعة والتذكرة المعتمد: <span className="font-mono font-black text-amber-300">[{ticketCode}]</span>
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#022c22] border border-amber-400/40 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between text-amber-300 font-bold border-b border-amber-400/20 pb-2">
                    <span className="flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      سبب الإدراج في طابور الانتظار:
                    </span>
                    <span className="px-2 py-0.5 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 text-[11px] font-bold">
                      الحلقة المرشحة مكتملة العدد
                    </span>
                  </div>
                  <p className="text-slate-200 text-xs leading-relaxed">
                    الحلقة المرشحة للطالب <strong className="text-white">({matchedHalaqah?.name || 'الحلقة المختارة'})</strong> وصلت إلى طاقتها الاستيعابية الكاملة ({existingStudents.filter(s => s.halaqahId === matchedHalaqah?.id).length}/{matchedHalaqah?.capacity || 15} طالب).
                  </p>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    تم توثيق كافة نتائجك في الفحص القرآني (المستوى: {testSummary?.classifiedLevel}) وحجز مقعدك بالترتيب رقم <strong className="text-amber-400 font-black font-mono">#{waitingEntry.queueNumber}</strong> في طابور الانتظار، وسيتواصل معكم المشرف فور توفر مقعد أو فتح حلقة جديدة بالمجمع.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onWaitingListAdded(waitingEntry);
                  }}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-110 text-amber-950 font-black text-sm shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
                >
                  <Check className="w-5 h-5 stroke-[3]" />
                  <span>تأكيد الإدراج في طابور الانتظار ومتابعة الطلب ➔</span>
                </button>
              </div>
            ) : (
              <div className="p-5 rounded-3xl bg-[#064e3b]/80 border-2 border-emerald-400/80 shadow-2xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-400 text-[#022c22] flex items-center justify-center font-bold shadow-lg">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-heading font-black text-base text-emerald-300">
                      تم إتمام الفحص التشخيصي وإرسال ملفك للمشرف بنجاح
                    </h4>
                    <p className="text-xs text-slate-200">
                      كود التذكرة الخاص بطلبك: <span className="font-mono font-black text-amber-300">[{ticketCode}]</span>
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#022c22] border border-[#065f46] space-y-2 text-xs">
                  <span className="font-black text-amber-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    حالة الطلب: تم الرفع إلى لوحة المشرف العام للمجمع
                  </span>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    تم رصد وتوثيق كافة نتائجك في التجويد وثبات الاستحضار والمتشابهات بنجاح. سيقوم المشرف العام بمراجعة الملف واعتماد تسكينك في المسجد والحلقة المعتمدة، كما يمكنك متابعة حالة طلبك برقم التذكرة عبر البوابة.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (createdStudent) {
                      onPlacementSuccess(createdStudent);
                    }
                  }}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-400 to-emerald-500 hover:brightness-110 text-[#022c22] font-black text-sm shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
                >
                  <Check className="w-5 h-5 stroke-[3]" />
                  <span>إنهاء وتتبع حالة الطلب ➔</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Modal: All 114 Surahs Multi-Select Picker */}
        {isWeakSurahsModalOpen && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-md">
            <div className="w-full max-w-xl bg-[#022c22] border-2 border-amber-400/80 rounded-3xl shadow-2xl p-5 space-y-4 max-h-[85vh] flex flex-col text-white">
              <div className="flex items-center justify-between border-b border-[#065f46] pb-3">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-amber-400" />
                  <h4 className="font-heading font-black text-sm sm:text-base text-amber-300">
                    اختر السور التي تحتاج مراجعة علاجية (من 114 سورة)
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWeakSurahsModalOpen(false)}
                  className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-xl border border-white/10"
                >
                  إغلاق
                </button>
              </div>

              {/* Search input */}
              <div className="relative">
                <input
                  type="text"
                  value={surahSearchTerm}
                  onChange={e => setSurahSearchTerm(e.target.value)}
                  placeholder="ابحث باسم السورة (البقرة، آل عمران، الكهف، مريم، يوسف، الملك...)"
                  className="w-full bg-[#064e3b] border border-[#065f46] focus:border-[#fbbf24] rounded-2xl py-2 px-3.5 pr-9 text-xs text-white placeholder-slate-400 outline-none font-bold"
                />
                <Search className="w-4 h-4 text-amber-300 absolute right-3 top-2.5" />
              </div>

              {/* Grid of 114 Surahs */}
              <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 p-1 max-h-[420px] scrollbar-thin">
                {filteredSurahs.map(s => {
                  const isSelected = selectedWeakSurahs.includes(s.number);
                  return (
                    <button
                      key={s.number}
                      type="button"
                      onClick={() => toggleWeakSurah(s.number)}
                      className={`p-2 rounded-xl text-right border text-xs font-bold transition-all cursor-pointer flex items-center justify-between gap-1 ${
                        isSelected
                          ? 'bg-amber-400 text-[#064e3b] border-amber-300 shadow-md font-black'
                          : 'bg-[#064e3b] text-slate-200 border-[#065f46] hover:bg-[#065f46]'
                      }`}
                    >
                      <span className="truncate">{s.number}. {s.name}</span>
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 shrink-0 stroke-[3]" />
                      ) : (
                        <span className="text-[10px] opacity-40 font-mono">ج{s.juz}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-[#065f46] flex items-center justify-between">
                <span className="text-xs text-amber-300 font-bold">
                  تم تحديد ({selectedWeakSurahs.length}) سورة
                </span>
                <button
                  type="button"
                  onClick={() => setIsWeakSurahsModalOpen(false)}
                  className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#064e3b] font-black text-xs shadow-md cursor-pointer"
                >
                  اعتماد التحديد ({selectedWeakSurahs.length})
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
