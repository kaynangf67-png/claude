import { config, hasBackend } from '../config';
import type { BBox, LonLat } from '../lib/geo';
import type { Report, ReportKind } from '../model/types';

/** Identificador anônimo do aparelho (sem dados pessoais). */
export function deviceId(): string {
  try {
    let id = localStorage.getItem('vq2.device');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('vq2.device', id);
    }
    return id;
  } catch {
    return 'sem-armazenamento';
  }
}

export interface NewReport {
  segmentId: string;
  kind: ReportKind;
  pos: LonLat;
  trust: number;
}

export interface MetricEvent {
  name: 'app_open' | 'forecast_shown' | 'answer' | 'report' | 'subscribe_click' | 'waitlist' | 'navigate';
  props?: Record<string, string | number | boolean | null>;
  at: number;
}

export interface DataStore {
  readonly kind: 'local' | 'supabase';
  getReports(bbox: BBox, sinceMs: number): Promise<Report[]>;
  addReport(r: NewReport): Promise<Report>;
  track(e: MetricEvent): void;
  events(): MetricEvent[];
  clearMine(): Promise<void>;
}

const LOCAL_REPORTS = 'vq2.reports';
const LOCAL_EVENTS = 'vq2.events';

interface StoredReport extends Report {
  pos: LonLat;
}

function readJson<T>(key: string, d: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || '') as T;
  } catch {
    return d;
  }
}
function writeJson(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

const inBox = (p: LonLat, b: BBox) => p[0] >= b.west && p[0] <= b.east && p[1] >= b.south && p[1] <= b.north;

/** Guarda no próprio aparelho (piloto sem servidor / modo offline). */
export class LocalStore implements DataStore {
  readonly kind = 'local' as const;
  async getReports(bbox: BBox, sinceMs: number) {
    return readJson<StoredReport[]>(LOCAL_REPORTS, []).filter((r) => r.at >= sinceMs && inBox(r.pos, bbox));
  }
  async addReport(r: NewReport) {
    const all = readJson<StoredReport[]>(LOCAL_REPORTS, []).filter((x) => Date.now() - x.at < 7 * 86400000);
    const rep: StoredReport = { id: crypto.randomUUID(), segmentId: r.segmentId, kind: r.kind, at: Date.now(), trust: r.trust, pos: r.pos };
    all.push(rep);
    writeJson(LOCAL_REPORTS, all.slice(-500));
    return rep;
  }
  track(e: MetricEvent) {
    const all = readJson<MetricEvent[]>(LOCAL_EVENTS, []);
    all.push(e);
    writeJson(LOCAL_EVENTS, all.slice(-2000));
  }
  events() {
    return readJson<MetricEvent[]>(LOCAL_EVENTS, []);
  }
  async clearMine() {
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('vq2.'))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  }
}

/**
 * Supabase via REST (PostgREST) — sem SDK, para manter o app leve.
 * Esquema e regras de acesso em supabase/migrations/001_init.sql.
 */
export class SupabaseStore implements DataStore {
  readonly kind = 'supabase' as const;
  private local = new LocalStore();
  constructor(
    private url: string,
    private key: string,
  ) {}
  private headers(extra: Record<string, string> = {}) {
    const token = readJson<{ access_token?: string } | null>('vq2.session', null)?.access_token;
    return { apikey: this.key, Authorization: `Bearer ${token || this.key}`, 'Content-Type': 'application/json', ...extra };
  }
  async getReports(b: BBox, sinceMs: number) {
    const q = new URLSearchParams();
    q.set('select', 'id,segment_id,kind,created_at,trust,lat,lon');
    q.append('lon', `gte.${b.west}`);
    q.append('lon', `lte.${b.east}`);
    q.append('lat', `gte.${b.south}`);
    q.append('lat', `lte.${b.north}`);
    q.set('created_at', `gte.${new Date(sinceMs).toISOString()}`);
    q.set('limit', '2000');
    const res = await fetch(`${this.url}/rest/v1/reports?${q}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`Supabase ${res.status}`);
    const rows = (await res.json()) as { id: string; segment_id: string; kind: ReportKind; created_at: string; trust: number; lat: number; lon: number }[];
    return rows.map((r) => ({ id: r.id, segmentId: r.segment_id, kind: r.kind, at: Date.parse(r.created_at), trust: r.trust, pos: [r.lon, r.lat] as LonLat }));
  }
  async addReport(r: NewReport) {
    const body = { segment_id: r.segmentId, kind: r.kind, lon: r.pos[0], lat: r.pos[1], trust: r.trust, device_id: deviceId() };
    const res = await fetch(`${this.url}/rest/v1/reports`, { method: 'POST', headers: this.headers({ Prefer: 'return=representation' }), body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`Supabase ${res.status}`);
    const [row] = (await res.json()) as { id: string; created_at: string }[];
    return { id: row.id, segmentId: r.segmentId, kind: r.kind, at: Date.parse(row.created_at), trust: r.trust, pos: r.pos };
  }
  track(e: MetricEvent) {
    this.local.track(e);
    void fetch(`${this.url}/rest/v1/events`, {
      method: 'POST',
      headers: this.headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ name: e.name, props: e.props ?? {}, device_id: deviceId(), created_at: new Date(e.at).toISOString() }),
      keepalive: true,
    }).catch(() => undefined);
  }
  events() {
    return this.local.events();
  }
  async clearMine() {
    await fetch(`${this.url}/rest/v1/rpc/delete_my_data`, { method: 'POST', headers: this.headers(), body: JSON.stringify({ p_device_id: deviceId() }) }).catch(() => undefined);
    await this.local.clearMine();
  }
}

let store: DataStore | null = null;
export function getStore(): DataStore {
  if (!store) store = hasBackend() ? new SupabaseStore(config.supabaseUrl, config.supabaseAnonKey) : new LocalStore();
  return store;
}
