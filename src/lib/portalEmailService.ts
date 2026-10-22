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
import { ApiConfig } from './apiConfig';

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
  fromEmail?: string;
  mailConfig?: {
    user: string;
    pass: string;
  };
  subject: string;
  title: string;
  greeting: string;
  bodyParagraphs: string[];
  ticketNumber?: string;
  verificationUrl?: string;
  detailsTable?: Array<{ label: string; value: string }>;
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
 * Ensures a portal URL is fully qualified with current protocol and domain
 */
export function ensureAbsolutePortalUrl(rawUrl: string, fallbackComplexId?: string): string {
  if (rawUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))) {
    return rawUrl;
  }
  
  let origin = '';
  if (typeof window !== 'undefined' && window.location?.origin) {
    origin = window.location.origin;
  } else {
    origin = ApiConfig.getBaseUrl() || '';
  }

  let path = rawUrl || (fallbackComplexId ? `/?complexPortal=${encodeURIComponent(fallbackComplexId)}&tab=register` : '/');
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  return origin ? `${origin}${path}` : path;
}

/**
 * Builds the OTP Verification Email with the Complex's Theme
 */
export function buildOtpVerificationEmail(
  complex: QuranComplex,
  toEmail: string,
  otpCode: string,
  portalUrl?: string
): BrandedEmailPayload {
  const directRegistrationUrl = portalUrl
    ? ensureAbsolutePortalUrl(portalUrl)
    : ensureAbsolutePortalUrl(`/?complexPortal=${encodeURIComponent(complex.id)}&tab=register`, complex.id);

  const senderEmail = complex.mailConfig?.fromEmail || complex.mailConfig?.user || 'qdrat2626@gmail.com';

  return {
    toEmail,
    fromEmail: senderEmail,
    mailConfig: complex.mailConfig ? { user: complex.mailConfig.user, pass: complex.mailConfig.pass } : undefined,
    subject: `رمز التحقق لتسجيل حسابك في ${complex.name} [${otpCode}]`,
    title: `توثيق البريد الإلكتروني • ${complex.name}`,
    greeting: `السلام عليكم ورحمة الله وبركاته،`,
    bodyParagraphs: [
      `أهلاً بك في بوابة واستمارة التسجيل الإلكترونية لمجمع ${complex.name}.`,
      `لإتمام توثيق بريدك الإلكتروني والبدء في تقديم طلب الانضمام إلى حلقات القرآن الكريم، يرجى استخدام رمز التحقق التالي:`
    ],
    highlightBox: {
      label: 'رمز التحقق المعتمد (صالح لمدة 10 دقائق)',
      value: otpCode,
      sublabel: 'يرجى كتابة هذا الرمز في خانة التحقق بالاستمارة'
    },
    badgeText: 'توثيق حساب إلكتروني معتمد',
    actionButton: {
      text: `إكمال التسجيل في مجمع ${complex.name} الآن`,
      url: directRegistrationUrl
    },
    footerNote: `هذه رسالة آلية صادرة من منظومة عُمْرَان لإدارة المجمعات والحلقات القرآنية لصالح مجمع ${complex.name}. إذا لم تكن أنت من طلب التسجيل، يمكنك تجاهل هذه الرسالة.`,
    sentAt: new Date().toISOString(),
    complexName: complex.name,
    complexTheme: complex.theme
  };
}

export function buildApplicationReceivedEmail(
  complex: QuranComplex,
  application: StudentRegistrationApplication,
  portalUrl: string
): BrandedEmailPayload {
  const queueNo = application.queueNumber || 1;
  const ahead = application.pendingAheadCount !== undefined ? application.pendingAheadCount : Math.max(0, queueNo - 1);
  const fullPortalUrl = ensureAbsolutePortalUrl(portalUrl);
  const sep = fullPortalUrl.includes('?') ? '&' : '?';
  const directTrackingUrl = `${fullPortalUrl}${sep}track=${encodeURIComponent(application.trackingCode)}`;
  const senderEmail = complex.mailConfig?.fromEmail || complex.mailConfig?.user || 'qdrat2626@gmail.com';

  const detailsTable: Array<{ label: string; value: string }> = [
    { label: 'رقم التذكرة والمتابعة', value: application.trackingCode },
    { label: 'اسم الطالب الثلاثي / الرباعي', value: application.studentName },
    { label: 'العمر', value: `${application.age} سنة` },
    { label: 'ولي الأمر', value: application.parentName || 'ولي الأمر' },
    { label: 'رقم هاتف ولي الأمر', value: application.parentPhone },
    { label: 'البريد الإلكتروني المعتمد', value: application.email || '—' },
    { label: 'حالة توثيق البريد', value: application.isEmailVerified ? 'تم التوثيق برمز التحقق (OTP) بنجاح ✅' : 'مقدم برمز التحقق' },
    {
      label: 'مقدار الحفظ الحالي',
      value: application.memorizedJuzList && application.memorizedJuzList.length > 0
        ? `${application.memorizedJuzList.length} أجزاء من القرآن الكريم`
        : 'بداية مشوار الحفظ المبارك'
    },
    { label: 'الحلقة المرشحة / التوجيه', value: application.preferredHalaqahName || 'توجيه المشرف المباشر' },
    { label: 'ترتيبك في الدور وقائمة الفرز', value: `رقم #${queueNo} (${ahead > 0 ? `${ahead} طلبات تسبقك` : 'في الصدارة'})` },
    { label: 'تاريخ ووقت التقديم', value: new Date(application.appliedAt).toLocaleString('ar-SA') }
  ];

  if (application.notes) {
    detailsTable.push({ label: 'ملاحظات مقدم الطلب', value: application.notes });
  }

  return {
    toEmail: application.email || '',
    fromEmail: senderEmail,
    mailConfig: complex.mailConfig ? { user: complex.mailConfig.user, pass: complex.mailConfig.pass } : undefined,
    subject: `تم استلام طلب انضمامك في ${complex.name} • رقم التذكرة [${application.trackingCode}]`,
    title: `تأكيد استلام طلب الانضمام • ${complex.name}`,
    greeting: `حياك الله وبياك أخي ولي أمر الطالب / ${application.studentName} حفظه الله ورعاه..`,
    bodyParagraphs: [
      `يسر إدارة مجمع ${complex.name} إبلاغكم بأنه تم استلام وتوثيق طلب انضمام ابنكم المبارك بنجاح إلى حلقات القرآن الكريم.`,
      `طلبكم الآن معتمد ومدرج برقم تذكرة رسمي في قائمة المراجعة والفرز التربوي لدى المشرف التعليمي للمجمع، وسيتم دراسته وتسكينه في الحلقة الأنسب لمستواه وحفظه بإذن الله.`
    ],
    ticketNumber: application.trackingCode,
    verificationUrl: directTrackingUrl,
    detailsTable,
    highlightBox: {
      label: 'رقم تذكرة المتابعة المعتمدة للمجمع:',
      value: application.trackingCode,
      sublabel: `ترتيبك في قائمة الفرز #${queueNo} • احتفظ برقم التذكرة لمتابعة القبول وتأكيد المقعد`
    },
    badgeText: `تذكرة طلب رسمي #${application.trackingCode}`,
    actionButton: {
      text: 'متابعة والتحقق من حالة الطلب مباشرة عبر الرابط',
      url: directTrackingUrl
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
  const fullPortalUrl = ensureAbsolutePortalUrl(portalUrl);
  const sep = fullPortalUrl.includes('?') ? '&' : '?';
  const directTrackingUrl = `${fullPortalUrl}${sep}track=${encodeURIComponent(application.trackingCode)}`;
  const senderEmail = complex.mailConfig?.fromEmail || complex.mailConfig?.user || 'qdrat2626@gmail.com';

  const detailsTable: Array<{ label: string; value: string }> = [
    { label: 'رقم التذكرة', value: application.trackingCode },
    { label: 'اسم الطالب المقبول', value: application.studentName },
    { label: 'الحلقة المعتمدة', value: halaqahName },
    { label: 'حالة القبول', value: 'تم الاعتماد والموافقة رسمياً 🎉' },
    { label: 'تاريخ الاعتماد', value: new Date().toLocaleString('ar-SA') }
  ];

  return {
    toEmail: application.email || '',
    fromEmail: senderEmail,
    mailConfig: complex.mailConfig ? { user: complex.mailConfig.user, pass: complex.mailConfig.pass } : undefined,
    subject: `🎉 بشرى سارة: تم قبول الطالب ${application.studentName} في ${complex.name}! [${application.trackingCode}]`,
    title: `بشرى القبول والاعتماد • ${complex.name}`,
    greeting: `السلام عليكم ورحمة الله وبركاته 🌿`,
    bodyParagraphs: [
      `نهنئكم ونسأل الله أن يبارك في ابننا الغالي / ${application.studentName}.`,
      `يسر المشرف التعليمي لمجمع ${complex.name} إبلاغكم بأنه تم اعتماد وقبول طلب انضمامه رسمياً وإلحاقه في:`,
      `📖 الحلقة المعتمدة: ${halaqahName}`,
      `لتثبيت المقعد واستلام بيانات الحلقة والبدء في مسيرة الحفظ المباركة، يرجى الضغط على زر تأكيد القبول بالأسفل ودخول بوابة الطالب فوراً.`
    ],
    ticketNumber: application.trackingCode,
    verificationUrl: directTrackingUrl,
    detailsTable,
    highlightBox: {
      label: 'الحلقة القرآنية المخصصة:',
      value: halaqahName,
      sublabel: `تذكرة رقم: ${application.trackingCode} • يرجى تأكيد الدخول وتثبيت المقعد`
    },
    badgeText: 'تم القبول والاعتماد 🎉',
    actionButton: {
      text: 'تأكيد القبول والدخول لحساب الطالب الآن',
      url: directTrackingUrl
    },
    footerNote: `مع تحيات إدارة ومحفظي مجمع ${complex.name} • منظومة عُمْرَان.`,
    sentAt: new Date().toISOString(),
    complexName: complex.name,
    complexTheme: complex.theme
  };
}

/**
 * Builds the Waiting List Notification Email
 */
export function buildWaitingListEmail(
  complex: QuranComplex,
  trackingCode: string,
  studentName: string,
  toEmail: string,
  queueNumber: number,
  portalUrl: string
): BrandedEmailPayload {
  const fullPortalUrl = ensureAbsolutePortalUrl(portalUrl);
  const sep = fullPortalUrl.includes('?') ? '&' : '?';
  const directTrackingUrl = `${fullPortalUrl}${sep}track=${encodeURIComponent(trackingCode)}`;
  const senderEmail = complex.mailConfig?.fromEmail || complex.mailConfig?.user || 'qdrat2626@gmail.com';

  return {
    toEmail,
    fromEmail: senderEmail,
    mailConfig: complex.mailConfig ? { user: complex.mailConfig.user, pass: complex.mailConfig.pass } : undefined,
    subject: `إشعار إدراج في قائمة الانتظار • مجمع ${complex.name} [${trackingCode}]`,
    title: `قائمة الانتظار الرسمية • ${complex.name}`,
    greeting: `السلام عليكم ورحمة الله وبركاته، مرحباً بك يا ${studentName}..`,
    bodyParagraphs: [
      `تم استلام طلب انضمامك إلى مجمع ${complex.name} ومراجعته بنجاح.`,
      `نظراً لاكتمال الطاقة الاستيعابية للحلقات حالياً، تم إدراج طلبك في قائمة الانتظار المعتمدة بالدور رقم #${queueNumber}.`,
      `سيقوم المشرف بمراجعة طلبك وقبولك كطالب إضافي أو فور توفر مقعد شاغر، وسيصلك إشعار بالبريد الإلكتروني فور الاعتماد.`
    ],
    ticketNumber: trackingCode,
    verificationUrl: directTrackingUrl,
    detailsTable: [
      { label: 'رقم التذكرة', value: trackingCode },
      { label: 'اسم الطالب', value: studentName },
      { label: 'رقم الدور في قائمة الانتظار', value: `#${queueNumber}` },
      { label: 'حالة الطلب', value: 'في قائمة الانتظار الرسمية' }
    ],
    highlightBox: {
      label: 'رقم الدور في قائمة الانتظار:',
      value: `#${queueNumber}`,
      sublabel: `تذكرة رقم: ${trackingCode}`
    },
    badgeText: `قائمة الانتظار #${queueNumber}`,
    actionButton: {
      text: 'متابعة حالة قائمة الانتظار والطلب',
      url: directTrackingUrl
    },
    footerNote: `مجمع ${complex.name} • منظومة عُمْرَان.`,
    sentAt: new Date().toISOString(),
    complexName: complex.name,
    complexTheme: complex.theme
  };
}

/**
 * Builds the Rejection / Polite Apology Notification Email for Student / Parent
 */
export function buildApplicationRejectedEmail(
  complex: QuranComplex,
  application: StudentRegistrationApplication,
  reason: string,
  portalUrl?: string
): BrandedEmailPayload {
  const fullPortalUrl = portalUrl ? ensureAbsolutePortalUrl(portalUrl) : '';
  const sep = fullPortalUrl.includes('?') ? '&' : '?';
  const directTrackingUrl = fullPortalUrl ? `${fullPortalUrl}${sep}track=${encodeURIComponent(application.trackingCode)}` : undefined;

  const senderEmail = complex.mailConfig?.fromEmail || complex.mailConfig?.user || 'qdrat2626@gmail.com';
  const cleanReason = (reason || '').trim() || 'نعتذر عن عدم إمكانية القبول في الوقت الحالي لاكتمال المقاعد المتاحة.';

  const detailsTable: Array<{ label: string; value: string }> = [
    { label: 'رقم التذكرة', value: application.trackingCode },
    { label: 'اسم الطالب', value: application.studentName },
    { label: 'العمر', value: `${application.age} سنة` },
    { label: 'حالة الطلب', value: 'تم الاعتذار عن القبول في هذه الفترة' },
    { label: 'سبب الاعتذار', value: cleanReason },
    { label: 'تاريخ المراجعة', value: new Date().toLocaleString('ar-SA') }
  ];

  return {
    toEmail: application.email || '',
    fromEmail: senderEmail,
    mailConfig: complex.mailConfig ? { user: complex.mailConfig.user, pass: complex.mailConfig.pass } : undefined,
    subject: `إشعار بشأن طلب الانضمام إلى ${complex.name} • [${application.trackingCode}]`,
    title: `إشعار بخصوص طلب الانضمام • ${complex.name}`,
    greeting: `السلام عليكم ورحمة الله وبركاته، مرحباً بك أخي ولي أمر الطالب / ${application.studentName} حفظه الله..`,
    bodyParagraphs: [
      `نشكر لكم اهتمامكم الكريم وثقتكم الغالية بمجمع ${complex.name} لتعليم القرآن الكريم، وحرصكم المبارك على تسجيل ابننا الفاضل في رحاب القرآن الكريم.`,
      `نود إفادتكم بأنه بعد دراسة ومراجعة طلبات الانضمام بعناية لدى المشرف التعليمي، نعتذر بكل أسف عن قبول الطلب في هذه الفترة نظراً لما يلي:`,
      `« ${cleanReason} »`,
      `نسأل الله العلي القدير أن يبارك في ابنكم وأن يجعله من أهل القرآن وخاصته، ونرحب بتقديمكم مجدداً في الفترات والدورات القادمة بإذن الله تعالى.`
    ],
    ticketNumber: application.trackingCode,
    verificationUrl: directTrackingUrl,
    detailsTable,
    highlightBox: {
      label: 'سبب الاعتذار المعتمد من المشرف:',
      value: cleanReason,
      sublabel: `تذكرة رقم: ${application.trackingCode} • نسأل الله لكم التوفيق والتيسير`
    },
    badgeText: 'إشعار مراجعة الطلب',
    actionButton: directTrackingUrl ? {
      text: 'متابعة تفاصيل الطلب عبر البوابة',
      url: directTrackingUrl
    } : undefined,
    footerNote: `مع تمنيات إدارة ومشرفي مجمع ${complex.name} لكم بالتوفيق والنجاح • منظومة عُمْرَان.`,
    sentAt: new Date().toISOString(),
    complexName: complex.name,
    complexTheme: complex.theme
  };
}

/**
 * Renders a full, modern, RTL responsive HTML email themed with the complex colors
 */
export function renderBrandedEmailHtml(payload: BrandedEmailPayload): string {
  const primaryColor = payload.complexTheme?.primaryColor || '#064e3b';
  const secondaryColor = payload.complexTheme?.secondaryColor || '#022c22';
  const accentColor = payload.complexTheme?.accentColor || '#fbbf24';

  const paragraphsHtml = payload.bodyParagraphs
    .map(
      p =>
        `<p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.8; color: #334155;">${p}</p>`
    )
    .join('');

  const ticketVoucherHtml = payload.ticketNumber
    ? `
      <div style="margin: 20px 0; padding: 18px 24px; background: linear-gradient(135deg, #f8fafc, #f1f5f9); border: 2px dashed ${primaryColor}; border-radius: 16px; text-align: center;">
        <div style="font-size: 12px; font-weight: 800; color: ${primaryColor}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">
          تذكرة التسجيل والمتابعة الرسمية
        </div>
        <div style="font-size: 28px; font-weight: 900; letter-spacing: 3px; color: #0f172a; font-family: monospace, Arial, sans-serif; direction: ltr; margin: 4px 0;">
          ${payload.ticketNumber}
        </div>
        ${payload.verificationUrl ? `
          <div style="margin-top: 10px;">
            <a href="${payload.verificationUrl}" target="_blank" style="display: inline-block; font-size: 12px; font-weight: bold; color: ${primaryColor}; text-decoration: underline;">
              رابط التحقق والمتابعة المباشر المخصص للطلب &larr;
            </a>
          </div>
        ` : ''}
      </div>
    `
    : '';

  const detailsTableHtml = payload.detailsTable && payload.detailsTable.length > 0
    ? `
      <div style="margin: 24px 0;">
        <h3 style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 12px; border-right: 4px solid ${primaryColor}; padding-right: 8px;">
          تفاصيل طلب التسجيل المعتمد:
        </h3>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; font-size: 13px;">
          <tbody>
            ${payload.detailsTable
              .map(
                (row, idx) => `
                <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 10px 14px; font-weight: 700; color: #475569; width: 40%; vertical-align: top;">
                    ${row.label}
                  </td>
                  <td style="padding: 10px 14px; font-weight: 600; color: #0f172a; direction: rtl; text-align: right;">
                    ${row.value}
                  </td>
                </tr>
              `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `
    : '';

  const highlightHtml = payload.highlightBox
    ? `
      <div style="margin: 24px 0; padding: 20px; background-color: #f8fafc; border: 2px dashed ${primaryColor}40; border-radius: 16px; text-align: center;">
        <div style="font-size: 13px; font-weight: 700; color: #64748b; margin-bottom: 8px;">${payload.highlightBox.label}</div>
        <div style="font-size: 32px; font-weight: 900; letter-spacing: 4px; color: ${primaryColor}; font-family: monospace, Arial, sans-serif; direction: ltr; margin: 4px 0;">${payload.highlightBox.value}</div>
        ${payload.highlightBox.sublabel ? `<div style="font-size: 12px; color: #94a3b8; margin-top: 6px;">${payload.highlightBox.sublabel}</div>` : ''}
      </div>
    `
    : '';

  const actionButtonHtml = payload.actionButton
    ? `
      <div style="margin: 28px 0; text-align: center;">
        <a href="${payload.actionButton.url}" target="_blank" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor}); color: #ffffff; text-decoration: none; font-size: 15px; font-weight: bold; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
          ${payload.actionButton.text}
        </a>
      </div>
    `
    : '';

  const badgeHtml = payload.badgeText
    ? `<span style="display: inline-block; padding: 4px 12px; background-color: ${accentColor}25; color: ${secondaryColor}; border: 1px solid ${accentColor}60; border-radius: 20px; font-size: 11px; font-weight: bold; margin-bottom: 12px;">${payload.badgeText}</span>`
    : '';

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${payload.subject}</title>
</head>
<body style="margin: 0; padding: 24px 12px; background-color: #f1f5f9; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; text-align: right; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0;">
    <!-- Header -->
    <tr>
      <td style="padding: 32px 28px; background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor}); text-align: center; color: #ffffff;">
        <div style="font-size: 13px; font-weight: 700; color: ${accentColor}; margin-bottom: 6px; letter-spacing: 0.5px;">منظومة عُمْرَان لإدارة الحلقات والمجمعات القرآنية</div>
        <h1 style="margin: 0; font-size: 22px; font-weight: 900; line-height: 1.4; color: #ffffff;">${payload.complexName}</h1>
      </td>
    </tr>

    <!-- Body Card -->
    <tr>
      <td style="padding: 32px 28px;">
        <div style="text-align: right;">
          ${badgeHtml}
          <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 800; color: #0f172a;">${payload.title}</h2>
          <p style="margin: 0 0 20px 0; font-size: 15px; font-weight: 700; color: #334155;">${payload.greeting}</p>
          ${paragraphsHtml}
          ${ticketVoucherHtml}
          ${detailsTableHtml}
          ${highlightHtml}
          ${actionButtonHtml}
        </div>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 24px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b; line-height: 1.6;">
        <div style="margin-bottom: 6px; font-weight: 600;">${payload.footerNote}</div>
        <div style="font-size: 11px; color: #94a3b8;">تم إرسال هذا الإشعار تلقائياً عبر خدمة البريد الرسمية المعتمدة (Gmail: ${payload.fromEmail}) • ${new Date(payload.sentAt).toLocaleString('ar-SA')}</div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Sends a real email to the recipient's personal inbox directly via the server SMTP endpoint.
 * Completely decoupled from client-side Google popup / Google Identity Services (GIS).
 * Works seamlessly for ANY email provider (Gmail, Outlook, Yahoo, Hotmail, iCloud, custom domains, etc.).
 */
export async function sendRealPortalEmail(
  payload: BrandedEmailPayload
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!payload.toEmail) {
    return { success: false, error: 'عنوان البريد الإلكتروني للمستلم مفقود.' };
  }

  try {
    const html = renderBrandedEmailHtml(payload);

    // Call server backend SMTP endpoint directly. NEVER invoke client GIS/Google popup!
    const srvRes = await fetch(ApiConfig.getEndpoint('/api/mail/send-gmail'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: payload.toEmail,
        subject: payload.subject,
        html,
        fromName: payload.complexName || 'منظومة عُمْرَان لإدارة المجمعات القرآنية',
        fromEmail: payload.fromEmail || 'qdrat2626@gmail.com',
        gmailUser: payload.mailConfig?.user,
        gmailAppPassword: payload.mailConfig?.pass
      })
    });

    if (srvRes.ok) {
      const srvData = await srvRes.json();
      if (srvData?.success) {
        return { success: true, messageId: srvData.messageId };
      }
      return {
        success: false,
        error: srvData?.error || 'تعذر إرسال البريد عبر الخادم.'
      };
    }

    const errData = await srvRes.json().catch(() => ({}));
    return {
      success: false,
      error: errData?.error || `فشل إرسال البريد الإلكتروني (رمز ${srvRes.status})`
    };
  } catch (err: any) {
    console.warn('Real email dispatch error:', err);
    return {
      success: false,
      error: err?.message || 'تعذر الاتصال بخادم البريد الإلكتروني'
    };
  }
}

/**
 * In-app simulated email popups are completely disabled per user preference.
 * Real emails are delivered directly to the user's actual inbox.
 */
export function dispatchPortalEmailNotification(_emailPayload: BrandedEmailPayload) {
  // Disabled: No fake in-app email simulation.
}
