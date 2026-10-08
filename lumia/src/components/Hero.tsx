import { useNavigate } from 'react-router-dom';
import { Play, Info } from 'lucide-react';
import type { CatalogItem } from '@/types/content';
import { Maturity, StatusChip } from './ui';
import { useApp } from '@/context/AppContext';

export function Hero({ featured }: { featured: CatalogItem }) {
  const nav = useNavigate();
  const { prefs } = useApp();
  const libras = featured.signLanguages.find((s) => s.language === 'pt-BR-LIBRAS');
  return (
    <section className="hero" aria-label="Destaque">
      <div className="hero-media">
        {prefs.reduceMotion ? (
          <img src={featured.backdrop} alt="" />
        ) : (
          <video poster="/media/a-ligacao/still-wide.webp" autoPlay muted loop playsInline preload="metadata" aria-hidden="true">
            <source src="/media/hero/hero-loop-720p.webm" type="video/webm" />
            <source src="/media/hero/hero-loop-720p.mp4" type="video/mp4" />
          </video>
        )}
      </div>
      <div className="hero-content">
        <div className="hero-feature">
          <span className="eyebrow">Em destaque · Original LUMIA</span>
        </div>
        <h1>
          Cinema <em className="gradient-text">para todos.</em>
        </h1>
        <p className="lead">Assista. Entenda. Viva a história.</p>
        <div className="hero-feature" style={{ marginBottom: 22 }}>
          <strong style={{ fontSize: 18 }}>{featured.title}</strong>
          <Maturity r={featured.maturity} />
          <span className="tag">{featured.genres.join(' · ')}</span>
          {libras && libras.status !== 'PLANNED' && libras.status !== 'NOT_AVAILABLE' && <StatusChip status={libras.status} />}
        </div>
        <div className="hero-actions">
          <button className="btn btn-primary" onClick={() => nav(`/assistir/${featured.slug}`)}>
            <Play size={18} fill="currentColor" /> Assistir agora
          </button>
          <button className="btn btn-libras" onClick={() => nav(`/assistir/${featured.slug}?libras=1`)}>
            <span aria-hidden>🤟</span> Assistir com Libras
          </button>
          <button className="btn btn-ghost" onClick={() => nav(`/titulo/${featured.slug}`)}>
            <Info size={18} /> Detalhes
          </button>
        </div>
      </div>
    </section>
  );
}
