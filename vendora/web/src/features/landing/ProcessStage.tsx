import { Camera, Check, ImageIcon, ScanSearch, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

/** Conteúdo ilustrativo: barras no lugar de texto, sem nomes de produtos. */

const STEPS = [
  { icon: Camera, title: 'Você envia as fotos', text: 'Do celular ou do computador. Pode ser a foto do produto e da embalagem.' },
  { icon: ScanSearch, title: 'Identificamos o produto', text: 'A IA reconhece o produto e lê marca e textos visíveis. O que a foto não mostra vira uma lista para você confirmar.' },
  { icon: ImageIcon, title: 'Tratamos as imagens', text: 'Recorte, luz, fundo branco e tamanho certo para cada canal, sempre numa cópia. A foto original fica guardada.' },
  { icon: Sparkles, title: 'O anúncio fica pronto', text: 'Título, descrição e ficha técnica no formato do canal, com a lista do que você ainda precisa confirmar.' },
];

function Bar({ w, tone = 'bg-ink-200' }: { w: string; tone?: string }) {
  return <div className={`h-2 rounded-full ${tone}`} style={{ width: w }} />;
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-ink-200 bg-surface p-4 ${className}`}>{children}</div>;
}

/** Garrafa estilizada genérica, usada só como forma ilustrativa. */
export function ProductGlyph({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 160" className={className} aria-hidden>
      <defs>
        <linearGradient id="pg" x1="0" x2="1">
          <stop offset="0" stopColor="#c6f432" />
          <stop offset="1" stopColor="#93c21b" />
        </linearGradient>
      </defs>
      <rect x="46" y="8" width="28" height="18" rx="5" fill="#1c1e27" />
      <rect x="32" y="26" width="56" height="124" rx="22" fill="url(#pg)" />
      <rect x="40" y="40" width="10" height="90" rx="5" fill="#fff" opacity=".25" />
    </svg>
  );
}

const STEP_CARDS = [
  () => (
    <Card className="w-full">
      <p className="mb-3 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">Fotos enviadas</p>
      <div className="grid grid-cols-3 gap-2">
        {['from-stone-300 to-stone-400', 'from-amber-100 to-stone-300', 'from-stone-200 to-stone-300'].map((g) => (
          <div key={g} className={`grid aspect-square place-items-center rounded-xl bg-gradient-to-br ${g}`}>
            <ProductGlyph className="h-3/4" />
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-300">
        <Check className="size-3.5" /> 3 fotos · originais guardadas
      </div>
    </Card>
  ),
  () => (
    <Card className="w-full">
      <p className="mb-3 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">Produto identificado</p>
      {[
        ['Marca', 'Confirmado', 'text-emerald-300 bg-emerald-400/10'],
        ['Modelo', 'Confirmado', 'text-emerald-300 bg-emerald-400/10'],
        ['Peso', 'Ausente', 'text-ink-500 bg-ink-100'],
        ['Descrição', 'A confirmar', 'text-amber-300 bg-amber-400/10'],
      ].map(([k, v, c]) => (
        <div key={k} className="flex items-center justify-between border-b border-ink-100 py-1.5 last:border-0">
          <span className="text-xs text-ink-700">{k}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${c}`}>{v}</span>
        </div>
      ))}
    </Card>
  ),
  () => (
    <Card className="w-full">
      <p className="mb-3 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">Imagens tratadas</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="relative grid aspect-square place-items-center rounded-xl bg-gradient-to-br from-stone-300 to-stone-400">
          <ProductGlyph className="h-3/4" />
          <span className="absolute bottom-1 left-1 rounded bg-surface/90 px-1.5 text-[9px] font-semibold">Original</span>
        </div>
        <div className="relative grid aspect-square place-items-center rounded-xl border border-ink-200 bg-surface">
          <ProductGlyph className="h-3/4" />
          <span className="absolute bottom-1 left-1 rounded bg-accent px-1.5 text-[9px] font-semibold text-accent-ink">1200×1200</span>
        </div>
      </div>
    </Card>
  ),
  () => (
    <Card className="w-full">
      <p className="mb-3 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">Anúncio final</p>
      <div className="flex gap-3">
        <div className="grid size-16 shrink-0 place-items-center rounded-xl border border-ink-200 bg-surface">
          <ProductGlyph className="h-12" />
        </div>
        <div className="flex-1 space-y-2 pt-1">
          <Bar w="95%" tone="bg-ink-700" />
          <Bar w="60%" tone="bg-ink-700" />
          <Bar w="35%" tone="bg-accent" />
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        <Bar w="100%" />
        <Bar w="88%" />
        <Bar w="72%" />
      </div>
    </Card>
  ),
];

/** As quatro etapas lado a lado, fixas: nada depende da rolagem. */
export function ProcessStage() {
  return (
    <div className="mx-auto mt-12 grid max-w-6xl gap-6 px-4 sm:grid-cols-2 lg:grid-cols-4">
      {STEPS.map((s, i) => {
        const Visual = STEP_CARDS[i]!;
        return (
          <div key={s.title} className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-ink-200 bg-surface text-xs font-semibold text-accent">{i + 1}</span>
              <h3 className="text-base font-semibold">{s.title}</h3>
            </div>
            <p className="text-sm text-ink-500">{s.text}</p>
            <Visual />
          </div>
        );
      })}
    </div>
  );
}
