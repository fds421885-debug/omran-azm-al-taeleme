import React, { useState } from 'react';
import {
  AlertTriangle,
  MapPin,
  Users,
  CheckCircle2,
  X,
  ArrowLeft,
  Save,
  Compass
} from 'lucide-react';
import { QuranComplex, Halaqah, Mosque } from '../../types';
import { OmranDataService } from '../../lib/firebase';

interface PortalPreFlightChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  complex: QuranComplex;
  halaqahs: Halaqah[];
  onCompleteAndProceed: () => void;
  onSaveComplex?: (c: QuranComplex) => Promise<void> | void;
  onSaveHalaqah?: (h: Halaqah) => Promise<void> | void;
}

export const PortalPreFlightChecklistModal: React.FC<PortalPreFlightChecklistModalProps> = ({
  isOpen,
  onClose,
  complex,
  halaqahs,
  onCompleteAndProceed,
  onSaveComplex,
  onSaveHalaqah
}) => {
  if (!isOpen) return null;

  // 1. Mosques requiring location
  const mosquesList = complex.mosques || [];
  const missingLocationMosques = mosquesList.filter(
    m => (!m.latitude && !m.longitude) || (!m.address && !m.locationName)
  );

  // 2. Halaqahs requiring capacity
  const missingCapacityHalaqahs = halaqahs.filter(h => !h.capacity || h.capacity <= 0);

  // Local state for editing missing values
  const [editedCapacities, setEditedCapacities] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    missingCapacityHalaqahs.forEach(h => {
      init[h.id] = 15; // default 15
    });
    return init;
  });

  const [editedAddresses, setEditedAddresses] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    missingLocationMosques.forEach(m => {
      init[m.id] = m.address || 'حي المجمع - بجوار المسجد الجامع';
    });
    return init;
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleSaveAndProceed = async () => {
    setIsSaving(true);
    try {
      // 1. Update mosques if any had missing locations
      if (missingLocationMosques.length > 0 && complex.mosques) {
        const updatedMosques = complex.mosques.map(m => {
          if (editedAddresses[m.id]) {
            return {
              ...m,
              address: editedAddresses[m.id],
              latitude: m.latitude || 24.7136,
              longitude: m.longitude || 46.6753
            };
          }
          return m;
        });
        const updatedC = { ...complex, mosques: updatedMosques };
        if (onSaveComplex) {
          await onSaveComplex(updatedC);
        } else {
          await OmranDataService.saveComplex(updatedC);
        }
      }

      // 2. Update halaqahs capacities
      for (const h of missingCapacityHalaqahs) {
        const cap = editedCapacities[h.id] || 15;
        const updatedH: Halaqah = { ...h, capacity: cap, maxStudents: cap };
        if (onSaveHalaqah) {
          await onSaveHalaqah(updatedH);
        } else {
          await OmranDataService.saveHalaqah(updatedH);
        }
      }

      onClose();
      onCompleteAndProceed();
    } catch (e) {
      console.warn('Pre-flight save note:', e);
      onClose();
      onCompleteAndProceed();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100005] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-[#022c22] border-2 border-amber-400 rounded-3xl max-w-xl w-full shadow-2xl p-5 sm:p-7 space-y-5 text-right my-auto animate-fadeIn" dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#065f46] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-400/40 shrink-0">
              <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white font-heading">
                تنبيه هام قبل فتح ومشاركة رابط التسجيل
              </h3>
              <p className="text-xs text-[#86efac]">
                لضمان دقة توجيه الذكاء الاصطناعي للطلاب وتسكينهم في أقرب مسجد وحلقة بسعة شاغرة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Checklists */}
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Missing Mosque Locations */}
          {missingLocationMosques.length > 0 && (
            <div className="p-4 rounded-2xl bg-[#064e3b]/60 border border-amber-400/30 space-y-3">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
                <span>مساجد تحتاج تحديد الموقع (ليتعرف عليها الذكاء الاصطناعي):</span>
              </div>
              <div className="space-y-2">
                {missingLocationMosques.map(m => (
                  <div key={m.id} className="p-2.5 rounded-xl bg-[#021f18] border border-[#065f46] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white">{m.name}</span>
                    <input
                      type="text"
                      placeholder="عنوان المسجد / الحي"
                      value={editedAddresses[m.id] || ''}
                      onChange={e => setEditedAddresses({ ...editedAddresses, [m.id]: e.target.value })}
                      className="bg-[#064e3b] border border-[#065f46] rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-amber-400"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Missing Halaqah Capacities */}
          {missingCapacityHalaqahs.length > 0 && (
            <div className="p-4 rounded-2xl bg-[#064e3b]/60 border border-amber-400/30 space-y-3">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                <Users className="w-4 h-4 text-amber-400 shrink-0" />
                <span>حلقات تحتاج تحديد السعة الاستيعابية القصوى (عدد الطلاب المسموح به):</span>
              </div>
              <div className="space-y-2">
                {missingCapacityHalaqahs.map(h => (
                  <div key={h.id} className="p-2.5 rounded-xl bg-[#021f18] border border-[#065f46] flex items-center justify-between gap-3">
                    <div className="text-xs">
                      <span className="font-bold text-white block">{h.name}</span>
                      <span className="text-[10px] text-slate-400">
                        {h.primaryTeacherName ? `المعلم: ${h.primaryTeacherName}` : 'لم يحدد معلم بعد'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-emerald-300 font-bold">السعة القصوى:</span>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={editedCapacities[h.id] || 15}
                        onChange={e => setEditedCapacities({
                          ...editedCapacities,
                          [h.id]: Math.max(1, parseInt(e.target.value) || 15)
                        })}
                        className="w-16 bg-[#064e3b] border border-[#065f46] rounded-lg px-2 py-1 text-center text-xs text-white font-mono font-bold outline-none focus:border-amber-400"
                      />
                      <span className="text-[10px] text-slate-300">طالب</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#065f46]">
          <button
            type="button"
            onClick={() => {
              onClose();
              onCompleteAndProceed();
            }}
            className="text-xs text-slate-400 hover:text-white underline cursor-pointer py-1"
          >
            تجاوز والمتابعة على أي حال
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveAndProceed}
            className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#fbbf24] hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all active:scale-95 disabled:opacity-50"
          >
            <CheckCircle2 className="w-5 h-5 text-slate-950" />
            <span>حفظ البيانات ومتابعة فتح الرابط</span>
          </button>
        </div>
      </div>
    </div>
  );
};
