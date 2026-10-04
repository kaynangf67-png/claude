import {
  AlertTriangle,
  Check,
  CheckCheck,
  Copy,
  ExternalLink,
  Lightbulb,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  Trophy,
  UserRound,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { MAX_FOLLOWUPS } from '../lib/analyze';
import { firstName, formatBRL, formatBRLShort, whatsappLink } from '../lib/format';
import { checkMessage, generateFollowup, type FollowupSource } from '../lib/followup';
import { actions, toast } from '../lib/store';
import type { Analysis, Business, Lead } from '../lib/types';
import { TempBadge } from './Badges';

export function DiagnosisCard({ lead, analysis, compact }: { lead: Lead; analysis: Analysis; compact?: boolean }) {
  const isOpen = lead.status !== 'recuperado' && lead.status !== 'perdido';
  const tone = analysis.isLostOpportunity
    ? 'border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50/40'
    : lead.status === 'recuperado'
      ? 'border-blue-200 bg-blue-50/60'
      : 'border-slate-200 bg-slate-50';
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="size-4 text-orange-500" />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Diagnóstico da IA</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-lg font-extrabold text-ink">{analysis.label}</p>
        <TempBadge temperature={analysis.temperature} long />
      </div>

      <div className={`mt-3 grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-2'}`}>
        <div className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-black/5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {lead.status === 'recuperado' ? 'Valor recuperado' : 'Valor potencial'}
          </p>
          <p className="num text-lg font-extrabold text-brand-700">{formatBRLShort(lead.value)}</p>
        </div>
        <div className="rounded-xl bg-white/80 px-3 py-2 ring-1 ring-black/5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Ação recomendada</p>
          <p className="text-sm font-bold leading-snug text-ink">{analysis.recommendedAction}</p>
        </div>
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-xs font-semibold text-slate-600">Por que a IA chegou nisso:</p>
        <ul className="space-y-1">
          {analysis.reasons.map((r) => (
            <li key={r} className="flex gap-2 text-sm text-slate-700">
              <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-orange-400" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>

      {analysis.needsHuman && isOpen && (
        <div className="mt-3 flex gap-2 rounded-xl bg-amber-100/70 px-3 py-2.5 text-sm text-amber-900 ring-1 ring-amber-200">
          <UserRound className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong>Atendimento humano recomendado.</strong> {analysis.humanReason}
          </span>
        </div>
      )}
    </div>
  );
}

type Phase = 'idle' | 'loading' | 'draft' | 'sent';

export function FollowupComposer({
  lead,
  business,
  analysis,
  onRecovered,
}: {
  lead: Lead;
  business: Business;
  analysis: Analysis;
  onRecovered?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [text, setText] = useState('');
  const [source, setSource] = useState<FollowupSource>('local');
  const [variant, setVariant] = useState(0);
  const [copied, setCopied] = useState(false);
  const [awaitingReply, setAwaitingReply] = useState(false);

  const isOpen = lead.status !== 'recuperado' && lead.status !== 'perdido';
  const n = firstName(lead.name);
  const kind = analysis.isReply ? 'resposta' : 'follow-up';
  const checks = text ? checkMessage(text, business) : [];

  async function generate(nextVariant: number) {
    setPhase('loading');
    const result = await generateFollowup(lead, business, analysis, nextVariant);
    setText(result.text);
    setSource(result.source);
    setVariant(nextVariant);
    setPhase('draft');
  }

  function register(simulated: boolean) {
    const msg = text.trim();
    if (!msg) return;
    if (analysis.isReply) actions.sendReply(lead.id, msg);
    else actions.sendFollowup(lead.id, msg);
    setPhase('sent');
    toast({
      title: simulated ? 'Mensagem enviada (simulação)' : 'Marcado como enviado',
      description: simulated
        ? `Simulamos o envio para ${n}. Nenhuma mensagem real foi enviada.`
        : `Registramos que você enviou a mensagem para ${n}.`,
    });
    if (simulated) {
      setAwaitingReply(true);
      setTimeout(() => {
        actions.simulateCustomerReply(lead.id);
        setAwaitingReply(false);
        toast({ title: `${n} respondeu! 💬`, description: 'Veja a conversa e feche a venda.', tone: 'info' });
      }, 2200);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard indisponível */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  function recover() {
    actions.setStatus(lead.id, 'recuperado');
    toast({ title: `+${formatBRL(lead.value)} recuperados 🎉`, description: `${lead.name} comprou ${lead.productName}.` });
    onRecovered?.();
  }

  function markLost() {
    actions.setStatus(lead.id, 'perdido');
    toast({ title: 'Lead marcado como perdido', description: 'Ele não receberá novos follow-ups.', tone: 'info' });
  }

  if (!isOpen) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        {lead.status === 'recuperado' ? (
          <div className="flex items-center gap-3">
            <Trophy className="size-5 text-blue-600" />
            <span>
              Venda recuperada: <strong className="text-ink">{formatBRL(lead.value)}</strong>. Esse valor já está no seu painel.
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>Lead marcado como perdido. A IA não sugere novos contatos.</span>
            <button className="btn-secondary btn-sm" onClick={() => actions.setStatus(lead.id, 'interessado')}>
              Reabrir lead
            </button>
          </div>
        )}
      </div>
    );
  }

  const readyToClose = analysis.label === 'Pronto para fechar' || analysis.objection === 'respondeu_followup';

  return (
    <div className="space-y-3">
      {/* --- Corpo ----------------------------------------------------------- */}
      {phase === 'idle' && (
        <>
          {analysis.canFollowUp || analysis.isReply ? (
            <button onClick={() => generate(0)} className="btn-primary w-full py-3 text-base">
              <Sparkles className="size-5" />
              {analysis.isReply ? 'Gerar resposta com IA' : 'Gerar follow-up com IA'}
            </button>
          ) : (
            analysis.blockReason && (
              <div
                className={`flex gap-2.5 rounded-xl px-3.5 py-3 text-sm ring-1 ${
                  readyToClose ? 'bg-brand-50 text-brand-900 ring-brand-200' : 'bg-slate-50 text-slate-700 ring-slate-200'
                }`}
              >
                {readyToClose ? <Lightbulb className="mt-0.5 size-4 shrink-0" /> : <ShieldCheck className="mt-0.5 size-4 shrink-0" />}
                <span>{analysis.blockReason}</span>
              </div>
            )
          )}
        </>
      )}

      {phase === 'loading' && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-dashed border-brand-300 bg-brand-50/50 py-8 text-sm font-medium text-brand-800">
          <Loader2 className="size-5 animate-spin" />
          Lendo a conversa e escrevendo a {kind}…
        </div>
      )}

      {phase === 'draft' && (
        <div className="animate-pop-in space-y-3">
          <div className="rounded-2xl border border-brand-200 bg-white shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-700">
                <Sparkles className="size-3.5" />
                {analysis.isReply ? 'Resposta sugerida' : 'Follow-up sugerido'}
              </span>
              <span className="text-[11px] font-medium text-slate-400">
                {source === 'claude' ? 'Gerado com Claude' : 'IA RecuperaAI · modo demo'} · edite à vontade
              </span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              className="block w-full resize-y rounded-b-2xl px-4 py-3 text-[15px] leading-relaxed text-ink focus:outline-none"
              aria-label="Mensagem de follow-up"
            />
          </div>

          <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
            {checks.map((c) => (
              <li
                key={c.id}
                title={c.detail}
                className={`inline-flex items-center gap-1 text-xs font-medium ${c.ok ? 'text-slate-500' : 'text-red-600'}`}
              >
                {c.ok ? <Check className="size-3.5 text-brand-600" /> : <X className="size-3.5" />}
                {c.ok ? c.label : c.detail}
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap gap-2">
            <button onClick={copy} className="btn-secondary btn-sm">
              {copied ? <Check className="size-3.5 text-brand-600" /> : <Copy className="size-3.5" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
            <a href={whatsappLink(lead.phone, text)} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
              <ExternalLink className="size-3.5" />
              Abrir no WhatsApp
            </a>
            <button onClick={() => generate(variant + 1)} className="btn-ghost btn-sm">
              <RefreshCw className="size-3.5" />
              Outra versão
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <button onClick={() => register(true)} className="btn-primary" disabled={!text.trim()}>
              <Send className="size-4" />
              Simular envio
            </button>
            <button onClick={() => register(false)} className="btn-secondary" disabled={!text.trim()}>
              <CheckCheck className="size-4" />
              Marcar como enviado
            </button>
          </div>
          <p className="text-center text-[11px] text-slate-400">
            Nada é enviado automaticamente. “Abrir no WhatsApp” só prepara a mensagem para você enviar.
          </p>
        </div>
      )}

      {phase === 'sent' && (
        <div className="animate-pop-in rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-900 ring-1 ring-brand-200">
          <p className="flex items-center gap-2 font-semibold">
            <CheckCheck className="size-4" />
            {analysis.isReply ? 'Resposta registrada' : `Follow-up registrado (${lead.followupsSent}/${MAX_FOLLOWUPS})`}
          </p>
          <p className="mt-0.5 flex items-center gap-2 text-brand-800/80">
            {awaitingReply ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> Simulando a resposta de {n}…
              </>
            ) : (
              'Próximo passo: quando o cliente comprar, registre a venda recuperada.'
            )}
          </p>
          {!awaitingReply && (analysis.canFollowUp || analysis.isReply) && (
            <button onClick={() => setPhase('idle')} className="mt-2 text-xs font-semibold text-brand-700 hover:underline">
              Escrever nova mensagem
            </button>
          )}
        </div>
      )}

      {/* --- Rodapé: resultado ------------------------------------------------ */}
      <div className={`rounded-2xl p-3 ${readyToClose ? 'bg-brand-600 text-white' : 'bg-slate-50 ring-1 ring-slate-200'}`}>
        {readyToClose && (
          <p className="mb-2 px-1 text-sm font-semibold">
            🎯 {n} quer comprar! Registre a venda para ver o ROI no painel.
          </p>
        )}
        <button
          onClick={recover}
          className={`btn w-full py-3 ${readyToClose ? 'bg-white text-brand-700 hover:bg-brand-50' : 'border border-brand-300 bg-white text-brand-700 hover:bg-brand-50'}`}
        >
          <Trophy className="size-4 shrink-0" />
          Simular venda recuperada · {formatBRLShort(lead.value)}
        </button>
        <button
          onClick={markLost}
          className={`mx-auto mt-1.5 flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium ${readyToClose ? 'text-white/80 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <ThumbsDown className="size-3.5" />
          Cliente desistiu? Marcar como perdido
        </button>
      </div>

      {analysis.objection === 'desconto' && phase === 'draft' && (
        <p className="flex gap-2 text-xs text-amber-700">
          <AlertTriangle className="size-3.5 shrink-0" />
          A IA não oferece desconto. Se quiser dar um, edite a mensagem — a decisão é sua.
        </p>
      )}
    </div>
  );
}
