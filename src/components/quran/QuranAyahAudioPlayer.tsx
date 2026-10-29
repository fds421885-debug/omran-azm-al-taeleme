import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Headphones,
  CheckCircle2,
  Volume2,
  VolumeX,
  Clock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Student, StudentListeningLog } from '../../types';
import { OmranDataService } from '../../lib/firebase';
import { getSurahInfo } from '../../data/quranData';
import { getExpandedAyahSequenceForRange } from '../../data/quranPagesData';
import { normalizeKfgqpcHafsText } from '../../lib/quranTextService';

function toArabicNumerals(n: number): string {
  const digits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(n).replace(/\d/g, (d) => digits[Number(d)]);
}

// EveryAyah CDN Reciters mapping with high-quality verified audio endpoints
export const EVERY_AYAH_RECITERS: Record<string, { folder: string; label: string }> = {
  minshawi: {
    folder: 'Minshawy_Teacher_128kbps',
    label: 'الشيخ محمد صديق المنشاوي (المصحف المعلم)'
  },
  hussary: {
    folder: 'Husary_Muallim_128kbps',
    label: 'الشيخ محمود خليل الحصري (المصحف المعلم)'
  },
  afasy: {
    folder: 'Alafasy_128kbps',
    label: 'الشيخ مشاري بن راشد العفاسي'
  },
  abdulbasit: {
    folder: 'Abdul_Basit_Murattal_192kbps',
    label: 'الشيخ عبد الباسط عبد الصمد (المصحف المرتل)'
  },
  hudhaify: {
    folder: 'Hudhaify_128kbps',
    label: 'الشيخ علي بن عبد الرحمن الحذيفي'
  },
  suwaid: {
    folder: 'Ayman_Sowaid_64kbps',
    label: 'الدكتور أيمن رشدي سويد'
  }
};

export function resolveReciterFolder(sheikhName?: string): { folder: string; label: string } {
  if (!sheikhName) return EVERY_AYAH_RECITERS.minshawi;
  const lower = sheikhName.toLowerCase();
  if (lower.includes('منشاوي') || lower.includes('minshawi')) return EVERY_AYAH_RECITERS.minshawi;
  if (lower.includes('حصري') || lower.includes('hussary') || lower.includes('husary')) return EVERY_AYAH_RECITERS.hussary;
  if (lower.includes('عفاسي') || lower.includes('afasy') || lower.includes('alafasy')) return EVERY_AYAH_RECITERS.afasy;
  if (lower.includes('عبد الباسط') || lower.includes('abdulbasit') || lower.includes('عبدالباسط')) return EVERY_AYAH_RECITERS.abdulbasit;
  if (lower.includes('حذيفي') || lower.includes('hudhaify')) return EVERY_AYAH_RECITERS.hudhaify;
  if (lower.includes('سويد') || lower.includes('suwaid') || lower.includes('sowaid')) return EVERY_AYAH_RECITERS.suwaid;
  return EVERY_AYAH_RECITERS.minshawi;
}

// Build standard padded EveryAyah mp3 URL (e.g. 026009.mp3 for Surah 26, Ayah 9)
export function getAyahAudioUrl(folder: string, surah: number, ayah: number): string {
  const sPad = String(surah).padStart(3, '0');
  const aPad = String(ayah).padStart(3, '0');
  return `https://everyayah.com/data/${folder}/${sPad}${aPad}.mp3`;
}

interface QuranAyahAudioPlayerProps {
  student: Student;
  surahNumber: number;
  surahName: string;
  fromAyah: number;
  toSurahNumber?: number;
  toSurahName?: string;
  toAyah: number;
  selectedSheikhName?: string;
  requiredRepetitions?: number; // 0 to 20 set by teacher
  listeningPointsReward?: number; // points awarded on completion
  onRepetitionComplete?: (newCompletedCount: number, isFullyDone: boolean) => void;
  onListeningPointsAwarded?: (points: number) => void;
}

export const QuranAyahAudioPlayer: React.FC<QuranAyahAudioPlayerProps> = ({
  student,
  surahNumber,
  surahName,
  fromAyah,
  toSurahNumber,
  toSurahName,
  toAyah,
  selectedSheikhName,
  requiredRepetitions = 3,
  listeningPointsReward = 5,
  onRepetitionComplete,
  onListeningPointsAwarded
}) => {
  const isNoneSheikh =
    selectedSheikhName === 'بدون' ||
    selectedSheikhName === 'لا يوجد' ||
    requiredRepetitions === 0;

  const safeStartSurah = Math.max(1, Math.min(surahNumber || 78, 114));
  const safeEndSurah = Math.max(1, Math.min(toSurahNumber || safeStartSurah, 114));
  const startSurahInfo = getSurahInfo(safeStartSurah);
  const endSurahInfo = getSurahInfo(safeEndSurah);
  const startAyah = Math.max(1, Math.min(fromAyah || 1, startSurahInfo.numberOfAyahs));
  const endAyah =
    safeStartSurah === safeEndSurah
      ? Math.max(startAyah, Math.min(toAyah || startAyah, startSurahInfo.numberOfAyahs))
      : Math.max(1, Math.min(toAyah || endSurahInfo.numberOfAyahs, endSurahInfo.numberOfAyahs));

  const ayahSequence = useMemo(
    () =>
      getExpandedAyahSequenceForRange({
        surahNumber: safeStartSurah,
        fromAyah: startAyah,
        toSurahNumber: safeEndSurah,
        toAyah: endAyah
      }),
    [safeStartSurah, startAyah, safeEndSurah, endAyah]
  );

  const portionHeading = useMemo(() => {
    const resolvedStartName = surahName || startSurahInfo.name;
    const resolvedEndName = toSurahName || endSurahInfo.name;
    if (safeStartSurah === safeEndSurah) {
      return `سورة ${resolvedStartName} : الآيات (${startAyah} - ${endAyah})`;
    }
    return `من سورة ${resolvedStartName} (${startAyah}) إلى سورة ${resolvedEndName} (${endAyah})`;
  }, [safeStartSurah, safeEndSurah, surahName, toSurahName, startSurahInfo.name, endSurahInfo.name, startAyah, endAyah]);

  const [selectedSheikhKey, setSelectedSheikhKey] = useState<string>(() => {
    if (!selectedSheikhName) return 'minshawi';
    const lower = selectedSheikhName.toLowerCase();
    if (lower.includes('حصري') || lower.includes('hussary') || lower.includes('husary')) return 'hussary';
    if (lower.includes('عفاسي') || lower.includes('afasy') || lower.includes('alafasy')) return 'afasy';
    if (lower.includes('عبد الباسط') || lower.includes('abdulbasit') || lower.includes('عبدالباسط')) return 'abdulbasit';
    if (lower.includes('حذيفي') || lower.includes('hudhaify')) return 'hudhaify';
    if (lower.includes('سويد') || lower.includes('suwaid') || lower.includes('sowaid')) return 'suwaid';
    return 'minshawi';
  });

  // Keep reciter folder updated with current selection
  const reciterConfig = EVERY_AYAH_RECITERS[selectedSheikhKey] || resolveReciterFolder(selectedSheikhName);

  // Repetition progress state (persistent in localStorage & listening_logs)
  const todayKey = new Date().toISOString().split('T')[0];
  const storageProgressKey = `omran_listening_${student.id}_${todayKey}_${safeStartSurah}_${startAyah}_${safeEndSurah}_${endAyah}`;

  const [completedRepetitions, setCompletedRepetitions] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(storageProgressKey);
      return saved ? Number(saved) : 0;
    } catch {
      return 0;
    }
  });

  const [isCompletedAll, setIsCompletedAll] = useState<boolean>(() => {
    if (isNoneSheikh) return true;
    try {
      const saved = localStorage.getItem(storageProgressKey);
      return saved ? Number(saved) >= requiredRepetitions : false;
    } catch {
      return false;
    }
  });

  // Current playing state (index inside ayahSequence)
  const [isPlaying, setIsPlaying] = useState(false);
  const [sequenceIndex, setSequenceIndex] = useState<number>(0);
  const [currentAyahText, setCurrentAyahText] = useState<string>('');
  const [isLoadingAyahText, setIsLoadingAyahText] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [, setAudioError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef<boolean>(false);
  const sequenceIndexRef = useRef<number>(0);
  const completedRepsRef = useRef<number>(completedRepetitions);
  const loopTimeoutRef = useRef<any>(null);

  const currentPair = ayahSequence[sequenceIndex] || ayahSequence[0] || { surah: safeStartSurah, ayah: startAyah };
  const currentPairSurahName = getSurahInfo(currentPair.surah).name;

  // Reset sequence position if assigned range changes
  useEffect(() => {
    sequenceIndexRef.current = 0;
    setSequenceIndex(0);
  }, [safeStartSurah, startAyah, safeEndSurah, endAyah]);

  // Keep refs synced
  useEffect(() => {
    sequenceIndexRef.current = sequenceIndex;
  }, [sequenceIndex]);

  useEffect(() => {
    completedRepsRef.current = completedRepetitions;
  }, [completedRepetitions]);

  // Sync completion status when required repetitions change
  useEffect(() => {
    if (isNoneSheikh) {
      setIsCompletedAll(true);
    } else if (completedRepetitions >= requiredRepetitions) {
      setIsCompletedAll(true);
    }
  }, [completedRepetitions, requiredRepetitions, isNoneSheikh]);

  // Fetch Ayah Text from local cache / public JSON
  useEffect(() => {
    let isCancelled = false;
    const targetSurah = currentPair.surah;
    const targetAyah = currentPair.ayah;

    const loadText = async () => {
      setIsLoadingAyahText(true);
      try {
        const res = await fetch(`/api/quran/surah/${targetSurah}`);
        if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
          const data = await res.json();
          if (!isCancelled && data?.ayahs && Array.isArray(data.ayahs)) {
            const rawText = data.ayahs[targetAyah - 1] || '';
            setCurrentAyahText(rawText);
            setIsLoadingAyahText(false);
            return;
          }
        }
      } catch {
        // Fallback
      }

      // Fallback to fetch public quran-verses.json directly
      try {
        const res = await fetch('/quran-verses.json');
        if (res.ok) {
          const allVerses = await res.json();
          if (!isCancelled && allVerses[targetSurah] && allVerses[targetSurah][targetAyah - 1]) {
            setCurrentAyahText(allVerses[targetSurah][targetAyah - 1]);
            setIsLoadingAyahText(false);
            return;
          }
        }
      } catch {}

      if (!isCancelled) {
        setCurrentAyahText(`الآية رقم (${targetAyah}) من سورة ${currentPairSurahName}`);
        setIsLoadingAyahText(false);
      }
    };

    loadText();
    return () => {
      isCancelled = true;
    };
  }, [currentPair.surah, currentPair.ayah, currentPairSurahName]);

  // Cleanup audio on unmount or target change
  useEffect(() => {
    return () => {
      isPlayingRef.current = false;
      if (loopTimeoutRef.current) {
        clearTimeout(loopTimeoutRef.current);
        loopTimeoutRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, [safeStartSurah, startAyah, safeEndSurah, endAyah, reciterConfig.folder]);

  const playSequenceAtRef = useRef<(idx: number) => void>(() => {});

  // Handle entire passage completion: increments repetitions and checks if reached target
  const handlePassageCompleted = useCallback(async () => {
    const nextCount = completedRepsRef.current + 1;
    completedRepsRef.current = nextCount;
    setCompletedRepetitions(nextCount);
    try {
      localStorage.setItem(storageProgressKey, String(nextCount));
    } catch {}

    const isFullyDone = requiredRepetitions > 0 && nextCount >= requiredRepetitions;

    if (isFullyDone && !isCompletedAll) {
      setIsCompletedAll(true);
      try {
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.6 }
        });
      } catch {}
      if (onListeningPointsAwarded) {
        onListeningPointsAwarded(listeningPointsReward);
      }
    }

    if (onRepetitionComplete) {
      onRepetitionComplete(nextCount, isFullyDone);
    }

    // Record listening log in Firestore
    const logEntry: StudentListeningLog = {
      id: `listen_${Date.now()}_${student.id}`,
      studentId: student.id,
      studentName: student.name,
      halaqahId: student.halaqahId,
      surahNumber: safeStartSurah,
      surahName: surahName || startSurahInfo.name,
      fromAyah: startAyah,
      toAyah: endAyah,
      targetCount: requiredRepetitions,
      completedCount: nextCount,
      isFullyCompleted: isFullyDone,
      date: todayKey,
      timestamp: new Date().toISOString()
    };
    OmranDataService.saveListeningLog(logEntry).catch(() => {});

    // KEY REQUIREMENT: When finished required repetitions, stop automatically!
    // The student can press play again if they want extra repetitions.
    if (requiredRepetitions > 0 && nextCount >= requiredRepetitions) {
      isPlayingRef.current = false;
      setIsPlaying(false);
      if (loopTimeoutRef.current) {
        clearTimeout(loopTimeoutRef.current);
        loopTimeoutRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      return;
    }

    // If more repetitions needed, automatically restart from index 0 seamlessly!
    if (isPlayingRef.current) {
      if (loopTimeoutRef.current) clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = setTimeout(() => {
        if (isPlayingRef.current) {
          playSequenceAtRef.current(0);
        }
      }, 450);
    }
  }, [
    requiredRepetitions,
    isCompletedAll,
    onListeningPointsAwarded,
    listeningPointsReward,
    onRepetitionComplete,
    student,
    safeStartSurah,
    surahName,
    startSurahInfo.name,
    startAyah,
    endAyah,
    todayKey,
    storageProgressKey
  ]);

  // Main Ayah Audio Player callback across sequence
  const playSequenceAt = useCallback((seqIdx: number) => {
    if (!isPlayingRef.current || ayahSequence.length === 0) return;
    const boundedIdx = Math.max(0, Math.min(seqIdx, ayahSequence.length - 1));
    const item = ayahSequence[boundedIdx];
    setAudioError(null);
    sequenceIndexRef.current = boundedIdx;
    setSequenceIndex(boundedIdx);

    if (loopTimeoutRef.current) {
      clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = null;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;
    audio.pause();

    const audioUrl = getAyahAudioUrl(reciterConfig.folder, item.surah, item.ayah);
    audio.src = audioUrl;
    audio.muted = isMuted;

    audio.onended = () => {
      if (!isPlayingRef.current) return;
      if (boundedIdx + 1 < ayahSequence.length) {
        playSequenceAtRef.current(boundedIdx + 1);
      } else {
        handlePassageCompleted();
      }
    };

    audio.onerror = () => {
      if (!isPlayingRef.current) return;
      if (boundedIdx + 1 < ayahSequence.length) {
        playSequenceAtRef.current(boundedIdx + 1);
      } else {
        handlePassageCompleted();
      }
    };

    audio.play().catch(() => {});
  }, [ayahSequence, reciterConfig.folder, isMuted, handlePassageCompleted]);

  useEffect(() => {
    playSequenceAtRef.current = playSequenceAt;
  }, [playSequenceAt]);

  const handleTogglePlay = () => {
    setAudioError(null);
    if (isPlaying) {
      // Pause
      isPlayingRef.current = false;
      setIsPlaying(false);
      if (loopTimeoutRef.current) {
        clearTimeout(loopTimeoutRef.current);
        loopTimeoutRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    } else {
      // Play
      isPlayingRef.current = true;
      setIsPlaying(true);
      playSequenceAt(sequenceIndexRef.current || 0);
    }
  };

  const handleResetRepetitions = () => {
    isPlayingRef.current = false;
    setIsPlaying(false);
    if (loopTimeoutRef.current) {
      clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    sequenceIndexRef.current = 0;
    setSequenceIndex(0);
    completedRepsRef.current = 0;
    setCompletedRepetitions(0);
    setIsCompletedAll(false);
    try {
      localStorage.removeItem(storageProgressKey);
    } catch {}
    if (onRepetitionComplete) {
      onRepetitionComplete(0, false);
    }
  };

  // If teacher selected "بدون", student is exempt and does NOT need to listen!
  if (isNoneSheikh) {
    return (
      <div className="bg-gradient-to-br from-[#022c22] via-[#064e3b] to-[#022c22] border-2 border-emerald-500/40 rounded-[32px] p-6 sm:p-7 shadow-2xl text-white relative overflow-hidden select-none">
        <div className="absolute inset-0 opacity-5 pointer-events-none artistic-pattern" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shadow-inner shrink-0">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300 border border-emerald-400/30">
                  معفى من الاستماع
                </span>
                <span className="text-xs text-[#86efac] font-medium">
                  القارئ: بدون (٠ مرات مطلوبة)
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold font-heading text-white mt-1">
                {portionHeading}
              </h3>
              <p className="text-xs text-[#86efac]/90 mt-1 leading-relaxed">
                حدد المعلم لهذه الجلسة خيار (بدون استماع) • لا يتطلب منك الاستماع لمقرر اليوم. ركّز على التكرار وتثبيت الحفظ والمراجعة!
              </p>
            </div>
          </div>
          <div className="px-4 py-2 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold text-xs flex items-center gap-2 shrink-0">
            <Sparkles className="w-4 h-4 text-emerald-300" />
            <span>معفى من السماع ومكتمل بنجاح (٠ / ٠)</span>
          </div>
        </div>
      </div>
    );
  }

  const progressPercent = Math.min(
    100,
    Math.round((completedRepetitions / Math.max(1, requiredRepetitions)) * 100)
  );

  return (
    <div className="bg-gradient-to-br from-[#022c22] via-[#064e3b] to-[#022c22] border-2 border-b-[6px] border-[#fbbf24] border-b-amber-700 rounded-[32px] p-5 sm:p-7 shadow-2xl text-white relative overflow-hidden select-none">
      {/* Decorative Islamic Background Pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none artistic-pattern" />

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b-2 border-emerald-600/30 pb-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-400 text-emerald-950 flex items-center justify-center font-black border-2 border-b-4 border-amber-600 shadow-md">
            <Headphones className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black px-3 py-1 rounded-full bg-amber-400 text-emerald-950 shadow-sm">
                مقرر الاستماع والتكرار
              </span>
              <span className="text-xs text-[#86efac] font-bold">
                بصوت: {reciterConfig.label}
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black font-heading text-white mt-1">
              {portionHeading}
            </h3>
          </div>
        </div>

        {/* Repetition Status Badge */}
        <div className="flex items-center gap-2">
          {isCompletedAll ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/25 border-2 border-emerald-400 border-b-4 border-b-emerald-600 text-emerald-300 font-black text-xs shadow-md">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>أتممت الاستماع المقرر بنجاح (+{toArabicNumerals(listeningPointsReward)} نقاط)</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-[#011a14] border-2 border-emerald-700/60 border-b-4 border-b-[#011a14] text-amber-300 font-black text-xs shadow-sm">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>
                المطلوب: {toArabicNumerals(requiredRepetitions)} تكرارات • المنجز: {toArabicNumerals(completedRepetitions)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Reciter Selector Switcher (التبديل بين المشايخ بضغطة واحدة وبشكل مباشر) */}
      <div className="mt-4 mb-2 p-3 sm:p-3.5 rounded-2xl bg-[#011a14]/90 border-2 border-emerald-700/60 border-b-4 border-b-[#011a14] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 relative z-10 text-xs shadow-md">
        <div className="flex items-center gap-2 text-slate-200 font-black">
          <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
          <span>تبديل القارئ المفضل:</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {Object.entries(EVERY_AYAH_RECITERS).map(([key, item]) => {
            const isSelected = selectedSheikhKey === key;
            const shortLabel =
              key === 'minshawi' ? 'المنشاوي (المعلم)' :
              key === 'hussary' ? 'الحصري (المعلم)' :
              key === 'afasy' ? 'مشاري العفاسي' :
              key === 'abdulbasit' ? 'عبد الباسط (مرتل)' :
              key === 'hudhaify' ? 'الحذيفي' :
              'أيمن سويد';

            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (selectedSheikhKey === key) return;
                  setSelectedSheikhKey(key);
                  if (isPlayingRef.current) {
                    setTimeout(() => {
                      playSequenceAt(sequenceIndexRef.current);
                    }, 50);
                  }
                }}
                className={`px-3 py-1.5 rounded-xl font-black text-[11px] transition-all cursor-pointer border-2 active:translate-y-[2px] active:border-b-2 shadow-sm ${
                  isSelected
                    ? 'bg-amber-400 text-emerald-950 border-amber-300 border-b-4 border-b-amber-600 shadow-md'
                    : 'bg-[#022c22] text-slate-200 hover:text-white border-emerald-700/60 border-b-4 border-b-[#011a14] hover:bg-[#064e3b]'
                }`}
                title={item.label}
              >
                {shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Ayah Display Box (Verse by Verse with Smooth Animation) */}
      <div className="my-6 relative z-10 min-h-[160px] sm:min-h-[190px] flex flex-col justify-center items-center p-6 sm:p-8 rounded-3xl bg-[#011a14] border-2 border-emerald-700/60 border-b-4 border-b-[#011a14] shadow-inner text-center">
        {/* Ayah Indicator */}
        <div className="text-xs font-black text-[#86efac] mb-3 flex flex-wrap items-center justify-center gap-2">
          <span>سورة {currentPairSurahName} • الآية ({toArabicNumerals(currentPair.ayah)})</span>
          <span className="px-3 py-0.5 rounded-full bg-[#064e3b] text-amber-300 border border-emerald-600/50 font-mono font-black">
            {toArabicNumerals(sequenceIndex + 1)} من {toArabicNumerals(ayahSequence.length)}
          </span>
        </div>

        {/* Ayah Arabic Calligraphy (King Fahd Medina Mushaf UthmanicHafs) */}
        <div className="transition-all duration-500 ease-in-out">
          {isLoadingAyahText ? (
            <div className="flex items-center gap-2 text-sm text-[#86efac]/70">
              <span className="w-4 h-4 border-2 border-[#fbbf24] border-t-transparent rounded-full animate-spin" />
              <span>جاري تحميل الآية الكريمة...</span>
            </div>
          ) : (
            <div className="font-mushaf text-2xl sm:text-3xl md:text-4xl text-[#f0f9f6] leading-[2] sm:leading-[2.15] text-center max-w-2xl px-2">
              {normalizeKfgqpcHafsText(currentAyahText)}{'\u00A0'}
              <span className="text-amber-400 mx-1 select-none">
                {toArabicNumerals(currentPair.ayah)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar for Repetitions */}
      <div className="space-y-1.5 mb-6 relative z-10">
        <div className="flex items-center justify-between text-xs text-[#86efac] font-bold">
          <span>تقدم التكرار الإجمالي:</span>
          <span className="font-black text-amber-300 font-mono">
            {toArabicNumerals(completedRepetitions)} من {toArabicNumerals(requiredRepetitions)} مرات ({toArabicNumerals(progressPercent)}٪)
          </span>
        </div>
        <div className="w-full h-3.5 rounded-full bg-[#011a14] border-2 border-emerald-800/80 border-b-2 overflow-hidden p-0.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Controls Bar (Platform Theme: Golden & Emerald) */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t-2 border-emerald-600/30 relative z-10">
        {/* Play/Pause Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleTogglePlay}
            className={`px-7 py-3.5 rounded-2xl font-black text-sm flex items-center gap-2.5 transition-all cursor-pointer shadow-xl border-2 border-amber-300 border-b-6 border-b-amber-600 active:translate-y-[2px] active:border-b-2 ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-emerald-950'
                : 'bg-amber-400 hover:bg-amber-300 text-emerald-950'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-5 h-5 fill-current" />
                <span>إيقاف مؤقت للاستماع</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 fill-current" />
                <span>
                  {completedRepetitions > 0 && !isCompletedAll
                    ? `مواصلة التكرار (${toArabicNumerals(completedRepetitions + 1)} من ${toArabicNumerals(requiredRepetitions)})`
                    : 'بدء الاستماع والتكرار'}
                </span>
              </>
            )}
          </button>

          {/* Reset button if desired */}
          {completedRepetitions > 0 && (
            <button
              type="button"
              onClick={handleResetRepetitions}
              className="p-3.5 rounded-2xl bg-[#022c22] hover:bg-[#064e3b] text-emerald-300 border-2 border-emerald-700/60 border-b-4 border-b-[#011a14] active:translate-y-[2px] active:border-b-2 text-xs font-bold transition-all cursor-pointer shadow-sm"
              title="إعادة بدء التكرارات من البداية"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Volume & Audio Settings */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMuted(prev => !prev)}
            className="p-3.5 rounded-2xl bg-[#022c22] border-2 border-emerald-700/60 border-b-4 border-b-[#011a14] active:translate-y-[2px] active:border-b-2 text-emerald-300 hover:text-white transition-all cursor-pointer shadow-sm"
            title={isMuted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <div className="text-right">
            <span className="text-[11px] text-[#86efac] font-bold block">نظام الحساب الآلي</span>
            <span className="text-[10px] text-amber-300 font-black">
              يُسجل التكرار تلقائياً عند سماع المقطع كاملاً
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
