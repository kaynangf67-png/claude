import { runTick } from "./agent.js";
import { storeFromEnv } from "./store.js";
import { telegramFromEnv } from "./telegram.js";

/**
 * Runtime persistente opcional (Fly.io, Railway, Render, VPS): chama o MESMO runTick em loop.
 * Use quando quiser intervalo menor que o do agendador gratuito. Mesmo código, mesmo banco, mesma trava:
 * se o agendador externo e este worker rodarem juntos, a trava do banco garante uma varredura por vez.
 */
const store = storeFromEnv(), send = telegramFromEnv();
const everySec = Math.max(30, Number(process.env.AGENT_INTERVAL_SEC ?? 60));
let stop = false;
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => { stop = true; });

await store.migrate();
console.log(`[trade-agent] worker iniciado; intervalo ${everySec}s`);
while (!stop) {
  const t0 = Date.now();
  try {
    const r = await runTick({ store, send });
    console.log(`[trade-agent] ${new Date().toISOString()} ${r.action} estado=${r.state} pares=${r.scanned}/${r.failed} abriu=${r.opened ?? "-"} alertas=${r.alerts}${r.note ? " nota=" + r.note : ""}`);
  } catch (e) { console.error("[trade-agent] falha na execução (tenta de novo):", (e as Error).message); }
  const wait = Math.max(1000, everySec * 1000 - (Date.now() - t0));
  await new Promise((r) => setTimeout(r, wait));
}
await store.close();
console.log("[trade-agent] worker encerrado");
