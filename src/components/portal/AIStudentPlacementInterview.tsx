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
  Check
} from 'lucide-react';
import {
  Student,
  Halaqah,
  QuranComplex,
  Mosque,
  WaitingListStudent,
  StudentMemorizationPlan
} from '../../types';
import { OmranDataService } from '../../lib/firebase';

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
  customWidget?: 'tajweed_quiz' | 'juz_selector' | 'pace_selector' | 'mosque_selector' | 'result_success' | 'result_waiting';
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
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [isTyping, setIsTyping] = useState<boolean>(true);
  const [userInput, setUserInput] = useState<string>('');
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Collected student answers during AI interview
  const [interviewData, setInterviewData] = useState<{
    memorizedCount: number;
    consolidatedCount: number;
    tajweedScore: number;
    tajweedAnswers: Record<string, string>;
    hasIjazah: boolean;
    goal: string;
    dailyNewPages: number;
    dailyReviewPages: number;
    selectedMosqueId?: string;
    selectedMosqueName?: string;
  }>({
    memorizedCount: studentInitialData.memorizedJuzList.length || 1,
    consolidatedCount: Math.max(0, (studentInitialData.memorizedJuzList.length || 1) - 2),
    tajweedScore: 0,
    tajweedAnswers: {},
    hasIjazah: false,
    goal: 'ختم القرآن الكريم وتثبيته كاملاً',
    dailyNewPages: 1,
    dailyReviewPages: 5
  });

  const [placementResult, setPlacementResult] = useState<{
    status: 'success' | 'waiting' | null;
    matchedHalaqah?: Halaqah;
    matchedMosque?: Mosque;
    waitingEntry?: WaitingListStudent;
    generatedPlan?: StudentMemorizationPlan;
    newStudent?: Student;
  }>({ status: null });

  // Auto scroll to bottom of chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isTyping]);

  // Initial welcome and greeting from AI
  useEffect(() => {
    const timer = setTimeout(() => {
      const welcomeMsg: ChatMessage = {
        id: 'msg_welcome',
        sender: 'ai',
        text: `أهلاً وسهلاً بك يا ${studentInitialData.studentName} (عمرك ${studentInitialData.age} سنة) في مجمع ${complex.name}! 🌟\n\nأنا «المساعد الذكي لتسكين وتوجيه الطلاب». مهمتي هي إجراء مقابلة تحديد مستوى تفاعلية معك لفحص جودة حفظك وتجويدك، والبحث الذكي عن الحلقة والمسجد والشيخ الأنسب لمستواك، ثم رسم خطة يومية ذكية مخصصة لك حتى الختم والتثبيت.`,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages([welcomeMsg]);
      setIsTyping(false);

      // Follow up with question 1
      setTimeout(() => {
        askConsolidatedJuzQuestion();
      }, 900);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  // 1. Question: Consolidated Juz Count
  const askConsolidatedJuzQuestion = () => {
    setIsTyping(true);
    setTimeout(() => {
      const memCount = studentInitialData.memorizedJuzList.length || 1;
      const qMsg: ChatMessage = {
        id: 'msg_q_juz',
        sender: 'ai',
        text: `ما شاء الله، سَجلتَ أنك تحفظ ${memCount} جزءاً من القرآن الكريم.\n\nمن بين هذه الأجزاء، ما هو عدد «الأجزاء المُثبَّتة» والمتقنة تماماً لديك بنسبة إتقان عالية؟`,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        isQuestion: true,
        questionKey: 'consolidated_juz',
        customWidget: 'juz_selector',
        widgetData: {
          totalMemorized: memCount
        }
      };
      setMessages(prev => [...prev, qMsg]);
      setIsTyping(false);
      setCurrentStep(1);
    }, 700);
  };

  // 2. Question: Tajweed Assessment (3 graded questions)
  const askTajweedQuestion1 = () => {
    setIsTyping(true);
    setTimeout(() => {
      const qMsg: ChatMessage = {
        id: 'msg_q_tajweed_1',
        sender: 'ai',
        text: `ممتاز! ننتقل الآن لفحص إتقانك لأحكام التجويد (سؤال 1 من 3 - المستوى التأسيسي):\n\nفي قوله تعالى: ﴿وَمَن يَقُولُ﴾، ما هو حكم النون الساكنة هنا؟`,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        isQuestion: true,
        questionKey: 'tajweed_1',
        options: [
          { label: 'إدغام بغنة (ناقص)', value: 'correct', subtext: 'الياء من حروف ينمو' },
          { label: 'إظهار حلقي', value: 'wrong', subtext: 'ليس من حروف الحلق' },
          { label: 'إقلاب', value: 'wrong', subtext: 'ليس حرف باء' }
        ]
      };
      setMessages(prev => [...prev, qMsg]);
      setIsTyping(false);
      setCurrentStep(2);
    }, 700);
  };

  const askTajweedQuestion2 = () => {
    setIsTyping(true);
    setTimeout(() => {
      const qMsg: ChatMessage = {
        id: 'msg_q_tajweed_2',
        sender: 'ai',
        text: `أحسنت! السؤال الثاني (المستوى المتوسط):\n\nفي قوله تعالى: ﴿فَإِذَا جَاءَتِ الصَّاخَّةُ﴾، ما نوع المد في كلمة (الصَّاخَّةُ) وكم مقدار مده لزوماً؟`,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        isQuestion: true,
        questionKey: 'tajweed_2',
        options: [
          { label: 'مد لازم كَلِمي مُثقَّل (٦ حركات)', value: 'correct', subtext: 'جاء بعد حرف المد حرف مشدد' },
          { label: 'مد واجب متصل (٤ أو ٥ حركات)', value: 'wrong', subtext: 'ليس بعده همز في كلمة' },
          { label: 'مد عارض للسكون (٢ أو ٤ أو ٦)', value: 'wrong', subtext: 'حكمه غير عارض' }
        ]
      };
      setMessages(prev => [...prev, qMsg]);
      setIsTyping(false);
      setCurrentStep(3);
    }, 700);
  };

  const askTajweedQuestion3 = () => {
    setIsTyping(true);
    setTimeout(() => {
      const qMsg: ChatMessage = {
        id: 'msg_q_tajweed_3',
        sender: 'ai',
        text: `بارَكَ الله فيك! السؤال الثالث (المستوى المتقدم الدقيق):\n\nفي قوله تعالى بسورة الأعراف: ﴿يَلْهَث ذَّٰلِكَ﴾، ما هو الحكم التجويدي المعمول به بين حرفي (الثاء) و(الذال)؟`,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        isQuestion: true,
        questionKey: 'tajweed_3',
        options: [
          { label: 'إدغام متجانسين صغير', value: 'correct', subtext: 'اتفقا في المخرج واختلفا في بعض الصفات' },
          { label: 'إظهار مطلق', value: 'wrong', subtext: 'لا يجوز الإظهار هنا في الرواية' },
          { label: 'إدغام متقاربين كبير', value: 'wrong', subtext: 'الحرف الأول ساكن فليس بكبير' }
        ]
      };
      setMessages(prev => [...prev, qMsg]);
      setIsTyping(false);
      setCurrentStep(4);
    }, 700);
  };

  // 3. Question: Ijazah in Quran
  const askIjazahQuestion = () => {
    setIsTyping(true);
    setTimeout(() => {
      const qMsg: ChatMessage = {
        id: 'msg_q_ijazah',
        sender: 'ai',
        text: `سؤال هام يتعلق بمسيرتك القرآنية:\n\nهل حصلت على إجازة قرآنية مسندة أو سند متصل إلى رسول الله ﷺ برواية حفص عن عاصم أو إحدى القراءات؟`,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        isQuestion: true,
        questionKey: 'ijazah',
        options: [
          { label: 'نعم، أحمل إجازة قرآنية مسندة', value: true, subtext: 'إجازة معتمدة بسند متصل' },
          { label: 'لا، لم أحصل على إجازة بعد', value: false, subtext: 'طالب علم راغب في الإتقان' },
          { label: 'أنا في طور الإعداد وعرض الختمة', value: 'in_progress', subtext: 'قارئ في مرحلة السند' }
        ]
      };
      setMessages(prev => [...prev, qMsg]);
      setIsTyping(false);
      setCurrentStep(5);
    }, 700);
  };

  // 4. Question: Target & Daily Pace (New and Review pages)
  const askPaceAndGoalQuestion = () => {
    setIsTyping(true);
    setTimeout(() => {
      const qMsg: ChatMessage = {
        id: 'msg_q_pace',
        sender: 'ai',
        text: `رائع جداً! الآن لنحدد معاً خطتك التثبيتية اليومية:\n\nما هو هدفك المنشود في الحلقة، وكم وجهاً جديداً وكم وجه مراجعة تستطيع تسميعه يومياً؟`,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        isQuestion: true,
        questionKey: 'pace',
        customWidget: 'pace_selector'
      };
      setMessages(prev => [...prev, qMsg]);
      setIsTyping(false);
      setCurrentStep(6);
    }, 700);
  };

  // 5. Question: Mosque Selection (Only if multi-mosque system)
  const isMultiMosqueSystem = useMemo(() => {
    return complex.complexType === 'multi_mosque_system' || (complex.mosques && complex.mosques.length > 1);
  }, [complex]);

  const askMosqueSelectionQuestion = () => {
    if (!isMultiMosqueSystem || !complex.mosques || complex.mosques.length === 0) {
      // Single complex: skip straight to AI placement matching!
      performAIPlacementAndPlanCalculation();
      return;
    }

    setIsTyping(true);
    setTimeout(() => {
      const qMsg: ChatMessage = {
        id: 'msg_q_mosque',
        sender: 'ai',
        text: `بما أن مجمع «${complex.name}» يُمثّل «منظومة قرآنية متكاملة» تضم عدة مساجد وجوامع تابعة:\n\nأيّ الجوامع الآتية هو الأقرب إلى منزلك وسكنك؟ سنبحث لك عن حلقة بها شاغر في هذا المسجد:`,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        isQuestion: true,
        questionKey: 'mosque',
        customWidget: 'mosque_selector',
        widgetData: {
          mosques: complex.mosques
        }
      };
      setMessages(prev => [...prev, qMsg]);
      setIsTyping(false);
      setCurrentStep(7);
    }, 700);
  };

  // Perform AI Matching, Capacity Checking, and Roadmap Generation
  const performAIPlacementAndPlanCalculation = (selectedMosqueId?: string) => {
    setIsTyping(true);
    setTimeout(() => {
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
      // For legacy halaqahs without capacity: capacity default is 15
      const availableHalaqahs = candidateHalaqahs.filter(h => {
        const cap = h.capacity && h.capacity > 0 ? h.capacity : 15;
        const currentCount = halaqahStudentCounts.get(h.id) || 0;
        return currentCount < cap;
      });

      // 3. Calculate Dynamic Memorization & Revision Plan
      const totalPagesInQuran = 604;
      const memPages = (interviewData.memorizedCount || 1) * 20;
      const remainingPages = Math.max(20, totalPagesInQuran - memPages);
      const pace = Math.max(1, interviewData.dailyNewPages);
      const daysToFinish = Math.ceil(remainingPages / pace);

      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + daysToFinish);
      const targetDateStr = targetDate.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      const plan: StudentMemorizationPlan = {
        dailyNewPages: interviewData.dailyNewPages,
        dailyReviewPages: interviewData.dailyReviewPages,
        consolidatedJuzCount: interviewData.consolidatedCount,
        memorizedJuzCount: interviewData.memorizedCount,
        targetJuz: 30,
        targetCompletionDate: targetDateStr,
        estimatedDaysRemaining: daysToFinish,
        progressPercentage: Math.min(100, Math.round((memPages / totalPagesInQuran) * 100)),
        status: 'on_track',
        lastUpdated: new Date().toISOString()
      };

      if (availableHalaqahs.length > 0) {
        // CASE A: Available Halaqah Found!
        const matched = availableHalaqahs[0];
        const matchedMosque = complex.mosques?.find(m => m.id === matched.mosqueId || m.id === selectedMosqueId);

        // Build complete Student record
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
          currentSurah: 1,
          currentSurahName: 'الفاتحة',
          currentAyah: 1,
          dailyNewTarget: `${interviewData.dailyNewPages} وجه يومياً`,
          dailyReviewTarget: `${interviewData.dailyReviewPages} وجه يومياً`,
          level: interviewData.tajweedScore >= 2 ? 'متميز' : 'متوسط',
          complexId: complex.id,
          complexName: complex.name,
          halaqahId: matched.id,
          halaqahName: matched.name,
          assignedMosqueId: matchedMosque?.id,
          assignedMosqueName: matchedMosque?.name,
          memorizationPlan: plan,
          mushafErrors: [],
          notes: studentInitialData.notes || 'تم التسكين والاختبار عبر المساعد الذكي',
          createdAt: new Date().toISOString()
        };

        setPlacementResult({
          status: 'success',
          matchedHalaqah: matched,
          matchedMosque,
          generatedPlan: plan,
          newStudent: studentObj
        });

        // Add result message to chat
        const resultMsg: ChatMessage = {
          id: 'msg_result_success',
          sender: 'ai',
          text: `🎉 مبارك يا ${studentInitialData.studentName}! أتممت مقابلة تحديد المستوى بنجاح باهر!\n\nبناءً على نتائجك، وجدنا لك شاغراً مناسباً لمستواك في: «${matched.name}» ${
            matchedMosque ? `بجامع «${matchedMosque.name}»` : ''
          }.\n\nتم رسم خطتك التثبيتية الذكية بمعدل ${plan.dailyNewPages} وجه جديد و${plan.dailyReviewPages} أوجه مراجعة يومياً، والختم المتوقع بإذن الله في: ${plan.targetCompletionDate}.`,
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
          memorizedJuz: interviewData.memorizedCount,
          consolidatedJuz: interviewData.consolidatedCount,
          tajweedLevel: interviewData.tajweedScore >= 2 ? 'متقدم' : 'متوسط',
          hasIjazah: Boolean(interviewData.hasIjazah),
          dailyNewPace: interviewData.dailyNewPages,
          dailyReviewPace: interviewData.dailyReviewPages,
          queueNumber: queueNum,
          complexId: complex.id,
          complexName: complex.name,
          mosqueId: selectedMosqueId,
          mosqueName: complex.mosques?.find(m => m.id === selectedMosqueId)?.name,
          status: 'waiting',
          addedAt: new Date().toISOString()
        };

        setPlacementResult({
          status: 'waiting',
          waitingEntry
        });

        const waitingMsg: ChatMessage = {
          id: 'msg_result_waiting',
          sender: 'ai',
          text: `أهلاً بك يا ${studentInitialData.studentName}. لقد أتممت المقابلة وحصلت على تقدير ممتاز.\n\nنظراً للإقبال الكبير واكتمال السعة الاستيعابية في جميع الحلقات المناسبة حالياً في ${complex.name}، تم إدراجك في «قائمة الانتظار الرسمية للمجمع» بالرقم: #${queueNum}.\n\nسيتم إشعار ولي الأمر هاتفياً وعبر البريد الإلكتروني فور توفر مقعد شاغر لك.`,
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

  // Handle user selecting an option
  const handleSelectOption = (qKey: string, opt: { label: string; value: any }) => {
    // 1. Post user response bubble
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: opt.label,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMsg]);

    // 2. Process based on question key
    if (qKey === 'tajweed_1') {
      const isCorrect = opt.value === 'correct';
      if (isCorrect) {
        setInterviewData(prev => ({
          ...prev,
          tajweedScore: prev.tajweedScore + 1,
          tajweedAnswers: { ...prev.tajweedAnswers, q1: opt.label }
        }));
      }
      setTimeout(() => askTajweedQuestion2(), 500);
    } else if (qKey === 'tajweed_2') {
      const isCorrect = opt.value === 'correct';
      if (isCorrect) {
        setInterviewData(prev => ({
          ...prev,
          tajweedScore: prev.tajweedScore + 1,
          tajweedAnswers: { ...prev.tajweedAnswers, q2: opt.label }
        }));
      }
      setTimeout(() => askTajweedQuestion3(), 500);
    } else if (qKey === 'tajweed_3') {
      const isCorrect = opt.value === 'correct';
      if (isCorrect) {
        setInterviewData(prev => ({
          ...prev,
          tajweedScore: prev.tajweedScore + 1,
          tajweedAnswers: { ...prev.tajweedAnswers, q3: opt.label }
        }));
      }
      setTimeout(() => askIjazahQuestion(), 500);
    } else if (qKey === 'ijazah') {
      setInterviewData(prev => ({ ...prev, hasIjazah: Boolean(opt.value) }));
      setTimeout(() => askPaceAndGoalQuestion(), 500);
    }
  };

  // Submit consolidated juz selector widget
  const handleConsolidatedJuzSubmit = (val: number) => {
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: `أحفظ ${studentInitialData.memorizedJuzList.length || 1} جزءاً، والأجزاء المثبتة لدي هي ${val} جزءاً.`,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMsg]);
    setInterviewData(prev => ({
      ...prev,
      consolidatedCount: val,
      memorizedCount: studentInitialData.memorizedJuzList.length || 1
    }));
    setTimeout(() => askTajweedQuestion1(), 600);
  };

  // Submit pace selector widget
  const handlePaceSubmit = (newPages: number, revPages: number, goalText: string) => {
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: `هدفي: ${goalText} • بمعدل ${newPages} وجه جديد و${revPages} أوجه مراجعة يومياً.`,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMsg]);
    setInterviewData(prev => ({
      ...prev,
      dailyNewPages: newPages,
      dailyReviewPages: revPages,
      goal: goalText
    }));

    if (isMultiMosqueSystem && complex.mosques && complex.mosques.length > 0) {
      setTimeout(() => askMosqueSelectionQuestion(), 600);
    } else {
      setTimeout(() => performAIPlacementAndPlanCalculation(), 600);
    }
  };

  // Submit mosque selector widget
  const handleMosqueSelect = (mosque: Mosque) => {
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: `المسجد الأقرب لي هو: ${mosque.name} (${mosque.address || 'ضمن المنظومة'})`,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMsg]);
    setInterviewData(prev => ({
      ...prev,
      selectedMosqueId: mosque.id,
      selectedMosqueName: mosque.name
    }));

    setTimeout(() => performAIPlacementAndPlanCalculation(mosque.id), 600);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md select-none" dir="rtl">
      <div className="w-full max-w-3xl bg-[#022c22] border-2 border-[#fbbf24]/50 rounded-3xl shadow-2xl flex flex-col h-[90vh] max-h-[820px] overflow-hidden">
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
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fbbf24] text-[#064e3b]">
                  مقابلة فورية
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
            إلغاء
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

                {/* Custom Widget: Consolidated Juz Selector */}
                {msg.customWidget === 'juz_selector' && (
                  <div className="p-4 rounded-2xl bg-[#064e3b]/80 border border-[#fbbf24]/40 space-y-3">
                    <p className="text-xs text-amber-200 font-bold">
                      اختر عدد الأجزاء المتقنة المثبتة (من 0 إلى {msg.widgetData?.totalMemorized}):
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: Math.min(31, (msg.widgetData?.totalMemorized || 1) + 1) }).map((_, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleConsolidatedJuzSubmit(idx)}
                          className="w-10 h-10 rounded-xl bg-[#022c22] hover:bg-[#fbbf24] hover:text-[#064e3b] text-white font-mono font-bold text-xs border border-[#065f46] transition-all cursor-pointer shadow-sm flex items-center justify-center active:scale-95"
                        >
                          {idx}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Widget: Pace & Daily Goals Selector */}
                {msg.customWidget === 'pace_selector' && (
                  <PaceSelectorWidget onSubmit={handlePaceSubmit} />
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

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex items-center gap-2.5 text-xs text-[#86efac]/80 p-2">
              <Bot className="w-4 h-4 animate-bounce text-[#fbbf24]" />
              <span>المساعد الذكي يحلل إجاباتك ويجهز التوجيه المناسب...</span>
            </div>
          )}
        </div>

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
// Subcomponent: Pace & Goal Selector Widget
// -------------------------------------------------------------------------
interface PaceSelectorWidgetProps {
  onSubmit: (newPages: number, reviewPages: number, goalText: string) => void;
}

const PaceSelectorWidget: React.FC<PaceSelectorWidgetProps> = ({ onSubmit }) => {
  const [newPages, setNewPages] = useState<number>(1);
  const [reviewPages, setReviewPages] = useState<number>(5);
  const [selectedGoal, setSelectedGoal] = useState<string>('ختم القرآن الكريم وتثبيته كاملاً');

  const goals = [
    'ختم القرآن الكريم وتثبيته كاملاً',
    'تثبيت وضبط آخر ١٠ أجزاء',
    'إتقان وتثبيت الأجزاء السابقة مع الحفظ الجديد',
    'المراجعة المكثفة لغرض نيل الإجازة والسند'
  ];

  return (
    <div className="p-4 rounded-2xl bg-[#064e3b]/90 border border-[#fbbf24]/50 space-y-4 text-xs text-white">
      {/* Target Goal */}
      <div>
        <label className="block text-amber-200 font-bold mb-1.5">الهدف التثبيتي الرئيسي في الحلقة:</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {goals.map(g => (
            <button
              key={g}
              type="button"
              onClick={() => setSelectedGoal(g)}
              className={`p-2 rounded-xl text-right text-xs font-bold transition-all border cursor-pointer ${
                selectedGoal === g
                  ? 'bg-[#fbbf24] text-[#064e3b] border-[#fbbf24] font-black'
                  : 'bg-[#022c22] text-white/80 border-[#065f46] hover:bg-[#022c22]/80'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Daily New Target */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold text-amber-200">كم وجهاً جديداً تستطيع حفظه وتسميعه يومياً؟</span>
          <span className="px-2 py-0.5 rounded-lg bg-[#fbbf24] text-[#064e3b] font-black">
            {newPages} {newPages === 1 ? 'وجه' : newPages === 2 ? 'وجهان' : 'أوجه'}
          </span>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setNewPages(p)}
              className={`flex-1 py-1.5 rounded-xl font-bold text-xs border cursor-pointer transition-all ${
                newPages === p
                  ? 'bg-[#fbbf24] text-[#064e3b] border-[#fbbf24]'
                  : 'bg-[#022c22] text-white border-[#065f46]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Daily Review Target */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="font-bold text-amber-200">كم وجه مراجعة وتثبيت تستطيع تسميعه يومياً؟</span>
          <span className="px-2 py-0.5 rounded-lg bg-[#fbbf24] text-[#064e3b] font-black">
            {reviewPages} {reviewPages >= 10 ? 'وجهاً' : 'أوجه'} ({Math.round((reviewPages / 20) * 10) / 10} جزء)
          </span>
        </div>
        <div className="flex gap-2">
          {[3, 5, 10, 15, 20].map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setReviewPages(p)}
              className={`flex-1 py-1.5 rounded-xl font-bold text-xs border cursor-pointer transition-all ${
                reviewPages === p
                  ? 'bg-[#fbbf24] text-[#064e3b] border-[#fbbf24]'
                  : 'bg-[#022c22] text-white border-[#065f46]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="button"
        onClick={() => onSubmit(newPages, reviewPages, selectedGoal)}
        className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-[#fbbf24] to-amber-400 hover:from-amber-400 hover:to-amber-500 text-[#064e3b] font-black text-xs sm:text-sm shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
      >
        <Check className="w-4 h-4" />
        <span>اعتماد الوتيرة والهدف والبحث عن الحلقة المناسبة</span>
      </button>
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
  const { halaqah, mosque, plan } = data;

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
        💡 تم إشعار المشرف العام للتحقق من إمكانية فتح حلقة إضافية أو قبولك فور توفر أول مقعد شاغر. سيتم التواصل معك على هاتف: {waitingEntry.phone}.
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
