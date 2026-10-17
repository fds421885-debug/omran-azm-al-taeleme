import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail,
  X,
  Copy,
  Check,
  ExternalLink,
  Clock,
  Building2
} from 'lucide-react';
import { BrandedEmailPayload } from '../../lib/portalEmailService';
import { darkenHex, getContrastTextColor } from '../../lib/themeUtils';

export const PortalEmailNotificationToast: React.FC = () => {
  const [activeEmail, setActiveEmail] = useState<BrandedEmailPayload | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [autoDismissTimer, setAutoDismissTimer] = useState<any>(null);

  useEffect(() => {
    const handleEmailSent = (e: any) => {
      if (e.detail) {
        const payload = e.detail as BrandedEmailPayload;
        setActiveEmail(payload);
        setCopiedCode(false);

        // Auto dismiss after 20 seconds unless user is interacting
        if (autoDismissTimer) clearTimeout(autoDismissTimer);
        const timer = setTimeout(() => {
          setActiveEmail(prev => (prev === payload ? null : prev));
        }, 20000);
        setAutoDismissTimer(timer);
      }
    };

    window.addEventListener('omran:portal-email-sent', handleEmailSent);
    return () => {
      window.removeEventListener('omran:portal-email-sent', handleEmailSent);
      if (autoDismissTimer) clearTimeout(autoDismissTimer);
    };
  }, []);

  if (!activeEmail) return null;

  const themeAccent = activeEmail.complexTheme?.accentColor || '#58cc02';
  const themeAccentShadow = darkenHex(themeAccent, 0.28);
  const accentTextColor = getContrastTextColor(themeAccent);

  const handleCopyOtp = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <>
      {/* Floating Interactive Toast at top of page */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -30, scale: 0.95 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed top-4 right-4 left-4 sm:left-auto sm:right-6 sm:w-[440px] z-[99999] pointer-events-auto"
          dir="rtl"
        >
          <div
            className="rounded-2xl border-2 border-b-4 p-4 shadow-2xl backdrop-blur-xl space-y-3 bg-[#17262d]/95 text-white"
            style={{
              borderColor: themeAccent,
              borderBottomColor: themeAccentShadow
            }}
          >
            {/* Header: Sender info */}
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center font-black shrink-0"
                  style={{
                    backgroundColor: `${themeAccent}25`,
                    color: themeAccent
                  }}
                >
                  <Mail className="w-4 h-4 stroke-[2.3]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-white truncate">
                      رسالة بريد جديدة
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                      {activeEmail.fromEmail}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-300 truncate">
                    إلى: <strong>{activeEmail.toEmail}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveEmail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="إغلاق الإشعار"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Subject and Title */}
            <div>
              <h5 className="text-xs font-black text-white line-clamp-1">
                {activeEmail.subject}
              </h5>
              <p className="text-[11px] text-slate-300 font-bold line-clamp-1 mt-0.5">
                {activeEmail.greeting}
              </p>
            </div>

            {/* If Highlight Box (e.g. 6-digit OTP code or Queue status) */}
            {activeEmail.highlightBox && (
              <div
                className="p-3 rounded-xl border-2 flex items-center justify-between gap-3 bg-black/40"
                style={{ borderColor: `${themeAccent}60` }}
              >
                <div>
                  <span className="text-[10px] text-slate-300 font-bold block">
                    {activeEmail.highlightBox.label}
                  </span>
                  <span
                    className="text-xl font-black font-mono tracking-wider"
                    style={{ color: themeAccent }}
                  >
                    {activeEmail.highlightBox.value}
                  </span>
                  {activeEmail.highlightBox.sublabel && (
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {activeEmail.highlightBox.sublabel}
                    </span>
                  )}
                </div>

                {/* If numeric code: Direct Copy Button */}
                {/^\d{4,8}$/.test(activeEmail.highlightBox.value.trim()) && (
                  <button
                    type="button"
                    onClick={() => handleCopyOtp(activeEmail.highlightBox!.value.trim())}
                    className="px-3.5 py-2 rounded-xl border-2 border-b-2 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:translate-y-0.5 hover:brightness-110 shadow-sm shrink-0"
                    style={{
                      backgroundColor: themeAccent,
                      borderColor: themeAccent,
                      color: accentTextColor
                    }}
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'تم النسخ!' : 'نسخ الرمز'}</span>
                  </button>
                )}
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>الآن</span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(true)}
                  className="px-3 py-1.5 rounded-xl border border-white/20 text-xs font-black text-amber-300 hover:bg-white/10 transition-colors cursor-pointer"
                >
                  معاينة البريد كاملاً ✉️
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Full Screen Branded Email Preview Modal */}
      {isPreviewOpen && (
        <div
          dir="rtl"
          className="fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto"
        >
          <div className="relative w-full max-w-xl rounded-3xl border-2 border-b-4 shadow-2xl bg-[#1b2e35] text-white p-6 space-y-5 my-auto max-h-[90vh] overflow-y-auto">
            {/* Modal Top Bar */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-amber-400" />
                <div>
                  <h4 className="text-sm font-black text-white">صندوق بريد منصة عُمران</h4>
                  <span className="text-[10px] text-slate-400 font-bold">
                    معاينة البريد الإلكتروني الواصل للطالب
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Simulated Email Envelope */}
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1 text-xs">
              <div>
                <span className="text-slate-400 font-bold">من: </span>
                <span className="font-mono text-emerald-300">{activeEmail.fromEmail}</span>
                <span className="text-slate-400 mr-2">({activeEmail.complexName})</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold">إلى: </span>
                <span className="font-mono text-white">{activeEmail.toEmail}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold">الموضوع: </span>
                <span className="font-black text-amber-300">{activeEmail.subject}</span>
              </div>
            </div>

            {/* Branded Email Content Body */}
            <div
              className="rounded-2xl border-2 p-5 space-y-4 bg-[#131f24]"
              style={{ borderColor: `${themeAccent}50` }}
            >
              {/* Complex Header */}
              <div className="text-center border-b border-white/10 pb-4 space-y-1">
                <div
                  className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center font-black border-2"
                  style={{
                    backgroundColor: `${themeAccent}20`,
                    borderColor: themeAccent,
                    color: themeAccent
                  }}
                >
                  <Building2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-white">{activeEmail.complexName}</h3>
                <span className="text-xs text-slate-400 font-bold">{activeEmail.title}</span>
              </div>

              {/* Greeting & Paragraphs */}
              <div className="space-y-2 text-xs leading-relaxed text-slate-200">
                <p className="font-black text-amber-300">{activeEmail.greeting}</p>
                {activeEmail.bodyParagraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>

              {/* Highlight Box */}
              {activeEmail.highlightBox && (
                <div
                  className="p-4 rounded-2xl border-2 text-center space-y-1.5 my-3 bg-black/40"
                  style={{ borderColor: themeAccent }}
                >
                  <span className="text-xs font-bold text-slate-300 block">
                    {activeEmail.highlightBox.label}
                  </span>
                  <div
                    className="text-2xl sm:text-3xl font-black font-mono tracking-widest"
                    style={{ color: themeAccent }}
                  >
                    {activeEmail.highlightBox.value}
                  </div>
                  {activeEmail.highlightBox.sublabel && (
                    <span className="text-[11px] text-slate-400 block font-bold">
                      {activeEmail.highlightBox.sublabel}
                    </span>
                  )}
                  {/^\d{4,8}$/.test(activeEmail.highlightBox.value.trim()) && (
                    <button
                      type="button"
                      onClick={() => handleCopyOtp(activeEmail.highlightBox!.value.trim())}
                      className="mt-2 px-4 py-2 rounded-xl text-xs font-black inline-flex items-center gap-1.5 cursor-pointer shadow-md"
                      style={{
                        backgroundColor: themeAccent,
                        color: accentTextColor
                      }}
                    >
                      {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedCode ? 'تم نسخ الرمز بنجاح!' : 'نسخ الرمز'}</span>
                    </button>
                  )}
                </div>
              )}

              {/* Action Button if present */}
              {activeEmail.actionButton && (
                <div className="text-center pt-2">
                  <a
                    href={activeEmail.actionButton.url}
                    className="inline-flex items-center justify-center gap-2 py-3 px-6 rounded-2xl border-2 border-b-4 text-xs font-black cursor-pointer shadow-lg hover:brightness-110 active:translate-y-0.5"
                    style={{
                      backgroundColor: themeAccent,
                      borderColor: themeAccent,
                      borderBottomColor: themeAccentShadow,
                      color: accentTextColor
                    }}
                  >
                    <span>{activeEmail.actionButton.text}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {/* Footer Note */}
              <div className="pt-4 border-t border-white/10 text-[10px] text-slate-400 font-bold text-center leading-relaxed">
                {activeEmail.footerNote}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="px-5 py-2 rounded-xl border border-white/20 text-xs font-black text-white hover:bg-white/10 cursor-pointer"
              >
                إغلاق المعاينة
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
