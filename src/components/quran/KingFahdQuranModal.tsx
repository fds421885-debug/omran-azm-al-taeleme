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
  SlidersHorizontal
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
  const [selectedReciterId, setSelectedReciterId] = useState<string>(() =>
    resolveInitialReciterId(selectedSheikhName)
  );
  const [audioScope, setAudioScope] = useState<'page' | 'highlight'>('page');
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [playingVerse, setPlayingVerse] = useState<{ surah: number; ayah: number } | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingAudioRef = useRef<boolean>(false);
  const audioQueueRef = useRef<Array<{ surah: number; ayah: number }>>([]);
  const audioQueueIndexRef = useRef<number>(0);

  const modalContainerRef = useRef<HTMLDivElement | null>(null);
  const mushafScrollRef = useRef<HTMLDivElement | null>(null);

  // Track deliberate navigation vs initial open so background syncs NEVER yank page or scroll
  const pendingFocusScrollRef = useRef<'target' | 'top' | null>('target');
  const lastHandledOpenSessionRef = useRef<string>('');

  // Sync reciter if teacher changed suggested sheikh while audio is stopped
  useEffect(() => {
    if (!isPlayingAudio && selectedSheikhName) {
      setSelectedReciterId(resolveInitialReciterId(selectedSheikhName));
    }
  }, [selectedSheikhName, isPlayingAudio]);

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

  // Built-in Audio Player Controls
  const stopAudioPlayback = useCallback(() => {
    isPlayingAudioRef.current = false;
    setIsPlayingAudio(false);
    setPlayingVerse(null);
    if (audioElRef.current) {
      try {
        audioElRef.current.pause();
        audioElRef.current.src = '';
      } catch {}
      audioElRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopAudioPlayback();
    };
  }, [stopAudioPlayback]);

  const playVerseAtQueueIndex = useCallback(
    (index: number, reciterIdOverride?: string) => {
      const queue = audioQueueRef.current;
      if (!isPlayingAudioRef.current || index < 0 || index >= queue.length) {
        stopAudioPlayback();
        return;
      }

      audioQueueIndexRef.current = index;
      const item = queue[index];
      setPlayingVerse(item);

      // Turn Mushaf page automatically (with animation & sound) if the recited verse is on another page!
      const versePage = getPageOfAyah(item.surah, item.ayah);
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

      // Smoothly scroll the playing verse into comfortable view
      setTimeout(() => {
        const container = mushafScrollRef.current;
        const el = document.getElementById(`mushaf-ayah-${item.surah}-${item.ayah}`);
        if (container && el) {
          const elRect = el.getBoundingClientRect();
          const cRect = container.getBoundingClientRect();
          if (elRect.top < cRect.top + 40 || elRect.bottom > cRect.bottom - 40) {
            const relTop = elRect.top - cRect.top + container.scrollTop;
            container.scrollTo({
              top: Math.max(0, relTop - container.clientHeight / 2 + elRect.height / 2),
              behavior: 'smooth'
            });
          }
        }
      }, 90);

      const folder = resolveReciterFolderById(reciterIdOverride || selectedReciterId);
      const sPad = String(item.surah).padStart(3, '0');
      const aPad = String(item.ayah).padStart(3, '0');
      const url = `https://everyayah.com/data/${folder}/${sPad}${aPad}.mp3`;

      if (audioElRef.current) {
        try {
          audioElRef.current.pause();
          audioElRef.current.src = '';
        } catch {}
      }

      const audio = new Audio(url);
      audioElRef.current = audio;

      audio.onended = () => {
        if (!isPlayingAudioRef.current) return;
        playVerseAtQueueIndex(index + 1, reciterIdOverride);
      };

      audio.onerror = () => {
        if (!isPlayingAudioRef.current) return;
        playVerseAtQueueIndex(index + 1, reciterIdOverride);
      };

      audio.play().catch(() => {
        stopAudioPlayback();
      });
    },
    [selectedReciterId, stopAudioPlayback, browsedPageStorageKey]
  );

  const handleToggleAudioPlay = () => {
    if (isPlayingAudio) {
      stopAudioPlayback();
      return;
    }

    let queue: Array<{ surah: number; ayah: number }> = [];
    if (audioScope === 'highlight' && activeHighlight) {
      queue = getExpandedAyahSequenceForRange(activeHighlight);
    } else {
      queue = getAyahsOnPage(currentPage);
    }

    if (queue.length === 0) return;

    audioQueueRef.current = queue;
    isPlayingAudioRef.current = true;
    setIsPlayingAudio(true);
    playVerseAtQueueIndex(0);
  };

  const handleReciterChange = (newReciterId: string) => {
    setSelectedReciterId(newReciterId);
    if (isPlayingAudioRef.current) {
      playVerseAtQueueIndex(audioQueueIndexRef.current, newReciterId);
    }
  };

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
      className={`fixed inset-0 z-[99999] flex flex-col bg-black/92 backdrop-blur-md overflow-hidden text-right select-none ${
        isFullscreen ? 'p-0' : 'p-1.5 sm:p-3 md:p-4'
      }`}
      dir="rtl"
    >
      {/* Quran Modal Main Wrapper Styled in Active Platform Theme */}
      <div
        className={`w-full h-full mx-auto flex flex-col shadow-2xl overflow-hidden relative transition-all duration-200 ${
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
        {/* 1. TOP CONTROL BAR: TITLE, PORTIONS, BUILT-IN AUDIO PLAYER & FULLSCREEN   */}
        {/* ========================================================================= */}
        <div
          className="border-b px-2.5 sm:px-4 py-2 sm:py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0"
          style={{
            background: `linear-gradient(to left, ${themeSecondary}, ${themePrimary}, ${themeSecondary})`,
            borderColor: themeBorder
          }}
        >
          {/* Right: Title & Per-Student Private Mushaf Badge */}
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl border flex items-center justify-center shadow-sm shrink-0"
              style={{
                backgroundColor: `${themeAccent}20`,
                borderColor: `${themeAccent}55`,
                color: themeAccent
              }}
            >
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="text-xs sm:text-sm md:text-base font-black font-heading text-white truncate">
                  مصحف الملك فهد • طبعة المدينة النبوية
                </h3>
                {studentName && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xl text-[10px] sm:text-[11px] font-black shadow-sm border max-w-[170px] sm:max-w-none truncate"
                    style={{
                      backgroundColor: themeAccent,
                      color: accentTextColor,
                      borderColor: themeAccent
                    }}
                  >
                    <User className="w-3 h-3 shrink-0" />
                    <span className="truncate">{studentName}</span>
                  </span>
                )}
                <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-xl text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <Cloud className="w-3 h-3" />
                  <span>حفظ سحابي</span>
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-300 mt-0.5 truncate">
                {juzHeaderTitle} • سورة {pageInfo.surahNames.join('، ')} • ص {toArabicNumerals(currentPage)} من {toArabicNumerals(604)}
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
            className="border-b px-2.5 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0"
            style={{
              backgroundColor: `${themePrimary}f2`,
              borderColor: themeBorder
            }}
          >
            {/* Quick Surah, Page Jump & Student Portion Switcher */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-slate-300 font-bold text-[11px] hidden sm:inline">السورة:</span>
                <select
                  value={pageInfo.startSurah}
                  onChange={e => handleJumpToSurah(Number(e.target.value))}
                  className="text-white border rounded-xl py-1 px-2 text-xs outline-none cursor-pointer font-bold max-w-[150px] sm:max-w-none"
                  style={{
                    backgroundColor: themeSecondary,
                    borderColor: themeBorder
                  }}
                >
                  {QURAN_SURAHS.map(s => (
                    <option key={s.number} value={s.number} style={{ backgroundColor: themePrimary, color: '#ffffff' }}>
                      {s.number}. سورة {s.name} ({s.numberOfAyahs})
                    </option>
                  ))}
                </select>
              </div>

              <form onSubmit={handleJumpToPageSubmit} className="flex items-center gap-1">
                <span className="text-slate-300 text-[11px]">ص:</span>
                <input
                  type="number"
                  min={1}
                  max={604}
                  value={searchPageInput}
                  onChange={e => setSearchPageInput(e.target.value)}
                  placeholder={currentPage.toString()}
                  className="w-12 sm:w-14 text-center font-bold border rounded-xl py-0.5 px-1 text-xs outline-none"
                  style={{
                    backgroundColor: themeSecondary,
                    borderColor: themeBorder,
                    color: themeAccent
                  }}
                />
                <button
                  type="submit"
                  className="px-2 py-1 rounded-xl font-black text-[11px] cursor-pointer hover:brightness-110 transition"
                  style={{
                    backgroundColor: themeAccent,
                    color: accentTextColor
                  }}
                >
                  انتقال
                </button>
              </form>

              {/* Quick Return to Recitation Page ONLY when user manually clicks it! */}
              {isAwayFromRecitationPage && (
                <button
                  type="button"
                  onClick={handleReturnToRecitationPosition}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-black border cursor-pointer hover:brightness-110 transition shadow-sm"
                  style={{
                    backgroundColor: `${themeAccent}22`,
                    borderColor: themeAccent,
                    color: themeAccent
                  }}
                  title="الرجوع إلى صفحة موضع التسميع المحدد"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>العودة لموضع التسميع (ص {recitationHomePage})</span>
                </button>
              )}

              {/* Student Portion Switcher Pills */}
              {highlightItems.length > 0 && (
                <div
                  className="flex items-center gap-1 p-0.5 rounded-xl border overflow-x-auto max-w-[92vw] sm:max-w-md"
                  style={{
                    backgroundColor: themePrimary,
                    borderColor: themeBorder
                  }}
                >
                  {highlightItems.map(item => {
                    const isSelected = item.id === selectedHighlightId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectHighlightItem(item)}
                        className="px-2 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1"
                        style={
                          isSelected
                            ? {
                                backgroundColor: themeAccent,
                                color: accentTextColor,
                                fontWeight: 900
                              }
                            : {
                                color: '#e2e8f0'
                              }
                        }
                      >
                        <span>{item.title}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Dual Top Hints: 1) Double-click to mark red  2) Click warning badge to remove that ayah's error */}
            <div className="flex items-center flex-wrap gap-1.5">
              <div
                className="inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-xl border shadow-sm"
                style={{
                  backgroundColor: `${themeSecondary}cc`,
                  borderColor: `${themeAccent}85`,
                  color: '#ffffff'
                }}
              >
                <Lightbulb className="w-3.5 h-3.5 shrink-0" style={{ color: themeAccent }} />
                <span style={{ color: themeAccent }}>لرصد الخطأ: اضغط مرتين على الآية</span>
              </div>

              <div
                className="inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-xl border shadow-sm"
                style={{
                  backgroundColor: `${themeSecondary}cc`,
                  borderColor: 'rgba(239, 68, 68, 0.65)',
                  color: '#fecaca'
                }}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span>لإزالة الخطأ: اضغط على علامة الإنذار بالآية</span>
              </div>

              {totalErrorsCount > 0 && (
                <div
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border font-black text-[11px] shadow-sm"
                  style={{
                    backgroundColor: 'rgba(153, 27, 27, 0.85)',
                    borderColor: `${themeAccent}80`,
                    color: '#fef2f2'
                  }}
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: themeAccent }} />
                  <span>
                    أخطاء الطالب: {toArabicNumerals(totalErrorVersesCount)} {totalErrorVersesCount === 1 ? 'آية' : 'آيات'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. MAIN MUSHAF PAGE CANVAS (AUTHENTIC KING FAHD MEDINA MUSHAF PRINT)      */}
        {/* ========================================================================= */}
        <div
          ref={mushafScrollRef}
          onTouchStart={handlePageTouchStart}
          onTouchEnd={handlePageTouchEnd}
          className={`flex-1 overflow-y-auto flex flex-col items-center justify-start relative scroll-smooth ${
            isFullscreen ? 'p-2 sm:p-5 md:p-6' : 'p-2 sm:p-5'
          }`}
          style={{
            background: `radial-gradient(circle at center, ${themeSecondary}55 0%, ${themePrimary} 65%, ${themeDarkBg} 100%)`
          }}
        >
          {/* Animated 3D Medina Mushaf Sheet */}
          <div
            key={flipAnimKey}
            className={`w-full ${
              isFullscreen ? 'max-w-5xl' : 'max-w-3xl'
            } bg-[#fffdf5] text-[#14120e] rounded-2xl sm:rounded-3xl p-2.5 sm:p-5 md:p-7 shadow-2xl border-[3px] relative ${
              flipDirection === 'next'
                ? 'mushaf-flip-next'
                : flipDirection === 'prev'
                ? 'mushaf-flip-prev'
                : ''
            }`}
            style={{
              borderColor: '#1f6f54',
              boxShadow: `0 0 0 3px #d4af3766, 0 25px 55px -12px rgba(0, 0, 0, 0.72)`
            }}
          >
            {/* Subtle Spine Shadow for Open Book Realism */}
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-5 sm:w-8 rounded-r-2xl opacity-35"
              style={{
                background:
                  currentPage % 2 === 1
                    ? 'linear-gradient(to left, rgba(120, 92, 40, 0.28), transparent)'
                    : 'none'
              }}
            />
            <div
              className="pointer-events-none absolute inset-y-0 left-0 w-5 sm:w-8 rounded-l-2xl opacity-35"
              style={{
                background:
                  currentPage % 2 === 0
                    ? 'linear-gradient(to right, rgba(120, 92, 40, 0.28), transparent)'
                    : 'none'
              }}
            />

            {/* King Fahd Medina Mushaf Top Outer Marginal Header (الجُزْءُ يميناً • اسم السورة يساراً) */}
            {!isSpecialMedinaOpeningPage && (
              <div className="flex items-center justify-between px-2 sm:px-4 pb-2 text-xs sm:text-sm font-quran text-[#1b4d3e] select-none">
                <div className="flex items-center gap-2 font-bold">
                  <span>{juzHeaderTitle}</span>
                  {pageMarkersInfo.hasRub && (
                    <span className="font-mushaf text-[#9a6b16] text-sm" title="يحتوي هذا الوجه على علامة حزب / ربع">
                      ۞
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 font-bold">
                  {pageMarkersInfo.hasSajdah && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-[#f6ecd2] border border-[#c8a24b] text-[#78510f]"
                      title="يحتوي هذا الوجه على موضع سجدة تلاوة"
                    >
                      <span>سَجْدَة</span>
                      <span className="font-mushaf text-sm leading-none">۩</span>
                    </span>
                  )}
                  <span>سُورَةُ {pageSections.map(s => s.surahInfo.name).join(' - ')}</span>
                </div>
              </div>
            )}

            {/* Authentic King Fahd Double-Framed Ornamental Inner Border */}
            <div
              className={`relative rounded-xl sm:rounded-2xl border-2 ${
                isSpecialMedinaOpeningPage
                  ? 'p-4 sm:p-8 md:p-10 bg-gradient-to-b from-[#fffef8] via-[#fffdf4] to-[#fcf8e8]'
                  : 'p-3.5 sm:p-7 md:p-9 bg-[#fffdf6]'
              }`}
              style={{
                borderColor: '#b78b2e',
                boxShadow: 'inset 0 0 0 3px #f6edd3, inset 0 0 0 5px #1f6f54'
              }}
            >
              {/* Four Corner Medina Arabesque Ornaments */}
              <span className="pointer-events-none absolute top-1.5 right-1.5 w-3.5 h-3.5 border-t-2 border-r-2 border-[#b78b2e] rounded-tr-sm" />
              <span className="pointer-events-none absolute top-1.5 left-1.5 w-3.5 h-3.5 border-t-2 border-l-2 border-[#b78b2e] rounded-tl-sm" />
              <span className="pointer-events-none absolute bottom-1.5 right-1.5 w-3.5 h-3.5 border-b-2 border-r-2 border-[#b78b2e] rounded-br-sm" />
              <span className="pointer-events-none absolute bottom-1.5 left-1.5 w-3.5 h-3.5 border-b-2 border-l-2 border-[#b78b2e] rounded-bl-sm" />

              {/* Sections & Ayahs on this page */}
              <div className="space-y-5">
                {pageSections.map(sec => {
                  return (
                    <div key={sec.surahNumber} className="space-y-3">
                      {/* Authentic King Fahd Ornate Surah Header Cartouche */}
                      {sec.isSurahBeginning && (
                        <div className="my-2 sm:my-3 text-center select-none">
                          <div
                            className="relative mx-auto w-full max-w-xl py-2 sm:py-2.5 px-4 sm:px-8 rounded-xl border-2 shadow-sm flex items-center justify-between"
                            style={{
                              background:
                                'linear-gradient(90deg, #e9d7a5 0%, #fbf3dc 20%, #fffdf5 50%, #fbf3dc 80%, #e9d7a5 100%)',
                              borderColor: '#b78b2e',
                              boxShadow: 'inset 0 0 0 2px #1f6f54'
                            }}
                          >
                            <span className="text-[11px] sm:text-xs font-quran font-bold text-[#1f6f54]">
                              {sec.surahInfo.revelationType === 'مكية' ? 'مَكِّيَّةٌ' : 'مَدَنِيَّةٌ'}
                            </span>

                            <h4 className="font-quran text-lg sm:text-2xl font-bold text-[#143d30] tracking-wide">
                              سُورَةُ {sec.surahInfo.name}
                            </h4>

                            <span className="text-[11px] sm:text-xs font-quran font-bold text-[#1f6f54]">
                              آيَاتُهَا {toArabicNumerals(sec.surahInfo.numberOfAyahs)}
                            </span>
                          </div>

                           {/* Exact King Fahd Uthmani Basmalah Line (KFGQPC v18 encoding with ۡ رأس الحاء):
                              - Surah 1 (Al-Fatihah): Basmalah IS Ayah 1 inside the verse stream (no separate banner)
                              - Surah 9 (At-Tawbah): No Basmalah
                              - All other Surahs (2..114 except 9): Single centered Uthmani Basmalah line */}
                          {sec.surahNumber !== 1 && sec.surahNumber !== 9 && (
                            <div
                              className="text-center font-mushaf pt-3 pb-1 text-[#14120e]"
                              style={{ fontSize: `${Math.max(20, Math.round(fontSize * 0.96))}px` }}
                            >
                              بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ
                            </div>
                          )}
                        </div>
                      )}

                      {/* Continuous Authentic King Fahd Uthmani Text Stream */}
                      <div
                        className={`font-mushaf ${
                          isSpecialMedinaOpeningPage ? 'text-center max-w-xl mx-auto py-3' : 'text-justify'
                        } leading-[2.35] sm:leading-[2.5] text-[#14120e] tracking-normal selection:bg-amber-200`}
                        style={{
                          fontSize: `${fontSize}px`,
                          textAlignLast: isSpecialMedinaOpeningPage ? 'center' : 'center'
                        }}
                        dir="rtl"
                      >
                        {sec.ayahs.map(ayah => {
                          const ayahKey = `${sec.surahNumber}:${ayah.ayahNumber}`;
                          const errorCount = ayahErrors[ayahKey] || 0;
                          const isAudioActive =
                            playingVerse?.surah === sec.surahNumber &&
                            playingVerse?.ayah === ayah.ayahNumber;
                          const isPrimaryHighlightStart =
                            activeHighlight &&
                            sec.surahNumber === activeHighlight.surahNumber &&
                            ayah.ayahNumber === activeHighlight.fromAyah;

                          return (
                            <React.Fragment key={ayah.ayahNumber}>
                              <span
                                id={`mushaf-ayah-${sec.surahNumber}-${ayah.ayahNumber}`}
                                onDoubleClick={e => {
                                  e.preventDefault();
                                  recordAyahError(sec.surahNumber, ayah.ayahNumber);
                                }}
                                onTouchStart={e =>
                                  handleTouchStartWithDoubleTap(e, sec.surahNumber, ayah.ayahNumber)
                                }
                                className={`transition-colors rounded-lg px-1 py-0.5 inline relative cursor-pointer select-none ${
                                  errorCount > 0
                                    ? 'bg-red-500/20 text-red-950 border-b-2 border-red-600 ring-1 ring-red-500/40'
                                    : isAudioActive
                                    ? 'bg-emerald-500/25 text-[#052e16] ring-2 ring-emerald-600 shadow-sm'
                                    : isPrimaryHighlightStart
                                    ? 'ayah-primary-target ayah-highlighted bg-[#fbbf24]/45 text-[#14120e] ring-1 ring-[#d97706]/70'
                                    : ayah.isHighlighted
                                    ? 'ayah-highlighted bg-[#fbbf24]/28 text-[#14120e] border-b border-[#d97706]/50'
                                    : 'hover:bg-amber-200/45'
                                }`}
                                title={
                                  errorCount > 0
                                    ? `آية بها خطأ مسجل | اضغط على علامة الإنذار لإزالة الخطأ من هذه الآية`
                                    : `اضغط مرتين على الآية لرصد خطأ تسميع | سورة ${sec.surahInfo.name} - آية ${toArabicNumerals(ayah.ayahNumber)}`
                                }
                              >
                                {ayah.text}
                                {/* Authentic King Fahd Ornate Ayah End Marker:
                                    In KFGQPC UthmanicHafs, Eastern Arabic digits (١..٢٨٦) automatically render
                                    as the authentic ornate Medina Mushaf verse-end rosette! */}
                                <span
                                  className={`inline mx-1 select-none ${
                                    errorCount > 0
                                      ? 'text-red-700'
                                      : isAudioActive
                                      ? 'text-emerald-800'
                                      : 'text-[#8a6116]'
                                  }`}
                                >
                                  {'\u00A0'}
                                  {toArabicNumerals(ayah.ayahNumber)}{' '}
                                </span>

                                {/* Warning Sign Error Badge (علامة الإنذار بثيم المنصة) — Click to clear ONLY this ayah's error */}
                                {errorCount > 0 && (
                                  <button
                                    type="button"
                                    onClick={e =>
                                      handleClearSingleAyahError(e, sec.surahNumber, ayah.ayahNumber)
                                    }
                                    onDoubleClick={e => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                    }}
                                    onMouseDown={e => e.stopPropagation()}
                                    onTouchStart={e =>
                                      handleClearSingleAyahError(e, sec.surahNumber, ayah.ayahNumber)
                                    }
                                    className="font-sans inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded-xl text-[11px] font-black border-2 shadow-md cursor-pointer active:scale-95 hover:brightness-110 transition-all select-none align-middle"
                                    style={{
                                      backgroundColor: themePrimary,
                                      borderColor: '#dc2626',
                                      color: '#fecaca',
                                      boxShadow: `0 2px 8px rgba(220, 38, 38, 0.35)`
                                    }}
                                    title="اضغط على علامة الإنذار لإزالة الخطأ من هذه الآية"
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                    <span>
                                      {errorCount > 1
                                        ? `${toArabicNumerals(errorCount)} أخطاء`
                                        : 'خطأ'}
                                    </span>
                                  </button>
                                )}
                              </span>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* King Fahd Medina Mushaf Centered Bottom Page Number Cartouche */}
            <div className="mt-3 flex items-center justify-center select-none">
              <div
                className="px-5 py-0.5 rounded-full border text-sm sm:text-base font-bold text-[#1b4d3e] bg-[#fbf3dc]"
                style={{ borderColor: '#b78b2e' }}
              >
                {toArabicNumerals(currentPage)}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. BOTTOM NAVIGATION BAR (RESPONSIVE ACROSS ALL SCREENS)                  */}
        {/* ========================================================================= */}
        <div
          className="border-t px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 sm:gap-4 shrink-0"
          style={{
            background: `linear-gradient(to left, ${themeSecondary}, ${themePrimary}, ${themeSecondary})`,
            borderColor: themeBorder
          }}
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
            <span className="hidden md:inline text-[10px] text-slate-300">
              استخدم الأسهم (← / →) أو اسحب الصفحة للتقليب • اضغط (F) لملء الشاشة
            </span>
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
