import { Camera, Download, Pause, Play, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { dist, worldToLatLon } from '../../lib/geo';
import {
  CurbObserver,
  DEFAULT_CAMERA,
  MotionTracker,
  spotInView,
  toGround,
  type CameraModel,
  type CameraObservation,
  type GroundDetection,
} from '../../services/vision/curbVision';
import { createVehicleDetector, type VehicleDetector } from '../../services/vision/vehicleDetector';
import { getSimulation } from '../../simulation/WorldSimulation';
import { actions, appStore, useApp } from '../../store/appStore';

type Phase = 'idle' | 'camera' | 'model' | 'running' | 'paused' | 'error';

interface LogFrame {
  t: number;
  pose: { x: number; z: number; heading: number; lat: number; lon: number; source: 'gps' | 'simulado'; accuracy: number | null };
  detections: {
    c: string;
    s: number;
    box: [number, number, number, number];
    forward: number | null;
    lateral: number | null;
    curbside: boolean;
    moving: boolean | null;
    speed: number | null;
  }[];
  observations: CameraObservation[];
}

const MAX_LOG = 5000;
const INTERVAL_MS = 180;

/**
 * Sensor de câmera (PROTÓTIPO): celular no painel, câmera para a frente.
 * Detecta veículos no aparelho, estima onde estão na rua e vota, por vaga monitorada
 * que passa no campo de visão, se ela estava ocupada ou livre.
 */
export default function CameraSensor() {
  const gps = useApp((s) => s.gps);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<VehicleDetector | null>(null);
  const observerRef = useRef(new CurbObserver());
  const trackerRef = useRef(new MotionTracker());
  const logRef = useRef<LogFrame[]>([]);
  const loopRef = useRef<number | null>(null);
  const wakeRef = useRef<{ release: () => Promise<void> } | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [calib, setCalib] = useState(DEFAULT_CAMERA);
  const calibRef = useRef(calib);
  calibRef.current = calib;
  const [showCalib, setShowCalib] = useState(false);
  const [stats, setStats] = useState({ fps: 0, inferMs: 0, vehicles: 0, curbside: 0, frames: 0, backend: '' });
  const [observations, setObservations] = useState<(CameraObservation & { street: string; sent: boolean })[]>([]);

  const stopLoop = () => {
    if (loopRef.current != null) cancelAnimationFrame(loopRef.current);
    loopRef.current = null;
  };

  const shutdown = () => {
    stopLoop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    detectorRef.current?.close();
    detectorRef.current = null;
    void wakeRef.current?.release().catch(() => {});
    wakeRef.current = null;
  };

  useEffect(() => shutdown, []);

  const start = async () => {
    setError(null);
    try {
      setPhase('camera');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      setPhase('model');
      detectorRef.current ??= await createVehicleDetector();
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
        wakeRef.current = (await nav.wakeLock?.request('screen')) ?? null;
      } catch {
        /* sem wake lock: a tela pode apagar */
      }
      setPhase('running');
      run();
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      setError(
        name === 'NotAllowedError'
          ? 'Permissão da câmera negada. Libere a câmera nas configurações do navegador.'
          : name === 'NotFoundError'
            ? 'Nenhuma câmera encontrada neste aparelho.'
            : `Não foi possível iniciar: ${err instanceof Error ? err.message : String(err)}. O modelo de detecção (~4,6 MB) precisa de internet na primeira vez.`,
      );
      setPhase('error');
      shutdown();
    }
  };

  const run = () => {
    const sim = getSimulation();
    let last = 0;
    let frames = 0;
    let fpsWindow = performance.now();
    let inferAcc = 0;
    let lastVehicles = 0;
    let lastCurb = 0;
    const tick = () => {
      loopRef.current = requestAnimationFrame(tick);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const detector = detectorRef.current;
      if (!video || !canvas || !detector || video.readyState < 2) return;
      const now = performance.now();
      if (now - last < INTERVAL_MS) return;
      last = now;
      const cam: CameraModel = { ...calibRef.current, width: video.videoWidth, height: video.videoHeight };
      const t0 = performance.now();
      const dets = detector.detect(video, now);
      inferAcc += performance.now() - t0;
      frames += 1;

      const v = sim.vehicle;
      const pose = { position: { ...v.position }, heading: v.heading };
      const ground = dets.map((d) => toGround(d, cam, pose));
      const valid = ground.filter((g): g is GroundDetection => g != null);
      trackerRef.current.update(valid, Date.now());
      const nearby = sim.spots.filter((s) => s.type === 'curb' && dist(s.position, pose.position) < 45);
      const obs = observerRef.current.update(nearby, valid, cam, pose, Date.now(), v.speed);
      // só com GPS real a imagem corresponde ao lugar do mapa; na demonstração nada entra no índice
      const live = appStore.get().gps.status === 'ok';
      if (live) for (const o of obs) sim.submitCameraObservation(o.spotId, o.kind, o.trust);
      if (obs.length) {
        setObservations((prev) =>
          [...obs.map((o) => ({ ...o, street: sim.spotsById.get(o.spotId)?.streetName ?? '', sent: live })), ...prev].slice(0, 30),
        );
      }
      lastVehicles = dets.length;
      lastCurb = valid.filter((g) => g.curbside && !g.moving).length;

      const { lat, lon } = worldToLatLon(pose.position);
      const state = appStore.get();
      if (logRef.current.length < MAX_LOG) {
        logRef.current.push({
          t: Date.now(),
          pose: {
            x: +pose.position.x.toFixed(2),
            z: +pose.position.z.toFixed(2),
            heading: +pose.heading.toFixed(4),
            lat: +lat.toFixed(7),
            lon: +lon.toFixed(7),
            source: state.gps.status === 'ok' ? 'gps' : 'simulado',
            accuracy: state.gps.accuracy,
          },
          detections: dets.map((d, i) => ({
            c: d.category,
            s: +d.score.toFixed(3),
            box: [Math.round(d.x), Math.round(d.y), Math.round(d.w), Math.round(d.h)],
            forward: ground[i] ? +ground[i]!.forward.toFixed(2) : null,
            lateral: ground[i] ? +ground[i]!.lateral.toFixed(2) : null,
            curbside: ground[i]?.curbside ?? false,
            moving: ground[i]?.moving ?? null,
            speed: ground[i]?.groundSpeed != null ? +ground[i]!.groundSpeed!.toFixed(2) : null,
          })),
          observations: obs,
        });
      }
      draw(canvas, cam, dets, ground, nearby, pose);

      if (now - fpsWindow > 1000) {
        setStats({
          fps: frames / ((now - fpsWindow) / 1000),
          inferMs: inferAcc / Math.max(1, frames),
          vehicles: lastVehicles,
          curbside: lastCurb,
          frames: logRef.current.length,
          backend: detector.backend,
        });
        frames = 0;
        inferAcc = 0;
        fpsWindow = now;
      }
    };
    loopRef.current = requestAnimationFrame(tick);
  };

  const pause = () => {
    stopLoop();
    setPhase('paused');
  };
  const resume = () => {
    setPhase('running');
    run();
  };

  const exportLog = () => {
    const blob = new Blob(
      [JSON.stringify({ app: 'VagaAqui', kind: 'camera-sensor-log', camera: calib, frames: logRef.current }, null, 0)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vagaaqui-sensor-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const close = () => {
    shutdown();
    actions.setCameraSensorOpen(false);
  };

  const poseLabel =
    gps.status === 'ok' ? `GPS real ±${Math.round(gps.accuracy ?? 0)} m` : 'Demonstração: posição do carro simulado';

  return (
    <div className="sensor" role="dialog" aria-label="Sensor de câmera">
      <video ref={videoRef} className="sensor-video" playsInline muted />
      <canvas ref={canvasRef} className="sensor-canvas" />

      <header className="sensor-top">
        <span className="sensor-badge">
          <Camera size={16} /> SENSOR DE CÂMERA · PROTÓTIPO
        </span>
        <button className="icon-btn" onClick={close} aria-label="Fechar sensor">
          <X size={20} />
        </button>
      </header>

      {phase !== 'running' && phase !== 'paused' && (
        <div className="sensor-intro">
          <h2>Seu celular como sensor de vagas</h2>
          <ol>
            <li>Prenda o celular no suporte do painel, na horizontal, com a câmera para a frente.</li>
            <li>
              <strong>Calibre antes de sair:</strong> em Calibrar, ponha a linha tracejada sobre o horizonte da imagem. Sem isso as
              distâncias saem erradas (em teste, 11 m em vez de ~25 m).
            </li>
            <li>Dirija normalmente: carros parados no meio-fio e espaços vazios viram observações (só com o carro em movimento).</li>
          </ol>
          <p className="sensor-privacy">
            <ShieldCheck size={16} /> A imagem é processada só neste aparelho. Nada de vídeo, rosto ou placa é enviado — apenas
            &quot;vaga X parecia ocupada/livre&quot;.
          </p>
          <p className="muted small">
            Protótipo: a estimativa assume rua plana e câmera nivelada. Carros passando, garagens e faixas proibidas causam erros —
            por isso cada observação tem peso baixo no Índice de Confiança. Use o log exportado para medir a precisão.
          </p>
          {error && <p className="sensor-error">{error}</p>}
          <button className="btn btn-primary btn-xl btn-block" onClick={start} disabled={phase === 'camera' || phase === 'model'}>
            <Play size={20} />
            {phase === 'camera' ? 'Abrindo câmera…' : phase === 'model' ? 'Carregando modelo de detecção…' : 'INICIAR SENSOR'}
          </button>
        </div>
      )}

      {(phase === 'running' || phase === 'paused') && (
        <>
          <div className="sensor-stats">
            <span>{poseLabel}</span>
            <span>
              {stats.fps.toFixed(1)} fps · {Math.round(stats.inferMs)} ms ({stats.backend})
            </span>
            <span>
              {stats.vehicles} veículos · {stats.curbside} junto ao meio-fio
            </span>
            <span>{stats.frames} quadros no log</span>
          </div>
          <div className="sensor-feed">
            <strong>Observações ({observations.filter((o) => o.sent).length} enviadas ao Índice de Confiança)</strong>
            {observations.length === 0 && <span className="muted small">Passe por vagas monitoradas do mapa para gerar observações.</span>}
            {observations.slice(0, 5).map((o) => (
              <span key={`${o.spotId}-${o.at}`} className={`obs ${o.kind}`}>
                {o.kind === 'occupied' ? 'Ocupada' : 'Livre'} · {o.street} · {Math.round(o.trust * 100)}% peso · {o.frames} quadros
                {!o.sent && ' · demonstração, não enviada'}
              </span>
            ))}
          </div>
          <div className="sensor-actions">
            {phase === 'running' ? (
              <button className="btn btn-secondary" onClick={pause}>
                <Pause size={18} /> Pausar
              </button>
            ) : (
              <button className="btn btn-primary" onClick={resume}>
                <Play size={18} /> Continuar
              </button>
            )}
            <button className="btn btn-ghost" onClick={() => setShowCalib((v) => !v)}>
              <SlidersHorizontal size={18} /> Calibrar
            </button>
            <button className="btn btn-ghost" onClick={exportLog}>
              <Download size={18} /> Exportar log
            </button>
          </div>
        </>
      )}

      {showCalib && (
        <div className="sensor-calib">
          <label>
            Horizonte ({Math.round(calib.horizon * 100)}% da altura)
            <input type="range" min={0.3} max={0.7} step={0.01} value={calib.horizon} onChange={(e) => setCalib({ ...calib, horizon: +e.target.value })} />
          </label>
          <label>
            Altura da câmera ({calib.cameraHeight.toFixed(2)} m)
            <input type="range" min={0.9} max={1.7} step={0.05} value={calib.cameraHeight} onChange={(e) => setCalib({ ...calib, cameraHeight: +e.target.value })} />
          </label>
          <label>
            Campo de visão ({calib.hfovDeg}°)
            <input type="range" min={45} max={90} step={1} value={calib.hfovDeg} onChange={(e) => setCalib({ ...calib, hfovDeg: +e.target.value })} />
          </label>
        </div>
      )}
    </div>
  );
}

function draw(
  canvas: HTMLCanvasElement,
  cam: CameraModel,
  dets: { category: string; score: number; x: number; y: number; w: number; h: number }[],
  ground: (GroundDetection | null)[],
  spots: { id: string; position: { x: number; z: number } }[],
  pose: { position: { x: number; z: number }; heading: number },
) {
  if (canvas.width !== cam.width || canvas.height !== cam.height) {
    canvas.width = cam.width;
    canvas.height = cam.height;
  }
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, cam.width, cam.height);
  const scale = cam.width / 1280;
  // horizonte
  ctx.setLineDash([12 * scale, 10 * scale]);
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2 * scale;
  ctx.beginPath();
  ctx.moveTo(0, cam.horizon * cam.height);
  ctx.lineTo(cam.width, cam.horizon * cam.height);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.font = `600 ${18 * scale}px Sora, system-ui, sans-serif`;
  dets.forEach((d, i) => {
    const g = ground[i];
    const color = !g ? 'rgba(160,170,190,0.8)' : g.moving ? '#7fa2ff' : g.curbside ? '#ffc93c' : '#7fa2ff';
    ctx.strokeStyle = color;
    ctx.lineWidth = 3 * scale;
    ctx.strokeRect(d.x, d.y, d.w, d.h);
    const label = !g
      ? `${d.category} ${Math.round(d.score * 100)}%`
      : `${g.moving ? 'em movimento' : g.curbside ? 'parado?' : 'na pista'} · ${g.forward.toFixed(0)} m`;
    const tw = ctx.measureText(label).width + 12 * scale;
    ctx.fillStyle = color;
    ctx.fillRect(d.x, d.y - 26 * scale, tw, 24 * scale);
    ctx.fillStyle = '#05070d';
    ctx.fillText(label, d.x + 6 * scale, d.y - 8 * scale);
  });
  // vagas monitoradas no campo de visão
  for (const s of spots) {
    const v = spotInView(s.position, cam, pose);
    if (!v.visible) continue;
    ctx.beginPath();
    ctx.arc(v.px.x, v.px.y, 9 * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(56,248,176,0.85)';
    ctx.fill();
  }
}
