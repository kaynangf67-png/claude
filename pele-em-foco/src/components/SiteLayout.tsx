import { Link, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Brand } from './Brand';
import { CheckoutButton } from './CheckoutButton';
import { launch, missingLaunchConfig } from '../config/launch';

export function SiteLayout() {
  const { pathname, hash } = useLocation();
  const missing = missingLaunchConfig();

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [pathname, hash]);

  return (
    <div className="site">
      <a href="#conteudo" className="skip-link">Pular para o conteúdo</a>
      {missing.length > 0 && (
        <div className="config-bar" role="note">
          <div className="container">
            <strong>Página em configuração</strong> — preencha antes de publicar: {missing.join(' · ')}. Veja o README.
          </div>
        </div>
      )}
      <header className="site-header">
        <div className="container">
          <Brand />
          <nav aria-label="Seções" className="site-nav">
            <Link to="/#conteudo-do-guia">O guia</Link>
            <Link to="/#bonus">App bônus</Link>
            <Link to="/#perguntas">Perguntas</Link>
          </nav>
          <div className="row">
            <Link to="/entrar" className="btn btn-ghost">Entrar</Link>
            {pathname === '/' ? <CheckoutButton size="sm" label="Quero o guia" /> : <Link to="/" className="btn btn-secondary">Conhecer o guia</Link>}
          </div>
        </div>
      </header>
      <main id="conteudo">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container stack">
          <div className="row between wrap" style={{ alignItems: 'flex-start' }}>
            <div className="stack" style={{ maxWidth: 420 }}>
              <Brand />
              <p className="small">
                Conteúdo educativo. Não faz diagnóstico, não indica tratamento e não substitui consulta com médico dermatologista. Acne dolorosa,
                persistente ou que deixa cicatrizes merece avaliação profissional.
              </p>
            </div>
            <nav aria-label="Rodapé" className="footer-links small">
              <Link to="/privacidade">Política de privacidade</Link>
              <Link to="/termos">Termos de uso e reembolso</Link>
              <Link to="/obrigado">Já comprei: como acessar</Link>
              {launch.supportEmail && <a href={`mailto:${launch.supportEmail}`}>{launch.supportEmail}</a>}
            </nav>
          </div>
          <p className="xs">
            © 2026 Pele em Foco
            {launch.businessName ? ` · ${launch.businessName}` : ' · [responsável a configurar]'}
            {launch.businessDocument ? ` · ${launch.businessDocument}` : ' · [CPF/CNPJ a configurar]'}
          </p>
        </div>
      </footer>
    </div>
  );
}
