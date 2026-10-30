import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, Minus, Radar, Search } from "lucide-react";
import { api } from "../lib/api";
import { useData } from "../lib/hooks";
import { useLive, useNow } from "../lib/live";
import { ago, pct, price } from "../lib/format";
import type { MarketId } from "../lib/types";
import { Card, DecisionPill, Empty, ScoreBar, SourceBadge, cx, inputCls } from "../components/ui";

const MARKETS: { id: "" | MarketId; label: string }[] = [
  { id: "", label: "Todos" }, { id: "forex", label: "Forex" }, { id: "crypto", label: "Cripto" },
  { id: "b3", label: "B3" }, { id: "us_stocks", label: "Ações EUA" }, { id: "indices", label: "Índices" },
  { id: "futures", label: "Futuros" }, { id: "commodities", label: "Commodities" },
];

export function Scanner() {
  const [market, setMarket] = useState<"" | MarketId>("");
  const [q, setQ] = useState("");
  const [trend, setTrend] = useState("");
  const [minScore, setMinScore] = useState(0);
  const [sort, setSort] = useState("score");
  const [fresh, setFresh] = useState(false);
  const { status } = useLive();
  const now = useNow();
  const nav = useNavigate();
  const { data, error } = useData(
    () => api.assets({ market, q, trend, min_score: minScore, sort, only_fresh: fresh }),
    [market, q, trend, minScore, sort, fresh],
  );
  const rows = data?.assets ?? [];

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {MARKETS.map((m) => (
          <button key={m.id} onClick={() => setMarket(m.id)}
            className={cx("whitespace-nowrap rounded-xl border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
              market === m.id ? "border-info/50 bg-info-soft text-info" : "border-line bg-card text-mute hover:text-ink")}>
            {m.label}
          </button>
        ))}
      </div>

      <Card pad={false}>
        <div className="grid gap-3 border-b border-line p-4 md:grid-cols-[1.6fr_1fr_1fr_1fr_auto]">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input className={cx(inputCls, "pl-9")} placeholder="Buscar ativo (BTC, EUR/USD, PETR4…)" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className={inputCls} value={trend} onChange={(e) => setTrend(e.target.value)} aria-label="Tendência">
            <option value="">Qualquer tendência</option>
            <option value="alta">Alta</option>
            <option value="baixa">Baixa</option>
            <option value="lateral">Lateral</option>
          </select>
          <select className={inputCls} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} aria-label="Força do sinal">
            <option value={0}>Qualquer confluência</option>
            <option value={50}>Confluência ≥ 50</option>
            <option value={70}>Confluência ≥ 70</option>
            <option value={85}>Confluência ≥ 85</option>
          </select>
          <select className={inputCls} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Ordenação">
            <option value="score">Ordenar por oportunidade</option>
            <option value="change">Maior variação 24h</option>
            <option value="symbol">Nome</option>
          </select>
          <label className="flex items-center gap-2 text-[12.5px] text-mute">
            <input type="checkbox" checked={fresh} onChange={(e) => setFresh(e.target.checked)} className="accent-[#3b82f6]" />
            Só dados atualizados
          </label>
        </div>

        {error && <div className="p-4 text-[13px] text-sell">{error}</div>}
        {!rows.length ? (
          <Empty icon={<Radar size={20} />}
            title={status?.running ? "Nenhum ativo com esses filtros" : "Scanner parado"}
            text={status?.running ? "Ajuste os filtros ou verifique as fontes de dados em Mercados."
              : "Clique em Iniciar scanner no topo para conectar às fontes e carregar os ativos."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[13px]">
              <thead className="text-[11px] uppercase tracking-wider text-faint">
                <tr className="border-b border-line">
                  <th className="px-4 py-3 font-semibold">Ativo</th>
                  <th className="px-3 py-3 font-semibold">Preço</th>
                  <th className="px-3 py-3 font-semibold">24h</th>
                  <th className="px-3 py-3 font-semibold">Tendência</th>
                  <th className="px-3 py-3 font-semibold">Confluência</th>
                  <th className="px-3 py-3 font-semibold">Sinal</th>
                  <th className="px-3 py-3 font-semibold">Motivo / bloqueio</th>
                  <th className="px-4 py-3 text-right font-semibold">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const tone = r.decision === "COMPRA" ? "buy" : r.decision === "VENDA" ? "sell" : "mute";
                  return (
                    <tr key={r.key} onClick={() => nav(`/analise/${encodeURIComponent(r.key)}`)}
                      className={cx("cursor-pointer border-b border-line/70 transition-colors hover:bg-card-2", r.stale && "opacity-55")}>
                      <td className="px-4 py-3">
                        <div className="font-semibold">{r.display}</div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-faint">
                          {r.market_label} <SourceBadge source={r.source} isLive={r.is_live} stale={r.stale} />
                        </div>
                      </td>
                      <td className="num px-3 py-3">{price(r.last_price)}</td>
                      <td className={cx("num px-3 py-3", (r.change_pct ?? 0) >= 0 ? "text-buy" : "text-sell")}>{pct(r.change_pct)}</td>
                      <td className="px-3 py-3">
                        <span className={cx("inline-flex items-center gap-1 text-[12.5px] capitalize",
                          r.trend === "alta" ? "text-buy" : r.trend === "baixa" ? "text-sell" : "text-mute")}>
                          {r.trend === "alta" ? <ArrowUpRight size={14} /> : r.trend === "baixa" ? <ArrowDownRight size={14} /> : <Minus size={14} />}
                          {r.trend ?? "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3"><ScoreBar score={r.score} tone={tone} /></td>
                      <td className="px-3 py-3"><DecisionPill decision={r.decision} /></td>
                      <td className="max-w-[280px] truncate px-3 py-3 text-[12px] text-mute" title={r.blocker ?? ""}>
                        {r.blocker ?? (r.decision && r.decision !== "AGUARDAR" ? "Critérios atendidos" : "—")}
                      </td>
                      <td className="num px-4 py-3 text-right text-[11.5px] text-faint">{ago(r.last_update, now)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-line px-4 py-2.5 text-[11.5px] text-faint">
          {rows.length} de {data?.total ?? 0} ativos · Confluência = quantos critérios técnicos concordam. Não é probabilidade de lucro.
        </div>
      </Card>
    </div>
  );
}
