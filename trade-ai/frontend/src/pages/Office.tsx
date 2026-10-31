import { useEffect, useState } from "react";
import { AlertTriangle, Bell, BellOff, Check, Lock, Power, RotateCcw, X } from "lucide-react";
import { Office3D } from "../components/Office3D";
import { LOSS_LIMIT, WIN_GOAL, stats, type DeskState } from "../lib/desk";
import { alertsOn, disableAlerts, enableAlerts } from "../lib/alerts";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const CRYPTO = [
  ["BTCUSD", "BTC/USD"], ["ETHUSD", "ETH/USD"], ["LTCUSD", "LTC/USD"],
  ["XRPUSD", "XRP/USD"], ["SOLUSD", "SOL/USD"], ["BNBUSD", "BNB/USD"],
] as const;
const label = (a: string) => CRYPTO.find(([id]) => id === a)?.[1] ?? a;
const hhmm = (t: number) => new Date(t * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const price = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: v >= 100 ? 2 : 5 });
/** Quanto tempo depois do sinal ainda dá para entrar sem estar atrasado. */
const ENTRY_WINDOW_S = 90;

function left(sec: number): string {
  if (sec <= 0) return "0s";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}min` : m ? `${m}min ${String(s).padStart(2, "0")}s` : `${s}s`;
}

export function Office({ desks, update, otherTab }: {
  desks: DeskState[]; update: (id: string, f: (d: DeskState) => DeskState) => void; otherTab: boolean;
}) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [alerts, setAlerts] = useState(alertsOn);
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  const toggleAlerts = async () => {
    if (alerts) {
      disableAlerts();
      setAlerts(false);
    } else {
      setAlerts(await enableAlerts());
    }
  };

  return (
    <div className="mt-5 space-y-5">
      <section className="card3d animate-fade overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-5 pt-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Escritório</div>
            <h2 className="text-[22px] font-extrabold leading-tight">Mesas de sinais com IA</h2>
          </div>
          <button onClick={toggleAlerts}
            className={cx("ml-auto flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors",
              alerts ? "bg-buy/15 text-buy" : "border border-line-2 text-mute hover:text-ink")}>
            {alerts ? <Bell size={14} /> : <BellOff size={14} />} {alerts ? "Alertas ligados" : "Ligar alertas"}
          </button>
        </div>
        <div className="-mx-3 pb-2 sm:mx-0 sm:px-6">
          <Office3D desks={desks} now={now} />
        </div>
      </section>

      {otherTab && (
        <div className="flex items-center gap-2 rounded-2xl border border-sell/30 bg-sell/10 px-4 py-3 text-[13px] text-warn">
          <AlertTriangle size={16} /> As mesas estão analisando em outra aba deste navegador. Esta aba só mostra.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {desks.map((d, i) => <DeskPanel key={d.id} d={d} n={i + 1} now={now} update={update} />)}
      </div>

      <div className="card3d p-5 text-[12.5px] leading-relaxed text-mute">
        <b className="text-ink">Como funciona.</b> Com a análise ligada, cada assistente lê as velas reais de 5 minutos logo depois
        que cada vela fecha. Se houver um setup claro, ela indica <b className="text-buy">COMPRA</b> ou{" "}
        <b className="text-sell">VENDA</b>, com expiração no fechamento de 1 a 3 velas. Você decide se entra, na sua corretora, em
        até {ENTRY_WINDOW_S} segundos. Depois, a mesa confere o sinal na vela real e conta acerto ou erro.{" "}
        <b className="text-ink">Regras:</b> {WIN_GOAL} acertos ou {LOSS_LIMIT} erros no dia pausam a mesa por 24 horas.
        A análise só roda com o site aberto. Cada análise usa a IA e gera custo na sua conta Anthropic.
        Nenhum sinal garante resultado.
      </div>
    </div>
  );
}

function DeskPanel({ d, n, now, update }: {
  d: DeskState; n: number; now: number; update: (id: string, f: (d: DeskState) => DeskState) => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const locked = d.lockUntil !== null && now < d.lockUntil;
  const st = stats(d.history);
  const breakEven = 1 / (1 + d.payout);
  const set = (f: (x: DeskState) => DeskState) => update(d.id, f);
  const nextCandle = Math.ceil((now + 1) / 300) * 300;
  const sig = d.open;
  const windowLeft = sig ? sig.entryAt + ENTRY_WINDOW_S - now : 0;
  const buy = sig?.direction === "CALL";

  let status: { text: string; tone: string };
  if (locked) status = { text: "Pausada", tone: "bg-sell/15 text-warn" };
  else if (sig) status = { text: "Sinal ativo", tone: "bg-buy/15 text-buy" };
  else if (d.on) status = { text: "Analisando", tone: "bg-buy/15 text-buy" };
  else status = { text: "Desligada", tone: "bg-card-2 text-mute" };

  return (
    <section className="card3d animate-fade min-w-0 p-5">
      <header className="flex items-center gap-3">
        <div className={cx("grid size-11 shrink-0 place-items-center rounded-2xl text-[17px] font-extrabold",
          n === 1 ? "bg-buy text-[#03130a]" : "bg-sell text-white")}>
          {d.name[0]}
        </div>
        <div className="min-w-0">
          <div className="text-[16px] font-extrabold">{d.name}</div>
          <div className="text-[12px] text-faint">Mesa {n} · sinais de {label(d.asset)}</div>
        </div>
        <span className={cx("ml-auto shrink-0 rounded-full px-3 py-1 text-[12px] font-bold", status.tone)}>{status.text}</span>
      </header>

      {/* Sinal */}
      {sig ? (
        <div className={cx("mt-4 overflow-hidden rounded-3xl border text-center",
          buy ? "border-buy/50 bg-buy/10 shadow-[0_0_50px_-20px_#22c55e]" : "border-sell/50 bg-sell/10 shadow-[0_0_50px_-20px_#ef4444]")}>
          <div className="px-5 pt-5">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-mute">{label(sig.asset)} · M5</div>
            <div className={cx("mt-1 text-[38px] font-black leading-none tracking-wide", buy ? "text-buy" : "text-sell")}>
              {buy ? "▲ COMPRA" : "▼ VENDA"}
            </div>
            <div className="mt-1 text-[12px] text-mute">{buy ? "CALL · acima de" : "PUT · abaixo de"} <b className="num text-ink">{price(sig.entryPrice)}</b></div>
          </div>
          <div className="mt-4 grid grid-cols-2 border-t border-line">
            <div className="border-r border-line px-3 py-3">
              <div className="text-[10.5px] uppercase tracking-wider text-faint">Entrar</div>
              {windowLeft > 0 ? (
                <div className="num text-[18px] font-extrabold text-ink">agora <span className="text-[13px] text-warn">· {left(windowLeft)}</span></div>
              ) : (
                <div className="text-[13px] font-bold text-warn">Passou · não entre atrasado</div>
              )}
            </div>
            <div className="px-3 py-3">
              <div className="text-[10.5px] uppercase tracking-wider text-faint">Expiração</div>
              <div className="num text-[18px] font-extrabold text-ink">{hhmm(sig.expiry)}</div>
              <div className="num text-[11px] text-mute">{now < sig.expiry ? `faltam ${left(sig.expiry - now)}` : "conferindo…"}</div>
            </div>
          </div>
          {sig.reasons.length > 0 && (
            <div className="border-t border-line px-4 py-3 text-left text-[12px] text-mute">
              {sig.reasons.slice(0, 3).map((r) => <div key={r} className="flex gap-1.5"><Check size={13} className={cx("mt-0.5 shrink-0", buy ? "text-buy" : "text-sell")} />{r}</div>)}
            </div>
          )}
        </div>
      ) : locked ? (
        <div className="mt-4 flex flex-col items-center gap-2 rounded-3xl border border-sell/30 bg-sell/10 px-5 py-6 text-center">
          <Lock size={22} className="text-warn" />
          <div className="text-[15px] font-extrabold text-warn">{d.lockReason}</div>
          <div className="text-[12.5px] text-mute">Volta a sinalizar às <b className="text-ink">{hhmm(d.lockUntil!)}</b> · faltam <span className="num">{left(d.lockUntil! - now)}</span></div>
        </div>
      ) : (
        <div className="mt-4 rounded-3xl border border-line bg-panel px-5 py-5 text-center">
          <div className="text-[15px] font-extrabold">{d.on ? "Sem sinal agora" : "Análise desligada"}</div>
          <div className="mt-1 text-[12.5px] text-mute">
            {d.on ? <>Próxima análise após a vela das <b className="num text-ink">{hhmm(nextCandle)}</b></> : "Ligue para receber sinais de compra e venda"}
          </div>
          {d.on && d.last && (
            <div className="mt-2 text-[12px] text-faint">
              Última, às {hhmm(d.last.at)}:{" "}
              {d.last.decision === "ERRO" ? <span className="text-warn">{d.last.error}</span> : (
                <>{d.last.decision === "AGUARDAR" ? "aguardar" : d.last.decision}{(d.last.blocks[0] ?? d.last.against[0]) && <> · {d.last.blocks[0] ?? d.last.against[0]}</>}</>
              )}
            </div>
          )}
        </div>
      )}

      <button onClick={() => set((x) => ({ ...x, on: !x.on }))}
        className={cx("mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[14px] font-extrabold tracking-wide transition-colors",
          d.on ? "border border-line-2 bg-card-2 text-ink hover:border-sell/50" : "btn3d text-[#03130a]")}>
        <Power size={16} /> {d.on ? "PAUSAR ANÁLISE" : "LIGAR ANÁLISE"}
      </button>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <label>
          <span className="text-[11px] font-medium text-faint">Ativo</span>
          <select value={d.asset} disabled={!!sig} onChange={(e) => set((x) => ({ ...x, asset: e.target.value, lastAnalyzed: null }))}
            className="mt-1 w-full rounded-xl border border-line-2 bg-panel px-2.5 py-2 text-[13px] font-semibold disabled:opacity-50">
            {CRYPTO.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
          </select>
        </label>
        <label>
          <span className="text-[11px] font-medium text-faint">Payout da corretora (%)</span>
          <input type="number" min={10} max={100} value={Math.round(d.payout * 100)}
            onChange={(e) => set((x) => ({ ...x, payout: Math.min(100, Math.max(10, Number(e.target.value) || 85)) / 100 }))}
            className="num mt-1 w-full rounded-xl border border-line-2 bg-panel px-2.5 py-2 text-[13px]" />
        </label>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Meter label="Acertos do dia" value={d.wins} max={WIN_GOAL} color="bg-buy" />
        <Meter label="Erros do dia" value={d.losses} max={LOSS_LIMIT} color="bg-sell" />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Mini k="Taxa de acerto" v={st.rate === null ? "—" : `${(st.rate * 100).toFixed(0)}%`}
          tone={st.rate === null ? undefined : st.rate >= breakEven ? "text-buy" : "text-sell"} />
        <Mini k="Precisa para empatar" v={`${(breakEven * 100).toFixed(1)}%`} />
        <Mini k="Sinais conferidos" v={`${st.wins}/${st.n}`} />
      </div>

      {d.history.length > 0 && (
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
          {d.history.slice(0, 6).map((t) => (
            <li key={t.id} className="flex items-center gap-2 px-3 py-2 text-[12.5px]">
              <span className={cx("w-16 font-bold", t.direction === "CALL" ? "text-buy" : "text-sell")}>{t.direction === "CALL" ? "COMPRA" : "VENDA"}</span>
              <span className="min-w-0 flex-1 truncate text-mute">{label(t.asset)} <span className="num text-faint">{hhmm(t.entryAt)} → {hhmm(t.expiry)}</span></span>
              {t.result === "win" ? <span className="flex items-center gap-1 font-bold text-buy"><Check size={14} />acerto</span>
                : t.result === "loss" ? <span className="flex items-center gap-1 font-bold text-sell"><X size={14} />erro</span>
                  : <span className="text-mute">{t.result}</span>}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex justify-end">
        {confirmReset ? (
          <div className="flex items-center gap-3 text-[12px]">
            <span className="text-mute">Apagar o histórico? (a pausa continua)</span>
            <button className="font-bold text-sell" onClick={() => { set((x) => ({ ...x, history: [] })); setConfirmReset(false); }}>Apagar</button>
            <button className="text-faint" onClick={() => setConfirmReset(false)}>Cancelar</button>
          </div>
        ) : (
          <button onClick={() => setConfirmReset(true)} disabled={!!sig}
            className="flex items-center gap-1.5 text-[12px] text-faint hover:text-mute disabled:opacity-40"><RotateCcw size={12} /> Apagar histórico</button>
        )}
      </div>
    </section>
  );
}

function Meter({ label: l, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-faint">{l}</span>
        <span className="num text-[14px] font-extrabold">{value}<span className="text-faint">/{max}</span></span>
      </div>
      <div className="mt-2 flex gap-1">
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={cx("h-2 flex-1 rounded-full", i < value ? color : "bg-line")} />
        ))}
      </div>
    </div>
  );
}

function Mini({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-2.5">
      <div className="text-[10.5px] leading-tight text-faint">{k}</div>
      <div className={cx("num mt-1 text-[15px] font-bold", tone)}>{v}</div>
    </div>
  );
}
