/**
 * Portal Email & Verification Service for Omran Platform
 * Handles:
 * 1. Strict Disposable / Temporary Email Detection
 * 2. OTP Code Generation and Verification
 * 3. Branded Complex-themed Email Notification Generator
 * 4. In-App Notification and Interactive Email Simulation from support@omran.com
 */

import { QuranComplex, StudentRegistrationApplication } from '../types';
import { darkenHex, lightenHex } from './themeUtils';

// Comprehensive list of known disposable / throwaway / temporary email domains
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  '10minutemail.com',
  '10minutemail.net',
  'tempmail.com',
  'temp-mail.org',
  'temp-mail.io',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'sharklasers.com',
  'grr.la',
  'mailinator.com',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'throwawaymail.com',
  'trashmail.com',
  'trashmail.net',
  'trashmail.org',
  'getairmail.com',
  'mohmal.com',
  'dispostable.com',
  'fakeinbox.com',
  'mytemp.email',
  'crazymailing.com',
  'nada.ltd',
  'getnada.com',
  'emailondeck.com',
  'maildrop.cc',
  'inboxkitten.com',
  'burnermail.io',
  'dropmail.me',
  'fakemailgenerator.com',
  'generator.email',
  'fakemail.net',
  'tempinbox.com',
  'disposablemail.com',
  'minuteinbox.com',
  'crazymail.com',
  'meltmail.com',
  'spambog.com',
  'mailnesia.com',
  'tempmailaddress.com',
  'temporarymail.com',
  'binkmail.com',
  'bobmail.info',
  'chacuo.net',
  'devnullmail.com',
  'easytrashmail.com',
  'fastmail.fm',
  'filzmail.com',
  'incognitomail.org',
  'kasmail.com',
  'maileater.com',
  'mailcatch.com',
  'mailforspam.com',
  'mytrashmail.com',
  'no-spam.ws',
  'nospam4.us',
  'onewaymail.com',
  'pookmail.com',
  'safetymail.info',
  'sogetthis.com',
  'soodonims.com',
  'spamavert.com',
  'spambox.us',
  'spamcannibal.org',
  'spamcon.org',
  'spamgourmet.com',
  'spamhole.com',
  'suremail.info',
  'tagmail.com',
  'tempemail.net',
  'tempspam.com',
  'trashymail.com',
  'zippymail.info'
]);

// Patterns matching common temporary email patterns
const DISPOSABLE_PATTERNS = [
  /temp.*mail/i,
  /fake.*mail/i,
  /throw.*away/i,
  /trash.*mail/i,
  /dispos/i,
  /10minute/i,
  /guerrilla/i,
  /mailinator/i,
  /sharklaser/i,
  /yopmail/i,
  /mohmal/i
];

/**
 * Validates whether an email is valid and NOT from a disposable temporary email provider
 */
export function validateEmailAuthenticity(email: string): {
  isValid: boolean;
  isDisposable: boolean;
  error?: string;
  domain?: string;
} {
  const clean = String(email || '').trim().toLowerCase();

  // 1. Basic RFC syntax check
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!clean || !emailRegex.test(clean)) {
    return {
      isValid: false,
      isDisposable: false,
      error: 'يرجى إدخال عنوان بريد إلكتروني صحيح ومكتمل (مثال: name@gmail.com).'
    };
  }

  const parts = clean.split('@');
  if (parts.length !== 2) {
    return { isValid: false, isDisposable: false, error: 'صيغة البريد الإلكتروني غير صحيحة.' };
  }

  const domain = parts[1];

  // 2. Check blacklist of disposable domains
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return {
      isValid: false,
      isDisposable: true,
      domain,
      error: 'عذراً، هذا البريد مؤقت وغير صالح. يرجى إدخال بريد إلكتروني حقيقي وثابت لضمان وصول إشعارات القبول والمتابعة.'
    };
  }

  // 3. Check pattern matching
  for (const pattern of DISPOSABLE_PATTERNS) {
    if (pattern.test(domain)) {
      return {
        isValid: false,
        isDisposable: true,
        domain,
        error: 'عذراً، تم حظر هذا النطاق لأنه يوفر بريداً مؤقتاً. يرجى استخدام بريد إلكتروني رسمي ودائم (مثل Gmail أو Outlook أو iCloud).'
      };
    }
  }

  return { isValid: true, isDisposable: false, domain };
}

// In-memory / session store for OTP codes with expiration
interface OtpEntry {
  email: string;
  code: string;
  expiresAt: number;
  attempts: number;
}

const OTP_CACHE_KEY = 'omran_portal_active_otps';

function getOtpStore(): Record<string, OtpEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = sessionStorage.getItem(OTP_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveOtpStore(store: Record<string, OtpEntry>) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(OTP_CACHE_KEY, JSON.stringify(store));
  } catch {}
}

/**
 * Generates a 6-digit numeric OTP code for the given email
 */
export function generateEmailOtp(email: string): string {
  const cleanEmail = email.trim().toLowerCase();
  // Generate random 6 digits (e.g. 849201)
  const code = Math.floor(100000 + Math.random() * 900000).toString();

  const store = getOtpStore();
  store[cleanEmail] = {
    email: cleanEmail,
    code,
    expiresAt: Date.now() + 10 * 60 * 1000, // Valid for 10 minutes
    attempts: 0
  };
  saveOtpStore(store);

  return code;
}

/**
 * Verifies an entered OTP code for an email
 */
export function verifyEmailOtp(email: string, enteredCode: string): {
  success: boolean;
  error?: string;
} {
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = enteredCode.trim().replace(/\D/g, '');

  const store = getOtpStore();
  const entry = store[cleanEmail];

  if (!entry) {
    return {
      success: false,
      error: 'لم يتم العثور على رمز تحقق نشط لهذا البريد. يرجى طلب رمز جديد.'
    };
  }

  if (Date.now() > entry.expiresAt) {
    delete store[cleanEmail];
    saveOtpStore(store);
    return {
      success: false,
      error: 'انتهت صلاحية رمز التحقق (أكثر من 10 دقائق). يرجى طلب رمز جديد.'
    };
  }

  if (entry.attempts >= 5) {
    delete store[cleanEmail];
    saveOtpStore(store);
    return {
      success: false,
      error: 'تم تجاوز الحد الأقصى للمحاولات الخاطئة. يرجى طلب رمز جديد.'
    };
  }

  if (entry.code !== cleanCode) {
    entry.attempts += 1;
    saveOtpStore(store);
    return {
      success: false,
      error: `رمز التحقق غير صحيح. متبقي لك ${5 - entry.attempts} محاولات.`
    };
  }

  // Verification succeeded - remove used OTP
  delete store[cleanEmail];
  saveOtpStore(store);

  return { success: true };
}

export interface BrandedEmailPayload {
  toEmail: string;
  fromEmail: string;
  subject: string;
  title: string;
  greeting: string;
  bodyParagraphs: string[];
  highlightBox?: {
    label: string;
    value: string;
    sublabel?: string;
  };
  badgeText?: string;
  actionButton?: {
    text: string;
    url: string;
  };
  footerNote: string;
  sentAt: string;
  complexName: string;
  complexTheme?: QuranComplex['theme'];
}

/**
 * Builds the OTP Verification Email with the Complex's Theme
 */
export function buildOtpVerificationEmail(
  complex: QuranComplex,
  toEmail: string,
  otpCode: string
): BrandedEmailPayload {
  return {
    toEmail,
    fromEmail: 'support@omran.com',
    subject: `رمز التحقق لتسجيل حسابك في ${complex.name} [${otpCode}]`,
    title: `توثيق البريد الإلكتروني • ${complex.name}`,
    greeting: `السلام عليكم ورحمة الله وبركاته،`,
    bodyParagraphs: [
      `أهلاً بك في بوابة التسجيل والخدمات الإلكترونية لمجمع ${complex.name}.`,
      `لإتمام توثيق بريدك الإلكتروني والبدء في تقديم طلب الانضمام إلى حلقات القرآن الكريم، يرجى استخدام رمز التحقق التالي:`
    ],
    highlightBox: {
      label: 'رمز التحقق المعتمد (صالح لمدة 10 دقائق)',
      value: otpCode,
      sublabel: 'يرجى كتابة هذا الرمز في خانة التحقق بالاستمارة'
    },
    badgeText: 'توثيق حساب إلكتروني معتمد',
    footerNote: `هذه رسالة آلية صادرة من منظومة عُمْرَان لإدارة المجمعات والحلقات القرآنية لصالح مجمع ${complex.name}. إذا لم تكن أنت من طلب التسجيل، يمكنك تجاهل هذه الرسالة.`,
    sentAt: new Date().toISOString(),
    complexName: complex.name,
    complexTheme: complex.theme
  };
}

/**
 * Builds the Application Received Email with Queue Position & Tracking Info
 */
export function buildApplicationReceivedEmail(
  complex: QuranComplex,
  application: StudentRegistrationApplication,
  portalUrl: string
): BrandedEmailPayload {
  const queueNo = application.queueNumber || 1;
  const ahead = application.pendingAheadCount !== undefined ? application.pendingAheadCount : Math.max(0, queueNo - 1);

  return {
    toEmail: application.email || '',
    fromEmail: 'support@omran.com',
    subject: `تم استلام طلب انضمامك في ${complex.name} • رقم المتابعة [${application.trackingCode}]`,
    title: `تأكيد استلام طلب الانضمام • ${complex.name}`,
    greeting: `حياك الله وبياك أخي ولي أمر الطالب / ${application.studentName} حفظه الله ورعاه..`,
    bodyParagraphs: [
      `يسر إدارة مجمع ${complex.name} إبلاغكم بأنه تم استلام طلب انضمام ابنكم المبارك بنجاح إلى حلقات القرآن الكريم.`,
      `طلبكم الآن مدرج في قائمة المراجعة والفرز التربوي لدى المشرف التعليمي للمجمع، وسيتم دراسته وتسكينه في الحلقة الأنسب لمستواه وحفظه بإذن الله.`
    ],
    highlightBox: {
      label: 'ترتيبك في الدور وقائمة المراجعة:',
      value: `الترتيب رقم #${queueNo}`,
      sublabel: ahead > 0 ? `يوجد ${ahead} طلبات قبلك قيد المراجعة` : 'طلبك في مقدمة قائمة المراجعة الحالية'
    },
    badgeText: `رقم متابعة الطلب: ${application.trackingCode}`,
    actionButton: {
      text: 'متابعة وتفقد حالة الطلب مباشرة عبر الرابط',
      url: `${portalUrl}&track=${application.trackingCode}`
    },
    footerNote: `مجمع ${complex.name} • منظومة عُمْرَان لإدارة الحلقات والمجمعات القرآنية.`,
    sentAt: new Date().toISOString(),
    complexName: complex.name,
    complexTheme: complex.theme
  };
}

/**
 * Builds the Acceptance Notification Email for Student / Parent
 */
export function buildApplicationAcceptedEmail(
  complex: QuranComplex,
  application: StudentRegistrationApplication,
  halaqahName: string,
  portalUrl: string
): BrandedEmailPayload {
  return {
    toEmail: application.email || '',
    fromEmail: 'support@omran.com',
    subject: `🎉 بشرى سارة: تم قبول الطالب ${application.studentName} في ${complex.name}!`,
    title: `بشرى القبول والاعتماد • ${complex.name}`,
    greeting: `السلام عليكم ورحمة الله وبركاته 🌿`,
    bodyParagraphs: [
      `نهنئكم ونسأل الله أن يبارك في ابننا الغالي / ${application.studentName}.`,
      `يسر المشرف التعليمي لمجمع ${complex.name} إبلاغكم بأنه تم اعتماد وقبول طلب انضمامه رسمياً وإلحاقه في:`,
      `📖 الحلقة المعتمدة: ${halaqahName}`,
      `لتثبيت المقعد واستلام بيانات الحلقة والبدء في مسيرة الحفظ المباركة، يرجى الضغط على زر تأكيد القبول بالأسفل ودخول بوابة الطالب.`
    ],
    highlightBox: {
      label: 'الحلقة القرآنية المخصصة:',
      value: halaqahName,
      sublabel: 'في انتظار تأكيد الطالب واستلام المقعد'
    },
    badgeText: 'تم القبول والاعتماد 🎉',
    actionButton: {
      text: 'تأكيد القبول والدخول لحساب الطالب الآن',
      url: `${portalUrl}&track=${application.trackingCode}`
    },
    footerNote: `مع تحيات إدارة ومحفظي مجمع ${complex.name} • منظومة عُمْرَان.`,
    sentAt: new Date().toISOString(),
    complexName: complex.name,
    complexTheme: complex.theme
  };
}

/**
 * Dispatches an active in-app email simulation event so the UI displays
 * an immediate toast/banner notification with copy code & view email button!
 */
export function dispatchPortalEmailNotification(emailPayload: BrandedEmailPayload) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent('omran:portal-email-sent', {
        detail: emailPayload
      })
    );
  } catch (e) {
    console.error('Error dispatching portal email notification:', e);
  }
}
