import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  Sparkles,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  CheckCircle2,
  Layers,
  Award,
  AlertTriangle,
  RotateCcw,
  Check,
  Flame,
  TrendingUp,
  Volume2
} from 'lucide-react';
import { QURAN_SURAHS, getSurahInfo } from '../../data/quranData';
import {
  ALL_PAGES,
  SURAH_START_PAGE_MAP,
  getKingFahdPageInfo,
  getPageOfAyah,
  formatPageTitle,
  QuranPageInfo
} from '../../data/quranPagesData';
import { loadAllQuranVerses, getSurahVerses } from '../../lib/quranTextService';
import { Student, AyahErrorRecord, StudentMemorizationPlan } from '../../types';

export interface QuranHighlightItem {
  id: string;
  title: string; // e.g. "الحفظ الجديد" | "المراجعة الصغرى" | "مقرر الغد"
  surahNumber: number;
  fromAyah: number;
  toSurahNumber?: number;
  toAyah: number;
}

interface KingFahdQuranModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSurah?: number;
  initialAyah?: number;
  initialPage?: number;
  highlightItems?: QuranHighlightItem[];
  activeItemId?: string;
  activeStudent?: Student | null;
  onUpdateStudentErrors?: (errors: AyahErrorRecord[]) => void;
  onSaveStudent?: (student: Student) => Promise<void> | void;
}

// Convert numbers to Arabic Eastern digits: 1 -> ١
export function toArabicNumerals(n: number): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return n.toString().replace(/\d/g, d => arabicDigits[parseInt(d, 10)] || d);
}

export const KingFahdQuranModal: React.FC<KingFahdQuranModalProps> = ({
  isOpen,
  onClose,
  initialSurah = 78,
  initialAyah = 1,
  initialPage,
  highlightItems = [],
  activeItemId,
  activeStudent,
  onUpdateStudentErrors,
  onSaveStudent
}) => {
  // Determine starting page
  const resolvedStartPage = useMemo(() => {
    if (initialPage && initialPage >= 1 && initialPage <= 604) {
      return initialPage;
    }
    return getPageOfAyah(initialSurah, initialAyah);
  }, [initialPage, initialSurah, initialAyah]);

  const [currentPage, setCurrentPage] = useState<number>(resolvedStartPage);
  const [fontSize, setFontSize] = useState<number>(24); // px for Quranic text
  const [selectedHighlightId, setSelectedHighlightId] = useState<string>(activeItemId || (highlightItems[0]?.id || ''));
  const [showAllPortionsTogether, setShowAllPortionsTogether] = useState<boolean>(true);
  const [quranMap, setQuranMap] = useState<Record<number, string[]>>({});
  const [isLoadingVerses, setIsLoadingVerses] = useState<boolean>(true);
  const [searchPageInput, setSearchPageInput] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const modalContainerRef = useRef<HTMLDivElement | null>(null);
  const mushafScrollRef = useRef<HTMLDivElement | null>(null);

  // Status Toast for teacher actions
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // 2.5s Long-press handling for marking Ayah error
  const [pressedAyah, setPressedAyah] = useState<{ surahNumber: number; ayahNumber: number } | null>(null);
  const [pressProgress, setPressProgress] = useState<number>(0);
  const longPressTimerRef = useRef<any>(null);
  const progressIntervalRef = useRef<any>(null);

  // Selected ayah action popover (if teacher clicks to edit mistake)
  const [selectedAyahAction, setSelectedAyahAction] = useState<{
    surahNumber: number;
    ayahNumber: number;
    ayahText: string;
    existingError?: AyahErrorRecord;
  } | null>(null);

  // Local student errors state synced with activeStudent?.mushafErrors
  const [localErrors, setLocalErrors] = useState<AyahErrorRecord[]>(activeStudent?.mushafErrors || []);

  useEffect(() => {
    setLocalErrors(activeStudent?.mushafErrors || []);
  }, [activeStudent?.mushafErrors]);

  // STABLE OPEN EFFECT: Only sync starting page when modal transitions from closed to open,
  // or when teacher explicitly switches to a different recitation item from outside!
  const prevIsOpenRef = useRef<boolean>(false);
  const lastActiveItemIdRef = useRef<string | undefined>(activeItemId);

  useEffect(() => {
    const isFirstOpen = isOpen && !prevIsOpenRef.current;
    const isNewItemTarget = isOpen && activeItemId && activeItemId !== lastActiveItemIdRef.current;

    if (isFirstOpen || isNewItemTarget) {
      setCurrentPage(resolvedStartPage);
      if (activeItemId) {
        setSelectedHighlightId(activeItemId);
      } else if (highlightItems[0]?.id) {
        setSelectedHighlightId(highlightItems[0].id);
      }
    }
    prevIsOpenRef.current = isOpen;
    lastActiveItemIdRef.current = activeItemId;
  }, [isOpen, resolvedStartPage, activeItemId, highlightItems]);

  // Active Highlight Item
  const activeHighlight = useMemo(() => {
    return highlightItems.find(h => h.id === selectedHighlightId) || highlightItems[0] || null;
  }, [highlightItems, selectedHighlightId]);

  // Ensure verses for current page are loaded
  const pageInfo: QuranPageInfo = useMemo(() => {
    return getKingFahdPageInfo(currentPage);
  }, [currentPage]);

  // Target Ayah and Surah to focus and scroll down to on this page
  const targetSurahNum = useMemo(() => {
    if (activeHighlight && getPageOfAyah(activeHighlight.surahNumber, activeHighlight.fromAyah) === currentPage) {
      return activeHighlight.surahNumber;
    }
    if (getPageOfAyah(initialSurah, initialAyah) === currentPage) {
      return initialSurah;
    }
    return pageInfo.startSurah;
  }, [activeHighlight, currentPage, initialSurah, initialAyah, pageInfo]);

  const targetAyahNum = useMemo(() => {
    if (activeHighlight && getPageOfAyah(activeHighlight.surahNumber, activeHighlight.fromAyah) === currentPage) {
      return activeHighlight.fromAyah;
    }
    if (getPageOfAyah(initialSurah, initialAyah) === currentPage) {
      return initialAyah;
    }
    return pageInfo.startAyah;
  }, [activeHighlight, currentPage, initialSurah, initialAyah, pageInfo]);

  // Load complete authentic Uthmani Quran verses
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    setIsLoadingVerses(true);

    loadAllQuranVerses()
      .then(data => {
        if (isMounted && data) {
          setQuranMap(data);
        }
      })
      .catch(err => {
        console.warn('Could not load bundled verses, will fetch on demand:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingVerses(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    for (let sNum = pageInfo.startSurah; sNum <= pageInfo.endSurah; sNum++) {
      if (!quranMap[sNum]) {
        getSurahVerses(sNum).then(v => {
          setQuranMap(prev => ({ ...prev, [sNum]: v }));
        });
      }
    }
  }, [isOpen, pageInfo, quranMap]);

  // Switch to another highlight item and jump straight to its start page
  const handleSelectHighlightItem = (item: QuranHighlightItem) => {
    setSelectedHighlightId(item.id);
    const targetPage = getPageOfAyah(item.surahNumber, item.fromAyah);
    setCurrentPage(targetPage);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < 604) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleJumpToSurah = (surahNum: number) => {
    const page = SURAH_START_PAGE_MAP[surahNum] || getPageOfAyah(surahNum, 1);
    setCurrentPage(page);
  };

  const handleSearchPageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(searchPageInput, 10);
    if (!isNaN(p) && p >= 1 && p <= 604) {
      setCurrentPage(p);
      setSearchPageInput('');
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        if (currentPage < 604) setCurrentPage(p => p + 1);
      } else if (e.key === 'ArrowRight') {
        if (currentPage > 1) setCurrentPage(p => p - 1);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentPage, onClose]);

  // Helper: check if ayah is inside a portion (supports forward and reverse multi-surah ranges)
  const isAyahInPortion = (item: QuranHighlightItem, surahNum: number, ayahNum: number): boolean => {
    const rawStartS = item.surahNumber;
    const rawStartA = item.fromAyah;
    const rawEndS = item.toSurahNumber || rawStartS;
    const rawEndA = item.toAyah;

    // Single-surah portion
    if (rawStartS === rawEndS) {
      const minA = Math.min(rawStartA, rawEndA);
      const maxA = Math.max(rawStartA, rawEndA);
      return surahNum === rawStartS && ayahNum >= minA && ayahNum <= maxA;
    }

    const minS = Math.min(rawStartS, rawEndS);
    const maxS = Math.max(rawStartS, rawEndS);

    // Any intermediate surah is 100% inside the portion
    if (surahNum > minS && surahNum < maxS) {
      return true;
    }

    // At the lower-numbered boundary surah
    if (surahNum === minS) {
      if (rawStartS < rawEndS) {
        // Forward: starts at rawStartA
        return ayahNum >= rawStartA;
      } else {
        // Backward (e.g. from 114 An-Nas down to 104 Al-Humazah): ends at rawEndA
        return ayahNum <= rawEndA;
      }
    }

    // At the higher-numbered boundary surah
    if (surahNum === maxS) {
      if (rawStartS < rawEndS) {
        // Forward: ends at rawEndA
        return ayahNum <= rawEndA;
      } else {
        // Backward (e.g. from 114 down to 104): starts at rawStartA
        return ayahNum >= rawStartA;
      }
    }

    return false;
  };

  // Record Ayah Mistake (Long press 2.5s or explicit click)
  const handleRecordAyahMistake = (surahNumber: number, ayahNumber: number, ayahText?: string) => {
    if (!activeStudent) return;
    const sInfo = getSurahInfo(surahNumber);
    let nextCount = 1;
    let updated: AyahErrorRecord[] = [];
    const existingIndex = localErrors.findIndex(e => e.surahNumber === surahNumber && e.ayahNumber === ayahNumber);

    if (existingIndex >= 0) {
      const existing = localErrors[existingIndex];
      nextCount = (existing.errorCount || 1) + 1;
      const updatedItem: AyahErrorRecord = {
        ...existing,
        errorCount: nextCount,
        lastErrorDate: new Date().toISOString(),
        cleared: false
      };
      updated = [...localErrors];
      updated[existingIndex] = updatedItem;
    } else {
      const newErr: AyahErrorRecord = {
        id: `err_${activeStudent.id}_${surahNumber}_${ayahNumber}_${Date.now()}`,
        studentId: activeStudent.id,
        surahNumber,
        ayahNumber,
        surahName: sInfo.name,
        ayahText: ayahText || `آية (${ayahNumber}) من سورة ${sInfo.name}`,
        errorCount: 1,
        lastErrorDate: new Date().toISOString(),
        cleared: false
      };
      updated = [newErr, ...localErrors];
    }

    setLocalErrors(updated);
    if (onUpdateStudentErrors) onUpdateStudentErrors(updated);
    if (onSaveStudent) {
      onSaveStudent({
        ...activeStudent,
        mushafErrors: updated
      });
    }

    // Gentle tactile haptic feedback
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([120, 60, 120]);
      }
    } catch (e) {}

    showToast(`تم تسجيل خطأ للطالب ${activeStudent.name} في سورة ${sInfo.name} آية (${toArabicNumerals(ayahNumber)}) للمرة (${toArabicNumerals(nextCount)}) ❌`, 'error');
  };

  // Clear / Fix Ayah Mistake
  const handleClearAyahMistake = (surahNumber: number, ayahNumber: number) => {
    if (!activeStudent) return;
    const updated = localErrors.filter(e => !(e.surahNumber === surahNumber && e.ayahNumber === ayahNumber));
    setLocalErrors(updated);
    if (onUpdateStudentErrors) onUpdateStudentErrors(updated);
    if (onSaveStudent) {
      onSaveStudent({
        ...activeStudent,
        mushafErrors: updated
      });
    }
    setSelectedAyahAction(null);
    showToast(`تم إزالة الخطأ وتثبيت الآية (${toArabicNumerals(ayahNumber)}) بنجاح للطالب ✓`, 'success');
  };

  // Start Long-Press (2.5 seconds per user request)
  const handlePointerDown = (surahNumber: number, ayahNumber: number, ayahText: string) => {
    if (!activeStudent) return;
    setPressedAyah({ surahNumber, ayahNumber });
    setPressProgress(0);

    const startTime = Date.now();
    const duration = 2500; // 2.5 seconds hold

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setPressProgress(pct);
    }, 40);

    longPressTimerRef.current = setTimeout(() => {
      handleRecordAyahMistake(surahNumber, ayahNumber, ayahText);
      handlePointerUp();
    }, duration);
  };

  const handlePointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setPressedAyah(null);
    setPressProgress(0);
  };

  const showToast = (text: string, type: 'success' | 'error' | 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3800);
  };

  // Determine Ayah styling
  const getAyahStyleInfo = (surahNum: number, ayahNum: number) => {
    // 1. Error on this Ayah for active student (Top Priority)
    const err = localErrors.find(e => e.surahNumber === surahNum && e.ayahNumber === ayahNum && !e.cleared);
    if (err) {
      return {
        category: 'error',
        errorCount: err.errorCount,
        title: `خطأ مرصود في التسميع (${err.errorCount} مرات)`,
        className: 'bg-rose-500/30 text-rose-950 font-black border-2 border-rose-600 shadow-[0_0_12px_rgba(244,63,94,0.6)] ring-2 ring-rose-500/40'
      };
    }

    // 2. Active highlighted portion
    if (activeHighlight && isAyahInPortion(activeHighlight, surahNum, ayahNum)) {
      const isNew = activeHighlight.id === 'new_today' || activeHighlight.title.includes('جديد');
      const isTom = activeHighlight.id === 'new_tomorrow' || activeHighlight.title.includes('غد');
      if (isNew) {
        return {
          category: 'new',
          title: 'الحفظ الجديد',
          className: 'bg-emerald-500/30 text-emerald-950 font-bold border-2 border-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.35)]'
        };
      }
      if (isTom) {
        return {
          category: 'tomorrow',
          title: 'مقرر الغد',
          className: 'bg-sky-500/30 text-sky-950 font-bold border-2 border-sky-600 shadow-[0_0_10px_rgba(14,165,233,0.35)]'
        };
      }
      return {
        category: 'review',
        title: activeHighlight.title,
        className: 'bg-amber-400/35 text-amber-950 font-bold border-2 border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.35)]'
      };
    }

    // 3. Multi-portion simultaneous display
    if (showAllPortionsTogether && highlightItems.length > 0) {
      for (const item of highlightItems) {
        if (isAyahInPortion(item, surahNum, ayahNum)) {
          const isNew = item.id === 'new_today' || item.title.includes('جديد');
          const isTom = item.id === 'new_tomorrow' || item.title.includes('غد');
          if (isNew) {
            return {
              category: 'new',
              title: 'الحفظ الجديد',
              className: 'bg-emerald-500/25 text-emerald-950 font-bold border border-emerald-500 shadow-xs'
            };
          }
          if (isTom) {
            return {
              category: 'tomorrow',
              title: 'مقرر الغد',
              className: 'bg-sky-500/25 text-sky-950 font-bold border border-sky-500 shadow-xs'
            };
          }
          return {
            category: 'review',
            title: item.title,
            className: 'bg-amber-400/25 text-amber-950 font-bold border border-amber-500 shadow-xs'
          };
        }
      }
    }

    return {
      category: 'normal',
      className: 'hover:bg-amber-100/70'
    };
  };

  // Build the array of sections/surahs to render on this page
  const pageSections = useMemo(() => {
    const sections: Array<{
      surahNumber: number;
      surahInfo: ReturnType<typeof getSurahInfo>;
      startAyah: number;
      endAyah: number;
      isSurahBeginning: boolean;
      ayahs: Array<{ ayahNumber: number; text: string }>;
    }> = [];

    const { startSurah, startAyah, endSurah, endAyah } = pageInfo;

    for (let sNum = startSurah; sNum <= endSurah; sNum++) {
      const sInfo = getSurahInfo(sNum);
      const isStartSurah = sNum === startSurah;
      const isEndSurah = sNum === endSurah;

      const fromA = isStartSurah ? startAyah : 1;
      const toA = isEndSurah ? endAyah : sInfo.numberOfAyahs;
      const isBeginning = fromA === 1;

      const verses = quranMap[sNum] || [];
      const ayahList: Array<{ ayahNumber: number; text: string }> = [];

      for (let a = fromA; a <= toA; a++) {
        let rawText = verses[a - 1] || '';
        if (!rawText) {
          rawText = `آية (${a}) من سورة ${sInfo.name}`;
        }
        rawText = rawText.replace(/^\ufeff/, '').trim();
        if (a === 1 && sNum !== 1 && sNum !== 9) {
          rawText = rawText.replace(/^بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ\s*/, '').replace(/^بِسْمِ اللهِ الرَّحْمَنِ الرَّحِيمِ\s*/, '');
        }

        ayahList.push({
          ayahNumber: a,
          text: rawText
        });
      }

      sections.push({
        surahNumber: sNum,
        surahInfo: sInfo,
        startAyah: fromA,
        endAyah: toA,
        isSurahBeginning: isBeginning,
        ayahs: ayahList
      });
    }

    return sections;
  }, [pageInfo, quranMap]);

  // Student Khatmah Progress metrics
  const khatmahMetrics = useMemo(() => {
    if (!activeStudent) return null;
    const completedPagesCount = activeStudent.completedNewPages?.length || Math.max(1, Math.round((activeStudent.currentSurah || 1) * 5.2));
    const totalPages = 604;
    const remainingPages = Math.max(0, totalPages - completedPagesCount);
    const pct = Math.min(100, Math.round((completedPagesCount / totalPages) * 100));

    // Calculate pace
    const dailyPace = activeStudent.memorizationPlan?.dailyNewPages || 1;
    const daysRemaining = Math.ceil(remainingPages / Math.max(0.5, dailyPace));
    const monthsRemaining = Math.max(1, Math.round(daysRemaining / 30));

    const totalMistakesCount = localErrors.reduce((sum, e) => sum + (e.cleared ? 0 : (e.errorCount || 1)), 0);

    return {
      completedPagesCount,
      totalPages,
      remainingPages,
      pct,
      dailyPace,
      monthsRemaining,
      totalMistakesCount
    };
  }, [activeStudent, localErrors]);

  if (!isOpen) return null;

  return (
    <div
      ref={modalContainerRef}
      className={`fixed inset-0 z-[99999] flex flex-col bg-black/95 backdrop-blur-md overflow-hidden text-right select-none ${
        isFullscreen ? 'p-0' : 'p-2 sm:p-4'
      }`}
      dir="rtl"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100000] px-5 py-3 rounded-2xl border-2 border-b-4 text-xs sm:text-sm font-black shadow-2xl flex items-center gap-3 animate-bounce select-none ${
            toastMessage.type === 'error'
              ? 'bg-rose-950 text-rose-200 border-rose-500'
              : toastMessage.type === 'success'
              ? 'bg-emerald-950 text-emerald-200 border-emerald-500'
              : 'bg-amber-950 text-amber-200 border-amber-500'
          }`}
        >
          {toastMessage.type === 'error' ? <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" /> : <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Quran Modal Main Wrapper */}
      <div className="bg-[#022c22] border-2 border-[#fbbf24]/50 rounded-3xl w-full h-full max-w-5xl mx-auto flex flex-col shadow-2xl overflow-hidden relative">
        {/* ========================================================================= */}
        {/* 1. TOP CONTROL BAR & ITEM SWITCHER                                        */}
        {/* ========================================================================= */}
        <div className="bg-gradient-to-r from-[#064e3b] via-[#022c22] to-[#064e3b] border-b border-[#065f46] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {/* Right: Title & Mushaf King Fahd Badge */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#fbbf24]/20 border border-[#fbbf24]/40 text-[#fbbf24] flex items-center justify-center shadow-sm shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black font-heading text-white">
                  مصحف مجمع الملك فهد لطباعة المصحف الشريف
                </h3>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fbbf24] text-[#064e3b]">
                  طبعة معتمدة 604 أوجه
                </span>
              </div>
              <p className="text-[11px] text-[#86efac]/90">
                الجزء {pageInfo.juz} • {pageInfo.surahNames.join('، ')} • الوجه {currentPage} من 604
              </p>
            </div>
          </div>

          {/* Center: Highlight Items Switcher (New vs Reviews vs Tomorrow) */}
          {highlightItems.length > 0 && (
            <div className="flex items-center gap-1.5 bg-[#022c22] p-1 rounded-2xl border border-[#065f46] overflow-x-auto max-w-md">
              <button
                type="button"
                onClick={() => setShowAllPortionsTogether(!showAllPortionsTogether)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  showAllPortionsTogether
                    ? 'bg-emerald-600 text-white font-black shadow-xs'
                    : 'text-slate-300 hover:text-white bg-[#064e3b]/40'
                }`}
                title="تلوين الحفظ الجديد والمراجعة ومقرر الغد معاً"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>عرض الكل معاً</span>
              </button>

              {highlightItems.map(item => {
                const isSelected = item.id === selectedHighlightId;
                const isNew = item.id === 'new_today' || item.title.includes('جديد');
                const isTom = item.id === 'new_tomorrow' || item.title.includes('غد');
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectHighlightItem(item)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                      isSelected
                        ? isNew ? 'bg-emerald-500 text-slate-950 font-black' : isTom ? 'bg-sky-400 text-slate-950 font-black' : 'bg-[#fbbf24] text-[#064e3b] font-black'
                        : 'text-[#86efac]/80 hover:text-white hover:bg-[#064e3b]/50'
                    }`}
                  >
                    <span>{item.title}</span>
                    <span className="text-[10px] opacity-75 font-mono">
                      (ص {getPageOfAyah(item.surahNumber, item.fromAyah)})
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Left Actions: Font Size, Fullscreen, Close */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#022c22] border border-[#065f46] rounded-xl px-1.5 py-1">
              <button
                type="button"
                onClick={() => setFontSize(s => Math.max(18, s - 2))}
                className="p-1 text-slate-300 hover:text-white rounded-lg hover:bg-white/10"
                title="تصغير الخط"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-bold text-amber-300 px-1">{fontSize}</span>
              <button
                type="button"
                onClick={() => setFontSize(s => Math.min(38, s + 2))}
                className="p-1 text-slate-300 hover:text-white rounded-lg hover:bg-white/10"
                title="تكبير الخط"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 border border-[#065f46]"
              title={isFullscreen ? 'تصغير الشاشة' : 'ملء الشاشة'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-300 hover:text-rose-400 rounded-xl hover:bg-rose-500/20 border border-[#065f46]"
              title="إغلاق المصحف"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. KHATMAH & ADAPTIVE MEMORIZATION PLAN STRIP                             */}
        {/* ========================================================================= */}
        {activeStudent && khatmahMetrics && (
          <div className="bg-gradient-to-r from-[#021e17] via-[#064e3b] to-[#021e17] border-b border-[#065f46] px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-amber-400/20 border border-amber-400/40 text-amber-300 flex items-center justify-center font-black">
                <Flame className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-white">
                  مصحف وتسميع الطالب: <span className="text-amber-300">{activeStudent.name}</span>
                </span>
                <span className="text-[11px] text-emerald-200">
                  • أنجز {toArabicNumerals(khatmahMetrics.completedPagesCount)} من {toArabicNumerals(604)} وجهاً ({khatmahMetrics.pct}٪)
                </span>
                <span className="text-[11px] text-amber-200/90 font-bold">
                  • متبقٍ {toArabicNumerals(khatmahMetrics.remainingPages)} وجهاً للختمة (ختمة متوقعة بعد {toArabicNumerals(khatmahMetrics.monthsRemaining)} شهر)
                </span>
                {khatmahMetrics.totalMistakesCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold text-[10px] flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-rose-400" />
                    <span>مرصود {toArabicNumerals(khatmahMetrics.totalMistakesCount)} خطأ في التسميع</span>
                  </span>
                )}
              </div>
            </div>

            {/* Hold hint */}
            <div className="hidden md:flex items-center gap-2 text-[11px] text-emerald-300 bg-[#022c22] px-3 py-1 rounded-xl border border-emerald-500/30">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>لرصد خطأ: علّق على الآية لمدة ثانيتين ونصف ⏱️ أو انقر عليها لتعديل الخطأ</span>
            </div>
          </div>
        )}

        {/* Legend color indicators */}
        <div className="bg-[#021f18] border-b border-[#065f46]/60 px-4 py-1.5 flex items-center justify-between gap-3 text-[11px] text-slate-300 flex-wrap">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-bold text-amber-300">دليل ألوان المقرر:</span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 border border-emerald-300 inline-block" />
              <span className="text-emerald-300 font-bold">حفظ جديد</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-400 border border-amber-300 inline-block" />
              <span className="text-amber-300 font-bold">مراجعة وتثبيت</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-sky-400 border border-sky-300 inline-block" />
              <span className="text-sky-300 font-bold">مقرر الغد</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500 border border-rose-300 inline-block" />
              <span className="text-rose-300 font-bold">آية أخطأ فيها الطالب ❌ (تتكرر تلقائياً في خطة الغد)</span>
            </span>
          </div>

          {/* Quick jump to Surah & Page */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-amber-300 font-bold">انتقال لسورة:</span>
              <select
                value={pageInfo.startSurah}
                onChange={e => handleJumpToSurah(Number(e.target.value))}
                className="bg-[#022c22] border border-[#065f46] text-[#fbbf24] text-xs font-bold rounded-xl px-2 py-1 outline-none cursor-pointer max-w-[150px] sm:max-w-none"
              >
                {QURAN_SURAHS.map(s => (
                  <option key={s.number} value={s.number}>
                    {s.number}. سورة {s.name} (ص {SURAH_START_PAGE_MAP[s.number] || getPageOfAyah(s.number, 1)})
                  </option>
                ))}
              </select>
            </div>

            <form onSubmit={handleSearchPageSubmit} className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400">انتقال لوجه:</span>
              <input
                type="number"
                min={1}
                max={604}
                placeholder="1 - 604"
                value={searchPageInput}
                onChange={e => setSearchPageInput(e.target.value)}
                className="w-16 bg-[#022c22] border border-[#065f46] rounded-lg px-1.5 py-0.5 text-center text-xs text-white outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                className="px-2 py-0.5 rounded-lg bg-amber-400 text-slate-900 font-black text-[10px] cursor-pointer hover:bg-amber-300"
              >
                ذهاب
              </button>
            </form>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. MUSHAF PAGE BODY (Authentic King Fahd Page Frame)                      */}
        {/* ========================================================================= */}
        <div
          ref={mushafScrollRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#04281f] flex flex-col items-center justify-start relative"
        >
          {/* Action Popover for a clicked Ayah */}
          {selectedAyahAction && (
            <div className="fixed inset-0 z-[100001] bg-black/60 flex items-center justify-center p-4">
              <div className="bg-[#022c22] border-2 border-amber-400 rounded-3xl p-5 max-w-md w-full shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-[#065f46] pb-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-amber-400" />
                    <h4 className="font-bold text-white text-sm">
                      خيارات الآية ({toArabicNumerals(selectedAyahAction.ayahNumber)}) - سورة {getSurahInfo(selectedAyahAction.surahNumber).name}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedAyahAction(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3 rounded-2xl bg-[#064e3b]/50 border border-[#065f46] text-amber-200 font-quran text-center text-lg leading-relaxed">
                  «{selectedAyahAction.ayahText}»
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleRecordAyahMistake(selectedAyahAction.surahNumber, selectedAyahAction.ayahNumber, selectedAyahAction.ayahText);
                      setSelectedAyahAction(null);
                    }}
                    className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>
                      {selectedAyahAction.existingError
                        ? `زيادة عدد الأخطاء (+1) • حالياً: (${toArabicNumerals(selectedAyahAction.existingError.errorCount)})`
                        : 'تسجيل خطأ تسميع لهذه الآية ❌'}
                    </span>
                  </button>

                  {selectedAyahAction.existingError && (
                    <button
                      type="button"
                      onClick={() => handleClearAyahMistake(selectedAyahAction.surahNumber, selectedAyahAction.ayahNumber)}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
                    >
                      <Check className="w-4 h-4" />
                      <span>تصحيح الخطأ وتثبيت الآية (إزالة من السجل) ✓</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Authentic Page Parchment / Frame */}
          <div className="w-full max-w-3xl bg-[#fffef7] text-[#1c1917] rounded-2xl shadow-2xl border-4 border-[#d97706]/70 p-6 sm:p-10 relative">
            {/* Top Page Header (Surah name right, Juz left) */}
            <div className="flex items-center justify-between border-b-2 border-[#064e3b]/30 pb-3 mb-6 text-xs sm:text-sm font-bold font-heading text-[#064e3b]">
              <span>الجزء {pageInfo.juz}</span>
              <span className="font-quran text-base sm:text-lg font-bold text-amber-800">
                {pageInfo.surahNames.join(' • ')}
              </span>
              <span>الوجه {toArabicNumerals(currentPage)}</span>
            </div>

            {/* Verses Container */}
            <div className="space-y-6">
              {pageSections.map(sec => (
                <div key={sec.surahNumber} className="space-y-3">
                  {/* Surah Header if surah starts on this page */}
                  {sec.isSurahBeginning && (
                    <div className="my-4 text-center">
                      <div className="inline-block w-full max-w-md mx-auto py-2.5 px-6 rounded-2xl bg-gradient-to-r from-[#064e3b] via-[#022c22] to-[#064e3b] text-[#fbbf24] border-2 border-[#d97706] shadow-md">
                        <h4 className="font-quran text-lg sm:text-xl font-bold tracking-wide">
                          سُورَةُ {sec.surahInfo.name}
                        </h4>
                        <div className="flex items-center justify-center gap-4 text-[10px] text-emerald-200 mt-0.5">
                          <span>{sec.surahInfo.revelationType === 'مكية' ? 'مَكِّيَّةٌ' : 'مَدَنِيَّةٌ'}</span>
                          <span>•</span>
                          <span>آيَاتُهَا {toArabicNumerals(sec.surahInfo.numberOfAyahs)}</span>
                        </div>
                      </div>

                      {sec.surahNumber !== 9 && (
                        <div className="text-center font-quran text-lg sm:text-2xl text-[#064e3b] pt-3 pb-1 tracking-wider font-bold">
                          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quran Text Stream */}
                  <div
                    className="font-quran text-justify leading-[2.6] sm:leading-[2.8] text-[#1c1917] tracking-normal selection:bg-amber-300"
                    style={{ fontSize: `${fontSize}px` }}
                    dir="rtl"
                  >
                    {sec.ayahs.map(ayah => {
                      const styleInfo = getAyahStyleInfo(sec.surahNumber, ayah.ayahNumber);
                      const isPressed = pressedAyah?.surahNumber === sec.surahNumber && pressedAyah?.ayahNumber === ayah.ayahNumber;

                      return (
                        <React.Fragment key={ayah.ayahNumber}>
                          <span
                            id={`mushaf-ayah-${sec.surahNumber}-${ayah.ayahNumber}`}
                            onPointerDown={() => handlePointerDown(sec.surahNumber, ayah.ayahNumber, ayah.text)}
                            onPointerUp={handlePointerUp}
                            onPointerLeave={handlePointerUp}
                            onClick={() => {
                              const err = localErrors.find(e => e.surahNumber === sec.surahNumber && e.ayahNumber === ayah.ayahNumber && !e.cleared);
                              setSelectedAyahAction({
                                surahNumber: sec.surahNumber,
                                ayahNumber: ayah.ayahNumber,
                                ayahText: ayah.text,
                                existingError: err
                              });
                            }}
                            className={`transition-all rounded-lg px-2 py-1 inline duration-200 relative cursor-pointer ${styleInfo.className} ${
                              isPressed ? 'scale-105 ring-4 ring-rose-500' : ''
                            }`}
                            title={`سورة ${sec.surahInfo.name} - آية ${ayah.ayahNumber} (علّق ٢.٥ ثانية لتسجيل خطأ)`}
                          >
                            {/* Holding progress bar indicator */}
                            {isPressed && (
                              <span
                                className="absolute bottom-0 right-0 h-1 bg-rose-600 rounded-full transition-all"
                                style={{ width: `${pressProgress}%` }}
                              />
                            )}

                            {ayah.text}

                            {/* Error Badge with Arabic Numeral if student errored on this Ayah */}
                            {styleInfo.category === 'error' && (
                              <span className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded-full bg-rose-600 text-white text-[11px] font-black shadow-md align-middle">
                                <span>❌</span>
                                <span>{toArabicNumerals(styleInfo.errorCount || 1)}</span>
                              </span>
                            )}
                          </span>

                          {/* Ornamental Ayah End Symbol */}
                          <span className="inline-block mx-1 font-quran text-[#064e3b] font-bold text-[0.88em] select-none text-amber-700">
                            {' '}۝{toArabicNumerals(ayah.ayahNumber)}{' '}
                          </span>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Page Footer */}
            <div className="mt-8 pt-3 border-t-2 border-[#064e3b]/30 text-center font-bold text-xs text-[#064e3b]">
              - {toArabicNumerals(currentPage)} -
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. BOTTOM NAVIGATION BAR                                                  */}
        {/* ========================================================================= */}
        <div className="bg-gradient-to-r from-[#064e3b] via-[#022c22] to-[#064e3b] border-t border-[#065f46] px-6 py-2.5 flex items-center justify-between gap-4 shrink-0">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#022c22] hover:bg-[#064e3b] disabled:opacity-30 disabled:cursor-not-allowed text-[#fbbf24] border border-[#065f46] font-bold text-xs sm:text-sm cursor-pointer transition-all shadow-md active:scale-95"
          >
            <ChevronRight className="w-5 h-5 text-[#fbbf24]" />
            <span>الوجه السابق (ص {currentPage > 1 ? currentPage - 1 : 1})</span>
          </button>

          <div className="hidden sm:flex flex-col items-center text-center">
            <span className="text-white font-bold text-xs font-heading">
              {formatPageTitle(currentPage)}
            </span>
            <span className="text-[10px] text-[#86efac]/70">
              استخدم أسهم لوحة المفاتيح للتنقل السريع
            </span>
          </div>

          <button
            type="button"
            onClick={handleNextPage}
            disabled={currentPage >= 604}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#fbbf24] hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed text-[#064e3b] font-black text-xs sm:text-sm cursor-pointer transition-all shadow-lg active:scale-95"
          >
            <span>الوجه التالي (ص {currentPage < 604 ? currentPage + 1 : 604})</span>
            <ChevronLeft className="w-5 h-5 text-[#064e3b]" />
          </button>
        </div>
      </div>
    </div>
  );
};
