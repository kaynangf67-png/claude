import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CatalogItem } from '@/types/content';
import { COUNTRY_LABEL, SIGN_LANGUAGES } from '@/types/content';
import { catalog, genresOf } from '@/services/catalogService';
import { Footer } from '@/components/Footer';

export default function CategoriesPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  useEffect(() => {
    catalog.list().then(setItems);
  }, []);
  const genres = genresOf(items);
  const countries = [...new Set(items.map((i) => i.country))];
  return (
    <main className="page" id="conteudo">
      <div className="container">
        <p className="eyebrow">Explorar</p>
        <h1 className="serif" style={{ fontSize: 'clamp(40px,6vw,72px)', margin: '6px 0 26px' }}>
          Categorias
        </h1>
        <div className="genre-tiles">
          {genres.map((g) => {
            const cover = items.find((i) => i.genres.includes(g));
            return (
              <Link key={g} className="genre-tile" to={`/categorias/${encodeURIComponent(g)}`}>
                {cover && <img src={cover.backdrop} alt="" loading="lazy" />}
                {g}
              </Link>
            );
          })}
        </div>
        <h2 className="section-title" style={{ margin: '44px 0 14px' }}>
          Catálogo global
        </h2>
        <p className="muted" style={{ maxWidth: 720 }}>
          Cada título informa idioma original, áudios, legendas e quais línguas de sinais estão disponíveis — Libras, ASL e BSL são línguas diferentes, com gramáticas próprias.
        </p>
        <div className="filter-bar">
          {countries.map((c) => (
            <span key={c} className="chip">
              {COUNTRY_LABEL[c] ?? c} · {items.filter((i) => i.country === c).length}
            </span>
          ))}
        </div>
        <div className="filter-bar">
          {Object.entries(SIGN_LANGUAGES).map(([code, l]) => (
            <span key={code} className="chip chip-libras" title={l.name}>
              {l.short} <code style={{ opacity: 0.7 }}>{code}</code>
            </span>
          ))}
        </div>
      </div>
      <Footer />
    </main>
  );
}
