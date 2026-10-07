import { Map as MlMap, Marker, setWorkerUrl, type GeoJSONSource, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// O MapLibre 6 roda o processamento do mapa num worker separado: o Vite empacota esse
// worker (com as dependências) num arquivo próprio e passamos o endereço dele.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useEffect, useRef } from 'react';
import { getState, setState, subscribe, toast, type AppState } from '../app/state';
import { resolveTheme, type ResolvedTheme } from '../app/theme';
import { config } from '../config';
import { setTileStreetProvider } from '../data/streets';
import { segmentsFromTiles, type TilePoi, type TileRoad } from '../data/tileStreets';
import { bboxAround, bearing as bearingTo, distance, type LonLat } from '../lib/geo';
import { levelOf } from '../model/forecast';
import { displayPosition } from '../model/nav';
import { LEVEL_COLOR } from './colors';

/** Estilo mínimo embutido: usado se o servidor de mapas não responder (rede bloqueada/offline). */
const fallbackStyle = (t: ResolvedTheme): StyleSpecification => ({
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': t === 'dark' ? '#0f1318' : '#eef1f4' } }],
});

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/** Só os trechos dentro do raio de caminhada, coloridos pela chance (sem "grade" de ruas). */
function segmentsGeoJSON(s: AppState): GeoJSON.FeatureCollection {
  const f = s.forecast;
  if (!f) return EMPTY;
  const bestIds = new Set(f.best.map((b) => b.segment.id));
  return {
    type: 'FeatureCollection',
    features: f.all.map((fc) => ({
      type: 'Feature',
      properties: { id: fc.segment.id, color: LEVEL_COLOR[levelOf(fc.p, fc.confidence)], w: bestIds.has(fc.segment.id) ? 9 : 6, sel: fc.segment.id === s.selectedSegmentId ? 1 : 0 },
      geometry: { type: 'LineString', coordinates: fc.segment.line },
    })),
  };
}

function routeGeoJSON(s: AppState): GeoJSON.FeatureCollection {
  if (!s.nav) return EMPTY;
  return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: s.nav.route.line } }] };
}

function el(className: string, html = '') {
  const d = document.createElement('div');
  d.className = className;
  d.innerHTML = html;
  return d;
}

/** câmera de navegação (estilo Waze) */
const NAV_ZOOM = 18.6;
const NAV_PITCH = 45;

/** posição do carro na navegação (encaixada na rota) */
function navCarPos(s: AppState) {
  return displayPosition(s.nav!.progress, s.gps.pos!, s.gps.accuracy);
}

/**
 * rumo do carro na navegação: com o carro encaixado na rota, segue a direção da
 * rua logo à frente (estável, como o Waze); só fora da rota usa o rumo do GPS.
 */
function navBearing(s: AppState): number {
  const nav = s.nav!;
  const car = navCarPos(s).pos;
  const onRoute = car === nav.progress.snapped;
  if (!onRoute && (s.gps.speed ?? 0) > 2 && s.gps.heading !== null) return s.gps.heading;
  const r = nav.route;
  const ahead = r.line[r.cum.findIndex((c) => c > nav.progress.alongM + 25)] ?? r.line[r.line.length - 1];
  return bearingTo(car, ahead);
}

const styleUrl = (t: ResolvedTheme) => (t === 'dark' ? config.mapStyleDark : config.mapStyleLight);

export default function MapView() {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setWorkerUrl(workerUrl);
    const s0 = getState();
    let theme = resolveTheme();
    const start = s0.gps.pos ?? config.defaultCenter;
    const map = new MlMap({
      container: box.current!,
      style: styleUrl(theme),
      center: start,
      zoom: 15,
      maxPitch: 65,
      attributionControl: { compact: true, customAttribution: '© colaboradores do OpenStreetMap' },
      pitchWithRotate: false,
      dragRotate: false,
      fadeDuration: 0,
    });
    map.touchZoomRotate.disableRotation();
    (window as unknown as { __vqMap?: MlMap }).__vqMap = map;

    // mapa de fundo: se o servidor não responder, cai para o estilo mínimo
    let styleOk = false;
    let usingFallback = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    const fallback = () => {
      if (styleOk || usingFallback) return;
      usingFallback = true;
      map.setStyle(fallbackStyle(theme), { diff: false });
      toast('Mapa de fundo indisponível — mostrando só as vagas');
    };
    const loadStyle = (t: ResolvedTheme) => {
      styleOk = false;
      usingFallback = false;
      clearTimeout(fallbackTimer);
      fallbackTimer = setTimeout(fallback, 8000);
      map.setStyle(styleUrl(t), { diff: false });
    };
    fallbackTimer = setTimeout(fallback, 8000);
    map.on('error', (e) => {
      if (!styleOk && !usingFallback && /style|Failed to fetch|NetworkError|404|403/i.test(String(e.error?.message ?? e.error))) fallback();
    });

    // marcadores DOM (poucos, sem depender das fontes do mapa)
    // posição do usuário: bolinha no mapa; na navegação vira a seta do carro (estilo Waze), deitada no chão
    const meEl = el('mk-me', '<div class="mk-me-arrow"></div><svg class="mk-car" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 3 42 43 24 33 6 43Z"/></svg>');
    const me = new Marker({ element: meEl, rotationAlignment: 'map', pitchAlignment: 'map' });
    const dest = new Marker({ element: el('mk-dest', '<span>📍</span>'), anchor: 'bottom' });
    const parked = new Marker({ element: el('mk-parked', '🚗'), anchor: 'center' });
    const navTarget = new Marker({ element: el('mk-target', 'P'), anchor: 'center' });
    let rankMarkers: Marker[] = [];
    let lotMarkers: Marker[] = [];

    const addLayers = () => {
      if (map.getSource('segments')) return;
      const casing = theme === 'dark' ? '#05070a' : '#ffffff';
      map.addSource('route', { type: 'geojson', data: EMPTY });
      map.addLayer({ id: 'route-casing', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': theme === 'dark' ? '#0b1a3a' : '#1d3f8f', 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 8, 16, 14, 19, 30] } });
      map.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#4f8cff', 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 5, 16, 9, 19, 22] } });
      map.addSource('segments', { type: 'geojson', data: EMPTY });
      map.addLayer({ id: 'seg-sel', type: 'line', source: 'segments', filter: ['==', ['get', 'sel'], 1], layout: { 'line-cap': 'round' }, paint: { 'line-color': theme === 'dark' ? '#ffffff' : '#111827', 'line-width': ['+', ['get', 'w'], 9], 'line-opacity': 0.35 } });
      map.addLayer({ id: 'seg-casing', type: 'line', source: 'segments', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': casing, 'line-width': ['+', ['get', 'w'], 4] } });
      map.addLayer({ id: 'seg', type: 'line', source: 'segments', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'w'] } });
      sync(true);
    };
    map.on('style.load', () => {
      if (!usingFallback) styleOk = true;
      clearTimeout(fallbackTimer);
      // mapa plano e limpo: sem prédios 3D
      // mapa limpo: sem prédios/casas (nem 3D nem contorno), só ruas
      for (const l of map.getStyle().layers ?? []) {
        if (l.type === 'fill-extrusion' || ('source-layer' in l && l['source-layer'] === 'building')) map.removeLayer(l.id);
      }
      map.setPitch(0);
      addLayers();
    });

    // ---- ruas lidas das peças vetoriais do próprio mapa (instantâneo, sem Overpass) ----
    const waitFor = (ev: 'idle' | 'style.load', ms: number) =>
      new Promise<void>((res) => {
        const t = setTimeout(res, ms);
        map.once(ev, () => {
          clearTimeout(t);
          res();
        });
      });
    const vectorSource = () => Object.entries(map.getStyle()?.sources ?? {}).find(([, src]) => src.type === 'vector')?.[0];
    setTileStreetProvider(async (center) => {
      if (!styleOk && !usingFallback) await waitFor('style.load', 4000);
      if (usingFallback || !styleOk) return null;
      const src = vectorSource();
      if (!src) return null;
      // enquadra a área toda de caminhada para o mapa carregar todas as peças em volta
      const b = bboxAround(center, 650);
      const want: [[number, number], [number, number]] = [
        [b.west, b.south],
        [b.east, b.north],
      ];
      const cur = map.getBounds();
      if (!cur.contains([b.west, b.south]) || !cur.contains([b.east, b.north]) || distance([cur.getCenter().lng, cur.getCenter().lat], center) > 300) {
        map.fitBounds(want, { animate: false, padding: 0, maxZoom: 15 });
      }
      await new Promise((r) => setTimeout(r, 0));
      if (!map.areTilesLoaded()) await waitFor('idle', 6000);
      const roads: TileRoad[] = [];
      for (const f of map.querySourceFeatures(src, { sourceLayer: 'transportation_name' })) {
        const g = f.geometry;
        const lines = g.type === 'LineString' ? [g.coordinates as LonLat[]] : g.type === 'MultiLineString' ? (g.coordinates as LonLat[][]) : [];
        const name = String(f.properties?.name ?? f.properties?.['name:latin'] ?? '');
        roads.push({ name, cls: String(f.properties?.class ?? ''), lines });
      }
      const pois: TilePoi[] = [];
      for (const f of map.querySourceFeatures(src, { sourceLayer: 'poi' })) {
        if (f.geometry.type !== 'Point') continue;
        pois.push({ cls: String(f.properties?.class ?? ''), name: f.properties?.name ? String(f.properties.name) : undefined, pos: f.geometry.coordinates as LonLat });
      }
      return segmentsFromTiles(roads, pois, center, 700);
    });
    map.on('click', 'seg', (e) => {
      const id = e.features?.[0]?.properties?.id as string | undefined;
      if (id) setState({ selectedSegmentId: id });
    });
    map.on('mouseenter', 'seg', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'seg', () => (map.getCanvas().style.cursor = ''));

    // durante a navegação a câmera segue o carro; se o usuário mexer no mapa, pausa 8 s
    let userMovedAt = 0;
    map.on('dragstart', () => (userMovedAt = Date.now()));
    map.on('zoomstart', (e) => {
      if ((e as { originalEvent?: Event }).originalEvent) userMovedAt = Date.now();
    });

    let lastForecast: AppState['forecast'] = null;
    let lastSel: string | null = null;
    let lastLots: AppState['lots'] | null = null;
    let lastNav: AppState['nav'] = null;
    let lastRoute: unknown = null;
    let centeredOnGps = Boolean(s0.gps.pos);
    let framedDest: unknown = null;
    let flewToDest: unknown = null;

    const sync = (force = false) => {
      const s = getState();
      if (s.gps.pos) {
        me.setLngLat(s.nav ? navCarPos(s).pos : s.gps.pos).addTo(map);
        me.setRotation(s.nav ? navBearing(s) : (s.gps.heading ?? 0));
        meEl.classList.toggle('nav', Boolean(s.nav));
        meEl.classList.toggle('has-heading', s.gps.heading !== null);
        meEl.classList.toggle('weak', s.gps.status === 'weak');
        if (!centeredOnGps && !s.dest) {
          centeredOnGps = true;
          map.jumpTo({ center: s.gps.pos, zoom: 15 });
        }
      } else me.remove();
      if (s.dest) dest.setLngLat(s.dest.pos).addTo(map);
      else dest.remove();
      if (s.parked) parked.setLngLat(s.parked.pos).addTo(map);
      else parked.remove();
      if (s.nav) navTarget.setLngLat(s.nav.target).addTo(map);
      else navTarget.remove();

      const segSrc = map.getSource('segments') as GeoJSONSource | undefined;
      if (segSrc && (force || s.forecast !== lastForecast || s.selectedSegmentId !== lastSel)) {
        segSrc.setData(segmentsGeoJSON(s));
        rankMarkers.forEach((m) => m.remove());
        rankMarkers = (s.forecast?.best ?? []).map((b, i) => {
          const m = new Marker({ element: el(`mk-rank lv-${b.level}`, String(i + 1)) }).setLngLat(b.segment.mid).addTo(map);
          m.getElement().addEventListener('click', (ev) => {
            ev.stopPropagation();
            setState({ selectedSegmentId: b.segment.id });
          });
          return m;
        });
      }
      const routeSrc = map.getSource('route') as GeoJSONSource | undefined;
      const routeKey = s.nav?.route ?? null;
      if (routeSrc && (force || routeKey !== lastRoute)) {
        routeSrc.setData(routeGeoJSON(s));
        lastRoute = routeKey;
      }
      if (force || s.lots !== lastLots || s.forecast !== lastForecast) {
        lotMarkers.forEach((m) => m.remove());
        lotMarkers = s.dest && s.forecast ? s.lots.slice(0, 30).map((l) => new Marker({ element: el('mk-lot', 'P') }).setLngLat(l.pos).addTo(map)) : [];
        lastLots = s.lots;
      }

      // câmera
      const wide = window.innerWidth >= 760;
      if (s.nav && s.gps.pos) {
        if (!lastNav) userMovedAt = 0;
        if (Date.now() - userMovedAt > 8000) {
          // estilo Waze: bem perto, inclinada, rota para cima e o carro no terço de baixo da tela
          const h = map.getContainer().clientHeight;
          map.easeTo({
            center: navCarPos(s).pos,
            bearing: navBearing(s),
            zoom: NAV_ZOOM,
            pitch: NAV_PITCH,
            padding: wide ? { top: Math.round(h * 0.3), bottom: 40, left: 440, right: 40 } : { top: Math.round(h * 0.32), bottom: 170, left: 0, right: 0 },
            duration: lastNav ? 900 : 1200,
          });
        }
      } else if (lastNav && !s.nav) {
        // fim da navegação: volta ao mapa plano, norte para cima
        map.easeTo({ bearing: 0, pitch: 0, duration: 600, padding: { top: 0, bottom: 0, left: 0, right: 0 } });
      }
      if (s.dest && !s.nav && s.dest.pos !== flewToDest && !s.forecast) {
        // mostra o destino na hora, antes da previsão chegar
        flewToDest = s.dest.pos;
        map.easeTo({ center: s.dest.pos, zoom: 15.5, bearing: 0, duration: 400 });
      }
      if (s.forecast && s.dest && !s.nav && s.dest.pos !== framedDest) {
        framedDest = s.dest.pos;
        const b = bboxAround(s.dest.pos, s.settings.radiusM + 60);
        map.fitBounds(
          [
            [b.west, b.south],
            [b.east, b.north],
          ],
          { padding: wide ? { top: 90, bottom: 30, left: 460, right: 30 } : { top: 90, bottom: Math.round(window.innerHeight * 0.6), left: 16, right: 16 }, duration: 600, maxZoom: 17, bearing: 0 },
        );
      }
      if (!s.dest) {
        framedDest = null;
        flewToDest = null;
      }
      lastForecast = s.forecast;
      lastSel = s.selectedSegmentId;
      lastNav = s.nav;
    };
    const unsub = subscribe(() => sync());
    const onRecenter = () => {
      userMovedAt = 0;
      const p = getState().gps.pos ?? config.defaultCenter;
      if (getState().nav) sync();
      else map.easeTo({ center: p, zoom: Math.max(map.getZoom(), 15.5), duration: 500 });
    };
    const onTheme = (e: Event) => {
      theme = (e as CustomEvent<ResolvedTheme>).detail;
      loadStyle(theme);
    };
    window.addEventListener('vq:recenter', onRecenter);
    window.addEventListener('vq:theme', onTheme);
    sync();

    return () => {
      setTileStreetProvider(null);
      unsub();
      clearTimeout(fallbackTimer);
      window.removeEventListener('vq:recenter', onRecenter);
      window.removeEventListener('vq:theme', onTheme);
      map.remove();
    };
  }, []);

  return <div ref={box} className="map" aria-label="Mapa de vagas" />;
}
