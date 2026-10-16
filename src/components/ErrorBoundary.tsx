import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, ShieldCheck } from 'lucide-react';

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
}

/**
 * Enterprise-grade, resilient ErrorBoundary for Omran Quran Platform.
 * Shields users from white screens and unexpected render crashes,
 * with graceful recovery, diagnostic logging, and safe state recovery.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  constructor(props: Props) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[OmranErrorBoundary] Caught render exception:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleRetry = () => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleHardReload = () => {
    try {
      // Clear transient corrupt query params or modal flags
      sessionStorage.removeItem('omran_transient_error');
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isTabLevel = Boolean(this.props.tabName);

      return (
        <div
          dir="rtl"
          className={`flex flex-col items-center justify-center p-6 text-center select-none ${
            isTabLevel
              ? 'min-h-[420px] rounded-3xl bg-slate-900/60 border border-emerald-500/20 backdrop-blur-md m-4 shadow-2xl'
              : 'min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white'
          }`}
        >
          {/* Calming Decorative Badge */}
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/5">
              <ShieldCheck className="w-10 h-10 text-emerald-400" />
            </div>
            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            </span>
          </div>

          {/* Heading */}
          <h2 className="text-xl md:text-2xl font-bold text-white mb-2 font-serif">
            {this.props.fallbackTitle ||
              (isTabLevel
                ? `تعذر عرض ${this.props.tabName || 'هذا القسم'} مؤقتاً`
                : 'حدث تنبيه غير متوقع أثناء المعالجة')}
          </h2>

          <p className="text-sm md:text-base text-slate-300/80 max-w-md mb-6 leading-relaxed">
            {this.props.fallbackMessage ||
              'تم تفعيل درع الحماية الذاتي للمنظومة لضمان سلامة بياناتك دون أي فقدان. يمكنك إعادة المحاولة أو العودة للشاشة الرئيسية بأمان.'}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
            <button
              type="button"
              onClick={this.handleRetry}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-900/40 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              <span>إعادة تحميل القسم</span>
            </button>

            <button
              type="button"
              onClick={this.handleHardReload}
              className="px-5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-200 font-medium text-sm transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Home className="w-4 h-4 text-emerald-400" />
              <span>تحديث التطبيق بالكامل</span>
            </button>
          </div>

          {/* Collapsible Safe Diagnostic Details */}
          {this.state.error && (
            <details className="w-full max-w-lg mt-4 text-right">
              <summary className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer transition-colors p-2 rounded-lg bg-slate-800/40 border border-slate-700/40 inline-flex items-center gap-1.5 select-none">
                <span>عرض التفاصيل الفنية الوقائية</span>
              </summary>
              <div className="mt-2 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-amber-300/90 overflow-x-auto text-left ltr max-h-32">
                {this.state.error.name}: {this.state.error.message}
              </div>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
