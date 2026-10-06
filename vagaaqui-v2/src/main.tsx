import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { captureAuthRedirect } from './app/auth';
import './styles.css';

captureAuthRedirect();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// PWA: funciona offline (casca do app + última área de ruas em cache)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}
