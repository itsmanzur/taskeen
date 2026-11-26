import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/noto-sans-bengali/400.css';
import '@fontsource/noto-sans-bengali/500.css';
import '@fontsource/noto-sans-bengali/600.css';
import '@fontsource/noto-sans-bengali/700.css';
import '@fontsource/noto-serif-bengali/500.css';
import '@fontsource/noto-serif-bengali/600.css';
import '@fontsource/noto-serif-bengali/700.css';
import '@fontsource/noto-naskh-arabic/400.css';
import '@fontsource/noto-naskh-arabic/600.css';
import '@fontsource/noto-naskh-arabic/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/600.css';
import '@fontsource/lateef/400.css';
import '@fontsource/lateef/700.css';
import '@fontsource/hind-siliguri/400.css';
import '@fontsource/hind-siliguri/500.css';
import '@fontsource/hind-siliguri/600.css';
import '@fontsource/hind-siliguri/700.css';
import '@fontsource/anek-bangla/400.css';
import '@fontsource/anek-bangla/500.css';
import '@fontsource/anek-bangla/600.css';
import '@fontsource/anek-bangla/700.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';
import { initSecureStorage } from './lib/secureStorage';

initSecureStorage()
  .catch(() => undefined)
  .finally(() => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
  });

if (
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  !('__TAURI_INTERNALS__' in window)
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
