import { useEffect, useState } from "react";
import { CheckCircle2, CircleSlash } from "lucide-react";
import { api } from "../lib/api";
import { useLive } from "../lib/live";
import type { DemoSettings, EngineSettings } from "../lib/types";
import { Badge, Button, Card, Field, inputCls } from "../components/ui";

const ENGINE_FIELDS: { k: keyof EngineSettings; label: string; hint?: string; step?: number }[] = [
  { k: "min_score", label: "Confluência mínima (0–100)", hint: "Abaixo disso o sinal não é liberado" },
  { k: "min_adx", label: "ADX mínimo", hint: "Abaixo disso o mercado é tratado como lateral" },
  { k: "rsi_long_min", label: "RSI mínimo para compra" }, { k: "rsi_long_max", label: "RSI máximo para compra" },
  { k: "rsi_short_min", label: "RSI mínimo para venda" }, { k: "rsi_short_max", label: "RSI máximo para venda" },
  { k: "atr_pct_min", label: "Volatilidade mínima (ATR % do preço)", step: 0.01 },
  { k: "atr_pct_max", label: "Volatilidade máxima (ATR % do preço)", step: 0.1 },
  { k: "volume_factor", label: "Volume mínimo (× média 20)", step: 0.1 },
  { k: "stop_atr_mult", label: "Stop mínimo (× ATR)", step: 0.1, hint: "Stop é obrigatório" },
  { k: "max_stop_atr", label: "Stop máximo (× ATR)", step: 0.1 },
  { k: "tp1_rr", label: "Alvo 1 (R:R)", step: 0.1 }, { k: "tp2_rr", label: "Alvo 2 (R:R)", step: 0.1 },
  { k: "entry_zone_atr", label: "Região de entrada (± × ATR)", step: 0.05, hint: "Fora dela o sinal é cancelado" },
  { k: "validity_bars", label: "Validade do sinal (candles M5)" },
  { k: "max_signal_delay_s", label: "Atraso máximo após o fechamento (s)", hint: "Evita entradas atrasadas" },
];

export function Settings() {
  const { toast, refresh } = useLive();
  const [engine, setEngine] = useState<EngineSettings | null>(null);
  const [demo, setDemo] = useState<DemoSettings | null>(null);
  const [integrations, setIntegrations] = useState<Record<string, boolean | string>>({});
  const [newBalance, setNewBalance] = useState("");

  useEffect(() => {
    api.settings().then((s) => {
      setEngine(s.engine);
      setDemo(s.demo);
      setIntegrations(s.integrations);
    }).catch((e) => toast((e as Error).message, "erro"));
  }, [toast]);

  const save = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast(ok, "ok");
      await refresh();
    } catch (e) {
      toast((e as Error).message, "erro");
    }
  };

  if (!engine || !demo) return null;
  const INTEG: [string, string, string][] = [
    ["binance", "Binance (cripto)", "BINANCE_ENABLED"],
    ["twelvedata", "Twelve Data (forex, ações EUA, índices, commodities)", "TWELVEDATA_API_KEY"],
    ["tradingview_webhook", "TradingView webhook (B3, futuros e qualquer ativo)", "TRADINGVIEW_WEBHOOK_SECRET"],
    ["vision", "IA para análise de capturas (Claude)", "ANTHROPIC_API_KEY"],
    ["simulated_feed", "Feed simulado (desenvolvimento)", "ENABLE_SIMULATED_FEED"],
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <Card title="Critérios do motor de análise M5" action={<Button variant="primary" onClick={() => save(() => api.putEngine(engine), "Critérios salvos e ativos reavaliados")}>Salvar</Button>}>
        <div className="grid gap-4 sm:grid-cols-2">
          {ENGINE_FIELDS.map((f) => (
            <Field key={f.k} label={f.label} hint={f.hint}>
              <input type="number" step={f.step ?? 1} className={inputCls} value={engine[f.k] as number}
                onChange={(e) => setEngine({ ...engine, [f.k]: Number(e.target.value) })} />
            </Field>
          ))}
          <label className="flex items-center gap-2 text-[13px] text-mute sm:col-span-2">
            <input type="checkbox" className="accent-[#22c55e]" checked={engine.require_trend}
              onChange={(e) => setEngine({ ...engine, require_trend: e.target.checked })} />
            Exigir tendência principal (EMA 50 × EMA 200) a favor
          </label>
        </div>
      </Card>

      <div className="space-y-6">
        <Card title="Conta demo" action={<Button variant="primary" onClick={() => save(() => api.putDemo(demo), "Conta demo atualizada")}>Salvar</Button>}>
          <div className="grid gap-4">
            <Field label="Risco por operação (% do saldo)"><input type="number" step={0.1} className={inputCls} value={demo.risk_pct} onChange={(e) => setDemo({ ...demo, risk_pct: Number(e.target.value) })} /></Field>
            <Field label="Limite diário de perda (% do saldo)"><input type="number" step={0.5} className={inputCls} value={demo.daily_loss_limit_pct} onChange={(e) => setDemo({ ...demo, daily_loss_limit_pct: Number(e.target.value) })} /></Field>
            <Field label="Máximo de operações simultâneas"><input type="number" className={inputCls} value={demo.max_open} onChange={(e) => setDemo({ ...demo, max_open: Number(e.target.value) })} /></Field>
            <Field label="Alvo usado na saída">
              <select className={inputCls} value={demo.target} onChange={(e) => setDemo({ ...demo, target: e.target.value as "tp1" | "tp2" })}>
                <option value="tp1">Alvo 1</option><option value="tp2">Alvo 2</option>
              </select>
            </Field>
            <div className="border-t border-line pt-4">
              <Field label="Reiniciar conta com saldo inicial" hint="Exige não ter operações abertas. O histórico é mantido.">
                <div className="flex gap-2">
                  <input type="number" className={inputCls} placeholder={String(demo.initial_balance)} value={newBalance} onChange={(e) => setNewBalance(e.target.value)} />
                  <Button disabled={!newBalance} onClick={() => save(() => api.reset(Number(newBalance)), "Conta demo reiniciada")}>Reiniciar</Button>
                </div>
              </Field>
            </div>
          </div>
        </Card>

        <Card title="Integrações">
          <ul className="space-y-2.5">
            {INTEG.map(([k, label, env]) => (
              <li key={k} className="flex items-start gap-2.5 text-[13px]">
                {integrations[k] ? <CheckCircle2 size={16} className="mt-px text-buy" /> : <CircleSlash size={16} className="mt-px text-faint" />}
                <div className="min-w-0 flex-1">
                  <div>{label}</div>
                  <code className="text-[11px] text-faint">{env}</code>
                </div>
                {k === "simulated_feed" && integrations[k] ? <Badge tone="warn">ligado</Badge> : null}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11.5px] text-faint">Chaves e segredos ficam só no servidor (variáveis de ambiente). Banco: {String(integrations.database ?? "")}.</p>
        </Card>
      </div>
    </div>
  );
}
