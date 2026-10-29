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
  Award,
  RefreshCw,
  Wand2,
  Globe,
  Mail,
  Send,
  ExternalLink
} from 'lucide-react';
import {
  TeacherAccount,
  Halaqah,
  Student,
  AppSettings,
  QuranComplex,
  ComplexThemeConfig,
  AttendancePointsSettings,
  getThreePartNameValidation,
  isTeacherDeveloper,
  getTeacherSixDigitCode,
  normalizeArabicDigits,
  normalizeTeacherText,
  normalizeArabicText
} from '../types';
import { ISLAMIC_THEME_PRESETS, applyComplexThemeToDOM, extractColorsFromImageDataUrl, generateHarmoniousIslamicPalette } from '../lib/themeUtils';
import { OmranDataService, db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { triggerComplexThemePulse } from '../utils/highlightHelper';
import { ApiConfig } from '../lib/apiConfig';
import { loadSavedMailConfigFromCloud, saveMailConfigToCloudForever } from '../lib/portalEmailService';

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

      const halaqahPayload: Halaqah = {
        id: editingHalaqah.id || `halaqah-${Date.now()}`,
        name: editingHalaqah.name.trim(),
        description: editingHalaqah.description?.trim() || '',
        complexId: targetComplex?.id || editingHalaqah.complexId || 'complex-main',
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
    workDaysPerWeek: settings.workDaysPerWeek ?? 5,
    presentPoints: settings.attendancePointsSettings?.presentPoints ?? 1,
    latePoints: settings.attendancePointsSettings?.latePoints ?? 0,
    excusedPoints: settings.attendancePointsSettings?.excusedPoints ?? 0,
    absentPointsDeduction: settings.attendancePointsSettings?.absentPointsDeduction ?? 1,
    enableAttendancePoints: settings.attendancePointsSettings?.enableAttendancePoints ?? true
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
        workDaysPerWeek: settings.workDaysPerWeek ?? 5,
        presentPoints: settings.attendancePointsSettings?.presentPoints ?? 1,
        latePoints: settings.attendancePointsSettings?.latePoints ?? 0,
        excusedPoints: settings.attendancePointsSettings?.excusedPoints ?? 0,
        absentPointsDeduction: settings.attendancePointsSettings?.absentPointsDeduction ?? 1,
        enableAttendancePoints: settings.attendancePointsSettings?.enableAttendancePoints ?? true
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

      const attPoints: AttendancePointsSettings = {
        presentPoints: Number(generalForm.presentPoints),
        latePoints: Number(generalForm.latePoints),
        excusedPoints: Number(generalForm.excusedPoints),
        absentPointsDeduction: Number(generalForm.absentPointsDeduction),
        enableAttendancePoints: Boolean(generalForm.enableAttendancePoints)
      };

      await onUpdateSettings({
        halaqahName: generalForm.halaqahName.trim(),
        complexName: generalForm.complexName.trim() || activeComplex?.name || settings.complexName,
        allowStudentRegistration: generalForm.allowStudentRegistration,
        workDaysPerWeek: Number(generalForm.workDaysPerWeek) || 5,
        attendancePointsSettings: attPoints,
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-fade-in"
      dir="rtl"
    >
      <div
        className="border rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden transition-colors"
        data-complex-themed="true"
        style={{
          '--complex-bg': themeColors.backgroundColor,
          '--complex-primary': themeColors.primaryColor,
          '--complex-secondary': themeColors.secondaryColor,
          '--complex-card': themeColors.cardColor || themeColors.secondaryColor,
          '--complex-accent': themeColors.accentColor,
          '--complex-border': themeColors.secondaryColor,
          '--complex-text': themeColors.textColor || '#f0f9f6',
          '--complex-subtext': `${themeColors.textColor || '#f0f9f6'}cc`,
          backgroundColor: themeColors.cardColor || themeColors.backgroundColor,
          borderColor: themeColors.secondaryColor || '#065f46',
          color: themeColors.textColor || '#f0f9f6'
        } as React.CSSProperties}
      >
        {/* Modal Header */}
        <div
          className="p-4 sm:p-5 border-b flex items-center justify-between shrink-0 z-20"
          style={{
            backgroundColor: themeColors.primaryColor || '#022c22',
            borderColor: themeColors.secondaryColor || '#065f46'
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl border flex items-center justify-center shadow-sm"
              style={{
                backgroundColor: `${themeColors.accentColor}25`,
                borderColor: `${themeColors.accentColor}50`,
                color: themeColors.accentColor || '#fbbf24'
              }}
            >
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                إعدادات المنظومة والحلقات
              </h2>
              <p className="text-xs opacity-80" style={{ color: themeColors.textColor || '#86efac' }}>
                إدارة المعلمين والحلقات ونقل الطلاب وضبط قواعد المنظومة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg opacity-70 hover:opacity-100 transition cursor-pointer"
            style={{ color: themeColors.textColor || '#86efac' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation (Sticky & Prominent) */}
        <div
          className="flex border-b px-3 overflow-x-auto gap-1 shrink-0 z-10 sticky top-0 shadow-sm"
          style={{
            backgroundColor: themeColors.primaryColor || '#022c22',
            borderColor: themeColors.secondaryColor || '#065f46'
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('teachers')}
            className="px-4 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap cursor-pointer"
            style={
              activeTab === 'teachers'
                ? {
                    borderColor: themeColors.accentColor,
                    color: themeColors.accentColor,
                    backgroundColor: `${themeColors.secondaryColor}80`,
                    fontWeight: 900
                  }
                : {
                    borderColor: 'transparent',
                    color: themeColors.textColor ? `${themeColors.textColor}B3` : '#86efac'
                  }
            }
          >
            <Users className="w-4 h-4" />
            <span>المعلمون والمحفظون ({teachers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('halaqahs')}
            className="px-4 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap cursor-pointer"
            style={
              activeTab === 'halaqahs'
                ? {
                    borderColor: themeColors.accentColor,
                    color: themeColors.accentColor,
                    backgroundColor: `${themeColors.secondaryColor}80`,
                    fontWeight: 900
                  }
                : {
                    borderColor: 'transparent',
                    color: themeColors.textColor ? `${themeColors.textColor}B3` : '#86efac'
                  }
            }
          >
            <Layers className="w-4 h-4" />
            <span>الحلقات القرآنية ({halaqahs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('transfers')}
            className="px-4 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap cursor-pointer"
            style={
              activeTab === 'transfers'
                ? {
                    borderColor: themeColors.accentColor,
                    color: themeColors.accentColor,
                    backgroundColor: `${themeColors.secondaryColor}80`,
                    fontWeight: 900
                  }
                : {
                    borderColor: 'transparent',
                    color: themeColors.textColor ? `${themeColors.textColor}B3` : '#86efac'
                  }
            }
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>نقل وتوزيع الطلاب</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className="px-4 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap cursor-pointer"
            style={
              activeTab === 'general'
                ? {
                    borderColor: themeColors.accentColor,
                    color: themeColors.accentColor,
                    backgroundColor: `${themeColors.secondaryColor}80`,
                    fontWeight: 900
                  }
                : {
                    borderColor: 'transparent',
                    color: themeColors.textColor ? `${themeColors.textColor}B3` : '#86efac'
                  }
            }
          >
            <Sliders className="w-4 h-4" />
            <span>الإعدادات العامة والثيم</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('mail')}
            className="px-4 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap cursor-pointer"
            style={
              activeTab === 'mail'
                ? {
                    borderColor: themeColors.accentColor,
                    color: themeColors.accentColor,
                    backgroundColor: `${themeColors.secondaryColor}80`,
                    fontWeight: 900
                  }
                : {
                    borderColor: 'transparent',
                    color: themeColors.textColor ? `${themeColors.textColor}B3` : '#86efac'
                  }
            }
          >
            <Mail className="w-4 h-4" />
            <span>البريد الإلكتروني وGmail</span>
            {mailConfigStatus?.isConfigured && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shadow-sm"></span>
            )}
          </button>
        </div>

        {/* Status Message */}
        {statusMsg && (
          <div
            className={`mx-4 mt-3 p-3 rounded-xl border flex items-center gap-2 text-sm ${
              statusMsg.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                : 'bg-red-950/80 border-red-500 text-red-200'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* TAB 1: TEACHERS */}
          {activeTab === 'teachers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-white text-base">قائمة المعلمين والمشرفين</h3>
                  <p className="text-xs text-[#86efac]/80">إدارة حسابات المعلمين وصلاحياتهم في المجمع</p>
                </div>
                {!editingTeacher && (
                  <button
                    type="button"
                    onClick={handleStartAddTeacher}
                    className="flex items-center gap-2 bg-[#fbbf24] text-[#064e3b] font-bold px-3.5 py-2 rounded-xl hover:bg-amber-300 transition text-sm cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة معلم جديد</span>
                  </button>
                )}
              </div>

              {editingTeacher ? (
                /* Teacher Form / Code Lookup Container */
                <div className="bg-[#022c22]/70 border border-[#065f46] rounded-xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#065f46]">
                    <h4 className="font-bold text-amber-300 text-sm flex items-center gap-2">
                      <UserCheck className="w-4 h-4" />
                      {isNewTeacher ? 'إضافة حساب معلم' : 'تعديل بيانات المعلم'}
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTeacher(null);
                        setFoundTeacherByCode(null);
                        setSearchTeacherCode('');
                      }}
                      className="text-xs text-[#86efac]/70 hover:text-white"
                    >
                      إلغاء
                    </button>
                  </div>

                  {/* Mode Switcher when adding a new teacher */}
                  {isNewTeacher && (
                    <div className="grid grid-cols-2 gap-2 bg-[#064e3b]/60 p-1 rounded-2xl border border-[#065f46]">
                      <button
                        type="button"
                        onClick={() => {
                          setAddMode('new');
                          setFoundTeacherByCode(null);
                          setCodeSearchError('');
                        }}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          addMode === 'new'
                            ? 'bg-[#fbbf24] text-[#064e3b] font-black shadow-md'
                            : 'text-[#86efac] hover:text-white'
                        }`}
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
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          addMode === 'code'
                            ? 'bg-[#fbbf24] text-[#064e3b] font-black shadow-md'
                            : 'text-[#86efac] hover:text-white'
                        }`}
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>مسجل بالفعل (بالرمز الفريد)</span>
                      </button>
                    </div>
                  )}

                  {isNewTeacher && addMode === 'code' ? (
                    /* Search & Attach by 6-Digit Code */
                    <div className="space-y-4 text-xs">
                      <div className="p-3.5 rounded-2xl bg-[#011a14] border border-amber-400/40 text-[#86efac] space-y-1.5">
                        <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                          <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>كيفية الحصول على الرمز الفريد للمعلم:</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          يقوم المعلم بالضغط على زر <strong>(الحساب)</strong> في أعلى شاشة المنظومة، وسيظهر رمزه الفريد المكون من 6 أرقام في أعلى النافذة ليقوم بنسخه ومشاركته معك.
                        </p>
                      </div>

                      <div>
                        <label className="block font-bold mb-1.5" style={{ color: themeColors.textColor || '#86efac' }}>
                          أدخل الرمز الفريد للمعلم (6 أرقام) أو اسم المستخدم أو رقم الهاتف:
                        </label>
                        <div className="flex gap-2">
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
                            className="flex-1 rounded-xl px-3.5 py-2.5 text-base font-mono font-bold tracking-widest text-center outline-none"
                            style={{
                              backgroundColor: `${themeColors.primaryColor}CC`,
                              border: `1.5px solid ${themeColors.secondaryColor}`,
                              color: themeColors.accentColor || '#fbbf24'
                            }}
                            dir="ltr"
                          />
                          <button
                            type="button"
                            onClick={() => handleSearchTeacherByCode()}
                            className="px-4 py-2.5 rounded-xl font-bold text-xs cursor-pointer shrink-0 transition-all flex items-center gap-1.5 shadow"
                            style={{
                              backgroundColor: themeColors.accentColor || '#fbbf24',
                              color: themeColors.primaryColor || '#022c22'
                            }}
                          >
                            <Search className="w-4 h-4" />
                            <span>التحقق</span>
                          </button>
                        </div>
                        {codeSearchError && (
                          <div className="mt-2 p-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-200 text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                            <span>{codeSearchError}</span>
                          </div>
                        )}
                      </div>

                      {foundTeacherByCode && (
                        <div className="p-4 rounded-2xl bg-[#01221a] border-2 border-emerald-500/60 shadow-lg space-y-3.5 animate-fadeIn">
                          <div className="flex items-center justify-between border-b border-[#065f46] pb-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-[#fbbf24] border border-amber-400/30 flex items-center justify-center font-bold text-sm">
                                {foundTeacherByCode.name.charAt(0)}
                              </div>
                              <div>
                                <div className="font-bold text-white text-sm flex items-center gap-1.5">
                                  <span>{foundTeacherByCode.name}</span>
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    معلم مسجل
                                  </span>
                                </div>
                                <div className="text-[11px] text-[#86efac]/80 font-mono">
                                  @{foundTeacherByCode.username} {foundTeacherByCode.phone ? `• ${foundTeacherByCode.phone}` : ''}
                                </div>
                              </div>
                            </div>
                            <span className="text-xs font-mono font-bold text-[#fbbf24] bg-black/30 px-2 py-1 rounded-lg border border-amber-400/30" dir="ltr">
                              {foundTeacherByCode.teacherCode || getTeacherSixDigitCode(foundTeacherByCode)}
                            </span>
                          </div>

                          {/* Halaqah selector */}
                          {halaqahs.length > 0 && (
                            <div>
                              <label className="block text-emerald-200 font-bold mb-1">
                                تعيين الحلقة في هذا المجمع:
                              </label>
                              <select
                                value={selectedHalaqahIdForAttach}
                                onChange={e => setSelectedHalaqahIdForAttach(e.target.value)}
                                className="w-full bg-[#064e3b]/80 border border-[#065f46] rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-[#fbbf24] text-xs"
                              >
                                {halaqahs.map(h => (
                                  <option key={h.id} value={h.id} className="bg-[#022c22] text-white">
                                    {h.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={handleAttachTeacherByCode}
                            disabled={isSubmitting}
                            className="w-full py-2.5 rounded-xl bg-[#fbbf24] hover:bg-[#f59e0b] text-[#064e3b] font-black cursor-pointer shadow-lg transition-all flex items-center justify-center gap-2 text-xs disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-4 h-4 text-[#064e3b]" />
                            <span>{isSubmitting ? 'جاري الإلحاق...' : 'إلحاق المعلم بهذا المجمع والحلقة'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <form onSubmit={handleSaveTeacherSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-[#86efac] mb-1">
                            الاسم الثلاثي للمعلم <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={editingTeacher.name || ''}
                            onChange={e => setEditingTeacher({ ...editingTeacher, name: e.target.value })}
                            placeholder="مثال: عبد الله أحمد المنصور"
                            className="w-full bg-[#064e3b]/80 border border-[#065f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#86efac] mb-1">
                            اسم المستخدم للدخول <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={editingTeacher.username || ''}
                            onChange={e => setEditingTeacher({ ...editingTeacher, username: e.target.value })}
                            placeholder="مثال: abdullah"
                            className="w-full bg-[#064e3b]/80 border border-[#065f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#86efac] mb-1">
                            كلمة المرور للدخول
                          </label>
                          <input
                            type="text"
                            value={editingTeacher.password || ''}
                            onChange={e => setEditingTeacher({ ...editingTeacher, password: e.target.value })}
                            placeholder="كلمة المرور (الافتراضي 123)"
                            className="w-full bg-[#064e3b]/80 border border-[#065f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#86efac] mb-1">
                            رقم هاتف المعلم (واتساب)
                          </label>
                          <input
                            type="tel"
                            value={editingTeacher.phone || ''}
                            onChange={e => setEditingTeacher({ ...editingTeacher, phone: e.target.value })}
                            placeholder="05XXXXXXXX"
                            className="w-full bg-[#064e3b]/80 border border-[#065f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#86efac] mb-1">
                            المسمى والصفة
                          </label>
                          <input
                            type="text"
                            value={editingTeacher.title || ''}
                            onChange={e => setEditingTeacher({ ...editingTeacher, title: e.target.value })}
                            placeholder="مثال: معلم ومحفظ / المشرف الإداري"
                            className="w-full bg-[#064e3b]/80 border border-[#065f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#86efac] mb-1">
                            الرتبة والصلاحية
                          </label>
                          <select
                            value={editingTeacher.role || 'teacher'}
                            onChange={e => setEditingTeacher({ ...editingTeacher, role: e.target.value as any })}
                            className="w-full bg-[#064e3b]/80 border border-[#065f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                          >
                            <option value="teacher">معلم حلقة</option>
                            <option value="supervisor">مشرف مجمع</option>
                            {isDeveloper && <option value="developer">مبرمج ومطور المنظومة</option>}
                          </select>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#065f46]">
                        <button
                          type="button"
                          onClick={() => setEditingTeacher(null)}
                          className="px-4 py-2 rounded-xl bg-[#064e3b] text-[#86efac] hover:bg-[#064e3b]/80 text-sm font-medium transition cursor-pointer"
                        >
                          إلغاء
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="px-5 py-2 rounded-xl bg-[#fbbf24] text-[#064e3b] font-bold text-sm hover:bg-amber-300 transition cursor-pointer flex items-center gap-2"
                        >
                          {isSubmitting ? 'جاري الحفظ...' : 'حفظ بيانات المعلم'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ) : (
                /* Teachers List */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {teachers.filter(t => isDeveloper || !isTeacherDeveloper(t)).map(t => (
                    <div
                      key={t.id}
                      id={`teacher-item-${t.id}`}
                      data-item-id={t.id}
                      className="bg-[#022c22]/60 border border-[#065f46] rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-amber-400/40 transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#064e3b] border border-amber-400/20 flex items-center justify-center font-bold text-amber-300 text-sm shrink-0">
                          {t.name.slice(0, 1)}
                        </div>
                        <div>
                          <div className="font-bold text-white text-sm flex items-center gap-2">
                            <span>{t.name}</span>
                            {t.role === 'developer' ? (
                              <span className="text-[10px] bg-purple-900/60 border border-purple-400/40 text-purple-200 px-1.5 py-0.5 rounded">
                                مبرمج ومطور
                              </span>
                            ) : t.role === 'supervisor' ? (
                              <span className="text-[10px] bg-amber-900/60 border border-amber-400/40 text-amber-200 px-1.5 py-0.5 rounded">
                                مشرف
                              </span>
                            ) : (
                              <span className="text-[10px] bg-emerald-900/60 border border-emerald-400/40 text-emerald-200 px-1.5 py-0.5 rounded">
                                معلم
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-[#86efac]/70 flex items-center gap-2 mt-0.5">
                            <span>@{t.username}</span>
                            {t.phone && <span>• {t.phone}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleStartEditTeacher(t)}
                          className="p-1.5 text-amber-300 hover:bg-[#064e3b] rounded-lg transition cursor-pointer"
                          title="تعديل"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {deleteTeacherId === t.id ? (
                          <div className="flex items-center gap-1 bg-red-950/80 px-2 py-1 rounded-lg border border-red-500">
                            <button
                              type="button"
                              onClick={() => handleConfirmDeleteTeacher(t.id)}
                              className="text-xs text-red-300 font-bold hover:underline cursor-pointer"
                            >
                              تأكيد
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTeacherId(null)}
                              className="text-xs text-white hover:underline cursor-pointer"
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteTeacherId(t.id)}
                            className="p-1.5 text-red-400 hover:bg-[#064e3b] rounded-lg transition cursor-pointer"
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
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-white text-base">قائمة الحلقات القرآنية</h3>
                  <p className="text-xs text-[#86efac]/80">إضافة وتعديل الحلقات وتعيين المعلم المشرف</p>
                </div>
                {!editingHalaqah && (
                  <button
                    type="button"
                    onClick={handleStartAddHalaqah}
                    className="flex items-center gap-2 bg-[#fbbf24] text-[#064e3b] font-bold px-3.5 py-2 rounded-xl hover:bg-amber-300 transition text-sm cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة حلقة جديدة</span>
                  </button>
                )}
              </div>

              {editingHalaqah ? (
                /* Halaqah Form */
                <form onSubmit={handleSaveHalaqahSubmit} className="bg-[#022c22]/70 border border-[#065f46] rounded-xl p-4 sm:p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#065f46]">
                    <h4 className="font-bold text-amber-300 text-sm flex items-center gap-2">
                      <Layers className="w-4 h-4" />
                      {isNewHalaqah ? 'إضافة حلقة قرآنية جديدة' : 'تعديل بيانات الحلقة'}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setEditingHalaqah(null)}
                      className="text-xs text-[#86efac]/70 hover:text-white"
                    >
                      إلغاء
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#86efac] mb-1">
                        اسم الحلقة القرآنية <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={editingHalaqah.name || ''}
                        onChange={e => setEditingHalaqah({ ...editingHalaqah, name: e.target.value })}
                        placeholder="مثال: حلقة ابن كثير"
                        className="w-full bg-[#064e3b]/80 border border-[#065f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[#86efac] mb-1">
                        المعلم المشرف على الحلقة
                      </label>
                      <select
                        value={editingHalaqah.primaryTeacherName || ''}
                        onChange={e => setEditingHalaqah({ ...editingHalaqah, primaryTeacherName: e.target.value })}
                        className="w-full bg-[#064e3b]/80 border border-[#065f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                      >
                        <option value="">-- اختر المعلم --</option>
                        {teachers.map(t => (
                          <option key={t.id} value={t.name}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {complexes.length > 0 && (
                      <div>
                        <label className="block text-xs font-semibold text-[#86efac] mb-1">
                          المجمع القرآني التابعة له الحلقة
                        </label>
                        <select
                          value={editingHalaqah.complexId || activeComplex?.id || complexes[0]?.id || ''}
                          onChange={e => {
                            const cId = e.target.value;
                            const targetC = complexes.find(c => c.id === cId);
                            setEditingHalaqah({
                              ...editingHalaqah,
                              complexId: cId || undefined,
                              complexName: targetC?.name || editingHalaqah.complexName
                            });
                          }}
                          className="w-full bg-[#064e3b]/80 border border-[#065f46] rounded-lg px-3 py-2 text-sm text-[#fbbf24] font-bold focus:outline-none focus:border-amber-400 cursor-pointer"
                        >
                          {complexes.map(c => (
                            <option key={c.id} value={c.id} className="bg-[#064e3b] text-white">
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Halaqah Capacity (السعة الاستيعابية للطلاب) */}
                    <div>
                      <label className="block text-xs font-semibold text-[#86efac] mb-1">
                        السعة الاستيعابية للحلقة (الحد الأقصى للطلاب) <span className="text-amber-300">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={editingHalaqah.capacity !== undefined ? editingHalaqah.capacity : 15}
                        onChange={e => setEditingHalaqah({ ...editingHalaqah, capacity: Math.max(1, parseInt(e.target.value) || 15) })}
                        placeholder="15"
                        className="w-full bg-[#064e3b]/80 border border-[#065f46] rounded-lg px-3 py-2 text-sm text-white font-mono font-bold focus:outline-none focus:border-amber-400"
                      />
                      <span className="text-[10px] text-slate-300 mt-1 block">
                        إذا اكتمل عدد الطلاب سيظهر تنبيه التعبئة الكاملة وتوجيه الطلاب لقائمة الانتظار.
                      </span>
                    </div>

                    {/* Mosque Selection for Multi-Mosque System */}
                    {activeComplex?.mosques && activeComplex.mosques.length > 0 && (
                      <div>
                        <label className="block text-xs font-semibold text-[#86efac] mb-1">
                          المسجد التابعة له الحلقة في المنظومة
                        </label>
                        <select
                          value={editingHalaqah.mosqueId || ''}
                          onChange={e => {
                            const mId = e.target.value;
                            const mObj = activeComplex.mosques?.find(m => m.id === mId);
                            setEditingHalaqah({
                              ...editingHalaqah,
                              mosqueId: mId || undefined,
                              mosqueName: mObj?.name
                            });
                          }}
                          className="w-full bg-[#064e3b]/80 border border-[#065f46] rounded-lg px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-amber-400 cursor-pointer"
                        >
                          <option value="">-- اختياري: غير محدد بمسجد معين --</option>
                          {activeComplex.mosques.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name} {m.address ? `(${m.address})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-[#86efac] mb-1">
                        وصف أو ملاحظات عن الحلقة
                      </label>
                      <input
                        type="text"
                        value={editingHalaqah.description || ''}
                        onChange={e => setEditingHalaqah({ ...editingHalaqah, description: e.target.value })}
                        placeholder="مثال: حلقة المتقدمين في الحفظ والمراجعة"
                        className="w-full bg-[#064e3b]/80 border border-[#065f46] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>

                    {/* Online Halaqah Settings */}
                    <div className="bg-[#022c22]/90 border border-[#065f46] rounded-2xl p-4 space-y-3 sm:col-span-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingHalaqah.isOnline || false}
                          onChange={e => setEditingHalaqah({ ...editingHalaqah, isOnline: e.target.checked })}
                          className="w-4 h-4 rounded text-amber-400 focus:ring-amber-400"
                        />
                        <span className="text-xs font-black text-amber-300">هذه الحلقة أونلاين / عن بعد عبر Google Meet</span>
                      </label>

                      {editingHalaqah.isOnline && (
                        <div className="space-y-3 pt-2 border-t border-[#065f46]">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] text-emerald-200 font-bold mb-1">وقت بدء الحلقة اليومي:</label>
                              <input
                                type="time"
                                value={editingHalaqah.onlineStartTime || '16:00'}
                                onChange={e => setEditingHalaqah({ ...editingHalaqah, onlineStartTime: e.target.value })}
                                className="w-full bg-[#064e3b]/80 border border-[#065f46] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-400"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-emerald-200 font-bold mb-1">وقت انتهاء الحلقة اليومي:</label>
                              <input
                                type="time"
                                value={editingHalaqah.onlineEndTime || '18:00'}
                                onChange={e => setEditingHalaqah({ ...editingHalaqah, onlineEndTime: e.target.value })}
                                className="w-full bg-[#064e3b]/80 border border-[#065f46] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-400"
                              />
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] text-emerald-200 font-bold">رابط Google Meet المباشر:</label>
                              <a
                                href="https://meet.google.com/new"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-amber-300 hover:underline font-bold flex items-center gap-1"
                                title="فتح صفحة إنشاء اجتماع في Google Meet مباشرة"
                              >
                                إنشاء في Google Meet مباشرة ↗
                              </a>
                            </div>
                            <input
                              type="url"
                              placeholder="https://meet.google.com/abc-defg-hij"
                              value={editingHalaqah.meetingUri || ''}
                              onChange={e => setEditingHalaqah({ ...editingHalaqah, meetingUri: e.target.value })}
                              className="w-full bg-[#064e3b]/80 border border-[#065f46] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-400 ltr text-left"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#065f46]">
                    <button
                      type="button"
                      onClick={() => setEditingHalaqah(null)}
                      className="px-4 py-2 rounded-xl bg-[#064e3b] text-[#86efac] hover:bg-[#064e3b]/80 text-sm font-medium transition cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2 rounded-xl bg-[#fbbf24] text-[#064e3b] font-bold text-sm hover:bg-amber-300 transition cursor-pointer flex items-center gap-2"
                    >
                      {isSubmitting ? 'جاري الحفظ...' : 'حفظ بيانات الحلقة'}
                    </button>
                  </div>
                </form>
              ) : (
                /* Halaqahs List */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {halaqahs.map(h => {
                    const halaqahStudentsCount = students.filter(s => s.halaqahId === h.id).length;
                    const isActive = activeHalaqahId === h.id;

                    return (
                      <div
                        key={h.id}
                        id={`halaqah-item-${h.id}`}
                        data-item-id={h.id}
                        className={`bg-[#022c22]/60 border rounded-xl p-4 flex flex-col justify-between gap-3 transition ${
                          isActive
                            ? 'border-amber-400 bg-[#064e3b]/50 shadow-md'
                            : 'border-[#065f46] hover:border-amber-400/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-white text-base flex items-center gap-2">
                              <span>{h.name}</span>
                              {isActive && (
                                <span className="text-[10px] bg-amber-400 text-[#064e3b] font-extrabold px-2 py-0.5 rounded-full">
                                  الحلقة النشطة حالياً
                                </span>
                              )}
                            </div>
                            {h.description && (
                              <p className="text-xs text-[#86efac]/70 mt-1">{h.description}</p>
                            )}
                            <div className="text-xs text-amber-200/90 mt-2 flex items-center flex-wrap gap-2">
                              <span className="bg-[#065f46]/80 text-[#86efac] text-[11px] px-2 py-0.5 rounded-md border border-[#065f46]">
                                المجمع: {h.complexName || activeComplex?.name || 'المجمع الرئيسي'}
                              </span>
                              {h.mosqueName && (
                                <span className="bg-[#fbbf24]/20 text-[#fbbf24] text-[11px] px-2 py-0.5 rounded-md border border-[#fbbf24]/30 font-bold">
                                  جامع: {h.mosqueName}
                                </span>
                              )}
                              <span>المعلم: {h.primaryTeacherName || 'غير محدد'}</span>
                              <span className="font-bold">
                                • الطلاب: {halaqahStudentsCount} / {h.capacity || 15}
                              </span>
                            </div>

                            {/* Full Capacity Warning Banner */}
                            {halaqahStudentsCount >= (h.capacity || 15) && (
                              <div className="mt-2.5 p-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-black flex items-center gap-1.5 shadow-sm">
                                <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                <span>لقد وصلت الحلقة إلى التعبئة الكاملة للطلاب</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleStartEditHalaqah(h)}
                              className="p-1.5 text-amber-300 hover:bg-[#064e3b] rounded-lg transition cursor-pointer"
                              title="تعديل"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            {deleteHalaqahId === h.id ? (
                              <div className="flex items-center gap-1 bg-red-950/80 px-2 py-1 rounded-lg border border-red-500">
                                <button
                                  type="button"
                                  onClick={() => handleConfirmDeleteHalaqah(h.id)}
                                  className="text-xs text-red-300 font-bold hover:underline cursor-pointer"
                                >
                                  تأكيد
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteHalaqahId(null)}
                                  className="text-xs text-white hover:underline cursor-pointer"
                                >
                                  إلغاء
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeleteHalaqahId(h.id)}
                                className="p-1.5 text-red-400 hover:bg-[#064e3b] rounded-lg transition cursor-pointer"
                                title="حذف"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {onSwitchActiveHalaqah && !isActive && (
                          <div className="pt-2 border-t border-[#065f46]/50 flex justify-end">
                            <button
                              type="button"
                              onClick={() => onSwitchActiveHalaqah(h.id)}
                              className="text-xs bg-[#064e3b] hover:bg-amber-400 hover:text-[#064e3b] text-amber-300 font-semibold px-3 py-1.5 rounded-lg border border-amber-400/30 transition cursor-pointer"
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
              <div className="bg-[#022c22]/70 border border-[#065f46] rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-white text-base">نقل الطلاب وتوزيعهم بين الحلقات</h3>
                    <p className="text-xs text-[#86efac]/80">حدد الطلاب واختر الحلقة الوجهة للنقل الفوري</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={targetDestinationHalaqahId}
                      onChange={e => setTargetDestinationHalaqahId(e.target.value)}
                      className="bg-[#064e3b] border border-amber-400/40 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none"
                    >
                      <option value="">-- اختر الحلقة الوجهة --</option>
                      {halaqahs.map(h => (
                        <option key={h.id} value={h.id}>
                          {h.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={isSubmitting || selectedStudentIds.length === 0 || !targetDestinationHalaqahId}
                      onClick={handleExecuteTransfer}
                      className="flex items-center gap-1.5 bg-[#fbbf24] disabled:bg-gray-600 disabled:text-gray-400 text-[#064e3b] font-bold px-4 py-2 rounded-xl text-xs hover:bg-amber-300 transition cursor-pointer shadow-sm shrink-0"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>نقل ({selectedStudentIds.length}) طالب</span>
                    </button>
                  </div>
                </div>

                {/* Filter and Search */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#065f46]">
                  <div className="relative">
                    <Search className="w-4 h-4 text-[#86efac]/60 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={transferSearch}
                      onChange={e => setTransferSearch(e.target.value)}
                      placeholder="بحث باسم الطالب..."
                      className="w-full bg-[#064e3b]/80 border border-[#065f46] rounded-xl pr-9 pl-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={transferFilterHalaqah}
                      onChange={e => setTransferFilterHalaqah(e.target.value)}
                      className="w-full bg-[#064e3b]/80 border border-[#065f46] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      <option value="all">كل الحلقات المصدر</option>
                      {halaqahs.map(h => (
                        <option key={h.id} value={h.id}>
                          {h.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={toggleSelectAllFiltered}
                      className="px-3 py-2 bg-[#064e3b] hover:bg-[#064e3b]/80 rounded-xl text-xs text-amber-300 font-semibold border border-[#065f46] whitespace-nowrap cursor-pointer"
                    >
                      {selectedStudentIds.length === filteredTransferStudents.length && filteredTransferStudents.length > 0
                        ? 'إلغاء التحديد'
                        : 'تحديد الكل'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Students Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[45vh] overflow-y-auto pr-1">
                {filteredTransferStudents.map(st => {
                  const isSelected = selectedStudentIds.includes(st.id);
                  const currentHalaqah = halaqahs.find(h => h.id === st.halaqahId);

                  return (
                    <div
                      key={st.id}
                      onClick={() => toggleSelectStudent(st.id)}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition ${
                        isSelected
                          ? 'bg-amber-400/20 border-amber-400 text-white'
                          : 'bg-[#022c22]/60 border-[#065f46] hover:border-amber-400/30'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="text-amber-300">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-amber-400" />
                          ) : (
                            <Square className="w-4 h-4 text-[#86efac]/50" />
                          )}
                        </div>
                        <div className="truncate">
                          <div className="font-bold text-xs truncate">{st.name}</div>
                          <div className="text-[11px] text-[#86efac]/70 truncate">
                            الحلقة الحالية: {currentHalaqah?.name || 'غير محدد'}
                          </div>
                        </div>
                      </div>
                    </div>
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
                className="border rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm"
                style={{
                  backgroundColor: `${themeColors.cardColor || '#064e3b'}80`,
                  borderColor: themeColors.secondaryColor || '#065f46'
                }}
              >
                <h3
                  className="font-bold text-base flex items-center gap-2 pb-2 border-b"
                  style={{
                    color: themeColors.accentColor || '#fbbf24',
                    borderColor: `${themeColors.secondaryColor || '#065f46'}80`
                  }}
                >
                  <Sliders className="w-4 h-4" />
                  <span>بيانات وهوية المنظومة والحلقة</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: themeColors.textColor || '#86efac' }}>
                      اسم المجمع القرآني
                    </label>
                    <input
                      type="text"
                      value={generalForm.complexName}
                      onChange={e => setGeneralForm({ ...generalForm, complexName: e.target.value })}
                      placeholder="مثال: مجمع النور القرآني"
                      className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                      style={{
                        backgroundColor: `${themeColors.primaryColor || '#022c22'}CC`,
                        border: `1px solid ${themeColors.secondaryColor || '#065f46'}`
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: themeColors.textColor || '#86efac' }}>
                      اسم الحلقة الافتراضية
                    </label>
                    <input
                      type="text"
                      value={generalForm.halaqahName}
                      onChange={e => setGeneralForm({ ...generalForm, halaqahName: e.target.value })}
                      placeholder="مثال: حلقة الإمام الشاطبي"
                      className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                      style={{
                        backgroundColor: `${themeColors.primaryColor || '#022c22'}CC`,
                        border: `1px solid ${themeColors.secondaryColor || '#065f46'}`
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: themeColors.textColor || '#86efac' }}>
                      أيام العمل الأسبوعية
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={7}
                      value={generalForm.workDaysPerWeek}
                      onChange={e => setGeneralForm({ ...generalForm, workDaysPerWeek: Number(e.target.value) })}
                      className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                      style={{
                        backgroundColor: `${themeColors.primaryColor || '#022c22'}CC`,
                        border: `1px solid ${themeColors.secondaryColor || '#065f46'}`
                      }}
                    />
                  </div>

                  {/* ONLY DEVELOPER CAN TOGGLE PUBLIC STUDENT REGISTRATION */}
                  {isDeveloper && (
                    <div className="flex items-center gap-3 pt-4 sm:pt-6">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={generalForm.allowStudentRegistration}
                          onChange={e => setGeneralForm({ ...generalForm, allowStudentRegistration: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-black/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-400"></div>
                        <span className="mr-3 text-xs font-bold" style={{ color: themeColors.textColor || '#86efac' }}>
                          إتاحة تسجيل الطلاب الجدد من البوابة العامة (صلاحية المبرمج)
                        </span>
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {/* Attendance & Absence Points Configuration (نقاط الحضور والغياب) */}
              <div
                className="border rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm"
                style={{
                  backgroundColor: `${themeColors.cardColor || '#064e3b'}80`,
                  borderColor: themeColors.secondaryColor || '#065f46'
                }}
              >
                <div
                  className="flex items-center justify-between pb-2 border-b flex-wrap gap-2"
                  style={{ borderColor: `${themeColors.secondaryColor || '#065f46'}80` }}
                >
                  <h3
                    className="font-bold text-base flex items-center gap-2"
                    style={{ color: themeColors.accentColor || '#fbbf24' }}
                  >
                    <Award className="w-4 h-4" />
                    <span>قواعد واحتساب نقاط الحضور والغياب للطلاب</span>
                  </h3>
                  <span className="text-[11px] opacity-80" style={{ color: themeColors.textColor || '#86efac' }}>
                    تُحسب هذه النقاط تلقائياً في رصيد الطالب التراكمي وتظهر في لوحة الشرف
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={generalForm.enableAttendancePoints}
                      onChange={e => setGeneralForm({ ...generalForm, enableAttendancePoints: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-black/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-400"></div>
                    <span className="mr-3 text-xs font-bold" style={{ color: themeColors.textColor || '#86efac' }}>
                      تفعيل احتساب نقاط الحضور والغياب في رصيد الطالب
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: themeColors.textColor || '#86efac' }}>
                      نقاط الحضور اليومي:
                    </label>
                    <input
                      type="number"
                      value={generalForm.presentPoints}
                      onChange={e => setGeneralForm({ ...generalForm, presentPoints: Number(e.target.value) })}
                      className="w-full rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                      style={{
                        backgroundColor: `${themeColors.primaryColor || '#022c22'}CC`,
                        border: `1px solid ${themeColors.secondaryColor || '#065f46'}`
                      }}
                    />
                    <span className="text-[10px] text-emerald-300/70 block mt-0.5">عادة +1 نقطة لكل يوم حضور</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: themeColors.textColor || '#86efac' }}>
                      نقاط التأخر:
                    </label>
                    <input
                      type="number"
                      value={generalForm.latePoints}
                      onChange={e => setGeneralForm({ ...generalForm, latePoints: Number(e.target.value) })}
                      className="w-full rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                      style={{
                        backgroundColor: `${themeColors.primaryColor || '#022c22'}CC`,
                        border: `1px solid ${themeColors.secondaryColor || '#065f46'}`
                      }}
                    />
                    <span className="text-[10px] text-amber-300/70 block mt-0.5">0 أو -1 عند التأخر</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: themeColors.textColor || '#86efac' }}>
                      نقاط الاستئذان بعذر:
                    </label>
                    <input
                      type="number"
                      value={generalForm.excusedPoints}
                      onChange={e => setGeneralForm({ ...generalForm, excusedPoints: Number(e.target.value) })}
                      className="w-full rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                      style={{
                        backgroundColor: `${themeColors.primaryColor || '#022c22'}CC`,
                        border: `1px solid ${themeColors.secondaryColor || '#065f46'}`
                      }}
                    />
                    <span className="text-[10px] text-blue-300/70 block mt-0.5">عادة 0 نقاط (لا خصم بعذر)</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: themeColors.textColor || '#86efac' }}>
                      خصم الغياب بدون عذر:
                    </label>
                    <input
                      type="number"
                      value={generalForm.absentPointsDeduction}
                      onChange={e => setGeneralForm({ ...generalForm, absentPointsDeduction: Number(e.target.value) })}
                      className="w-full rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
                      style={{
                        backgroundColor: `${themeColors.primaryColor || '#022c22'}CC`,
                        border: `1px solid ${themeColors.secondaryColor || '#065f46'}`
                      }}
                    />
                    <span className="text-[10px] text-rose-300/70 block mt-0.5">يُخصم من رصيد الطالب (مثلاً 1)</span>
                  </div>
                </div>
              </div>

              {/* Dual-Deployment & External API Server Configuration */}
              <div
                className="border rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm"
                style={{
                  backgroundColor: `${themeColors.cardColor || '#064e3b'}80`,
                  borderColor: themeColors.secondaryColor || '#065f46'
                }}
              >
                <div
                  className="flex items-center justify-between pb-2 border-b flex-wrap gap-2"
                  style={{ borderColor: `${themeColors.secondaryColor || '#065f46'}80` }}
                >
                  <h3
                    className="font-bold text-base flex items-center gap-2"
                    style={{ color: themeColors.accentColor || '#fbbf24' }}
                  >
                    <Globe className="w-4 h-4" />
                    <span>معمارية النشر وربط الخادم (GitHub Pages & API Server)</span>
                  </h3>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-600/50">
                    {ApiConfig.isGitHubPages() ? 'نشر ثابت على GitHub Pages' : 'خادم متكامل محلي/سحابي'}
                  </span>
                </div>
                <p className="text-xs" style={{ color: themeColors.textColor || '#86efac' }}>
                  تدعم منظومة عُمْرَان الوضع الثنائي: واجهة ثابتة جاهزة للنشر على GitHub Pages مع ربط خادم API مستقل لمعالجة الذكاء الاصطناعي والتكاملات الخارجية.
                </p>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: themeColors.textColor || '#86efac' }}>
                    رابط خادم الواجهة البرمجية (API Base URL):
                  </label>
                  <input
                    type="url"
                    placeholder="https://api.omran.example.com أو اتركه فارغاً لاستخدام الخادم الافتراضي"
                    value={customApiUrl}
                    onChange={e => setCustomApiUrl(e.target.value)}
                    className="w-full rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none font-mono"
                    style={{
                      backgroundColor: `${themeColors.primaryColor || '#022c22'}CC`,
                      border: `1px solid ${themeColors.secondaryColor || '#065f46'}`
                    }}
                  />
                  <span className="text-[10px] text-emerald-300/70 block mt-1">
                    في حال تشغيل الواجهة على GitHub Pages، أدخل رابط خادم Express السحابي هنا. في وضع التطوير المحلي أو الاستضافة الكاملة، يُكتشف الخادم تلقائياً.
                  </span>
                </div>
              </div>

              {/* Dynamic Quran Complex Theme Customizer with LIVE PREVIEW */}
              <div
                className="border rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm"
                style={{
                  backgroundColor: `${themeColors.cardColor || '#064e3b'}80`,
                  borderColor: themeColors.secondaryColor || '#065f46'
                }}
              >
                <div
                  className="flex items-center justify-between pb-2 border-b flex-wrap gap-2"
                  style={{ borderColor: `${themeColors.secondaryColor || '#065f46'}80` }}
                >
                  <div>
                    <h3
                      className="font-bold text-base flex items-center gap-2"
                      style={{ color: themeColors.accentColor || '#fbbf24' }}
                    >
                      <Palette className="w-4 h-4" />
                      <span>تخصيص ثيم وألوان المجمع القرآني (معاينة حية فورية)</span>
                    </h3>
                    <p className="text-[11px] opacity-80" style={{ color: themeColors.textColor || '#86efac' }}>
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
                      className="px-3.5 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-all border disabled:opacity-50"
                      style={{
                        backgroundColor: themeColors.accentColor || '#fbbf24',
                        color: themeColors.primaryColor || '#022c22',
                        borderColor: `${themeColors.primaryColor || '#022c22'}40`
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
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: themeColors.accentColor || '#ffc800' }}>
                      اختر ثيم وهوية المجمع القرآني (تطبيق فوري لجميع الألوان والبطاقات والأزرار):
                    </span>
                    <span
                      className="text-[10px] px-2.5 py-0.5 rounded-full font-black border"
                      style={{
                        borderColor: `${themeColors.accentColor || '#ffc800'}50`,
                        color: themeColors.accentColor || '#ffc800',
                        backgroundColor: `${themeColors.accentColor || '#ffc800'}15`
                      }}
                    >
                      10 باقات متناسقة
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                    {ISLAMIC_THEME_PRESETS.map(preset => {
                      const isSelected =
                        (themeColors.backgroundColor || '').toLowerCase() === preset.colors.backgroundColor.toLowerCase() &&
                        (themeColors.accentColor || '').toLowerCase() === preset.colors.accentColor.toLowerCase();

                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleApplyThemePreset(preset.colors)}
                          className={`p-2.5 rounded-2xl border-2 text-right transition-all cursor-pointer flex flex-col justify-between gap-2 active:translate-y-0.5 ${
                            isSelected
                              ? 'border-b-4 shadow-lg ring-2 ring-white/50'
                              : 'hover:brightness-110 shadow-xs'
                          }`}
                          style={{
                            backgroundColor: preset.colors.cardColor || preset.colors.secondaryColor,
                            borderColor: isSelected ? (preset.colors.accentColor || '#ffc800') : 'rgba(255,255,255,0.18)',
                            borderBottomColor: preset.colors.accentColor || '#ffc800'
                          }}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0 shadow-inner" style={{ backgroundColor: preset.colors.backgroundColor }} />
                            <span className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0 shadow-inner" style={{ backgroundColor: preset.colors.cardColor || preset.colors.secondaryColor }} />
                            <span className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0 shadow-inner" style={{ backgroundColor: preset.colors.accentColor }} />
                          </div>
                          <span className="text-xs font-black text-white block truncate">{preset.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {extractedPalette.length > 0 && (
                  <div
                    className="p-3 rounded-xl border space-y-1.5"
                    style={{
                      backgroundColor: `${themeColors.primaryColor || '#022c22'}90`,
                      borderColor: themeColors.secondaryColor || '#065f46'
                    }}
                  >
                    <div className="flex items-center justify-between text-xs font-bold" style={{ color: themeColors.accentColor || '#fbbf24' }}>
                      <span className="flex items-center gap-1.5">
                        <Wand2 className="w-3.5 h-3.5" />
                        <span>الألوان المستخرجة من الصورة ({extractedPalette.length} درجات):</span>
                      </span>
                      <span className="text-[10px] opacity-75 font-normal" style={{ color: themeColors.textColor }}>
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
                          className="group relative w-7 h-7 rounded-lg border border-white/30 shadow transition-transform hover:scale-110 cursor-pointer flex items-center justify-center"
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
                  className="p-3.5 rounded-xl border space-y-2.5"
                  style={{
                    backgroundColor: `${themeColors.primaryColor || '#022c22'}70`,
                    borderColor: themeColors.secondaryColor || '#065f46'
                  }}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: themeColors.accentColor || '#fbbf24' }}>
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      <span>التبديل التفاعلي بين الألوان (اضغط على أي لونين للتبديل بينهما):</span>
                    </span>
                    {swapFirstRole && (
                      <span
                        className="text-[11px] px-2.5 py-0.5 rounded-full font-bold animate-pulse"
                        style={{
                          backgroundColor: `${themeColors.accentColor}30`,
                          color: themeColors.accentColor
                        }}
                      >
                        تم تحديد: {getRoleArabicName(swapFirstRole)} • اضغط على اللون الثاني لإتمام التبديل
                      </span>
                    )}
                  </div>

                  {/* 5 Color Roles Clickable Chips */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
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
                          className={`p-2 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between gap-1.5 ${
                            isFirst
                              ? 'ring-2 ring-amber-400 scale-105 shadow-lg font-black'
                              : 'hover:scale-[1.02] shadow-sm'
                          }`}
                          style={{
                            backgroundColor: `${themeColors.secondaryColor || '#064e3b'}90`,
                            borderColor: isFirst ? (themeColors.accentColor || '#fbbf24') : `${themeColors.secondaryColor || '#065f46'}`
                          }}
                          title="اضغط للتبديل مع لون آخر"
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] opacity-75 line-clamp-1" style={{ color: themeColors.textColor }}>
                              {item.label}
                            </span>
                            <span className="text-[11px] font-mono font-bold line-clamp-1" style={{ color: themeColors.textColor }}>
                              {val}
                            </span>
                          </div>
                          <span
                            className="w-6 h-6 rounded-lg border border-white/30 shrink-0 shadow"
                            style={{ backgroundColor: val }}
                          />
                        </button>
                      );
                    })}
                  </div>

                  {/* Quick Swap Shortcuts */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] opacity-70 ml-1" style={{ color: themeColors.textColor }}>تبديل سريع:</span>
                    <button
                      type="button"
                      onClick={() => handleQuickSwap('textColor', 'backgroundColor')}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer flex items-center gap-1 hover:brightness-110"
                      style={{
                        backgroundColor: `${themeColors.secondaryColor}60`,
                        borderColor: `${themeColors.accentColor}50`,
                        color: themeColors.textColor
                      }}
                    >
                      <ArrowLeftRight className="w-2.5 h-2.5" />
                      <span>النصوص ⇄ الخلفية</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickSwap('primaryColor', 'accentColor')}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer flex items-center gap-1 hover:brightness-110"
                      style={{
                        backgroundColor: `${themeColors.secondaryColor}60`,
                        borderColor: `${themeColors.accentColor}50`,
                        color: themeColors.textColor
                      }}
                    >
                      <ArrowLeftRight className="w-2.5 h-2.5" />
                      <span>الأساسي ⇄ التمييز</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickSwap('cardColor', 'backgroundColor')}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold border transition cursor-pointer flex items-center gap-1 hover:brightness-110"
                      style={{
                        backgroundColor: `${themeColors.secondaryColor}60`,
                        borderColor: `${themeColors.accentColor}50`,
                        color: themeColors.textColor
                      }}
                    >
                      <ArrowLeftRight className="w-2.5 h-2.5" />
                      <span>البطاقات ⇄ الخلفية</span>
                    </button>
                  </div>
                </div>

                {/* Interactive Live Preview Box */}
                <div
                  className="rounded-2xl p-4 border transition-all duration-300 space-y-3 shadow-md"
                  style={{
                    backgroundColor: themeColors.backgroundColor,
                    borderColor: themeColors.primaryColor,
                    color: themeColors.textColor
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shadow"
                        style={{
                          backgroundColor: themeColors.cardColor,
                          color: themeColors.accentColor
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-black font-heading">
                        معاينة مباشرة: بطاقات وأزرار {generalForm.complexName || 'المجمع'}
                      </span>
                    </div>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                      style={{
                        backgroundColor: `${themeColors.accentColor}25`,
                        color: themeColors.accentColor
                      }}
                    >
                      ثيم نشط
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div
                      className="p-3 rounded-xl border space-y-1 shadow-sm"
                      style={{
                        backgroundColor: themeColors.cardColor,
                        borderColor: themeColors.primaryColor
                      }}
                    >
                      <div className="text-xs font-bold" style={{ color: themeColors.textColor }}>
                        بطاقة الحلقة القرآنية
                      </div>
                      <div className="text-[11px] opacity-80" style={{ color: themeColors.textColor }}>
                        متابعة الحفظ والتسميع اليومي (14 طالب مسجل)
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="flex-1 py-2 px-3 rounded-xl font-black text-xs transition-all shadow-sm flex items-center justify-center gap-1.5"
                        style={{
                          backgroundColor: themeColors.accentColor,
                          color: themeColors.primaryColor
                        }}
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>زر رئيسي</span>
                      </button>
                      <div
                        className="p-2 rounded-xl border text-xs font-bold"
                        style={{
                          backgroundColor: themeColors.secondaryColor,
                          borderColor: themeColors.primaryColor,
                          color: themeColors.textColor
                        }}
                      >
                        زر ثانوي
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preset Themes List */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-emerald-200">
                    اختر من باقات الثيمات الإسلامية المعتمدة:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {ISLAMIC_THEME_PRESETS.map(preset => {
                      const isSelected =
                        themeColors.backgroundColor === preset.colors.backgroundColor &&
                        themeColors.accentColor === preset.colors.accentColor;

                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleApplyThemePreset(preset.colors)}
                          className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                            isSelected
                              ? 'border-amber-400 ring-2 ring-amber-400/50 shadow-md scale-[1.02]'
                              : 'border-[#065f46] hover:border-amber-400/50 bg-[#064e3b]/50'
                          }`}
                          style={{
                            backgroundColor: preset.colors.backgroundColor
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className="text-[11px] font-black line-clamp-1"
                              style={{ color: preset.colors.textColor }}
                            >
                              {preset.name.split(' ')[0]}
                            </span>
                            {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />}
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-white/20"
                              style={{ backgroundColor: preset.colors.cardColor }}
                            />
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-white/20"
                              style={{ backgroundColor: preset.colors.secondaryColor }}
                            />
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-white/20"
                              style={{ backgroundColor: preset.colors.accentColor }}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Hex Pickers */}
                <div className="pt-2 border-t border-[#065f46]">
                  <label className="block text-xs font-bold text-emerald-200 mb-2">
                    أو حدد الألوان المخصصة يدوياً:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <span className="block text-[11px] text-[#86efac]/90 mb-1">اللون الأساسي:</span>
                      <div className="flex items-center gap-2 bg-[#064e3b] p-1.5 rounded-xl border border-[#065f46]">
                        <input
                          type="color"
                          value={themeColors.primaryColor}
                          onChange={e => setThemeColors({ ...themeColors, primaryColor: e.target.value })}
                          className="w-6 h-6 rounded cursor-pointer border-none bg-transparent"
                        />
                        <span className="text-xs font-mono font-bold text-white">{themeColors.primaryColor}</span>
                      </div>
                    </div>

                    <div>
                      <span className="block text-[11px] text-[#86efac]/90 mb-1">اللون الثانوي/البطاقات:</span>
                      <div className="flex items-center gap-2 bg-[#064e3b] p-1.5 rounded-xl border border-[#065f46]">
                        <input
                          type="color"
                          value={themeColors.secondaryColor}
                          onChange={e => setThemeColors({ ...themeColors, secondaryColor: e.target.value, cardColor: e.target.value })}
                          className="w-6 h-6 rounded cursor-pointer border-none bg-transparent"
                        />
                        <span className="text-xs font-mono font-bold text-white">{themeColors.secondaryColor}</span>
                      </div>
                    </div>

                    <div>
                      <span className="block text-[11px] text-[#86efac]/90 mb-1">لون التمييز والذهب:</span>
                      <div className="flex items-center gap-2 bg-[#064e3b] p-1.5 rounded-xl border border-[#065f46]">
                        <input
                          type="color"
                          value={themeColors.accentColor}
                          onChange={e => setThemeColors({ ...themeColors, accentColor: e.target.value })}
                          className="w-6 h-6 rounded cursor-pointer border-none bg-transparent"
                        />
                        <span className="text-xs font-mono font-bold text-white">{themeColors.accentColor}</span>
                      </div>
                    </div>

                    <div>
                      <span className="block text-[11px] text-[#86efac]/90 mb-1">لون الخلفية:</span>
                      <div className="flex items-center gap-2 bg-[#064e3b] p-1.5 rounded-xl border border-[#065f46]">
                        <input
                          type="color"
                          value={themeColors.backgroundColor}
                          onChange={e => setThemeColors({ ...themeColors, backgroundColor: e.target.value })}
                          className="w-6 h-6 rounded cursor-pointer border-none bg-transparent"
                        />
                        <span className="text-xs font-mono font-bold text-white">{themeColors.backgroundColor}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl font-black text-sm transition cursor-pointer flex items-center gap-2 shadow-lg disabled:opacity-50"
                  style={{
                    backgroundColor: themeColors.accentColor || '#fbbf24',
                    color: themeColors.primaryColor || '#022c22'
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
            <div className="space-y-6 animate-fade-in p-1">
              {/* Header Banner */}
              <div
                className="p-4 sm:p-5 rounded-2xl border-2 space-y-2 relative overflow-hidden"
                style={{
                  backgroundColor: `${themeColors.primaryColor}80`,
                  borderColor: themeColors.accentColor || '#fbbf24'
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-black shrink-0 border"
                    style={{
                      backgroundColor: `${themeColors.accentColor}25`,
                      borderColor: themeColors.accentColor,
                      color: themeColors.accentColor || '#fbbf24'
                    }}
                  >
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>خدمة إرسال البريد الإلكتروني الحقيقي (Gmail)</span>
                      {mailConfigStatus?.isConfigured ? (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                          مفعلة ومتصلة ✓
                        </span>
                      ) : (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                          بانتظار الإعداد
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed mt-0.5">
                      إرسال رسائل بريد إلكتروني حقيقية مباشرة إلى البريد الشخصي للطلاب وأولياء الأمور (رموز التحقق OTP، إشعارات استلام الطلب، وبشرى القبول والاعتماد).
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Indicator */}
              <div
                className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                  mailConfigStatus?.isConfigured
                    ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                    : 'bg-amber-950/60 border-amber-500/50 text-amber-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      mailConfigStatus?.isConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`}
                  />
                  <span>
                    {mailConfigStatus?.isConfigured
                      ? `خدمة البريد نشطة وجاهزة للإرسال الفعلي عبر الحساب: (${mailConfigStatus.user})`
                      : 'خدمة البريد غير مربوطة حالياً. أدخل بيانات حساب Gmail بالأسفل لتفعيل الإرسال الحقيقي فوراً.'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={fetchMailConfig}
                  className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold transition cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <RefreshCw className="w-3 h-3" />
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
                className="p-5 rounded-2xl border space-y-4"
                style={{
                  backgroundColor: `${themeColors.secondaryColor}40`,
                  borderColor: themeColors.secondaryColor || '#065f46'
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Key className="w-4 h-4 text-amber-400" />
                    <span>بيانات حساب Gmail والمفتاح المحفوظة في قاعدة البيانات</span>
                  </h4>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                    <Database className="w-3.5 h-3.5" />
                    <span>يُحفظ للأبد لبوابة المجمع • قابل للتعديل بأي وقت</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#86efac] mb-1">
                      بريد Gmail الشخصي أو الرسمي <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="مثال: ikmhhg68@gmail.com"
                      value={gmailUser}
                      onChange={e => setGmailUser(e.target.value)}
                      className="w-full bg-[#064e3b]/80 border border-[#065f46] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#86efac] mb-1">
                      مفتاح مرور التطبيقات (Google App Password - 16 حرفاً) <span className="text-red-400">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={showMailPass ? 'text' : 'password'}
                        required
                        placeholder="16 حرفاً من Google (مثال: abcd efgh ijkl mnop)"
                        value={gmailAppPass}
                        onChange={e => setGmailAppPass(e.target.value)}
                        className="w-full bg-[#064e3b]/80 border border-[#065f46] rounded-xl pl-20 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 font-mono"
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
                            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-amber-300 transition cursor-pointer"
                            title="نسخ المفتاح المحفوظ"
                          >
                            {copiedMailPass ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setShowMailPass(prev => !prev)}
                          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 transition cursor-pointer"
                          title={showMailPass ? 'إخفاء المفتاح' : 'إظهار المفتاح المحفوظ للتعديل أو المراجعة'}
                        >
                          {showMailPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#86efac] mb-1">
                      اسم المرسل الذي يظهر في عنوان البريد
                    </label>
                    <input
                      type="text"
                      value={mailFromName}
                      onChange={e => setMailFromName(e.target.value)}
                      placeholder="مثال: مجمع عُمران القرآني"
                      className="w-full bg-[#064e3b]/80 border border-[#065f46] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#86efac] mb-1">
                      عنوان بريد الرد (Reply-To)
                    </label>
                    <input
                      type="email"
                      value={mailFromEmail}
                      onChange={e => setMailFromEmail(e.target.value)}
                      placeholder="اتركه فارغاً لاستخدام بريد Gmail نفسه"
                      className="w-full bg-[#064e3b]/80 border border-[#065f46] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400"
                      dir="ltr"
                    />
                  </div>
                </div>

                {/* Google App Password Guide */}
                <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 text-xs text-slate-300 space-y-1.5 leading-relaxed">
                  <div className="flex items-center gap-1.5 font-bold text-amber-300">
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
                        className="text-amber-400 underline font-mono inline-flex items-center gap-0.5"
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
                    className="px-6 py-2.5 rounded-xl font-black text-sm transition cursor-pointer flex items-center gap-2 shadow-lg disabled:opacity-50"
                    style={{
                      backgroundColor: themeColors.accentColor || '#fbbf24',
                      color: themeColors.primaryColor || '#022c22'
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
                className="p-5 rounded-2xl border space-y-4"
                style={{
                  backgroundColor: `${themeColors.secondaryColor}30`,
                  borderColor: themeColors.secondaryColor || '#065f46'
                }}
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Send className="w-4 h-4 text-emerald-400" />
                    <span>تجربة إرسال بريد حقيقي فوري للتأكد</span>
                  </h4>
                  <span className="text-[11px] text-slate-400">إرسال فوري إلى صندوق الوارد</span>
                </div>

                <p className="text-xs text-slate-300">
                  أدخل بريدك الإلكتروني الشخصي واضغط إرسال، وسيقوم النظام فوراً بإرسال رسالة تجريبية حقيقية لصندوق واردك لتتأكد بنفسك من عمل الخدمة.
                </p>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="email"
                    value={testEmailTo}
                    onChange={e => setTestEmailTo(e.target.value)}
                    placeholder="أدخل بريدك الشخصي (مثال: ikmhhg68@gmail.com)"
                    className="flex-1 bg-[#064e3b]/80 border border-[#065f46] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-400 font-mono"
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
                    className="px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-2 shrink-0 shadow disabled:opacity-50"
                    style={{
                      backgroundColor: themeColors.accentColor || '#fbbf24',
                      color: themeColors.primaryColor || '#022c22'
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
                    className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
                      mailTestResult.success
                        ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
                        : 'bg-red-950/80 border-red-500 text-red-200'
                    }`}
                  >
                    {mailTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
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
