import { CheckCheck, SendHorizontal, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { clockTime, dayLabel } from '../lib/format';
import { actions } from '../lib/store';
import type { Lead, Sender } from '../lib/types';

export function ChatView({ lead, businessName }: { lead: Lead; businessName: string }) {
  const [draft, setDraft] = useState('');
  const [as, setAs] = useState<Sender>('cliente');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [lead.messages.length]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    actions.addMessage(lead.id, as, t);
    setDraft('');
  }

  let lastDay = '';
  return (
    <div className="flex h-full min-h-[420px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="chat-wallpaper flex-1 space-y-2 overflow-y-auto px-3 py-4 sm:px-5">
        {lead.messages.length === 0 && (
          <p className="mx-auto mt-10 max-w-xs text-center text-sm text-slate-500">
            Nenhuma mensagem ainda. Simule a conversa abaixo — escreva como cliente e como sua empresa.
          </p>
        )}
        {lead.messages.map((m) => {
          const day = dayLabel(m.at);
          const showDay = day !== lastDay;
          lastDay = day;
          const mine = m.from === 'empresa';
          return (
            <div key={m.id}>
              {showDay && (
                <div className="my-3 flex justify-center">
                  <span className="rounded-lg bg-white/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 shadow-sm">
                    {day}
                  </span>
                </div>
              )}
              <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-[14.5px] leading-snug shadow-sm sm:max-w-[75%] ${
                    mine ? 'rounded-tr-md bg-[#d9fdd3] text-slate-900' : 'rounded-tl-md bg-white text-slate-900'
                  } ${m.isFollowup ? 'ring-2 ring-brand-400/60' : ''}`}
                >
                  {m.isFollowup && (
                    <span className="mb-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brand-700">
                      <Sparkles className="size-3" /> Follow-up
                    </span>
                  )}
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  <span className="mt-0.5 flex items-center justify-end gap-1 text-[10.5px] text-slate-500">
                    {clockTime(m.at)}
                    {mine && <CheckCheck className="size-3.5 text-sky-500" />}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="border-t border-slate-200 bg-slate-50 p-2.5">
        <div className="mb-2 flex items-center gap-1.5 px-1 text-xs">
          <span className="font-medium text-slate-500">Simular mensagem de:</span>
          {(['cliente', 'empresa'] as Sender[]).map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => setAs(s)}
              className={`rounded-full px-2.5 py-1 font-semibold transition ${
                as === s ? 'bg-ink text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'
              }`}
            >
              {s === 'cliente' ? 'Cliente' : businessName}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={as === 'cliente' ? 'Ex.: Vou pensar e te aviso' : 'Ex.: Custa R$ 1.890, parcelamos em 10x'}
            className="input flex-1 bg-white"
          />
          <button className="btn-dark px-3" aria-label="Adicionar mensagem" disabled={!draft.trim()}>
            <SendHorizontal className="size-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
