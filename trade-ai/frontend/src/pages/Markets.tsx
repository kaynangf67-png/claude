import { useState } from "react";
import { Copy, FileUp, Globe2, KeyRound } from "lucide-react";
import { api, webhookUrl } from "../lib/api";
import { useData } from "../lib/hooks";
import { useLive, useNow } from "../lib/live";
import { ago } from "../lib/format";
import { Badge, Button, Card, Field, cx, inputCls } from "../components/ui";

const COVERAGE = {
  ao_vivo: { label: "Ao vivo", tone: "buy" },
  simulado: { label: "Simulado", tone: "warn" },
  sem_provedor: { label: "Sem fonte", tone: "mute" },
} as const;

export function Markets() {
  const { data } = useData(api.markets);
  const now = useNow();
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data?.markets.map((m) => (
          <div key={m.market} className="rounded-2xl border border-line bg-card p-4 shadow-card animate-fade">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-semibold">{m.label}</span>
              <Badge tone={COVERAGE[m.coverage].tone}>{COVERAGE[m.coverage].label}</Badge>
            </div>
            <div className="num mt-3 text-[22px] font-semibold">{m.assets}<span className="ml-1 text-[12px] font-normal text-faint">ativos</span></div>
            <div className="mt-1 text-[11.5px] text-faint">
              {m.stale > 0 ? <span className="text-warn">{m.stale} sem dados atualizados</span> : m.assets ? "todos atualizados" : ""}
            </div>
            <div className="mt-2 text-[11.5px] text-mute">{m.providers.length ? `Fonte: ${m.providers.join(", ")}` : m.note}</div>
          </div>
        ))}
      </div>

      <Card title="Conexões de dados" action={<Globe2 size={16} className="text-faint" />}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-wider text-faint">
              <tr className="border-b border-line">
                <th className="py-2.5 pr-3 font-semibold">Fonte</th>
                <th className="px-3 py-2.5 font-semibold">Estado</th>
                <th className="px-3 py-2.5 font-semibold">Mercados</th>
                <th className="px-3 py-2.5 font-semibold">Ativos</th>
                <th className="px-3 py-2.5 font-semibold">Última atualização</th>
                <th className="px-3 py-2.5 font-semibold">Observação</th>
              </tr>
            </thead>
            <tbody>
              {data?.providers.map((p) => (
                <tr key={p.name} className="border-b border-line/70">
                  <td className="py-3 pr-3 font-semibold">{p.label} {!p.is_live && <Badge tone="warn">SIMULADO</Badge>}</td>
                  <td className="px-3 py-3">
                    <Badge tone={p.state === "conectado" ? "buy" : p.state === "erro" ? "sell" : p.state === "sem_credencial" ? "mute" : "warn"}>
                      {p.state.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-[12px] text-mute">{p.markets.join(", ")}</td>
                  <td className="num px-3 py-3">{p.symbols}</td>
                  <td className="num px-3 py-3 text-[12px] text-mute">{ago(p.last_ok, now)}</td>
                  <td className="px-3 py-3 text-[12px] text-mute">
                    {p.requires.length ? <span className="inline-flex items-center gap-1 text-warn"><KeyRound size={12} />Requer {p.requires.join(", ")}</span> : p.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-faint">
          Um ativo fica “sem dados atualizados” quando passa mais de dois candles sem cotação nova (mercado fechado, feed travado ou queda de conexão).
          Nesses ativos o scanner não libera sinal e a conta demo bloqueia entradas.
        </p>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <WebhookCard />
        <CsvImport />
      </div>
    </div>
  );
}

function WebhookCard() {
  const { status, toast } = useLive();
  const tv = status?.providers.find((p) => p.name === "tradingview");
  const url = webhookUrl();
  const sample = JSON.stringify({ secret: "SEU_SEGREDO", type: "bar", symbol: "PETR4", exchange: "BMFBOVESPA", timeframe: "5", time: 1767261600000, open: 37.1, high: 37.3, low: 37.0, close: 37.25, volume: 120400 }, null, 2);
  return (
    <Card title="TradingView · webhook Pine Script" action={<Badge tone={tv?.configured ? "buy" : "mute"}>{tv?.configured ? "ativo" : "sem segredo"}</Badge>}>
      <ol className="list-decimal space-y-1.5 pl-5 text-[13px] text-mute">
        <li>No servidor, defina <code className="text-ink">TRADINGVIEW_WEBHOOK_SECRET</code>.</li>
        <li>No TradingView, abra o ativo em <b className="text-ink">5 minutos</b> e adicione o indicador <code className="text-ink">tradingview/trade_ai_feed_m5.pine</code>.</li>
        <li>Crie um alerta “Any alert() function call” com a URL de webhook abaixo. Um alerta por ativo.</li>
        <li>Para ter histórico na hora (EMA 200 precisa de 210 candles), importe o CSV do gráfico ao lado.</li>
      </ol>
      <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2">
        <code className="num min-w-0 flex-1 truncate text-[12px] text-info">{url}</code>
        <button onClick={() => navigator.clipboard.writeText(url).then(() => toast("URL copiada", "ok"))} className="text-mute hover:text-ink" aria-label="Copiar URL"><Copy size={14} /></button>
      </div>
      <pre className="num mt-3 max-h-48 overflow-auto rounded-xl border border-line bg-panel p-3 text-[11.5px] text-mute">{sample}</pre>
      <p className="mt-3 text-[11.5px] text-faint">Webhooks do TradingView exigem plano pago e autenticação em dois fatores (2FA). Barras fora de M5 são recusadas.</p>
    </Card>
  );
}

function CsvImport() {
  const { toast, refresh } = useLive();
  const [file, setFile] = useState<File | null>(null);
  const [symbol, setSymbol] = useState("");
  const [market, setMarket] = useState("b3");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!file || !symbol) return;
    setBusy(true);
    try {
      const r = await api.importCsv(file, symbol, market);
      toast(`${r.candles} candles M5 importados para ${r.asset}`, "ok");
      await refresh();
    } catch (e) {
      toast((e as Error).message, "erro");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title="Importar histórico (CSV do TradingView)" action={<FileUp size={16} className="text-faint" />}>
      <p className="text-[13px] text-mute">
        No TradingView: gráfico em 5 min → menu do layout → <b className="text-ink">Exportar dados do gráfico</b> (horário em UNIX).
        O histórico importado não é tratado como ao vivo até chegarem alertas novos.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Ativo (igual ao ticker do alerta)"><input className={inputCls} value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="PETR4" /></Field>
        <Field label="Mercado">
          <select className={inputCls} value={market} onChange={(e) => setMarket(e.target.value)}>
            <option value="b3">Ações brasileiras</option><option value="futures">Futuros</option><option value="forex">Forex</option>
            <option value="crypto">Cripto</option><option value="us_stocks">Ações EUA</option><option value="indices">Índices</option>
            <option value="commodities">Commodities</option>
          </select>
        </Field>
      </div>
      <label className={cx("mt-3 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-line-2 bg-panel px-4 py-5 text-[13px] text-mute hover:border-info")}>
        <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {file ? file.name : "Selecionar arquivo .csv"}
      </label>
      <Button variant="primary" className="mt-3 w-full" disabled={!file || !symbol || busy} onClick={send}>Importar</Button>
    </Card>
  );
}
