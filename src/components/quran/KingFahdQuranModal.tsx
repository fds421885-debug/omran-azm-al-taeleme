import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  ZoomIn,
  ZoomOut,
  Lightbulb,
  AlertTriangle,
  User,
  Cloud,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Compass,
  Headphones,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  ArrowDownCircle,
  ArrowUpCircle,
  SkipForward,
  SkipBack,
  Square
} from 'lucide-react';
import { QURAN_SURAHS, FAMOUS_RECITERS, getSurahInfo } from '../../data/quranData';
import {
  getKingFahdPageInfo,
  getPageOfAyah,
  formatPageTitle,
  QuranPageInfo,
  KING_FAHD_JUZ_NAMES,
  isAyahInRecitationRange,
  getExpandedAyahSequenceForRange,
  getAyahsOnPage
} from '../../data/quranPagesData';
import { loadAllQuranVerses, getSurahVerses, normalizeKfgqpcHafsText } from '../../lib/quranTextService';
import { ComplexThemeConfig } from '../../types';
import { darkenHex, lightenHex, getContrastTextColor } from '../../lib/themeUtils';

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
  openRequestVersion?: number;
  highlightItems?: QuranHighlightItem[];
  activeItemId?: string;
  selectedSheikhName?: string;
  onReciterChange?: (reciterName: string, reciterId: string) => void;
  studentName?: string;
  studentId?: string;
  teacherId?: string;
  teacherName?: string;
  theme?: ComplexThemeConfig;
  onRecordAyahError?: (surah: number, ayah: number, errorCount: number) => void;
  onRecordDetailedAyahError?: (errorLog: any) => void;
  recordedAyahErrors?: Record<string, number>;
}

// Convert numbers to Arabic Eastern digits: 1 -> ١
export function toArabicNumerals(n: number): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return n.toString().replace(/\d/g, d => arabicDigits[parseInt(d, 10)]);
}

// Shared Web Audio Context for crisp, zero-latency realistic paper page-flip sound
let sharedPageFlipAudioCtx: AudioContext | null = null;

function playRealisticPageFlipSound() {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    if (!sharedPageFlipAudioCtx || sharedPageFlipAudioCtx.state === 'closed') {
      sharedPageFlipAudioCtx = new AudioCtx();
    }
    const ctx = sharedPageFlipAudioCtx;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const duration = 0.21;
    const sampleRate = ctx.sampleRate;
    const bufferSize = Math.floor(sampleRate * duration);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const output = noiseBuffer.getChannelData(0);

    // Shaped pink-ish paper friction noise with natural rustle contour
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      const t = i / bufferSize;
      // Fast attack, smooth airy paper arc, gentle settle
      const env = Math.pow(Math.sin(Math.PI * t), 0.75) * (1 - 0.35 * t);
      output[i] = (b0 + b1 + b2 + white * 0.42) * 0.14 * env;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    // Bandpass sweep simulating crisp Medina Mushaf paper leaf turning through air
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.Q.setValueAtTime(1.15, now);
    bandpass.frequency.setValueAtTime(850, now);
    bandpass.frequency.exponentialRampToValueAtTime(2450, now + 0.075);
    bandpass.frequency.exponentialRampToValueAtTime(680, now + duration);

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(320, now);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(0.42, now + 0.028);
    gainNode.gain.exponentialRampToValueAtTime(0.008, now + duration);

    noiseSource.connect(highpass);
    highpass.connect(bandpass);
    bandpass.connect(gainNode);
    gainNode.connect(ctx.destination);

    noiseSource.start(now);
    noiseSource.stop(now + duration);
  } catch {
    // Ignore audio context restrictions silently
  }
}

function resolveReciterFolderById(reciterId: string): string {
  const found = FAMOUS_RECITERS.find(
    r => r.id === reciterId || r.name === reciterId || r.everyAyahFolder === reciterId
  );
  return found?.everyAyahFolder || 'Minshawy_Teacher_128kbps';
}

function resolveInitialReciterId(sheikhName?: string): string {
  if (!sheikhName) return 'minshawi';
  const lower = sheikhName.toLowerCase();
  if (lower.includes('حصري') || lower.includes('husary')) return 'hussary';
  if (lower.includes('عفاسي') || lower.includes('afasy')) return 'afasy';
  if (lower.includes('حذيفي') || lower.includes('hudhaify')) return 'hudhaify';
  if (lower.includes('عبد الباسط') || lower.includes('عبدالباسط') || lower.includes('basit')) return 'abdulbasit';
  if (lower.includes('سويد') || lower.includes('sowaid')) return 'suwaid';
  return 'minshawi';
}

export function getNextSequentialVerse(surah: number, ayah: number): { surah: number; ayah: number } | null {
  const currentSurah = getSurahInfo(surah);
  if (!currentSurah) return null;
  if (ayah < currentSurah.numberOfAyahs) {
    return { surah, ayah: ayah + 1 };
  }
  if (surah < 114) {
    return { surah: surah + 1, ayah: 1 };
  }
  return null; // Reached end of Quran (An-Nas)
}

export function getPrevSequentialVerse(surah: number, ayah: number): { surah: number; ayah: number } | null {
  if (ayah > 1) {
    return { surah, ayah: ayah - 1 };
  }
  if (surah > 1) {
    const prevSurah = getSurahInfo(surah - 1);
    if (prevSurah) {
      return { surah: surah - 1, ayah: prevSurah.numberOfAyahs };
    }
  }
  return null; // At beginning of Quran (Al-Fatihah 1)
}

export const KingFahdQuranModal: React.FC<KingFahdQuranModalProps> = ({
  isOpen,
  onClose,
  initialSurah = 78,
  initialAyah = 1,
  initialPage,
  openRequestVersion = 0,
  highlightItems = [],
  activeItemId,
  selectedSheikhName,
  onReciterChange,
  studentName,
  studentId,
  theme,
  onRecordAyahError,
  recordedAyahErrors
}) => {
  // Platform Theme Resolution
  const themePrimary = theme?.primaryColor || '#022c22';
  const themeSecondary = theme?.secondaryColor || '#064e3b';
  const themeAccent = theme?.accentColor || '#fbbf24';
  const themeCard = theme?.cardColor || '#064e3b';
  const themeBorder = lightenHex(themeSecondary, 0.16);
  const themeDarkBg = darkenHex(themePrimary, 0.25);
  const accentTextColor = getContrastTextColor(themeAccent);

  const browsedPageStorageKey = `omran_mushaf_browsed_page_${studentId || 'anon'}`;

  // Determine starting page for the assigned recitation
  const resolvedStartPage = useMemo(() => {
    if (initialPage && initialPage >= 1 && initialPage <= 604) {
      return initialPage;
    }
    return getPageOfAyah(initialSurah, initialAyah);
  }, [initialPage, initialSurah, initialAyah]);

  const [currentPage, setCurrentPage] = useState<number>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = sessionStorage.getItem(browsedPageStorageKey);
        const parsed = saved ? parseInt(saved, 10) : NaN;
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 604) {
          return parsed;
        }
      }
    } catch {}
    return resolvedStartPage;
  });

  const [fontSize, setFontSize] = useState<number>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      return 22;
    }
    return 26;
  });

  const [selectedHighlightId, setSelectedHighlightId] = useState<string>(
    activeItemId || (highlightItems[0]?.id || '')
  );
  const [quranMap, setQuranMap] = useState<Record<number, string[]>>({});
  const [isLoadingVerses, setIsLoadingVerses] = useState<boolean>(true);
  const [searchPageInput, setSearchPageInput] = useState<string>('');

  // Fullscreen / Maximize State & Compact Sub-Toolbar Toggle
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showSubToolbar, setShowSubToolbar] = useState<boolean>(true);

  // Page-Turn Animation & Sound State
  const [flipDirection, setFlipDirection] = useState<'next' | 'prev' | null>(null);
  const [flipAnimKey, setFlipAnimKey] = useState<number>(0);
  const [isFlipSoundEnabled, setIsFlipSoundEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('omran_mushaf_flip_sound');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const isFlipSoundEnabledRef = useRef<boolean>(isFlipSoundEnabled);
  isFlipSoundEnabledRef.current = isFlipSoundEnabled;

  // Built-in Audio Recitation Player State
  const [selectedReciterId, setSelectedReciterId] = useState<string>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('omran_mushaf_reciter');
        if (saved && FAMOUS_RECITERS.some(r => r.id === saved)) {
          return saved;
        }
      }
    } catch {}
    return resolveInitialReciterId(selectedSheikhName);
  });
  const selectedReciterIdRef = useRef<string>(selectedReciterId);
  selectedReciterIdRef.current = selectedReciterId;

  const [audioScope, setAudioScope] = useState<'page' | 'highlight'>('page');
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [playingVerse, setPlayingVerse] = useState<{ surah: number; ayah: number } | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingAudioRef = useRef<boolean>(false);
  const activeAyahPlayTokenRef = useRef<number>(0);
  const audioQueueRef = useRef<Array<{ surah: number; ayah: number }>>([]);
  const audioQueueIndexRef = useRef<number>(0);

  const modalContainerRef = useRef<HTMLDivElement | null>(null);
  const mushafScrollRef = useRef<HTMLDivElement | null>(null);

  // Smooth scroll tracking & helpers for mobile & all screen sizes
  const [canScrollDown, setCanScrollDown] = useState<boolean>(false);
  const [canScrollUp, setCanScrollUp] = useState<boolean>(false);

  const checkScrollState = useCallback(() => {
    const el = mushafScrollRef.current;
    if (!el) return;
    const hasOverflow = el.scrollHeight > el.clientHeight + 12;
    setCanScrollUp(hasOverflow && el.scrollTop > 35);
    setCanScrollDown(hasOverflow && el.scrollTop + el.clientHeight < el.scrollHeight - 35);
  }, []);

  const handleSmoothScroll = useCallback((direction: 'up' | 'down') => {
    const el = mushafScrollRef.current;
    if (!el) return;
    const scrollStep = Math.max(220, Math.round(el.clientHeight * 0.7));
    el.scrollBy({
      top: direction === 'down' ? scrollStep : -scrollStep,
      behavior: 'smooth'
    });
  }, []);

  useEffect(() => {
    const el = mushafScrollRef.current;
    if (!el || !isOpen) return;

    const timer = setTimeout(checkScrollState, 120);
    el.addEventListener('scroll', checkScrollState, { passive: true });
    window.addEventListener('resize', checkScrollState);

    return () => {
      clearTimeout(timer);
      el.removeEventListener('scroll', checkScrollState);
      window.removeEventListener('resize', checkScrollState);
    };
  }, [checkScrollState, currentPage, fontSize, isLoadingVerses, isOpen]);

  // Track deliberate navigation vs initial open so background syncs NEVER yank page or scroll
  const pendingFocusScrollRef = useRef<'target' | 'top' | null>('target');
  const lastHandledOpenSessionRef = useRef<string>('');

  // Sync reciter from suggested sheikh ONLY when no custom choice was saved by user
  useEffect(() => {
    if (selectedSheikhName) {
      try {
        const saved = typeof window !== 'undefined' ? localStorage.getItem('omran_mushaf_reciter') : null;
        if (!saved) {
          const resolved = resolveInitialReciterId(selectedSheikhName);
          setSelectedReciterId(resolved);
          selectedReciterIdRef.current = resolved;
        }
      } catch {}
    }
  }, [selectedSheikhName]);

  // Helper to navigate to any page WITH realistic 3D flip animation + paper flip sound + persistent session save
  const navigateToPage = useCallback(
    (
      targetPage: number,
      options?: {
        playSound?: boolean;
        scrollMode?: 'top' | 'target' | 'none';
        forcedDirection?: 'next' | 'prev';
      }
    ) => {
      const clamped = Math.max(1, Math.min(604, targetPage));
      setCurrentPage(prev => {
        if (prev === clamped) {
          if (options?.scrollMode) {
            pendingFocusScrollRef.current = options.scrollMode === 'none' ? null : options.scrollMode;
          }
          return prev;
        }

        const dir = options?.forcedDirection || (clamped > prev ? 'next' : 'prev');
        setFlipDirection(dir);
        setFlipAnimKey(k => k + 1);

        if (options?.playSound !== false && isFlipSoundEnabledRef.current) {
          playRealisticPageFlipSound();
        }

        pendingFocusScrollRef.current =
          options?.scrollMode === 'none' ? null : options?.scrollMode || 'top';

        try {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem(browsedPageStorageKey, String(clamped));
          }
        } catch {}

        return clamped;
      });
    },
    [browsedPageStorageKey]
  );

  // Toggle sound preference
  const toggleFlipSound = () => {
    setIsFlipSoundEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem('omran_mushaf_flip_sound', String(next));
      } catch {}
      if (next) {
        playRealisticPageFlipSound();
      }
      return next;
    });
  };

  // Toggle Fullscreen / Maximize (works both inside iframes via 100vw/100dvh AND native Fullscreen API)
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => {
      const next = !prev;
      try {
        if (next) {
          if (modalContainerRef.current?.requestFullscreen && !document.fullscreenElement) {
            modalContainerRef.current.requestFullscreen().catch(() => {});
          }
        } else if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        // Keep CSS fullscreen active unless exited via Esc/Fullscreen API
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, [isFullscreen]);

  // Per-Student Isolated Mushaf Errors State + Synchronous Ref
  const [ayahErrors, setAyahErrors] = useState<Record<string, number>>(() =>
    recordedAyahErrors ? { ...recordedAyahErrors } : {}
  );
  const ayahErrorsRef = useRef<Record<string, number>>(
    recordedAyahErrors ? { ...recordedAyahErrors } : {}
  );
  const [lastErrorNotification, setLastErrorNotification] = useState<{
    type: 'added' | 'removed';
    text: string;
  } | null>(null);
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Strictly sync isolated errors whenever studentId, recordedAyahErrors, or modal open state changes
  useEffect(() => {
    const cleanCopy = recordedAyahErrors ? { ...recordedAyahErrors } : {};
    ayahErrorsRef.current = cleanCopy;
    setAyahErrors(cleanCopy);
  }, [recordedAyahErrors, studentId, isOpen]);

  const showToast = (type: 'added' | 'removed', text: string) => {
    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current);
    }
    setLastErrorNotification({ type, text });
    notificationTimerRef.current = setTimeout(() => {
      setLastErrorNotification(null);
    }, 2400);
  };

  useEffect(() => {
    return () => {
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current);
      }
    };
  }, []);

  const lastRecordedTimeRef = useRef<Record<string, number>>({});

  // Instant, popup-free error marking on double-click / double-tap
  const recordAyahError = (surahNumber: number, ayahNumber: number) => {
    const key = `${surahNumber}:${ayahNumber}`;
    const now = Date.now();
    if (lastRecordedTimeRef.current[key] && now - lastRecordedTimeRef.current[key] < 320) {
      return;
    }
    lastRecordedTimeRef.current[key] = now;

    const currentCount = ayahErrorsRef.current[key] || 0;
    const computedNext = currentCount + 1;

    try {
      if (typeof window !== 'undefined' && 'navigator' in window && (navigator as any).vibrate) {
        (navigator as any).vibrate([60, 30, 60]);
      }
    } catch {}

    // 1. Synchronously update ref & UI state immediately
    const nextMap = { ...ayahErrorsRef.current, [key]: computedNext };
    ayahErrorsRef.current = nextMap;
    setAyahErrors(nextMap);

    // 2. Persist immediately to active student's isolated Mushaf in Cloud Firestore
    if (onRecordAyahError) {
      onRecordAyahError(surahNumber, ayahNumber, computedNext);
    }

    const sInfo = getSurahInfo(surahNumber);
    showToast(
      'added',
      `تم حفظ الخطأ سحابياً في سورة ${sInfo?.name || surahNumber} (الآية ${toArabicNumerals(ayahNumber)})`
    );
  };

  // Clicking the warning badge (علامة الإنذار) removes ONLY this specific ayah's entire error
  const handleClearSingleAyahError = (
    e: React.MouseEvent | React.TouchEvent,
    surahNumber: number,
    ayahNumber: number
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const key = `${surahNumber}:${ayahNumber}`;

    const nextMap = { ...ayahErrorsRef.current };
    delete nextMap[key];
    ayahErrorsRef.current = nextMap;
    setAyahErrors(nextMap);

    if (onRecordAyahError) {
      onRecordAyahError(surahNumber, ayahNumber, 0);
    }

    const sInfo = getSurahInfo(surahNumber);
    showToast(
      'removed',
      `تمت إزالة الخطأ من سورة ${sInfo?.name || surahNumber} (الآية ${toArabicNumerals(ayahNumber)}) وحفظ التعديل سحابياً`
    );
  };

  // Touch Double-Tap support for tablets & phones (without any popup or long-press delay)
  const lastTapRef = useRef<{ time: number; surah: number; ayah: number }>({
    time: 0,
    surah: 0,
    ayah: 0
  });

  const handleTouchStartWithDoubleTap = (
    e: React.TouchEvent,
    surahNumber: number,
    ayahNumber: number
  ) => {
    const now = Date.now();
    if (
      lastTapRef.current.surah === surahNumber &&
      lastTapRef.current.ayah === ayahNumber &&
      now - lastTapRef.current.time < 360
    ) {
      if (e.cancelable) e.preventDefault();
      recordAyahError(surahNumber, ayahNumber);
      lastTapRef.current = { time: 0, surah: 0, ayah: 0 };
      return;
    }
    lastTapRef.current = { time: now, surah: surahNumber, ayah: ayahNumber };
  };

  // Touch Swipe Left/Right on Mushaf Page to Turn Pages Naturally on Mobile & Tablet
  const swipeStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handlePageTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) {
      swipeStartRef.current = null;
      return;
    }
    swipeStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now()
    };
  };

  const handlePageTouchEnd = (e: React.TouchEvent) => {
    if (!swipeStartRef.current || e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - swipeStartRef.current.x;
    const dy = e.changedTouches[0].clientY - swipeStartRef.current.y;
    const dt = Date.now() - swipeStartRef.current.time;
    swipeStartRef.current = null;

    // Horizontal swipe: minimum 65px, mostly horizontal, within 700ms
    if (dt < 700 && Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.6) {
      // In Arabic RTL Mushaf: swiping finger from left-to-right (dx > 0) turns to NEXT page;
      // swiping finger from right-to-left (dx < 0) turns back to PREVIOUS page.
      if (dx > 0 && currentPage < 604) {
        navigateToPage(currentPage + 1, { scrollMode: 'top', forcedDirection: 'next' });
      } else if (dx < 0 && currentPage > 1) {
        navigateToPage(currentPage - 1, { scrollMode: 'top', forcedDirection: 'prev' });
      }
    }
  };

  const totalErrorVersesCount = useMemo(() => {
    return Object.keys(ayahErrors).filter(k => (ayahErrors[k] || 0) > 0).length;
  }, [ayahErrors]);

  const totalErrorsCount = useMemo(() => {
    return Object.values(ayahErrors).reduce((sum, n) => sum + (n || 0), 0);
  }, [ayahErrors]);

  // Active Highlight Item
  const activeHighlight = useMemo(() => {
    return highlightItems.find(h => h.id === selectedHighlightId) || highlightItems[0] || null;
  }, [highlightItems, selectedHighlightId]);

  // Recitation home page (for the "العودة لموضع التسميع" button when browsing elsewhere)
  const recitationHomePage = useMemo(() => {
    if (activeHighlight) {
      return getPageOfAyah(activeHighlight.surahNumber, activeHighlight.fromAyah);
    }
    return resolvedStartPage;
  }, [activeHighlight, resolvedStartPage]);

  // Ensure verses for current page are loaded
  const pageInfo: QuranPageInfo = useMemo(() => {
    return getKingFahdPageInfo(currentPage);
  }, [currentPage]);

  // Target Ayah and Surah to focus ONLY when user explicitly opens Mushaf or clicks a portion tab
  const targetSurahNum = useMemo(() => {
    if (
      activeHighlight &&
      getPageOfAyah(activeHighlight.surahNumber, activeHighlight.fromAyah) === currentPage
    ) {
      return activeHighlight.surahNumber;
    }
    if (getPageOfAyah(initialSurah, initialAyah) === currentPage) {
      return initialSurah;
    }
    return pageInfo.startSurah;
  }, [activeHighlight, currentPage, initialSurah, initialAyah, pageInfo]);

  const targetAyahNum = useMemo(() => {
    if (
      activeHighlight &&
      getPageOfAyah(activeHighlight.surahNumber, activeHighlight.fromAyah) === currentPage
    ) {
      return activeHighlight.fromAyah;
    }
    if (getPageOfAyah(initialSurah, initialAyah) === currentPage) {
      return initialAyah;
    }
    return pageInfo.startAyah;
  }, [activeHighlight, currentPage, initialSurah, initialAyah, pageInfo]);

  // CRITICAL FIX: Set starting page ONLY on explicit user open (openRequestVersion) or student switch!
  // NEVER reset currentPage on background Firestore updates, AI plan completions, or prop re-renders!
  useEffect(() => {
    if (!isOpen) {
      stopAudioPlayback();
      return;
    }

    const sessionId = `${studentId || 'anon'}__${openRequestVersion}`;
    if (lastHandledOpenSessionRef.current !== sessionId) {
      lastHandledOpenSessionRef.current = sessionId;
      setCurrentPage(resolvedStartPage);
      pendingFocusScrollRef.current = 'target';
      try {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(browsedPageStorageKey, String(resolvedStartPage));
        }
      } catch {}
      if (activeItemId) {
        setSelectedHighlightId(activeItemId);
      } else if (highlightItems[0]?.id) {
        setSelectedHighlightId(highlightItems[0].id);
      }
    }
  }, [isOpen, studentId, openRequestVersion, resolvedStartPage, activeItemId, browsedPageStorageKey]);

  // Master Continuous Ayah Player: Plays sequentially verse by verse, turns pages, and NEVER stops until user clicks stop!
  const currentPlayingVerseRef = useRef<{ surah: number; ayah: number } | null>(null);

  const stopAudioPlayback = useCallback(() => {
    activeAyahPlayTokenRef.current++;
    isPlayingAudioRef.current = false;
    currentPlayingVerseRef.current = null;
    setIsPlayingAudio(false);
    setPlayingVerse(null);
    if (audioElRef.current) {
      try {
        const el = audioElRef.current;
        el.onended = null;
        el.onerror = null;
        el.pause();
        el.src = '';
      } catch {}
      audioElRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopAudioPlayback();
    };
  }, [stopAudioPlayback]);

  const playSingleVerse = useCallback(
    (surah: number, ayah: number, reciterIdOverride?: string) => {
      if (!isPlayingAudioRef.current) return;

      const currentToken = ++activeAyahPlayTokenRef.current;
      currentPlayingVerseRef.current = { surah, ayah };
      setPlayingVerse({ surah, ayah });

      // 1. Turn Mushaf page automatically (with 3D animation & sound) if the recited verse is on another page!
      const versePage = getPageOfAyah(surah, ayah);
      setCurrentPage(prevPage => {
        if (prevPage !== versePage) {
          const dir = versePage > prevPage ? 'next' : 'prev';
          setFlipDirection(dir);
          setFlipAnimKey(k => k + 1);
          if (isFlipSoundEnabledRef.current) {
            playRealisticPageFlipSound();
          }
          try {
            sessionStorage.setItem(browsedPageStorageKey, String(versePage));
          } catch {}
          return versePage;
        }
        return prevPage;
      });

      // 2. Smoothly scroll the recited verse into comfortable center view
      setTimeout(() => {
        const container = mushafScrollRef.current;
        const el = document.getElementById(`mushaf-ayah-${surah}-${ayah}`);
        if (container && el) {
          const elRect = el.getBoundingClientRect();
          const cRect = container.getBoundingClientRect();
          if (elRect.top < cRect.top + 45 || elRect.bottom > cRect.bottom - 45) {
            const relTop = elRect.top - cRect.top + container.scrollTop;
            container.scrollTo({
              top: Math.max(0, relTop - container.clientHeight / 2 + elRect.height / 2),
              behavior: 'smooth'
            });
          }
        }
      }, 95);

      const activeReciter = reciterIdOverride || selectedReciterIdRef.current;
      const folder = resolveReciterFolderById(activeReciter);
      const sPad = String(surah).padStart(3, '0');
      const aPad = String(ayah).padStart(3, '0');
      const url = `https://everyayah.com/data/${folder}/${sPad}${aPad}.mp3`;

      // Clean unbinding of listeners and pause previous audio before changing src to eliminate phantom error skips
      let audio = audioElRef.current;
      if (audio) {
        audio.onended = null;
        audio.onerror = null;
        try {
          audio.pause();
        } catch {}
      } else {
        audio = new Audio();
        audioElRef.current = audio;
      }

      audio.preload = 'auto';

      // Sequential advance: when current verse finishes, automatically play next verse without stopping!
      audio.onended = () => {
        if (activeAyahPlayTokenRef.current !== currentToken || !isPlayingAudioRef.current) return;
        const next = getNextSequentialVerse(surah, ayah);
        if (next && isPlayingAudioRef.current) {
          playSingleVerse(next.surah, next.ayah, activeReciter);
        } else {
          stopAudioPlayback();
        }
      };

      audio.onerror = () => {
        if (activeAyahPlayTokenRef.current !== currentToken || !isPlayingAudioRef.current) return;
        const next = getNextSequentialVerse(surah, ayah);
        if (next && isPlayingAudioRef.current) {
          setTimeout(() => {
            if (activeAyahPlayTokenRef.current === currentToken && isPlayingAudioRef.current) {
              playSingleVerse(next.surah, next.ayah, activeReciter);
            }
          }, 350);
        } else {
          stopAudioPlayback();
        }
      };

      try {
        audio.src = url;
        audio.play().catch(() => {
          if (activeAyahPlayTokenRef.current !== currentToken || !isPlayingAudioRef.current) return;
          stopAudioPlayback();
        });
      } catch {
        if (activeAyahPlayTokenRef.current === currentToken) {
          stopAudioPlayback();
        }
      }
    },
    [stopAudioPlayback, browsedPageStorageKey]
  );

  // Start continuous audio recitation starting from an exact Ayah
  const playContinuousFromAyah = useCallback(
    (startSurah: number, startAyah: number, reciterIdOverride?: string) => {
      isPlayingAudioRef.current = true;
      setIsPlayingAudio(true);
      playSingleVerse(startSurah, startAyah, reciterIdOverride);
    },
    [playSingleVerse]
  );

  const handlePlayNextAyah = useCallback(() => {
    if (!currentPlayingVerseRef.current) return;
    const next = getNextSequentialVerse(
      currentPlayingVerseRef.current.surah,
      currentPlayingVerseRef.current.ayah
    );
    if (next) {
      playSingleVerse(next.surah, next.ayah);
    }
  }, [playSingleVerse]);

  const handlePlayPrevAyah = useCallback(() => {
    if (!currentPlayingVerseRef.current) return;
    const prev = getPrevSequentialVerse(
      currentPlayingVerseRef.current.surah,
      currentPlayingVerseRef.current.ayah
    );
    if (prev) {
      playSingleVerse(prev.surah, prev.ayah);
    }
  }, [playSingleVerse]);

  const handleToggleAudioPlay = () => {
    if (isPlayingAudio) {
      stopAudioPlayback();
      return;
    }

    const startSurah = playingVerse?.surah || (activeHighlight ? activeHighlight.surahNumber : pageInfo.startSurah);
    const startAyah = playingVerse?.ayah || (activeHighlight ? activeHighlight.fromAyah : pageInfo.startAyah);

    playContinuousFromAyah(startSurah, startAyah);
  };

  const handleReciterChange = (newReciterId: string) => {
    setSelectedReciterId(newReciterId);
    selectedReciterIdRef.current = newReciterId;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('omran_mushaf_reciter', newReciterId);
      }
    } catch {}

    const found = FAMOUS_RECITERS.find(r => r.id === newReciterId);
    if (found && onReciterChange) {
      onReciterChange(found.name, newReciterId);
    }

    if (isPlayingAudioRef.current && currentPlayingVerseRef.current) {
      playSingleVerse(
        currentPlayingVerseRef.current.surah,
        currentPlayingVerseRef.current.ayah,
        newReciterId
      );
    }
  };

  // Ayah Long-Press (التعليق بالإصبع) gesture tracking for phones & tablets
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggeredRef = useRef<boolean>(false);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleAyahTouchStart = (
    e: React.TouchEvent,
    surahNumber: number,
    ayahNumber: number
  ) => {
    clearLongPressTimer();
    longPressTriggeredRef.current = false;

    const touch = e.touches[0];
    if (!touch) return;
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

    // 400ms hold timer (تعليق بالإصبع لبدء التلاوة المستمرة)
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      try {
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate(50);
        }
      } catch {}

      // Select Ayah and begin continuous recitation!
      playContinuousFromAyah(surahNumber, ayahNumber);
      const sInfo = getSurahInfo(surahNumber);
      showToast('added', `بدء تلاوة الشيخ المستمرة من الآية (${toArabicNumerals(ayahNumber)}) سورة ${sInfo?.name || surahNumber}`);
    }, 400);
  };

  const handleAyahTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);

    // Cancel long-press if user moves finger to scroll
    if (dx > 9 || dy > 9) {
      clearLongPressTimer();
    }
  };

  const handleAyahTouchEnd = (
    e: React.TouchEvent,
    surahNumber: number,
    ayahNumber: number
  ) => {
    clearLongPressTimer();

    // If long-press fired, prevent click / double-tap
    if (longPressTriggeredRef.current) {
      if (e.cancelable) e.preventDefault();
      longPressTriggeredRef.current = false;
      return;
    }

    // Double-tap error recording
    const now = Date.now();
    if (
      lastTapRef.current.surah === surahNumber &&
      lastTapRef.current.ayah === ayahNumber &&
      now - lastTapRef.current.time < 360
    ) {
      if (e.cancelable) e.preventDefault();
      recordAyahError(surahNumber, ayahNumber);
      lastTapRef.current = { time: 0, surah: 0, ayah: 0 };
      return;
    }
    lastTapRef.current = { time: now, surah: surahNumber, ayah: ayahNumber };
  };

  const handleAyahTouchCancel = () => {
    clearLongPressTimer();
    longPressTriggeredRef.current = false;
  };

  // Prevent native Android Chrome & browser context menu from ever showing inside Mushaf
  useEffect(() => {
    if (!isOpen) return;
    const preventContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('.mushaf-reading-area, .mushaf-scroll-container, .mushaf-ayah-item, .mushaf-leaf-frame')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('contextmenu', preventContextMenu, { capture: true });
    return () => {
      window.removeEventListener('contextmenu', preventContextMenu, { capture: true });
    };
  }, [isOpen]);

  // Load complete authentic King Fahd Uthmani Quran verses
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

  const handleSelectHighlightItem = (item: QuranHighlightItem) => {
    setSelectedHighlightId(item.id);
    const targetPage = getPageOfAyah(item.surahNumber, item.fromAyah);
    navigateToPage(targetPage, { scrollMode: 'target' });
  };

  const handleReturnToRecitationPosition = () => {
    navigateToPage(recitationHomePage, { scrollMode: 'target' });
  };

  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      navigateToPage(currentPage - 1, { scrollMode: 'top', forcedDirection: 'prev' });
    }
  }, [currentPage, navigateToPage]);

  const handleNextPage = useCallback(() => {
    if (currentPage < 604) {
      navigateToPage(currentPage + 1, { scrollMode: 'top', forcedDirection: 'next' });
    }
  }, [currentPage, navigateToPage]);

  const handleJumpToSurah = (surahNum: number) => {
    const page = getPageOfAyah(surahNum, 1);
    navigateToPage(page, { scrollMode: 'top' });
  };

  const handleJumpToPageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(searchPageInput, 10);
    if (!isNaN(p) && p >= 1 && p <= 604) {
      navigateToPage(p, { scrollMode: 'top' });
      setSearchPageInput('');
    }
  };

  // Keyboard navigation: Left/Right arrows, F for Fullscreen, Space to Play/Pause, Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select';
      if (isTyping) {
        if (e.key === 'Escape') onClose();
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleNextPage();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handlePrevPage();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFullscreen, handleNextPage, handlePrevPage, toggleFullscreen, onClose]);

  // Build sections/surahs to render on this page (100% King Fahd Medina Mushaf fidelity)
  const pageSections = useMemo(() => {
    const sections: Array<{
      surahNumber: number;
      surahInfo: ReturnType<typeof getSurahInfo>;
      startAyah: number;
      endAyah: number;
      isSurahBeginning: boolean;
      ayahs: Array<{ ayahNumber: number; text: string; isHighlighted: boolean }>;
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
      const ayahList: Array<{ ayahNumber: number; text: string; isHighlighted: boolean }> = [];

      for (let a = fromA; a <= toA; a++) {
        let rawText = verses[a - 1] || '';
        if (!rawText) {
          rawText = `...`;
        }

        rawText = rawText === '...' ? '...' : normalizeKfgqpcHafsText(rawText);

        // Safety guard in case any fallback API ever prepends Basmalah on Surahs 2..114 (except 9)
        if (a === 1 && sNum !== 1 && sNum !== 9 && rawText !== '...') {
          rawText = rawText
            .replace(/^بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ\s*/, '')
            .replace(/^بِّسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ\s*/, '')
            .replace(/^بِسۡمِ ٱللَّهِ ٱلرَّحۡمَـٰنِ ٱلرَّحِيمِ\s*/, '')
            .replace(/^بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ\s*/, '')
            .replace(/^بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ\s*/, '')
            .replace(/^بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ\s*/, '')
            .replace(/^بِسْمِ اللهِ الرَّحْمَنِ الرَّحِيمِ\s*/, '')
            .trim();
        }

        ayahList.push({
          ayahNumber: a,
          text: rawText,
          // Full multi-surah support (both ascending 112->114 AND descending 114->112!)
          isHighlighted: isAyahInRecitationRange(sNum, a, activeHighlight)
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
  }, [pageInfo, quranMap, activeHighlight]);

  // Controlled Scroll: ONLY runs when pendingFocusScrollRef is explicitly armed (open, portion click, or manual page turn)
  // NEVER runs on background Firestore snapshots or prop reference updates!
  useEffect(() => {
    if (!isOpen || isLoadingVerses) return;
    const mode = pendingFocusScrollRef.current;
    if (!mode) return;

    pendingFocusScrollRef.current = null;
    const container = mushafScrollRef.current;
    if (!container) return;

    if (mode === 'top') {
      container.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }

    // mode === 'target'
    const t0 = setTimeout(() => {
      const c = mushafScrollRef.current;
      if (!c) return;
      const targetEl = (document.getElementById(`mushaf-ayah-${targetSurahNum}-${targetAyahNum}`) ||
        c.querySelector('.ayah-primary-target') ||
        c.querySelector('.ayah-highlighted')) as HTMLElement | null;
      if (targetEl) {
        const targetRect = targetEl.getBoundingClientRect();
        const containerRect = c.getBoundingClientRect();
        const relativeTop = targetRect.top - containerRect.top + c.scrollTop;
        const targetScrollTop = Math.max(
          0,
          relativeTop - c.clientHeight / 2 + targetRect.height / 2
        );
        c.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
      } else {
        c.scrollTo({ top: 0, behavior: 'auto' });
      }
    }, 60);

    return () => clearTimeout(t0);
  }, [isOpen, currentPage, selectedHighlightId, isLoadingVerses, targetSurahNum, targetAyahNum]);

  // Detect if this page contains Sajdah (۩) or Hizb/Rub (۞) in King Fahd Mushaf
  const pageMarkersInfo = useMemo(() => {
    let hasSajdah = false;
    let hasRub = false;
    for (const sec of pageSections) {
      for (const ay of sec.ayahs) {
        if (ay.text.includes('۩')) hasSajdah = true;
        if (ay.text.includes('۞')) hasRub = true;
      }
    }
    return { hasSajdah, hasRub };
  }, [pageSections]);

  if (!isOpen) return null;

  // Pages 1 & 2 in King Fahd Medina Mushaf (الفاتحة وأول البقرة) have the iconic centered medallion frame!
  const isSpecialMedinaOpeningPage = currentPage === 1 || currentPage === 2;
  const juzHeaderTitle = KING_FAHD_JUZ_NAMES[pageInfo.juz] || `الجُزْءُ ${toArabicNumerals(pageInfo.juz)}`;
  const isAwayFromRecitationPage = currentPage !== recitationHomePage;

  return (
    <div
      ref={modalContainerRef}
      className={`fixed inset-0 z-[99999] flex flex-col bg-black/92 backdrop-blur-md overflow-hidden text-right select-none h-[100dvh] max-h-[100dvh] w-full ${
        isFullscreen ? 'p-0' : 'p-1 sm:p-2.5 md:p-4'
      }`}
      dir="rtl"
    >
      {/* Quran Modal Main Wrapper Styled in Active Platform Theme */}
      <div
        className={`w-full h-full min-h-0 max-h-full mx-auto flex flex-col shadow-2xl overflow-hidden relative transition-all duration-200 ${
          isFullscreen
            ? 'max-w-none rounded-none border-0'
            : 'max-w-5xl rounded-2xl sm:rounded-3xl border-2'
        }`}
        style={{
          backgroundColor: themePrimary,
          borderColor: isFullscreen ? 'transparent' : `${themeAccent}80`
        }}
      >
        {/* ========================================================================= */}
        {/* 1. TOP BAR: TITLE + STUDENT INFO + AUDIO BAR + ZOOM & FULLSCREEN CONTROLS */}
        {/* ========================================================================= */}
        <div
          className="border-b px-3 sm:px-5 py-2.5 flex items-center justify-between gap-2 shrink-0 flex-wrap sm:flex-nowrap"
          style={{ backgroundColor: themeSecondary, borderColor: themeBorder }}
        >
          {/* Right: Title & Student Name / Juz */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border shadow-sm"
              style={{
                backgroundColor: `${themeAccent}20`,
                borderColor: `${themeAccent}60`,
                color: themeAccent
              }}
            >
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-heading font-black text-xs sm:text-sm text-white truncate flex items-center gap-2">
                <span>مصحف المدينة النبوية (مجمع الملك فهد)</span>
                <span
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-black/30 border border-white/10"
                  style={{ color: themeAccent }}
                >
                  ص {toArabicNumerals(currentPage)}
                </span>
              </h3>
              <p className="text-[10px] sm:text-xs text-slate-300 font-bold truncate">
                {studentName ? `مصحف الطالب: ${studentName}` : juzHeaderTitle}
              </p>
            </div>
          </div>

          {/* Center: Built-in Audio Play Bar (زر تشغيل التلاوة داخل المصحف) */}
          <div
            className="flex items-center gap-1.5 p-1 rounded-2xl border flex-wrap sm:flex-nowrap"
            style={{
              backgroundColor: `${themePrimary}ee`,
              borderColor: isPlayingAudio ? themeAccent : themeBorder
            }}
          >
            <button
              type="button"
              onClick={handleToggleAudioPlay}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer transition-all shadow-sm active:scale-95"
              style={
                isPlayingAudio
                  ? {
                      backgroundColor: '#dc2626',
                      color: '#ffffff'
                    }
                  : {
                      backgroundColor: themeAccent,
                      color: accentTextColor
                    }
              }
              title={isPlayingAudio ? 'إيقاف التلاوة الصوتية' : 'تشغيل التلاوة الصوتية'}
            >
              {isPlayingAudio ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>إيقاف</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>تشغيل</span>
                </>
              )}
            </button>

            {/* Scope Toggle: Current Page vs Assigned Portion */}
            {activeHighlight && (
              <div className="flex items-center rounded-xl overflow-hidden border" style={{ borderColor: themeBorder }}>
                <button
                  type="button"
                  onClick={() => {
                    stopAudioPlayback();
                    setAudioScope('page');
                  }}
                  className="px-2 py-1 text-[10px] font-bold cursor-pointer transition-colors"
                  style={
                    audioScope === 'page'
                      ? { backgroundColor: `${themeAccent}30`, color: themeAccent }
                      : { color: '#cbd5e1' }
                  }
                  title="تلاوة آيات الوجه المعروض حالياً"
                >
                  الوجه
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopAudioPlayback();
                    setAudioScope('highlight');
                  }}
                  className="px-2 py-1 text-[10px] font-bold cursor-pointer transition-colors"
                  style={
                    audioScope === 'highlight'
                      ? { backgroundColor: `${themeAccent}30`, color: themeAccent }
                      : { color: '#cbd5e1' }
                  }
                  title="تلاوة الورد المحدد للطالب كاملاً"
                >
                  الورد
                </button>
              </div>
            )}

            {/* Reciter Selector */}
            <div className="flex items-center gap-1 pr-1">
              <Headphones className="w-3.5 h-3.5 hidden sm:block shrink-0" style={{ color: themeAccent }} />
              <select
                value={selectedReciterId}
                onChange={e => handleReciterChange(e.target.value)}
                className="text-[11px] font-bold rounded-lg py-1 px-1.5 outline-none cursor-pointer max-w-[115px] sm:max-w-[155px] truncate border"
                style={{
                  backgroundColor: themeSecondary,
                  borderColor: themeBorder,
                  color: '#ffffff'
                }}
                title="اختيار القارئ"
              >
                {FAMOUS_RECITERS.map(r => (
                  <option key={r.id} value={r.id} style={{ backgroundColor: themePrimary, color: '#ffffff' }}>
                    {r.name.replace('الشيخ ', '').replace(' (المصحف المعلم)', ' - معلم').replace(' (المصحف المرتل)', '')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Left: Zoom, Sound Toggle, Toolbar Toggle, Fullscreen Maximize & Close */}
          <div className="flex items-center gap-1.5">
            {/* Font Zoom Controls (Accessible on ALL screens including phones) */}
            <div
              className="flex items-center gap-0.5 px-1.5 py-1 rounded-xl border"
              style={{
                backgroundColor: themePrimary,
                borderColor: themeBorder
              }}
            >
              <button
                type="button"
                onClick={() => setFontSize(s => Math.min(44, s + 2))}
                className="p-1 rounded-lg text-slate-200 hover:text-white hover:bg-white/10 cursor-pointer"
                title="تكبير خط المصحف"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono px-1 font-bold" style={{ color: themeAccent }}>
                {fontSize}
              </span>
              <button
                type="button"
                onClick={() => setFontSize(s => Math.max(16, s - 2))}
                className="p-1 rounded-lg text-slate-200 hover:text-white hover:bg-white/10 cursor-pointer"
                title="تصغير خط المصحف"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Page-Flip Sound Toggle */}
            <button
              type="button"
              onClick={toggleFlipSound}
              className="p-2 rounded-xl border transition-colors cursor-pointer"
              style={{
                backgroundColor: isFlipSoundEnabled ? `${themeAccent}22` : themeCard,
                borderColor: isFlipSoundEnabled ? `${themeAccent}70` : themeBorder,
                color: isFlipSoundEnabled ? themeAccent : '#94a3b8'
              }}
              title={isFlipSoundEnabled ? 'صوت تقليب الصفحات مفعّل (اضغط للكتم)' : 'صوت تقليب الصفحات مكتوم (اضغط للتفعيل)'}
            >
              {isFlipSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Toggle Sub-Toolbar (helpful on small screens or fullscreen) */}
            <button
              type="button"
              onClick={() => setShowSubToolbar(v => !v)}
              className="p-2 rounded-xl border transition-colors cursor-pointer sm:hidden"
              style={{
                backgroundColor: showSubToolbar ? `${themeAccent}22` : themeCard,
                borderColor: themeBorder,
                color: showSubToolbar ? themeAccent : '#cbd5e1'
              }}
              title="إظهار / إخفاء شريط الأدوات"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            {/* Maximize / Fullscreen Button (تكبير يملأ الشاشة) */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border font-black text-xs transition-all cursor-pointer hover:brightness-110"
              style={
                isFullscreen
                  ? {
                      backgroundColor: themeAccent,
                      color: accentTextColor,
                      borderColor: themeAccent
                    }
                  : {
                      backgroundColor: themeCard,
                      borderColor: `${themeAccent}65`,
                      color: themeAccent
                    }
              }
              title={isFullscreen ? 'تصغير المصحف للوضع العادي' : 'تكبير المصحف ليملأ الشاشة بالكامل'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span className="hidden md:inline">{isFullscreen ? 'تصغير' : 'ملء الشاشة'}</span>
            </button>

            {/* Close Mushaf */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-200 hover:text-red-300 hover:bg-red-500/20 transition-colors cursor-pointer border"
              style={{
                backgroundColor: themeCard,
                borderColor: themeBorder
              }}
              title="إغلاق المصحف"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. SUB-BAR: PORTION TABS + QUICK JUMP + DUAL RECITATION ERROR HINTS       */}
        {/* ========================================================================= */}
        {showSubToolbar && (
          <div
            className="border-b px-3 sm:px-5 py-2 flex items-center justify-between gap-2 shrink-0 flex-wrap sm:flex-nowrap"
            style={{ backgroundColor: `${themePrimary}ee`, borderColor: themeBorder }}
          >
            {/* Highlight Portion Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full">
              {highlightItems.map(item => {
                const isActive = item.id === (activeHighlight?.id || selectedHighlightId);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectHighlightItem(item)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer border"
                    style={
                      isActive
                        ? {
                            backgroundColor: themeAccent,
                            color: accentTextColor,
                            borderColor: themeAccent
                          }
                        : {
                            backgroundColor: themeCard,
                            color: '#cbd5e1',
                            borderColor: themeBorder
                          }
                    }
                  >
                    <span>{item.title}</span>
                    <span className="text-[10px] opacity-80">
                      ({getSurahInfo(item.surahNumber)?.name || item.surahNumber})
                    </span>
                  </button>
                );
              })}

              {isAwayFromRecitationPage && (
                <button
                  type="button"
                  onClick={handleReturnToRecitationPosition}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold shrink-0 border transition-all cursor-pointer shadow-sm hover:brightness-110"
                  style={{
                    backgroundColor: `${themeAccent}25`,
                    borderColor: themeAccent,
                    color: themeAccent
                  }}
                  title="العودة لموضع التسميع المقرر للطالب"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>العودة للتسميع</span>
                </button>
              )}
            </div>

            {/* Quick Page Jump & Surah Select */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Surah Jump Select */}
              <select
                value={pageInfo.startSurah}
                onChange={e => handleJumpToSurah(parseInt(e.target.value, 10))}
                className="text-xs font-bold rounded-xl py-1 px-2 border outline-none cursor-pointer max-w-[120px] truncate"
                style={{
                  backgroundColor: themeCard,
                  borderColor: themeBorder,
                  color: '#ffffff'
                }}
                title="الانتقال إلى سورة"
              >
                {QURAN_SURAHS.map(s => (
                  <option key={s.number} value={s.number} style={{ backgroundColor: themePrimary, color: '#ffffff' }}>
                    {s.number}. {s.name}
                  </option>
                ))}
              </select>

              {/* Jump to Page Input */}
              <form onSubmit={handleJumpToPageSubmit} className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={604}
                  placeholder={`ص (${currentPage})`}
                  value={searchPageInput}
                  onChange={e => setSearchPageInput(e.target.value)}
                  className="w-16 sm:w-20 px-2 py-1 text-xs rounded-xl border text-center font-bold text-white placeholder-slate-400 outline-none focus:border-amber-400"
                  style={{ backgroundColor: themeCard, borderColor: themeBorder }}
                  title="اكتب رقم الوجه واضغط انتقال"
                />
                <button
                  type="submit"
                  className="px-2.5 py-1 text-xs font-bold rounded-xl border cursor-pointer hover:brightness-110"
                  style={{
                    backgroundColor: themeSecondary,
                    borderColor: themeBorder,
                    color: themeAccent
                  }}
                >
                  انتقال
                </button>
              </form>

              {/* Error count pill */}
              {totalErrorsCount > 0 && (
                <div
                  className="flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-bold border"
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    borderColor: 'rgba(239, 68, 68, 0.4)',
                    color: '#f87171'
                  }}
                  title="إجمالي الأخطاء المسجلة للطالب"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{toArabicNumerals(totalErrorsCount)} خطأ</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. MUSHAF READING CANVAS: 100% KING FAHD MEDINA MUSHAF FIDELITY           */}
        {/* ========================================================================= */}
        <div
          ref={mushafScrollRef}
          onTouchStart={handlePageTouchStart}
          onTouchEnd={handlePageTouchEnd}
          className="flex-1 min-h-0 w-full overflow-y-auto px-2 sm:px-6 py-3 sm:py-6 flex flex-col items-center custom-scrollbar mushaf-scroll-container scroll-smooth relative"
          style={{
            backgroundColor: themeDarkBg,
            touchAction: 'pan-y',
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorY: 'contain'
          }}
        >
          {/* Animated Page Flip Leaf Frame */}
          <div
            key={flipAnimKey}
            className={`w-full max-w-2xl bg-[#fffef7] text-[#1a1a1a] rounded-xl sm:rounded-2xl shadow-2xl border-4 relative transition-all p-3.5 sm:p-7 md:p-9 pb-16 sm:pb-24 mb-10 ${
              flipDirection === 'next'
                ? 'mushaf-flip-next'
                : flipDirection === 'prev'
                ? 'mushaf-flip-prev'
                : ''
            }`}
            style={{
              borderColor: '#c5a059',
              boxShadow: '0 20px 45px -10px rgba(0,0,0,0.45)',
              touchAction: 'pan-y'
            }}
          >
            {/* Real King Fahd Mushaf Header line */}
            <div
              className="flex items-center justify-between pb-3 mb-3 border-b-2 font-mushaf text-xs sm:text-sm text-[#785b24] select-none font-bold"
              style={{ borderColor: '#e4d3a2' }}
            >
              <div className="flex items-center gap-2">
                <span>سُورَةُ {getSurahInfo(pageInfo.startSurah)?.name || ''}</span>
                {pageMarkersInfo.hasSajdah && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 border border-amber-300">
                    ۩ سجدة تلاوة
                  </span>
                )}
              </div>
              <div className="text-[11px] sm:text-xs text-[#a68644]">
                {juzHeaderTitle}
              </div>
            </div>

            {/* Inner Decorative Outer Border line */}
            <div className="relative border border-[#d6be85]/60 rounded-lg p-2.5 sm:p-5">
              {isLoadingVerses ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
                  <div className="w-8 h-8 rounded-full border-2 border-amber-600 border-t-transparent animate-spin" />
                  <span className="text-xs font-bold text-amber-800">جاري تحميل آيات المصحف الشريف...</span>
                </div>
              ) : (
                <div
                  className="font-mushaf text-justify leading-[2.5] sm:leading-[2.7] text-[#1c1c1c] select-none"
                  style={{
                    fontSize: `${fontSize}px`,
                    wordSpacing: '0.12em',
                    touchAction: 'pan-y'
                  }}
                  dir="rtl"
                >
                  {pageSections.map(section => {
                    const isOpeningSurah = isSpecialMedinaOpeningPage && (section.surahNumber === 1 || section.surahNumber === 2);
                    return (
                      <React.Fragment key={section.surahNumber}>
                        {/* Surah Beginning Ornamental Frame Header */}
                        {section.isSurahBeginning && (
                          <div className="my-5 text-center select-none">
                            <div
                              className="relative mx-auto max-w-md py-2 sm:py-2.5 px-4 rounded-xl border-2 shadow-sm"
                              style={{
                                backgroundColor: '#fcf6e8',
                                borderColor: '#c5a059'
                              }}
                            >
                              <div className="font-mushaf font-black text-base sm:text-lg text-[#654316] flex items-center justify-center gap-2">
                                <span>سُورَةُ {section.surahInfo.name}</span>
                              </div>
                              <div className="text-[10px] sm:text-[11px] font-sans font-bold text-[#8a6831] mt-0.5 flex items-center justify-center gap-3">
                                <span>{section.surahInfo.revelationType === 'مكية' ? 'مَكِّيَّة' : 'مَدَنِيَّة'}</span>
                                <span>•</span>
                                <span>آيَاتُهَا {toArabicNumerals(section.surahInfo.numberOfAyahs)}</span>
                              </div>
                            </div>

                            {/* Basmalah (displayed on all surahs except Surah At-Tawbah 9, and not duplicated on Al-Fatihah) */}
                            {section.surahNumber !== 1 && section.surahNumber !== 9 && (
                              <div className="text-center font-mushaf text-lg sm:text-xl text-[#2b2416] py-3.5 tracking-wide">
                                بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ
                              </div>
                            )}
                          </div>
                        )}

                        {/* Verses Flow */}
                        {section.ayahs.map(ay => {
                          const errCount = ayahErrors[`${section.surahNumber}:${ay.ayahNumber}`] || 0;
                          const isAudioActive =
                            playingVerse?.surah === section.surahNumber &&
                            playingVerse?.ayah === ay.ayahNumber;
                          const isTarget =
                            section.surahNumber === targetSurahNum &&
                            ay.ayahNumber === targetAyahNum;

                          return (
                            <span
                              key={ay.ayahNumber}
                              id={`mushaf-ayah-${section.surahNumber}-${ay.ayahNumber}`}
                              onContextMenu={e => {
                                e.preventDefault();
                                e.stopPropagation();
                                playContinuousFromAyah(section.surahNumber, ay.ayahNumber);
                                return false;
                              }}
                              onTouchStart={e => handleAyahTouchStart(e, section.surahNumber, ay.ayahNumber)}
                              onTouchMove={handleAyahTouchMove}
                              onTouchEnd={e => handleAyahTouchEnd(e, section.surahNumber, ay.ayahNumber)}
                              onTouchCancel={handleAyahTouchCancel}
                              onDoubleClick={() => recordAyahError(section.surahNumber, ay.ayahNumber)}
                              onClick={() => {
                                if (isPlayingAudioRef.current) {
                                  playContinuousFromAyah(section.surahNumber, ay.ayahNumber);
                                }
                              }}
                              className={`mushaf-ayah-item relative inline cursor-pointer select-none transition-all duration-150 rounded px-1.5 py-0.5 ${
                                isTarget ? 'ayah-primary-target' : ''
                              } ${ay.isHighlighted ? 'ayah-highlighted' : ''} ${
                                isAudioActive ? 'ayah-recitation-active' : ''
                              }`}
                              style={{
                                touchAction: 'pan-y',
                                backgroundColor: isAudioActive
                                  ? `${themeAccent}40`
                                  : errCount > 0
                                  ? 'rgba(239, 68, 68, 0.16)'
                                  : ay.isHighlighted
                                  ? 'rgba(251, 191, 36, 0.18)'
                                  : 'transparent',
                                outline: isAudioActive ? `2.5px solid ${themeAccent}` : undefined,
                                boxShadow: isAudioActive ? `0 0 16px ${themeAccent}90` : undefined
                              }}
                              title="علق بإصبعك (Long Press) لبدء التلاوة المستمرة بصوت الشيخ من هذه الآية • انقر مرتين لرصد خطأ"
                            >
                              {/* Error Badge with Instant Clear on Click */}
                              {errCount > 0 && (
                                <button
                                  type="button"
                                  onClick={e =>
                                    handleClearSingleAyahError(e, section.surahNumber, ay.ayahNumber)
                                  }
                                  className="inline-flex items-center gap-0.5 mx-1 px-1.5 py-0.5 rounded-full text-[10px] font-black font-sans text-white bg-red-600 hover:bg-red-700 shadow cursor-pointer align-middle transition-transform hover:scale-110 active:scale-95"
                                  title="خطأ مسجل سحابياً - انقر لحذفه فوراً"
                                >
                                  <AlertTriangle className="w-2.5 h-2.5 inline" />
                                  <span>{toArabicNumerals(errCount)}</span>
                                  <X className="w-2.5 h-2.5 inline mr-0.5" />
                                </button>
                              )}

                              <span>{ay.text}</span>

                              {/* Ayah End Medallion ﴿١﴾ */}
                              <span
                                className="inline-block mx-1 font-mushaf text-[#a47e3b] font-normal select-none"
                                style={{ fontSize: '0.88em' }}
                              >
                                ﴿{toArabicNumerals(ay.ayahNumber)}﴾
                              </span>
                            </span>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Page Footer inside King Fahd Frame */}
            <div className="pt-3 mt-3 border-t-2 flex items-center justify-center font-mushaf select-none" style={{ borderColor: '#e4d3a2' }}>
              <div
                className="px-3 py-0.5 rounded-full border text-xs sm:text-sm font-bold text-[#654316]"
                style={{ backgroundColor: '#fcf6e8', borderColor: '#c5a059' }}
              >
                {toArabicNumerals(currentPage)}
              </div>
            </div>
          </div>

          {/* Floating Smooth Scroll Assist Controls for Mobile & All Screens */}
          {(canScrollUp || canScrollDown) && (
            <div
              className="sticky bottom-4 z-40 self-end mr-2 sm:mr-4 mb-2 flex flex-col gap-2 items-center pointer-events-auto transition-all"
              style={{ direction: 'ltr' }}
            >
              {canScrollUp && (
                <button
                  type="button"
                  onClick={() => handleSmoothScroll('up')}
                  className="w-10 h-10 rounded-full shadow-2xl border-2 flex items-center justify-center cursor-pointer transition-all active:scale-90 hover:scale-110 backdrop-blur-md"
                  style={{
                    backgroundColor: `${themePrimary}f0`,
                    borderColor: `${themeAccent}cc`,
                    color: themeAccent,
                    boxShadow: '0 6px 20px rgba(0,0,0,0.5)'
                  }}
                  title="تمرير سلس لأعلى المصحف"
                  aria-label="تمرير لأعلى"
                >
                  <ChevronUp className="w-5 h-5 stroke-[2.5]" />
                </button>
              )}

              {canScrollDown && (
                <button
                  type="button"
                  onClick={() => handleSmoothScroll('down')}
                  className="w-10 h-10 rounded-full shadow-2xl border-2 flex items-center justify-center cursor-pointer transition-all active:scale-90 hover:scale-110 backdrop-blur-md animate-bounce"
                  style={{
                    backgroundColor: themeAccent,
                    borderColor: themeAccent,
                    color: accentTextColor,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.6)'
                  }}
                  title="تمرير سلس لأسفل الصفحة لرؤية باقي الآيات"
                  aria-label="تمرير لأسفل"
                >
                  <ChevronDown className="w-5 h-5 stroke-[2.5]" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 4. BOTTOM NAVIGATION BAR (RESPONSIVE ACROSS ALL SCREENS)                  */}
        {/* ========================================================================= */}
        <div
          className="border-t px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 shrink-0 flex-wrap sm:flex-nowrap"
          style={{ backgroundColor: themeSecondary, borderColor: themeBorder }}
        >
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed border font-bold text-xs sm:text-sm cursor-pointer transition-all shadow-md active:scale-95 hover:brightness-110"
            style={{
              backgroundColor: themePrimary,
              borderColor: themeBorder,
              color: themeAccent
            }}
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" style={{ color: themeAccent }} />
            <span>
              <span className="hidden sm:inline">الوجه السابق </span>(ص{' '}
              {toArabicNumerals(currentPage > 1 ? currentPage - 1 : 1)})
            </span>
          </button>

          <div className="flex flex-col items-center text-center min-w-0">
            <span className="text-white font-bold text-[11px] sm:text-xs font-heading truncate max-w-[180px] sm:max-w-md">
              {formatPageTitle(currentPage)}
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="hidden md:inline text-[10px] text-slate-300">
                استخدم الأسهم (← / →) أو اسحب الصفحة للتقليب • اضغط (F) لملء الشاشة
              </span>
              {(canScrollUp || canScrollDown) && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleSmoothScroll('up')}
                    disabled={!canScrollUp}
                    className="px-2 py-0.5 rounded-lg border text-[10px] font-bold flex items-center gap-0.5 cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed transition-all active:scale-95 hover:brightness-110"
                    style={{ backgroundColor: themeCard, borderColor: themeBorder, color: themeAccent }}
                    title="تمرير سلس لأعلى الوجه"
                  >
                    <ChevronUp className="w-3 h-3" />
                    <span>أعلى</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSmoothScroll('down')}
                    disabled={!canScrollDown}
                    className="px-2 py-0.5 rounded-lg border text-[10px] font-bold flex items-center gap-0.5 cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed transition-all active:scale-95 hover:brightness-110"
                    style={{ backgroundColor: themeCard, borderColor: themeBorder, color: themeAccent }}
                    title="تمرير سلس لأسفل الوجه لرؤية باقي الآيات"
                  >
                    <ChevronDown className="w-3 h-3" />
                    <span>أسفل</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleNextPage}
            disabled={currentPage >= 604}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed font-black text-xs sm:text-sm cursor-pointer transition-all shadow-lg active:scale-95 hover:brightness-110"
            style={{
              backgroundColor: themeAccent,
              color: accentTextColor
            }}
          >
            <span>
              <span className="hidden sm:inline">الوجه التالي </span>(ص{' '}
              {toArabicNumerals(currentPage < 604 ? currentPage + 1 : 604)})
            </span>
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" style={{ color: accentTextColor }} />
          </button>
        </div>

        {/* Floating Continuous Recitation Active Controller Bar */}
        {isPlayingAudio && playingVerse && (
          <div
            className="absolute bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between gap-2 sm:gap-4 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-2xl shadow-2xl border-2 backdrop-blur-xl transition-all max-w-[94vw] w-fit"
            style={{
              backgroundColor: `${themePrimary}fa`,
              borderColor: themeAccent,
              boxShadow: `0 12px 36px rgba(0,0,0,0.65), 0 0 20px ${themeAccent}40`
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 border animate-pulse"
                style={{
                  backgroundColor: `${themeAccent}25`,
                  borderColor: themeAccent,
                  color: themeAccent
                }}
              >
                <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] sm:text-xs font-black text-white truncate flex items-center gap-1.5">
                  <span>سُورَةُ {getSurahInfo(playingVerse.surah)?.name || playingVerse.surah}</span>
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/40 border border-white/10"
                    style={{ color: themeAccent }}
                  >
                    آية {toArabicNumerals(playingVerse.ayah)}
                  </span>
                </div>
                <div className="text-[10px] text-slate-300 font-bold truncate flex items-center gap-1.5 mt-0.5">
                  <span className="hidden sm:inline">القارئ:</span>
                  <select
                    value={selectedReciterId}
                    onChange={e => handleReciterChange(e.target.value)}
                    className="bg-black/50 border border-white/20 text-[10px] text-amber-300 rounded px-1.5 py-0.5 outline-none cursor-pointer max-w-[130px] sm:max-w-[170px] truncate"
                    title="تغيير القارئ أثناء التلاوة"
                  >
                    {FAMOUS_RECITERS.map(r => (
                      <option key={r.id} value={r.id} style={{ backgroundColor: '#022c22', color: '#ffffff' }}>
                        {r.name.replace('الشيخ ', '').replace(' (المصحف المعلم)', ' - معلم').replace(' (المصحف المرتل)', '')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Quick Player Control Buttons */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 pr-2 border-r border-white/10">
              <button
                type="button"
                onClick={handlePlayPrevAyah}
                className="p-1.5 sm:p-2 rounded-xl border text-slate-200 hover:text-white transition-all cursor-pointer hover:brightness-110 active:scale-95"
                style={{ backgroundColor: themeCard, borderColor: themeBorder }}
                title="الآية السابقة"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={stopAudioPlayback}
                className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl font-black text-xs cursor-pointer shadow-md transition-all active:scale-95 bg-red-600 hover:bg-red-700 text-white"
                title="إيقاف التلاوة"
              >
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>إيقاف</span>
              </button>

              <button
                type="button"
                onClick={handlePlayNextAyah}
                className="p-1.5 sm:p-2 rounded-xl border text-slate-200 hover:text-white transition-all cursor-pointer hover:brightness-110 active:scale-95"
                style={{ backgroundColor: themeCard, borderColor: themeBorder }}
                title="الآية التالية"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Floating Cloud Save Notification Toast */}
        {lastErrorNotification && (
          <div
            className="absolute bottom-16 right-1/2 translate-x-1/2 z-50 border-2 text-white font-bold text-xs px-4 sm:px-5 py-2.5 rounded-2xl shadow-2xl flex items-center gap-2.5 backdrop-blur-md max-w-[92vw]"
            style={{
              backgroundColor: `${themePrimary}f5`,
              borderColor: lastErrorNotification.type === 'added' ? '#ef4444' : themeAccent
            }}
          >
            <AlertTriangle
              className="w-4 h-4 shrink-0"
              style={{ color: lastErrorNotification.type === 'added' ? '#f87171' : themeAccent }}
            />
            <span>{lastErrorNotification.text}</span>
          </div>
        )}
      </div>
    </div>
  );
};
