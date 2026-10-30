import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Ban, Check, ImagePlus, Loader2, RefreshCw, Trash2, X,
} from "lucide-react";
import type { Result } from "../server/analyze";
import { prepareImage } from "./lib/image";
import { breakEven, entryTimes, hhmm, wilson } from "./lib/math";
import { load, save, type Entry } from "./lib/history";
import { Logo } from "./components/Logo";
import { Candle3D, CandleScene, Tilt } from "./components/ThreeD";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const pct = (v: number) => `${(v * 100).toFixed(1).replace(".", ",")}%`;
const num = (v: number | null) =>
  v === null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: v >= 100 ? 2 : 5 });

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function App() {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [capturedAt, setCapturedAt] = useState<number | null>(null);
  const [payout, setPayout] = useState(() => {
    try {
      return Number(localStorage.getItem("trade-ai:payout")) || 85;
    } catch {
      return 85;
    }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [timing, setTiming] = useState<{ entry: Date; expiry: Date } | null>(null);
  const [history, setHistory] = useState<Entry[]>(load);
  const [drag, setDrag] = useState(false);

  useEffect(() => save(history), [history]);
  useEffect(() => {
    try {
      localStorage.setItem("trade-ai:payout", String(payout));
    } catch { /* sem armazenamento */ }
  }, [payout]);

  const take = useCallback((b: Blob | null | undefined, when?: number) => {
    if (!b || !b.type.startsWith("image/")) return;
    setBlob(b);
    setCapturedAt(when ?? Date.now());
    setResult(null);
    setTiming(null);
    setError(null);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(b);
    });
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      if (item) take(item.getAsFile(), Date.now());
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [take]);

  const analyze = async () => {
    if (!blob) return;
    if (import.meta.env.VITE_PREVIEW) {
      setError("Esta é só uma prévia da interface. A análise com IA funciona no site da Vercel, depois de cadastrar a ANTHROPIC_API_KEY.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const img = await prepareImage(blob);
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          image: img.data, media_type: img.mediaType,
          image_age_s: capturedAt ? (Date.now() - capturedAt) / 1000 : null,
        }),
      });
      const body = await res.json().catch(() => ({ error: `Erro ${res.status}` }));
      if (!res.ok) throw new Error(body.error ?? `Erro ${res.status}`);
      const r = body as Result;
      setResult(r);
      const t = r.decision !== "NAO_OPERAR" && r.timeframe_minutes
        ? entryTimes(new Date(), r.timeframe_minutes, r.expiration_candles) : null;
      setTiming(t);
      if (r.decision !== "NAO_OPERAR") {
        setHistory((h) => [{
          id: crypto.randomUUID(), at: Date.now(), symbol: r.symbol, timeframe: r.timeframe, decision: r.decision,
          quality: r.setup_quality, payout: payout / 100, entryAt: t?.entry.getTime() ?? null,
          expiryAt: t?.expiry.getTime() ?? null, result: null,
        }, ...h]);
      }
    } catch (e) {
      setError(e instanceof TypeError ? "Sem conexão com o servidor." : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const be = breakEven(payout / 100);

  return (
    <div className="mx-auto flex min-h-screen max-w-[1180px] flex-col px-4 py-6 md:px-8 md:py-8">
      <CandleScene />
      <header className="flex items-center gap-3">
        <Logo size={44} />
        <div className="leading-tight">
          <div className="text-[18px] font-extrabold tracking-[0.08em]">TRADE <span className="title-gradient">AI</span></div>
          <div className="text-[11.5px] text-faint">Leitura de print para binárias</div>
        </div>
        <div className="ml-auto hidden items-end gap-5 pr-2 sm:flex" style={{ perspective: 600 }} aria-hidden>
          <Candle3D up w={14} h={34} wick={10} />
          <Candle3D up={false} w={14} h={26} wick={12} style={{ animationDelay: "-3s" }} />
        </div>
      </header>

      <main className="mt-7 grid flex-1 gap-5 lg:grid-cols-[1.1fr_1fr]">
        {/* Print */}
        <Tilt className="card3d animate-fade min-w-0 p-5" max={2.5}>
          <label
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; take(f, f?.lastModified); }}
            className={cx("flex min-h-[300px] cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-dashed bg-panel p-3 text-center transition-colors",
              drag ? "border-info bg-info/10" : "border-line-2 hover:border-info/60")}>
            <input type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; take(f, f?.lastModified); e.target.value = ""; }} />
            {preview ? (
              <img src={preview} alt="Print selecionado" className="max-h-[420px] rounded-xl object-contain" />
            ) : (
              <>
                <div className="grid size-14 place-items-center rounded-2xl border border-line bg-card-2"><ImagePlus size={24} className="text-mute" /></div>
                <div className="text-[15px] font-semibold">Selecione o print do mercado</div>
                <div className="max-w-xs text-[12.5px] leading-relaxed text-mute">
                  Toque para escolher, arraste ou cole com Ctrl+V. Mostre ativo, tempo gráfico, escala de preço e as últimas velas.
                </div>
              </>
            )}
          </label>

          <div className="mt-4 flex items-end gap-3">
            <label className="w-32">
              <span className="text-[12px] font-medium text-mute">Payout</span>
              <div className="relative mt-1.5">
                <input type="number" min={10} max={100} value={payout}
                  onChange={(e) => setPayout(Math.min(100, Math.max(10, Number(e.target.value) || 0)))}
                  className="num w-full rounded-xl border border-line-2 bg-panel px-3 py-2.5 pr-8 text-[14px] focus:border-info focus:outline-none" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-faint">%</span>
              </div>
            </label>
            <div className="pb-2.5 text-[12px] text-mute">
              Precisa acertar <b className="num text-ink">{pct(be)}</b> só para empatar.
            </div>
          </div>

          <button onClick={analyze} disabled={!blob || busy}
            className="btn3d mt-4 mb-1.5 flex w-full items-center justify-center gap-2.5 rounded-2xl py-4 text-[15px] font-extrabold tracking-[0.06em] text-[#03130a] disabled:cursor-not-allowed disabled:opacity-40">
            {busy ? <><Loader2 size={18} className="animate-spin" /> ANALISANDO O PRINT…</> : "CALCULAR ENTRADA"}
          </button>
          {blob && !busy && (
            <button onClick={() => { setBlob(null); setPreview(null); setResult(null); setError(null); }}
              className="mt-2 w-full py-1 text-[12px] text-faint hover:text-mute">Trocar print</button>
          )}
        </Tilt>

        {/* Resultado */}
        <Tilt className="card3d animate-fade min-w-0 p-5" max={3}>
          {error ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-10 text-center">
              <AlertTriangle className="text-sell" />
              <div className="max-w-sm text-[14px] text-sell">{error}</div>
            </div>
          ) : busy ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-mute">
              <Loader2 className="animate-spin" /> <span className="text-[13px]">Lendo velas, níveis e indicadores…</span>
            </div>
          ) : result ? (
            <ResultView r={result} timing={timing} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-14 text-center">
              <div className="flex h-24 items-end gap-6" style={{ perspective: 600 }} aria-hidden>
                <Candle3D up w={18} h={44} wick={14} />
                <Candle3D up={false} w={18} h={34} wick={16} style={{ animationDelay: "-4s" }} />
              </div>
              <div className="text-[15px] font-semibold">A entrada aparece aqui</div>
              <p className="max-w-sm text-[12.5px] leading-relaxed text-mute">
                CALL, PUT ou NÃO OPERAR, com horário de entrada, expiração e motivos. Quando o print não deixa claro, a resposta é não operar.
              </p>
            </div>
          )}
        </Tilt>
      </main>

      <Performance history={history} setHistory={setHistory} />

      <footer className="mt-8 space-y-1 text-center text-[11px] leading-relaxed text-faint">
        <p>A leitura de um print não prevê a próxima vela. Nenhum resultado é garantido; opere só o que pode perder.</p>
        <p>A CVM já alertou que corretoras de opções binárias que captam clientes no Brasil não têm autorização para isso.</p>
      </footer>
    </div>
  );
}

function ResultView({ r, timing }: { r: Result; timing: { entry: Date; expiry: Date } | null }) {
  const now = useNow();
  const call = r.decision === "CALL";
  const wait = r.decision === "NAO_OPERAR";
  const toEntry = timing ? Math.round((timing.entry.getTime() - now) / 1000) : null;
  const late = toEntry !== null && toEntry < -5;

  return (
    <div className="animate-fade space-y-4">
      <div className={cx("flex items-center gap-4 rounded-2xl border p-4",
        wait ? "border-line-2 bg-card-2" : call ? "border-buy/40 bg-buy/10 shadow-[0_0_40px_-12px_#22c55e]" : "border-sell/40 bg-sell/10 shadow-[0_0_40px_-12px_#ef4444]")}>
        <div className={cx("grid size-16 shrink-0 place-items-center rounded-2xl border",
          wait ? "border-line bg-panel text-mute" : call ? "border-buy/40 bg-buy/15" : "border-sell/40 bg-sell/15")}
          style={{ perspective: 400 }}>
          {wait ? <Ban size={26} /> : <Candle3D up={call} w={14} h={26} wick={9} />}
        </div>
        <div className="min-w-0">
          <div className={cx("flex items-center gap-2 text-[28px] font-extrabold leading-none tracking-wide", wait ? "text-mute" : call ? "text-buy" : "text-sell")}>
            {wait ? "NÃO OPERAR" : r.decision}
            {!wait && (call ? <ArrowUpRight size={26} /> : <ArrowDownRight size={26} />)}
          </div>
          <div className="mt-1.5 text-[12.5px] text-mute">
            {[r.symbol, r.timeframe, r.platform].filter(Boolean).join(" · ") || "ativo não identificado"}
            {!wait && <> · setup <b className="text-ink">{r.setup_quality}</b></>}
          </div>
        </div>
      </div>

      {!wait && timing && (
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line text-center">
          <Cell k="Entrada" v={hhmm(timing.entry)} hint="abertura da vela" />
          <Cell k="Expiração" v={hhmm(timing.expiry)} hint={`${r.expiration_candles} vela${r.expiration_candles > 1 ? "s" : ""}`} />
          <Cell k={late ? "Status" : "Faltam"} v={late ? "Passou" : `${Math.max(0, toEntry ?? 0)}s`}
            hint={late ? "não entre atrasado" : "pelo relógio do aparelho"} tone={late ? "text-sell" : "text-warn"} />
        </div>
      )}
      {!wait && r.entry_reference_price !== null && (
        <div className="text-[12.5px] text-mute">Preço de referência no print: <b className="num text-ink">{num(r.entry_reference_price)}</b></div>
      )}

      {wait && (r.blocks.length > 0 || r.ai_decision === "NAO_OPERAR") && (
        <div className="space-y-1.5 rounded-xl border border-warn/30 bg-warn/10 p-3 text-[12.5px] text-warn">
          {r.blocks.map((b) => <div key={b} className="flex gap-2"><RefreshCw size={13} className="mt-0.5 shrink-0" />{b}</div>)}
          {r.ai_decision === "NAO_OPERAR" && r.blocks.length === 0 && <div>Sem setup claro neste print. Espere a próxima oportunidade.</div>}
          {r.ai_decision !== "NAO_OPERAR" && <div className="text-faint">A leitura indicava {r.ai_decision}, mas foi bloqueada pelas travas acima.</div>}
        </div>
      )}

      <List title="A favor" items={r.reasons} icon={<Check size={13} className="mt-0.5 shrink-0 text-buy" />} />
      <List title="Contra" items={r.against} icon={<X size={13} className="mt-0.5 shrink-0 text-sell" />} />
      {r.invalidation && !wait && <p className="text-[12.5px] text-mute"><b className="text-ink">Não entre se:</b> {r.invalidation}</p>}

      <details className="rounded-xl border border-line bg-panel px-3 py-2 text-[12.5px] text-mute">
        <summary className="cursor-pointer select-none font-semibold text-ink">O que a IA leu no print</summary>
        <div className="mt-2 space-y-1">
          <div>Tendência: <b className="text-ink">{r.trend}</b> · último preço: <b className="num text-ink">{num(r.last_price)}</b>{r.visible_time && <> · horário: {r.visible_time}</>}</div>
          <div>Últimas velas: {r.last_candles}</div>
          {r.supports.length > 0 && <div>Suportes: <span className="num">{r.supports.map(num).join(" · ")}</span></div>}
          {r.resistances.length > 0 && <div>Resistências: <span className="num">{r.resistances.map(num).join(" · ")}</span></div>}
          {r.indicators.map((i) => <div key={i.name}>{i.name}: {i.reading}</div>)}
          {r.missing.length > 0 && <div className="text-warn">Não visível: {r.missing.join(", ")}</div>}
        </div>
      </details>
    </div>
  );
}

function Cell({ k, v, hint, tone }: { k: string; v: string; hint: string; tone?: string }) {
  return (
    <div className="bg-panel px-2 py-3">
      <div className="text-[10.5px] font-medium uppercase tracking-wider text-faint">{k}</div>
      <div className={cx("num mt-1 text-[20px] font-bold", tone)}>{v}</div>
      <div className="text-[10.5px] text-faint">{hint}</div>
    </div>
  );
}

function List({ title, items, icon }: { title: string; items: string[]; icon: React.ReactNode }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-faint">{title}</div>
      <ul className="mt-1.5 space-y-1">{items.map((t) => <li key={t} className="flex gap-2 text-[13px] text-mute">{icon}{t}</li>)}</ul>
    </div>
  );
}

function Performance({ history, setHistory }: { history: Entry[]; setHistory: (f: (h: Entry[]) => Entry[]) => void }) {
  const stats = useMemo(() => {
    const done = history.filter((h) => h.result);
    const wins = done.filter((h) => h.result === "win").length;
    const n = done.length;
    const avgPayout = n ? done.reduce((s, h) => s + h.payout, 0) / n : 0.85;
    return { n, wins, losses: n - wins, rate: n ? wins / n : null, be: breakEven(avgPayout), ci: wilson(wins, n),
      units: done.reduce((s, h) => s + (h.result === "win" ? h.payout : -1), 0), pending: history.length - n, avgPayout };
  }, [history]);

  const [confirmClear, setConfirmClear] = useState(false);
  const mark = (id: string, result: Entry["result"]) => setHistory((h) => h.map((e) => (e.id === id ? { ...e, result } : e)));

  let verdict = "Marque o resultado de cada entrada. Só assim dá para saber se a leitura funciona para você.";
  if (stats.n > 0 && stats.ci) {
    if (stats.n < 30) verdict = `Com ${stats.n} ${stats.n === 1 ? "operação" : "operações"} a amostra ainda não diz nada. Continue registrando.`;
    else if (stats.ci[0] > stats.be) verdict = "Sua taxa está acima do ponto de equilíbrio com margem estatística. Continue medindo: isso pode mudar.";
    else if (stats.ci[1] < stats.be) verdict = "Sua taxa está abaixo do ponto de equilíbrio: do jeito que está, você perde dinheiro. Pare e revise.";
    else verdict = "Ainda não dá para distinguir sua taxa do ponto de equilíbrio. Sem vantagem comprovada.";
  }

  return (
    <section className="card3d animate-fade mt-5 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold">Seu desempenho real</h2>
        {history.length > 0 && (confirmClear ? (
          <div className="flex items-center gap-2 text-[12px]">
            <span className="text-mute">Apagar todo o histórico?</span>
            <button onClick={() => { setHistory(() => []); setConfirmClear(false); }} className="font-semibold text-sell">Apagar</button>
            <button onClick={() => setConfirmClear(false)} className="text-faint hover:text-mute">Cancelar</button>
          </div>
        ) : (
          <button onClick={() => setConfirmClear(true)}
            className="flex items-center gap-1.5 text-[12px] text-faint hover:text-sell"><Trash2 size={13} /> Limpar</button>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat k="Operações" v={String(stats.n)} hint={stats.pending ? `${stats.pending} sem resultado` : undefined} />
        <Stat k="Acertos" v={stats.n ? `${stats.wins}/${stats.n}` : "—"} />
        <Stat k="Taxa real" v={stats.rate === null ? "—" : pct(stats.rate)}
          hint={stats.ci ? `95%: ${pct(stats.ci[0])} a ${pct(stats.ci[1])}` : undefined}
          tone={stats.rate === null ? undefined : stats.rate >= stats.be ? "text-buy" : "text-sell"} />
        <Stat k="Ponto de equilíbrio" v={pct(stats.be)} hint={`payout médio ${Math.round(stats.avgPayout * 100)}%`} />
        <Stat k="Resultado" v={`${stats.units >= 0 ? "+" : ""}${stats.units.toFixed(2).replace(".", ",")}`} hint="em entradas (1 = valor apostado)"
          tone={stats.units >= 0 ? "text-buy" : "text-sell"} />
      </div>
      <p className="mt-3 text-[12.5px] text-mute">{verdict}</p>

      {history.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line">
          {history.slice(0, 20).map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
              <span className={cx("w-12 font-bold", h.decision === "CALL" ? "text-buy" : "text-sell")}>{h.decision}</span>
              <span className="min-w-0 flex-1 truncate text-mute">
                {[h.symbol, h.timeframe].filter(Boolean).join(" · ") || "ativo ?"}
                <span className="num ml-2 text-faint">{new Date(h.at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              </span>
              <div className="flex gap-1.5">
                <button onClick={() => mark(h.id, h.result === "win" ? null : "win")}
                  className={cx("rounded-lg border px-2.5 py-1 text-[12px] font-semibold", h.result === "win" ? "border-buy bg-buy text-[#04130a]" : "border-line-2 text-mute hover:text-buy")}>Ganhou</button>
                <button onClick={() => mark(h.id, h.result === "loss" ? null : "loss")}
                  className={cx("rounded-lg border px-2.5 py-1 text-[12px] font-semibold", h.result === "loss" ? "border-sell bg-sell text-white" : "border-line-2 text-mute hover:text-sell")}>Perdeu</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Stat({ k, v, hint, tone }: { k: string; v: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-3">
      <div className="text-[11px] text-faint">{k}</div>
      <div className={cx("num mt-1 text-[19px] font-semibold", tone)}>{v}</div>
      {hint && <div className="mt-0.5 text-[10.5px] text-faint">{hint}</div>}
    </div>
  );
}
