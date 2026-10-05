import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { Toaster } from './components/ui';
import { Onboarding, Signup } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { Landing } from './pages/Landing';
import { LeadDetail, Leads } from './pages/Leads';
import { Pricing, PublicPricing, ThankYou } from './pages/Pricing';
import { Recover } from './pages/Recover';
import { Settings } from './pages/Settings';
import { useAppState } from './lib/store';

function Home() {
  const { user, business } = useAppState();
  if (user && business) return <Navigate to="/app" replace />;
  return <Landing />;
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/cadastro" element={<Signup />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/planos" element={<PublicPricing />} />
        <Route path="/obrigado" element={<ThankYou />} />
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="recuperar" element={<Recover />} />
          <Route path="leads" element={<Leads />} />
          <Route path="leads/:id" element={<LeadDetail />} />
          <Route path="empresa" element={<Settings />} />
          <Route path="planos" element={<Pricing />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </HashRouter>
  );
}
