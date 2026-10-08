import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { CatalogItem } from '@/types/content';
import { catalog, hasInterpretation } from '@/services/catalogService';
import { DEMO_FLAGSHIP_ID } from '@/data/movies';
import { useApp } from '@/context/AppContext';
import { Hero } from '@/components/Hero';
import { MovieRow } from '@/components/MovieGrid';
import { Footer } from '@/components/Footer';

export default function HomePage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const { progress, myList, favorites } = useApp();
  useEffect(() => {
    catalog.list().then(setItems);
  }, []);
  const featured = items.find((i) => i.id === DEMO_FLAGSHIP_ID);
  const rows = useMemo(() => {
    const by = (f: (i: CatalogItem) => boolean) => items.filter(f);
    const cont = Object.entries(progress)
      .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
      .map(([id]) => items.find((i) => i.id === id))
      .filter(Boolean) as CatalogItem[];
    return {
      cont,
      libras: by((i) => hasInterpretation(i)),
      news: by((i) => i.tags.includes('new')),
      popular: by((i) => i.tags.includes('popular')),
      rec: by((i) => i.tags.includes('recommended')),
      movies: by((i) => i.kind === 'movie' || i.kind === 'short'),
      series: by((i) => i.kind === 'series'),
      docs: by((i) => i.kind === 'documentary'),
      fav: favorites.map((id) => items.find((i) => i.id === id)).filter(Boolean) as CatalogItem[],
      list: myList.map((id) => items.find((i) => i.id === id)).filter(Boolean) as CatalogItem[],
    };
  }, [items, progress, myList, favorites]);

  return (
    <main id="conteudo">
      {featured && <Hero featured={featured} />}
      <div style={{ marginTop: -40, position: 'relative', zIndex: 2 }}>
        <MovieRow title="Continuar assistindo" items={rows.cont} wide />
        <MovieRow title="🤟 Com intérprete de Libras" items={rows.libras} wide />
        <MovieRow title="Lançamentos" items={rows.news} />
        <MovieRow title="Populares" items={rows.popular} />
        <MovieRow title="Recomendados para você" items={rows.rec} />
        <MovieRow title="Minha Lista" items={rows.list} more="/minha-lista" />
        <MovieRow title="Favoritos" items={rows.fav} more="/minha-lista#favoritos" />
        <MovieRow title="Filmes" items={rows.movies} more="/filmes" />
        <MovieRow title="Séries" items={rows.series} more="/series" />
        <MovieRow title="Documentários" items={rows.docs} more="/documentarios" />
      </div>

      <section className="section manifesto" style={{ isolation: 'isolate' }}>
        <div className="glow" />
        <p className="eyebrow" style={{ marginBottom: 18 }}>
          LUMIA — o intérprete de IA para filmes
        </p>
        <h2>
          Não queremos apenas traduzir o que é dito.
          <br />
          <em className="gradient-text">Queremos ajudar todos a viver a história.</em>
        </h2>
        <p>A IA analisa imagem, diálogo, sons, emoções, personagens e contexto — e um intérprete digital transforma tudo isso em Libras, sincronizado com cada cena.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 30, flexWrap: 'wrap' }}>
          <Link className="btn btn-libras" to="/assistir/a-ligacao?libras=1">
            <span aria-hidden>🤟</span> Ver a demonstração
          </Link>
          <Link className="btn btn-ghost" to="/como-funciona">
            Como funciona
          </Link>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="pillars">
          {[
            ['🎬', 'Imagem', 'O que acontece em cena'],
            ['🗣️', 'Diálogo', 'O que é dito e por quem'],
            ['🔊', 'Sons', 'Porta, telefone, silêncio'],
            ['😨', 'Emoções', 'Tom, tensão, intenção'],
            ['👤', 'Personagens', 'Quem fala com quem'],
            ['📖', 'Contexto', 'O que a cena significa'],
          ].map(([e, t, d]) => (
            <div className="pillar" key={t}>
              <span className="em" aria-hidden>
                {e}
              </span>
              <strong>{t}</strong>
              <span>{d}</span>
            </div>
          ))}
        </div>
      </section>
      <Footer />
    </main>
  );
}
