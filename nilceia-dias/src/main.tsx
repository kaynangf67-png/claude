import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import App from './App';
import { initAnalytics } from './lib/analytics';
import { captureCampaign, installCampaignLinkDecorator } from './lib/utm';
import './index.css';

const root = document.getElementById('root')!;
const pageKey = root.dataset.page || 'home';

(window as unknown as { __ndHydrated: boolean }).__ndHydrated = true;
captureCampaign();
installCampaignLinkDecorator();
initAnalytics(pageKey);

const app = (
  <StrictMode>
    <App pageKey={pageKey} />
  </StrictMode>
);

// Em produção o HTML já vem pré-renderizado (scripts/prerender.mjs).
if (root.hasChildNodes()) hydrateRoot(root, app);
else createRoot(root).render(app);
