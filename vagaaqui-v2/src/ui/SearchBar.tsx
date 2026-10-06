import { useEffect, useRef, useState } from 'react';
import { forecastHere, origin, selectDestination } from '../app/controller';
import { setState, useApp } from '../app/state';
import { searchPlaces, type Place } from '../services/geocode';

export function SearchBar() {
  const dest = useApp((s) => s.dest);
  const favorites = useApp((s) => s.favorites);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const ctrl = useRef<AbortController | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 3) {
      setResults([]);
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
        setResults(r);
        setErr(r.length ? null : 'Nenhum lugar encontrado');
      } catch (e) {
        if (!c.signal.aborted) setErr('Busca indisponível no momento');
      } finally {
        if (!c.signal.aborted) setBusy(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const closeSearch = () => {
    setQ('');
    setResults([]);
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
            placeholder="Para onde você vai?"
            aria-label="Para onde você vai?"
            enterKeyHint="search"
          />
          {busy && <span className="spinner" aria-label="Buscando" />}
        </div>
        {(results.length > 0 || err) && (
          <ul className="results" role="listbox">
            {err && <li className="result muted">{err}</li>}
            {results.map((r) => (
              <li key={r.id}>
                <button className="result" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(r)}>
                  <b>{r.name}</b>
                  <span>{r.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!results.length && !err && (
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
