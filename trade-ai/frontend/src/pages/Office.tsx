import { useEffect, useState } from "react";
import { AlertTriangle, Lock, Power, RotateCcw } from "lucide-react";
import { Office3D } from "../components/Office3D";
import { LOSS_LIMIT, WIN_GOAL, stats, type DeskState } from "../lib/desk";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
const CRYPTO = [
  ["BTCUSD", "BTC/USD"], ["ETHUSD", "ETH/USD"], ["LTCUSD", "LTC/USD"],
  ["XRPUSD", "XRP/USD"], ["SOLUSD", "SOL/USD"], ["BNBUSD", "BNB/USD"],
] as const;
const label = (a: string) => CRYPTO.find(([id]) => id === a)?.[1] ?? a;
const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hhmm = (t: number) => new Date(t * 1000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const price = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: v >= 100 ? 2 : 5 });

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
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mt-5 space-y-5">
      <section className="card3d animate-fade overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 px-5 pt-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Escritório</div>
            <h2 className="text-[22px] font-extrabold leading-tight">Mesa de operações com IA</h2>
          </div>
          <span className="ml-auto rounded-full bg-sell/15 px-3 py-1 text-[12px] font-bold text-warn">SIMULADO · preços reais</span>
        </div>
        <div className="-mx-3 pb-2 sm:mx-0 sm:px-6">
          <Office3D desks={desks} now={now} />
        </div>
      </section>

      {otherTab && (
        <div className="flex items-center gap-2 rounded-2xl border border-sell/30 bg-sell/10 px-4 py-3 text-[13px] text-warn">
          <AlertTriangle size={16} /> As mesas estão operando em outra aba deste navegador. Esta aba só mostra.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {desks.map((d, i) => <DeskPanel key={d.id} d={d} n={i + 1} now={now} update={update} />)}
      </div>

      <div className="card3d p-5 text-[12.5px] leading-relaxed text-mute">
        <b className="text-ink">Como as mesas funcionam.</b> Ligada, cada assistente analisa as velas M5 reais do ativo logo após o
        fechamento de cada vela. Se vir um setup claro, entra em CALL ou PUT ao preço do momento, com expiração no fechamento de uma
        vela M5 (1 a 3 velas), e confere o resultado pela vela real. Empate devolve a entrada.{" "}
        <b className="text-ink">Regras:</b> {WIN_GOAL} wins no dia, ou {LOSS_LIMIT} losses no dia, travam a mesa por 24 horas.
        As mesas só operam com o site aberto. Nenhuma ordem vai para corretora: o saldo é simulado. Cada análise usa a IA e gera
        custo na sua conta Anthropic.
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
  const accent = n === 1 ? "bg-buy" : "bg-sell";
  const set = (f: (x: DeskState) => DeskState) => update(d.id, f);
  const nextCandle = Math.ceil((now + 1) / 300) * 300;

  let status: { text: string; tone: string };
  if (locked) status = { text: "Travada", tone: "bg-sell/15 text-warn" };
  else if (d.open) status = { text: "Em operação", tone: "bg-buy/15 text-buy" };
  else if (d.on) status = { text: "Ligada", tone: "bg-buy/15 text-buy" };
  else status = { text: "Desligada", tone: "bg-card-2 text-mute" };

  return (
    <section className="card3d animate-fade min-w-0 p-5">
      <header className="flex items-center gap-3">
        <div className={cx("grid size-11 shrink-0 place-items-center rounded-2xl text-[17px] font-extrabold text-[#03130a]", accent)}>
          {d.name[0]}
        </div>
        <div className="min-w-0">
          <div className="text-[16px] font-extrabold">{d.name}</div>
          <div className="text-[12px] text-faint">Mesa {n} · assistente de IA</div>
        </div>
        <span className={cx("ml-auto shrink-0 rounded-full px-3 py-1 text-[12px] font-bold", status.tone)}>{status.text}</span>
      </header>

      <button onClick={() => set((x) => ({ ...x, on: !x.on }))}
        className={cx("mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[14px] font-extrabold tracking-wide transition-colors",
          d.on ? "border border-line-2 bg-card-2 text-ink hover:border-sell/50" : "btn3d text-[#03130a]")}>
        <Power size={16} /> {d.on ? "DESLIGAR MESA" : "LIGAR MESA"}
      </button>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <label className="col-span-3 sm:col-span-1">
          <span className="text-[11px] font-medium text-faint">Ativo</span>
          <select value={d.asset} disabled={!!d.open} onChange={(e) => set((x) => ({ ...x, asset: e.target.value, lastAnalyzed: null }))}
            className="mt-1 w-full rounded-xl border border-line-2 bg-panel px-2.5 py-2 text-[13px] font-semibold disabled:opacity-50">
            {CRYPTO.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
          </select>
        </label>
        <label>
          <span className="text-[11px] font-medium text-faint">Entrada (R$)</span>
          <input type="number" min={1} value={d.stake} onChange={(e) => set((x) => ({ ...x, stake: Math.max(1, Number(e.target.value) || 1) }))}
            className="num mt-1 w-full rounded-xl border border-line-2 bg-panel px-2.5 py-2 text-[13px]" />
        </label>
        <label>
          <span className="text-[11px] font-medium text-faint">Payout (%)</span>
          <input type="number" min={10} max={100} value={Math.round(d.payout * 100)}
            onChange={(e) => set((x) => ({ ...x, payout: Math.min(100, Math.max(10, Number(e.target.value) || 85)) / 100 }))}
            className="num mt-1 w-full rounded-xl border border-line-2 bg-panel px-2.5 py-2 text-[13px]" />
        </label>
      </div>

      {/* regras do dia */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Meter label="Meta do dia" value={d.wins} max={WIN_GOAL} unit="wins" color="bg-buy" />
        <Meter label="Limite do dia" value={d.losses} max={LOSS_LIMIT} unit="losses" color="bg-sell" />
      </div>

      {locked && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-sell/30 bg-sell/10 px-4 py-3">
          <Lock size={18} className="shrink-0 text-warn" />
          <div className="text-[13px]">
            <div className="font-bold text-warn">{d.lockReason}</div>
            <div className="text-mute">Volta a operar às {hhmm(d.lockUntil!)} · faltam <span className="num">{left(d.lockUntil! - now)}</span></div>
          </div>
        </div>
      )}

      {d.open && (
        <div className={cx("mt-4 rounded-2xl border p-4", d.open.direction === "CALL" ? "border-buy/40 bg-buy/10" : "border-sell/40 bg-sell/10")}>
          <div className="flex items-center justify-between">
            <span className={cx("text-[20px] font-extrabold", d.open.direction === "CALL" ? "text-buy" : "text-sell")}>
              {d.open.direction === "CALL" ? "▲ CALL" : "▼ PUT"} <span className="text-[13px] text-mute">{label(d.open.asset)}</span>
            </span>
            <span className="num text-[13px] font-bold text-ink">
              {now < d.open.expiry ? `expira em ${left(d.open.expiry - now)}` : "conferindo resultado…"}
            </span>
          </div>
          <div className="num mt-1.5 text-[12px] text-mute">
            Entrada {price(d.open.entryPrice)} às {hhmm(d.open.entryAt)} · expiração {hhmm(d.open.expiry)} · {money(d.open.stake)}
          </div>
          {d.open.reasons.length > 0 && <div className="mt-2 text-[12px] text-mute">{d.open.reasons.slice(0, 2).join(" · ")}</div>}
        </div>
      )}

      {!d.open && !locked && d.on && (
        <div className="mt-4 rounded-2xl border border-line bg-panel px-4 py-3 text-[12.5px] text-mute">
          Próxima análise após o fechamento da vela das <b className="num text-ink">{hhmm(nextCandle)}</b>.
          {d.last && (
            <div className="mt-1.5">
              Última ({hhmm(d.last.at)}):{" "}
              {d.last.decision === "ERRO" ? <span className="text-warn">{d.last.error}</span> : (
                <>
                  <b className="text-ink">{d.last.decision}</b>
                  {d.last.blocks.length > 0 && <> · {d.last.blocks[0]}</>}
                  {d.last.decision === "AGUARDAR" && d.last.blocks.length === 0 && d.last.against[0] && <> · {d.last.against[0]}</>}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* desempenho */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Mini k="Saldo simulado" v={money(d.balance)} tone={d.balance >= 1000 ? "text-buy" : "text-sell"} />
        <Mini k="Taxa de acerto" v={st.rate === null ? "—" : `${(st.rate * 100).toFixed(0)}%`} hint={`${st.wins}/${st.n}`} />
        <Mini k="Operações" v={String(d.history.length)} />
      </div>

      {d.history.length > 0 && (
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
          {d.history.slice(0, 6).map((t) => (
            <li key={t.id} className="flex items-center gap-2 px-3 py-2 text-[12.5px]">
              <span className={cx("w-11 font-bold", t.direction === "CALL" ? "text-buy" : "text-sell")}>{t.direction}</span>
              <span className="min-w-0 flex-1 truncate text-mute">
                {label(t.asset)} <span className="num text-faint">{hhmm(t.entryAt)}</span>
              </span>
              <span className={cx("num font-bold",
                t.result === "win" ? "text-buy" : t.result === "loss" ? "text-sell" : "text-mute")}>
                {t.result === "win" ? `+${money(t.profit ?? 0)}` : t.result === "loss" ? money(t.profit ?? 0) : t.result}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex justify-end">
        {confirmReset ? (
          <div className="flex items-center gap-3 text-[12px]">
            <span className="text-mute">Zerar saldo e histórico? (a trava continua)</span>
            <button className="font-bold text-sell" onClick={() => { set((x) => ({ ...x, balance: 1000, history: [] })); setConfirmReset(false); }}>Zerar</button>
            <button className="text-faint" onClick={() => setConfirmReset(false)}>Cancelar</button>
          </div>
        ) : (
          <button onClick={() => setConfirmReset(true)} disabled={!!d.open}
            className="flex items-center gap-1.5 text-[12px] text-faint hover:text-mute disabled:opacity-40"><RotateCcw size={12} /> Zerar mesa</button>
        )}
      </div>
    </section>
  );
}

function Meter({ label: l, value, max, unit, color }: { label: string; value: number; max: number; unit: string; color: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] text-faint">{l}</span>
        <span className="num text-[14px] font-extrabold">{value}<span className="text-faint">/{max}</span> <span className="text-[11px] font-medium text-mute">{unit}</span></span>
      </div>
      <div className="mt-2 flex gap-1">
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={cx("h-2 flex-1 rounded-full", i < value ? color : "bg-line")} />
        ))}
      </div>
    </div>
  );
}

function Mini({ k, v, hint, tone }: { k: string; v: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-2.5">
      <div className="text-[10.5px] text-faint">{k}</div>
      <div className={cx("num mt-0.5 text-[14px] font-bold", tone)}>{v}</div>
      {hint && <div className="num text-[10px] text-faint">{hint}</div>}
    </div>
  );
}
