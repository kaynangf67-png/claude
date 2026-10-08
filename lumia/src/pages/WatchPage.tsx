import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { CatalogItem } from '@/types/content';
import type { SoundEvent, TimedCue } from '@/ai/types';
import { catalog, hasInterpretation, isPlayable } from '@/services/catalogService';
import { loadWebVTT } from '@/services/videoService';
import { soundEventsFromCues } from '@/ai/multimodalAnalyzer';
import { PipelineUnavailableError, runInterpretationPipeline, type PipelineResult, type PipelineStage } from '@/ai/interpretationPipeline';
import { useApp } from '@/context/AppContext';
import { VideoPlayer } from '@/components/VideoPlayer';
import { Transcript } from '@/components/Transcript';
import { LibrasPanel, SceneInsight } from '@/components/SceneInsight';
import type { PipelineState } from '@/components/PipelineStatus';
import { Disclaimer } from '@/components/ui';

const MIN_STAGE_MS = 260; // ritmo mínimo para a pessoa conseguir ler cada etapa

export default function WatchPage() {
  const { slug = '' } = useParams();
  const [search] = useSearchParams();
  const { prefs, reviews, setProgress, progress } = useApp();
  const [item, setItem] = useState<CatalogItem | null | undefined>(undefined);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [t, setT] = useState(0);
  const [captions, setCaptions] = useState<Record<string, TimedCue[]>>({});
  const [sounds, setSounds] = useState<SoundEvent[]>([]);
  const [pipeline, setPipeline] = useState<PipelineResult | null>(null);
  const [pState, setPState] = useState<PipelineState>({ stage: null, details: {}, done: false, error: null });
  const wantsLibras = search.get('libras') === '1';
  const [librasOn, setLibrasOn] = useState<boolean>(false);

  useEffect(() => {
    catalog.get(slug).then((i) => setItem(i ?? null));
  }, [slug]);

  const librasAvailable = Boolean(item && hasInterpretation(item, prefs.signLanguage));

  useEffect(() => {
    if (item && librasAvailable) setLibrasOn(wantsLibras || prefs.interpreterEnabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, librasAvailable]);

  // legendas e sons (WebVTT)
  useEffect(() => {
    if (!item) return;
    let alive = true;
    for (const tr of item.textTracks) {
      loadWebVTT(tr.src)
        .then((cues) => {
          if (!alive) return;
          if (tr.kind === 'sounds' || tr.kind === 'descriptions') setSounds(soundEventsFromCues(cues));
          else setCaptions((c) => ({ ...c, [tr.id]: cues }));
        })
        .catch((e) => console.warn('[LUMIA] legenda indisponível', tr.src, e));
    }
    return () => {
      alive = false;
    };
  }, [item]);

  // pipeline de interpretação (roda uma vez por título; refaz quando há revisão humana)
  useEffect(() => {
    if (!item || !librasAvailable) return;
    let alive = true;
    const animate = librasOn && !pipeline;
    setPState({ stage: null, details: {}, done: false, error: null });
    runInterpretationPipeline(item, {
      language: prefs.signLanguage,
      reviews,
      onStage: async (stage: PipelineStage, detail: string) => {
        if (!alive) return;
        setPState((s) => ({ ...s, stage, details: { ...s.details, [stage]: detail } }));
        if (animate) await new Promise((r) => setTimeout(r, MIN_STAGE_MS));
      },
    })
      .then((res) => {
        if (!alive) return;
        setPipeline(res);
        setPState((s) => ({ ...s, done: true, elapsedMs: res.elapsedMs }));
      })
      .catch((e) => {
        if (!alive) return;
        setPState((s) => ({ ...s, error: e instanceof PipelineUnavailableError ? e.message : `Falha no pipeline: ${String(e)}` }));
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, librasAvailable, reviews, prefs.signLanguage]);

  // relógio da interface (10 Hz). O avatar NÃO depende disso: lê currentTime a cada quadro.
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 90) return;
      last = now;
      const v = videoRef.current;
      if (v) setT((prev) => (Math.abs(prev - v.currentTime) > 0.01 ? v.currentTime : prev));
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // continuar assistindo
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !item) return;
    const saved = progress[item.id];
    const onMeta = () => {
      if (saved && saved.time > 3 && saved.time < (v.duration || 0) - 3 && !search.get('t')) v.currentTime = saved.time;
      const qt = parseFloat(search.get('t') ?? '');
      if (Number.isFinite(qt)) v.currentTime = qt;
    };
    let lastSave = 0;
    const onTime = () => {
      const now = Date.now();
      if (now - lastSave < 2000) return;
      lastSave = now;
      if (v.currentTime > 1) setProgress(item.id, { time: v.currentTime, duration: v.duration || 0, updatedAt: now });
    };
    const onEnd = () => setProgress(item.id, null);
    v.addEventListener('loadedmetadata', onMeta, { once: true });
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('ended', onEnd);
    return () => {
      v.removeEventListener('loadedmetadata', onMeta);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('ended', onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item]);

  if (item === undefined) return <div className="watch" />;
  if (!item || !isPlayable(item)) {
    return (
      <div className="page container">
        <div className="empty">
          <h2 style={{ marginBottom: 10 }}>Título indisponível para reprodução</h2>
          <p>{item ? 'Este título está em negociação de licenciamento ou ainda não tem vídeo autorizado.' : 'Não encontramos este título.'}</p>
          <Link className="btn btn-ghost" to={item ? `/titulo/${item.slug}` : '/'} style={{ marginTop: 16 }}>
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  const seek = (to: number) => {
    const v = videoRef.current;
    if (v) v.currentTime = to;
  };

  return (
    <div className="watch">
      <h1 className="sr-only">Assistindo: {item.title}</h1>
      <VideoPlayer
        item={item}
        videoRef={videoRef}
        time={t}
        captionsByTrack={captions}
        sounds={sounds}
        pipeline={pipeline}
        pipelineState={pState}
        librasOn={librasOn}
        setLibrasOn={setLibrasOn}
        librasAvailable={librasAvailable}
        autoPlay
      />
      {!prefs.cinemaMode && (
        <>
          <div className="watch-panels">
            <Transcript cues={captions['cc-pt'] ?? []} sounds={sounds} analysis={pipeline?.analysis ?? null} t={t} onSeek={seek} />
            <SceneInsight pipeline={pipeline} t={t} />
            <LibrasPanel pipeline={pipeline} t={t} librasOn={librasOn} />
          </div>
          <div className="container" style={{ paddingBottom: 40 }}>
            <Disclaimer />
            {pState.done && pState.elapsedMs !== undefined && (
              <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                Pipeline executado no navegador em {Math.round(pState.elapsedMs)} ms (etapas exibidas com ritmo mínimo de leitura). Análise de cena e plano de glosas: dados pré-processados de demonstração.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
