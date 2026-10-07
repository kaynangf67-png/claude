import type { SupabaseClient } from '@supabase/supabase-js';
import { PlanLimitError, type LimitKey } from '@/services/plans';
import type { DataRepository, Insert, ListOptions, Row, TableName, Update } from './types';

const LIMIT_KEYS: Partial<Record<TableName, LimitKey>> = {
  products: 'products',
  videos: 'videos',
  lives: 'livesPerMonth',
  ai_generations: 'aiGenerationsPerMonth',
};

function raise(table: TableName, error: { message: string; code?: string }): never {
  // O trigger enforce_plan_limit sinaliza com a mensagem PLAN_LIMIT.
  if (error.message.startsWith('PLAN_LIMIT') && LIMIT_KEYS[table]) throw new PlanLimitError(LIMIT_KEYS[table]!, 0);
  throw new Error(error.message);
}

type Query = {
  eq(c: string, v: unknown): Query;
  in(c: string, v: unknown[]): Query;
  gte(c: string, v: unknown): Query;
  lte(c: string, v: unknown): Query;
  is(c: string, v: null): Query;
};

function filtered<Q>(q: Q, opts: Pick<ListOptions<TableName>, 'eq' | 'in' | 'gte' | 'lte'> = {}): Q {
  let query = q as unknown as Query;
  for (const [k, v] of Object.entries(opts.eq ?? {})) query = v === null ? query.is(k, null) : query.eq(k, v);
  if (opts.in) query = query.in(opts.in.column as string, opts.in.values);
  for (const [k, v] of Object.entries(opts.gte ?? {})) query = query.gte(k, v);
  for (const [k, v] of Object.entries(opts.lte ?? {})) query = query.lte(k, v);
  return query as unknown as Q;
}

/**
 * Repositório Supabase. O filtro por user_id é explícito por clareza/performance,
 * mas quem garante o isolamento é o RLS no Postgres.
 */
export class SupabaseRepository implements DataRepository {
  readonly kind = 'supabase' as const;

  constructor(private readonly db: SupabaseClient, private readonly userId: string) {}

  async list<T extends TableName>(table: T, opts: ListOptions<T> = {}): Promise<Row<T>[]> {
    let q = filtered(this.db.from(table).select('*').eq('user_id', this.userId), opts as ListOptions<TableName>);
    if (opts.orderBy) q = q.order(opts.orderBy.column as string, { ascending: opts.orderBy.ascending !== false });
    if (opts.limit != null) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) raise(table, error);
    return (data ?? []) as Row<T>[];
  }

  async get<T extends TableName>(table: T, id: string): Promise<Row<T> | null> {
    const { data, error } = await this.db.from(table).select('*').eq('id', id).maybeSingle();
    if (error) raise(table, error);
    return data as Row<T> | null;
  }

  async insert<T extends TableName>(table: T, values: Insert<T>): Promise<Row<T>> {
    const { data, error } = await this.db.from(table).insert({ ...values, user_id: this.userId }).select('*').single();
    if (error) raise(table, error);
    return data as Row<T>;
  }

  async insertMany<T extends TableName>(table: T, values: Insert<T>[]): Promise<Row<T>[]> {
    if (values.length === 0) return [];
    const out: Row<T>[] = [];
    // lotes para não estourar o tamanho de requisição do PostgREST
    for (let i = 0; i < values.length; i += 500) {
      const chunk = values.slice(i, i + 500).map((v) => ({ ...v, user_id: this.userId }));
      const { data, error } = await this.db.from(table).insert(chunk).select('*');
      if (error) raise(table, error);
      out.push(...((data ?? []) as Row<T>[]));
    }
    return out;
  }

  async update<T extends TableName>(table: T, id: string, patch: Update<T>): Promise<Row<T>> {
    const { data, error } = await this.db.from(table).update(patch as Record<string, unknown>).eq('id', id).select('*').single();
    if (error) raise(table, error);
    return data as Row<T>;
  }

  async remove<T extends TableName>(table: T, id: string): Promise<void> {
    const { error } = await this.db.from(table).delete().eq('id', id);
    if (error) raise(table, error);
  }

  async removeWhere<T extends TableName>(table: T, opts: Pick<ListOptions<T>, 'eq' | 'in' | 'gte'>): Promise<void> {
    const q = filtered(this.db.from(table).delete().eq('user_id', this.userId), opts as ListOptions<TableName>);
    const { error } = await q;
    if (error) raise(table, error);
  }

  async count<T extends TableName>(table: T, opts: Pick<ListOptions<T>, 'eq' | 'gte' | 'lte'> = {}): Promise<number> {
    const q = filtered(
      this.db.from(table).select('id', { count: 'exact', head: true }).eq('user_id', this.userId),
      opts as ListOptions<TableName>,
    );
    const { count, error } = await q;
    if (error) raise(table, error);
    return count ?? 0;
  }
}
