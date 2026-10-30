import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Activity, BarChart3, Camera, Globe2, History, LayoutDashboard, Menu, Radar, Settings, Sparkles, Target, X,
} from "lucide-react";
import { useLive } from "../lib/live";
import { ConnDot, TimeframeTag, cx } from "./ui";
import { ScannerToggle } from "./ScannerToggle";

const NAV = [
  { to: "/", label: "Visão geral", icon: LayoutDashboard },
  { to: "/scanner", label: "Scanner global", icon: Radar },
  { to: "/mercados", label: "Mercados", icon: Globe2 },
  { to: "/oportunidades", label: "Oportunidades", icon: Target },
  { to: "/operacoes", label: "Operações", icon: Activity },
  { to: "/historico", label: "Histórico", icon: History },
  { to: "/estatisticas", label: "Estatísticas", icon: BarChart3 },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="grid size-9 place-items-center rounded-xl border border-buy/30 bg-gradient-to-br from-buy/25 to-info/10">
        <Sparkles size={17} className="text-buy" />
      </div>
      <div className="leading-tight">
        <div className="text-[15px] font-extrabold tracking-[0.08em]">TRADE <span className="text-buy">AI</span></div>
        <div className="text-[10.5px] font-medium text-faint">Global Market Scanner</div>
      </div>
    </div>
  );
}

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const { signals } = useLive();
  const active = signals.filter((s) => s.status === "ativo").length;
  return (
    <nav className="mt-7 flex flex-col gap-0.5">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} end={to === "/"} onClick={onNavigate}
          className={({ isActive }) => cx(
            "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-colors",
            isActive ? "bg-card-2 text-ink shadow-card" : "text-mute hover:bg-card hover:text-ink")}>
          {({ isActive }) => (
            <>
              <Icon size={17} className={isActive ? "text-buy" : "text-faint group-hover:text-mute"} />
              <span className="flex-1">{label}</span>
              {to === "/oportunidades" && active > 0 && (
                <span className="num rounded-md bg-buy px-1.5 text-[11px] font-bold text-[#04130a]">{active}</span>
              )}
            </>
          )}
        </NavLink>
      ))}
      <div className="my-3 h-px bg-line" />
      <NavLink to="/captura" onClick={onNavigate}
        className={({ isActive }) => cx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium",
          isActive ? "bg-card-2 text-ink" : "text-mute hover:bg-card hover:text-ink")}>
        <Camera size={17} className="text-info" /> Captura com IA
      </NavLink>
    </nav>
  );
}

export function Layout() {
  const [open, setOpen] = useState(false);
  const { conn, status } = useLive();
  const loc = useLocation();
  const title = NAV.find((n) => (n.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(n.to)))?.label
    ?? (loc.pathname.startsWith("/analise") ? "Análise detalhada" : loc.pathname.startsWith("/captura") ? "Captura com IA" : "");

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-line bg-panel/70 px-4 py-6 backdrop-blur lg:flex">
        <Brand />
        <Nav />
        <div className="mt-auto rounded-2xl border border-line bg-card p-3.5 text-[11.5px] leading-relaxed text-faint">
          Operações apenas em <b className="text-mute">modo demo</b>. O Trade AI não envia ordens reais e não promete acerto.
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <aside className="absolute inset-y-0 left-0 w-[270px] border-r border-line bg-panel px-4 py-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <Brand />
              <button className="text-mute" onClick={() => setOpen(false)} aria-label="Fechar menu"><X size={20} /></button>
            </div>
            <Nav onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-bg/80 px-4 py-3 backdrop-blur md:px-7">
          <button className="text-mute lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu size={22} /></button>
          <h1 className="truncate text-[17px] font-semibold">{title}</h1>
          <TimeframeTag />
          <div className="ml-auto flex items-center gap-4">
            <span className="hidden sm:inline-flex"><ConnDot state={conn} /></span>
            <ScannerToggle compact />
          </div>
        </header>
        {status?.simulated_present && (
          <div className="border-b border-warn/30 bg-warn-soft px-4 py-2 text-center text-[12.5px] font-medium text-warn md:px-7">
            Feed SIMULADO ativo: ativos marcados como “SIMULADO” não são cotações reais.
          </div>
        )}
        {conn === "offline" && (
          <div className="border-b border-sell/30 bg-sell-soft px-4 py-2 text-center text-[12.5px] font-medium text-sell">
            Sem conexão com o servidor. Dados na tela podem estar desatualizados; entradas demo ficam bloqueadas.
          </div>
        )}
        <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-6 md:px-7">
          <Outlet />
        </main>
      </div>
      <Toasts />
    </div>
  );
}

function Toasts() {
  const { toasts } = useLive();
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={cx("animate-fade rounded-xl border px-4 py-3 text-[13px] font-medium shadow-card backdrop-blur",
          t.kind === "ok" ? "border-buy/30 bg-[#0b1a12]/95 text-buy" : t.kind === "erro" ? "border-sell/30 bg-[#1d0c0c]/95 text-sell"
            : "border-line-2 bg-card/95 text-ink")}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
