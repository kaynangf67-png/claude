import type { SupabaseClient } from '@supabase/supabase-js';
import type { Article } from '../../content/articles';
import { AppError, type AccessInfo, type ClaimResult, type DataService, type JournalEntry, type JournalInput, type Period, type Profile, type RoutineCompletion } from '../types';
import { translateError } from './errors';

interface JournalRow {
  id: string; entry_date: string; notes: string; skin_feel: JournalEntry['skinFeel']; observations: string[];
  products_used: string; created_at: string; updated_at: string;
}
const toEntry = (r: JournalRow): JournalEntry => ({
  id: r.id, entryDate: r.entry_date, notes: r.notes, skinFeel: r.skin_feel, observations: r.observations,
  productsUsed: r.products_used, createdAt: r.created_at, updatedAt: r.updated_at,
});

export class SupabaseDataService implements DataService {
  constructor(private readonly db: SupabaseClient) {}

  private async uid() {
    const { data } = await this.db.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new AppError('Sua sessão expirou. Entre novamente.', 'session_expired');
    return id;
  }

  async getAccess(): Promise<AccessInfo> {
    const { data, error } = await this.db.rpc('get_my_access');
    if (error) throw translateError(error);
    const row = (data as { status: AccessInfo['status']; starts_at: string | null; expires_at: string | null; source: string | null }[])[0];
    return row ? { status: row.status, startsAt: row.starts_at, expiresAt: row.expires_at, source: row.source } : { status: 'none', startsAt: null, expiresAt: null, source: null };
  }

  async claimAccess(): Promise<ClaimResult> {
    const { data, error } = await this.db.rpc('claim_verified_purchase');
    if (error) throw translateError(error);
    return data as ClaimResult;
  }

  async getProfile(): Promise<Profile | null> {
    const { data, error } = await this.db.from('profiles').select('display_name, accepted_disclaimer_at, created_at').maybeSingle();
    if (error) throw translateError(error);
    return data ? { displayName: data.display_name, acceptedDisclaimerAt: data.accepted_disclaimer_at, createdAt: data.created_at } : null;
  }

  async updateDisplayName(name: string) {
    const id = await this.uid();
    const { error } = await this.db.from('profiles').update({ display_name: name.trim() }).eq('id', id);
    if (error) throw translateError(error);
  }

  async listCompletions(from: string, to: string): Promise<RoutineCompletion[]> {
    const { data, error } = await this.db
      .from('routine_completions')
      .select('completed_on, period, step_key')
      .gte('completed_on', from)
      .lte('completed_on', to);
    if (error) throw translateError(error);
    return (data ?? []).map((r) => ({ completedOn: r.completed_on, period: r.period, stepKey: r.step_key }));
  }

  async setCompletion(date: string, period: Period, stepKey: string, done: boolean) {
    if (done) {
      // upsert ignorando duplicata: marcar duas vezes não cria dois registros
      const { error } = await this.db
        .from('routine_completions')
        .upsert({ completed_on: date, period, step_key: stepKey }, { onConflict: 'user_id,completed_on,period,step_key', ignoreDuplicates: true });
      if (error) throw translateError(error);
    } else {
      const { data, error } = await this.db
        .from('routine_completions')
        .delete()
        .match({ completed_on: date, period, step_key: stepKey })
        .select('id');
      if (error) throw translateError(error);
      if (!data?.length) {
        const access = await this.getAccess();
        if (access.status !== 'active') throw new AppError('Seu acesso ao app não está ativo, então não foi possível salvar.', 'no_access');
      }
    }
  }

  async listJournal(): Promise<JournalEntry[]> {
    const { data, error } = await this.db.from('journal_entries').select('*').order('entry_date', { ascending: false });
    if (error) throw translateError(error);
    return (data as JournalRow[]).map(toEntry);
  }

  async saveJournal(input: JournalInput, id?: string): Promise<JournalEntry> {
    const row = {
      entry_date: input.entryDate,
      notes: input.notes.trim(),
      skin_feel: input.skinFeel,
      observations: input.observations,
      products_used: input.productsUsed.trim(),
    };
    const query = id ? this.db.from('journal_entries').update(row).eq('id', id) : this.db.from('journal_entries').insert(row);
    const { data, error } = await query.select('*').maybeSingle();
    if (error) throw translateError(error);
    if (!data) throw new AppError('Seu acesso ao app não está ativo, então não foi possível salvar.', 'no_access');
    return toEntry(data as JournalRow);
  }

  async deleteJournal(id: string) {
    const { error } = await this.db.from('journal_entries').delete().eq('id', id);
    if (error) throw translateError(error);
  }

  async listArticles(): Promise<Article[]> {
    const { data, error } = await this.db
      .from('educational_articles')
      .select('slug, category, title, summary, reading_minutes, body, sources')
      .order('sort_order');
    if (error) throw translateError(error);
    return (data ?? []).map((r) => ({
      slug: r.slug, category: r.category, title: r.title, summary: r.summary, minutes: r.reading_minutes, sections: r.body, sources: r.sources,
    }));
  }

  async exportData(email: string) {
    const [profile, access, routine, journal] = await Promise.all([
      this.getProfile(),
      this.getAccess(),
      this.listCompletions('1900-01-01', '9999-12-31'),
      this.listJournal(),
    ]);
    return { exportedAt: new Date().toISOString(), account: { email }, profile, access, routine, journal };
  }

  async deleteMyData() {
    const { error } = await this.db.rpc('delete_my_data');
    if (error) throw translateError(error);
  }

  async deleteAccount() {
    const { error } = await this.db.functions.invoke('delete-account', { method: 'POST' });
    if (error) throw new AppError('Não foi possível excluir a conta agora. Tente de novo ou fale com o suporte.', 'delete_failed');
    await this.db.auth.signOut();
  }
}
