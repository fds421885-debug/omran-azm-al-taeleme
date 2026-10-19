import React, { useState, useEffect } from 'react';
import { Mail, Key, Check, AlertCircle, RefreshCw, ExternalLink, X, Send, Sparkles } from 'lucide-react';
import { ApiConfig } from '../../lib/apiConfig';
import { db } from '../../lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

interface QuickMailSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: () => void;
  initialEmail?: string;
}

export const QuickMailSetupModal: React.FC<QuickMailSetupModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
  initialEmail = ''
}) => {
  const [gmailUser, setGmailUser] = useState(initialEmail);
  const [appPassword, setAppPassword] = useState('');
  const [fromName, setFromName] = useState('منظومة عُمْرَان لإدارة المجمعات القرآنية');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadCurrentConfig();
    }
  }, [isOpen]);

  const loadCurrentConfig = async () => {
    try {
      const snap = await getDoc(doc(db, 'settings', 'mail_config'));
      if (snap.exists()) {
        const data = snap.data();
        if (data.user) setGmailUser(data.user);
        if (data.fromName) setFromName(data.fromName);
      } else {
        const res = await fetch(ApiConfig.getEndpoint('/api/mail/config'));
        if (res.ok) {
          const cfg = await res.json();
          if (cfg.user) setGmailUser(cfg.user);
          if (cfg.fromName) setFromName(cfg.fromName);
        }
      }
    } catch (e) {
      // ignore
    }
  };

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gmailUser.trim() || !appPassword.trim()) {
      setStatusMsg({ type: 'error', text: 'يرجى إدخال عنوان بريد Gmail وكلمة مرور التطبيقات (App Password).' });
      return;
    }

    setIsSaving(true);
    setStatusMsg(null);
    setTestResult(null);

    const cleanUser = gmailUser.trim().toLowerCase();
    const cleanPass = appPassword.trim().replace(/\s+/g, '');
    const cleanName = fromName.trim() || 'منظومة عُمْرَان لإدارة المجمعات القرآنية';

    try {
      // 1. Save to server endpoint
      const res = await fetch(ApiConfig.getEndpoint('/api/mail/config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: cleanUser,
          pass: cleanPass,
          fromName: cleanName,
          fromEmail: cleanUser
        })
      });

      // 2. Save to Firestore for permanent persistence
      try {
        await setDoc(doc(db, 'settings', 'mail_config'), {
          user: cleanUser,
          pass: cleanPass,
          fromName: cleanName,
          fromEmail: cleanUser,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (fErr) {
        console.warn('Firestore mail config save notice:', fErr);
      }

      if (res.ok) {
        setStatusMsg({
          type: 'success',
          text: 'تم تفعيل وحفظ خدمة البريد بنجاح! يتم الآن اختبار الإرسال الفعلي للتأكد...'
        });

        // 3. Automatically send a real test email to verify!
        setIsTesting(true);
        try {
          const testRes = await fetch(ApiConfig.getEndpoint('/api/mail/send-gmail'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: cleanUser,
              subject: '🎉 تم تفعيل خدمة البريد بنجاح في منظومة عُمْرَان',
              html: `<div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; background-color: #f8fafc; border-radius: 12px; color: #1e293b;">
                <h2 style="color: #064e3b; margin-top: 0;">تهانينا! خدمة البريد الحقيقية تعمل الآن</h2>
                <p>تم ضبط خادم Gmail SMTP بنجاح عبر الحساب (${cleanUser}).</p>
                <p>جميع رسائل التحقق (OTP) وتذاكر تسجيل الطلاب وإشعارات القبول ستصل مباشرة وبشكل فوري إلى صناديق البريد الشخصية.</p>
                <div style="font-size: 12px; color: #64748b; margin-top: 20px;">منظومة عُمْرَان لإدارة الحلقات والمجمعات القرآنية</div>
              </div>`,
              gmailUser: cleanUser,
              gmailAppPassword: cleanPass,
              fromName: cleanName,
              fromEmail: cleanUser
            })
          });

          const testData = await testRes.json();
          if (testRes.ok && testData?.success) {
            setTestResult({
              success: true,
              text: `🎉 تم إرسال رسالة تجريبية حقيقية بنجاح إلى (${cleanUser})! تفقد صندوق بريدك للتأكد.`
            });
          } else {
            setTestResult({
              success: false,
              text: `تم الحفظ ولكن فشل اختبار الإرسال: ${testData?.error || 'يرجى مراجعة كلمة مرور التطبيقات'}`
            });
          }
        } catch (tErr: any) {
          setTestResult({
            success: false,
            text: `تم الحفظ ولكن تعذر اختبار الإرسال: ${tErr?.message || 'خطأ اتصال'}`
          });
        } finally {
          setIsTesting(false);
        }

        if (onConfigSaved) onConfigSaved();
      } else {
        const data = await res.json().catch(() => ({}));
        setStatusMsg({ type: 'error', text: data?.error || 'تعذر حفظ إعدادات البريد على الخادم.' });
      }
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'فشل الاتصال بالخادم.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn" dir="rtl">
      <div className="bg-[#022c22] border-2 border-amber-400/50 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-[#065f46] flex items-center justify-between bg-gradient-to-r from-[#064e3b] to-[#022c22]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400/20 text-amber-300 flex items-center justify-center border border-amber-400/40">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">تهيئة خدمة البريد الإلكتروني الفعلي (SMTP)</h3>
              <p className="text-xs text-[#86efac]/80">لإرسال رموز التحقق وتذاكر القبول مباشرة لصندوق الوارد</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#86efac] mb-1.5">
              بريد Gmail المعتمد للإرسال <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={gmailUser}
                onChange={e => setGmailUser(e.target.value)}
                placeholder="مثال: omran.complex@gmail.com"
                className="w-full bg-[#064e3b]/80 border border-[#065f46] focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-400 outline-none font-mono"
                dir="ltr"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#86efac] mb-1.5">
              كلمة مرور التطبيقات (Google App Password - 16 حرفاً) <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={appPassword}
                onChange={e => setAppPassword(e.target.value)}
                placeholder="مثال: abcd efgh ijkl mnop"
                className="w-full bg-[#064e3b]/80 border border-[#065f46] focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-400 outline-none font-mono"
                dir="ltr"
              />
              <Key className="w-4 h-4 text-amber-300 absolute right-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#86efac] mb-1.5">
              اسم المرسل الظاهر للطلاب وأولياء الأمور
            </label>
            <input
              type="text"
              value={fromName}
              onChange={e => setFromName(e.target.value)}
              placeholder="مثال: مجمع عُمران القرآني"
              className="w-full bg-[#064e3b]/80 border border-[#065f46] focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-400 outline-none font-bold"
            />
          </div>

          {/* Quick Guide Card */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 text-xs text-slate-300 space-y-2">
            <div className="flex items-center gap-1.5 font-black text-amber-300">
              <Sparkles className="w-4 h-4" />
              <span>كيف تنشئ كلمة مرور التطبيقات من Google في دقيقة واحدة؟</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-300 pr-1 leading-relaxed">
              <li>
                افتح الرابط المباشر من Google:{' '}
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
              <li>انسخ الكود المكون من 16 حرفاً وضعه في الخانة أعلاه واضغط حفظ.</li>
            </ol>
          </div>

          {statusMsg && (
            <div
              className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                statusMsg.type === 'success'
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                  : 'bg-red-500/20 border-red-500/40 text-red-200'
              }`}
            >
              {statusMsg.type === 'success' ? (
                <Check className="w-4 h-4 shrink-0" />
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

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#065f46]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-white/20 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSaving || isTesting}
              className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-[#022c22] text-xs font-black flex items-center gap-2 cursor-pointer shadow-lg transition-all active:scale-95 disabled:opacity-50"
            >
              {isSaving || isTesting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{isTesting ? 'جارٍ إرسال البريد التجريبي...' : 'جارٍ الحفظ والتفعيل...'}</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>حفظ وتفعيل الإرسال الفعلي</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
