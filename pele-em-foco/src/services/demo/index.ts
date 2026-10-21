// MODO DEMONSTRAÇÃO — autenticação e dados locais, sem servidor e sem segurança real.
// Existe para desenvolver e demonstrar o app sem credenciais do Supabase.
// Reproduz as regras do banco (acesso ativo para gravar, acesso vitalício, isolamento por usuário)
// para que o comportamento da interface seja o mesmo da produção.
import { ARTICLES } from '../../content/articles';
import {
  AppError,
  type AccessInfo, type AuthService, type AuthUser, type ClaimResult, type DataService, type DemoControls,
  type JournalEntry, type JournalInput, type Period, type Profile, type SignUpInput,
} from '../types';
import { DEMO_KEY, DemoStore, hashPassword, randomSalt, safeStorage, type DemoDb } from './store';

const DAY = 86_400_000;
const NO_ACCESS = new AppError('Seu acesso ao app não está ativo, então não foi possível salvar.', 'no_access');
const uuid = () => crypto.randomUUID();

function accessOf(db: DemoDb, uid: string, now = Date.now()): AccessInfo {
  const a = db.access[uid];
  if (!a) return { status: 'none', startsAt: null, expiresAt: null, source: null };
  const status = a.status === 'revoked' ? 'revoked' : a.expiresAt !== 'infinity' && now >= Date.parse(a.expiresAt) ? 'expired' : 'active';
  return { status, startsAt: a.startsAt, expiresAt: a.expiresAt === 'infinity' ? null : a.expiresAt, source: 'demo' };
}

export class DemoBackend implements AuthService, DataService, DemoControls {
  readonly kind = 'demo' as const;
  private listeners = new Set<(u: AuthUser | null, event?: string) => void>();

  constructor(private readonly store = new DemoStore(safeStorage())) {
    // Mantém abas sincronizadas (entrar/sair em outra aba).
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === DEMO_KEY) void this.getUser().then((u) => this.emit(u));
      });
    }
  }

  private emit(user: AuthUser | null, event?: string) {
    for (const l of this.listeners) l(user, event);
  }

  private uid(): string {
    const id = this.store.read().sessionUserId;
    if (!id) throw new AppError('Sua sessão expirou. Entre novamente.', 'session_expired');
    return id;
  }

  private requireActive(db: DemoDb, uid: string) {
    if (accessOf(db, uid).status !== 'active') throw NO_ACCESS;
  }

  // ---------- Auth ----------
  async getUser(): Promise<AuthUser | null> {
    const db = this.store.read();
    const u = db.users.find((x) => x.id === db.sessionUserId);
    return u ? { id: u.id, email: u.email, emailConfirmed: true } : null;
  }

  onChange(cb: (user: AuthUser | null, event?: string) => void) {
    this.listeners.add(cb);
    return () => void this.listeners.delete(cb);
  }

  async signUp({ email, password, displayName, acceptedDisclaimer }: SignUpInput) {
    const normalized = email.trim().toLowerCase();
    if (this.store.read().users.some((u) => u.email === normalized)) {
      throw new AppError('Já existe uma conta com este e-mail. Tente entrar ou recuperar a senha.', 'user_exists');
    }
    const salt = randomSalt();
    const hash = await hashPassword(password, salt);
    const user = this.store.update((db) => {
      const u = { id: uuid(), email: normalized, salt, hash, displayName: displayName.trim(), acceptedDisclaimerAt: acceptedDisclaimer ? new Date().toISOString() : null, createdAt: new Date().toISOString() };
      db.users.push(u);
      db.sessionUserId = u.id;
      return u;
    });
    this.emit({ id: user.id, email: user.email, emailConfirmed: true }, 'SIGNED_IN');
    return { needsConfirmation: false };
  }

  async signIn(email: string, password: string) {
    const normalized = email.trim().toLowerCase();
    const u = this.store.read().users.find((x) => x.email === normalized);
    // Mesmo tempo de resposta e mesma mensagem para e-mail inexistente ou senha errada.
    const hash = await hashPassword(password, u?.salt ?? 'sem-conta');
    if (!u || hash !== u.hash) throw new AppError('E-mail ou senha incorretos.', 'invalid_credentials');
    this.store.update((db) => void (db.sessionUserId = u.id));
    const user = { id: u.id, email: u.email, emailConfirmed: true };
    this.emit(user, 'SIGNED_IN');
    return user;
  }

  async signOut() {
    this.store.update((db) => void (db.sessionUserId = null));
    this.emit(null, 'SIGNED_OUT');
  }

  async sendPasswordReset() {
    // Sem servidor de e-mail no modo demonstração.
    throw new AppError('No modo demonstração não há envio de e-mail. Crie outra conta de teste ou apague os dados do navegador.', 'demo_no_email');
  }

  async updatePassword(newPassword: string) {
    const id = this.uid();
    const salt = randomSalt();
    const hash = await hashPassword(newPassword, salt);
    this.store.update((db) => {
      const u = db.users.find((x) => x.id === id);
      if (u) Object.assign(u, { salt, hash });
    });
  }

  // ---------- Acesso ----------
  async getAccess() {
    return accessOf(this.store.read(), this.uid());
  }

  async claimAccess(): Promise<ClaimResult> {
    // Não há compras verificadas no modo demo: o acesso vem só dos controles de demonstração.
    return (await this.getAccess()).status === 'active' ? 'already_active' : 'no_purchase';
  }

  async grantDemoAccess() {
    const id = this.uid();
    const now = Date.now();
    this.store.update((db) => {
      db.access[id] = { status: 'active', startsAt: new Date(now).toISOString(), expiresAt: 'infinity' };
    });
  }

  async expireDemoAccess() {
    const id = this.uid();
    const now = Date.now();
    this.store.update((db) => {
      db.access[id] = { status: 'active', startsAt: new Date(now - 31 * DAY).toISOString(), expiresAt: new Date(now - DAY).toISOString() };
    });
  }

  async removeDemoAccess() {
    const id = this.uid();
    this.store.update((db) => void delete db.access[id]);
  }

  // ---------- Perfil ----------
  async getProfile(): Promise<Profile | null> {
    const db = this.store.read();
    const u = db.users.find((x) => x.id === db.sessionUserId);
    return u ? { displayName: u.displayName, acceptedDisclaimerAt: u.acceptedDisclaimerAt, createdAt: u.createdAt } : null;
  }

  async updateDisplayName(name: string) {
    const id = this.uid();
    this.store.update((db) => {
      const u = db.users.find((x) => x.id === id);
      if (u) u.displayName = name.trim();
    });
  }

  // ---------- Rotina ----------
  async listCompletions(from: string, to: string) {
    const id = this.uid();
    return (this.store.read().completions[id] ?? []).filter((c) => c.completedOn >= from && c.completedOn <= to);
  }

  async setCompletion(date: string, period: Period, stepKey: string, done: boolean) {
    const id = this.uid();
    this.store.update((db) => {
      this.requireActive(db, id);
      const list = (db.completions[id] ??= []);
      const i = list.findIndex((c) => c.completedOn === date && c.period === period && c.stepKey === stepKey);
      if (done && i < 0) list.push({ completedOn: date, period, stepKey });
      if (!done && i >= 0) list.splice(i, 1);
    });
  }

  // ---------- Diário ----------
  async listJournal() {
    const id = this.uid();
    return [...(this.store.read().journal[id] ?? [])].sort((a, b) => (a.entryDate < b.entryDate ? 1 : -1));
  }

  async saveJournal(input: JournalInput, entryId?: string) {
    const id = this.uid();
    return this.store.update((db) => {
      this.requireActive(db, id);
      const list = (db.journal[id] ??= []);
      if (list.some((e) => e.entryDate === input.entryDate && e.id !== entryId)) {
        throw new AppError('Já existe um registro para esta data.', 'duplicate');
      }
      const now = new Date().toISOString();
      const clean = { ...input, notes: input.notes.trim(), productsUsed: input.productsUsed.trim() };
      if (entryId) {
        const e = list.find((x) => x.id === entryId);
        if (!e) throw new AppError('Registro não encontrado.', 'not_found');
        Object.assign(e, clean, { updatedAt: now });
        return { ...e };
      }
      const entry: JournalEntry = { ...clean, id: uuid(), createdAt: now, updatedAt: now };
      list.push(entry);
      return entry;
    });
  }

  async deleteJournal(entryId: string) {
    const id = this.uid();
    this.store.update((db) => {
      db.journal[id] = (db.journal[id] ?? []).filter((e) => e.id !== entryId);
    });
  }

  // ---------- Biblioteca ----------
  async listArticles() {
    if (accessOf(this.store.read(), this.uid()).status !== 'active') return [];
    return ARTICLES;
  }

  // ---------- Dados ----------
  async exportData(email: string) {
    const id = this.uid();
    const db = this.store.read();
    return {
      exportedAt: new Date().toISOString(),
      account: { email },
      profile: await this.getProfile(),
      access: accessOf(db, id),
      routine: db.completions[id] ?? [],
      journal: db.journal[id] ?? [],
    };
  }

  async deleteMyData() {
    const id = this.uid();
    this.store.update((db) => {
      delete db.completions[id];
      delete db.journal[id];
    });
  }

  async deleteAccount() {
    const id = this.uid();
    this.store.update((db) => {
      db.users = db.users.filter((u) => u.id !== id);
      delete db.access[id];
      delete db.completions[id];
      delete db.journal[id];
      db.sessionUserId = null;
    });
    this.emit(null, 'SIGNED_OUT');
  }
}
