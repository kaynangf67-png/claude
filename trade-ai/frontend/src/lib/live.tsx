import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api, wsUrl } from "./api";
import type { Account, Signal, Status } from "./types";

type Conn = "conectando" | "online" | "offline";

interface LiveState {
  conn: Conn;
  status: Status | null;
  signals: Signal[];
  account: Account | null;
  lastMessage: number | null;
  version: number; // muda a cada evento: páginas usam para recarregar dados
  refresh: () => Promise<void>;
  setStatus: (s: Status) => void;
  toast: (msg: string, kind?: "ok" | "erro" | "info") => void;
  toasts: { id: number; msg: string; kind: "ok" | "erro" | "info" }[];
}

const Ctx = createContext<LiveState | null>(null);

export function LiveProvider({ children }: { children: ReactNode }) {
  const [conn, setConn] = useState<Conn>("conectando");
  const [status, setStatus] = useState<Status | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [lastMessage, setLast] = useState<number | null>(null);
  const [version, setVersion] = useState(0);
  const [toasts, setToasts] = useState<LiveState["toasts"]>([]);
  const retry = useRef(0);

  const toast = useCallback((msg: string, kind: "ok" | "erro" | "info" = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [st, sg, ac] = await Promise.all([api.status(), api.signals(), api.account()]);
      setStatus(st);
      setSignals(sg.signals);
      setAccount(ac);
      setVersion((v) => v + 1);
    } catch {
      setConn("offline");
    }
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: number | undefined;
    let closed = false;

    const connect = () => {
      setConn((c) => (c === "online" ? c : "conectando"));
      ws = new WebSocket(wsUrl());
      ws.onopen = () => {
        retry.current = 0;
        setConn("online");
      };
      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        setLast(Date.now() / 1000);
        if (msg.type === "snapshot") {
          setStatus(msg.status);
          setSignals(msg.signals);
          setAccount(msg.account);
        } else if (msg.type === "signal") {
          const s: Signal = msg.signal;
          setSignals((prev) => [s, ...prev.filter((x) => x.id !== s.id)].sort((a, b) => b.created_at - a.created_at));
          if (msg.event === "novo") toast(`${s.decision} ${s.symbol} · confluência ${s.score}`, "info");
        } else if (msg.type === "trade") {
          const t = msg.trade;
          if (msg.event === "fechada")
            toast(`${t.symbol} encerrada (${t.exit_reason}) ${t.pnl >= 0 ? "+" : ""}${t.pnl?.toFixed(2)}`,
              t.pnl >= 0 ? "ok" : "erro");
        }
        setVersion((v) => v + 1);
      };
      ws.onclose = () => {
        if (closed) return;
        setConn("offline");
        const delay = Math.min(15000, 1000 * 2 ** retry.current++);
        timer = window.setTimeout(connect, delay);
      };
      ws.onerror = () => ws?.close();
    };

    refresh();
    connect();
    return () => {
      closed = true;
      window.clearTimeout(timer);
      ws?.close();
    };
  }, [refresh, toast]);

  return (
    <Ctx.Provider value={{ conn, status, signals, account, lastMessage, version, refresh, setStatus, toast, toasts }}>
      {children}
    </Ctx.Provider>
  );
}

export function useLive(): LiveState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLive fora do LiveProvider");
  return v;
}

/** Relógio que atualiza a cada segundo (contagens regressivas, "há X s"). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now() / 1000);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() / 1000), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
