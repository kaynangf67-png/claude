import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Newspaper } from "lucide-react";

export interface NewsItem { title: string; country: string; impact: number; at: number; brt: string; minutes: number }
export interface NewsAlert { level: "alerta" | "sem_calendario" | null; message: string; events: NewsItem[]; next: NewsItem | null; currencies: string[] }

const stars = (n: number) => "★".repeat(n) + "☆".repeat(Math.max(0, 3 - n));
const when = (m: number) => (m === 0 ? "agora" : m > 0 ? `em ${m} min` : `há ${-m} min`);
const inH = (m: number) => (m < 60 ? `em ${m} min` : `em ${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`);

/**
 * Notícia de 2+ estrelas das moedas do ativo de 15 min antes a 15 min depois de agora: mostra o ALERTA primeiro e só libera
 * a entrada quando o usuário decidir ver. Nada é bloqueado de vez: a decisão é dele.
 */
export function NewsGate({ alert, children }: { alert: NewsAlert | null | undefined; children: ReactNode }) {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(false), [alert]);
  if (!alert) return <>{children}</>;

  if (alert.level && !ok) {
    const strong = alert.level === "alerta";
    return (
      <div className="animate-fade mt-4 rounded-2xl border border-warn/50 bg-warn/10 p-4">
        <div className="flex items-center gap-2 text-[16px] font-extrabold text-warn">
          <AlertTriangle size={20} /> {strong ? "ALERTA DE NOTÍCIA" : "NOTÍCIAS NÃO VERIFICADAS"}
        </div>
        {strong ? (
          <ul className="mt-2 space-y-1.5">
            {alert.events.map((e) => (
              <li key={`${e.at}${e.country}${e.title}`} className="text-[13px] text-ink">
                <span className="num font-bold text-warn">{stars(e.impact)}</span> <b>{e.country}</b> · {e.title}
                <span className="text-mute"> · {e.brt} ({when(e.minutes)})</span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-2 text-[12.5px] text-mute">{alert.message}</p>
        <p className="mt-1 text-[12px] text-mute">
          Em notícia forte o preço pode disparar para os dois lados em segundos, o spread abre e o stop pode ser executado pior que o marcado.
        </p>
        <button onClick={() => setOk(true)}
          className="mt-3 w-full rounded-xl border border-warn/60 px-4 py-2.5 text-[13.5px] font-bold text-warn hover:bg-warn/15">
          Estou ciente do risco: mostrar a entrada (decisão minha)
        </button>
      </div>
    );
  }

  return (
    <>
      {alert.level && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-[12px] text-warn">
          <AlertTriangle size={14} className="shrink-0" />
          {alert.level === "alerta" ? `Entrada com notícia forte na janela: ${alert.events.map((e) => `${e.country} ${stars(e.impact)} ${e.title} (${when(e.minutes)})`).join("; ")}.` : "Calendário não verificado nesta análise."}
        </div>
      )}
      {!alert.level && alert.next && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2 text-[12px] text-mute">
          <Newspaper size={14} className="shrink-0" />
          Sem notícia forte agora. Próxima de 2+ estrelas: <b className="text-ink">{alert.next.country} {stars(alert.next.impact)} {alert.next.title}</b> {inH(alert.next.minutes)} ({alert.next.brt}).
        </div>
      )}
      {children}
    </>
  );
}
