/**
 * Calendário econômico da semana (feed público do Forex Factory em nfs.faireconomy.media).
 * O feed é atualizado poucas vezes por hora e pede poucas consultas: por isso a resposta fica 30 min em cache.
 */

const CALENDAR_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

export interface CalEvent {
  at: number;        // horário em segundos (epoch)
  title: string;
  country: string;   // moeda: USD, EUR, GBP...
  impact: number;    // estrelas: 3 alto, 2 médio, 1 baixo, 0 feriado/sem impacto
  forecast: string;
  previous: string;
}

const IMPACT: Record<string, number> = { high: 3, medium: 2, low: 1 };

interface RawEvent { title?: unknown; country?: unknown; date?: unknown; impact?: unknown; forecast?: unknown; previous?: unknown }

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function parseCalendar(rows: unknown): CalEvent[] {
  if (!Array.isArray(rows)) throw new Error("Calendário em formato inesperado");
  return (rows as RawEvent[]).flatMap((r) => {
    const at = Math.floor(Date.parse(str(r.date)) / 1000);
    const title = str(r.title);
    if (!Number.isFinite(at) || !title) return [];
    return [{
      at, title, country: str(r.country).toUpperCase(),
      impact: IMPACT[str(r.impact).toLowerCase()] ?? 0,
      forecast: str(r.forecast), previous: str(r.previous),
    }];
  }).sort((a, b) => a.at - b.at || b.impact - a.impact);
}

export async function fetchCalendar(): Promise<CalEvent[]> {
  const res = await fetch(CALENDAR_URL, { headers: { "user-agent": "Mozilla/5.0 (TradeAI painel)" } });
  if (!res.ok) throw new Error(`Calendário ${res.status}`);
  return parseCalendar(await res.json());
}

export async function handleCalendar(): Promise<Response> {
  try {
    const events = await fetchCalendar();
    return new Response(JSON.stringify({ events, at: Math.floor(Date.now() / 1000) }), {
      headers: { "content-type": "application/json", "cache-control": "public, s-maxage=1800, stale-while-revalidate=3600" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ events: [], error: (e as Error).message }), {
      status: 502, headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }
}
