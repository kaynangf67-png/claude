import { Crosshair, MapPin, Search, SquareParking, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { actions, useApp } from '../../store/appStore';
import type { Destination } from '../../types';
import { getCity } from '../../world/cityStore';

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function allDestinations(): Destination[] {
  const city = getCity();
  const pois = city.pois.map((p) => ({ id: p.id, label: p.name, position: p.position }));
  const streets = city.streetNames
    .map((s, i) => ({ id: `street-${i}`, label: s.name, position: s.position }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  return [...pois, ...streets];
}

/** "Para onde você vai?" — destino opcional; sem destino, busca vagas perto do carro. */
export function SearchBar() {
  const destination = useApp((s) => s.destination);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const options = useMemo(allDestinations, []);
  const results = useMemo(() => {
    const q = normalize(query.trim());
    const list = q ? options.filter((o) => normalize(o.label).includes(q)) : options.slice(0, 7);
    return list.slice(0, 7);
  }, [query, options]);

  const choose = (d: Destination | null) => {
    setOpen(false);
    setQuery('');
    inputRef.current?.blur();
    actions.setDestination(d);
  };

  return (
    <div className={`search ${open ? 'open' : ''}`}>
      <div className="search-field">
        <Search size={20} className="search-icon" />
        <input
          ref={inputRef}
          value={open ? query : destination?.label ?? query}
          placeholder="Para onde você vai?"
          aria-label="Para onde você vai?"
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 160)}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) choose(results[0]);
            if (e.key === 'Escape') inputRef.current?.blur();
          }}
        />
        {destination && !open && (
          <button className="icon-btn ghost" aria-label="Limpar destino" onClick={() => actions.setDestination(null)}>
            <X size={18} />
          </button>
        )}
      </div>
      {open && (
        <ul className="search-results" role="listbox">
          <li>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => choose(null)}>
              <SquareParking size={18} className="accent" />
              <span>
                <strong>Encontrar estacionamento</strong>
                <small>Melhor vaga perto de você agora</small>
              </span>
            </button>
          </li>
          {results.map((r) => (
            <li key={r.id}>
              <button onMouseDown={(e) => e.preventDefault()} onClick={() => choose(r)}>
                {r.id.startsWith('poi') ? <MapPin size={18} /> : <Crosshair size={18} />}
                <span>
                  <strong>{r.label}</strong>
                  <small>{r.id.startsWith('poi') ? 'Vagas a até 700 m a pé' : 'Rua'}</small>
                </span>
              </button>
            </li>
          ))}
          {!results.length && <li className="muted small pad">Nada encontrado nesta área de demonstração.</li>}
        </ul>
      )}
    </div>
  );
}
