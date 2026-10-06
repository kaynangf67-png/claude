import { useEffect, useMemo, useRef, useState } from 'react';
import { forecastHere, origin, selectDestination } from '../app/controller';
import { setState, useApp } from '../app/state';
import { prefetchStreets } from '../data/streets';
import { searchPlaces, type Place } from '../services/geocode';

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** resultados por texto (a mesma busca não vai duas vezes à internet) */
const cache = new Map<string, Place[]>();

export function SearchBar() {
  const dest = useApp((s) => s.dest);
  const favorites = useApp((s) => s.favorites);
  const recent = useApp((s) => s.recent);
  const [q, setQ] = useState('');
  const [remote, setRemote] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const ctrl = useRef<AbortController | null>(null);

  // instantâneo: favoritos e recentes que batem com o texto, sem esperar a internet
  const local = useMemo(() => {
    const t = norm(q.trim());
    const all = [...favorites.map((f) => ({ ...f.place, detail: `${f.label} · ${f.place.detail}` })), ...recent];
    const seen = new Set<string>();
    return all.filter((p) => {
      const key = p.name + p.pos.join();
      if (seen.has(key)) return false;
      seen.add(key);
      return t.length === 0 ? false : norm(`${p.name} ${p.detail}`).includes(t);
    });
  }, [q, favorites, recent]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setRemote([]);
      setErr(null);
      setBusy(false);
      return;
    }
    const key = norm(term);
    const hit = cache.get(key);
    if (hit) {
      setRemote(hit);
      setErr(null);
      return;
    }
    const t = setTimeout(async () => {
      ctrl.current?.abort();
      const c = new AbortController();
      ctrl.current = c;
      setBusy(true);
      try {
        const r = await searchPlaces(term, origin(), c.signal);
        cache.set(key, r);
        setRemote(r);
        setErr(r.length ? null : 'Nenhum lugar encontrado');
        // adianta o download das ruas do 1º resultado: quando tocar, já está pronto
        if (r[0]) prefetchStreets(r[0].pos);
      } catch {
        if (!c.signal.aborted) setErr('Busca indisponível no momento');
      } finally {
        if (!c.signal.aborted) setBusy(false);
      }
    }, 160);
    return () => clearTimeout(t);
  }, [q]);

  const results = useMemo(() => {
    const seen = new Set(local.map((p) => p.name + p.pos.join()));
    return [...local, ...remote.filter((p) => !seen.has(p.name + p.pos.join()))].slice(0, 7);
  }, [local, remote]);

  const closeSearch = () => {
    setQ('');
    setRemote([]);
    setFocused(false);
    (document.activeElement as HTMLElement | null)?.blur();
  };
  const pick = (p: Place) => {
    closeSearch();
    void selectDestination(p);
  };

  if (dest && !focused) {
    return (
      <div className="topbar">
        <button className="search-collapsed" onClick={() => setFocused(true)} aria-label="Mudar destino">
          <span className="search-ico">⌕</span>
          <span className="search-dest">{dest.name}</span>
        </button>
        <MenuButton />
      </div>
    );
  }

  const showSuggestions = focused && q.trim().length === 0 && recent.length > 0;

  return (
    <div className="topbar">
      <div className="search">
        <div className="search-row">
          <span className="search-ico">⌕</span>
          <input
            autoFocus={focused}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 200)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && results[0]) pick(results[0]);
            }}
            placeholder="Para onde você vai?"
            aria-label="Para onde você vai?"
            enterKeyHint="search"
            autoComplete="off"
          />
          {busy && <span className="spinner" aria-label="Buscando" />}
          {q && (
            <button className="clear-btn" aria-label="Limpar busca" onMouseDown={(e) => e.preventDefault()} onClick={() => setQ('')}>
              ✕
            </button>
          )}
        </div>
        {(results.length > 0 || (err && q.trim().length >= 2)) && (
          <ul className="results" role="listbox">
            {results.map((r) => (
              <li key={r.id + r.pos.join()}>
                <button className="result" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(r)}>
                  <b>{r.name}</b>
                  <span>{r.detail}</span>
                </button>
              </li>
            ))}
            {err && !results.length && <li className="result muted">{err}</li>}
          </ul>
        )}
        {showSuggestions && (
          <ul className="results" role="listbox" aria-label="Recentes">
            {recent.slice(0, 5).map((r) => (
              <li key={'rec' + r.id}>
                <button className="result" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(r)}>
                  <b>🕑 {r.name}</b>
                  <span>{r.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!results.length && !(err && q.trim().length >= 2) && (
          <div className="chips">
            {favorites.map((f) => (
              <button key={f.label} className="chip" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(f.place)}>
                {f.label === 'Casa' ? '🏠' : f.label === 'Trabalho' ? '💼' : '⭐'} {f.label}
              </button>
            ))}
            <button
              className="chip chip-here"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                closeSearch();
                void forecastHere();
              }}
            >
              ◎ Vagas aqui perto
            </button>
          </div>
        )}
      </div>
      {!focused && <MenuButton />}
    </div>
  );
}

function MenuButton() {
  return (
    <button className="icon-btn" aria-label="Conta e plano" onClick={() => setState({ screen: 'account' })}>
      ☰
    </button>
  );
}
