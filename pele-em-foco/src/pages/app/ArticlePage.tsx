import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Notice, Spinner } from '../../components/ui';
import { RequireAccess } from '../../components/guards';
import { useBackend } from '../../app/session';
import { useAsync } from '../../app/useAsync';
import { categoryLabel } from '../../content/articles';

function ArticleInner() {
  const { slug } = useParams();
  const { data } = useBackend();
  const state = useAsync(() => data.listArticles(), [data]);
  if (state.loading && !state.data) return <Spinner />;
  if (state.error) return <p className="field-error" role="alert">{state.error}</p>;
  const article = state.data?.find((a) => a.slug === slug);

  if (!article) {
    return (
      <div className="stack">
        <h1>Artigo não encontrado</h1>
        <Link to="/app/aprender" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }}>Voltar à biblioteca</Link>
      </div>
    );
  }

  return (
    <article className="narrow stack-lg" style={{ marginInline: 'auto' }}>
      <Link to="/app/aprender" className="btn btn-ghost" style={{ alignSelf: 'flex-start', paddingLeft: 0 }}>
        <ArrowLeft size={18} aria-hidden="true" /> Biblioteca
      </Link>
      <header className="stack">
        <div className="row"><span className="tag">{categoryLabel(article.category)}</span><span className="xs muted">{article.minutes} min de leitura</span></div>
        <h1>{article.title}</h1>
        <p className="lead" style={{ marginBottom: 0 }}>{article.summary}</p>
      </header>
      <div className="article-body">
        {article.sections.map((s, i) => (
          <section key={i}>
            {s.heading && <h2>{s.heading}</h2>}
            {s.paragraphs?.map((p, j) => <p key={j}>{p}</p>)}
            {s.bullets && <ul>{s.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>}
            {s.note && <Notice>{s.note}</Notice>}
          </section>
        ))}
      </div>
      <section className="card-beige stack" aria-labelledby="fontes">
        <h2 id="fontes" className="h3" style={{ fontSize: 'var(--text-md)' }}>Fontes</h2>
        <ul className="sources" style={{ marginBottom: 0, paddingLeft: '1.2rem' }}>
          {article.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer">{s.label} <ExternalLink size={12} aria-label="(abre em nova aba)" /></a>
            </li>
          ))}
        </ul>
        <p className="xs muted" style={{ marginBottom: 0 }}>Conteúdo educativo. Não indica tratamento individual e não substitui avaliação de dermatologista.</p>
      </section>
    </article>
  );
}

export function ArticlePage() {
  return <RequireAccess><ArticleInner /></RequireAccess>;
}
