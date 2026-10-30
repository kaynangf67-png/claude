import { BarChart3, Info } from "lucide-react";
import { api } from "../lib/api";
import { useData } from "../lib/hooks";
import { dateTime, money, ratio } from "../lib/format";
import type { Summary } from "../lib/types";
import { Badge, Card, Empty } from "../components/ui";
import { LineArea } from "../components/LineArea";

function SummaryGrid({ s, money: m }: { s: Summary; money?: number }) {
  const items: [string, string][] = [
    ["Operações", String(s.trades)],
    ["Ganhos / perdas", `${s.wins} / ${s.losses}`],
    ["Taxa de acerto", ratio(s.hit_rate)],
    ["Resultado em R", s.total_r.toFixed(2)],
    ["Média por operação", s.avg_r?.toFixed(2) ?? "—"],
    ["Fator de lucro", s.profit_factor?.toFixed(2) ?? "—"],
    ["Drawdown máx. (R)", s.max_drawdown_r.toFixed(2)],
  ];
  if (m !== undefined) items.push(["Resultado", money(m, true)]);
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
      {items.map(([k, v]) => (
        <div key={k}><div className="text-[11.5px] text-faint">{k}</div><div className="num mt-1 text-[18px] font-semibold">{v}</div></div>
      ))}
    </div>
  );
}

export function Stats() {
  const { data } = useData(api.stats);
  if (!data) return null;
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2 rounded-2xl border border-line bg-card px-4 py-3 text-[12.5px] text-mute">
        <Info size={16} className="mt-px shrink-0 text-info" />
        Backtest, demo e mercado ao vivo são medidos separadamente e nunca somados. A taxa de acerto vem só de operações encerradas;
        com poucas operações ela não diz nada sobre o futuro.
      </div>

      <Card title="Conta demo" action={<Badge tone="info">DEMO</Badge>}>
        {data.demo.trades ? (
          <>
            <SummaryGrid s={data.demo} money={data.demo.pnl} />
            {data.demo.simulated_feed_trades > 0 && (
              <p className="mt-3 text-[12px] text-warn">{data.demo.simulated_feed_trades} operações usaram dados SIMULADOS e não refletem mercado real.</p>
            )}
            {data.equity.length > 1 && <div className="mt-5"><LineArea points={data.equity} baseline={data.initial_balance} height={240} /></div>}
          </>
        ) : <Empty icon={<BarChart3 size={20} />} title="Sem operações demo encerradas" />}
      </Card>

      <Card title="Backtest" action={<Badge tone="warn">BACKTEST</Badge>}>
        {data.backtest.trades ? <SummaryGrid s={data.backtest} /> : <Empty icon={<BarChart3 size={20} />} title="Nenhum backtest rodado" text="Abra a análise de um ativo e clique em Backtest." />}
        {data.backtest_runs.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[12.5px]">
              <thead className="text-[11px] uppercase tracking-wider text-faint">
                <tr className="border-b border-line">
                  <th className="py-2 pr-3">Quando</th><th className="px-3 py-2">Ativo</th><th className="px-3 py-2">Candles</th>
                  <th className="px-3 py-2">Operações</th><th className="px-3 py-2">Acerto</th><th className="px-3 py-2">Total R</th><th className="px-3 py-2">Dados</th>
                </tr>
              </thead>
              <tbody>
                {data.backtest_runs.map((r) => (
                  <tr key={r.id} className="border-b border-line/70">
                    <td className="num py-2 pr-3 text-mute">{dateTime(r.created_at)}</td>
                    <td className="px-3 py-2 font-semibold">{r.asset_key}</td>
                    <td className="num px-3 py-2">{r.bars}</td>
                    <td className="num px-3 py-2">{r.trades}</td>
                    <td className="num px-3 py-2">{ratio(r.hit_rate)}</td>
                    <td className="num px-3 py-2">{r.total_r.toFixed(2)}</td>
                    <td className="px-3 py-2">{r.data_is_live ? <Badge tone="info">mercado</Badge> : <Badge tone="warn">simulado</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Mercado ao vivo" action={<Badge tone="mute">indisponível</Badge>}>
        <p className="text-[13px] text-mute">{data.live.note}</p>
      </Card>
    </div>
  );
}
