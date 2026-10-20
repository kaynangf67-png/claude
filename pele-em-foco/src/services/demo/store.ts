// Armazenamento do MODO DEMONSTRAÇÃO. Tudo fica no localStorage deste navegador.
// Não é segurança real: qualquer pessoa com acesso ao aparelho pode ler ou alterar.
import type { JournalEntry, RoutineCompletion } from '../types';

export const DEMO_KEY = 'pele-em-foco:demo:v1';

export interface DemoUser {
  id: string;
  email: string;
  salt: string;
  hash: string;
  displayName: string;
  acceptedDisclaimerAt: string | null;
  createdAt: string;
}

export interface DemoAccess {
  status: 'active' | 'revoked';
  startsAt: string;
  expiresAt: string;
}

export interface DemoDb {
  users: DemoUser[];
  sessionUserId: string | null;
  access: Record<string, DemoAccess>;
  completions: Record<string, RoutineCompletion[]>;
  journal: Record<string, JournalEntry[]>;
}

type KV = Pick<Storage, 'getItem' | 'setItem'>;

/** localStorage quando disponível; senão, memória (dados somem ao fechar a página). */
export function safeStorage(): KV {
  try {
    const s = window.localStorage;
    s.getItem(DEMO_KEY);
    return s;
  } catch {
    const map = new Map<string, string>();
    return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
  }
}

const empty = (): DemoDb => ({ users: [], sessionUserId: null, access: {}, completions: {}, journal: {} });

export class DemoStore {
  constructor(private readonly storage: KV) {}

  read(): DemoDb {
    try {
      const raw = this.storage.getItem(DEMO_KEY);
      return raw ? { ...empty(), ...(JSON.parse(raw) as Partial<DemoDb>) } : empty();
    } catch {
      return empty();
    }
  }

  write(db: DemoDb) {
    try {
      this.storage.setItem(DEMO_KEY, JSON.stringify(db));
    } catch {
      /* armazenamento bloqueado (janela privada etc.): os dados valem só nesta sessão */
    }
  }

  update<T>(fn: (db: DemoDb) => T): T {
    const db = this.read();
    const result = fn(db);
    this.write(db);
    return result;
  }
}

const toHex = (buf: ArrayBuffer | Uint8Array) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export function randomSalt(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(16)));
}

/** PBKDF2-SHA256, 210 mil iterações. A senha nunca é guardada em texto. */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 210_000 },
    key,
    256,
  );
  return toHex(bits);
}
