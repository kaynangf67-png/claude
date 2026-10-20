import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { CATEGORY_GUIDES, PRODUCTS, type Product } from '../../content/products';
import { formatFullDate } from '../../lib/dates';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function ProductCard({ p }: { p: Product }) {
  return (
    <div className="card-flat stack">
      <div>
        <strong>{p.name}</strong>
        <div className="small muted">{p.brand}</div>
      </div>
      {p.purpose && <p className="small" style={{ marginBottom: 0 }}>{p.purpose}</p>}
      <p className="xs muted" style={{ marginBottom: 0 }}>Ingredientes de destaque (do rótulo): {p.keyIngredients.join(', ')}</p>
      {p.price && (
        <p className="small" style={{ marginBottom: 0 }}>
          {brl(p.price.minBRL)}{p.price.maxBRL !== p.price.minBRL && ` a ${brl(p.price.maxBRL)}`}
          <span className="xs muted"> · conferido em {formatFullDate(p.price.verifiedAt)} ({p.price.source}). Preços mudam.</span>
        </p>
      )}
      {p.url && (
        <a href={p.url} target="_blank" rel={p.affiliate ? 'sponsored noopener noreferrer' : 'noopener noreferrer'} className="btn btn-secondary" style={{ alignSelf: 'flex-start' }}>
          Ver produto <ExternalLink size={14} aria-hidden="true" />
        </a>
      )}
      {p.affiliate && (
        <p className="xs" style={{ marginBottom: 0, color: 'var(--pf-alert)' }}>
          Link de afiliado: o Pele em Foco pode receber comissão se você comprar por ele, sem custo extra para você.
        </p>
      )}
    </div>
  );
}
import { Notice } from '../../components/ui';
import { RequireAccess } from '../../components/guards';

function GuideInner() {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView({ block: 'start' });
  }, [hash]);

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
      <Notice>
        {PRODUCTS.length === 0
          ? 'Nenhuma marca patrocina este conteúdo e nenhum produto específico é recomendado.'
          : 'Os produtos abaixo são exemplos para comparar com os critérios de cada categoria, não uma indicação para a sua pele. Links marcados como afiliado podem gerar comissão.'}
      </Notice>
      <p className="small" style={{ marginBottom: 0 }}>
        Não sabe por onde começar? <Link to="/app/aprender/questionario">Responda o questionário de rotina</Link>.
      </p>
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
          {PRODUCTS.some((p) => p.category === g.id) && (
            <div className="grid grid-2">
              {PRODUCTS.filter((p) => p.category === g.id).map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

export function ProductGuide() {
  return <RequireAccess><GuideInner /></RequireAccess>;
}
