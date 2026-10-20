import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { CATEGORY_GUIDES } from '../../content/products';
import { Notice } from '../../components/ui';
import { RequireAccess } from '../../components/guards';

function GuideInner() {
  return (
    <div className="stack-lg">
      <Link to="/app/aprender" className="btn btn-ghost" style={{ alignSelf: 'flex-start', paddingLeft: 0 }}>
        <ArrowLeft size={18} aria-hidden="true" /> Biblioteca
      </Link>
      <header className="page-title">
        <p className="eyebrow">Guia de produtos</p>
        <h1>O que observar antes de comprar</h1>
        <p>Função, ingredientes, preço por uso e se você consegue manter.</p>
      </header>
      <Notice>Nenhuma marca patrocina este conteúdo e nenhum produto específico é recomendado.</Notice>
      {CATEGORY_GUIDES.map((g) => (
        <section key={g.id} className="card stack" aria-labelledby={`cat-${g.id}`}>
          <h2 id={`cat-${g.id}`} className="h3">{g.title}</h2>
          <p className="muted" style={{ marginBottom: 0 }}>{g.role}</p>
          <div className="grid grid-2">
            <div>
              <p className="eyebrow">Procure</p>
              <ul className="small" style={{ marginBottom: 0, paddingLeft: '1.2rem' }}>{g.lookFor.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
            <div>
              <p className="eyebrow" style={{ color: 'var(--pf-alert)' }}>Cuidado com</p>
              <ul className="small" style={{ marginBottom: 0, paddingLeft: '1.2rem' }}>{g.caution.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

export function ProductGuide() {
  return <RequireAccess><GuideInner /></RequireAccess>;
}
