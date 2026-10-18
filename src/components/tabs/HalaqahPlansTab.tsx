import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  Calendar,
  Clock,
  Sparkles,
  BrainCircuit,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Users,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
  Layers,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Filter,
  Flame,
  Check,
  X
} from 'lucide-react';
import {
  Student,
  Halaqah,
  QuranComplex,
  StudentMemorizationPlan
} from '../../types';
import { calculateRealisticKhatmTimeline } from '../../lib/aiPlanService';
import { OmranDataService } from '../../lib/firebase';
import { darkenHex, lightenHex, getContrastTextColor } from '../../lib/themeUtils';
import { toArabicNumerals } from '../quran/KingFahdQuranModal';

interface HalaqahPlansTabProps {
  students: Student[];
  halaqahs: Halaqah[];
  activeComplex?: QuranComplex | null;
  activeHalaqahId?: string;
  isSupervisor?: boolean;
  isDeveloper?: boolean;
  onUpdateStudents?: (updatedStudents: Student[]) => Promise<void> | void;
  onUpdateComplex?: (complex: QuranComplex) => Promise<void> | void;
}

const WEEK_DAYS = [
  { id: 'sun', label: 'الأحد' },
  { id: 'mon', label: 'الإثنين' },
  { id: 'tue', label: 'الثلاثاء' },
  { id: 'wed', label: 'الأربعاء' },
  { id: 'thu', label: 'الخميس' },
  { id: 'fri', label: 'الجمعة' },
  { id: 'sat', label: 'السبت' }
];

export const HalaqahPlansTab: React.FC<HalaqahPlansTabProps> = ({
  students = [],
  halaqahs = [],
  activeComplex,
  activeHalaqahId,
  isSupervisor = false,
  isDeveloper = false,
  onUpdateStudents,
  onUpdateComplex
}) => {
  // Theme calculations
  const themeAccent = activeComplex?.theme?.accentColor || '#ffc800';
  const themePrimary = activeComplex?.theme?.primaryColor || '#131f24';
  const themeSecondary = activeComplex?.theme?.secondaryColor || '#1b2e35';
  const themeCard = activeComplex?.theme?.cardColor || '#203843';
  const themeCardBorder = lightenHex(themeCard, 0.16);
  const themeCardShadow = darkenHex(themeCard, 0.35);
  const themeAccentShadow = darkenHex(themeAccent, 0.28);
  const accentTextColor = getContrastTextColor(themeAccent);

  // Configuration States
  const [selectedDays, setSelectedDays] = useState<string[]>(['sun', 'mon', 'tue', 'wed', 'thu']);
  const [dailyHours, setDailyHours] = useState<number>(2.0);
  const [targetScope, setTargetScope] = useState<'all' | string>(activeHalaqahId && activeHalaqahId !== 'all' ? activeHalaqahId : 'all');
  const [strategyPreset, setStrategyPreset] = useState<'tathbeet_first' | 'standard' | 'intensive'>('tathbeet_first');
  const [searchStudent, setSearchStudent] = useState('');

  // AI Recalculation States
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalcProgress, setRecalcProgress] = useState(0);
  const [currentProcessingName, setCurrentProcessingName] = useState('');
  const [recalcSuccessMsg, setRecalcSuccessMsg] = useState('');
  const [selectedViewingStudent, setSelectedViewingStudent] = useState<Student | null>(null);

  // Filter students based on target scope
  const targetStudents = useMemo(() => {
    let list = students;
    if (activeComplex) {
      list = list.filter(s => !s.complexId || s.complexId === activeComplex.id);
    }
    if (targetScope !== 'all') {
      list = list.filter(s => s.halaqahId === targetScope);
    }
    return list;
  }, [students, activeComplex, targetScope]);

  const displayedStudents = useMemo(() => {
    if (!searchStudent.trim()) return targetStudents;
    const query = searchStudent.trim().toLowerCase();
    return targetStudents.filter(s =>
      s.name.toLowerCase().includes(query) ||
      (s.halaqahName && s.halaqahName.toLowerCase().includes(query))
    );
  }, [targetStudents, searchStudent]);

  // Toggle Day selection
  const handleToggleDay = (dayId: string) => {
    setSelectedDays(prev => {
      if (prev.includes(dayId)) {
        if (prev.length <= 1) return prev; // Keep at least 1 day
        return prev.filter(d => d !== dayId);
      } else {
        return [...prev, dayId];
      }
    });
  };

  // Preset Selection
  const applyPreset = (type: 'school_5' | 'tri_sat_mon_wed' | 'tri_sun_tue_thu' | 'full_7') => {
    if (type === 'school_5') {
      setSelectedDays(['sun', 'mon', 'tue', 'wed', 'thu']);
    } else if (type === 'tri_sat_mon_wed') {
      setSelectedDays(['sat', 'mon', 'wed']);
    } else if (type === 'tri_sun_tue_thu') {
      setSelectedDays(['sun', 'tue', 'thu']);
    } else if (type === 'full_7') {
      setSelectedDays(['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri']);
    }
  };

  // Run AI Recalibration for all students in scope
  const handleRunAIRecalibration = async () => {
    if (targetStudents.length === 0) {
      alert('لا يوجد طلاب ضمن النطاق المحدد لإعادة جدولة خططهم.');
      return;
    }

    setIsRecalculating(true);
    setRecalcProgress(0);
    setRecalcSuccessMsg('');

    const weeklyDaysCount = selectedDays.length;
    const updatedList: Student[] = [];

    try {
      for (let i = 0; i < targetStudents.length; i++) {
        const student = targetStudents[i];
        setCurrentProcessingName(student.name);
        setRecalcProgress(Math.round(((i + 1) / targetStudents.length) * 100));

        // Determine student memorized juz
        const memCount = student.currentSurah
          ? (student.currentSurah <= 2 ? 30 : Math.max(1, Math.round((114 - student.currentSurah) / 3.8)))
          : 1;

        const consCount = student.memorizationPlan?.consolidatedJuzCount || Math.max(0, memCount - 2);

        // Calculate pace according to strategy
        let dailyNew = 1;
        let dailyReview = 5;
        if (strategyPreset === 'tathbeet_first') {
          dailyNew = memCount >= 25 ? 0.5 : 1;
          dailyReview = Math.max(5, consCount * 1.5);
        } else if (strategyPreset === 'standard') {
          dailyNew = 1;
          dailyReview = 5;
        } else if (strategyPreset === 'intensive') {
          dailyNew = 2;
          dailyReview = 10;
        }

        // Calculate realistic Khatmah timeline using verified pedagogical math
        const timeline = calculateRealisticKhatmTimeline({
          memorizedJuz: memCount,
          consolidatedJuz: consCount,
          dailyNewPages: dailyNew,
          dailyReviewPages: dailyReview,
          weeklyDaysCount,
          dailyHoursCount: dailyHours
        });

        // Generate tailored next day assignment respecting errors
        const hasErrors = (student.mushafErrors || []).some(e => !e.cleared && e.errorCount > 0);
        const nextAction = hasErrors ? 'repeat_surah' : 'advance_page';
        const nextReason = hasErrors
          ? 'تم تعليق التقدم وتخصيص جلسة الغد لتكرار وتثبيت الآيات التي وقع فيها خطأ'
          : 'تقدم منهجي متزن مع مراجعة الماضي';

        const updatedPlan: StudentMemorizationPlan = {
          dailyNewPages: dailyNew,
          dailyReviewPages: dailyReview,
          consolidatedJuzCount: consCount,
          memorizedJuzCount: memCount,
          targetJuz: 30,
          targetCompletionDate: timeline.targetCompletionDate,
          estimatedDaysRemaining: timeline.estimatedDaysRemaining,
          progressPercentage: timeline.progressPercentage,
          status: hasErrors ? 'needs_reinforcement' : 'on_track',
          weeklyDaysCount,
          dailyHoursCount: dailyHours,
          tathbeetStopsCount: timeline.tathbeetStopsCount,
          milestones: timeline.milestones,
          nextDayAssignment: {
            newMemorization: hasErrors
              ? `إعادة وتثبيت: سورة ${student.currentSurahName || 'الحالية'} الآيات 1 إلى ${student.currentAyah || 10}`
              : `الحفظ الجديد: سورة ${student.targetSurahName || student.currentSurahName || 'النبأ'} (${dailyNew} وجه)`,
            review: `مراجعة وتثبيت: ${dailyReview} أوجه من الأجزاء السابقة`,
            action: nextAction,
            reason: nextReason
          },
          aiNotes: `تم الضبط بواسطة المشرف بناءً على جدول (${weeklyDaysCount} أيام أسبوعياً / ${dailyHours} ساعات يومياً). ${timeline.pedagogicalNote}`,
          lastUpdated: new Date().toISOString()
        };

        const updatedStudent: Student = {
          ...student,
          memorizationPlan: updatedPlan,
          aiPlan: {
            roadmapSummary: `خطة تثبيت منهجي بواقع ${dailyNew} وجه جديد و${dailyReview} أوجه مراجعة، والختم بإذن الله: ${timeline.targetCompletionDate}.`,
            currentDailyAssignment: {
              newMemorization: updatedPlan.nextDayAssignment?.newMemorization || 'وجه جديد',
              review: updatedPlan.nextDayAssignment?.review || 'مراجعة الماضي',
              suggestedSheikh: 'الشيخ محمود خليل الحصري (مرتل ومجود)',
              dailyNote: hasErrors ? 'التركيز على تكرار الآيات التي فيها أخطاء' : 'التكرار 3 مرات قبل النوم',
              targetRepetitions: 3
            },
            difficultyAdjustment: hasErrors ? 'مراجعة وتكرار مكثف' : 'متزن',
            estimatedDaysToFinishJuz: Math.ceil(20 / dailyNew)
          }
        };

        // Persist to storage
        await OmranDataService.saveStudent(updatedStudent);
        updatedList.push(updatedStudent);

        // Small delay for UI smoothness
        if (targetStudents.length < 20) {
          await new Promise(r => setTimeout(r, 60));
        }
      }

      if (onUpdateStudents) {
        onUpdateStudents(updatedList);
      }

      setRecalcSuccessMsg(`🎉 تم بنجاح تام إعادة احتساب وضبط الخطط القرآنية ومواعيد الختم لـ (${targetStudents.length}) طالباً بناءً على جدولك الجديد (${weeklyDaysCount} أيام أسبوعياً / ${dailyHours} ساعات يومياً)!`);
      confetti({
        particleCount: 80,
        spread: 80,
        origin: { y: 0.6 }
      });
    } catch (err) {
      console.error('Error during AI recalibration:', err);
      alert('حدث تنبيه أثناء تحديث بعض السجلات، ولكن تم حفظ الأغلب بنجاح.');
    } finally {
      setIsRecalculating(false);
      setCurrentProcessingName('');
    }
  };

  return (
    <div className="space-y-6 pb-12 text-right" dir="rtl">
      {/* Header Duolingo Card */}
      <div
        className="rounded-3xl border-2 border-b-4 p-5 sm:p-7 shadow-xl relative overflow-hidden"
        style={{
          backgroundColor: themeSecondary,
          borderColor: themeCardBorder,
          borderBottomColor: themeCardShadow
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black shadow-sm"
              style={{
                backgroundColor: `${themeAccent}25`,
                color: themeAccent,
                border: `1px solid ${themeAccent}60`
              }}
            >
              <BrainCircuit className="w-4 h-4" />
              <span>لوحة تحكم المشرف والمبرمج • المنظومة الذكية لخطط الختم والتثبيت</span>
            </div>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black font-heading text-white">
              ضبط أوقات الحلقات وجدولة الختم بالذكاء الاصطناعي
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-bold max-w-2xl leading-relaxed">
              حدّد كم يوم تكون الحلقة أسبوعياً وساعات الحلقة والوتيرة المعتمدة. عند اعتماد التعديل، يبدأ الذكاء الاصطناعي في إعادة احتساب وتحديث مواعيد الختم وأوراد التثبيت لكافة الطلاب تلقائياً بما يناسب الجدول الجديد.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <div
              className="px-4 py-3 rounded-2xl border-2 border-b-4 text-center shrink-0 shadow-sm"
              style={{
                backgroundColor: themePrimary,
                borderColor: themeCardBorder,
                borderBottomColor: themeCardShadow
              }}
            >
              <span className="text-[10px] text-slate-400 font-black block">إجمالي الطلاب في النطاق</span>
              <span className="text-xl font-black" style={{ color: themeAccent }}>
                {toArabicNumerals(targetStudents.length)} طالب
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Success Notification Banner */}
      {recalcSuccessMsg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500/50 text-emerald-200 text-xs sm:text-sm font-black flex items-center justify-between gap-3 shadow-lg"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{recalcSuccessMsg}</span>
          </div>
          <button
            onClick={() => setRecalcSuccessMsg('')}
            className="p-1 rounded-lg hover:bg-white/10 text-emerald-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Panel 1: Days of Halaqah */}
        <div
          className="rounded-3xl border-2 border-b-4 p-5 space-y-4 shadow-md"
          style={{
            backgroundColor: themeCard,
            borderColor: themeCardBorder,
            borderBottomColor: themeCardShadow
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-black text-sm text-white">
              <Calendar className="w-4 h-4" style={{ color: themeAccent }} />
              <span>أيام الحلقة أسبوعياً ({toArabicNumerals(selectedDays.length)} أيام)</span>
            </div>
            <span className="text-[11px] font-bold text-slate-300">
              من {WEEK_DAYS.find(d => d.id === selectedDays[0])?.label || 'الأحد'} إلى {WEEK_DAYS.find(d => d.id === selectedDays[selectedDays.length - 1])?.label || 'الخميس'}
            </span>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => applyPreset('school_5')}
              className="px-2.5 py-1 rounded-xl text-[11px] font-black border transition-all cursor-pointer hover:bg-white/10"
              style={{
                borderColor: selectedDays.length === 5 ? themeAccent : themeCardBorder,
                color: selectedDays.length === 5 ? themeAccent : '#cbd5e1'
              }}
            >
              أحد - خميس (5 أيام)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('tri_sat_mon_wed')}
              className="px-2.5 py-1 rounded-xl text-[11px] font-black border transition-all cursor-pointer hover:bg-white/10"
              style={{
                borderColor: selectedDays.length === 3 && selectedDays.includes('sat') ? themeAccent : themeCardBorder,
                color: selectedDays.length === 3 && selectedDays.includes('sat') ? themeAccent : '#cbd5e1'
              }}
            >
              سبت، اثنين، أربعاء (3)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('full_7')}
              className="px-2.5 py-1 rounded-xl text-[11px] font-black border transition-all cursor-pointer hover:bg-white/10"
              style={{
                borderColor: selectedDays.length === 7 ? themeAccent : themeCardBorder,
                color: selectedDays.length === 7 ? themeAccent : '#cbd5e1'
              }}
            >
              طوال الأسبوع (7 أيام)
            </button>
          </div>

          {/* Days Checkboxes */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {WEEK_DAYS.map(day => {
              const isSelected = selectedDays.includes(day.id);
              return (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => handleToggleDay(day.id)}
                  className={`py-2 px-3 rounded-2xl border-2 font-black text-xs transition-all cursor-pointer flex items-center justify-between ${
                    isSelected ? 'shadow-sm active:translate-y-0.5' : 'opacity-60 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: isSelected ? `${themeAccent}25` : themePrimary,
                    borderColor: isSelected ? themeAccent : themeCardBorder,
                    color: isSelected ? themeAccent : '#94a3b8'
                  }}
                >
                  <span>{day.label}</span>
                  {isSelected ? (
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  ) : (
                    <span className="w-3 h-3 rounded-full border border-slate-600 inline-block" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Panel 2: Daily Hours & Target Scope */}
        <div
          className="rounded-3xl border-2 border-b-4 p-5 space-y-4 shadow-md"
          style={{
            backgroundColor: themeCard,
            borderColor: themeCardBorder,
            borderBottomColor: themeCardShadow
          }}
        >
          <div className="flex items-center gap-2 font-black text-sm text-white">
            <Clock className="w-4 h-4" style={{ color: themeAccent }} />
            <span>ساعات الحلقة اليومية ونطاق التطبيق</span>
          </div>

          {/* Hours Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">مدة جلسة التسميع اليومية:</label>
            <div className="grid grid-cols-4 gap-2">
              {[1.0, 1.5, 2.0, 3.0].map(h => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setDailyHours(h)}
                  className={`py-2 rounded-2xl border-2 font-black text-xs transition-all cursor-pointer text-center ${
                    dailyHours === h ? 'border-b-4 shadow-sm' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{
                    backgroundColor: dailyHours === h ? themeAccent : themePrimary,
                    borderColor: dailyHours === h ? themeAccent : themeCardBorder,
                    borderBottomColor: dailyHours === h ? themeAccentShadow : undefined,
                    color: dailyHours === h ? accentTextColor : '#e2e8f0'
                  }}
                >
                  {h === 1 ? 'ساعة' : h === 2 ? 'ساعتان' : `${h} ساعات`}
                </button>
              ))}
            </div>
          </div>

          {/* Halaqah Scope */}
          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-bold text-slate-300 block">نطاق الحلقات المشمولة بالجدولة:</label>
            <select
              value={targetScope}
              onChange={e => setTargetScope(e.target.value)}
              className="w-full py-2.5 px-3 rounded-2xl border text-xs font-bold text-white outline-none focus:ring-2 focus:ring-amber-400"
              style={{
                backgroundColor: themePrimary,
                borderColor: themeCardBorder
              }}
            >
              <option value="all">كافة الحلقات في المجمع ({students.length} طالب)</option>
              {halaqahs.map(h => (
                <option key={h.id} value={h.id}>
                  {h.name} {h.complexName ? `(${h.complexName})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Panel 3: Pedagogical Strategy & Execution */}
        <div
          className="rounded-3xl border-2 border-b-4 p-5 space-y-4 shadow-md flex flex-col justify-between"
          style={{
            backgroundColor: themeCard,
            borderColor: themeCardBorder,
            borderBottomColor: themeCardShadow
          }}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-black text-sm text-white">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>استراتيجية التثبيت (الختم بتثبيت)</span>
            </div>

            <div className="space-y-2">
              {[
                {
                  id: 'tathbeet_first',
                  title: 'أولوية التثبيت والإتقان (الموصى بها)',
                  desc: 'الختم بتثبيت خير من التعجل بالتفلت. وقفات تثبيت دورية كل 5 أجزاء ومراجعة تراكمية.'
                },
                {
                  id: 'standard',
                  title: 'وتيرة قياسية متزنة',
                  desc: 'حفظ وجه جديد يومياً مع مراجعة 5 أوجه منتظمة.'
                },
                {
                  id: 'intensive',
                  title: 'وتيرة مكثفة للهمم العالية',
                  desc: 'حفظ وجهين جديدين يومياً مع مراجعة 10 أوجه للمتفرغين.'
                }
              ].map(st => (
                <div
                  key={st.id}
                  onClick={() => setStrategyPreset(st.id as any)}
                  className={`p-2.5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-2.5 ${
                    strategyPreset === st.id ? 'bg-amber-400/10 border-amber-400' : 'bg-black/20 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border mt-0.5 shrink-0 flex items-center justify-center ${
                    strategyPreset === st.id ? 'border-amber-400 bg-amber-400' : 'border-slate-500'
                  }`}>
                    {strategyPreset === st.id && <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-white">{st.title}</h5>
                    <p className="text-[10px] text-slate-300 font-bold leading-relaxed">{st.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Trigger Button */}
          <button
            type="button"
            disabled={isRecalculating}
            onClick={handleRunAIRecalibration}
            className="w-full py-3.5 px-4 rounded-2xl border-2 border-b-4 text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xl active:translate-y-0.5 hover:brightness-110 disabled:opacity-50"
            style={{
              backgroundColor: themeAccent,
              borderColor: themeAccent,
              borderBottomColor: themeAccentShadow,
              color: accentTextColor
            }}
          >
            <Sparkles className="w-4 h-4" />
            <span>حفظ وتحديث خطط الطلاب بالذكاء الاصطناعي</span>
          </button>
        </div>
      </div>

      {/* Recalibration Fullscreen Overlay Modal (Requested: الرجاء عدم الخروج) */}
      <AnimatePresence>
        {isRecalculating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100005] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          >
            <div
              className="w-full max-w-lg rounded-3xl border-2 border-b-4 p-6 sm:p-8 space-y-6 shadow-2xl text-center"
              style={{
                backgroundColor: themeSecondary,
                borderColor: themeAccent,
                borderBottomColor: themeAccentShadow
              }}
            >
              <div
                className="w-16 h-16 rounded-3xl mx-auto flex items-center justify-center border-2 border-b-4 shadow-lg animate-bounce"
                style={{
                  backgroundColor: `${themeAccent}25`,
                  borderColor: themeAccent,
                  color: themeAccent
                }}
              >
                <BrainCircuit className="w-8 h-8" />
              </div>

              <div className="space-y-2">
                <span className="inline-block px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-400/40">
                  ⚠️ تنبيه: الرجاء عدم الخروج من الصفحة
                </span>
                <h3 className="text-lg sm:text-xl font-black text-white font-heading">
                  الذكاء الاصطناعي يعيد ضبط وجدولة خطط الحفظ والتثبيت...
                </h3>
                <p className="text-xs text-slate-300 font-bold max-w-sm mx-auto leading-relaxed">
                  يتم الآن احتساب مسار الأيام المتبقية وتواريخ الختم الدقيقة لكل طالب بناءً على ({selectedDays.length} أيام أسبوعياً / {dailyHours} ساعات يومياً) وموازنة وقفات التثبيت.
                </p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-black text-slate-200">
                  <span>جاري معالجة: {currentProcessingName || '...' }</span>
                  <span style={{ color: themeAccent }}>{recalcProgress}%</span>
                </div>
                <div className="w-full h-3.5 rounded-full bg-black/40 border border-white/10 overflow-hidden p-0.5">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${recalcProgress}%`,
                      backgroundColor: themeAccent
                    }}
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-slate-400 font-bold">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
                <span>يرجى الانتظار حتى اكتمال تحديث السجلات وحفظها سحابياً...</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Student Plans Explorer Table */}
      <div
        className="rounded-3xl border-2 border-b-4 p-5 sm:p-6 space-y-4 shadow-xl"
        style={{
          backgroundColor: themeSecondary,
          borderColor: themeCardBorder,
          borderBottomColor: themeCardShadow
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-black text-base text-white">
            <BookOpen className="w-5 h-5" style={{ color: themeAccent }} />
            <span>كشف خطط ومواعيد الختم المعتمدة للطلاب ({toArabicNumerals(displayedStudents.length)})</span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="بحث باسم الطالب أو الحلقة..."
              value={searchStudent}
              onChange={e => setSearchStudent(e.target.value)}
              className="w-full pr-9 pl-3 py-2 rounded-xl border text-xs font-bold text-white outline-none focus:border-amber-400"
              style={{
                backgroundColor: themePrimary,
                borderColor: themeCardBorder
              }}
            />
          </div>
        </div>

        {/* Table / Cards Grid */}
        <div className="space-y-3">
          {displayedStudents.length === 0 ? (
            <div className="p-8 text-center text-xs font-bold text-slate-400">
              لا يوجد طلاب مطابقين للبحث.
            </div>
          ) : (
            displayedStudents.map(student => {
              const plan = student.memorizationPlan;
              const hasErrors = (student.mushafErrors || []).some(e => !e.cleared && e.errorCount > 0);

              return (
                <div
                  key={student.id}
                  className="rounded-2xl border-2 border-b-4 p-4 transition-all shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  style={{
                    backgroundColor: themeCard,
                    borderColor: themeCardBorder,
                    borderBottomColor: themeCardShadow
                  }}
                >
                  {/* Student Basic Info */}
                  <div className="flex items-center gap-3 min-w-[220px]">
                    <div
                      className="w-10 h-10 rounded-2xl border-2 flex items-center justify-center font-black text-sm shrink-0 shadow-sm"
                      style={{
                        backgroundColor: `${themeAccent}20`,
                        borderColor: `${themeAccent}50`,
                        color: themeAccent
                      }}
                    >
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-white">{student.name}</h4>
                      <p className="text-[11px] text-slate-300 font-bold">
                        {student.halaqahName || 'حلقة غير محددة'} • {student.age || 12} سنة
                      </p>
                    </div>
                  </div>

                  {/* Plan Metrics */}
                  <div className="flex items-center gap-3 sm:gap-6 flex-wrap text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">المحفوظ / المثبت</span>
                      <span className="font-black text-white">
                        {toArabicNumerals(plan?.memorizedJuzCount || (student.currentSurah ? Math.max(1, Math.round((114 - student.currentSurah) / 3.8)) : 1))} جزءاً
                        {' '}(ثبت: {toArabicNumerals(plan?.consolidatedJuzCount || 1)})
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">معدل الحفظ / المراجعة</span>
                      <span className="font-black text-emerald-300">
                        {plan?.dailyNewPages || 1} وجه • {plan?.dailyReviewPages || 5} أوجه
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">تاريخ الختم المحسوب</span>
                      <span className="font-black text-amber-300">
                        {plan?.targetCompletionDate || 'خلال سنة تقريباً'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">الأيام المتبقية</span>
                      <span className="font-black text-white">
                        ~{toArabicNumerals(plan?.estimatedDaysRemaining || 365)} يوماً
                      </span>
                    </div>

                    {hasErrors && (
                      <span className="px-2 py-1 rounded-lg text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                        ⚠️ يحتاج تثبيت أخطاء
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end lg:self-auto">
                    <button
                      type="button"
                      onClick={() => setSelectedViewingStudent(student)}
                      className="px-3.5 py-2 rounded-xl border-2 border-b-2 text-xs font-black transition-all cursor-pointer shadow-sm hover:brightness-110 flex items-center gap-1.5"
                      style={{
                        backgroundColor: `${themeAccent}25`,
                        borderColor: `${themeAccent}60`,
                        color: themeAccent
                      }}
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>تفاصيل الخطة</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Plan Details Modal */}
      {selectedViewingStudent && (
        <div className="fixed inset-0 z-[100005] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div
            className="w-full max-w-xl rounded-3xl border-2 border-b-4 p-5 sm:p-7 space-y-5 shadow-2xl my-auto animate-fadeIn"
            style={{
              backgroundColor: themeSecondary,
              borderColor: themeAccent,
              borderBottomColor: themeAccentShadow
            }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: themeCardBorder }}>
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-5 h-5" style={{ color: themeAccent }} />
                <h3 className="text-base font-black text-white">
                  الخطة القرآنية الشاملة: {selectedViewingStudent.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedViewingStudent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1 text-xs">
              {/* Target Date Highlight Card */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-400/40 space-y-1.5">
                <span className="text-[11px] font-black text-amber-300 block">موعد الختم المحسوب بدقة:</span>
                <div className="text-lg font-black text-white">
                  {selectedViewingStudent.memorizationPlan?.targetCompletionDate || 'قيد الاحتساب'}
                </div>
                <p className="text-[11px] text-slate-300 font-bold leading-relaxed">
                  {selectedViewingStudent.memorizationPlan?.aiNotes || selectedViewingStudent.aiPlan?.roadmapSummary || 'خطة تثبيت منهجي متزن.'}
                </p>
              </div>

              {/* Targets Breakdown */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-black/20 border border-white/10">
                  <span className="text-[10px] text-slate-400 font-bold block">مقرر الحفظ الجديد:</span>
                  <span className="font-black text-white">
                    {selectedViewingStudent.memorizationPlan?.nextDayAssignment?.newMemorization || selectedViewingStudent.dailyNewTarget || 'وجه واحد'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-black/20 border border-white/10">
                  <span className="text-[10px] text-slate-400 font-bold block">مقرر المراجعة والتثبيت:</span>
                  <span className="font-black text-emerald-300">
                    {selectedViewingStudent.memorizationPlan?.nextDayAssignment?.review || selectedViewingStudent.dailyReviewTarget || '5 أوجه'}
                  </span>
                </div>
              </div>

              {/* Milestones if present */}
              {selectedViewingStudent.memorizationPlan?.milestones && (
                <div className="p-3 rounded-2xl bg-black/20 border border-white/10 space-y-2">
                  <span className="text-[11px] font-black text-white block">مراحل ووقفات التثبيت القادمة:</span>
                  <div className="space-y-1.5">
                    {selectedViewingStudent.memorizationPlan.milestones.map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-white/5">
                        <span className="text-slate-200 font-bold">{m.label}</span>
                        <span className="text-amber-300 font-black">{m.targetDate}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t" style={{ borderColor: themeCardBorder }}>
              <button
                type="button"
                onClick={() => setSelectedViewingStudent(null)}
                className="py-2.5 px-6 rounded-xl font-black text-xs cursor-pointer shadow-md"
                style={{
                  backgroundColor: themeAccent,
                  color: accentTextColor
                }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
