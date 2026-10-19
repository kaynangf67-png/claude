import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AppProvider } from './state/app';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1 } },
});

// Build de visualização (arquivo único): abre via file://, então usa rotas com # e começa na demonstração.
const isPreview = import.meta.env.VITE_PREVIEW === '1';
const Router = isPreview ? HashRouter : BrowserRouter;
if (isPreview) {
  try {
    if (localStorage.getItem('trenddrop:demo-mode') === null) localStorage.setItem('trenddrop:demo-mode', '1');
  } catch {
    /* ignora */
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router>
        <AppProvider>
          <App />
          <Toaster theme="dark" position="bottom-right" richColors closeButton />
        </AppProvider>
      </Router>
    </QueryClientProvider>
  </StrictMode>,
);
