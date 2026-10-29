import React from 'react';
import {
  Library,
  Link2,
  FolderOpen,
  ShieldCheck,
  X,
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  HardDrive,
  CheckCircle2,
  Building2
} from 'lucide-react';
import { LibraryDocument, QuranComplex } from '../../types';
import { GoogleWorkspaceService } from '../../lib/googleWorkspace';

interface LibraryLinkRequiredModalProps {
  isOpen: boolean;
  complex?: QuranComplex | null;
  pendingDoc?: LibraryDocument | null;
  isLinking: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onLinkAndSaveNow: () => Promise<void>;
  onNavigateToLibrary: () => void;
}

export const LibraryLinkRequiredModal: React.FC<LibraryLinkRequiredModalProps> = ({
  isOpen,
  complex,
  pendingDoc,
  isLinking,
  errorMessage,
  onClose,
  onLinkAndSaveNow,
  onNavigateToLibrary
}) => {
  if (!isOpen) return null;

  const complexTitle = complex?.name || 'المجمع القرآني الحالي';
  const targetSection = pendingDoc
    ? GoogleWorkspaceService.resolveDocSection(pendingDoc)
    : 'general';
  const targetFolderTitle = GoogleWorkspaceService.getSectionArabicTitle(targetSection);

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg rounded-[32px] bg-[var(--complex-card,#203843)] border-2 border-b-[8px] border-[var(--complex-accent,#ffc800)] shadow-2xl overflow-hidden text-[var(--complex-text,#ffffff)]">
        {/* Top Accent Header */}
        <div className="relative px-6 pt-7 pb-6 bg-[var(--complex-secondary,#1b2e35)] border-b-2 border-[var(--complex-border,#2b4550)]">
          <button
            type="button"
            onClick={onClose}
            disabled={isLinking}
            aria-label="إغلاق"
            className="absolute top-5 left-5 w-10 h-10 rounded-2xl bg-[var(--complex-card,#203843)] border-2 border-b-4 border-[var(--complex-border,#2b4550)] flex items-center justify-center text-slate-300 hover:text-white active:translate-y-[2px] active:border-b-2 transition-all disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-3xl bg-[var(--complex-accent,#ffc800)] text-slate-950 border-2 border-b-[5px] border-amber-600/60 flex items-center justify-center shrink-0 shadow-lg">
              <Library className="w-8 h-8 stroke-[2.5]" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[var(--complex-accent,#ffc800)] mb-1">
                <Building2 className="w-3.5 h-3.5" />
                <span>{complexTitle}</span>
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white">
                يرجى ربط المكتبة
              </h2>
              <p className="text-xs sm:text-sm font-bold text-slate-300 mt-1">
                تعمل المكتبة والأرشيف السحابي حصرياً عبر حساب Google Drive المستقل لهذا المجمع
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {pendingDoc && (
            <div className="rounded-2xl bg-[var(--complex-primary,#131f24)] border-2 border-b-4 border-[var(--complex-border,#2b4550)] p-4 flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#58cc02]/20 border-2 border-[#58cc02]/50 text-[#58cc02] flex items-center justify-center shrink-0">
                <FolderOpen className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold text-slate-400">الملف الجاهز للحفظ في المكتبة:</p>
                <p className="text-sm font-black text-white truncate mt-0.5">{pendingDoc.title}</p>
                <p className="text-xs font-bold text-[#58cc02] mt-1 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 shrink-0" />
                  <span>سيُحفظ تلقائياً في Google Drive داخل مجلد: «{targetFolderTitle}»</span>
                </p>
              </div>
            </div>
          )}

          {/* Drive Structure Preview */}
          <div className="rounded-2xl bg-[var(--complex-secondary,#1b2e35)] border-2 border-[var(--complex-border,#2b4550)] p-4 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-black text-[var(--complex-accent,#ffc800)]">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>عزل مستقل 100% لكل مجمع + تنظيم تلقائي في Google Drive:</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs font-extrabold text-slate-200">
              <div className="flex items-center gap-2 rounded-xl bg-[var(--complex-card,#203843)] border border-[var(--complex-border,#2b4550)] px-3 py-2">
                <CheckCircle2 className="w-4 h-4 text-[#ffc800] shrink-0" />
                <span>مجلد الشهادات</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-[var(--complex-card,#203843)] border border-[var(--complex-border,#2b4550)] px-3 py-2">
                <CheckCircle2 className="w-4 h-4 text-[#58cc02] shrink-0" />
                <span>مجلد الحضور والغياب</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-[var(--complex-card,#203843)] border border-[var(--complex-border,#2b4550)] px-3 py-2">
                <CheckCircle2 className="w-4 h-4 text-[#ce82ff] shrink-0" />
                <span>مجلد الاختبارات</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-[var(--complex-card,#203843)] border border-[var(--complex-border,#2b4550)] px-3 py-2">
                <CheckCircle2 className="w-4 h-4 text-[#1cb0f6] shrink-0" />
                <span>مجلد التقارير الدورية</span>
              </div>
            </div>
            <p className="text-[11px] font-bold text-slate-400 leading-relaxed pt-1">
              ملاحظة: ربط حساب Google هنا يفعّل المكتبة وقسم الاختبارات (نماذج وجداول Google) لهذا المجمع معاً دون أي تداخل مع المجمعات الأخرى.
            </p>
          </div>

          {errorMessage && (
            <div className="rounded-2xl bg-rose-500/15 border-2 border-b-4 border-rose-500/50 p-3.5 flex items-start gap-2.5 text-rose-200 text-xs font-extrabold">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Buttons (Duolingo 3D Tactile Style) */}
          <div className="space-y-3 pt-1">
            <button
              type="button"
              onClick={onLinkAndSaveNow}
              disabled={isLinking}
              className="w-full py-3.5 px-5 rounded-2xl bg-[#58cc02] hover:bg-[#61e002] text-white font-black text-sm sm:text-base border-2 border-b-[5px] border-[#46a302] active:translate-y-[2px] active:border-b-2 transition-all flex items-center justify-center gap-2.5 shadow-lg disabled:opacity-60"
            >
              {isLinking ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>جاري ربط المكتبة بـ Google Drive وحفظ الملف...</span>
                </>
              ) : (
                <>
                  <Link2 className="w-5 h-5 stroke-[2.5]" />
                  <span>
                    {pendingDoc
                      ? 'ربط المكتبة بحساب Google وحفظ الملف الآن'
                      : 'ربط المكتبة بحساب Google وتفعيلها الآن'}
                  </span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onNavigateToLibrary}
                disabled={isLinking}
                className="flex-1 py-3 px-4 rounded-2xl bg-[var(--complex-accent,#ffc800)] hover:brightness-105 text-slate-950 font-black text-xs sm:text-sm border-2 border-b-4 border-amber-600/70 active:translate-y-[2px] active:border-b-2 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Library className="w-4 h-4" />
                <span>الذهاب إلى قسم المكتبة</span>
                <ArrowLeft className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={isLinking}
                className="py-3 px-5 rounded-2xl bg-[var(--complex-secondary,#1b2e35)] hover:bg-[var(--complex-border,#2b4550)] text-slate-300 font-extrabold text-xs sm:text-sm border-2 border-b-4 border-[var(--complex-border,#2b4550)] active:translate-y-[2px] active:border-b-2 transition-all disabled:opacity-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
