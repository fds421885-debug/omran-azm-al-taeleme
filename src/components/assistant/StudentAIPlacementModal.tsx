import React, { useState } from 'react';
import {
  Sparkles,
  User,
  Phone,
  Calendar,
  BookOpen,
  ChevronLeft,
  X,
  Bot,
  BrainCircuit,
  Award
} from 'lucide-react';
import {
  Student,
  QuranComplex,
  Halaqah,
  WaitingListStudent
} from '../../types';
import { OmranDataService } from '../../lib/firebase';
import { AIStudentPlacementInterview } from '../portal/AIStudentPlacementInterview';

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
  const targetComplex = complexes.find(c => c.id === studentInitialData.complexId) || complexes[0] || null;

  // Local Form state for initial details (if not provided)
  const [formName, setFormName] = useState(studentInitialData.name || '');
  const [formAge, setFormAge] = useState<number>(studentInitialData.age || 11);
  const [formPhone, setFormPhone] = useState(studentInitialData.phone || '');
  const [formParentName, setFormParentName] = useState(studentInitialData.parentName || '');
  const [formParentPhone, setFormParentPhone] = useState(studentInitialData.parentPhones?.[0] || studentInitialData.phone || '');
  const [formMemorizedJuz, setFormMemorizedJuz] = useState<number>(1);
  const [isInterviewActive, setIsInterviewActive] = useState<boolean>(Boolean(studentInitialData.name?.trim()));
  const [formError, setFormError] = useState<string>('');

  if (!isOpen) return null;

  const handleStartDynamicInterview = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formName.trim()) {
      setFormError('يرجى كتابة الاسم الثلاثي للطالب للبدء في المقابلة الذكية.');
      return;
    }
    if (!formPhone.trim()) {
      setFormError('يرجى إدخال رقم الهاتف للتواصل وحفظ الحساب.');
      return;
    }
    setIsInterviewActive(true);
  };

  // Build data payload for the interactive interview
  const activeStudentData = {
    studentName: formName.trim() || studentInitialData.name,
    age: formAge || studentInitialData.age || 11,
    phone: formPhone.trim() || studentInitialData.phone,
    parentName: formParentName.trim() || studentInitialData.parentName || `ولي أمر ${formName.trim()}`,
    parentPhone: formParentPhone.trim() || formPhone.trim() || studentInitialData.phone,
    email: `${formPhone.trim()}@omran-quran.com`,
    memorizedJuzList: formMemorizedJuz >= 30
      ? Array.from({ length: 30 }, (_, i) => i + 1)
      : Array.from({ length: Math.max(1, formMemorizedJuz) }, (_, i) => 30 - i),
    notes: 'تمت المقابلة والتسكين بواسطة المساعد القرآني التكيفي الذكي',
    trackingCode: `OMR-AI${Math.floor(1000 + Math.random() * 9000)}`,
    password: studentInitialData.password || '123'
  };

  return (
    <>
      {isInterviewActive && targetComplex ? (
        <AIStudentPlacementInterview
          studentInitialData={activeStudentData}
          complex={targetComplex}
          halaqahs={halaqahs}
          existingStudents={existingStudents}
          onPlacementSuccess={async (newStudent: Student) => {
            try {
              // 1. Direct dual persistence: Firestore and Local cache
              await OmranDataService.saveStudent(newStudent);

              // 2. Real-time broadcast for supervisor
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('omran:students-updated', { detail: newStudent }));
                window.dispatchEvent(new CustomEvent('omran:data-updated', { detail: { type: 'student', payload: newStudent } }));
              }

              const matchedH = halaqahs.find(h => h.id === newStudent.halaqahId) || halaqahs[0];
              onPlacementComplete(newStudent, targetComplex, matchedH);
              onClose();
            } catch (err) {
              console.warn('Placement completion note:', err);
              const matchedH = halaqahs.find(h => h.id === newStudent.halaqahId) || halaqahs[0];
              onPlacementComplete(newStudent, targetComplex, matchedH);
              onClose();
            }
          }}
          onWaitingListAdded={async (waitingEntry: WaitingListStudent) => {
            try {
              const currentWait = targetComplex.waitingList || [];
              const updatedWait = [...currentWait.filter(w => w.id !== waitingEntry.id), waitingEntry];
              const updatedComplex: QuranComplex = {
                ...targetComplex,
                waitingList: updatedWait
              };
              await OmranDataService.saveComplex(updatedComplex);
              onPlacedInWaitingList(waitingEntry, targetComplex);
              onClose();
            } catch (err) {
              console.warn('Waiting list save note:', err);
              onPlacedInWaitingList(waitingEntry, targetComplex);
              onClose();
            }
          }}
          onCancel={onClose}
        />
      ) : (
        /* Introductory Step (Only shown if studentInitialData.name was empty) */
        <div className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto" dir="rtl">
          <div className="relative w-full max-w-lg bg-[#022c22] border-2 border-amber-400/60 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto transition-all animate-fadeIn">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#064e3b] via-[#022c22] to-[#064e3b] border-b border-[#065f46] px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/50 text-amber-300 flex items-center justify-center shadow-md">
                  <Bot className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white font-heading flex items-center gap-2">
                    <span>المساعد القرآني الذكي لتسكين وتوجيه الطلاب</span>
                  </h3>
                  <p className="text-[11px] text-emerald-200">
                    {targetComplex?.name || 'مجمع القرآن الكريم'} • مقابلة تحديد المستوى والتسكين التفاعلية
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleStartDynamicInterview} className="p-5 sm:p-6 space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-[#064e3b]/50 border border-[#065f46] space-y-1">
                <span className="text-amber-300 font-black text-xs flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>مقابلة ذكية متكيفة وليست أسئلة ثابتة!</span>
                </span>
                <p className="text-[11px] text-emerald-100 font-bold leading-relaxed">
                  سيجري المساعد الذكي حواراً تكيفياً حياً مع الطالب؛ فإذا كان خاتماً عامله معاملة الخاتم المتقن، وإذا كان طفلاً بسّط له ولعب معه، ويقيس نفسيته ويختبره اختباراً حياً لرسم خطة تثبيت دقيقة وتسكينه في الحلقة الأنسب.
                </p>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-black">
                  {formError}
                </div>
              )}

              {/* Student Name */}
              <div className="space-y-1">
                <label className="text-white font-black block">اسم الطالب (الاسم الثلاثي):</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="مثال: عبد الرحمن محمد القحطاني"
                    className="w-full bg-[#064e3b] border border-[#065f46] focus:border-amber-400 rounded-xl pr-9 pl-3 py-2.5 text-white font-bold outline-none text-xs"
                  />
                </div>
              </div>

              {/* Age and Memorized Juz */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-white font-black block">عمر الطالب (سنوات):</label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
                    <input
                      type="number"
                      min={4}
                      max={80}
                      value={formAge}
                      onChange={e => setFormAge(Number(e.target.value))}
                      className="w-full bg-[#064e3b] border border-[#065f46] focus:border-amber-400 rounded-xl pr-9 pl-3 py-2.5 text-white font-bold outline-none text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-white font-black block">كم جزءاً يحفظ تقريباً؟</label>
                  <div className="relative">
                    <BookOpen className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
                    <select
                      value={formMemorizedJuz}
                      onChange={e => setFormMemorizedJuz(Number(e.target.value))}
                      className="w-full bg-[#064e3b] border border-[#065f46] focus:border-amber-400 rounded-xl pr-9 pl-3 py-2.5 text-white font-bold outline-none text-xs cursor-pointer"
                    >
                      <option value={1}>جزء واحد (جزء عم)</option>
                      <option value={3}>٣ أجزاء</option>
                      <option value={5}>٥ أجزاء</option>
                      <option value={10}>١٠ أجزاء</option>
                      <option value={15}>١٥ جزءاً</option>
                      <option value={20}>٢٠ جزءاً</option>
                      <option value={25}>٢٥ جزءاً</option>
                      <option value={30}>٣٠ جزءاً (خاتم للقرآن الكريم كاملاً)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Phone and Parent */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-white font-black block">رقم الهاتف:</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute right-3 top-3 text-slate-400" />
                    <input
                      type="tel"
                      required
                      value={formPhone}
                      onChange={e => setFormPhone(e.target.value)}
                      placeholder="05xxxxxxxx"
                      className="w-full bg-[#064e3b] border border-[#065f46] focus:border-amber-400 rounded-xl pr-9 pl-3 py-2.5 text-white font-bold outline-none text-xs font-mono"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-white font-black block">اسم ولي الأمر:</label>
                  <input
                    type="text"
                    value={formParentName}
                    onChange={e => setFormParentName(e.target.value)}
                    placeholder="اختياري"
                    className="w-full bg-[#064e3b] border border-[#065f46] focus:border-amber-400 rounded-xl px-3 py-2.5 text-white font-bold outline-none text-xs"
                  />
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-400 hover:brightness-110 text-slate-900 font-black text-xs sm:text-sm border-b-4 border-amber-600 shadow-xl cursor-pointer transition-all flex items-center justify-center gap-2 active:translate-y-0.5"
                >
                  <BrainCircuit className="w-5 h-5 text-slate-900" />
                  <span>بدء المقابلة الذكية التكيفية مع الطالب (AI)</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
