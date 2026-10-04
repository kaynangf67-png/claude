import { MessageSquareText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { analyzeLead } from '../lib/analyze';
import { formatPhone, relativeTime } from '../lib/format';
import { useAppState } from '../lib/store';
import { Avatar, StatusBadge } from './Badges';
import { DiagnosisCard, FollowupComposer } from './FollowupComposer';
import { Modal } from './ui';

export function RecoverModal({ leadId, onClose }: { leadId: string | null; onClose: () => void }) {
  const { leads, business } = useAppState();
  const lead = leads.find((l) => l.id === leadId);
  if (!lead || !business) return null;
  const analysis = analyzeLead(lead, business);
  const snippet = lead.messages.slice(-3);

  return (
    <Modal
      open={!!leadId}
      onClose={onClose}
      wide
      title={
        <div className="flex items-center gap-3">
          <Avatar name={lead.name} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-base font-bold text-ink">{lead.name}</p>
              <StatusBadge status={lead.status} />
            </div>
            <p className="truncate text-sm text-slate-500">
              {lead.productName} · {formatPhone(lead.phone)}
            </p>
          </div>
        </div>
      }
    >
      <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-2 md:grid-rows-[auto_1fr] [&>*]:min-w-0">
        <DiagnosisCard lead={lead} analysis={analysis} compact />
        <div className="md:col-start-2 md:row-span-2 md:row-start-1">
          <FollowupComposer key={lead.id} lead={lead} business={business} analysis={analysis} />
        </div>
        <div className="self-start rounded-2xl border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Trecho da conversa</span>
            <span className="text-xs text-slate-400">{relativeTime(analysis.lastInteraction)}</span>
          </div>
          <div className="chat-wallpaper space-y-1.5 rounded-xl p-2.5">
            {snippet.map((m) => (
              <div key={m.id} className={`flex ${m.from === 'empresa' ? 'justify-end' : ''}`}>
                <p
                  className={`max-w-[90%] rounded-xl px-2.5 py-1.5 text-[13px] leading-snug shadow-sm ${
                    m.from === 'empresa' ? 'bg-[#d9fdd3]' : 'bg-white'
                  } ${m.isFollowup ? 'ring-2 ring-brand-400/60' : ''}`}
                >
                  {m.text}
                </p>
              </div>
            ))}
          </div>
          <Link
            to={`/app/leads/${lead.id}`}
            onClick={onClose}
            className="mt-2 inline-flex items-center gap-1.5 px-1 text-xs font-semibold text-brand-700 hover:underline"
          >
            <MessageSquareText className="size-3.5" />
            Ver conversa completa
          </Link>
        </div>
      </div>
    </Modal>
  );
}
