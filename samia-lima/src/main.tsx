import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { isPreview } from './lib/preview';
import './index.css';

document.documentElement.classList.add('js');

// A prévia mostra conteúdo não confirmado: não deve ser indexada.
if (isPreview) {
  const meta = document.createElement('meta');
  meta.name = 'robots';
  meta.content = 'noindex';
  document.head.appendChild(meta);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
