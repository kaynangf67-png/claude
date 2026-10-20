import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { StoreProvider } from './lib/store';
import { AppLayout } from './components/AppLayout';
import { SiteLayout } from './components/SiteLayout';
import { Landing } from './pages/site/Landing';
import { Obrigado } from './pages/site/Obrigado';
import { NotFound, Privacidade, Termos } from './pages/site/Legal';
import { Onboarding } from './pages/app/Onboarding';
import { Home } from './pages/app/Home';
import { Routine } from './pages/app/Routine';
import { Journal } from './pages/app/Journal';
import { Library } from './pages/app/Library';
import { ArticlePage } from './pages/app/ArticlePage';
import { Products } from './pages/app/Products';
import { Profile } from './pages/app/Profile';

export function App() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route index element={<Landing />} />
            <Route path="obrigado" element={<Obrigado />} />
            <Route path="privacidade" element={<Privacidade />} />
            <Route path="termos" element={<Termos />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="app/boas-vindas" element={<Onboarding />} />
          <Route path="app" element={<AppLayout />}>
            <Route index element={<Home />} />
            <Route path="rotina" element={<Routine />} />
            <Route path="diario" element={<Journal />} />
            <Route path="biblioteca" element={<Library />} />
            <Route path="biblioteca/:slug" element={<ArticlePage />} />
            <Route path="produtos" element={<Products />} />
            <Route path="perfil" element={<Profile />} />
          </Route>
        </Routes>
      </StoreProvider>
    </BrowserRouter>
  );
}
