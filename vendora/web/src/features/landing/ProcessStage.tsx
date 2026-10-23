import { motion, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from 'framer-motion';
import { Camera, Check, ImageIcon, ScanSearch, Sparkles } from 'lucide-react';
import { useRef, type ReactNode } from 'react';

/**
 * Demonstração do processo controlada pela rolagem. Usa apenas transformações
 * CSS 3D (perspective/translateZ/rotate) — leves em GPU, sem WebGL. Com
 * movimento reduzido, vira uma lista estática.
 *
 * Conteúdo é ilustrativo: barras no lugar de texto, sem nomes de produtos.
 */

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
  return <div className={`rounded-2xl border border-ink-200/80 bg-white p-4 shadow-[var(--shadow-lift)] ${className}`}>{children}</div>;
}

/** Garrafa estilizada genérica, usada só como forma ilustrativa. */
export function ProductGlyph({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 160" className={className} aria-hidden>
      <defs>
        <linearGradient id="pg" x1="0" x2="1">
          <stop offset="0" stopColor="#6d4aff" />
          <stop offset="1" stopColor="#2f6bff" />
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
    <Card className="w-[290px]">
      <p className="mb-3 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">Fotos enviadas</p>
      <div className="grid grid-cols-3 gap-2">
        {['from-stone-300 to-stone-400', 'from-amber-100 to-stone-300', 'from-stone-200 to-stone-300'].map((g) => (
          <div key={g} className={`grid aspect-square place-items-center rounded-xl bg-gradient-to-br ${g}`}>
            <ProductGlyph className="h-3/4" />
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-700">
        <Check className="size-3.5" /> 3 fotos · originais guardadas
      </div>
    </Card>
  ),
  () => (
    <Card className="w-[290px]">
      <p className="mb-3 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">Produto identificado</p>
      {[
        ['Marca', 'Confirmado', 'text-emerald-700 bg-emerald-50'],
        ['Modelo', 'Confirmado', 'text-emerald-700 bg-emerald-50'],
        ['Peso', 'Ausente', 'text-ink-500 bg-ink-100'],
        ['Descrição', 'A confirmar', 'text-amber-700 bg-amber-50'],
      ].map(([k, v, c]) => (
        <div key={k} className="flex items-center justify-between border-b border-ink-100 py-1.5 last:border-0">
          <span className="text-xs text-ink-700">{k}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${c}`}>{v}</span>
        </div>
      ))}
    </Card>
  ),
  () => (
    <Card className="w-[290px]">
      <p className="mb-3 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">Imagens tratadas</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="relative grid aspect-square place-items-center rounded-xl bg-gradient-to-br from-stone-300 to-stone-400">
          <ProductGlyph className="h-3/4" />
          <span className="absolute bottom-1 left-1 rounded bg-white/90 px-1.5 text-[9px] font-semibold">Original</span>
        </div>
        <div className="relative grid aspect-square place-items-center rounded-xl border border-ink-200 bg-white">
          <ProductGlyph className="h-3/4" />
          <span className="absolute bottom-1 left-1 rounded bg-violet-brand px-1.5 text-[9px] font-semibold text-white">1200×1200</span>
        </div>
      </div>
    </Card>
  ),
  () => (
    <Card className="w-[290px]">
      <p className="mb-3 text-[11px] font-semibold tracking-wide text-ink-500 uppercase">Anúncio final</p>
      <div className="flex gap-3">
        <div className="grid size-16 shrink-0 place-items-center rounded-xl border border-ink-200 bg-white">
          <ProductGlyph className="h-12" />
        </div>
        <div className="flex-1 space-y-2 pt-1">
          <Bar w="95%" tone="bg-ink-900/80" />
          <Bar w="60%" tone="bg-ink-900/80" />
          <Bar w="35%" tone="bg-gradient-to-r from-violet-brand to-blue-brand" />
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

function StageCard({ index, progress, children }: { index: number; progress: MotionValue<number>; children: ReactNode }) {
  // Cada cartão "chega" à frente quando a rolagem passa pela sua etapa.
  const center = index / (STEPS.length - 1);
  const dist = useTransform(progress, (p) => p - center);
  const z = useTransform(dist, [-0.5, 0, 0.5], [-260, 60, -260]);
  const y = useTransform(dist, [-0.5, 0, 0.5], [140, 0, -140]);
  const rotateX = useTransform(dist, [-0.5, 0, 0.5], [28, 0, -28]);
  const opacity = useTransform(dist, [-0.45, -0.15, 0, 0.15, 0.45], [0, 0.55, 1, 0.55, 0]);
  return (
    <motion.div className="absolute" style={{ z, y, rotateX, opacity, transformStyle: 'preserve-3d' }}>
      {children}
    </motion.div>
  );
}

export function ProcessStage() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.4 });
  const rotateY = useTransform(progress, [0, 1], [-14, 14]);
  const activeIndex = useTransform(progress, (p) => Math.min(STEPS.length - 1, Math.round(p * (STEPS.length - 1))));

  if (reduce)
    return (
      <div className="mx-auto grid max-w-5xl gap-6 px-4 md:grid-cols-2">
        {STEPS.map((s, i) => {
          const Visual = STEP_CARDS[i]!;
          return (
            <div key={s.title} className="flex flex-col gap-4">
              <Visual />
              <div>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-ink-500">{s.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    );

  return (
    <div ref={ref} className="relative h-[320vh]">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 md:grid-cols-2">
          <div className="order-2 md:order-1">
            {STEPS.map((s, i) => (
              <StepText key={s.title} index={i} active={activeIndex} step={s} />
            ))}
          </div>
          <div className="order-1 grid h-[340px] place-items-center md:order-2 md:h-[480px]" style={{ perspective: 1100 }}>
            <motion.div className="relative grid place-items-center" style={{ rotateY, transformStyle: 'preserve-3d' }}>
              {STEP_CARDS.map((Visual, i) => (
                <StageCard key={i} index={i} progress={progress}>
                  <Visual />
                </StageCard>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepText({ index, active, step }: { index: number; active: MotionValue<number>; step: (typeof STEPS)[number] }) {
  const opacity = useTransform(active, (a) => (a === index ? 1 : 0.28));
  const x = useTransform(active, (a) => (a === index ? 0 : -6));
  return (
    <motion.div style={{ opacity, x }} className="flex gap-4 py-4 transition-[opacity,transform] duration-300">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white shadow-[var(--shadow-soft)]">
        <step.icon className="size-5 text-violet-brand" />
      </div>
      <div>
        <p className="text-xs font-semibold text-ink-400">Etapa {index + 1}</p>
        <h3 className="text-lg font-semibold sm:text-xl">{step.title}</h3>
        <p className="mt-1 max-w-md text-sm text-ink-500">{step.text}</p>
      </div>
    </motion.div>
  );
}
