import type {
  AIGeneration,
  AnalyticsRow,
  AppNotification,
  Automation,
  BaseRecord,
  Integration,
  Live,
  LiveSchedule,
  Post,
  Product,
  Profile,
  Video,
} from '@/types/domain';

export interface TableMap {
  profiles: Profile;
  products: Product;
  videos: Video;
  lives: Live;
  live_schedules: LiveSchedule;
  automations: Automation;
  analytics: AnalyticsRow;
  notifications: AppNotification;
  ai_generations: AIGeneration;
  integrations: Integration;
  posts: Post;
}

export type TableName = keyof TableMap;
export type Row<T extends TableName> = TableMap[T];
export type Insert<T extends TableName> = Omit<Row<T>, keyof BaseRecord> & { id?: string; created_at?: string };
export type Update<T extends TableName> = Partial<Omit<Row<T>, keyof BaseRecord>>;

export interface ListOptions<T extends TableName> {
  eq?: Partial<Record<keyof Row<T>, string | number | boolean | null>>;
  in?: { column: keyof Row<T>; values: string[] };
  gte?: Partial<Record<keyof Row<T>, string | number>>;
  lte?: Partial<Record<keyof Row<T>, string | number>>;
  orderBy?: { column: keyof Row<T>; ascending?: boolean };
  limit?: number;
}

/**
 * Persistência pura (CRUD + arquivos), sem regra de negócio.
 * Toda operação é automaticamente escopada ao usuário logado.
 */
export interface DataRepository {
  readonly kind: 'demo' | 'supabase';
  list<T extends TableName>(table: T, opts?: ListOptions<T>): Promise<Row<T>[]>;
  get<T extends TableName>(table: T, id: string): Promise<Row<T> | null>;
  insert<T extends TableName>(table: T, values: Insert<T>): Promise<Row<T>>;
  insertMany<T extends TableName>(table: T, values: Insert<T>[]): Promise<Row<T>[]>;
  update<T extends TableName>(table: T, id: string, patch: Update<T>): Promise<Row<T>>;
  remove<T extends TableName>(table: T, id: string): Promise<void>;
  removeWhere<T extends TableName>(table: T, opts: Pick<ListOptions<T>, 'eq' | 'in' | 'gte'>): Promise<void>;
  count<T extends TableName>(table: T, opts?: Pick<ListOptions<T>, 'eq' | 'gte' | 'lte'>): Promise<number>;
}

export type Bucket = 'avatars' | 'product-images' | 'video-files' | 'thumbnails';

export interface FileStorage {
  /** Envia o arquivo e devolve o caminho (sempre prefixado pelo user_id). */
  upload(bucket: Bucket, file: Blob, opts: { name: string; onProgress?: (pct: number) => void }): Promise<string>;
  /** URL exibível. Buckets privados recebem URL assinada temporária. */
  resolveUrl(bucket: Bucket, path: string): Promise<string | null>;
  remove(bucket: Bucket, path: string): Promise<void>;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
}

export interface AuthService {
  readonly kind: 'demo' | 'supabase';
  getUser(): Promise<AuthUser | null>;
  onChange(cb: (user: AuthUser | null) => void): () => void;
  signIn(email: string, password: string): Promise<AuthUser>;
  signUp(email: string, password: string, fullName: string): Promise<{ user: AuthUser | null; needsConfirmation: boolean }>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  updatePassword(newPassword: string): Promise<void>;
}

export function applyFilters<T extends TableName>(rows: Row<T>[], opts: ListOptions<T> = {}): Row<T>[] {
  let out = rows;
  const get = (r: Row<T>, k: string) => (r as unknown as Record<string, unknown>)[k];
  if (opts.eq) {
    for (const [k, v] of Object.entries(opts.eq)) out = out.filter((r) => get(r, k) === v);
  }
  if (opts.in) {
    const set = new Set(opts.in.values);
    const col = opts.in.column as string;
    out = out.filter((r) => set.has(get(r, col) as string));
  }
  if (opts.gte) {
    for (const [k, v] of Object.entries(opts.gte)) out = out.filter((r) => (get(r, k) as string | number) >= (v as string | number));
  }
  if (opts.lte) {
    for (const [k, v] of Object.entries(opts.lte)) out = out.filter((r) => (get(r, k) as string | number) <= (v as string | number));
  }
  if (opts.orderBy) {
    const col = opts.orderBy.column as string;
    const dir = opts.orderBy.ascending === false ? -1 : 1;
    out = [...out].sort((a, b) => {
      const x = get(a, col) as string | number;
      const y = get(b, col) as string | number;
      return x < y ? -dir : x > y ? dir : 0;
    });
  }
  if (opts.limit != null) out = out.slice(0, opts.limit);
  return out;
}
