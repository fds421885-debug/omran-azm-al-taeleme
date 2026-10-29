import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db, OmranDataService, DEFAULT_HALAQAHS } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  Exam,
  ExamQuestion,
  ExamSubmission,
  ExamSubmissionAnswer,
  GoogleOAuthConfig,
  FullBackupData,
  Student,
  TeacherAccount,
  AttendanceRecord,
  StudentEvaluation,
  Halaqah,
  LibraryDocument,
  LibraryDocumentType,
  LibraryDriveSection,
  DriveSectionFolderMeta
} from '../types';
import { ApiConfig } from './apiConfig';

export const GOOGLE_SCOPES = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/meetings.space.created',
  'https://www.googleapis.com/auth/meetings.space.readonly',
  'https://www.googleapis.com/auth/meetings.space.settings',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
];

export const GOOGLE_MEET_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/meetings.space.created',
  'https://www.googleapis.com/auth/meetings.space.readonly',
  'https://www.googleapis.com/auth/meetings.space.settings',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
];

/**
 * Creates an authentic, active Google Meet room registered on Google infrastructure.
 * Uses Google Meet REST API v2 as primary and Google Calendar Events Conference API as guaranteed fallback.
 * Guaranteed to never return fake random strings.
 */
export async function createRealGoogleMeetMeeting(
  accessToken: string,
  halaqahName: string = 'حلقة قرآنية'
): Promise<{ meetingUri: string; meetingCode: string; spaceName?: string } | null> {
  if (!accessToken) return null;

  // Strategy 1: Google Meet Spaces REST API v2
  try {
    const res = await fetch('https://meet.googleapis.com/v2/spaces', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        config: {
          accessType: 'OPEN'
        }
      })
    });
    if (res.ok) {
      const data = await res.json();
      const uri = data.meetingUri || data.uri;
      if (uri && typeof uri === 'string') {
        const code = data.meetingCode || uri.split('/').pop() || '';
        return {
          meetingUri: uri,
          meetingCode: code,
          spaceName: data.name || ''
        };
      }
    } else {
      const errText = await res.text();
      console.warn('Google Meet API v2 returned non-ok status, trying Calendar API fallback:', res.status, errText);
    }
  } catch (err) {
    console.warn('Google Meet API v2 fetch error, falling back to Calendar Conference API:', err);
  }

  // Strategy 2: Google Calendar Events API with Conference Data (hangoutsMeet)
  // Universally supported for both personal Google accounts and Workspace accounts.
  // Produces an authentic, registered meet.google.com room link.
  try {
    const now = new Date();
    const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    const requestId = `omran-meet-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const eventPayload = {
      summary: `حلقة قرآنية: ${halaqahName}`,
      description: `غرفة اجتماع Google Meet معتمدة لحلقة (${halaqahName}) عبر منصة عمران لتعليم القرآن الكريم. الرابط مفتوح للجميع ومتاح للانضمام.`,
      start: {
        dateTime: now.toISOString(),
        timeZone: 'Asia/Riyadh'
      },
      end: {
        dateTime: oneYearLater.toISOString(),
        timeZone: 'Asia/Riyadh'
      },
      conferenceData: {
        createRequest: {
          requestId: requestId,
          conferenceSolutionKey: {
            type: 'hangoutsMeet'
          }
        }
      }
    };

    const calRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventPayload)
    });

    if (calRes.ok) {
      const calData = await calRes.json();
      const hangoutLink = calData.hangoutLink || calData.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri;
      if (hangoutLink && typeof hangoutLink === 'string') {
        const code = hangoutLink.split('/').pop() || '';
        return {
          meetingUri: hangoutLink,
          meetingCode: code,
          spaceName: calData.id || ''
        };
      }
    } else {
      const errText = await calRes.text();
      console.warn('Calendar Conference API returned error, applying guaranteed Google Meet fallback:', calRes.status, errText);
    }
  } catch (err) {
    console.warn('Google Calendar API fetch error:', err);
  }

  // If Google REST APIs are restricted on the project, return null so UI uses the direct Google Meet creator (meet.google.com/new)
  return null;
}

export async function createGoogleMeetSpace(accessToken: string, halaqahName?: string): Promise<{ meetingUri: string; meetingCode: string; spaceName: string } | null> {
  const result = await createRealGoogleMeetMeeting(accessToken, halaqahName);
  if (result) {
    return {
      meetingUri: result.meetingUri,
      meetingCode: result.meetingCode,
      spaceName: result.spaceName || ''
    };
  }
  return null;
}

export async function getGoogleMeetAccessToken(): Promise<{ email: string; displayName?: string; photoURL?: string | null; accessToken: string }> {
  const clientId = (firebaseConfig as any).oAuthClientId || '576155598063-9sigjmhkijl03raan3lj117q6sjbcnb6.apps.googleusercontent.com';
  await loadGoogleGISScript();
  try {
    const res = await requestAccessTokenViaGIS(clientId, GOOGLE_MEET_SCOPES);
    return res;
  } catch (err: any) {
    console.warn('GIS request with GOOGLE_MEET_SCOPES failed, falling back to standard profile scopes:', err);
    const fallback = await requestAccessTokenViaGIS(clientId, [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ]);
    return fallback;
  }
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string; error_description?: string }) => void;
            error_callback?: (error: any) => void;
          }) => {
            requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
          };
        };
      };
    };
  }
}

export class UnauthorizedDomainError extends Error {
  isUnauthorizedDomain = true;
  domain: string;
  projectId: string;
  firebaseConsoleUrl: string;

  constructor(domain: string, projectId: string) {
    const consoleUrl = `https://console.firebase.google.com/project/${projectId}/authentication/settings`;
    super(
      `نطاق المنصة الحالي (${domain}) يحتاج إلى إضافة في قائمة النطاقات المصرح بها (Authorized Domains)، أو يمكنك استخدام رابط Google Form مباشرة دون الحاجة للربط.`
    );
    this.name = 'UnauthorizedDomainError';
    this.domain = domain;
    this.projectId = projectId;
    this.firebaseConsoleUrl = consoleUrl;
  }
}

export class PopupClosedByUserError extends Error {
  isPopupClosed = true;
  constructor() {
    super(
      'تم إغلاق نافذة تسجيل الدخول من Google قبل استكمال التفويض. يرجى إعادة المحاولة مع إبقاء النافذة مفتوحة لاختيار حسابك والموافقة على الأذونات.'
    );
    this.name = 'PopupClosedByUserError';
  }
}

export class PopupBlockedError extends Error {
  isPopupBlocked = true;
  constructor() {
    super(
      'قام المتصفح بحظر نافذة تسجيل الدخول المنبثقة. يرجى السماح بالنوافذ المنبثقة (Popups) لهذا الموقع من إعدادات المتصفح، أو فتح المنصة في تبويب جديد.'
    );
    this.name = 'PopupBlockedError';
  }
}

export class UnregisteredGoogleAccountError extends Error {
  isUnregistered = true;
  email: string;
  constructor(email: string) {
    super(
      `أنت غير مسجل في المنظومة. الرجاء التسجيل أولاً أو التواصل مع المشرف العام.`
    );
    this.name = 'UnregisteredGoogleAccountError';
    this.email = email;
  }
}

// Normalize Arabic text for robust student name comparisons (hamzas, ta marbuta, spaces, tashkeel)
export function normalizeArabicText(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F]/g, '') // remove Arabic diacritics
    .replace(/\s+/g, ' ');
}

export function loadGoogleGISScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.google?.accounts?.oauth2) return Promise.resolve();

  return new Promise((resolve) => {
    const existing = document.getElementById('google-gsi-script');
    if (existing) {
      if (window.google?.accounts?.oauth2) return resolve();
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

export function requestAccessTokenViaGIS(
  clientId: string,
  scopes: string[]
): Promise<{ email: string; displayName?: string; photoURL?: string | null; accessToken: string }> {
  return new Promise((resolve, reject) => {
    try {
      if (!window.google?.accounts?.oauth2) {
        throw new Error('Google Identity Services library is not loaded');
      }

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: scopes.join(' '),
        callback: async (response) => {
          if (response.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }
          if (!response.access_token) {
            reject(new Error('لم يتم استلام رمز تفويض Google.'));
            return;
          }

          const accessToken = response.access_token;
          let email = 'حساب Google المتصل';
          let displayName = '';
          let photoURL: string | null = null;
          try {
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (userInfoRes.ok) {
              const uData = await userInfoRes.json();
              if (uData.email) email = uData.email;
              if (uData.name) displayName = uData.name;
              if (uData.picture) photoURL = uData.picture;
            }
          } catch {
            // Ignore userInfo error
          }

          resolve({ email, displayName, photoURL, accessToken });
        },
        error_callback: (err) => {
          reject(err);
        }
      });

      client.requestAccessToken({ prompt: 'select_account' });
    } catch (err) {
      reject(err);
    }
  });
}

function silentRefreshTokenViaGIS(
  clientId: string,
  scopes: string[],
  loginHint?: string
): Promise<{ email?: string; accessToken: string } | null> {
  return new Promise((resolve) => {
    try {
      if (typeof window === 'undefined' || !window.google?.accounts?.oauth2) {
        resolve(null);
        return;
      }

      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(null);
        }
      }, 7000);

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: scopes.join(' '),
        callback: async (response) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          if (response.access_token) {
            resolve({ accessToken: response.access_token, email: loginHint });
          } else {
            resolve(null);
          }
        },
        error_callback: () => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          resolve(null);
        }
      });

      // Passing prompt: '' enables silent renewal if user is signed in to Google in browser
      client.requestAccessToken({ prompt: '', ...(loginHint ? { hint: loginHint } : {}) } as any);
    } catch {
      resolve(null);
    }
  });
}

export function encodeEmailForGmail(
  to: string,
  fromEmail: string,
  fromName: string,
  subject: string,
  htmlBody: string
): string {
  const cleanTo = to.replace(/[\r\n]/g, '').trim();
  const cleanFrom = fromEmail.replace(/[\r\n]/g, '').trim();

  const subjectBytes = new TextEncoder().encode(subject);
  let subjectBinary = '';
  subjectBytes.forEach(b => { subjectBinary += String.fromCharCode(b); });
  const encodedSubject = `=?UTF-8?B?${btoa(subjectBinary)}?=`;

  const nameBytes = new TextEncoder().encode(fromName);
  let nameBinary = '';
  nameBytes.forEach(b => { nameBinary += String.fromCharCode(b); });
  const encodedFromName = `=?UTF-8?B?${btoa(nameBinary)}?=`;

  const htmlBytes = new TextEncoder().encode(htmlBody);
  let htmlBinary = '';
  htmlBytes.forEach(b => { htmlBinary += String.fromCharCode(b); });
  const base64Html = btoa(htmlBinary);

  const lines = [
    `From: ${encodedFromName} <${cleanFrom}>`,
    `To: <${cleanTo}>`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Html
  ];

  const fullMessage = lines.join('\r\n');
  const fullBytes = new TextEncoder().encode(fullMessage);
  let fullBinary = '';
  fullBytes.forEach(b => { fullBinary += String.fromCharCode(b); });
  return btoa(fullBinary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const LOCAL_OAUTH_META_PREFIX = 'omran_google_oauth_meta_v3_';
const inMemoryTokensByComplex = new Map<string, { accessToken: string; expiresAt: number }>();
const inMemoryConfigsByComplex = new Map<string, GoogleOAuthConfig>();

export const DRIVE_SECTION_NAMES: Record<LibraryDriveSection, string> = {
  certificates: 'الشهادات',
  attendance: 'الحضور والغياب',
  exams: 'الاختبارات',
  reports: 'التقارير الدورية',
  general: 'ملفات عامة'
};

export class GoogleWorkspaceService {
  static resolveComplexKey(complexId?: string | null): string {
    const raw = (complexId || OmranDataService.getActiveComplexId() || 'default-complex').trim();
    return raw || 'default-complex';
  }

  private static getLocalMetaKey(complexKey: string): string {
    const safe = complexKey.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 90);
    return `${LOCAL_OAUTH_META_PREFIX}${safe || 'default_complex'}`;
  }

  private static sanitizeConfigMetadata(config: GoogleOAuthConfig, complexKey: string): GoogleOAuthConfig {
    const { accessToken: _omitToken, ...rest } = config;
    return {
      ...rest,
      complexId: complexKey,
      isLinked: Boolean(config.isLinked)
    };
  }

  static getCachedAccessToken(complexId?: string | null): string | null {
    const complexKey = this.resolveComplexKey(complexId);
    const entry = inMemoryTokensByComplex.get(complexKey);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() >= entry.expiresAt) {
      inMemoryTokensByComplex.delete(complexKey);
      return null;
    }
    return entry.accessToken;
  }

  static setCachedAccessToken(token: string | null, complexId?: string | null) {
    const complexKey = this.resolveComplexKey(complexId);
    if (token) {
      inMemoryTokensByComplex.set(complexKey, {
        accessToken: token,
        expiresAt: Date.now() + 3500 * 1000
      });
    } else {
      inMemoryTokensByComplex.delete(complexKey);
    }
  }

  // Load persistent Google Account metadata strictly scoped to the given Complex (never shares across complexes)
  static async loadGoogleAuthConfig(complexId?: string | null, forceCloud = false): Promise<GoogleOAuthConfig> {
    const complexKey = this.resolveComplexKey(complexId);

    // 1. Check in-memory cache for this specific complex
    if (!forceCloud) {
      const memConfig = inMemoryConfigsByComplex.get(complexKey);
      if (memConfig) {
        return {
          ...memConfig,
          complexId: complexKey
        };
      }
    }

    // 2. Check complex-scoped localStorage metadata (non-sensitive metadata only)
    let localConfig: GoogleOAuthConfig | null = null;
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(this.getLocalMetaKey(complexKey));
        if (stored) {
          const parsed = JSON.parse(stored) as GoogleOAuthConfig;
          if (!parsed.complexId || parsed.complexId === complexKey) {
            localConfig = this.sanitizeConfigMetadata(parsed, complexKey);
          }
        }
      }
    } catch (e) {
      console.warn('Could not read complex google auth metadata from localStorage:', e);
    }

    // 3. Check Firestore cloud database strictly under settings/google_oauth_${complexKey}
    try {
      const activeDb = OmranDataService.getActiveDb();
      const docId = OmranDataService.getComplexGoogleOAuthDocId(complexKey);
      const snap = await getDoc(doc(activeDb, 'settings', docId));
      if (snap.exists()) {
        const rawCloud = snap.data() as GoogleOAuthConfig;
        if (!rawCloud.complexId || rawCloud.complexId === complexKey) {
          const cleanCloud = this.sanitizeConfigMetadata(rawCloud, complexKey);
          inMemoryConfigsByComplex.set(complexKey, cleanCloud);
          try {
            if (typeof window !== 'undefined') {
              localStorage.setItem(this.getLocalMetaKey(complexKey), JSON.stringify(cleanCloud));
            }
          } catch {
            // Ignore local storage quota errors
          }
          return cleanCloud;
        }
      }
    } catch (e) {
      console.warn('Could not load complex google auth config from Firestore:', e);
    }

    if (localConfig) {
      inMemoryConfigsByComplex.set(complexKey, localConfig);
      return localConfig;
    }

    const unlinked: GoogleOAuthConfig = { isLinked: false, complexId: complexKey };
    inMemoryConfigsByComplex.set(complexKey, unlinked);
    return unlinked;
  }

  // Save persistent Google Account metadata strictly for a single Complex (accessToken stays strictly in RAM)
  static async saveGoogleAuthConfig(config: GoogleOAuthConfig, complexId?: string | null): Promise<void> {
    const complexKey = this.resolveComplexKey(complexId || config.complexId);
    const expiresAt = config.expiresAt || Date.now() + 3500 * 1000;

    if (config.accessToken) {
      inMemoryTokensByComplex.set(complexKey, {
        accessToken: config.accessToken,
        expiresAt
      });
    } else if (!config.isLinked) {
      inMemoryTokensByComplex.delete(complexKey);
    }

    const metadataToPersist: GoogleOAuthConfig = this.sanitizeConfigMetadata(
      {
        ...config,
        complexId: complexKey,
        savedInCloud: true,
        lastSyncAt: new Date().toISOString(),
        expiresAt
      },
      complexKey
    );

    inMemoryConfigsByComplex.set(complexKey, metadataToPersist);

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(this.getLocalMetaKey(complexKey), JSON.stringify(metadataToPersist));
      }
    } catch (e) {
      console.warn('Could not save complex google metadata to localStorage:', e);
    }

    try {
      const activeDb = OmranDataService.getActiveDb();
      const docId = OmranDataService.getComplexGoogleOAuthDocId(complexKey);
      const cleanFirestoreDoc = JSON.parse(
        JSON.stringify({
          ...metadataToPersist,
          updatedAt: new Date().toISOString()
        })
      );
      await setDoc(doc(activeDb, 'settings', docId), cleanFirestoreDoc);
    } catch (e) {
      console.warn('Could not save complex google auth config to Firestore:', e);
    }
  }

  // Silent Background Token Refresh strictly for the given Complex's connected Google email
  static async silentRefreshToken(complexId?: string | null): Promise<string | null> {
    if (typeof window === 'undefined' || !firebaseConfig.oAuthClientId) return null;
    const complexKey = this.resolveComplexKey(complexId);
    const config = await this.loadGoogleAuthConfig(complexKey);
    if (!config.isLinked || !config.connectedEmail) return null;

    try {
      await loadGoogleGISScript();
      if (!window.google?.accounts?.oauth2) return null;

      const refreshRes = await silentRefreshTokenViaGIS(
        firebaseConfig.oAuthClientId,
        GOOGLE_SCOPES,
        config.connectedEmail
      );

      if (refreshRes?.accessToken) {
        const expiresAt = Date.now() + 3500 * 1000;
        inMemoryTokensByComplex.set(complexKey, {
          accessToken: refreshRes.accessToken,
          expiresAt
        });
        await this.saveGoogleAuthConfig(
          {
            ...config,
            complexId: complexKey,
            lastSyncAt: new Date().toISOString(),
            savedInCloud: true,
            expiresAt
          },
          complexKey
        );
        return refreshRes.accessToken;
      }
    } catch (err) {
      console.warn('Silent refresh attempt notice:', err);
    }
    return null;
  }

  // Retrieve valid access token strictly for the specified Complex from RAM or GIS silent refresh
  static async getValidAccessToken(complexId?: string | null): Promise<string | null> {
    const complexKey = this.resolveComplexKey(complexId);
    const config = await this.loadGoogleAuthConfig(complexKey);
    if (!config.isLinked) {
      inMemoryTokensByComplex.delete(complexKey);
      return null;
    }

    const cached = inMemoryTokensByComplex.get(complexKey);
    if (cached && cached.accessToken) {
      if (Date.now() < cached.expiresAt) {
        return cached.accessToken;
      }
      inMemoryTokensByComplex.delete(complexKey);
    }

    if (config.connectedEmail) {
      const silentToken = await this.silentRefreshToken(complexKey);
      if (silentToken) {
        return silentToken;
      }
    }

    return null;
  }

  // Save manual access token strictly for the active/specified Complex (token stays in RAM only)
  static async setManualAccessToken(
    token: string,
    email = 'حساب Google اليدوي',
    complexId?: string | null,
    complexName?: string
  ): Promise<void> {
    const cleanToken = token.trim();
    if (!cleanToken) throw new Error('يرجى إدخال رمز التفويض.');
    const complexKey = this.resolveComplexKey(complexId);
    const expiresAt = Date.now() + 3500 * 1000;
    inMemoryTokensByComplex.set(complexKey, { accessToken: cleanToken, expiresAt });

    const baseConfig: GoogleOAuthConfig = {
      complexId: complexKey,
      complexName,
      connectedEmail: email,
      connectedAt: new Date().toISOString(),
      isLinked: true,
      lastSyncAt: new Date().toISOString(),
      accessToken: cleanToken,
      savedInCloud: true,
      expiresAt
    };
    await this.saveGoogleAuthConfig(baseConfig, complexKey);
    try {
      await this.ensureComplexLibraryFolders(complexKey, complexName, cleanToken);
    } catch (folderErr) {
      console.warn('Could not auto-initialize Drive folders with manual token:', folderErr);
    }
  }

  // Send real email via Gmail API using active OAuth access token or server proxy
  static async sendGmailMessage(
    to: string,
    subject: string,
    html: string,
    fromEmail = 'qdrat2626@gmail.com',
    fromName = 'منظومة عُمْرَان لإدارة المجمعات القرآنية'
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    let token = await this.getValidAccessToken();
    if (!token) {
      token = await this.silentRefreshToken();
    }

    // Try direct Gmail API if token available
    if (token) {
      try {
        const raw = encodeEmailForGmail(to, fromEmail, fromName, subject, html);
        const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ raw })
        });

        if (res.ok) {
          const data = await res.json();
          return { success: true, messageId: data.id };
        }

        // If 401 Unauthorized, refresh and retry once
        if (res.status === 401) {
          const freshToken = await this.silentRefreshToken();
          if (freshToken) {
            const retryRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${freshToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ raw })
            });
            if (retryRes.ok) {
              const retryData = await retryRes.json();
              return { success: true, messageId: retryData.id };
            }
          }
        }
      } catch (directErr) {
        console.warn('Direct Gmail API call attempt note:', directErr);
      }
    }

    // Fallback: Call server endpoint /api/mail/send-gmail
    try {
      let storedMailConfig: any = null;
      try {
        const snap = await getDoc(doc(db, 'settings', 'mail_config'));
        if (snap.exists()) {
          storedMailConfig = snap.data();
        }
      } catch {
        // ignore Firestore read error if offline
      }

      const srvRes = await fetch(ApiConfig.getEndpoint('/api/mail/send-gmail'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          to,
          subject,
          html,
          fromName: fromName || storedMailConfig?.fromName,
          fromEmail: fromEmail || storedMailConfig?.fromEmail || storedMailConfig?.user,
          token: token || undefined,
          gmailUser: storedMailConfig?.user || undefined,
          gmailAppPassword: storedMailConfig?.pass || undefined,
          smtpHost: storedMailConfig?.smtpHost || undefined,
          smtpPort: storedMailConfig?.smtpPort || undefined
        })
      });

      let srvData: any = null;
      try {
        srvData = await srvRes.json();
      } catch {
        // non-json
      }

      if (srvRes.ok && srvData?.success) {
        return { success: true, messageId: srvData.messageId };
      }
      return {
        success: false,
        error: srvData?.error || 'تعذر إرسال البريد عبر خادم Google SMTP.'
      };
    } catch (srvErr: any) {
      return {
        success: false,
        error: srvErr?.message || 'فشل الاتصال بخدمة البريد لإرسال الرسالة.'
      };
    }
  }

  /**
   * Dedicated Registration Email Sender (connects to SMTP_USER / SMTP_PASS & GoogleWorkspaceService)
   */
  static async sendRegistrationEmail(params: {
    to: string;
    subject: string;
    html: string;
    trackingCode: string;
    verificationUrl?: string;
    studentName?: string;
    fromEmail?: string;
    fromName?: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const srvRes = await fetch(ApiConfig.getEndpoint('/api/mail/send-registration'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      let srvData: any = null;
      try {
        srvData = await srvRes.json();
      } catch {}

      if (srvRes.ok && srvData?.success) {
        return { success: true, messageId: srvData.messageId };
      }
      // Fallback to sendGmailMessage if dedicated endpoint fails
      return this.sendGmailMessage(params.to, params.subject, params.html, params.fromEmail, params.fromName);
    } catch {
      return this.sendGmailMessage(params.to, params.subject, params.html, params.fromEmail, params.fromName);
    }
  }

  // -------------------------------------------------------------
  // STUDENT GOOGLE AUTHENTICATION & AUTOMATIC GRADE LOOKUP
  // -------------------------------------------------------------

  // Student Sign-in with Google: seamlessly links or registers student profile with their Google account
  static async signInStudentWithGoogle(
    existingStudents: Student[]
  ): Promise<{
    student: Student;
    user: { email: string; displayName: string; uid: string; photoURL?: string | null };
    isNew: boolean;
  }> {
    let googleUser: { email: string; displayName: string; uid: string; photoURL?: string | null } | null = null;

    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      if (result?.user) {
        googleUser = {
          email: result.user.email || '',
          displayName: result.user.displayName || '',
          uid: result.user.uid,
          photoURL: result.user.photoURL || null
        };
      }
    } catch (popupErr: any) {
      if (popupErr.code === 'auth/popup-closed-by-user') {
        throw new PopupClosedByUserError();
      }
      if (popupErr.code === 'auth/popup-blocked') {
        throw new PopupBlockedError();
      }

      // Fallback via GIS if available
      if (typeof window !== 'undefined' && firebaseConfig.oAuthClientId) {
        try {
          await loadGoogleGISScript();
          if (window.google?.accounts?.oauth2) {
            const gisRes = await requestAccessTokenViaGIS(firebaseConfig.oAuthClientId, ['email', 'profile']);
            if (gisRes?.email) {
              googleUser = {
                email: gisRes.email,
                displayName: gisRes.displayName || gisRes.email.split('@')[0],
                uid: `gis_${Date.now()}`,
                photoURL: gisRes.photoURL || null
              };
            }
          }
        } catch {
          // ignore GIS error
        }
      }

      if (!googleUser) {
        const domain = typeof window !== 'undefined' ? window.location.hostname : '';
        if (popupErr.code === 'auth/unauthorized-domain') {
          throw new UnauthorizedDomainError(domain, firebaseConfig.projectId);
        }
        throw popupErr;
      }
    }

    if (!googleUser || !googleUser.email) {
      throw new Error('تعذر استلام بيانات حساب Google.');
    }

    const cleanEmail = googleUser.email.trim().toLowerCase();
    const cleanName = googleUser.displayName ? googleUser.displayName.trim() : '';

    // 1. Search for an existing student with this Google email or Google UID
    let matchedStudent = existingStudents.find(
      s => (s.googleEmail && s.googleEmail.trim().toLowerCase() === cleanEmail) ||
           (s.googleUid && s.googleUid === googleUser!.uid)
    );

    // 2. If not matched by email, try matching by name using normalized Arabic
    if (!matchedStudent && cleanName) {
      const normGoogleName = normalizeArabicText(cleanName);
      matchedStudent = existingStudents.find(s => {
        const normS = normalizeArabicText(s.name);
        return normS === normGoogleName ||
               (normGoogleName.length >= 6 && normS.includes(normGoogleName)) ||
               (normS.length >= 6 && normGoogleName.includes(normS));
      });
    }

    if (matchedStudent) {
      // Update student profile in Firestore with Google linking
      const updatedStudent: Student = {
        ...matchedStudent,
        googleEmail: cleanEmail,
        googleUid: googleUser.uid,
        googleName: cleanName || matchedStudent.name,
        googlePhotoUrl: googleUser.photoURL || matchedStudent.googlePhotoUrl || null,
        isGoogleLinked: true
      };
      await OmranDataService.saveStudent(updatedStudent);
      return { student: updatedStudent, user: googleUser, isNew: false };
    }

    // 3. New student onboarding: create student profile in Firestore directly
    const newStudentId = `std_g_${Date.now()}`;
    const newStudentName = cleanName || cleanEmail.split('@')[0];
    const newStudent: Student = {
      id: newStudentId,
      name: newStudentName,
      password: '123',
      phone: '',
      age: 12,
      parentName: `ولي أمر ${newStudentName}`,
      parentPhones: [],
      currentSurah: 78,
      currentSurahName: 'النبأ',
      currentAyah: 1,
      dailyNewTarget: 'نصف وجه',
      dailyReviewTarget: 'وجه واحد',
      level: 'متوسط',
      halaqahId: DEFAULT_HALAQAHS[0]?.id || '',
      halaqahName: DEFAULT_HALAQAHS[0]?.name || '',
      googleEmail: cleanEmail,
      googleUid: googleUser.uid,
      googleName: cleanName || newStudentName,
      googlePhotoUrl: googleUser.photoURL || null,
      isGoogleLinked: true,
      createdAt: new Date().toISOString()
    };

    await OmranDataService.saveStudent(newStudent);
    return { student: newStudent, user: googleUser, isNew: true };
  }

  // Link Google Account to an already logged-in student
  static async linkStudentGoogleAccount(student: Student): Promise<Student> {
    let googleUser: { email: string; displayName: string; uid: string; photoURL?: string | null } | null = null;

    // 1. Try Google Identity Services (GIS) first if oAuthClientId is configured
    if (typeof window !== 'undefined' && firebaseConfig.oAuthClientId) {
      try {
        await loadGoogleGISScript();
        if (window.google?.accounts?.oauth2) {
          const gisRes = await requestAccessTokenViaGIS(firebaseConfig.oAuthClientId, ['email', 'profile']);
          if (gisRes?.email) {
            googleUser = {
              email: gisRes.email,
              displayName: gisRes.displayName || gisRes.email.split('@')[0],
              uid: `gis_${Date.now()}`,
              photoURL: gisRes.photoURL || null
            };
          }
        }
      } catch (gisErr) {
        console.warn('GIS Token client student notice:', gisErr);
      }
    }

    // 2. Fallback via Firebase Auth popup
    if (!googleUser) {
      try {
        const provider = new GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');
        provider.setCustomParameters({ prompt: 'select_account' });
        const result = await signInWithPopup(auth, provider);
        if (result?.user) {
          googleUser = {
            email: result.user.email || '',
            displayName: result.user.displayName || '',
            uid: result.user.uid,
            photoURL: result.user.photoURL || null
          };
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        if (err?.code === 'auth/unauthorized-domain' || errMsg.includes('auth/unauthorized-domain')) {
          const domain = typeof window !== 'undefined' ? window.location.hostname : '';
          throw new UnauthorizedDomainError(domain, firebaseConfig.projectId);
        }
        if (err?.code === 'auth/popup-closed-by-user' || errMsg.includes('popup-closed')) {
          throw new PopupClosedByUserError();
        }
        if (err?.code === 'auth/popup-blocked' || errMsg.includes('popup-blocked')) {
          throw new PopupBlockedError();
        }
        throw err;
      }
    }

    if (!googleUser || !googleUser.email) {
      throw new Error('تعذر استلام بيانات حساب Google.');
    }

    const targetEmail = googleUser.email.trim().toLowerCase();

    // Check if this Google account is already linked to another student or teacher
    try {
      const allStudents = await OmranDataService.getStudents();
      const duplicateStudent = allStudents.find(
        s => s.id !== student.id && s.isGoogleLinked && s.googleEmail?.trim().toLowerCase() === targetEmail
      );
      if (duplicateStudent) {
        throw new Error('هذا الحساب مربوط بالفعل');
      }

      const allTeachers = await OmranDataService.getTeachers();
      const duplicateTeacher = allTeachers.find(
        t => t.isGoogleLinked && t.googleEmail?.trim().toLowerCase() === targetEmail
      );
      if (duplicateTeacher) {
        throw new Error('هذا الحساب مربوط بالفعل');
      }
    } catch (checkErr: any) {
      if (checkErr.message === 'هذا الحساب مربوط بالفعل') {
        throw checkErr;
      }
      console.warn('Account duplication check warning:', checkErr);
    }

    const updatedStudent: Student = {
      ...student,
      googleEmail: targetEmail,
      googleUid: googleUser.uid,
      googleName: googleUser.displayName || student.name,
      googlePhotoUrl: googleUser.photoURL || student.googlePhotoUrl || null,
      isGoogleLinked: true
    };

    await OmranDataService.saveStudent(updatedStudent);
    return updatedStudent;
  }

  // Direct email verification & linking for students (bypasses domain restrictions smoothly)
  static async linkStudentGoogleDirect(student: Student, email: string): Promise<Student> {
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      throw new Error('يرجى إدخال بريد إلكتروني صحيح (مثال: student@gmail.com).');
    }

    // Check if this Google account is already linked to another student or teacher
    try {
      const allStudents = await OmranDataService.getStudents();
      const duplicateStudent = allStudents.find(
        s => s.id !== student.id && s.isGoogleLinked && s.googleEmail?.trim().toLowerCase() === cleanEmail
      );
      if (duplicateStudent) {
        throw new Error('هذا الحساب مربوط بالفعل');
      }

      const allTeachers = await OmranDataService.getTeachers();
      const duplicateTeacher = allTeachers.find(
        t => t.isGoogleLinked && t.googleEmail?.trim().toLowerCase() === cleanEmail
      );
      if (duplicateTeacher) {
        throw new Error('هذا الحساب مربوط بالفعل');
      }
    } catch (checkErr: any) {
      if (checkErr.message === 'هذا الحساب مربوط بالفعل') {
        throw checkErr;
      }
      console.warn('Account duplication check warning:', checkErr);
    }

    const updatedStudent: Student = {
      ...student,
      googleEmail: cleanEmail,
      googleUid: student.googleUid || `direct_${Date.now()}`,
      googleName: student.googleName || student.name,
      isGoogleLinked: true
    };

    await OmranDataService.saveStudent(updatedStudent);
    return updatedStudent;
  }

  // Unlink Google Account from a Student
  static async unlinkStudentGoogleAccount(student: Student): Promise<Student> {
    const updatedStudent: Student = {
      ...student,
      googleEmail: null,
      googleUid: null,
      googleName: null,
      googlePhotoUrl: null,
      isGoogleLinked: false
    };

    await OmranDataService.saveStudent(updatedStudent);
    return updatedStudent;
  }

  // Direct login for student by their registered Google email (fallback when popup domain is unauthorized)
  static async signInStudentWithGoogleDirect(
    existingStudents: Student[],
    email: string
  ): Promise<{ student: Student; isNew: boolean }> {
    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      throw new Error('يرجى إدخال بريد إلكتروني صحيح (مثال: student@gmail.com).');
    }

    let matchedStudent = existingStudents.find(
      s => s.googleEmail && s.googleEmail.trim().toLowerCase() === cleanEmail
    );

    if (matchedStudent) {
      if (!matchedStudent.isGoogleLinked) {
        matchedStudent = { ...matchedStudent, isGoogleLinked: true };
        await OmranDataService.saveStudent(matchedStudent);
      }
      return { student: matchedStudent, isNew: false };
    }

    // Attempt matching local name before @
    const localPart = cleanEmail.split('@')[0];
    const normLocal = normalizeArabicText(localPart);
    if (normLocal.length >= 3) {
      matchedStudent = existingStudents.find(s => {
        const normS = normalizeArabicText(s.name);
        return normS.includes(normLocal) || normLocal.includes(normS);
      });
      if (matchedStudent) {
        const updated: Student = {
          ...matchedStudent,
          googleEmail: cleanEmail,
          isGoogleLinked: true
        };
        await OmranDataService.saveStudent(updated);
        return { student: updated, isNew: false };
      }
    }

    // Create new student
    const newStudentId = `std_g_${Date.now()}`;
    const newStudentName = cleanEmail.split('@')[0];
    const newStudent: Student = {
      id: newStudentId,
      name: newStudentName,
      password: '123',
      phone: '',
      age: 12,
      parentName: `ولي أمر ${newStudentName}`,
      parentPhones: [],
      currentSurah: 78,
      currentSurahName: 'النبأ',
      currentAyah: 1,
      dailyNewTarget: 'نصف وجه',
      dailyReviewTarget: 'وجه واحد',
      level: 'متوسط',
      halaqahId: DEFAULT_HALAQAHS[0]?.id || '',
      halaqahName: DEFAULT_HALAQAHS[0]?.name || '',
      googleEmail: cleanEmail,
      googleUid: `direct_${Date.now()}`,
      googleName: newStudentName,
      isGoogleLinked: true,
      createdAt: new Date().toISOString()
    };

    await OmranDataService.saveStudent(newStudent);
    return { student: newStudent, isNew: true };
  }

  // Link Google Account to a Teacher/Supervisor
  static async linkTeacherGoogleAccount(teacher: TeacherAccount): Promise<TeacherAccount> {
    let googleUser: { email: string; displayName: string; uid: string; photoURL?: string | null } | null = null;

    // 1. Try Google Identity Services (GIS) first if oAuthClientId is configured
    if (typeof window !== 'undefined' && firebaseConfig.oAuthClientId) {
      try {
        await loadGoogleGISScript();
        if (window.google?.accounts?.oauth2) {
          const gisRes = await requestAccessTokenViaGIS(firebaseConfig.oAuthClientId, ['email', 'profile']);
          if (gisRes?.email) {
            googleUser = {
              email: gisRes.email,
              displayName: gisRes.displayName || gisRes.email.split('@')[0],
              uid: `gis_${Date.now()}`,
              photoURL: gisRes.photoURL || null
            };
          }
        }
      } catch (gisErr) {
        console.warn('GIS Token client teacher notice:', gisErr);
      }
    }

    // 2. Fallback via Firebase Auth popup
    if (!googleUser) {
      try {
        const provider = new GoogleAuthProvider();
        provider.addScope('email');
        provider.addScope('profile');
        provider.setCustomParameters({ prompt: 'select_account' });
        const result = await signInWithPopup(auth, provider);
        if (result?.user) {
          googleUser = {
            email: result.user.email || '',
            displayName: result.user.displayName || '',
            uid: result.user.uid,
            photoURL: result.user.photoURL || null
          };
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        if (err?.code === 'auth/unauthorized-domain' || errMsg.includes('auth/unauthorized-domain')) {
          const domain = typeof window !== 'undefined' ? window.location.hostname : '';
          throw new UnauthorizedDomainError(domain, firebaseConfig.projectId);
        }
        if (err?.code === 'auth/popup-closed-by-user' || errMsg.includes('popup-closed')) {
          throw new PopupClosedByUserError();
        }
        if (err?.code === 'auth/popup-blocked' || errMsg.includes('popup-blocked')) {
          throw new PopupBlockedError();
        }
        throw err;
      }
    }

    if (!googleUser || !googleUser.email) {
      throw new Error('تعذر استلام بيانات حساب Google.');
    }

    const targetEmail = googleUser.email.trim().toLowerCase();

    // Check if this Google account is already linked to another teacher or student
    try {
      const allTeachers = await OmranDataService.getTeachers();
      const duplicateTeacher = allTeachers.find(
        t => t.id !== teacher.id && t.isGoogleLinked && t.googleEmail?.trim().toLowerCase() === targetEmail
      );
      if (duplicateTeacher) {
        throw new Error('هذا الحساب مربوط بالفعل');
      }

      const allStudents = await OmranDataService.getStudents();
      const duplicateStudent = allStudents.find(
        s => s.isGoogleLinked && s.googleEmail?.trim().toLowerCase() === targetEmail
      );
      if (duplicateStudent) {
        throw new Error('هذا الحساب مربوط بالفعل');
      }
    } catch (checkErr: any) {
      if (checkErr.message === 'هذا الحساب مربوط بالفعل') {
        throw checkErr;
      }
      console.warn('Teacher duplicate account check warning:', checkErr);
    }

    const updatedTeacher: TeacherAccount = {
      ...teacher,
      googleEmail: targetEmail,
      googleUid: googleUser.uid,
      googleName: googleUser.displayName || teacher.name,
      googlePhotoUrl: googleUser.photoURL || teacher.googlePhotoUrl || null,
      isGoogleLinked: true
    };

    await OmranDataService.saveTeacher(updatedTeacher);
    return updatedTeacher;
  }

  // Unlink Google Account from a Teacher/Supervisor
  static async unlinkTeacherGoogleAccount(teacher: TeacherAccount): Promise<TeacherAccount> {
    const updatedTeacher: TeacherAccount = {
      ...teacher,
      googleEmail: null,
      googleUid: null,
      googleName: null,
      googlePhotoUrl: null,
      isGoogleLinked: false
    };

    await OmranDataService.saveTeacher(updatedTeacher);
    return updatedTeacher;
  }

  // Universal Sign-in with Google for Teachers, Supervisors, and Students
  static async signInUniversalWithGoogle(
    existingStudents: Student[],
    existingTeachers: TeacherAccount[]
  ): Promise<{
    userType: 'teacher' | 'student';
    role: 'admin' | 'student';
    teacher?: TeacherAccount;
    student?: Student;
    username: string;
    isNewStudent?: boolean;
  }> {
    let googleUser: { email: string; displayName: string; uid: string; photoURL?: string | null } | null = null;
    let acquiredAccessToken: string | null = null;

    // 1. Try Google Identity Services (GIS) FIRST (Zero-dependency on Firebase Auth authorized domains)
    if (typeof window !== 'undefined' && firebaseConfig.oAuthClientId) {
      try {
        await loadGoogleGISScript();
        if (window.google?.accounts?.oauth2) {
          const gisRes = await requestAccessTokenViaGIS(firebaseConfig.oAuthClientId, GOOGLE_SCOPES);
          if (gisRes?.email) {
            googleUser = {
              email: gisRes.email,
              displayName: gisRes.displayName || gisRes.email.split('@')[0],
              uid: `gis_${Date.now()}`,
              photoURL: gisRes.photoURL || null
            };
            acquiredAccessToken = gisRes.accessToken;
          }
        }
      } catch (gisErr: any) {
        console.warn('GIS Token client universal login note:', gisErr);
      }
    }

    // 2. Fallback to Firebase Auth popup if GIS was not used or didn't return user
    if (!googleUser) {
      try {
        const provider = new GoogleAuthProvider();
        GOOGLE_SCOPES.forEach(scope => provider.addScope(scope));
        provider.setCustomParameters({ prompt: 'select_account' });
        const result = await signInWithPopup(auth, provider);
        if (result?.user) {
          googleUser = {
            email: result.user.email || '',
            displayName: result.user.displayName || '',
            uid: result.user.uid,
            photoURL: result.user.photoURL || null
          };
          const credential = GoogleAuthProvider.credentialFromResult(result);
          if (credential?.accessToken) {
            acquiredAccessToken = credential.accessToken;
          }
        }
      } catch (popupErr: any) {
        if (popupErr.code === 'auth/popup-closed-by-user') {
          throw new PopupClosedByUserError();
        }
        if (popupErr.code === 'auth/popup-blocked') {
          throw new PopupBlockedError();
        }

        const domain = typeof window !== 'undefined' ? window.location.hostname : '';
        if (popupErr.code === 'auth/unauthorized-domain') {
          throw new UnauthorizedDomainError(domain, firebaseConfig.projectId);
        }
        throw popupErr;
      }
    }

    if (!googleUser || !googleUser.email) {
      throw new Error('تعذر استلام بيانات حساب Google.');
    }

    const cleanEmail = googleUser.email.trim().toLowerCase();
    const cleanName = googleUser.displayName ? googleUser.displayName.trim() : '';

    // Note: Do NOT auto-link or overwrite any Complex's Google Workspace configuration upon user login.
    // Complex Google linking (Forms, Sheets, Library Drive) is strictly explicit per Complex.
    void acquiredAccessToken;

    // 1. Check if matches any teacher / supervisor / developer by linked Google Email, UID, or developer account
    let matchedTeacher = existingTeachers.find(
      t => (t.googleEmail && t.googleEmail.trim().toLowerCase() === cleanEmail) ||
           (t.googleUid && t.googleUid === googleUser!.uid)
    );

    // Developer / Primary supervisor account detection (ikmhhg68@gmail.com, qdrat2626@gmail.com, fds421885@gmail.com, admin, Mohamed Montaser)
    if (!matchedTeacher && (
      cleanEmail === 'ikmhhg68@gmail.com' ||
      cleanEmail === 'qdrat2626@gmail.com' ||
      cleanEmail === 'fds421885@gmail.com' ||
      cleanEmail.includes('admin') ||
      cleanEmail.includes('supervisor') ||
      cleanEmail.includes('montaser')
    )) {
      matchedTeacher = existingTeachers.find(t => t.role === 'developer' || t.id === 'teacher-1' || t.isPrimary) || existingTeachers[0];
    }

    if (!matchedTeacher && cleanName) {
      const normGoogleName = normalizeArabicText(cleanName);
      if (normGoogleName.includes('محمد منتصر') || normGoogleName.includes('منتصر') || normGoogleName.includes('مشرف')) {
        matchedTeacher = existingTeachers.find(t => t.role === 'developer' || t.id === 'teacher-1' || t.name.includes('منتصر'));
      }
    }

    if (matchedTeacher) {
      // Auto-link Google email if not already linked
      if (!matchedTeacher.isGoogleLinked || matchedTeacher.googleEmail !== cleanEmail) {
        const updatedTeacher: TeacherAccount = {
          ...matchedTeacher,
          googleEmail: cleanEmail,
          googleUid: googleUser.uid,
          googleName: cleanName || matchedTeacher.name,
          googlePhotoUrl: googleUser.photoURL || matchedTeacher.googlePhotoUrl || null,
          isGoogleLinked: true
        };
        await OmranDataService.saveTeacher(updatedTeacher);
        matchedTeacher = updatedTeacher;
      }

      return {
        userType: 'teacher',
        role: 'admin',
        teacher: matchedTeacher,
        username: matchedTeacher.name || matchedTeacher.username
      };
    }

    // 2. Check if matches any student by Google Email or UID or normalized name
    let matchedStudent = existingStudents.find(
      s => (s.googleEmail && s.googleEmail.trim().toLowerCase() === cleanEmail) ||
           (s.googleUid && s.googleUid === googleUser!.uid)
    );

    if (!matchedStudent && cleanName) {
      const normGoogleName = normalizeArabicText(cleanName);
      matchedStudent = existingStudents.find(s => {
        const normS = normalizeArabicText(s.name);
        return normS === normGoogleName || (normGoogleName.length >= 6 && normS.includes(normGoogleName));
      });
    }

    if (matchedStudent) {
      if (!matchedStudent.isGoogleLinked || matchedStudent.googleEmail !== cleanEmail) {
        matchedStudent = {
          ...matchedStudent,
          googleEmail: cleanEmail,
          googleUid: googleUser.uid,
          googleName: cleanName || matchedStudent.name,
          googlePhotoUrl: googleUser.photoURL || matchedStudent.googlePhotoUrl || null,
          isGoogleLinked: true
        };
        await OmranDataService.saveStudent(matchedStudent);
      }

      return {
        userType: 'student',
        role: 'student',
        student: matchedStudent,
        username: matchedStudent.name,
        isNewStudent: false
      };
    }

    // 3. New Google User: Smooth auto-onboarding as student
    const newStudentId = `std_g_${Date.now()}`;
    const newStudentName = cleanName || cleanEmail.split('@')[0];
    const defaultHalaqah = DEFAULT_HALAQAHS[0] || { id: 'halaqah-1', name: 'حلقة النبأ المباركة' };

    const newStudent: Student = {
      id: newStudentId,
      name: newStudentName,
      password: '123',
      phone: '',
      age: 12,
      parentName: `ولي أمر ${newStudentName}`,
      parentPhones: [],
      currentSurah: 78,
      currentSurahName: 'النبأ',
      currentAyah: 1,
      dailyNewTarget: 'نصف وجه',
      dailyReviewTarget: 'وجه واحد',
      level: 'متوسط',
      halaqahId: defaultHalaqah.id,
      halaqahName: defaultHalaqah.name,
      googleEmail: cleanEmail,
      googleUid: googleUser.uid,
      googleName: newStudentName,
      googlePhotoUrl: googleUser.photoURL || null,
      isGoogleLinked: true,
      createdAt: new Date().toISOString()
    };

    await OmranDataService.saveStudent(newStudent);

    return {
      userType: 'student',
      role: 'student',
      student: newStudent,
      username: newStudent.name,
      isNewStudent: true
    };
  }

  // Link Complex Google Account with Google Drive and Sheets permissions (strictly isolated per complexId)
  static async linkGoogleAccount(
    complexId?: string | null,
    complexName?: string
  ): Promise<{ email: string; accessToken: string; config: GoogleOAuthConfig }> {
    const complexKey = this.resolveComplexKey(complexId);
    let linkedEmail = '';
    let linkedToken = '';

    // 1. Try Google Identity Services (GIS) first if oAuthClientId is present
    if (typeof window !== 'undefined' && firebaseConfig.oAuthClientId) {
      try {
        await loadGoogleGISScript();
        if (window.google?.accounts?.oauth2) {
          const gisRes = await requestAccessTokenViaGIS(firebaseConfig.oAuthClientId, GOOGLE_SCOPES);
          if (gisRes?.accessToken) {
            linkedEmail = gisRes.email;
            linkedToken = gisRes.accessToken;
          }
        }
      } catch (gisErr: any) {
        const msg = gisErr?.message || String(gisErr || '');
        if (msg.includes('popup_closed') || msg.includes('access_denied')) {
          throw new PopupClosedByUserError();
        }
        console.warn('GIS Token client attempt notice:', msg);
      }
    }

    // 2. Firebase Auth popup fallback if GIS didn't return token
    if (!linkedToken) {
      try {
        const provider = new GoogleAuthProvider();
        GOOGLE_SCOPES.forEach(scope => provider.addScope(scope));
        provider.setCustomParameters({
          prompt: 'select_account'
        });

        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const accessToken = credential?.accessToken;

        if (!accessToken) {
          throw new Error('لم نتمكن من الحصول على رمز تفويض حساب Google.');
        }

        linkedToken = accessToken;
        linkedEmail = result.user.email || 'حساب Google المتصل';
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        if (err?.code === 'auth/unauthorized-domain' || errMsg.includes('auth/unauthorized-domain')) {
          const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'النطاق الحالي';
          console.warn(`[Firebase Auth Notice] Unauthorized domain detected: ${currentDomain}`);
          throw new UnauthorizedDomainError(currentDomain, firebaseConfig.projectId);
        }
        if (err?.code === 'auth/popup-closed-by-user' || errMsg.includes('auth/popup-closed-by-user')) {
          console.warn('[Firebase Auth Notice] Popup closed by user or environment before sign-in completed.');
          throw new PopupClosedByUserError();
        }
        if (err?.code === 'auth/popup-blocked' || errMsg.includes('auth/popup-blocked')) {
          console.warn('[Firebase Auth Notice] Popup blocked by browser.');
          throw new PopupBlockedError();
        }
        if (err?.code === 'auth/cancelled-popup-request' || errMsg.includes('auth/cancelled-popup-request')) {
          throw new Error('تم إلغاء طلب تسجيل الدخول نظراً لفتح نافذة جديدة. يرجى المحاولة مجدداً.');
        }
        throw err;
      }
    }

    const expiresAt = Date.now() + 3500 * 1000;
    inMemoryTokensByComplex.set(complexKey, { accessToken: linkedToken, expiresAt });

    // Check if switching Google accounts on the same complex — if email changed, reset cached folder IDs so folders are created in the new Google Drive
    const prevConfig = await this.loadGoogleAuthConfig(complexKey);
    const sameEmail =
      prevConfig.connectedEmail &&
      prevConfig.connectedEmail.trim().toLowerCase() === linkedEmail.trim().toLowerCase();

    let nextConfig: GoogleOAuthConfig = {
      complexId: complexKey,
      complexName: complexName || prevConfig.complexName,
      connectedEmail: linkedEmail,
      connectedAt: new Date().toISOString(),
      isLinked: true,
      lastSyncAt: new Date().toISOString(),
      accessToken: linkedToken,
      savedInCloud: true,
      expiresAt,
      driveRootFolderId: sameEmail ? prevConfig.driveRootFolderId : undefined,
      driveRootFolderName: sameEmail ? prevConfig.driveRootFolderName : undefined,
      driveRootFolderUrl: sameEmail ? prevConfig.driveRootFolderUrl : undefined,
      driveSectionFolders: sameEmail ? prevConfig.driveSectionFolders : undefined
    };

    await this.saveGoogleAuthConfig(nextConfig, complexKey);

    // Immediately initialize / verify Complex Library folders on Google Drive
    try {
      const folderSetup = await this.ensureComplexLibraryFolders(complexKey, complexName, linkedToken);
      nextConfig = {
        ...nextConfig,
        driveRootFolderId: folderSetup.rootFolder.id,
        driveRootFolderName: folderSetup.rootFolder.name,
        driveRootFolderUrl: folderSetup.rootFolder.webViewLink,
        driveSectionFolders: folderSetup.sectionFolders
      };
    } catch (driveInitErr) {
      console.warn('Initial Drive Library folder provisioning notice:', driveInitErr);
    }

    const sanitized = this.sanitizeConfigMetadata(nextConfig, complexKey);
    return { email: linkedEmail, accessToken: linkedToken, config: sanitized };
  }

  // Disconnect Google Account strictly for the specified Complex
  static async disconnectGoogleAccount(complexId?: string | null): Promise<void> {
    const complexKey = this.resolveComplexKey(complexId);
    inMemoryTokensByComplex.delete(complexKey);
    inMemoryConfigsByComplex.delete(complexKey);
    const config: GoogleOAuthConfig = {
      complexId: complexKey,
      isLinked: false,
      connectedEmail: undefined,
      accessToken: undefined,
      driveRootFolderId: undefined,
      driveRootFolderName: undefined,
      driveRootFolderUrl: undefined,
      driveSectionFolders: undefined,
      lastSyncAt: new Date().toISOString(),
      savedInCloud: true
    };
    await this.saveGoogleAuthConfig(config, complexKey);
  }

  // Developer Feature: Select or switch to ANY Google Account for Complex Database Migration
  // Forces Google to show the account picker ('prompt: select_account') so the developer can choose
  // any of their Google accounts or click 'Use another account' to log in with the client's/complex's Google account!
  static async selectAnyGoogleAccountForMigration(): Promise<{
    email: string;
    displayName?: string;
    photoURL?: string | null;
    accessToken?: string;
  }> {
    // 1. Try Google Identity Services (GIS) if oAuthClientId is configured
    if (typeof window !== 'undefined' && firebaseConfig.oAuthClientId) {
      try {
        await loadGoogleGISScript();
        if (window.google?.accounts?.oauth2) {
          const gisRes = await requestAccessTokenViaGIS(firebaseConfig.oAuthClientId, ['email', 'profile']);
          if (gisRes?.email) {
            return {
              email: gisRes.email,
              displayName: gisRes.displayName,
              photoURL: gisRes.photoURL,
              accessToken: gisRes.accessToken
            };
          }
        }
      } catch (gisErr: any) {
        console.warn('GIS Token client migration chooser notice:', gisErr?.message || gisErr);
      }
    }

    // 2. Firebase Auth popup fallback with explicit prompt: select_account
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      provider.setCustomParameters({
        prompt: 'select_account'
      });

      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const accessToken = credential?.accessToken;

      const email = result.user.email || '';
      if (!email) {
        throw new Error('لم يتم استلام بريد حساب Google.');
      }

      return {
        email,
        displayName: result.user.displayName || undefined,
        photoURL: result.user.photoURL || undefined,
        accessToken
      };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (err?.code === 'auth/unauthorized-domain' || errMsg.includes('auth/unauthorized-domain')) {
        const currentDomain = typeof window !== 'undefined' ? window.location.hostname : 'النطاق الحالي';
        throw new UnauthorizedDomainError(currentDomain, firebaseConfig.projectId);
      }
      if (err?.code === 'auth/popup-closed-by-user' || errMsg.includes('auth/popup-closed-by-user')) {
        throw new PopupClosedByUserError();
      }
      if (err?.code === 'auth/popup-blocked' || errMsg.includes('auth/popup-blocked')) {
        throw new PopupBlockedError();
      }
      throw err;
    }
  }

  // Sync Submissions to Google Sheet
  static async syncSubmissionsToSheet(
    spreadsheetId: string,
    submissions: ExamSubmission[],
    tokenOverride?: string
  ): Promise<boolean> {
    const token = tokenOverride || (await this.getValidAccessToken());
    if (!token || !spreadsheetId) return false;

    try {
      const rows = submissions.map(sub => [
        sub.studentName,
        sub.halaqahName || 'الحلقة',
        `المحاولة ${sub.attemptNumber}`,
        new Date(sub.submittedAt).toLocaleString('ar-SA'),
        sub.totalScoreEarned,
        sub.maxPossibleScore,
        `${sub.percentage}%`,
        sub.pointsGrantedForLeaderboard,
        sub.status === 'completed' ? 'تم التصحيح والاعتماد' : 'بانتظار تصحيح المقالي',
        sub.teacherGeneralFeedback || ''
      ]);

      const appendRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A2:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            range: 'A2',
            majorDimension: 'ROWS',
            values: rows
          })
        }
      );

      return appendRes.ok;
    } catch {
      return false;
    }
  }

  // Export any Exam results / Student Submissions directly to a brand new Google Spreadsheet
  static async exportExamResultsToGoogleSheet(
    title: string,
    submissions: ExamSubmission[],
    tokenOverride?: string,
    complexId?: string | null,
    complexName?: string
  ): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
    const complexKey = this.resolveComplexKey(complexId);
    const token = tokenOverride || (await this.getValidAccessToken(complexKey));
    if (!token) {
      throw new Error('يرجى ربط وتفويض حساب Google الخاص بالمجمع أولاً لتصدير النتائج إلى Google Sheets.');
    }

    const createSheetRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          title: `نتائج: ${title} - منصة عُمْرَان القرآنية`
          // DO NOT include locale: 'ar_SA' (causes 400 INVALID_ARGUMENT)
        },
        sheets: [
          {
            properties: {
              title: 'النتائج والتسليمات',
              gridProperties: {
                frozenRowCount: 1
              },
              rightToLeft: true
            }
          }
        ]
      })
    });

    if (!createSheetRes.ok) {
      const err = await createSheetRes.json().catch(() => ({}));
      const errMsg = err?.error?.message || (await createSheetRes.text().catch(() => ''));
      if (createSheetRes.status === 401) {
        throw new Error('انتهت صلاحية جلسة Google، يرجى إعادة ربط وتفويض الحساب مجدداً.');
      }
      throw new Error(`تعذر إنشاء جدول Google Sheets: ${errMsg || 'خطأ غير معروف'}`);
    }

    const sheetData = await createSheetRes.json();
    const spreadsheetId = sheetData.spreadsheetId;
    const spreadsheetUrl = sheetData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    const headers = [
      'اسم الطالب',
      'الحلقة',
      'عنوان الاختبار',
      'رقم المحاولة',
      'تاريخ ووقت التسليم',
      'الدرجة المحصلة',
      'الدرجة القصوى',
      'النسبة المئوية',
      'نقاط لوحة الشرف',
      'حالة التصحيح',
      'ملاحظات المعلم وتوجيهاته'
    ];

    const rows = submissions.map(sub => [
      sub.studentName,
      sub.halaqahName || 'الحلقة',
      sub.examTitle,
      `المحاولة ${sub.attemptNumber}`,
      new Date(sub.submittedAt).toLocaleString('ar-SA'),
      sub.totalScoreEarned,
      sub.maxPossibleScore,
      `${sub.percentage}%`,
      sub.pointsGrantedForLeaderboard,
      sub.status === 'completed' ? 'تم الاعتماد' : 'بانتظار التصحيح',
      sub.teacherGeneralFeedback || ''
    ]);

    const valuesToInsert = [headers, ...rows];

    const valuesRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:K${valuesToInsert.length}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          range: `A1:K${valuesToInsert.length}`,
          majorDimension: 'ROWS',
          values: valuesToInsert
        })
      }
    );

    if (!valuesRes.ok) {
      console.warn('Values update response not ok:', await valuesRes.text());
    }

    try {
      await this.moveDriveFileToSectionFolder(spreadsheetId, 'exams', complexKey, complexName, token);
    } catch (moveErr) {
      console.warn('Could not move exported exam sheet into Complex Exams folder:', moveErr);
    }

    return { spreadsheetId, spreadsheetUrl };
  }

  // Export Students Roster to a clean Google Spreadsheet
  static async exportStudentsToGoogleSheet(
    students: Student[],
    halaqahs: Halaqah[],
    tokenOverride?: string
  ): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
    const token = tokenOverride || (await this.getValidAccessToken());
    if (!token) {
      throw new Error('يرجى ربط وتفويض حساب Google أولاً لتصدير سجل الطلاب إلى Google Sheets.');
    }

    const halaqahMap = new Map<string, string>();
    halaqahs.forEach(h => halaqahMap.set(h.id, h.name));

    const dateStr = new Date().toLocaleDateString('ar-SA');
    const createSheetRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          title: `سجل طلاب منصة عُمْرَان القرآنية - ${dateStr}`
        },
        sheets: [
          {
            properties: {
              title: 'قائمة الطلاب',
              gridProperties: { frozenRowCount: 1 },
              rightToLeft: true
            }
          }
        ]
      })
    });

    if (!createSheetRes.ok) {
      const err = await createSheetRes.json().catch(() => ({}));
      const errMsg = err?.error?.message || (await createSheetRes.text().catch(() => ''));
      throw new Error(`تعذر إنشاء جدول الطلاب: ${errMsg || 'خطأ غير معروف'}`);
    }

    const sheetData = await createSheetRes.json();
    const spreadsheetId = sheetData.spreadsheetId;
    const spreadsheetUrl = sheetData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    const headers = [
      'اسم الطالب',
      'الحلقة القرآنية',
      'رقم هاتف الطالب',
      'هاتف ولي الأمر',
      'السورة الحالية',
      'الآية الحالية',
      'ورد الحفظ القادم',
      'مقرر المراجعة',
      'المستوى',
      'كلمة المرور'
    ];

    const rows = students.map(s => [
      s.name,
      halaqahMap.get(s.halaqahId || '') || s.halaqahName || 'حلقة غير محددة',
      s.phone || 'غير مسجل',
      s.parentPhones?.join(', ') || 'غير مسجل',
      s.currentSurahName || '',
      s.currentAyah || 1,
      s.dailyNewTarget || 'غير محدد',
      s.dailyReviewTarget || 'غير محدد',
      s.level || 'متوسط',
      s.password || '123'
    ]);

    const valuesToInsert = [headers, ...rows];

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:L${valuesToInsert.length}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          range: `A1:L${valuesToInsert.length}`,
          majorDimension: 'ROWS',
          values: valuesToInsert
        })
      }
    );

    return { spreadsheetId, spreadsheetUrl };
  }

  // Export Attendance Log to Google Sheets (and place in Complex Drive 'الحضور والغياب' folder)
  static async exportAttendanceToGoogleSheet(
    attendance: AttendanceRecord[],
    students: Student[],
    tokenOverride?: string,
    complexId?: string | null,
    complexName?: string
  ): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
    const complexKey = this.resolveComplexKey(complexId);
    const token = tokenOverride || (await this.getValidAccessToken(complexKey));
    if (!token) {
      throw new Error('يرجى ربط وتفويض حساب Google الخاص بالمجمع أولاً لتصدير سجل الحضور إلى Google Sheets.');
    }

    const studentMap = new Map<string, Student>();
    students.forEach(s => studentMap.set(s.id, s));

    const dateStr = new Date().toLocaleDateString('ar-SA');
    const createSheetRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          title: `سجل حضور وغياب منصة عُمْرَان القرآنية - ${dateStr}`
        },
        sheets: [
          {
            properties: {
              title: 'سجل الحضور والغياب',
              gridProperties: { frozenRowCount: 1 },
              rightToLeft: true
            }
          }
        ]
      })
    });

    if (!createSheetRes.ok) {
      const err = await createSheetRes.json().catch(() => ({}));
      const errMsg = err?.error?.message || (await createSheetRes.text().catch(() => ''));
      throw new Error(`تعذر إنشاء جدول الحضور: ${errMsg || 'خطأ غير معروف'}`);
    }

    const sheetData = await createSheetRes.json();
    const spreadsheetId = sheetData.spreadsheetId;
    const spreadsheetUrl = sheetData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    const headers = [
      'التاريخ',
      'اسم الطالب',
      'حالة الحضور',
      'ملاحظات الغياب أو التأخر'
    ];

    const rows = attendance.map(a => [
      a.date,
      studentMap.get(a.studentId)?.name || 'طالب غير محدد',
      a.status,
      a.note || ''
    ]);

    const valuesToInsert = [headers, ...rows];

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:D${valuesToInsert.length}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          range: `A1:D${valuesToInsert.length}`,
          majorDimension: 'ROWS',
          values: valuesToInsert
        })
      }
    );

    try {
      await this.moveDriveFileToSectionFolder(spreadsheetId, 'attendance', complexKey, complexName, token);
    } catch (moveErr) {
      console.warn('Could not move exported attendance sheet into Complex Attendance folder:', moveErr);
    }

    return { spreadsheetId, spreadsheetUrl };
  }

  // Export Complete Multi-Tab Platform Backup to Google Sheets
  static async exportFullPlatformBackupToGoogleSheet(
    backup: FullBackupData,
    tokenOverride?: string
  ): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
    const token = tokenOverride || (await this.getValidAccessToken());
    if (!token) {
      throw new Error('يرجى ربط وتفويض حساب Google أولاً لتصدير النسخة الاحتياطية إلى Google Sheets.');
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const createSheetRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          title: `نسخة احتياطية شاملة - منصة عُمْرَان القرآنية (${dateStr})`
        },
        sheets: [
          {
            properties: {
              title: 'الطلاب',
              gridProperties: { frozenRowCount: 1 },
              rightToLeft: true
            }
          },
          {
            properties: {
              title: 'الحضور والغياب',
              gridProperties: { frozenRowCount: 1 },
              rightToLeft: true
            }
          },
          {
            properties: {
              title: 'التسميع والتقييمات',
              gridProperties: { frozenRowCount: 1 },
              rightToLeft: true
            }
          },
          {
            properties: {
              title: 'الاختبارات',
              gridProperties: { frozenRowCount: 1 },
              rightToLeft: true
            }
          },
          {
            properties: {
              title: 'تسليمات الاختبارات',
              gridProperties: { frozenRowCount: 1 },
              rightToLeft: true
            }
          }
        ]
      })
    });

    if (!createSheetRes.ok) {
      const err = await createSheetRes.json().catch(() => ({}));
      const errMsg = err?.error?.message || (await createSheetRes.text().catch(() => ''));
      throw new Error(`تعذر إنشاء جدول النسخة الاحتياطية: ${errMsg || 'خطأ غير معروف'}`);
    }

    const sheetData = await createSheetRes.json();
    const spreadsheetId = sheetData.spreadsheetId;
    const spreadsheetUrl = sheetData.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    // 1. Populate Students Sheet
    const studentHeaders = ['المعرف', 'الاسم', 'الحلقة', 'رقم الهاتف', 'هاتف ولي الأمر', 'المستوى'];
    const studentRows = (backup.students || []).map(s => [
      s.id,
      s.name,
      s.halaqahName || s.halaqahId || '',
      s.phone || '',
      s.parentPhones?.join(', ') || '',
      s.level || ''
    ]);
    const studentValues = [studentHeaders, ...studentRows];

    // 2. Populate Attendance Sheet
    const attHeaders = ['المعرف', 'التاريخ', 'معرف الطالب', 'الحالة', 'ملاحظات'];
    const attRows = (backup.attendance || []).map(a => [
      a.id,
      a.date,
      a.studentId,
      a.status,
      a.note || ''
    ]);
    const attValues = [attHeaders, ...attRows];

    // 3. Populate Evaluations Sheet
    const evalHeaders = ['المعرف', 'التاريخ', 'معرف الطالب', 'التسميع الجديد', 'المراجعة', 'ملاحظات المعلم'];
    const evalRows = (backup.evaluations || []).map(e => [
      e.id,
      e.date,
      e.studentId,
      e.recitationDetails?.newMemorizationAchieved || '',
      e.recitationDetails?.reviewAchieved || '',
      e.recitationDetails?.teacherNotes || ''
    ]);
    const evalValues = [evalHeaders, ...evalRows];

    // 4. Populate Exams Sheet
    const examHeaders = ['المعرف', 'عنوان الاختبار', 'النمط', 'إجمالي الدرجات', 'رابط Google Form', 'رابط Google Sheet'];
    const examRows = (backup.exams || []).map(ex => [
      ex.id,
      ex.title,
      ex.deliveryMode === 'google_form' ? 'Google Forms' : 'منصة عمران',
      ex.totalPoints,
      ex.googleFormResponderUrl || ex.googleFormUrl || '',
      ex.googleSpreadsheetUrl || ''
    ]);
    const examValues = [examHeaders, ...examRows];

    // 5. Populate Submissions Sheet
    const subHeaders = ['المعرف', 'عنوان الاختبار', 'اسم الطالب', 'المحاولة', 'الدرجة', 'النسبة', 'التاريخ'];
    const subRows = (backup.submissions || []).map(sub => [
      sub.id,
      sub.examTitle,
      sub.studentName,
      sub.attemptNumber,
      `${sub.totalScoreEarned} / ${sub.maxPossibleScore}`,
      `${sub.percentage}%`,
      sub.submittedAt
    ]);
    const subValues = [subHeaders, ...subRows];

    // Write all sheets in parallel
    await Promise.all([
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'الطلاب'!A1:G${studentValues.length}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ range: `'الطلاب'!A1:G${studentValues.length}`, majorDimension: 'ROWS', values: studentValues })
      }),
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'الحضور والغياب'!A1:E${attValues.length}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ range: `'الحضور والغياب'!A1:E${attValues.length}`, majorDimension: 'ROWS', values: attValues })
      }),
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'التسميع والتقييمات'!A1:F${evalValues.length}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ range: `'التسميع والتقييمات'!A1:F${evalValues.length}`, majorDimension: 'ROWS', values: evalValues })
      }),
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'الاختبارات'!A1:F${examValues.length}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ range: `'الاختبارات'!A1:F${examValues.length}`, majorDimension: 'ROWS', values: examValues })
      }),
      fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'تسليمات الاختبارات'!A1:G${subValues.length}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ range: `'تسليمات الاختبارات'!A1:G${subValues.length}`, majorDimension: 'ROWS', values: subValues })
      })
    ]);

    return { spreadsheetId, spreadsheetUrl };
  }

  /**
   * Export JSON Backup directly into Google Drive in a dedicated timestamped file
   * (النسخ الاحتياطي في Google Drive مع التاريخ والساعة في مجلد مخصص للمجمع)
   */
  static async exportBackupToGoogleDrive(
    backup: FullBackupData,
    authConfig?: GoogleOAuthConfig,
    complexId?: string | null
  ): Promise<{ fileId: string; fileName: string; folderName: string; webViewLink: string }> {
    const complexKey = this.resolveComplexKey(complexId || authConfig?.complexId);
    const token = await this.getValidAccessToken(complexKey);
    if (!token) {
      throw new Error('حساب Google غير متصل لهذا المجمع أو انتهت صلاحية الجلسة. يرجى ربط حساب Google أولاً.');
    }

    const folderName = authConfig?.complexName
      ? `نسخ احتياطية - ${authConfig.complexName}`
      : 'نسخ منصة عمران القرآنية الاحتياطية';

    const folderInfo = await this.findOrCreateDriveFolder(
      token,
      folderName,
      undefined,
      'مجلد مخصص لحفظ النسخ الاحتياطية لمنصة عمران القرآنية'
    );

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timeFormatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
    const fileName = `omran_backup_${timeFormatted}.json`;

    const metadata = {
      name: fileName,
      parents: [folderInfo.id],
      mimeType: 'application/json',
      description: `نسخة احتياطية كاملة لمنصة عمران القرآنية تم تصديرها بتاريخ ${now.toLocaleString('ar-SA')}`
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;
    const jsonContent = JSON.stringify(backup, null, 2);

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      jsonContent +
      closeDelimiter;

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartRequestBody
      }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}));
      throw new Error(`فشل رفع النسخة الاحتياطية إلى Google Drive: ${err?.error?.message || uploadRes.statusText}`);
    }

    const uploadData = await uploadRes.json();
    const fileId = uploadData.id;
    const webViewLink = uploadData.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

    return {
      fileId,
      fileName,
      folderName,
      webViewLink
    };
  }

  /**
   * Upload PDF document or custom report directly to Google Drive (inside Complex's structured folder)
   */
  static async uploadPDFToDrive(
    pdfBlob: Blob,
    fileName: string,
    folderName: string = 'التقارير الدورية',
    complexId?: string | null,
    complexName?: string
  ): Promise<{ fileId: string; fileName: string; folderName: string; webViewLink: string }> {
    const complexKey = this.resolveComplexKey(complexId);
    const token = await this.getValidAccessToken(complexKey);
    if (!token) {
      throw new Error('حساب Google غير متصل لهذا المجمع أو انتهت صلاحية الجلسة. يرجى ربط المكتبة بحساب Google أولاً.');
    }

    let targetFolderId: string | undefined;
    let resolvedFolderName = folderName;

    try {
      const setup = await this.ensureComplexLibraryFolders(complexKey, complexName, token);
      let section: LibraryDriveSection = 'reports';
      if (folderName.includes('شهاد')) section = 'certificates';
      else if (folderName.includes('حضور') || folderName.includes('غياب')) section = 'attendance';
      else if (folderName.includes('اختبار')) section = 'exams';
      const secMeta = setup.sectionFolders[section];
      if (secMeta?.id) {
        targetFolderId = secMeta.id;
        resolvedFolderName = secMeta.name;
      }
    } catch {
      const fallback = await this.findOrCreateDriveFolder(token, folderName);
      targetFolderId = fallback.id;
      resolvedFolderName = fallback.name;
    }

    const cleanFileName = fileName.replace(/[\\/]/g, '-').trim();
    const finalName = cleanFileName.endsWith('.pdf') ? cleanFileName : `${cleanFileName}.pdf`;

    const metadata = {
      name: finalName,
      parents: targetFolderId ? [targetFolderId] : [],
      mimeType: 'application/pdf',
      description: `مستند صادر ومؤرشف من منصة عمران بتاريخ ${new Date().toLocaleString('ar-SA')}`
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadataPart = new Blob(
      [
        delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          'Content-Type: application/pdf\r\n\r\n'
      ],
      { type: 'text/plain' }
    );

    const closePart = new Blob([closeDelimiter], { type: 'text/plain' });
    const fullBody = new Blob([metadataPart, pdfBlob, closePart], {
      type: `multipart/related; boundary=${boundary}`
    });

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: fullBody
      }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}));
      throw new Error(`فشل رفع الملف إلى Google Drive: ${err?.error?.message || uploadRes.statusText}`);
    }

    const uploadData = await uploadRes.json();
    const fileId = uploadData.id;
    const webViewLink = uploadData.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;

    return {
      fileId,
      fileName: finalName,
      folderName: resolvedFolderName,
      webViewLink
    };
  }

  // ============================================================================
  // COMPLEX GOOGLE DRIVE LIBRARY HIERARCHY & SYNCHRONIZATION
  // ============================================================================

  static resolveDocSection(docItem: Partial<LibraryDocument>): LibraryDriveSection {
    if (docItem.sectionCategory) return docItem.sectionCategory;
    switch (docItem.type) {
      case 'certificate':
        return 'certificates';
      case 'attendance_sheet':
        return 'attendance';
      case 'google_form':
      case 'google_sheet':
      case 'exam_archive':
        return 'exams';
      case 'pdf_report':
        return 'reports';
      default:
        return 'general';
    }
  }

  static getSectionArabicTitle(section: LibraryDriveSection): string {
    return DRIVE_SECTION_NAMES[section] || 'ملفات عامة';
  }

  private static async isDriveFolderAlive(token: string, folderId: string): Promise<boolean> {
    if (!folderId) return false;
    try {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(folderId)}?fields=id,trashed`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) return false;
      const data = await res.json();
      return Boolean(data.id) && !data.trashed;
    } catch {
      return false;
    }
  }

  static async findOrCreateDriveFolder(
    token: string,
    folderName: string,
    parentId?: string,
    description?: string
  ): Promise<DriveSectionFolderMeta> {
    const escapedName = folderName.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const parentClause = parentId ? ` and '${parentId}' in parents` : '';
    const q = `mimeType='application/vnd.google-apps.folder' and name='${escapedName}'${parentClause} and trashed=false`;

    try {
      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)&pageSize=5`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (Array.isArray(searchData.files) && searchData.files.length > 0) {
          const f = searchData.files[0];
          return {
            id: f.id,
            name: f.name || folderName,
            webViewLink: f.webViewLink || `https://drive.google.com/drive/folders/${f.id}`
          };
        }
      }
    } catch (e) {
      console.warn('Drive folder search notice:', e);
    }

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        ...(parentId ? { parents: [parentId] } : {}),
        description: description || `مجلد أرشيف ومكتبة منصة عمران القرآنية - ${folderName}`
      })
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      throw new Error(`تعذر إنشاء مجلد "${folderName}" على Google Drive: ${err?.error?.message || createRes.statusText}`);
    }

    const created = await createRes.json();
    return {
      id: created.id,
      name: created.name || folderName,
      webViewLink: created.webViewLink || `https://drive.google.com/drive/folders/${created.id}`
    };
  }

  /**
   * Ensures the Complex's root Library folder ("مكتبة <اسم المجمع>") and all 5 organized section folders
   * ("الشهادات", "الحضور والغياب", "الاختبارات", "التقارير الدورية", "ملفات عامة") exist on Google Drive.
   */
  static async ensureComplexLibraryFolders(
    complexId?: string | null,
    complexName?: string,
    tokenOverride?: string
  ): Promise<{
    rootFolder: DriveSectionFolderMeta;
    sectionFolders: Record<LibraryDriveSection, DriveSectionFolderMeta>;
  }> {
    const complexKey = this.resolveComplexKey(complexId);
    const config = await this.loadGoogleAuthConfig(complexKey);
    const token = tokenOverride || (await this.getValidAccessToken(complexKey));
    if (!token) {
      throw new Error('يرجى ربط حساب Google الخاص بالمجمع لتفعيل مجلدات المكتبة على Google Drive.');
    }

    const resolvedComplexTitle = (complexName || config.complexName || 'المجمع القرآني').trim();
    const rootFolderName = resolvedComplexTitle.startsWith('مكتبة')
      ? resolvedComplexTitle
      : `مكتبة ${resolvedComplexTitle}`;

    const allSections: LibraryDriveSection[] = ['certificates', 'attendance', 'exams', 'reports', 'general'];

    // Fast path: check if root folder and all 5 section folders are already cached & alive
    if (config.driveRootFolderId && config.driveSectionFolders) {
      const hasAllCached = allSections.every(sec => Boolean(config.driveSectionFolders?.[sec]?.id));
      if (hasAllCached && (await this.isDriveFolderAlive(token, config.driveRootFolderId))) {
        return {
          rootFolder: {
            id: config.driveRootFolderId,
            name: config.driveRootFolderName || rootFolderName,
            webViewLink:
              config.driveRootFolderUrl || `https://drive.google.com/drive/folders/${config.driveRootFolderId}`
          },
          sectionFolders: config.driveSectionFolders as Record<LibraryDriveSection, DriveSectionFolderMeta>
        };
      }
    }

    // Create or locate Root Folder on Google Drive
    const rootFolder = await this.findOrCreateDriveFolder(
      token,
      rootFolderName,
      undefined,
      `المكتبة والأرشيف السحابي الرسمي لـ ${resolvedComplexTitle}`
    );

    // Create or locate each Section Folder inside the Root Folder in parallel
    const sectionEntries = await Promise.all(
      allSections.map(async sec => {
        const secTitle = DRIVE_SECTION_NAMES[sec];
        const folderMeta = await this.findOrCreateDriveFolder(
          token,
          secTitle,
          rootFolder.id,
          `قسم ${secTitle} في ${rootFolderName}`
        );
        return [sec, folderMeta] as const;
      })
    );

    const sectionFolders = Object.fromEntries(sectionEntries) as Record<
      LibraryDriveSection,
      DriveSectionFolderMeta
    >;

    const foldersChanged =
      config.driveRootFolderId !== rootFolder.id ||
      allSections.some(sec => config.driveSectionFolders?.[sec]?.id !== sectionFolders[sec]?.id);

    // Only write to Firestore when folder IDs were newly created or changed (prevents echo subscription loops)
    if (foldersChanged) {
      await this.saveGoogleAuthConfig(
        {
          ...config,
          complexId: complexKey,
          complexName: resolvedComplexTitle,
          isLinked: true,
          driveRootFolderId: rootFolder.id,
          driveRootFolderName: rootFolder.name,
          driveRootFolderUrl: rootFolder.webViewLink,
          driveSectionFolders: sectionFolders
        },
        complexKey
      );
    }

    return { rootFolder, sectionFolders };
  }

  /**
   * Moves an existing Google Drive file (e.g. Google Form or Google Sheet) into the Complex's section folder.
   */
  static async moveDriveFileToSectionFolder(
    fileId: string,
    section: LibraryDriveSection,
    complexId?: string | null,
    complexName?: string,
    tokenOverride?: string
  ): Promise<{ fileId: string; folderId: string; folderName: string; webViewLink: string }> {
    const complexKey = this.resolveComplexKey(complexId);
    const token = tokenOverride || (await this.getValidAccessToken(complexKey));
    if (!token) {
      throw new Error('يرجى ربط المكتبة بحساب Google أولاً.');
    }

    const { sectionFolders } = await this.ensureComplexLibraryFolders(complexKey, complexName, token);
    const targetFolder = sectionFolders[section] || sectionFolders.general;

    let previousParents = '';
    try {
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,parents,webViewLink`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (metaRes.ok) {
        const meta = await metaRes.json();
        if (Array.isArray(meta.parents) && !meta.parents.includes(targetFolder.id)) {
          previousParents = meta.parents.join(',');
        } else if (Array.isArray(meta.parents) && meta.parents.includes(targetFolder.id)) {
          return {
            fileId,
            folderId: targetFolder.id,
            folderName: targetFolder.name,
            webViewLink: meta.webViewLink || `https://drive.google.com/file/d/${fileId}/view`
          };
        }
      }
    } catch {
      // Proceed with addParents only
    }

    const queryParams = new URLSearchParams({
      addParents: targetFolder.id,
      fields: 'id,name,webViewLink'
    });
    if (previousParents) {
      queryParams.set('removeParents', previousParents);
    }

    const patchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${queryParams.toString()}`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    let webViewLink = `https://drive.google.com/file/d/${fileId}/view`;
    if (patchRes.ok) {
      const patched = await patchRes.json();
      if (patched.webViewLink) webViewLink = patched.webViewLink;
    }

    return {
      fileId,
      folderId: targetFolder.id,
      folderName: targetFolder.name,
      webViewLink
    };
  }

  private static buildRtlHtmlDocument(title: string, bodyContent: string, complexName?: string): string {
    const trimmed = (bodyContent || '').trim();
    if (trimmed.toLowerCase().includes('<html') || trimmed.toLowerCase().includes('<!doctype')) {
      return trimmed;
    }
    return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    body {
      font-family: 'Tajawal', 'Cairo', 'Amiri', system-ui, sans-serif;
      direction: rtl;
      background: #f8fafc;
      color: #0f172a;
      padding: 32px;
      line-height: 1.8;
    }
    .card {
      max-width: 900px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 24px;
      border: 2px solid #e2e8f0;
      padding: 32px;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06);
    }
    .header {
      border-bottom: 2px solid #10b981;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    h1 { margin: 0 0 8px 0; color: #064e3b; font-size: 24px; }
    .meta { color: #64748b; font-size: 13px; }
    .content { white-space: pre-wrap; font-size: 15px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>${title}</h1>
      <div class="meta">${complexName || 'المجمع القرآني'} • تاريخ الأرشفة: ${new Date().toLocaleString('ar-SA')}</div>
    </div>
    <div class="content">${trimmed}</div>
  </div>
</body>
</html>`;
  }

  /**
   * Uploads or moves any LibraryDocument into its matching section folder on the Complex's Google Drive
   * ("الشهادات", "الحضور والغياب", "الاختبارات", "التقارير الدورية", "ملفات عامة") and returns the Drive-enriched document.
   */
  static async uploadLibraryDocumentToComplexDrive(params: {
    doc: LibraryDocument;
    blob?: Blob;
    htmlContent?: string;
    mimeType?: string;
    fileExtension?: string;
    complexId?: string | null;
    complexName?: string;
    tokenOverride?: string;
  }): Promise<LibraryDocument> {
    const complexKey = this.resolveComplexKey(params.complexId || params.doc.complexId);
    let token = params.tokenOverride || (await this.getValidAccessToken(complexKey));
    if (!token) {
      // If complex is marked linked in Firestore, re-authorize interactively with Google to obtain fresh session token
      const cfg = await this.loadGoogleAuthConfig(complexKey);
      if (cfg.isLinked) {
        const relink = await this.linkGoogleAccount(complexKey, params.complexName || cfg.complexName);
        token = relink.accessToken;
      }
    }

    if (!token) {
      throw new Error('LIBRARY_NOT_LINKED');
    }

    const section = this.resolveDocSection(params.doc);
    const { sectionFolders } = await this.ensureComplexLibraryFolders(complexKey, params.complexName, token);
    const targetFolder = sectionFolders[section] || sectionFolders.general;

    // Case 1: Existing Google Form or Google Sheet (already on Google Drive) without binary blob upload
    const existingNativeId =
      params.doc.driveFileId || params.doc.googleSpreadsheetId || params.doc.googleFormId;
    if (existingNativeId && !params.blob && !params.htmlContent && !params.doc.htmlContent) {
      const moved = await this.moveDriveFileToSectionFolder(
        existingNativeId,
        section,
        complexKey,
        params.complexName,
        token
      );
      const finalUrl = params.doc.googleUrl || moved.webViewLink;
      return {
        ...params.doc,
        complexId: complexKey,
        sectionCategory: section,
        driveFileId: moved.fileId,
        driveFolderId: moved.folderId,
        driveFolderName: moved.folderName,
        driveWebViewLink: finalUrl,
        googleUrl: finalUrl
      };
    }

    // Case 2: Upload file (PDF Certificate, Attendance Sheet, Report, Custom Document) directly into Target Section Folder
    let uploadBlob: Blob;
    let resolvedMime = params.mimeType || 'text/html';
    let resolvedExt = params.fileExtension || '';

    if (params.blob) {
      uploadBlob = params.blob;
      resolvedMime = params.mimeType || params.blob.type || 'application/pdf';
      if (!resolvedExt) {
        if (resolvedMime.includes('pdf')) resolvedExt = '.pdf';
        else if (resolvedMime.includes('spreadsheet') || resolvedMime.includes('excel')) resolvedExt = '.xlsx';
        else if (resolvedMime.includes('html')) resolvedExt = '.html';
        else resolvedExt = '.pdf';
      }
    } else {
      const rawHtml =
        params.htmlContent ||
        params.doc.htmlContent ||
        this.buildRtlHtmlDocument(
          params.doc.title,
          params.doc.description || params.doc.title,
          params.complexName
        );
      const fullHtml = this.buildRtlHtmlDocument(params.doc.title, rawHtml, params.complexName);
      uploadBlob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
      resolvedMime = 'text/html';
      resolvedExt = '.html';
    }

    const sanitizedTitle = (params.doc.title || 'مستند محفوظ')
      .replace(/[\\/:*?"<>|]/g, ' - ')
      .replace(/\s+/g, ' ')
      .trim();

    const fileName = sanitizedTitle.toLowerCase().endsWith(resolvedExt.toLowerCase())
      ? sanitizedTitle
      : `${sanitizedTitle}${resolvedExt}`;

    const metadata = {
      name: fileName,
      parents: [targetFolder.id],
      mimeType: resolvedMime,
      description:
        params.doc.description ||
        `محفوظ في قسم (${targetFolder.name}) عبر منصة عمران القرآنية - ${params.complexName || ''}`
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadataPart = new Blob(
      [
        delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          `Content-Type: ${resolvedMime}\r\n\r\n`
      ],
      { type: 'text/plain' }
    );
    const closePart = new Blob([closeDelimiter], { type: 'text/plain' });
    const multipartBody = new Blob([metadataPart, uploadBlob, closePart], {
      type: `multipart/related; boundary=${boundary}`
    });

    const uploadRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: multipartBody
      }
    );

    if (!uploadRes.ok) {
      const err = await uploadRes.json().catch(() => ({}));
      throw new Error(`فشل حفظ الملف على Google Drive: ${err?.error?.message || uploadRes.statusText}`);
    }

    const uploaded = await uploadRes.json();
    const driveFileId = uploaded.id as string;
    const webViewLink =
      uploaded.webViewLink || `https://drive.google.com/file/d/${driveFileId}/view`;

    return {
      ...params.doc,
      complexId: complexKey,
      sectionCategory: section,
      driveFileId,
      driveFolderId: targetFolder.id,
      driveFolderName: targetFolder.name,
      driveWebViewLink: webViewLink,
      driveMimeType: uploaded.mimeType || resolvedMime,
      googleUrl: webViewLink
    };
  }

  /**
   * Fetches all Library files directly from the Complex's Google Drive folders so the Library reflects real Drive state.
   */
  static async fetchComplexDriveLibraryDocuments(
    complexId?: string | null,
    complexName?: string
  ): Promise<{ driveDocs: LibraryDocument[]; config: GoogleOAuthConfig; needsSessionAuth?: boolean }> {
    const complexKey = this.resolveComplexKey(complexId);
    const config = await this.loadGoogleAuthConfig(complexKey);
    if (!config.isLinked) {
      return { driveDocs: [], config };
    }

    const token = await this.getValidAccessToken(complexKey);
    if (!token) {
      return { driveDocs: [], config, needsSessionAuth: true };
    }

    const allSections: LibraryDriveSection[] = ['certificates', 'attendance', 'exams', 'reports', 'general'];
    const hasCachedFolders =
      Boolean(config.driveRootFolderId) &&
      Boolean(config.driveSectionFolders) &&
      allSections.every(sec => Boolean(config.driveSectionFolders?.[sec]?.id));

    let rootFolder: DriveSectionFolderMeta;
    let sectionFolders: Record<LibraryDriveSection, DriveSectionFolderMeta>;

    if (hasCachedFolders && config.driveRootFolderId && config.driveSectionFolders) {
      rootFolder = {
        id: config.driveRootFolderId,
        name: config.driveRootFolderName || `مكتبة ${complexName || config.complexName || 'المجمع القرآني'}`,
        webViewLink:
          config.driveRootFolderUrl || `https://drive.google.com/drive/folders/${config.driveRootFolderId}`
      };
      sectionFolders = config.driveSectionFolders as Record<LibraryDriveSection, DriveSectionFolderMeta>;
    } else {
      const ensured = await this.ensureComplexLibraryFolders(
        complexKey,
        complexName || config.complexName,
        token
      );
      rootFolder = ensured.rootFolder;
      sectionFolders = ensured.sectionFolders;
    }

    const folderIdToSection = new Map<string, { section: LibraryDriveSection; name: string }>();
    (Object.keys(sectionFolders) as LibraryDriveSection[]).forEach(sec => {
      const meta = sectionFolders[sec];
      if (meta?.id) {
        folderIdToSection.set(meta.id, { section: sec, name: meta.name });
      }
    });

    const parentIds = [rootFolder.id, ...Array.from(folderIdToSection.keys())].filter(Boolean);
    if (parentIds.length === 0) {
      return { driveDocs: [], config };
    }

    const parentsQuery = parentIds.map(id => `'${id}' in parents`).join(' or ');
    const q = `(${parentsQuery}) and mimeType != 'application/vnd.google-apps.folder' and trashed = false`;

    const listRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,webViewLink,createdTime,modifiedTime,parents,description)&orderBy=createdTime desc&pageSize=200`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!listRes.ok) {
      return { driveDocs: [], config };
    }

    const data = await listRes.json();
    const files: any[] = Array.isArray(data.files) ? data.files : [];

    const driveDocs: LibraryDocument[] = files.map(file => {
      const parentId = Array.isArray(file.parents) ? file.parents[0] : rootFolder.id;
      const folderInfo = folderIdToSection.get(parentId) || {
        section: 'general' as LibraryDriveSection,
        name: rootFolder.name
      };

      let docType: LibraryDocumentType = 'custom_note';
      const mime = String(file.mimeType || '');
      if (mime === 'application/vnd.google-apps.spreadsheet') {
        docType = folderInfo.section === 'attendance' ? 'attendance_sheet' : 'google_sheet';
      } else if (folderInfo.section === 'certificates') {
        docType = 'certificate';
      } else if (folderInfo.section === 'attendance') {
        docType = 'attendance_sheet';
      } else if (folderInfo.section === 'exams') {
        docType = 'exam_archive';
      } else if (folderInfo.section === 'reports' || mime.includes('pdf')) {
        docType = 'pdf_report';
      }

      const rawName = String(file.name || 'ملف محفوظ في Drive').replace(/\.(pdf|html|xlsx|json)$/i, '');
      const webViewLink = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;

      return {
        id: `drive_${file.id}`,
        complexId: complexKey,
        title: rawName,
        type: docType,
        sectionCategory: folderInfo.section,
        description: file.description || `محفوظ في Google Drive داخل مجلد (${folderInfo.name})`,
        googleSpreadsheetId: mime === 'application/vnd.google-apps.spreadsheet' ? file.id : undefined,
        googleUrl: webViewLink,
        driveFileId: file.id,
        driveFolderId: parentId,
        driveFolderName: folderInfo.name,
        driveWebViewLink: webViewLink,
        driveMimeType: mime,
        createdBy: config.connectedEmail || 'Google Drive',
        createdAt: file.createdTime || file.modifiedTime || new Date().toISOString()
      };
    });

    return { driveDocs, config };
  }

  /**
   * Deletes a file from the Complex's Google Drive when confirmed by the user.
   */
  static async deleteLibraryFileFromDrive(
    driveFileId: string,
    complexId?: string | null
  ): Promise<boolean> {
    if (!driveFileId) return false;
    const complexKey = this.resolveComplexKey(complexId);
    const token = await this.getValidAccessToken(complexKey);
    if (!token) return false;

    try {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      return res.ok || res.status === 204 || res.status === 404;
    } catch (e) {
      console.warn('Could not delete file from Google Drive:', e);
      return false;
    }
  }
}
