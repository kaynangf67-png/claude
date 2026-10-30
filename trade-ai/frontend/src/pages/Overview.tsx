import { Link } from "react-router-dom";
import { Activity, Crosshair, Gauge, Radar, Target, TrendingUp, Wallet } from "lucide-react";
import { api } from "../lib/api";
import { useData, useExecute } from "../lib/hooks";
import { useLive, useNow } from "../lib/live";
import { ago, money, ratio } from "../lib/format";
import { Badge, Card, Empty, Stat, TimeframeTag, cx } from "../components/ui";
import { ScannerToggle } from "../components/ScannerToggle";
import { OpportunityCard } from "../components/OpportunityCard";
import { LineArea } from "../components/LineArea";

export function Overview() {
  const { status, signals, account } = useLive();
  const now = useNow();
  const stats = useData(api.stats).data;
  const execute = useExecute();
  const active = signals.filter((s) => s.status === "ativo");
  const latest = signals.slice(0, 6);
  const running = !!status?.running;
  const errors = status?.providers.filter((p) => p.configured && p.state === "erro") ?? [];

  return (
    <div className="space-y-6">
      {/* Hero do scanner */}
      <section className="relative overflow-hidden rounded-3xl border border-line bg-gradient-to-br from-card to-panel p-6 shadow-card md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-buy/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-mute">
              <span className={cx("size-2 rounded-full", running ? "bg-buy text-buy animate-pulse-dot" : "bg-faint")} />
              Scanner {running ? "em operação" : "parado"}
            </div>
            <h2 className="mt-3 text-[26px] font-bold leading-tight md:text-[32px]">
              Day trade em <span className="text-info">M5</span>, em todos os mercados conectados.
            </h2>
            <p className="mt-2 max-w-xl text-[14px] text-mute">
              {running
                ? `Monitorando ${status?.assets_fresh ?? 0} ativos com dados atualizados${status?.simulated_present ? ` (${(status?.assets_fresh ?? 0) - (status?.assets_live ?? 0)} simulados)` : ""}. Último ciclo ${ago(status?.last_cycle, now)}.`
                : "Clique em iniciar: o Trade AI conecta às fontes de dados, analisa cada fechamento de candle M5 e libera só as oportunidades confirmadas."}
            </p>
            {errors.length > 0 && (
              <p className="mt-2 text-[13px] text-sell">Falha em: {errors.map((p) => `${p.label} (${p.message})`).join(" · ")}</p>
            )}
          </div>
          <div className="flex flex-col items-start gap-3 md:items-end">
            <ScannerToggle />
            <span className="flex items-center gap-2 text-[12px] text-faint">Timeframe <TimeframeTag /> · fechamento de candle</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Status do scanner" value={running ? "Ativo" : "Parado"} tone={running ? "buy" : "warn"} icon={<Radar size={15} />}
          hint={running ? `${status?.cycles ?? 0} ciclos` : "aguardando início"} />
        <Stat label="Ativos monitorados" value={status?.assets_fresh ?? 0} icon={<Crosshair size={15} />}
          hint={`${status?.assets_live ?? 0} ao vivo · ${status?.assets_stale ?? 0} sem dados atualizados`} />
        <Stat label="Oportunidades ativas" value={active.length} tone="buy" icon={<Target size={15} />}
          hint={`${signals.length} identificadas na sessão`} />
        <Stat label="Operações abertas" value={account?.open_trades.length ?? 0} icon={<Activity size={15} />} hint="conta demo" />
        <Stat label="Resultado do dia (demo)" value={<span className={(account?.today_pnl ?? 0) >= 0 ? "text-buy" : "text-sell"}>{money(account?.today_pnl ?? 0, true)}</span>}
          tone={(account?.today_pnl ?? 0) >= 0 ? "buy" : "sell"} icon={<Wallet size={15} />} hint="simulado, não é dinheiro real" />
        <Stat label="Taxa de acerto (demo)" value={ratio(stats?.demo.hit_rate)} icon={<Gauge size={15} />}
          hint={stats?.demo.trades ? `${stats.demo.trades} operações fechadas` : "sem operações ainda"} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Desempenho da conta demo" action={<Badge tone="info">DEMO</Badge>}>
          {stats && stats.equity.length > 1 ? (
            <LineArea points={stats.equity} baseline={stats.initial_balance} height={240} />
          ) : (
            <Empty icon={<TrendingUp size={20} />} title="Sem histórico de desempenho"
              text="A curva aparece depois das primeiras operações demo encerradas. Nenhum número é inventado." />
          )}
        </Card>
        <Card title="Fontes de dados" action={<Link to="/mercados" className="text-[12px] font-semibold text-info">Ver mercados</Link>}>
          <ul className="space-y-2.5">
            {status?.providers.map((p) => (
              <li key={p.name} className="flex items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2.5">
                <span className={cx("size-2 rounded-full",
                  p.state === "conectado" ? "bg-buy" : p.state === "erro" ? "bg-sell" : p.configured ? "bg-warn" : "bg-faint")} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">{p.label}</div>
                  <div className="truncate text-[11.5px] text-faint">{p.message || p.state}</div>
                </div>
                {!p.is_live && <Badge tone="warn">SIMULADO</Badge>}
                {p.last_ok && <span className="num text-[11px] text-faint">{ago(p.last_ok, now)}</span>}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">Últimas oportunidades identificadas</h2>
          <Link to="/oportunidades" className="text-[12.5px] font-semibold text-info">Ver todas</Link>
        </div>
        {latest.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {latest.map((s) => <OpportunityCard key={s.id} s={s} onExecute={execute} />)}
          </div>
        ) : (
          <Card><Empty icon={<Target size={20} />} title="Mercado sem confirmação. Aguardando uma oportunidade."
            text={running ? "Os critérios configurados ainda não foram atendidos em nenhum ativo." : "Inicie o scanner para começar a análise."} /></Card>
        )}
      </section>
    </div>
  );
}
