import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, CircleSlash, Download, FlaskConical, Loader2, MinusCircle, ShieldAlert } from "lucide-react";
import { api } from "../lib/api";
import { useExecute } from "../lib/hooks";
import { useLive, useNow } from "../lib/live";
import type { ChartPayload } from "../lib/types";
import { ago, countdown, pct, price, ratio, time } from "../lib/format";
import { CandleChart, annotatedPng, type CandleChartHandle } from "../components/CandleChart";
import { Badge, Button, Card, DecisionPill, Empty, ScoreRing, SourceBadge, TimeframeTag, cx } from "../components/ui";

export function Analysis() {
  const { key = "" } = useParams();
  const { version, toast } = useLive();
  const now = useNow();
  const execute = useExecute();
  const [data, setData] = useState<ChartPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bt, setBt] = useState<Awaited<ReturnType<typeof api.backtest>> | null>(null);
  const [btBusy, setBtBusy] = useState(false);
  const chart = useRef<CandleChartHandle>(null);
  const lastBar = useRef<number | null>(null);

  // Recarrega o gráfico quando fecha candle novo ou muda o sinal (não a cada tick).
  useEffect(() => {
    let alive = true;
    api.chart(key).then((d) => {
      if (!alive) return;
      const bar = d.candles.at(-1)?.time ?? null;
      setData((prev) => {
        if (prev && bar === lastBar.current && prev.signal?.status === d.signal?.status && prev.asset.stale === d.asset.stale) {
          return { ...prev, asset: d.asset };
        }
        lastBar.current = bar;
        return d;
      });
      setError(null);
    }).catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [key, version]);

  if (error) return <Card><Empty icon={<CircleSlash size={20} />} title="Ativo indisponível" text={error} /></Card>;
  if (!data) return <div className="grid h-80 place-items-center text-mute"><Loader2 className="animate-spin" /></div>;

  const { asset, analysis: a, signal } = data;
  const tone = a.decision === "COMPRA" ? "buy" : a.decision === "VENDA" ? "sell" : "mute";
  const plan = signal ?? null;

  const download = () => {
    const cv = chart.current?.screenshot();
    if (!cv) return;
    const link = document.createElement("a");
    link.href = annotatedPng(cv, data);
    link.download = `trade-ai_${asset.symbol.replace(/[^\w]/g, "")}_M5_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "")}.png`;
    link.click();
    toast("Captura anotada salva", "ok");
  };

  const runBacktest = async () => {
    setBtBusy(true);
    try {
      setBt(await api.backtest(asset.key));
    } catch (e) {
      toast((e as Error).message, "erro");
    } finally {
      setBtBusy(false);
    }
  };

  const ind = a.indicators;
  const num = (k: string, d = 2) => (typeof ind[k] === "number" ? (ind[k] as number).toFixed(d) : "—");

  return (
    <div className="space-y-5">
      <Link to="/scanner" className="inline-flex items-center gap-1.5 text-[12.5px] text-mute hover:text-ink"><ArrowLeft size={14} /> Scanner</Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <ScoreRing score={a.score} tone={tone} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[24px] font-bold">{asset.display}</h2>
              <TimeframeTag />
              <DecisionPill decision={a.decision} size="lg" />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-mute">
              <span>{asset.market_label}</span>
              <SourceBadge source={asset.source} isLive={asset.is_live} stale={asset.stale} />
              <span className="num text-ink">{price(asset.last_price)}</span>
              <span className={cx("num", (asset.change_pct ?? 0) >= 0 ? "text-buy" : "text-sell")}>{pct(asset.change_pct)}</span>
              <span className="text-faint">· atualizado {ago(asset.last_update, now)}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={download}><Download size={15} /> Captura anotada</Button>
          <Button onClick={runBacktest} disabled={btBusy}>{btBusy ? <Loader2 size={15} className="animate-spin" /> : <FlaskConical size={15} />} Backtest</Button>
          {plan?.status === "ativo" && (
            <Button variant={plan.direction === "long" ? "buy" : "sell"} onClick={() => execute(plan)}>Executar demo</Button>
          )}
        </div>
      </div>

      {asset.stale && (
        <div className="flex items-center gap-2 rounded-xl border border-warn/30 bg-warn-soft px-4 py-2.5 text-[13px] text-warn">
          <ShieldAlert size={16} /> Sem dados atualizados deste ativo. Nenhum sinal é liberado e entradas demo ficam bloqueadas.
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <Card pad={false} className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line px-4 py-2.5 text-[11.5px] text-mute">
            <Legend c="#60a5fa" t="EMA 50" /><Legend c="#c084fc" t="EMA 200" />{data.series.vwap.length > 0 && <Legend c="#f5a524" t="VWAP" />}
            <Legend c="#3b82f6" t="Entrada" /><Legend c="#f04444" t="Stop" dashed /><Legend c="#22c55e" t="Alvos" dashed />
            <Legend c="#22c55e88" t="Suporte" dashed /><Legend c="#f0444488" t="Resistência" dashed />
            <span className="ml-auto">Painéis: RSI 14 · MACD</span>
          </div>
          <div className="p-2">
            {data.candles.length ? <CandleChart ref={chart} data={data} height={520} />
              : <Empty icon={<MinusCircle size={20} />} title="Sem candles" text="Este ativo ainda não recebeu dados." />}
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Plano do sinal" action={plan && <Badge tone={plan.status === "ativo" ? "info" : "mute"}>{plan.status}</Badge>}>
            {plan ? (
              <div className="space-y-3">
                <Row k="Direção" v={<span className={plan.direction === "long" ? "text-buy" : "text-sell"}>{plan.decision}</span>} />
                <Row k="Entrada" v={price(plan.entry)} />
                <Row k="Região de entrada" v={`${price(plan.zone_low)} – ${price(plan.zone_high)}`} />
                <Row k="Stop-loss" v={<span className="text-sell">{price(plan.stop)}</span>} />
                <Row k="Alvo 1" v={<span className="text-buy">{price(plan.tp1)} <span className="text-faint">1:{plan.rr1}</span></span>} />
                <Row k="Alvo 2" v={<span className="text-buy">{price(plan.tp2)} <span className="text-faint">1:{plan.rr2}</span></span>} />
                <Row k="Identificado" v={time(plan.created_at, true)} />
                <Row k="Validade" v={plan.status === "ativo" ? countdown(plan.valid_until, now) : time(plan.valid_until)} />
                <p className="rounded-lg bg-panel px-3 py-2 text-[12px] text-mute">{plan.status === "ativo" ? plan.confirmation : plan.status_reason}</p>
              </div>
            ) : (
              <p className="text-[13px] text-mute">Mercado sem confirmação. Aguardando uma oportunidade.</p>
            )}
          </Card>

          <Card title={`Confluência ${a.direction === "short" ? "de venda" : "de compra"} · ${a.score}/100`}>
            <ul className="space-y-2">
              {a.factors.map((f) => (
                <li key={f.key} className="flex items-start gap-2 text-[12.5px]">
                  {!f.available ? <MinusCircle size={15} className="mt-px shrink-0 text-faint" />
                    : f.ok ? <CheckCircle2 size={15} className={cx("mt-px shrink-0", a.direction === "short" ? "text-sell" : "text-buy")} />
                      : <CircleSlash size={15} className="mt-px shrink-0 text-faint" />}
                  <div className="min-w-0 flex-1">
                    <div className={f.ok && f.available ? "text-ink" : "text-mute"}>{f.label}</div>
                    {f.detail && <div className="num text-[11px] text-faint">{f.detail}</div>}
                  </div>
                  <span className="num text-[11px] text-faint">{f.weight}</span>
                </li>
              ))}
            </ul>
            {a.blockers.length > 0 && (
              <div className="mt-4 space-y-1.5 border-t border-line pt-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-warn">Por que aguardar</div>
                {a.blockers.map((b) => <div key={b} className="text-[12px] text-mute">• {b}</div>)}
              </div>
            )}
            <p className="mt-4 text-[11px] text-faint">A pontuação mede concordância entre critérios técnicos. Não é probabilidade de lucro.</p>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Tendência">
          <div className={cx("text-[18px] font-bold capitalize", a.trend === "alta" ? "text-buy" : a.trend === "baixa" ? "text-sell" : "text-mute")}>{a.trend}</div>
          <div className="num mt-2 text-[12px] text-mute">EMA 50 {num("ema50", 5)} · EMA 200 {num("ema200", 5)}</div>
        </Card>
        <Card title="Momentum">
          <div className="num text-[13px] text-mute">RSI <b className="text-ink">{num("rsi", 1)}</b> · MACD hist <b className="text-ink">{num("macd_hist", 5)}</b></div>
          <div className="num mt-2 text-[12px] text-mute">ADX {num("adx", 1)} (+DI {num("plus_di", 1)} / −DI {num("minus_di", 1)})</div>
        </Card>
        <Card title="Volatilidade e volume">
          <div className="num text-[13px] text-mute">ATR <b className="text-ink">{num("atr", 5)}</b> ({num("atr_pct", 3)}%)</div>
          <div className="num mt-2 text-[12px] text-mute">{ind.has_volume ? `Volume ${num("vol_ratio")}x a média` : "Provedor sem volume: VWAP e volume desconsiderados"}</div>
        </Card>
        <Card title="Suportes e resistências">
          <div className="num space-y-1 text-[12px]">
            {a.levels.resistances.slice().reverse().map((l) => <div key={`r${l.price}`} className="text-sell">R {price(l.price)} <span className="text-faint">×{l.touches}</span></div>)}
            <div className="text-ink">— {price(asset.last_price)}</div>
            {a.levels.supports.map((l) => <div key={`s${l.price}`} className="text-buy">S {price(l.price)} <span className="text-faint">×{l.touches}</span></div>)}
          </div>
        </Card>
      </div>

      {bt && (
        <Card title="Backtest deste ativo" action={<Badge tone="warn">BACKTEST · não é resultado ao vivo</Badge>}>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
            <Mini k="Operações" v={bt.trades} /><Mini k="Taxa de acerto" v={ratio(bt.hit_rate)} />
            <Mini k="Resultado (R)" v={bt.total_r.toFixed(2)} /><Mini k="Média por operação" v={bt.avg_r?.toFixed(2) ?? "—"} />
            <Mini k="Fator de lucro" v={bt.profit_factor?.toFixed(2) ?? "—"} /><Mini k="Drawdown máx. (R)" v={bt.max_drawdown_r.toFixed(2)} />
          </div>
          <p className="mt-3 text-[11.5px] text-faint">
            {bt.bars} candles M5 · entrada na abertura do candle seguinte · sem custos, spread ou slippage (o real tende a ser pior)
            {bt.data_is_live ? "" : " · DADOS SIMULADOS"}. Amostra pequena não prova vantagem estatística.
          </p>
        </Card>
      )}
    </div>
  );
}

function Legend({ c, t, dashed }: { c: string; t: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-0 w-4 border-t-2" style={{ borderColor: c, borderStyle: dashed ? "dashed" : "solid" }} />{t}
    </span>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <span className="text-mute">{k}</span><span className="num font-semibold">{v}</span>
    </div>
  );
}

function Mini({ k, v }: { k: string; v: ReactNode }) {
  return <div><div className="text-[11px] text-faint">{k}</div><div className="num mt-1 text-[17px] font-semibold">{v}</div></div>;
}
