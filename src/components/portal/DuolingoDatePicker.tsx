import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, Sparkles, X } from 'lucide-react';

interface DuolingoDatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (val: string) => void;
  placeholder?: string;
  required?: boolean;
  themeBg?: string;
  themeCard?: string;
  themeCardBorder?: string;
  themeAccent?: string;
  themeAccentShadow?: string;
  minYear?: number;
  maxYear?: number;
  allowClear?: boolean;
}

export const DuolingoDatePicker: React.FC<DuolingoDatePickerProps> = ({
  value,
  onChange,
  placeholder = 'اختر التاريخ',
  required = false,
  themeBg = '#131f24',
  themeCard = '#203843',
  themeCardBorder = '#2b4550',
  themeAccent = '#ffc800',
  themeAccentShadow = '#e5a500',
  minYear = 1950,
  maxYear = 2050,
  allowClear = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const parseIsoDateLocal = (isoStr: string): Date => {
    const parts = (isoStr || '').split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  };

  const formatLocalIsoDate = (dateObj: Date): string => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const [pickerMonthDate, setPickerMonthDate] = useState<Date>(() => {
    const initial = parseIsoDateLocal(value || todayStr);
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });

  // Keep month view in sync if value changes externally
  useEffect(() => {
    if (value) {
      const parsed = parseIsoDateLocal(value);
      setPickerMonthDate(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    }
  }, [value]);

  // Handle outside click & escape key
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const ARABIC_WEEKDAYS_SHORT = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
  const ARABIC_WEEKDAYS_FULL = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const ARABIC_GREGORIAN_MONTHS = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];

  const selectedDisplay = useMemo(() => {
    if (!value) return null;
    const d = parseIsoDateLocal(value);
    const weekday = ARABIC_WEEKDAYS_FULL[d.getDay()] || '';
    const monthName = ARABIC_GREGORIAN_MONTHS[d.getMonth()] || '';
    let hijriStr = '';
    try {
      hijriStr = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(d);
    } catch {
      hijriStr = '';
    }
    return {
      weekday,
      dayNum: d.getDate(),
      monthName,
      yearNum: d.getFullYear(),
      label: `${weekday} • ${d.getDate()} ${monthName} ${d.getFullYear()}`,
      hijriStr
    };
  }, [value]);

  const currentYear = pickerMonthDate.getFullYear();
  const currentMonthIdx = pickerMonthDate.getMonth();

  const pickerMonthHeader = useMemo(() => {
    const monthName = ARABIC_GREGORIAN_MONTHS[currentMonthIdx] || '';
    let hijriMonthYear = '';
    try {
      hijriMonthYear = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
        month: 'long',
        year: 'numeric'
      }).format(new Date(currentYear, currentMonthIdx, 15));
    } catch {
      hijriMonthYear = '';
    }
    return { monthName, yearNum: currentYear, hijriMonthYear };
  }, [currentYear, currentMonthIdx]);

  const pickerCalendarCells = useMemo(() => {
    const year = currentYear;
    const month = currentMonthIdx;
    const firstDayWeekday = new Date(year, month, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: Array<{
      iso: string;
      day: number;
      inCurrentMonth: boolean;
    }> = [];

    // Leading days from previous month
    for (let i = firstDayWeekday - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const dObj = new Date(year, month - 1, dayNum);
      cells.push({
        iso: formatLocalIsoDate(dObj),
        day: dayNum,
        inCurrentMonth: false
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dObj = new Date(year, month, d);
      cells.push({
        iso: formatLocalIsoDate(dObj),
        day: d,
        inCurrentMonth: true
      });
    }

    // Trailing days
    const totalTarget = cells.length <= 35 ? 35 : 42;
    let nextDay = 1;
    while (cells.length < totalTarget) {
      const dObj = new Date(year, month + 1, nextDay);
      cells.push({
        iso: formatLocalIsoDate(dObj),
        day: nextDay,
        inCurrentMonth: false
      });
      nextDay++;
    }

    return cells;
  }, [currentYear, currentMonthIdx]);

  const yearsOptions = useMemo(() => {
    const list: number[] = [];
    for (let y = maxYear; y >= minYear; y--) {
      list.push(y);
    }
    return list;
  }, [minYear, maxYear]);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Hidden input for form validation */}
      {required && (
        <input
          type="text"
          value={value || ''}
          onChange={() => {}}
          required={required}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      )}

      {/* Main Trigger Button */}
      <div
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full flex items-center justify-between gap-2 border-2 border-b-4 rounded-2xl py-2.5 px-3.5 text-xs sm:text-sm font-bold cursor-pointer transition-all active:translate-y-[2px] active:border-b-2 shadow-sm select-none"
        style={{
          backgroundColor: themeBg,
          borderColor: isOpen ? themeAccent : themeCardBorder,
          borderBottomColor: isOpen ? themeAccentShadow : themeCardBorder,
          color: value ? '#ffffff' : '#94a3b8'
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border-2"
            style={{
              backgroundColor: `${themeAccent}20`,
              borderColor: `${themeAccent}50`,
              color: themeAccent
            }}
          >
            <Calendar className="w-3.5 h-3.5" />
          </div>

          <div className="text-right truncate">
            {selectedDisplay ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-black">{selectedDisplay.label}</span>
                <span
                  className="font-mono text-[11px] px-2 py-0.5 rounded-lg border"
                  style={{
                    backgroundColor: themeCard,
                    borderColor: themeCardBorder,
                    color: themeAccent
                  }}
                >
                  {value}
                </span>
                {selectedDisplay.hijriStr && (
                  <span className="text-[10px] text-amber-200/80 font-bold hidden sm:inline">
                    ({selectedDisplay.hijriStr})
                  </span>
                )}
              </div>
            ) : (
              <span className="text-slate-400 font-bold">{placeholder}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {value && allowClear && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onChange('');
              }}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title="مسح التاريخ"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            style={{ color: themeAccent }}
          />
        </div>
      </div>

      {/* Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="duo-complex-datepicker-popover absolute top-full left-0 right-0 sm:right-auto sm:w-[350px] mt-2.5 z-50 space-y-3"
            style={{
              backgroundColor: themeBg,
              borderColor: themeAccent,
              borderBottomColor: themeAccentShadow
            }}
          >
            {/* Header: Selected Date Banner */}
            <div
              className="duo-complex-datepicker-selected-banner flex items-center justify-between gap-2"
              style={{
                backgroundColor: `${themeAccent}18`,
                borderColor: `${themeAccent}50`
              }}
            >
              <div className="text-right">
                <div className="text-[11px] font-black" style={{ color: themeAccent }}>
                  التاريخ المختار
                </div>
                <div className="text-xs font-black mt-0.5 text-white">
                  {selectedDisplay ? selectedDisplay.label : 'لم يتم التحديد بعد'}
                </div>
                {selectedDisplay?.hijriStr && (
                  <div className="text-[10px] text-amber-200/90 font-bold mt-0.5">
                    {selectedDisplay.hijriStr}
                  </div>
                )}
              </div>

              {value && (
                <span
                  className="font-mono text-xs font-black px-2.5 py-1 rounded-xl border-2"
                  style={{
                    backgroundColor: themeCard,
                    borderColor: themeCardBorder,
                    color: themeAccent
                  }}
                >
                  {value}
                </span>
              )}
            </div>

            {/* Quick Month & Year Navigators with Year Select */}
            <div
              className="duo-complex-datepicker-monthbar flex items-center justify-between gap-2"
              style={{
                backgroundColor: themeCard,
                borderColor: themeCardBorder
              }}
            >
              <button
                type="button"
                title="الشهر السابق"
                onClick={() =>
                  setPickerMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
                }
                className="duo-complex-date-step-btn cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1.5">
                {/* Month Dropdown */}
                <select
                  value={currentMonthIdx}
                  onChange={e =>
                    setPickerMonthDate(new Date(currentYear, Number(e.target.value), 1))
                  }
                  className="bg-transparent text-xs font-black font-heading outline-none cursor-pointer border-b border-dashed pb-0.5"
                  style={{
                    color: themeAccent,
                    borderColor: `${themeAccent}60`
                  }}
                >
                  {ARABIC_GREGORIAN_MONTHS.map((m, idx) => (
                    <option key={m} value={idx} className="bg-slate-900 text-white">
                      {m}
                    </option>
                  ))}
                </select>

                {/* Year Dropdown */}
                <select
                  value={currentYear}
                  onChange={e =>
                    setPickerMonthDate(new Date(Number(e.target.value), currentMonthIdx, 1))
                  }
                  className="bg-transparent text-xs font-black font-mono outline-none cursor-pointer border-b border-dashed pb-0.5"
                  style={{
                    color: themeAccent,
                    borderColor: `${themeAccent}60`
                  }}
                >
                  {yearsOptions.map(y => (
                    <option key={y} value={y} className="bg-slate-900 text-white">
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                title="الشهر التالي"
                onClick={() =>
                  setPickerMonthDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
                }
                className="duo-complex-date-step-btn cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Hijri Month Indicator */}
            {pickerMonthHeader.hijriMonthYear && (
              <div className="text-center text-[10px] font-bold text-amber-200/80 -mt-1">
                {pickerMonthHeader.hijriMonthYear}
              </div>
            )}

            {/* Weekday Row */}
            <div className="grid grid-cols-7 gap-1.5">
              {ARABIC_WEEKDAYS_SHORT.map(dayLabel => (
                <div key={dayLabel} className="duo-complex-weekday-cell">
                  {dayLabel}
                </div>
              ))}
            </div>

            {/* Tactile 3D Day Selection Grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {pickerCalendarCells.map(cell => {
                const isSelected = cell.iso === value;
                const isTodayCell = cell.iso === todayStr;

                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={() => {
                      onChange(cell.iso);
                      setIsOpen(false);
                    }}
                    className={`duo-complex-day-btn cursor-pointer font-mono ${
                      !cell.inCurrentMonth ? 'is-outside' : ''
                    } ${isTodayCell ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}`}
                  >
                    <span>{cell.day}</span>
                    {isTodayCell && (
                      <span
                        className="w-1.5 h-1.5 rounded-full mt-0.5"
                        style={{
                          backgroundColor: isSelected ? '#131f24' : themeAccent
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Popover Footer Actions */}
            <div
              className="flex items-center justify-between gap-2 pt-2.5 border-t-2"
              style={{ borderColor: themeCardBorder }}
            >
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onChange(todayStr);
                    setIsOpen(false);
                  }}
                  className={`duo-complex-today-btn text-[11px] cursor-pointer ${
                    value === todayStr ? 'is-active' : ''
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>اليوم</span>
                </button>
                {value && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange('');
                      setIsOpen(false);
                    }}
                    className="duo-complex-today-btn text-[11px] cursor-pointer text-red-300"
                  >
                    مسح
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="duo-btn-dark px-3.5 py-1.5 text-[11px] cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
