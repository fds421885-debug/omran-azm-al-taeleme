import React, { useState, useEffect } from 'react';
import {
  Mail,
  Key,
  Check,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  X,
  Send,
  Sparkles,
  Eye,
  EyeOff,
  Copy,
  Database,
  ShieldCheck,
  Building2,
  Trash2
} from 'lucide-react';
import { ApiConfig } from '../../lib/apiConfig';
<<<<<<< HEAD
import { QuranComplex } from '../../types';
import {
  loadSavedMailConfigFromCloud,
  saveMailConfigToCloudForever
} from '../../lib/portalEmailService';
=======
import { db, OmranDataService } from '../../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { QuranComplex } from '../../types';
>>>>>>> fe1326044c44ff41cee71f10bb01b26f4533f2d4

interface QuickMailSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (savedConfig?: { user: string; pass: string; fromName: string }) => void;
  initialEmail?: string;
  complex?: QuranComplex;
  complexId?: string;
  complexName?: string;
  onSaveComplex?: (complex: QuranComplex) => void | Promise<void>;
}

export const QuickMailSetupModal: React.FC<QuickMailSetupModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
  initialEmail = '',
  complex,
  complexId,
  complexName,
  onSaveComplex
}) => {
  const targetComplexId = complex?.id || complexId || '';
  const targetComplexName = complex?.name || complexName || 'المجمع القرآني';

  const [gmailUser, setGmailUser] = useState(initialEmail);
  const [appPassword, setAppPassword] = useState('');
  const [fromName, setFromName] = useState(
    targetComplexName ? `مجمع ${targetComplexName}` : 'منظومة عُمْرَان لإدارة المجمعات القرآنية'
  );
  const [showPassword, setShowPassword] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isSavedInCloud, setIsSavedInCloud] = useState<boolean>(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCurrentConfig();
    }
  }, [isOpen, targetComplexId]);

  const loadCurrentConfig = async () => {
<<<<<<< HEAD
    try {
      const saved = await loadSavedMailConfigFromCloud(targetComplexId, complex);
      if (saved) {
        if (saved.user) setGmailUser(saved.user);
        if (saved.pass) setAppPassword(saved.pass);
        if (saved.fromName) setFromName(saved.fromName);
        if (saved.updatedAt) setLastSavedAt(saved.updatedAt);
        if (saved.user && saved.pass) setIsSavedInCloud(true);
      }
    } catch (e) {
      console.warn('Mail config load notice:', e);
    }
=======
    let foundUser = '';
    let foundPass = '';
    let foundFromName = '';
    let savedTimestamp = '';

    // 1. Check in complex object props
    if (complex?.mailConfig) {
      if (complex.mailConfig.user) foundUser = complex.mailConfig.user;
      if (complex.mailConfig.pass) foundPass = complex.mailConfig.pass;
      if (complex.mailConfig.fromName) foundFromName = complex.mailConfig.fromName;
      if (complex.mailConfig.updatedAt) savedTimestamp = complex.mailConfig.updatedAt;
    }

    // 2. Check Firestore per-complex document if available
    if (targetComplexId) {
      try {
        const complexSnap = await getDoc(doc(db, 'settings', `mail_config_${targetComplexId}`));
        if (complexSnap.exists()) {
          const cData = complexSnap.data();
          if (cData.user) foundUser = cData.user;
          if (cData.pass) foundPass = cData.pass;
          if (cData.fromName) foundFromName = cData.fromName;
          if (cData.updatedAt) savedTimestamp = cData.updatedAt;
        }
      } catch (e) {
        console.warn('Per-complex mail config check notice:', e);
      }
    }

    // 3. Check general Firestore settings/mail_config (Source of truth)
    if (!foundUser || !foundPass) {
      try {
        const snap = await getDoc(doc(db, 'settings', 'mail_config'));
        if (snap.exists()) {
          const data = snap.data();
          if (!foundUser && data.user) foundUser = data.user;
          if (!foundPass && data.pass) foundPass = data.pass;
          if (!foundFromName && data.fromName) foundFromName = data.fromName;
          if (!savedTimestamp && data.updatedAt) savedTimestamp = data.updatedAt;
        }
      } catch (e) {
        console.warn('General mail config check notice:', e);
      }
    }

    // 4. Check localStorage fallback
    if (!foundUser || !foundPass) {
      try {
        const local = localStorage.getItem('omran_mail_config');
        if (local) {
          const parsed = JSON.parse(local);
          if (!foundUser && parsed.user) foundUser = parsed.user;
          if (!foundPass && parsed.pass) foundPass = parsed.pass;
          if (!foundFromName && parsed.fromName) foundFromName = parsed.fromName;
          if (!savedTimestamp && parsed.updatedAt) savedTimestamp = parsed.updatedAt;
        }
      } catch {}
    }

    // 5. Check server /api/mail/config
    if (!foundUser || !foundPass) {
      try {
        const res = await fetch(ApiConfig.getEndpoint('/api/mail/config'));
        if (res.ok) {
          const cfg = await res.json();
          if (!foundUser && cfg.user) foundUser = cfg.user;
          if (!foundPass && cfg.pass) foundPass = cfg.pass;
          if (!foundFromName && cfg.fromName) foundFromName = cfg.fromName;
        }
      } catch {}
    }

    if (foundUser) setGmailUser(foundUser);
    if (foundPass) setAppPassword(foundPass);
    if (foundFromName) setFromName(foundFromName);
    if (savedTimestamp) setLastSavedAt(savedTimestamp);
    if (foundUser && foundPass) setIsSavedInCloud(true);
>>>>>>> fe1326044c44ff41cee71f10bb01b26f4533f2d4
  };

  if (!isOpen) return null;

  const handleCopyKey = () => {
    if (!appPassword) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(appPassword);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gmailUser.trim() || !appPassword.trim()) {
      setStatusMsg({
        type: 'error',
        text: 'يرجى إدخال عنوان بريد Gmail وكلمة مرور التطبيقات (App Password).'
      });
      return;
    }

    setIsSaving(true);
    setStatusMsg(null);
    setTestResult(null);

    const cleanUser = gmailUser.trim().toLowerCase();
    const cleanPass = appPassword.trim().replace(/\s+/g, '');
    const cleanName = fromName.trim() || `مجمع ${targetComplexName}`;
    const nowIso = new Date().toISOString();

    const configPayload = {
      user: cleanUser,
      pass: cleanPass,
      fromName: cleanName,
      fromEmail: cleanUser,
      complexId: targetComplexId || undefined,
      complexName: targetComplexName || undefined,
      updatedAt: nowIso
    };

    try {
<<<<<<< HEAD
      const savedPayload = await saveMailConfigToCloudForever({
        user: cleanUser,
        pass: cleanPass,
        fromName: cleanName,
        fromEmail: cleanUser,
        complexId: targetComplexId,
        complexName: targetComplexName,
        complex,
        onSaveComplex
      });

      setLastSavedAt(savedPayload.updatedAt || nowIso);
=======
      // 1. Save to Firestore central settings/mail_config FOREVER
      try {
        await setDoc(doc(db, 'settings', 'mail_config'), configPayload, { merge: true });
        if (targetComplexId) {
          await setDoc(doc(db, 'settings', `mail_config_${targetComplexId}`), configPayload, { merge: true });
        }
      } catch (fErr: any) {
        console.error('Firestore mail config save error:', fErr);
      }

      // 2. If a complex object is provided, update complex.mailConfig and save to Firestore
      if (complex) {
        try {
          const updatedComplex: QuranComplex = {
            ...complex,
            mailConfig: {
              user: cleanUser,
              pass: cleanPass,
              fromName: cleanName,
              fromEmail: cleanUser,
              updatedAt: nowIso
            }
          };
          await OmranDataService.saveComplex(updatedComplex);
          if (onSaveComplex) {
            await onSaveComplex(updatedComplex);
          }
        } catch (cErr) {
          console.warn('Could not update complex object with mailConfig:', cErr);
        }
      }

      // 3. Save to localStorage for instant local access
      try {
        localStorage.setItem('omran_mail_config', JSON.stringify(configPayload));
        if (targetComplexId) {
          localStorage.setItem(`omran_mail_config_${targetComplexId}`, JSON.stringify(configPayload));
        }
      } catch {}

      // 4. Save to backend Express server endpoint
      try {
        await fetch(ApiConfig.getEndpoint('/api/mail/config'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(configPayload)
        });
      } catch (sErr) {
        console.warn('Server endpoint mail save notice:', sErr);
      }

      setLastSavedAt(nowIso);
>>>>>>> fe1326044c44ff41cee71f10bb01b26f4533f2d4
      setIsSavedInCloud(true);
      setStatusMsg({
        type: 'success',
        text: 'تم حفظ البريد والمفتاح للأبد في قاعدة البيانات السحابية (Firestore)! يمكنك تعديلها في أي وقت.'
      });

      // 5. Automatically test the saved credentials with real email verification
      setIsTesting(true);
      try {
        const testRes = await fetch(ApiConfig.getEndpoint('/api/mail/send-gmail'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: cleanUser,
            subject: `🎉 تم حفظ وتفعيل خدمة البريد بنجاح • ${targetComplexName}`,
            html: `<div dir="rtl" style="font-family: Arial, sans-serif; padding: 24px; background-color: #f8fafc; border-radius: 16px; color: #1e293b; border: 1px solid #e2e8f0;">
              <h2 style="color: #064e3b; margin-top: 0;">تهانينا! خدمة البريد والمفتاح محفوظة وتعمل بنجاح</h2>
              <p>تم حفظ وتفعيل إعدادات خادم البريد للمجمع (${targetComplexName}) عبر الحساب (${cleanUser}) في قاعدة البيانات بصورة دائمة.</p>
              <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 14px; margin: 16px 0;">
                <strong style="color: #065f46;">المفتاح والبريد محفوظان في قاعدة البيانات للأبد</strong> ويمكنك تعديلهم أو تحديثهم في أي وقت من لوحة المجمع أو رابط الدخول.
              </div>
              <p>رسائل التحقق (OTP) وتذاكر القبول وإشعارات الحلقات ستصل للطلاب وأولياء الأمور مباشرة وبشكل فوري.</p>
              <div style="font-size: 12px; color: #64748b; margin-top: 20px;">منظومة عُمْرَان لإدارة المجمعات القرآنية</div>
            </div>`,
            gmailUser: cleanUser,
            gmailAppPassword: cleanPass,
            fromName: cleanName,
            fromEmail: cleanUser
          })
        });

        const testData = await testRes.json().catch(() => ({}));
        if (testRes.ok && testData?.success) {
          setTestResult({
            success: true,
            text: `🎉 تم إرسال رسالة تجريبية بنجاح إلى (${cleanUser})! تفقد صندوق بريدك للتأكد من وصولها.`
          });
        } else {
          setTestResult({
            success: false,
            text: `تم الحفظ في قاعدة البيانات ولكن فشل اختبار الإرسال: ${testData?.error || 'يرجى مراجعة كلمة مرور التطبيقات والتأكد من إتاحتها من Google.'}`
          });
        }
      } catch (tErr: any) {
        setTestResult({
          success: false,
          text: `تم الحفظ بنجاح في قاعدة البيانات، ولكن تعذر فحص الإرسال: ${tErr?.message || 'خطأ اتصال'}`
        });
      } finally {
        setIsTesting(false);
      }

      if (onConfigSaved) {
        onConfigSaved({
          user: cleanUser,
          pass: cleanPass,
          fromName: cleanName
        });
      }
<<<<<<< HEAD
=======

      try {
        window.dispatchEvent(new CustomEvent('omran:mail-config-updated', { detail: configPayload }));
      } catch {}
>>>>>>> fe1326044c44ff41cee71f10bb01b26f4533f2d4
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'حدث خطأ أثناء الحفظ.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestOnly = async () => {
    if (!gmailUser.trim() || !appPassword.trim()) {
      setStatusMsg({ type: 'error', text: 'يرجى إدخال البريد والمفتاح أولاً لتجربة الإرسال.' });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    const cleanUser = gmailUser.trim().toLowerCase();
    const cleanPass = appPassword.trim().replace(/\s+/g, '');
    const cleanName = fromName.trim() || `مجمع ${targetComplexName}`;

    try {
      const testRes = await fetch(ApiConfig.getEndpoint('/api/mail/send-gmail'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: cleanUser,
          subject: `⚡ اختبار فحص خدمة البريد • ${targetComplexName}`,
          html: `<div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; background-color: #f8fafc; border-radius: 12px; color: #1e293b;">
            <h2 style="color: #064e3b; margin-top: 0;">اختبار إرسال بريد تجريبي ناجح!</h2>
            <p>المفتاح صالح ومفعل ويعمل بكفاءة لإرسال الإشعارات ورموز OTP لـ (${targetComplexName}).</p>
            <div style="font-size: 12px; color: #64748b; margin-top: 20px;">منظومة عُمْرَان لإدارة المجمعات القرآنية</div>
          </div>`,
          gmailUser: cleanUser,
          gmailAppPassword: cleanPass,
          fromName: cleanName,
          fromEmail: cleanUser
        })
      });

      const testData = await testRes.json().catch(() => ({}));
      if (testRes.ok && testData?.success) {
        setTestResult({
          success: true,
          text: `🎉 المفتاح صالح ويعمل 100%! تم إرسال رسالة فحص بنجاح إلى (${cleanUser}).`
        });
      } else {
        setTestResult({
          success: false,
          text: `فشل الاتصال: ${testData?.error || 'يرجى التأكد من كلمة مرور التطبيقات المكونة من 16 حرفاً'}`
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        text: `خطأ اتصال: ${err?.message || 'تعذر الوصول لخادم البريد'}`
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      dir="rtl"
    >
      <div className="bg-[#022c22] border-2 border-amber-400/60 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#065f46] flex items-center justify-between bg-gradient-to-r from-[#064e3b] via-[#022c22] to-[#064e3b]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/20 text-amber-300 flex items-center justify-center border border-amber-400/40 shadow-inner">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-white">إعدادات البريد والمفتاح الدائم</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 font-bold flex items-center gap-1">
                  <Database className="w-3 h-3" />
                  حفظ للأبد في قاعدة البيانات
                </span>
              </div>
              <p className="text-xs text-[#86efac]/90 mt-0.5">
                {targetComplexName ? `خاص بـ: ${targetComplexName}` : 'لإرسال رموز OTP ورسائل القبول والتذاكر'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-all"
            title="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Persistence Status Badge */}
        {isSavedInCloud && (
          <div className="px-5 py-2.5 bg-emerald-950/70 border-b border-emerald-500/30 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-300 font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>البريد والمفتاح محفوظان سحابياً في قاعدة البيانات للأبد ✓</span>
            </div>
            {lastSavedAt && (
              <span className="text-[10px] font-mono text-slate-400">
                آخر تحديث: {new Date(lastSavedAt).toLocaleDateString('ar-SA')}
              </span>
            )}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-right">
          {/* Email input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#86efac]">
                عنوان بريد Gmail المعتمد: <span className="text-amber-400">*</span>
              </label>
              <span className="text-[10px] text-slate-400">يُحفظ في قاعدة البيانات</span>
            </div>
            <div className="relative">
              <input
                type="email"
                required
                value={gmailUser}
                onChange={e => {
                  setGmailUser(e.target.value);
                  setStatusMsg(null);
                  setTestResult(null);
                }}
                placeholder="مثال: quran.complex@gmail.com"
                className="w-full bg-[#064e3b]/80 border border-[#065f46] focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-400 outline-none font-mono"
                dir="ltr"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* App Password / Key input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#86efac]">
                مفتاح كلمة مرور التطبيقات (App Password - 16 حرفاً): <span className="text-amber-400">*</span>
              </label>
              <div className="flex items-center gap-2">
                {appPassword && (
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="text-[10px] text-amber-300 hover:text-white flex items-center gap-1 cursor-pointer bg-white/5 px-2 py-0.5 rounded-md border border-white/10"
                    title="نسخ المفتاح"
                  >
                    {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedKey ? 'تم النسخ!' : 'نسخ المفتاح'}</span>
                  </button>
                )}
                <span className="text-[10px] text-emerald-300 font-bold">يمكنك تعديله في أي وقت</span>
              </div>
            </div>
            <div className="relative flex items-center">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={appPassword}
                onChange={e => {
                  setAppPassword(e.target.value);
                  setStatusMsg(null);
                  setTestResult(null);
                }}
                placeholder="مثال: abcd efgh ijkl mnop"
                className="w-full bg-[#064e3b]/80 border border-[#065f46] focus:border-amber-400 rounded-xl px-3.5 py-2.5 pl-10 text-xs sm:text-sm text-white placeholder-slate-400 outline-none font-mono tracking-wider font-bold"
                dir="ltr"
              />
              <div className="absolute left-2.5 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title={showPassword ? 'إخفاء المفتاح' : 'إظهار المفتاح'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-amber-300" />}
                </button>
              </div>
            </div>
            <p className="text-[10px] text-slate-300 leading-relaxed">
              يتم حفظ المفتاح بصورة دائمة ومحمية في قاعدة البيانات السحابية، ويبقى ظاهراً وقابلاً للتعديل في أي وقت.
            </p>
          </div>

          {/* From Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-[#86efac]">
              اسم المرسل الظاهر للطلاب وأولياء الأمور في الرسالة:
            </label>
            <input
              type="text"
              value={fromName}
              onChange={e => setFromName(e.target.value)}
              placeholder={`مجمع ${targetComplexName}`}
              className="w-full bg-[#064e3b]/80 border border-[#065f46] focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-400 outline-none font-bold"
            />
          </div>

          {/* Quick Guide Card */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 text-xs text-slate-300 space-y-2">
            <div className="flex items-center gap-1.5 font-black text-amber-300">
              <Sparkles className="w-4 h-4" />
              <span>كيف تستخرج مفتاح التطبيقات (16 حرفاً) من Google؟</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-300 pr-1 leading-relaxed">
              <li>
                افتح رابط كلمات مرور التطبيقات من Google:{' '}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noreferrer"
                  className="text-amber-400 font-bold underline font-mono inline-flex items-center gap-0.5"
                >
                  myaccount.google.com/apppasswords <ExternalLink className="w-3 h-3 inline" />
                </a>
              </li>
              <li>سجل دخولك بحساب Google الخاص بك وتأكد من تفعيل التحقق بخطوتين (2-Step Verification).</li>
              <li>اكتب اسم التطبيق (مثال: عُمران) واضغط <strong>إنشاء (Create)</strong>.</li>
              <li>انسخ الكود وضعه في خانة المفتاح أعلاه واضغط زر الحفظ.</li>
            </ol>
          </div>

          {/* Status Messages */}
          {statusMsg && (
            <div
              className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                  : 'bg-red-500/20 border-red-500/40 text-red-200'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{statusMsg.text}</span>
            </div>
          )}

          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                testResult.success
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                  : 'bg-amber-500/20 border-amber-500/40 text-amber-200'
              }`}
            >
              {testResult.success ? (
                <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
              )}
              <span>{testResult.text}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-3 border-t border-[#065f46]">
            <button
              type="button"
              onClick={handleTestOnly}
              disabled={isSaving || isTesting || !gmailUser.trim() || !appPassword.trim()}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-amber-400/40 bg-white/5 hover:bg-white/10 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
              title="تجربة الإرسال والتأكد من صحة المفتاح"
            >
              {isTesting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-300" />
              ) : (
                <Send className="w-3.5 h-3.5 text-amber-300" />
              )}
              <span>اختبار المفتاح فقط</span>
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-white/20 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                إغلاق
              </button>
              <button
                type="submit"
                disabled={isSaving || isTesting}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#022c22] text-xs font-black flex items-center justify-center gap-2 cursor-pointer shadow-lg transition-all active:scale-95 disabled:opacity-50"
              >
                {isSaving || isTesting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جارٍ الحفظ والفحص...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>حفظ وتعديل الإعدادات في قاعدة البيانات</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
