import React, { useState, useEffect } from 'react';
import {
  Radio,
  Video,
  Clock,
  Users,
  ExternalLink,
  Plus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Copy,
  Check,
  Trash2,
  Edit3,
  BookOpen
} from 'lucide-react';
import { Halaqah, HalaqahReviewLink, TeacherAccount, QuranComplex, Student } from '../../types';
import {
  darkenHex,
  lightenHex,
  getDistinctComplexReviewPalette,
  getDefaultReviewLinkTitle,
  extractMeetingUrlAndCode,
  normalizeMeetingUrl
} from '../../lib/themeUtils';

interface OnlineHalaqahsTabProps {
  halaqahs: Halaqah[];
  teachers: TeacherAccount[];
  students: Student[];
  currentUser: any;
  currentTeacher: TeacherAccount | null;
  isSupervisor: boolean;
  isDeveloper: boolean;
  activeComplex?: QuranComplex | null;
  onUpdateHalaqah: (halaqah: Halaqah) => Promise<void>;
  onRefreshData: () => void;
}

function getNextReviewLinkDefaultName(existingLinks: HalaqahReviewLink[] = []): string {
  const existingTitles = new Set(existingLinks.map(l => (l.title || '').trim()));
  let idx = existingLinks.length + 1;
  let candidate = getDefaultReviewLinkTitle(idx);
  while (existingTitles.has(candidate)) {
    idx += 1;
    candidate = getDefaultReviewLinkTitle(idx);
  }
  return candidate;
}

export const OnlineHalaqahsTab: React.FC<OnlineHalaqahsTabProps> = ({
  halaqahs = [],
  teachers = [],
  students = [],
  currentUser,
  currentTeacher,
  isSupervisor = false,
  isDeveloper = false,
  activeComplex,
  onUpdateHalaqah,
  onRefreshData
}) => {
  const [editingHalaqah, setEditingHalaqah] = useState<Halaqah | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // 'main' for primary halaqah link, or reviewLink.id for a specific review link
  const [waitingMeetTarget, setWaitingMeetTarget] = useState<'main' | string | null>(null);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  // Re-evaluate active halaqah window automatically every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const themeSecondary = activeComplex?.theme?.secondaryColor || '#1b2e35';
  const themeCard = activeComplex?.theme?.cardColor || activeComplex?.theme?.surfaceColor || '#203843';
  const themeAccent = activeComplex?.theme?.accentColor || '#ffc800';
  const themeAccentShadow = darkenHex(themeAccent, 0.28);
  const themeBorder = lightenHex(themeCard, 0.18);
  const themeBorderBottom = darkenHex(themeCard, 0.35);

  const reviewPalette = getDistinctComplexReviewPalette(
    activeComplex?.theme,
    activeComplex?.themeColor
  );

  // Filter online halaqahs based on user role and permissions
  const onlineHalaqahs = React.useMemo(() => {
    let list = halaqahs.filter(h => h.isOnline);
    if (!isDeveloper && !isSupervisor && currentTeacher) {
      list = list.filter(h =>
        h.primaryTeacherId === currentTeacher.id ||
        (h.teacherIds && h.teacherIds.includes(currentTeacher.id)) ||
        (h.primaryTeacherName && currentTeacher.name && h.primaryTeacherName.trim() === currentTeacher.name.trim()) ||
        (h.teacherName && currentTeacher.name && h.teacherName.trim() === currentTeacher.name.trim()) ||
        currentTeacher.halaqahId === h.id ||
        (Array.isArray(currentTeacher.halaqahIds) && currentTeacher.halaqahIds.includes(h.id))
      );
    }
    return list;
  }, [halaqahs, isDeveloper, isSupervisor, currentTeacher]);

  // Check if current time falls within halaqah scheduled start and end times
  const isHalaqahTimeActive = (h: Halaqah): boolean => {
    void nowTick;
    const start = h.onlineStartTime || h.startTime || '16:00';
    const end = h.onlineEndTime || h.endTime || '20:00';
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    const startMinutes = (startH || 0) * 60 + (startM || 0);
    const endMinutes = (endH || 0) * 60 + (endM || 0);

    let isTimeActive = false;
    if (startMinutes <= endMinutes) {
      isTimeActive = currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      isTimeActive = currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }

    if (h.scheduleDays && h.scheduleDays.length > 0) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const currentDay = dayNames[now.getDay()];
      const isDayActive = h.scheduleDays.some(d => {
        const norm = (d || '').toLowerCase().trim();
        return norm === currentDay || norm === String(now.getDay());
      });
      return isTimeActive && isDayActive;
    }

    return isTimeActive;
  };

  const showToast = (msg: string, isError = false) => {
    if (isError) {
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(null), 5000);
    } else {
      setErrorMessage(null);
      setSuccessMessage(msg);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  const sanitizeHalaqahForSave = (h: Halaqah): Halaqah => {
    const normalizedMain = h.meetingUri?.trim() ? normalizeMeetingUrl(h.meetingUri) : '';
    const extractedMain = extractMeetingUrlAndCode(normalizedMain);
    const cleanedReviewLinks: HalaqahReviewLink[] = (h.reviewLinks || []).map((link, idx) => {
      const cleanTitle = (link.title || '').trim() || getDefaultReviewLinkTitle(idx + 1);
      const rawUrl = (link.url || '').trim();
      const normUrl = rawUrl ? normalizeMeetingUrl(rawUrl) : '';
      const extracted = extractMeetingUrlAndCode(normUrl);
      return {
        ...link,
        id: link.id || `rev-link-${Date.now()}-${idx}`,
        title: cleanTitle,
        url: normUrl,
        meetingCode: extracted?.code || link.meetingCode || '',
        isEnabled: link.isEnabled !== false,
        createdAt: link.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });

    return {
      ...h,
      isOnline: true,
      meetingUri: normalizedMain,
      meetingCode: extractedMain?.code || h.meetingCode || '',
      reviewLinks: cleanedReviewLinks,
      updatedAt: new Date().toISOString()
    };
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHalaqah) return;
    try {
      const finalHalaqah = sanitizeHalaqahForSave(editingHalaqah);
      await onUpdateHalaqah(finalHalaqah);
      showToast('تم حفظ رابط الحلقة وروابط المراجعة ومواعيدها سحابياً بنجاح.');
      setWaitingMeetTarget(null);
      setEditingHalaqah(null);
    } catch (err: any) {
      showToast(err?.message || 'حدث خطأ أثناء حفظ التعديلات سحابياً.', true);
    }
  };

  const applyCapturedMeetUrl = async (rawUrl: string, target: 'main' | string) => {
    if (!editingHalaqah) return;
    const extracted = extractMeetingUrlAndCode(rawUrl);
    if (!extracted) {
      showToast('الرابط الملتقط غير صالح. انسخ رابط Google Meet (مثل meet.google.com/abc-defg-hij) أو الصقه في الحقل مباشرة.', true);
      return;
    }

    try {
      let updatedHalaqahObj: Halaqah;
      if (target === 'main') {
        updatedHalaqahObj = sanitizeHalaqahForSave({
          ...editingHalaqah,
          isOnline: true,
          meetingUri: extracted.url,
          meetingCode: extracted.code,
          meetingCreatedAt: new Date().toISOString(),
          meetingCreatedBy: currentUser?.email || currentTeacher?.name || 'المشرف/المعلم'
        });
      } else {
        const nextLinks = (editingHalaqah.reviewLinks || []).map(l =>
          l.id === target
            ? { ...l, url: extracted.url, meetingCode: extracted.code, updatedAt: new Date().toISOString() }
            : l
        );
        updatedHalaqahObj = sanitizeHalaqahForSave({
          ...editingHalaqah,
          reviewLinks: nextLinks
        });
      }

      setEditingHalaqah(updatedHalaqahObj);
      await onUpdateHalaqah(updatedHalaqahObj);
      setWaitingMeetTarget(null);
      showToast(`تم التقاط الرابط وحفظه سحابياً بنجاح: ${extracted.url}`);
    } catch (err: any) {
      showToast(err?.message || 'تعذر حفظ الرابط سحابياً.', true);
    }
  };

  const handleCaptureFromClipboard = async (target: 'main' | string) => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        showToast('متصفحك يتطلب اللصق اليدوي مباشرة داخل حقل الرابط أدناه (Ctrl+V أو لصق).', true);
        return;
      }
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        showToast('الحافظة فارغة حالياً. انسخ رابط الاجتماع أولاً ثم اضغط التقاط.', true);
        return;
      }
      await applyCapturedMeetUrl(text.trim(), target);
    } catch {
      showToast('يرجى لصق الرابط المنسوخ مباشرة داخل حقل الرابط المخصص له.', true);
    }
  };

  // Auto-listen for window focus to capture copied Google Meet link upon returning from meet.google.com/new
  useEffect(() => {
    if (!waitingMeetTarget || !editingHalaqah) return;

    const onFocus = async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text && (text.includes('meet.google.com/') || /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(text.trim()))) {
            await applyCapturedMeetUrl(text, waitingMeetTarget);
          }
        }
      } catch {
        // Clipboard permission handled gracefully by manual paste / capture button
      }
    };

    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [waitingMeetTarget, editingHalaqah]);

  // Add a new review link inside the Edit Modal
  const handleAddReviewLinkInModal = () => {
    if (!editingHalaqah) return;
    const currentLinks = editingHalaqah.reviewLinks || [];
    const defaultTitle = getNextReviewLinkDefaultName(currentLinks);
    const newLink: HalaqahReviewLink = {
      id: `rev-link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: defaultTitle,
      url: '',
      isEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setEditingHalaqah({
      ...editingHalaqah,
      reviewLinks: [...currentLinks, newLink]
    });
  };

  const handleUpdateReviewLinkInModal = (linkId: string, patch: Partial<HalaqahReviewLink>) => {
    if (!editingHalaqah) return;
    setEditingHalaqah({
      ...editingHalaqah,
      reviewLinks: (editingHalaqah.reviewLinks || []).map(l =>
        l.id === linkId ? { ...l, ...patch, updatedAt: new Date().toISOString() } : l
      )
    });
  };

  const handleDeleteReviewLinkInModal = (linkId: string) => {
    if (!editingHalaqah) return;
    if (waitingMeetTarget === linkId) setWaitingMeetTarget(null);
    setEditingHalaqah({
      ...editingHalaqah,
      reviewLinks: (editingHalaqah.reviewLinks || []).filter(l => l.id !== linkId)
    });
  };

  // Direct card-level toggle for enabling/disabling a specific review link immediately
  const handleQuickToggleReviewLinkOnCard = async (halaqah: Halaqah, linkId: string) => {
    const nextLinks = (halaqah.reviewLinks || []).map(l =>
      l.id === linkId ? { ...l, isEnabled: l.isEnabled === false ? true : false, updatedAt: new Date().toISOString() } : l
    );
    const targetLink = nextLinks.find(l => l.id === linkId);
    const updatedHalaqah = sanitizeHalaqahForSave({
      ...halaqah,
      reviewLinks: nextLinks
    });
    try {
      await onUpdateHalaqah(updatedHalaqah);
      showToast(
        targetLink?.isEnabled
          ? `تم تفعيل "${targetLink.title}" — سيظهر الآن للطلاب وقت الحلقة.`
          : `تم تعطيل "${targetLink?.title || 'الرابط'}" — لن يظهر هذا الرابط للطلاب.`
      );
    } catch (err: any) {
      showToast(err?.message || 'تعذر تحديث حالة الرابط سحابياً.', true);
    }
  };

  // Direct card-level delete for a specific review link
  const handleQuickDeleteReviewLinkOnCard = async (halaqah: Halaqah, linkId: string) => {
    const removed = (halaqah.reviewLinks || []).find(l => l.id === linkId);
    const nextLinks = (halaqah.reviewLinks || []).filter(l => l.id !== linkId);
    const updatedHalaqah = sanitizeHalaqahForSave({
      ...halaqah,
      reviewLinks: nextLinks
    });
    try {
      await onUpdateHalaqah(updatedHalaqah);
      showToast(`تم حذف "${removed?.title || 'رابط المراجعة'}" سحابياً بنجاح.`);
    } catch (err: any) {
      showToast(err?.message || 'تعذر حذف الرابط سحابياً.', true);
    }
  };

  // Open Edit Modal and optionally append a fresh review link immediately
  const openEditWithOptionalNewReviewLink = (h: Halaqah, appendNewReviewLink = false) => {
    setWaitingMeetTarget(null);
    if (!appendNewReviewLink) {
      setEditingHalaqah({
        ...h,
        reviewLinks: [...(h.reviewLinks || [])]
      });
      return;
    }
    const existing = h.reviewLinks || [];
    const newLink: HalaqahReviewLink = {
      id: `rev-link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: getNextReviewLinkDefaultName(existing),
      url: '',
      isEnabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setEditingHalaqah({
      ...h,
      reviewLinks: [...existing, newLink]
    });
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header Banner */}
      <div
        className="p-6 rounded-3xl border-2 border-b-4 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
        style={{
          backgroundColor: themeCard,
          borderColor: themeBorder,
          borderBottomColor: themeBorderBottom
        }}
      >
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2.5">
            <span
              className="p-2 rounded-2xl border-2 border-b-4"
              style={{
                backgroundColor: `${themeAccent}25`,
                color: themeAccent,
                borderColor: `${themeAccent}60`,
                borderBottomColor: themeAccentShadow
              }}
            >
              <Radio className="w-6 h-6" />
            </span>
            <h2 className="text-xl sm:text-2xl font-black font-heading text-white">
              إدارة الحلقات القرآنية الأونلاين وروابط المراجعة
            </h2>
          </div>
          <p className="text-xs sm:text-sm font-bold text-slate-300">
            إدارة رابط الحلقة الأساسي وإضافة روابط مراجعة متعددة مع التحكم الكامل بتسميتها وتفعيلها أو تعطيلها أو حذفها في أي وقت.
          </p>
        </div>

        <div className="flex items-center gap-3 relative z-10">
          <button
            onClick={() => onRefreshData()}
            className="px-4 py-2.5 rounded-2xl border-2 border-b-4 font-black text-xs transition-all cursor-pointer flex items-center gap-2 hover:brightness-110 active:translate-y-[2px]"
            style={{
              backgroundColor: themeSecondary,
              borderColor: themeBorder,
              borderBottomColor: themeBorderBottom,
              color: themeAccent
            }}
          >
            <RefreshCw className="w-4 h-4" />
            <span>تحديث البيانات</span>
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500 text-emerald-300 font-bold text-xs flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-500/20 border-2 border-red-500 text-red-300 font-bold text-xs flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Online Halaqahs Grid */}
      {onlineHalaqahs.length === 0 ? (
        <div
          className="p-12 rounded-3xl border-2 border-b-4 text-center space-y-4"
          style={{
            backgroundColor: themeCard,
            borderColor: themeBorder,
            borderBottomColor: themeBorderBottom
          }}
        >
          <Video className="w-12 h-12 mx-auto text-slate-400 opacity-60" />
          <h3 className="text-lg font-black text-white">لا توجد حلقات أونلاين مسجلة حالياً</h3>
          <p className="text-xs text-slate-300 font-bold max-w-md mx-auto">
            {isSupervisor || isDeveloper
              ? 'يمكنك ضبط أي حلقة وتعيينها كحلقة أونلاين وإدخال رابط الاجتماع وروابط المراجعة وحفظها سحابياً.'
              : 'لم يتم تعيينك في أي حلقة أونلاين حتى الآن. يرجى مراجعة المشرف العام.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {onlineHalaqahs.map(h => {
            const assignedTeacher = teachers.find(
              t => t.id === h.primaryTeacherId || (h.teacherIds && h.teacherIds.includes(t.id))
            );
            const halaqahStudents = students.filter(
              s => s.halaqahId === h.id || (s.halaqahName && h.name && s.halaqahName.trim() === h.name.trim())
            );
            const isAssignedTeacher = Boolean(
              currentTeacher && (
                h.primaryTeacherId === currentTeacher.id ||
                (h.teacherIds && h.teacherIds.includes(currentTeacher.id)) ||
                (h.primaryTeacherName && currentTeacher.name && h.primaryTeacherName.trim() === currentTeacher.name.trim()) ||
                (h.teacherName && currentTeacher.name && h.teacherName.trim() === currentTeacher.name.trim()) ||
                currentTeacher.halaqahId === h.id ||
                (Array.isArray(currentTeacher.halaqahIds) && currentTeacher.halaqahIds.includes(h.id))
              )
            );
            const canManageHalaqah = isSupervisor || isDeveloper || isAssignedTeacher;
            const isActiveTime = isHalaqahTimeActive(h);
            const reviewLinks = h.reviewLinks || [];
            const mainMeetingHref = normalizeMeetingUrl(h.meetingUri);

            return (
              <div
                key={h.id}
                className={`p-6 rounded-3xl border-2 border-b-4 shadow-xl space-y-4 relative overflow-hidden flex flex-col justify-between transition-all ${
                  isActiveTime ? 'opacity-100' : 'opacity-85'
                }`}
                style={{
                  backgroundColor: themeCard,
                  borderColor: isActiveTime ? themeAccent : themeBorder,
                  borderBottomColor: isActiveTime ? themeAccentShadow : themeBorderBottom
                }}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[11px] text-sky-300 font-bold block mb-0.5">
                        حلقة عن بُعد (Online)
                      </span>
                      <h3 className="text-lg font-black text-white font-heading">{h.name}</h3>
                    </div>
                    {isActiveTime ? (
                      <span className="text-xs font-black text-emerald-300 shrink-0">
                        نشطة الآن (في موعدها)
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-slate-400 shrink-0">
                        خارج وقت الحلقة
                      </span>
                    )}
                  </div>

                  {h.description && (
                    <p className="text-xs text-slate-300 font-bold line-clamp-2">{h.description}</p>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-1 text-xs font-bold text-slate-300">
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-black/20 border border-white/5">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>{h.onlineStartTime || h.startTime || '16:00'} - {h.onlineEndTime || h.endTime || '20:00'}</span>
                    </div>
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-black/20 border border-white/5">
                      <Users className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>{halaqahStudents.length} طالب مسجل</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                    <span className="text-slate-400">المعلم المحفظ:</span>
                    <strong className="text-white">
                      {assignedTeacher?.name || h.primaryTeacherName || h.teacherName || 'غير محدد'}
                    </strong>
                  </div>
                </div>

                {/* Main Link + Stacked Review Links & Actions */}
                <div className="pt-4 border-t border-white/10 space-y-4">
                  {/* 1. Primary Halaqah Link */}
                  {(h as any).isGeneratingMeeting ? (
                    <div className="p-3 rounded-2xl bg-amber-500/20 border-2 border-amber-400/80 text-amber-300 text-xs font-bold text-center space-y-1">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                        <span>جارٍ إنشاء رابط الاجتماع التلقائي...</span>
                      </div>
                    </div>
                  ) : mainMeetingHref ? (
                    <div className="space-y-2">
                      {isActiveTime ? (
                        <a
                          href={mainMeetingHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-3.5 px-4 rounded-2xl font-black text-xs text-center flex items-center justify-center gap-2 shadow-lg transition-all hover:brightness-110 active:translate-y-[2px] cursor-pointer"
                          style={{
                            backgroundColor: reviewPalette.mainBtnBg,
                            color: reviewPalette.mainBtnText,
                            border: `2px solid ${reviewPalette.mainBtnBorder}`,
                            borderBottom: `5px solid ${reviewPalette.mainBtnShadow}`
                          }}
                        >
                          <Video className="w-4 h-4 shrink-0" />
                          <span>الانضمام إلى رابط الحلقة الأساسي الآن</span>
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="w-full py-3 px-4 rounded-2xl font-bold text-xs text-center flex items-center justify-center gap-2 bg-slate-900/90 border-2 border-slate-800 border-b-4 text-slate-400 opacity-60 cursor-not-allowed"
                          title="زر الدخول للطلاب يفتح تلقائياً في وقت الحلقة المجدول"
                        >
                          <Video className="w-4 h-4 opacity-50 shrink-0" />
                          <span>رابط الحلقة الأساسي (يفتح وقت الحلقة)</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold text-center">
                      لم يتم إدخال رابط الاجتماع الأساسي لهذه الحلقة بعد.
                    </div>
                  )}

                  {/* 2. Review Links Section (روابط المراجعة - Duolingo 3D Tactile Theme in Distinct Complex Color) */}
                  {reviewLinks.length > 0 && (
                    <div
                      className="p-4 rounded-2xl border-2 border-b-4 space-y-3"
                      style={{
                        backgroundColor: reviewPalette.reviewBoxBg,
                        borderColor: reviewPalette.reviewBoxBorder,
                        borderBottomColor: reviewPalette.reviewBoxBottomBorder
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 shrink-0" style={{ color: reviewPalette.reviewBtnBg }} />
                          <span className="text-xs font-black text-white">
                            روابط المراجعة ({reviewLinks.filter(l => l.isEnabled !== false).length} مفعل من {reviewLinks.length})
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-300">
                          تظهر للطلاب المفعّلة فقط
                        </span>
                      </div>

                      <div className="flex flex-col gap-2.5">
                        {reviewLinks.map((link, idx) => {
                          const displayTitle = (link.title || '').trim() || getDefaultReviewLinkTitle(idx + 1);
                          const isLinkEnabled = link.isEnabled !== false;
                          const linkHref = normalizeMeetingUrl(link.url);

                          return (
                            <div
                              key={link.id || idx}
                              className={`p-2.5 rounded-2xl border transition-all space-y-2 ${
                                isLinkEnabled
                                  ? 'bg-black/25 border-white/10'
                                  : 'bg-black/40 border-slate-700/60 opacity-75'
                              }`}
                            >
                              {/* Top bar for Teacher/Supervisor: Checkbox toggle (مفعل / غير مفعل) + Quick Edit / Delete */}
                              {canManageHalaqah && (
                                <div className="flex items-center justify-between gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleQuickToggleReviewLinkOnCard(h, link.id)}
                                    className="flex items-center gap-2 text-xs font-black cursor-pointer select-none group"
                                    title={isLinkEnabled ? 'اضغط لتعطيل الرابط وإخفائه عن الطلاب' : 'اضغط لتفعيل الرابط وإظهاره للطلاب'}
                                  >
                                    <span
                                      className={`w-5 h-5 rounded-lg flex items-center justify-center border-2 border-b-[3px] transition-all ${
                                        isLinkEnabled
                                          ? 'bg-[#58cc02] border-[#58cc02] border-b-[#46a302] text-white'
                                          : 'bg-slate-800 border-slate-600 border-b-slate-900 text-transparent'
                                      }`}
                                    >
                                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                                    </span>
                                    <span className={isLinkEnabled ? 'text-[#58cc02]' : 'text-slate-400'}>
                                      {isLinkEnabled ? 'مفعل' : 'غير مفعل'}
                                    </span>
                                    {!isLinkEnabled && (
                                      <span className="text-[10px] font-bold text-amber-300/90">
                                        · مخفي عن الطلاب
                                      </span>
                                    )}
                                  </button>

                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => openEditWithOptionalNewReviewLink(h, false)}
                                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition cursor-pointer"
                                      title="تعديل اسم أو عنوان الرابط"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleQuickDeleteReviewLinkOnCard(h, link.id)}
                                      className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 hover:text-red-300 transition cursor-pointer"
                                      title="حذف رابط المراجعة نهائياً"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Stacked Duolingo 3D Button for each Review Link */}
                              {linkHref ? (
                                isActiveTime && isLinkEnabled ? (
                                  <a
                                    href={linkHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-3 px-4 rounded-2xl font-black text-xs text-center flex items-center justify-between gap-2 shadow-md transition-all hover:brightness-110 active:translate-y-[2px] cursor-pointer"
                                    style={{
                                      backgroundColor: reviewPalette.reviewBtnBg,
                                      color: reviewPalette.reviewBtnText,
                                      border: `2px solid ${reviewPalette.reviewBtnBorder}`,
                                      borderBottom: `5px solid ${reviewPalette.reviewBtnShadow}`
                                    }}
                                  >
                                    <span className="flex items-center gap-2 truncate">
                                      <Video className="w-4 h-4 shrink-0" />
                                      <span className="truncate">{displayTitle}</span>
                                    </span>
                                    <span className="flex items-center gap-1 text-[11px] shrink-0">
                                      <span>دخول المراجعة</span>
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </span>
                                  </a>
                                ) : (
                                  <a
                                    href={linkHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-2.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-between gap-2 bg-slate-900/80 border-2 border-slate-700 border-b-4 text-slate-300 hover:text-white transition-all cursor-pointer"
                                    title="معاينة رابط المراجعة للمعلم/المشرف"
                                  >
                                    <span className="flex items-center gap-2 truncate">
                                      <Video className="w-4 h-4 opacity-70 shrink-0" />
                                      <span className="truncate">{displayTitle}</span>
                                    </span>
                                    <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-1">
                                      <span>{!isLinkEnabled ? 'معطل للطلاب · معاينة' : 'معاينة الرابط'}</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </span>
                                  </a>
                                )
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => openEditWithOptionalNewReviewLink(h, false)}
                                  className="w-full py-2.5 px-4 rounded-2xl border-2 border-dashed border-amber-400/50 text-amber-300 text-xs font-bold text-center hover:bg-amber-400/10 cursor-pointer"
                                >
                                  {displayTitle} — اضغط لإدخال رابط Google Meet أو رابط المراجعة
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Management Footer Actions */}
                  {canManageHalaqah && (
                    <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => openEditWithOptionalNewReviewLink(h, true)}
                        className="px-3.5 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 cursor-pointer transition-all hover:brightness-110 active:translate-y-[2px]"
                        style={{
                          backgroundColor: reviewPalette.reviewBtnBg,
                          color: reviewPalette.reviewBtnText,
                          border: `2px solid ${reviewPalette.reviewBtnBorder}`,
                          borderBottom: `4px solid ${reviewPalette.reviewBtnShadow}`
                        }}
                      >
                        <Plus className="w-4 h-4" />
                        <span>إضافة رابط مراجعة</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditWithOptionalNewReviewLink(h, false)}
                        className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-black text-amber-300 cursor-pointer flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{h.meetingUri ? 'تعديل الروابط والمواعيد' : 'إدخال الروابط والمواعيد'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Halaqah & Review Links Modal */}
      {editingHalaqah && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
          <div
            className="w-full max-w-2xl p-6 rounded-3xl border-2 border-b-4 shadow-2xl space-y-5 relative max-h-[92vh] overflow-y-auto"
            style={{
              backgroundColor: themeSecondary,
              borderColor: themeBorder,
              borderBottomColor: themeBorderBottom
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="text-lg font-black text-white font-heading">
                  تعديل رابط الحلقة الأونلاين وروابط المراجعة
                </h3>
                <p className="text-xs text-slate-300 font-bold mt-0.5">
                  يمكنك ضبط رابط الحلقة الأساسي وإضافة روابط مراجعة بعدد غير محدود مع تفعيل أو تعطيل أي رابط.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setWaitingMeetTarget(null);
                  setEditingHalaqah(null);
                }}
                className="p-2 rounded-xl bg-white/10 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-5">
              {/* Halaqah Name & Schedule */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-black text-slate-300 mb-1">اسم الحلقة</label>
                  <input
                    type="text"
                    value={editingHalaqah.name}
                    onChange={e => setEditingHalaqah({ ...editingHalaqah, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/30 border border-white/20 text-white text-xs font-bold focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-300 mb-1">وقت البداية</label>
                  <input
                    type="time"
                    value={editingHalaqah.onlineStartTime || editingHalaqah.startTime || '16:00'}
                    onChange={e => setEditingHalaqah({ ...editingHalaqah, onlineStartTime: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/30 border border-white/20 text-white text-xs font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-300 mb-1">وقت النهاية</label>
                  <input
                    type="time"
                    value={editingHalaqah.onlineEndTime || editingHalaqah.endTime || '20:00'}
                    onChange={e => setEditingHalaqah({ ...editingHalaqah, onlineEndTime: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/30 border border-white/20 text-white text-xs font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* 1. Primary Meeting Link Section */}
              <div className="p-4 rounded-2xl bg-black/25 border border-white/15 space-y-3">
                <label className="block text-xs font-black text-amber-300">
                  رابط الحلقة الأساسي (Google Meet أو رابط مخصص)
                </label>

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={editingHalaqah.meetingUri || ''}
                    onChange={e => setEditingHalaqah({ ...editingHalaqah, meetingUri: e.target.value })}
                    placeholder="https://meet.google.com/abc-defg-hij"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-black/40 border border-white/20 text-white text-xs font-bold focus:outline-none focus:border-amber-400 ltr text-left"
                  />

                  <a
                    href="https://meet.google.com/new"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      setWaitingMeetTarget('main');
                      showToast('تم فتح Google Meet لإنشاء اجتماع الحلقة الأساسي — انسخ الرابط وسنلتقطه تلقائياً عند عودتك.');
                    }}
                    className="px-4 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-2 shrink-0 cursor-pointer transition-all hover:brightness-110 active:translate-y-[2px]"
                    style={{
                      backgroundColor: reviewPalette.mainBtnBg,
                      color: reviewPalette.mainBtnText,
                      border: `2px solid ${reviewPalette.mainBtnBorder}`,
                      borderBottom: `4px solid ${reviewPalette.mainBtnShadow}`
                    }}
                  >
                    <Video className="w-4 h-4" />
                    <span>إنشاء في Google Meet</span>
                  </a>
                </div>

                {waitingMeetTarget === 'main' && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/15 border-2 border-amber-400 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-300 font-black text-xs">
                        <RefreshCw className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
                        <span>بانتظار نسخ رابط Google Meet للحلقة الأساسية...</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setWaitingMeetTarget(null)}
                        className="text-[10px] text-slate-300 hover:text-white px-2 py-0.5 rounded bg-black/40 cursor-pointer"
                      >
                        إلغاء الانتظار
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCaptureFromClipboard('main')}
                        className="px-3.5 py-2 rounded-xl bg-[#58cc02] border-2 border-[#58cc02] border-b-4 border-b-[#46a302] text-white font-black text-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>التقاط الرابط من الحافظة وحفظه الآن</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                  <button
                    type="button"
                    onClick={() => handleCaptureFromClipboard('main')}
                    className="text-amber-300 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>التقاط من الحافظة</span>
                  </button>

                  {editingHalaqah.meetingUri && (
                    <div className="flex items-center gap-3">
                      <a
                        href={normalizeMeetingUrl(editingHalaqah.meetingUri)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:underline flex items-center gap-1 font-black"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>اختبار الرابط</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard?.writeText(normalizeMeetingUrl(editingHalaqah.meetingUri)).catch(() => {});
                          showToast('تم نسخ رابط الحلقة الأساسي للحافظة.');
                        }}
                        className="text-amber-300 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>نسخ</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingHalaqah({ ...editingHalaqah, meetingUri: '', meetingCode: '' })}
                        className="text-red-400 hover:underline font-bold cursor-pointer"
                      >
                        مسح
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Review Links Management Section (روابط المراجعة الإضافية) */}
              <div
                className="p-4 rounded-2xl border-2 border-b-4 space-y-4"
                style={{
                  backgroundColor: reviewPalette.reviewBoxBg,
                  borderColor: reviewPalette.reviewBoxBorder,
                  borderBottomColor: reviewPalette.reviewBoxBottomBorder
                }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center gap-2">
                      <BookOpen className="w-4 h-4" style={{ color: reviewPalette.reviewBtnBg }} />
                      <span>روابط المراجعة الإضافية ({(editingHalaqah.reviewLinks || []).length})</span>
                    </h4>
                    <p className="text-[11px] text-slate-300 font-bold mt-0.5">
                      الاسم الافتراضي يتدرج تلقائياً (رابط المراجعة ١، رابط المراجعة ٢...) ويمكنك تسميته أو تعطيله في أي وقت.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddReviewLinkInModal}
                    className="px-4 py-2.5 rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-all hover:brightness-110 active:translate-y-[2px]"
                    style={{
                      backgroundColor: reviewPalette.reviewBtnBg,
                      color: reviewPalette.reviewBtnText,
                      border: `2px solid ${reviewPalette.reviewBtnBorder}`,
                      borderBottom: `4px solid ${reviewPalette.reviewBtnShadow}`
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    <span>أضف رابط مراجعة</span>
                  </button>
                </div>

                {(editingHalaqah.reviewLinks || []).length === 0 ? (
                  <div className="p-4 rounded-2xl bg-black/25 border border-dashed border-white/15 text-center text-xs text-slate-300 font-bold">
                    لا توجد روابط مراجعة مضافة بعد. اضغط «أضف رابط مراجعة» لإضافة «رابط المراجعة ١».
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(editingHalaqah.reviewLinks || []).map((link, idx) => {
                      const defaultFallbackName = getDefaultReviewLinkTitle(idx + 1);
                      const isEnabled = link.isEnabled !== false;
                      const isWaitingThis = waitingMeetTarget === link.id;

                      return (
                        <div
                          key={link.id}
                          className={`p-3.5 rounded-2xl border-2 space-y-3 transition-all ${
                            isEnabled
                              ? 'bg-black/30 border-white/15'
                              : 'bg-black/50 border-slate-700/70 opacity-80'
                          }`}
                        >
                          {/* Top Row: Enable/Disable Check + Link Name Input + Delete Button */}
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                            {/* Tactile Duolingo Check Toggle (مفعل / غير مفعل) */}
                            <button
                              type="button"
                              onClick={() => handleUpdateReviewLinkInModal(link.id, { isEnabled: !isEnabled })}
                              className={`px-3 py-2 rounded-xl border-2 border-b-4 font-black text-xs flex items-center gap-2 shrink-0 cursor-pointer transition-all active:translate-y-[2px] ${
                                isEnabled
                                  ? 'bg-[#58cc02]/20 border-[#58cc02] border-b-[#46a302] text-[#89e219]'
                                  : 'bg-slate-800/90 border-slate-600 border-b-slate-900 text-slate-400'
                              }`}
                              title={isEnabled ? 'مفعل: يظهر للطلاب وقت الحلقة (اضغط لإلغاء الصح وتعطيله)' : 'غير مفعل: لن يظهر للطلاب (اضغط لوضع الصح وتفعيله)'}
                            >
                              <span
                                className={`w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all ${
                                  isEnabled
                                    ? 'bg-[#58cc02] border-[#58cc02] text-white'
                                    : 'bg-slate-900 border-slate-500 text-transparent'
                                }`}
                              >
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </span>
                              <span>{isEnabled ? 'مفعل' : 'غير مفعل'}</span>
                            </button>

                            {/* Link Name Input */}
                            <div className="flex-1">
                              <input
                                type="text"
                                value={link.title}
                                onChange={e => handleUpdateReviewLinkInModal(link.id, { title: e.target.value })}
                                placeholder={defaultFallbackName}
                                className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/20 text-white text-xs font-black focus:outline-none focus:border-sky-400"
                              />
                            </div>

                            {/* Delete This Review Link */}
                            <button
                              type="button"
                              onClick={() => handleDeleteReviewLinkInModal(link.id)}
                              className="px-3 py-2 rounded-xl bg-[#ff4b4b]/15 hover:bg-[#ff4b4b]/25 border-2 border-[#ff4b4b]/60 border-b-4 border-b-[#ea2b2b] text-red-300 font-black text-xs flex items-center justify-center gap-1 shrink-0 cursor-pointer active:translate-y-[2px]"
                              title="حذف رابط المراجعة هذا"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>حذف</span>
                            </button>
                          </div>

                          {!isEnabled && (
                            <p className="text-[11px] font-bold text-amber-300">
                              هذا الرابط «غير مفعل» حالياً — لن يظهر للطلاب، وستظهر لهم بقية الروابط المفعّلة فقط.
                            </p>
                          )}

                          {/* URL Input + Direct Google Meet Creation (Same Settings as Main Link) */}
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              value={link.url || ''}
                              onChange={e => handleUpdateReviewLinkInModal(link.id, { url: e.target.value })}
                              placeholder="https://meet.google.com/abc-defg-hij أو أي رابط مراجعة"
                              className="flex-1 px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/20 text-white text-xs font-bold focus:outline-none focus:border-sky-400 ltr text-left"
                            />

                            <a
                              href="https://meet.google.com/new"
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => {
                                setWaitingMeetTarget(link.id);
                                showToast(`تم فتح Google Meet لإنشاء "${link.title || defaultFallbackName}" — انسخ الرابط وسنلتقطه تلقائياً.`);
                              }}
                              className="px-3.5 py-2.5 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-all hover:brightness-110 active:translate-y-[2px]"
                              style={{
                                backgroundColor: reviewPalette.reviewBtnBg,
                                color: reviewPalette.reviewBtnText,
                                border: `2px solid ${reviewPalette.reviewBtnBorder}`,
                                borderBottom: `4px solid ${reviewPalette.reviewBtnShadow}`
                              }}
                            >
                              <Video className="w-4 h-4" />
                              <span>إنشاء في Google Meet</span>
                            </a>
                          </div>

                          {/* Smart Waiting Card for This Review Link */}
                          {isWaitingThis && (
                            <div className="p-3 rounded-xl bg-sky-500/15 border-2 border-sky-400 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-sky-200 flex items-center gap-1.5">
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>بانتظار نسخ رابط Google Meet لـ «{link.title || defaultFallbackName}»...</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setWaitingMeetTarget(null)}
                                  className="text-[10px] text-slate-300 hover:text-white px-2 py-0.5 rounded bg-black/40 cursor-pointer"
                                >
                                  إلغاء
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleCaptureFromClipboard(link.id)}
                                className="px-3.5 py-1.5 rounded-xl bg-[#58cc02] border-2 border-[#58cc02] border-b-4 border-b-[#46a302] text-white font-black text-xs flex items-center gap-1.5 cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5" />
                                <span>التقاط الرابط من الحافظة وحفظه الآن</span>
                              </button>
                            </div>
                          )}

                          {/* Helper Actions for This Review Link */}
                          <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                            <button
                              type="button"
                              onClick={() => handleCaptureFromClipboard(link.id)}
                              className="text-sky-300 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span>التقاط من الحافظة</span>
                            </button>

                            {link.url && (
                              <div className="flex items-center gap-3">
                                <a
                                  href={normalizeMeetingUrl(link.url)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-400 hover:underline flex items-center gap-1 font-black"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>اختبار الرابط</span>
                                </a>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard?.writeText(normalizeMeetingUrl(link.url)).catch(() => {});
                                    showToast(`تم نسخ "${link.title || defaultFallbackName}" للحافظة.`);
                                  }}
                                  className="text-sky-300 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>نسخ</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateReviewLinkInModal(link.id, { url: '', meetingCode: '' })}
                                  className="text-red-400 hover:underline font-bold cursor-pointer"
                                >
                                  مسح الرابط
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setWaitingMeetTarget(null);
                    setEditingHalaqah(null);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-white/10 text-slate-300 font-bold text-xs hover:bg-white/20 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-2xl font-black text-xs cursor-pointer shadow-lg hover:brightness-110 active:translate-y-[2px]"
                  style={{
                    backgroundColor: reviewPalette.mainBtnBg,
                    color: reviewPalette.mainBtnText,
                    border: `2px solid ${reviewPalette.mainBtnBorder}`,
                    borderBottom: `4px solid ${reviewPalette.mainBtnShadow}`
                  }}
                >
                  حفظ الروابط والمواعيد سحابياً
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
