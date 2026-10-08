import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import type { CatalogItem, ContentKind } from '@/types/content';
import { COUNTRY_LABEL } from '@/types/content';
import { catalog, genresOf, hasInterpretation } from '@/services/catalogService';
import { MovieGrid } from '@/components/MovieGrid';
import { Footer } from '@/components/Footer';

const TITLES: Record<string, { title: string; kinds: ContentKind[]; lead: string }> = {
  filmes: { title: 'Filmes', kinds: ['movie', 'short'], lead: 'Longas e curtas do mundo inteiro, com acessibilidade de ponta a ponta.' },
  series: { title: 'Séries', kinds: ['series'], lead: 'Temporadas inteiras com intérprete, legendas e sons importantes.' },
  documentarios: { title: 'Documentários', kinds: ['documentary'], lead: 'Histórias reais, interpretadas com contexto.' },
};

export default function BrowsePage({ section }: { section?: keyof typeof TITLES }) {
  const params = useParams();
  const [search] = useSearchParams();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const genreParam = params.genre ? decodeURIComponent(params.genre) : search.get('genero');
  const [country, setCountry] = useState<string | null>(null);
  const [onlyLibras, setOnlyLibras] = useState(false);
  const conf = section ? TITLES[section] : null;

  useEffect(() => {
    catalog.list({ kind: conf?.kinds, genre: genreParam ?? undefined }).then(setItems);
  }, [conf?.kinds, genreParam]);

  const countries = useMemo(() => [...new Set(items.map((i) => i.country))], [items]);
  const shown = items.filter((i) => (!country || i.country === country) && (!onlyLibras || hasInterpretation(i)));

  return (
    <main className="page" id="conteudo">
      <div className="container">
        <p className="eyebrow">{genreParam ? 'Categoria' : 'Catálogo'}</p>
        <h1 className="serif" style={{ fontSize: 'clamp(40px,6vw,72px)', margin: '6px 0 8px' }}>
          {genreParam ?? conf?.title ?? 'Catálogo'}
        </h1>
        {conf && <p className="muted" style={{ maxWidth: 620 }}>{conf.lead}</p>}
        <div className="filter-bar" role="toolbar" aria-label="Filtros">
          <button aria-pressed={onlyLibras} onClick={() => setOnlyLibras((v) => !v)}>
            🤟 Com Libras
          </button>
          <button aria-pressed={!country} onClick={() => setCountry(null)}>
            Todos os países
          </button>
          {countries.map((c) => (
            <button key={c} aria-pressed={country === c} onClick={() => setCountry(country === c ? null : c)}>
              {COUNTRY_LABEL[c] ?? c}
            </button>
          ))}
        </div>
        <MovieGrid items={shown} empty="Nenhum título com esses filtros." />
        {!genreParam && (
          <p className="muted" style={{ fontSize: 13, marginTop: 30 }}>
            Gêneros: {genresOf(items).join(' · ')}
          </p>
        )}
      </div>
      <Footer />
    </main>
  );
}
