import type { Analysis, LeadStatus, Temperature } from '../lib/types';
import { MAX_FOLLOWUPS } from '../lib/analyze';
import { initials } from '../lib/format';

const pill = 'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset';

export const STATUS_META: Record<LeadStatus, { emoji: string; label: string; cls: string }> = {
  novo: { emoji: '🟢', label: 'Novo', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  interessado: { emoji: '🟡', label: 'Interessado', cls: 'bg-yellow-50 text-yellow-800 ring-yellow-200' },
  followup: { emoji: '🟠', label: 'Follow-up', cls: 'bg-orange-50 text-orange-700 ring-orange-200' },
  recuperado: { emoji: '🔵', label: 'Recuperado', cls: 'bg-blue-50 text-blue-700 ring-blue-200' },
  perdido: { emoji: '🔴', label: 'Perdido', cls: 'bg-red-50 text-red-700 ring-red-200' },
};

export const TEMP_META: Record<Temperature, { emoji: string; label: string; cls: string }> = {
  quente: { emoji: '🔥', label: 'Quente', cls: 'bg-orange-50 text-orange-700 ring-orange-200' },
  morno: { emoji: '🟡', label: 'Morno', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  frio: { emoji: '❄️', label: 'Frio', cls: 'bg-sky-50 text-sky-700 ring-sky-200' },
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`${pill} ${m.cls}`}>
      <span aria-hidden className="text-[10px]">{m.emoji}</span>
      {m.label}
    </span>
  );
}

export function TempBadge({ temperature, long }: { temperature: Temperature; long?: boolean }) {
  const m = TEMP_META[temperature];
  return (
    <span className={`${pill} ${m.cls}`}>
      <span aria-hidden>{m.emoji}</span>
      {long ? `Lead ${m.label.toLowerCase()}` : m.label}
    </span>
  );
}

export function FollowupBadge({ analysis, sent }: { analysis: Analysis; sent: number }) {
  const map: Record<Analysis['followupState'], { label: string; cls: string }> = {
    pendente: { label: analysis.isReply ? 'Responder' : 'Pendente', cls: 'bg-amber-50 text-amber-800 ring-amber-200' },
    aguardando: { label: `Enviado ${sent}/${MAX_FOLLOWUPS}`, cls: 'bg-slate-50 text-slate-600 ring-slate-200' },
    respondido: { label: 'Cliente respondeu', cls: 'bg-brand-50 text-brand-700 ring-brand-200' },
    limite: { label: `Limite ${sent}/${MAX_FOLLOWUPS}`, cls: 'bg-slate-100 text-slate-500 ring-slate-200' },
    nao_necessario: {
      label: sent > 0 ? `Enviado ${sent}/${MAX_FOLLOWUPS}` : '—',
      cls: 'bg-white text-slate-400 ring-slate-200',
    },
  };
  const s = analysis.isReply ? map.pendente : map[analysis.followupState];
  return <span className={`${pill} ${s.cls}`}>{s.label}</span>;
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const palette = ['bg-emerald-100 text-emerald-800', 'bg-sky-100 text-sky-800', 'bg-amber-100 text-amber-800', 'bg-rose-100 text-rose-800', 'bg-violet-100 text-violet-800', 'bg-teal-100 text-teal-800'];
  const idx = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length;
  const dims = size === 'sm' ? 'size-8 text-xs' : size === 'lg' ? 'size-12 text-base' : 'size-10 text-sm';
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold ${dims} ${palette[idx]}`}>
      {initials(name)}
    </span>
  );
}
