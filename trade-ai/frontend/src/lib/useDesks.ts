import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyResult, canTrade, expiryFor, lastClosedOpen, newDesk, refresh, settle, type Candle, type DeskState, type Trade,
} from "./desk";

const KEY = "trade-ai:mesas";
const LEADER = "trade-ai:motor";
const TICK_MS = 5000;

function load(): DeskState[] {
  const now = Math.floor(Date.now() / 1000);
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as DeskState[];
  } catch { /* sem armazenamento */ }
  return [newDesk("m1", "Lia", "BTCUSD", now), newDesk("m2", "Nara", "ETHUSD", now)];
}

const nowS = () => Math.floor(Date.now() / 1000);

/**
 * Motor das mesas. Roda no navegador enquanto o site está aberto:
 * analisa uma vez por vela M5 (logo após o fechamento), abre a operação simulada,
 * confere o resultado na vela de expiração e aplica as regras (5 wins / 2 losses → 24 h).
 */
export function useDesks() {
  const [desks, setDesks] = useState<DeskState[]>(load);
  const [otherTab, setOtherTab] = useState(false);
  const ref = useRef(desks);
  ref.current = desks;
  const busy = useRef<Record<string, boolean>>({});
  const tab = useRef(Math.random().toString(36).slice(2));

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(desks));
    } catch { /* sem armazenamento */ }
  }, [desks]);

  const update = useCallback((id: string, f: (d: DeskState) => DeskState) => {
    setDesks((ds) => ds.map((d) => (d.id === id ? f(d) : d)));
  }, []);

  /** Só uma aba opera de cada vez, para não abrir operações em dobro. */
  const isLeader = () => {
    try {
      const cur = JSON.parse(localStorage.getItem(LEADER) ?? "null") as { id: string; ts: number } | null;
      if (cur && cur.id !== tab.current && Date.now() - cur.ts < TICK_MS * 4) return false;
      localStorage.setItem(LEADER, JSON.stringify({ id: tab.current, ts: Date.now() }));
    } catch { /* sem armazenamento: esta aba opera */ }
    return true;
  };

  const settleOpen = useCallback(async (d: DeskState) => {
    const t = d.open!;
    const res = await fetch(`/api/candles?asset=${t.asset}`);
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Erro ${res.status}`);
    const { candles } = (await res.json()) as { candles: Candle[] };
    const r = settle(t, candles);
    const now = nowS();
    if (r) update(d.id, (cur) => (cur.open?.id === t.id ? applyResult(cur, { ...t, ...r }, now) : cur));
    else if (now > t.expiry + 1800)
      update(d.id, (cur) => (cur.open?.id === t.id ? applyResult(cur, { ...t, result: "anulada", profit: 0 }, now) : cur));
  }, [update]);

  const analyze = useCallback(async (d: DeskState, candleOpen: number) => {
    update(d.id, (cur) => ({ ...cur, lastAnalyzed: candleOpen }));
    try {
      const res = await fetch("/api/desk", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ asset: d.asset }),
      });
      const body = await res.json().catch(() => ({ error: `Erro ${res.status}` }));
      if (!res.ok) throw new Error(body.error ?? `Erro ${res.status}`);
      update(d.id, (cur) => {
        const last = { at: body.decided_at, decision: body.decision, reasons: body.reasons, against: body.against, blocks: body.blocks };
        const now = nowS();
        // a mesa pode ter sido desligada ou travada durante a análise
        if ((body.decision === "CALL" || body.decision === "PUT") && canTrade(cur, now) && cur.asset === body.asset) {
          const trade: Trade = {
            id: `${cur.id}-${body.decided_at}`, asset: cur.asset, direction: body.decision, entryPrice: body.price,
            entryAt: body.decided_at, expiry: expiryFor(body.decided_at, body.expiration_candles), stake: cur.stake,
            payout: cur.payout, reasons: body.reasons,
          };
          return { ...cur, last, open: trade };
        }
        return { ...cur, last };
      });
    } catch (e) {
      update(d.id, (cur) => ({
        ...cur, last: { at: nowS(), decision: "ERRO", reasons: [], against: [], blocks: [], error: (e as Error).message },
      }));
    }
  }, [update]);

  useEffect(() => {
    const tick = async () => {
      if (!isLeader()) {
        setOtherTab(true);
        return;
      }
      setOtherTab(false);
      const now = nowS();
      setDesks((ds) => ds.map((d) => refresh(d, now)));
      for (const d of ref.current.map((x) => refresh(x, now))) {
        if (busy.current[d.id]) continue;
        busy.current[d.id] = true;
        try {
          if (d.open && now >= d.open.expiry + 3) {
            await settleOpen(d);
          } else if (canTrade(d, now)) {
            const open = lastClosedOpen(now);
            const since = now - (open + 300);
            // uma análise por vela, nos 2 primeiros minutos após o fechamento (evita entrada atrasada)
            if (d.lastAnalyzed !== open && since >= 3 && since <= 120) await analyze(d, open);
          }
        } catch (e) {
          update(d.id, (cur) => ({
            ...cur, last: { at: nowS(), decision: "ERRO", reasons: [], against: [], blocks: [], error: (e as Error).message },
          }));
        } finally {
          busy.current[d.id] = false;
        }
      }
    };
    tick();
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [analyze, settleOpen, update]);

  return { desks, update, otherTab };
}
