import React, { useState } from 'react';
import {
  Radio,
  Video,
  Clock,
  Calendar,
  Users,
  ExternalLink,
  Plus,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Layers,
  Building2,
  ShieldAlert,
  X
} from 'lucide-react';
import { Halaqah, TeacherAccount, QuranComplex, Student } from '../../types';
import { createGoogleMeetSpace, getGoogleMeetAccessToken } from '../../lib/googleWorkspace';
import { OmranDataService } from '../../lib/firebase';
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


  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHalaqah) return;
    try {
      await onUpdateHalaqah(editingHalaqah);
      setSuccessMessage('تم تحديث إعدادات الحلقة الأونلاين بنجاح.');
      setEditingHalaqah(null);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err?.message || 'حدث خطأ أثناء حفظ التعديلات.');
    }
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
              إدارة الحلقات القرآنية الأونلاين (Google Meet)
            </h2>
          </div>
          <p className="text-xs sm:text-sm font-bold text-slate-300">
            متابعة الحلقات المرئية عن بُعد، إنشاء روابط Google Meet التلقائية، والدخول المباشر بالاسم المعتمد في المنصة.
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
              ? 'يمكنك ضبط أي حلقة وتعيينها كحلقة أونلاين عبر إعدادات وإدارة المجمعات والحلقات.'
              : 'لم يتم تعيينك في أي حلقة أونلاين حتى الآن. يرجى مراجعة المشرف العام.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {onlineHalaqahs.map(h => {
            const assignedTeacher = teachers.find(t => t.id === h.primaryTeacherId || (h.teacherIds && h.teacherIds.includes(t.id)));
            const halaqahStudents = students.filter(s => s.halaqahId === h.id || (s.halaqahName && h.name && s.halaqahName.trim() === h.name.trim()));

            return (
              <div
                key={h.id}
                className="p-6 rounded-3xl border-2 border-b-4 shadow-xl space-y-4 relative overflow-hidden flex flex-col justify-between"
                style={{
                  backgroundColor: themeCard,
                  borderColor: themeBorder,
                  borderBottomColor: themeBorderBottom
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
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-2xl bg-emerald-500/20 border border-emerald-400 text-emerald-300 text-xs font-black shrink-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span>نشطة</span>
                    </span>
                  </div>

                  {h.description && (
                    <p className="text-xs text-slate-300 font-bold line-clamp-2">{h.description}</p>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-bold text-slate-300">
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-black/20 border border-white/5">
                      <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>{h.onlineStartTime || h.startTime || '16:00'} - {h.onlineEndTime || h.endTime || '18:00'}</span>
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
                  {h.meetingUri ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <a
                          href={h.meetingUri}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={async (e) => {
                            const check = await OmranDataService.verifyGoogleMeetMeeting(h.meetingUri);
                            if (!check.exists) {
                              e.preventDefault();
                              setErrorMessage(check.message);
                              setTimeout(() => setErrorMessage(null), 5000);
                              return;
                            }
                            const userName = currentUser?.name || currentTeacher?.name || 'مستخدم المنصة';
                            navigator.clipboard.writeText(userName).catch(() => {});
                            setSuccessMessage(`تم نسخ اسمك المعتمد في المنصة ("${userName}") للحافظة للدخول به في Google Meet بنجاح.`);
                            setTimeout(() => setSuccessMessage(null), 6000);
                          }}
                          className="flex-1 py-3 px-4 rounded-2xl font-black text-xs text-center flex items-center justify-center gap-2 shadow-lg transition-all hover:brightness-110 active:translate-y-[2px]"
                          style={{
                            backgroundColor: themeAccent,
                            color: themePrimary,
                            border: `2px solid ${themeAccent}`,
                            borderBottom: `4px solid ${themeAccentShadow}`
                          }}
                        >
                          <Video className="w-4 h-4" />
                          <span>الانضمام للحلقة (Google Meet)</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                  {h.meetingUri ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <a
                          href={h.meetingUri}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={async (e) => {
                            const check = await OmranDataService.verifyGoogleMeetMeeting(h.meetingUri);
                            if (!check.exists) {
                              e.preventDefault();
                              setErrorMessage(check.message);
                              setTimeout(() => setErrorMessage(null), 5000);
                              return;
                            }
                            const userName = currentUser?.name || currentTeacher?.name || 'مستخدم المنصة';
                            navigator.clipboard.writeText(userName).catch(() => {});
                            setSuccessMessage(`تم نسخ اسمك المعتمد في المنصة ("${userName}") للحافظة للدخول به في Google Meet بنجاح.`);
                            setTimeout(() => setSuccessMessage(null), 6000);
                          }}
                          className="flex-1 py-3 px-4 rounded-2xl font-black text-xs text-center flex items-center justify-center gap-2 shadow-lg transition-all hover:brightness-110 active:translate-y-[2px]"
                          style={{
                            backgroundColor: themeAccent,
                            color: themePrimary,
                            border: `2px solid ${themeAccent}`,
                            borderBottom: `4px solid ${themeAccentShadow}`
                          }}
                        >
                          <Video className="w-4 h-4" />
                          <span>الانضمام للحلقة (Google Meet)</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                      <p className="text-[11px] text-slate-300 font-bold text-center">
                        اسم الدخول المعتمد في الاجتماع: <span className="text-amber-300">{currentUser?.name || currentTeacher?.name || 'مستخدم المنصة'}</span>
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold text-center space-y-1">
                      <p>لم يتم إدخال رابط Google Meet لهذه الحلقة بعد.</p>
                      <p className="text-[11px] text-slate-300">يرجى من المشرف كتابة وإدخال رابط Google Meet المعتمد من إعدادات الحلقات أو إدارة المجمعات.</p>
                    </div>
                  )}

                  {(isSupervisor || isDeveloper) && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-slate-400 font-bold">
                        {h.meetingCode ? `كود الاجتماع: ${h.meetingCode}` : 'لم يتم إنشاء الرابط بعد'}
                      </span>
                      <button
                        onClick={() => setEditingHalaqah(h)}
                        className="text-xs font-bold text-amber-300 hover:underline cursor-pointer"
                      >
                        تعديل المواعيد والبيانات
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Halaqah Modal */}
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
              <h3 className="text-lg font-black text-white font-heading">تعديل إعدادات الحلقة الأونلاين</h3>
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
                    value={editingHalaqah.onlineEndTime || editingHalaqah.endTime || '18:00'}
                    onChange={e => setEditingHalaqah({ ...editingHalaqah, onlineEndTime: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-black/30 border border-white/20 text-white text-xs font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-300 mb-1">رابط Google Meet المباشر</label>
                <input
                  type="url"
                  value={editingHalaqah.meetingUri || ''}
                  onChange={e => setEditingHalaqah({ ...editingHalaqah, meetingUri: e.target.value })}
                  placeholder="https://meet.google.com/abc-defg-hij"
                  className="w-full px-4 py-2.5 rounded-xl bg-black/30 border border-white/20 text-white text-xs font-bold focus:outline-none focus:border-amber-400 ltr text-left"
                />
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
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
