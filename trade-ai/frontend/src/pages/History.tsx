import { useState } from "react";
import { History as HistoryIcon } from "lucide-react";
import { api } from "../lib/api";
import { useData } from "../lib/hooks";
import { dateTime, money, price } from "../lib/format";
import { Badge, Card, Empty, Segmented, SourceBadge, cx } from "../components/ui";

const REASON: Record<string, string> = {
  stop: "Stop", alvo: "Alvo", manual: "Manual", emergencia: "Emergência", fim_dos_dados: "Fim dos dados",
};

export function History() {
  const [mode, setMode] = useState<"demo" | "backtest">("demo");
  const { data } = useData(() => api.trades(mode), [mode]);
  const events = useData(api.events).data?.events ?? [];
  const rows = data?.trades ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented value={mode} onChange={setMode} options={[{ value: "demo", label: "Demo" }, { value: "backtest", label: "Backtest" }]} />
        <Badge tone={mode === "demo" ? "info" : "warn"}>{mode === "demo" ? "Resultados de conta DEMO" : "Resultados de BACKTEST (histórico)"}</Badge>
      </div>
      <Card pad={false}>
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[13px]">
              <thead className="text-[11px] uppercase tracking-wider text-faint">
                <tr className="border-b border-line">
                  <th className="px-5 py-3 font-semibold">Abertura</th><th className="px-3 py-3 font-semibold">Ativo</th>
                  <th className="px-3 py-3 font-semibold">Lado</th><th className="px-3 py-3 font-semibold">Entrada</th>
                  <th className="px-3 py-3 font-semibold">Saída</th><th className="px-3 py-3 font-semibold">Motivo</th>
                  <th className="px-3 py-3 font-semibold">R</th><th className="px-5 py-3 text-right font-semibold">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const win = (t.r_multiple ?? 0) > 0;
                  return (
                    <tr key={t.id} className="border-b border-line/70">
                      <td className="num px-5 py-3 text-[12px] text-mute">{dateTime(t.opened_at)}</td>
                      <td className="px-3 py-3"><div className="font-semibold">{t.symbol}</div><SourceBadge source={t.source} isLive={t.data_is_live} /></td>
                      <td className="px-3 py-3"><Badge tone={t.direction === "long" ? "buy" : "sell"}>{t.direction === "long" ? "COMPRA" : "VENDA"}</Badge></td>
                      <td className="num px-3 py-3">{price(t.entry)}</td>
                      <td className="num px-3 py-3">{t.status === "aberta" ? <Badge tone="info">aberta</Badge> : price(t.exit)}</td>
                      <td className="px-3 py-3 text-[12px] text-mute">{t.exit_reason ? REASON[t.exit_reason] ?? t.exit_reason : "—"}</td>
                      <td className={cx("num px-3 py-3", win ? "text-buy" : "text-sell")}>{t.r_multiple?.toFixed(2) ?? "—"}</td>
                      <td className={cx("num px-5 py-3 text-right font-semibold", win ? "text-buy" : "text-sell")}>
                        {mode === "demo" ? money(t.pnl, true) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={<HistoryIcon size={20} />} title="Nenhuma operação registrada"
            text={mode === "demo" ? "Toda operação demo fica registrada aqui, com entrada, saída e motivo." : "Rode um backtest na página de análise de um ativo."} />
        )}
      </Card>

      <Card title="Registro de eventos">
        {events.length ? (
          <ul className="space-y-1.5">
            {events.map((e, i) => (
              <li key={i} className="flex gap-3 text-[12.5px]">
                <span className="num shrink-0 text-faint">{dateTime(e.at)}</span>
                <Badge tone="mute">{e.kind}</Badge>
                <span className="text-mute">{e.message}</span>
              </li>
            ))}
          </ul>
        ) : <p className="text-[13px] text-mute">Sem eventos.</p>}
      </Card>
    </div>
  );
}
