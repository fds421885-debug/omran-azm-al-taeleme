import React, { useState, useEffect } from 'react';
import {
  Send,
  MessageCircle,
  Copy,
  Check,
  Phone,
  Edit,
  ExternalLink,
  RefreshCw,
  Search,
  BookOpen,
  Sparkles,
  Award,
  UserCheck,
  X,
  Clock
} from 'lucide-react';
import { motion } from 'motion/react';
import { Student, AttendanceRecord, StudentEvaluation, AppSettings, QuranComplex } from '../../types';
import { calculateRealisticQuranAssignment, formatQuranPortion, getSurahInfo } from '../../data/quranData';
import { darkenHex, lightenHex, getContrastTextColor } from '../../lib/themeUtils';

interface ParentsWhatsAppTabProps {
  students: Student[];
  attendance: AttendanceRecord[];
  evaluations: StudentEvaluation[];
  settings: AppSettings;
  preselectedStudentId?: string;
  senderAccountName?: string;
  currentUserName?: string;
  activeComplex?: QuranComplex | null;
}

export const ParentsWhatsAppTab: React.FC<ParentsWhatsAppTabProps> = ({
  students,
  attendance,
  evaluations,
  settings,
  preselectedStudentId,
  senderAccountName,
  currentUserName,
  activeComplex
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Active Complex 3D Duolingo Theme Variables
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

  // Dynamic sender name based on active logged-in teacher account (e.g. محمد، أنس)
  const initialSender = currentUserName || senderAccountName || settings.teacherName || 'معلم ومحفظ الحلقة';
  const [senderName, setSenderName] = useState<string>(initialSender);
  const [isEditingSender, setIsEditingSender] = useState(false);

  useEffect(() => {
    if (currentUserName || senderAccountName) {
      setSenderName(currentUserName || senderAccountName || settings.teacherName || 'معلم ومحفظ الحلقة');
    }
  }, [currentUserName, senderAccountName, settings.teacherName]);

  // Messages map: studentId -> message string
  const [messagesMap, setMessagesMap] = useState<Record<string, string>>({});
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');

  // Helper to build pristine, 100% accurate and comprehensive message from teacher records
  const buildComprehensiveMessage = (
    student: Student,
    status: string,
    evalData?: StudentEvaluation,
    customSender?: string
  ): string => {
    let baseUrl = '';
    if (typeof window !== 'undefined') {
      const cleanHref = window.location.origin + window.location.pathname;
      baseUrl = cleanHref.replace(/\/+$/, '');
    }
    const portalUrl = baseUrl ? `${baseUrl}/?portal=${encodeURIComponent(student.id)}` : '';

    // Realistic calculation fallback if not evaluated yet
    const realisticAssignment = calculateRealisticQuranAssignment(
      student.currentSurah || student.currentSurahName || 78,
      student.currentAyah || 1,
      student.level || 'متوسط',
      student.dailyNewTarget || 'نصف وجه'
    );

    // 1. Today's recitation (ما سمعه الطالب اليوم)
    let todayNewText = '';
    let todayReviewText = '';

    if (evalData?.recitationDetails?.todayNewItem) {
      const item = evalData.recitationDetails.todayNewItem;
      const sInfo = getSurahInfo(item.surahNumber);
      const toSurahInfo = item.toSurahNumber ? getSurahInfo(item.toSurahNumber) : sInfo;
      todayNewText = formatQuranPortion(
        item.surahName || sInfo.name,
        item.fromAyah,
        item.toAyah,
        sInfo.numberOfAyahs,
        item.type,
        item.toSurahName || toSurahInfo.name,
        toSurahInfo.numberOfAyahs
      );
    } else if (evalData?.recitationDetails?.newMemorizationAchieved) {
      todayNewText = evalData.recitationDetails.newMemorizationAchieved;
    } else if (status === 'حاضر') {
      todayNewText = student.currentSurahName
        ? `سورة ${student.currentSurahName} (الآية ${student.currentAyah || 1})`
        : 'أتمّ التسميع المقرر';
    } else {
      todayNewText = 'لم يسمّع اليوم (غائب)';
    }

    if (evalData?.recitationDetails?.todayReviewItems && evalData.recitationDetails.todayReviewItems.length > 0) {
      const reviewLines = evalData.recitationDetails.todayReviewItems.map(r => {
        const sInfo = getSurahInfo(r.surahNumber);
        const toSurahInfo = r.toSurahNumber ? getSurahInfo(r.toSurahNumber) : sInfo;
        return formatQuranPortion(
          r.surahName || sInfo.name,
          r.fromAyah,
          r.toAyah,
          sInfo.numberOfAyahs,
          r.type,
          r.toSurahName || toSurahInfo.name,
          toSurahInfo.numberOfAyahs
        );
      });
      todayReviewText = reviewLines.join(' ، ');
    } else if (evalData?.recitationDetails?.reviewAchieved) {
      todayReviewText = evalData.recitationDetails.reviewAchieved;
    } else if (status === 'حاضر') {
      todayReviewText = student.currentSurahName ? `مراجعة سورة ${student.currentSurahName}` : 'مراجعة وتثبيت ما تم حفظه';
    } else {
      todayReviewText = 'لم يراجع اليوم';
    }

    // 2. Tomorrow's assignment (تقرير غد)
    let tomNewText = '';
    let tomReviewText = '';

    if (evalData?.recitationDetails?.tomorrowNewItem) {
      const tItem = evalData.recitationDetails.tomorrowNewItem;
      const sInfo = getSurahInfo(tItem.surahNumber);
      const toSurahInfo = tItem.toSurahNumber ? getSurahInfo(tItem.toSurahNumber) : sInfo;
      tomNewText = formatQuranPortion(
        tItem.surahName || sInfo.name,
        tItem.fromAyah,
        tItem.toAyah,
        sInfo.numberOfAyahs,
        tItem.type,
        tItem.toSurahName || toSurahInfo.name,
        toSurahInfo.numberOfAyahs
      );
    } else if (student.aiPlan?.currentDailyAssignment?.newMemorization) {
      tomNewText = student.aiPlan.currentDailyAssignment.newMemorization;
    } else {
      tomNewText = realisticAssignment.newMemorization;
    }

    if (evalData?.recitationDetails?.tomorrowReviewItem) {
      const tRev = evalData.recitationDetails.tomorrowReviewItem;
      const sInfo = getSurahInfo(tRev.surahNumber);
      const toSurahInfo = tRev.toSurahNumber ? getSurahInfo(tRev.toSurahNumber) : sInfo;
      tomReviewText = formatQuranPortion(
        tRev.surahName || sInfo.name,
        tRev.fromAyah,
        tRev.toAyah,
        sInfo.numberOfAyahs,
        tRev.type,
        tRev.toSurahName || toSurahInfo.name,
        toSurahInfo.numberOfAyahs
      );
    } else if (student.aiPlan?.currentDailyAssignment?.review) {
      tomReviewText = student.aiPlan.currentDailyAssignment.review;
    } else {
      tomReviewText = realisticAssignment.review;
    }

    // Construct concise, clean WhatsApp message strictly according to requested format
    let msg = `السلام عليكم\n`;
    msg += `الطالب: ${student.name}\n\n`;
    msg += `لمتابعة ملف الطالب ادخل على الرابط التالي:\n`;
    msg += `${portalUrl}\n\n`;
    msg += `ما سمعه الطالب اليوم:\n`;
    msg += `- الجديد: ${todayNewText}\n`;
    msg += `- المراجعات: ${todayReviewText}\n\n`;
    msg += `تقرير غد:\n`;
    msg += `- الجديد: ${tomNewText}\n`;
    msg += `- المراجعات: ${tomReviewText}\n\n`;
    msg += `جزاكم الله خيرا`;

    return msg;
  };

  // Re-sync messages whenever students, evaluations, attendance, or senderName change
  useEffect(() => {
    const updatedMap: Record<string, string> = {};
    students.forEach(student => {
      const todayAtt = attendance.find(
        a => a.date === todayStr && a.studentId === student.id
      );
      const status = todayAtt?.status || 'حاضر';
      const evalData = evaluations.find(
        e => e.date === todayStr && e.studentId === student.id
      );

      updatedMap[student.id] = buildComprehensiveMessage(student, status, evalData, senderName);
    });

    setMessagesMap(updatedMap);
  }, [students, attendance, evaluations, settings, senderName, activeComplex]);

  const handleUpdateSenderName = (newName: string) => {
    setSenderName(newName);
    const updatedMap: Record<string, string> = {};
    students.forEach(student => {
      const todayAtt = attendance.find(
        a => a.date === todayStr && a.studentId === student.id
      );
      const status = todayAtt?.status || 'حاضر';
      const evalData = evaluations.find(
        e => e.date === todayStr && e.studentId === student.id
      );

      updatedMap[student.id] = buildComprehensiveMessage(student, status, evalData, newName);
    });
    setMessagesMap(updatedMap);
  };

  const handleRefreshStudentMessage = (student: Student) => {
    const todayAtt = attendance.find(
      a => a.date === todayStr && a.studentId === student.id
    );
    const status = todayAtt?.status || 'حاضر';
    const evalData = evaluations.find(
      e => e.date === todayStr && e.studentId === student.id
    );

    const freshMsg = buildComprehensiveMessage(student, status, evalData, senderName);
    setMessagesMap(prev => ({
      ...prev,
      [student.id]: freshMsg
    }));
  };

  const handleCopy = (studentId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(studentId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleSendWhatsApp = (phone: string, text: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const encoded = encodeURIComponent(text);
    const url = `https://wa.me/${cleanPhone}?text=${encoded}`;
    window.open(url, '_blank');
  };

  const handleOpenEdit = (studentId: string) => {
    setEditingStudentId(studentId);
    setEditingText(messagesMap[studentId] || '');
  };

  const handleSaveEdit = () => {
    if (editingStudentId) {
      setMessagesMap(prev => ({
        ...prev,
        [editingStudentId]: editingText
      }));
      setEditingStudentId(null);
    }
  };

  const filteredStudents = students.filter(
    s =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.parentName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div
        className="rounded-[32px] border-2 border-b-4 p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all"
        style={{
          backgroundColor: themePrimary,
          borderColor: themeBorder,
          borderBottomColor: themeCardShadow
        }}
      >
        <div>
          <h2 className="text-xl font-bold font-heading flex items-center gap-2" style={{ color: themeText }}>
            <div
              className="w-9 h-9 rounded-2xl border-2 border-b-4 flex items-center justify-center shrink-0 shadow-sm"
              style={{
                backgroundColor: themeAccent,
                borderColor: themeAccent,
                borderBottomColor: themeAccentShadow,
                color: themeContrastText
              }}
            >
              <MessageCircle className="w-5 h-5" />
            </div>
            <span>رسائل الواتساب اليومية لأولياء الأمور</span>
          </h2>
          <p className="text-xs mt-1.5 font-bold" style={{ color: themeSubtext }}>
            صياغة رسائل مختصرة ودقيقة: إنجاز اليوم، مقرر الغد، ورابط مباشر لملف الطالب
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Active Sender Account Badge & Modifier */}
          <div
            className="flex items-center gap-2 text-xs px-3.5 py-2.5 rounded-2xl border-2 border-b-4 shadow-sm"
            style={{
              backgroundColor: themeCard,
              borderColor: themeBorder,
              borderBottomColor: themeCardShadow,
              color: themeText
            }}
          >
            <UserCheck className="w-4 h-4 shrink-0" style={{ color: themeAccent }} />
            <span style={{ color: themeSubtext }}>الحساب المُرسل منه:</span>
            <span
              className="font-black font-mono px-2.5 py-1 rounded-xl border-2 border-b-2 text-xs"
              style={{
                backgroundColor: `${themeAccent}25`,
                borderColor: `${themeAccent}50`,
                borderBottomColor: themeAccentShadow,
                color: themeAccent
              }}
            >
              {senderName}
            </span>
            <button
              type="button"
              onClick={() => setIsEditingSender(!isEditingSender)}
              className="text-xs font-black underline cursor-pointer mr-1.5 transition-colors hover:brightness-125"
              style={{ color: themeAccent }}
            >
              {isEditingSender ? 'إغلاق' : 'تغيير'}
            </button>
          </div>

          <div
            className="hidden lg:flex items-center gap-2 text-xs px-3.5 py-2.5 rounded-2xl border-2 border-b-4 shadow-sm"
            style={{
              backgroundColor: themeCard,
              borderColor: themeBorder,
              borderBottomColor: themeCardShadow,
              color: themeAccent
            }}
          >
            <BookOpen className="w-4 h-4" />
            <span className="font-bold">تُحدّث فورياً بحسب الحساب المُرسل</span>
          </div>
        </div>
      </div>

      {/* Account Sender Customization Panel */}
      {isEditingSender && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="border-2 border-b-4 rounded-[28px] p-5 shadow-xl space-y-3"
          style={{
            backgroundColor: themeSecondary,
            borderColor: themeAccent,
            borderBottomColor: themeAccentShadow
          }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-xs font-bold flex items-center gap-2" style={{ color: themeText }}>
                <UserCheck className="w-4 h-4" style={{ color: themeAccent }} />
                <span>تحديد الحساب أو المعلم الذي يُكتب اسمه في تذييل رسالة الواتساب:</span>
              </span>
              <p className="text-[11px] font-bold" style={{ color: themeSubtext }}>
                سواء كنت مسجلاً باسمك (مثل محمد أو أنس) أو كمعلم للحلقة، يمكنك تثبيت اسم الحساب بدقة.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              {currentUserName && currentUserName !== senderName && (
                <button
                  type="button"
                  onClick={() => handleUpdateSenderName(currentUserName)}
                  className="px-3.5 py-1.5 rounded-xl border-2 border-b-2 text-xs font-black transition-all cursor-pointer active:translate-y-[1px]"
                  style={{
                    backgroundColor: `${themeAccent}25`,
                    borderColor: `${themeAccent}60`,
                    borderBottomColor: themeAccentShadow,
                    color: themeAccent
                  }}
                >
                  استخدام اسم حسابي ({currentUserName})
                </button>
              )}
              {senderAccountName && senderAccountName !== senderName && (
                <button
                  type="button"
                  onClick={() => handleUpdateSenderName(senderAccountName)}
                  className="px-3.5 py-1.5 rounded-xl border-2 border-b-2 text-xs font-black transition-all cursor-pointer active:translate-y-[1px]"
                  style={{
                    backgroundColor: themeCard,
                    borderColor: themeBorder,
                    borderBottomColor: themeCardShadow,
                    color: themeText
                  }}
                >
                  استخدام اسم المعلم ({senderAccountName})
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={senderName}
              onChange={e => handleUpdateSenderName(e.target.value)}
              placeholder="اكتب اسم الحساب أو المعلم المرسل هنا..."
              className="w-full border-2 border-b-4 text-xs font-bold rounded-xl py-2.5 px-3 outline-none transition-all shadow-inner"
              style={{
                backgroundColor: themePrimary,
                borderColor: themeBorder,
                borderBottomColor: themeBorderBottom,
                color: themeText
              }}
            />
            <button
              type="button"
              onClick={() => setIsEditingSender(false)}
              className="px-5 py-2.5 rounded-xl border-2 border-b-4 text-xs font-black shrink-0 transition-all cursor-pointer active:translate-y-[2px] active:border-b-2 hover:brightness-110 shadow-md"
              style={{
                backgroundColor: themeAccent,
                borderColor: themeAccent,
                borderBottomColor: themeAccentShadow,
                color: themeContrastText
              }}
            >
              تم
            </button>
          </div>
        </motion.div>
      )}

      {/* 3D Duolingo Search Bar */}
      <div
        className="relative flex items-center gap-3 p-2 sm:p-2.5 rounded-[26px] border-2 border-b-[5px] transition-all shadow-xl"
        style={{
          backgroundColor: darkenHex(themeCard, 0.2),
          borderColor: themeBorder,
          borderBottomColor: themeCardShadow
        }}
      >
        <div
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl border-2 border-b-4 flex items-center justify-center shrink-0 shadow-md"
          style={{
            backgroundColor: themeAccent,
            borderColor: themeAccent,
            borderBottomColor: themeAccentShadow,
            color: themeContrastText
          }}
        >
          <Search className="w-5 h-5 stroke-[2.5]" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="بحث سريع باسم الطالب، المعلم، أو ولي الأمر..."
          className="flex-1 bg-transparent py-2.5 px-2 text-xs sm:text-sm md:text-base font-black outline-none placeholder:opacity-50"
          style={{ color: themeText }}
          dir="rtl"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border-2 border-b-3 flex items-center justify-center font-black cursor-pointer active:translate-y-[2px] active:border-b transition-all shadow-md ml-1"
            style={{
              backgroundColor: themeCard,
              borderColor: themeBorder,
              borderBottomColor: themeCardShadow,
              color: themeText
            }}
            title="مسح البحث"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        )}
      </div>

      {/* Student Cards List */}
      <div className="space-y-4">
        {filteredStudents.length === 0 ? (
          <div
            className="rounded-[30px] border-2 border-b-[6px] p-12 text-center text-xs font-bold shadow-xl"
            style={{
              backgroundColor: themeCard,
              borderColor: themeBorder,
              borderBottomColor: themeCardShadow,
              color: themeSubtext
            }}
          >
            لا يوجد طلاب مطابقون للبحث.
          </div>
        ) : (
          filteredStudents.map((student, sIdx) => {
            const todayAtt = attendance.find(
              a => a.date === todayStr && a.studentId === student.id
            );
            const status = todayAtt?.status || 'حاضر';
            const evalData = evaluations.find(
              e => e.date === todayStr && e.studentId === student.id
            );
            const msg = messagesMap[student.id] || buildComprehensiveMessage(student, status, evalData, senderName);
            const isCopied = copiedId === student.id;

            return (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(sIdx * 0.04, 0.4) }}
                className="rounded-[30px] border-2 border-b-[6px] p-5 sm:p-6 transition-all shadow-xl hover:translate-y-[-2px]"
                style={{
                  backgroundColor: themeCard,
                  borderColor: themeBorder,
                  borderBottomColor: themeCardShadow
                }}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                  {/* Left Info: Student Profile & Numbers */}
                  <div className="lg:w-1/3 space-y-3.5">
                    <div className="flex items-center gap-3">
                      {/* 3D Student Badge */}
                      <div
                        className="w-12 h-12 rounded-2xl border-2 border-b-4 flex items-center justify-center font-bold text-sm shrink-0 shadow-md"
                        style={{
                          backgroundColor: themeAccent,
                          borderColor: themeAccent,
                          borderBottomColor: themeAccentShadow,
                          color: themeContrastText
                        }}
                      >
                        <UserCheck className="w-6 h-6 stroke-[2.4]" />
                      </div>
                      <div className="min-w-0">
                        <h4
                          className="text-base sm:text-lg font-black leading-snug break-words"
                          title={student.name}
                          style={{ color: themeText }}
                        >
                          {student.name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1 text-xs font-bold" style={{ color: themeSubtext }}>
                          <span>ولي الأمر:</span>
                          <span className="font-black" style={{ color: themeText }}>{student.parentName || 'غير مسجل'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Stats Box (3D Duolingo) */}
                    <div
                      className="rounded-[22px] border-2 border-b-[5px] p-4 space-y-3 shadow-inner"
                      style={{
                        backgroundColor: darkenHex(themeCard, 0.28),
                        borderColor: themeBorder,
                        borderBottomColor: themeCardShadow
                      }}
                    >
                      {/* حضور اليوم */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-xs" style={{ color: themeSubtext }}>حضور اليوم:</span>
                        <div
                          className={`font-black px-3.5 py-1.5 rounded-xl border-2 border-b-4 text-xs shadow-md inline-flex items-center gap-1.5 ${
                            status === 'حاضر'
                              ? 'bg-[#22c55e] text-white border-[#16a34a] border-b-[#15803d]'
                              : status === 'غائب'
                              ? 'bg-[#ef4444] text-white border-[#dc2626] border-b-[#b91c1c]'
                              : status === 'معتذر'
                              ? 'bg-[#f59e0b] text-white border-[#d97706] border-b-[#b45309]'
                              : 'bg-slate-700 text-slate-100 border-slate-600 border-b-slate-800'
                          }`}
                        >
                          {status === 'حاضر' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          {status === 'غائب' && <X className="w-3.5 h-3.5 stroke-[3]" />}
                          {status === 'معتذر' && <Clock className="w-3.5 h-3.5 stroke-[3]" />}
                          <span>{status}</span>
                        </div>
                      </div>

                      {/* هل تم التسجيل له أم لا (تسميع اليوم) */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-xs" style={{ color: themeSubtext }}>تسميع اليوم:</span>
                        {evalData ? (
                          <div
                            className="font-black px-3 py-1.5 rounded-xl border-2 border-b-4 text-xs shadow-md inline-flex items-center gap-1.5 bg-[#10b981] text-white border-[#059669] border-b-[#047857]"
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>تم تسجيل التسميع</span>
                          </div>
                        ) : (
                          <div
                            className="font-black px-3 py-1.5 rounded-xl border-2 border-b-4 text-xs shadow-md inline-flex items-center gap-1.5"
                            style={{
                              backgroundColor: darkenHex(themeCard, 0.45),
                              borderColor: themeBorder,
                              borderBottomColor: darkenHex(themeCard, 0.6),
                              color: themeSubtext
                            }}
                          >
                            <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>لم يسجل بعد</span>
                          </div>
                        )}
                      </div>

                      {/* مقرر الغد */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                        <span className="font-black text-xs" style={{ color: themeSubtext }}>مقرر الغد:</span>
                        <span className="font-bold text-xs truncate max-w-[150px]" style={{ color: themeAccent }}>
                          {student.aiPlan?.currentDailyAssignment?.newMemorization || 'مقرر الغد محدد'}
                        </span>
                      </div>
                    </div>

                    {/* Parent Phone Numbers List with 3D Direct Send */}
                    <div className="space-y-2">
                      <div className="text-xs font-black flex items-center gap-1.5" style={{ color: themeSubtext }}>
                        <Phone className="w-3.5 h-3.5" style={{ color: themeAccent }} />
                        <span>أرقام هواتف أولياء الأمور للإرسال:</span>
                      </div>
                      <div className="space-y-2">
                        {student.parentPhones && student.parentPhones.length > 0 ? (
                          student.parentPhones.map((phone, pIdx) => (
                            <div
                              key={pIdx}
                              className="flex items-center justify-between gap-2 p-3 rounded-2xl border-2 border-b-4 text-xs shadow-md transition-all"
                              style={{
                                backgroundColor: darkenHex(themeCard, 0.28),
                                borderColor: themeBorder,
                                borderBottomColor: themeCardShadow
                              }}
                            >
                              <div className="flex items-center gap-2 font-mono font-bold text-xs" dir="ltr" style={{ color: themeText }}>
                                <Phone className="w-3.5 h-3.5" style={{ color: themeAccent }} />
                                <span>{phone}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleSendWhatsApp(phone, msg)}
                                className="px-3.5 py-1.5 rounded-xl border-2 border-b-4 font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:translate-y-[2px] active:border-b-2 hover:brightness-110 bg-[#22c55e] border-[#16a34a] border-b-[#15803d] text-white"
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>إرسال واتساب</span>
                              </button>
                            </div>
                          ))
                        ) : (
                          <div
                            className="flex items-center justify-between gap-2 p-3 rounded-2xl border-2 border-b-4 text-xs shadow-md"
                            style={{
                              backgroundColor: darkenHex(themeCard, 0.28),
                              borderColor: themeBorder,
                              borderBottomColor: themeCardShadow
                            }}
                          >
                            <span className="font-mono font-bold text-xs" dir="ltr" style={{ color: themeText }}>
                              {student.phone}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleSendWhatsApp(student.phone, msg)}
                              className="px-3.5 py-1.5 rounded-xl border-2 border-b-4 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md active:translate-y-[2px] active:border-b-2 hover:brightness-110 bg-[#22c55e] border-[#16a34a] border-b-[#15803d] text-white"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>إرسال واتساب</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Box: Formatted Message Box */}
                  <div
                    className="lg:w-2/3 flex flex-col justify-between rounded-[26px] border-2 border-b-[6px] p-5 sm:p-6 space-y-4 shadow-xl"
                    style={{
                      backgroundColor: darkenHex(themeCard, 0.2),
                      borderColor: themeBorder,
                      borderBottomColor: themeCardShadow
                    }}
                  >
                    <div
                      className="flex items-center justify-between pb-3.5 border-b"
                      style={{ borderColor: `${themeBorder}80` }}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-xl border-2 border-b-3 flex items-center justify-center shadow-sm"
                          style={{
                            backgroundColor: `${themeAccent}25`,
                            borderColor: `${themeAccent}60`,
                            borderBottomColor: themeAccentShadow,
                            color: themeAccent
                          }}
                        >
                          <MessageCircle className="w-4 h-4" />
                        </div>
                        <span className="text-xs sm:text-sm font-black" style={{ color: themeAccent }}>
                          نص الرسالة المعتمدة لولي الأمر
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRefreshStudentMessage(student)}
                          title="تحديث الرسالة من بيانات المعلم"
                          className="p-2 sm:px-3 sm:py-2 rounded-xl border-2 border-b-4 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all active:translate-y-[2px] active:border-b-2 hover:brightness-110 shadow-md"
                          style={{
                            backgroundColor: themeCard,
                            borderColor: themeBorder,
                            borderBottomColor: themeCardShadow,
                            color: themeSubtext
                          }}
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">تحديث</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(student.id)}
                          title="تعديل نص الرسالة يدوياً"
                          className="p-2 sm:px-3 sm:py-2 rounded-xl border-2 border-b-4 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all active:translate-y-[2px] active:border-b-2 hover:brightness-110 shadow-md"
                          style={{
                            backgroundColor: themeCard,
                            borderColor: themeBorder,
                            borderBottomColor: themeCardShadow,
                            color: themeSubtext
                          }}
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">تعديل</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCopy(student.id, msg)}
                          className="px-3.5 py-2 rounded-xl border-2 border-b-4 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-md active:translate-y-[2px] active:border-b-2 hover:brightness-110"
                          style={
                            isCopied
                              ? {
                                  backgroundColor: '#10b981',
                                  borderColor: '#10b981',
                                  borderBottomColor: '#059669',
                                  color: '#ffffff'
                                }
                              : {
                                  backgroundColor: themeAccent,
                                  borderColor: themeAccent,
                                  borderBottomColor: themeAccentShadow,
                                  color: themeContrastText
                                }
                          }
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>تم النسخ!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>نسخ النص</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* 3D Duolingo Message Text Frame (الإطار اللي في نص الرسالة) */}
                    <div
                      className="rounded-[22px] border-2 border-b-[5px] p-4 sm:p-5 text-xs sm:text-sm font-sans whitespace-pre-line leading-relaxed max-h-72 overflow-y-auto shadow-inner relative transition-all"
                      style={{
                        backgroundColor: darkenHex(themeCard, 0.42),
                        borderColor: themeBorder,
                        borderBottomColor: themeCardShadow,
                        color: themeText
                      }}
                    >
                      {/* Top Header Tag inside the frame */}
                      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10 text-[11px] font-bold">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          <span style={{ color: themeAccent }}>معاينة رسالة الواتساب اليومية:</span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-lg border-2 border-b-2 text-[10px] font-black bg-emerald-500/20 text-emerald-300 border-emerald-500/40 border-b-emerald-600">
                          نص معتمد
                        </span>
                      </div>

                      {/* Content */}
                      <div className="font-semibold select-text" dir="rtl">
                        {msg}
                      </div>
                    </div>

                    {/* Portal link footer in 3D */}
                    <div
                      className="p-3 rounded-2xl border-2 border-b-4 flex items-center justify-between text-xs font-bold shadow-md"
                      style={{
                        backgroundColor: darkenHex(themeCard, 0.3),
                        borderColor: themeBorder,
                        borderBottomColor: themeCardShadow
                      }}
                    >
                      <span style={{ color: themeSubtext }}>الرابط المرفق: بوابة المتابعة الحية للطالب</span>
                      <a
                        href={`/?portal=${student.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-xl border-2 border-b-3 font-black text-xs flex items-center gap-1.5 transition-all active:translate-y-[1px] hover:brightness-110 shadow-sm"
                        style={{
                          backgroundColor: `${themeAccent}25`,
                          borderColor: `${themeAccent}60`,
                          borderBottomColor: themeAccentShadow,
                          color: themeAccent
                        }}
                      >
                        <span>معاينة صفحة الطالب</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Manual Edit Message Modal */}
      {editingStudentId && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div
            className="w-full max-w-xl rounded-[32px] border-2 border-b-4 p-6 sm:p-8 shadow-2xl space-y-4 animate-scaleUp"
            style={{
              backgroundColor: themePrimary,
              borderColor: themeAccent,
              borderBottomColor: themeAccentShadow
            }}
          >
            <h3 className="text-base font-black font-heading flex items-center gap-2" style={{ color: themeAccent }}>
              <Edit className="w-5 h-5" />
              <span>تعديل نص رسالة الواتساب</span>
            </h3>
            <textarea
              rows={9}
              value={editingText}
              onChange={e => setEditingText(e.target.value)}
              className="w-full rounded-2xl border-2 border-b-4 p-3.5 text-xs font-sans outline-none resize-none shadow-inner"
              style={{
                backgroundColor: darkenHex(themePrimary, 0.25),
                borderColor: themeBorder,
                borderBottomColor: themeBorderBottom,
                color: themeText
              }}
              dir="rtl"
            />
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setEditingStudentId(null)}
                className="px-4 py-2.5 rounded-2xl border-2 border-b-2 text-xs font-bold transition-all cursor-pointer hover:brightness-110 active:translate-y-[1px]"
                style={{
                  backgroundColor: themeCard,
                  borderColor: themeBorder,
                  borderBottomColor: themeCardShadow,
                  color: themeSubtext
                }}
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-5 py-2.5 rounded-2xl border-2 border-b-4 text-xs font-black shadow-md cursor-pointer transition-all hover:brightness-110 active:translate-y-[2px] active:border-b-2"
                style={{
                  backgroundColor: themeAccent,
                  borderColor: themeAccent,
                  borderBottomColor: themeAccentShadow,
                  color: themeContrastText
                }}
              >
                حفظ النص المعدل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
