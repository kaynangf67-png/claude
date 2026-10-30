import { useState } from "react";
import { Loader2, Play, Square } from "lucide-react";
import { api } from "../lib/api";
import { useLive } from "../lib/live";
import { Button, cx } from "./ui";

export function ScannerToggle({ compact = false }: { compact?: boolean }) {
  const { status, setStatus, toast, refresh, conn } = useLive();
  const [busy, setBusy] = useState(false);
  const running = !!status?.running;

  const toggle = async () => {
    setBusy(true);
    try {
      const st = running ? await api.stop() : await api.start();
      setStatus(st);
      const errs = st.providers.filter((p) => p.configured && p.state === "erro");
      if (!running) {
        toast(errs.length ? `Scanner iniciado com falha em: ${errs.map((p) => p.label).join(", ")}` : "Scanner iniciado",
          errs.length ? "erro" : "ok");
      }
      await refresh();
    } catch (e) {
      toast((e as Error).message, "erro");
    } finally {
      setBusy(false);
    }
  };

  if (compact) {
    return (
      <Button variant={running ? "outline" : "buy"} onClick={toggle} disabled={busy || conn === "offline"} className="px-3">
        {busy ? <Loader2 size={15} className="animate-spin" /> : running ? <Square size={13} /> : <Play size={14} />}
        <span className="hidden sm:inline">{running ? "Parar" : "Iniciar scanner"}</span>
      </Button>
    );
  }
  return (
    <button onClick={toggle} disabled={busy || conn === "offline"}
      className={cx("group relative flex items-center gap-3 overflow-hidden rounded-2xl px-6 py-4 text-[15px] font-extrabold tracking-[0.06em] transition-all disabled:opacity-50",
        running ? "border border-line-2 bg-card-2 text-ink hover:border-sell/50"
          : "bg-buy text-[#04130a] shadow-[0_10px_40px_-10px_#22c55e99] hover:shadow-[0_10px_50px_-6px_#22c55eaa]")}>
      {busy ? <Loader2 size={18} className="animate-spin" /> : running ? <Square size={16} /> : <Play size={18} />}
      {running ? "PARAR SCANNER" : "INICIAR SCANNER"}
    </button>
  );
}
