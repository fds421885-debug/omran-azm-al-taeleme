import React, { useState } from 'react';
import {
  BookOpen,
  Sparkles,
  CheckCircle2,
  Clock,
  Award,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Building2,
  ArrowRight,
  TrendingUp,
  UserCheck,
  Flame,
  X,
  Compass
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  Student,
  QuranComplex,
  Halaqah,
  Mosque,
  WaitingListStudent,
  StudentMemorizationPlan
} from '../../types';
import { OmranDataService } from '../../lib/firebase';
import { toArabicNumerals } from '../quran/KingFahdQuranModal';

interface StudentAIPlacementModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentInitialData: {
    name: string;
    age: number;
    phone: string;
    parentName: string;
    parentPhones: string[];
    password?: string;
    complexId?: string;
  };
  complexes: QuranComplex[];
  halaqahs: Halaqah[];
  existingStudents: Student[];
  onPlacementComplete: (student: Student, targetComplex: QuranComplex, halaqah: Halaqah) => void;
  onPlacedInWaitingList: (waitingTicket: WaitingListStudent, targetComplex: QuranComplex) => void;
}

export const StudentAIPlacementModal: React.FC<StudentAIPlacementModalProps> = ({
  isOpen,
  onClose,
  studentInitialData,
  complexes,
  halaqahs,
  existingStudents,
  onPlacementComplete,
  onPlacedInWaitingList
}) => {
  // Resolve target complex
  const targetComplex = complexes.find(c => c.id === studentInitialData.complexId) || complexes[0] || null;
  const isMultiMosque = targetComplex?.complexType === 'multi_mosque_system' && (targetComplex?.mosques?.length || 0) > 0;

  // Step index: 0 = Welcome, 1 = Memorization & Solidification, 2 = Tajweed Test, 3 = Ijazah & Goal, 4 = Daily Pace, 5 = Mosque Selection (if multi-mosque), 6 = AI Processing & Outcome
  const [currentStep, setCurrentStep] = useState<number>(0);

  // Form / Interview Responses
  const [memorizedJuz, setMemorizedJuz] = useState<number>(1);
  const [consolidatedJuz, setConsolidatedJuz] = useState<number>(1);

  // Tajweed diagnostic responses
  const [knowsTajweed, setKnowsTajweed] = useState<'yes' | 'learning' | 'beginner'>('learning');
  const [tajweedQ1, setTajweedQ1] = useState<string>(''); // Easy: Iqlaab
  const [tajweedQ2, setTajweedQ2] = useState<string>(''); // Medium: Muttasil
  const [tajweedQ3, setTajweedQ3] = useState<string>(''); // Hard: Qalqalah

  // Ijazah & Goal
  const [hasIjazah, setHasIjazah] = useState<'yes' | 'in_progress' | 'no'>('no');
  const [targetGoal, setTargetGoal] = useState<string>('ختم وتثبيت القرآن الكريم كاملاً بإتقان');

  // Daily Pace
  const [dailyNewPace, setDailyNewPace] = useState<number>(1); // in pages (0.5, 1, 2, 3)
  const [dailyReviewPace, setDailyReviewPace] = useState<number>(5); // in pages (2, 5, 10, 20)

  // Selected Mosque (if multi-mosque system)
  const [selectedMosqueId, setSelectedMosqueId] = useState<string>(targetComplex?.mosques?.[0]?.id || '');

  // AI Reasoning & Search states
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<any>(null);
  const [placementOutcome, setPlacementOutcome] = useState<'placed' | 'waiting_list' | null>(null);
  const [placedHalaqah, setPlacedHalaqah] = useState<Halaqah | null>(null);
  const [waitingListTicket, setWaitingListTicket] = useState<WaitingListStudent | null>(null);
  const [createdStudent, setCreatedStudent] = useState<Student | null>(null);

  if (!isOpen) return null;

  // Total steps
  const totalInterviewSteps = isMultiMosque ? 5 : 4;

  const handleStartInterview = () => {
    setCurrentStep(1);
  };

  const handleNextStep = () => {
    if (currentStep === 1) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    } else if (currentStep === 3) {
      setCurrentStep(4);
    } else if (currentStep === 4) {
      if (isMultiMosque) {
        setCurrentStep(5);
      } else {
        processPlacementWithAI();
      }
    } else if (currentStep === 5) {
      processPlacementWithAI();
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      setCurrentStep(0);
    }
  };

  // Process AI Placement & Halaqah Capacity Allocation
  const processPlacementWithAI = async () => {
    setCurrentStep(6);
    setIsProcessing(true);

    try {
      // 1. Call server-side Gemini placement interview API
      const q1Correct = tajweedQ1 === 'إقلاب';
      const q2Correct = tajweedQ2 === 'مد واجب متصل';
      const q3Correct = tajweedQ3 === 'قطب جد';

      const res = await fetch('/api/gemini/student-placement-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: studentInitialData.name,
          age: studentInitialData.age,
          memorizedJuz,
          consolidatedJuz,
          tajweedAnswers: {
            knowsTajweed,
            easyCorrect: q1Correct,
            mediumCorrect: q2Correct,
            hardCorrect: q3Correct
          },
          hasIjazah: hasIjazah === 'yes',
          targetGoal,
          dailyNewPace,
          dailyReviewPace,
          selectedMosque: selectedMosqueId
        })
      });

      const data = await res.json();
      setAiAnalysisResult(data);

      // 2. Scan Candidate Halaqahs in Target Complex & Selected Mosque
      const complexHalaqahs = halaqahs.filter(h => {
        if (!targetComplex) return true;
        const matchesComplex = !h.complexId || h.complexId === targetComplex.id;
        if (isMultiMosque && selectedMosqueId) {
          return matchesComplex && (!h.mosqueId || h.mosqueId === selectedMosqueId);
        }
        return matchesComplex;
      });

      // Find halaqahs with available capacity
      const availableHalaqahsWithSeats = complexHalaqahs.map(h => {
        const studentCount = existingStudents.filter(s => s.halaqahId === h.id).length;
        const cap = h.capacity !== undefined && h.capacity > 0 ? h.capacity : Math.max(12, studentCount);
        const availableSeats = Math.max(0, cap - studentCount);
        return {
          halaqah: h,
          studentCount,
          capacity: cap,
          availableSeats
        };
      }).filter(item => item.availableSeats > 0);

      // 3. CASE A: SEAT FOUND
      if (availableHalaqahsWithSeats.length > 0) {
        // Pick best matching halaqah (most seats or matching level)
        const chosenItem = availableHalaqahsWithSeats[0];
        const chosenHalaqah = chosenItem.halaqah;

        const assignedMosque = isMultiMosque
          ? targetComplex?.mosques?.find(m => m.id === (chosenHalaqah.mosqueId || selectedMosqueId))
          : undefined;

        const studentId = `std_${Date.now()}`;
        const newStudentObj: Student = {
          id: studentId,
          name: studentInitialData.name.trim(),
          password: studentInitialData.password || '123',
          phone: studentInitialData.phone.trim(),
          age: studentInitialData.age || 10,
          parentName: studentInitialData.parentName.trim() || `ولي أمر ${studentInitialData.name.trim()}`,
          parentPhones: studentInitialData.parentPhones?.length ? studentInitialData.parentPhones : [studentInitialData.phone.trim()],
          currentSurah: data?.initialPosition?.surahNumber || 78,
          currentSurahName: data?.initialPosition?.surahName || 'النبأ',
          currentAyah: data?.initialPosition?.ayahNumber || 1,
          dailyNewTarget: `${dailyNewPace} وجه`,
          dailyReviewTarget: `${dailyReviewPace} أوجه`,
          level: data?.studentLevel || 'متوسط',
          complexId: targetComplex?.id,
          complexName: targetComplex?.name,
          halaqahId: chosenHalaqah.id,
          halaqahName: chosenHalaqah.name,
          assignedMosqueId: assignedMosque?.id,
          assignedMosqueName: assignedMosque?.name,
          memorizationPlan: data?.memorizationPlan,
          aiPlan: {
            roadmapSummary: data?.memorizationPlan?.aiNotes || 'خطة الحفظ والتثبيت الذكية المعتمدة للطالب',
            difficultyAdjustment: data?.studentLevel || 'متوسط',
            estimatedDaysToFinishJuz: Math.max(10, Math.round(20 / dailyNewPace)),
            currentDailyAssignment: data?.suggestedAssignment || {
              newMemorization: `سورة ${data?.initialPosition?.surahName || 'النبأ'}: الآيات (1 - 10)`,
              review: 'مراجعة وتثبيت المحفوظ السابق',
              suggestedSheikh: 'الشيخ محمود خليل الحصري (المصحف المعلم)',
              tajweedFocus: 'أحكام النون الساكنة والتنوين',
              dailyNote: 'التكرار 3 مرات قبل النوم ترسيخاً للحفظ.'
            },
            lastUpdated: new Date().toISOString()
          },
          createdAt: new Date().toISOString()
        };

        // Persist to Firestore and local storage
        await OmranDataService.saveStudent(newStudentObj);

        setCreatedStudent(newStudentObj);
        setPlacedHalaqah(chosenHalaqah);
        setPlacementOutcome('placed');

        // Confetti celebration
        try {
          confetti({
            particleCount: 80,
            spread: 80,
            origin: { y: 0.6 }
          });
        } catch (e) {}

      } else {
        // 4. CASE B: NO AVAILABLE CAPACITY (ALL HALAQAHS FULL -> WAITING LIST)
        const currentWaiting = targetComplex?.waitingList || [];
        const nextQueueNumber = currentWaiting.length + 1;
        const trackingCode = `OMR-W${Math.floor(1000 + Math.random() * 9000)}`;

        const assignedMosque = isMultiMosque
          ? targetComplex?.mosques?.find(m => m.id === selectedMosqueId)
          : undefined;

        const waitingTicket: WaitingListStudent = {
          id: `wait_${Date.now()}`,
          applicationTrackingCode: trackingCode,
          studentName: studentInitialData.name.trim(),
          age: studentInitialData.age,
          phone: studentInitialData.phone.trim(),
          parentName: studentInitialData.parentName.trim() || `ولي أمر ${studentInitialData.name.trim()}`,
          parentPhone: studentInitialData.phone.trim(),
          memorizedJuz,
          consolidatedJuz,
          tajweedLevel: data?.studentLevel || 'متوسط',
          hasIjazah: hasIjazah === 'yes',
          dailyNewPace,
          dailyReviewPace,
          queueNumber: nextQueueNumber,
          complexId: targetComplex?.id || 'complex-main',
          complexName: targetComplex?.name,
          mosqueId: assignedMosque?.id,
          mosqueName: assignedMosque?.name,
          status: 'waiting',
          notes: data?.memorizationPlan?.aiNotes || 'تم التحقق من المستوى ورسم الخطة في انتظار توفر مقعد شاغر',
          addedAt: new Date().toISOString()
        };

        // Update complex waiting list in database
        if (targetComplex) {
          const updatedComplex: QuranComplex = {
            ...targetComplex,
            waitingList: [...(targetComplex.waitingList || []), waitingTicket]
          };
          await OmranDataService.saveComplex(updatedComplex);
        }

        setWaitingListTicket(waitingTicket);
        setPlacementOutcome('waiting_list');
      }
    } catch (err: any) {
      console.error('Placement error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinishAndEnter = () => {
    if (placementOutcome === 'placed' && createdStudent && targetComplex && placedHalaqah) {
      onPlacementComplete(createdStudent, targetComplex, placedHalaqah);
    } else if (placementOutcome === 'waiting_list' && waitingListTicket && targetComplex) {
      onPlacedInWaitingList(waitingListTicket, targetComplex);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      dir="rtl"
    >
      <div className="relative w-full max-w-2xl bg-[#022c22] border-2 border-amber-400/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto transition-all animate-fadeIn">
        
        {/* Top Header */}
        <div className="bg-gradient-to-r from-[#064e3b] via-[#022c22] to-[#064e3b] border-b border-[#065f46] px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/50 text-amber-300 flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-black text-white font-heading flex items-center gap-2">
                <span>المساعد القرآني الذكي لتحديد المستوى والتسكين</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-slate-900 font-black">
                  ذكاء اصطناعي
                </span>
              </h3>
              <p className="text-[11px] text-emerald-200">
                {targetComplex?.name || 'مجمع القرآن الكريم'} • مقابلة تحديد المستوى والتسكين بالحلقات
              </p>
            </div>
          </div>

          {currentStep !== 6 && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-6">

          {/* STEP 0: WELCOME BANNER */}
          {currentStep === 0 && (
            <div className="text-center space-y-6 py-4">
              <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-amber-400/20 blur-xl animate-pulse" />
                <div className="w-24 h-24 rounded-3xl bg-[#064e3b] border-2 border-amber-400/60 flex items-center justify-center shadow-2xl relative z-10">
                  <BookOpen className="w-12 h-12 text-amber-300" />
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xl sm:text-2xl font-black text-white font-heading">
                  مرحباً بك يا <span className="text-amber-300">{studentInitialData.name}</span>! 👋
                </h4>
                <p className="text-sm text-emerald-200 leading-relaxed max-w-lg mx-auto">
                  حفظك الله وبارك في مسيرتك القرآنية. لن نطلب منك اختيار حلقة يدوياً؛ بل سأقوم بصفتي مساعدك القرآني الذكي بطرح بضعة أسئلة ممتعة لتحديد مستواك بدقة، ورسم خطة ختم وتثبيت مخصصة لك، والبحث عن المقعد الأنسب لك في حلقات المجمع.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-right">
                <div className="p-3.5 rounded-2xl bg-[#064e3b]/40 border border-[#065f46] space-y-1">
                  <span className="text-amber-300 text-xs font-bold flex items-center gap-1.5">
                    <Award className="w-4 h-4" />
                    <span>فحص الحفظ والتثبيت</span>
                  </span>
                  <p className="text-[11px] text-slate-300">
                    رصد الأجزاء المحفوظة وتمييز المتقن المثبت منها.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#064e3b]/40 border border-[#065f46] space-y-1">
                  <span className="text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>اختبار التجويد الذكي</span>
                  </span>
                  <p className="text-[11px] text-slate-300">
                    ٣ أسئلة تفاعلية (سهل، متوسط، متقدم) لتحديد المستوى.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#064e3b]/40 border border-[#065f46] space-y-1">
                  <span className="text-sky-300 text-xs font-bold flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4" />
                    <span>خطة الختم والتسكين</span>
                  </span>
                  <p className="text-[11px] text-slate-300">
                    رسم خطة زمنية حتى الختمة وإلحاقك بحلقة متاحة السعة.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleStartInterview}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-black text-sm border-b-4 border-amber-600 active:translate-y-[2px] active:border-b-2 shadow-xl cursor-pointer transition-all inline-flex items-center justify-center gap-2"
              >
                <span>ابدأ المقابلة الذكية الآن</span>
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* STEP 1: MEMORIZATION & SOLIDIFICATION */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <span className="text-xs text-amber-400 font-bold">الخطوة ١ من {totalInterviewSteps}</span>
                <h4 className="text-lg font-black text-white font-heading">
                  الأجزاء المحفوظة والمثبتة من القرآن الكريم
                </h4>
                <p className="text-xs text-emerald-200">
                  حدد عدد الأجزاء التي سبق لك حفظها، وكم جزءاً منها يعتبر محفوظاً ومثبتاً بإتقان لا يتفلت منك.
                </p>
              </div>

              <div className="space-y-5 bg-[#064e3b]/30 p-4 rounded-2xl border border-[#065f46]">
                {/* Total Memorized Juz */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-emerald-200">
                      كم جزءاً تحفظ من القرآن الكريم؟
                    </label>
                    <span className="text-sm font-black text-amber-300 bg-[#022c22] px-3 py-1 rounded-xl border border-amber-400/40">
                      {memorizedJuz} {memorizedJuz === 1 ? 'جزء' : memorizedJuz === 2 ? 'جزآن' : 'أجزاء'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    value={memorizedJuz}
                    onChange={e => {
                      const v = Number(e.target.value);
                      setMemorizedJuz(v);
                      if (consolidatedJuz > v) setConsolidatedJuz(v);
                    }}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 px-1">
                    <span>مبتدئ من الصفر (0)</span>
                    <span>نصف القرآن (15 جزءاً)</span>
                    <span>القرآن كاملاً (30 جزءاً)</span>
                  </div>
                </div>

                {/* Consolidated / Solidified Juz */}
                <div className="space-y-2 pt-2 border-t border-[#065f46]">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-emerald-200">
                      كم جزءاً منها تعتبره مثبتاً ومتقناً لديك؟
                    </label>
                    <span className="text-sm font-black text-emerald-300 bg-[#022c22] px-3 py-1 rounded-xl border border-emerald-400/40">
                      {consolidatedJuz} أجزاء مثبتة
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={memorizedJuz}
                    value={consolidatedJuz}
                    onChange={e => setConsolidatedJuz(Number(e.target.value))}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                  <p className="text-[11px] text-slate-300">
                    {consolidatedJuz < memorizedJuz
                      ? `لديك ${memorizedJuz - consolidatedJuz} أجزاء تحتاج تثبيتاً ومراجعة مكثفة ضمن خطتك.`
                      : 'ممتاز! جميع ما حفظته مثبت ومتقن بفضل الله.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: TAJWEED DIAGNOSTIC TEST */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <span className="text-xs text-amber-400 font-bold">الخطوة ٢ من {totalInterviewSteps}</span>
                <h4 className="text-lg font-black text-white font-heading">
                  اختبار أحكام التجويد التشخيصي (٣ أسئلة)
                </h4>
                <p className="text-xs text-emerald-200">
                  أجب عن الأسئلة التالية لتحديد مستواك التجويدي بدقة واقتراح التركيز التجويدي الأنسب لك.
                </p>
              </div>

              <div className="space-y-4">
                {/* Question 1: Easy */}
                <div className="p-3.5 rounded-2xl bg-[#064e3b]/30 border border-[#065f46] space-y-2.5">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-900 font-black text-[11px] flex items-center justify-center">١</span>
                    <span>سؤال بسيط: ما حكم النون الساكنة في قوله تعالى: (مِن بَعْدِ) ؟</span>
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold">
                    {['إقلاب', 'إدغام', 'إظهار', 'إخفاء'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setTajweedQ1(opt)}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          tajweedQ1 === opt
                            ? 'bg-amber-400 text-slate-900 border-amber-500 font-black shadow-md'
                            : 'bg-[#022c22] text-slate-200 border-[#065f46] hover:bg-[#064e3b]'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Question 2: Medium */}
                <div className="p-3.5 rounded-2xl bg-[#064e3b]/30 border border-[#065f46] space-y-2.5">
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-400 text-slate-900 font-black text-[11px] flex items-center justify-center">٢</span>
                    <span>سؤال متوسط: ما نوع المد في قوله تعالى: (السَّمَاءِ) عند الوصل؟</span>
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold">
                    {['مد واجب متصل', 'مد جائز منفصل', 'مد بدل', 'مد لازم'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setTajweedQ2(opt)}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          tajweedQ2 === opt
                            ? 'bg-emerald-400 text-slate-900 border-emerald-500 font-black shadow-md'
                            : 'bg-[#022c22] text-slate-200 border-[#065f46] hover:bg-[#064e3b]'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Question 3: Hard */}
                <div className="p-3.5 rounded-2xl bg-[#064e3b]/30 border border-[#065f46] space-y-2.5">
                  <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-sky-400 text-slate-900 font-black text-[11px] flex items-center justify-center">٣</span>
                    <span>سؤال متقدم: ما صفة 'القلقلة' وفي أي الحروف تجتمع؟</span>
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold">
                    {['قطب جد', 'يرملون', 'خص ضغط قظ', 'أحرف الحلق'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setTajweedQ3(opt)}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          tajweedQ3 === opt
                            ? 'bg-sky-400 text-slate-900 border-sky-500 font-black shadow-md'
                            : 'bg-[#022c22] text-slate-200 border-[#065f46] hover:bg-[#064e3b]'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: IJAZAH & GOAL */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <span className="text-xs text-amber-400 font-bold">الخطوة ٣ من {totalInterviewSteps}</span>
                <h4 className="text-lg font-black text-white font-heading">
                  الإجازة القرآنية وهدفك التثبيتي
                </h4>
                <p className="text-xs text-emerald-200">
                  هل لديك إجازة في قراءة معينة؟ وما هي غايتك الأساسية في رحلتك بالحلقة؟
                </p>
              </div>

              <div className="space-y-4">
                {/* Ijazah */}
                <div className="p-3.5 rounded-2xl bg-[#064e3b]/30 border border-[#065f46] space-y-2">
                  <label className="text-xs font-bold text-emerald-200 block">
                    هل تحمل إجازة مسندة في القرآن الكريم؟
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-bold">
                    {[
                      { id: 'yes', label: 'نعم، أحمل إجازة مسندة' },
                      { id: 'in_progress', label: 'في طور الإقراء والإجازة' },
                      { id: 'no', label: 'لا، ولكن أطمح لنيلها' }
                    ].map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setHasIjazah(item.id as any)}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          hasIjazah === item.id
                            ? 'bg-amber-400 text-slate-900 border-amber-500 font-black shadow-md'
                            : 'bg-[#022c22] text-slate-200 border-[#065f46] hover:bg-[#064e3b]'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Goal */}
                <div className="p-3.5 rounded-2xl bg-[#064e3b]/30 border border-[#065f46] space-y-2">
                  <label className="text-xs font-bold text-emerald-200 block">
                    ما هو هدفك التثبيتي الرئيسي؟
                  </label>
                  <div className="grid grid-cols-1 gap-2 text-xs font-bold">
                    {[
                      'ختم وتثبيت القرآن الكريم كاملاً بإتقان',
                      'تثبيت ومراجعة الأجزاء المحفوظة السابقة دون تشتت',
                      'حفظ جديد بوتيرة يومية متدرجة مع ضبط التجويد',
                      'إتقان مخارج الحروف والصفات والتأهل للإجازة'
                    ].map(goal => (
                      <button
                        key={goal}
                        type="button"
                        onClick={() => setTargetGoal(goal)}
                        className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                          targetGoal === goal
                            ? 'bg-emerald-500/30 text-white border-emerald-400 font-black shadow-md'
                            : 'bg-[#022c22] text-slate-300 border-[#065f46] hover:bg-[#064e3b]'
                        }`}
                      >
                        <span>{goal}</span>
                        {targetGoal === goal && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: DAILY PACE */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="space-y-1">
                <span className="text-xs text-amber-400 font-bold">الخطوة ٤ من {totalInterviewSteps}</span>
                <h4 className="text-lg font-black text-white font-heading">
                  طاقتك اليومية في الحفظ والمراجعة
                </h4>
                <p className="text-xs text-emerald-200">
                  حدد المقدار الذي تستطيع الالتزام به يومياً ليرسم الذكاء الاصطناعي موعد ختمتك وتثبيتك بدقة.
                </p>
              </div>

              <div className="space-y-4">
                {/* New Pace */}
                <div className="p-3.5 rounded-2xl bg-[#064e3b]/30 border border-[#065f46] space-y-2">
                  <label className="text-xs font-bold text-emerald-200 block">
                    كم وجهاً جديداً تستطيع حفظه وتسميعه يومياً؟
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold">
                    {[
                      { val: 0.5, label: 'نصف وجه' },
                      { val: 1, label: 'وجه واحد' },
                      { val: 2, label: 'وجهان' },
                      { val: 3, label: '٣ أوجه' }
                    ].map(item => (
                      <button
                        key={item.val}
                        type="button"
                        onClick={() => setDailyNewPace(item.val)}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          dailyNewPace === item.val
                            ? 'bg-amber-400 text-slate-900 border-amber-500 font-black shadow-md'
                            : 'bg-[#022c22] text-slate-200 border-[#065f46] hover:bg-[#064e3b]'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Review Pace */}
                <div className="p-3.5 rounded-2xl bg-[#064e3b]/30 border border-[#065f46] space-y-2">
                  <label className="text-xs font-bold text-emerald-200 block">
                    كم وجه مراجعة تستطيع تسميعه يومياً لتثبيت المحفوظ؟
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold">
                    {[
                      { val: 2, label: 'وجهان' },
                      { val: 5, label: '٥ أوجه (ربع حزب)' },
                      { val: 10, label: '١٠ أوجه (نصف جزء)' },
                      { val: 20, label: '٢٠ وجهاً (جزء كامل)' }
                    ].map(item => (
                      <button
                        key={item.val}
                        type="button"
                        onClick={() => setDailyReviewPace(item.val)}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          dailyReviewPace === item.val
                            ? 'bg-emerald-400 text-slate-900 border-emerald-500 font-black shadow-md'
                            : 'bg-[#022c22] text-slate-200 border-[#065f46] hover:bg-[#064e3b]'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: MOSQUE SELECTION (FOR MULTI-MOSQUE MEGA ORGANIZATION) */}
          {currentStep === 5 && isMultiMosque && (
            <div className="space-y-6">
              <div className="space-y-1">
                <span className="text-xs text-amber-400 font-bold">الخطوة ٥ من {totalInterviewSteps}</span>
                <h4 className="text-lg font-black text-white font-heading">
                  أي الجوامع والمساجد التابعة للمنظومة هو الأقرب إليك؟
                </h4>
                <p className="text-xs text-emerald-200">
                  بما أن هذا التسجيل ضمن ({targetComplex?.name})، اختر المسجد الأقرب لمقر سكنك لتسكينك في إحدى حلقاته.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5 max-h-72 overflow-y-auto">
                {targetComplex?.mosques?.map(m => {
                  const isSelected = selectedMosqueId === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMosqueId(m.id)}
                      className={`p-4 rounded-2xl border text-right transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-emerald-600/30 text-white border-emerald-400 font-black shadow-md'
                          : 'bg-[#064e3b]/30 text-slate-200 border-[#065f46] hover:bg-[#064e3b]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">{m.name}</div>
                          {m.address && (
                            <div className="text-xs text-emerald-200/80 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3.5 h-3.5 text-amber-400" />
                              <span>{m.address}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      {isSelected && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 6: AI PROCESSING & OUTCOME */}
          {currentStep === 6 && (
            <div className="text-center space-y-6 py-4">
              {isProcessing ? (
                <div className="space-y-6 py-8">
                  {/* Rotating loader around steadfast Quran emblem */}
                  <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-amber-400/20 blur-xl animate-pulse" />
                    
                    {/* Rotating Ring */}
                    <svg
                      className="absolute inset-0 w-full h-full animate-spin pointer-events-none"
                      viewBox="0 0 100 100"
                      style={{ animationDuration: '2.4s', animationTimingFunction: 'linear' }}
                    >
                      <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
                      <circle
                        cx="50"
                        cy="50"
                        r="44"
                        fill="none"
                        stroke="#fbbf24"
                        strokeWidth="4"
                        strokeDasharray="90 180"
                        strokeLinecap="round"
                      />
                    </svg>

                    {/* Steadfast Holy Quran */}
                    <div className="w-20 h-20 rounded-2xl bg-[#064e3b] border-2 border-amber-400 flex items-center justify-center shadow-2xl relative z-10">
                      <BookOpen className="w-10 h-10 text-amber-300" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-lg font-black text-white font-heading">
                      جاري تحليل إجاباتك ورسم خطة الختم والبحث في شواغر الحلقات...
                    </h4>
                    <p className="text-xs text-emerald-200">
                      يقوم الذكاء الاصطناعي الآن بمطابقة مستواك وسعة الحلقات الاستيعابية.
                    </p>
                  </div>
                </div>
              ) : placementOutcome === 'placed' && placedHalaqah ? (
                /* OUTCOME A: PLACED IN A HALAQAH */
                <div className="space-y-6 animate-fadeIn">
                  <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 flex items-center justify-center mx-auto shadow-2xl">
                    <CheckCircle2 className="w-12 h-12" />
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xl sm:text-2xl font-black text-white font-heading">
                      مبارك يا <span className="text-amber-300">{studentInitialData.name}</span>! 🎉
                    </h4>
                    <p className="text-sm font-bold text-emerald-300">
                      تم قبولك وتسكينك بنجاح في حلقات المجمع!
                    </p>
                  </div>

                  {/* Placement Details Card */}
                  <div className="bg-[#064e3b]/40 border-2 border-amber-400/50 rounded-2xl p-5 text-right space-y-3.5 shadow-xl">
                    <div className="flex items-center justify-between border-b border-[#065f46] pb-3">
                      <span className="text-xs text-slate-300">الحلقة المخصصة لك:</span>
                      <span className="text-sm font-black text-amber-300">{placedHalaqah.name}</span>
                    </div>

                    <div className="flex items-center justify-between border-b border-[#065f46] pb-3">
                      <span className="text-xs text-slate-300">المعلم والمحفظ:</span>
                      <span className="text-xs font-bold text-white">{placedHalaqah.primaryTeacherName || 'معلم الحلقة'}</span>
                    </div>

                    {createdStudent?.assignedMosqueName && (
                      <div className="flex items-center justify-between border-b border-[#065f46] pb-3">
                        <span className="text-xs text-slate-300">المسجد / الجامع:</span>
                        <span className="text-xs font-bold text-emerald-200">{createdStudent.assignedMosqueName}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between border-b border-[#065f46] pb-3">
                      <span className="text-xs text-slate-300">المستوى المعتمد:</span>
                      <span className="text-xs font-black text-sky-300">{aiAnalysisResult?.studentLevel || 'متوسط'}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-300">موعد الختمة المتوقع:</span>
                      <span className="text-xs font-black text-amber-300">
                        {aiAnalysisResult?.memorizationPlan?.targetCompletionDate || 'خلال سنة تقريباً'} ({toArabicNumerals(aiAnalysisResult?.memorizationPlan?.estimatedDaysRemaining || 365)} يوماً)
                      </span>
                    </div>
                  </div>

                  {aiAnalysisResult?.memorizationPlan?.aiNotes && (
                    <div className="p-4 rounded-2xl bg-[#022c22] border border-[#065f46] text-xs text-emerald-200 leading-relaxed text-right">
                      <span className="font-bold text-amber-300 block mb-1">توجيه الذكاء الاصطناعي لك:</span>
                      {aiAnalysisResult.memorizationPlan.aiNotes}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleFinishAndEnter}
                    className="w-full py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-black text-sm border-b-4 border-amber-600 active:translate-y-[2px] active:border-b-2 shadow-xl cursor-pointer transition-all flex items-center justify-center gap-2"
                  >
                    <span>الدخول إلى واجهة الطالب والبدء فوراً</span>
                    <ArrowRight className="w-5 h-5 rotate-180" />
                  </button>
                </div>
              ) : (
                /* OUTCOME B: WAITING LIST */
                <div className="space-y-6 animate-fadeIn">
                  <div className="w-20 h-20 rounded-3xl bg-amber-500/20 border-2 border-amber-400 text-amber-300 flex items-center justify-center mx-auto shadow-2xl">
                    <Clock className="w-12 h-12" />
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-xl sm:text-2xl font-black text-white font-heading">
                      أنت مسجل في قائمة الانتظار للمجمع
                    </h4>
                    <p className="text-sm font-bold text-amber-300">
                      نظراً لاكتمال السعة الاستيعابية لجميع الحلقات حالياً (فل).
                    </p>
                  </div>

                  {/* Waiting Ticket */}
                  <div className="bg-[#064e3b]/40 border-2 border-amber-400/50 rounded-2xl p-5 text-right space-y-3 shadow-xl">
                    <div className="flex items-center justify-between border-b border-[#065f46] pb-3">
                      <span className="text-xs text-slate-300">رقم متابعة الطلب:</span>
                      <span className="text-sm font-black text-amber-300 font-mono">{waitingListTicket?.applicationTrackingCode}</span>
                    </div>

                    <div className="flex items-center justify-between border-b border-[#065f46] pb-3">
                      <span className="text-xs text-slate-300">دورك في قائمة الانتظار:</span>
                      <span className="text-sm font-black text-emerald-300">#{waitingListTicket?.queueNumber}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-300">رقم الهاتف المسجل للتواصل:</span>
                      <span className="text-xs font-mono font-bold text-white">{studentInitialData.phone}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed max-w-md mx-auto">
                    تم حفظ مستواك وخطة تسميعك بالكامل. سيتواصل معك مشرف المجمع فور توفر مقعد شاغر في إحدى الحلقات المعتمدة.
                  </p>

                  <button
                    type="button"
                    onClick={handleFinishAndEnter}
                    className="w-full py-3.5 rounded-2xl bg-[#064e3b] hover:bg-emerald-700 text-white font-black text-sm border-2 border-emerald-400/50 border-b-4 border-b-emerald-800 active:translate-y-[2px] active:border-b-2 shadow-xl cursor-pointer transition-all"
                  >
                    <span>تم وحفظ بطاقة الانتظار</span>
                  </button>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Navigation Footer */}
        {currentStep > 0 && currentStep < 6 && (
          <div className="bg-[#021f18] border-t border-[#065f46] px-5 py-3.5 flex items-center justify-between">
            <button
              type="button"
              onClick={handlePrevStep}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <ChevronRight className="w-4 h-4" />
              <span>السابق</span>
            </button>

            <button
              type="button"
              onClick={handleNextStep}
              className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-black text-xs border-b-2 border-amber-600 active:translate-y-[1px] shadow-md cursor-pointer transition-all flex items-center gap-1.5"
            >
              <span>{currentStep === totalInterviewSteps ? 'تسكين الطالب ورسم الخطة' : 'التالي'}</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
