import { randomBytes, scrypt as _scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(_scrypt);

export const SESSION_DAYS = 30;

export async function hashPassword(pw) {
  const salt = randomBytes(16);
  const h = await scrypt(pw, salt, 64);
  return ['scrypt', salt.toString('base64'), h.toString('base64')].join('$');
}

export async function verifyPassword(pw, stored) {
  const [alg, s, h] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(h, 'base64');
  const got = await scrypt(pw, Buffer.from(s, 'base64'), expected.length);
  return timingSafeEqual(expected, got);
}

export const sha256 = (s) => createHash('sha256').update(s).digest('hex');
export const newId = (n = 12) => randomBytes(n).toString('base64url');

export async function createSession(db, userId) {
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  await db.run('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES ($1,$2,$3,$4)',
    [sha256(token), userId, now, now + SESSION_DAYS * 86400000]);
  return token;
}

export async function userFromToken(db, token) {
  if (!token || typeof token !== 'string' || token.length > 100) return null;
  const s = await db.get('SELECT user_id, expires_at FROM sessions WHERE token_hash = $1', [sha256(token)]);
  if (!s || s.expires_at < Date.now()) return null;
  const u = await db.get('SELECT * FROM users WHERE id = $1', [s.user_id]);
  if (!u || u.banned) return null;
  return u;
}

export async function deleteSession(db, token) {
  await db.run('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
}

export const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;
const BLOCKED = ['admin', 'moderador', 'pixelrush', 'sistema', 'root'];
export function validUsername(u) {
  return typeof u === 'string' && USERNAME_RE.test(u) && !BLOCKED.includes(u.toLowerCase());
}

// Limitador simples (janela deslizante por chave)
export class RateLimiter {
  constructor(limit, windowMs) { this.limit = limit; this.windowMs = windowMs; this.m = new Map(); }
  hit(key) {
    const now = Date.now();
    let a = this.m.get(key);
    if (!a) { a = []; this.m.set(key, a); }
    while (a.length && a[0] <= now - this.windowMs) a.shift();
    if (a.length >= this.limit) return false;
    a.push(now);
    if (this.m.size > 50000) this.m.clear();
    return true;
  }
}
