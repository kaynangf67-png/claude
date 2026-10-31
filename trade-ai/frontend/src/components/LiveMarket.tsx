import { useState } from "react";
import { ASSETS, GROUPS, marketState, type Asset, type MarketState } from "../lib/markets";
import { LiveChart } from "./LiveChart";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/** Mercado ao vivo: abas por tipo de ativo, ativos da aba, gráfico M5 limpo. */
export function LiveMarket({ asset, state, clock, onPick }: {
  asset: Asset; state: MarketState; clock: Date; onPick: (id: string) => void;
}) {
  const [group, setGroup] = useState<Asset["group"]>(asset.group);

  return (
    <section className="card3d animate-fade mt-5 overflow-hidden">
      {/* Cabeçalho: ativo + estado */}
      <div className="flex items-center gap-3 px-5 pt-4">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-faint">Mercado ao vivo</div>
          <div className="mt-0.5 flex items-center gap-2">
            <h2 className="truncate text-[22px] font-extrabold leading-tight">{asset.label}</h2>
            <span className="num rounded-md border border-line-2 px-1.5 py-0.5 text-[11px] font-bold text-mute">M5</span>
          </div>
        </div>
        <span className={cx("ml-auto flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold",
          state.open ? "bg-buy/15 text-buy" : "bg-sell/15 text-warn")}>
          <span className={cx("size-2 rounded-full", state.open ? "animate-pulse bg-buy" : "bg-sell")} />
          {state.open ? "Ao vivo" : "Fechado"}
        </span>
      </div>

      {/* Abas */}
      <div className="mt-4 flex gap-1 px-5">
        {GROUPS.map((g) => (
          <button key={g} onClick={() => setGroup(g)}
            className={cx("rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors",
              group === g ? "bg-ink text-bg" : "text-mute hover:text-ink")}>
            {g}
          </button>
        ))}
      </div>

      {/* Ativos da aba */}
      <div className="no-scrollbar fade-x mt-3 flex gap-2 overflow-x-auto px-5 pb-4 md:flex-wrap md:overflow-visible md:[mask-image:none]">
        {ASSETS.filter((a) => a.group === group).map((a) => {
          const open = marketState(a, clock).open;
          const active = a.id === asset.id;
          return (
            <button key={a.id} onClick={() => onPick(a.id)}
              className={cx("flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-[13px] font-semibold transition-all",
                active ? "border-buy bg-buy/15 text-ink shadow-[0_0_24px_-10px_#22c55e]" : "border-line bg-panel text-mute hover:border-line-2 hover:text-ink")}>
              <span className={cx("size-1.5 rounded-full", open ? "bg-buy" : "bg-faint")} />
              {a.label}
            </button>
          );
        })}
      </div>

      {/* Fechado */}
      {!state.open && (
        <div className="mx-5 mb-4 flex flex-col gap-3 rounded-2xl border border-sell/25 bg-sell/10 px-4 py-3 text-[12.5px] sm:flex-row sm:items-center">
          <span className="min-w-0 flex-1 text-warn">{state.note}. O gráfico fica parado até reabrir.</span>
          <button onClick={() => { setGroup("Cripto"); onPick("BTCUSD"); }}
            className="shrink-0 rounded-lg bg-buy px-3 py-2 text-[12.5px] font-bold text-[#03130a]">Ver BTC/USD ao vivo</button>
        </div>
      )}

      {/* Gráfico */}
      <div className="h-[340px] border-t border-line bg-panel md:h-[440px]">
        <LiveChart symbol={asset.tv} />
      </div>

      <p className="flex flex-wrap gap-x-3 gap-y-1 px-5 py-3 text-[11.5px] text-faint">
        <span>Cotação do TradingView; pode diferir um pouco da corretora.</span>
        <span>OTC: use o print da sua corretora.</span>
      </p>
    </section>
  );
}
