import { ExternalLink } from 'lucide-react';
import { CATEGORY_GUIDES, PRODUCTS, type Product } from '../../content/products';
import { formatLong } from '../../lib/dates';
import { Notice } from '../../components/ui';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function ProductCard({ p }: { p: Product }) {
  return (
    <div className="card-flat stack">
      <div>
        <strong>{p.name}</strong>
        <div className="small muted">{p.brand}</div>
      </div>
      <p className="small" style={{ marginBottom: 0 }}>{p.purpose}</p>
      <p className="xs muted" style={{ marginBottom: 0 }}>Ingredientes de destaque: {p.keyIngredients.join(', ')}</p>
      {p.price && (
        <p className="small" style={{ marginBottom: 0 }}>
          {brl(p.price.minBRL)}{p.price.maxBRL !== p.price.minBRL && ` a ${brl(p.price.maxBRL)}`}
          <span className="xs muted"> · conferido em {formatLong(p.price.verifiedAt)} ({p.price.source}). Preços mudam.</span>
        </p>
      )}
      {p.url && (
        <a href={p.url} target="_blank" rel={p.affiliate ? 'sponsored noopener noreferrer' : 'noopener noreferrer'} className="small">
          Ver produto <ExternalLink size={12} aria-label="(abre em nova aba)" />
        </a>
      )}
      {p.affiliate && <p className="xs" style={{ margin: 0, color: 'var(--pf-alert)' }}>Link de afiliado: podemos receber comissão se você comprar por ele, sem custo extra para você.</p>}
    </div>
  );
}

export function Products() {
  return (
    <div className="stack-lg">
      <header className="page-title">
        <p className="eyebrow">Produtos</p>
        <h1>O que observar antes de comprar</h1>
        <p>Função, ingredientes, preço por uso e se você consegue manter.</p>
      </header>

      <Notice>
        Nenhuma marca patrocina este conteúdo. Produtos específicos só aparecem aqui depois de conferidos, com preço datado e aviso claro quando o link for de afiliado.
      </Notice>

      {CATEGORY_GUIDES.map((g) => {
        const items = PRODUCTS.filter((p) => p.category === g.id);
        return (
          <section key={g.id} className="card stack" aria-labelledby={`cat-${g.id}`}>
            <h2 id={`cat-${g.id}`} style={{ fontSize: 'var(--text-lg)' }}>{g.title}</h2>
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
            {items.length > 0 && <div className="grid grid-2">{items.map((p) => <ProductCard key={p.id} p={p} />)}</div>}
          </section>
        );
      })}

      <section className="card-beige stack">
        <h2 style={{ fontSize: 'var(--text-md)' }}>Conta rápida: preço por mês</h2>
        <p className="small" style={{ marginBottom: 0 }}>Divida o preço pela duração estimada. Um protetor de R$ 60 que dura dois meses sai R$ 30/mês; um de R$ 40 que dura um mês sai R$ 40/mês. O mais barato na prateleira nem sempre é o mais barato no uso.</p>
      </section>
    </div>
  );
}
