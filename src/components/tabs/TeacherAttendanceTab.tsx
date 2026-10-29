import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  UserCheck,
  Clock,
  MapPin,
  Calendar,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Edit2,
  Navigation,
  RefreshCw,
  Search,
  Sparkles,
  Info,
  Check,
  X,
  Building2,
  Users,
  Compass,
  AlertCircle,
  UserPlus,
  Eye,
  Globe,
  Laptop,
  FolderArchive,
  ChevronLeft,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { MosqueLocationMapModal } from '../MosqueLocationMapModal';
import {
  TeacherAccount,
  TeacherShift,
  MosqueItem,
  TeacherAttendanceRecord,
  TeacherAttendanceStatus,
  calculateHaversineDistanceMeters,
  QuranComplex,
  Halaqah,
  LibraryDocument
} from '../../types';
import { OmranDataService } from '../../lib/firebase';
import { triggerComplexThemePulse } from '../../utils/highlightHelper';
import { darkenHex, lightenHex, getContrastTextColor } from '../../lib/themeUtils';

/**
 * Checks whether a shift/halaqah is remote (online)
 */
export const isShiftRemote = (shift?: TeacherShift | null): boolean => {
  if (!shift) return false;
  if (shift.isOnline === true || shift.locationType === 'remote') return true;
  const name = (shift.name || '').toLowerCase();
  return (
    name.includes('عن بعد') ||
    name.includes('أونلاين') ||
    name.includes('اونلاين') ||
    name.includes('online') ||
    name.includes('remote') ||
    name.includes('افتراضي') ||
    name.includes('زوم') ||
    name.includes('ميت')
  );
};

interface TeacherAttendanceTabProps {
  teachers: TeacherAccount[];
  currentTeacher?: TeacherAccount;
  currentUserName?: string;
  isSupervisor?: boolean;
  isDeveloper?: boolean;
  activeComplex?: QuranComplex | null;
  initialHighlightId?: string;
  halaqahs?: Halaqah[];
  onSaveLibraryDoc?: (
    doc: LibraryDocument,
    options?: {
      blob?: Blob;
      htmlContent?: string;
      mimeType?: string;
      fileExtension?: string;
    }
  ) => Promise<void>;
}

export const TeacherAttendanceTab: React.FC<TeacherAttendanceTabProps> = ({
  teachers = [],
  currentTeacher,
  currentUserName,
  isSupervisor = false,
  isDeveloper = false,
  activeComplex,
  initialHighlightId,
  halaqahs = [],
  onSaveLibraryDoc
}) => {
  const isSupervisorOrDev = isSupervisor || isDeveloper;
  const todayStr = new Date().toISOString().split('T')[0];
  const [isSavingToLibrary, setIsSavingToLibrary] = useState(false);

  const themePrimary = activeComplex?.theme?.primaryColor || '#131f24';
  const themeSecondary = activeComplex?.theme?.secondaryColor || '#1b2e35';
  const themeCard = activeComplex?.theme?.cardColor || activeComplex?.theme?.surfaceColor || '#203843';
  const themeBg = activeComplex?.theme?.backgroundColor || '#131f24';
  const themeAccent = activeComplex?.theme?.accentColor || '#ffc800';
  const themeAccentShadow = darkenHex(themeAccent, 0.28);
  const themeCardShadow = darkenHex(themeCard, 0.35);
  const themeBorder = lightenHex(themeCard, 0.18);
  const themeBorderBottom = darkenHex(themeCard, 0.35);
  const themeText = activeComplex?.theme?.textColor || '#ffffff';
  const themeSubtext = activeComplex?.theme?.subtextColor || lightenHex(themeAccent, 0.25);
  const themeContrastText = getContrastTextColor(themeAccent);

  useEffect(() => {
    if (initialHighlightId) {
      setTimeout(() => {
        triggerComplexThemePulse(initialHighlightId);
      }, 350);
    }
  }, [initialHighlightId]);

  // Selected date for supervisor attendance records (default: today)
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);
  const datePickerContainerRef = useRef<HTMLDivElement | null>(null);

  const parseIsoDateLocal = (isoStr: string): Date => {
    const parts = (isoStr || '').split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  };

  const formatLocalIsoDate = (dateObj: Date): string => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const [pickerMonthDate, setPickerMonthDate] = useState<Date>(() => {
    const initial = parseIsoDateLocal(todayStr);
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });

  useEffect(() => {
    const parsed = parseIsoDateLocal(selectedDate);
    setPickerMonthDate(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
  }, [selectedDate]);

  useEffect(() => {
    if (!isDatePickerOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (
        datePickerContainerRef.current &&
        !datePickerContainerRef.current.contains(e.target as Node)
      ) {
        setIsDatePickerOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDatePickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDatePickerOpen]);

  const ARABIC_WEEKDAYS_FULL = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const ARABIC_WEEKDAYS_SHORT = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
  const ARABIC_GREGORIAN_MONTHS = [
    'يناير',
    'فبراير',
    'مارس',
    'أبريل',
    'مايو',
    'يونيو',
    'يوليو',
    'أغسطس',
    'سبتمبر',
    'أكتوبر',
    'نوفمبر',
    'ديسمبر'
  ];

  const selectedDateDisplay = useMemo(() => {
    const d = parseIsoDateLocal(selectedDate);
    const weekday = ARABIC_WEEKDAYS_FULL[d.getDay()] || '';
    const monthName = ARABIC_GREGORIAN_MONTHS[d.getMonth()] || '';
    let hijriStr = '';
    try {
      hijriStr = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(d);
    } catch {
      hijriStr = '';
    }
    return {
      weekday,
      dayNum: d.getDate(),
      monthName,
      yearNum: d.getFullYear(),
      shortLabel: `${weekday} • ${d.getDate()} ${monthName} ${d.getFullYear()}`,
      hijriStr
    };
  }, [selectedDate]);

  const pickerMonthHeader = useMemo(() => {
    const monthName = ARABIC_GREGORIAN_MONTHS[pickerMonthDate.getMonth()] || '';
    const yearNum = pickerMonthDate.getFullYear();
    let hijriMonthYear = '';
    try {
      hijriMonthYear = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
        month: 'long',
        year: 'numeric'
      }).format(new Date(yearNum, pickerMonthDate.getMonth(), 15));
    } catch {
      hijriMonthYear = '';
    }
    return { monthName, yearNum, hijriMonthYear };
  }, [pickerMonthDate]);

  const pickerCalendarCells = useMemo(() => {
    const year = pickerMonthDate.getFullYear();
    const month = pickerMonthDate.getMonth();
    const firstDayWeekday = new Date(year, month, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: Array<{
      iso: string;
      day: number;
      inCurrentMonth: boolean;
    }> = [];

    // Leading days from previous month
    for (let i = firstDayWeekday - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const dObj = new Date(year, month - 1, dayNum);
      cells.push({
        iso: formatLocalIsoDate(dObj),
        day: dayNum,
        inCurrentMonth: false
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dObj = new Date(year, month, d);
      cells.push({
        iso: formatLocalIsoDate(dObj),
        day: d,
        inCurrentMonth: true
      });
    }

    // Trailing days from next month to complete full rows of 7
    const totalTarget = cells.length <= 35 ? 35 : 42;
    let nextDay = 1;
    while (cells.length < totalTarget) {
      const dObj = new Date(year, month + 1, nextDay++);
      cells.push({
        iso: formatLocalIsoDate(dObj),
        day: dObj.getDate(),
        inCurrentMonth: false
      });
    }

    return cells;
  }, [pickerMonthDate]);

  const handleStepSelectedDate = (deltaDays: number) => {
    const current = parseIsoDateLocal(selectedDate);
    current.setDate(current.getDate() + deltaDays);
    setSelectedDate(formatLocalIsoDate(current));
  };

  const yesterdayStr = useMemo(() => {
    const d = parseIsoDateLocal(todayStr);
    d.setDate(d.getDate() - 1);
    return formatLocalIsoDate(d);
  }, [todayStr]);

  // Active view mode: 'records' | 'shifts' | 'mosques' | 'self'
  const [activeSubTab, setActiveSubTab] = useState<'records' | 'shifts' | 'mosques' | 'self'>(
    isSupervisorOrDev ? 'records' : 'self'
  );
  const isSupervisorSelfMode = activeSubTab === 'self';

  // Quick Toast Notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // 1. Mosques List State (قائمة الجوامع والمساجد المضافة)
  const [mosques, setMosques] = useState<MosqueItem[]>([]);
  const [isLoadingMosques, setIsLoadingMosques] = useState(true);
  const [isMosqueModalOpen, setIsMosqueModalOpen] = useState(false);
  const [editingMosqueId, setEditingMosqueId] = useState<string | null>(null);
  const [mosqueNameInput, setMosqueNameInput] = useState('');
  const [mosqueNeighborhoodInput, setMosqueNeighborhoodInput] = useState('');
  const [mosqueRadiusInput, setMosqueRadiusInput] = useState<string>('100');
  const [capturedMosqueLocation, setCapturedMosqueLocation] = useState<{ lat?: number; lng?: number } | null>(null);
  const [isCapturingGPS, setIsCapturingGPS] = useState(false);
  const [gpsCaptureMsg, setGpsCaptureMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Google Maps Interactive Modal State (اطلاع / تحديد وتعديل)
  const [mapModalMosque, setMapModalMosque] = useState<MosqueItem | null>(null);
  const [mapModalMode, setMapModalMode] = useState<'view' | 'picker'>('view');
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);

  const handleOpenMosqueMap = (mosque: MosqueItem, mode: 'view' | 'picker' = 'view') => {
    setMapModalMosque(mosque);
    setMapModalMode(mode);
    setIsMapModalOpen(true);
  };

  const handleSaveMosqueLocationFromMap = async (mosqueId: string, lat: number, lng: number, radiusMeters?: number) => {
    const target = mosques.find(m => m.id === mosqueId);
    if (!target) return;
    const finalRadius = radiusMeters ?? target.allowedRadiusMeters ?? 100;
    const updated: MosqueItem = {
      ...target,
      latitude: lat,
      longitude: lng,
      allowedRadiusMeters: finalRadius,
      isLocationSet: true
    };
    setMosques(prev => prev.map(m => (m.id === mosqueId ? updated : m)));
    setCapturedMosqueLocation({ lat, lng });
    setMosqueRadiusInput(String(finalRadius));
    try {
      await OmranDataService.saveMosque(updated);
    } catch (e) {
      console.warn('Error saving mosque location:', e);
    }
    showToast(`تم تثبيت موقع (${updated.name}) بنطاق ${finalRadius} متر على الخريطة بنجاح!`);
  };

  // 2. Shifts State (فترات ومناوبات الدوام)
  const [shifts, setShifts] = useState<TeacherShift[]>([]);
  const [isLoadingShifts, setIsLoadingShifts] = useState(true);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [isAddingNewMosqueInShift, setIsAddingNewMosqueInShift] = useState(false);
  const [newMosqueNameInShift, setNewMosqueNameInShift] = useState('');
  const [isMosqueSelectOpen, setIsMosqueSelectOpen] = useState(false);
  const [activeShiftTimeField, setActiveShiftTimeField] = useState<
    'checkInStart' | 'checkInEnd' | 'checkOutStart' | 'checkOutEnd' | null
  >(null);
  const [shiftModalTeacherSearch, setShiftModalTeacherSearch] = useState('');
  const [shiftForm, setShiftForm] = useState<{
    name: string;
    mosqueId: string;
    checkInStart: string;
    checkInEnd: string;
    checkOutStart: string;
    checkOutEnd: string;
    assignedTeacherIds: string[];
    isOnline: boolean;
  }>({
    name: 'الفترة العصرية',
    mosqueId: '',
    checkInStart: '15:30',
    checkInEnd: '16:00',
    checkOutStart: '17:30',
    checkOutEnd: '18:00',
    assignedTeacherIds: [],
    isOnline: false
  });

  // 3. Attendance Records State
  const [attendanceRecords, setAttendanceRecords] = useState<TeacherAttendanceRecord[]>([]);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(true);

  // Teacher check-in loading & error feedback
  const [isPerformingCheckIn, setIsPerformingCheckIn] = useState(false);
  const [isPerformingCheckOut, setIsPerformingCheckOut] = useState(false);
  const [checkInFeedback, setCheckInFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Supervisor Manual Action Modal
  const [actionTeacherModal, setActionTeacherModal] = useState<{
    teacher: TeacherAccount;
    shift: TeacherShift;
    actionType: 'check_in' | 'check_out' | 'excuse' | 'absent' | 'late';
  } | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [customTime, setCustomTime] = useState('');

  // Search in records
  const [searchTeacherQuery, setSearchTeacherQuery] = useState('');

  // Dedicated Quick-Assign Teachers Modal State
  const [assignTeachersModalShift, setAssignTeachersModalShift] = useState<TeacherShift | null>(null);
  const [assignTeachersSearch, setAssignTeachersSearch] = useState('');
  const [selectedAssignedTeacherIds, setSelectedAssignedTeacherIds] = useState<string[]>([]);

  // Helper for Arabic Time format (e.g. 03:45 م)
  const formatCurrentArabicTime = (dateObj: Date = new Date()) => {
    let hours = dateObj.getHours();
    const minutes = dateObj.getMinutes();
    const isPM = hours >= 12;
    hours = hours % 12 || 12;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)} ${isPM ? 'م' : 'ص'}`;
  };

  // Helper for parsing time string "HH:mm" to minutes from midnight
  const parseTimeToMinutes = (timeStr?: string): number => {
    if (!timeStr) return 0;
    const parts = timeStr.trim().split(':');
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    return h * 60 + m;
  };

  // Helpers for Custom Duolingo 3D Time Picker ("HH:mm" <-> 12-hour Arabic parts)
  const parse24hTimeParts = (hhmm?: string) => {
    const fallback = (hhmm || '15:30').trim();
    const parts = fallback.split(':');
    const rawH = Math.min(23, Math.max(0, parseInt(parts[0], 10) || 0));
    const rawM = Math.min(59, Math.max(0, parseInt(parts[1], 10) || 0));
    const isPM = rawH >= 12;
    const hour12 = rawH % 12 || 12;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return {
      hour24: rawH,
      hour12,
      minute: rawM,
      isPM,
      formatted: `${pad(hour12)}:${pad(rawM)} ${isPM ? 'م' : 'ص'}`
    };
  };

  const build24hTimeFromParts = (hour12: number, minute: number, isPM: boolean): string => {
    const cleanH12 = ((hour12 - 1) % 12) + 1;
    const cleanM = Math.min(59, Math.max(0, minute));
    let h24 = cleanH12 % 12;
    if (isPM) h24 += 12;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(h24)}:${pad(cleanM)}`;
  };

  // Initial Data Load
  useEffect(() => {
    let isMounted = true;

    async function loadAll() {
      setIsLoadingMosques(true);
      setIsLoadingShifts(true);
      setIsLoadingAttendance(true);
      try {
        const complexId = activeComplex?.id;
        const [loadedMosques, loadedShifts, loadedAtt] = await Promise.all([
          OmranDataService.loadMosques(complexId),
          OmranDataService.loadTeacherShifts(complexId),
          OmranDataService.loadTeacherAttendance(selectedDate, complexId)
        ]);

        if (!isMounted) return;

        // Initialize default mosque if none exist (100 meters default radius)
        let finalMosques = loadedMosques;
        if (loadedMosques.length === 0) {
          const defaultMosque: MosqueItem = {
            id: `mosque_${Date.now()}`,
            name: activeComplex?.name || 'جامع المجمع الرئيسي',
            neighborhood: 'مقر الحلقات',
            complexId: activeComplex?.id,
            latitude: 24.7136,
            longitude: 46.6753,
            allowedRadiusMeters: 100,
            isLocationSet: false,
            createdAt: new Date().toISOString()
          };
          await OmranDataService.saveMosque(defaultMosque);
          finalMosques = [defaultMosque];
        }
        setMosques(finalMosques);

        // Initialize default shift if none exist
        let finalShifts = loadedShifts;
        if (loadedShifts.length === 0) {
          const defaultShift: TeacherShift = {
            id: `shift_${Date.now()}`,
            name: 'الفترة العصرية الرسمية',
            complexId: activeComplex?.id,
            mosqueId: finalMosques[0]?.id || '',
            mosqueName: finalMosques[0]?.name || 'جامع المجمع الرئيسي',
            checkInStart: '15:30',
            checkInEnd: '16:00',
            checkOutStart: '17:30',
            checkOutEnd: '18:00',
            assignedTeacherIds: teachers.map(t => t.id),
            createdAt: new Date().toISOString()
          };
          await OmranDataService.saveTeacherShift(defaultShift);
          finalShifts = [defaultShift];
        }
        setShifts(finalShifts);

        setAttendanceRecords(loadedAtt);
      } catch (e) {
        // Fallback gracefully without console noise
      } finally {
        if (isMounted) {
          setIsLoadingMosques(false);
          setIsLoadingShifts(false);
          setIsLoadingAttendance(false);
        }
      }
    }

    loadAll();
    return () => {
      isMounted = false;
    };
  }, [selectedDate, activeComplex?.id, teachers.length]);

  // =========================================================================
  // 1. Mosques Management Handlers
  // =========================================================================
  const handleOpenAddMosqueModal = () => {
    setEditingMosqueId(null);
    setMosqueNameInput('');
    setMosqueNeighborhoodInput('');
    setMosqueRadiusInput('100');
    setCapturedMosqueLocation(null);
    setGpsCaptureMsg(null);
    setIsMosqueModalOpen(true);
  };

  const handleOpenEditMosqueModal = (mosque: MosqueItem) => {
    setEditingMosqueId(mosque.id);
    setMosqueNameInput(mosque.name);
    setMosqueNeighborhoodInput(mosque.neighborhood || '');
    setMosqueRadiusInput(String(mosque.allowedRadiusMeters || 100));
    setCapturedMosqueLocation(
      mosque.isLocationSet && mosque.latitude && mosque.longitude
        ? { lat: mosque.latitude, lng: mosque.longitude }
        : null
    );
    setGpsCaptureMsg(
      mosque.isLocationSet
        ? { type: 'success', text: 'الموقع الجغرافي لهذا الجامع محدد مسبقاً بنجاح' }
        : null
    );
    setIsMosqueModalOpen(true);
  };

  // Simple one-click GPS capture without exposing numbers/coordinates to the user
  const handleCaptureCurrentLocationForMosque = () => {
    setIsCapturingGPS(true);
    setGpsCaptureMsg(null);

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsCaptureMsg({
        type: 'error',
        text: 'متصفحك لا يدعم تحديد الموقع الجغرافي (GPS).'
      });
      setIsCapturingGPS(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => {
        setCapturedMosqueLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        });
        setGpsCaptureMsg({
          type: 'success',
          text: 'تم التقاط موقع الجامع الحالي بنجاح بنقرة واحدة!'
        });
        setIsCapturingGPS(false);
      },
      err => {
        setIsCapturingGPS(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsCaptureMsg({
            type: 'error',
            text: 'يرجى السماح بإذن الوصول إلى الموقع في المتصفح للالتقاط.'
          });
        } else {
          setGpsCaptureMsg({
            type: 'error',
            text: 'تعذر التقاط الموقع حالياً، يرجى التأكد من تشغيل الـ GPS.'
          });
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSaveMosque = async () => {
    const trimmed = mosqueNameInput.trim();
    if (!trimmed) {
      showToast('يرجى إدخال اسم الجامع أو المسجد', 'error');
      return;
    }

    const mosqueId = editingMosqueId || `mosque_${Date.now()}`;
    const existing = mosques.find(m => m.id === mosqueId);
    const complexId = activeComplex?.id || 'default_complex';

    const parsedRadius = parseInt(mosqueRadiusInput, 10);
    const finalRadius = !isNaN(parsedRadius) && parsedRadius > 0 ? parsedRadius : 100;

    const newMosque: MosqueItem = {
      id: mosqueId,
      name: trimmed,
      neighborhood: mosqueNeighborhoodInput.trim() || undefined,
      complexId,
      latitude: capturedMosqueLocation?.lat ?? existing?.latitude,
      longitude: capturedMosqueLocation?.lng ?? existing?.longitude,
      allowedRadiusMeters: finalRadius,
      isLocationSet: Boolean(capturedMosqueLocation?.lat || (existing?.isLocationSet && existing?.latitude)),
      createdAt: existing?.createdAt || new Date().toISOString()
    };

    setMosques(prev => [...prev.filter(m => m.id !== newMosque.id), newMosque]);
    setIsMosqueModalOpen(false);

    try {
      await OmranDataService.saveMosque(newMosque);
    } catch (e) {
      // quiet fallback
    }

    showToast(editingMosqueId ? 'تم تحديث بيانات الجامع بنجاح!' : 'تم حفظ الجامع الجديد بنجاح!');
  };

  const handleDeleteMosque = async (mosqueId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الجامع؟')) return;
    setMosques(prev => prev.filter(m => m.id !== mosqueId));
    try {
      await OmranDataService.deleteMosque(mosqueId);
    } catch (e) {
      // quiet fallback
    }
    showToast('تم حذف الجامع بنجاح');
  };

  // =========================================================================
  // 2. Shifts Management Handlers
  // =========================================================================
  const handleOpenAssignTeachersModal = (shift: TeacherShift) => {
    setAssignTeachersModalShift(shift);
    setSelectedAssignedTeacherIds(shift.assignedTeacherIds || []);
    setAssignTeachersSearch('');
  };

  const handleSaveAssignedTeachers = async () => {
    if (!assignTeachersModalShift) return;
    const shiftId = assignTeachersModalShift.id;
    const updatedShift: TeacherShift = {
      ...assignTeachersModalShift,
      assignedTeacherIds: selectedAssignedTeacherIds
    };

    setShifts(prev => prev.map(s => (s.id === shiftId ? updatedShift : s)));
    setAssignTeachersModalShift(null);

    try {
      await OmranDataService.saveTeacherShift(updatedShift);
      showToast('تم تعيين وتكليف المعلمين في فترة الدوام بنجاح!');
      try {
        confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
      } catch {
        // ignore
      }
    } catch (e) {
      showToast('تم حفظ التعيين بنجاح!');
    }
  };

  const handleOpenAddShiftModal = () => {
    setEditingShiftId(null);
    setIsAddingNewMosqueInShift(mosques.length === 0);
    setNewMosqueNameInShift('');
    setIsMosqueSelectOpen(false);
    setActiveShiftTimeField(null);
    setShiftModalTeacherSearch('');
    setShiftForm({
      name: 'الفترة العصرية الرسمية',
      mosqueId: mosques[0]?.id || '',
      checkInStart: '15:30',
      checkInEnd: '16:00',
      checkOutStart: '17:30',
      checkOutEnd: '18:00',
      assignedTeacherIds: teachers.map(t => t.id),
      isOnline: false
    });
    setIsShiftModalOpen(true);
  };

  const handleOpenEditShiftModal = (shift: TeacherShift) => {
    setEditingShiftId(shift.id);
    setIsAddingNewMosqueInShift(false);
    setNewMosqueNameInShift('');
    setIsMosqueSelectOpen(false);
    setActiveShiftTimeField(null);
    setShiftModalTeacherSearch('');
    setShiftForm({
      name: shift.name,
      mosqueId: shift.mosqueId || mosques[0]?.id || '',
      checkInStart: shift.checkInStart,
      checkInEnd: shift.checkInEnd,
      checkOutStart: shift.checkOutStart,
      checkOutEnd: shift.checkOutEnd,
      assignedTeacherIds: shift.assignedTeacherIds || [],
      isOnline: isShiftRemote(shift)
    });
    setIsShiftModalOpen(true);
  };

  const handleSaveShift = async () => {
    const shiftNameTrimmed = shiftForm.name.trim();
    if (!shiftNameTrimmed) {
      showToast('يرجى إدخال اسم فترة الدوام', 'error');
      return;
    }

    const shiftId = editingShiftId || `shift_${Date.now()}`;
    const complexId = activeComplex?.id || 'default_complex';
    const isOnlineShift = shiftForm.isOnline;

    let selectedMosqueId = shiftForm.mosqueId;
    let selectedMosqueName = '';

    if (isOnlineShift) {
      selectedMosqueId = '';
      selectedMosqueName = 'حلقة عن بعد (أونلاين)';
    } else {
      // If user typed a new mosque name inline inside the shift modal
      if (newMosqueNameInShift.trim()) {
        const newMName = newMosqueNameInShift.trim();
        const newMId = `mosque_${Date.now()}`;
        const createdMosque: MosqueItem = {
          id: newMId,
          name: newMName,
          complexId,
          neighborhood: 'مسجد الدوام',
          allowedRadiusMeters: 100,
          isLocationSet: false,
          createdAt: new Date().toISOString()
        };
        setMosques(prev => [...prev.filter(m => m.id !== newMId), createdMosque]);
        try {
          await OmranDataService.saveMosque(createdMosque);
        } catch (e) {
          // quiet fallback
        }
        selectedMosqueId = newMId;
        selectedMosqueName = newMName;
        setNewMosqueNameInShift('');
        setIsAddingNewMosqueInShift(false);
      } else {
        const matchM = mosques.find(m => m.id === selectedMosqueId) || mosques[0];
        selectedMosqueId = matchM?.id || '';
        selectedMosqueName = matchM?.name || activeComplex?.name || 'جامع الحلقات';
      }
    }

    const shift: TeacherShift = {
      id: shiftId,
      name: shiftNameTrimmed,
      complexId,
      mosqueId: selectedMosqueId,
      mosqueName: selectedMosqueName,
      checkInStart: shiftForm.checkInStart || '15:30',
      checkInEnd: shiftForm.checkInEnd || '16:00',
      checkOutStart: shiftForm.checkOutStart || '17:30',
      checkOutEnd: shiftForm.checkOutEnd || '18:00',
      assignedTeacherIds: shiftForm.assignedTeacherIds || [],
      isOnline: isOnlineShift,
      locationType: isOnlineShift ? 'remote' : 'in_person',
      createdAt: new Date().toISOString()
    };

    // Instant optimistic update with zero lag
    setShifts(prev => [...prev.filter(s => s.id !== shift.id), shift]);
    setIsShiftModalOpen(false);

    try {
      await OmranDataService.saveTeacherShift(shift);
    } catch (e) {
      // quiet fallback
    }

    try {
      confetti({ particleCount: 35, spread: 60, origin: { y: 0.8 } });
    } catch {
      // ignore
    }
    showToast(editingShiftId ? 'تم تحديث وتعيين فترة الدوام بنجاح!' : 'تم إنشاء وتعيين فترة الدوام بنجاح!');
  };

  const handleDeleteShift = async (shiftId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف فترة الدوام هذه؟')) return;
    setShifts(prev => prev.filter(s => s.id !== shiftId));
    try {
      await OmranDataService.deleteTeacherShift(shiftId);
    } catch (e) {
      // quiet fallback
    }
    showToast('تم حذف فترة الدوام بنجاح');
  };

  // =========================================================================
  // 3. Dynamic Status Calculation Helper (Absence after halaqah end, Late until end)
  // =========================================================================
  const getTeacherShiftDynamicStatus = (
    shift: TeacherShift,
    record?: TeacherAttendanceRecord,
    recordDate: string = selectedDate
  ) => {
    // If supervisor manually set excuse or absent or explicit record
    if (record?.status === 'معتذر') {
      return { status: 'معتذر', displayStatus: 'معتذر', isPendingCheckout: false, didNotCheckOut: false, isClosed: false, delayMinutes: 0 };
    }
    if (record?.status === 'غائب') {
      return { status: 'غائب', displayStatus: 'غائب', isPendingCheckout: false, didNotCheckOut: false, isClosed: true, delayMinutes: 0 };
    }

    const isToday = recordDate === todayStr;
    const isPastDate = recordDate < todayStr;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const checkInStartMin = parseTimeToMinutes(shift.checkInStart);
    const checkInEndMin = parseTimeToMinutes(shift.checkInEnd || shift.checkInStart);
    const checkOutStartMin = parseTimeToMinutes(shift.checkOutStart);
    const checkOutEndMin = parseTimeToMinutes(shift.checkOutEnd || shift.checkOutStart);

    // End of halaqah / shift:
    // Defined by checkOutEnd if set, otherwise checkOutStart, otherwise checkInEnd
    const shiftEndMin = checkOutEndMin > 0 ? checkOutEndMin : (checkOutStartMin > 0 ? checkOutStartMin : checkInEndMin);

    const hasCheckedIn = Boolean(record?.checkInTime);
    const hasCheckedOut = Boolean(record?.checkOutTime);

    // 1. If teacher checked in:
    if (hasCheckedIn) {
      const baseStatus = record?.status || 'حاضر';
      // Check if departure / halaqah time has ended without checkout
      const checkOutEnded = isPastDate || (isToday && shiftEndMin > 0 && currentMinutes > shiftEndMin);
      if (!hasCheckedOut && checkOutEnded) {
        return {
          status: baseStatus,
          displayStatus: `${baseStatus} (لم ينصرف)`,
          isPendingCheckout: true,
          didNotCheckOut: true,
          isClosed: false,
          delayMinutes: record?.delayMinutes || 0
        };
      }
      return {
        status: baseStatus,
        displayStatus: hasCheckedOut ? `${baseStatus} (تم الانصراف)` : baseStatus,
        isPendingCheckout: false,
        didNotCheckOut: false,
        isClosed: false,
        delayMinutes: record?.delayMinutes || 0
      };
    }

    // 2. If teacher has NOT checked in:
    // "اذا انتهى وقت الحلقة شفت خلاص ما يقدرش يحضر ويحسب غااائب"
    // If the halaqah time has ended (or past date):
    const halaqahEnded = isPastDate || (isToday && shiftEndMin > 0 && currentMinutes > shiftEndMin);
    if (halaqahEnded) {
      return {
        status: 'غائب',
        displayStatus: 'غائب',
        isPendingCheckout: false,
        didNotCheckOut: false,
        isClosed: true,
        delayMinutes: 0
      };
    }

    // If today and halaqah is still ongoing:
    if (isToday) {
      // Before check-in starts
      if (checkInStartMin > 0 && currentMinutes < checkInStartMin) {
        return {
          status: 'في انتظار التحضير',
          displayStatus: 'في انتظار التحضير',
          isPendingCheckout: false,
          didNotCheckOut: false,
          isClosed: false,
          delayMinutes: 0
        };
      }
      // "يحسبه متأخر الى نهاية الحلقة"
      // If after checkInEndMin and up to shiftEndMin:
      if (checkInEndMin > 0 && currentMinutes > checkInEndMin) {
        const delayMins = currentMinutes - checkInEndMin;
        return {
          status: 'متأخر',
          displayStatus: `متأخر (${delayMins} د)`,
          isPendingCheckout: false,
          didNotCheckOut: false,
          isClosed: false,
          delayMinutes: delayMins
        };
      }
      // On-time window
      return {
        status: 'في انتظار التحضير',
        displayStatus: 'وقت التحضير متاح',
        isPendingCheckout: false,
        didNotCheckOut: false,
        isClosed: false,
        delayMinutes: 0
      };
    }

    return { status: 'غائب', displayStatus: 'غائب', isPendingCheckout: false, didNotCheckOut: false, isClosed: true, delayMinutes: 0 };
  };

  // =========================================================================
  // 3. Teacher Self-Attendance Check-In / Check-Out
  // =========================================================================
  const handleTeacherCheckIn = async (targetShift: TeacherShift) => {
    const teacherId = currentTeacher?.id || (isSupervisorOrDev ? 'supervisor-self' : '');
    const teacherName = currentTeacher?.name || currentUserName || 'المعلم';
    if (!teacherId) return;

    setIsPerformingCheckIn(true);
    setCheckInFeedback(null);

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const checkInStartMin = parseTimeToMinutes(targetShift.checkInStart);
    const checkInEndMin = parseTimeToMinutes(targetShift.checkInEnd || targetShift.checkInStart);
    const checkOutStartMin = parseTimeToMinutes(targetShift.checkOutStart);
    const checkOutEndMin = parseTimeToMinutes(targetShift.checkOutEnd || targetShift.checkOutStart);
    const shiftEndMin = checkOutEndMin > 0 ? checkOutEndMin : (checkOutStartMin > 0 ? checkOutStartMin : checkInEndMin);

    // Rule 1: Cannot check in before start of check-in time
    if (checkInStartMin > 0 && currentMinutes < checkInStartMin) {
      setCheckInFeedback({
        type: 'error',
        text: `عذراً، لا يمكنك تسجيل الحضور قبل موعد بداية التحضير (${targetShift.checkInStart})! يبدأ التحضير في الوقت المحدد، يرجى الانتظار.`
      });
      setIsPerformingCheckIn(false);
      return;
    }

    // Rule 2: Cannot check in after halaqah has ended! "اذا انتهى وقت الحلقة خلاص ما يقدرش يحضر ويحسب غااائب"
    if (shiftEndMin > 0 && currentMinutes > shiftEndMin) {
      setCheckInFeedback({
        type: 'error',
        text: `عذراً، انتهى وقت الحلقة/الدوام بالكامل (${targetShift.checkOutEnd || targetShift.checkOutStart})! تم إغلاق فترة التحضير ولا يمكن التسجيل، ويُحتسب المعلم غائباً لهذا اليوم.`
      });
      setIsPerformingCheckIn(false);
      return;
    }

    // Determine status: "حاضر" if on-time (<= checkInEnd), or "متأخر" if late (> checkInEnd up to end of halaqah)
    // "عايزه يحسبه متأخر الى نهاية الحلقة"
    const isLate = checkInEndMin > 0 && currentMinutes > checkInEndMin;
    const delayMinutes = isLate ? (currentMinutes - checkInEndMin) : 0;
    const determinedStatus: TeacherAttendanceStatus = isLate ? 'متأخر' : 'حاضر';

    const isRemote = isShiftRemote(targetShift);

    // -------------------------------------------------------------
    // REMOTE / ONLINE HALAQAH: No GPS required! "بدون لازم يكون في الموقع"
    // -------------------------------------------------------------
    if (isRemote) {
      try {
        const timeStr = formatCurrentArabicTime();
        const recId = `tatt_${selectedDate}_${targetShift.id}_${teacherId}`;
        const existing = attendanceRecords.find(r => r.id === recId);

        const record: TeacherAttendanceRecord = {
          id: recId,
          date: selectedDate,
          shiftId: targetShift.id,
          shiftName: targetShift.name,
          teacherId,
          teacherName,
          complexId: activeComplex?.id,
          mosqueId: targetShift.mosqueId || 'remote',
          mosqueName: targetShift.mosqueName || 'حلقة عن بعد (أونلاين)',
          status: determinedStatus,
          checkInTime: timeStr,
          checkInTimestamp: new Date().toISOString(),
          checkOutTime: existing?.checkOutTime,
          checkOutTimestamp: existing?.checkOutTimestamp,
          isOnline: true,
          delayMinutes,
          note: isLate ? `حضور متأخر (${delayMinutes} دقيقة) - حلقة عن بعد` : 'حضور عن بعد (أونلاين)',
          recordedBy: 'self',
          createdAt: existing?.createdAt || new Date().toISOString()
        };

        await OmranDataService.saveTeacherAttendanceRecord(record);
        setAttendanceRecords(prev => [...prev.filter(r => r.id !== record.id), record]);

        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.6 }
        });

        setCheckInFeedback({
          type: 'success',
          text: isLate
            ? `تم تسجيل حضورك (متأخر ${delayMinutes} دقيقة) للحلقة عن بعد (${targetShift.name}) في تمام الساعة ${timeStr} بنجاح!`
            : `تم تسجيل حضورك بنجاح للحلقة عن بعد (${targetShift.name}) في تمام الساعة ${timeStr}!`
        });
      } catch (e) {
        setCheckInFeedback({
          type: 'error',
          text: 'حدث خطأ أثناء حفظ التحضير. يرجى إعادة المحاولة.'
        });
      } finally {
        setIsPerformingCheckIn(false);
      }
      return;
    }

    // -------------------------------------------------------------
    // IN-PERSON HALAQAH: Requires GPS verification at mosque!
    // -------------------------------------------------------------
    const targetMosque = mosques.find(m => m.id === targetShift.mosqueId) || mosques[0];

    if (!navigator.geolocation) {
      setCheckInFeedback({
        type: 'error',
        text: 'متصفحك لا يدعم تحديد الموقع الجغرافي (GPS).'
      });
      setIsPerformingCheckIn(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const userLat = pos.coords.latitude;
          const userLng = pos.coords.longitude;

          // Verify mosque has configured location
          if (!targetMosque || !targetMosque.isLocationSet || !targetMosque.latitude || !targetMosque.longitude) {
            setCheckInFeedback({
              type: 'error',
              text: `عذراً، لم يتم ضبط الموقع الجغرافي لجامع (${targetMosque?.name || targetShift.name}) بعد على الخريطة من قِبل المشرف. يلزم ضبط موقع الجامع أولاً للتحقق من النطاق المسموح.`
            });
            setIsPerformingCheckIn(false);
            return;
          }

          // Check mosque radius (default 100 meters, or supervisor configured)
          const distance = calculateHaversineDistanceMeters(
            userLat,
            userLng,
            targetMosque.latitude,
            targetMosque.longitude
          );
          const allowedRadius = targetMosque.allowedRadiusMeters || 100;

          if (distance > allowedRadius) {
            const distDisplay = distance >= 1000 ? `${(distance / 1000).toFixed(2)} كم (${Math.round(distance)} متر)` : `${Math.round(distance)} متر`;
            const allowedDisplay = allowedRadius >= 1000 ? `${(allowedRadius / 1000).toFixed(2)} كم (${allowedRadius} متر)` : `${allowedRadius} متر`;
            setCheckInFeedback({
              type: 'error',
              text: `عذراً، أنت خارج نطاق (${targetMosque.name})! المسافة الحالية تقريباً ${distDisplay}، والمدى المسموح للتحضير هو ${allowedDisplay} فقط.`
            });
            setIsPerformingCheckIn(false);
            return;
          }

          // Within range! Record check-in
          const timeStr = formatCurrentArabicTime();
          const recId = `tatt_${selectedDate}_${targetShift.id}_${teacherId}`;
          const existing = attendanceRecords.find(r => r.id === recId);

          const record: TeacherAttendanceRecord = {
            id: recId,
            date: selectedDate,
            shiftId: targetShift.id,
            shiftName: targetShift.name,
            teacherId,
            teacherName,
            complexId: activeComplex?.id,
            mosqueId: targetMosque?.id,
            mosqueName: targetMosque?.name,
            status: determinedStatus,
            checkInTime: timeStr,
            checkInTimestamp: new Date().toISOString(),
            checkInLatitude: userLat,
            checkInLongitude: userLng,
            checkInDistanceMeters: Math.round(distance),
            checkOutTime: existing?.checkOutTime,
            checkOutTimestamp: existing?.checkOutTimestamp,
            isOnline: false,
            delayMinutes,
            note: isLate ? `حضور متأخر (${delayMinutes} دقيقة) في موقع الجامع` : undefined,
            recordedBy: 'self',
            createdAt: existing?.createdAt || new Date().toISOString()
          };

          await OmranDataService.saveTeacherAttendanceRecord(record);
          setAttendanceRecords(prev => [...prev.filter(r => r.id !== record.id), record]);

          confetti({
            particleCount: 70,
            spread: 60,
            origin: { y: 0.6 }
          });

          setCheckInFeedback({
            type: 'success',
            text: isLate
              ? `تم تسجيل حضورك (متأخر ${delayMinutes} دقيقة) في (${targetMosque?.name || targetShift.name}) في تمام الساعة ${timeStr}!`
              : `تم تسجيل حضورك بنجاح في (${targetMosque?.name || targetShift.name}) في تمام الساعة ${timeStr}!`
          });
        } catch (e) {
          setCheckInFeedback({
            type: 'error',
            text: 'حدث خطأ أثناء حفظ التحضير. يرجى إعادة المحاولة.'
          });
        } finally {
          setIsPerformingCheckIn(false);
        }
      },
      err => {
        setIsPerformingCheckIn(false);
        setCheckInFeedback({
          type: 'error',
          text: err.code === err.PERMISSION_DENIED
            ? 'تم رفض إذن الوصول إلى الموقع. يرجى تفعيل الـ GPS في متصفحك أو هاتفك.'
            : 'تعذر تحديد موقعك الحالي. يرجى التأكد من تشغيل الـ GPS.'
        });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handleTeacherCheckOut = async (targetShift: TeacherShift) => {
    const teacherId = currentTeacher?.id || (isSupervisorOrDev ? 'supervisor-self' : '');
    const teacherName = currentTeacher?.name || currentUserName || 'المعلم';
    if (!teacherId) return;

    setIsPerformingCheckOut(true);
    setCheckInFeedback(null);

    // Rule 1: Teacher must have recorded check-in first
    const recId = `tatt_${selectedDate}_${targetShift.id}_${teacherId}`;
    const existing = attendanceRecords.find(r => r.id === recId);
    if (!existing || !existing.checkInTime) {
      setCheckInFeedback({
        type: 'error',
        text: 'يرجى تسجيل الحضور أولاً قبل تسجيل الانصراف.'
      });
      setIsPerformingCheckOut(false);
      return;
    }

    // Departure is OPEN ("والانصراف مفتوح")
    // Teacher can check out at any time once checked in!
    const isRemote = isShiftRemote(targetShift);

    // -------------------------------------------------------------
    // REMOTE / ONLINE HALAQAH: No GPS required! "بدون لازم يكون في الموقع"
    // -------------------------------------------------------------
    if (isRemote) {
      try {
        const timeStr = formatCurrentArabicTime();
        const record: TeacherAttendanceRecord = {
          ...existing,
          checkOutTime: timeStr,
          checkOutTimestamp: new Date().toISOString(),
          isOnline: true,
          recordedBy: 'self'
        };

        await OmranDataService.saveTeacherAttendanceRecord(record);
        setAttendanceRecords(prev => [...prev.filter(r => r.id !== record.id), record]);

        confetti({
          particleCount: 50,
          spread: 50,
          origin: { y: 0.6 }
        });

        setCheckInFeedback({
          type: 'success',
          text: `تم تسجيل انصرافك بنجاح للحلقة عن بعد (${targetShift.name}) في تمام الساعة ${timeStr}!`
        });
      } catch (e) {
        setCheckInFeedback({
          type: 'error',
          text: 'حدث خطأ أثناء حفظ الانصراف. يرجى إعادة المحاولة.'
        });
      } finally {
        setIsPerformingCheckOut(false);
      }
      return;
    }

    // -------------------------------------------------------------
    // IN-PERSON HALAQAH: "ولكن لازم ينصرف في موقع الجامع"
    // -------------------------------------------------------------
    const targetMosque = mosques.find(m => m.id === targetShift.mosqueId) || mosques[0];

    if (!navigator.geolocation) {
      setCheckInFeedback({
        type: 'error',
        text: 'متصفحك لا يدعم تحديد الموقع الجغرافي (GPS) للتحقق من موقع الجامع عند الانصراف.'
      });
      setIsPerformingCheckOut(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const userLat = pos.coords.latitude;
          const userLng = pos.coords.longitude;

          // Verify mosque has configured location
          if (!targetMosque || !targetMosque.isLocationSet || !targetMosque.latitude || !targetMosque.longitude) {
            setCheckInFeedback({
              type: 'error',
              text: `عذراً، لم يتم ضبط الموقع الجغرافي لجامع (${targetMosque?.name || targetShift.name}) بعد على الخريطة من قِبل المشرف. يلزم ضبط موقع الجامع أولاً لتسجيل الانصراف.`
            });
            setIsPerformingCheckOut(false);
            return;
          }

          // Check mosque radius (must be at the mosque site!)
          const distance = calculateHaversineDistanceMeters(
            userLat,
            userLng,
            targetMosque.latitude,
            targetMosque.longitude
          );
          const allowedRadius = targetMosque.allowedRadiusMeters || 100;

          if (distance > allowedRadius) {
            const distDisplay = distance >= 1000 ? `${(distance / 1000).toFixed(2)} كم (${Math.round(distance)} متر)` : `${Math.round(distance)} متر`;
            const allowedDisplay = allowedRadius >= 1000 ? `${(allowedRadius / 1000).toFixed(2)} كم (${allowedRadius} متر)` : `${allowedRadius} متر`;
            setCheckInFeedback({
              type: 'error',
              text: `عذراً، يجب تسجيل الانصراف من موقع الجامع (${targetMosque.name})! المسافة الحالية تقريباً ${distDisplay}، والمدى المسموح للانصراف هو ${allowedDisplay} فقط.`
            });
            setIsPerformingCheckOut(false);
            return;
          }

          // Within mosque range! Record check-out
          const timeStr = formatCurrentArabicTime();

          const record: TeacherAttendanceRecord = {
            id: recId,
            date: selectedDate,
            shiftId: targetShift.id,
            shiftName: targetShift.name,
            teacherId,
            teacherName,
            complexId: activeComplex?.id,
            mosqueId: targetMosque?.id,
            mosqueName: targetMosque?.name,
            status: existing?.status || 'حاضر',
            checkInTime: existing?.checkInTime || timeStr,
            checkInTimestamp: existing?.checkInTimestamp || new Date().toISOString(),
            checkInLatitude: existing?.checkInLatitude,
            checkInLongitude: existing?.checkInLongitude,
            checkInDistanceMeters: existing?.checkInDistanceMeters,
            checkOutTime: timeStr,
            checkOutTimestamp: new Date().toISOString(),
            checkOutDistanceMeters: Math.round(distance),
            isOnline: false,
            delayMinutes: existing?.delayMinutes,
            recordedBy: 'self',
            createdAt: existing?.createdAt || new Date().toISOString()
          };

          await OmranDataService.saveTeacherAttendanceRecord(record);
          setAttendanceRecords(prev => [...prev.filter(r => r.id !== record.id), record]);

          confetti({
            particleCount: 50,
            spread: 50,
            origin: { y: 0.6 }
          });

          setCheckInFeedback({
            type: 'success',
            text: `تم تسجيل انصرافك بنجاح من (${targetMosque?.name || targetShift.name}) في تمام الساعة ${timeStr}!`
          });
        } catch (e) {
          setCheckInFeedback({
            type: 'error',
            text: 'حدث خطأ أثناء حفظ الانصراف. يرجى إعادة المحاولة.'
          });
        } finally {
          setIsPerformingCheckOut(false);
        }
      },
      err => {
        setIsPerformingCheckOut(false);
        setCheckInFeedback({
          type: 'error',
          text: err.code === err.PERMISSION_DENIED
            ? 'تم رفض إذن الوصول إلى الموقع. يلزم تفعيل الـ GPS لتسجيل الانصراف من موقع الجامع.'
            : 'تعذر تحديد موقعك الحالي للتأكد من وجودك في المسجد. يرجى تشغيل الـ GPS.'
        });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // =========================================================================
  // 4. Supervisor Fast Actions (Manual Check-in, Out, Excuse, Absent, Reset)
  // =========================================================================
  const handleApplySupervisorAction = async () => {
    if (!actionTeacherModal) return;
    const { teacher, shift, actionType } = actionTeacherModal;

    const targetMosque = mosques.find(m => m.id === shift.mosqueId) || mosques[0];
    const recId = `tatt_${selectedDate}_${shift.id}_${teacher.id}`;
    const existing = attendanceRecords.find(r => r.id === recId);
    const chosenTime = customTime.trim() || formatCurrentArabicTime();

    let newStatus: TeacherAttendanceStatus = 'حاضر';
    let newCheckIn = existing?.checkInTime;
    let newCheckOut = existing?.checkOutTime;

    if (actionType === 'check_in') {
      newStatus = 'حاضر';
      newCheckIn = chosenTime;
    } else if (actionType === 'late') {
      newStatus = 'متأخر';
      newCheckIn = chosenTime;
    } else if (actionType === 'check_out') {
      newStatus = existing?.status || 'حاضر';
      newCheckOut = chosenTime;
    } else if (actionType === 'excuse') {
      newStatus = 'معتذر';
    } else if (actionType === 'absent') {
      newStatus = 'غائب';
    }

    const record: TeacherAttendanceRecord = {
      id: recId,
      date: selectedDate,
      shiftId: shift.id,
      shiftName: shift.name,
      teacherId: teacher.id,
      teacherName: teacher.name,
      complexId: activeComplex?.id,
      mosqueId: targetMosque?.id,
      mosqueName: targetMosque?.name,
      status: newStatus,
      checkInTime: newCheckIn,
      checkInTimestamp: existing?.checkInTimestamp || (actionType === 'check_in' ? new Date().toISOString() : undefined),
      checkOutTime: newCheckOut,
      checkOutTimestamp: actionType === 'check_out' ? new Date().toISOString() : existing?.checkOutTimestamp,
      note: actionNote.trim() || existing?.note,
      recordedBy: 'supervisor',
      createdAt: existing?.createdAt || new Date().toISOString()
    };

    await OmranDataService.saveTeacherAttendanceRecord(record);
    setAttendanceRecords(prev => [...prev.filter(r => r.id !== record.id), record]);
    setActionTeacherModal(null);
    setActionNote('');
    setCustomTime('');
  };

  const handleResetRecord = async (shift: TeacherShift, teacherId: string) => {
    if (!window.confirm('هل تريد إلغاء التحضير وإعادة الضبط لهذا المعلم؟')) return;
    const recId = `tatt_${selectedDate}_${shift.id}_${teacherId}`;
    await OmranDataService.deleteTeacherAttendanceRecord(recId, selectedDate);
    setAttendanceRecords(prev => prev.filter(r => r.id !== recId));
  };

  // Teacher's assigned shifts today
  const myAssignedShifts = useMemo(() => {
    const tId = currentTeacher?.id;
    if (!tId) return shifts;
    const explicitlyAssigned = shifts.filter(s => (s.assignedTeacherIds || []).includes(tId));
    if (explicitlyAssigned.length > 0) return explicitlyAssigned;
    // If supervisor or developer, allow them to check in into any of the complex's shifts
    if (isSupervisorOrDev) return shifts;
    return [];
  }, [shifts, currentTeacher, isSupervisorOrDev]);

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Floating / Top Toast Message */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -15, scale: 0.95 }}
            className={`p-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-xl border ${
              toastMessage.type === 'success'
                ? 'bg-amber-400 text-[#064e3b] border-amber-300'
                : 'bg-red-600 text-white border-red-500'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Banner & Mode Toggle with Duolingo 3D Styling */}
      <div
        className="p-5 sm:p-6 rounded-[32px] border-2 border-b-4 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
        style={{
          backgroundColor: themeCard,
          borderColor: themeBorder,
          borderBottomColor: themeBorderBottom
        }}
      >
        <div className="flex items-center gap-3.5">
          <div
            className="w-12 h-12 rounded-2xl border-2 border-b-4 flex items-center justify-center font-black text-xl shadow-lg shrink-0"
            style={{
              backgroundColor: themeAccent,
              borderColor: themeAccent,
              borderBottomColor: themeAccentShadow,
              color: themeContrastText
            }}
          >
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-white font-heading">
                نظام تحضير المعلمين الذكي
              </h2>
              <span
                className="text-xs px-2.5 py-0.5 rounded-full font-bold border"
                style={{
                  backgroundColor: `${themeAccent}25`,
                  color: themeAccent,
                  borderColor: `${themeAccent}60`
                }}
              >
                {mosques.length} {mosques.length === 1 ? 'جامع مسجل' : 'جوامع مسجلة'}
              </span>
              {activeComplex?.name && (
                <span
                  className="text-xs px-2.5 py-0.5 rounded-full font-bold border flex items-center gap-1"
                  style={{
                    backgroundColor: themeSecondary,
                    color: themeSubtext,
                    borderColor: themeBorder
                  }}
                >
                  <Building2 className="w-3 h-3" style={{ color: themeAccent }} />
                  <span>{activeComplex.name}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-1 font-bold">
              إدارة فترات الدوام والمناوبات، وتعيين الجوامع والمعلمين، والتحضير السلس بضغطة زر
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div
          className="flex items-center gap-1.5 p-1.5 rounded-2xl border flex-wrap"
          style={{
            backgroundColor: themePrimary,
            borderColor: themeBorder
          }}
        >
          {isSupervisorOrDev && (
            <>
              <button
                type="button"
                onClick={() => setActiveSubTab('records')}
                className="px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border-2 border-b-4 active:translate-y-0.5"
                style={
                  activeSubTab === 'records'
                    ? {
                        backgroundColor: themeAccent,
                        color: themeContrastText,
                        borderColor: themeAccent,
                        borderBottomColor: themeAccentShadow
                      }
                    : {
                        backgroundColor: 'transparent',
                        color: '#cbd5e1',
                        borderColor: 'transparent',
                        borderBottomColor: 'transparent'
                      }
                }
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>سجل التحضير</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('shifts')}
                className="px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border-2 border-b-4 active:translate-y-0.5"
                style={
                  activeSubTab === 'shifts'
                    ? {
                        backgroundColor: themeAccent,
                        color: themeContrastText,
                        borderColor: themeAccent,
                        borderBottomColor: themeAccentShadow
                      }
                    : {
                        backgroundColor: 'transparent',
                        color: '#cbd5e1',
                        borderColor: 'transparent',
                        borderBottomColor: 'transparent'
                      }
                }
              >
                <Clock className="w-3.5 h-3.5" />
                <span>فترات الدوام وتعيينها ({shifts.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSubTab('mosques')}
                className="px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border-2 border-b-4 active:translate-y-0.5"
                style={
                  activeSubTab === 'mosques'
                    ? {
                        backgroundColor: themeAccent,
                        color: themeContrastText,
                        borderColor: themeAccent,
                        borderBottomColor: themeAccentShadow
                      }
                    : {
                        backgroundColor: 'transparent',
                        color: '#cbd5e1',
                        borderColor: 'transparent',
                        borderBottomColor: 'transparent'
                      }
                }
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>الجوامع ({mosques.length})</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setActiveSubTab('self')}
            className="px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border-2 border-b-4 active:translate-y-0.5"
            style={
              activeSubTab === 'self' || !isSupervisorOrDev
                ? {
                    backgroundColor: themeAccent,
                    color: themeContrastText,
                    borderColor: themeAccent,
                    borderBottomColor: themeAccentShadow
                  }
                : {
                    backgroundColor: 'transparent',
                    color: '#cbd5e1',
                    borderColor: 'transparent',
                    borderBottomColor: 'transparent'
                  }
            }
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>تسجيل حضوري</span>
          </button>

          {isSupervisorOrDev && onSaveLibraryDoc && (
            <button
              type="button"
              disabled={isSavingToLibrary}
              onClick={async () => {
                setIsSavingToLibrary(true);
                try {
                  const complexTitle = activeComplex?.name || 'المجمع القرآني';
                  const dayRecords = attendanceRecords.filter(r => r.date === selectedDate);
                  const rowsHtml =
                    dayRecords.length > 0
                      ? dayRecords
                          .map(
                            (r, idx) => `<tr>
                              <td>${idx + 1}</td>
                              <td><strong>${r.teacherName}</strong></td>
                              <td>${r.shiftName || '-'}</td>
                              <td>${r.mosqueName || '-'}</td>
                              <td>${r.status}</td>
                              <td>${r.checkInTime || '-'}</td>
                              <td>${r.checkOutTime || '-'}</td>
                              <td>${r.note || '-'}</td>
                            </tr>`
                          )
                          .join('')
                      : teachers
                          .map(
                            (t, idx) => `<tr>
                              <td>${idx + 1}</td>
                              <td><strong>${t.name}</strong></td>
                              <td>-</td>
                              <td>${complexTitle}</td>
                              <td>لم يُسجل بعد</td>
                              <td>-</td>
                              <td>-</td>
                              <td>-</td>
                            </tr>`
                          )
                          .join('');

                  const htmlSheet = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <title>تحضير المعلمين - ${complexTitle} - ${selectedDate}</title>
  <style>
    body { font-family: 'Tajawal', 'Cairo', sans-serif; direction: rtl; padding: 28px; background: #f8fafc; color: #0f172a; }
    .box { max-width: 960px; margin: 0 auto; background: #fff; border-radius: 20px; border: 2px solid #cbd5e1; padding: 24px; }
    h1 { margin: 0 0 6px; color: #064e3b; font-size: 22px; }
    .meta { color: #475569; font-size: 13px; margin-bottom: 18px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #064e3b; color: #fbbf24; padding: 10px; border: 1px solid #064e3b; text-align: right; }
    td { padding: 8px 10px; border: 1px solid #cbd5e1; }
    tr:nth-child(even) td { background: #f8fafc; }
  </style>
</head>
<body>
  <div class="box">
    <h1>كشف تحضير المعلمين والمشرفين - ${complexTitle}</h1>
    <div class="meta">التاريخ: ${selectedDate} • تم الاستخراج بواسطة: ${currentUserName || 'المشرف'}</div>
    <table>
      <thead><tr><th>#</th><th>اسم المعلم</th><th>الفترة / المناوبة</th><th>الجامع</th><th>الحالة</th><th>وقت الحضور</th><th>وقت الانصراف</th><th>ملاحظات</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>
</body>
</html>`;

                  const docObj: LibraryDocument = {
                    id: `lib-tatt-${Date.now()}`,
                    complexId: activeComplex?.id,
                    complexName: complexTitle,
                    title: `الحضور والغياب (المعلمون) - ${complexTitle} - ${selectedDate}`,
                    type: 'attendance_sheet',
                    sectionCategory: 'attendance',
                    description: `سجل تحضير وانصراف معلمي (${complexTitle}) ليوم ${selectedDate}`,
                    htmlContent: htmlSheet,
                    createdBy: currentUserName || 'المشرف',
                    createdAt: new Date().toISOString()
                  };

                  await onSaveLibraryDoc(docObj, {
                    blob: new Blob([htmlSheet], { type: 'text/html;charset=utf-8' }),
                    htmlContent: htmlSheet,
                    mimeType: 'text/html',
                    fileExtension: '.html'
                  });
                  setToastMessage({
                    type: 'success',
                    text: 'تم حفظ كشف تحضير المعلمين في المكتبة ومجلد «الحضور والغياب» على Google Drive بنجاح ✓'
                  });
                  setTimeout(() => setToastMessage(null), 4000);
                } catch (err: any) {
                  if (err?.message !== 'LIBRARY_NOT_LINKED') {
                    setToastMessage({
                      type: 'error',
                      text: err?.message || 'تعذر حفظ كشف التحضير في المكتبة.'
                    });
                    setTimeout(() => setToastMessage(null), 4000);
                  }
                } finally {
                  setIsSavingToLibrary(false);
                }
              }}
              className="duo-complex-secondary-btn text-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-60"
            >
              {isSavingToLibrary ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FolderArchive className="w-3.5 h-3.5" />
              )}
              <span>حفظ في المكتبة</span>
            </button>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* VIEW 1: TEACHER SELF ATTENDANCE (واجهة المعلم للتحضير الذاتي)        */}
      {/* ===================================================================== */}
      {(activeSubTab === 'self' || !isSupervisorOrDev) && (
        <div className="duo-complex-records-shell p-6 sm:p-8 space-y-6 transition-all">
          {/* Header Row */}
          <div
            className="pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2"
            style={{ borderColor: themeBorder }}
          >
            <div className="flex items-center gap-3.5">
              <div className="duo-complex-header-icon w-12 h-12 flex items-center justify-center shrink-0">
                <Navigation className="w-6 h-6" />
              </div>
              <div>
                <h3
                  className="text-base sm:text-lg font-black font-heading flex items-center gap-2"
                  style={{ color: themeText }}
                >
                  <span>تحضير الحضور والانصراف اليومي</span>
                </h3>
                <p className="duo-complex-subtext text-xs mt-0.5 font-bold">
                  تاريخ اليوم: <span className="font-mono">{todayStr}</span> • المعلم:{' '}
                  <strong style={{ color: themeAccent }}>
                    {currentTeacher?.name || currentUserName || 'المعلم'}
                  </strong>
                </p>
              </div>
            </div>

            {(() => {
              const firstInPersonShift = myAssignedShifts.find(s => !isShiftRemote(s));
              const activeMosqueForBadge = firstInPersonShift
                ? mosques.find(m => m.id === firstInPersonShift.mosqueId) || mosques[0]
                : mosques[0];
              const radiusM = activeMosqueForBadge?.allowedRadiusMeters || 100;
              const radiusFormatted =
                radiusM >= 1000 && radiusM % 1000 === 0
                  ? `${radiusM / 1000} كم`
                  : radiusM >= 1000
                  ? `${(radiusM / 1000).toFixed(1)} كم`
                  : `${radiusM} متر`;

              return (
                <div className="flex items-center gap-2 flex-wrap">
                  {myAssignedShifts.length > 0 && myAssignedShifts.every(s => isShiftRemote(s)) ? (
                    <span className="duo-complex-shift-count-badge text-xs inline-flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      <span>دوام عن بعد (أونلاين)</span>
                    </span>
                  ) : (
                    <span className="duo-complex-shift-count-badge text-xs inline-flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>النطاق المسموح: {radiusFormatted} من الجامع</span>
                    </span>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Feedback Banner */}
          {checkInFeedback && (
            <div
              className={`duo-complex-self-notice ${
                checkInFeedback.type === 'error' ? 'duo-complex-self-notice--ended' : ''
              } text-xs sm:text-sm flex items-center gap-2.5 animate-fadeIn`}
            >
              {checkInFeedback.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0" />
              )}
              <span>{checkInFeedback.text}</span>
            </div>
          )}

          {myAssignedShifts.length === 0 ? (
            <div className="duo-complex-empty-box p-8 text-center text-xs space-y-4">
              <p className="text-sm font-black" style={{ color: themeText }}>
                لا توجد فترات دوام مسندة إليك حالياً في هذا المجمع (
                {activeComplex?.name || 'المجمع'}).
              </p>
              {isSupervisorOrDev ? (
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  {shifts.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleOpenAssignTeachersModal(shifts[0])}
                      className="duo-complex-assign-btn text-xs inline-flex items-center gap-2 cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>تعيين فترتي وإدراج اسمي الآن</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleOpenAddShiftModal}
                    className="duo-complex-secondary-btn text-xs inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إنشاء فترة دوام جديدة</span>
                  </button>
                </div>
              ) : (
                <p className="duo-complex-subtext font-bold">
                  يرجى التواصل مع المشرف لتعيين فترتك وجامعك في هذا المجمع.
                </p>
              )}
            </div>
          ) : (
            <div
              className={`grid grid-cols-1 ${
                myAssignedShifts.length > 1 ? 'lg:grid-cols-2' : ''
              } gap-5`}
            >
              {myAssignedShifts.map(shift => {
                const isRemote = isShiftRemote(shift);
                const shiftMosque = mosques.find(m => m.id === shift.mosqueId) || mosques[0];
                const myRecordId = `tatt_${todayStr}_${shift.id}_${
                  currentTeacher?.id || (isSupervisorOrDev ? 'supervisor-self' : '')
                }`;
                const record = attendanceRecords.find(r => r.id === myRecordId);

                const hasCheckedIn = Boolean(record?.checkInTime);
                const hasCheckedOut = Boolean(record?.checkOutTime);

                const now = new Date();
                const currentMinutes = now.getHours() * 60 + now.getMinutes();
                const checkInStartMin = parseTimeToMinutes(shift.checkInStart);
                const checkInEndMin = parseTimeToMinutes(shift.checkInEnd || shift.checkInStart);
                const checkOutStartMin = parseTimeToMinutes(shift.checkOutStart);
                const checkOutEndMin = parseTimeToMinutes(shift.checkOutEnd || shift.checkOutStart);
                const shiftEndMin =
                  checkOutEndMin > 0
                    ? checkOutEndMin
                    : checkOutStartMin > 0
                    ? checkOutStartMin
                    : checkInEndMin;

                const isBeforeCheckIn = checkInStartMin > 0 && currentMinutes < checkInStartMin;
                const isHalaqahEnded = shiftEndMin > 0 && currentMinutes > shiftEndMin;
                const isLateCheckIn =
                  !isHalaqahEnded && checkInEndMin > 0 && currentMinutes > checkInEndMin;
                const delayMinutes = isLateCheckIn ? currentMinutes - checkInEndMin : 0;

                const checkInStartFmt = parse24hTimeParts(shift.checkInStart).formatted;
                const checkInEndFmt = parse24hTimeParts(shift.checkInEnd).formatted;
                const checkOutStartFmt = parse24hTimeParts(shift.checkOutStart).formatted;
                const checkOutEndFmt = parse24hTimeParts(shift.checkOutEnd).formatted;
                const shiftEndFmt = parse24hTimeParts(
                  shift.checkOutEnd || shift.checkOutStart
                ).formatted;

                const statusVariantClass = hasCheckedOut
                  ? 'duo-complex-self-status-chip--done'
                  : hasCheckedIn
                  ? record?.status === 'متأخر'
                    ? 'duo-complex-self-status-chip--late'
                    : 'duo-complex-self-status-chip--done'
                  : isHalaqahEnded
                  ? 'duo-complex-self-status-chip--ended'
                  : isLateCheckIn
                  ? 'duo-complex-self-status-chip--late'
                  : '';

                return (
                  <div
                    key={shift.id}
                    className="duo-complex-mgmt-shift-card p-5 sm:p-6 space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      {/* Shift 3D Header Bar */}
                      <div className="duo-complex-shift-header flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3">
                          <div className="duo-complex-header-icon w-11 h-11 flex items-center justify-center shrink-0">
                            {isRemote ? (
                              <Globe className="w-5 h-5" />
                            ) : (
                              <Clock className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <span
                              className="text-sm sm:text-base font-black font-heading block"
                              style={{ color: themeText }}
                            >
                              {shift.name}
                            </span>
                            <span className="duo-complex-subtext text-[11px] font-bold block mt-0.5">
                              {isRemote
                                ? 'دوام حلقة عن بعد (أونلاين)'
                                : `مقر الدوام: ${
                                    shiftMosque?.name || shift.mosqueName || 'جامع الحلقات'
                                  }`}
                            </span>
                          </div>
                        </div>

                        <span className={`duo-complex-self-status-chip text-xs ${statusVariantClass}`}>
                          {hasCheckedOut
                            ? 'تم الانصراف ✓'
                            : hasCheckedIn
                            ? record?.status === 'متأخر'
                              ? `حاضر (متأخر ${record.delayMinutes ? `${record.delayMinutes} د` : ''})`
                              : 'تم الحضور ✓'
                            : isHalaqahEnded
                            ? 'غائب (انتهى وقت الحلقة)'
                            : isBeforeCheckIn
                            ? `يبدأ التحضير (${checkInStartFmt})`
                            : isLateCheckIn
                            ? `التحضير متأخر (${delayMinutes} د)`
                            : 'متاح للتحضير الآن'}
                        </span>
                      </div>

                      {/* Shift Type & Mosque 3D Location Box */}
                      {isRemote ? (
                        <div className="duo-complex-shift-location-box duo-complex-shift-location-box--remote space-y-1.5">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div
                              className="flex items-center gap-2 text-xs sm:text-sm font-black"
                              style={{ color: themeText }}
                            >
                              <Globe className="w-4 h-4 shrink-0" />
                              <span>حلقة عن بعد (أونلاين)</span>
                            </div>
                            <span className="duo-complex-shift-schedule-chip text-[11px]">
                              بدون شرط الموقع الجغرافي
                            </span>
                          </div>
                          <p className="duo-complex-subtext text-[11px] font-bold leading-relaxed">
                            التحضير والانصراف مباشر بنقرة واحدة وفق مواعيد الحلقة دون الحاجة للـ GPS أو الوجود بالمسجد.
                          </p>
                        </div>
                      ) : (
                        <div className="duo-complex-shift-location-box space-y-2">
                          <div className="flex items-center justify-between gap-2.5 flex-wrap">
                            <div className="flex items-center gap-2 text-xs sm:text-sm font-black flex-wrap">
                              <Building2 className="w-4 h-4 shrink-0" />
                              <span style={{ color: themeText }}>
                                الجامع: {shiftMosque?.name || shift.mosqueName || 'جامع الحلقات'}
                              </span>
                              <span className="duo-complex-shift-schedule-chip text-[11px]">
                                النطاق: {shiftMosque?.allowedRadiusMeters || 100} متر
                              </span>
                            </div>

                            {shiftMosque && (
                              <button
                                type="button"
                                onClick={() => handleOpenMosqueMap(shiftMosque, 'view')}
                                className="duo-complex-mini-edit-btn text-xs inline-flex items-center gap-1.5 cursor-pointer"
                                title={`اطلاع على موقع الجامع وحدود الـ ${
                                  shiftMosque.allowedRadiusMeters || 100
                                } متر على الخريطة`}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>خريطة الجامع</span>
                              </button>
                            )}
                          </div>

                          {shiftMosque?.neighborhood && (
                            <span className="duo-complex-subtext text-xs font-bold block pr-6">
                              الموقع: {shiftMosque.neighborhood}
                            </span>
                          )}

                          {!shiftMosque?.isLocationSet && (
                            <div className="duo-complex-datepicker-selected-banner text-[11px] font-black flex items-center gap-2">
                              <AlertCircle
                                className="w-4 h-4 shrink-0"
                                style={{ color: themeAccent }}
                              />
                              <span style={{ color: themeText }}>
                                تنبيه: لم يحدد المشرف إحداثيات هذا الجامع على الخريطة بعد.
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 3D Check-in & Check-out Window Boxes */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-center">
                        <div className="duo-complex-shift-time-box space-y-1">
                          <span className="duo-complex-shift-time-label text-[11px] block">
                            نافذة الحضور:
                          </span>
                          <div className="duo-complex-shift-time-value text-xs sm:text-sm font-mono flex items-center justify-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: themeAccent }} />
                            <span dir="ltr">
                              {checkInStartFmt} - {checkInEndFmt}
                            </span>
                          </div>
                        </div>

                        <div className="duo-complex-shift-time-box space-y-1">
                          <span className="duo-complex-shift-time-label text-[11px] block">
                            نافذة الانصراف:
                          </span>
                          <div className="duo-complex-shift-time-value text-xs sm:text-sm font-mono flex items-center justify-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: themeAccent }} />
                            <span dir="ltr">
                              {checkOutStartFmt} - {checkOutEndFmt}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Real-time 3D Attendance Timing Notice */}
                      {!hasCheckedIn && (
                        <div>
                          {isHalaqahEnded ? (
                            <div className="duo-complex-self-notice duo-complex-self-notice--ended text-center text-xs flex items-center justify-center gap-2">
                              <XCircle className="w-4 h-4 shrink-0" />
                              <span>
                                انتهى وقت الحلقة الرسمي بالكامل ({shiftEndFmt}) • تم إغلاق التحضير واحتسابك غائباً لهذا اليوم
                              </span>
                            </div>
                          ) : isBeforeCheckIn ? (
                            <div className="duo-complex-self-notice text-center text-xs flex items-center justify-center gap-2">
                              <Clock className="w-4 h-4 shrink-0" />
                              <span>
                                لا يمكن التحضير قبل الموعد • يبدأ التحضير في تمام الساعة {checkInStartFmt}
                              </span>
                            </div>
                          ) : isLateCheckIn ? (
                            <div className="duo-complex-self-notice duo-complex-self-notice--late text-center text-xs flex items-center justify-center gap-2">
                              <AlertCircle className="w-4 h-4 shrink-0" />
                              <span>
                                أنت متأخر الآن ({delayMinutes} دقيقة) • التحضير متاح حتى نهاية وقت الحلقة ({shiftEndFmt}) وسيُسجَّل متأخر
                              </span>
                            </div>
                          ) : (
                            <div className="duo-complex-self-notice text-center text-xs flex items-center justify-center gap-2">
                              <CheckCircle2 className="w-4 h-4 shrink-0" />
                              <span>
                                وقت التحضير في الموعد متاح الآن حتى الساعة {checkInEndFmt}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {hasCheckedIn && !hasCheckedOut && (
                        <div className="duo-complex-self-notice text-center text-xs flex items-center justify-center gap-2">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>
                            {isRemote
                              ? 'الانصراف مفتوح ومتاح بنقرة واحدة (حلقة عن بعد بدون اشتراط الموقع)'
                              : `الانصراف مفتوح الآن • يلزم تسجيله وأنت متواجد في موقع (${
                                  shiftMosque?.name || shift.mosqueName || 'الجامع'
                                })`}
                          </span>
                        </div>
                      )}

                      {/* Recorded Times 3D Summary */}
                      {record && (
                        <div className="duo-complex-teachers-list-box space-y-2 text-xs">
                          {record.checkInTime && (
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="duo-complex-subtext font-black">
                                ساعة الحضور المسجلة:
                              </span>
                              <div className="flex items-center gap-2">
                                <span
                                  className={`duo-complex-duty-status text-[10px] ${
                                    record.status !== 'غائب' ? 'is-assigned' : ''
                                  }`}
                                >
                                  {record.status}{' '}
                                  {record.delayMinutes ? `(${record.delayMinutes} د)` : ''}
                                </span>
                                <strong
                                  className="font-mono font-black"
                                  style={{ color: themeText }}
                                >
                                  {record.checkInTime}
                                </strong>
                              </div>
                            </div>
                          )}

                          {record.checkOutTime && (
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="duo-complex-subtext font-black">
                                ساعة الانصراف المسجلة:
                              </span>
                              <strong
                                className="font-mono font-black"
                                style={{ color: themeText }}
                              >
                                {record.checkOutTime}
                              </strong>
                            </div>
                          )}

                          {record.note && (
                            <div
                              className="duo-complex-subtext text-[11px] font-bold pt-1.5 border-t-2"
                              style={{ borderColor: themeBorder }}
                            >
                              ملاحظة: {record.note}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Solid Duolingo 3D Action Buttons (Zero Broken Gradients!) */}
                    <div
                      className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t-2"
                      style={{ borderColor: themeBorder }}
                    >
                      <button
                        type="button"
                        disabled={
                          hasCheckedIn || isPerformingCheckIn || isBeforeCheckIn || isHalaqahEnded
                        }
                        onClick={() => handleTeacherCheckIn(shift)}
                        className={`duo-complex-self-action-btn text-xs flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed ${
                          hasCheckedIn
                            ? 'is-completed'
                            : isBeforeCheckIn || isHalaqahEnded
                            ? 'is-locked'
                            : ''
                        }`}
                      >
                        {isPerformingCheckIn ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                            <span>جارٍ التحقق...</span>
                          </>
                        ) : hasCheckedIn ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>{record?.status === 'متأخر' ? 'حاضر (متأخر)' : 'تم الحضور'}</span>
                          </>
                        ) : isHalaqahEnded ? (
                          <>
                            <XCircle className="w-4 h-4 shrink-0" />
                            <span>انتهى وقت الحلقة (غائب)</span>
                          </>
                        ) : isBeforeCheckIn ? (
                          <>
                            <Clock className="w-4 h-4 shrink-0" />
                            <span>التحضير يبدأ ({checkInStartFmt})</span>
                          </>
                        ) : isLateCheckIn ? (
                          <>
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>تسجيل الحضور (متأخر {delayMinutes} د)</span>
                          </>
                        ) : isRemote ? (
                          <>
                            <Globe className="w-4 h-4 shrink-0" />
                            <span>تسجيل الحضور (عن بعد)</span>
                          </>
                        ) : (
                          <>
                            <Navigation className="w-4 h-4 shrink-0" />
                            <span>تسجيل الحضور (بالمسجد)</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={!hasCheckedIn || hasCheckedOut || isPerformingCheckOut}
                        onClick={() => handleTeacherCheckOut(shift)}
                        className={`duo-complex-self-action-btn text-xs flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed ${
                          hasCheckedOut ? 'is-completed' : !hasCheckedIn ? 'is-locked' : ''
                        }`}
                      >
                        {isPerformingCheckOut ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                            <span>جارٍ الانصراف...</span>
                          </>
                        ) : hasCheckedOut ? (
                          <>
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>تم الانصراف</span>
                          </>
                        ) : !hasCheckedIn ? (
                          <>
                            <Clock className="w-4 h-4 shrink-0" />
                            <span>الانصراف (بعد التحضير)</span>
                          </>
                        ) : isRemote ? (
                          <>
                            <Globe className="w-4 h-4 shrink-0" />
                            <span>تسجيل الانصراف (عن بعد)</span>
                          </>
                        ) : (
                          <>
                            <Building2 className="w-4 h-4 shrink-0" />
                            <span>تسجيل الانصراف (في الجامع)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW 2: SUPERVISOR ATTENDANCE RECORDS (سجل الحضور اليومي للمشرف)      */}
      {/* ===================================================================== */}
      {isSupervisorOrDev && activeSubTab === 'records' && (
        <div className="duo-complex-records-shell p-6 sm:p-8 space-y-6 transition-all">
          {/* Header & Custom Duolingo 3D Date Picker Navigation */}
          <div
            className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b-2"
            style={{ borderColor: themeBorder }}
          >
            <div className="flex items-center gap-3.5">
              <div className="duo-complex-header-icon w-12 h-12 flex items-center justify-center shrink-0">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <h3
                  className="text-base sm:text-lg font-black font-heading flex items-center gap-2"
                  style={{ color: themeText }}
                >
                  <span>سجل تحضير وانصراف المعلمين</span>
                </h3>
                <p className="duo-complex-subtext text-xs mt-0.5 font-bold">
                  يمكنك الرجوع لأي تاريخ سابق للاطلاع على سجلات التحضير أو التعديل عليها
                </p>
              </div>
            </div>

            {/* Custom Duolingo 3D Complex Date Picker ("من الداخل وتحديد التاريخ كذلك") */}
            <div ref={datePickerContainerRef} className="relative flex items-center gap-2 flex-wrap">
              <span className="duo-complex-subtext text-xs font-black px-1">التاريخ المحدد:</span>

              <div className="duo-complex-date-dock inline-flex items-center gap-1.5 flex-wrap">
                {/* Step Previous Day */}
                <button
                  type="button"
                  title="اليوم السابق"
                  onClick={() => handleStepSelectedDate(-1)}
                  className="duo-complex-date-step-btn cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Date Trigger Button */}
                <button
                  type="button"
                  onClick={() => setIsDatePickerOpen(prev => !prev)}
                  className={`duo-complex-date-trigger inline-flex items-center gap-2 text-xs cursor-pointer ${
                    isDatePickerOpen ? 'is-open' : ''
                  }`}
                >
                  <Calendar className="w-4 h-4 shrink-0" style={{ color: themeAccent }} />
                  <span className="whitespace-nowrap">{selectedDateDisplay.shortLabel}</span>
                  <span
                    className="font-mono text-[11px] px-1.5 py-0.5 rounded-md opacity-90"
                    style={{
                      backgroundColor: themePrimary,
                      color: themeAccent
                    }}
                  >
                    {selectedDate}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-150 ${
                      isDatePickerOpen ? 'rotate-180' : ''
                    }`}
                    style={{ color: themeAccent }}
                  />
                </button>

                {/* Step Next Day */}
                <button
                  type="button"
                  title="اليوم التالي"
                  onClick={() => handleStepSelectedDate(1)}
                  className="duo-complex-date-step-btn cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Today Quick Button */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate(todayStr);
                    setIsDatePickerOpen(false);
                  }}
                  className={`duo-complex-today-btn inline-flex items-center gap-1.5 text-xs cursor-pointer ${
                    selectedDate === todayStr ? 'is-active' : ''
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>اليوم</span>
                </button>
              </div>

              {/* Inside Custom Calendar Popover */}
              <AnimatePresence>
                {isDatePickerOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="duo-complex-datepicker-popover absolute top-full left-0 mt-2.5 w-[312px] sm:w-[342px] z-50 space-y-3"
                  >
                    {/* Selected Date Active Banner */}
                    <div className="duo-complex-datepicker-selected-banner flex items-center justify-between gap-2">
                      <div className="text-right">
                        <div
                          className="text-[11px] font-black"
                          style={{ color: themeAccent }}
                        >
                          التاريخ المحدد حالياً
                        </div>
                        <div
                          className="text-xs font-black mt-0.5"
                          style={{ color: themeText }}
                        >
                          {selectedDateDisplay.shortLabel}
                        </div>
                        {selectedDateDisplay.hijriStr && (
                          <div className="duo-complex-subtext text-[10px] font-bold mt-0.5">
                            {selectedDateDisplay.hijriStr}
                          </div>
                        )}
                      </div>
                      <span
                        className="font-mono text-xs font-black px-2.5 py-1 rounded-xl border-2"
                        style={{
                          backgroundColor: themeCard,
                          borderColor: themeBorder,
                          color: themeAccent
                        }}
                      >
                        {selectedDate}
                      </span>
                    </div>

                    {/* Month & Year Switcher Bar */}
                    <div className="duo-complex-datepicker-monthbar flex items-center justify-between gap-2">
                      <button
                        type="button"
                        title="الشهر السابق"
                        onClick={() =>
                          setPickerMonthDate(
                            prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                          )
                        }
                        className="duo-complex-date-step-btn cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>

                      <div className="text-center">
                        <div
                          className="text-sm font-black font-heading"
                          style={{ color: themeAccent }}
                        >
                          {pickerMonthHeader.monthName} {pickerMonthHeader.yearNum}
                        </div>
                        {pickerMonthHeader.hijriMonthYear && (
                          <div className="duo-complex-subtext text-[10px] font-bold">
                            {pickerMonthHeader.hijriMonthYear}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        title="الشهر التالي"
                        onClick={() =>
                          setPickerMonthDate(
                            prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                          )
                        }
                        className="duo-complex-date-step-btn cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Weekday Headers */}
                    <div className="grid grid-cols-7 gap-1.5">
                      {ARABIC_WEEKDAYS_SHORT.map(dayLabel => (
                        <div key={dayLabel} className="duo-complex-weekday-cell">
                          {dayLabel}
                        </div>
                      ))}
                    </div>

                    {/* Tactile 3D Day Selection Grid */}
                    <div className="grid grid-cols-7 gap-1.5">
                      {pickerCalendarCells.map(cell => {
                        const isSelected = cell.iso === selectedDate;
                        const isTodayCell = cell.iso === todayStr;

                        return (
                          <button
                            key={cell.iso}
                            type="button"
                            onClick={() => {
                              setSelectedDate(cell.iso);
                              setIsDatePickerOpen(false);
                            }}
                            className={`duo-complex-day-btn cursor-pointer font-mono ${
                              !cell.inCurrentMonth ? 'is-outside' : ''
                            } ${isTodayCell ? 'is-today' : ''} ${
                              isSelected ? 'is-selected' : ''
                            }`}
                          >
                            <span>{cell.day}</span>
                            {isTodayCell && (
                              <span
                                className="w-1.5 h-1.5 rounded-full mt-0.5"
                                style={{
                                  backgroundColor: isSelected
                                    ? themeContrastText
                                    : themeAccent
                                }}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Popover Quick Footer Actions */}
                    <div
                      className="flex items-center justify-between gap-2 pt-2.5 border-t-2"
                      style={{ borderColor: themeBorder }}
                    >
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDate(todayStr);
                            setIsDatePickerOpen(false);
                          }}
                          className={`duo-complex-today-btn text-[11px] cursor-pointer ${
                            selectedDate === todayStr ? 'is-active' : ''
                          }`}
                        >
                          اليوم
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDate(yesterdayStr);
                            setIsDatePickerOpen(false);
                          }}
                          className={`duo-complex-today-btn text-[11px] cursor-pointer ${
                            selectedDate === yesterdayStr ? 'is-active' : ''
                          }`}
                        >
                          أمس
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsDatePickerOpen(false)}
                        className="duo-btn-dark px-3.5 py-1.5 text-[11px] cursor-pointer"
                      >
                        إغلاق
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Shifts Accordion / List */}
          {shifts.length === 0 ? (
            <div className="duo-complex-empty-box p-8 text-center text-xs font-extrabold">
              لا توجد فترات دوام منشأة بعد. اضغط على تبويب "فترات الدوام" لإضافة فترة جديدة.
            </div>
          ) : (
            <div className="space-y-6">
              {shifts.map(shift => {
                const shiftMosque = mosques.find(m => m.id === shift.mosqueId) || mosques[0];
                const assignedTeachersList = teachers.filter(t => (shift.assignedTeacherIds || []).includes(t.id));

                return (
                  <div
                    key={shift.id}
                    className="duo-complex-shift-card p-5 sm:p-6 space-y-4"
                  >
                    {/* Shift Header Bar */}
                    <div className="duo-complex-shift-header flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                      <div className="flex items-center gap-3.5">
                        <div className="duo-complex-header-icon w-11 h-11 flex items-center justify-center font-bold shrink-0">
                          <Clock className="w-5 h-5" />
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="text-base font-black font-heading"
                              style={{ color: themeText }}
                            >
                              {shift.name}
                            </span>
                            {isShiftRemote(shift) ? (
                              <span className="duo-complex-shift-badge duo-complex-shift-badge--remote text-xs inline-flex items-center gap-1.5">
                                <Globe className="w-3.5 h-3.5" />
                                <span>حلقة عن بعد (أونلاين)</span>
                              </span>
                            ) : (
                              <span className="duo-complex-shift-badge text-xs inline-flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5" />
                                <span>{shiftMosque?.name || shift.mosqueName || 'جامع الحلقات'}</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 flex-wrap text-[11px]">
                            <span className="duo-complex-shift-schedule-chip inline-flex items-center gap-1">
                              <span>الحضور:</span>
                              <span className="font-mono" style={{ color: themeAccent }}>
                                ({shift.checkInStart} - {shift.checkInEnd})
                              </span>
                            </span>
                            <span className="duo-complex-shift-schedule-chip inline-flex items-center gap-1">
                              <span>الانصراف:</span>
                              <span className="font-mono" style={{ color: themeAccent }}>
                                ({shift.checkOutStart} - {shift.checkOutEnd})
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenAssignTeachersModal(shift)}
                          className="duo-complex-assign-btn text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <UserCheck className="w-4 h-4" />
                          <span>تعيين وتكليف المعلمين ({assignedTeachersList.length})</span>
                        </button>
                      </div>
                    </div>

                    {/* Teachers Table for this shift */}
                    {assignedTeachersList.length === 0 ? (
                      <div className="duo-complex-empty-box text-center py-6 px-4 space-y-3">
                        <p className="text-xs font-extrabold">
                          لم يتم تعيين أي معلمين في هذه الفترة بعد.
                        </p>
                        <button
                          type="button"
                          onClick={() => handleOpenAssignTeachersModal(shift)}
                          className="duo-complex-assign-btn text-xs inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <UserPlus className="w-4 h-4" />
                          <span>تعيين وتكليف المعلمين لهذه الفترة الآن</span>
                        </button>
                      </div>
                    ) : (
                      <div className="duo-complex-att-table-wrap overflow-x-auto">
                        <table className="duo-complex-att-table w-full text-right text-xs">
                          <thead>
                            <tr>
                              <th className="px-3.5 py-3.5 font-black text-right">المعلم</th>
                              <th className="px-3.5 py-3.5 font-black text-center">الحالة</th>
                              <th className="px-3.5 py-3.5 font-black text-center">ساعة الحضور</th>
                              <th className="px-3.5 py-3.5 font-black text-center">ساعة الانصراف</th>
                              <th className="px-3.5 py-3.5 font-black text-right">ملاحظات</th>
                              <th className="px-3.5 py-3.5 font-black text-left">إجراءات المشرف</th>
                            </tr>
                          </thead>
                          <tbody>
                            {assignedTeachersList.map(teacher => {
                              const recId = `tatt_${selectedDate}_${shift.id}_${teacher.id}`;
                              const record = attendanceRecords.find(r => r.id === recId);
                              const dynamicInfo = getTeacherShiftDynamicStatus(shift, record, selectedDate);
                              const status = dynamicInfo.status;
                              const displayStatus = dynamicInfo.displayStatus;

                              return (
                                <tr
                                  key={teacher.id}
                                  id={`teacher-att-item-${teacher.id}`}
                                  data-item-id={teacher.id}
                                  className="transition-colors"
                                >
                                  <td
                                    className="px-3.5 py-3 font-black whitespace-nowrap"
                                    style={{ color: themeText }}
                                  >
                                    {teacher.name}
                                  </td>
                                  <td className="px-3.5 py-3 text-center whitespace-nowrap">
                                    <span
                                      className={`duo-att-chip text-[11px] ${
                                        status === 'حاضر'
                                          ? dynamicInfo.didNotCheckOut
                                            ? 'duo-att-chip-accent'
                                            : 'bg-[#58cc02]/15 text-[#89e219] border-[#58cc02] border-b-[#46a302]'
                                          : status === 'متأخر'
                                          ? 'bg-[#ff9600]/15 text-[#ffb84d] border-[#ff9600] border-b-[#e68300]'
                                          : status === 'معتذر'
                                          ? 'duo-att-chip-accent'
                                          : status === 'غائب'
                                          ? 'bg-[#ff4b4b]/15 text-[#ff8787] border-[#ff4b4b] border-b-[#ea2b2b]'
                                          : 'duo-att-chip-empty'
                                      }`}
                                    >
                                      {displayStatus}
                                    </span>
                                  </td>
                                  <td className="px-3.5 py-3 text-center font-mono font-black whitespace-nowrap">
                                    {record?.checkInTime ? (
                                      <span className="duo-att-chip duo-att-chip-accent text-xs">
                                        {record.checkInTime}
                                      </span>
                                    ) : (
                                      <span className="duo-att-chip duo-att-chip-empty min-w-[2.75rem] text-xs">
                                        —
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3.5 py-3 text-center font-mono font-black whitespace-nowrap">
                                    {record?.checkOutTime ? (
                                      <span className="duo-att-chip duo-att-chip-checkout text-xs">
                                        {record.checkOutTime}
                                      </span>
                                    ) : dynamicInfo.didNotCheckOut ? (
                                      <span className="duo-att-chip duo-att-chip-accent text-[11px] font-sans">
                                        لم ينصرف
                                      </span>
                                    ) : (
                                      <span className="duo-att-chip duo-att-chip-empty min-w-[2.75rem] text-xs">
                                        —
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3.5 py-3 text-right">
                                    {record?.note ? (
                                      <span className="duo-att-chip duo-att-chip-note text-[11px] justify-start text-right">
                                        {record.note}
                                      </span>
                                    ) : (
                                      <span className="duo-att-chip duo-att-chip-empty min-w-[2.75rem] text-xs">
                                        —
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3.5 py-3 text-left">
                                    <div className="duo-att-actions-dock inline-flex items-center justify-end gap-1.5 flex-wrap">
                                      {/* Quick Check-in */}
                                      <button
                                        type="button"
                                        title="تحضير يدوي"
                                        onClick={() => {
                                          setActionTeacherModal({
                                            teacher,
                                            shift,
                                            actionType: 'check_in'
                                          });
                                          setCustomTime(formatCurrentArabicTime());
                                          setActionNote('');
                                        }}
                                        className={`duo-att-action-btn duo-att-action-btn--checkin cursor-pointer ${
                                          status === 'حاضر' ? 'is-selected' : ''
                                        }`}
                                      >
                                        تحضير
                                      </button>

                                      {/* Quick Late */}
                                      <button
                                        type="button"
                                        title="تسجيل متأخر"
                                        onClick={() => {
                                          setActionTeacherModal({
                                            teacher,
                                            shift,
                                            actionType: 'late'
                                          });
                                          setCustomTime(formatCurrentArabicTime());
                                          setActionNote('حضور متأخر');
                                        }}
                                        className={`duo-att-action-btn duo-att-action-btn--late cursor-pointer ${
                                          status === 'متأخر' ? 'is-selected' : ''
                                        }`}
                                      >
                                        متأخر
                                      </button>

                                      {/* Quick Check-out */}
                                      <button
                                        type="button"
                                        title="تسجيل انصراف"
                                        onClick={() => {
                                          setActionTeacherModal({
                                            teacher,
                                            shift,
                                            actionType: 'check_out'
                                          });
                                          setCustomTime(formatCurrentArabicTime());
                                          setActionNote('');
                                        }}
                                        className={`duo-att-action-btn duo-att-action-btn--checkout cursor-pointer ${
                                          record?.checkOutTime ? 'is-selected' : ''
                                        }`}
                                      >
                                        انصراف
                                      </button>

                                      {/* Quick Excuse */}
                                      <button
                                        type="button"
                                        title="تسجيل عذر"
                                        onClick={() => {
                                          setActionTeacherModal({
                                            teacher,
                                            shift,
                                            actionType: 'excuse'
                                          });
                                          setCustomTime('');
                                          setActionNote('عذر مسبق معتمد من الإدارة');
                                        }}
                                        className={`duo-att-action-btn duo-att-action-btn--excuse cursor-pointer ${
                                          status === 'معتذر' ? 'is-selected' : ''
                                        }`}
                                      >
                                        عذر
                                      </button>

                                      {/* Quick Absent */}
                                      <button
                                        type="button"
                                        title="تسجيل غياب"
                                        onClick={() => {
                                          setActionTeacherModal({
                                            teacher,
                                            shift,
                                            actionType: 'absent'
                                          });
                                          setCustomTime('');
                                          setActionNote('غياب دون إشعار');
                                        }}
                                        className={`duo-att-action-btn duo-att-action-btn--absent cursor-pointer ${
                                          status === 'غائب' ? 'is-selected' : ''
                                        }`}
                                      >
                                        غياب
                                      </button>

                                      {/* Reset */}
                                      {record && (
                                        <button
                                          type="button"
                                          title="إلغاء التحضير / إعادة تعيين"
                                          onClick={() => handleResetRecord(shift, teacher.id)}
                                          className="duo-att-action-btn duo-att-action-btn--reset cursor-pointer"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW 3: MOSQUES MANAGEMENT (إدارة الجوامع والمساجد المضافة)            */}
      {/* ===================================================================== */}
      {isSupervisorOrDev && activeSubTab === 'mosques' && (
        <div className="duo-complex-records-shell p-6 sm:p-8 space-y-6 transition-all">
          <div
            className="flex items-center justify-between gap-4 pb-5 border-b-2 flex-wrap"
            style={{ borderColor: themeBorder }}
          >
            <div className="flex items-center gap-3.5">
              <div className="duo-complex-header-icon w-12 h-12 flex items-center justify-center shrink-0">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h3
                  className="text-base sm:text-lg font-black font-heading flex items-center gap-2"
                  style={{ color: themeText }}
                >
                  <span>إدارة الجوامع والمساجد</span>
                </h3>
                <p className="duo-complex-subtext text-xs mt-0.5 font-bold">
                  يمكنك كتابة اسم الجامع وحفظه، وإضافة أكثر من جامع للمجمع بسهولة تامة
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenAddMosqueModal}
              className="duo-complex-assign-btn text-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة جامع جديد</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mosques.map(mosque => {
              const linkedShiftsCount = shifts.filter(s => s.mosqueId === mosque.id).length;

              return (
                <div
                  key={mosque.id}
                  className="duo-complex-mgmt-shift-card p-5 space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <div className="duo-complex-header-icon w-10 h-10 flex items-center justify-center shrink-0">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <h4
                            className="text-sm font-black font-heading"
                            style={{ color: themeText }}
                          >
                            {mosque.name}
                          </h4>
                          <span className="duo-complex-subtext text-[11px] font-bold block">
                            {mosque.neighborhood || 'جامع تابع للمجمع'}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`duo-complex-duty-status text-[10px] ${
                          mosque.isLocationSet ? 'is-assigned' : ''
                        }`}
                      >
                        {mosque.isLocationSet ? 'الموقع ملتقط ✓' : 'لم يحدد الموقع'}
                      </span>
                    </div>

                    <div className="duo-complex-shift-time-box flex items-center justify-between text-xs">
                      <span className="duo-complex-shift-time-label">
                        الفترات المربوطة بهذا الجامع:
                      </span>
                      <strong className="font-black" style={{ color: themeAccent }}>
                        {linkedShiftsCount} فترات
                      </strong>
                    </div>

                    <div className="duo-complex-shift-time-box flex items-center justify-between text-xs">
                      <span className="duo-complex-shift-time-label flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" style={{ color: themeAccent }} />
                        <span>مدى التحضير المسموح:</span>
                      </span>
                      <strong className="duo-complex-shift-time-value font-mono">
                        {mosque.allowedRadiusMeters || 100} متر{' '}
                        {(mosque.allowedRadiusMeters || 100) >= 1000
                          ? `(${((mosque.allowedRadiusMeters || 100) / 1000).toFixed(1)} كم)`
                          : ''}
                      </strong>
                    </div>
                  </div>

                  <div
                    className="flex items-center justify-between gap-2 pt-3 border-t-2 flex-wrap"
                    style={{ borderColor: themeBorder }}
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {mosque.isLocationSet && (
                        <button
                          type="button"
                          onClick={() => handleOpenMosqueMap(mosque, 'view')}
                          className="duo-complex-mini-edit-btn text-xs inline-flex items-center gap-1 cursor-pointer"
                          title={`اطلاع على موقع الجامع وحدود الـ ${
                            mosque.allowedRadiusMeters || 100
                          } متر على الخريطة`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>اطلاع</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenMosqueMap(mosque, 'picker')}
                        className="duo-complex-assign-btn text-xs inline-flex items-center gap-1 cursor-pointer"
                        title="تحديد أو تعديل الموقع على خريطة Google التفاعلية"
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>
                          {mosque.isLocationSet ? 'تعديل على الخريطة' : 'تحديد على الخريطة'}
                        </span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditMosqueModal(mosque)}
                        className="duo-complex-secondary-btn text-xs inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>تعديل</span>
                      </button>
                      {mosques.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteMosque(mosque.id)}
                          className="duo-complex-danger-icon-btn cursor-pointer"
                          title="حذف الجامع"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW 4: SHIFTS MANAGEMENT (إدارة فترات ومناوبات الدوام)                 */}
      {/* ===================================================================== */}
      {isSupervisorOrDev && activeSubTab === 'shifts' && (
        <div className="duo-complex-records-shell p-6 sm:p-8 space-y-6 transition-all">
          <div
            className="flex items-center justify-between gap-4 pb-5 border-b-2 flex-wrap"
            style={{ borderColor: themeBorder }}
          >
            <div className="flex items-center gap-3.5">
              <div className="duo-complex-header-icon w-12 h-12 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h3
                  className="text-base sm:text-lg font-black font-heading flex items-center gap-2"
                  style={{ color: themeText }}
                >
                  <span>فترات ومناوبات دوام المعلمين</span>
                </h3>
                <p className="duo-complex-subtext text-xs mt-0.5 font-bold">
                  تحديد مواعيد الحضور والانصراف، وربط كل فترة بجامع مخصص وقائمة المعلمين المناوبين
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleOpenAddShiftModal}
              className="duo-complex-assign-btn text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة فترة دوام</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {shifts.map(shift => {
              const shiftMosque = mosques.find(m => m.id === shift.mosqueId) || mosques[0];
              const assignedTeachers = teachers.filter(t => (shift.assignedTeacherIds || []).includes(t.id));

              return (
                <div
                  key={shift.id}
                  className="duo-complex-mgmt-shift-card p-5 sm:p-6 space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4
                        className="text-base sm:text-lg font-black font-heading"
                        style={{ color: themeText }}
                      >
                        {shift.name}
                      </h4>
                      <span className="duo-complex-shift-count-badge text-xs">
                        {assignedTeachers.length} معلمين مناوبين
                      </span>
                    </div>

                    {isShiftRemote(shift) ? (
                      <div className="duo-complex-shift-location-box duo-complex-shift-location-box--remote space-y-1">
                        <div className="flex items-center gap-2 text-xs font-black">
                          <Globe className="w-4 h-4 shrink-0" />
                          <span>حلقة عن بعد (أونلاين) • بدون شرط الموقع الجغرافي</span>
                        </div>
                      </div>
                    ) : (
                      <div className="duo-complex-shift-location-box space-y-1">
                        <div className="flex items-center gap-2 text-xs font-black">
                          <Building2 className="w-4 h-4 shrink-0" />
                          <span>الجامع المخصص: {shiftMosque?.name || shift.mosqueName || 'جامع الحلقات'}</span>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2.5 text-center text-xs">
                      <div className="duo-complex-shift-time-box">
                        <span className="duo-complex-shift-time-label text-[11px] block mb-0.5">
                          موعد الحضور:
                        </span>
                        <strong className="duo-complex-shift-time-value font-mono text-sm tracking-wide">
                          {shift.checkInStart} - {shift.checkInEnd}
                        </strong>
                      </div>
                      <div className="duo-complex-shift-time-box">
                        <span className="duo-complex-shift-time-label text-[11px] block mb-0.5">
                          موعد الانصراف:
                        </span>
                        <strong className="duo-complex-shift-time-value font-mono text-sm tracking-wide">
                          {shift.checkOutStart} - {shift.checkOutEnd}
                        </strong>
                      </div>
                    </div>

                    <div className="duo-complex-shift-teachers-panel space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="duo-complex-subtext text-xs font-black block">
                          المعلمون المكلفون ({assignedTeachers.length}):
                        </span>
                        <button
                          type="button"
                          onClick={() => handleOpenAssignTeachersModal(shift)}
                          className="duo-complex-mini-edit-btn text-[11px] flex items-center gap-1 cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>تعديل المكلفين</span>
                        </button>
                      </div>
                      {assignedTeachers.length === 0 ? (
                        <div
                          onClick={() => handleOpenAssignTeachersModal(shift)}
                          className="duo-complex-empty-assign-trigger text-center cursor-pointer"
                        >
                          <span className="text-xs font-black">
                            لم يُعيّن معلمين بعد — اضغط هنا لتعيين المعلمين
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {assignedTeachers.map(t => (
                            <span
                              key={t.id}
                              className="duo-complex-teacher-chip text-[11px]"
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: themeAccent }}
                              />
                              <span>{t.name}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div
                    className="flex items-center justify-between gap-2 pt-3.5 border-t-2 flex-wrap"
                    style={{ borderColor: themeBorder }}
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenAssignTeachersModal(shift)}
                      className="duo-complex-assign-btn text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>تعيين المعلمين ({assignedTeachers.length})</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditShiftModal(shift)}
                        className="duo-complex-secondary-btn text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>تعديل المواعيد</span>
                      </button>
                      {shifts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteShift(shift.id)}
                          className="duo-complex-danger-icon-btn cursor-pointer"
                          title="حذف الفترة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: ADD / EDIT MOSQUE (إضافة / تعديل جامع بدون تعقيدات)          */}
      {/* ===================================================================== */}
      {typeof document !== 'undefined' &&
        isMosqueModalOpen &&
        createPortal(
          <div
            dir="rtl"
            onClick={() => setIsMosqueModalOpen(false)}
            style={{ zIndex: 2147483000 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
          >
            <div
              onClick={e => e.stopPropagation()}
              className="duo-complex-modal-shell w-full max-w-lg max-h-[92vh] flex flex-col p-5 sm:p-6 space-y-4 text-right"
            >
              <div className="duo-complex-modal-header flex items-start justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="duo-complex-header-icon w-12 h-12 flex items-center justify-center font-black text-xl shrink-0">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3
                      className="text-base sm:text-lg font-black font-heading"
                      style={{ color: themeText }}
                    >
                      {editingMosqueId ? 'تعديل بيانات الجامع' : 'إضافة جامع جديد'}
                    </h3>
                    <p className="duo-complex-subtext text-xs font-bold mt-0.5">
                      اكتب اسم الجامع بكل سهولة واحفظه لربط فترات الدوام به
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMosqueModalOpen(false)}
                  className="duo-complex-modal-close-btn cursor-pointer"
                  title="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 overflow-y-auto custom-scrollbar flex-1 min-h-0 pr-0.5 py-0.5">
                {/* Mosque Name */}
                <div className="space-y-1.5">
                  <label className="duo-complex-subtext text-xs font-black block">
                    اسم الجامع أو المسجد: <span className="text-red-400">*</span>
                  </label>
                  <div className="duo-complex-search-dock">
                    <span className="duo-complex-search-icon-badge">
                      <Building2 className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={mosqueNameInput}
                      onChange={e => setMosqueNameInput(e.target.value)}
                      placeholder="مثال: جامع الراجحي، جامع الفرقان، مسجد بلال بن رباح..."
                      className="duo-complex-search-field text-xs sm:text-sm"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Neighborhood / Location label */}
                <div className="space-y-1.5">
                  <label className="duo-complex-subtext text-xs font-black block">
                    الحي أو المنطقة (اختياري):
                  </label>
                  <div className="duo-complex-search-dock">
                    <span className="duo-complex-search-icon-badge">
                      <MapPin className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={mosqueNeighborhoodInput}
                      onChange={e => setMosqueNeighborhoodInput(e.target.value)}
                      placeholder="مثال: حي الروضة، الشارع العام..."
                      className="duo-complex-search-field text-xs"
                    />
                  </div>
                </div>

                {/* Mosque Range Setting (مدى المسجد للتحضير بالأمتار) */}
                <div className="duo-complex-teachers-list-box space-y-2.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="duo-complex-subtext text-xs font-black">
                      مدى المسجد المسموح للتحضير (بالمتر):
                    </label>
                    <span className="duo-complex-shift-count-badge text-[11px] font-mono">
                      {mosqueRadiusInput || 100} متر{' '}
                      {Number(mosqueRadiusInput) >= 1000
                        ? `(${(Number(mosqueRadiusInput) / 1000).toFixed(1)} كم)`
                        : ''}
                    </span>
                  </div>
                  <p className="duo-complex-subtext text-[11px] leading-relaxed font-bold opacity-90">
                    المسافة المحيطة بالمسجد التي يُسمح للمعلم بالتحضير والانصراف داخلها (الافتراضي 100 متر، ويمكنك كتابة أي رقم تريده كـ 100 أو 500 أو 1000 متر أو غيرها).
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="10"
                      max="50000"
                      step="10"
                      value={mosqueRadiusInput}
                      onChange={e => setMosqueRadiusInput(e.target.value)}
                      placeholder="100"
                      className="duo-complex-input w-full py-2 px-3 rounded-xl text-xs sm:text-sm font-mono font-black outline-none"
                    />
                    <span className="duo-complex-subtext text-xs font-black shrink-0">متر</span>
                  </div>
                  {/* Quick preset chips */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    {[
                      { label: '100 م (الافتراضي)', val: 100 },
                      { label: '200 م', val: 200 },
                      { label: '500 م', val: 500 },
                      { label: '1000 م (1 كم)', val: 1000 },
                      { label: '2000 م (2 كم)', val: 2000 }
                    ].map(preset => (
                      <button
                        key={preset.val}
                        type="button"
                        onClick={() => setMosqueRadiusInput(String(preset.val))}
                        className={`duo-complex-today-btn text-[11px] cursor-pointer ${
                          Number(mosqueRadiusInput) === preset.val ? 'is-active' : ''
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Simple One-Click GPS Capture */}
                <div className="duo-complex-teachers-list-box space-y-2.5">
                  <span className="text-xs font-black block" style={{ color: themeAccent }}>
                    تحديد الموقع للتحضير الذكي (Google Maps أو بنقرة واحدة):
                  </span>
                  <p className="duo-complex-subtext text-[11px] leading-relaxed font-bold opacity-90">
                    يمكنك فتح الخريطة التفاعلية والتحريك وسحب الدبوس حتى تصل للجامع، أو الضغط على التقاط موقعك الحالي مباشرة.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const tempMosque: MosqueItem = {
                          id: editingMosqueId || `mosque_${Date.now()}`,
                          name: mosqueNameInput.trim() || 'الجامع',
                          neighborhood: mosqueNeighborhoodInput.trim(),
                          latitude: capturedMosqueLocation?.lat,
                          longitude: capturedMosqueLocation?.lng,
                          isLocationSet: Boolean(capturedMosqueLocation?.lat),
                          allowedRadiusMeters: parseInt(mosqueRadiusInput, 10) || 100,
                          createdAt: new Date().toISOString()
                        };
                        handleOpenMosqueMap(tempMosque, 'picker');
                      }}
                      className="duo-complex-assign-btn text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <MapPin className="w-4 h-4" />
                      <span>تحديد بالخريطة التفاعلية</span>
                    </button>

                    <button
                      type="button"
                      disabled={isCapturingGPS}
                      onClick={handleCaptureCurrentLocationForMosque}
                      className="duo-complex-secondary-btn text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Navigation className="w-4 h-4" />
                      <span>{isCapturingGPS ? 'جارٍ الالتقاط...' : 'التقاط موقعي الحالي (GPS)'}</span>
                    </button>
                  </div>

                  {gpsCaptureMsg && (
                    <div
                      className={`p-2.5 rounded-xl text-xs font-black flex items-center gap-2 border-2 border-b-4 ${
                        gpsCaptureMsg.type === 'success'
                          ? 'duo-att-chip-accent'
                          : 'bg-red-500/20 text-red-200 border-red-500/50'
                      }`}
                    >
                      {gpsCaptureMsg.type === 'success' ? (
                        <Check className="w-4 h-4 shrink-0" />
                      ) : (
                        <X className="w-4 h-4 shrink-0" />
                      )}
                      <span>{gpsCaptureMsg.text}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="duo-complex-modal-footer flex items-center justify-end gap-2.5 flex-wrap shrink-0">
                <button
                  type="button"
                  onClick={() => setIsMosqueModalOpen(false)}
                  className="duo-complex-secondary-btn text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={!mosqueNameInput.trim()}
                  onClick={handleSaveMosque}
                  className="duo-complex-assign-btn text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>حفظ الجامع</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ===================================================================== */}
      {/* MODAL 2: ADD / EDIT SHIFT (ربط الفترة بالجامع والمعلمين والخيارات)      */}
      {/* ===================================================================== */}
      {typeof document !== 'undefined' &&
        isShiftModalOpen &&
        createPortal(
          <div
            dir="rtl"
            onClick={() => setIsShiftModalOpen(false)}
            style={{ zIndex: 2147483000 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
          >
            <div
              onClick={e => e.stopPropagation()}
              className="duo-complex-modal-shell w-full max-w-lg max-h-[92vh] flex flex-col p-5 sm:p-6 space-y-4 text-right"
            >
              {/* Pinned 3D Header */}
              <div className="duo-complex-modal-header flex items-start justify-between gap-3 shrink-0">
                <div className="flex items-start gap-3">
                  <div className="duo-complex-header-icon w-12 h-12 flex items-center justify-center font-black text-xl shrink-0">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3
                      className="text-base sm:text-lg font-black font-heading leading-snug"
                      style={{ color: themeText }}
                    >
                      {editingShiftId ? 'تعديل فترة الدوام' : 'إنشاء فترة دوام جديدة'}
                    </h3>
                    <p className="duo-complex-subtext text-xs font-bold leading-relaxed">
                      المجمع: {activeComplex?.name || 'المجمع الحالي'} • حدد الجامع ومواعيد الدوام والمعلمين المناوبين
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsShiftModalOpen(false)}
                  className="duo-complex-modal-close-btn cursor-pointer"
                  title="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Middle Body */}
              <div className="space-y-4 overflow-y-auto custom-scrollbar flex-1 min-h-0 pr-0.5 py-0.5">
                {/* 1. Shift Name (3D Dock + Quick Preset Options) */}
                <div className="space-y-2">
                  <label className="duo-complex-subtext text-xs font-black block">
                    اسم الفترة: <span className="text-red-400">*</span>
                  </label>
                  <div className="duo-complex-search-dock">
                    <span className="duo-complex-search-icon-badge">
                      <Clock className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={shiftForm.name}
                      onChange={e => setShiftForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="مثال: الفترة العصرية الرسمية، الفترة المسائية، حلقة الفجر..."
                      className="duo-complex-search-field text-xs sm:text-sm"
                    />
                    {shiftForm.name.trim() !== '' && (
                      <button
                        type="button"
                        onClick={() => setShiftForm(prev => ({ ...prev, name: '' }))}
                        className="duo-complex-mini-edit-btn text-[11px] flex items-center gap-1 cursor-pointer shrink-0"
                        title="مسح الاسم"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Quick Shift Name Options */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      'الفترة العصرية الرسمية',
                      'الفترة المسائية',
                      'فترة الفجر',
                      'الفترة الصباحية'
                    ].map(presetName => (
                      <button
                        key={presetName}
                        type="button"
                        onClick={() => setShiftForm(prev => ({ ...prev, name: presetName }))}
                        className={`duo-complex-today-btn text-[11px] cursor-pointer ${
                          shiftForm.name.trim() === presetName ? 'is-active' : ''
                        }`}
                      >
                        {presetName}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Shift Type Toggle (حضورية أو عن بعد) — 100% Active Complex Theme */}
                <div className="space-y-2">
                  <label className="duo-complex-subtext text-xs font-black block">
                    نوع الحلقة / الدوام: <span className="text-red-400">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShiftForm(prev => ({ ...prev, isOnline: false }))}
                      className={
                        !shiftForm.isOnline
                          ? 'duo-complex-assign-btn text-xs flex items-center justify-center gap-2 cursor-pointer py-2.5'
                          : 'duo-complex-secondary-btn text-xs flex items-center justify-center gap-2 cursor-pointer py-2.5'
                      }
                    >
                      <Building2 className="w-4 h-4 shrink-0" />
                      <span>حلقة حضورية (بالمسجد)</span>
                      {!shiftForm.isOnline && <Check className="w-4 h-4 stroke-[3] shrink-0" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMosqueSelectOpen(false);
                        setShiftForm(prev => ({ ...prev, isOnline: true }));
                      }}
                      className={
                        shiftForm.isOnline
                          ? 'duo-complex-assign-btn text-xs flex items-center justify-center gap-2 cursor-pointer py-2.5'
                          : 'duo-complex-secondary-btn text-xs flex items-center justify-center gap-2 cursor-pointer py-2.5'
                      }
                    >
                      <Globe className="w-4 h-4 shrink-0" />
                      <span>حلقة عن بعد (أونلاين)</span>
                      {shiftForm.isOnline && <Check className="w-4 h-4 stroke-[3] shrink-0" />}
                    </button>
                  </div>
                </div>

                {/* 3. Custom Duolingo 3D Mosque Selector & Options Menu ("والخيارات") */}
                {!shiftForm.isOnline ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <label className="duo-complex-subtext text-xs font-black flex items-center gap-1.5">
                        <Building2 className="w-4 h-4" style={{ color: themeAccent }} />
                        <span>
                          الجامع المخصص لهذه الفترة: <span className="text-red-400">*</span>
                        </span>
                      </label>

                      {mosques.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isAddingNewMosqueInShift) {
                              setIsAddingNewMosqueInShift(false);
                              setNewMosqueNameInShift('');
                            } else {
                              setIsMosqueSelectOpen(false);
                              setIsAddingNewMosqueInShift(true);
                            }
                          }}
                          className="duo-complex-mini-edit-btn text-[11px] inline-flex items-center gap-1 cursor-pointer"
                        >
                          {isAddingNewMosqueInShift ? (
                            <>
                              <Building2 className="w-3.5 h-3.5" />
                              <span>اختيار من الجوامع المسجلة ({mosques.length})</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              <span>جامع جديد</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {isAddingNewMosqueInShift || mosques.length === 0 ? (
                      <div className="duo-complex-teachers-list-box space-y-2">
                        <span className="duo-complex-subtext text-[11px] font-black block">
                          إضافة جامع جديد وربطه مباشرة بهذه الفترة:
                        </span>
                        <div className="duo-complex-search-dock">
                          <span className="duo-complex-search-icon-badge">
                            <Building2 className="w-4 h-4" />
                          </span>
                          <input
                            type="text"
                            value={newMosqueNameInShift}
                            onChange={e => setNewMosqueNameInShift(e.target.value)}
                            placeholder="اكتب اسم الجامع الجديد هنا..."
                            className="duo-complex-search-field text-xs sm:text-sm"
                          />
                        </div>
                      </div>
                    ) : (
                      (() => {
                        const selectedMosqueObj =
                          mosques.find(m => m.id === shiftForm.mosqueId) || mosques[0];
                        return (
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveShiftTimeField(null);
                                setIsMosqueSelectOpen(prev => !prev);
                              }}
                              className={`duo-complex-select-trigger flex items-center justify-between gap-3 cursor-pointer ${
                                isMosqueSelectOpen ? 'is-open' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="duo-complex-search-icon-badge">
                                  <Building2 className="w-4 h-4" />
                                </span>
                                <div className="min-w-0 text-right">
                                  <span
                                    className="text-xs sm:text-sm font-black block truncate"
                                    style={{ color: themeText }}
                                  >
                                    {selectedMosqueObj?.name || 'اختر الجامع'}
                                  </span>
                                  <span className="duo-complex-subtext text-[11px] font-bold block truncate">
                                    {selectedMosqueObj?.neighborhood
                                      ? `${selectedMosqueObj.neighborhood} • نطاق التحضير ${
                                          selectedMosqueObj.allowedRadiusMeters || 100
                                        } متر`
                                      : `نطاق التحضير المعتمد: ${
                                          selectedMosqueObj?.allowedRadiusMeters || 100
                                        } متر`}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="duo-complex-shift-schedule-chip text-[11px]">
                                  {isMosqueSelectOpen ? 'إغلاق الخيارات' : 'تغيير الجامع'}
                                </span>
                                <ChevronDown
                                  className={`w-4 h-4 transition-transform duration-200 ${
                                    isMosqueSelectOpen ? 'rotate-180' : ''
                                  }`}
                                  style={{ color: themeAccent }}
                                />
                              </div>
                            </button>

                            {isMosqueSelectOpen && (
                              <div className="duo-complex-select-menu space-y-2">
                                <div className="flex items-center justify-between gap-2 px-1">
                                  <span className="duo-complex-subtext text-[11px] font-black">
                                    خيارات الجوامع المسجلة في المجمع:
                                  </span>
                                  <span className="duo-complex-shift-count-badge text-[10px]">
                                    {mosques.length} جامع
                                  </span>
                                </div>

                                <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-2 pr-0.5">
                                  {mosques.map(m => {
                                    const isCurrentMosque =
                                      (shiftForm.mosqueId || mosques[0]?.id) === m.id;
                                    return (
                                      <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => {
                                          setShiftForm(prev => ({ ...prev, mosqueId: m.id }));
                                          setIsAddingNewMosqueInShift(false);
                                          setNewMosqueNameInShift('');
                                          setIsMosqueSelectOpen(false);
                                        }}
                                        className={`duo-complex-teacher-select-card flex items-center justify-between gap-2.5 cursor-pointer ${
                                          isCurrentMosque ? 'is-selected' : ''
                                        }`}
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <span
                                            className={`duo-complex-checkbox ${
                                              isCurrentMosque ? 'is-checked' : ''
                                            }`}
                                          >
                                            {isCurrentMosque && (
                                              <Check className="w-4 h-4 stroke-[3]" />
                                            )}
                                          </span>
                                          <div className="min-w-0 text-right">
                                            <span
                                              className="text-xs sm:text-sm font-black block truncate"
                                              style={{ color: themeText }}
                                            >
                                              {m.name}
                                            </span>
                                            <span className="duo-complex-subtext text-[11px] font-bold block truncate">
                                              {m.neighborhood ? `${m.neighborhood} • ` : ''}
                                              نطاق {m.allowedRadiusMeters || 100} م{' '}
                                              {m.isLocationSet ? '• (موقع GPS مفعل)' : ''}
                                            </span>
                                          </div>
                                        </div>

                                        <span
                                          className={`duo-complex-duty-status text-[10px] shrink-0 ${
                                            isCurrentMosque ? 'is-assigned' : ''
                                          }`}
                                        >
                                          {isCurrentMosque ? 'الجامع المحدد' : 'اختيار'}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsMosqueSelectOpen(false);
                                    setIsAddingNewMosqueInShift(true);
                                  }}
                                  className="duo-complex-secondary-btn w-full text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <Plus className="w-4 h-4" />
                                  <span>إضافة جامع جديد غير موجود في القائمة</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    )}

                    <p className="duo-complex-subtext text-[11px] font-bold">
                      عند تحضير المعلم أو انصرافه، سيتحقق النظام من تواجده في هذا الجامع المحدد.
                    </p>
                  </div>
                ) : (
                  <div className="duo-complex-shift-location-box duo-complex-shift-location-box--remote space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 font-black">
                      <Globe className="w-4 h-4" />
                      <span>حلقة عن بعد (أونلاين) معتمدة</span>
                    </div>
                    <p className="text-[11px] leading-relaxed font-bold opacity-95">
                      يتم التحضير والانصراف مباشرة وفق التوقيت المحدد دون اشتراط موقع المسجد أو GPS.
                    </p>
                  </div>
                )}

                {/* 4. Check-in & Check-out Custom Duolingo 3D Time Triggers & Options */}
                {(
                  [
                    {
                      groupTitle: 'موعد الحضور (من - إلى):',
                      startField: 'checkInStart' as const,
                      endField: 'checkInEnd' as const,
                      startLabel: 'يبدأ الحضور من:',
                      endLabel: 'ينتهي الحضور في:',
                      presets: [
                        { label: '05:00 ص', val: '05:00' },
                        { label: '08:00 ص', val: '08:00' },
                        { label: '03:30 م', val: '15:30' },
                        { label: '04:00 م', val: '16:00' },
                        { label: '04:30 م', val: '16:30' },
                        { label: '07:00 م', val: '19:00' }
                      ]
                    },
                    {
                      groupTitle: 'موعد الانصراف (من - إلى):',
                      startField: 'checkOutStart' as const,
                      endField: 'checkOutEnd' as const,
                      startLabel: 'يبدأ الانصراف من:',
                      endLabel: 'ينتهي الانصراف في:',
                      presets: [
                        { label: '06:30 ص', val: '06:30' },
                        { label: '11:00 ص', val: '11:00' },
                        { label: '05:30 م', val: '17:30' },
                        { label: '06:00 م', val: '18:00' },
                        { label: '08:00 م', val: '20:00' },
                        { label: '09:00 م', val: '21:00' }
                      ]
                    }
                  ] as const
                ).map(timeGroup => {
                  const startParts = parse24hTimeParts(shiftForm[timeGroup.startField]);
                  const endParts = parse24hTimeParts(shiftForm[timeGroup.endField]);
                  const isGroupPickerOpen =
                    activeShiftTimeField === timeGroup.startField ||
                    activeShiftTimeField === timeGroup.endField;
                  const activeFieldKey = isGroupPickerOpen ? activeShiftTimeField : null;
                  const activeParts = activeFieldKey
                    ? parse24hTimeParts(shiftForm[activeFieldKey])
                    : null;
                  const activeFieldArabicTitle =
                    activeFieldKey === 'checkInStart'
                      ? 'بداية وقت الحضور'
                      : activeFieldKey === 'checkInEnd'
                      ? 'نهاية وقت الحضور'
                      : activeFieldKey === 'checkOutStart'
                      ? 'بداية وقت الانصراف'
                      : 'نهاية وقت الانصراف';

                  return (
                    <div key={timeGroup.groupTitle} className="space-y-2">
                      <label className="duo-complex-subtext text-xs font-black block">
                        {timeGroup.groupTitle}
                      </label>

                      <div className="grid grid-cols-2 gap-2.5">
                        {/* Start Time Trigger */}
                        <div className="duo-complex-shift-time-box space-y-1.5">
                          <span className="duo-complex-shift-time-label text-[11px] block">
                            {timeGroup.startLabel}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsMosqueSelectOpen(false);
                              setActiveShiftTimeField(prev =>
                                prev === timeGroup.startField ? null : timeGroup.startField
                              );
                            }}
                            className={`duo-complex-time-trigger flex items-center justify-between gap-2 cursor-pointer ${
                              activeShiftTimeField === timeGroup.startField ? 'is-open' : ''
                            }`}
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <Clock
                                className="w-4 h-4 shrink-0"
                                style={{ color: themeAccent }}
                              />
                              <span className="text-xs sm:text-sm font-mono font-black">
                                {startParts.formatted}
                              </span>
                            </span>
                            <ChevronDown
                              className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                                activeShiftTimeField === timeGroup.startField ? 'rotate-180' : ''
                              }`}
                              style={{ color: themeAccent }}
                            />
                          </button>
                        </div>

                        {/* End Time Trigger */}
                        <div className="duo-complex-shift-time-box space-y-1.5">
                          <span className="duo-complex-shift-time-label text-[11px] block">
                            {timeGroup.endLabel}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsMosqueSelectOpen(false);
                              setActiveShiftTimeField(prev =>
                                prev === timeGroup.endField ? null : timeGroup.endField
                              );
                            }}
                            className={`duo-complex-time-trigger flex items-center justify-between gap-2 cursor-pointer ${
                              activeShiftTimeField === timeGroup.endField ? 'is-open' : ''
                            }`}
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <Clock
                                className="w-4 h-4 shrink-0"
                                style={{ color: themeAccent }}
                              />
                              <span className="text-xs sm:text-sm font-mono font-black">
                                {endParts.formatted}
                              </span>
                            </span>
                            <ChevronDown
                              className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                                activeShiftTimeField === timeGroup.endField ? 'rotate-180' : ''
                              }`}
                              style={{ color: themeAccent }}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Custom Duolingo 3D Time Options Panel ("والخيارات") */}
                      {isGroupPickerOpen && activeFieldKey && activeParts && (
                        <div className="duo-complex-time-popover space-y-3">
                          {/* Banner with active field & Done button */}
                          <div className="duo-complex-datepicker-selected-banner flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 shrink-0" style={{ color: themeAccent }} />
                              <span
                                className="text-xs font-black"
                                style={{ color: themeText }}
                              >
                                {activeFieldArabicTitle}:{' '}
                                <span style={{ color: themeAccent }} className="font-mono">
                                  {activeParts.formatted}
                                </span>
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setActiveShiftTimeField(null)}
                              className="duo-complex-assign-btn text-[11px] py-1 px-3 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                              <span>تم</span>
                            </button>
                          </div>

                          {/* Quick Time Presets */}
                          <div className="space-y-1.5">
                            <span className="duo-complex-subtext text-[11px] font-black block">
                              أوقات جاهزة سريعة:
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {timeGroup.presets.map(preset => (
                                <button
                                  key={preset.val}
                                  type="button"
                                  onClick={() =>
                                    setShiftForm(prev => ({
                                      ...prev,
                                      [activeFieldKey]: preset.val
                                    }))
                                  }
                                  className={`duo-complex-today-btn text-[11px] font-mono cursor-pointer ${
                                    shiftForm[activeFieldKey] === preset.val ? 'is-active' : ''
                                  }`}
                                >
                                  {preset.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* AM / PM 3D Toggle */}
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const updated = build24hTimeFromParts(
                                  activeParts.hour12,
                                  activeParts.minute,
                                  false
                                );
                                setShiftForm(prev => ({ ...prev, [activeFieldKey]: updated }));
                              }}
                              className={
                                !activeParts.isPM
                                  ? 'duo-complex-assign-btn text-xs flex items-center justify-center gap-1.5 cursor-pointer py-2'
                                  : 'duo-complex-secondary-btn text-xs flex items-center justify-center gap-1.5 cursor-pointer py-2'
                              }
                            >
                              <span>صباحاً (ص)</span>
                              {!activeParts.isPM && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const updated = build24hTimeFromParts(
                                  activeParts.hour12,
                                  activeParts.minute,
                                  true
                                );
                                setShiftForm(prev => ({ ...prev, [activeFieldKey]: updated }));
                              }}
                              className={
                                activeParts.isPM
                                  ? 'duo-complex-assign-btn text-xs flex items-center justify-center gap-1.5 cursor-pointer py-2'
                                  : 'duo-complex-secondary-btn text-xs flex items-center justify-center gap-1.5 cursor-pointer py-2'
                              }
                            >
                              <span>مساءً (م)</span>
                              {activeParts.isPM && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </button>
                          </div>

                          {/* Hours 1..12 3D Grid */}
                          <div className="space-y-1.5">
                            <span className="duo-complex-subtext text-[11px] font-black block">
                              اختر الساعة:
                            </span>
                            <div className="grid grid-cols-6 gap-1.5">
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(hr => {
                                const isSelectedHr = activeParts.hour12 === hr;
                                return (
                                  <button
                                    key={hr}
                                    type="button"
                                    onClick={() => {
                                      const updated = build24hTimeFromParts(
                                        hr,
                                        activeParts.minute,
                                        activeParts.isPM
                                      );
                                      setShiftForm(prev => ({
                                        ...prev,
                                        [activeFieldKey]: updated
                                      }));
                                    }}
                                    className={`duo-complex-day-btn font-mono cursor-pointer ${
                                      isSelectedHr ? 'is-selected' : ''
                                    }`}
                                  >
                                    {hr.toString().padStart(2, '0')}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Minutes 00..55 3D Grid */}
                          <div className="space-y-1.5">
                            <span className="duo-complex-subtext text-[11px] font-black block">
                              اختر الدقائق:
                            </span>
                            <div className="grid grid-cols-6 gap-1.5">
                              {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(minVal => {
                                const isSelectedMin = activeParts.minute === minVal;
                                return (
                                  <button
                                    key={minVal}
                                    type="button"
                                    onClick={() => {
                                      const updated = build24hTimeFromParts(
                                        activeParts.hour12,
                                        minVal,
                                        activeParts.isPM
                                      );
                                      setShiftForm(prev => ({
                                        ...prev,
                                        [activeFieldKey]: updated
                                      }));
                                    }}
                                    className={`duo-complex-day-btn font-mono cursor-pointer ${
                                      isSelectedMin ? 'is-selected' : ''
                                    }`}
                                  >
                                    :{minVal.toString().padStart(2, '0')}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* 5. Assign Teachers 3D Search Dock + Bulk Toolbar + 3D Cards */}
                <div className="space-y-2.5 pt-1">
                  <label className="duo-complex-subtext text-xs font-black block">
                    المعلمون المناوبون في هذه الفترة:
                  </label>

                  {/* 3D Search Dock */}
                  <div className="duo-complex-search-dock">
                    <span className="duo-complex-search-icon-badge">
                      <Search className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      value={shiftModalTeacherSearch}
                      onChange={e => setShiftModalTeacherSearch(e.target.value)}
                      placeholder="بحث عن اسم المعلم..."
                      className="duo-complex-search-field text-xs sm:text-sm"
                    />
                    {shiftModalTeacherSearch.trim() !== '' && (
                      <button
                        type="button"
                        onClick={() => setShiftModalTeacherSearch('')}
                        className="duo-complex-mini-edit-btn text-[11px] flex items-center gap-1 cursor-pointer shrink-0"
                        title="مسح البحث"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>مسح</span>
                      </button>
                    )}
                  </div>

                  {/* 3D Selection Counter & Bulk Buttons */}
                  <div className="duo-complex-selection-toolbar flex items-center justify-between gap-2 flex-wrap text-xs">
                    <span className="duo-complex-shift-count-badge text-xs">
                      المحدد: {shiftForm.assignedTeacherIds.length} من أصل {teachers.length} معلم
                    </span>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          setShiftForm(prev => ({
                            ...prev,
                            assignedTeacherIds: teachers.map(t => t.id)
                          }))
                        }
                        className="duo-complex-bulk-select-btn text-[11px] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>تحديد جميع المعلمين</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setShiftForm(prev => ({ ...prev, assignedTeacherIds: [] }))
                        }
                        className="duo-complex-bulk-clear-btn text-[11px] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>إلغاء التحديد</span>
                      </button>
                    </div>
                  </div>

                  <div className="duo-complex-teachers-list-box max-h-56 overflow-y-auto custom-scrollbar space-y-2.5">
                    {teachers.length === 0 ? (
                      <div className="duo-complex-empty-box p-5 text-center text-xs font-extrabold">
                        لا يوجد معلمون مسجلون في هذا المجمع بعد.
                      </div>
                    ) : (
                      (() => {
                        const filteredModalTeachers = teachers.filter(
                          t =>
                            !shiftModalTeacherSearch.trim() ||
                            t.name
                              .toLowerCase()
                              .includes(shiftModalTeacherSearch.toLowerCase()) ||
                            t.username
                              .toLowerCase()
                              .includes(shiftModalTeacherSearch.toLowerCase())
                        );

                        if (filteredModalTeachers.length === 0) {
                          return (
                            <div className="duo-complex-empty-box p-5 text-center text-xs font-extrabold">
                              لا يوجد معلم مطابق لعبارة البحث «{shiftModalTeacherSearch}».
                            </div>
                          );
                        }

                        return filteredModalTeachers.map(t => {
                          const isChecked = shiftForm.assignedTeacherIds.includes(t.id);
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                if (isChecked) {
                                  setShiftForm(prev => ({
                                    ...prev,
                                    assignedTeacherIds: prev.assignedTeacherIds.filter(
                                      id => id !== t.id
                                    )
                                  }));
                                } else {
                                  setShiftForm(prev => ({
                                    ...prev,
                                    assignedTeacherIds: [...prev.assignedTeacherIds, t.id]
                                  }));
                                }
                              }}
                              className={`duo-complex-teacher-select-card flex items-center justify-between gap-3 cursor-pointer ${
                                isChecked ? 'is-selected' : ''
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span
                                  className={`duo-complex-checkbox ${
                                    isChecked ? 'is-checked' : ''
                                  }`}
                                >
                                  {isChecked && <Check className="w-4 h-4 stroke-[3]" />}
                                </span>
                                <div className="min-w-0 text-right">
                                  <span
                                    className="text-xs sm:text-sm font-black block truncate"
                                    style={{ color: themeText }}
                                  >
                                    {t.name}
                                  </span>
                                  <span className="duo-complex-subtext text-[11px] font-bold block truncate mt-0.5">
                                    اسم المستخدم: {t.username}{' '}
                                    {t.role === 'supervisor' ? '• (معلم مشرف)' : ''}
                                  </span>
                                </div>
                              </div>

                              <span
                                className={`duo-complex-duty-status text-[10px] shrink-0 ${
                                  isChecked ? 'is-assigned' : ''
                                }`}
                              >
                                {isChecked ? 'مكلف بالمناوبة' : 'غير مكلف'}
                              </span>
                            </button>
                          );
                        });
                      })()
                    )}
                  </div>
                </div>
              </div>

              {/* Pinned 3D Footer */}
              <div className="duo-complex-modal-footer flex items-center justify-end gap-2.5 flex-wrap shrink-0">
                <button
                  type="button"
                  onClick={() => setIsShiftModalOpen(false)}
                  className="duo-complex-secondary-btn text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={!shiftForm.name.trim()}
                  onClick={handleSaveShift}
                  className="duo-complex-assign-btn text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>حفظ الفترة وتأكيد الإعدادات</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ===================================================================== */}
      {/* MODAL 3: SUPERVISOR MANUAL RECORD ACTION (تحضير / انصراف / عذر / غياب) */}
      {/* ===================================================================== */}
      {typeof document !== 'undefined' &&
        actionTeacherModal &&
        createPortal(
          <div
            dir="rtl"
            onClick={() => setActionTeacherModal(null)}
            style={{ zIndex: 2147483000 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
          >
            <div
              onClick={e => e.stopPropagation()}
              className="duo-complex-modal-shell w-full max-w-md max-h-[92vh] flex flex-col p-5 sm:p-6 space-y-4 text-right"
            >
              <div className="duo-complex-modal-header flex items-start justify-between gap-3 shrink-0">
                <div>
                  <h3
                    className="text-base font-black font-heading"
                    style={{ color: themeText }}
                  >
                    {actionTeacherModal.actionType === 'check_in' && 'تسجيل حضور يدوي (في الوقت)'}
                    {actionTeacherModal.actionType === 'late' && 'تسجيل حضور متأخر'}
                    {actionTeacherModal.actionType === 'check_out' && 'تسجيل انصراف يدوي'}
                    {actionTeacherModal.actionType === 'excuse' && 'تسجيل عذر للمعلم'}
                    {actionTeacherModal.actionType === 'absent' && 'تسجيل غياب للمعلم'}
                  </h3>
                  <p className="duo-complex-subtext text-xs font-black mt-1">
                    المعلم: {actionTeacherModal.teacher.name} • {actionTeacherModal.shift.name}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActionTeacherModal(null)}
                  className="duo-complex-modal-close-btn cursor-pointer"
                  title="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 min-h-0 pr-0.5 py-0.5">
                {(actionTeacherModal.actionType === 'check_in' ||
                  actionTeacherModal.actionType === 'late' ||
                  actionTeacherModal.actionType === 'check_out') && (
                  <div className="space-y-2">
                    <label className="duo-complex-subtext text-xs font-black block">
                      الوقت المسجل:
                    </label>
                    <div className="duo-complex-search-dock">
                      <span className="duo-complex-search-icon-badge">
                        <Clock className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        value={customTime}
                        onChange={e => setCustomTime(e.target.value)}
                        placeholder="مثال: 03:45 م"
                        className="duo-complex-search-field text-xs font-mono"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[
                        { label: 'الآن', val: formatCurrentArabicTime() },
                        { label: '03:30 م', val: '03:30 م' },
                        { label: '04:00 م', val: '04:00 م' },
                        { label: '05:30 م', val: '05:30 م' },
                        { label: '06:00 م', val: '06:00 م' }
                      ].map(opt => (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => setCustomTime(opt.val)}
                          className={`duo-complex-today-btn text-[11px] font-mono cursor-pointer ${
                            customTime.trim() === opt.val ? 'is-active' : ''
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="duo-complex-subtext text-xs font-black block">
                    ملاحظة المشرف / سبب العذر:
                  </label>
                  <textarea
                    rows={2}
                    value={actionNote}
                    onChange={e => setActionNote(e.target.value)}
                    placeholder="اكتب ملاحظة أو سبب العذر إن وجد..."
                    className="duo-complex-input w-full py-2.5 px-3.5 rounded-xl text-xs font-bold outline-none resize-none"
                  />
                </div>
              </div>

              <div className="duo-complex-modal-footer flex items-center justify-end gap-2.5 flex-wrap shrink-0">
                <button
                  type="button"
                  onClick={() => setActionTeacherModal(null)}
                  className="duo-complex-secondary-btn text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleApplySupervisorAction}
                  className="duo-complex-assign-btn text-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تأكيد وحفظ</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ===================================================================== */}
      {/* MODAL 4: QUICK ASSIGN TEACHERS TO SHIFT (تعيين المعلمين في الفترة)     */}
      {/* ===================================================================== */}
      {typeof document !== 'undefined' &&
        assignTeachersModalShift &&
        createPortal(
          <div
            dir="rtl"
            onClick={() => setAssignTeachersModalShift(null)}
            style={{ zIndex: 2147483000 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5"
          >
            <div
              onClick={e => e.stopPropagation()}
              className="duo-complex-modal-shell w-full max-w-lg max-h-[92vh] flex flex-col p-5 sm:p-6 space-y-4 text-right"
            >
              {/* Modal 3D Header & Close Button */}
              <div className="duo-complex-modal-header flex items-start justify-between gap-3 shrink-0">
                <div className="flex items-start gap-3">
                  <div className="duo-complex-header-icon w-12 h-12 flex items-center justify-center font-black text-xl shrink-0">
                    <UserCheck className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3
                      className="text-base sm:text-lg font-black font-heading leading-snug"
                      style={{ color: themeText }}
                    >
                      تعيين وتكليف المعلمين في فترة ({assignTeachersModalShift.name})
                    </h3>
                    <p className="duo-complex-subtext text-xs font-bold leading-relaxed">
                      المجمع: {activeComplex?.name || 'المجمع الحالي'} • اختر المعلمين المناوبين المكلفين بالحضور
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAssignTeachersModalShift(null)}
                  className="duo-complex-modal-close-btn cursor-pointer"
                  title="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Search Box (3D All Around) & Bulk Selection Toolbar */}
              <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 min-h-0 pr-0.5">
                {/* 3D Tactile Search Dock ("والبحث كذلك كلها دار ما دار") */}
                <div className="duo-complex-search-dock">
                  <span className="duo-complex-search-icon-badge">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={assignTeachersSearch}
                    onChange={e => setAssignTeachersSearch(e.target.value)}
                    placeholder="بحث عن اسم المعلم..."
                    className="duo-complex-search-field text-xs sm:text-sm"
                  />
                  {assignTeachersSearch.trim() !== '' && (
                    <button
                      type="button"
                      onClick={() => setAssignTeachersSearch('')}
                      className="duo-complex-mini-edit-btn text-[11px] flex items-center gap-1 cursor-pointer shrink-0"
                      title="مسح البحث"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>مسح</span>
                    </button>
                  )}
                </div>

                {/* 3D Selection Counter & Bulk Action Buttons */}
                <div className="duo-complex-selection-toolbar flex items-center justify-between gap-2 flex-wrap text-xs">
                  <span className="duo-complex-shift-count-badge text-xs">
                    المحدد: {selectedAssignedTeacherIds.length} من أصل {teachers.length} معلم
                  </span>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setSelectedAssignedTeacherIds(teachers.map(t => t.id))}
                      className="duo-complex-bulk-select-btn text-[11px] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>تحديد جميع المعلمين</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedAssignedTeacherIds([])}
                      className="duo-complex-bulk-clear-btn text-[11px] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>إلغاء التحديد</span>
                    </button>
                  </div>
                </div>

                {/* Teachers 3D Selection Cards List */}
                <div className="duo-complex-teachers-list-box max-h-64 overflow-y-auto custom-scrollbar space-y-2.5">
                  {teachers.length === 0 ? (
                    <div className="duo-complex-empty-box p-6 text-center text-xs font-extrabold">
                      لا يوجد معلمون مسجلون في هذا المجمع بعد.
                    </div>
                  ) : (
                    (() => {
                      const filteredTeachers = teachers.filter(
                        t =>
                          !assignTeachersSearch.trim() ||
                          t.name.toLowerCase().includes(assignTeachersSearch.toLowerCase()) ||
                          t.username.toLowerCase().includes(assignTeachersSearch.toLowerCase())
                      );

                      if (filteredTeachers.length === 0) {
                        return (
                          <div className="duo-complex-empty-box p-6 text-center text-xs font-extrabold">
                            لا يوجد معلم مطابق لعبارة البحث «{assignTeachersSearch}».
                          </div>
                        );
                      }

                      return filteredTeachers.map(t => {
                        const isSelected = selectedAssignedTeacherIds.includes(t.id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setSelectedAssignedTeacherIds(prev =>
                                  prev.filter(id => id !== t.id)
                                );
                              } else {
                                setSelectedAssignedTeacherIds(prev => [...prev, t.id]);
                              }
                            }}
                            className={`duo-complex-teacher-select-card flex items-center justify-between gap-3 cursor-pointer ${
                              isSelected ? 'is-selected' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className={`duo-complex-checkbox ${
                                  isSelected ? 'is-checked' : ''
                                }`}
                              >
                                {isSelected && <Check className="w-4 h-4 stroke-[3]" />}
                              </span>
                              <div className="min-w-0 text-right">
                                <span
                                  className="text-sm font-black block truncate"
                                  style={{ color: themeText }}
                                >
                                  {t.name}
                                </span>
                                <span className="duo-complex-subtext text-[11px] font-bold block truncate mt-0.5">
                                  اسم المستخدم: {t.username}{' '}
                                  {t.role === 'supervisor' ? '• (معلم مشرف)' : ''}
                                </span>
                              </div>
                            </div>

                            <span
                              className={`duo-complex-duty-status text-[11px] shrink-0 ${
                                isSelected ? 'is-assigned' : ''
                              }`}
                            >
                              {isSelected ? 'مكلف بالمناوبة' : 'غير مكلف'}
                            </span>
                          </button>
                        );
                      });
                    })()
                  )}
                </div>
              </div>

              {/* Modal 3D Footer */}
              <div className="duo-complex-modal-footer flex items-center justify-end gap-2.5 flex-wrap shrink-0">
                <button
                  type="button"
                  onClick={() => setAssignTeachersModalShift(null)}
                  className="duo-complex-secondary-btn text-xs cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSaveAssignedTeachers}
                  className="duo-complex-assign-btn text-xs inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>حفظ التعيين وتأكيد المناوبة</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ===================================================================== */}
      {/* MODAL 5: GOOGLE MAPS MOSQUE LOCATION (اطلاع / تحديد وتعديل بالخريطة)  */}
      {/* ===================================================================== */}
      {mapModalMosque && (
        <MosqueLocationMapModal
          isOpen={isMapModalOpen}
          onClose={() => {
            setIsMapModalOpen(false);
            setMapModalMosque(null);
          }}
          mosque={mapModalMosque}
          mode={mapModalMode}
          onSaveLocation={handleSaveMosqueLocationFromMap}
        />
      )}
    </div>
  );
};
