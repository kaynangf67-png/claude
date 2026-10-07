import { uuid } from '@/lib/utils';
import { applyFilters, type DataRepository, type Insert, type ListOptions, type Row, type TableName, type Update } from './types';

type DB = { [K in TableName]?: Row<K>[] };

/**
 * Repositório local (modo demonstração). Persiste em localStorage, um banco por usuário.
 * Mantém a mesma semântica do Supabase: id/created_at/updated_at gerados aqui.
 */
export class DemoRepository implements DataRepository {
  readonly kind = 'demo' as const;
  private cache: DB | null = null;

  constructor(private readonly userId: string, private readonly storage: Storage = localStorage) {}

  private get key() {
    return `liveflow:db:${this.userId}`;
  }

  private load(): DB {
    if (this.cache) return this.cache;
    try {
      this.cache = JSON.parse(this.storage.getItem(this.key) ?? '{}') as DB;
    } catch {
      this.cache = {};
    }
    return this.cache;
  }

  private save() {
    try {
      this.storage.setItem(this.key, JSON.stringify(this.cache ?? {}));
    } catch (err) {
      throw new Error('Armazenamento local cheio. Remova dados antigos ou configure o Supabase.', { cause: err });
    }
  }

  private table<T extends TableName>(name: T): Row<T>[] {
    const db = this.load();
    return ((db[name] as Row<T>[] | undefined) ??= [] as Row<T>[]);
  }

  async list<T extends TableName>(table: T, opts?: ListOptions<T>): Promise<Row<T>[]> {
    return applyFilters(this.table(table), opts).map((r) => ({ ...r }));
  }

  async get<T extends TableName>(table: T, id: string): Promise<Row<T> | null> {
    const row = this.table(table).find((r) => r.id === id);
    return row ? { ...row } : null;
  }

  async insert<T extends TableName>(table: T, values: Insert<T>): Promise<Row<T>> {
    const [row] = await this.insertMany(table, [values]);
    return row;
  }

  async insertMany<T extends TableName>(table: T, values: Insert<T>[]): Promise<Row<T>[]> {
    const now = new Date().toISOString();
    const rows = values.map(
      (v) => ({ created_at: now, ...v, id: v.id ?? uuid(), user_id: this.userId, updated_at: now }) as unknown as Row<T>,
    );
    this.table(table).push(...rows);
    this.save();
    return rows.map((r) => ({ ...r }));
  }

  async update<T extends TableName>(table: T, id: string, patch: Update<T>): Promise<Row<T>> {
    const rows = this.table(table);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx < 0) throw new Error('Registro não encontrado');
    rows[idx] = { ...rows[idx], ...patch, updated_at: new Date().toISOString() };
    this.save();
    return { ...rows[idx] };
  }

  async remove<T extends TableName>(table: T, id: string): Promise<void> {
    const db = this.load();
    db[table] = this.table(table).filter((r) => r.id !== id) as never;
    this.save();
  }

  async removeWhere<T extends TableName>(table: T, opts: Pick<ListOptions<T>, 'eq' | 'in' | 'gte' | 'lte'>): Promise<void> {
    const doomed = new Set(applyFilters(this.table(table), opts).map((r) => r.id));
    const db = this.load();
    db[table] = this.table(table).filter((r) => !doomed.has(r.id)) as never;
    this.save();
  }

  async count<T extends TableName>(table: T, opts?: Pick<ListOptions<T>, 'eq' | 'gte' | 'lte'>): Promise<number> {
    return applyFilters(this.table(table), opts).length;
  }

  /** Apaga todos os dados do usuário (usado ao trocar para dados de demonstração). */
  reset() {
    this.cache = {};
    this.save();
  }
}
