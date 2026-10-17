import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail,
  X,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Building2,
  Clock,
  CheckCircle2,
  ShieldCheck,
  Send
} from 'lucide-react';
import { BrandedEmailPayload } from '../../lib/portalEmailService';
import { darkenHex, lightenHex, getContrastTextColor } from '../../lib/themeUtils';

interface BrandedEmailViewerModalProps {
  email: BrandedEmailPayload | null;
  onClose: () => void;
  onCopyOtp?: (code: string) => void;
}

export const BrandedEmailViewerModal: React.FC<BrandedEmailViewerModalProps> = ({
  email,
  onClose,
  onCopyOtp
}) => {
  const [copied, setCopied] = useState(false);

  if (!email) return null;

  const theme = email.complexTheme || {
    primaryColor: '#131f24',
    secondaryColor: '#1b2e35',
    accentColor: '#58cc02',
    backgroundColor: '#131f24',
    cardColor: '#203843',
    textColor: '#ffffff'
  };

  const accentColor = theme.accentColor || '#58cc02';
  const accentShadow = darkenHex(accentColor, 0.28);
  const cardColor = theme.cardColor || '#203843';
  const cardBorder = lightenHex(cardColor, 0.2);
  const accentTextColor = getContrastTextColor(accentColor);

  const handleCopyCode = () => {
    if (email.highlightBox?.value) {
      navigator.clipboard.writeText(email.highlightBox.value);
      setCopied(true);
      if (onCopyOtp) onCopyOtp(email.highlightBox.value);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[10020] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
    >
      <div
        className="relative w-full max-w-lg rounded-3xl border-2 border-b-4 shadow-2xl overflow-hidden flex flex-col my-auto animate-in zoom-in-95 duration-150"
        style={{
          backgroundColor: cardColor,
          borderColor: cardBorder,
          borderBottomColor: darkenHex(cardColor, 0.4)
        }}
      >
        {/* Email Header Bar */}
        <div
          className="p-4 border-b-2 flex items-center justify-between gap-3"
          style={{
            backgroundColor: `${theme.primaryColor || '#131f24'}f5`,
            borderColor: cardBorder
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-black shadow-md shrink-0 border-2"
              style={{
                backgroundColor: `${accentColor}25`,
                borderColor: accentColor,
                color: accentColor
              }}
            >
              <Mail className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-black border"
                  style={{
                    backgroundColor: `${accentColor}20`,
                    borderColor: `${accentColor}60`,
                    color: accentColor
                  }}
                >
                  صندوق بريدك الوارد
                </span>
                <span className="text-[10px] text-slate-300 font-mono">support@omran.com</span>
              </div>
              <h3 className="text-xs sm:text-sm font-black text-white truncate font-heading mt-0.5">
                {email.subject}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Branded Email Canvas */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Email Subject & Meta Card */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-300 font-bold">
              <span>من: <strong>منظومة عُمْرَان &lt;support@omran.com&gt;</strong></span>
              <span className="text-[10px] text-slate-400 font-mono">
                {new Date(email.sentAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="text-slate-300 font-bold">
              إلى: <strong className="text-white font-mono" dir="ltr">{email.toEmail}</strong>
            </div>
          </div>

          {/* Branded Body Card */}
          <div
            className="rounded-2xl border-2 p-5 space-y-4 shadow-sm"
            style={{
              backgroundColor: theme.backgroundColor || '#131f24',
              borderColor: cardBorder
            }}
          >
            {/* Complex Branded Banner */}
            <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center font-black"
                style={{
                  backgroundColor: `${accentColor}20`,
                  color: accentColor
                }}
              >
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-black text-white">{email.title}</h4>
                <span className="text-[10px] text-slate-300 font-bold">{email.complexName}</span>
              </div>
            </div>

            {/* Greeting */}
            <p className="text-xs sm:text-sm font-black text-white">{email.greeting}</p>

            {/* Paragraphs */}
            <div className="space-y-2 text-xs text-slate-200 font-bold leading-relaxed">
              {email.bodyParagraphs.map((p, idx) => (
                <p key={idx}>{p}</p>
              ))}
            </div>

            {/* Highlight Box (OTP Code or Queue position) */}
            {email.highlightBox && (
              <div
                className="p-4 rounded-2xl border-2 border-b-4 text-center space-y-2 shadow-md my-3"
                style={{
                  backgroundColor: cardColor,
                  borderColor: accentColor,
                  borderBottomColor: accentShadow
                }}
              >
                <span className="text-[11px] font-bold text-slate-300 block">
                  {email.highlightBox.label}
                </span>

                <div
                  className="text-2xl sm:text-3xl font-black font-mono tracking-widest"
                  style={{ color: accentColor }}
                >
                  {email.highlightBox.value}
                </div>

                {email.highlightBox.sublabel && (
                  <p className="text-[10px] text-slate-300 font-bold">
                    {email.highlightBox.sublabel}
                  </p>
                )}

                {/* Quick 1-Click Copy Code Button if numeric OTP */}
                {email.highlightBox.value.length === 6 && /^\d+$/.test(email.highlightBox.value) && (
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="mt-2 w-full py-2 px-3 rounded-xl border-2 border-b-2 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:translate-y-0.5"
                    style={{
                      backgroundColor: accentColor,
                      borderColor: accentColor,
                      color: accentTextColor
                    }}
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'تم نسخ الرمز!' : 'نسخ رمز التحقق وتعبئته'}</span>
                  </button>
                )}
              </div>
            )}

            {/* Action Link Button */}
            {email.actionButton && (
              <a
                href={email.actionButton.url}
                className="w-full py-3 rounded-xl border-2 border-b-4 text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-all active:translate-y-0.5 hover:brightness-110 shadow-md text-white text-center"
                style={{
                  backgroundColor: accentColor,
                  borderColor: accentColor,
                  borderBottomColor: accentShadow,
                  color: accentTextColor
                }}
              >
                <span>{email.actionButton.text}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            {/* Footer Branded Note */}
            <p className="text-[10px] text-slate-400 font-bold pt-3 border-t border-white/10 leading-relaxed">
              {email.footerNote}
            </p>
          </div>
        </div>

        {/* Bottom Close Action */}
        <div className="p-3 border-t border-white/10 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-black text-slate-200 hover:text-white bg-white/5 hover:bg-white/10 cursor-pointer"
          >
            إغلاق الرسالة
          </button>
        </div>
      </div>
    </div>
  );
};
