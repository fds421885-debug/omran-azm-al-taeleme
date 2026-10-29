import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import {
  TrendingUp,
  BookOpen,
  FileText,
  Award,
  Sparkles,
  Layers,
  BarChart3,
  Activity,
  Users,
  ChevronDown,
  CheckCircle2,
  Calendar,
  Flame,
  ArrowUpRight,
  PlusCircle
} from 'lucide-react';
import { Student, StudentEvaluation, QuranComplex, AppSettings } from '../../types';
import { QURAN_SURAHS, getSurahInfo } from '../../data/quranData';
import {
  getPageOfAyah,
  getAyahsOnPage,
  calculateStudentCompletedPages
} from '../../data/quranPagesData';
import { lightenHex, darkenHex, getContrastTextColor } from '../../lib/themeUtils';

interface StudentProgressAnalyticsSectionProps {
  students: Student[];
  evaluations: StudentEvaluation[];
  activeComplex?: QuranComplex | null;
  settings?: AppSettings;
  onNavigateTab?: (tab: string) => void;
}

export const StudentProgressAnalyticsSection: React.FC<StudentProgressAnalyticsSectionProps> = ({
  students,
  evaluations,
  activeComplex,
  settings,
  onNavigateTab
}) => {
  // Complex Theme setup - strictly no green
  const currentTheme = activeComplex?.theme || settings?.theme;
  const themePrimary = currentTheme?.primaryColor || '#131f24';
  const themeSecondary = currentTheme?.secondaryColor || '#1b2e35';
  const themeAccent = currentTheme?.accentColor || '#ffc800';
  const themeCardBg = currentTheme?.cardColor || '#203843';
  const themeBorder = lightenHex(themeCardBg, 0.18);
  const themeBorderBottom = darkenHex(themeCardBg, 0.35);
  const themeAccentShadow = darkenHex(themeAccent, 0.28);
  const accentTextColor = getContrastTextColor(themeAccent);

  // Harmonious theme contrast color for review (sky-cyan, strictly non-green)
  const themeReviewColor = '#38bdf8';
  const themeReviewShadow = '#0284c7';

  // Filters state - default to Bar Chart for crisp, organized daily session comparisons
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all');
  const [metricUnit, setMetricUnit] = useState<'pages' | 'ayahs'>('pages');
  const [chartType, setChartType] = useState<'bar' | 'area'>('bar');
  const [timeRangeDays, setTimeRangeDays] = useState<7 | 14>(7);

  // 1. Calculate Quran Memorization Metrics (Total Ayat, Total Pages, Total Surahs)
  const studentMetricsMap = useMemo(() => {
    const map = new Map<string, {
      totalAyat: number;
      totalPages: number;
      totalSurahs: number;
      surahNames: string[];
      progressPercent: number;
    }>();

    students.forEach(student => {
      const ayatSet = new Set<string>(); // "surah:ayah"
      const completedSurahsSet = new Set<number>();

      // 1. Pages recorded from evaluations and student.completedNewPages
      const pageStats = calculateStudentCompletedPages(student, evaluations);
      const uniquePages = pageStats.uniqueNewPages || [];

      uniquePages.forEach(p => {
        const pageAyahs = getAyahsOnPage(p);
        pageAyahs.forEach(a => {
          ayatSet.add(`${a.surah}:${a.ayah}`);
        });
      });

      // 2. Memorized Juz list (if student has registered juz e.g. [28, 29, 30])
      if (Array.isArray(student.memorizedJuzList) && student.memorizedJuzList.length > 0) {
        student.memorizedJuzList.forEach(juzNum => {
          QURAN_SURAHS.forEach(s => {
            if (s.juz === juzNum) {
              completedSurahsSet.add(s.number);
              for (let a = 1; a <= s.numberOfAyahs; a++) {
                ayatSet.add(`${s.number}:${a}`);
              }
            }
          });
        });
      }

      // 3. Recently completed surahs
      if (Array.isArray(student.recentlyCompletedSurahs)) {
        student.recentlyCompletedSurahs.forEach(rc => {
          if (rc && rc.surahNumber) {
            completedSurahsSet.add(rc.surahNumber);
            const sInfo = getSurahInfo(rc.surahNumber);
            for (let a = 1; a <= sInfo.numberOfAyahs; a++) {
              ayatSet.add(`${rc.surahNumber}:${a}`);
            }
          }
        });
      }

      // 4. Current Surah & Ayah position progress
      if (student.currentSurah) {
        const curSurah = student.currentSurah;
        const curAyah = Math.max(1, student.currentAyah || 1);

        // Typical progression from Juz 30 (Surah 114 down to curSurah)
        if (curSurah >= 78) {
          for (let s = 114; s > curSurah; s--) {
            completedSurahsSet.add(s);
            const sInfo = getSurahInfo(s);
            for (let a = 1; a <= sInfo.numberOfAyahs; a++) {
              ayatSet.add(`${s}:${a}`);
            }
          }
          // In current surah
          for (let a = 1; a <= curAyah; a++) {
            ayatSet.add(`${curSurah}:${a}`);
          }
        } else {
          // Ascending from Al-Baqarah (Surah 2 up to curSurah)
          completedSurahsSet.add(1); // Al-Fatihah
          for (let a = 1; a <= 7; a++) ayatSet.add(`1:${a}`);

          for (let s = 2; s < curSurah; s++) {
            completedSurahsSet.add(s);
            const sInfo = getSurahInfo(s);
            for (let a = 1; a <= sInfo.numberOfAyahs; a++) {
              ayatSet.add(`${s}:${a}`);
            }
          }
          for (let a = 1; a <= curAyah; a++) {
            ayatSet.add(`${curSurah}:${a}`);
          }
        }
      }

      // Check all surahs: if all verses are present in ayatSet, mark surah as completed
      QURAN_SURAHS.forEach(s => {
        if (!completedSurahsSet.has(s.number)) {
          let isFull = true;
          for (let a = 1; a <= s.numberOfAyahs; a++) {
            if (!ayatSet.has(`${s.number}:${a}`)) {
              isFull = false;
              break;
            }
          }
          if (isFull && s.numberOfAyahs > 0) {
            completedSurahsSet.add(s.number);
          }
        }
      });

      const totalAyat = ayatSet.size;
      const totalPages = Math.max(uniquePages.length, Math.round(totalAyat / 10.3));
      const totalSurahs = completedSurahsSet.size;
      const progressPercent = Math.min(100, Math.round((totalAyat / 6236) * 1000) / 10);

      const surahNames = Array.from(completedSurahsSet)
        .sort((a, b) => a - b)
        .map(n => getSurahInfo(n).name);

      map.set(student.id, {
        totalAyat,
        totalPages,
        totalSurahs,
        surahNames,
        progressPercent
      });
    });

    return map;
  }, [students, evaluations]);

  // Aggregate selected view metrics (Single Student or Entire Complex / Halaqah)
  const displayMetrics = useMemo(() => {
    if (selectedStudentId !== 'all') {
      const single = studentMetricsMap.get(selectedStudentId);
      if (single) {
        return {
          totalAyat: single.totalAyat,
          totalPages: single.totalPages,
          totalSurahs: single.totalSurahs,
          progressPercent: single.progressPercent,
          surahNames: single.surahNames,
          isAggregate: false
        };
      }
    }

    // Aggregate across all students
    let sumAyat = 0;
    let sumPages = 0;
    let sumSurahs = 0;
    studentMetricsMap.forEach(m => {
      sumAyat += m.totalAyat;
      sumPages += m.totalPages;
      sumSurahs += m.totalSurahs;
    });

    const avgAyat = students.length > 0 ? Math.round(sumAyat / students.length) : 0;
    const avgPages = students.length > 0 ? Math.round(sumPages / students.length) : 0;
    const avgSurahs = students.length > 0 ? Math.round(sumSurahs / students.length) : 0;
    const avgPercent = students.length > 0 ? Math.round((avgAyat / 6236) * 1000) / 10 : 0;

    return {
      totalAyat: sumAyat,
      totalPages: sumPages,
      totalSurahs: sumSurahs,
      avgAyat,
      avgPages,
      avgSurahs,
      progressPercent: avgPercent,
      isAggregate: true
    };
  }, [selectedStudentId, studentMetricsMap, students]);

  // 2. Trend Chart Data: Clean, well-spaced daily data points with Arabic day names
  const trendData = useMemo(() => {
    const arabicDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const days: string[] = [];

    // Collect dates: generate the timeline for the selected range leading up to today
    const now = new Date();
    for (let i = timeRangeDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      days.push(`${y}-${m}-${day}`);
    }

    // Filter evaluations according to selected student
    const targetEvals = selectedStudentId === 'all'
      ? evaluations
      : evaluations.filter(e => e.studentId === selectedStudentId);

    return days.map(dateStr => {
      const dObj = new Date(dateStr + 'T00:00:00');
      const dayName = arabicDays[dObj.getDay()] || '';
      const dayNum = dObj.getDate();
      const monthNum = dObj.getMonth() + 1;

      // Short, clean display tick that never overlaps horizontally
      const displayTick = timeRangeDays === 7 ? dayName : `${dayNum}/${monthNum}`;
      const fullDateLabel = `${dayName} (${dayNum}/${monthNum})`;

      const dayEvals = targetEvals.filter(e => e.date === dateStr);
      let memPages = 0;
      let revPages = 0;
      let memAyahs = 0;
      let revAyahs = 0;
      const activeStudentsSet = new Set<string>();

      dayEvals.forEach(ev => {
        activeStudentsSet.add(ev.studentId);
        const details = ev.recitationDetails;
        if (!details) return;

        // --- New Memorization Calculation ---
        if (details.todayNewItem && !details.todayNewItem.didNotRecite) {
          const item = details.todayNewItem;
          const pCount = typeof item.pagesCount === 'number' && item.pagesCount > 0
            ? item.pagesCount
            : Math.max(0.5, Math.abs((item.toAyah || 1) - (item.fromAyah || 1) + 1) / 15);
          memPages += pCount;

          const aCount = typeof item.totalAyahs === 'number' && item.totalAyahs > 0
            ? item.totalAyahs
            : Math.max(1, Math.abs((item.toAyah || 1) - (item.fromAyah || 1) + 1));
          memAyahs += aCount;
        } else if (Array.isArray(details.pagesCompletedToday) && details.pagesCompletedToday.length > 0) {
          memPages += details.pagesCompletedToday.length;
          memAyahs += details.pagesCompletedToday.length * 15;
        } else if (details.newMemorizationAchieved && details.newMemorizationAchieved.trim().length > 0) {
          memPages += 1.0;
          memAyahs += 15;
        }

        // --- Review Calculation ---
        if (Array.isArray(details.todayReviewItems) && details.todayReviewItems.length > 0) {
          details.todayReviewItems.forEach(rItem => {
            if (rItem && !rItem.didNotRecite) {
              const pCount = typeof rItem.pagesCount === 'number' && rItem.pagesCount > 0
                ? rItem.pagesCount
                : Math.max(1.0, Math.abs((rItem.toAyah || 1) - (rItem.fromAyah || 1) + 1) / 15);
              revPages += pCount;

              const aCount = typeof rItem.totalAyahs === 'number' && rItem.totalAyahs > 0
                ? rItem.totalAyahs
                : Math.max(3, Math.abs((rItem.toAyah || 1) - (rItem.fromAyah || 1) + 1));
              revAyahs += aCount;
            }
          });
        } else if (details.reviewAchieved && details.reviewAchieved.trim().length > 0) {
          // Realistic portion when student completed review
          revPages += 2.5;
          revAyahs += 35;
        }
      });

      return {
        date: dateStr,
        displayTick,
        fullDateLabel,
        dayName,
        memorizationPages: Math.round(memPages * 10) / 10,
        reviewPages: Math.round(revPages * 10) / 10,
        memorizationAyahs: memAyahs,
        reviewAyahs: revAyahs,
        studentsCount: activeStudentsSet.size,
        evaluationsCount: dayEvals.length
      };
    });
  }, [evaluations, selectedStudentId, timeRangeDays]);

  // Totals for the chart time range
  const chartTotals = useMemo(() => {
    let totalMemPages = 0;
    let totalRevPages = 0;
    let totalMemAyahs = 0;
    let totalRevAyahs = 0;

    trendData.forEach(d => {
      totalMemPages += d.memorizationPages;
      totalRevPages += d.reviewPages;
      totalMemAyahs += d.memorizationAyahs;
      totalRevAyahs += d.reviewAyahs;
    });

    const ratio = totalMemPages > 0 ? (totalRevPages / totalMemPages).toFixed(1) : '0';

    return {
      totalMemPages: Math.round(totalMemPages * 10) / 10,
      totalRevPages: Math.round(totalRevPages * 10) / 10,
      totalMemAyahs,
      totalRevAyahs,
      ratio
    };
  }, [trendData]);

  // Custom Chart Tooltip adhering strictly to theme palette (no green)
  const CustomChartTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      return (
        <div
          className="p-3.5 rounded-2xl border-2 border-b-4 shadow-2xl text-xs space-y-2 backdrop-blur-md"
          style={{
            backgroundColor: `${themeCardBg}fa`,
            borderColor: themeBorder,
            borderBottomColor: themeBorderBottom,
            minWidth: '220px'
          }}
          dir="rtl"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
            <span className="font-black text-white flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" style={{ color: themeAccent }} />
              <span>{dataPoint.fullDateLabel}</span>
            </span>
            <span
              className="px-2 py-0.5 rounded-lg text-[10px] font-black"
              style={{
                backgroundColor: `${themeAccent}20`,
                color: themeAccent
              }}
            >
              {dataPoint.evaluationsCount} تسميع
            </span>
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-200 font-bold">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: themeAccent }} />
                <span>الحفظ الجديد:</span>
              </span>
              <span className="font-black text-white">
                {metricUnit === 'pages' ? `${dataPoint.memorizationPages} وجه` : `${dataPoint.memorizationAyahs} آية`}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-200 font-bold">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: themeReviewColor }} />
                <span>المراجعة والتثبيت:</span>
              </span>
              <span className="font-black text-white">
                {metricUnit === 'pages' ? `${dataPoint.reviewPages} وجه` : `${dataPoint.reviewAyahs} آية`}
              </span>
            </div>
          </div>

          {dataPoint.studentsCount > 0 && selectedStudentId === 'all' && (
            <div className="pt-1.5 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300">
              <span>الطلاب الذين سمّعوا:</span>
              <span className="font-black" style={{ color: themeAccent }}>{dataPoint.studentsCount} طلاب</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const hasAnyActivity = chartTotals.totalMemPages > 0 || chartTotals.totalRevPages > 0;

  return (
    <div
      className="border-2 border-b-4 rounded-[28px] p-5 sm:p-7 shadow-xl space-y-6 transition-all"
      style={{
        backgroundColor: themeCardBg,
        borderColor: themeBorder,
        borderBottomColor: themeBorderBottom
      }}
    >
      {/* 1. Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border-2 border-b-2 text-xs font-black shadow-xs"
              style={{
                backgroundColor: `${themeAccent}20`,
                borderColor: `${themeAccent}60`,
                borderBottomColor: themeAccentShadow,
                color: themeAccent
              }}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>تحليل الإنجاز القرآني الذكي</span>
            </div>

            <span className="text-xs text-slate-300 font-bold">
              • {activeComplex?.name || 'مجمع تحفيظ القرآن الكريم'}
            </span>
          </div>

          <h3 className="text-lg sm:text-xl font-black text-white font-heading flex items-center gap-2">
            <span>متابعة تقدم الحفظ والمراجعة اليومية</span>
            <Sparkles className="w-4 h-4" style={{ color: themeAccent }} />
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 font-medium">
            حساب دقيق لإجمالي الآيات والأوجه والسور المحفوظة ورسم بياني لمسار الحفظ الجديد مقابل المراجعة والتثبيت.
          </p>
        </div>

        {/* Filter Controls Bar in Theme Colors (Strictly no green) */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Student Selector */}
          <div className="relative min-w-[200px] sm:min-w-[240px]">
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full appearance-none px-3.5 py-2.5 pl-9 rounded-2xl text-xs font-black border-2 border-b-4 cursor-pointer transition-all shadow-md focus:outline-none focus:ring-2"
              style={{
                backgroundColor: themeSecondary,
                borderColor: `${themeAccent}60`,
                borderBottomColor: themeBorderBottom,
                color: '#ffffff'
              }}
            >
              <option value="all">📊 جميع طلاب الحلقة (الإجمالي العام)</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  👤 {s.name} ({s.currentSurahName ? `سورة ${s.currentSurahName}` : 'طالب'})
                </option>
              ))}
            </select>
            <ChevronDown
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: themeAccent }}
            />
          </div>

          {/* Metric Toggle: Pages vs Ayat */}
          <div
            className="flex items-center p-1 rounded-2xl border-2 border-b-4 shadow-sm"
            style={{
              backgroundColor: themeSecondary,
              borderColor: themeBorder,
              borderBottomColor: themeBorderBottom
            }}
          >
            <button
              type="button"
              onClick={() => setMetricUnit('pages')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                metricUnit === 'pages' ? 'shadow-sm border-2 border-b-2' : 'text-slate-300 hover:text-white'
              }`}
              style={metricUnit === 'pages' ? {
                backgroundColor: themeAccent,
                color: accentTextColor,
                borderColor: themeAccent,
                borderBottomColor: themeAccentShadow
              } : undefined}
            >
              الأوجه
            </button>
            <button
              type="button"
              onClick={() => setMetricUnit('ayahs')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                metricUnit === 'ayahs' ? 'shadow-sm border-2 border-b-2' : 'text-slate-300 hover:text-white'
              }`}
              style={metricUnit === 'ayahs' ? {
                backgroundColor: themeAccent,
                color: accentTextColor,
                borderColor: themeAccent,
                borderBottomColor: themeAccentShadow
              } : undefined}
            >
              الآيات
            </button>
          </div>

          {/* Time Range Toggle: 7 vs 14 days */}
          <div
            className="flex items-center p-1 rounded-2xl border-2 border-b-4 shadow-sm"
            style={{
              backgroundColor: themeSecondary,
              borderColor: themeBorder,
              borderBottomColor: themeBorderBottom
            }}
          >
            <button
              type="button"
              onClick={() => setTimeRangeDays(7)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                timeRangeDays === 7 ? 'shadow-sm border-2 border-b-2' : 'text-slate-300 hover:text-white'
              }`}
              style={timeRangeDays === 7 ? {
                backgroundColor: themeAccent,
                color: accentTextColor,
                borderColor: themeAccent,
                borderBottomColor: themeAccentShadow
              } : undefined}
            >
              ٧ أيام
            </button>
            <button
              type="button"
              onClick={() => setTimeRangeDays(14)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                timeRangeDays === 14 ? 'shadow-sm border-2 border-b-2' : 'text-slate-300 hover:text-white'
              }`}
              style={timeRangeDays === 14 ? {
                backgroundColor: themeAccent,
                color: accentTextColor,
                borderColor: themeAccent,
                borderBottomColor: themeAccentShadow
              } : undefined}
            >
              ١٤ يوماً
            </button>
          </div>

          {/* Chart Type Toggle: Bar vs Area */}
          <button
            type="button"
            onClick={() => setChartType(prev => prev === 'bar' ? 'area' : 'bar')}
            className="p-2.5 rounded-2xl border-2 border-b-4 active:translate-y-0.5 shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
            style={{
              backgroundColor: themeSecondary,
              borderColor: themeBorder,
              borderBottomColor: themeBorderBottom,
              color: themeAccent
            }}
            title={chartType === 'bar' ? 'التحويل إلى رسم مساحي انسيابي' : 'التحويل إلى أعمدة بيانية'}
          >
            {chartType === 'bar' ? <TrendingUp className="w-4 h-4" /> : <BarChart3 className="w-4 h-4" />}
            <span className="text-[11px] font-black hidden sm:inline">
              {chartType === 'bar' ? 'أعمدة' : 'مساحي'}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Key Metrics 4-Cards Grid (Strict Complex Theme, No Green) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Total Ayat Memorized */}
        <div
          className="p-4 sm:p-5 rounded-2xl border-2 border-b-4 shadow-md transition-all hover:translate-y-[-2px]"
          style={{
            backgroundColor: themeSecondary,
            borderColor: `${themeAccent}50`,
            borderBottomColor: themeBorderBottom
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-200">
              {displayMetrics.isAggregate ? 'إجمالي الآيات المحفوظة' : 'آيات الطالب المحفوظة'}
            </span>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center border-2 border-b-4 shadow-inner"
              style={{
                backgroundColor: `${themeAccent}25`,
                borderColor: `${themeAccent}60`,
                borderBottomColor: themeAccentShadow,
                color: themeAccent
              }}
            >
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-heading">
            {displayMetrics.totalAyat.toLocaleString('ar-SA')}
            <span className="text-xs font-normal text-slate-300 mr-1.5">آية</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] font-bold text-slate-300">
            <span>من 6,236 آية بالمصحف</span>
            <span
              className="px-2 py-0.5 rounded-lg border font-black"
              style={{
                backgroundColor: `${themeAccent}20`,
                borderColor: `${themeAccent}50`,
                color: themeAccent
              }}
            >
              {displayMetrics.progressPercent}%
            </span>
          </div>
          {/* Progress Track */}
          <div className="w-full h-1.5 bg-black/30 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, displayMetrics.progressPercent)}%`,
                backgroundColor: themeAccent
              }}
            />
          </div>
        </div>

        {/* Card 2: Total Pages Memorized */}
        <div
          className="p-4 sm:p-5 rounded-2xl border-2 border-b-4 shadow-md transition-all hover:translate-y-[-2px]"
          style={{
            backgroundColor: themeSecondary,
            borderColor: `${themeReviewColor}40`,
            borderBottomColor: themeBorderBottom
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-200">
              {displayMetrics.isAggregate ? 'إجمالي الأوجه والصفحات' : 'أوجه الطالب المحفوظة'}
            </span>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center border-2 border-b-4 shadow-inner"
              style={{
                backgroundColor: `${themeReviewColor}25`,
                borderColor: `${themeReviewColor}60`,
                borderBottomColor: themeReviewShadow,
                color: themeReviewColor
              }}
            >
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-heading">
            {displayMetrics.totalPages.toLocaleString('ar-SA')}
            <span className="text-xs font-normal text-slate-300 mr-1.5">وجهاً</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] font-bold text-slate-300">
            <span>مصحف مجمع الملك فهد</span>
            <span
              className="px-2 py-0.5 rounded-lg border font-black"
              style={{
                backgroundColor: `${themeReviewColor}20`,
                borderColor: `${themeReviewColor}50`,
                color: themeReviewColor
              }}
            >
              {Math.min(100, Math.round((displayMetrics.totalPages / 604) * 100))}%
            </span>
          </div>
          {/* Progress Track */}
          <div className="w-full h-1.5 bg-black/30 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (displayMetrics.totalPages / 604) * 100)}%`,
                backgroundColor: themeReviewColor
              }}
            />
          </div>
        </div>

        {/* Card 3: Total Surahs Memorized */}
        <div
          className="p-4 sm:p-5 rounded-2xl border-2 border-b-4 shadow-md transition-all hover:translate-y-[-2px]"
          style={{
            backgroundColor: themeSecondary,
            borderColor: `${themeAccent}50`,
            borderBottomColor: themeBorderBottom
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-200">
              {displayMetrics.isAggregate ? 'إجمالي السور المنجزة' : 'السور المكتملة للطالب'}
            </span>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center border-2 border-b-4 shadow-inner"
              style={{
                backgroundColor: `${themeAccent}25`,
                borderColor: `${themeAccent}60`,
                borderBottomColor: themeAccentShadow,
                color: themeAccent
              }}
            >
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-heading">
            {displayMetrics.totalSurahs.toLocaleString('ar-SA')}
            <span className="text-xs font-normal text-slate-300 mr-1.5">سورة</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] font-bold text-slate-300">
            <span>من 114 سورة كاملة</span>
            <span
              className="px-2 py-0.5 rounded-lg border font-black"
              style={{
                backgroundColor: `${themeAccent}20`,
                borderColor: `${themeAccent}50`,
                color: themeAccent
              }}
            >
              {Math.min(100, Math.round((displayMetrics.totalSurahs / 114) * 100))}%
            </span>
          </div>
          {/* Progress Track */}
          <div className="w-full h-1.5 bg-black/30 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (displayMetrics.totalSurahs / 114) * 100)}%`,
                backgroundColor: themeAccent
              }}
            />
          </div>
        </div>

        {/* Card 4: Daily Memorization vs Review Ratio */}
        <div
          className="p-4 sm:p-5 rounded-2xl border-2 border-b-4 shadow-md transition-all hover:translate-y-[-2px]"
          style={{
            backgroundColor: themeSecondary,
            borderColor: `${themeAccent}50`,
            borderBottomColor: themeBorderBottom
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-200">نسبة المراجعة للحفظ</span>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center border-2 border-b-4 shadow-inner"
              style={{
                backgroundColor: `${themeAccent}25`,
                borderColor: `${themeAccent}60`,
                borderBottomColor: themeAccentShadow,
                color: themeAccent
              }}
            >
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white font-heading">
            {chartTotals.ratio} : 1
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] font-bold text-slate-300">
            <span>{timeRangeDays === 7 ? 'خلال أسبوع' : 'خلال أسبوعين'}</span>
            <span
              className="px-2 py-0.5 rounded-lg border font-black"
              style={{
                backgroundColor: parseFloat(chartTotals.ratio) >= 2 ? `${themeAccent}25` : `${themeReviewColor}25`,
                borderColor: parseFloat(chartTotals.ratio) >= 2 ? `${themeAccent}60` : `${themeReviewColor}60`,
                color: parseFloat(chartTotals.ratio) >= 2 ? themeAccent : themeReviewColor
              }}
            >
              {parseFloat(chartTotals.ratio) >= 2 ? 'تثبيت متزن' : 'حفظ نشط'}
            </span>
          </div>
          {/* Ratio bar */}
          <div className="w-full h-1.5 bg-black/30 rounded-full mt-2 flex overflow-hidden">
            <div
              className="h-full"
              style={{
                width: `${Math.max(20, Math.min(80, 100 / (1 + parseFloat(chartTotals.ratio || '1'))))}%`,
                backgroundColor: themeAccent
              }}
              title="حفظ جديد"
            />
            <div
              className="h-full flex-1"
              style={{ backgroundColor: themeReviewColor }}
              title="مراجعة وتثبيت"
            />
          </div>
        </div>
      </div>

      {/* 3. Trend Chart Container: Daily Memorization vs. Review Activity */}
      <div
        className="p-5 sm:p-6 rounded-2xl border-2 border-b-4 shadow-lg space-y-4"
        style={{
          backgroundColor: themeSecondary,
          borderColor: themeBorder,
          borderBottomColor: themeBorderBottom
        }}
      >
        {/* Header with Title and Clear Legend Chips */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="space-y-1">
            <h4 className="text-sm sm:text-base font-black text-white font-heading flex items-center gap-2">
              <TrendingUp className="w-4 h-4" style={{ color: themeAccent }} />
              <span>
                منحنى نشاط الحفظ والمراجعة اليومي ({timeRangeDays === 7 ? 'آخر ٧ أيام' : 'آخر ١٤ يوماً'})
              </span>
            </h4>
            <p className="text-xs text-slate-300 font-medium">
              مقارنة حجم التسميع اليومي: الحفظ الجديد (ذهبي) مقابل المراجعة والتثبيت (أزرق سماوي).
            </p>
          </div>

          {/* Interactive Legend Chips */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 border-b-2 text-xs font-black shadow-xs"
              style={{
                backgroundColor: `${themeAccent}18`,
                borderColor: `${themeAccent}50`,
                borderBottomColor: themeAccentShadow,
                color: themeAccent
              }}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: themeAccent }} />
              <span className="text-slate-200 font-bold">الحفظ الجديد:</span>
              <span className="font-extrabold text-white">
                {metricUnit === 'pages' ? `${chartTotals.totalMemPages} وجه` : `${chartTotals.totalMemAyahs} آية`}
              </span>
            </div>

            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 border-b-2 text-xs font-black shadow-xs"
              style={{
                backgroundColor: `${themeReviewColor}18`,
                borderColor: `${themeReviewColor}50`,
                borderBottomColor: themeReviewShadow,
                color: themeReviewColor
              }}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: themeReviewColor }} />
              <span className="text-slate-200 font-bold">المراجعة والتثبيت:</span>
              <span className="font-extrabold text-white">
                {metricUnit === 'pages' ? `${chartTotals.totalRevPages} وجه` : `${chartTotals.totalRevAyahs} آية`}
              </span>
            </div>
          </div>
        </div>

        {/* Recharts Container: Clean SVG with proper spacing, zero overlapping text */}
        <div className="w-full min-h-[280px] h-[280px] pt-3">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'bar' ? (
              <BarChart
                data={trendData}
                margin={{ top: 16, right: 16, left: 0, bottom: 20 }}
                barGap={6}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={lightenHex(themeCardBg, 0.12)}
                  opacity={0.4}
                  vertical={false}
                />
                <XAxis
                  dataKey="displayTick"
                  stroke="#94a3b8"
                  fontSize={11}
                  fontWeight={700}
                  tickLine={false}
                  dy={8}
                  interval={0}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  fontWeight={700}
                  tickLine={false}
                  width={34}
                  allowDecimals={metricUnit === 'pages'}
                  domain={[0, (dataMax: number) => Math.max(metricUnit === 'pages' ? 4 : 40, Math.ceil(dataMax * 1.25))]}
                  tickCount={5}
                />
                <Tooltip content={<CustomChartTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                <Bar
                  dataKey={metricUnit === 'pages' ? 'memorizationPages' : 'memorizationAyahs'}
                  name="الحفظ الجديد"
                  fill={themeAccent}
                  radius={[6, 6, 0, 0]}
                  barSize={timeRangeDays === 7 ? 22 : 12}
                />
                <Bar
                  dataKey={metricUnit === 'pages' ? 'reviewPages' : 'reviewAyahs'}
                  name="المراجعة والتثبيت"
                  fill={themeReviewColor}
                  radius={[6, 6, 0, 0]}
                  barSize={timeRangeDays === 7 ? 22 : 12}
                />
              </BarChart>
            ) : (
              <AreaChart
                data={trendData}
                margin={{ top: 16, right: 16, left: 0, bottom: 20 }}
              >
                <defs>
                  <linearGradient id="omranMemGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={themeAccent} stopOpacity={0.45} />
                    <stop offset="95%" stopColor={themeAccent} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="omranRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={themeReviewColor} stopOpacity={0.45} />
                    <stop offset="95%" stopColor={themeReviewColor} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={lightenHex(themeCardBg, 0.12)}
                  opacity={0.4}
                  vertical={false}
                />
                <XAxis
                  dataKey="displayTick"
                  stroke="#94a3b8"
                  fontSize={11}
                  fontWeight={700}
                  tickLine={false}
                  dy={8}
                  interval={0}
                />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  fontWeight={700}
                  tickLine={false}
                  width={34}
                  allowDecimals={metricUnit === 'pages'}
                  domain={[0, (dataMax: number) => Math.max(metricUnit === 'pages' ? 4 : 40, Math.ceil(dataMax * 1.25))]}
                  tickCount={5}
                />
                <Tooltip content={<CustomChartTooltip />} />
                {/* Clean curves with dot={false} to eliminate zero-line dot clutter */}
                <Area
                  type="monotone"
                  dataKey={metricUnit === 'pages' ? 'memorizationPages' : 'memorizationAyahs'}
                  name="الحفظ الجديد"
                  stroke={themeAccent}
                  strokeWidth={2.5}
                  fill="url(#omranMemGrad)"
                  dot={false}
                  activeDot={{ r: 5, stroke: '#ffffff', strokeWidth: 2, fill: themeAccent }}
                />
                <Area
                  type="monotone"
                  dataKey={metricUnit === 'pages' ? 'reviewPages' : 'reviewAyahs'}
                  name="المراجعة والتثبيت"
                  stroke={themeReviewColor}
                  strokeWidth={2.5}
                  fill="url(#omranRevGrad)"
                  dot={false}
                  activeDot={{ r: 5, stroke: '#ffffff', strokeWidth: 2, fill: themeReviewColor }}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* 4. Pedagogical Insight Banner */}
        <div
          className="p-3.5 sm:p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
          style={{
            backgroundColor: `${themeCardBg}80`,
            borderColor: `${themeAccent}30`
          }}
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 shrink-0" style={{ color: themeAccent }} />
            <span className="text-slate-200 font-bold leading-relaxed">
              {hasAnyActivity ? (
                parseFloat(chartTotals.ratio) >= 2 ? (
                  <span>
                    <strong>توازن منهجي مثالي:</strong> تلتزم الحلقة بالنسبة الذهبية للتحفيظ القرآني (ضعفي المراجعة لكل حفظ جديد) لضمان رسوخ المحفوظ وصيانة المتون.
                  </span>
                ) : (
                  <span>
                    <strong>توجيه إثرائي:</strong> وتيرة الحفظ الجديد تتقارب مع المراجعة، يوصى بزيادة مقدار المراجعة اليومية لتثبيت السور السابقة وحمايتها من التفلت.
                  </span>
                )
              ) : (
                <span>
                  <strong>جاهزية الرصد:</strong> يتم تحديث المنحنى البياني التفاعلي تلقائياً فور رصد أي تسميع يومي للطلاب في الحلقة.
                </span>
              )}
            </span>
          </div>

          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('evaluation')}
              className="text-xs font-black cursor-pointer hover:underline flex items-center gap-1 shrink-0 self-end sm:self-auto"
              style={{ color: themeAccent }}
            >
              <span>تسجيل تسميع جديد</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
