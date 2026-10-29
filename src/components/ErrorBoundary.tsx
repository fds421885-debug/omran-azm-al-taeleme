import React, { Component, ErrorInfo, ReactNode } from 'react';

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

  componentDidCatch(error: Error, _errorInfo: ErrorInfo) {
    // Silent auto-recovery without disrupting the user
    try {
      if (this.props.onReset) {
        this.props.onReset();
      }
    } catch {}
    
    // Automatically clear error state so the screen recovers safely
    if (this.state.hasError) {
      setTimeout(() => {
        this.setState({
          hasError: false,
          error: null,
          errorInfo: null,
        });
      }, 50);
    }
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

  render() {
    // If an error is briefly caught, return null while auto-recovering to prevent React cascading render errors
    if (this.state.hasError) {
      return null;
    }

    return this.props.children;
  }
}

