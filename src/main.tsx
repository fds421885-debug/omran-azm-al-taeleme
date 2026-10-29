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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

