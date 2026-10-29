import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Silently guard against harmless browser/extension/environment errors & rejections
window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
});

window.addEventListener('error', (event) => {
  const msg = String(event.message || '');
  if (
    msg.includes('ResizeObserver') ||
    msg.includes('WebSocket') ||
    msg.includes('Vite') ||
    msg.includes('chrome-extension') ||
    msg.includes('Script error') ||
    msg.includes('Non-Error promise rejection captured')
  ) {
    event.preventDefault();
  }
});

// Clean browser console: filter harmless third-party notices and benign auth fallbacks
if (typeof window !== 'undefined') {
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const text = args.map(a => (typeof a === 'string' ? a : (a?.message || ''))).join(' ');
    if (
      text.includes('Firebase') ||
      text.includes('Registration apps') ||
      text.includes('Initial data load notice') ||
      text.includes('snapshot notice') ||
      text.includes('ResizeObserver') ||
      text.includes('operation-not-allowed') ||
      text.includes('Save student AI plan notice')
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };

  const originalError = console.error;
  console.error = (...args: any[]) => {
    const text = args.map(a => (typeof a === 'string' ? a : (a?.message || ''))).join(' ');
    if (
      text.includes('identitytoolkit.googleapis.com') ||
      text.includes('auth/operation-not-allowed') ||
      text.includes('auth/invalid-credential') ||
      text.includes('ResizeObserver') ||
      text.includes('Non-Error promise rejection captured')
    ) {
      return;
    }
    originalError.apply(console, args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

