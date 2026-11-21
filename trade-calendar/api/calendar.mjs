// Calendário econômico ao vivo (fonte: feed público semanal do Forex Factory).
// Normaliza os eventos e guarda em cache para respeitar o limite de acessos da fonte.
const SOURCES = [
  'https://nfs.faireconomy.media/ff_calendar_thisweek.json',
  'https://nfs.faireconomy.media/ff_calendar_nextweek.json',
];
const TTL_MS = 5 * 60 * 1000;
let memo = { at: 0, data: null };

const IMPACT = { high: 'high', medium: 'medium', low: 'low', holiday: 'holiday', 'non-economic': 'low' };

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

function normalize(list) {
  const out = [];
  for (const e of Array.isArray(list) ? list : []) {
    const t = Date.parse(e.date);
    if (!e || !e.title || Number.isNaN(t)) continue;
    const currency = String(e.country || '').toUpperCase().slice(0, 4);
    const impact = IMPACT[String(e.impact || '').toLowerCase()] || 'low';
    out.push({
      id: hash(`${currency}|${e.date}|${e.title}`),
      title: String(e.title),
      currency,
      impact,
      time: new Date(t).toISOString(),
      forecast: e.forecast ? String(e.forecast) : '',
      previous: e.previous ? String(e.previous) : '',
      actual: e.actual ? String(e.actual) : '',
    });
  }
  return out;
}

async function fetchJson(url) {
  const r = await fetch(url, { headers: { 'user-agent': 'TradeCalendar/1.0', accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export default async function handler(req, res) {
  try {
    if (!memo.data || Date.now() - memo.at > TTL_MS) {
      const results = await Promise.allSettled(SOURCES.map(fetchJson));
      if (results[0].status !== 'fulfilled' && !memo.data) throw results[0].reason;
      const seen = new Set();
      const events = [];
      for (const r of results) {
        if (r.status !== 'fulfilled') continue;
        for (const ev of normalize(r.value)) { if (!seen.has(ev.id)) { seen.add(ev.id); events.push(ev); } }
      }
      events.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
      if (events.length || !memo.data) memo = { at: Date.now(), data: events };
    }
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(JSON.stringify({ source: 'Forex Factory', updatedAt: new Date(memo.at).toISOString(), events: memo.data }));
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ error: 'Não foi possível carregar o calendário econômico agora.', detail: String(err && err.message || err) });
  }
}
