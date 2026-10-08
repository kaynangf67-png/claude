import { Link } from 'react-router-dom';
import { Logo } from './Logo';
import { Disclaimer } from './ui';

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-cols">
        <div style={{ maxWidth: 380 }}>
          <Logo tagline />
          <p style={{ marginTop: 14 }}>Não queremos apenas traduzir o que é dito. Queremos ajudar todos a viver a história.</p>
        </div>
        <nav aria-label="Rodapé">
          <Link to="/como-funciona">Como funciona</Link>
          <Link to="/acessibilidade">Acessibilidade</Link>
          <Link to="/estudio">Estúdio de validação</Link>
          <Link to="/perfil">Perfil e planos</Link>
          <Link to="/entrar">Entrar</Link>
        </nav>
      </div>
      <Disclaimer />
      <p style={{ fontSize: 12.5, margin: 0 }}>
        Catálogo de demonstração: exceto os curtas originais LUMIA, todos os títulos, elencos e pôsteres são fictícios. Nenhum filme comercial é distribuído
        nesta plataforma. Avatar de referência gerado por código; a arquitetura aceita um avatar humano realista em GLB.
      </p>
    </footer>
  );
}
