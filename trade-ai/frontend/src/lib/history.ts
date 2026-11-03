import type { Decision } from "../../server/analyze";

export interface Entry {
  id: string;
  at: number; // ms
  symbol: string | null;
  timeframe: string | null;
  decision: Decision;
  quality: string;
  payout: number;
  entryAt: number | null;
  expiryAt: number | null;
  result: "win" | "loss" | null;
}

const KEY = "trade-ai:historico";

export function load(): Entry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Entry[]) : [];
  } catch {
    return [];
  }
}

export function save(list: Entry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 500)));
  } catch {
    /* armazenamento indisponível (aba anônima): o histórico vale só nesta sessão */
  }
}
