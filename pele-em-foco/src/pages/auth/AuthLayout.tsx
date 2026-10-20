import { Outlet } from 'react-router-dom';
import { Brand, BrandMark } from '../../components/Brand';
import { DemoBanner } from '../../components/DemoBanner';

export function AuthLayout() {
  return (
    <div className="auth-shell">
      <DemoBanner />
      <div className="auth-split">
        <aside className="auth-aside" aria-hidden="true">
          <BrandMark className="auth-aside-mark" />
          <p className="auth-aside-quote">
            Entenda sua pele.<br /><em>Organize sua rotina.</em><br />Escolha com mais consciência.
          </p>
          <p className="xs">Conteúdo educativo. Não substitui avaliação de dermatologista.</p>
        </aside>
        <main id="conteudo" className="auth-main">
          <div className="auth-card stack-lg">
            <Brand to="/" />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
