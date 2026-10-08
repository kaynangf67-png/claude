import { Link, useNavigate } from 'react-router-dom';
import { Heart, Play, Plus, Check } from 'lucide-react';
import type { CatalogItem } from '@/types/content';
import { KIND_LABEL } from '@/types/content';
import { useApp } from '@/context/AppContext';
import { hasInterpretation, isPlayable } from '@/services/catalogService';
import { Maturity } from './ui';

export function MovieCard({ item, wide = false }: { item: CatalogItem; wide?: boolean }) {
  const { myList, toggleList, favorites, toggleFavorite, progress, prefs } = useApp();
  const nav = useNavigate();
  const inList = myList.includes(item.id);
  const fav = favorites.includes(item.id);
  const prog = progress[item.id];
  const libras = hasInterpretation(item);
  const playable = isPlayable(item);
  return (
    <article className={`card ${wide ? 'wide' : ''}`} aria-label={item.title}>
      <img src={wide ? item.backdrop : item.poster} alt="" loading="lazy" decoding="async" />
      <Link to={`/titulo/${item.slug}`} className="card-link" aria-label={`${item.title} — ver detalhes`} />
      <div className="card-badges">
        {libras && <span className="chip chip-libras">🤟 Libras</span>}
        {item.tags.includes('original') && <span className="chip chip-amber">Original LUMIA</span>}
        {item.fictional && <span className="chip chip-mock">Fictício</span>}
      </div>
      <div className="card-body">
        <div className="card-title">{item.title}</div>
        <div className="card-meta">
          <Maturity r={item.maturity} />
          <span>{item.year}</span>
          <span>·</span>
          <span>{KIND_LABEL[item.kind]}</span>
        </div>
      </div>
      <div className="card-actions">
        {playable && (
          <button className="icon-btn" aria-label={`Assistir ${item.title}`} onClick={() => nav(`/assistir/${item.slug}${libras && prefs.interpreterEnabled ? '?libras=1' : ''}`)}>
            <Play size={15} fill="currentColor" />
          </button>
        )}
        <button className="icon-btn" aria-pressed={inList} aria-label={inList ? 'Remover da Minha Lista' : 'Adicionar à Minha Lista'} onClick={() => toggleList(item.id)}>
          {inList ? <Check size={15} /> : <Plus size={15} />}
        </button>
        <button className="icon-btn" aria-pressed={fav} aria-label={fav ? 'Remover dos favoritos' : 'Favoritar'} onClick={() => toggleFavorite(item.id)}>
          <Heart size={15} fill={fav ? 'currentColor' : 'none'} />
        </button>
      </div>
      {prog && prog.duration > 0 && (
        <div className="card-progress" aria-label={`${Math.round((prog.time / prog.duration) * 100)}% assistido`}>
          <span style={{ width: `${Math.min(100, (prog.time / prog.duration) * 100)}%` }} />
        </div>
      )}
    </article>
  );
}
