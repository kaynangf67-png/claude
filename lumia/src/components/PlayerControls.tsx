import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Volume1, Subtitles, AudioLines, Settings, Maximize, Minimize, Gauge, Clapperboard, PanelRight, Check } from 'lucide-react';
import { formatTime } from '@/services/videoService';
import type { AudioTrack, TimedTextTrack, VideoRendition } from '@/types/content';
import type { SoundEvent } from '@/ai/types';
import type { TimelineSegment } from '@/avatar/timelineEngine';

export interface PlayerControlsProps {
  playing: boolean;
  time: number;
  duration: number;
  buffered: number;
  volume: number;
  muted: boolean;
  rate: number;
  quality: string; // 'auto' | rendition id
  activeRendition?: VideoRendition;
  renditions: VideoRendition[];
  captionsOn: boolean;
  captionTrack: string;
  captionTracks: TimedTextTrack[];
  audioTracks: AudioTrack[];
  librasOn: boolean;
  librasAvailable: boolean;
  fullscreen: boolean;
  cinema: boolean;
  immersive: boolean;
  sounds: SoundEvent[];
  segments: TimelineSegment[];
  onPlay: () => void;
  onSeek: (t: number) => void;
  onSkip: (d: number) => void;
  onVolume: (v: number) => void;
  onMute: () => void;
  onRate: (r: number) => void;
  onQuality: (q: string) => void;
  onCaptions: (on: boolean, track?: string) => void;
  onLibras: () => void;
  onSettings: () => void;
  onFullscreen: () => void;
  onCinema: () => void;
  onImmersive: () => void;
  onMenuOpen: (open: boolean) => void;
}

type MenuId = 'cc' | 'audio' | 'quality' | 'speed' | null;

function MenuButton({ id, open, setOpen, label, icon, children, hideSm, hideXs }: { id: MenuId; open: MenuId; setOpen: (m: MenuId) => void; label: string; icon: ReactNode; children: ReactNode; hideSm?: boolean; hideXs?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open !== id) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open, id, setOpen]);
  return (
    <div style={{ position: 'relative' }} ref={ref} className={hideSm ? 'hide-sm' : hideXs ? 'hide-xs-ctrl' : ''}>
      <button className="cbtn" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open === id} onClick={() => setOpen(open === id ? null : id)}>
        {icon}
      </button>
      {open === id && (
        <div className="pop-menu" role="menu">
          {children}
        </div>
      )}
    </div>
  );
}

function Item({ checked, onClick, children, disabled }: { checked?: boolean; onClick?: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button role="menuitemradio" aria-checked={Boolean(checked)} onClick={onClick} disabled={disabled}>
      <span>{children}</span>
      {checked && <Check size={15} />}
    </button>
  );
}

const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function PlayerControls(p: PlayerControlsProps) {
  const [menu, setMenuState] = useState<MenuId>(null);
  const setMenu = (m: MenuId) => {
    setMenuState(m);
    p.onMenuOpen(m !== null);
  };
  const bar = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [drag, setDrag] = useState<number | null>(null);

  const posFrom = (clientX: number) => {
    const r = bar.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * (p.duration || 0);
  };

  const shown = drag ?? p.time;
  const pct = p.duration ? (shown / p.duration) * 100 : 0;
  const VolIcon = p.muted || p.volume === 0 ? VolumeX : p.volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="controls" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <div
        ref={bar}
        className={`progress ${drag !== null ? 'dragging' : ''}`}
        role="slider"
        aria-label="Linha do tempo"
        aria-valuemin={0}
        aria-valuemax={Math.round(p.duration)}
        aria-valuenow={Math.round(shown)}
        aria-valuetext={`${formatTime(shown)} de ${formatTime(p.duration)}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') (e.preventDefault(), e.stopPropagation(), p.onSkip(-5));
          if (e.key === 'ArrowRight') (e.preventDefault(), e.stopPropagation(), p.onSkip(5));
        }}
        onPointerDown={(e) => {
          try {
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
          setDrag(posFrom(e.clientX));
        }}
        onPointerMove={(e) => {
          const t = posFrom(e.clientX);
          setHover(t);
          if (drag !== null) setDrag(t);
        }}
        onPointerUp={(e) => {
          if (drag !== null) p.onSeek(posFrom(e.clientX));
          setDrag(null);
        }}
        onPointerLeave={() => setHover(null)}
      >
        <div className="progress-rail">
          <div className="progress-buffer" style={{ width: `${p.duration ? (p.buffered / p.duration) * 100 : 0}%` }} />
          <div className="progress-fill" style={{ width: `${pct}%` }} />
          {p.duration > 0 &&
            p.sounds
              .filter((s) => s.importance !== 'low')
              .map((s) => <span key={s.id} className="progress-mark sound" style={{ left: `${(s.start / p.duration) * 100}%` }} title={s.label} />)}
          {p.librasOn &&
            p.duration > 0 &&
            p.segments.map((s) => <span key={s.id} className="progress-seg" style={{ left: `${(s.signStart / p.duration) * 100}%`, width: `${Math.max(0.4, ((s.signEnd - s.signStart) / p.duration) * 100)}%` }} />)}
          <div className="progress-thumb" style={{ left: `${pct}%` }} />
        </div>
        {hover !== null && (
          <div className="progress-tip" style={{ left: `${(hover / (p.duration || 1)) * 100}%` }}>
            {formatTime(hover)}
          </div>
        )}
      </div>

      <div className="controls-row">
        <button className="cbtn" aria-label={p.playing ? 'Pausar (K)' : 'Reproduzir (K)'} title={p.playing ? 'Pausar' : 'Reproduzir'} onClick={p.onPlay}>
          {p.playing ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
        </button>
        <button className="cbtn" aria-label="Voltar 10 segundos (J)" title="Voltar 10 s" onClick={() => p.onSkip(-10)}>
          <RotateCcw size={21} />
          <span className="sr-only">10</span>
        </button>
        <button className="cbtn" aria-label="Avançar 10 segundos (L)" title="Avançar 10 s" onClick={() => p.onSkip(10)}>
          <RotateCw size={21} />
        </button>
        <div className="volume">
          <button className="cbtn" aria-label={p.muted ? 'Ativar som (M)' : 'Silenciar (M)'} onClick={p.onMute}>
            <VolIcon size={21} />
          </button>
          <input type="range" min={0} max={1} step={0.02} value={p.muted ? 0 : p.volume} onChange={(e) => p.onVolume(parseFloat(e.target.value))} aria-label="Volume" />
        </div>
        <span className="time">
          {formatTime(p.time)}
          <span className="dur"> / {formatTime(p.duration)}</span>
        </span>
        <span className="spacer" />

        <MenuButton id="cc" open={menu} setOpen={setMenu} label="Legendas (C)" icon={<Subtitles size={21} color={p.captionsOn ? 'var(--amber)' : undefined} />}>
          <div className="label">Legendas</div>
          <Item checked={!p.captionsOn} onClick={() => (p.onCaptions(false), setMenu(null))}>
            Desligadas
          </Item>
          {p.captionTracks.map((t) => (
            <Item key={t.id} checked={p.captionsOn && p.captionTrack === t.id} onClick={() => (p.onCaptions(true, t.id), setMenu(null))}>
              {t.label}
            </Item>
          ))}
        </MenuButton>
        <MenuButton id="audio" open={menu} setOpen={setMenu} label="Áudio" icon={<AudioLines size={21} />} hideSm>
          <div className="label">Áudio</div>
          {p.audioTracks.map((a) => (
            <Item key={a.id} checked={a.kind === 'original'} disabled={!a.available}>
              {a.label}
              {!a.available && ' — em breve'}
            </Item>
          ))}
        </MenuButton>
        <MenuButton id="quality" open={menu} setOpen={setMenu} label="Qualidade" icon={<span style={{ fontSize: 12, fontWeight: 800 }}>{p.quality === 'auto' ? 'AUTO' : p.activeRendition?.height + 'p'}</span>} hideSm>
          <div className="label">Qualidade</div>
          <Item checked={p.quality === 'auto'} onClick={() => (p.onQuality('auto'), setMenu(null))}>
            Automática{p.quality === 'auto' && p.activeRendition ? ` (${p.activeRendition.height}p)` : ''}
          </Item>
          {p.renditions.map((r) => (
            <Item key={r.id} checked={p.quality === r.id} onClick={() => (p.onQuality(r.id), setMenu(null))}>
              {r.label}
            </Item>
          ))}
        </MenuButton>
        <MenuButton id="speed" open={menu} setOpen={setMenu} label="Velocidade" icon={<Gauge size={21} />} hideXs>
          <div className="label">Velocidade</div>
          {RATES.map((r) => (
            <Item key={r} checked={p.rate === r} onClick={() => (p.onRate(r), setMenu(null))}>
              {r === 1 ? 'Normal' : `${r}×`}
            </Item>
          ))}
        </MenuButton>

        <button className="cbtn libras" aria-pressed={p.librasOn} onClick={p.onLibras} disabled={!p.librasAvailable} title={p.librasAvailable ? 'Intérprete de Libras (I)' : 'Sem interpretação para este título'}>
          <span aria-hidden>🤟</span>
          <span className="lbl-txt">Libras</span>
        </button>
        <button className="cbtn hide-sm" aria-pressed={p.immersive} aria-label="Libras imersivo" title="Libras imersivo — mais espaço para o intérprete" onClick={p.onImmersive} disabled={!p.librasOn}>
          <PanelRight size={21} />
        </button>
        <button className="cbtn hide-sm" aria-pressed={p.cinema} aria-label="Modo cinema" title="Modo cinema" onClick={p.onCinema}>
          <Clapperboard size={21} />
        </button>
        <button className="cbtn" aria-label="Acessibilidade e configurações" title="Acessibilidade e configurações" onClick={p.onSettings}>
          <Settings size={21} />
        </button>
        <button className="cbtn" aria-label={p.fullscreen ? 'Sair da tela cheia (F)' : 'Tela cheia (F)'} title="Tela cheia" onClick={p.onFullscreen}>
          {p.fullscreen ? <Minimize size={21} /> : <Maximize size={21} />}
        </button>
      </div>
    </div>
  );
}

export { RATES };
