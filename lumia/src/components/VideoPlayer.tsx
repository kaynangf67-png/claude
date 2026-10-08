/**
 * VIDEO PLAYER — HTML5 <video> + camadas de acessibilidade.
 *
 * Camadas (de baixo para cima): vídeo → regiões de diagnóstico → legendas →
 * sons importantes → intérprete 3D → status da IA → controles → painel de
 * acessibilidade. Tudo dentro do mesmo contêiner, que é o alvo da tela cheia:
 * o intérprete continua visível em tela cheia.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, X } from 'lucide-react';
import type { CatalogItem } from '@/types/content';
import { SIGN_LANGUAGES, STATUS_LABEL } from '@/types/content';
import type { SoundEvent, TimedCue } from '@/ai/types';
import type { PipelineResult } from '@/ai/interpretationPipeline';
import { activeSignAt, segmentAt } from '@/avatar/timelineEngine';
import { sceneAt } from '@/ai/multimodalAnalyzer';
import { pickAutoRendition, resolveSource } from '@/services/videoService';
import { useApp } from '@/context/AppContext';
import { PlayerControls } from './PlayerControls';
import { AvatarWindow } from './AvatarWindow';
import { Captions, SoundCues } from './CaptionOverlay';
import { PipelineStatus, type PipelineState } from './PipelineStatus';
import { AccessibilityPanel } from './AccessibilityPanel';
import { captionPadding, computeAvatarLayout, roiToBox, type Box } from './avatarLayout';
import type { Ambience, AvatarStatus } from './AvatarViewer';

export interface VideoPlayerProps {
  item: CatalogItem;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  time: number;
  captionsByTrack: Record<string, TimedCue[]>;
  sounds: SoundEvent[];
  pipeline: PipelineResult | null;
  pipelineState: PipelineState;
  librasOn: boolean;
  setLibrasOn: (on: boolean) => void;
  librasAvailable: boolean;
  autoPlay: boolean;
}

export function VideoPlayer(props: VideoPlayerProps) {
  const { item, videoRef, time: t, pipeline, librasOn } = props;
  const { prefs, setPrefs, toast } = useApp();
  const nav = useNavigate();
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ W: 1280, H: 720 });
  const [aspect, setAspect] = useState(16 / 9);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(item.video?.durationSec ?? 0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [quality, setQuality] = useState<string>('auto');
  const [src, setSrc] = useState<string | undefined>(undefined);
  const [controls, setControls] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [avatarStatus, setAvatarStatus] = useState<AvatarStatus | null>(null);
  const [ambience, setAmbience] = useState<Ambience | null>(null);
  const [ripple, setRipple] = useState<{ side: 'left' | 'right'; key: number } | null>(null);
  const [avatarFps, setAvatarFps] = useState({ fps: 0, cpu: 0 });
  const [dropped, setDropped] = useState<{ dropped: number; total: number } | null>(null);
  const [showPipeline, setShowPipeline] = useState(false);
  const [portrait, setPortrait] = useState(() => window.innerHeight > window.innerWidth);
  useEffect(() => {
    const on = () => setPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const hideTimer = useRef<number | undefined>(undefined);
  const lastTap = useRef<{ t: number; x: number } | null>(null);
  const tapTimer = useRef<number | undefined>(undefined);

  const cinema = prefs.cinemaMode;
  const immersive = prefs.immersive && librasOn;
  const renditions = item.video?.renditions ?? [];
  const active = renditions.find((r) => resolveSource(r) === src);

  // ---------------------------------------------------------------- tamanho
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ W: e.contentRect.width, H: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---------------------------------------------------------------- fonte
  useEffect(() => {
    if (!renditions.length) return;
    const r = quality === 'auto' ? pickAutoRendition(item, size.H) : renditions.find((x) => x.id === quality);
    if (r && resolveSource(r) !== src) {
      const v = videoRef.current;
      const resume = v && src ? { time: v.currentTime, play: !v.paused } : null;
      setSrc(resolveSource(r));
      if (resume && v) {
        const onMeta = () => {
          v.currentTime = resume.time;
          v.playbackRate = rate;
          if (resume.play) v.play().catch(() => undefined);
          v.removeEventListener('loadedmetadata', onMeta);
        };
        v.addEventListener('loadedmetadata', onMeta);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quality, item.id, size.H > 500]);

  // ---------------------------------------------------------------- eventos do vídeo
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const on: Record<string, () => void> = {
      play: () => setPlaying(true),
      pause: () => setPlaying(false),
      ended: () => setPlaying(false),
      durationchange: () => setDuration(v.duration || 0),
      loadedmetadata: () => {
        setDuration(v.duration || 0);
        if (v.videoWidth && v.videoHeight) setAspect(v.videoWidth / v.videoHeight);
      },
      progress: () => {
        if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
      },
      volumechange: () => {
        setVolume(v.volume);
        setMuted(v.muted);
      },
      ratechange: () => setRate(v.playbackRate),
      waiting: () => setWaiting(true),
      playing: () => setWaiting(false),
      canplay: () => setWaiting(false),
    };
    Object.entries(on).forEach(([k, f]) => v.addEventListener(k, f));
    return () => Object.entries(on).forEach(([k, f]) => v.removeEventListener(k, f));
  }, [videoRef]);

  // autoplay ao chegar pelo botão "Assistir" (só na primeira fonte — trocar a qualidade não dá play)
  const autoplayed = useRef(false);
  useEffect(() => {
    if (!props.autoPlay || !src || autoplayed.current) return;
    const v = videoRef.current;
    if (!v) return;
    autoplayed.current = true;
    v.play().catch(() => setNeedsTap(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // ---------------------------------------------------------------- controles visíveis
  const poke = useCallback(() => {
    setControls(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      const v = videoRef.current;
      if (v && !v.paused) setControls(false);
    }, cinema ? 1800 : 2800);
  }, [cinema, videoRef]);
  useEffect(() => {
    if (!playing || menuOpen || settings) {
      setControls(true);
      window.clearTimeout(hideTimer.current);
    } else poke();
  }, [playing, menuOpen, settings, poke]);

  // ---------------------------------------------------------------- ações
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setNeedsTap(false);
    if (v.paused) v.play().catch(() => setNeedsTap(true));
    else v.pause();
  }, [videoRef]);
  const seek = useCallback(
    (to: number) => {
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = Math.max(0, Math.min(v.duration || to, to));
    },
    [videoRef],
  );
  const skip = useCallback(
    (d: number) => {
      const v = videoRef.current;
      if (v) seek(v.currentTime + d);
      poke();
    },
    [seek, poke, videoRef],
  );
  const toggleFullscreen = useCallback(async () => {
    const el = box.current;
    const v = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (el.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: 'hide' });
        try {
          await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape');
        } catch {
          /* nem todo dispositivo permite travar orientação */
        }
      } else if (v?.webkitEnterFullscreen) {
        toast('No iPhone, a tela cheia nativa não mostra o intérprete. Use o modo cinema para manter o avatar.', 'warn');
        v.webkitEnterFullscreen();
      }
    } catch {
      toast('Tela cheia não disponível neste navegador.', 'warn');
    }
  }, [toast, videoRef]);
  useEffect(() => {
    const on = () => setFullscreen(document.fullscreenElement === box.current);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);

  const setCaptions = (on: boolean, track?: string) => setPrefs({ captions: on, ...(track ? { captionTrack: track } : {}) });
  const toggleLibras = useCallback(() => {
    if (!props.librasAvailable) {
      toast('Este título ainda não tem interpretação em língua de sinais.', 'warn');
      return;
    }
    props.setLibrasOn(!librasOn);
    setCollapsed(false);
  }, [props, librasOn, toast]);

  // ---------------------------------------------------------------- teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.metaKey || e.ctrlKey || e.altKey) return;
      const v = videoRef.current;
      if (!v) return;
      const k = e.key.toLowerCase();
      const map: Record<string, () => void> = {
        ' ': togglePlay,
        k: togglePlay,
        j: () => skip(-10),
        l: () => skip(10),
        arrowleft: () => skip(-10),
        arrowright: () => skip(10),
        arrowup: () => (v.volume = Math.min(1, v.volume + 0.1)),
        arrowdown: () => (v.volume = Math.max(0, v.volume - 0.1)),
        m: () => (v.muted = !v.muted),
        f: toggleFullscreen,
        c: () => setPrefs({ captions: !prefs.captions }),
        i: toggleLibras,
        escape: () => (settings ? setSettings(false) : cinema && !document.fullscreenElement ? setPrefs({ cinemaMode: false }) : undefined),
      };
      if (map[k]) {
        if (k === ' ' && (e.target as HTMLElement)?.tagName === 'BUTTON') return;
        e.preventDefault();
        map[k]();
        poke();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, skip, toggleFullscreen, toggleLibras, prefs.captions, setPrefs, settings, cinema, poke, videoRef]);

  // ---------------------------------------------------------------- toque / clique na imagem
  const onSurfacePointerUp = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const rect = box.current!.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const now = performance.now();
    const isTouch = e.pointerType !== 'mouse';
    if (lastTap.current && now - lastTap.current.t < 300) {
      window.clearTimeout(tapTimer.current);
      lastTap.current = null;
      if (x < 0.35) {
        skip(-10);
        setRipple({ side: 'left', key: now });
      } else if (x > 0.65) {
        skip(10);
        setRipple({ side: 'right', key: now });
      } else toggleFullscreen();
      return;
    }
    lastTap.current = { t: now, x };
    tapTimer.current = window.setTimeout(() => {
      lastTap.current = null;
      if (isTouch) {
        if (controls && playing) setControls(false);
        else poke();
      } else togglePlay();
    }, isTouch ? 260 : 200);
  };

  // ---------------------------------------------------------------- iluminação adaptativa (modo cinema)
  useEffect(() => {
    if (!librasOn || !cinema) return;
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 9;
    const g = c.getContext('2d', { willReadFrequently: true });
    const id = window.setInterval(() => {
      const v = videoRef.current;
      if (!v || !g || v.readyState < 2) return;
      try {
        g.drawImage(v, 0, 0, 16, 9);
        const d = g.getImageData(0, 0, 16, 9).data;
        let r = 0;
        let gg = 0;
        let b = 0;
        for (let i = 0; i < d.length; i += 4) {
          r += d[i];
          gg += d[i + 1];
          b += d[i + 2];
        }
        const n = d.length / 4;
        r /= n * 255;
        gg /= n * 255;
        b /= n * 255;
        setAmbience({ lum: 0.2126 * r + 0.7152 * gg + 0.0722 * b, color: [r, gg, b] });
      } catch {
        /* vídeo de outra origem sem CORS: mantém iluminação padrão */
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [librasOn, cinema, videoRef]);

  // ---------------------------------------------------------------- diagnóstico
  useEffect(() => {
    if (!prefs.diagnostics) return;
    const id = window.setInterval(() => {
      const q = videoRef.current?.getVideoPlaybackQuality?.();
      if (q) setDropped({ dropped: q.droppedVideoFrames, total: q.totalVideoFrames });
    }, 1000);
    return () => window.clearInterval(id);
  }, [prefs.diagnostics, videoRef]);

  // painel de etapas da IA: aparece ao ligar Libras e some ao concluir
  useEffect(() => {
    if (!librasOn) return;
    setShowPipeline(true);
  }, [librasOn]);
  useEffect(() => {
    if (props.pipelineState.done && showPipeline) {
      const id = window.setTimeout(() => setShowPipeline(false), 1600);
      return () => window.clearTimeout(id);
    }
  }, [props.pipelineState.done, showPipeline]);

  // ---------------------------------------------------------------- layout
  const { W, H } = size;
  // Celular em pé: player mais alto, vídeo no topo, intérprete e legendas na faixa de baixo
  // — assim o avatar ganha tamanho sem cobrir a imagem.
  const stacked = portrait && W < 700 && !cinema && !fullscreen && !immersive;
  const STACK_TOP = 52;
  const videoAreaW = immersive ? W * 0.64 : W;
  const videoRect: Box = useMemo(() => {
    if (stacked) return { x: 0, y: STACK_TOP, w: W, h: W / aspect };
    let w = videoAreaW;
    let h = w / aspect;
    if (h > H) {
      h = H;
      w = h * aspect;
    }
    return { x: (videoAreaW - w) / 2, y: (H - h) / 2, w, h };
  }, [videoAreaW, H, W, aspect, stacked]);
  const controlsH = W < 860 ? 76 : 100;
  const bottomReserve = cinema || fullscreen ? (controls ? controlsH : 12) : controlsH;
  const rois = useMemo(() => (pipeline ? pipeline.analysis.regions.filter((r) => t >= r.start && t < r.end) : []), [pipeline, t]);
  const layout = useMemo(
    () => computeAvatarLayout({ W, H, prefs, bottomReserve, immersive, videoRect, rois }),
    [W, H, prefs, bottomReserve, immersive, videoRect, rois],
  );
  const avatarVisible = librasOn && !collapsed && Boolean(pipeline);
  const capPad = captionPadding(avatarVisible && !immersive ? layout : null, W, H);
  const capPadImm = immersive ? { left: 16, right: W * 0.36 + 16 } : capPad;

  // ---------------------------------------------------------------- dados do instante
  const timeline = pipeline?.timeline ?? null;
  const seg = timeline ? segmentAt(timeline, t, 0.3) : undefined;
  const sign = timeline ? activeSignAt(timeline, t) : undefined;
  const chars = pipeline?.analysis.characters ?? [];
  const speakerChar = seg?.representation.roleShift ? chars.find((c) => c.id === seg.representation.roleShift) : undefined;
  const speakerColors = Object.fromEntries(chars.map((c) => [c.voiceTag, c.color]));
  const captionCues = props.captionsByTrack[prefs.captionTrack] ?? props.captionsByTrack['cc-pt'] ?? [];
  const activeCue = (props.captionsByTrack['cc-pt'] ?? []).find((c) => t >= c.start && t < c.end);
  let emotion: { who: string | null; emotion: import('@/ai/types').Emotion; mood?: boolean } | null = null;
  if (prefs.emotionalDescription && pipeline) {
    const s = activeCue ? timeline?.segments.find((x) => x.unit.id === activeCue.id) : undefined;
    if (s) emotion = { who: chars.find((c) => c.id === s.context.speaker.speakerId)?.name ?? null, emotion: s.context.emotion.emotion };
    else {
      const sc = sceneAt(pipeline.analysis, t);
      if (sc && sc.tension >= 0.6) emotion = { who: null, emotion: sc.mood, mood: true };
    }
  }
  const glossLabel = sign ? (sign.token.kind === 'fingerspell' ? `${sign.token.letters?.split('').join('-')}` : sign.token.gloss) : null;
  const statusOf = seg?.status;

  const classes = ['player', cinema ? 'cinema' : 'page-mode', stacked ? 'stacked' : '', immersive ? 'immersive' : '', controls ? 'controls-visible' : 'controls-hidden', !controls && playing ? 'hide-cursor' : ''].join(' ');

  return (
    <div ref={box} className={classes} onPointerMove={(e) => e.pointerType === 'mouse' && poke()} onPointerDown={(e) => e.pointerType !== 'mouse' && poke()} tabIndex={-1}>
      <video
        ref={videoRef}
        style={stacked ? { top: STACK_TOP, height: videoRect.h, bottom: 'auto' } : undefined}
        src={src}
        poster={item.backdrop}
        playsInline
        preload="auto"
        onPointerUp={onSurfacePointerUp}
        aria-label={`Vídeo: ${item.title}`}
      >
        {/* Faixas WebVTT nativas (para leitores de tela / tecnologias assistivas). A exibição visual usa a camada própria. */}
        {item.textTracks
          .filter((tr) => tr.kind !== 'sounds')
          .map((tr) => (
            <track key={tr.id} kind={tr.kind === 'captions' ? 'captions' : 'subtitles'} src={tr.src} srcLang={tr.lang} label={tr.label} />
          ))}
      </video>

      {prefs.diagnostics &&
        rois.map((r) => {
          const b = roiToBox(r, videoRect);
          return (
            <div key={r.id} className="roi-debug" style={{ left: b.x, top: b.y, width: b.w, height: b.h }}>
              {r.label}
            </div>
          );
        })}

      {prefs.captions && <Captions cues={captionCues} t={t} size={prefs.captionSize} speakerColors={speakerColors} showSpeaker={prefs.showSpeakerNames} emotion={emotion} padding={capPadImm} />}
      {!prefs.captions && emotion && <Captions cues={[]} t={t} size={prefs.captionSize} speakerColors={{}} showSpeaker={false} emotion={emotion} padding={capPadImm} />}
      {prefs.soundCues && !(showPipeline && librasOn) && <SoundCues sounds={props.sounds} t={t} />}

      {ripple && (
        <div key={ripple.key} className={`seek-ripple ${ripple.side}`} onAnimationEnd={() => setRipple(null)}>
          {ripple.side === 'left' ? '« 10 s' : '10 s »'}
        </div>
      )}
      {waiting && playing && <div className="spinner" aria-label="Carregando" />}
      {(needsTap || (!playing && t < 0.05)) && (
        <button className="big-play" aria-label="Reproduzir" onClick={togglePlay}>
          <Play size={36} fill="currentColor" />
        </button>
      )}

      {librasOn && pipeline && (
        <AvatarWindow
          layout={layout}
          W={W}
          H={H}
          prefs={prefs}
          setPrefs={setPrefs}
          getTime={() => videoRef.current?.currentTime ?? 0}
          timeline={timeline}
          loci={pipeline.loci}
          immersive={immersive}
          cinema={cinema || fullscreen}
          ambience={ambience}
          speaker={speakerChar ? { name: speakerChar.name, color: speakerChar.color } : null}
          gloss={glossLabel}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          onClose={() => props.setLibrasOn(false)}
          onStatus={(s) => {
            setAvatarStatus(s);
            if (s.kind === 'error') toast(s.message, 'warn');
          }}
          status={avatarStatus}
          onFps={(fps, cpu) => setAvatarFps({ fps, cpu })}
          bottomReserve={bottomReserve}
        />
      )}
      {librasOn && layout.autoMovedFor && !collapsed && !immersive && (
        <div className="reposition-note" style={{ left: layout.x, top: Math.max(8, layout.y - 30) }}>
          Intérprete reposicionado: não cobrir {layout.autoMovedFor}
        </div>
      )}

      {librasOn && showPipeline && <PipelineStatus state={props.pipelineState} />}
      {librasOn && !showPipeline && props.pipelineState.done && (
        <div className="ai-chip" style={{ opacity: controls ? 1 : 0.55 }}>
          <span className="pulse" />
          <span>Interpretação ativa</span>
          <span className="hide-xs">· {SIGN_LANGUAGES[prefs.signLanguage].short}</span>
          {statusOf && <span className="hide-xs" style={{ color: statusOf === 'HUMAN_VERIFIED' || statusOf === 'PUBLISHED' ? 'var(--ok)' : 'var(--warn)' }}>· {STATUS_LABEL[statusOf]}</span>}
        </div>
      )}

      {prefs.diagnostics && (
        <div className="diag">
          <div>vídeo t = {t.toFixed(2)} s · {rate}× · {active?.height ?? '—'}p</div>
          <div>quadros perdidos: {dropped ? `${dropped.dropped}/${dropped.total}` : '—'}</div>
          <div>avatar: {librasOn ? `${avatarFps.fps} fps (teto ${immersive ? 45 : 30}) · JS ${avatarFps.cpu.toFixed(2)} ms/quadro · ${avatarStatus?.kind ?? '—'}` : 'desligado (render parado)'}</div>
          <div>sinal: {sign ? `${sign.token.gloss} [${sign.start.toFixed(2)}–${sign.end.toFixed(2)}]` : '—'}</div>
          <div>regiões protegidas: {rois.length}</div>
        </div>
      )}

      <div className="player-top" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn" aria-label="Voltar" onClick={() => (cinema ? setPrefs({ cinemaMode: false }) : nav(-1))} style={{ background: 'rgba(0,0,0,0.35)' }}>
          {cinema ? <X size={18} /> : <ArrowLeft size={18} />}
        </button>
        <div>
          <div className="title">{item.title}</div>
          <div className="sub">
            {cinema ? 'Modo cinema · Esc para sair' : immersive ? 'Libras imersivo' : librasOn ? `Intérprete IA · ${SIGN_LANGUAGES[prefs.signLanguage].name}` : 'Pressione I para o intérprete de Libras'}
          </div>
        </div>
      </div>

      <PlayerControls
        playing={playing}
        time={t}
        duration={duration}
        buffered={buffered}
        volume={volume}
        muted={muted}
        rate={rate}
        quality={quality}
        activeRendition={active}
        renditions={renditions}
        captionsOn={prefs.captions}
        captionTrack={prefs.captionTrack}
        captionTracks={item.textTracks.filter((x) => x.kind !== 'sounds' && x.kind !== 'descriptions')}
        audioTracks={item.audioTracks}
        librasOn={librasOn}
        librasAvailable={props.librasAvailable}
        fullscreen={fullscreen}
        cinema={cinema}
        immersive={immersive}
        sounds={props.sounds}
        segments={timeline?.segments ?? []}
        onPlay={togglePlay}
        onSeek={seek}
        onSkip={skip}
        onVolume={(v) => {
          const el = videoRef.current;
          if (!el) return;
          el.volume = v;
          el.muted = v === 0;
        }}
        onMute={() => {
          const el = videoRef.current;
          if (el) el.muted = !el.muted;
        }}
        onRate={(r) => {
          const el = videoRef.current;
          if (el) el.playbackRate = r;
        }}
        onQuality={setQuality}
        onCaptions={setCaptions}
        onLibras={toggleLibras}
        onSettings={() => setSettings(true)}
        onFullscreen={toggleFullscreen}
        onCinema={() => setPrefs({ cinemaMode: !cinema })}
        onImmersive={() => setPrefs({ immersive: !prefs.immersive })}
        onMenuOpen={setMenuOpen}
      />

      {settings && <AccessibilityPanel prefs={prefs} setPrefs={setPrefs} librasOn={librasOn} setLibrasOn={toggleLibrasTo(props, librasOn)} item={item} onClose={() => setSettings(false)} />}
    </div>
  );
}

function toggleLibrasTo(props: VideoPlayerProps, current: boolean) {
  return (on: boolean) => {
    if (on !== current && (props.librasAvailable || !on)) props.setLibrasOn(on);
  };
}
