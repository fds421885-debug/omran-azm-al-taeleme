import React, { ErrorInfo, ReactNode } from 'react';
import { RefreshCw, LogOut, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
  tabName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

/**
 * Resilient ErrorBoundary for Omran Quran Platform.
 * Attempts brief auto-recovery once for transient state glitches,
 * and shows a clear Arabic recovery screen if an error persists instead of a blank screen.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    retryCount: 0,
  };

  private lastErrorAt = 0;

  constructor(props: Props) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught runtime error:', error, errorInfo);
    const now = Date.now();
    const isRapidRepeat = now - this.lastErrorAt < 3000;
    this.lastErrorAt = now;

    try {
      if (this.props.onReset) {
        this.props.onReset();
      }
    } catch {}

    this.setState(prev => {
      const nextCount = isRapidRepeat ? prev.retryCount + 1 : 1;
      if (nextCount <= 1) {
        setTimeout(() => {
          this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
          });
        }, 80);
      }
      return {
        errorInfo,
        retryCount: nextCount,
      };
    });
  }

  handleRetry = () => {
    if (this.props.onReset) {
      try {
        this.props.onReset();
      } catch {}
    }
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    });
  };

  handleSafeReload = () => {
    try {
      window.location.reload();
    } catch {}
  };

  handleSafeLogout = () => {
    try {
      localStorage.removeItem('omran_session');
      sessionStorage.removeItem('omran_session');
      localStorage.removeItem('omran_selected_complex_id');
      window.location.href = '/';
    } catch {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.state.retryCount <= 1) {
        return (
          <div className="min-h-screen bg-[#131f24] text-white flex items-center justify-center p-6" dir="rtl">
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-[#1b2e35] border-2 border-b-4 border-[#ffc800]/50 text-sm font-black text-[#ffc800]">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>جارٍ استعادة العرض...</span>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-[#131f24] text-white flex items-center justify-center p-4 sm:p-6" dir="rtl">
          <div className="w-full max-w-md bg-[#1b2e35] border-2 border-b-[6px] border-[#2b4550] rounded-[28px] p-6 sm:p-8 shadow-2xl text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border-2 border-b-4 border-amber-400/60 text-amber-300 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg sm:text-xl font-black text-white">
                {this.props.fallbackTitle || 'حدث تعثر مؤقت في عرض الصفحة'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 font-bold leading-relaxed">
                {this.props.fallbackMessage || 'تم منع الشاشة الفارغة تلقائياً. يمكنك إعادة المحاولة أو تحديث الصفحة أو إعادة تسجيل الدخول.'}
              </p>
              {this.state.error?.message && (
                <div className="mt-2 p-2.5 rounded-xl bg-[#131f24] border border-white/10 text-[11px] font-mono text-amber-300/90 break-words" dir="ltr">
                  {this.state.error.message}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2.5 pt-1">
              <button
                type="button"
                onClick={this.handleRetry}
                className="w-full py-3 px-4 rounded-2xl bg-[#ffc800] hover:brightness-105 text-[#131f24] font-black text-xs sm:text-sm border-2 border-[#ffc800] border-b-4 border-b-[#c99d00] active:translate-y-0.5 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span>إعادة المحاولة الآن</span>
              </button>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={this.handleSafeReload}
                  className="py-2.5 px-3 rounded-2xl bg-[#203843] hover:bg-[#274452] text-white font-bold text-xs border-2 border-[#2b4550] border-b-4 cursor-pointer transition-all"
                >
                  تحديث الصفحة
                </button>
                <button
                  type="button"
                  onClick={this.handleSafeLogout}
                  className="py-2.5 px-3 rounded-2xl bg-red-500/15 hover:bg-red-500/25 text-red-300 font-bold text-xs border-2 border-red-500/40 border-b-4 border-b-red-700 flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>إعادة الدخول</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

