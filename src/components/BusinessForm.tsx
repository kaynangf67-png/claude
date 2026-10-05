import { Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { uid } from '../lib/format';
import type { Business } from '../lib/types';

export const SEGMENTS = [
  'Loja de móveis',
  'Loja de roupas',
  'Salão de beleza',
  'Clínica odontológica',
  'Oficina mecânica',
  'Prestador de serviços',
  'Loja local',
  'Outro',
];

export const EMPTY_BUSINESS: Business = {
  name: '',
  whatsapp: '',
  segment: SEGMENTS[0],
  description: '',
  hours: '',
  products: [{ id: uid(), name: '', price: 0 }],
  faqs: [{ id: uid(), question: '', answer: '' }],
};

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-base font-bold text-ink">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-slate-500">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function parsePrice(v: string) {
  const n = Number(v.replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function BusinessForm({
  initial,
  submitLabel,
  onSubmit,
  extraActions,
}: {
  initial: Business;
  submitLabel: string;
  onSubmit: (b: Business) => void;
  extraActions?: ReactNode;
}) {
  const [b, setB] = useState<Business>(initial);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(initial.products.map((p) => [p.id, p.price ? String(p.price).replace('.', ',') : ''])),
  );
  const patch = (p: Partial<Business>) => setB((x) => ({ ...x, ...p }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      ...b,
      name: b.name.trim(),
      products: b.products
        .map((p) => ({ ...p, name: p.name.trim(), price: parsePrice(priceDrafts[p.id] ?? '') }))
        .filter((p) => p.name),
      faqs: b.faqs.filter((f) => f.question.trim() && f.answer.trim()),
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Section title="Seu negócio" hint="A IA usa só estas informações para escrever as mensagens.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="bf-name">Nome da empresa</label>
            <input id="bf-name" className="input" required value={b.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Ex.: Studio Bella" />
          </div>
          <div>
            <label className="label" htmlFor="bf-wa">WhatsApp</label>
            <input id="bf-wa" className="input" required inputMode="tel" value={b.whatsapp} onChange={(e) => patch({ whatsapp: e.target.value })} placeholder="(11) 99999-9999" />
          </div>
          <div>
            <label className="label" htmlFor="bf-seg">Segmento</label>
            <select id="bf-seg" className="input" value={b.segment} onChange={(e) => patch({ segment: e.target.value })}>
              {[...new Set([...SEGMENTS, b.segment])].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="bf-hours">Horário de atendimento</label>
            <input id="bf-hours" className="input" value={b.hours} onChange={(e) => patch({ hours: e.target.value })} placeholder="Seg a sex, 9h às 18h" />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="bf-desc">Descrição</label>
            <textarea id="bf-desc" rows={2} className="input" value={b.description} onChange={(e) => patch({ description: e.target.value })} placeholder="O que você vende, onde atende, diferenciais…" />
          </div>
        </div>
      </Section>

      <Section title="Produtos e serviços" hint="A IA nunca cita um preço que não esteja aqui.">
        <div className="space-y-2">
          {b.products.map((p, i) => (
            <div key={p.id} className="flex gap-2">
              <input
                className="input flex-1"
                value={p.name}
                aria-label={`Produto ${i + 1}`}
                placeholder="Ex.: Corte + escova"
                onChange={(e) => patch({ products: b.products.map((x) => (x.id === p.id ? { ...x, name: e.target.value } : x)) })}
              />
              <div className="relative w-32 sm:w-40">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">R$</span>
                <input
                  className="input num pl-9"
                  inputMode="decimal"
                  aria-label={`Preço ${i + 1}`}
                  placeholder="0,00"
                  value={priceDrafts[p.id] ?? ''}
                  onChange={(e) => setPriceDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                />
              </div>
              <button
                type="button"
                className="btn-ghost px-2.5"
                aria-label="Remover produto"
                onClick={() => patch({ products: b.products.filter((x) => x.id !== p.id) })}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn-ghost btn-sm mt-3 text-brand-700"
          onClick={() => patch({ products: [...b.products, { id: uid(), name: '', price: 0 }] })}
        >
          <Plus className="size-4" /> Adicionar produto ou serviço
        </button>
      </Section>

      <Section title="Perguntas frequentes" hint="Pagamento, entrega, agendamento… A IA usa as respostas quando o cliente pergunta.">
        <div className="space-y-3">
          {b.faqs.map((f) => (
            <div key={f.id} className="grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-[1fr_1.4fr_auto]">
              <input
                className="input"
                placeholder="Pergunta"
                value={f.question}
                onChange={(e) => patch({ faqs: b.faqs.map((x) => (x.id === f.id ? { ...x, question: e.target.value } : x)) })}
              />
              <input
                className="input"
                placeholder="Resposta"
                value={f.answer}
                onChange={(e) => patch({ faqs: b.faqs.map((x) => (x.id === f.id ? { ...x, answer: e.target.value } : x)) })}
              />
              <button type="button" className="btn-ghost px-2.5" aria-label="Remover pergunta" onClick={() => patch({ faqs: b.faqs.filter((x) => x.id !== f.id) })}>
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn-ghost btn-sm mt-3 text-brand-700"
          onClick={() => patch({ faqs: [...b.faqs, { id: uid(), question: '', answer: '' }] })}
        >
          <Plus className="size-4" /> Adicionar pergunta
        </button>
      </Section>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {extraActions}
        <button className="btn-primary px-6 py-3">{submitLabel}</button>
      </div>
    </form>
  );
}
