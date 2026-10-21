import React, { useState } from 'react';
import {
  Radio,
  Video,
  Clock,
  Calendar,
  Users,
  ExternalLink,
  Plus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Layers,
  Building2,
  ShieldAlert,
  X,
  Copy,
  Check,
  Sparkles
} from 'lucide-react';
import { Halaqah, TeacherAccount, QuranComplex, Student } from '../../types';
import { OmranDataService } from '../../lib/firebase';
import { getGoogleMeetAccessToken, createGoogleMeetSpace } from '../../lib/googleWorkspace';
import { darkenHex, lightenHex, getContrastTextColor } from '../../lib/themeUtils';

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
  const [isWaitingForDirectMeet, setIsWaitingForDirectMeet] = useState<boolean>(false);
  const [joiningHalaqah, setJoiningHalaqah] = useState<{
    halaqah: Halaqah;
    name: string;
    copied: boolean;
  } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  // Filter online halaqahs based on user role and permissions
  const onlineHalaqahs = React.useMemo(() => {
    let list = halaqahs.filter(h => h.isOnline);
    if (!isDeveloper && !isSupervisor && currentTeacher) {
      list = list.filter(h =>
        h.primaryTeacherId === currentTeacher.id ||
        (h.teacherIds && h.teacherIds.includes(currentTeacher.id)) ||
        (h.teacherName && currentTeacher.name && h.teacherName.trim() === currentTeacher.name.trim())
      );
    }
    return list;
  }, [halaqahs, isDeveloper, isSupervisor, currentTeacher]);

  // Check if current time falls within halaqah scheduled start and end times
  const isHalaqahTimeActive = (h: Halaqah): boolean => {
    const start = h.onlineStartTime || h.startTime || '00:00';
    const end = h.onlineEndTime || h.endTime || '23:59';
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    const startMinutes = (startH || 0) * 60 + (startM || 0);
    const endMinutes = (endH || 0) * 60 + (endM || 0);

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHalaqah) return;
    try {
      await onUpdateHalaqah(editingHalaqah);
      setSuccessMessage('تم حفظ تحديث رابط ومواعيد الحلقة أونلاين سحابياً بنجاح.');
      setEditingHalaqah(null);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'حدث خطأ أثناء حفظ التعديلات سحابياً.');
    }
  };

  const extractMeetUrlAndCode = (rawText: string): { url: string; code: string } | null => {
    if (!rawText) return null;
    const clean = rawText.trim();
    // Match meet.google.com/xxx-yyyy-zzz
    const meetMatch = clean.match(/(?:https?:\/\/)?meet\.google\.com\/([a-z0-9-]+)/i);
    if (meetMatch && meetMatch[1]) {
      const code = meetMatch[1].split('?')[0].trim();
      return { url: `https://meet.google.com/${code}`, code };
    }
    // Match xxx-yyyy-zzz raw code
    const codeMatch = clean.match(/^([a-z]{3}-[a-z]{4}-[a-z]{3})$/i);
    if (codeMatch && codeMatch[1]) {
      const code = codeMatch[1].trim();
      return { url: `https://meet.google.com/${code}`, code };
    }
    // Generic URL (Zoom / Teams / etc.)
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      return { url: clean, code: clean.split('/').pop()?.split('?')[0] || '' };
    }
    return null;
  };

  const applyRealMeetUrl = async (rawUrl: string) => {
    if (!editingHalaqah) return;
    const extracted = extractMeetUrlAndCode(rawUrl);
    if (!extracted) {
      setErrorMessage('الرابط الملتقط غير صالح. يرجى التأكد من نسخ رابط Google Meet الحقيقي (مثال: meet.google.com/abc-defg-hij).');
      return;
    }

    try {
      const updatedHalaqahObj: Halaqah = {
        ...editingHalaqah,
        isOnline: true,
        meetingUri: extracted.url,
        meetingCode: extracted.code,
        meetingCreatedAt: new Date().toISOString(),
        meetingCreatedBy: currentUser?.email || currentTeacher?.name || 'المشرف/المعلم',
        updatedAt: new Date().toISOString()
      };

      setEditingHalaqah(updatedHalaqahObj);
      await onUpdateHalaqah(updatedHalaqahObj);
      setIsWaitingForDirectMeet(false);
      setErrorMessage(null);
      setSuccessMessage(`✓ تم بنجاح التقاط رابط Google Meet الأصلي والحقيقي وحفظه سحابياً: ${extracted.url}`);
      setTimeout(() => setSuccessMessage(null), 6000);
    } catch (err: any) {
      console.error('Error applying real meet url:', err);
      setErrorMessage(err?.message || 'تعذر حفظ الرابط سحابياً.');
    }
  };

  const handleCaptureFromClipboard = async () => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        const manual = window.prompt('الصق رابط Google Meet المنسوخ هنا:');
        if (manual) await applyRealMeetUrl(manual);
        return;
      }
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        setErrorMessage('الحافظة فارغة حالياً. قم بنسخ رابط الاجتماع من Google Meet أولاً ثم اضغط التقاط.');
        return;
      }
      await applyRealMeetUrl(text.trim());
    } catch (e: any) {
      const manual = window.prompt('يرجى لصق رابط Google Meet المنسوخ هنا:');
      if (manual) await applyRealMeetUrl(manual);
    }
  };

  // Auto-listen for window focus to capture copied Google Meet link upon returning from meet.google.com/new
  React.useEffect(() => {
    if (!isWaitingForDirectMeet || !editingHalaqah) return;

    const onFocus = async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText();
          if (text && (text.includes('meet.google.com/') || /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(text.trim()))) {
            await applyRealMeetUrl(text);
          }
        }
      } catch (e) {
        // clipboard read may require user gesture in some browsers, covered by manual capture button
      }
    };

    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [isWaitingForDirectMeet, editingHalaqah]);

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
          <div className="flex items-center gap-2">
            <span
              className="p-2 rounded-2xl border-2 border-b-4"
              style={{
                backgroundColor: `${themeAccent}25`,
                color: themeAccent,
                borderColor: `${themeAccent}60`,
                borderBottomColor: themeAccentShadow
              }}
            >
              <Radio className="w-6 h-6 animate-pulse" />
            </span>
            <h2 className="text-xl sm:text-2xl font-black font-heading text-white">
              إدارة الحلقات القرآنية الأونلاين (رابط يدوي محفوظ سحابياً)
            </h2>
          </div>
          <p className="text-xs sm:text-sm font-bold text-slate-300">
            متابعة الحلقات المرئية عن بُعد. يقوم المشرف أو المعلم بإدخال وحفظ رابط الاجتماع يدوياً، ويظهر مفعلًا ومتوهجاً في وقت الحلقة المحدد فقط وعند الانتهاء يتم الإغلاق تلقائياً.
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
              ? 'يمكنك ضبط أي حلقة وتعيينها كحلقة أونلاين وإدخال رابط الاجتماع يدوياً وحفظه سحابياً.'
              : 'لم يتم تعيينك في أي حلقة أونلاين حتى الآن. يرجى مراجعة المشرف العام.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {onlineHalaqahs.map(h => {
            const assignedTeacher = teachers.find(t => t.id === h.primaryTeacherId || (h.teacherIds && h.teacherIds.includes(t.id)));
            const halaqahStudents = students.filter(s => s.halaqahId === h.id || (s.halaqahName && h.name && s.halaqahName.trim() === h.name.trim()));
            const isAssignedTeacher = currentTeacher && (
              h.primaryTeacherId === currentTeacher.id ||
              (h.teacherIds && h.teacherIds.includes(currentTeacher.id)) ||
              (h.teacherName && currentTeacher.name && h.teacherName.trim() === currentTeacher.name.trim())
            );
            const isActiveTime = isHalaqahTimeActive(h);

            return (
              <div
                key={h.id}
                className={`p-6 rounded-3xl border-2 border-b-4 shadow-xl space-y-4 relative overflow-hidden flex flex-col justify-between transition-all ${
                  isActiveTime ? 'opacity-100 ring-2 ring-amber-400/50' : 'opacity-70'
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
                      <span className="text-[10px] px-2.5 py-1 rounded-full font-black bg-blue-500/20 border border-blue-400 text-blue-300 inline-block mb-1">
                        حلقة عن بُعد (Online)
                      </span>
                      <h3 className="text-lg font-black text-white font-heading">{h.name}</h3>
                    </div>
                    {isActiveTime ? (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-2xl bg-emerald-500/20 border border-emerald-400 text-emerald-300 text-xs font-black shrink-0 shadow-lg animate-pulse">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                        <span>نشطة الآن (في موعدها)</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-2xl bg-slate-800/60 border border-slate-700 text-slate-400 text-xs font-bold shrink-0">
                        <span className="w-2 h-2 rounded-full bg-slate-500" />
                        <span>غير نشطة (خارج وقت الحلقة - نورها مطفي)</span>
                      </span>
                    )}
                  </div>

                  {h.description && (
                    <p className="text-xs text-slate-300 font-bold line-clamp-2">{h.description}</p>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-bold text-slate-300">
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-black/20 border border-white/5">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>{h.onlineStartTime || h.startTime || '16:00'} - {h.onlineEndTime || h.endTime || '20:00'}</span>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-black/20 border border-white/5">
                      <Users className="w-4 h-4 text-blue-400 shrink-0" />
                      <span>{halaqahStudents.length} طالب مسجل</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
                    <span className="text-slate-400">المعلم المحفظ:</span>
                    <strong className="text-white">{assignedTeacher?.name || h.primaryTeacherName || h.teacherName || 'غير محدد'}</strong>
                  </div>
                </div>

                {/* Meeting Link & Actions */}
                <div className="pt-4 border-t border-white/10 space-y-3">
                  {/* Generation Status Feedback */}
                  {(h as any).isGeneratingMeeting ? (
                    <div className="p-3 rounded-2xl bg-amber-500/20 border-2 border-amber-400/80 text-amber-300 text-xs font-bold text-center space-y-2 animate-pulse">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                        <span>جاري إنشاء رابط الاجتماع التلقائي... ⏳</span>
                      </div>
                      <p className="text-[11px] text-amber-200">يتم الآن تجهيز الرابط المعتمد سحابياً، يرجى الانتظار ثوانٍ معدودة.</p>
                    </div>
                  ) : h.meetingUri ? (
                    <div className="space-y-2">
                      <div className="p-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold text-center flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>تم إنشاء الرابط بنجاح وجاهز للاستخدام والتصديق السحابي ✓</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isActiveTime ? (
                          <button
                            type="button"
                            onClick={() => {
                              const rawName = currentUser?.name || currentTeacher?.name || currentUser?.username || 'مستخدم المنصة';
                              const rolePrefix = isDeveloper ? 'المطور' : isSupervisor ? 'المشرف' : currentTeacher ? 'المعلم' : '';
                              const suggestedName = rolePrefix ? `${rolePrefix}: ${rawName}` : rawName;

                              // Automatically copy name to clipboard immediately
                              navigator.clipboard.writeText(suggestedName).catch(() => {});

                              setJoiningHalaqah({
                                halaqah: h,
                                name: suggestedName,
                                copied: true
                              });
                            }}
                            className="flex-1 py-3 px-4 rounded-2xl font-black text-xs text-center flex items-center justify-center gap-2 shadow-lg transition-all hover:brightness-110 active:translate-y-[2px] cursor-pointer"
                            style={{
                              backgroundColor: themeAccent,
                              color: themePrimary,
                              border: `2px solid ${themeAccent}`,
                              borderBottom: `4px solid ${themeAccentShadow}`
                            }}
                          >
                            <Video className="w-4 h-4" />
                            <span>الانضمام بالاسم المعتمد في Google Meet</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            className="flex-1 py-3 px-4 rounded-2xl font-bold text-xs text-center flex items-center justify-center gap-2 bg-slate-900/90 border border-slate-800 text-slate-500 opacity-40 cursor-not-allowed"
                            title="زر الدخول لا يعمل لعدم تواجده في وقت الحلقة المجدول"
                          >
                            <Video className="w-4 h-4 opacity-30" />
                            <span>زر الدخول مغلق (خارج وقت الحلقة المجدول)</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2 text-[11px] text-slate-300 font-bold">
                          <span>اسم الدخول:</span>
                          <span className="text-amber-300 font-black">{currentUser?.name || currentTeacher?.name || 'مستخدم المنصة'}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const userName = currentUser?.name || currentTeacher?.name || 'مستخدم المنصة';
                              navigator.clipboard.writeText(userName).catch(() => {});
                              setCopiedId(h.id);
                              setSuccessMessage(`تم نسخ اسمك المعتمد ("${userName}") للحافظة.`);
                              setTimeout(() => {
                                setCopiedId(null);
                                setSuccessMessage(null);
                              }, 3000);
                            }}
                            className="p-1 px-2 rounded-lg bg-white/10 hover:bg-white/20 text-amber-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                            title="نسخ اسمك المعتمد في المنصة للحافظة"
                          >
                            {copiedId === h.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span className="text-emerald-400">تم النسخ ✓</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>نسخ الاسم</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold text-center space-y-1">
                        <p>لم يتم إدخال رابط الاجتماع لهذه الحلقة بعد.</p>
                      </div>
                    </div>
                  )}

                  {(isSupervisor || isDeveloper || isAssignedTeacher) && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-400 font-bold">
                        {h.meetingUri ? '✓ الرابط محفوظ سحابياً' : 'لم يتم إدخال رابط'}
                      </span>
                      <button
                        onClick={() => setEditingHalaqah(h)}
                        className="text-xs font-bold text-amber-300 hover:underline cursor-pointer"
                      >
                        {h.meetingUri ? 'تعديل الرابط والمواعيد' : 'إدخال رابط الاجتماع أو إنشائه تلقائياً'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Joining Halaqah Modal - Guarantees User Platform Name inside Google Meet */}
      {joiningHalaqah && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
          <div
            className="w-full max-w-lg p-6 sm:p-7 rounded-3xl border-2 border-b-4 shadow-2xl space-y-5 relative max-h-[90vh] overflow-y-auto"
            style={{
              backgroundColor: themeSecondary,
              borderColor: themeBorder,
              borderBottomColor: themeBorderBottom
            }}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-white/10">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/40">
                    <Video className="w-5 h-5" />
                  </span>
                  <h3 className="text-lg font-black text-white font-heading">
                    الانضمام إلى Google Meet بالاسم المعتمد
                  </h3>
                </div>
                <p className="text-xs text-slate-300 font-bold">
                  حلقة: <span className="text-amber-300">{joiningHalaqah.halaqah.name}</span>
                </p>
              </div>
              <button
                onClick={() => setJoiningHalaqah(null)}
                className="p-2 rounded-xl bg-white/10 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Success alert: copied to clipboard */}
            <div className="p-3.5 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="font-black">تم نسخ اسمك المعتمد تلقائياً إلى الحافظة (Clipboard) ✓</p>
                <p className="text-[11px] text-emerald-200/90 font-normal mt-0.5">
                  الصقه مباشرة في Google Meet ليظهر اسمك المعتمد في المنصة.
                </p>
              </div>
            </div>

            {/* Name Input & Copy Field */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-200">
                اسمك الذي سيظهر داخل الاجتماع:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joiningHalaqah.name}
                  onChange={e => setJoiningHalaqah({ ...joiningHalaqah, name: e.target.value })}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-black/40 border-2 border-amber-400/60 text-amber-200 text-sm font-black focus:outline-none focus:border-amber-400 text-right"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(joiningHalaqah.name).catch(() => {});
                    setJoiningHalaqah({ ...joiningHalaqah, copied: true });
                    setSuccessMessage(`تم نسخ "${joiningHalaqah.name}" للحافظة ✓`);
                    setTimeout(() => setSuccessMessage(null), 3000);
                  }}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5 cursor-pointer shrink-0 border border-white/20 transition-all"
                >
                  <Copy className="w-4 h-4 text-amber-300" />
                  <span>نسخ مجدداً</span>
                </button>
              </div>

              {/* Quick Format Pills */}
              <div className="flex items-center gap-2 pt-1 flex-wrap text-[11px]">
                <span className="text-slate-400 font-bold">تنسيق سريع:</span>
                <button
                  type="button"
                  onClick={() => {
                    const raw = currentUser?.name || currentTeacher?.name || currentUser?.username || 'المستخدم';
                    setJoiningHalaqah({ ...joiningHalaqah, name: raw });
                    navigator.clipboard.writeText(raw).catch(() => {});
                  }}
                  className="px-2.5 py-1 rounded-lg bg-black/30 hover:bg-black/50 text-slate-300 border border-white/10 cursor-pointer font-bold"
                >
                  الاسم فقط
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const raw = currentUser?.name || currentTeacher?.name || currentUser?.username || 'المستخدم';
                    const formatted = `المعلم: ${raw}`;
                    setJoiningHalaqah({ ...joiningHalaqah, name: formatted });
                    navigator.clipboard.writeText(formatted).catch(() => {});
                  }}
                  className="px-2.5 py-1 rounded-lg bg-black/30 hover:bg-black/50 text-slate-300 border border-white/10 cursor-pointer font-bold"
                >
                  المعلم: ...
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const raw = currentUser?.name || currentTeacher?.name || currentUser?.username || 'المستخدم';
                    const formatted = `المشرف: ${raw}`;
                    setJoiningHalaqah({ ...joiningHalaqah, name: formatted });
                    navigator.clipboard.writeText(formatted).catch(() => {});
                  }}
                  className="px-2.5 py-1 rounded-lg bg-black/30 hover:bg-black/50 text-slate-300 border border-white/10 cursor-pointer font-bold"
                >
                  المشرف: ...
                </button>
              </div>
            </div>

            {/* Google Meet Display Guide */}
            <div className="p-4 rounded-2xl bg-black/30 border border-white/10 space-y-2.5 text-xs text-slate-300">
              <div className="flex items-center gap-2 text-amber-400 font-black">
                <Sparkles className="w-4 h-4" />
                <span>كيف تضمن ظهور اسمك المعتمد داخل Google Meet؟</span>
              </div>
              <ul className="space-y-2 list-disc list-inside text-[11px] leading-relaxed text-slate-300">
                <li>
                  <strong className="text-white">عند الدخول كـ ضيف أو نافذة خاصة:</strong> يطلب منك Google Meet مباشرة <span className="text-amber-300">"ما هو اسمك؟"</span>؛ فقط قم بعمل <span className="text-emerald-300 font-bold">لصق (Paste / Ctrl+V)</span>.
                </li>
                <li>
                  <strong className="text-white">عند الدخول بحساب Google الشخصي:</strong> في شاشة الاستعداد قبل الضغط على "طلب الانضمام"، اضغط على اسمك لتعديله، أو الصق اسمك المعتمد في محادثة الاجتماع (Chat) فور دخولك لتوثيق حضورك في المنظومة.
                </li>
              </ul>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setJoiningHalaqah(null)}
                className="px-4 py-2.5 rounded-xl bg-white/10 text-slate-300 font-bold text-xs hover:bg-white/20 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(joiningHalaqah.name).catch(() => {});
                  window.open(joiningHalaqah.halaqah.meetingUri, '_blank', 'noopener,noreferrer');
                  setJoiningHalaqah(null);
                  setSuccessMessage(`تم نسخ اسمك المعتمد ("${joiningHalaqah.name}") وفتح Google Meet الآن ✓`);
                  setTimeout(() => setSuccessMessage(null), 5000);
                }}
                className="flex-1 py-3 px-5 rounded-xl font-black text-xs cursor-pointer shadow-xl flex items-center justify-center gap-2 hover:brightness-110 active:translate-y-[2px] transition-all"
                style={{
                  backgroundColor: themeAccent,
                  color: themePrimary,
                  border: `2px solid ${themeAccent}`,
                  borderBottom: `4px solid ${themeAccentShadow}`
                }}
              >
                <Video className="w-4 h-4" />
                <span>فتح Google Meet بالاسم المنسوخ الآن 🚀</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Halaqah Modal (Manual Link Entry & Cloud Save) */}
      {editingHalaqah && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
          <div
            className="w-full max-w-lg p-6 rounded-3xl border-2 border-b-4 shadow-2xl space-y-5 relative max-h-[90vh] overflow-y-auto"
            style={{
              backgroundColor: themeSecondary,
              borderColor: themeBorder,
              borderBottomColor: themeBorderBottom
            }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-lg font-black text-white font-heading">إدخال/تعديل رابط الحلقة الأونلاين يدوياً</h3>
              <button
                onClick={() => setEditingHalaqah(null)}
                className="p-2 rounded-xl bg-white/10 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-300 mb-1">اسم الحلقة</label>
                <input
                  type="text"
                  value={editingHalaqah.name}
                  onChange={e => setEditingHalaqah({ ...editingHalaqah, name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-black/30 border border-white/20 text-white text-xs font-bold focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-300 mb-1">وقت البداية</label>
                  <input
                    type="time"
                    value={editingHalaqah.onlineStartTime || editingHalaqah.startTime || '16:00'}
                    onChange={e => setEditingHalaqah({ ...editingHalaqah, onlineStartTime: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-black/30 border border-white/20 text-white text-xs font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-300 mb-1">وقت النهاية</label>
                  <input
                    type="time"
                    value={editingHalaqah.onlineEndTime || editingHalaqah.endTime || '20:00'}
                    onChange={e => setEditingHalaqah({ ...editingHalaqah, onlineEndTime: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-black/30 border border-white/20 text-white text-xs font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-300 mb-1">
                  رابط الاجتماع (Google Meet الأصلي المعتمد)
                </label>
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="url"
                      value={editingHalaqah.meetingUri || ''}
                      onChange={e => setEditingHalaqah({ ...editingHalaqah, meetingUri: e.target.value })}
                      placeholder="https://meet.google.com/abc-defg-hij"
                      className="flex-1 px-4 py-2.5 rounded-xl bg-black/30 border border-white/20 text-white text-xs font-bold focus:outline-none focus:border-amber-400 ltr text-left"
                    />

                    {/* Direct Real Google Meet Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsWaitingForDirectMeet(true);
                        setErrorMessage(null);
                        setSuccessMessage('تم فتح نافذة Google Meet لإنشاء اجتماع حقيقي بحسابك... انسخ الرابط من هناك وسنلتقطه فوراً!');
                        window.open('https://meet.google.com/new', '_blank');
                      }}
                      className="px-4 py-2.5 rounded-xl font-black text-xs bg-amber-400 hover:bg-amber-300 text-[#064e3b] shadow-md flex items-center justify-center gap-2 shrink-0 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
                      title="فتح صفحة إنشاء اجتماع حقيقي ومسجل على خوادم Google Meet فوراً"
                    >
                      <Video className="w-4 h-4" />
                      <span>إنشاء اجتماع حقيقي (Google Meet المباشر) 🚀</span>
                    </button>
                  </div>

                  {/* Active Waiting & Smart Clipboard Capture Card */}
                  {isWaitingForDirectMeet && (
                    <div className="p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-400 shadow-xl space-y-3 animate-pulse">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-amber-300 font-black text-xs">
                          <RefreshCw className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
                          <span>بانتظار رابط الاجتماع الحقيقي من Google Meet...</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsWaitingForDirectMeet(false)}
                          className="text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-black/40"
                        >
                          إلغاء الانتظار
                        </button>
                      </div>

                      <p className="text-[11px] text-amber-200/90 leading-relaxed font-bold">
                        فتحنا لك صفحة Google Meet الأصلية في نافذة أخرى؛ اضغط زر <strong>"نسخ الرابط"</strong> داخل صفحة Google Meet، وبمجرد رجوعك هنا سيتم التقاط الرابط وتعبئته وحفظه سحابياً تلقائياً!
                      </p>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleCaptureFromClipboard}
                          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow cursor-pointer transition-all active:scale-95"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>📋 اضغط لالتقاط الرابط من الحافظة وحفظه سحابياً الآن</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const link = window.prompt('الصق رابط Google Meet هنا:');
                            if (link) applyRealMeetUrl(link);
                          }}
                          className="px-3 py-2 rounded-xl bg-black/40 hover:bg-black/60 border border-white/20 text-slate-200 font-bold text-xs cursor-pointer"
                        >
                          لصق يدوي للرابط
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Quick Helper Actions & Verification */}
                  <div className="flex items-center justify-between gap-2 pt-1 flex-wrap text-[11px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={handleCaptureFromClipboard}
                        className="text-amber-300 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                        title="التقاط الرابط المنسوخ من الحافظة"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>التقاط من الحافظة (Clipboard)</span>
                      </button>

                      <span className="text-slate-600">•</span>

                      <a
                        href="https://meet.google.com/new"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-300 hover:underline flex items-center gap-1 font-bold"
                        title="فتح Google Meet مباشرة لإنشاء غرفة بحسابك"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>فتح صفحة إنشاء اجتماع في Google Meet</span>
                      </a>
                    </div>

                    {editingHalaqah.meetingUri && (
                      <div className="flex items-center gap-3">
                        <a
                          href={editingHalaqah.meetingUri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-400 hover:underline flex items-center gap-1 font-black cursor-pointer"
                          title="اختبار الرابط والتأكد من عمله 100%"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>اختبار الرابط الآن ✓</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(editingHalaqah.meetingUri || '').catch(() => {});
                            setSuccessMessage('تم نسخ رابط الاجتماع للحافظة ✓');
                            setTimeout(() => setSuccessMessage(null), 2500);
                          }}
                          className="text-amber-300 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>نسخ الرابط</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingHalaqah({ ...editingHalaqah, meetingUri: '', meetingCode: '' });
                          }}
                          className="text-red-400 hover:underline text-[10px] font-bold cursor-pointer"
                          title="مسح الرابط لإنشاء رابط جديد"
                        >
                          مسح
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="text-[10px] text-slate-400 leading-normal">
                    💡 <strong>طريقة العمل الأصلية:</strong> بالضغط على الزر، يُفتح لك Google Meet بحسابك الحقيقي لإنشاء غرفة معتمدة على خوادم Google، وعند نسخك للرابط ورجوعك يتم التقاطه تلقائياً وتعبئته في الحقل وحفظه في السحابة.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingHalaqah(null)}
                  className="px-5 py-2.5 rounded-xl bg-white/10 text-slate-300 font-bold text-xs hover:bg-white/20 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl font-black text-xs cursor-pointer shadow-lg hover:brightness-110 active:translate-y-[2px]"
                  style={{
                    backgroundColor: themeAccent,
                    color: themePrimary
                  }}
                >
                  حفظ الرابط في السحابة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
