import { useState } from "react";
import { Activity, Lock, OctagonX, ShieldCheck, Unlock } from "lucide-react";
import { api } from "../lib/api";
import { useData } from "../lib/hooks";
import { useLive } from "../lib/live";
import { dateTime, money, price } from "../lib/format";
import { Badge, Button, Card, Empty, Stat, SourceBadge, cx } from "../components/ui";

export function Operations() {
  const { toast, refresh } = useLive();
  const { data: acc, setData } = useData(api.account);
  const [confirm, setConfirm] = useState(false);

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast(ok, "ok");
      setData(await api.account());
      await refresh();
    } catch (e) {
      toast((e as Error).message, "erro");
    }
  };

  if (!acc) return null;
  const usedPct = acc.daily_loss_limit > 0 ? Math.min(100, (acc.daily_loss_used / acc.daily_loss_limit) * 100) : 0;
  const unreal = acc.open_trades.reduce((s, t) => s + (t.unrealized ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-info/25 bg-info-soft px-4 py-3 text-[13px] text-info">
        <span className="flex items-center gap-2"><ShieldCheck size={16} /> Conta DEMO · execução simulada · nenhuma ordem é enviada a corretora</span>
        {acc.locked && <Badge tone="sell"><Lock size={11} /> {acc.lock_reason}</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Saldo demo" value={money(acc.balance)} hint={`inicial ${money(acc.initial_balance)}`} />
        <Stat label="Resultado do dia" value={<span className={acc.today_pnl >= 0 ? "text-buy" : "text-sell"}>{money(acc.today_pnl, true)}</span>} hint={`em aberto ${money(unreal, true)}`} />
        <Stat label="Risco por operação" value={`${acc.settings.risk_pct}%`} hint={`alvo usado: ${acc.settings.target === "tp1" ? "Alvo 1" : "Alvo 2"}`} />
        <div className="rounded-2xl border border-line bg-card p-4 shadow-card">
          <div className="text-[12px] font-medium text-mute">Limite diário de perda</div>
          <div className="num mt-2 text-[17px] font-semibold">{money(acc.daily_loss_used)} <span className="text-[12px] text-faint">/ {money(acc.daily_loss_limit)}</span></div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-line">
            <div className={cx("h-full rounded-full", usedPct >= 100 ? "bg-sell" : usedPct > 66 ? "bg-warn" : "bg-buy")} style={{ width: `${usedPct}%` }} />
          </div>
        </div>
      </div>

      <Card title="Operações abertas" action={
        <div className="flex gap-2">
          {acc.locked && <Button variant="ghost" onClick={() => act(api.unlock, "Conta desbloqueada")}><Unlock size={14} /> Desbloquear</Button>}
          {!confirm ? (
            <Button variant="danger" onClick={() => setConfirm(true)}><OctagonX size={15} /> Emergência</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setConfirm(false)}>Cancelar</Button>
              <Button variant="sell" onClick={() => { setConfirm(false); act(api.emergency, "Tudo fechado e conta travada"); }}>
                Fechar tudo e travar
              </Button>
            </>
          )}
        </div>
      } pad={false}>
        {acc.open_trades.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-[13px]">
              <thead className="text-[11px] uppercase tracking-wider text-faint">
                <tr className="border-b border-line">
                  <th className="px-5 py-3 font-semibold">Ativo</th><th className="px-3 py-3 font-semibold">Lado</th>
                  <th className="px-3 py-3 font-semibold">Entrada</th><th className="px-3 py-3 font-semibold">Atual</th>
                  <th className="px-3 py-3 font-semibold">Stop</th><th className="px-3 py-3 font-semibold">Alvo</th>
                  <th className="px-3 py-3 font-semibold">Resultado</th><th className="px-5 py-3 text-right font-semibold" />
                </tr>
              </thead>
              <tbody>
                {acc.open_trades.map((t) => (
                  <tr key={t.id} className="border-b border-line/70">
                    <td className="px-5 py-3">
                      <div className="font-semibold">{t.symbol}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-faint">{dateTime(t.opened_at)} <SourceBadge source={t.source} isLive={t.data_is_live} stale={!t.data_ok} /></div>
                    </td>
                    <td className="px-3 py-3"><Badge tone={t.direction === "long" ? "buy" : "sell"}>{t.direction === "long" ? "COMPRA" : "VENDA"}</Badge></td>
                    <td className="num px-3 py-3">{price(t.entry)}</td>
                    <td className="num px-3 py-3">{price(t.last_price)}</td>
                    <td className="num px-3 py-3 text-sell">{price(t.stop)}</td>
                    <td className="num px-3 py-3 text-buy">{price(t.target)}</td>
                    <td className={cx("num px-3 py-3 font-semibold", (t.unrealized ?? 0) >= 0 ? "text-buy" : "text-sell")}>{money(t.unrealized ?? null, true)}</td>
                    <td className="px-5 py-3 text-right">
                      <Button variant="ghost" onClick={() => act(() => api.closeTrade(t.id), "Operação encerrada")}>Encerrar</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon={<Activity size={20} />} title="Nenhuma operação aberta"
            text="Abra uma operação demo em um card de oportunidade ativo. Entradas só são aceitas com stop-loss, dentro da região de entrada e com dados atualizados." />
        )}
      </Card>
      <p className="text-[11.5px] leading-relaxed text-faint">
        Stop e alvo são verificados a cada atualização de preço pela máxima/mínima; se os dois forem tocados no mesmo candle, conta-se o stop.
        Sem custos, spread ou slippage: resultados reais tendem a ser piores.
      </p>
    </div>
  );
}
