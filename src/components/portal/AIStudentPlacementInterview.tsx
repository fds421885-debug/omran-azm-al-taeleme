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
  Search
} from 'lucide-react';
import {
  Student,
  Halaqah,
  QuranComplex,
  Mosque,
  WaitingListStudent,
  StudentMemorizationPlan,
  StudentRegistrationApplication
} from '../../types';
import { OmranDataService } from '../../lib/firebase';
import {
  executeDynamicInterviewTurn,
  calculateRealisticKhatmTimeline,
  DynamicInterviewResponse,
  DynamicInterviewQuestion
} from '../../lib/aiPlanService';
import {
  buildApplicationAcceptedEmail,
  sendRealPortalEmail
} from '../../lib/portalEmailService';
import { QURAN_SURAHS, getSurahInfo } from '../../data/quranData';
import { calculatePortionFromPace } from '../../data/quranPagesData';

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
    trackingCode: string;
  };
  complex: QuranComplex;
  halaqahs: Halaqah[];
  existingStudents: Student[];
  onPlacementSuccess: (student: Student) => void;
  onWaitingListAdded: (entry: WaitingListStudent) => void;
  onCancel: () => void;
}

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
  options?: Array<{ label: string; value: any; subtext?: string }>;
  isQuestion?: boolean;
  questionKey?: string;
  isLiveTest?: boolean;
  surahNumber?: number;
  ayahNumber?: number;
  customWidget?: 'juz_selector' | 'pace_selector' | 'mosque_selector' | 'result_success' | 'result_waiting' | 'surah_picker';
  widgetData?: any;
}

export const AIStudentPlacementInterview: React.FC<AIStudentPlacementInterviewProps> = ({
  studentInitialData,
  complex,
  halaqahs,
  existingStudents,
  onPlacementSuccess,
  onWaitingListAdded,
  onCancel
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [turnIndex, setTurnIndex] = useState<number>(1);
  const [isTyping, setIsTyping] = useState<boolean>(true);
  const [typingMessage, setTypingMessage] = useState<string>('المساعد القرآني يتأمل بياناتك ويبدأ المقابلة التفاعلية...');
  const [userInput, setUserInput] = useState<string>('');
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Accumulated assessment data gathered adaptively across dialogue turns
  const [interviewData, setInterviewData] = useState<{
    memorizedCount: number;
    consolidatedCount: number;
    tajweedScore: number;
    hasIjazah: boolean;
    goal: string;
    dailyNewPages: number;
    dailyReviewPages: number;
    selectedMosqueId?: string;
    selectedMosqueName?: string;
    reachedSurah?: number;
    reachedAyah?: number;
    reachedSurahName?: string;
    reviewDirection?: 'from_baqarah' | 'from_nas';
    userAnswersList: string[];
  }>({
    memorizedCount: studentInitialData.memorizedJuzList?.length || 1,
    consolidatedCount: Math.max(0, (studentInitialData.memorizedJuzList?.length || 1) - 2),
    tajweedScore: 0,
    hasIjazah: false,
    goal: 'ختم القرآن الكريم وتثبيته كاملاً بإتقان',
    dailyNewPages: 1,
    dailyReviewPages: 5,
    reachedSurah: undefined,
    reachedAyah: undefined,
    reachedSurahName: undefined,
    reviewDirection: (studentInitialData.memorizedJuzList?.length || 1) >= 30 ? 'from_baqarah' : 'from_nas',
    userAnswersList: []
  });

  const [placementResult, setPlacementResult] = useState<{
    status: 'success' | 'waiting' | null;
    matchedHalaqah?: Halaqah;
    matchedMosque?: Mosque;
    waitingEntry?: WaitingListStudent;
    generatedPlan?: StudentMemorizationPlan;
    newStudent?: Student;
  }>({ status: null });

  // Auto scroll to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isTyping]);

  // Welcome greeting & Turn 1 Launch
  useEffect(() => {
    const memCount = studentInitialData.memorizedJuzList?.length || 1;
    const isKhatim = memCount >= 30;
    const isChild = studentInitialData.age <= 12;

    const timer = setTimeout(async () => {
      const greetingText = isKhatim
        ? `أهلاً وسهلاً بك يا ${studentInitialData.studentName} في مجمع ${complex.name}! 🌟\n\nأنا «المساعد القرآني الذكي لتسكين وتوجيه الطلاب». هنيئاً لك حفظ كتاب الله كاملاً، ومهمتي معك اليوم هي تقييم جودة السرد وضبط المتشابهات ورسم مسار الإجازة والسند المتصل، والبحث عن الحلقة الأنسب لمستواك العالي.`
        : isChild
        ? `أهلاً بالبطل الصغير ${studentInitialData.studentName} (عمرك ${studentInitialData.age} سنة) في مجمع ${complex.name}! 🌸\n\nأنا صديقك «المساعد الذكي». سنلعب معاً ونتحدث عن القرآن الكريم، لنتعرف على حفظك الجميل ونختار لك أحسن شيخ وأجمل حلقة!`
        : `أهلاً وسهلاً بك يا ${studentInitialData.studentName} في مجمع ${complex.name}! 🌟\n\nأنا «المساعد القرآني الذكي لتسكين وتوجيه الطلاب». سنجري معاً مقابلة تفاعلية حية لفحص جودة حفظك وتجويدك ونفسيتك، لنرسم لك خطة تثبيت مخصصة حتى الختم والتثبيت، وتسكينك في الحلقة الأنسب.`;

      const welcomeMsg: ChatMessage = {
        id: 'msg_welcome',
        sender: 'ai',
        text: greetingText,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages([welcomeMsg]);
      setIsTyping(true);
      setTypingMessage('المساعد الذكي يحلل مستواك ويعد السؤال الأول...');

      // Run Turn 1 dynamically
      try {
        const turn1 = await executeDynamicInterviewTurn({
          studentInitialData,
          complex,
          turnIndex: 1,
          chatHistory: [{ sender: 'ai', text: greetingText }],
          accumulatedData: interviewData
        });

        setTimeout(() => {
          setIsTyping(false);
          const isSurahPicker = turn1.nextQuestion?.questionId === 'quran_position_reached' || (turn1 as any).customWidget === 'surah_picker';
          const qMsg: ChatMessage = {
            id: `msg_q_1`,
            sender: 'ai',
            text: turn1.replyText,
            timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
            isQuestion: true,
            questionKey: turn1.nextQuestion?.questionId || 'turn_1',
            options: turn1.nextQuestion?.options,
            isLiveTest: turn1.nextQuestion?.isLiveRecitationTest,
            surahNumber: turn1.nextQuestion?.surahNumber,
            ayahNumber: turn1.nextQuestion?.ayahNumber,
            customWidget: isSurahPicker ? 'surah_picker' : undefined
          };
          setMessages(prev => [...prev, qMsg]);
        }, 900);
      } catch (err) {
        setIsTyping(false);
      }
    }, 700);

    return () => clearTimeout(timer);
  }, []);

  // Multi-Mosque system check
  const isMultiMosqueSystem = useMemo(() => {
    return complex.complexType === 'multi_mosque_system' || (complex.mosques && complex.mosques.length > 1);
  }, [complex]);

  // Mosque selection question
  const askMosqueSelectionQuestion = () => {
    if (!isMultiMosqueSystem || !complex.mosques || complex.mosques.length === 0) {
      performAIPlacementAndPlanCalculation();
      return;
    }

    setIsTyping(true);
    setTypingMessage('المساعد الذكي يفحص المساجد التابعة للمنظومة...');
    setTimeout(() => {
      const qMsg: ChatMessage = {
        id: 'msg_q_mosque',
        sender: 'ai',
        text: `بما أن مجمع «${complex.name}» يضم منظومة مساجد وجوامع متعددة:\n\nأيّ المساجد التالية هو الأقرب والأيسر لسكنك لنبحث لك عن حلقة بشاغر متاح فيه؟`,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        isQuestion: true,
        questionKey: 'mosque_picker',
        customWidget: 'mosque_selector',
        widgetData: {
          mosques: complex.mosques
        }
      };
      setMessages(prev => [...prev, qMsg]);
      setIsTyping(false);
    }, 700);
  };

  // Perform AI Matching, Capacity Checking, and Realistic Plan Generation
  const performAIPlacementAndPlanCalculation = async (selectedMosqueId?: string) => {
    setIsTyping(true);
    setTypingMessage('الذكاء الاصطناعي يحسب جدول الختم الواقعي ويبحث عن الحلقة الشاغرة...');

    setTimeout(async () => {
      // 1. Search candidate halaqahs in this complex (or selected mosque)
      let candidateHalaqahs = halaqahs.filter(h => {
        if (h.complexId && h.complexId !== complex.id) return false;
        if (selectedMosqueId && h.mosqueId && h.mosqueId !== selectedMosqueId) return false;
        return true;
      });

      if (candidateHalaqahs.length === 0) {
        candidateHalaqahs = halaqahs;
      }

      // 2. Check Capacity: count students currently in each halaqah
      const halaqahStudentCounts = new Map<string, number>();
      for (const s of existingStudents) {
        if (s.halaqahId) {
          const count = halaqahStudentCounts.get(s.halaqahId) || 0;
          halaqahStudentCounts.set(s.halaqahId, count + 1);
        }
      }

      // Filter halaqahs that have free capacity: current < capacity
      const availableHalaqahs = candidateHalaqahs.filter(h => {
        const cap = h.capacity && h.capacity > 0 ? h.capacity : 15;
        const currentCount = halaqahStudentCounts.get(h.id) || 0;
        return currentCount < cap;
      });

      // 3. Calculate Realistic, Mathematically Sound Khatmah Timeline
      const weeklyDays = 5;
      const dailyHours = 2;
      const memCount = Math.max(1, interviewData.memorizedCount);
      const isKhatim = memCount >= 30;
      const consCount = Math.max(0, Math.min(memCount, interviewData.consolidatedCount));
      const dailyNew = Math.max(0.25, interviewData.dailyNewPages);
      const dailyRev = Math.max(2, interviewData.dailyReviewPages);

      const startS = interviewData.reachedSurah || (isKhatim ? 2 : 78);
      const startA = interviewData.reachedAyah || 1;
      const startInfo = getSurahInfo(startS);

      const timeline = calculateRealisticKhatmTimeline({
        memorizedJuz: memCount,
        consolidatedJuz: consCount,
        dailyNewPages: dailyNew,
        dailyReviewPages: dailyRev,
        weeklyDaysCount: weeklyDays,
        dailyHoursCount: dailyHours
      });

      const startPortion = calculatePortionFromPace(startS, startA, dailyNew);

      // Day 1 Protocol:
      // "اول يوم للقارئ وهيبدأ لو خاتم مش هيكون فيه مراجعة اول يوم ﻷنه لسه هيبدأ وهيسمع لكن بكرة لا خلاص اللي سمعه يحب يبدأ عليه المراجعة من الحفظ اللي سمعه امبارح"
      const plan: StudentMemorizationPlan = {
        dailyNewPages: dailyNew,
        dailyReviewPages: dailyRev,
        consolidatedJuzCount: consCount,
        memorizedJuzCount: memCount,
        targetJuz: 30,
        targetCompletionDate: timeline.targetCompletionDate,
        estimatedDaysRemaining: timeline.estimatedDaysRemaining,
        progressPercentage: timeline.progressPercentage,
        status: 'on_track',
        weeklyDaysCount: weeklyDays,
        dailyHoursCount: dailyHours,
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

      if (availableHalaqahs.length > 0) {
        // CASE A: Available Halaqah Found!
        const matched = availableHalaqahs[0];
        const matchedMosque = complex.mosques?.find(m => m.id === matched.mosqueId || m.id === selectedMosqueId);

        const newStudentId = `std_${Date.now()}_${Math.floor(Math.random() * 9000 + 1000)}`;
        const studentObj: Student = {
          id: newStudentId,
          name: studentInitialData.studentName,
          password: '123',
          phone: studentInitialData.phone,
          age: studentInitialData.age,
          parentName: studentInitialData.parentName,
          parentPhones: [studentInitialData.parentPhone],
          parentPhone: studentInitialData.parentPhone,
          googleEmail: studentInitialData.email || null,
          currentSurah: startS,
          currentSurahName: startInfo.name,
          currentAyah: startA,
          startSurahReached: startS,
          startAyahReached: startA,
          reviewStartDirection: interviewData.reviewDirection || (isKhatim ? 'from_baqarah' : 'from_nas'),
          isFirstSession: true,
          dailyNewTarget: `${dailyNew} وجه يومياً`,
          dailyReviewTarget: `${dailyRev} أوجه يومياً`,
          level: interviewData.tajweedScore >= 1 || memCount >= 5 ? 'متميز' : 'متوسط',
          complexId: complex.id,
          complexName: complex.name,
          halaqahId: matched.id,
          halaqahName: matched.name,
          assignedMosqueId: matchedMosque?.id,
          assignedMosqueName: matchedMosque?.name,
          memorizationPlan: plan,
          aiPlan: {
            roadmapSummary: `خطة تثبيت ذكية ومحسوبة بدقة. موعد الختم الواقعي: ${timeline.targetCompletionDate}.`,
            currentDailyAssignment: {
              newMemorization: plan.nextDayAssignment?.newMemorization || 'وجه جديد',
              review: plan.nextDayAssignment?.review || 'مراجعة الماضي',
              suggestedSheikh: 'الشيخ محمود خليل الحصري (المصحف المعلم)',
              dailyNote: 'التكرار 3 مرات قبل النوم لضمان التثبيت',
              targetRepetitions: 3
            },
            difficultyAdjustment: 'متزن',
            estimatedDaysToFinishJuz: Math.ceil(20 / dailyNew),
            lastUpdated: new Date().toISOString()
          },
          mushafErrors: [],
          notes: studentInitialData.notes || 'تم التسكين والتوجيه بالمساعد الذكي التفاعلي',
          createdAt: new Date().toISOString()
        };

        setPlacementResult({
          status: 'success',
          matchedHalaqah: matched,
          matchedMosque,
          generatedPlan: plan,
          newStudent: studentObj
        });

        const resultMsg: ChatMessage = {
          id: 'msg_result_success',
          sender: 'ai',
          text: `🎉 مبارك يا ${studentInitialData.studentName}! أتممت المقابلة التفاعلية بنجاح.\n\nبناءً على فحص مستواك ونفسيتك، وجدنا لك شاغراً مناسباً في: «${matched.name}» ${
            matchedMosque ? `بجامع «${matchedMosque.name}»` : ''
          }.\n\n📅 **موعد الختم المحسوب بتثبيت:** ${plan.targetCompletionDate}\n💡 **قاعدة الخطة:** ${timeline.pedagogicalNote}`,
          timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
          customWidget: 'result_success',
          widgetData: {
            halaqah: matched,
            mosque: matchedMosque,
            plan,
            student: studentObj
          }
        };
        setMessages(prev => [...prev, resultMsg]);
        setIsTyping(false);
      } else {
        // CASE B: All halaqahs full -> Add to Waiting List!
        const queueNum = (complex.waitingList?.length || 0) + 1;
        const waitingEntry: WaitingListStudent = {
          id: `wait_${Date.now()}_${Math.floor(Math.random() * 9000 + 1000)}`,
          applicationTrackingCode: studentInitialData.trackingCode,
          studentName: studentInitialData.studentName,
          age: studentInitialData.age,
          phone: studentInitialData.phone,
          parentName: studentInitialData.parentName,
          parentPhone: studentInitialData.parentPhone,
          memorizedJuz: memCount,
          consolidatedJuz: consCount,
          tajweedLevel: interviewData.tajweedScore >= 1 ? 'متقدم' : 'متوسط',
          hasIjazah: Boolean(interviewData.hasIjazah),
          dailyNewPace: dailyNew,
          dailyReviewPace: dailyRev,
          queueNumber: queueNum,
          complexId: complex.id,
          complexName: complex.name,
          mosqueId: selectedMosqueId,
          mosqueName: complex.mosques?.find(m => m.id === selectedMosqueId)?.name,
          status: 'waiting',
          notes: `موعد الختم المحسوب بالذكاء الاصطناعي: ${timeline.targetCompletionDate}. في انتظار شاغر أو موافقة المشرف كطالب إضافي.`,
          addedAt: new Date().toISOString()
        };

        setPlacementResult({
          status: 'waiting',
          waitingEntry
        });

        const waitingMsg: ChatMessage = {
          id: 'msg_result_waiting',
          sender: 'ai',
          text: `أهلاً بك يا ${studentInitialData.studentName}. أتممت المقابلة وحصلت على تقدير ممتاز.\n\nنظراً للإقبال الكبير واكتمال السعة الاستيعابية في جميع الحلقات حالياً بمجمع ${complex.name}، تم إدراجك في «قائمة الانتظار الرسمية للمجمع» برقم الدور: #${queueNum}.\n\nبإمكان المشرف مراجعة ملفك والموافقة على قبولك كطالب إضافي فوراً، وسيصلك إشعار بالبريد فور الاعتماد.`,
          timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
          customWidget: 'result_waiting',
          widgetData: {
            waitingEntry
          }
        };
        setMessages(prev => [...prev, waitingMsg]);
        setIsTyping(false);
      }
    }, 1200);
  };

  // Advance conversation turn adaptively based on user answer
  const advanceTurnWithAnswer = async (answerText: string, extraData?: Partial<typeof interviewData>) => {
    // 1. Post user bubble
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: answerText,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMsg]);

    const updatedData = {
      ...interviewData,
      ...extraData,
      userAnswersList: [...interviewData.userAnswersList, answerText]
    };
    setInterviewData(updatedData);

    // 2. Set thoughtful AI thinking state
    setIsTyping(true);
    setTypingMessage('المساعد الذكي يحلل إجابتك بدقة ويفحص أبعادها القرآنية والتربوية...');

    // 3. Call dynamic turn engine
    const nextTurn = turnIndex + 1;
    setTurnIndex(nextTurn);

    try {
      const response: DynamicInterviewResponse = await executeDynamicInterviewTurn({
        studentInitialData,
        complex,
        turnIndex: nextTurn,
        chatHistory: [...messages, userMsg].map(m => ({ sender: m.sender, text: m.text })),
        lastUserAnswer: answerText,
        accumulatedData: updatedData
      });

      setTimeout(() => {
        setIsTyping(false);

        if (response.isCompleted) {
          // Final greeting message
          const finalMsg: ChatMessage = {
            id: `msg_final_${nextTurn}`,
            sender: 'ai',
            text: response.replyText,
            timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
          };
          setMessages(prev => [...prev, finalMsg]);

          // Proceed to mosque selection or direct placement
          if (isMultiMosqueSystem && complex.mosques && complex.mosques.length > 0) {
            askMosqueSelectionQuestion();
          } else {
            performAIPlacementAndPlanCalculation();
          }
        } else {
          // Next adaptive question bubble
          const isSurahPicker = response.nextQuestion?.questionId === 'quran_position_reached' || (response as any).customWidget === 'surah_picker';
          const nextQMsg: ChatMessage = {
            id: `msg_q_${nextTurn}`,
            sender: 'ai',
            text: response.replyText,
            timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
            isQuestion: true,
            questionKey: response.nextQuestion?.questionId || `turn_${nextTurn}`,
            options: response.nextQuestion?.options,
            isLiveTest: response.nextQuestion?.isLiveRecitationTest,
            surahNumber: response.nextQuestion?.surahNumber,
            ayahNumber: response.nextQuestion?.ayahNumber,
            customWidget: isSurahPicker ? 'surah_picker' : undefined
          };
          setMessages(prev => [...prev, nextQMsg]);
        }
      }, 800);
    } catch (e) {
      setIsTyping(false);
      // Fallback: proceed to placement
      performAIPlacementAndPlanCalculation();
    }
  };

  // Handle clicking an option button
  const handleSelectOption = (qKey: string, opt: { label: string; value: any }) => {
    let extra: Partial<typeof interviewData> = {};

    if (opt.value === 'correct') {
      extra.tajweedScore = interviewData.tajweedScore + 1;
    } else if (opt.value === 'from_baqarah' || opt.value === 'from_nas') {
      extra.reviewDirection = opt.value;
    } else if (typeof opt.value === 'number') {
      if (qKey.includes('consolidated') || qKey.includes('cons')) {
        extra.consolidatedCount = opt.value;
      }
    } else if (typeof opt.value === 'object' && opt.value !== null) {
      if (opt.value.newPages !== undefined) {
        extra.dailyNewPages = opt.value.newPages;
        extra.dailyReviewPages = opt.value.reviewPages;
      }
    }

    advanceTurnWithAnswer(opt.label, extra);
  };

  // Handle Quran Surah and Ayah reached confirmation
  const handleSurahPositionSelected = (surahNum: number, ayahNum: number, surahName: string) => {
    const text = `وصلت في سور القرآن الكريم عند: سورة ${surahName} (الآية ${ayahNum})`;
    advanceTurnWithAnswer(text, {
      reachedSurah: surahNum,
      reachedAyah: ayahNum,
      reachedSurahName: surahName
    });
  };

  // Handle free text typed input
  const handleSendCustomInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isTyping) return;
    const text = userInput.trim();
    setUserInput('');
    advanceTurnWithAnswer(text);
  };

  // Mosque selection
  const handleMosqueSelect = (mosque: Mosque) => {
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: `المسجد الأنسب لي هو: جامع «${mosque.name}» (${mosque.address || 'ضمن مساجد المنظومة'})`,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMsg]);
    setInterviewData(prev => ({
      ...prev,
      selectedMosqueId: mosque.id,
      selectedMosqueName: mosque.name
    }));

    performAIPlacementAndPlanCalculation(mosque.id);
  };

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
                  المساعد الذكي لتسكين وتوجيه الطلاب
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#fbbf24] text-[#064e3b]">
                  حوار تكيفي حي
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
            className="text-xs text-white/60 hover:text-white px-3 py-1.5 rounded-xl border border-white/10 hover:border-white/30 transition-all cursor-pointer"
          >
            إغلاق
          </button>
        </div>

        {/* Chat Messages Body */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-gradient-to-b from-[#022c22] via-[#01221a] to-[#022c22]">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-[92%] sm:max-w-[85%] ${
                msg.sender === 'user' ? 'mr-auto flex-row-reverse' : 'ml-auto flex-row'
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                  msg.sender === 'ai'
                    ? 'bg-[#fbbf24] text-[#064e3b]'
                    : 'bg-emerald-700 text-white'
                }`}
              >
                {msg.sender === 'ai' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>

              {/* Message Content Bubble */}
              <div className="space-y-3 flex-1">
                <div
                  className={`rounded-2xl p-4 text-xs sm:text-sm leading-relaxed whitespace-pre-line shadow-md ${
                    msg.sender === 'ai'
                      ? 'bg-[#064e3b]/90 text-[#f0fdf4] border border-[#065f46] rounded-tr-none'
                      : 'bg-[#fbbf24] text-[#064e3b] font-bold rounded-tl-none shadow-amber-500/20'
                  }`}
                >
                  {msg.text}
                </div>

                {/* Live Ayah Recitation Test Box */}
                {msg.isLiveTest && (
                  <div className="p-3.5 rounded-2xl bg-black/30 border border-amber-400/40 text-amber-200 text-xs flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
                      <Mic className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-white block">فحص الاستحضار المباشر للآيات:</span>
                      <span className="text-[11px] text-[#86efac]">
                        بإمكانك كتابة بداية الآية في صندوق الرد بالأسفل أو اختيار الجاهزية مباشرة
                      </span>
                    </div>
                  </div>
                )}

                {/* Question Interactive Options */}
                {msg.options && msg.options.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {msg.options.map((opt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSelectOption(msg.questionKey || '', opt)}
                        className="text-right p-3 rounded-2xl bg-[#064e3b] hover:bg-[#065f46] border border-[#065f46] hover:border-[#fbbf24] text-white text-xs font-bold transition-all shadow-md cursor-pointer flex flex-col gap-1 active:scale-[0.98]"
                      >
                        <span className="font-black text-[#fbbf24]">{opt.label}</span>
                        {opt.subtext && <span className="text-[11px] text-white/70 font-normal">{opt.subtext}</span>}
                      </button>
                    ))}
                  </div>
                )}

                {/* Custom Widget: Quran Surah & Ayah Reached Picker */}
                {msg.customWidget === 'surah_picker' && (
                  <div className="pt-2">
                    <QuranPositionReachedPicker
                      initialSurah={interviewData.reachedSurah || (studentInitialData.memorizedJuzList?.length >= 30 ? 2 : 78)}
                      initialAyah={interviewData.reachedAyah || 1}
                      onConfirm={handleSurahPositionSelected}
                    />
                  </div>
                )}

                {/* Custom Widget: Mosque Selection */}
                {msg.customWidget === 'mosque_selector' && msg.widgetData?.mosques && (
                  <div className="space-y-2 pt-1">
                    {msg.widgetData.mosques.map((m: Mosque) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleMosqueSelect(m)}
                        className="w-full text-right p-3.5 rounded-2xl bg-[#064e3b] hover:bg-[#065f46] border border-[#065f46] hover:border-[#fbbf24] transition-all flex items-center justify-between gap-3 text-white cursor-pointer shadow-md group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-[#022c22] text-[#fbbf24] flex items-center justify-center shrink-0">
                            <Compass className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs sm:text-sm font-black text-white group-hover:text-[#fbbf24]">
                              {m.name}
                            </p>
                            <p className="text-[11px] text-white/70">{m.address || 'ضمن مساجد المنظومة القرآنية'}</p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 rounded-xl bg-[#fbbf24] text-[#064e3b] text-xs font-black shrink-0">
                          اختيار المسجد
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Custom Widget: Placement Success Card */}
                {msg.customWidget === 'result_success' && msg.widgetData && (
                  <PlacementSuccessCard
                    data={msg.widgetData}
                    onConfirm={() => {
                      if (msg.widgetData.student) {
                        onPlacementSuccess(msg.widgetData.student);
                      }
                    }}
                  />
                )}

                {/* Custom Widget: Waiting List Card */}
                {msg.customWidget === 'result_waiting' && msg.widgetData && (
                  <WaitingListCard
                    waitingEntry={msg.widgetData.waitingEntry}
                    onConfirm={() => {
                      if (msg.widgetData.waitingEntry) {
                        onWaitingListAdded(msg.widgetData.waitingEntry);
                      }
                    }}
                  />
                )}
              </div>
            </div>
          ))}

          {/* Typing & Thinking Indicator */}
          {isTyping && (
            <div className="flex items-center gap-2.5 text-xs text-[#86efac] p-3 rounded-2xl bg-[#064e3b]/40 border border-[#065f46] animate-pulse">
              <Bot className="w-4 h-4 animate-bounce text-[#fbbf24] shrink-0" />
              <span>{typingMessage}</span>
            </div>
          )}
        </div>

        {/* Interactive Chat Input Form (For free text and custom dynamic answers) */}
        {!placementResult.status && (
          <form
            onSubmit={handleSendCustomInput}
            className="p-3 bg-[#064e3b] border-t border-[#065f46] flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              placeholder="اكتب إجابتك أو استفسارك هنا للمساعد الذكي..."
              disabled={isTyping}
              className="flex-1 bg-[#022c22] border border-[#065f46] focus:border-[#fbbf24] rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-400 outline-none transition-all font-bold disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!userInput.trim() || isTyping}
              className="p-2.5 sm:px-4 sm:py-2.5 rounded-2xl bg-[#fbbf24] hover:bg-amber-400 disabled:opacity-40 text-[#064e3b] font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95 shrink-0"
              title="إرسال الإجابة"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">إرسال</span>
            </button>
          </form>
        )}

        {/* Footer info banner */}
        <div className="bg-[#022c22] border-t border-[#065f46] px-5 py-2.5 flex items-center justify-between text-[11px] text-[#86efac]/70">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#fbbf24]" />
            <span>نظام التسكين الذكي والخرائط التثبيتية التكيفية • مدعوم بالذكاء الاصطناعي</span>
          </div>
          <span>منظومة عمران القرآنية</span>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------------------
// Subcomponent: Placement Success Card
// -------------------------------------------------------------------------
interface PlacementSuccessCardProps {
  data: {
    halaqah: Halaqah;
    mosque?: Mosque;
    plan: StudentMemorizationPlan;
    student: Student;
  };
  onConfirm: () => void;
}

const PlacementSuccessCard: React.FC<PlacementSuccessCardProps> = ({ data, onConfirm }) => {
  const { halaqah, mosque, plan, student } = data;

  return (
    <div className="p-5 rounded-3xl bg-gradient-to-b from-[#064e3b] to-[#022c22] border-2 border-[#fbbf24] shadow-2xl space-y-4 text-white">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-[#fbbf24] text-[#064e3b] flex items-center justify-center shrink-0 shadow-lg">
          <Award className="w-6 h-6" />
        </div>
        <div>
          <h4 className="font-heading font-black text-base text-[#fbbf24]">
            بطاقة القبول والتسكين الرسمي
          </h4>
          <p className="text-xs text-[#86efac]">تم التسكين بنجاح في الحلقة والمسجد المعتمد</p>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-2xl bg-[#022c22] border border-[#065f46] space-y-1">
          <span className="text-white/60">الحلقة المعتمدة:</span>
          <p className="font-black text-[#fbbf24] text-sm">{halaqah.name}</p>
          <p className="text-[11px] text-white/70">المعلم: {halaqah.primaryTeacherName || 'معلم الحلقة'}</p>
        </div>

        <div className="p-3 rounded-2xl bg-[#022c22] border border-[#065f46] space-y-1">
          <span className="text-white/60">المسجد والجامع:</span>
          <p className="font-black text-white text-sm">{mosque?.name || halaqah.complexName || 'جامع المنظومة'}</p>
          <div className="flex items-center gap-1 text-[11px] text-[#86efac]">
            <MapPin className="w-3 h-3 text-[#fbbf24]" />
            <span>{mosque?.address || 'الموقع محدد رسمياً على الخريطة'}</span>
          </div>
        </div>
      </div>

      {/* Smart Plan Summary Banner */}
      <div className="p-3.5 rounded-2xl bg-[#fbbf24]/10 border border-[#fbbf24]/30 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-black text-[#fbbf24] flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" />
            خطة التثبيت والختم التكيفية
          </span>
          <span className="px-2 py-0.5 rounded-lg bg-[#fbbf24] text-[#064e3b] font-black text-[10px]">
            {plan.progressPercentage}% منجز
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-[#022c22] rounded-full h-2.5 overflow-hidden border border-[#065f46]">
          <div
            className="bg-gradient-to-r from-emerald-400 to-[#fbbf24] h-full rounded-full transition-all duration-700"
            style={{ width: `${plan.progressPercentage}%` }}
          ></div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-white/80 pt-1">
          <span>الورد اليومي: {plan.dailyNewPages} جديد + {plan.dailyReviewPages} مراجعة</span>
          <span className="font-bold text-amber-200">الختم المتوقع: {plan.targetCompletionDate}</span>
        </div>
      </div>

      {/* Direct Enter Button */}
      <button
        type="button"
        onClick={onConfirm}
        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#fbbf24] via-amber-400 to-[#fbbf24] hover:brightness-110 text-[#064e3b] font-black text-sm shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
      >
        <CheckCircle2 className="w-5 h-5 text-[#064e3b]" />
        <span>تَمْ • الدخول المباشر إلى واجهة الطالب وبدء الحفظ</span>
      </button>
    </div>
  );
};

// -------------------------------------------------------------------------
// Subcomponent: Waiting List Card
// -------------------------------------------------------------------------
interface WaitingListCardProps {
  waitingEntry: WaitingListStudent;
  onConfirm: () => void;
}

const WaitingListCard: React.FC<WaitingListCardProps> = ({ waitingEntry, onConfirm }) => {
  return (
    <div className="p-5 rounded-3xl bg-gradient-to-b from-[#064e3b] to-[#022c22] border-2 border-amber-400/80 shadow-2xl space-y-4 text-white">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-amber-400 text-[#064e3b] flex items-center justify-center shrink-0 shadow-lg">
          <Clock className="w-6 h-6 animate-spin" />
        </div>
        <div>
          <h4 className="font-heading font-black text-base text-amber-300">
            بطاقة قائمة الانتظار المعتمدة
          </h4>
          <p className="text-xs text-white/70">نظراً لاكتمال سعة الحلقات (تعبئة كاملة)</p>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-[#022c22] border border-[#065f46] space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-white/70">رقمك في قائمة الانتظار:</span>
          <span className="text-base font-black text-[#fbbf24] font-mono">
            #{waitingEntry.queueNumber}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/70">كود متابعة الطلب:</span>
          <span className="font-mono text-white font-bold">{waitingEntry.applicationTrackingCode}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-white/70">المجمع المنشود:</span>
          <span className="text-white font-bold">{waitingEntry.complexName}</span>
        </div>
        {waitingEntry.mosqueName && (
          <div className="flex items-center justify-between">
            <span className="text-white/70">المسجد المفضل:</span>
            <span className="text-amber-200 font-bold">{waitingEntry.mosqueName}</span>
          </div>
        )}
      </div>

      <p className="text-[11px] text-white/70 leading-relaxed">
        💡 تم إشعار المشرف العام للتحقق من إمكانية فتح مقعد إضافي لك أو قبولك فور توفر أول شاغر.
      </p>

      <button
        type="button"
        onClick={onConfirm}
        className="w-full py-3 rounded-2xl bg-[#064e3b] hover:bg-[#065f46] border border-[#fbbf24] text-[#fbbf24] font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
      >
        <span>حفظ بيانات الانتظار والعودة للبوابة</span>
      </button>
    </div>
  );
};

// -------------------------------------------------------------------------
// Subcomponent: Quran Position Reached Searchable Dropdown & Ayah Picker
// -------------------------------------------------------------------------
interface QuranPositionReachedPickerProps {
  initialSurah?: number;
  initialAyah?: number;
  onConfirm: (surahNumber: number, ayahNumber: number, surahName: string) => void;
}

const QuranPositionReachedPicker: React.FC<QuranPositionReachedPickerProps> = ({
  initialSurah = 78,
  initialAyah = 1,
  onConfirm
}) => {
  const [search, setSearch] = useState('');
  const [selectedSurah, setSelectedSurah] = useState<number>(initialSurah);
  const [selectedAyah, setSelectedAyah] = useState<number>(initialAyah);

  const curSurahInfo = useMemo(() => getSurahInfo(selectedSurah), [selectedSurah]);

  const filteredSurahs = useMemo(() => {
    if (!search.trim()) return QURAN_SURAHS;
    const clean = search.trim();
    return QURAN_SURAHS.filter(s =>
      s.name.includes(clean) ||
      s.number.toString() === clean ||
      s.englishName.toLowerCase().includes(clean.toLowerCase())
    );
  }, [search]);

  const maxAyahs = curSurahInfo.numberOfAyahs;

  const handleSurahChange = (sNum: number) => {
    setSelectedSurah(sNum);
    setSelectedAyah(1);
  };

  const handleAyahChange = (val: number) => {
    const clamped = Math.max(1, Math.min(maxAyahs, val));
    setSelectedAyah(clamped);
  };

  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-[#022c22] border-2 border-amber-400/60 shadow-2xl space-y-3.5 text-white animate-fadeIn" dir="rtl">
      <div className="flex items-center gap-2.5 border-b border-[#065f46] pb-2.5">
        <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center font-bold">
          <BookOpen className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-xs sm:text-sm font-black text-amber-300">
            حدد أين وصلت في سور القرآن الكريم بدقة:
          </h4>
          <p className="text-[11px] text-[#86efac]/80">
            اختر السورة والآية التي تقف عندها من قائمة سور القرآن الكريم الـ ١١٤
          </p>
        </div>
      </div>

      {/* Surah Search & Select */}
      <div className="space-y-1.5">
        <label className="text-[11px] text-[#86efac] font-bold block">
          البحث في سور القرآن الكريم الـ ١١٤:
        </label>
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ابحث باسم السورة (مثلاً: البقرة، الكهف، يس، النبأ، الملك...)"
            className="w-full bg-[#064e3b] border border-[#065f46] focus:border-[#fbbf24] rounded-2xl py-2 px-3.5 pr-9 text-xs text-white placeholder-slate-400 outline-none font-bold shadow-inner"
          />
          <Search className="w-4 h-4 text-amber-300 absolute right-3 top-2.5" />
        </div>

        {/* Dropdown Select with All 114 Surahs */}
        <select
          value={selectedSurah}
          onChange={e => handleSurahChange(Number(e.target.value))}
          className="w-full bg-[#064e3b] border border-[#065f46] focus:border-[#fbbf24] text-amber-300 font-bold rounded-2xl py-2.5 px-3 text-xs outline-none cursor-pointer shadow-md"
        >
          {filteredSurahs.map(s => (
            <option key={s.number} value={s.number} className="bg-[#022c22] text-white">
              {s.number}. سورة {s.name} ({s.numberOfAyahs} آية - جزء {s.juz} - {s.revelationType})
            </option>
          ))}
        </select>
      </div>

      {/* Selected Surah Badge Info */}
      <div className="p-3 rounded-2xl bg-black/30 border border-[#065f46] flex items-center justify-between text-xs">
        <div>
          <span className="font-black text-white text-sm">سورة {curSurahInfo.name}</span>
          <span className="text-[11px] text-[#86efac] block">
            الجزء {curSurahInfo.juz} • {curSurahInfo.revelationType} • عدد آياتها {curSurahInfo.numberOfAyahs}
          </span>
        </div>
        <span className="px-2.5 py-1 rounded-xl bg-amber-400/20 text-amber-300 font-bold text-xs border border-amber-400/40">
          السورة رقم {curSurahInfo.number}
        </span>
      </div>

      {/* Ayah Input & Presets */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-[#86efac] font-bold">
          <span>الآية التي وصلت إليها:</span>
          <span className="text-amber-300 font-mono font-black">(من 1 إلى {maxAyahs})</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleAyahChange(selectedAyah - 1)}
            disabled={selectedAyah <= 1}
            className="w-9 h-9 rounded-xl bg-[#064e3b] hover:bg-[#065f46] disabled:opacity-30 text-white font-black text-base flex items-center justify-center border border-[#065f46] cursor-pointer"
          >
            -
          </button>
          <input
            type="number"
            min={1}
            max={maxAyahs}
            value={selectedAyah}
            onChange={e => handleAyahChange(Number(e.target.value))}
            className="flex-1 bg-[#064e3b] border border-[#065f46] focus:border-[#fbbf24] text-center font-black text-amber-300 text-sm py-2 rounded-xl outline-none"
          />
          <button
            type="button"
            onClick={() => handleAyahChange(selectedAyah + 1)}
            disabled={selectedAyah >= maxAyahs}
            className="w-9 h-9 rounded-xl bg-[#064e3b] hover:bg-[#065f46] disabled:opacity-30 text-white font-black text-base flex items-center justify-center border border-[#065f46] cursor-pointer"
          >
            +
          </button>
        </div>

        {/* Quick Ayah Presets */}
        <div className="flex items-center gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => handleAyahChange(1)}
            className="flex-1 py-1 px-2 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] text-slate-300 font-bold border border-white/10 cursor-pointer"
          >
            بداية السورة (آية 1)
          </button>
          <button
            type="button"
            onClick={() => handleAyahChange(Math.round(maxAyahs / 2))}
            className="flex-1 py-1 px-2 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] text-slate-300 font-bold border border-white/10 cursor-pointer"
          >
            المنتصف (آية {Math.round(maxAyahs / 2)})
          </button>
          <button
            type="button"
            onClick={() => handleAyahChange(maxAyahs)}
            className="flex-1 py-1 px-2 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] text-slate-300 font-bold border border-white/10 cursor-pointer"
          >
            خاتمة السورة (آية {maxAyahs})
          </button>
        </div>
      </div>

      {/* Confirmation Action */}
      <button
        type="button"
        onClick={() => onConfirm(curSurahInfo.number, selectedAyah, curSurahInfo.name)}
        className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-400 to-[#fbbf24] hover:brightness-110 text-[#064e3b] font-black text-xs sm:text-sm cursor-pointer shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
      >
        <Check className="w-4 h-4 stroke-[3]" />
        <span>تأكيد الوصول عند: سورة {curSurahInfo.name} (الآية {selectedAyah}) ➔</span>
      </button>
    </div>
  );
};

