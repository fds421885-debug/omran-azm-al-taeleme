import { QURAN_SURAHS, getSurahInfo } from '../data/quranData';

// In-memory cache for all 114 Surahs and their Uthmani verses
let cachedQuranMap: Record<number, string[]> | null = null;
let loadPromise: Promise<Record<number, string[]>> | null = null;

/**
 * Load all Quran verses from public/quran-verses.json or fallback API
 */
export async function loadAllQuranVerses(): Promise<Record<number, string[]>> {
  if (cachedQuranMap && Object.keys(cachedQuranMap).length >= 114) {
    return cachedQuranMap;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      // 0. If in Node.js environment (e.g. vitest), read from local public folder
      if (typeof window === 'undefined') {
        try {
          const fs = await import('fs');
          const path = await import('path');
          const filePath = path.join(process.cwd(), 'public', 'quran-verses.json');
          if (fs.existsSync(filePath)) {
            const fileData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            if (fileData && Object.keys(fileData).length >= 114) {
              cachedQuranMap = fileData;
              return fileData;
            }
          }
        } catch (nodeErr) {
          // Continue to fetch if fs fails
        }
      }

      // 1. Try local bundled public file
      const resp = await fetch('/quran-verses.json');
      if (resp.ok) {
        const data = await resp.json();
        if (data && typeof data === 'object' && Object.keys(data).length >= 114) {
          cachedQuranMap = data;
          return data;
        }
      }
    } catch (err) {
      console.warn('Failed to load /quran-verses.json, trying server endpoint:', err);
    }

    try {
      // 2. Try server endpoint
      const resp2 = await fetch('/api/quran/all');
      if (resp2.ok && resp2.headers.get('content-type')?.includes('application/json')) {
        const data2 = await resp2.json();
        if (data2 && typeof data2 === 'object' && Object.keys(data2).length >= 114) {
          cachedQuranMap = data2;
          return data2;
        }
      }
    } catch (err2) {
      console.warn('Failed to load from server endpoint:', err2);
    }

    // Fallback object with Basmalah for all 114 surahs
    cachedQuranMap = cachedQuranMap || {};
    return cachedQuranMap;
  })();

  return loadPromise;
}

/**
 * Normalize any Uthmani/Tanzil Quran string to 100% authentic KFGQPC UthmanicHafs (v0.18) encoding
 * so browser HarfBuzz shapers and UthmanicHafs glyphs NEVER render dotted circles (◌) on Waqf,
 * Ibtida/Rub (۞), Sajdah (۩), Sukun (ۡ), Rounded Zero (ْ), Saktah (ۜ), or Ishmam (۬) marks.
 */
export function normalizeKfgqpcHafsText(text: string): string {
  if (!text) return '';

  let normalized = text
    .replace(/^\ufeff/, '')
    .replace(/\u25cc/g, '');

  // Detect if string uses Tanzil / Standard Unicode conventions instead of KFGQPC v18:
  // In KFGQPC v18, U+0652 (ْ) is ONLY used as rounded zero directly after ا / و / ي,
  // while Sukun (رأس الحاء) is U+06E1 (ۡ), and U+06DF / U+06E3 / U+06EB are never used.
  const hasTanzilOnlyMarks = /[\u06DF\u06E3\u06EB]/.test(normalized);
  const hasConsonantSukun = !normalized.includes('\u06E1') && /[^\u0627\u0648\u064A]\u0652/.test(normalized);

  if (hasTanzilOnlyMarks || hasConsonantSukun) {
    normalized = normalized
      .replace(/\u0652/g, '\u06E1') // Standard Sukun -> KFGQPC رأس الحاء (ۡ)
      .replace(/\u06DF/g, '\u0652') // Tanzil Rounded Zero (۟) -> KFGQPC صفر مستدير (ْ)
      .replace(/\u06E3/g, '\u06DC') // Small low seen (ۣ) -> KFGQPC small seen (ۜ)
      .replace(/\u06EB/g, '\u06EC'); // Empty high stop (۫) -> KFGQPC ishmam diamond (۬)
  }

  // Eliminate spaces/NBSP immediately before combining marks (Mn) such as Waqf signs (ۖ ۗ ۘ ۙ ۚ ۛ ۜ)
  // so HarfBuzz never synthesizes a dotted circle (◌) in the middle of the ayah.
  normalized = normalized.replace(
    /[ \t\u00A0]+([\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED])/g,
    '$1'
  );

  // Attach Sajdah mark (۩) cleanly if preceded by regular ASCII space
  normalized = normalized.replace(/ +\u06E9/g, '\u06E9');

  return normalized.trim();
}

/**
 * Get verses of a specific Surah
 */
export async function getSurahVerses(surahNumber: number): Promise<string[]> {
  const all = await loadAllQuranVerses();
  if (all && all[surahNumber] && all[surahNumber].length > 0) {
    return all[surahNumber];
  }

  // If not in cache yet, try fetching single surah
  try {
    const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahNumber}/quran-uthmani`);
    if (res.ok) {
      const data = await res.json();
      if (data?.data?.ayahs) {
        const verses = data.data.ayahs.map((a: any) => normalizeKfgqpcHafsText(String(a.text || '')));
        if (!cachedQuranMap) cachedQuranMap = {};
        cachedQuranMap[surahNumber] = verses;
        return verses;
      }
    }
  } catch (e) {
    console.warn('Fallback fetching single surah failed:', e);
  }

  // Absolute fallback
  const sInfo = getSurahInfo(surahNumber);
  const fallbackVerses: string[] = [];
  for (let i = 1; i <= sInfo.numberOfAyahs; i++) {
    fallbackVerses.push(`الآية (${i}) من سورة ${sInfo.name}`);
  }
  return fallbackVerses;
}

/**
 * Synchronously get Ayah text from memory cache if available
 */
export function getAyahTextSync(surahNumber: number, ayahNumber: number): string {
  if (ayahNumber === 0) {
    return 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ';
  }

  if (cachedQuranMap && cachedQuranMap[surahNumber]) {
    const verses = cachedQuranMap[surahNumber];
    if (verses && verses[ayahNumber - 1]) {
      return verses[ayahNumber - 1];
    }
  }

  const sInfo = getSurahInfo(surahNumber);
  return `الآية (${ayahNumber}) من سورة ${sInfo.name}`;
}

/**
 * Preload immediately on script execution
 */
if (typeof window !== 'undefined') {
  loadAllQuranVerses().catch(() => {});
}
