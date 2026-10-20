import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ARTICLES, FAQS, type ArticleCategory } from '../../content/articles';

const CATEGORIES: (ArticleCategory | 'Todos')[] = ['Todos', 'Acne', 'Rotina', 'Produtos', 'Estilo de vida', 'Saúde'];

export function Library() {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('Todos');
  const list = category === 'Todos' ? ARTICLES : ARTICLES.filter((a) => a.category === category);

  return (
    <div className="stack-lg">
      <header className="page-title">
        <p className="eyebrow">Biblioteca</p>
        <h1>Aprender</h1>
        <p>Resumos dos temas do e-book, com links para as fontes.</p>
      </header>

      <div className="row wrap" style={{ gap: 'var(--space-2)' }} role="group" aria-label="Filtrar por tema">
        {CATEGORIES.map((c) => (
          <button key={c} className="chip" aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>
        ))}
      </div>

      <div className="grid grid-2">
        {list.map((a) => (
          <Link key={a.slug} to={`/app/biblioteca/${a.slug}`} className="card card-link stack">
            <div className="row between"><span className="tag">{a.category}</span><span className="xs muted">{a.minutes} min</span></div>
            <h2 style={{ fontSize: 'var(--text-md)' }}>{a.title}</h2>
            <p className="small muted" style={{ marginBottom: 0 }}>{a.summary}</p>
            <span className="small row" style={{ color: 'var(--color-primary)', fontWeight: 600, gap: 4 }}>Ler <ArrowRight size={14} aria-hidden="true" /></span>
          </Link>
        ))}
      </div>

      <section aria-labelledby="faq" className="stack">
        <h2 id="faq" style={{ fontSize: 'var(--text-lg)' }}>Perguntas frequentes</h2>
        <div>
          {FAQS.map((f) => (
            <details key={f.q} className="faq">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <Link to="/app/produtos" className="card-beige card-link row between">
        <span><strong>Guia de produtos</strong><br /><span className="small muted">O que observar em limpador, hidratante, protetor e tratamento.</span></span>
        <ArrowRight aria-hidden="true" />
      </Link>
    </div>
  );
}
