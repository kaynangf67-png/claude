import { Map as MlMap, Marker, setWorkerUrl, type GeoJSONSource, type StyleSpecification } from 'maplibre-gl';
// O MapLibre 6 roda o processamento do mapa num worker separado: o Vite empacota esse
// worker (com as dependências) num arquivo próprio e passamos o endereço dele.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import { getState, setState, subscribe, toast, type AppState } from '../app/state';
import { config } from '../config';
import { bboxAround } from '../lib/geo';
import { levelOf } from '../model/forecast';
import { LEVEL_COLOR } from './colors';

/** Estilo mínimo embutido: usado se o servidor de mapas não responder (rede bloqueada/offline). */
const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#0f1318' } }],
};

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

function segmentsGeoJSON(s: AppState): GeoJSON.FeatureCollection {
  const f = s.forecast;
  if (!f) {
    return {
      type: 'FeatureCollection',
      features: s.segments.map((seg) => ({ type: 'Feature', properties: { id: seg.id, color: '#3a4250', w: 3, sel: 0 }, geometry: { type: 'LineString', coordinates: seg.line } })),
    };
  }
  const byId = new Map(f.all.map((x) => [x.segment.id, x]));
  const bestIds = new Set(f.best.map((b) => b.segment.id));
  return {
    type: 'FeatureCollection',
    features: s.segments.map((seg) => {
      const fc = byId.get(seg.id);
      const color = seg.noParking ? '#3a2a2e' : fc ? LEVEL_COLOR[levelOf(fc.p, fc.confidence)] : '#2c333d';
      return {
        type: 'Feature',
        properties: { id: seg.id, color, w: bestIds.has(seg.id) ? 9 : fc ? 5 : 3, sel: seg.id === s.selectedSegmentId ? 1 : 0, op: fc ? 0.95 : 0.6 },
        geometry: { type: 'LineString', coordinates: seg.line },
      };
    }),
  };
}

function el(className: string, html = '') {
  const d = document.createElement('div');
  d.className = className;
  d.innerHTML = html;
  return d;
}

export default function MapView() {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setWorkerUrl(workerUrl);
    const s0 = getState();
    const start = s0.gps.pos ?? config.defaultCenter;
    const map = new MlMap({
      container: box.current!,
      style: config.mapStyleUrl,
      center: start,
      zoom: 15,
      attributionControl: { compact: true, customAttribution: '© colaboradores do OpenStreetMap' },
      pitchWithRotate: false,
      dragRotate: false,
      fadeDuration: 0,
    });
    map.touchZoomRotate.disableRotation();
    (window as unknown as { __vqMap?: MlMap }).__vqMap = map;

    let styleOk = false;
    let usingFallback = false;
    const fallback = () => {
      if (styleOk || usingFallback) return;
      usingFallback = true;
      map.setStyle(FALLBACK_STYLE);
      toast('Mapa de fundo indisponível — mostrando só as vagas');
    };
    const fallbackTimer = setTimeout(fallback, 8000);
    map.on('error', (e) => {
      if (!styleOk && !usingFallback && /style|Failed to fetch|NetworkError|404|403/i.test(String(e.error?.message ?? e.error))) fallback();
    });

    // marcadores DOM (poucos, sem fontes do mapa)
    const meEl = el('mk-me', '<div class="mk-me-arrow"></div>');
    const me = new Marker({ element: meEl, rotationAlignment: 'map' });
    const dest = new Marker({ element: el('mk-dest', '<span>📍</span>'), anchor: 'bottom' });
    const parked = new Marker({ element: el('mk-parked', '🚗'), anchor: 'center' });
    let rankMarkers: Marker[] = [];
    let lotMarkers: Marker[] = [];

    const addLayers = () => {
      if (map.getSource('segments')) return;
      map.addSource('segments', { type: 'geojson', data: EMPTY });
      map.addLayer({ id: 'seg-casing', type: 'line', source: 'segments', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#05070a', 'line-width': ['+', ['get', 'w'], 3], 'line-opacity': 0.85 } });
      map.addLayer({
        id: 'seg',
        type: 'line',
        source: 'segments',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'w'], 'line-opacity': ['coalesce', ['get', 'op'], 0.9] },
      });
      map.addLayer({ id: 'seg-sel', type: 'line', source: 'segments', filter: ['==', ['get', 'sel'], 1], layout: { 'line-cap': 'round' }, paint: { 'line-color': '#ffffff', 'line-width': ['+', ['get', 'w'], 6], 'line-opacity': 0.35 } }, 'seg-casing');
      sync(true);
    };
    map.on('style.load', () => {
      if (!usingFallback) styleOk = true;
      clearTimeout(fallbackTimer);
      addLayers();
    });
    map.on('click', 'seg', (e) => {
      const id = e.features?.[0]?.properties?.id as string | undefined;
      if (id) setState({ selectedSegmentId: id });
    });
    map.on('mouseenter', 'seg', () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'seg', () => (map.getCanvas().style.cursor = ''));

    let lastForecast: AppState['forecast'] = null;
    let lastSegments: AppState['segments'] | null = null;
    let lastSel: string | null = null;
    let lastLots: AppState['lots'] | null = null;
    let centeredOnGps = Boolean(s0.gps.pos);
    let destPosFramed: unknown = null;

    const sync = (force = false) => {
      const s = getState();
      // posição do usuário
      if (s.gps.pos) {
        me.setLngLat(s.gps.pos).addTo(map);
        me.setRotation(s.gps.heading ?? 0);
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

      const src = map.getSource('segments') as GeoJSONSource | undefined;
      if (src && (force || s.forecast !== lastForecast || s.segments !== lastSegments || s.selectedSegmentId !== lastSel)) {
        src.setData(segmentsGeoJSON(s));
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
      if (force || s.lots !== lastLots || s.forecast !== lastForecast) {
        lotMarkers.forEach((m) => m.remove());
        lotMarkers = s.dest ? s.lots.slice(0, 30).map((l) => new Marker({ element: el('mk-lot', 'P') }).setLngLat(l.pos).addTo(map)) : [];
        lastLots = s.lots;
      }
      // enquadra destino + trechos quando chega uma previsão nova para outro destino
      if (s.forecast && s.dest && s.dest.pos !== destPosFramed) {
        destPosFramed = s.dest.pos;
        const b = bboxAround(s.dest.pos, s.settings.radiusM + 60);
        map.fitBounds(
          [
            [b.west, b.south],
            [b.east, b.north],
          ],
          { padding: window.innerWidth >= 760 ? { top: 90, bottom: 30, left: 460, right: 30 } : { top: 90, bottom: Math.round(window.innerHeight * 0.6), left: 16, right: 16 }, duration: 600, maxZoom: 17 },
        );
      }
      lastForecast = s.forecast;
      lastSegments = s.segments;
      lastSel = s.selectedSegmentId;
    };
    const unsub = subscribe(() => sync());
    const onRecenter = () => {
      const p = getState().gps.pos ?? config.defaultCenter;
      map.easeTo({ center: p, zoom: Math.max(map.getZoom(), 15.5), duration: 500 });
    };
    window.addEventListener('vq:recenter', onRecenter);
    sync();

    return () => {
      unsub();
      clearTimeout(fallbackTimer);
      window.removeEventListener('vq:recenter', onRecenter);
      map.remove();
    };
  }, []);

  return <div ref={box} className="map" aria-label="Mapa de vagas" />;
}
