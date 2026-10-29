import { ComplexThemeConfig } from '../types';

export function extractHexColor(input?: string | null): string | null {
  if (!input) return null;
  const str = String(input).trim();
  const match = str.match(/#([0-9a-fA-F]{3,8})\b/);
  return match ? `#${match[1]}` : null;
}

export function hexToRgb(hex?: string | null): string {
  const cleanHex = extractHexColor(hex) || '#ffc800';
  let c = cleanHex.replace('#', '').trim();
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  const num = parseInt(c.slice(0, 6), 16);
  if (isNaN(num)) return '255, 200, 0';
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `${r}, ${g}, ${b}`;
}

export function lightenHex(hex?: string | null, percent = 0.2): string {
  const cleanHex = extractHexColor(hex) || '#203843';
  let c = cleanHex.replace('#', '').trim();
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  const num = parseInt(c.slice(0, 6), 16);
  if (isNaN(num)) return '#2b4550';
  const r = Math.min(255, Math.floor(((num >> 16) & 255) + (255 - ((num >> 16) & 255)) * percent));
  const g = Math.min(255, Math.floor(((num >> 8) & 255) + (255 - ((num >> 8) & 255)) * percent));
  const b = Math.min(255, Math.floor((num & 255) + (255 - (num & 255)) * percent));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function darkenHex(hex?: string | null, percent = 0.2): string {
  const cleanHex = extractHexColor(hex) || '#ffc800';
  let c = cleanHex.replace('#', '').trim();
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  const num = parseInt(c.slice(0, 6), 16);
  if (isNaN(num)) return '#e5a500';
  const r = Math.max(0, Math.floor(((num >> 16) & 255) * (1 - percent)));
  const g = Math.max(0, Math.floor(((num >> 8) & 255) * (1 - percent)));
  const b = Math.max(0, Math.floor((num & 255) * (1 - percent)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function getContrastTextColor(hex?: string | null): string {
  const cleanHex = extractHexColor(hex) || '#ffc800';
  let c = cleanHex.replace('#', '').trim();
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c.slice(0, 6), 16);
  if (isNaN(num)) return '#131f24';
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 148 ? '#131f24' : '#ffffff';
}

export interface IslamicThemePreset {
  id: string;
  name: string;
  subtitle: string;
  colors: ComplexThemeConfig;
}

export const GOOGLE_THEME_CONFIG: ComplexThemeConfig = {
  primaryColor: '#101a24',
  secondaryColor: '#1a2936',
  accentColor: '#4285F4',
  backgroundColor: '#0c141c',
  surfaceColor: 'rgba(26, 41, 54, 0.85)',
  cardColor: '#1f3342',
  textColor: '#ffffff'
};

/**
 * 11 Master Islamic & Duolingo Palettes with mathematically verified contrast separation:
 * - Canvas Background is dark & immersive
 * - Card/Secondary has visible elevation (+18% to +25%) so cards & headers NEVER blend into the background
 * - Accent is vibrant jewel/gold with glowing contrast
 * - Buttons are guaranteed high-contrast (never match background)
 */
export const ISLAMIC_THEME_PRESETS: IslamicThemePreset[] = [
  {
    id: 'google_colors',
    name: 'ثيم وألوان جوجل (Google Colors)',
    subtitle: 'ألوان جوجل الرسمية الأربعة (الأزرق #4285F4، الأخضر #34A853، الأصفر #FBBC05، والأحمر #EA4335) وثيم دولينجو',
    colors: GOOGLE_THEME_CONFIG
  },
  {
    id: 'duo_green',
    name: 'ثيم دولينجو الأخضر القياسي',
    subtitle: 'الأخضر النضر الأيقوني لدولينجو مع بطاقات مجسمة وثلاثية الأبعاد',
    colors: {
      primaryColor: '#131f24',
      secondaryColor: '#1b2e35',
      accentColor: '#58cc02',
      backgroundColor: '#131f24',
      surfaceColor: 'rgba(27, 46, 53, 0.85)',
      cardColor: '#203843',
      textColor: '#ffffff'
    }
  },
  {
    id: 'duo_blue',
    name: 'ثيم دولينجو الأزرق السماوي',
    subtitle: 'أزرق فيذر المنعش مع تباين قوي وبطاقات واضحة وسلسة',
    colors: {
      primaryColor: '#0f1c24',
      secondaryColor: '#172c38',
      accentColor: '#1cb0f6',
      backgroundColor: '#0f1c24',
      surfaceColor: 'rgba(23, 44, 56, 0.85)',
      cardColor: '#1a3746',
      textColor: '#f0f9ff'
    }
  },
  {
    id: 'duo_gold',
    name: 'ثيم دولينجو الحماسي الذهبي',
    subtitle: 'أصفر الإنجاز والتنافس المشرق مع بطاقات دافئة وعصرية',
    colors: {
      primaryColor: '#1d170a',
      secondaryColor: '#302613',
      accentColor: '#ffc800',
      backgroundColor: '#171206',
      surfaceColor: 'rgba(48, 38, 19, 0.85)',
      cardColor: '#3d3016',
      textColor: '#fffbeb'
    }
  },
  {
    id: 'duo_purple',
    name: 'ثيم دولينجو الماسي البنفسجي',
    subtitle: 'بنفسجي سوبر دولينجو الفاخر مع لمسات براقة',
    colors: {
      primaryColor: '#180f24',
      secondaryColor: '#2b1a3f',
      accentColor: '#ce82ff',
      backgroundColor: '#140c1e',
      surfaceColor: 'rgba(43, 26, 63, 0.85)',
      cardColor: '#372051',
      textColor: '#faf5ff'
    }
  },
  {
    id: 'duo_orange',
    name: 'ثيم دولينجو الناري',
    subtitle: 'برتقالي ستريك الحماسي للتحدي والمنافسة اليومية',
    colors: {
      primaryColor: '#1f1308',
      secondaryColor: '#382210',
      accentColor: '#ff9600',
      backgroundColor: '#190e05',
      surfaceColor: 'rgba(56, 34, 16, 0.85)',
      cardColor: '#472a12',
      textColor: '#fff7ed'
    }
  },
  {
    id: 'emerald',
    name: 'الزمردي النبوي الأصيل',
    subtitle: 'أخضر زمردي داكن مع بطاقات واضحة ولمسات خضراء نضرة',
    colors: {
      primaryColor: '#0c1f19',
      secondaryColor: '#143329',
      accentColor: '#58cc02',
      backgroundColor: '#091813',
      surfaceColor: 'rgba(20, 51, 41, 0.75)',
      cardColor: '#194034',
      textColor: '#f0fdf4'
    }
  },
  {
    id: 'navy',
    name: 'الكحلي القرآني الملكي',
    subtitle: 'أزرق كحلي عميق مع بطاقات كحلية بارزة وأزرق سماوي فاخر',
    colors: {
      primaryColor: '#030f1c',
      secondaryColor: '#0c2340',
      accentColor: '#1cb0f6',
      backgroundColor: '#041122',
      surfaceColor: 'rgba(12, 35, 64, 0.7)',
      cardColor: '#0e2a4d',
      textColor: '#f0f9ff'
    }
  },
  {
    id: 'andalusi_gold',
    name: 'الذهبي الأندلسي الفاخر',
    subtitle: 'بني شوكولاتي أندلسي مع بطاقات واضحة وذهب قرطبي مشرق',
    colors: {
      primaryColor: '#150d06',
      secondaryColor: '#36210f',
      accentColor: '#ffc800',
      backgroundColor: '#1c120a',
      surfaceColor: 'rgba(54, 33, 15, 0.7)',
      cardColor: '#3a2512',
      textColor: '#fef3c7'
    }
  },
  {
    id: 'turquoise',
    name: 'الفيروزي الأصفهاني التراثي',
    subtitle: 'تركواز بحري إسلامي عميق مع لمسات زمردية وذهبية نضرة',
    colors: {
      primaryColor: '#031a1b',
      secondaryColor: '#093c3e',
      accentColor: '#2dd4bf',
      backgroundColor: '#042022',
      surfaceColor: 'rgba(9, 60, 62, 0.7)',
      cardColor: '#0c484b',
      textColor: '#f0fdfa'
    }
  },
  {
    id: 'charcoal',
    name: 'الفحمي العصري الداكن',
    subtitle: 'فحمي داكن مع ألوان حيوية مجسمة وتباين نقي',
    colors: {
      primaryColor: '#131f24',
      secondaryColor: '#1b2e35',
      accentColor: '#58cc02',
      backgroundColor: '#10191d',
      surfaceColor: 'rgba(27, 46, 53, 0.85)',
      cardColor: '#203843',
      textColor: '#fafafa'
    }
  }
];

/**
 * Intelligent Color Harmonizer:
 * Takes any base hue and optional accent, and mathematically constructs
 * a complete, harmonious theme where buttons NEVER match the background,
 * and cards have clear step-up contrast.
 */
export function generateHarmoniousIslamicPalette(
  baseColor: string,
  accentColor: string = '#58cc02'
): ComplexThemeConfig {
  const bg = darkenHex(baseColor, 0.25);
  const primary = darkenHex(baseColor, 0.1);
  const secondary = lightenHex(baseColor, 0.18);
  const card = lightenHex(baseColor, 0.22);
  const surface = `rgba(${hexToRgb(card)}, 0.85)`;

  return {
    primaryColor: primary,
    secondaryColor: secondary,
    accentColor: accentColor,
    backgroundColor: bg,
    surfaceColor: surface,
    cardColor: card,
    textColor: '#ffffff'
  };
}

/**
 * Checks if a complex theme config differs from the default natural platform Duolingo theme
 */
export function isCustomTheme(theme?: ComplexThemeConfig | null): boolean {
  if (!theme) return false;
  const p = (theme.primaryColor || '').trim().toLowerCase();
  const s = (theme.secondaryColor || '').trim().toLowerCase();
  const a = (theme.accentColor || '').trim().toLowerCase();
  const bg = (theme.backgroundColor || '').trim().toLowerCase();
  if (p === '#131f24' && s === '#1b2e35' && a === '#58cc02' && (bg === '#131f24' || bg === '#10191d')) {
    return false;
  }
  return true;
}

/**
 * Applies complex theme variables to document DOM if inside a complex,
 * or strictly resets to the natural platform Duolingo colors if outside.
 */
export function applyComplexThemeToDOM(
  theme?: ComplexThemeConfig | null,
  isInsideComplex: boolean = false
): void {
  if (typeof document === 'undefined') return;

  if (isInsideComplex && theme) {
    const primary = theme.primaryColor || '#131f24';
    const secondary = theme.secondaryColor || '#1b2e35';
    const accent = theme.accentColor || '#58cc02';
    const bg = theme.backgroundColor || '#131f24';
    
    // Ensure card has guaranteed step-up contrast over bg (never match!)
    let card = theme.cardColor || theme.surfaceColor || secondary;
    if (card.toLowerCase() === bg.toLowerCase()) {
      card = lightenHex(bg, 0.2);
    }
    
    const border = lightenHex(card, 0.2);
    const subtext = lightenHex(accent, 0.45);
    const text = theme.textColor || '#ffffff';

    const pRgb = hexToRgb(primary);
    const sRgb = hexToRgb(secondary);
    const aRgb = hexToRgb(accent);
    const bgRgb = hexToRgb(bg);
    const cardRgb = hexToRgb(card);
    const bRgb = hexToRgb(border);

    document.body.style.backgroundColor = bg;
    document.body.style.color = text;

    const accentShadow = darkenHex(accent, 0.28);
    const cardShadow = darkenHex(card, 0.35);

    document.documentElement.setAttribute('data-complex-themed', 'true');
    document.documentElement.style.setProperty('--complex-primary', primary);
    document.documentElement.style.setProperty('--complex-primary-rgb', pRgb);
    document.documentElement.style.setProperty('--complex-secondary', secondary);
    document.documentElement.style.setProperty('--complex-secondary-rgb', sRgb);
    document.documentElement.style.setProperty('--complex-accent', accent);
    document.documentElement.style.setProperty('--complex-accent-rgb', aRgb);
    document.documentElement.style.setProperty('--complex-accent-shadow', accentShadow);
    document.documentElement.style.setProperty('--complex-bg', bg);
    document.documentElement.style.setProperty('--complex-bg-rgb', bgRgb);
    document.documentElement.style.setProperty('--complex-card', card);
    document.documentElement.style.setProperty('--complex-card-rgb', cardRgb);
    document.documentElement.style.setProperty('--complex-card-shadow', cardShadow);
    document.documentElement.style.setProperty('--complex-border', border);
    document.documentElement.style.setProperty('--complex-border-rgb', bRgb);
    document.documentElement.style.setProperty('--complex-text', text);
    document.documentElement.style.setProperty('--complex-subtext', subtext);
    document.documentElement.style.setProperty('--complex-subtext-rgb', hexToRgb(subtext));
    document.documentElement.style.setProperty('--complex-accent-text', getContrastTextColor(accent));
    document.documentElement.style.setProperty('--complex-secondary-shadow', darkenHex(secondary, 0.35));
  } else {
    // Natural platform theme (Duolingo #131f24 & #ffc800) - outside complex
    document.body.style.backgroundColor = '#131f24';
    document.body.style.color = '#ffffff';

    document.documentElement.removeAttribute('data-complex-themed');
    document.documentElement.style.setProperty('--complex-primary', '#131f24');
    document.documentElement.style.setProperty('--complex-primary-rgb', '19, 31, 36');
    document.documentElement.style.setProperty('--complex-secondary', '#1b2e35');
    document.documentElement.style.setProperty('--complex-secondary-rgb', '27, 46, 53');
    document.documentElement.style.setProperty('--complex-accent', '#ffc800');
    document.documentElement.style.setProperty('--complex-accent-rgb', '255, 200, 0');
    document.documentElement.style.setProperty('--complex-accent-shadow', '#e5a500');
    document.documentElement.style.setProperty('--complex-bg', '#131f24');
    document.documentElement.style.setProperty('--complex-bg-rgb', '19, 31, 36');
    document.documentElement.style.setProperty('--complex-card', '#203843');
    document.documentElement.style.setProperty('--complex-card-rgb', '32, 56, 67');
    document.documentElement.style.setProperty('--complex-card-shadow', '#16262e');
    document.documentElement.style.setProperty('--complex-border', '#2b4550');
    document.documentElement.style.setProperty('--complex-border-rgb', '43, 69, 80');
    document.documentElement.style.setProperty('--complex-text', '#ffffff');
    document.documentElement.style.setProperty('--complex-subtext', '#ffd233');
    document.documentElement.style.setProperty('--complex-subtext-rgb', '255, 210, 51');
    document.documentElement.style.setProperty('--complex-accent-text', '#131f24');
    document.documentElement.style.setProperty('--complex-secondary-shadow', '#122026');
  }
}


/**
 * Extracts vibrant and harmonious Islamic colors from an uploaded image data URL.
 */
export async function extractColorsFromImageDataUrl(dataUrl: string): Promise<{
  theme: ComplexThemeConfig;
  palette: string[];
}> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      return reject(new Error('Browser environment required for image processing'));
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve({
            theme: generateHarmoniousIslamicPalette('#022c22', '#fbbf24'),
            palette: ['#022c22', '#064e3b', '#fbbf24', '#021e17', '#f0f9f6']
          });
        }

        // Downscale for fast, robust color quantization
        const width = 80;
        const height = 80;
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height).data;
        const colorCounts: Record<string, { r: number; g: number; b: number; count: number; sat: number; light: number }> = {};

        for (let i = 0; i < imgData.length; i += 16) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const a = imgData[i + 3];

          if (a < 128) continue; // ignore transparent pixels

          // Quantize to reduce noise (step of 16)
          const qr = Math.round(r / 16) * 16;
          const qg = Math.round(g / 16) * 16;
          const qb = Math.round(b / 16) * 16;
          const key = `${qr},${qg},${qb}`;

          // Calculate HSL saturation & lightness
          const max = Math.max(r, g, b) / 255;
          const min = Math.min(r, g, b) / 255;
          const light = (max + min) / 2;
          const sat = max === min ? 0 : (max - min) / (light > 0.5 ? 2 - max - min : max + min);

          if (!colorCounts[key]) {
            colorCounts[key] = { r: qr, g: qg, b: qb, count: 0, sat, light };
          }
          colorCounts[key].count++;
        }

        const sortedColors = Object.values(colorCounts).sort((a, b) => b.count - a.count);

        const toHex = (r: number, g: number, b: number) =>
          `#${[r, g, b].map(x => Math.min(255, Math.max(0, x)).toString(16).padStart(2, '0')).join('')}`;

        // Find vibrant candidate for Accent (high saturation, pleasant lightness)
        const vibrantCandidates = sortedColors
          .filter(c => c.sat > 0.25 && c.light > 0.35 && c.light < 0.85)
          .sort((a, b) => (b.sat * 2 + b.count / 100) - (a.sat * 2 + a.count / 100));

        // Find dark/deep candidate for Background / Primary
        const darkCandidates = sortedColors
          .filter(c => c.light < 0.35)
          .sort((a, b) => b.count - a.count);

        // Find mid-tone candidate for Cards / Secondary
        const midCandidates = sortedColors
          .filter(c => c.light >= 0.25 && c.light <= 0.65)
          .sort((a, b) => b.count - a.count);

        const primaryRaw = darkCandidates[0] || sortedColors[0] || { r: 2, g: 44, b: 34 };
        const accentRaw = vibrantCandidates[0] || { r: 251, g: 191, b: 36 };
        const secondaryRaw = midCandidates[0] || { r: 6, g: 78, b: 59 };

        const baseHex = toHex(primaryRaw.r, primaryRaw.g, primaryRaw.b);
        const accentHex = toHex(accentRaw.r, accentRaw.g, accentRaw.b);
        const secHex = toHex(secondaryRaw.r, secondaryRaw.g, secondaryRaw.b);

        // Construct complete theme
        const bg = darkenHex(baseHex, 0.3);
        const primary = baseHex;
        let card = lightenHex(secHex, 0.1);
        if (card.toLowerCase() === bg.toLowerCase()) {
          card = lightenHex(bg, 0.25);
        }

        const theme: ComplexThemeConfig = {
          primaryColor: primary,
          secondaryColor: secHex,
          accentColor: accentHex,
          backgroundColor: bg,
          surfaceColor: `rgba(${hexToRgb(card)}, 0.7)`,
          cardColor: card,
          textColor: '#f8fafc'
        };

        const rawPalette = sortedColors.slice(0, 8).map(c => toHex(c.r, c.g, c.b));
        // Add distinct theme colors to palette
        const fullPalette = Array.from(new Set([
          theme.backgroundColor,
          theme.primaryColor,
          theme.cardColor,
          theme.secondaryColor,
          theme.accentColor,
          theme.textColor,
          ...rawPalette
        ])).filter(Boolean);

        resolve({ theme, palette: fullPalette });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image for color extraction'));
    img.src = dataUrl;
  });
}

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toArabicNumerals(num: number): string {
  return String(Math.max(1, Math.floor(num)))
    .split('')
    .map(ch => (ch >= '0' && ch <= '9' ? ARABIC_DIGITS[Number(ch)] : ch))
    .join('');
}

export function getDefaultReviewLinkTitle(indexOneBased: number): string {
  return `رابط المراجعة ${toArabicNumerals(indexOneBased)}`;
}

export function extractMeetingUrlAndCode(rawText?: string | null): { url: string; code: string } | null {
  if (!rawText) return null;
  const clean = rawText.trim();
  if (!clean) return null;

  // Match meet.google.com/xxx-yyyy-zzz
  const meetMatch = clean.match(/(?:https?:\/\/)?meet\.google\.com\/([a-z0-9-]+)/i);
  if (meetMatch && meetMatch[1]) {
    const code = meetMatch[1].split('?')[0].trim();
    return { url: `https://meet.google.com/${code}`, code };
  }

  // Match xxx-yyyy-zzz raw Meet code
  const codeMatch = clean.match(/^([a-z]{3}-[a-z]{4}-[a-z]{3})$/i);
  if (codeMatch && codeMatch[1]) {
    const code = codeMatch[1].trim();
    return { url: `https://meet.google.com/${code}`, code };
  }

  // Generic URL (Zoom / Teams / custom domain with or without https://)
  if (/^https?:\/\//i.test(clean)) {
    return { url: clean, code: clean.split('/').pop()?.split('?')[0] || '' };
  }
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(clean)) {
    const normalized = `https://${clean}`;
    return { url: normalized, code: clean.split('/').pop()?.split('?')[0] || '' };
  }

  return null;
}

export function normalizeMeetingUrl(rawUrl?: string | null): string {
  if (!rawUrl) return '';
  const extracted = extractMeetingUrlAndCode(rawUrl);
  if (extracted) return extracted.url;
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const clean = extractHexColor(hex) || '#1cb0f6';
  let c = clean.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c.slice(0, 6), 16);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        break;
      case g:
        h = ((b - r) / d + 2) * 60;
        break;
      case b:
        h = ((r - g) / d + 4) * 60;
        break;
    }
  }
  return { h, s, l };
}

function hslToHex(h: number, s: number, l: number): string {
  const normH = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((normH / 60) % 2) - 1));
  const m = l - c / 2;
  let r1 = 0, g1 = 0, b1 = 0;

  if (normH < 60) [r1, g1, b1] = [c, x, 0];
  else if (normH < 120) [r1, g1, b1] = [x, c, 0];
  else if (normH < 180) [r1, g1, b1] = [0, c, x];
  else if (normH < 240) [r1, g1, b1] = [0, x, c];
  else if (normH < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];

  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
}

/**
 * Generates a Duolingo 3D tactile color palette derived from the Complex's identity,
 * ensuring the Main Halaqah button uses the Complex's primary accent while Review Link
 * buttons use a harmoniously related YET unmistakably distinct Complex-derived color.
 */
export function getDistinctComplexReviewPalette(
  theme?: ComplexThemeConfig | null,
  fallbackThemeColor?: string | null
) {
  const cardBg = theme?.cardColor || theme?.secondaryColor || '#1b2e35';
  const mainBtnBg = theme?.accentColor || fallbackThemeColor || '#ffc800';
  const mainBtnBorder = lightenHex(mainBtnBg, 0.12);
  const mainBtnShadow = darkenHex(mainBtnBg, 0.28);
  const mainBtnText = getContrastTextColor(mainBtnBg);

  const surfaceCandidate = theme?.secondaryColor || theme?.cardColor || theme?.primaryColor || '#1b2e35';
  const mainHsl = hexToHsl(mainBtnBg);
  const surfHsl = hexToHsl(surfaceCandidate);

  // Derive review button hue from the Complex's own secondary/surface hue if chromatic,
  // shifting hue when needed so it is always visually distinct from mainBtnBg.
  let reviewHue = surfHsl.s >= 0.14 ? surfHsl.h : (mainHsl.h + 150) % 360;
  const hueDistance = Math.min(
    Math.abs(reviewHue - mainHsl.h),
    360 - Math.abs(reviewHue - mainHsl.h)
  );
  if (hueDistance < 42) {
    reviewHue = (mainHsl.h + 58) % 360;
  }

  const reviewBtnBg = hslToHex(reviewHue, Math.max(0.68, Math.min(0.86, surfHsl.s + 0.35)), 0.45);
  const reviewBtnBorder = lightenHex(reviewBtnBg, 0.14);
  const reviewBtnShadow = darkenHex(reviewBtnBg, 0.32);
  const reviewBtnText = getContrastTextColor(reviewBtnBg);

  const reviewBoxBg = darkenHex(cardBg, 0.18);
  const reviewBoxBorder = `${reviewBtnBg}66`;
  const reviewBoxBottomBorder = darkenHex(reviewBtnBg, 0.42);

  return {
    cardBg,
    cardBorder: lightenHex(cardBg, 0.2),
    cardShadow: darkenHex(cardBg, 0.36),
    mainBtnBg,
    mainBtnBorder,
    mainBtnShadow,
    mainBtnText,
    reviewBtnBg,
    reviewBtnBorder,
    reviewBtnShadow,
    reviewBtnText,
    reviewBoxBg,
    reviewBoxBorder,
    reviewBoxBottomBorder
  };
}


