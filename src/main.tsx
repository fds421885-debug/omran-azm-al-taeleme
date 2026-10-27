import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  console.warn('[OmranPlatform] Handled background promise rejection:', event.reason);
});

window.addEventListener('error', (event) => {
  if (event.message?.includes('ResizeObserver') || event.message?.includes('WebSocket') || event.message?.includes('Vite') || event.message?.includes('chrome-extension')) {
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

