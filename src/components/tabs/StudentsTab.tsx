import React, { useState, useEffect, useMemo } from 'react';
import {
  UserPlus,
  Search,
  Filter,
  Trash2,
  Edit,
  Phone,
  BookOpen,
  Lock,
  Unlock,
  Sparkles,
  Shield,
  Plus,
  X,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  Eye,
  Layers,
  ArrowRightLeft,
  CheckSquare,
  Square,
  RefreshCw,
  Users,
  Copy,
  FileText,
  Link as LinkIcon
} from 'lucide-react';
import { Student, StudentLevel, AppSettings, Halaqah, getThreePartNameValidation, QuranComplex, StudentMemorizationPlan } from '../../types';
import { darkenHex, lightenHex } from '../../lib/themeUtils';
import { normalizeArabicText } from '../../lib/googleWorkspace';
import { QURAN_SURAHS } from '../../data/quranData';
import { getPageOfAyah } from '../../data/quranPagesData';
import { triggerComplexThemePulse } from '../../utils/highlightHelper';
import { OmranDataService } from '../../lib/firebase';
import { ComplexPortalSettingsModal } from '../portal/ComplexPortalSettingsModal';
import { calculateRealisticKhatmTimeline, calculateStudentMemorizedJuz } from '../../lib/aiPlanService';

function toArabicNumerals(num: number | string): string {
  const digits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).replace(/[0-9]/g, d => digits[parseInt(d, 10)]);
}

interface StudentsTabProps {
  students: Student[];
  settings: AppSettings;
  halaqahs?: Halaqah[];
  activeHalaqahId?: string;
  isSupervisor?: boolean;
  isDeveloper?: boolean;
  activeComplex?: QuranComplex | null;
  onAddStudent: (studentData: Partial<Student>) => Promise<boolean>;
  onBatchAddStudents?: (studentsList: Partial<Student>[]) => Promise<boolean>;
  onUpdateStudent: (student: Student) => Promise<boolean>;
  onDeleteStudent: (studentId: string) => Promise<boolean>;
  onBatchDeleteStudents?: (studentIds: string[]) => Promise<boolean>;
  onToggleRegistration: () => void;
  onTriggerAIPlan: (student: Student) => Promise<void>;
  onTransferStudent?: (studentId: string, targetHalaqahId: string, targetHalaqahName: string) => Promise<void>;
  onBatchTransferStudents?: (studentIds: string[], targetHalaqahId: string, targetHalaqahName: string) => Promise<void>;
  initialStudentToDeleteId?: string;
  initialSearchQuery?: string;
}

/**
 * دالة ذكية لتنظيف وتنسيق أسماء الطلاب المدخلة جماعياً:
 * - تزيل الترقيم والشرطات والرموز في البداية والنهاية (مثل: 1- ، 1. ، (1) ، • ، -)
 * - تزيل الكشيدة (ـ) وتوحّد المسافات
 * - تزيل الملاحظات بين أقواس مثل (جديد) أو (حلقة الفجر)
 */
export function cleanStudentBulkName(raw: string): string {
  if (!raw) return '';
  let cleaned = raw
    .replace(/[\u200B-\u200F\uFEFF\u202A-\u202E\u00A0\t]/g, ' ') // Strip invisible unicode, bidi marks, tabs
    .trim();
  // Remove parenthetical annotations e.g. (جديد), [حلقة 1]
  cleaned = cleaned.replace(/\([^)]*\)/g, ' ');
  cleaned = cleaned.replace(/\[[^\]]*\]/g, ' ');
  // Remove leading numbers, bullets, dashes, periods, hashes (e.g. 1-, 1., (1), •)
  cleaned = cleaned.replace(/^[\s\d٠-٩\-–—._\)\(\[\]•*#:/\\]+/u, ' ');
  // Remove trailing numbers or punctuation
  cleaned = cleaned.replace(/[\s\d٠-٩\-–—._\)\(\[\]•*#:/\\]+$/u, ' ');
  // Remove tatweel (kashida)
  cleaned = cleaned.replace(/\u0640/g, '');
  // Remove non-word punctuation, keeping letters, spaces and hyphens
  cleaned = cleaned.replace(/[^\p{L}\s'-]/gu, ' ');
  // Normalize internal whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

export const StudentsTab: React.FC<StudentsTabProps> = ({
  students,
  settings,
  halaqahs = [],
  activeHalaqahId,
  isSupervisor = false,
  isDeveloper = false,
  activeComplex,
  onAddStudent,
  onBatchAddStudents,
  onUpdateStudent,
  onDeleteStudent,
  onBatchDeleteStudents,
  onToggleRegistration,
  onTriggerAIPlan,
  onTransferStudent,
  onBatchTransferStudents,
  initialStudentToDeleteId,
  initialSearchQuery
}) => {
  const currentTheme = activeComplex?.theme || settings?.theme;
  const cardBg = currentTheme?.cardColor || 'var(--complex-card, #203843)';
  const secondaryBg = currentTheme?.secondaryColor || 'var(--complex-secondary, #1b2e35)';
  const primaryBg = currentTheme?.primaryColor || 'var(--complex-primary, #131f24)';
  const borderCol = currentTheme?.secondaryColor || 'var(--complex-border, #2b4550)';
  const borderBottomCol = darkenHex(primaryBg, 0.35);
  const accentCol = currentTheme?.accentColor || 'var(--complex-accent, #ffc800)';
  const accentShadow = darkenHex(accentCol, 0.28);

  const [searchTerm, setSearchTerm] = useState(initialSearchQuery || '');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');

  // Bulk Selection & Transfer/Delete State
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isBulkTransferModalOpen, setIsBulkTransferModalOpen] = useState(false);
  const [bulkTargetHalaqahId, setBulkTargetHalaqahId] = useState<string>('');
  const [isBulkTransferring, setIsBulkTransferring] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Bulk Delete State
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Set default bulk halaqah when modal opens or halaqahs change
  useEffect(() => {
    if (halaqahs.length > 0 && !bulkTargetHalaqahId) {
      setBulkTargetHalaqahId(halaqahs[0].id);
    }
  }, [halaqahs, bulkTargetHalaqahId]);

  const handleSelectAllFiltered = () => {
    const allFilteredIds = filteredStudents.map(s => s.id);
    setSelectedStudentIds(allFilteredIds);
  };

  const handleDeselectAll = () => {
    setSelectedStudentIds([]);
  };

  // Bulk Delete Handler
  const handleConfirmBulkDelete = async () => {
    if (selectedStudentIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      if (onBatchDeleteStudents) {
        await onBatchDeleteStudents(selectedStudentIds);
      } else {
        for (const id of selectedStudentIds) {
          await onDeleteStudent(id);
        }
      }
      setSelectedStudentIds([]);
      setIsBulkDeleteModalOpen(false);
    } catch (err) {
      console.error('Bulk delete error:', err);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStudentIds.length === 0 || !bulkTargetHalaqahId) {
      setBulkFeedback({ type: 'error', text: 'يرجى اختيار الحلقة المستهدفة لنقل الطلاب إليها.' });
      return;
    }

    const targetHalaqah = halaqahs.find(h => h.id === bulkTargetHalaqahId);
    const targetName = targetHalaqah ? targetHalaqah.name : 'الحلقة المختارة';

    setIsBulkTransferring(true);
    setBulkFeedback(null);
    try {
      if (onBatchTransferStudents) {
        await onBatchTransferStudents(selectedStudentIds, bulkTargetHalaqahId, targetName);
      } else if (onTransferStudent) {
        for (const sId of selectedStudentIds) {
          await onTransferStudent(sId, bulkTargetHalaqahId, targetName);
        }
      }
      setBulkFeedback({
        type: 'success',
        text: `تم نقل (${selectedStudentIds.length}) طلاب بنجاح إلى "${targetName}" وحفظ كافة سجلاتهم سحابياً!`
      });
      setTimeout(() => {
        setSelectedStudentIds([]);
        setIsBulkTransferModalOpen(false);
        setBulkFeedback(null);
        setBulkTargetHalaqahId('');
      }, 1500);
    } catch (err: any) {
      setBulkFeedback({
        type: 'error',
        text: err.message || 'حدث خطأ أثناء نقل الطلاب سحابياً.'
      });
    } finally {
      setIsBulkTransferring(false);
    }
  };
  
  // Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAIPlacementModalOpen, setIsAIPlacementModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [viewingPlanStudent, setViewingPlanStudent] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);
  const [quickAssignStudent, setQuickAssignStudent] = useState<Student | null>(null);
  const [quickSelectedHalaqahId, setQuickSelectedHalaqahId] = useState<string>('');
  const [isQuickAssigning, setIsQuickAssigning] = useState(false);

  // Complex Portal & Applications State
  const [isPortalSettingsOpen, setIsPortalSettingsOpen] = useState(false);
  const [pendingAppsCount, setPendingAppsCount] = useState(0);

  useEffect(() => {
    if (!activeComplex) return;
    const unsub = OmranDataService.subscribeToRegistrationApplications(apps => {
      const count = apps.filter(a => a.status === 'pending').length;
      setPendingAppsCount(count);
    }, activeComplex.id);

    return () => unsub();
  }, [activeComplex?.id]);

  // Auto-open student deletion modal if navigated from assistant
  useEffect(() => {
    if (initialSearchQuery !== undefined && initialSearchQuery !== '') {
      setSearchTerm(initialSearchQuery);
    }
    if (initialStudentToDeleteId && students.length > 0) {
      const match = students.find(s => s.id === initialStudentToDeleteId);
      if (match) {
        setStudentToDelete(match);
      }
      setTimeout(() => {
        triggerComplexThemePulse(initialStudentToDeleteId);
      }, 350);
    }
  }, [initialSearchQuery, initialStudentToDeleteId, students]);
  
  // Form fields
  const [formName, setFormName] = useState('');
  const [formPassword, setFormPassword] = useState('123');
  const [formAge, setFormAge] = useState<number>(11);
  const [formParentName, setFormParentName] = useState('');
  const [formParentPhones, setFormParentPhones] = useState<string[]>(['']);
  const [formSurahNum, setFormSurahNum] = useState<number>(78);
  const [formAyah, setFormAyah] = useState<number>(1);
  const [formHalaqahId, setFormHalaqahId] = useState<string>(activeHalaqahId || halaqahs[0]?.id || '');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Open edit modal
  const openEditModal = (student: Student) => {
    setEditingStudent(student);
    setFormName(student.name);
    setFormPassword(student.password || '123');
    setFormAge(student.age || 10);
    setFormParentName(student.parentName || '');
    setFormParentPhones(student.parentPhones && student.parentPhones.length > 0 ? [...student.parentPhones] : ['']);
    setFormSurahNum(student.currentSurah || 78);
    setFormAyah(student.currentAyah || 1);
    setFormHalaqahId(student.halaqahId || '');
    setFormError('');
    setIsAddModalOpen(true);
  };

  // Lock body scroll when any modal is open
  useEffect(() => {
    const isAnyModalOpen =
      isAddModalOpen ||
      !!viewingPlanStudent ||
      !!studentToDelete ||
      !!quickAssignStudent ||
      isBulkTransferModalOpen ||
      isBulkDeleteModalOpen;

    if (isAnyModalOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [
    isAddModalOpen,
    viewingPlanStudent,
    studentToDelete,
    quickAssignStudent,
    isBulkTransferModalOpen,
    isBulkDeleteModalOpen
  ]);

  const handleAddParentPhone = () => {
    setFormParentPhones([...formParentPhones, '']);
  };

  const handleRemoveParentPhone = (idx: number) => {
    const updated = formParentPhones.filter((_, i) => i !== idx);
    setFormParentPhones(updated.length > 0 ? updated : ['']);
  };

  const handleParentPhoneChange = (idx: number, val: string) => {
    const updated = [...formParentPhones];
    updated[idx] = val;
    setFormParentPhones(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) {
      setFormError('يرجى كتابة اسم الطالب');
      return;
    }

    const nameValidation = getThreePartNameValidation(formName, 'طالب');
    if (!nameValidation.isValid) {
      setFormError(nameValidation.message || 'الاسم الثلاثي للطالب إلزامي.');
      return;
    }

    const cleanStudentName = formName.trim();
    const normStudentName = cleanStudentName.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

    // Check duplicate name against existing students
    const duplicateStudent = students.find(
      s => (!editingStudent || s.id !== editingStudent.id) &&
           s.name.trim().toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي') === normStudentName
    );
    if (duplicateStudent) {
      setFormError(`عذراً، هذا الاسم (${cleanStudentName}) مسجل مسبقاً في المنظومة! يرجى كتابة الاسم الرباعي أو إضافة اسم العائلة والجد لتجنب تطابق الأسماء.`);
      return;
    }

    const selectedSurah = QURAN_SURAHS.find(s => s.number === Number(formSurahNum));
    const validParentPhones = formParentPhones.map(p => p.trim()).filter(p => p.length > 0);
    const chosenHalaqah = halaqahs.find(h => h.id === formHalaqahId);
    const assignedHalaqahName = chosenHalaqah ? chosenHalaqah.name : '';

    // Enforce Halaqah Capacity limit check
    if (chosenHalaqah && (!editingStudent || editingStudent.halaqahId !== formHalaqahId)) {
      const currentHalaqahStudentsCount = students.filter(s => s.halaqahId === chosenHalaqah.id).length;
      const capacity = chosenHalaqah.capacity && chosenHalaqah.capacity > 0 ? chosenHalaqah.capacity : Math.max(1, currentHalaqahStudentsCount);
      if (currentHalaqahStudentsCount >= capacity) {
        setFormError(`لقد وصلت الحلقة (${chosenHalaqah.name}) إلى التعبئة الكاملة للطلاب (السعة الاستيعابية: ${capacity} طلاب).`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (editingStudent) {
        const updated: Student = {
          ...editingStudent,
          name: formName.trim(),
          password: formPassword.trim() || '123',
          phone: editingStudent.phone || validParentPhones[0] || '',
          age: formAge,
          parentName: formParentName.trim() || `ولي أمر ${formName.trim()}`,
          parentPhones: validParentPhones.length > 0 ? validParentPhones : (editingStudent.parentPhones || []),
          parentPhone: validParentPhones[0] || editingStudent.parentPhone || '',
          currentSurah: Number(formSurahNum),
          currentSurahName: selectedSurah?.name || 'النبأ',
          currentAyah: Number(formAyah),
          dailyNewTarget: editingStudent.dailyNewTarget || 'نصف وجه',
          dailyReviewTarget: editingStudent.dailyReviewTarget || 'وجه واحد',
          level: editingStudent.level || 'متوسط',
          halaqahId: formHalaqahId,
          halaqahName: assignedHalaqahName,
          notes: editingStudent.notes || ''
        };
        await onUpdateStudent(updated);
      } else {
        await onAddStudent({
          name: formName.trim(),
          password: formPassword.trim() || '123',
          phone: validParentPhones[0] || '',
          age: formAge,
          parentName: formParentName.trim() || `ولي أمر ${formName.trim()}`,
          parentPhones: validParentPhones.length > 0 ? validParentPhones : [''],
          parentPhone: validParentPhones[0] || '',
          currentSurah: Number(formSurahNum),
          currentSurahName: selectedSurah?.name || 'النبأ',
          currentAyah: Number(formAyah),
          dailyNewTarget: 'نصف وجه',
          dailyReviewTarget: 'وجه واحد',
          level: 'متوسط',
          halaqahId: formHalaqahId,
          halaqahName: assignedHalaqahName,
          notes: ''
        });
      }
      setIsAddModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'حدث خطأ أثناء الحفظ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Quick Assign Handler
  const handleQuickAssign = async () => {
    if (!quickAssignStudent || !quickSelectedHalaqahId) return;
    setIsQuickAssigning(true);
    try {
      const chosen = halaqahs.find(h => h.id === quickSelectedHalaqahId);
      const chosenName = chosen ? chosen.name : '';
      if (onTransferStudent) {
        await onTransferStudent(quickAssignStudent.id, quickSelectedHalaqahId, chosenName);
      } else {
        await onUpdateStudent({
          ...quickAssignStudent,
          halaqahId: quickSelectedHalaqahId,
          halaqahName: chosenName
        });
      }
      setQuickAssignStudent(null);
      setQuickSelectedHalaqahId('');
    } catch (e: any) {
      console.error('Quick assign error:', e);
    } finally {
      setIsQuickAssigning(false);
    }
  };

  const unassignedStudentsCount = students.filter(
    s => !s.halaqahId || s.halaqahId.trim() === '' || s.halaqahId === 'unassigned' || s.halaqahId === 'none'
  ).length;
  const assignedStudentsCount = students.length - unassignedStudentsCount;

  // Filter students
  const filteredStudents = students.filter(student => {
    const isAssigned = Boolean(
      student.halaqahId &&
      student.halaqahId.trim() !== '' &&
      student.halaqahId !== 'unassigned' &&
      student.halaqahId !== 'none'
    );

    if (assignmentFilter === 'assigned' && !isAssigned) return false;
    if (assignmentFilter === 'unassigned' && isAssigned) return false;

    const matchesSearch =
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.currentSurahName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.phone?.includes(searchTerm);
    const matchesLevel = levelFilter === 'all' || student.level === levelFilter;
    return matchesSearch && matchesLevel;
  });

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div
        className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-[28px] border-2 border-b-4 shadow-xl backdrop-blur-md transition-all"
        style={{
          backgroundColor: secondaryBg,
          borderColor: borderCol,
          borderBottomColor: borderBottomCol
        }}
      >
        <div>
          <h2 className="text-xl font-black font-heading text-white flex items-center gap-2">
            <span>إدارة الطلاب والتسجيل الذكي</span>
            <span
              className="text-xs px-3 py-1 rounded-full font-black border-2 border-b-2 shadow-xs"
              style={{
                backgroundColor: `${accentCol}20`,
                borderColor: `${accentCol}60`,
                borderBottomColor: accentShadow,
                color: accentCol
              }}
            >
              {students.length} طالب
            </span>
          </h2>
          <p className="text-xs text-slate-300 font-bold mt-1">
            تسجيل الطلاب وتحديد مستوياتهم ومواضع حفظهم ومتابعة مقرراتهم المنهجية
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Registration Lock Toggle - Only visible to Developer/Programmer */}
          {isDeveloper && (
            <button
              onClick={onToggleRegistration}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 border-2 border-b-4 active:translate-y-0.5 transition-all cursor-pointer shadow-sm ${
                settings.allowStudentRegistration
                  ? 'bg-amber-400/20 border-amber-400/60 text-amber-300 hover:bg-amber-400/30'
                  : 'bg-red-500/20 border-red-500/60 text-red-300 hover:bg-red-500/30'
              }`}
              style={{
                borderBottomColor: settings.allowStudentRegistration ? accentShadow : '#991b1b'
              }}
              title={
                settings.allowStudentRegistration
                  ? 'التسجيل الذاتي مفتوح للطلاب (انقر للقفل)'
                  : 'التسجيل الذاتي مغلق حالياً (انقر للفتح)'
              }
            >
              {settings.allowStudentRegistration ? (
                <>
                  <Unlock className="w-4 h-4 text-amber-300" />
                  <span>إنشاء الحسابات: مفتوح</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-red-400" />
                  <span>إنشاء الحسابات: مغلق</span>
                </>
              )}
            </button>
          )}

          {/* Complex Dedicated Portal & Registration Link Button (فقط بوابة رابط تسجيل المجمع) */}
          {activeComplex && (
            <button
              type="button"
              onClick={() => setIsPortalSettingsOpen(true)}
              className="px-5 py-2.5 rounded-2xl border-2 border-b-4 text-xs sm:text-sm font-black shadow-xl flex items-center gap-2 transition-all cursor-pointer active:translate-y-0.5 hover:brightness-110"
              style={{
                backgroundColor: accentCol,
                borderColor: accentCol,
                borderBottomColor: accentShadow,
                color: primaryBg
              }}
              title="إدارة وتفعيل رابط وبوابة تسجيل المجمع واستقبال طلبات الطلاب"
            >
              <LinkIcon className="w-4 h-4" />
              <span>بوابة رابط تسجيل المجمع</span>
              {pendingAppsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-300 text-slate-950 shadow-sm animate-pulse">
                  {pendingAppsCount} طلبات جديدة
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Search & Level Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="بحث بالاسم أو السورة أو رقم الهاتف..."
            className="w-full border-2 rounded-2xl py-2.5 px-4 pr-11 text-xs sm:text-sm text-white placeholder-slate-400 outline-none font-bold shadow-inner"
            style={{
              backgroundColor: primaryBg,
              borderColor: borderCol
            }}
            dir="rtl"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-4 top-3.5" />
        </div>

        <div
          className="flex items-center gap-2 p-1.5 rounded-2xl border-2 border-b-4 flex-wrap shadow-sm"
          style={{
            backgroundColor: secondaryBg,
            borderColor: borderCol,
            borderBottomColor: borderBottomCol
          }}
        >
          <span className="text-xs text-slate-300 px-2 font-bold">المستوى:</span>
          {(['all', 'قوي', 'متوسط', 'ضعيف'] as const).map(lvl => (
            <button
              key={lvl}
              onClick={() => setLevelFilter(lvl)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border-2 active:translate-y-0.5 ${
                levelFilter === lvl
                  ? 'border-b-4 shadow-md'
                  : 'border-transparent text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              style={levelFilter === lvl ? {
                backgroundColor: accentCol,
                color: primaryBg,
                borderColor: accentCol,
                borderBottomColor: accentShadow
              } : undefined}
            >
              {lvl === 'all' ? 'الكل' : lvl}
            </button>
          ))}
        </div>

        {/* Assignment Status Filter */}
        <div
          className="flex items-center gap-2 p-1.5 rounded-2xl border-2 border-b-4 flex-wrap shadow-sm"
          style={{
            backgroundColor: secondaryBg,
            borderColor: borderCol,
            borderBottomColor: borderBottomCol
          }}
        >
          <span className="text-xs text-slate-300 px-2 font-bold">الحلقة:</span>
          <button
            onClick={() => setAssignmentFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border-2 active:translate-y-0.5 ${
              assignmentFilter === 'all'
                ? 'border-b-4 shadow-md'
                : 'border-transparent text-slate-300 hover:text-white hover:bg-white/10'
            }`}
            style={assignmentFilter === 'all' ? {
              backgroundColor: accentCol,
              color: primaryBg,
              borderColor: accentCol,
              borderBottomColor: accentShadow
            } : undefined}
          >
            الكل ({students.length})
          </button>
          <button
            onClick={() => setAssignmentFilter('assigned')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border-2 active:translate-y-0.5 ${
              assignmentFilter === 'assigned'
                ? 'border-b-4 shadow-md'
                : 'border-transparent text-slate-300 hover:text-white hover:bg-white/10'
            }`}
            style={assignmentFilter === 'assigned' ? {
              backgroundColor: '#58cc02',
              color: '#ffffff',
              borderColor: '#58cc02',
              borderBottomColor: '#46a302'
            } : undefined}
          >
            المرفقين ({assignedStudentsCount})
          </button>
          <button
            onClick={() => setAssignmentFilter('unassigned')}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border-2 active:translate-y-0.5 ${
              assignmentFilter === 'unassigned'
                ? 'border-b-4 shadow-md'
                : unassignedStudentsCount > 0
                ? 'text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border-amber-400/40'
                : 'border-transparent text-slate-300 hover:text-white hover:bg-white/10'
            }`}
            style={assignmentFilter === 'unassigned' ? {
              backgroundColor: '#ff9600',
              color: '#ffffff',
              borderColor: '#ff9600',
              borderBottomColor: '#e68300'
            } : undefined}
          >
            <span>غير المرفقين ({unassignedStudentsCount})</span>
            {unassignedStudentsCount > 0 && <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />}
          </button>
        </div>
      </div>

      {/* Unassigned Students Alert Banner for Supervisor */}
      {unassignedStudentsCount > 0 && isSupervisor && assignmentFilter !== 'unassigned' && (
        <div
          className="border-2 border-b-4 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg"
          style={{
            backgroundColor: `${secondaryBg}`,
            borderColor: '#f59e0b',
            borderBottomColor: '#b45309'
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-200">
                تنبيه: يوجد {unassignedStudentsCount} طالب غير مرفق في أي حلقة قرآنية
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                الطلاب غير المرفقين يظهر لهم في بوابتهم (لم يتم إرفاقك بعد)، ولن يظهروا للمعلمين في الحلقات إلا عند إرفاقهم بحلقة محددة.
              </p>
            </div>
          </div>
          <button
            onClick={() => setAssignmentFilter('unassigned')}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 font-black text-xs flex items-center justify-center gap-1.5 shrink-0 shadow-md cursor-pointer transition-all border-2 border-b-4 border-amber-600 active:translate-y-0.5"
          >
            <span>عرض وتعيين غير المرفقين ({unassignedStudentsCount})</span>
          </button>
        </div>
      )}

      {/* Bulk Selection and Batch Transfer Bar */}
      <div
        className="border-2 border-b-4 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg"
        style={{
          backgroundColor: secondaryBg,
          borderColor: borderCol,
          borderBottomColor: borderBottomCol
        }}
      >
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0 ? handleDeselectAll : handleSelectAllFiltered}
            className="px-3.5 py-2 rounded-xl text-xs font-bold border-2 border-b-4 flex items-center gap-2 cursor-pointer transition-all active:translate-y-0.5"
            style={{
              backgroundColor: cardBg,
              borderColor: borderCol,
              borderBottomColor: borderBottomCol,
              color: '#ffffff'
            }}
          >
            {selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0 ? (
              <>
                <CheckSquare className="w-4 h-4" style={{ color: accentCol }} />
                <span>إلغاء تحديد الكل ({selectedStudentIds.length})</span>
              </>
            ) : (
              <>
                <Square className="w-4 h-4 text-slate-400" />
                <span>تحديد جميع المعروضين ({filteredStudents.length})</span>
              </>
            )}
          </button>

          {selectedStudentIds.length > 0 && (
            <button
              type="button"
              onClick={handleDeselectAll}
              className="text-xs text-slate-400 hover:text-red-300 underline cursor-pointer px-1"
            >
              مسح التحديد
            </button>
          )}

          <div className="text-xs">
            {selectedStudentIds.length > 0 ? (
              <span
                className="px-3 py-1 rounded-xl border-2 border-b-2 font-bold"
                style={{
                  backgroundColor: `${accentCol}20`,
                  borderColor: `${accentCol}50`,
                  color: accentCol
                }}
              >
                تم تحديد <strong>{selectedStudentIds.length}</strong> طالب (إجراءات مجمّعة)
              </span>
            ) : (
              <span className="text-slate-300 text-[11px] hidden sm:inline">
                حدد الطلاب بالضغط على زر المربع في بطاقة أي طالب لنقلهم أو حذفهم دفعة واحدة
              </span>
            )}
          </div>
        </div>

        {/* Bulk Action Buttons (Transfer & Delete) */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Delete Selected Students Button */}
          <button
            type="button"
            disabled={selectedStudentIds.length === 0}
            onClick={() => setIsBulkDeleteModalOpen(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-black bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:hover:bg-red-600 disabled:cursor-not-allowed text-white flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md shrink-0 border-2 border-b-4 border-red-800 active:translate-y-0.5"
            title="حذف جميع الطلاب المحددين نهائياً"
          >
            <Trash2 className="w-4 h-4" />
            <span>حذف المحددين ({selectedStudentIds.length})</span>
          </button>

          {/* Transfer Selected Students Button */}
          <button
            type="button"
            disabled={selectedStudentIds.length === 0}
            onClick={() => {
              const otherHalaqah = halaqahs.find(h => h.id !== activeHalaqahId) || halaqahs[0];
              setBulkTargetHalaqahId(otherHalaqah ? otherHalaqah.id : '');
              setBulkFeedback(null);
              setIsBulkTransferModalOpen(true);
            }}
            className="px-4 sm:px-5 py-2.5 rounded-xl text-xs font-black disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md shrink-0 border-2 border-b-4 active:translate-y-0.5"
            style={{
              backgroundColor: accentCol,
              color: primaryBg,
              borderColor: accentCol,
              borderBottomColor: accentShadow
            }}
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>نقل المحددين ({selectedStudentIds.length}) إلى حلقة</span>
          </button>
        </div>
      </div>

      {/* Student Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStudents.length === 0 ? (
          <div
            className="col-span-full border-2 border-b-4 rounded-[32px] p-12 text-center"
            style={{
              backgroundColor: cardBg,
              borderColor: borderCol,
              borderBottomColor: borderBottomCol
            }}
          >
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-40" style={{ color: accentCol }} />
            <h4 className="text-base font-bold text-white">لا يوجد طلاب مطابقون للبحث</h4>
            <p className="text-xs text-slate-300 mt-1">
              تأكد من كتابة الاسم بشكل صحيح أو أضف طالباً جديداً
            </p>
          </div>
        ) : (
          filteredStudents.map(student => {
            const isSelected = selectedStudentIds.includes(student.id);

            return (
              <div
                key={student.id}
                id={`student-item-${student.id}`}
                data-item-id={student.id}
                className={`border-2 border-b-4 rounded-[28px] p-5 flex flex-col justify-between gap-4 transition-all duration-200 hover:shadow-xl ${
                  isSelected ? 'ring-2 ring-amber-400/40 shadow-lg' : ''
                }`}
                style={{
                  backgroundColor: cardBg,
                  borderColor: isSelected ? accentCol : borderCol,
                  borderBottomColor: isSelected ? accentShadow : borderBottomCol
                }}
              >
                {/* Card Top */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {/* Selection Checkbox */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStudentIds(prev =>
                            prev.includes(student.id)
                              ? prev.filter(id => id !== student.id)
                              : [...prev, student.id]
                          );
                        }}
                        className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center shrink-0 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-b-4 font-black'
                            : 'border-slate-600/40 hover:border-amber-400/60'
                        }`}
                        style={isSelected ? {
                          backgroundColor: accentCol,
                          color: primaryBg,
                          borderColor: accentCol,
                          borderBottomColor: accentShadow
                        } : {
                          backgroundColor: primaryBg,
                          color: '#ffffff'
                        }}
                        title={isSelected ? 'إلغاء تحديد الطالب' : 'تحديد الطالب للنقل'}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-400" />
                        )}
                      </button>

                      {/* Student Avatar Initial Badge (Dynamically colored by active Complex Theme) */}
                      <div
                        className="w-12 h-12 rounded-2xl border-2 border-b-4 flex items-center justify-center text-xl font-black shadow-md shrink-0 transition-all select-none"
                        style={{
                          backgroundColor: `${accentCol}22`,
                          borderColor: `${accentCol}90`,
                          borderBottomColor: accentShadow,
                          color: accentCol
                        }}
                      >
                        {student.name.trim().charAt(0) || 'ط'}
                      </div>

                      <div>
                        <h3 className="text-sm font-black text-white line-clamp-1">{student.name}</h3>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-300 font-bold flex-wrap">
                          <span>{student.age} سنة</span>
                          {(!student.halaqahId || student.halaqahId.trim() === '' || student.halaqahId === 'unassigned' || student.halaqahId === 'none') ? (
                            <>
                              <span>•</span>
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-black border"
                                style={{
                                  backgroundColor: 'rgba(245, 158, 11, 0.2)',
                                  color: '#fbbf24',
                                  borderColor: 'rgba(245, 158, 11, 0.4)'
                                }}
                              >
                                غير مرفق بحلقة
                              </span>
                            </>
                          ) : (
                            student.halaqahName && (
                              <>
                                <span>•</span>
                                <span
                                  className="px-2.5 py-0.5 rounded-full text-[10px] font-black border-2 border-b-2 shadow-xs"
                                  style={{
                                    backgroundColor: `${accentCol}20`,
                                    borderColor: `${accentCol}60`,
                                    borderBottomColor: accentShadow,
                                    color: accentCol
                                  }}
                                >
                                  {student.halaqahName}
                                </span>
                              </>
                            )
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(student)}
                        title="تعديل بيانات الطالب"
                        className="p-2 rounded-xl text-slate-300 hover:text-white transition-colors cursor-pointer border border-white/5 hover:border-white/20"
                        style={{ backgroundColor: primaryBg }}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setStudentToDelete(student)}
                        title="حذف الطالب"
                        className="p-2 rounded-xl text-red-400 hover:text-red-300 transition-colors cursor-pointer border border-white/5 hover:border-red-500/30"
                        style={{ backgroundColor: primaryBg }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Progress Details Card with Dynamic Complex Theme */}
                  <div
                    className="mt-4 border-2 border-b-4 rounded-2xl p-3.5 space-y-1.5 text-xs font-bold transition-all shadow-sm"
                    style={{
                      backgroundColor: secondaryBg,
                      borderColor: borderCol,
                      borderBottomColor: borderBottomCol
                    }}
                  >
                    <div className="flex items-center justify-between text-white">
                      <span className="text-slate-300 font-bold">موضع الحفظ الحالي:</span>
                      <span className="font-black" style={{ color: accentCol }}>
                        سورة {student.currentSurahName} (الآية {student.currentAyah})
                      </span>
                    </div>
                    {(() => {
                      const curPage = getPageOfAyah(student.currentSurah || 78, student.currentAyah || 1);
                      return (
                        <div className="flex items-center justify-between text-white">
                          <span className="text-slate-300 font-bold">الوجه الحالي بالمصحف:</span>
                          <span className="font-bold opacity-90" style={{ color: accentCol }}>
                            الوجه {curPage} من 604
                          </span>
                        </div>
                      );
                    })()}
                    <div className="flex items-center justify-between text-white pt-1.5 border-t border-white/10">
                      <span className="text-slate-300 font-bold">ولي الأمر:</span>
                      <span className="text-white font-bold">{student.parentName}</span>
                    </div>
                    {student.parentPhones && student.parentPhones.length > 0 && (
                      <div className="flex items-center gap-1.5 text-[11px] overflow-hidden pt-0.5" style={{ color: accentCol }}>
                        <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: accentCol }} />
                        <span className="truncate font-mono font-bold" dir="ltr">
                          {student.parentPhones.join(' • ')}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Quick Assign Action for Unassigned Students */}
                  {(!student.halaqahId || student.halaqahId.trim() === '' || student.halaqahId === 'unassigned' || student.halaqahId === 'none') && isSupervisor && (
                    <button
                      onClick={() => {
                        setQuickAssignStudent(student);
                        setQuickSelectedHalaqahId(halaqahs[0]?.id || '');
                      }}
                      className="w-full mt-3 py-2 px-3 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm border-2 border-b-4 active:translate-y-0.5"
                      style={{
                        backgroundColor: 'rgba(245, 158, 11, 0.2)',
                        color: '#fbbf24',
                        borderColor: 'rgba(245, 158, 11, 0.5)',
                        borderBottomColor: '#b45309'
                      }}
                    >
                      <UserPlus className="w-3.5 h-3.5 text-amber-300" />
                      <span>إرفاق هذا الطالب بحلقة قرآنية الآن</span>
                    </button>
                  )}
                </div>

                {/* Plan Banner / Action */}
                <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setViewingPlanStudent(student)}
                    className="flex-1 py-2.5 px-3 rounded-2xl border-2 border-b-4 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:translate-y-0.5 hover:brightness-110"
                    style={{
                      backgroundColor: 'var(--complex-secondary, #1b2e35)',
                      borderColor: 'var(--complex-border, #2b4550)',
                      borderBottomColor: 'var(--complex-card-shadow, #16262e)',
                      color: 'var(--complex-accent, #ffc800)'
                    }}
                  >
                    <BookOpen className="w-3.5 h-3.5" style={{ color: 'var(--complex-accent, #ffc800)' }} />
                    <span>عرض الخطة المنهجية والتثبيت</span>
                    {student.memorizationPlan?.targetCompletionDate ? (
                      <span className="text-[10px] text-emerald-300 font-bold">
                        (الختم: {student.memorizationPlan.targetCompletionDate})
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-300/90 font-bold">
                        (الذكاء الاصطناعي جاهز للضبط)
                      </span>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit Student Modal */}
      {isAddModalOpen && editingStudent && (
        <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto overscroll-contain">
          <div className="relative w-full max-w-2xl bg-[#064e3b] border border-[#fbbf24]/30 rounded-2xl sm:rounded-[32px] shadow-2xl shadow-emerald-950/90 flex flex-col max-h-[90vh] my-auto overflow-hidden overscroll-contain animate-fadeIn">
            {/* Pinned Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[#065f46] shrink-0 bg-[#064e3b]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#fbbf24] text-[#064e3b] flex items-center justify-center font-bold shadow-md shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold font-heading text-[#fbbf24]">
                    تعديل بيانات الطالب
                  </h3>
                  <p className="text-[11px] sm:text-xs text-[#86efac]">
                    تحديث بيانات الطالب وموضعه الحالي وسجلاته في الحلقة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 rounded-xl text-[#86efac] hover:text-white hover:bg-[#022c22] cursor-pointer transition-colors"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Modal Body */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
                {formError && (
                  <div className="p-3 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-200 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Row 1: Student Basic Info */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-[#86efac] text-right">
                        اسم الطالب الثلاثي <span className="text-red-400">* (إلزامي)</span>
                      </label>
                      {formName.trim().length > 0 && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                          getThreePartNameValidation(formName, 'طالب').isValid
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}>
                          {getThreePartNameValidation(formName, 'طالب').isValid ? (
                            <>
                              <CheckCircle className="w-3 h-3" />
                              <span>ثلاثي مكتمل</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3 h-3" />
                              <span>يلزم 3 أسماء على الأقل</span>
                            </>
                          )}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      placeholder="مثال: عبد الله محمد القاسمي أو عمر بن خالد التميمي"
                      className="w-full bg-[#022c22] border border-[#065f46] focus:border-[#fbbf24] rounded-2xl py-2.5 px-3.5 text-sm text-[#f0f9f6] outline-none transition-colors"
                      dir="rtl"
                    />
                    <p className="text-[10px] text-[#86efac]/70 mt-1">
                      * يشترط كتابة الاسم الثلاثي كاملاً (الاسم، اسم الأب، واسم العائلة/الجد).
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#86efac] mb-1 text-right">
                      العمر (سنوات)
                    </label>
                    <input
                      type="number"
                      min={4}
                      max={40}
                      value={formAge}
                      onChange={e => setFormAge(Number(e.target.value))}
                      className="w-full bg-[#022c22] border border-[#065f46] focus:border-[#fbbf24] rounded-2xl py-2.5 px-3.5 text-sm text-[#f0f9f6] outline-none transition-colors"
                    />
                  </div>
                </div>

                {/* Row 2: Credentials */}
                <div>
                  <label className="block text-xs font-semibold text-[#86efac] mb-1 text-right">
                    كلمة مرور حساب الطالب <span className="text-xs text-[#86efac]/70">(لتسجيل الدخول إلى البوابة)</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formPassword}
                    onChange={e => setFormPassword(e.target.value)}
                    placeholder="كلمة مرور للدخول"
                    className="w-full bg-[#022c22] border border-[#065f46] focus:border-[#fbbf24] rounded-2xl py-2.5 px-3.5 text-sm text-[#f0f9f6] outline-none transition-colors"
                    dir="ltr"
                  />
                </div>

                {/* Row 3: Parent Info & Multiple Parent Phones */}
                <div className="bg-[#022c22]/80 border border-[#065f46] rounded-2xl p-3.5 sm:p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#86efac] mb-1 text-right">
                      اسم ولي الأمر
                    </label>
                    <input
                      type="text"
                      value={formParentName}
                      onChange={e => setFormParentName(e.target.value)}
                      placeholder="اسم والد الطالب / ولي أمره"
                      className="w-full bg-[#064e3b]/80 border border-[#065f46] focus:border-[#fbbf24] rounded-2xl py-2.5 px-3.5 text-sm text-[#f0f9f6] outline-none transition-colors"
                      dir="rtl"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                      <label className="text-xs font-semibold text-[#86efac] text-right">
                        أرقام هواتف أولياء الأمور (لواتساب المتابعة)
                      </label>
                      <button
                        type="button"
                        onClick={handleAddParentPhone}
                        className="text-[11px] text-[#fbbf24] hover:text-[#f59e0b] flex items-center gap-1 font-bold cursor-pointer py-1 px-2 rounded-lg hover:bg-[#064e3b]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إضافة رقم هاتف آخر</span>
                      </button>
                    </div>
                    <div className="space-y-2">
                      {formParentPhones.map((phone, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="tel"
                            value={phone}
                            onChange={e => handleParentPhoneChange(idx, e.target.value)}
                            placeholder="رقم الواتساب (مثال: 966501234567)"
                            className="flex-1 bg-[#064e3b]/80 border border-[#065f46] focus:border-[#fbbf24] rounded-2xl py-2 px-3.5 text-sm text-[#f0f9f6] outline-none transition-colors"
                            dir="ltr"
                          />
                          {formParentPhones.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveParentPhone(idx)}
                              className="p-2 text-[#86efac] hover:text-red-400 hover:bg-[#022c22] rounded-xl cursor-pointer shrink-0"
                              title="حذف هذا الرقم"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Row 4: Quran Position (Surah & Ayah) */}
                <div className="bg-[#022c22]/80 border border-[#065f46] rounded-2xl p-3.5 sm:p-4 space-y-3">
                  <div className="text-xs font-bold text-[#fbbf24] flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4" />
                    <span>موضع الحفظ الحالي للقرآن الكريم</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#86efac] mb-1 text-right">
                        اختر السورة
                      </label>
                      <select
                        value={formSurahNum}
                        onChange={e => setFormSurahNum(Number(e.target.value))}
                        className="w-full bg-[#064e3b]/80 border border-[#065f46] focus:border-[#fbbf24] rounded-2xl py-2.5 px-3 text-sm text-[#f0f9f6] outline-none"
                      >
                        {QURAN_SURAHS.map(s => (
                          <option key={s.number} value={s.number} className="bg-[#064e3b] text-white">
                            {s.number}. سورة {s.name} ({s.numberOfAyahs} آية - الجزء {s.juz})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#86efac] mb-1 text-right">
                        رقم الآية التي وصل إليها
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={286}
                        value={formAyah}
                        onChange={e => setFormAyah(Number(e.target.value))}
                        className="w-full bg-[#064e3b]/80 border border-[#065f46] focus:border-[#fbbf24] rounded-2xl py-2.5 px-3 text-sm text-[#f0f9f6] outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Halaqah Selection (if multi-halaqah exists) */}
                {halaqahs.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-[#86efac] mb-1 text-right">
                      الحلقة التابع لها الطالب
                    </label>
                    <select
                      value={formHalaqahId}
                      onChange={e => setFormHalaqahId(e.target.value)}
                      className="w-full bg-[#022c22] border border-[#065f46] focus:border-[#fbbf24] rounded-2xl py-2.5 px-3 text-sm text-[#f0f9f6] outline-none cursor-pointer"
                    >
                      <option value="" className="bg-[#064e3b] text-amber-300 font-bold">
                        غير مرفق بحلقة بعد (في قائمة الانتظار)
                      </option>
                      {halaqahs.map(h => {
                        const hCount = students.filter(s => s.halaqahId === h.id).length;
                        const cap = h.capacity && h.capacity > 0 ? h.capacity : Math.max(1, hCount);
                        const isFull = hCount >= cap;
                        return (
                          <option
                            key={h.id}
                            value={h.id}
                            className={`bg-[#064e3b] ${isFull ? 'text-amber-300 font-bold' : 'text-white'}`}
                          >
                            {h.name} {h.primaryTeacherName ? `(المعلم: ${h.primaryTeacherName})` : ''} - [{hCount} / {cap} طالب]{isFull ? ' ⚠️ [مكتملة]' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
              </div>

              {/* Pinned Modal Footer */}
              <div className="flex items-center justify-end gap-3 p-4 sm:p-5 border-t border-[#065f46] shrink-0 bg-[#022c22]/95">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-2xl text-[#86efac] hover:text-white hover:bg-[#064e3b] text-xs font-bold cursor-pointer transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-2xl bg-[#fbbf24] hover:bg-[#f59e0b] disabled:opacity-50 text-[#064e3b] text-xs sm:text-sm font-black shadow-[0_0_20px_rgba(251,191,36,0.3)] flex items-center gap-2 cursor-pointer transition-all"
                >
                  {isSubmitting ? (
                    <span>جاري حفظ البيانات...</span>
                  ) : (
                    <>
                      <Edit className="w-4 h-4 text-[#064e3b]" />
                      <span>حفظ التعديلات</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Delete Students Confirmation Modal */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain">
          <div className="relative w-full max-w-lg bg-[#064e3b] border border-red-500/50 rounded-3xl p-6 shadow-2xl shadow-emerald-950/90 flex flex-col gap-4 my-auto overscroll-contain animate-fadeIn text-right">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#065f46] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/40 text-red-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">تأكيد حذف الطلاب المحددين نهائياً</h3>
                  <p className="text-xs text-red-200/90 mt-0.5">
                    سيتم حذف ({selectedStudentIds.length}) طالب وكافة سجلاتهم نهائياً من السحابة
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="p-1.5 rounded-lg text-[#86efac] hover:text-white hover:bg-[#022c22] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selected Students Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#86efac]">
                <span>الطلاب المختارون للحذف ({selectedStudentIds.length}):</span>
                <span className="text-[11px] text-red-300 font-mono">
                  {selectedStudentIds.length} طالب
                </span>
              </div>

              <div className="max-h-40 overflow-y-auto bg-[#022c22]/90 border border-red-500/30 rounded-2xl p-2.5 flex flex-wrap gap-1.5">
                {selectedStudentIds.map(sId => {
                  const st = students.find(s => s.id === sId);
                  if (!st) return null;
                  return (
                    <span
                      key={st.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-red-950/40 text-white border border-red-500/30 text-xs"
                    >
                      <span className="font-bold">{st.name}</span>
                      <span className="text-[10px] text-[#86efac]">
                        ({st.halaqahName || 'غير مرفق'})
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedStudentIds(prev => prev.filter(id => id !== st.id))}
                        className="text-slate-400 hover:text-white cursor-pointer"
                        title="إزالة من قائمة الحذف"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-[11px] text-red-200 leading-relaxed space-y-1">
              <div className="font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span>تحذير لا يمكن التراجع عنه:</span>
              </div>
              <div>
                سيتم حذف كافة سجلات التسميع اليومية، ودرجات الاختبارات، وسجلات الحضور والغياب، والخطط المنهجية لجميع الطلاب المحددين ({selectedStudentIds.length}) وحذفهم من السحابة فوراً.
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isBulkDeleting}
                onClick={() => setIsBulkDeleteModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#022c22] text-[#86efac] hover:text-white border border-[#065f46] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isBulkDeleting || selectedStudentIds.length === 0}
                onClick={handleConfirmBulkDelete}
                className="px-6 py-2.5 rounded-xl text-xs font-black bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg shadow-red-950/40 cursor-pointer transition-all flex items-center gap-2"
              >
                {isBulkDeleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري الحذف السحابي...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>نعم، حذف ({selectedStudentIds.length}) طالب نهائياً</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Plan Modal */}
      {viewingPlanStudent && (() => {
        const studentMemJuz = calculateStudentMemorizedJuz(viewingPlanStudent);
        const fallbackTimeline = calculateRealisticKhatmTimeline({
          memorizedJuz: studentMemJuz,
          consolidatedJuz: Math.max(0, studentMemJuz - 2),
          dailyNewPages: 1,
          dailyReviewPages: 5,
          weeklyDaysCount: 5,
          dailyHoursCount: 2
        });
        const plan = viewingPlanStudent.memorizationPlan;
        const targetDate = plan?.targetCompletionDate || fallbackTimeline.targetCompletionDate;
        const daysRemaining = plan?.estimatedDaysRemaining || fallbackTimeline.estimatedDaysRemaining;
        const progressPct = plan?.progressPercentage || fallbackTimeline.progressPercentage;

        return (
          <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto overscroll-contain">
            <div className="relative w-full max-w-xl bg-[#064e3b] border-2 border-amber-400/50 rounded-2xl sm:rounded-[32px] shadow-2xl shadow-emerald-950/90 flex flex-col max-h-[90vh] my-auto overflow-hidden overscroll-contain animate-fadeIn text-right" dir="rtl">
              {/* Header */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[#065f46] shrink-0 bg-[#064e3b]">
                <div className="flex items-center gap-2.5 text-amber-300 font-bold font-heading text-sm sm:text-base">
                  <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center border border-amber-400/30">
                    <BookOpen className="w-5 h-5 shrink-0" />
                  </div>
                  <div>
                    <span className="line-clamp-1 text-white font-black">الخطة القرآنية المنهجية: {viewingPlanStudent.name}</span>
                    <span className="text-[11px] text-[#86efac] font-bold block">{viewingPlanStudent.halaqahName || 'حلقة القرآن الكريم'}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewingPlanStudent(null)}
                  className="p-1.5 text-[#86efac] hover:text-white rounded-xl cursor-pointer hover:bg-[#022c22]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-xs">
                {/* Target Date Main Duolingo Card */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#022c22] border-2 border-amber-400/40 space-y-3 shadow-md">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>موعد الختم المحسوب بدقة:</span>
                    </span>
                    <span className="text-xs font-mono font-black px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/40">
                      متبقي قرابة {toArabicNumerals(daysRemaining)} يوماً
                    </span>
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-white font-heading">
                    {targetDate}
                  </div>
                  {/* Progress towards 30 Juz */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] text-[#86efac] font-bold">
                      <span>نسبة الإنجاز نحو الختمة (30 جزء):</span>
                      <span className="font-mono font-black text-amber-300">{progressPct}%</span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-black/40 border border-[#065f46] overflow-hidden p-0.5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-amber-400 transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(5, progressPct))}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Pedagogical Roadmap Card */}
                <div className="p-4 rounded-2xl bg-[#022c22]/80 border border-[#065f46] space-y-1.5">
                  <span className="text-[11px] font-bold text-amber-300 block">
                    خارطة الطريق والتوجيه التربوي المعتمد:
                  </span>
                  <p className="text-[#f0f9f6] leading-relaxed text-xs">
                    {plan?.aiNotes || viewingPlanStudent.aiPlan?.roadmapSummary || fallbackTimeline.pedagogicalNote}
                  </p>
                </div>

                {/* Daily Assignment Grid */}
                <div className="p-4 rounded-2xl bg-[#022c22]/80 border border-[#065f46] space-y-2.5">
                  <span className="text-[11px] font-bold text-[#86efac] block">
                    مقرر الورد اليومي والتثبيت المبرمج:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-black/20 border border-white/5">
                      <span className="text-[#86efac] font-bold block text-[10px]">الحفظ الجديد اليومي:</span>
                      <span className="font-bold text-amber-300">
                        {plan?.nextDayAssignment?.newMemorization || viewingPlanStudent.aiPlan?.currentDailyAssignment?.newMemorization || viewingPlanStudent.dailyNewTarget || 'وجه واحد'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-black/20 border border-white/5">
                      <span className="text-[#86efac] font-bold block text-[10px]">المراجعة والتثبيت:</span>
                      <span className="font-bold text-emerald-300">
                        {plan?.nextDayAssignment?.review || viewingPlanStudent.aiPlan?.currentDailyAssignment?.review || viewingPlanStudent.dailyReviewTarget || '5 أوجه'}
                      </span>
                    </div>
                  </div>
                  {viewingPlanStudent.aiPlan?.currentDailyAssignment?.suggestedSheikh && (
                    <div className="pt-1 text-[11px] text-[#f0f9f6] flex items-center justify-between">
                      <span className="text-[#86efac]">القارئ الموصى به للاستماع:</span>
                      <span className="font-bold text-amber-300">{viewingPlanStudent.aiPlan.currentDailyAssignment.suggestedSheikh}</span>
                    </div>
                  )}
                </div>

                {/* Tathbeet Stops & Milestones */}
                {(plan?.milestones || fallbackTimeline.milestones).length > 0 && (
                  <div className="p-4 rounded-2xl bg-[#022c22]/80 border border-[#065f46] space-y-2">
                    <span className="text-[11px] font-bold text-white block">
                      مراحل ووقفات التثبيت التراكمي المجدولة:
                    </span>
                    <div className="space-y-1.5">
                      {(plan?.milestones || fallbackTimeline.milestones).map((m, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-white/5 text-xs">
                          <span className="text-slate-200 font-bold">{m.label}</span>
                          <span className="text-amber-300 font-mono font-black">{m.targetDate}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 sm:p-5 border-t border-[#065f46] shrink-0 bg-[#022c22]/95 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setViewingPlanStudent(null)}
                  className="px-6 py-2.5 rounded-2xl bg-[#fbbf24] hover:bg-[#f59e0b] text-[#064e3b] font-black text-xs cursor-pointer shadow-md"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Delete Student Confirmation Modal */}
      {studentToDelete && (
        <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain">
          <div className="relative w-full max-w-sm bg-[#064e3b] border border-red-500/50 rounded-2xl sm:rounded-[32px] p-5 sm:p-7 shadow-2xl space-y-4 text-center my-auto overscroll-contain animate-fadeIn">
            <div className="w-14 h-14 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto border border-red-500/30">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-heading">تأكيد حذف الطالب نهائياً</h3>
              <p className="text-xs text-[#86efac]/90 mt-2 leading-relaxed">
                هل أنت متأكد من رغبتك في حذف حساب الطالب <span className="text-[#fbbf24] font-black">"{studentToDelete.name}"</span> نهائياً؟
                <br />
                <span className="text-red-300 text-[11px]">سيتم حذف كافة سجلات التسميع والحضور والخطة الخاصة به.</span>
              </p>
              {Boolean(studentToDelete.isGoogleLinked || studentToDelete.googleEmail) && (
                <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs text-right mt-3 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>🔗</span>
                    <span>حساب Google مرتبط بهذا الطالب:</span>
                  </div>
                  <div className="font-mono text-xs text-white" dir="ltr">
                    {studentToDelete.googleEmail}
                  </div>
                  <div className="text-[11px] text-amber-200/90 leading-tight">
                    سيتم فك ارتباط حساب Google وحذف بيانات اعتماده نهائياً مع إتمام عملية الحذف.
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-3 pt-2 flex-col sm:flex-row">
              <button
                type="button"
                disabled={isDeletingStudent}
                onClick={() => !isDeletingStudent && setStudentToDelete(null)}
                className="w-full sm:flex-1 py-2.5 rounded-2xl text-xs font-bold bg-[#022c22] text-[#86efac] hover:text-white border border-[#065f46] cursor-pointer disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isDeletingStudent}
                onClick={async () => {
                  if (studentToDelete && !isDeletingStudent) {
                    setIsDeletingStudent(true);
                    try {
                      const id = studentToDelete.id;
                      await onDeleteStudent(id);
                      setStudentToDelete(null);
                    } catch (e) {
                      console.error('Delete student failed:', e);
                    } finally {
                      setIsDeletingStudent(false);
                    }
                  }
                }}
                className="w-full sm:flex-1 py-2.5 rounded-2xl text-xs font-black bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:opacity-75 text-white shadow-lg cursor-pointer transition-all flex items-center justify-center gap-2"
              >
                {isDeletingStudent ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>جاري الحذف...</span>
                  </>
                ) : (
                  <span>نعم، تأكيد الحذف</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Assign Halaqah Modal */}
      {quickAssignStudent && (
        <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain">
          <div className="relative w-full max-w-md bg-[#064e3b] border border-amber-500/40 rounded-3xl p-6 shadow-2xl shadow-emerald-950/90 flex flex-col gap-4 my-auto overscroll-contain animate-fadeIn">
            <div className="flex items-center gap-3 border-b border-[#065f46] pb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">إرفاق الطالب بحلقة قرآنية</h3>
                <p className="text-xs text-[#86efac]/80 mt-0.5">
                  الطالب: <span className="text-amber-300 font-bold">{quickAssignStudent.name}</span>
                </p>
              </div>
            </div>

            <p className="text-xs text-[#86efac]/90 leading-relaxed">
              اختر الحلقة القرآنية التي ترغب في إلحاق الطالب بها. بعد التأكيد، سيتم الحفظ سحابياً وبشكل دائم وسيتمكن الطالب من الدخول لمعلمه ومتابعة الحفظ فوراً.
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#86efac] text-right">
                اختر الحلقة القرآنية:
              </label>
              <select
                value={quickSelectedHalaqahId || (halaqahs[0]?.id || '')}
                onChange={e => setQuickSelectedHalaqahId(e.target.value)}
                className="w-full bg-[#022c22] border border-[#065f46] focus:border-amber-400 rounded-2xl py-3 px-3.5 text-sm text-[#f0f9f6] outline-none cursor-pointer font-bold"
              >
                {halaqahs.map(h => (
                  <option key={h.id} value={h.id} className="bg-[#064e3b] text-white">
                    {h.name} — المعلم: {h.primaryTeacherName || 'المعلم المسؤول'}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isQuickAssigning}
                onClick={() => {
                  setQuickAssignStudent(null);
                  setQuickSelectedHalaqahId('');
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#022c22] text-[#86efac] hover:text-white border border-[#065f46] cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isQuickAssigning}
                onClick={() => {
                  const targetId = quickSelectedHalaqahId || (halaqahs[0]?.id || '');
                  if (targetId) {
                    setQuickSelectedHalaqahId(targetId);
                    handleQuickAssign();
                  }
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-[#022c22] shadow-lg cursor-pointer transition-all flex items-center gap-1.5"
              >
                {isQuickAssigning ? (
                  <span>جاري الإرفاق السحابي...</span>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>تأكيد الإرفاق والحفظ السحابي</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Transfer Modal */}
      {isBulkTransferModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain">
          <div className="relative w-full max-w-lg bg-[#064e3b] border border-[#fbbf24]/40 rounded-3xl p-6 shadow-2xl shadow-emerald-950/90 flex flex-col gap-4 my-auto overscroll-contain animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#065f46] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#fbbf24]/20 border border-[#fbbf24]/40 text-[#fbbf24] flex items-center justify-center shrink-0">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">نقل جماعي للطلاب المحددين</h3>
                  <p className="text-xs text-[#86efac]/90 mt-0.5">
                    سيتم نقل جميع الطلاب المحددين وتحديث بياناتهم في السحابة فوراً
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsBulkTransferModalOpen(false);
                  setBulkFeedback(null);
                }}
                className="p-1.5 rounded-lg text-[#86efac] hover:text-white hover:bg-[#022c22] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {bulkFeedback && (
              <div
                className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${
                  bulkFeedback.type === 'success'
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-200'
                    : 'bg-red-500/20 border border-red-500/40 text-red-200'
                }`}
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{bulkFeedback.text}</span>
              </div>
            )}

            {/* Selected Students Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#86efac]">
                <span>الطلاب المختارون للنقل ({selectedStudentIds.length}):</span>
                <span className="text-[11px] text-amber-300">
                  {selectedStudentIds.length} طالب
                </span>
              </div>

              <div className="max-h-36 overflow-y-auto bg-[#022c22]/90 border border-[#065f46] rounded-2xl p-2.5 flex flex-wrap gap-1.5">
                {selectedStudentIds.map(sId => {
                  const st = students.find(s => s.id === sId);
                  if (!st) return null;
                  return (
                    <span
                      key={st.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#064e3b] text-white border border-[#065f46] text-xs"
                    >
                      <span className="font-bold">{st.name}</span>
                      <span className="text-[10px] text-[#86efac]">
                        ({st.halaqahName || 'غير مرفق'})
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedStudentIds(prev => prev.filter(id => id !== st.id))}
                        className="text-slate-400 hover:text-red-300 cursor-pointer"
                        title="إزالة من التحديد"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Target Halaqah Select */}
            <form onSubmit={handleBulkTransferSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[#86efac] text-right">
                  اختر الحلقة المستهدفة لنقل الطلاب إليها:
                </label>
                <select
                  value={bulkTargetHalaqahId}
                  onChange={e => setBulkTargetHalaqahId(e.target.value)}
                  className="w-full bg-[#022c22] border border-[#065f46] focus:border-[#fbbf24] rounded-2xl py-3 px-3.5 text-sm text-[#f0f9f6] outline-none cursor-pointer font-bold"
                >
                  <option value="" disabled>-- اختر الحلقة المستهدفة --</option>
                  {halaqahs.map(h => (
                    <option key={h.id} value={h.id} className="bg-[#064e3b] text-white">
                      {h.name} {h.primaryTeacherName ? `(المعلم: ${h.primaryTeacherName})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-[#022c22]/60 border border-[#065f46] rounded-xl text-[11px] text-[#86efac]/80 leading-relaxed">
                ℹ️ سيتم نقل جميع الطلاب المحددين إلى الحلقة المختارة سحابياً وبشكل دائم، مع الاحتفاظ بكامل سجلات التسميع والتقييمات والخطط اليومية دون أي فقدان.
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isBulkTransferring}
                  onClick={() => {
                    setIsBulkTransferModalOpen(false);
                    setBulkFeedback(null);
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#022c22] text-[#86efac] hover:text-white border border-[#065f46] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isBulkTransferring || selectedStudentIds.length === 0 || !bulkTargetHalaqahId}
                  className="px-6 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-[#fbbf24] to-[#f59e0b] text-[#064e3b] shadow-lg shadow-amber-950/30 cursor-pointer transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isBulkTransferring ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جاري النقل السحابي...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="w-4 h-4" />
                      <span>تأكيد نقل {selectedStudentIds.length} طالب سحابياً</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complex Dedicated Portal & Registration Settings Modal */}
      {activeComplex && (
        <ComplexPortalSettingsModal
          isOpen={isPortalSettingsOpen}
          onClose={() => setIsPortalSettingsOpen(false)}
          complex={activeComplex}
          halaqahs={halaqahs}
          onUpdateComplex={async (updated) => {
            await OmranDataService.saveComplex(updated);
          }}
          onStudentCreatedFromApp={(st) => {
            onAddStudent(st);
          }}
        />
      )}
    </div>
  );
};
