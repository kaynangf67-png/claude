import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  Clock3,
  FileDown,
  History,
  ImageIcon,
  Layers3,
  Camera,
  ScanEye,
  ShieldCheck,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { MARKETPLACE_IDS } from '@vendora/shared/marketplaces';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo, MarketplaceChip } from '../components/ui';
import { ProcessStage, ProductGlyph } from '../features/landing/ProcessStage';
import { useAuth } from '../lib/auth';

function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function HeroInput() {
  const { user } = useAuth();
  const target = '/app/novo';
  const href = user ? target : `/cadastro?next=${encodeURIComponent(target)}`;
  return (
    <div className="mx-auto mt-10 w-full max-w-2xl">
      <Link
        to={href}
        className="group flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-violet-brand/30 bg-white px-6 py-8 shadow-[var(--shadow-lift)] transition hover:border-violet-brand sm:flex-row sm:justify-between sm:py-5"
      >
        <span className="flex items-center gap-3 text-left">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-brand/10 to-blue-brand/10 text-violet-brand">
            <Camera className="size-5" />
          </span>
          <span>
            <span className="block font-semibold text-ink-950">Envie as fotos do produto</span>
            <span className="block text-sm text-ink-500">Do celular ou do computador. A IA faz o resto.</span>
          </span>
        </span>
        <span className="btn-primary px-6 py-3.5 text-[15px]">
          Gerar meu anúncio <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
        </span>
      </Link>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs text-ink-500">Para</span>
        {MARKETPLACE_IDS.map((id) => (
          <MarketplaceChip key={id} id={id} />
        ))}
      </div>
    </div>
  );
}

function HeroVisual() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const p = useSpring(scrollYProgress, { stiffness: 90, damping: 22 });
  const rotateX = useTransform(p, [0, 0.5, 1], [22, 8, -6]);
  const leftX = useTransform(p, [0.2, 0.7], [-40, -170]);
  const rightX = useTransform(p, [0.2, 0.7], [40, 170]);
  const leftZ = useTransform(p, [0.2, 0.7], [-60, -140]);
  const lift = useTransform(p, [0.2, 0.8], [0, -40]);

  const panel = 'rounded-2xl border border-ink-200/80 bg-white p-4 shadow-[var(--shadow-lift)]';
  const bar = (w: string, c = 'bg-ink-200') => <div className={`h-2 rounded-full ${c}`} style={{ width: w }} />;

  return (
    <div ref={ref} className="relative mx-auto mt-16 h-[360px] max-w-4xl sm:h-[420px]" style={{ perspective: 1200 }} aria-hidden>
      <motion.div className="absolute inset-0 grid place-items-center" style={reduce ? {} : { rotateX, transformStyle: 'preserve-3d' }}>
        <motion.div className={`${panel} absolute hidden w-56 sm:block`} style={reduce ? { x: -190 } : { x: leftX, z: leftZ, rotateY: 18 }}>
          <p className="mb-2 text-[10px] font-semibold text-ink-500 uppercase">Ficha técnica</p>
          {['70%', '55%', '80%', '45%'].map((w, i) => (
            <div key={i} className="flex items-center justify-between py-1.5">
              {bar('35%')}
              {bar(w === '45%' ? '25%' : '30%', 'bg-ink-300')}
            </div>
          ))}
        </motion.div>
        <motion.div className={`${panel} absolute hidden w-56 sm:block`} style={reduce ? { x: 190 } : { x: rightX, z: leftZ, rotateY: -18 }}>
          <p className="mb-2 text-[10px] font-semibold text-ink-500 uppercase">Confirme antes de publicar</p>
          {['Peso', 'Dimensões', 'Garantia'].map((k) => (
            <div key={k} className="flex items-center gap-2 py-1.5 text-xs text-ink-700">
              <span className="size-1.5 rounded-full bg-amber-500" /> {k}
            </div>
          ))}
        </motion.div>
        <motion.div className={`${panel} relative w-[300px] sm:w-[340px]`} style={reduce ? {} : { y: lift, z: 40 }}>
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded-full bg-violet-brand/10 px-2 py-0.5 text-[10px] font-semibold text-violet-brand">Prévia</span>
            <span className="text-[10px] text-ink-400">Demonstração ilustrativa</span>
          </div>
          <div className="grid aspect-[4/3] place-items-center rounded-xl bg-gradient-to-b from-white to-ink-50 ring-1 ring-ink-100">
            <ProductGlyph className="h-36" />
          </div>
          <div className="mt-4 space-y-2">
            {bar('92%', 'bg-ink-900/80')}
            {bar('64%', 'bg-ink-900/80')}
            <div className="pt-1">{bar('30%', 'bg-gradient-to-r from-violet-brand to-blue-brand')}</div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

const BENEFITS = [
  { icon: Clock3, title: 'Menos trabalho manual', text: 'Os dados do produto são lidos e organizados para você; o tempo vai para a revisão, não para a digitação.' },
  { icon: BadgeCheck, title: 'Sem informação inventada', text: 'Medidas, garantias e certificações sem fonte são sinalizadas para você confirmar ou remover.' },
  { icon: Layers3, title: 'Um anúncio por canal', text: 'Mercado Livre, Shopee e TikTok Shop têm limites e orientações próprias — e você pode ajustá-los.' },
];

const FEATURES = [
  { icon: ScanEye, title: 'IA que lê as fotos', text: 'Identifica o produto, lê marca e textos da embalagem e aponta o que a foto não mostra.' },
  { icon: Sparkles, title: 'Textos com IA', text: 'Título, descrição e palavras-chave, com fatos separados de sugestões de marketing.' },
  { icon: Wand2, title: 'Editor de imagens', text: 'Recorte, luz, contraste, saturação, fundo branco e tamanho do canal, com desfazer e refazer.' },
  { icon: ImageIcon, title: 'Fotos prontas para venda', text: 'Fundo branco, produto centralizado e tamanho do canal, geradas automaticamente. A original fica guardada.' },
  { icon: History, title: 'Histórico e versões', text: 'Cada edição vira uma versão. Restaure qualquer uma quando quiser.' },
  { icon: FileDown, title: 'Exportação pronta', text: 'ZIP com texto e imagens, TXT para colar ou JSON para integrações.' },
];

const FAQ = [
  {
    q: 'A Vendora publica o anúncio direto no marketplace?',
    a: 'Ainda não. Hoje você exporta o anúncio e publica pelo painel do vendedor. A integração com o Mercado Livre já faz a autorização da conta; o envio automático só será anunciado depois de testado com contas reais.',
  },
  {
    q: 'A IA adivinha marca, medidas e peso pela foto?',
    a: 'Não. Ela só usa o que dá para ver: marca e especificações apenas se estiverem escritas na foto ou na embalagem. O que a foto não mostra (peso, medidas, garantia) aparece numa lista para você confirmar.',
  },
  {
    q: 'As fotos de venda são geradas por IA?',
    a: 'Não inventamos imagens. As fotos de venda são a sua foto tratada: fundo branco, produto centralizado e tamanho certo para o canal. Assim o comprador vê o produto real.',
  },
  {
    q: 'A IA pode inventar características do produto?',
    a: 'Ela é instruída a usar só os dados de origem, e depois conferimos o texto: medidas, garantias e certificações que não aparecem na origem são sinalizadas, e especificações sem fonte são removidas. Mesmo assim, revise antes de publicar.',
  },
  {
    q: 'As imagens editadas alteram o produto?',
    a: 'Não. O editor só faz ajustes globais (recorte, luz, contraste, saturação, fundo). Nada é desenhado ou gerado sobre o produto, e a original fica disponível.',
  },
  {
    q: 'Os limites de cada marketplace estão atualizados?',
    a: 'Os padrões foram revisados em outubro de 2026, e mostramos quais vêm de documentação oficial e quais não. As regras mudam por categoria: ajuste os limites em Configurações.',
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-ink-200 last:border-0">
      <button className="flex w-full items-center justify-between gap-4 py-5 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="font-medium">{q}</span>
        <ChevronDown className={`size-4 shrink-0 text-ink-500 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      <motion.div initial={false} animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }} className="overflow-hidden">
        <p className="pb-5 text-sm leading-relaxed text-ink-500">{a}</p>
      </motion.div>
    </div>
  );
}

export function LandingPage() {
  const { user } = useAuth();
  return (
    <div className="overflow-x-clip bg-[#fbfbfd]">
      <header className="sticky top-0 z-30 border-b border-transparent bg-[#fbfbfd]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-ink-700 md:flex">
            <a href="#como-funciona" className="hover:text-ink-950">Como funciona</a>
            <a href="#recursos" className="hover:text-ink-950">Recursos</a>
            <a href="#planos" className="hover:text-ink-950">Planos</a>
            <a href="#faq" className="hover:text-ink-950">Dúvidas</a>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/app" className="btn-primary">Abrir painel</Link>
            ) : (
              <>
                <Link to="/entrar" className="btn-ghost hidden sm:inline-flex">Entrar</Link>
                <Link to="/cadastro" className="btn-primary">Começar</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative px-4 pt-16 pb-10 sm:pt-24">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-brand/15 via-blue-brand/10 to-violet-brand/10 blur-3xl" />
        <div className="relative mx-auto max-w-4xl text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-medium text-ink-700 shadow-[var(--shadow-soft)]">
              <Sparkles className="size-3.5 text-violet-brand" /> Da foto ao anúncio, com inteligência artificial.
            </span>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="mt-6 text-4xl leading-[1.05] font-extrabold sm:text-6xl">
              Transforme qualquer produto em um <span className="gradient-text">anúncio profissional.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mx-auto mt-6 max-w-2xl text-base text-ink-500 sm:text-lg">
              Tire uma foto do produto. A IA identifica o que é, escreve título e descrição profissionais e prepara as fotos para publicar nos seus
              marketplaces favoritos.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <HeroInput />
          </Reveal>
        </div>
        <HeroVisual />
      </section>

      <section id="beneficios" className="px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">Mais anúncio, menos retrabalho</h2>
            <p className="mt-3 text-ink-500">Pensado para vendedores, lojistas, revendedores e agências que cadastram produtos todos os dias.</p>
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {BENEFITS.map((b, i) => (
              <Reveal key={b.title} delay={i * 0.08}>
                <div className="card h-full p-6 transition hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
                  <b.icon className="size-5 text-violet-brand" />
                  <h3 className="mt-4 text-lg font-semibold">{b.title}</h3>
                  <p className="mt-2 text-sm text-ink-500">{b.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="como-funciona" className="pt-10">
        <Reveal className="mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Como funciona</h2>
          <p className="mt-3 text-ink-500">Role para acompanhar o caminho da foto até o anúncio.</p>
        </Reveal>
        <ProcessStage />
      </section>

      <section id="recursos" className="px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-2xl">
            <h2 className="text-3xl font-bold sm:text-4xl">Recursos</h2>
            <p className="mt-3 text-ink-500">Tudo o que já funciona hoje. O que depende de integrações externas está indicado no próprio app.</p>
          </Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 0.06}>
                <div className="group card h-full p-6 transition hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
                  <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-violet-brand/10 to-blue-brand/10 transition group-hover:scale-105">
                    <f.icon className="size-5 text-violet-brand" />
                  </div>
                  <h3 className="mt-4 font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-ink-500">{f.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-6">
            <div className="flex items-start gap-3 rounded-2xl border border-ink-200 bg-white p-5 text-sm text-ink-700">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-600" />
              <p>
                Segurança por padrão: links para endereços internos são bloqueados, chaves de API ficam só no servidor, imagens são validadas
                pelo conteúdo e cada conta só acessa os próprios dados.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="planos" className="px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <Reveal className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">Planos</h2>
            <p className="mt-3 text-ink-500">Estamos em acesso antecipado. Os planos pagos ainda não têm preço definido.</p>
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              { name: 'Acesso antecipado', tag: 'Disponível', text: 'Todos os recursos atuais, com limites de uso por hora.', cta: true },
              { name: 'Profissional', tag: 'Em planejamento', text: 'Mais volume, publicação automática quando as integrações estiverem prontas.' },
              { name: 'Agências', tag: 'Em planejamento', text: 'Várias lojas, equipe e marcas em uma conta só.' },
            ].map((p, i) => (
              <Reveal key={p.name} delay={i * 0.08}>
                <div className={`card flex h-full flex-col p-6 ${p.cta ? 'ring-2 ring-violet-brand/30' : ''}`}>
                  <span className={`self-start rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.cta ? 'bg-violet-brand/10 text-violet-brand' : 'bg-ink-100 text-ink-500'}`}>
                    {p.tag}
                  </span>
                  <h3 className="mt-4 text-xl font-bold">{p.name}</h3>
                  <p className="mt-2 flex-1 text-sm text-ink-500">{p.text}</p>
                  {p.cta && (
                    <Link to={user ? '/app/novo' : '/cadastro'} className="btn-primary mt-6">
                      Começar agora
                    </Link>
                  )}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="px-4 py-20">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <h2 className="text-center text-3xl font-bold sm:text-4xl">Perguntas frequentes</h2>
          </Reveal>
          <Reveal delay={0.05}>
            <div className="card mt-10 px-6">
              {FAQ.map((f) => (
                <FaqItem key={f.q} {...f} />
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="px-4 pb-24">
        <Reveal>
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-violet-brand to-blue-brand px-6 py-14 text-center text-white sm:px-12">
            <div className="pointer-events-none absolute -top-20 -right-20 size-72 rounded-full bg-white/10 blur-2xl" />
            <h2 className="text-3xl font-bold text-white sm:text-4xl">Seu próximo anúncio começa com uma foto.</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/80">Envie a foto, revise o que a IA escreveu e exporte para o seu marketplace.</p>
            <Link to={user ? '/app/novo' : '/cadastro'} className="btn mt-8 bg-white px-6 py-3 text-ink-950 hover:bg-white/90">
              Criar meu primeiro anúncio <ArrowRight className="size-4" />
            </Link>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-ink-200 px-4 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-sm text-ink-500 sm:flex-row">
          <Logo />
          <p>Vendora AI · Da foto ao anúncio, com inteligência artificial.</p>
        </div>
      </footer>
    </div>
  );
}
