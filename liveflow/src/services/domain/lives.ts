import { addDays, format } from 'date-fns';
import { liveSchema, type LiveInput } from '@/lib/validation';
import { stripBase } from '@/lib/utils';
import { checkLimit, PlanLimitError } from '@/services/plans';
import { combineDateTime, expandRecurrence, nextOccurrence } from '@/services/recurrence';
import type { Insert } from '@/services/data/types';
import type { Automation, Live, LiveSchedule, LiveStatus, PlanTier } from '@/types/domain';
import { notify, type ServiceContext } from './context';

/** Quantos dias à frente as automações materializam ocorrências. */
export const GENERATION_HORIZON_DAYS = 30;
const MAX_OCCURRENCES_PER_RUN = 60;

const TERMINAL: LiveStatus[] = ['finished', 'cancelled', 'error'];

export function livesService(ctx: ServiceContext) {
  const { repo, tiktok } = ctx;

  /** Mesma regra do trigger enforce_plan_limit: limite por mês-calendário de início. */
  async function ensureCapacity(plan: PlanTier, dates: Date[]) {
    const { limit } = checkLimit(plan, 'livesPerMonth', 0);
    if (limit == null || dates.length === 0) return;
    const adding = new Map<string, number>();
    for (const d of dates) adding.set(format(d, 'yyyy-MM'), (adding.get(format(d, 'yyyy-MM')) ?? 0) + 1);
    for (const [month, n] of adding) {
      const start = new Date(`${month}-01T00:00:00`);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      const existing = await repo.count('lives', { gte: { starts_at: start.toISOString() }, lte: { starts_at: new Date(end.getTime() - 1).toISOString() } });
      if (existing + n > limit) throw new PlanLimitError('livesPerMonth', limit);
    }
  }

  async function bumpVideoUsage(videoId: string | null, by: number) {
    if (!videoId || by === 0) return;
    const video = await repo.get('videos', videoId);
    if (!video) return;
    await repo.update('videos', videoId, {
      usage_count: Math.max(0, video.usage_count + by),
      status: video.status === 'available' ? 'scheduled' : video.status,
    });
  }

  /** Cria as ocorrências de uma agenda a partir de `from` até o horizonte. */
  async function materialize(schedule: LiveSchedule, from: Date): Promise<Live[]> {
    const until = addDays(new Date(), GENERATION_HORIZON_DAYS);
    const dates = expandRecurrence(schedule.recurrence, { from, until, limit: MAX_OCCURRENCES_PER_RUN });
    const existing = new Set(
      (await repo.list('lives', { eq: { schedule_id: schedule.id } })).map((l) => new Date(l.starts_at).getTime()),
    );
    const rows: Insert<'lives'>[] = dates
      .filter((d) => !existing.has(d.getTime()))
      .map((d) => ({
        video_id: schedule.video_id,
        product_id: schedule.product_id,
        schedule_id: schedule.id,
        title: schedule.title,
        description: schedule.description,
        starts_at: d.toISOString(),
        duration_minutes: schedule.duration_minutes,
        status: 'scheduled',
        external_id: null,
        error_message: null,
      }));
    const created = await repo.insertMany('lives', rows);
    await repo.update('live_schedules', schedule.id, { generated_until: format(until, 'yyyy-MM-dd') });
    await bumpVideoUsage(schedule.video_id, created.length);
    return created;
  }

  async function refreshAutomation(automation: Automation, schedule: LiveSchedule) {
    const next = automation.is_active ? nextOccurrence(schedule.recurrence) : null;
    return repo.update('automations', automation.id, { next_run_at: next?.toISOString() ?? null });
  }

  return {
    list: () => repo.list('lives', { orderBy: { column: 'starts_at', ascending: true } }),
    get: (id: string) => repo.get('lives', id),
    listSchedules: () => repo.list('live_schedules'),
    listAutomations: () => repo.list('automations', { orderBy: { column: 'created_at', ascending: false } }),

    /**
     * Fluxo do assistente: cria uma live única ou uma agenda recorrente
     * (agenda + automação + ocorrências).
     */
    async create(input: LiveInput, opts: { plan: PlanTier; asDraft?: boolean }): Promise<{ lives: Live[]; automation: Automation | null }> {
      const data = liveSchema.parse(input);
      const r = data.recurrence;

      if (r.frequency === 'none') {
        const startsAt = combineDateTime(r.startDate, r.time);
        await ensureCapacity(opts.plan, [startsAt]);
        const status: LiveStatus = opts.asDraft ? 'draft' : 'scheduled';
        let externalId: string | null = null;
        if (!opts.asDraft) {
          externalId = (
            await tiktok.scheduleLive({
              title: data.title,
              description: data.description,
              startsAt: startsAt.toISOString(),
              durationMinutes: data.duration_minutes,
              productExternalIds: [],
            })
          ).externalId;
        }
        const live = await repo.insert('lives', {
          video_id: data.video_id,
          product_id: data.product_id,
          schedule_id: null,
          title: data.title,
          description: data.description,
          starts_at: startsAt.toISOString(),
          duration_minutes: data.duration_minutes,
          status,
          external_id: externalId,
          error_message: null,
        });
        if (!opts.asDraft) await bumpVideoUsage(data.video_id, 1);
        await notify(
          ctx,
          opts.asDraft ? 'live_created' : 'live_scheduled',
          opts.asDraft ? 'Live criada como rascunho' : 'Live programada',
          live.title,
          { type: 'live', id: live.id },
        );
        return { lives: [live], automation: null };
      }

      const preview = expandRecurrence(r, { from: new Date(), until: addDays(new Date(), GENERATION_HORIZON_DAYS), limit: MAX_OCCURRENCES_PER_RUN });
      await ensureCapacity(opts.plan, preview);

      const schedule = await repo.insert('live_schedules', {
        video_id: data.video_id,
        product_id: data.product_id,
        title: data.title,
        description: data.description,
        duration_minutes: data.duration_minutes,
        recurrence: { ...r, endDate: r.endDate ?? null },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        generated_until: null,
      });
      const automation = await repo.insert('automations', {
        schedule_id: schedule.id,
        name: data.title,
        is_active: true,
        next_run_at: null,
        last_run_at: null,
      });
      const lives = await materialize(schedule, new Date());
      const refreshed = await refreshAutomation(automation, schedule);
      await notify(ctx, 'automation_created', 'Automação criada', `${data.title} · ${lives.length} lives programadas`, {
        type: 'automation',
        id: automation.id,
      });
      return { lives, automation: refreshed };
    },

    async reschedule(id: string, startsAt: Date, durationMinutes?: number) {
      const live = await repo.get('lives', id);
      if (!live) throw new Error('Live não encontrada');
      if (TERMINAL.includes(live.status)) throw new Error('Esta live já foi encerrada.');
      return repo.update('lives', id, {
        starts_at: startsAt.toISOString(),
        duration_minutes: durationMinutes ?? live.duration_minutes,
        status: live.status === 'draft' ? 'draft' : 'scheduled',
      });
    },

    async update(id: string, patch: Partial<Pick<Live, 'title' | 'description' | 'video_id' | 'product_id' | 'duration_minutes'>>) {
      return repo.update('lives', id, patch);
    },

    async publishDraft(id: string) {
      const live = await repo.get('lives', id);
      if (!live || live.status !== 'draft') throw new Error('Apenas rascunhos podem ser programados.');
      if (new Date(live.starts_at) < new Date()) throw new Error('Ajuste a data: o horário já passou.');
      await bumpVideoUsage(live.video_id, 1);
      await notify(ctx, 'live_scheduled', 'Live programada', live.title, { type: 'live', id });
      return repo.update('lives', id, { status: 'scheduled' });
    },

    async duplicate(id: string, plan: PlanTier, startsAt?: Date) {
      const live = await repo.get('lives', id);
      if (!live) throw new Error('Live não encontrada');
      const when = startsAt ?? addDays(new Date(Math.max(Date.now(), new Date(live.starts_at).getTime())), 1);
      await ensureCapacity(plan, [when]);
      const copy = await repo.insert('lives', {
        ...stripBase(live),
        schedule_id: null,
        starts_at: when.toISOString(),
        status: 'draft',
        external_id: null,
        error_message: null,
      });
      await notify(ctx, 'live_created', 'Live duplicada', copy.title, { type: 'live', id: copy.id });
      return copy;
    },

    async cancel(id: string) {
      const live = await repo.get('lives', id);
      if (!live) throw new Error('Live não encontrada');
      if (TERMINAL.includes(live.status)) return live;
      await notify(ctx, 'live_cancelled', 'Live cancelada', live.title, { type: 'live', id });
      return repo.update('lives', id, { status: 'cancelled' });
    },

    async remove(id: string) {
      await repo.remove('lives', id);
    },

    async setAutomationActive(automationId: string, active: boolean) {
      const automation = await repo.get('automations', automationId);
      if (!automation) throw new Error('Automação não encontrada');
      const schedule = await repo.get('live_schedules', automation.schedule_id);
      if (!schedule) throw new Error('Agenda não encontrada');
      const now = new Date();
      if (!active) {
        // Pausar = cancelar ocorrências futuras ainda não iniciadas.
        const future = await repo.list('lives', { eq: { schedule_id: schedule.id, status: 'scheduled' }, gte: { starts_at: now.toISOString() } });
        for (const l of future) await repo.update('lives', l.id, { status: 'cancelled' });
        await bumpVideoUsage(schedule.video_id, -future.length);
      }
      const updated = await repo.update('automations', automationId, { is_active: active });
      if (active) await materialize(schedule, now);
      return refreshAutomation(updated, schedule);
    },

    async removeAutomation(automationId: string) {
      const automation = await repo.get('automations', automationId);
      if (!automation) return;
      await repo.removeWhere('lives', { eq: { schedule_id: automation.schedule_id, status: 'scheduled' } });
      await repo.remove('automations', automationId);
      await repo.remove('live_schedules', automation.schedule_id);
    },

    /**
     * Rotina de manutenção (roda ao abrir o app; em produção, mover para pg_cron/Edge Function):
     *  1) estende o horizonte das automações ativas;
     *  2) sincroniza status das lives com a integração (mock: pelo horário).
     */
    async sync(): Promise<{ generated: number; updated: number }> {
      let generated = 0;
      let updated = 0;
      const automations = await repo.list('automations', { eq: { is_active: true } });
      for (const a of automations) {
        const schedule = await repo.get('live_schedules', a.schedule_id);
        if (!schedule) continue;
        const from = schedule.generated_until ? addDays(new Date(`${schedule.generated_until}T00:00:00`), 1) : new Date();
        const startFrom = from > new Date() ? from : new Date();
        generated += (await materialize(schedule, startFrom)).length;
        await repo.update('automations', a.id, { last_run_at: new Date().toISOString() });
        await refreshAutomation(a, schedule);
      }

      const open = (await repo.list('lives')).filter((l) => l.status === 'scheduled' || l.status === 'running');
      for (const l of open) {
        const state = await tiktok.getLiveStatus({
          externalId: l.external_id,
          startsAt: l.starts_at,
          durationMinutes: l.duration_minutes,
          status: l.status,
        });
        if (state.status !== l.status) {
          await repo.update('lives', l.id, { status: state.status, error_message: state.message ?? null });
          updated++;
        }
      }
      return { generated, updated };
    },
  };
}
