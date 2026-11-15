import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Settings,
  Users,
  Layers,
  ArrowRightLeft,
  Sliders,
  Plus,
  Trash2,
  Edit2,
  Check,
  AlertTriangle,
  UserCheck,
  Search,
  CheckSquare,
  Square,
  Sparkles,
  Phone,
  Shield,
  Key,
  KeyRound,
  BookOpen,
  Palette,
  Eye,
  EyeOff,
  Copy,
  Database,
  CheckCircle2,
  AlertCircle,
  Upload,
  ArrowLeftRight,
  RefreshCw,
  Wand2,
  Globe,
  Mail,
  Send,
  ExternalLink,
  ChevronDown,
  Clock,
  Building2
} from 'lucide-react';
import {
  TeacherAccount,
  Halaqah,
  Student,
  AppSettings,
  QuranComplex,
  ComplexThemeConfig,
  getThreePartNameValidation,
  isTeacherDeveloper,
  getTeacherSixDigitCode,
  normalizeArabicDigits,
  normalizeTeacherText,
  normalizeArabicText
} from '../types';
import {
  ISLAMIC_THEME_PRESETS,
  applyComplexThemeToDOM,
  extractColorsFromImageDataUrl,
  darkenHex,
  lightenHex,
  getContrastTextColor
} from '../lib/themeUtils';
import { OmranDataService } from '../lib/firebase';
import { triggerComplexThemePulse } from '../utils/highlightHelper';
import { ApiConfig } from '../lib/apiConfig';
import { loadSavedMailConfigFromCloud, saveMailConfigToCloudForever } from '../lib/portalEmailService';

export interface DuoSettingsSelectOption {
  value: string;
  label: string;
  subLabel?: string;
}

interface DuoSettingsSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: DuoSettingsSelectOption[];
  placeholder?: string;
  primaryColor: string;
  secondaryColor: string;
  cardColor: string;
  accentColor: string;
  borderColor: string;
  shadowColor: string;
  accentShadowColor: string;
  accentTextColor: string;
  textColor?: string;
  compact?: boolean;
  className?: string;
}

const DuoSettingsSelect: React.FC<DuoSettingsSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = '-- اختر --',
  primaryColor,
  secondaryColor,
  cardColor,
  accentColor,
  borderColor,
  shadowColor,
  accentShadowColor,
  accentTextColor,
  textColor = '#ffffff',
  compact = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [openDirection, setOpenDirection] = useState<'down' | 'up'>('down');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  const toggleOpen = () => {
    if (!isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 240 && rect.top > 220) {
        setOpenDirection('up');
      } else {
        setOpenDirection('down');
      }
    }
    setIsOpen(prev => !prev);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (searchInputRef.current) searchInputRef.current.focus();
      const timer = setTimeout(() => {
        if (selectedItemRef.current && listContainerRef.current) {
          selectedItemRef.current.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
        }
      }, 40);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const selectedOption = options.find(o => o.value === value);
  const filteredOptions = searchTerm.trim()
    ? options.filter(
        o =>
          o.label.toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
          (o.subLabel && o.subLabel.toLowerCase().includes(searchTerm.trim().toLowerCase()))
      )
    : options;

  return (
    <div ref={containerRef} className={`relative w-full ${isOpen ? 'z-[75]' : 'z-10'} ${className}`}>
      <button
        type="button"
        onClick={toggleOpen}
        className={`w-full flex items-center justify-between gap-2 border-2 border-b-4 rounded-2xl ${
          compact ? 'py-2 px-3 text-xs' : 'py-2.5 px-3.5 text-xs sm:text-sm'
        } font-black transition-all shadow-sm active:translate-y-[2px] active:border-b-2 hover:brightness-110 cursor-pointer text-right`}
        style={{
          backgroundColor: primaryColor,
          borderColor: isOpen ? accentColor : borderColor,
          borderBottomColor: isOpen ? accentShadowColor : shadowColor,
          color: textColor
        }}
      >
        <span className="truncate flex-1 text-right">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: accentColor }}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute ${
            openDirection === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          } right-0 z-[85] w-full min-w-[min(200px,calc(100vw-2.5rem))] max-h-64 overflow-hidden rounded-2xl border-2 border-b-4 shadow-2xl p-1.5 space-y-1`}
          style={{
            backgroundColor: cardColor,
            borderColor: accentColor,
            borderBottomColor: accentShadowColor
          }}
        >
          {options.length > 7 && (
            <div className="p-1 mb-1 border-b border-white/10 sticky top-0 z-10" style={{ backgroundColor: cardColor }}>
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 absolute right-2.5 text-slate-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="بحث سريع..."
                  className="w-full pr-8 pl-2 py-1.5 text-xs rounded-xl border-2 text-white placeholder-slate-400 focus:outline-none font-bold text-right"
                  style={{
                    backgroundColor: primaryColor,
                    borderColor: borderColor
                  }}
                  onClick={e => e.stopPropagation()}
                />
              </div>
            </div>
          )}

          <div ref={listContainerRef} className="max-h-52 overflow-y-auto space-y-1 custom-scrollbar pr-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-3 text-center text-xs text-slate-400 font-bold">لا توجد نتائج مطابقة</div>
            ) : (
              filteredOptions.map(opt => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    ref={isSelected ? selectedItemRef : undefined}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearchTerm('');
                    }}
                    className="w-full text-right px-3 py-2 rounded-xl border-2 border-b-[3px] text-xs font-black transition-all flex items-center justify-between gap-2 cursor-pointer active:translate-y-[1px] active:border-b-2"
                    style={
                      isSelected
                        ? {
                            backgroundColor: accentColor,
                            borderColor: accentColor,
                            borderBottomColor: accentShadowColor,
                            color: accentTextColor
                          }
                        : {
                            backgroundColor: secondaryColor,
                            borderColor: 'transparent',
                            borderBottomColor: 'transparent',
                            color: textColor
                          }
                    }
                  >
                    <div className="min-w-0 flex-1 text-right">
                      <div className="truncate">{opt.label}</div>
                      {opt.subLabel && (
                        <div className={`text-[10px] truncate ${isSelected ? 'opacity-80' : 'text-slate-400'}`}>
                          {opt.subLabel}
                        </div>
                      )}
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface DuoTimeSelectorProps {
  value: string;
  onChange: (value: string) => void;
  primaryColor: string;
  secondaryColor: string;
  cardColor: string;
  accentColor: string;
  borderColor: string;
  shadowColor: string;
  accentShadowColor: string;
  accentTextColor: string;
  textColor?: string;
}

const DuoTimeSelector: React.FC<DuoTimeSelectorProps> = ({
  value,
  onChange,
  ...themeProps
}) => {
  const [rawH, rawM] = (value || '16:00').split(':');
  const currentH = String(Math.min(23, Math.max(0, parseInt(rawH || '16', 10) || 0))).padStart(2, '0');
  const parsedMin = Math.min(55, Math.max(0, Math.round((parseInt(rawM || '0', 10) || 0) / 5) * 5));
  const currentM = String(parsedMin).padStart(2, '0');

  const hourOptions: DuoSettingsSelectOption[] = Array.from({ length: 24 }, (_, h) => {
    const hh = String(h).padStart(2, '0');
    const period = h < 12 ? 'ص' : 'م';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return {
      value: hh,
      label: `${h12} ${period} (${hh})`
    };
  });

  const minuteOptions: DuoSettingsSelectOption[] = Array.from({ length: 12 }, (_, idx) => {
    const mm = String(idx * 5).padStart(2, '0');
    return { value: mm, label: `:${mm} د` };
  });

  return (
    <div className="grid grid-cols-2 gap-2" dir="rtl">
      <DuoSettingsSelect
        value={currentH}
        onChange={newH => onChange(`${newH}:${currentM}`)}
        options={hourOptions}
        compact
        {...themeProps}
      />
      <DuoSettingsSelect
        value={currentM}
        onChange={newM => onChange(`${currentH}:${newM}`)}
        options={minuteOptions}
        compact
        {...themeProps}
      />
    </div>
  );
};

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  teachers: TeacherAccount[];
  allTeachers?: TeacherAccount[];
  halaqahs: Halaqah[];
  students: Student[];
  settings: AppSettings;
  complexes?: QuranComplex[];
  activeComplex?: QuranComplex | null;
  isDeveloper: boolean;
  complexName?: string;
  activeHalaqahId?: string;
  onSaveTeacher: (teacher: TeacherAccount) => Promise<void>;
  onDeleteTeacher: (teacherId: string) => Promise<void>;
  onSaveHalaqah: (halaqah: Halaqah) => Promise<void>;
  onDeleteHalaqah: (halaqahId: string) => Promise<void>;
  onTransferStudent?: (studentId: string, targetHalaqahId: string, targetHalaqahName: string) => Promise<void>;
  onBatchTransferStudents?: (studentIds: string[], targetHalaqahId: string, targetHalaqahName: string) => Promise<void>;
  onSwitchActiveHalaqah?: (halaqahId: string) => void;
  onSaveComplex?: (complex: QuranComplex) => Promise<void>;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  initialTab?: string;
  initialHighlightId?: string;
}

type TabType = 'teachers' | 'halaqahs' | 'transfers' | 'general' | 'mail';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  teachers,
  allTeachers = [],
  halaqahs,
  students,
  settings,
  complexes = [],
  activeComplex,
  isDeveloper,
  complexName,
  activeHalaqahId,
  onSaveTeacher,
  onDeleteTeacher,
  onSaveHalaqah,
  onDeleteHalaqah,
  onTransferStudent,
  onBatchTransferStudents,
  onSwitchActiveHalaqah,
  onSaveComplex,
  onUpdateSettings,
  initialTab,
  initialHighlightId
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('teachers');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mail / Gmail Configuration State
  const [gmailUser, setGmailUser] = useState('');
  const [gmailAppPass, setGmailAppPass] = useState('');
  const [showMailPass, setShowMailPass] = useState(false);
  const [copiedMailPass, setCopiedMailPass] = useState(false);
  const [mailFromName, setMailFromName] = useState(activeComplex?.name || 'منظومة عُمْرَان لإدارة المجمعات القرآنية');
  const [mailFromEmail, setMailFromEmail] = useState('');
  const [mailConfigStatus, setMailConfigStatus] = useState<{ isConfigured: boolean; user: string } | null>(null);
  const [isSavingMailConfig, setIsSavingMailConfig] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState('ikmhhg68@gmail.com');
  const [isTestingMail, setIsTestingMail] = useState(false);
  const [mailTestResult, setMailTestResult] = useState<{ success: boolean; msg: string } | null>(null);

  // Load Mail Config Status on mount / when mail tab selected / when complex changes
  const fetchMailConfig = async () => {
    try {
      const saved = await loadSavedMailConfigFromCloud(activeComplex?.id, activeComplex);
      if (saved && saved.user) {
        setGmailUser(saved.user);
        setTestEmailTo(prev => (!prev || prev === 'ikmhhg68@gmail.com' ? saved.user : prev));
        if (saved.pass) {
          setGmailAppPass(saved.pass);
        }
        if (saved.fromName) setMailFromName(saved.fromName);
        if (saved.fromEmail) setMailFromEmail(saved.fromEmail);
        setMailConfigStatus({ isConfigured: Boolean(saved.user && saved.pass), user: saved.user });
        return;
      }

      const query = activeComplex?.id ? `?complexId=${encodeURIComponent(activeComplex.id)}` : '';
      const res = await fetch(ApiConfig.getEndpoint(`/api/mail/config${query}`));
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        setMailConfigStatus({ isConfigured: Boolean(data.isConfigured), user: data.user || '' });
        if (data.user) {
          setGmailUser(data.user);
          setTestEmailTo(prev => (!prev || prev === 'ikmhhg68@gmail.com' ? data.user : prev));
        }
        if (data.pass) setGmailAppPass(data.pass);
        if (data.fromName) setMailFromName(data.fromName);
        if (data.fromEmail) setMailFromEmail(data.fromEmail);
      }
    } catch {
      // Gracefully silent
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMailConfig();
    }
  }, [activeComplex?.id]);

  // Lock body scroll when modal is open and handle initial tab & highlight
  useEffect(() => {
    if (isOpen) {
      fetchMailConfig();
      if (initialTab) {
        if (initialTab === 'halaqahs' || initialTab === 'teachers' || initialTab === 'transfers' || initialTab === 'general' || initialTab === 'mail') {
          setActiveTab(initialTab as TabType);
        }
      }
      if (initialHighlightId) {
        setTimeout(() => {
          triggerComplexThemePulse(initialHighlightId);
        }, 350);
      }
      const original = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = original;
      };
    }
  }, [isOpen, initialTab, initialHighlightId]);

  // Clear messages on tab change
  useEffect(() => {
    setStatusMsg(null);
  }, [activeTab]);

  // ==========================================
  // 1. Teachers State & Handlers
  // ==========================================
  const [editingTeacher, setEditingTeacher] = useState<Partial<TeacherAccount> | null>(null);
  const [isNewTeacher, setIsNewTeacher] = useState(false);
  const [addMode, setAddMode] = useState<'new' | 'code'>('new');
  const [searchTeacherCode, setSearchTeacherCode] = useState('');
  const [foundTeacherByCode, setFoundTeacherByCode] = useState<TeacherAccount | null>(null);
  const [codeSearchError, setCodeSearchError] = useState('');
  const [selectedHalaqahIdForAttach, setSelectedHalaqahIdForAttach] = useState<string>('');
  const [deleteTeacherId, setDeleteTeacherId] = useState<string | null>(null);

  const handleStartAddTeacher = () => {
    setIsNewTeacher(true);
    setAddMode('new');
    setSearchTeacherCode('');
    setFoundTeacherByCode(null);
    setCodeSearchError('');
    setSelectedHalaqahIdForAttach(halaqahs[0]?.id || '');
    setEditingTeacher({
      id: `teacher-${Date.now()}`,
      name: '',
      username: '',
      password: '123',
      phone: '',
      title: 'معلم ومحفظ',
      role: 'teacher',
      complexId: activeComplex?.id,
      complexName: activeComplex?.name || complexName,
      createdAt: new Date().toISOString()
    });
    setStatusMsg(null);
  };

  const handleSearchTeacherByCode = async (codeToSearch?: string) => {
    const rawInput = (codeToSearch !== undefined ? codeToSearch : searchTeacherCode).trim();
    if (!rawInput) {
      setCodeSearchError('يرجى كتابة الرمز الفريد للمعلم المكون من 6 أرقام (أو اسم المستخدم أو رقم الهاتف).');
      setFoundTeacherByCode(null);
      return;
    }
    const cleanInput = normalizeArabicDigits(rawInput).trim();
    const cleanDigits = cleanInput.replace(/\D/g, '');

    const pool = (allTeachers && allTeachers.length > 0) ? allTeachers : teachers;

    const findTeacher = (list: TeacherAccount[]) => {
      return list.find(t => {
        const c = normalizeArabicDigits(t.teacherCode || getTeacherSixDigitCode(t)).replace(/\D/g, '');
        if (cleanDigits && (c === cleanDigits || (cleanDigits.length === 6 && c.slice(-6) === cleanDigits) || (cleanDigits.length >= 4 && c.includes(cleanDigits)))) return true;
        if (cleanInput && t.username && t.username.toLowerCase().trim() === cleanInput.toLowerCase().replace('@', '')) return true;
        if (cleanDigits.length >= 8 && t.phone && t.phone.replace(/\D/g, '').includes(cleanDigits)) return true;
        if (cleanInput.length >= 3 && t.name && (t.name.trim().toLowerCase() === cleanInput.toLowerCase() || t.name.trim().toLowerCase().includes(cleanInput.toLowerCase()))) return true;
        return false;
      });
    };

    let matched = findTeacher(pool);

    // If not found in current memory list, load from live Firestore
    if (!matched) {
      try {
        const cloudTeachers = await OmranDataService.loadTeachers();
        matched = findTeacher(cloudTeachers);
      } catch {
        // Fallback
      }
    }

    // Direct multi-db / central db lookup
    if (!matched) {
      try {
        const found = await OmranDataService.findTeacherByCode(cleanDigits || cleanInput);
        if (found) matched = found;
      } catch {
        // Fallback
      }
    }

    if (matched) {
      setFoundTeacherByCode(matched);
      setCodeSearchError('');
      if (!selectedHalaqahIdForAttach && halaqahs.length > 0) {
        setSelectedHalaqahIdForAttach(halaqahs[0].id);
      }
    } else {
      setFoundTeacherByCode(null);
      setCodeSearchError(`لم يتم العثور على معلم مسجل بالبيانات المدخلة (${cleanInput}). تأكد من صحة الرمز واطلب من المعلم نسخه من نافذة تعديل حسابه.`);
    }
  };

  const handleAttachTeacherByCode = async () => {
    if (!foundTeacherByCode) return;
    try {
      setIsSubmitting(true);
      const targetComplexId = activeComplex?.id || '';
      const targetComplexName = activeComplex?.name || complexName || 'المجمع';

      const existingCIds = foundTeacherByCode.complexIds || (foundTeacherByCode.complexId ? [foundTeacherByCode.complexId] : []);
      const updatedComplexIds = Array.from(new Set([...existingCIds, ...(targetComplexId ? [targetComplexId] : [])]));
      const updatedComplexNames = complexes.filter(c => updatedComplexIds.includes(c.id)).map(c => c.name);

      const existingHIds = foundTeacherByCode.halaqahIds || (foundTeacherByCode.halaqahId ? [foundTeacherByCode.halaqahId] : []);
      const updatedHalaqahIds = Array.from(new Set([...existingHIds, ...(selectedHalaqahIdForAttach ? [selectedHalaqahIdForAttach] : [])]));
      const updatedHalaqahNames = halaqahs.filter(h => updatedHalaqahIds.includes(h.id)).map(h => h.name);

      const updatedTeacher: TeacherAccount = {
        ...foundTeacherByCode,
        complexId: targetComplexId || foundTeacherByCode.complexId,
        complexName: targetComplexName || foundTeacherByCode.complexName,
        complexIds: updatedComplexIds,
        complexNames: updatedComplexNames,
        halaqahId: selectedHalaqahIdForAttach || foundTeacherByCode.halaqahId,
        halaqahName: halaqahs.find(h => h.id === selectedHalaqahIdForAttach)?.name || foundTeacherByCode.halaqahName,
        halaqahIds: updatedHalaqahIds,
        halaqahNames: updatedHalaqahNames
      };

      await onSaveTeacher(updatedTeacher);

      if (selectedHalaqahIdForAttach && onSaveHalaqah) {
        const targetH = halaqahs.find(h => h.id === selectedHalaqahIdForAttach);
        if (targetH) {
          await onSaveHalaqah({
            ...targetH,
            primaryTeacherId: updatedTeacher.id,
            primaryTeacherName: updatedTeacher.name
          }).catch(() => {});
        }
      }
      setStatusMsg({
        type: 'success',
        text: `تم إلحاق المعلم (${foundTeacherByCode.name}) بالمجمع والحلقة بنجاح!`
      });
      setEditingTeacher(null);
      setIsNewTeacher(false);
      setFoundTeacherByCode(null);
      setSearchTeacherCode('');
    } catch (err: any) {
      setCodeSearchError(err?.message || 'حدث خطأ أثناء إلحاق المعلم.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEditTeacher = (teacher: TeacherAccount) => {
    setIsNewTeacher(false);
    setEditingTeacher({ ...teacher });
    setStatusMsg(null);
  };

  const handleSaveTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher || !editingTeacher.name?.trim() || !editingTeacher.username?.trim()) {
      setStatusMsg({ type: 'error', text: 'يرجى كتابة اسم المعلم واسم المستخدم للدخول.' });
      return;
    }

    const nameVal = getThreePartNameValidation(editingTeacher.name, 'معلم');
    if (!nameVal.isValid) {
      setStatusMsg({ type: 'error', text: nameVal.message || 'الاسم الثلاثي للمعلم إلزامي.' });
      return;
    }

    try {
      setIsSubmitting(true);
      const teacherPayload: TeacherAccount = {
        id: editingTeacher.id || `teacher-${Date.now()}`,
        name: editingTeacher.name.trim(),
        username: editingTeacher.username.trim(),
        password: editingTeacher.password?.trim() || '123',
        phone: editingTeacher.phone?.trim() || '0500000000',
        title: editingTeacher.title?.trim() || 'معلم ومحفظ',
        role: editingTeacher.role || 'teacher',
        complexId: editingTeacher.complexId || activeComplex?.id,
        complexName: editingTeacher.complexName || activeComplex?.name || complexName,
        createdAt: editingTeacher.createdAt || new Date().toISOString()
      };

      await onSaveTeacher(teacherPayload);
      setStatusMsg({
        type: 'success',
        text: isNewTeacher ? 'تمت إضافة المعلم بنجاح!' : 'تم تحديث بيانات المعلم بنجاح!'
      });
      setEditingTeacher(null);
      setIsNewTeacher(false);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'حدث خطأ أثناء حفظ المعلم.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeleteTeacher = async (id: string) => {
    try {
      setIsSubmitting(true);
      await onDeleteTeacher(id);
      setStatusMsg({ type: 'success', text: 'تم حذف حساب المعلم بنجاح.' });
      setDeleteTeacherId(null);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'فشل حذف المعلم.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // 2. Halaqahs State & Handlers
  // ==========================================
  const [editingHalaqah, setEditingHalaqah] = useState<Partial<Halaqah> | null>(null);
  const [isNewHalaqah, setIsNewHalaqah] = useState(false);
  const [deleteHalaqahId, setDeleteHalaqahId] = useState<string | null>(null);

  const handleStartAddHalaqah = () => {
    setIsNewHalaqah(true);
    setEditingHalaqah({
      id: `halaqah-${Date.now()}`,
      name: '',
      description: '',
      complexId: activeComplex?.id,
      complexName: activeComplex?.name || complexName,
      primaryTeacherName: teachers[0]?.name || '',
      createdAt: new Date().toISOString()
    });
    setStatusMsg(null);
  };

  const handleStartEditHalaqah = (h: Halaqah) => {
    setIsNewHalaqah(false);
    setEditingHalaqah({
      ...h,
      complexId: h.complexId || activeComplex?.id,
      complexName: h.complexName || activeComplex?.name || complexName
    });
    setStatusMsg(null);
  };

  const handleSaveHalaqahSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHalaqah || !editingHalaqah.name?.trim()) {
      setStatusMsg({ type: 'error', text: 'يرجى كتابة اسم الحلقة القرآنية.' });
      return;
    }

    try {
      setIsSubmitting(true);
      const targetComplex = (editingHalaqah.complexId ? complexes.find(c => c.id === editingHalaqah.complexId) : null) || activeComplex || complexes[0];
      const selectedTeacherName = editingHalaqah.primaryTeacherName?.trim();
      const matchedTeacher = selectedTeacherName
        ? teachers.find(t => t.name.trim() === selectedTeacherName || normalizeTeacherText(t.name) === normalizeTeacherText(selectedTeacherName))
        : null;

      const isOnline = editingHalaqah.isOnline || false;
      const meetingUri = editingHalaqah.meetingUri?.trim() || '';
      const meetingCode = meetingUri.includes('meet.google.com') ? (meetingUri.split('/').pop() || '') : '';

      const normalizedReviewLinks = (editingHalaqah.reviewLinks || []).map((link, idx) => ({
        ...link,
        id: link.id || `rev-link-${Date.now()}-${idx}`,
        title: (link.title || '').trim() || `رابط المراجعة ${['١','٢','٣','٤','٥','٦','٧','٨','٩','١٠'][idx] || (idx + 1)}`,
        url: (link.url || '').trim(),
        isEnabled: link.isEnabled !== false,
        updatedAt: new Date().toISOString()
      }));

      const halaqahPayload: Halaqah = {
        ...editingHalaqah,
        id: editingHalaqah.id || `halaqah-${Date.now()}`,
        name: editingHalaqah.name.trim(),
        description: editingHalaqah.description?.trim() || '',
        complexId: targetComplex?.id || editingHalaqah.complexId || '',
        complexName: targetComplex?.name || editingHalaqah.complexName || complexName || 'المجمع القرآني',
        primaryTeacherId: matchedTeacher?.id || editingHalaqah.primaryTeacherId,
        primaryTeacherName: matchedTeacher?.name || selectedTeacherName || '',
        capacity: Number(editingHalaqah.capacity) > 0 ? Number(editingHalaqah.capacity) : 15,
        mosqueId: editingHalaqah.mosqueId,
        mosqueName: editingHalaqah.mosqueName,
        isOnline,
        onlineStartTime: editingHalaqah.onlineStartTime || '16:00',
        onlineEndTime: editingHalaqah.onlineEndTime || '18:00',
        meetingUri,
        meetingCode,
        googleSpaceName: editingHalaqah.googleSpaceName || '',
        reviewLinks: normalizedReviewLinks,
        createdAt: editingHalaqah.createdAt || new Date().toISOString()
      };

      await onSaveHalaqah(halaqahPayload);

      // Link matched teacher bidirectionally
      if (matchedTeacher) {
        const updatedTeacher: TeacherAccount = {
          ...matchedTeacher,
          complexId: matchedTeacher.complexId || halaqahPayload.complexId,
          complexName: matchedTeacher.complexName || halaqahPayload.complexName,
          complexIds: Array.from(new Set([...(matchedTeacher.complexIds || []), halaqahPayload.complexId!])),
          complexNames: Array.from(new Set([...(matchedTeacher.complexNames || []), halaqahPayload.complexName || 'المجمع'])),
          halaqahId: halaqahPayload.id,
          halaqahName: halaqahPayload.name,
          halaqahIds: Array.from(new Set([...(matchedTeacher.halaqahIds || []), halaqahPayload.id])),
          halaqahNames: Array.from(new Set([...(matchedTeacher.halaqahNames || []), halaqahPayload.name]))
        };
        await onSaveTeacher(updatedTeacher).catch(() => {});
      }

      // Sync all students of this halaqah with the target complex and halaqah name
      const normHName = normalizeArabicText(halaqahPayload.name);
      const halaqahStudents = students.filter(s =>
        s.halaqahId === halaqahPayload.id ||
        (s.halaqahName && normalizeArabicText(s.halaqahName) === normHName)
      );
      for (const st of halaqahStudents) {
        if (st.complexId !== halaqahPayload.complexId || st.halaqahId !== halaqahPayload.id || st.halaqahName !== halaqahPayload.name) {
          await OmranDataService.saveStudent({
            ...st,
            complexId: halaqahPayload.complexId,
            complexName: halaqahPayload.complexName,
            halaqahId: halaqahPayload.id,
            halaqahName: halaqahPayload.name
          }).catch(() => {});
        }
      }

      setStatusMsg({
        type: 'success',
        text: isNewHalaqah ? 'تمت إضافة الحلقة القرآنية وتثبيتها بنجاح!' : 'تم تحديث بيانات الحلقة وربطها بنجاح!'
      });
      setEditingHalaqah(null);
      setIsNewHalaqah(false);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'حدث خطأ أثناء حفظ الحلقة.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeleteHalaqah = async (id: string) => {
    try {
      setIsSubmitting(true);
      await onDeleteHalaqah(id);
      setStatusMsg({ type: 'success', text: 'تم حذف الحلقة القرآنية بنجاح.' });
      setDeleteHalaqahId(null);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'فشل حذف الحلقة.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // 3. Student Transfer State & Handlers
  // ==========================================
  const [transferFilterHalaqah, setTransferFilterHalaqah] = useState<string>('all');
  const [transferSearch, setTransferSearch] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [targetDestinationHalaqahId, setTargetDestinationHalaqahId] = useState<string>('');

  const filteredTransferStudents = students.filter(st => {
    const matchHalaqah = transferFilterHalaqah === 'all' || st.halaqahId === transferFilterHalaqah;
    const matchSearch = !transferSearch || st.name.toLowerCase().includes(transferSearch.toLowerCase());
    return matchHalaqah && matchSearch;
  });

  const toggleSelectStudent = (id: string) => {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAllFiltered = () => {
    if (selectedStudentIds.length === filteredTransferStudents.length && filteredTransferStudents.length > 0) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredTransferStudents.map(s => s.id));
    }
  };

  const handleExecuteTransfer = async () => {
    if (!targetDestinationHalaqahId) {
      setStatusMsg({ type: 'error', text: 'يرجى اختيار الحلقة المراد نقل الطلاب إليها.' });
      return;
    }
    if (selectedStudentIds.length === 0) {
      setStatusMsg({ type: 'error', text: 'يرجى تحديد طالب واحد على الأقل لنقله.' });
      return;
    }

    const targetHalaqah = halaqahs.find(h => h.id === targetDestinationHalaqahId);
    const targetName = targetHalaqah?.name || 'الحلقة المختارة';

    try {
      setIsSubmitting(true);
      if (selectedStudentIds.length === 1 && onTransferStudent) {
        await onTransferStudent(selectedStudentIds[0], targetDestinationHalaqahId, targetName);
      } else if (onBatchTransferStudents) {
        await onBatchTransferStudents(selectedStudentIds, targetDestinationHalaqahId, targetName);
      } else if (onTransferStudent) {
        for (const sid of selectedStudentIds) {
          await onTransferStudent(sid, targetDestinationHalaqahId, targetName);
        }
      }
      setStatusMsg({
        type: 'success',
        text: `تم نقل ${selectedStudentIds.length} طالب إلى ${targetName} بنجاح!`
      });
      setSelectedStudentIds([]);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'فشل نقل الطلاب.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // 4. General Settings State & Handlers
  // ==========================================
  const [generalForm, setGeneralForm] = useState({
    halaqahName: settings.halaqahName || '',
    complexName: activeComplex?.name || settings.complexName || '',
    allowStudentRegistration: settings.allowStudentRegistration ?? true,
    workDaysPerWeek: settings.workDaysPerWeek ?? 5
  });

  const [customApiUrl, setCustomApiUrl] = useState(() => ApiConfig.getBaseUrl());

  // Dynamic Theme state for the active complex
  const [themeColors, setThemeColors] = useState<ComplexThemeConfig>(() => {
    return activeComplex?.theme || settings?.theme || {
      primaryColor: '#131f24',
      secondaryColor: '#1b2e35',
      accentColor: '#58cc02',
      backgroundColor: '#131f24',
      surfaceColor: 'rgba(27, 46, 53, 0.85)',
      cardColor: '#203843',
      textColor: '#ffffff'
    };
  });

  // Image color extraction & role swapping state
  const [extractedPalette, setExtractedPalette] = useState<string[]>([]);
  const [isExtractingColors, setIsExtractingColors] = useState(false);
  const [swapFirstRole, setSwapFirstRole] = useState<keyof ComplexThemeConfig | null>(null);
  const themeImageInputRef = useRef<HTMLInputElement | null>(null);

  // Synchronize generalForm & themeColors whenever activeComplex, settings, or modal open status changes
  useEffect(() => {
    if (isOpen) {
      setGeneralForm({
        halaqahName: settings.halaqahName || '',
        complexName: activeComplex?.name || settings.complexName || '',
        allowStudentRegistration: settings.allowStudentRegistration ?? true,
        workDaysPerWeek: settings.workDaysPerWeek ?? 5
      });
      const effTheme = activeComplex?.theme || settings?.theme;
      if (effTheme) {
        setThemeColors(effTheme);
        applyComplexThemeToDOM(effTheme, true);
      }
      setSwapFirstRole(null);
    }
  }, [isOpen, activeComplex, settings]);

  const handleApplyThemePreset = (preset: ComplexThemeConfig) => {
    setThemeColors(preset);
    applyComplexThemeToDOM(preset, true);
  };

  // Upload image & extract harmonious color palette
  const handleThemeImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      setStatusMsg({ type: 'error', text: 'حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 8 ميجابايت.' });
      return;
    }

    setIsExtractingColors(true);
    setStatusMsg(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const dataUrl = reader.result as string;
        const result = await extractColorsFromImageDataUrl(dataUrl);
        setThemeColors(result.theme);
        applyComplexThemeToDOM(result.theme, true);
        setExtractedPalette(result.palette || []);
        setStatusMsg({
          type: 'success',
          text: `تم استخراج الألوان من الصورة بنجاح! تم استخراج (${result.palette.length}) درجات لونية متناسقة.`
        });
      } catch {
        setStatusMsg({ type: 'error', text: 'تعذر استخراج الألوان من الصورة. يرجى تجربة صورة أخرى أو استخدام الباقات الجاهزة.' });
      } finally {
        setIsExtractingColors(false);
        if (themeImageInputRef.current) themeImageInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setIsExtractingColors(false);
      setStatusMsg({ type: 'error', text: 'حدث خطأ أثناء قراءة ملف الصورة.' });
    };
    reader.readAsDataURL(file);
  };

  // Interactive Swap between two color roles (e.g. text color <-> background color)
  const handleSelectRoleForSwap = (role: keyof ComplexThemeConfig) => {
    if (!swapFirstRole) {
      setSwapFirstRole(role);
      setStatusMsg({
        type: 'success',
        text: `تم تحديد (${getRoleArabicName(role)}). اضغط الآن على اللون الثاني للتبديل بينهما فوراً!`
      });
    } else if (swapFirstRole === role) {
      setSwapFirstRole(null);
      setStatusMsg(null);
    } else {
      const color1 = themeColors[swapFirstRole] || '#022c22';
      const color2 = themeColors[role] || '#fbbf24';

      const updated = {
        ...themeColors,
        [swapFirstRole]: color2,
        [role]: color1
      };
      setThemeColors(updated);
      applyComplexThemeToDOM(updated, true);

      setStatusMsg({
        type: 'success',
        text: `تم التبديل بنجاح بين (${getRoleArabicName(swapFirstRole)}) و (${getRoleArabicName(role)})!`
      });
      setSwapFirstRole(null);
    }
  };

  const getRoleArabicName = (role: keyof ComplexThemeConfig): string => {
    switch (role) {
      case 'backgroundColor': return 'لون الخلفية الرئيسي';
      case 'primaryColor': return 'اللون الأساسي';
      case 'cardColor': return 'لون البطاقات';
      case 'secondaryColor': return 'اللون الثانوي';
      case 'accentColor': return 'لون التمييز والأزرار';
      case 'textColor': return 'لون النصوص';
      default: return String(role);
    }
  };

  // Direct Quick Swap between common role pairs
  const handleQuickSwap = (roleA: keyof ComplexThemeConfig, roleB: keyof ComplexThemeConfig) => {
    const valA = themeColors[roleA] || '#022c22';
    const valB = themeColors[roleB] || '#ffffff';
    const updated = {
      ...themeColors,
      [roleA]: valB,
      [roleB]: valA
    };
    setThemeColors(updated);
    applyComplexThemeToDOM(updated, true);
    setStatusMsg({
      type: 'success',
      text: `تم التبديل الفوري بين (${getRoleArabicName(roleA)}) و (${getRoleArabicName(roleB)})!`
    });
  };

  const handleSaveGeneralSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);

      await onUpdateSettings({
        halaqahName: generalForm.halaqahName.trim(),
        complexName: generalForm.complexName.trim() || activeComplex?.name || settings.complexName,
        allowStudentRegistration: generalForm.allowStudentRegistration,
        workDaysPerWeek: Number(generalForm.workDaysPerWeek) || 5,
        theme: themeColors
      });

      const targetComplex = activeComplex || complexes[0];
      if (targetComplex && onSaveComplex) {
        const updatedComplex: QuranComplex = {
          ...targetComplex,
          name: generalForm.complexName.trim() || targetComplex.name,
          theme: themeColors
        };
        await onSaveComplex(updatedComplex);
      }
      applyComplexThemeToDOM(themeColors, true);

      if (customApiUrl !== undefined) {
        ApiConfig.setCustomApiUrl(customApiUrl);
      }

      setStatusMsg({ type: 'success', text: 'تم حفظ الإعدادات العامة وإعدادات الربط السحابي وثيم المجمع بنجاح!' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'فشل حفظ الإعدادات.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Dynamic Duolingo 3D Complex Theme Tokens (Live Reactive)
  const tBg = themeColors.backgroundColor || '#131f24';
  const tPrimary = themeColors.primaryColor || '#131f24';
  const tSecondary = themeColors.secondaryColor || '#1b2e35';
  const tCard = themeColors.cardColor || tSecondary || '#203843';
  const tAccent = themeColors.accentColor || '#ffc800';
  const tText = themeColors.textColor || '#ffffff';
  const tBorder = lightenHex(tCard, 0.16);
  const tShadow = darkenHex(tCard, 0.35);
  const tSecondaryShadow = darkenHex(tSecondary, 0.35);
  const tAccentShadow = darkenHex(tAccent, 0.28);
  const tAccentText = getContrastTextColor(tAccent);
  const tSelectProps = {
    primaryColor: tPrimary,
    secondaryColor: tSecondary,
    cardColor: tCard,
    accentColor: tAccent,
    borderColor: tBorder,
    shadowColor: tShadow,
    accentShadowColor: tAccentShadow,
    accentTextColor: tAccentText,
    textColor: tText
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5 bg-black/80 backdrop-blur-sm animate-fade-in"
      dir="rtl"
    >
      <div
        className="border-2 border-b-[6px] rounded-[28px] w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden transition-colors"
        data-complex-themed="true"
        style={{
          '--complex-bg': tBg,
          '--complex-primary': tPrimary,
          '--complex-secondary': tSecondary,
          '--complex-secondary-shadow': tSecondaryShadow,
          '--complex-card': tCard,
          '--complex-card-shadow': tShadow,
          '--complex-accent': tAccent,
          '--complex-accent-shadow': tAccentShadow,
          '--complex-border': tBorder,
          '--complex-text': tText,
          '--complex-subtext': `${tText}cc`,
          backgroundColor: tCard,
          borderColor: tBorder,
          borderBottomColor: tShadow,
          color: tText
        } as React.CSSProperties}
      >
        {/* Modal Header */}
        <div
          className="p-4 sm:p-5 border-b-2 flex items-center justify-between gap-3 shrink-0 z-20"
          style={{
            backgroundColor: tPrimary,
            borderColor: tBorder
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-2xl border-2 border-b-4 flex items-center justify-center shadow-md shrink-0"
              style={{
                backgroundColor: tCard,
                borderColor: tAccent,
                borderBottomColor: tAccentShadow,
                color: tAccent
              }}
            >
              <Settings className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-black font-heading text-white truncate">
                إعدادات المنظومة والحلقات
              </h2>
              <p className="text-xs font-bold opacity-85 truncate" style={{ color: tText }}>
                إدارة المعلمين والحلقات ونقل الطلاب وضبط هوية المنظومة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-2xl border-2 border-b-4 flex items-center justify-center cursor-pointer transition-all active:translate-y-[2px] active:border-b-2 hover:brightness-110 shrink-0"
            style={{
              backgroundColor: tSecondary,
              borderColor: tBorder,
              borderBottomColor: tShadow,
              color: tText
            }}
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation (Duolingo 3D Tactile Tabs) */}
        <div
          className="flex items-center p-2.5 sm:px-4 border-b-2 overflow-x-auto gap-2 shrink-0 z-10 sticky top-0 custom-scrollbar"
          style={{
            backgroundColor: tSecondary,
            borderColor: tBorder
          }}
        >
          {(
            [
              { id: 'teachers' as const, label: `المعلمون والمحفظون (${teachers.length})`, icon: Users },
              { id: 'halaqahs' as const, label: `الحلقات القرآنية (${halaqahs.length})`, icon: Layers },
              { id: 'transfers' as const, label: 'نقل وتوزيع الطلاب', icon: ArrowRightLeft },
              { id: 'general' as const, label: 'الإعدادات العامة والثيم', icon: Sliders },
              { id: 'mail' as const, label: 'البريد الإلكتروني وGmail', icon: Mail }
            ]
          ).map(tab => {
            const Icon = tab.icon;
            const isTabActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className="px-3.5 py-2 rounded-2xl border-2 border-b-4 text-xs sm:text-sm font-black flex items-center gap-2 transition-all whitespace-nowrap cursor-pointer active:translate-y-[2px] active:border-b-2 hover:brightness-110 shrink-0"
                style={
                  isTabActive
                    ? {
                        backgroundColor: tAccent,
                        borderColor: tAccent,
                        borderBottomColor: tAccentShadow,
                        color: tAccentText
                      }
                    : {
                        backgroundColor: tPrimary,
                        borderColor: tBorder,
                        borderBottomColor: tShadow,
                        color: tText
                      }
                }
              >
                <Icon className="w-4 h-4 shrink-0" style={{ color: isTabActive ? tAccentText : tAccent }} />
                <span>{tab.label}</span>
                {tab.id === 'mail' && mailConfigStatus?.isConfigured && (
                  <CheckCircle2
                    className="w-3.5 h-3.5 shrink-0"
                    style={{ color: isTabActive ? tAccentText : '#58cc02' }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Status Message */}
        {statusMsg && (
          <div
            className="mx-4 mt-3 p-3.5 rounded-2xl border-2 border-b-4 flex items-center gap-2.5 text-xs sm:text-sm font-black shadow-md animate-fadeIn"
            style={
              statusMsg.type === 'success'
                ? {
                    backgroundColor: '#58cc0218',
                    borderColor: '#58cc02',
                    borderBottomColor: '#46a302',
                    color: '#d9f99d'
                  }
                : {
                    backgroundColor: '#ff4b4b18',
                    borderColor: '#ff4b4b',
                    borderBottomColor: '#cc2e2e',
                    color: '#fecdd3'
                  }
            }
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#89e219] shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-[#ff6b6b] shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
          {/* TAB 1: TEACHERS */}
          {activeTab === 'teachers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="font-black text-white text-base font-heading">قائمة المعلمين والمشرفين</h3>
                  <p className="text-xs font-bold opacity-80" style={{ color: tText }}>
                    إدارة حسابات المعلمين وصلاحياتهم في المجمع
                  </p>
                </div>
                {!editingTeacher && (
                  <button
                    type="button"
                    onClick={handleStartAddTeacher}
                    className="flex items-center gap-2 font-black px-4 py-2.5 rounded-2xl border-2 border-b-4 transition-all text-xs sm:text-sm cursor-pointer shadow-md active:translate-y-[2px] active:border-b-2 hover:brightness-110"
                    style={{
                      backgroundColor: tAccent,
                      borderColor: tAccent,
                      borderBottomColor: tAccentShadow,
                      color: tAccentText
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة معلم جديد</span>
                  </button>
                )}
              </div>

              {editingTeacher ? (
                /* Teacher Form / Code Lookup Container */
                <div
                  className="border-2 border-b-4 rounded-[24px] p-4 sm:p-5 space-y-4 shadow-md"
                  style={{
                    backgroundColor: tSecondary,
                    borderColor: tBorder,
                    borderBottomColor: tSecondaryShadow
                  }}
                >
                  <div className="flex items-center justify-between pb-3 border-b-2" style={{ borderColor: tBorder }}>
                    <h4 className="font-black text-sm flex items-center gap-2" style={{ color: tAccent }}>
                      <UserCheck className="w-4 h-4" />
                      <span>{isNewTeacher ? 'إضافة حساب معلم' : 'تعديل بيانات المعلم'}</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTeacher(null);
                        setFoundTeacherByCode(null);
                        setSearchTeacherCode('');
                      }}
                      className="px-3 py-1.5 rounded-xl border-2 border-b-[3px] text-xs font-black cursor-pointer transition-all active:translate-y-[1px] active:border-b-2"
                      style={{
                        backgroundColor: tPrimary,
                        borderColor: tBorder,
                        borderBottomColor: tShadow,
                        color: tText
                      }}
                    >
                      إلغاء
                    </button>
                  </div>

                  {/* Mode Switcher when adding a new teacher */}
                  {isNewTeacher && (
                    <div
                      className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1.5 rounded-2xl border-2 border-b-4"
                      style={{
                        backgroundColor: tPrimary,
                        borderColor: tBorder,
                        borderBottomColor: tShadow
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setAddMode('new');
                          setFoundTeacherByCode(null);
                          setCodeSearchError('');
                        }}
                        className="py-2.5 px-3 rounded-xl border-2 border-b-[3px] text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 active:translate-y-[1px] active:border-b-2"
                        style={
                          addMode === 'new'
                            ? {
                                backgroundColor: tAccent,
                                borderColor: tAccent,
                                borderBottomColor: tAccentShadow,
                                color: tAccentText
                              }
                            : {
                                backgroundColor: 'transparent',
                                borderColor: 'transparent',
                                borderBottomColor: 'transparent',
                                color: tText
                              }
                        }
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إنشاء حساب جديد</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddMode('code');
                          setCodeSearchError('');
                        }}
                        className="py-2.5 px-3 rounded-xl border-2 border-b-[3px] text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 active:translate-y-[1px] active:border-b-2"
                        style={
                          addMode === 'code'
                            ? {
                                backgroundColor: tAccent,
                                borderColor: tAccent,
                                borderBottomColor: tAccentShadow,
                                color: tAccentText
                              }
                            : {
                                backgroundColor: 'transparent',
                                borderColor: 'transparent',
                                borderBottomColor: 'transparent',
                                color: tText
                              }
                        }
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>مسجل بالفعل (بالرمز الفريد)</span>
                      </button>
                    </div>
                  )}

                  {isNewTeacher && addMode === 'code' ? (
                    /* Search & Attach by 6-Digit Code */
                    <div className="space-y-4 text-xs">
                      <div
                        className="p-3.5 rounded-2xl border-2 border-b-4 space-y-1.5"
                        style={{
                          backgroundColor: tPrimary,
                          borderColor: tAccent,
                          borderBottomColor: tAccentShadow
                        }}
                      >
                        <div className="flex items-center gap-2 font-black text-xs" style={{ color: tAccent }}>
                          <KeyRound className="w-4 h-4 shrink-0" />
                          <span>كيفية الحصول على الرمز الفريد للمعلم:</span>
                        </div>
                        <p className="text-[11px] text-slate-300 font-bold leading-relaxed">
                          يقوم المعلم بالضغط على زر <strong>(الحساب)</strong> في أعلى شاشة المنظومة، وسيظهر رمزه الفريد المكون من 6 أرقام في أعلى النافذة ليقوم بنسخه ومشاركته معك.
                        </p>
                      </div>

                      <div>
                        <label className="block font-black mb-1.5" style={{ color: tText }}>
                          أدخل الرمز الفريد للمعلم (6 أرقام) أو اسم المستخدم أو رقم الهاتف:
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            maxLength={30}
                            placeholder="أدخل الرمز (مثال: 482910) أو اسم المستخدم"
                            value={searchTeacherCode}
                            onChange={e => {
                              const val = e.target.value;
                              setSearchTeacherCode(val);
                              const digitsOnly = normalizeArabicDigits(val).replace(/\D/g, '');
                              if (digitsOnly.length === 6) {
                                handleSearchTeacherByCode(digitsOnly);
                              } else if (val.trim().length === 0) {
                                setFoundTeacherByCode(null);
                                setCodeSearchError('');
                              }
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSearchTeacherByCode();
                              }
                            }}
                            className="flex-1 rounded-2xl border-2 border-b-4 px-3.5 py-2.5 text-base font-mono font-black tracking-widest text-center outline-none"
                            style={{
                              backgroundColor: tPrimary,
                              borderColor: tBorder,
                              borderBottomColor: tShadow,
                              color: tAccent
                            }}
                            dir="ltr"
                          />
                          <button
                            type="button"
                            onClick={() => handleSearchTeacherByCode()}
                            className="px-5 py-2.5 rounded-2xl border-2 border-b-4 font-black text-xs cursor-pointer shrink-0 transition-all flex items-center justify-center gap-1.5 shadow-md active:translate-y-[2px] active:border-b-2 hover:brightness-110"
                            style={{
                              backgroundColor: tAccent,
                              borderColor: tAccent,
                              borderBottomColor: tAccentShadow,
                              color: tAccentText
                            }}
                          >
                            <Search className="w-4 h-4" />
                            <span>التحقق</span>
                          </button>
                        </div>
                        {codeSearchError && (
                          <div className="mt-2 p-3 rounded-2xl bg-[#ff4b4b]/15 border-2 border-b-[3px] border-[#ff4b4b] border-b-[#cc2e2e] text-rose-200 text-xs font-bold flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-[#ff6b6b] shrink-0" />
                            <span>{codeSearchError}</span>
                          </div>
                        )}
                      </div>

                      {foundTeacherByCode && (
                        <div
                          className="p-4 rounded-2xl border-2 border-b-4 shadow-lg space-y-3.5 animate-fadeIn"
                          style={{
                            backgroundColor: tPrimary,
                            borderColor: '#58cc02',
                            borderBottomColor: '#46a302'
                          }}
                        >
                          <div className="flex items-center justify-between border-b-2 pb-2.5 flex-wrap gap-2" style={{ borderColor: tBorder }}>
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-11 h-11 rounded-2xl border-2 border-b-4 flex items-center justify-center font-black text-sm shrink-0"
                                style={{
                                  backgroundColor: tCard,
                                  borderColor: tAccent,
                                  borderBottomColor: tAccentShadow,
                                  color: tAccent
                                }}
                              >
                                {(foundTeacherByCode.name || 'م').charAt(0)}
                              </div>
                              <div>
                                <div className="font-black text-white text-sm flex items-center gap-1.5 flex-wrap">
                                  <span>{foundTeacherByCode.name || 'معلم'}</span>
                                  <span className="text-[10px] px-2.5 py-0.5 rounded-xl bg-[#58cc02]/15 text-[#89e219] border-2 border-b-2 border-[#58cc02] border-b-[#46a302] font-black">
                                    معلم مسجل
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-300 font-mono font-bold">
                                  @{foundTeacherByCode.username || 'teacher'} {foundTeacherByCode.phone ? `• ${foundTeacherByCode.phone}` : ''}
                                </div>
                              </div>
                            </div>
                            <span
                              className="text-xs font-mono font-black px-2.5 py-1 rounded-xl border-2 border-b-[3px]"
                              style={{
                                backgroundColor: tCard,
                                borderColor: tAccent,
                                borderBottomColor: tAccentShadow,
                                color: tAccent
                              }}
                              dir="ltr"
                            >
                              {foundTeacherByCode.teacherCode || getTeacherSixDigitCode(foundTeacherByCode)}
                            </span>
                          </div>

                          {/* Halaqah selector */}
                          {halaqahs.length > 0 && (
                            <div>
                              <label className="block font-black mb-1.5" style={{ color: tText }}>
                                تعيين الحلقة في هذا المجمع:
                              </label>
                              <DuoSettingsSelect
                                value={selectedHalaqahIdForAttach}
                                onChange={val => setSelectedHalaqahIdForAttach(val)}
                                options={halaqahs.map(h => ({
                                  value: h.id,
                                  label: h.name,
                                  subLabel: h.primaryTeacherName ? `المعلم: ${h.primaryTeacherName}` : undefined
                                }))}
                                placeholder="-- اختر الحلقة --"
                                {...tSelectProps}
                              />
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={handleAttachTeacherByCode}
                            disabled={isSubmitting}
                            className="w-full py-3 rounded-2xl border-2 border-b-4 font-black cursor-pointer shadow-lg transition-all flex items-center justify-center gap-2 text-xs disabled:opacity-50 active:translate-y-[2px] active:border-b-2 hover:brightness-110"
                            style={{
                              backgroundColor: tAccent,
                              borderColor: tAccent,
                              borderBottomColor: tAccentShadow,
                              color: tAccentText
                            }}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{isSubmitting ? 'جاري الإلحاق...' : 'إلحاق المعلم بهذا المجمع والحلقة'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <form onSubmit={handleSaveTeacherSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-black mb-1.5" style={{ color: tText }}>
                            الاسم الثلاثي للمعلم <span className="text-rose-400">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={editingTeacher.name || ''}
                            onChange={e => setEditingTeacher({ ...editingTeacher, name: e.target.value })}
                            placeholder="مثال: عبد الله أحمد المنصور"
                            className="w-full border-2 border-b-4 rounded-2xl px-3.5 py-2.5 text-sm text-white font-bold focus:outline-none"
                            style={{
                              backgroundColor: tPrimary,
                              borderColor: tBorder,
                              borderBottomColor: tShadow
                            }}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-black mb-1.5" style={{ color: tText }}>
                            اسم المستخدم للدخول <span className="text-rose-400">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={editingTeacher.username || ''}
                            onChange={e => setEditingTeacher({ ...editingTeacher, username: e.target.value })}
                            placeholder="مثال: abdullah"
                            className="w-full border-2 border-b-4 rounded-2xl px-3.5 py-2.5 text-sm text-white font-bold focus:outline-none"
                            style={{
                              backgroundColor: tPrimary,
                              borderColor: tBorder,
                              borderBottomColor: tShadow
                            }}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-black mb-1.5" style={{ color: tText }}>
                            كلمة المرور للدخول
                          </label>
                          <input
                            type="text"
                            value={editingTeacher.password || ''}
                            onChange={e => setEditingTeacher({ ...editingTeacher, password: e.target.value })}
                            placeholder="كلمة المرور (الافتراضي 123)"
                            className="w-full border-2 border-b-4 rounded-2xl px-3.5 py-2.5 text-sm text-white font-bold focus:outline-none"
                            style={{
                              backgroundColor: tPrimary,
                              borderColor: tBorder,
                              borderBottomColor: tShadow
                            }}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-black mb-1.5" style={{ color: tText }}>
                            رقم هاتف المعلم (واتساب)
                          </label>
                          <input
                            type="tel"
                            value={editingTeacher.phone || ''}
                            onChange={e => setEditingTeacher({ ...editingTeacher, phone: e.target.value })}
                            placeholder="05XXXXXXXX"
                            className="w-full border-2 border-b-4 rounded-2xl px-3.5 py-2.5 text-sm text-white font-bold focus:outline-none"
                            style={{
                              backgroundColor: tPrimary,
                              borderColor: tBorder,
                              borderBottomColor: tShadow
                            }}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-black mb-1.5" style={{ color: tText }}>
                            المسمى والصفة
                          </label>
                          <input
                            type="text"
                            value={editingTeacher.title || ''}
                            onChange={e => setEditingTeacher({ ...editingTeacher, title: e.target.value })}
                            placeholder="مثال: معلم ومحفظ / المشرف الإداري"
                            className="w-full border-2 border-b-4 rounded-2xl px-3.5 py-2.5 text-sm text-white font-bold focus:outline-none"
                            style={{
                              backgroundColor: tPrimary,
                              borderColor: tBorder,
                              borderBottomColor: tShadow
                            }}
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-black mb-1.5" style={{ color: tText }}>
                            الرتبة والصلاحية
                          </label>
                          <DuoSettingsSelect
                            value={editingTeacher.role || 'teacher'}
                            onChange={val => setEditingTeacher({ ...editingTeacher, role: val as any })}
                            options={[
                              { value: 'teacher', label: 'معلم حلقة', subLabel: 'صلاحيات التقييم والحضور لطلابه' },
                              { value: 'supervisor', label: 'مشرف مجمع', subLabel: 'إدارة الحلقات والمعلمين والتقارير' },
                              ...(isDeveloper
                                ? [{ value: 'developer', label: 'مبرمج ومطور المنظومة', subLabel: 'صلاحيات المطور الكاملة' }]
                                : [])
                            ]}
                            {...tSelectProps}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2.5 pt-3 border-t-2" style={{ borderColor: tBorder }}>
                        <button
                          type="button"
                          onClick={() => setEditingTeacher(null)}
                          className="px-4 py-2.5 rounded-2xl border-2 border-b-4 text-xs sm:text-sm font-black transition-all cursor-pointer active:translate-y-[2px] active:border-b-2"
                          style={{
                            backgroundColor: tPrimary,
                            borderColor: tBorder,
                            borderBottomColor: tShadow,
                            color: tText
                          }}
                        >
                          إلغاء
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="px-5 py-2.5 rounded-2xl border-2 border-b-4 font-black text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-2 shadow-md active:translate-y-[2px] active:border-b-2 hover:brightness-110 disabled:opacity-50"
                          style={{
                            backgroundColor: tAccent,
                            borderColor: tAccent,
                            borderBottomColor: tAccentShadow,
                            color: tAccentText
                          }}
                        >
                          {isSubmitting ? 'جاري الحفظ...' : 'حفظ بيانات المعلم'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ) : (
                /* Teachers List */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {teachers.filter(t => isDeveloper || !isTeacherDeveloper(t)).map(t => (
                    <div
                      key={t.id}
                      id={`teacher-item-${t.id}`}
                      data-item-id={t.id}
                      className="border-2 border-b-4 rounded-2xl p-4 flex items-center justify-between gap-3 transition-all shadow-sm"
                      style={{
                        backgroundColor: tSecondary,
                        borderColor: tBorder,
                        borderBottomColor: tSecondaryShadow
                      }}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-11 h-11 rounded-2xl border-2 border-b-4 flex items-center justify-center font-black text-sm shrink-0 shadow-sm"
                          style={{
                            backgroundColor: tPrimary,
                            borderColor: tAccent,
                            borderBottomColor: tAccentShadow,
                            color: tAccent
                          }}
                        >
                          {(t.name || 'م').slice(0, 1)}
                        </div>
                        <div className="min-w-0">
                          <div className="font-black text-white text-sm flex items-center gap-2 flex-wrap">
                            <span className="truncate">{t.name || 'معلم'}</span>
                            {t.role === 'developer' ? (
                              <span
                                className="text-[10px] px-2.5 py-0.5 rounded-xl border-2 border-b-2 font-black"
                                style={{
                                  backgroundColor: tPrimary,
                                  borderColor: '#a855f7',
                                  color: '#e9d5ff'
                                }}
                              >
                                مبرمج ومطور
                              </span>
                            ) : t.role === 'supervisor' ? (
                              <span
                                className="text-[10px] px-2.5 py-0.5 rounded-xl border-2 border-b-2 font-black"
                                style={{
                                  backgroundColor: `${tAccent}20`,
                                  borderColor: tAccent,
                                  color: tAccent
                                }}
                              >
                                مشرف
                              </span>
                            ) : (
                              <span className="text-[10px] bg-[#58cc02]/15 border-2 border-b-2 border-[#58cc02] text-[#89e219] px-2.5 py-0.5 rounded-xl font-black">
                                معلم
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-300 font-bold flex items-center gap-2 mt-1 flex-wrap">
                            <span className="font-mono">@{t.username || 'user'}</span>
                            {t.phone && <span className="font-mono">• {t.phone}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEditTeacher(t)}
                          className="w-9 h-9 rounded-xl border-2 border-b-[3px] flex items-center justify-center transition-all cursor-pointer active:translate-y-[1px] active:border-b-2 hover:brightness-110"
                          style={{
                            backgroundColor: tPrimary,
                            borderColor: tBorder,
                            borderBottomColor: tShadow,
                            color: tAccent
                          }}
                          title="تعديل"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {deleteTeacherId === t.id ? (
                          <div
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border-2 border-b-[3px]"
                            style={{
                              backgroundColor: '#ff4b4b20',
                              borderColor: '#ff4b4b',
                              borderBottomColor: '#cc2e2e'
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => handleConfirmDeleteTeacher(t.id)}
                              className="text-xs text-[#ff6b6b] font-black hover:underline cursor-pointer"
                            >
                              تأكيد
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTeacherId(null)}
                              className="text-xs text-white font-bold hover:underline cursor-pointer"
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteTeacherId(t.id)}
                            className="w-9 h-9 rounded-xl border-2 border-b-[3px] flex items-center justify-center text-rose-400 transition-all cursor-pointer active:translate-y-[1px] active:border-b-2 hover:brightness-110"
                            style={{
                              backgroundColor: tPrimary,
                              borderColor: '#ff4b4b55',
                              borderBottomColor: '#cc2e2e88'
                            }}
                            title="حذف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: HALAQAHS */}
          {activeTab === 'halaqahs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="font-black text-white text-base font-heading">قائمة الحلقات القرآنية</h3>
                  <p className="text-xs font-bold opacity-80" style={{ color: tText }}>
                    إضافة وتعديل الحلقات وتعيين المعلم المشرف
                  </p>
                </div>
                {!editingHalaqah && (
                  <button
                    type="button"
                    onClick={handleStartAddHalaqah}
                    className="flex items-center gap-2 font-black px-4 py-2.5 rounded-2xl border-2 border-b-4 transition-all text-xs sm:text-sm cursor-pointer shadow-md active:translate-y-[2px] active:border-b-2 hover:brightness-110"
                    style={{
                      backgroundColor: tAccent,
                      borderColor: tAccent,
                      borderBottomColor: tAccentShadow,
                      color: tAccentText
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة حلقة جديدة</span>
                  </button>
                )}
              </div>

              {editingHalaqah ? (
                /* Halaqah Form */
                <form
                  onSubmit={handleSaveHalaqahSubmit}
                  className="border-2 border-b-4 rounded-[24px] p-4 sm:p-5 space-y-4 shadow-md"
                  style={{
                    backgroundColor: tSecondary,
                    borderColor: tBorder,
                    borderBottomColor: tSecondaryShadow
                  }}
                >
                  <div className="flex items-center justify-between pb-3 border-b-2" style={{ borderColor: tBorder }}>
                    <h4 className="font-black text-sm flex items-center gap-2" style={{ color: tAccent }}>
                      <Layers className="w-4 h-4" />
                      <span>{isNewHalaqah ? 'إضافة حلقة قرآنية جديدة' : 'تعديل بيانات الحلقة'}</span>
                    </h4>
                    <button
                      type="button"
                      onClick={() => setEditingHalaqah(null)}
                      className="px-3 py-1.5 rounded-xl border-2 border-b-[3px] text-xs font-black cursor-pointer transition-all active:translate-y-[1px] active:border-b-2"
                      style={{
                        backgroundColor: tPrimary,
                        borderColor: tBorder,
                        borderBottomColor: tShadow,
                        color: tText
                      }}
                    >
                      إلغاء
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black mb-1.5" style={{ color: tText }}>
                        اسم الحلقة القرآنية <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editingHalaqah.name || ''}
                        onChange={e => setEditingHalaqah({ ...editingHalaqah, name: e.target.value })}
                        placeholder="مثال: حلقة ابن كثير"
                        className="w-full border-2 border-b-4 rounded-2xl px-3.5 py-2.5 text-sm text-white font-bold focus:outline-none"
                        style={{
                          backgroundColor: tPrimary,
                          borderColor: tBorder,
                          borderBottomColor: tShadow
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-black mb-1.5" style={{ color: tText }}>
                        المعلم المشرف على الحلقة
                      </label>
                      <DuoSettingsSelect
                        value={editingHalaqah.primaryTeacherName || ''}
                        onChange={val => setEditingHalaqah({ ...editingHalaqah, primaryTeacherName: val })}
                        options={[
                          { value: '', label: '-- اختر المعلم --' },
                          ...teachers.map(t => ({
                            value: t.name || '',
                            label: t.name || 'معلم',
                            subLabel: t.username ? `@${t.username}` : undefined
                          }))
                        ]}
                        placeholder="-- اختر المعلم --"
                        {...tSelectProps}
                      />
                    </div>

                    {complexes.length > 0 && (
                      <div>
                        <label className="block text-xs font-black mb-1.5" style={{ color: tText }}>
                          المجمع القرآني التابعة له الحلقة
                        </label>
                        <DuoSettingsSelect
                          value={editingHalaqah.complexId || activeComplex?.id || complexes[0]?.id || ''}
                          onChange={cId => {
                            const targetC = complexes.find(c => c.id === cId);
                            setEditingHalaqah({
                              ...editingHalaqah,
                              complexId: cId || undefined,
                              complexName: targetC?.name || editingHalaqah.complexName
                            });
                          }}
                          options={complexes.map(c => ({
                            value: c.id,
                            label: c.name
                          }))}
                          {...tSelectProps}
                        />
                      </div>
                    )}

                    {/* Halaqah Capacity */}
                    <div>
                      <label className="block text-xs font-black mb-1.5" style={{ color: tText }}>
                        السعة الاستيعابية للحلقة (الحد الأقصى للطلاب) <span style={{ color: tAccent }}>*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={editingHalaqah.capacity !== undefined ? editingHalaqah.capacity : 15}
                        onChange={e => setEditingHalaqah({ ...editingHalaqah, capacity: Math.max(1, parseInt(e.target.value) || 15) })}
                        placeholder="15"
                        className="w-full border-2 border-b-4 rounded-2xl px-3.5 py-2.5 text-sm text-white font-mono font-black focus:outline-none"
                        style={{
                          backgroundColor: tPrimary,
                          borderColor: tBorder,
                          borderBottomColor: tShadow
                        }}
                      />
                      <span className="text-[10px] text-slate-300 font-bold mt-1 block">
                        إذا اكتمل عدد الطلاب سيظهر تنبيه التعبئة الكاملة وتوجيه الطلاب لقائمة الانتظار.
                      </span>
                    </div>

                    {/* Mosque Selection for Multi-Mosque System */}
                    {activeComplex?.mosques && activeComplex.mosques.length > 0 && (
                      <div>
                        <label className="block text-xs font-black mb-1.5" style={{ color: tText }}>
                          المسجد التابعة له الحلقة في المنظومة
                        </label>
                        <DuoSettingsSelect
                          value={editingHalaqah.mosqueId || ''}
                          onChange={mId => {
                            const mObj = activeComplex.mosques?.find(m => m.id === mId);
                            setEditingHalaqah({
                              ...editingHalaqah,
                              mosqueId: mId || undefined,
                              mosqueName: mObj?.name
                            });
                          }}
                          options={[
                            { value: '', label: '-- اختياري: غير محدد بمسجد معين --' },
                            ...activeComplex.mosques.map(m => ({
                              value: m.id,
                              label: m.name,
                              subLabel: m.address || undefined
                            }))
                          ]}
                          placeholder="-- اختياري: غير محدد بمسجد معين --"
                          {...tSelectProps}
                        />
                      </div>
                    )}

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-black mb-1.5" style={{ color: tText }}>
                        وصف أو ملاحظات عن الحلقة
                      </label>
                      <input
                        type="text"
                        value={editingHalaqah.description || ''}
                        onChange={e => setEditingHalaqah({ ...editingHalaqah, description: e.target.value })}
                        placeholder="مثال: حلقة المتقدمين في الحفظ والمراجعة"
                        className="w-full border-2 border-b-4 rounded-2xl px-3.5 py-2.5 text-sm text-white font-bold focus:outline-none"
                        style={{
                          backgroundColor: tPrimary,
                          borderColor: tBorder,
                          borderBottomColor: tShadow
                        }}
                      />
                    </div>

                    {/* Online Halaqah Settings */}
                    <div
                      className="border-2 border-b-4 rounded-2xl p-4 space-y-3 sm:col-span-2"
                      style={{
                        backgroundColor: tPrimary,
                        borderColor: editingHalaqah.isOnline ? tAccent : tBorder,
                        borderBottomColor: editingHalaqah.isOnline ? tAccentShadow : tShadow
                      }}
                    >
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={editingHalaqah.isOnline || false}
                          onChange={e => setEditingHalaqah({ ...editingHalaqah, isOnline: e.target.checked })}
                          className="w-4 h-4 rounded-lg cursor-pointer"
                          style={{ accentColor: tAccent }}
                        />
                        <span className="text-xs font-black" style={{ color: tAccent }}>
                          هذه الحلقة أونلاين / عن بعد عبر Google Meet
                        </span>
                      </label>

                      {editingHalaqah.isOnline && (
                        <div className="space-y-3 pt-3 border-t-2" style={{ borderColor: tBorder }}>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="text-[11px] font-black mb-1.5 flex items-center gap-1.5" style={{ color: tText }}>
                                <Clock className="w-3.5 h-3.5" style={{ color: tAccent }} />
                                <span>وقت بدء الحلقة اليومي:</span>
                              </label>
                              <DuoTimeSelector
                                value={editingHalaqah.onlineStartTime || '16:00'}
                                onChange={val => setEditingHalaqah({ ...editingHalaqah, onlineStartTime: val })}
                                {...tSelectProps}
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-black mb-1.5 flex items-center gap-1.5" style={{ color: tText }}>
                                <Clock className="w-3.5 h-3.5" style={{ color: tAccent }} />
                                <span>وقت انتهاء الحلقة اليومي:</span>
                              </label>
                              <DuoTimeSelector
                                value={editingHalaqah.onlineEndTime || '18:00'}
                                onChange={val => setEditingHalaqah({ ...editingHalaqah, onlineEndTime: val })}
                                {...tSelectProps}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                              <label className="text-[11px] font-black" style={{ color: tText }}>رابط Google Meet المباشر:</label>
                              <a
                                href="https://meet.google.com/new"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] hover:underline font-black flex items-center gap-1"
                                style={{ color: tAccent }}
                                title="فتح صفحة إنشاء اجتماع في Google Meet مباشرة"
                              >
                                إنشاء في Google Meet مباشرة ↗
                              </a>
                            </div>
                            <input
                              type="text"
                              placeholder="https://meet.google.com/abc-defg-hij"
                              value={editingHalaqah.meetingUri || ''}
                              onChange={e => setEditingHalaqah({ ...editingHalaqah, meetingUri: e.target.value })}
                              className="w-full border-2 border-b-4 rounded-2xl px-3 py-2 text-xs text-white font-mono outline-none ltr text-left"
                              style={{
                                backgroundColor: tSecondary,
                                borderColor: tBorder,
                                borderBottomColor: tShadow
                              }}
                            />
                          </div>

                          {/* Review Links inside Settings Modal */}
                          <div className="pt-3 border-t-2 space-y-2.5" style={{ borderColor: tBorder }}>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-xs font-black" style={{ color: tAccent }}>
                                روابط المراجعة الإضافية ({(editingHalaqah.reviewLinks || []).length})
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const existing = editingHalaqah.reviewLinks || [];
                                  const nextIdx = existing.length + 1;
                                  const arDigits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
                                  const arNum = String(nextIdx).split('').map(d => arDigits[Number(d)] || d).join('');
                                  setEditingHalaqah({
                                    ...editingHalaqah,
                                    reviewLinks: [
                                      ...existing,
                                      {
                                        id: `rev-link-${Date.now()}-${nextIdx}`,
                                        title: `رابط المراجعة ${arNum}`,
                                        url: '',
                                        isEnabled: true,
                                        createdAt: new Date().toISOString()
                                      }
                                    ]
                                  });
                                }}
                                className="px-3 py-1.5 rounded-xl border-2 border-b-[3px] font-black text-[11px] cursor-pointer transition-all active:translate-y-[1px] active:border-b-2 hover:brightness-110"
                                style={{
                                  backgroundColor: tAccent,
                                  borderColor: tAccent,
                                  borderBottomColor: tAccentShadow,
                                  color: tAccentText
                                }}
                              >
                                + أضف رابط مراجعة
                              </button>
                            </div>

                            {(editingHalaqah.reviewLinks || []).map((link, idx) => {
                              const isEnabled = link.isEnabled !== false;
                              return (
                                <div
                                  key={link.id || idx}
                                  className="p-3 rounded-2xl border-2 border-b-[3px] space-y-2"
                                  style={{
                                    backgroundColor: tSecondary,
                                    borderColor: tBorder,
                                    borderBottomColor: tShadow
                                  }}
                                >
                                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                                    <label className="flex items-center gap-1.5 text-[11px] font-black cursor-pointer shrink-0">
                                      <input
                                        type="checkbox"
                                        checked={isEnabled}
                                        onChange={e => {
                                          const checked = e.target.checked;
                                          setEditingHalaqah({
                                            ...editingHalaqah,
                                            reviewLinks: (editingHalaqah.reviewLinks || []).map((l, i) =>
                                              i === idx ? { ...l, isEnabled: checked } : l
                                            )
                                          });
                                        }}
                                        className="w-4 h-4 rounded accent-[#58cc02]"
                                      />
                                      <span className={isEnabled ? 'text-[#89e219]' : 'text-slate-400'}>
                                        {isEnabled ? 'مفعل' : 'غير مفعل'}
                                      </span>
                                    </label>
                                    <input
                                      type="text"
                                      value={link.title}
                                      onChange={e =>
                                        setEditingHalaqah({
                                          ...editingHalaqah,
                                          reviewLinks: (editingHalaqah.reviewLinks || []).map((l, i) =>
                                            i === idx ? { ...l, title: e.target.value } : l
                                          )
                                        })
                                      }
                                      placeholder={`رابط المراجعة ${idx + 1}`}
                                      className="flex-1 min-w-[140px] border-2 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold outline-none"
                                      style={{
                                        backgroundColor: tPrimary,
                                        borderColor: tBorder
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEditingHalaqah({
                                          ...editingHalaqah,
                                          reviewLinks: (editingHalaqah.reviewLinks || []).filter((_, i) => i !== idx)
                                        })
                                      }
                                      className="px-2.5 py-1.5 rounded-xl border-2 border-b-[3px] bg-[#ff4b4b]/15 border-[#ff4b4b] border-b-[#cc2e2e] text-rose-200 text-[10px] font-black cursor-pointer active:translate-y-[1px] active:border-b-2"
                                    >
                                      حذف
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={link.url || ''}
                                      onChange={e =>
                                        setEditingHalaqah({
                                          ...editingHalaqah,
                                          reviewLinks: (editingHalaqah.reviewLinks || []).map((l, i) =>
                                            i === idx ? { ...l, url: e.target.value } : l
                                          )
                                        })
                                      }
                                      placeholder="https://meet.google.com/abc-defg-hij"
                                      className="flex-1 border-2 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono outline-none ltr text-left"
                                      style={{
                                        backgroundColor: tPrimary,
                                        borderColor: tBorder
                                      }}
                                    />
                                    <a
                                      href="https://meet.google.com/new"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-1.5 rounded-xl border-2 border-b-[3px] text-[10px] font-black shrink-0 hover:brightness-110"
                                      style={{
                                        backgroundColor: tPrimary,
                                        borderColor: tAccent,
                                        borderBottomColor: tAccentShadow,
                                        color: tAccent
                                      }}
                                    >
                                      Google Meet ↗
                                    </a>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-3 border-t-2" style={{ borderColor: tBorder }}>
                    <button
                      type="button"
                      onClick={() => setEditingHalaqah(null)}
                      className="px-4 py-2.5 rounded-2xl border-2 border-b-4 text-xs sm:text-sm font-black transition-all cursor-pointer active:translate-y-[2px] active:border-b-2"
                      style={{
                        backgroundColor: tPrimary,
                        borderColor: tBorder,
                        borderBottomColor: tShadow,
                        color: tText
                      }}
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2.5 rounded-2xl border-2 border-b-4 font-black text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-2 shadow-md active:translate-y-[2px] active:border-b-2 hover:brightness-110 disabled:opacity-50"
                      style={{
                        backgroundColor: tAccent,
                        borderColor: tAccent,
                        borderBottomColor: tAccentShadow,
                        color: tAccentText
                      }}
                    >
                      {isSubmitting ? 'جاري الحفظ...' : 'حفظ بيانات الحلقة'}
                    </button>
                  </div>
                </form>
              ) : (
                /* Halaqahs List */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {halaqahs.map(h => {
                    const halaqahStudentsCount = students.filter(s => s.halaqahId === h.id).length;
                    const isActive = activeHalaqahId === h.id;

                    return (
                      <div
                        key={h.id}
                        id={`halaqah-item-${h.id}`}
                        data-item-id={h.id}
                        className="border-2 border-b-4 rounded-2xl p-4 flex flex-col justify-between gap-3 transition-all shadow-sm"
                        style={{
                          backgroundColor: tSecondary,
                          borderColor: isActive ? tAccent : tBorder,
                          borderBottomColor: isActive ? tAccentShadow : tSecondaryShadow
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="font-black text-white text-base flex items-center gap-2 flex-wrap">
                              <span>{h.name}</span>
                              {isActive && (
                                <span
                                  className="text-[10px] font-black px-2.5 py-0.5 rounded-xl border-2 border-b-2"
                                  style={{
                                    backgroundColor: tAccent,
                                    borderColor: tAccent,
                                    borderBottomColor: tAccentShadow,
                                    color: tAccentText
                                  }}
                                >
                                  الحلقة النشطة حالياً
                                </span>
                              )}
                            </div>
                            {h.description && (
                              <p className="text-xs text-slate-300 font-bold mt-1">{h.description}</p>
                            )}
                            <div className="text-xs mt-2.5 flex items-center flex-wrap gap-2">
                              <span
                                className="text-[11px] px-2.5 py-1 rounded-xl border-2 border-b-2 font-black"
                                style={{
                                  backgroundColor: tPrimary,
                                  borderColor: tBorder,
                                  color: tText
                                }}
                              >
                                المجمع: {h.complexName || activeComplex?.name || 'المجمع الرئيسي'}
                              </span>
                              {h.mosqueName && (
                                <span
                                  className="text-[11px] px-2.5 py-1 rounded-xl border-2 border-b-2 font-black"
                                  style={{
                                    backgroundColor: `${tAccent}20`,
                                    borderColor: tAccent,
                                    color: tAccent
                                  }}
                                >
                                  جامع: {h.mosqueName}
                                </span>
                              )}
                              <span className="text-slate-200 font-bold">المعلم: {h.primaryTeacherName || 'غير محدد'}</span>
                              <span className="font-black" style={{ color: tAccent }}>
                                • الطلاب: {halaqahStudentsCount} / {h.capacity || 15}
                              </span>
                            </div>

                            {/* Full Capacity Warning Banner */}
                            {halaqahStudentsCount >= (h.capacity || 15) && (
                              <div className="mt-2.5 p-2.5 rounded-2xl bg-[#ff4b4b]/15 border-2 border-b-[3px] border-[#ff4b4b] border-b-[#cc2e2e] text-rose-200 text-xs font-black flex items-center gap-1.5 shadow-sm">
                                <AlertCircle className="w-4 h-4 text-[#ff6b6b] shrink-0" />
                                <span>لقد وصلت الحلقة إلى التعبئة الكاملة للطلاب</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEditHalaqah(h)}
                              className="w-9 h-9 rounded-xl border-2 border-b-[3px] flex items-center justify-center transition-all cursor-pointer active:translate-y-[1px] active:border-b-2 hover:brightness-110"
                              style={{
                                backgroundColor: tPrimary,
                                borderColor: tBorder,
                                borderBottomColor: tShadow,
                                color: tAccent
                              }}
                              title="تعديل"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {deleteHalaqahId === h.id ? (
                              <div
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border-2 border-b-[3px]"
                                style={{
                                  backgroundColor: '#ff4b4b20',
                                  borderColor: '#ff4b4b',
                                  borderBottomColor: '#cc2e2e'
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleConfirmDeleteHalaqah(h.id)}
                                  className="text-xs text-[#ff6b6b] font-black hover:underline cursor-pointer"
                                >
                                  تأكيد
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteHalaqahId(null)}
                                  className="text-xs text-white font-bold hover:underline cursor-pointer"
                                >
                                  إلغاء
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeleteHalaqahId(h.id)}
                                className="w-9 h-9 rounded-xl border-2 border-b-[3px] flex items-center justify-center text-rose-400 transition-all cursor-pointer active:translate-y-[1px] active:border-b-2 hover:brightness-110"
                                style={{
                                  backgroundColor: tPrimary,
                                  borderColor: '#ff4b4b55',
                                  borderBottomColor: '#cc2e2e88'
                                }}
                                title="حذف"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {onSwitchActiveHalaqah && !isActive && (
                          <div className="pt-2.5 border-t-2 flex justify-end" style={{ borderColor: tBorder }}>
                            <button
                              type="button"
                              onClick={() => onSwitchActiveHalaqah(h.id)}
                              className="text-xs font-black px-3.5 py-2 rounded-xl border-2 border-b-[3px] transition-all cursor-pointer active:translate-y-[1px] active:border-b-2 hover:brightness-110"
                              style={{
                                backgroundColor: tPrimary,
                                borderColor: tAccent,
                                borderBottomColor: tAccentShadow,
                                color: tAccent
                              }}
                            >
                              التبديل إلى هذه الحلقة
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: STUDENT TRANSFERS */}
          {activeTab === 'transfers' && (
            <div className="space-y-4">
              <div
                className="border-2 border-b-4 rounded-[24px] p-4 sm:p-5 space-y-4 shadow-md"
                style={{
                  backgroundColor: tSecondary,
                  borderColor: tBorder,
                  borderBottomColor: tSecondaryShadow
                }}
              >
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-black text-white text-base font-heading">نقل الطلاب وتوزيعهم بين الحلقات</h3>
                    <p className="text-xs font-bold opacity-80" style={{ color: tText }}>
                      حدد الطلاب واختر الحلقة الوجهة للنقل الفوري
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto md:min-w-[260px]">
                    <div className="flex-1 sm:min-w-[180px]">
                      <DuoSettingsSelect
                        value={targetDestinationHalaqahId}
                        onChange={val => setTargetDestinationHalaqahId(val)}
                        options={[
                          { value: '', label: '-- اختر الحلقة الوجهة --' },
                          ...halaqahs.map(h => ({
                            value: h.id,
                            label: h.name,
                            subLabel: h.primaryTeacherName ? `المعلم: ${h.primaryTeacherName}` : undefined
                          }))
                        ]}
                        placeholder="-- اختر الحلقة الوجهة --"
                        {...tSelectProps}
                      />
                    </div>

                    <button
                      type="button"
                      disabled={isSubmitting || selectedStudentIds.length === 0 || !targetDestinationHalaqahId}
                      onClick={handleExecuteTransfer}
                      className="flex items-center justify-center gap-1.5 font-black px-4 py-2.5 rounded-2xl border-2 border-b-4 text-xs transition-all cursor-pointer shadow-md shrink-0 active:translate-y-[2px] active:border-b-2 hover:brightness-110 disabled:opacity-45 disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: tAccent,
                        borderColor: tAccent,
                        borderBottomColor: tAccentShadow,
                        color: tAccentText
                      }}
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      <span>نقل ({selectedStudentIds.length}) طالب</span>
                    </button>
                  </div>
                </div>

                {/* Filter and Search */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t-2" style={{ borderColor: tBorder }}>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={transferSearch}
                      onChange={e => setTransferSearch(e.target.value)}
                      placeholder="بحث باسم الطالب..."
                      className="w-full border-2 border-b-4 rounded-2xl pr-10 pl-3 py-2.5 text-xs text-white font-bold focus:outline-none"
                      style={{
                        backgroundColor: tPrimary,
                        borderColor: tBorder,
                        borderBottomColor: tShadow
                      }}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <DuoSettingsSelect
                        value={transferFilterHalaqah}
                        onChange={val => setTransferFilterHalaqah(val)}
                        options={[
                          { value: 'all', label: 'كل الحلقات المصدر' },
                          ...halaqahs.map(h => ({
                            value: h.id,
                            label: h.name
                          }))
                        ]}
                        compact
                        {...tSelectProps}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={toggleSelectAllFiltered}
                      className="px-3.5 py-2 rounded-2xl border-2 border-b-4 text-xs font-black whitespace-nowrap cursor-pointer transition-all active:translate-y-[2px] active:border-b-2 hover:brightness-110"
                      style={{
                        backgroundColor: tPrimary,
                        borderColor: tAccent,
                        borderBottomColor: tAccentShadow,
                        color: tAccent
                      }}
                    >
                      {selectedStudentIds.length === filteredTransferStudents.length && filteredTransferStudents.length > 0
                        ? 'إلغاء التحديد'
                        : 'تحديد الكل'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Students Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[45vh] overflow-y-auto pr-1 custom-scrollbar">
                {filteredTransferStudents.map(st => {
                  const isSelected = selectedStudentIds.includes(st.id);
                  const currentHalaqah = halaqahs.find(h => h.id === st.halaqahId);

                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => toggleSelectStudent(st.id)}
                      className="p-3.5 rounded-2xl border-2 border-b-4 flex items-center justify-between gap-2 cursor-pointer transition-all text-right active:translate-y-[2px] active:border-b-2 hover:brightness-110"
                      style={
                        isSelected
                          ? {
                              backgroundColor: `${tAccent}22`,
                              borderColor: tAccent,
                              borderBottomColor: tAccentShadow,
                              color: '#ffffff'
                            }
                          : {
                              backgroundColor: tSecondary,
                              borderColor: tBorder,
                              borderBottomColor: tSecondaryShadow,
                              color: tText
                            }
                      }
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="shrink-0" style={{ color: isSelected ? tAccent : '#94a3b8' }}>
                          {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        </div>
                        <div className="truncate">
                          <div className="font-black text-xs text-white truncate">{st.name}</div>
                          <div className="text-[11px] text-slate-300 font-bold truncate">
                            الحلقة الحالية: {currentHalaqah?.name || 'غير محدد'}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: GENERAL SETTINGS & THEME CUSTOMIZATION */}
          {activeTab === 'general' && (
            <form onSubmit={handleSaveGeneralSettings} className="space-y-5">
              {/* Basic Organization Info */}
              <div
                className="border-2 border-b-4 rounded-[24px] p-4 sm:p-5 space-y-4 shadow-md"
                style={{
                  backgroundColor: tSecondary,
                  borderColor: tBorder,
                  borderBottomColor: tSecondaryShadow
                }}
              >
                <h3
                  className="font-black text-base font-heading flex items-center gap-2 pb-2.5 border-b-2"
                  style={{
                    color: tAccent,
                    borderColor: tBorder
                  }}
                >
                  <Sliders className="w-4 h-4" />
                  <span>بيانات وهوية المنظومة والحلقة</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black mb-1.5" style={{ color: tText }}>
                      اسم المجمع القرآني
                    </label>
                    <input
                      type="text"
                      value={generalForm.complexName}
                      onChange={e => setGeneralForm({ ...generalForm, complexName: e.target.value })}
                      placeholder="مثال: مجمع النور القرآني"
                      className="w-full border-2 border-b-4 rounded-2xl px-3.5 py-2.5 text-sm text-white font-bold focus:outline-none"
                      style={{
                        backgroundColor: tPrimary,
                        borderColor: tBorder,
                        borderBottomColor: tShadow
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black mb-1.5" style={{ color: tText }}>
                      اسم الحلقة الافتراضية
                    </label>
                    <input
                      type="text"
                      value={generalForm.halaqahName}
                      onChange={e => setGeneralForm({ ...generalForm, halaqahName: e.target.value })}
                      placeholder="مثال: حلقة الإمام الشاطبي"
                      className="w-full border-2 border-b-4 rounded-2xl px-3.5 py-2.5 text-sm text-white font-bold focus:outline-none"
                      style={{
                        backgroundColor: tPrimary,
                        borderColor: tBorder,
                        borderBottomColor: tShadow
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black mb-1.5" style={{ color: tText }}>
                      أيام العمل الأسبوعية
                    </label>
                    <DuoSettingsSelect
                      value={String(generalForm.workDaysPerWeek)}
                      onChange={val => setGeneralForm({ ...generalForm, workDaysPerWeek: Number(val) })}
                      options={[1, 2, 3, 4, 5, 6, 7].map(d => ({
                        value: String(d),
                        label: d === 1 ? 'يوم واحد أسبوعياً' : d === 2 ? 'يومان أسبوعياً' : `${d} أيام أسبوعياً`
                      }))}
                      {...tSelectProps}
                    />
                  </div>

                  {/* ONLY DEVELOPER CAN TOGGLE PUBLIC STUDENT REGISTRATION */}
                  {isDeveloper && (
                    <div className="flex items-center gap-3 pt-2 sm:pt-6">
                      <button
                        type="button"
                        onClick={() => setGeneralForm({ ...generalForm, allowStudentRegistration: !generalForm.allowStudentRegistration })}
                        className="w-full p-3 rounded-2xl border-2 border-b-4 flex items-center justify-between gap-3 cursor-pointer transition-all active:translate-y-[2px] active:border-b-2"
                        style={{
                          backgroundColor: tPrimary,
                          borderColor: generalForm.allowStudentRegistration ? tAccent : tBorder,
                          borderBottomColor: generalForm.allowStudentRegistration ? tAccentShadow : tShadow
                        }}
                      >
                        <span className="text-xs font-black text-right" style={{ color: tText }}>
                          إتاحة تسجيل الطلاب الجدد من البوابة العامة
                        </span>
                        <span
                          className="px-2.5 py-1 rounded-xl text-[10px] font-black shrink-0"
                          style={
                            generalForm.allowStudentRegistration
                              ? { backgroundColor: '#58cc02', color: '#ffffff' }
                              : { backgroundColor: tSecondary, color: '#94a3b8' }
                          }
                        >
                          {generalForm.allowStudentRegistration ? 'مفعل' : 'مغلق'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Dual-Deployment & External API Server Configuration */}
              <div
                className="border-2 border-b-4 rounded-[24px] p-4 sm:p-5 space-y-3 shadow-md"
                style={{
                  backgroundColor: tSecondary,
                  borderColor: tBorder,
                  borderBottomColor: tSecondaryShadow
                }}
              >
                <div
                  className="flex items-center justify-between pb-2.5 border-b-2 flex-wrap gap-2"
                  style={{ borderColor: tBorder }}
                >
                  <h3
                    className="font-black text-base font-heading flex items-center gap-2"
                    style={{ color: tAccent }}
                  >
                    <Globe className="w-4 h-4" />
                    <span>معمارية النشر وربط الخادم (GitHub Pages & API Server)</span>
                  </h3>
                  <span
                    className="text-[11px] px-3 py-1 rounded-xl border-2 border-b-2 font-black"
                    style={{
                      backgroundColor: tPrimary,
                      borderColor: '#58cc02',
                      color: '#89e219'
                    }}
                  >
                    {ApiConfig.isGitHubPages() ? 'نشر ثابت على GitHub Pages' : 'خادم متكامل محلي/سحابي'}
                  </span>
                </div>
                <p className="text-xs font-bold opacity-85" style={{ color: tText }}>
                  تدعم منظومة عُمْرَان الوضع الثنائي: واجهة ثابتة جاهزة للنشر على GitHub Pages مع ربط خادم API مستقل لمعالجة التكاملات الخارجية.
                </p>
                <div>
                  <label className="block text-xs font-black mb-1.5" style={{ color: tText }}>
                    رابط خادم الواجهة البرمجية (API Base URL):
                  </label>
                  <input
                    type="url"
                    placeholder="https://api.omran.example.com أو اتركه فارغاً لاستخدام الخادم الافتراضي"
                    value={customApiUrl}
                    onChange={e => setCustomApiUrl(e.target.value)}
                    className="w-full border-2 border-b-4 rounded-2xl px-3.5 py-2.5 text-sm text-white focus:outline-none font-mono"
                    style={{
                      backgroundColor: tPrimary,
                      borderColor: tBorder,
                      borderBottomColor: tShadow
                    }}
                  />
                  <span className="text-[10px] text-slate-300 font-bold block mt-1.5">
                    في حال تشغيل الواجهة على GitHub Pages، أدخل رابط خادم Express السحابي هنا. في وضع التطوير المحلي أو الاستضافة الكاملة، يُكتشف الخادم تلقائياً.
                  </span>
                </div>
              </div>

              {/* Dynamic Quran Complex Theme Customizer with LIVE PREVIEW */}
              <div
                className="border-2 border-b-4 rounded-[24px] p-4 sm:p-5 space-y-4 shadow-md"
                style={{
                  backgroundColor: tSecondary,
                  borderColor: tBorder,
                  borderBottomColor: tSecondaryShadow
                }}
              >
                <div
                  className="flex items-center justify-between pb-3 border-b-2 flex-wrap gap-2.5"
                  style={{ borderColor: tBorder }}
                >
                  <div>
                    <h3
                      className="font-black text-base font-heading flex items-center gap-2"
                      style={{ color: tAccent }}
                    >
                      <Palette className="w-4 h-4" />
                      <span>تخصيص ثيم وألوان المجمع القرآني (معاينة حية فورية)</span>
                    </h3>
                    <p className="text-[11px] font-bold opacity-85 mt-0.5" style={{ color: tText }}>
                      ارفع صورة لاستخراج الهوية، أو اختر من الباقات، وبدّل بين الألوان بضغطة زر
                    </p>
                  </div>

                  {/* Hidden Image Upload Input & Button */}
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={themeImageInputRef}
                      accept="image/*"
                      onChange={handleThemeImageUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isExtractingColors}
                      onClick={() => themeImageInputRef.current?.click()}
                      className="px-4 py-2 rounded-2xl border-2 border-b-4 font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:translate-y-[2px] active:border-b-2 hover:brightness-110 disabled:opacity-50"
                      style={{
                        backgroundColor: tAccent,
                        borderColor: tAccent,
                        borderBottomColor: tAccentShadow,
                        color: tAccentText
                      }}
                      title="ارفع أي صورة أو شعار للمجمع لاستخراج الألوان منها آلياً"
                    >
                      {isExtractingColors ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>جارٍ استخراج الألوان...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span>رفع صورة واستخراج الألوان</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* 10 Master Duolingo & Islamic Theme Presets Selection Grid */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-black" style={{ color: tAccent }}>
                      اختر ثيم وهوية المجمع القرآني (تطبيق فوري لجميع الألوان والبطاقات والأزرار):
                    </span>
                    <span
                      className="text-[10px] px-3 py-1 rounded-xl font-black border-2 border-b-2"
                      style={{
                        borderColor: tAccent,
                        borderBottomColor: tAccentShadow,
                        color: tAccent,
                        backgroundColor: tPrimary
                      }}
                    >
                      {ISLAMIC_THEME_PRESETS.length} باقات متناسقة
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
                    {ISLAMIC_THEME_PRESETS.map(preset => {
                      const isSelected =
                        (themeColors.backgroundColor || '').toLowerCase() === preset.colors.backgroundColor.toLowerCase() &&
                        (themeColors.accentColor || '').toLowerCase() === preset.colors.accentColor.toLowerCase();
                      const pAccent = preset.colors.accentColor || '#ffc800';
                      const pShadow = darkenHex(preset.colors.cardColor || preset.colors.secondaryColor, 0.35);

                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleApplyThemePreset(preset.colors)}
                          className="p-3 rounded-2xl border-2 border-b-4 text-right transition-all cursor-pointer flex flex-col justify-between gap-2 active:translate-y-[2px] active:border-b-2 hover:brightness-110 shadow-sm"
                          style={{
                            backgroundColor: preset.colors.cardColor || preset.colors.secondaryColor,
                            borderColor: isSelected ? pAccent : lightenHex(preset.colors.cardColor || preset.colors.secondaryColor, 0.16),
                            borderBottomColor: isSelected ? darkenHex(pAccent, 0.28) : pShadow
                          }}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1">
                              <span className="w-3.5 h-3.5 rounded-md border border-white/30 shrink-0" style={{ backgroundColor: preset.colors.backgroundColor }} />
                              <span className="w-3.5 h-3.5 rounded-md border border-white/30 shrink-0" style={{ backgroundColor: preset.colors.cardColor || preset.colors.secondaryColor }} />
                              <span className="w-3.5 h-3.5 rounded-md border border-white/30 shrink-0" style={{ backgroundColor: pAccent }} />
                            </div>
                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: pAccent }} />}
                          </div>
                          <span className="text-xs font-black text-white block truncate">{preset.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {extractedPalette.length > 0 && (
                  <div
                    className="p-3.5 rounded-2xl border-2 border-b-4 space-y-2"
                    style={{
                      backgroundColor: tPrimary,
                      borderColor: tBorder,
                      borderBottomColor: tShadow
                    }}
                  >
                    <div className="flex items-center justify-between text-xs font-black flex-wrap gap-2" style={{ color: tAccent }}>
                      <span className="flex items-center gap-1.5">
                        <Wand2 className="w-3.5 h-3.5" />
                        <span>الألوان المستخرجة من الصورة ({extractedPalette.length} درجات):</span>
                      </span>
                      <span className="text-[10px] opacity-80 font-bold" style={{ color: tText }}>
                        {swapFirstRole
                          ? `اضغط على أي لون لتطبيقه على (${getRoleArabicName(swapFirstRole)})`
                          : 'اضغط على دور لوني أدناه ثم اختر لوناً من هنا'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      {extractedPalette.map((colorHex, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            if (swapFirstRole) {
                              setThemeColors(prev => ({
                                ...prev,
                                [swapFirstRole]: colorHex
                              }));
                              setStatusMsg({
                                type: 'success',
                                text: `تم تعيين اللون (${colorHex}) لـ (${getRoleArabicName(swapFirstRole)})!`
                              });
                              setSwapFirstRole(null);
                            }
                          }}
                          className="group relative w-8 h-8 rounded-xl border-2 border-b-[3px] border-white/40 border-b-black/40 shadow transition-transform hover:scale-110 cursor-pointer flex items-center justify-center"
                          style={{ backgroundColor: colorHex }}
                          title={`تطبيق ${colorHex}`}
                        >
                          <span className="sr-only">{colorHex}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Interactive Color Role Swapping Panel */}
                <div
                  className="p-4 rounded-2xl border-2 border-b-4 space-y-3"
                  style={{
                    backgroundColor: tPrimary,
                    borderColor: tBorder,
                    borderBottomColor: tShadow
                  }}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-black flex items-center gap-1.5" style={{ color: tAccent }}>
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      <span>التبديل التفاعلي بين الألوان (اضغط على أي لونين للتبديل بينهما):</span>
                    </span>
                    {swapFirstRole && (
                      <span
                        className="text-[11px] px-3 py-1 rounded-xl border-2 border-b-2 font-black"
                        style={{
                          backgroundColor: `${tAccent}22`,
                          borderColor: tAccent,
                          color: tAccent
                        }}
                      >
                        تم تحديد: {getRoleArabicName(swapFirstRole)} • اضغط على اللون الثاني لإتمام التبديل
                      </span>
                    )}
                  </div>

                  {/* 5 Color Roles Clickable Chips */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {(
                      [
                        { key: 'backgroundColor', label: 'لون الخلفية' },
                        { key: 'primaryColor', label: 'اللون الأساسي' },
                        { key: 'cardColor', label: 'لون البطاقات' },
                        { key: 'accentColor', label: 'لون التمييز' },
                        { key: 'textColor', label: 'لون النصوص' }
                      ] as const
                    ).map(item => {
                      const isFirst = swapFirstRole === item.key;
                      const val = themeColors[item.key] || '#ffffff';
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => handleSelectRoleForSwap(item.key)}
                          className="p-2.5 rounded-2xl border-2 border-b-4 text-right transition-all cursor-pointer flex items-center justify-between gap-1.5 active:translate-y-[2px] active:border-b-2 hover:brightness-110"
                          style={{
                            backgroundColor: tSecondary,
                            borderColor: isFirst ? tAccent : tBorder,
                            borderBottomColor: isFirst ? tAccentShadow : tSecondaryShadow
                          }}
                          title="اضغط للتبديل مع لون آخر"
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] opacity-80 font-bold line-clamp-1" style={{ color: tText }}>
                              {item.label}
                            </span>
                            <span className="text-[11px] font-mono font-black line-clamp-1" style={{ color: tText }}>
                              {val}
                            </span>
                          </div>
                          <span
                            className="w-6 h-6 rounded-xl border-2 border-white/30 shrink-0 shadow"
                            style={{ backgroundColor: val }}
                          />
                        </button>
                      );
                    })}
                  </div>

                  {/* Quick Swap Shortcuts */}
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <span className="text-[10px] font-bold opacity-80 ml-1" style={{ color: tText }}>تبديل سريع:</span>
                    <button
                      type="button"
                      onClick={() => handleQuickSwap('textColor', 'backgroundColor')}
                      className="px-3 py-1.5 rounded-xl text-[10px] font-black border-2 border-b-[3px] transition-all cursor-pointer flex items-center gap-1 active:translate-y-[1px] active:border-b-2 hover:brightness-110"
                      style={{
                        backgroundColor: tSecondary,
                        borderColor: tBorder,
                        borderBottomColor: tSecondaryShadow,
                        color: tAccent
                      }}
                    >
                      <ArrowLeftRight className="w-2.5 h-2.5" />
                      <span>النصوص ⇄ الخلفية</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickSwap('primaryColor', 'accentColor')}
                      className="px-3 py-1.5 rounded-xl text-[10px] font-black border-2 border-b-[3px] transition-all cursor-pointer flex items-center gap-1 active:translate-y-[1px] active:border-b-2 hover:brightness-110"
                      style={{
                        backgroundColor: tSecondary,
                        borderColor: tBorder,
                        borderBottomColor: tSecondaryShadow,
                        color: tAccent
                      }}
                    >
                      <ArrowLeftRight className="w-2.5 h-2.5" />
                      <span>الأساسي ⇄ التمييز</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickSwap('cardColor', 'backgroundColor')}
                      className="px-3 py-1.5 rounded-xl text-[10px] font-black border-2 border-b-[3px] transition-all cursor-pointer flex items-center gap-1 active:translate-y-[1px] active:border-b-2 hover:brightness-110"
                      style={{
                        backgroundColor: tSecondary,
                        borderColor: tBorder,
                        borderBottomColor: tSecondaryShadow,
                        color: tAccent
                      }}
                    >
                      <ArrowLeftRight className="w-2.5 h-2.5" />
                      <span>البطاقات ⇄ الخلفية</span>
                    </button>
                  </div>
                </div>

                {/* Interactive Live Preview Box */}
                <div
                  className="rounded-2xl p-4 border-2 border-b-4 transition-all duration-300 space-y-3 shadow-md"
                  style={{
                    backgroundColor: tBg,
                    borderColor: tBorder,
                    borderBottomColor: tShadow,
                    color: tText
                  }}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-xl border-2 border-b-2 flex items-center justify-center font-black text-xs shadow"
                        style={{
                          backgroundColor: tCard,
                          borderColor: tAccent,
                          color: tAccent
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-black font-heading">
                        معاينة مباشرة: بطاقات وأزرار {generalForm.complexName || 'المجمع'}
                      </span>
                    </div>
                    <span
                      className="text-[10px] px-2.5 py-1 rounded-xl border-2 font-black"
                      style={{
                        backgroundColor: tCard,
                        borderColor: tAccent,
                        color: tAccent
                      }}
                    >
                      ثيم نشط
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div
                      className="p-3.5 rounded-2xl border-2 border-b-4 space-y-1 shadow-sm"
                      style={{
                        backgroundColor: tCard,
                        borderColor: tBorder,
                        borderBottomColor: tShadow
                      }}
                    >
                      <div className="text-xs font-black" style={{ color: tText }}>
                        بطاقة الحلقة القرآنية
                      </div>
                      <div className="text-[11px] opacity-85 font-bold" style={{ color: tText }}>
                        متابعة الحفظ والتسميع اليومي (14 طالب مسجل)
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="flex-1 py-2.5 px-3 rounded-2xl border-2 border-b-4 font-black text-xs transition-all shadow-sm flex items-center justify-center gap-1.5"
                        style={{
                          backgroundColor: tAccent,
                          borderColor: tAccent,
                          borderBottomColor: tAccentShadow,
                          color: tAccentText
                        }}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>زر رئيسي</span>
                      </button>
                      <div
                        className="px-3.5 py-2.5 rounded-2xl border-2 border-b-4 text-xs font-black"
                        style={{
                          backgroundColor: tSecondary,
                          borderColor: tBorder,
                          borderBottomColor: tSecondaryShadow,
                          color: tText
                        }}
                      >
                        زر ثانوي
                      </div>
                    </div>
                  </div>
                </div>

                {/* Custom Hex Pickers */}
                <div className="pt-3 border-t-2" style={{ borderColor: tBorder }}>
                  <label className="block text-xs font-black mb-2.5" style={{ color: tAccent }}>
                    تعديل قيم الألوان المخصصة يدوياً (Hex):
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { key: 'primaryColor' as const, label: 'اللون الأساسي' },
                      { key: 'secondaryColor' as const, label: 'لون البطاقات' },
                      { key: 'accentColor' as const, label: 'لون التمييز والذهب' },
                      { key: 'backgroundColor' as const, label: 'لون الخلفية' }
                    ].map(cField => (
                      <div
                        key={cField.key}
                        className="p-2.5 rounded-2xl border-2 border-b-4 space-y-1.5"
                        style={{
                          backgroundColor: tPrimary,
                          borderColor: tBorder,
                          borderBottomColor: tShadow
                        }}
                      >
                        <span className="block text-[11px] font-black" style={{ color: tText }}>{cField.label}:</span>
                        <div className="flex items-center gap-2">
                          <span
                            className="w-7 h-7 rounded-xl border-2 border-white/30 shrink-0 shadow-inner"
                            style={{ backgroundColor: themeColors[cField.key] || '#131f24' }}
                          />
                          <input
                            type="text"
                            value={themeColors[cField.key] || ''}
                            onChange={e => {
                              const nextVal = e.target.value;
                              if (cField.key === 'secondaryColor') {
                                setThemeColors({ ...themeColors, secondaryColor: nextVal, cardColor: nextVal });
                              } else {
                                setThemeColors({ ...themeColors, [cField.key]: nextVal });
                              }
                            }}
                            className="w-full rounded-xl border px-2 py-1 text-xs font-mono font-black text-white outline-none ltr text-left"
                            style={{
                              backgroundColor: tSecondary,
                              borderColor: tBorder
                            }}
                            dir="ltr"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 rounded-2xl border-2 border-b-4 font-black text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-2 shadow-lg active:translate-y-[2px] active:border-b-2 hover:brightness-110 disabled:opacity-50"
                  style={{
                    backgroundColor: tAccent,
                    borderColor: tAccent,
                    borderBottomColor: tAccentShadow,
                    color: tAccentText
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جاري حفظ وتطبيق الإعدادات...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>حفظ الإعدادات وثيم المجمع</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* 5. Real Mail & Gmail Service Tab */}
          {activeTab === 'mail' && (
            <div className="space-y-5 animate-fade-in p-1">
              {/* Header Banner */}
              <div
                className="p-4 sm:p-5 rounded-[24px] border-2 border-b-4 space-y-2 relative overflow-hidden shadow-md"
                style={{
                  backgroundColor: tSecondary,
                  borderColor: tAccent,
                  borderBottomColor: tAccentShadow
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-2xl border-2 border-b-4 flex items-center justify-center font-black shrink-0 shadow-sm"
                    style={{
                      backgroundColor: tPrimary,
                      borderColor: tAccent,
                      borderBottomColor: tAccentShadow,
                      color: tAccent
                    }}
                  >
                    <Mail className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-base font-black text-white font-heading flex items-center gap-2 flex-wrap">
                      <span>خدمة إرسال البريد الإلكتروني الحقيقي (Gmail)</span>
                      {mailConfigStatus?.isConfigured ? (
                        <span className="text-[11px] px-2.5 py-0.5 rounded-xl bg-[#58cc02]/15 text-[#89e219] border-2 border-b-2 border-[#58cc02] border-b-[#46a302] font-black">
                          مفعلة ومتصلة ✓
                        </span>
                      ) : (
                        <span
                          className="text-[11px] px-2.5 py-0.5 rounded-xl border-2 border-b-2 font-black"
                          style={{
                            backgroundColor: `${tAccent}20`,
                            borderColor: tAccent,
                            color: tAccent
                          }}
                        >
                          بانتظار الإعداد
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-300 font-bold leading-relaxed mt-1">
                      إرسال رسائل بريد إلكتروني حقيقية مباشرة إلى البريد الشخصي للطلاب وأولياء الأمور (رموز التحقق OTP، إشعارات استلام الطلب، وبشرى القبول والاعتماد).
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Indicator */}
              <div
                className="p-4 rounded-2xl border-2 border-b-4 flex items-center justify-between gap-3 text-xs font-black flex-wrap"
                style={
                  mailConfigStatus?.isConfigured
                    ? {
                        backgroundColor: '#58cc0218',
                        borderColor: '#58cc02',
                        borderBottomColor: '#46a302',
                        color: '#d9f99d'
                      }
                    : {
                        backgroundColor: tSecondary,
                        borderColor: tAccent,
                        borderBottomColor: tAccentShadow,
                        color: tText
                      }
                }
              >
                <div className="flex items-center gap-2.5">
                  {mailConfigStatus?.isConfigured ? (
                    <CheckCircle2 className="w-4 h-4 text-[#89e219] shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" style={{ color: tAccent }} />
                  )}
                  <span>
                    {mailConfigStatus?.isConfigured
                      ? `خدمة البريد نشطة وجاهزة للإرسال الفعلي عبر الحساب: (${mailConfigStatus.user})`
                      : 'خدمة البريد غير مربوطة حالياً. أدخل بيانات حساب Gmail بالأسفل لتفعيل الإرسال الحقيقي فوراً.'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={fetchMailConfig}
                  className="px-3.5 py-1.5 rounded-xl border-2 border-b-[3px] font-black transition-all cursor-pointer flex items-center gap-1.5 shrink-0 active:translate-y-[1px] active:border-b-2 hover:brightness-110"
                  style={{
                    backgroundColor: tPrimary,
                    borderColor: tBorder,
                    borderBottomColor: tShadow,
                    color: tText
                  }}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>تحديث الحالة</span>
                </button>
              </div>

              {/* Gmail Settings Form */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!gmailUser.trim() || !gmailAppPass.trim()) {
                    setStatusMsg({ type: 'error', text: 'يرجى إدخال بريد Gmail وكلمة مرور التطبيقات.' });
                    return;
                  }
                  setIsSavingMailConfig(true);
                  setStatusMsg(null);
                  try {
                    const cleanUser = gmailUser.trim();
                    const cleanPass = gmailAppPass.trim().replace(/\s+/g, '');
                    const cleanFromName = mailFromName.trim() || (activeComplex?.name ? `مجمع ${activeComplex.name}` : 'منظومة عُمْرَان القرآنية');
                    const cleanFromEmail = mailFromEmail.trim() || cleanUser;

                    await saveMailConfigToCloudForever({
                      user: cleanUser,
                      pass: cleanPass,
                      fromName: cleanFromName,
                      fromEmail: cleanFromEmail,
                      complex: activeComplex || undefined,
                      complexId: activeComplex?.id,
                      onSaveComplex: onSaveComplex
                    });

                    setGmailAppPass(cleanPass);
                    setStatusMsg({
                      type: 'success',
                      text: 'تم حفظ البريد والمفتاح في قاعدة البيانات السحابية للأبد وربطهما برابط تسجيل المجمع بنجاح! يمكنك تعديلهما في أي وقت.'
                    });
                    setMailConfigStatus({ isConfigured: true, user: cleanUser });
                  } catch (err: any) {
                    setStatusMsg({ type: 'error', text: err?.message || 'فشل حفظ إعدادات البريد.' });
                  } finally {
                    setIsSavingMailConfig(false);
                  }
                }}
                className="p-5 rounded-[24px] border-2 border-b-4 space-y-4 shadow-md"
                style={{
                  backgroundColor: tSecondary,
                  borderColor: tBorder,
                  borderBottomColor: tSecondaryShadow
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b-2" style={{ borderColor: tBorder }}>
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <Key className="w-4 h-4" style={{ color: tAccent }} />
                    <span>بيانات حساب Gmail والمفتاح المحفوظة في قاعدة البيانات</span>
                  </h4>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-black px-3 py-1 rounded-xl bg-[#58cc02]/15 border-2 border-b-2 border-[#58cc02] text-[#89e219]">
                    <Database className="w-3.5 h-3.5" />
                    <span>يُحفظ للأبد لبوابة المجمع • قابل للتعديل بأي وقت</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black mb-1.5" style={{ color: tText }}>
                      بريد Gmail الشخصي أو الرسمي <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="مثال: ikmhhg68@gmail.com"
                      value={gmailUser}
                      onChange={e => setGmailUser(e.target.value)}
                      className="w-full border-2 border-b-4 rounded-2xl px-3.5 py-2.5 text-sm text-white font-bold focus:outline-none"
                      style={{
                        backgroundColor: tPrimary,
                        borderColor: tBorder,
                        borderBottomColor: tShadow
                      }}
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black mb-1.5" style={{ color: tText }}>
                      مفتاح مرور التطبيقات (Google App Password - 16 حرفاً) <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={showMailPass ? 'text' : 'password'}
                        required
                        placeholder="16 حرفاً من Google (مثال: abcd efgh ijkl mnop)"
                        value={gmailAppPass}
                        onChange={e => setGmailAppPass(e.target.value)}
                        className="w-full border-2 border-b-4 rounded-2xl pl-20 pr-3.5 py-2.5 text-sm text-white font-bold focus:outline-none font-mono"
                        style={{
                          backgroundColor: tPrimary,
                          borderColor: tBorder,
                          borderBottomColor: tShadow
                        }}
                        dir="ltr"
                      />
                      <div className="absolute left-2 flex items-center gap-1">
                        {gmailAppPass && (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(gmailAppPass.replace(/\s+/g, ''));
                              setCopiedMailPass(true);
                              setTimeout(() => setCopiedMailPass(false), 2000);
                            }}
                            className="p-1.5 rounded-xl border transition cursor-pointer"
                            style={{
                              backgroundColor: tSecondary,
                              borderColor: tBorder,
                              color: tAccent
                            }}
                            title="نسخ المفتاح المحفوظ"
                          >
                            {copiedMailPass ? <Check className="w-3.5 h-3.5 text-[#89e219]" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowMailPass(prev => !prev)}
                          className="p-1.5 rounded-xl border transition cursor-pointer text-slate-200"
                          style={{
                            backgroundColor: tSecondary,
                            borderColor: tBorder
                          }}
                          title={showMailPass ? 'إخفاء المفتاح' : 'إظهار المفتاح المحفوظ للتعديل أو المراجعة'}
                        >
                          {showMailPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black mb-1.5" style={{ color: tText }}>
                      اسم المرسل الذي يظهر في عنوان البريد
                    </label>
                    <input
                      type="text"
                      value={mailFromName}
                      onChange={e => setMailFromName(e.target.value)}
                      placeholder="مثال: مجمع عُمران القرآني"
                      className="w-full border-2 border-b-4 rounded-2xl px-3.5 py-2.5 text-sm text-white font-bold focus:outline-none"
                      style={{
                        backgroundColor: tPrimary,
                        borderColor: tBorder,
                        borderBottomColor: tShadow
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-black mb-1.5" style={{ color: tText }}>
                      عنوان بريد الرد (Reply-To)
                    </label>
                    <input
                      type="email"
                      value={mailFromEmail}
                      onChange={e => setMailFromEmail(e.target.value)}
                      placeholder="اتركه فارغاً لاستخدام بريد Gmail نفسه"
                      className="w-full border-2 border-b-4 rounded-2xl px-3.5 py-2.5 text-sm text-white font-bold focus:outline-none"
                      style={{
                        backgroundColor: tPrimary,
                        borderColor: tBorder,
                        borderBottomColor: tShadow
                      }}
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Google App Password Guide */}
                <div
                  className="p-4 rounded-2xl border-2 border-b-4 text-xs text-slate-300 font-bold space-y-1.5 leading-relaxed"
                  style={{
                    backgroundColor: tPrimary,
                    borderColor: tBorder,
                    borderBottomColor: tShadow
                  }}
                >
                  <div className="flex items-center gap-1.5 font-black" style={{ color: tAccent }}>
                    <Sparkles className="w-4 h-4" />
                    <span>كيف تحصل على كلمة مرور التطبيقات من Google خلال دقيقة؟</span>
                  </div>
                  <ol className="list-decimal list-inside space-y-1 pr-1 text-slate-300">
                    <li>
                      افتح صفحة كلمات مرور التطبيقات في Google:{' '}
                      <a
                        href="https://myaccount.google.com/apppasswords"
                        target="_blank"
                        rel="noreferrer"
                        className="underline font-mono inline-flex items-center gap-0.5"
                        style={{ color: tAccent }}
                      >
                        myaccount.google.com/apppasswords <ExternalLink className="w-3 h-3 inline" />
                      </a>
                    </li>
                    <li>اكتب اسم التطبيق (مثال: عُمران) واضغط على <strong>إنشاء (Create)</strong>.</li>
                    <li>انسخ كلمة المرور المكونة من 16 حرفاً وضعها في الخانة أعلاه واضغط حفظ.</li>
                  </ol>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSavingMailConfig}
                    className="px-6 py-3 rounded-2xl border-2 border-b-4 font-black text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-2 shadow-lg active:translate-y-[2px] active:border-b-2 hover:brightness-110 disabled:opacity-50"
                    style={{
                      backgroundColor: tAccent,
                      borderColor: tAccent,
                      borderBottomColor: tAccentShadow,
                      color: tAccentText
                    }}
                  >
                    {isSavingMailConfig ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>جاري حفظ وتفعيل خدمة البريد...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>حفظ وتفعيل خدمة البريد الآن</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Live Test Email Section */}
              <div
                className="p-5 rounded-[24px] border-2 border-b-4 space-y-4 shadow-md"
                style={{
                  backgroundColor: tSecondary,
                  borderColor: tBorder,
                  borderBottomColor: tSecondaryShadow
                }}
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <Send className="w-4 h-4 text-[#89e219]" />
                    <span>تجربة إرسال بريد حقيقي فوري للتأكد</span>
                  </h4>
                  <span className="text-[11px] font-bold text-slate-300">إرسال فوري إلى صندوق الوارد</span>
                </div>

                <p className="text-xs font-bold text-slate-300">
                  أدخل بريدك الإلكتروني الشخصي واضغط إرسال، وسيقوم النظام فوراً بإرسال رسالة تجريبية حقيقية لصندوق واردك لتتأكد بنفسك من عمل الخدمة.
                </p>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="email"
                    value={testEmailTo}
                    onChange={e => setTestEmailTo(e.target.value)}
                    placeholder="أدخل بريدك الشخصي (مثال: ikmhhg68@gmail.com)"
                    className="flex-1 border-2 border-b-4 rounded-2xl px-3.5 py-2.5 text-sm text-white font-bold focus:outline-none font-mono"
                    style={{
                      backgroundColor: tPrimary,
                      borderColor: tBorder,
                      borderBottomColor: tShadow
                    }}
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!testEmailTo.trim()) {
                        setMailTestResult({ success: false, msg: 'يرجى كتابة عنوان البريد للمستلم.' });
                        return;
                      }
                      setIsTestingMail(true);
                      setMailTestResult(null);
                      try {
                        const res = await fetch(ApiConfig.getEndpoint('/api/mail/send-gmail'), {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            to: testEmailTo.trim(),
                            subject: `رسالة اختبار الإرسال الحقيقي من ${activeComplex?.name || 'منظومة عُمران'}`,
                            html: `<div dir="rtl" style="font-family: Arial, sans-serif; padding: 24px; background-color: #f8fafc; color: #1e293b; border-radius: 16px;">
                              <h2 style="color: #064e3b; margin-top: 0;">🎉 تهانينا! خدمة البريد الحقيقية تعمل بنجاح</h2>
                              <p>وصلتك هذه الرسالة بنجاح في صندوق بريدك الشخصي عبر خدمة Gmail في منظومة عُمْرَان لإدارة المجمعات والحلقات القرآنية.</p>
                              <div style="background-color: #ecfdf5; border: 2px solid #10b981; border-radius: 12px; padding: 16px; margin: 16px 0;">
                                <strong>حالة الإرسال:</strong> بريد حقيقي مباشر تم استلامه في صندوق الوارد<br/>
                                <strong>المستلم:</strong> ${testEmailTo.trim()}<br/>
                                <strong>التاريخ والوقت:</strong> ${new Date().toLocaleString('ar-SA')}
                              </div>
                              <p style="font-size: 13px; color: #64748b;">جميع رسائل التحقق (OTP) وتسجيل الطلاب وإشعارات أولياء الأمور ستصلكم فوراً بنفس هذه الآلية الحقيقية.</p>
                            </div>`,
                            fromName: mailFromName.trim(),
                            fromEmail: mailFromEmail.trim() || gmailUser.trim(),
                            gmailUser: gmailUser.trim() || undefined,
                            gmailAppPassword: gmailAppPass.trim() || undefined
                          })
                        });
                        let data: any = null;
                        try {
                          data = await res.json();
                        } catch {
                          // non-json
                        }

                        if (res.ok && data?.success) {
                          setMailTestResult({
                            success: true,
                            msg: `🎉 تم إرسال رسالة البريد الحقيقية بنجاح إلى صندوق الوارد (${testEmailTo.trim()})! يرجى فتح بريدك للتأكد (أو فحص مجلد الرسائل غير المرغوب فيها Spam).`
                          });
                        } else {
                          setMailTestResult({
                            success: false,
                            msg: data?.error || 'تعذر إرسال بريد الاختبار. يرجى التأكد من كتابة البريد وكلمة مرور التطبيقات بشكل صحيح.'
                          });
                        }
                      } catch (err: any) {
                        setMailTestResult({
                          success: false,
                          msg: err?.message || 'فشل الاتصال بخادم البريد.'
                        });
                      } finally {
                        setIsTestingMail(false);
                      }
                    }}
                    disabled={isTestingMail}
                    className="px-5 py-2.5 rounded-2xl border-2 border-b-4 font-black text-xs sm:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 shadow-md active:translate-y-[2px] active:border-b-2 hover:brightness-110 disabled:opacity-50"
                    style={{
                      backgroundColor: tAccent,
                      borderColor: tAccent,
                      borderBottomColor: tAccentShadow,
                      color: tAccentText
                    }}
                  >
                    {isTestingMail ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>جاري الإرسال التجريبي...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>إرسال بريد تجريبي الآن 🚀</span>
                      </>
                    )}
                  </button>
                </div>

                {mailTestResult && (
                  <div
                    className="p-3.5 rounded-2xl border-2 border-b-4 text-xs font-black flex items-center gap-2"
                    style={
                      mailTestResult.success
                        ? {
                            backgroundColor: '#58cc0218',
                            borderColor: '#58cc02',
                            borderBottomColor: '#46a302',
                            color: '#d9f99d'
                          }
                        : {
                            backgroundColor: '#ff4b4b18',
                            borderColor: '#ff4b4b',
                            borderBottomColor: '#cc2e2e',
                            color: '#fecdd3'
                          }
                    }
                  >
                    {mailTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-[#89e219] shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-[#ff6b6b] shrink-0" />
                    )}
                    <span>{mailTestResult.msg}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default SettingsModal;
