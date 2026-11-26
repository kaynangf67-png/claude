// Cliente da API REST e do WebSocket.
const TOKEN_KEY = 'pixelrush.token';

export const auth = {
  get token() { return localStorage.getItem(TOKEN_KEY); },
  set token(v) { if (v) localStorage.setItem(TOKEN_KEY, v); else localStorage.removeItem(TOKEN_KEY); },
};

export class ApiError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth.token) headers.Authorization = 'Bearer ' + auth.token;
  let res;
  try {
    res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, 'Sem conexão com o servidor');
  }
  let data = {};
  try { data = await res.json(); } catch { /* */ }
  if (!res.ok) {
    if (res.status === 401 && path !== '/api/auth/login') auth.token = null;
    throw new ApiError(res.status, data.error || 'Erro ' + res.status);
  }
  return data;
}

// WebSocket com reconexão automática
export class Live {
  constructor() {
    this.ws = null;
    this.handlers = new Map();
    this.queue = [];
    this.closed = false;
    this.clockOffset = 0;
    this.connected = false;
  }
  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(fn);
    return () => this.handlers.get(type).delete(fn);
  }
  emit(type, msg) { for (const fn of this.handlers.get(type) || []) fn(msg); }
  connect() {
    if (!auth.token || (this.ws && this.ws.readyState <= 1)) return;
    this.closed = false;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ t: 'auth', token: auth.token }));
    };
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === 'hello') {
        this.connected = true;
        for (const q of this.queue.splice(0)) ws.send(JSON.stringify(q));
        this.send({ t: 'ping' });
      }
      if (m.t === 'pong') this.clockOffset = m.now - Date.now();
      if (m.serverNow) this.clockOffset = m.serverNow - Date.now();
      this.emit(m.t, m);
      this.emit('*', m);
    };
    ws.onclose = () => {
      this.connected = false;
      this.emit('disconnect', {});
      if (!this.closed) setTimeout(() => this.connect(), 2500);
    };
  }
  send(msg) {
    if (this.ws && this.ws.readyState === 1 && this.connected) this.ws.send(JSON.stringify(msg));
    else { this.queue.push(msg); this.connect(); }
  }
  close() { this.closed = true; this.connected = false; if (this.ws) this.ws.close(); }
  serverNow() { return Date.now() + this.clockOffset; }
}
