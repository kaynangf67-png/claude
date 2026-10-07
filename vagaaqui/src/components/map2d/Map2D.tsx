import { useEffect, useRef } from 'react';
import { STATUS_COLORS } from '../../config/constants';
import { ARRIVAL_DISTANCE } from '../../hooks/useSimulation';
import { getSimulation } from '../../simulation/WorldSimulation';
import { actions, appStore, effectiveTier } from '../../store/appStore';
import { cameraBus } from '../../store/cameraBus';
import type { ParkingSpot, SpotAssessment, Vec2 } from '../../types';
import { getCity } from '../../world/cityStore';
import { CAR_COLORS } from '../map/mapStyle';
import { installTestBridge } from '../map/testBridge';
import { angleLerp, applyView, headingUpRotation, screenToWorld, visibleBounds, worldToScreen, type View2D } from './camera2d';
import { buildStreetLabels } from './layers';
import { addQuad, blitTile, CAR_L, carCorners, LEVELS, MAP_COLORS, pickLevel, TileCache, tilesFor, type Tile } from './tiles';

/**
 * Mapa 2D leve (Canvas 2D) — padrão do app.
 * Desenha só o essencial: ruas, vagas com chance, alguns carros, rota e o carro do
 * usuário com o mapa girando conforme o rumo. O fundo (ruas, calçadas, carros parados)
 * vem de tiles pré-desenhados (ver tiles.ts); a cada quadro só o que muda é desenhado.
 * Sem WebGL, sem bibliotecas 3D.
 */

const COLORS = {
  route: '#4f86ff',
  routeEdge: '#0b1430',
  vehicle: '#ffffff',
};

interface Follow {
  zoomMul: number;
}

function pill(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, highlight: boolean) {
  ctx.font = `${highlight ? 800 : 700} ${highlight ? 15 : 12}px Sora, system-ui, sans-serif`;
  const w = ctx.measureText(text).width + (highlight ? 18 : 12);
  const h = highlight ? 24 : 19;
  const top = y - h - 7;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, top, w, h, h / 2);
  ctx.fillStyle = highlight ? color : 'rgba(8,11,18,0.92)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 5, top + h - 1);
  ctx.lineTo(x, y - 2);
  ctx.lineTo(x + 5, top + h - 1);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = highlight ? '#05070d' : '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, top + h / 2 + 1);
}

export default function Map2D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    const sim = getSimulation();
    const city = getCity();
    const streetLabels = buildStreetLabels(city);
    const tier = effectiveTier(appStore.get());
    const maxDpr = tier === 'low' ? 1.25 : tier === 'medium' ? 1.75 : 2;
    const frameInterval = tier === 'low' ? 1000 / 30 : 0;
    const tiles = new TileCache(city, sim.world.parkedSlots, tier === 'low' ? 24 : 40);
    tiles.warmBase(city.bounds);
    const labelWidth = new Map<string, number>();

    const view: View2D = { cx: sim.vehicle.position.x, cz: sim.vehicle.position.z, zoom: 1.6, rot: 0, width: 1, height: 1, anchorY: 0.5 };
    const target = { ...view };
    const follow: Follow = { zoomMul: 1 };
    let dpr = 1;
    let mode = appStore.get().cameraMode;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      view.width = target.width = rect.width;
      view.height = target.height = rect.height;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const fitBounds = () => {
      const b = city.bounds;
      target.cx = (b.minX + b.maxX) / 2;
      target.cz = (b.minZ + b.maxZ) / 2;
      target.zoom = Math.min(view.width / (b.maxX - b.minX), view.height / (b.maxZ - b.minZ)) * 0.95;
      target.rot = 0;
      target.anchorY = 0.5;
    };

    // ---------- comandos dos botões (mesmo canal do mapa 3D) ----------
    const offBus = cameraBus.on((cmd) => {
      const following = appStore.get().cameraMode === 'follow';
      if (cmd.type === 'zoom' && following) {
        follow.zoomMul = Math.min(4, Math.max(0.3, follow.zoomMul / cmd.factor));
        return;
      }
      if (cmd.type === 'tilt') return; // não existe inclinação no 2D
      if (following) actions.setCameraMode('free');
      if (cmd.type === 'zoom') target.zoom = Math.min(12, Math.max(0.15, target.zoom / cmd.factor));
      if (cmd.type === 'rotate') target.rot += cmd.radians;
      if (cmd.type === 'north') target.rot = 0;
      if (cmd.type === 'focus') {
        target.cx = cmd.x;
        target.cz = cmd.z;
        target.anchorY = 0.5;
        target.zoom = Math.min(8, Math.max(0.6, 500 / (cmd.distance ?? 160)));
      }
      if (cmd.type === 'overview') fitBounds();
    });

    const offStore = appStore.subscribe(() => {
      const s = appStore.get();
      if (s.cameraMode !== mode) {
        mode = s.cameraMode;
        if (mode === 'preview') fitBounds();
      }
    });

    // ---------- gestos: 1 dedo/arrastar move · pinça/scroll zoom · 2 dedos/botão direito giram ----------
    const pointers = new Map<number, { x: number; y: number }>();
    let downAt = 0;
    let moved = 0;
    let rightDrag = false;
    const toFree = () => {
      const s = appStore.get();
      if (s.cameraMode === 'follow' && !s.driverMode) actions.setCameraMode('free');
      return !(s.driverMode && s.cameraMode === 'follow');
    };
    const local = (e: PointerEvent | WheelEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, local(e));
      downAt = performance.now();
      moved = 0;
      rightDrag = e.button === 2;
    };
    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const cur = local(e);
      if (pointers.size === 1) {
        const dx = cur.x - prev.x;
        const dy = cur.y - prev.y;
        moved += Math.abs(dx) + Math.abs(dy);
        if (moved > 6 && toFree()) {
          if (rightDrag) {
            target.rot += dx * 0.006;
          } else {
            // arrasta o mundo junto com o dedo
            const a = screenToWorld(target, prev);
            const b = screenToWorld(target, cur);
            target.cx += a.x - b.x;
            target.cz += a.z - b.z;
          }
          Object.assign(view, { cx: target.cx, cz: target.cz, rot: target.rot });
        }
      } else if (pointers.size === 2) {
        const [idA, idB] = [...pointers.keys()];
        const pA = pointers.get(idA)!;
        const pB = pointers.get(idB)!;
        const nA = e.pointerId === idA ? cur : pA;
        const nB = e.pointerId === idB ? cur : pB;
        const d0 = Math.hypot(pB.x - pA.x, pB.y - pA.y) || 1;
        const d1 = Math.hypot(nB.x - nA.x, nB.y - nA.y) || 1;
        const a0 = Math.atan2(pB.y - pA.y, pB.x - pA.x);
        const a1 = Math.atan2(nB.y - nA.y, nB.x - nA.x);
        moved += 10;
        if (toFree()) {
          const mid = { x: (nA.x + nB.x) / 2, y: (nA.y + nB.y) / 2 };
          const anchor = screenToWorld(target, mid);
          target.zoom = Math.min(12, Math.max(0.15, target.zoom * (d1 / d0)));
          target.rot += a1 - a0;
          // mantém o ponto entre os dedos fixo na tela
          Object.assign(view, { zoom: target.zoom, rot: target.rot });
          const after = screenToWorld(target, mid);
          target.cx += anchor.x - after.x;
          target.cz += anchor.z - after.z;
          Object.assign(view, { cx: target.cx, cz: target.cz });
        }
      }
      pointers.set(e.pointerId, cur);
    };
    const onUp = (e: PointerEvent) => {
      const p = pointers.get(e.pointerId);
      pointers.delete(e.pointerId);
      if (!p || moved > 6 || performance.now() - downAt > 400 || rightDrag) return;
      // toque curto: seleciona a vaga mais próxima do dedo
      const w = screenToWorld(view, p);
      const radius = Math.max(4, 22 / view.zoom);
      let best: ParkingSpot | null = null;
      let bestD = radius;
      for (const s of sim.spots) {
        const d = Math.hypot(s.position.x - w.x, s.position.z - w.z);
        if (d < bestD) {
          bestD = d;
          best = s;
        }
      }
      actions.selectSpot(best?.id ?? null);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!toFree()) return;
      const p = local(e);
      const anchor = screenToWorld(target, p);
      target.zoom = Math.min(12, Math.max(0.15, target.zoom * Math.exp(-e.deltaY * 0.0015)));
      Object.assign(view, { zoom: target.zoom });
      const after = screenToWorld({ ...target, cx: view.cx, cz: view.cz }, p);
      target.cx = view.cx + anchor.x - after.x;
      target.cz = view.cz + anchor.z - after.z;
      Object.assign(view, { cx: target.cx, cz: target.cz });
    };
    const onContext = (e: Event) => e.preventDefault();
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContext);

    installTestBridge({
      project(spotId: string) {
        const s = sim.spotsById.get(spotId);
        if (!s) return null;
        const p = worldToScreen(view, s.position);
        return { ...p, visible: p.x >= 0 && p.y >= 0 && p.x <= view.width && p.y <= view.height };
      },
      camera() {
        return { target: [Math.round(view.cx), Math.round(view.cz)], zoom: +view.zoom.toFixed(2), rotDeg: Math.round((view.rot * 180) / Math.PI) };
      },
    });

    // ---------- laço de desenho ----------
    let raf = 0;
    let last = performance.now();
    let lastDraw = 0;
    let fpsFrames = 0;
    let fpsAt = last;
    (window as unknown as { __vagaaquiFps?: number }).__vagaaquiFps = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (frameInterval && now - lastDraw < frameInterval) return;
      lastDraw = now;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      sim.update(dt);
      const state = appStore.get();
      const v = sim.vehicle;

      // câmera de navegação: rumo para cima, carro mais embaixo, aproxima na chegada
      if (state.cameraMode === 'follow') {
        const driving = state.navStatus === 'navigating';
        const remaining = v.route ? v.stopAt - v.routeS : Infinity;
        const arrive = driving ? Math.min(1, Math.max(0, (ARRIVAL_DISTANCE - remaining) / 120)) : 0;
        const portrait = view.height > view.width * 1.1;
        const base = driving ? (portrait ? 2.6 : 3.2) : 1.5;
        target.zoom = base * (1 + arrive * 0.9) * follow.zoomMul;
        target.rot = driving ? headingUpRotation(v.heading) : 0;
        target.anchorY = driving ? 0.66 : 0.5;
        target.cx = v.position.x;
        target.cz = v.position.z;
      }
      const k = 1 - Math.exp(-dt * (state.cameraMode === 'follow' ? 5 : 8));
      view.cx += (target.cx - view.cx) * k;
      view.cz += (target.cz - view.cz) * k;
      view.zoom += (target.zoom - view.zoom) * k;
      view.rot = angleLerp(view.rot, target.rot, k);
      view.anchorY += (target.anchorY - view.anchorY) * k;
      draw(now, state);

      fpsFrames++;
      if (now - fpsAt > 1000) {
        (window as unknown as { __vagaaquiFps?: number }).__vagaaquiFps = Math.round((fpsFrames * 1000) / (now - fpsAt));
        fpsFrames = 0;
        fpsAt = now;
      }
    };

    const draw = (now: number, state: ReturnType<typeof appStore.get>) => {
      const snapshot = sim.getSnapshot();
      const z = view.zoom;
      const px = 1 / z; // 1 pixel em metros
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = MAP_COLORS.land;
      ctx.fillRect(0, 0, view.width, view.height);

      applyView(ctx, view, dpr);
      const b = visibleBounds(view);
      const inView = (p: Vec2) => p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ;

      // fundo estático: tiles pré-desenhados (máx. 2 novos por quadro; enquanto isso usa um nível mais grosso)
      const level = pickLevel(z * dpr);
      const need = tilesFor(level, b);
      const ready: Tile[] = [];
      const fallback = new Map<string, Tile>();
      let budget = 2;
      tiles.beginFrame();
      for (const [tx, tz] of need) {
        let t = tiles.get(level, tx, tz);
        if (!t && budget > 0) {
          t = tiles.build(level, tx, tz);
          budget--;
        }
        if (t) {
          ready.push(t);
          continue;
        }
        for (let l = level - 1; l >= 0; l--) {
          const f = LEVELS[level] / LEVELS[l];
          const ftx = Math.floor(tx / f);
          const ftz = Math.floor(tz / f);
          const ft = tiles.get(l, ftx, ftz);
          if (ft) {
            fallback.set(`${l}/${ftx}/${ftz}`, ft);
            break;
          }
          if (l === 0) fallback.set(`0/${ftx}/${ftz}`, tiles.build(0, ftx, ftz)); // fora da cidade: barato
        }
      }
      ctx.imageSmoothingEnabled = true;
      for (const t of fallback.values()) blitTile(ctx, t);
      for (const t of ready) blitTile(ctx, t);

      // carros nas vagas monitoradas que estão ocupadas (mudam com o tempo, ficam fora do tile)
      if (z > 0.9) {
        const groups = CAR_COLORS.map(() => new Path2D());
        for (const spot of sim.spots) {
          if (spot.type === 'curb' && snapshot.occupiedVisible.has(spot.id) && inView(spot.position)) {
            addQuad(groups[spot.id.length % groups.length], carCorners(spot.position, spot.heading, CAR_L - 0.4));
          }
        }
        groups.forEach((g, i) => {
          ctx.fillStyle = CAR_COLORS[i];
          ctx.fill(g);
        });
      }

      // rota
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const route = state.route;
      if (route && state.navStatus === 'navigating') {
        const path = new Path2D();
        const startS = sim.vehicle.routeS;
        let started = false;
        for (let i = 0; i < route.points.length; i++) {
          if (route.cumulative[i] < startS - 1) continue;
          const p = route.points[i];
          if (!started) {
            path.moveTo(sim.vehicle.position.x, sim.vehicle.position.z);
            started = true;
          }
          path.lineTo(p.x, p.z);
        }
        ctx.strokeStyle = COLORS.routeEdge;
        ctx.lineWidth = Math.max(4.4, 9 * px);
        ctx.stroke(path);
        ctx.strokeStyle = COLORS.route;
        ctx.lineWidth = Math.max(3, 6 * px);
        ctx.stroke(path);
        // fluxo animado
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = Math.max(0.6, 1.6 * px);
        ctx.setLineDash([2.5, 9]);
        ctx.lineDashOffset = -((now / 1000) * 14) % 11.5;
        ctx.stroke(path);
        ctx.setLineDash([]);
        ctx.lineDashOffset = 0;
      }

      // trânsito
      if (z > 0.6) {
        const traffic = new Path2D();
        for (const a of sim.agents) if (inView(a.position)) addQuad(traffic, carCorners(a.position, a.heading));
        ctx.fillStyle = '#9aa3b2';
        ctx.fill(traffic);
      }

      // vagas monitoradas: retângulo colorido no meio-fio
      const highlightIds = new Set<string>();
      if (state.selectedSpotId) highlightIds.add(state.selectedSpotId);
      if (state.targetSpotId && (state.navStatus === 'navigating' || state.navStatus === 'arrived')) highlightIds.add(state.targetSpotId);
      if (state.recommendationsOpen && state.recommendations[0]) highlightIds.add(state.recommendations[0].spotId);
      const visibleSpots: { spot: ParkingSpot; a: SpotAssessment }[] = [];
      for (const spot of sim.spots) {
        if (!inView(spot.position)) continue;
        const a = snapshot.assessments.get(spot.id);
        if (!a) continue;
        visibleSpots.push({ spot, a });
        const color = STATUS_COLORS[a.status];
        const hl = highlightIds.has(spot.id);
        const pad = carCorners(spot.position, spot.heading, spot.type === 'lot' ? 9 : 5.6, spot.type === 'lot' ? 4 : 2.4);
        const path = new Path2D();
        addQuad(path, pad);
        ctx.fillStyle = color + (snapshot.occupiedVisible.has(spot.id) ? '55' : 'aa');
        ctx.fill(path);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(0.25, (hl ? 3 : 1.5) * px);
        ctx.stroke(path);
        if (hl) {
          const pulse = (now / 1000) % 1.2;
          ctx.beginPath();
          ctx.arc(spot.position.x, spot.position.z, 4 + pulse * 10, 0, Math.PI * 2);
          ctx.strokeStyle = color + Math.round((1 - pulse / 1.2) * 200).toString(16).padStart(2, '0');
          ctx.lineWidth = 2.5 * px;
          ctx.stroke();
        }
      }

      // ---------- camada de tela (texto sempre de pé) ----------
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // nomes de ruas
      if (z > 1.4) {
        ctx.font = '600 11px Sora, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let count = 0;
        for (const l of streetLabels) {
          if (count > 18 || !inView(l)) continue;
          let w = labelWidth.get(l.name);
          if (w === undefined) labelWidth.set(l.name, (w = ctx.measureText(l.name).width));
          if (w > l.length * z * 0.8) continue;
          const s = worldToScreen(view, l);
          let ang = l.angle + view.rot;
          while (ang > Math.PI / 2) ang -= Math.PI;
          while (ang < -Math.PI / 2) ang += Math.PI;
          ctx.save();
          ctx.translate(s.x, s.y);
          ctx.rotate(ang);
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(20,22,26,0.9)';
          ctx.strokeText(l.name, 0, 0);
          ctx.fillStyle = 'rgba(225,230,238,0.9)';
          ctx.fillText(l.name, 0, 0);
          ctx.restore();
          count++;
        }
      }

      // pontos de interesse
      if (z > 0.5) {
        ctx.font = '600 12px Sora, system-ui, sans-serif';
        for (const poi of city.pois) {
          if (!inView(poi.position)) continue;
          const s = worldToScreen(view, poi.position);
          ctx.beginPath();
          ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#7fa2ff';
          ctx.fill();
          ctx.textAlign = 'left';
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(10,12,16,0.9)';
          ctx.strokeText(poi.name, s.x + 9, s.y + 4);
          ctx.fillStyle = '#c9d6ff';
          ctx.fillText(poi.name, s.x + 9, s.y + 4);
        }
      }

      // etiquetas de chance das vagas (sem sobreposição)
      const taken: { x: number; y: number }[] = [];
      const ordered = visibleSpots.sort((p, q) => Number(highlightIds.has(q.spot.id)) - Number(highlightIds.has(p.spot.id)));
      for (const { spot, a } of ordered) {
        const hl = highlightIds.has(spot.id);
        if (!hl && z < 0.8) continue;
        const s = worldToScreen(view, spot.position);
        if (!hl && taken.some((t) => Math.abs(t.x - s.x) < 46 && Math.abs(t.y - s.y) < 26)) continue;
        taken.push(s);
        const pct = Math.round(a.probability * 100);
        pill(ctx, s.x, s.y, `${spot.type === 'lot' ? 'P ' : ''}${a.status === 'stale' ? '~' : ''}${pct}%`, STATUS_COLORS[a.status], hl);
      }

      // carro do usuário: halo + seta
      const vs = worldToScreen(view, sim.vehicle.position);
      const pulse = (now / 1000) % 1.6;
      ctx.beginPath();
      ctx.arc(vs.x, vs.y, 16 + pulse * 18, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(91,140,255,${0.28 * (1 - pulse / 1.6)})`;
      ctx.fill();
      ctx.save();
      ctx.translate(vs.x, vs.y);
      // rumo na tela: ângulo do vetor de frente após a rotação do mapa
      ctx.rotate(-sim.vehicle.heading + view.rot + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -15);
      ctx.lineTo(11, 12);
      ctx.lineTo(0, 6);
      ctx.lineTo(-11, 12);
      ctx.closePath();
      ctx.fillStyle = COLORS.vehicle;
      ctx.shadowColor = 'rgba(79,134,255,0.9)';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = COLORS.route;
      ctx.stroke();
      ctx.restore();
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      offBus();
      offStore();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContext);
    };
  }, []);

  return <canvas ref={canvasRef} className="map-canvas map2d" aria-label="Mapa de vagas" />;
}
