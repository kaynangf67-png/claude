import {
  ArrowDown,
  BookOpenText,
  CalendarCheck2,
  ClipboardList,
  Compass,
  Leaf,
  ListChecks,
  MessageSquareText,
  FlaskConical,
  NotebookPen,
  Repeat2,
  ShieldCheck,
  Sparkles,
  Timer,
  Trophy,
  X,
} from "lucide-react";
import Link from "next/link";
import { DashboardPreview } from "@/components/landing/DashboardPreview";
import { Faq } from "@/components/landing/Faq";
import { HeaderAuthLink, StartCta } from "@/components/landing/StartCta";
import { Logo } from "@/components/ui/Logo";
import { WEEK_THEMES } from "@/domain/missions";

const BETA_POINTS = [
  {
    icon: Sparkles,
    title: "Acesso completo e gratuito",
    text: "As 21 missões, o guia de alternativas, XP, conquistas e o relatório final. Sem cartão de crédito e sem cobrança no fim.",
  },
  {
    icon: MessageSquareText,
    title: "Sua opinião define a próxima versão",
    text: "Três pesquisas curtas e opcionais: no início, no Dia 7 e no Dia 21. Críticas valem tanto quanto elogios.",
  },
  {
    icon: FlaskConical,
    title: "Uma versão em construção",
    text: "Pode haver ajustes durante a turma. Se algo não funcionar, há um canal direto com o fundador dentro do app.",
  },
];

const BENEFITS = [
  {
    icon: Compass,
    title: "Entenda seus gatilhos",
    text: "Descubra em que horários, lugares e situações a vontade de doce aparece. Com isso, fica mais fácil se preparar, em vez de depender só da força de vontade.",
  },
  {
    icon: Repeat2,
    title: "Trocas que cabem na sua rotina",
    text: "Um guia com alternativas práticas de comida, bebida e estratégias sem comida, ordenadas pelo que combina com você, seu tempo e seu orçamento.",
  },
  {
    icon: Leaf,
    title: "Progresso sem culpa",
    text: "Perdeu um dia? A missão continua lá. Comeu um doce? Faz parte. O desafio registra o que você fez, sem contar o que deixou de fazer.",
  },
];

const STEPS = [
  {
    icon: ClipboardList,
    title: "Conte sobre a sua rotina",
    text: "Um questionário de cerca de 2 minutos sobre seus horários, dificuldades e preferências. Sem perguntas sobre peso ou saúde.",
  },
  {
    icon: CalendarCheck2,
    title: "Faça uma missão por dia",
    text: "Atividades curtas e práticas, com versão rápida para os dias corridos. Cada missão concluída soma XP e libera conquistas.",
  },
  {
    icon: NotebookPen,
    title: "Monte o seu plano",
    text: "Ao longo dos 21 dias você salva as estratégias que funcionaram. No fim, elas viram um plano pessoal para continuar.",
  },
];

const INCLUDED = [
  { icon: ListChecks, text: "21 missões diárias, organizadas em três semanas: perceber, ajustar e sustentar" },
  { icon: Timer, text: "Versão rápida de cada missão para os dias em que o tempo é curto" },
  { icon: BookOpenText, text: "Guia de alternativas e estratégias, personalizado pelas suas respostas" },
  { icon: NotebookPen, text: "Espaço para reflexões curtas depois de cada missão" },
  { icon: Trophy, text: "XP, níveis e conquistas para acompanhar o caminho" },
  { icon: Sparkles, text: "Relatório final com o que você fez e as estratégias que quer manter" },
];

const NOT_INCLUDED = [
  "Dieta, cardápio fechado ou contagem de calorias",
  "Diagnóstico, tratamento ou acompanhamento de saúde",
  "Promessa de emagrecimento ou de “acabar com a vontade”",
];

export default function LandingPage() {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo />
          <nav aria-label="Seções da página" className="hidden items-center gap-1 text-sm font-medium text-muted md:flex">
            <a href="#primeira-turma" className="rounded-md px-3 py-2 hover:text-forest">
              Primeira Turma
            </a>
            <a href="#como-funciona" className="rounded-md px-3 py-2 hover:text-forest">
              Como funciona
            </a>
            <a href="#o-que-inclui" className="rounded-md px-3 py-2 hover:text-forest">
              O que inclui
            </a>
            <a href="#duvidas" className="rounded-md px-3 py-2 hover:text-forest">
              Dúvidas
            </a>
          </nav>
          <div className="flex items-center gap-1">
            <HeaderAuthLink />
            <StartCta size="sm" label="Participar" className="max-sm:hidden" />
          </div>
        </div>
      </header>

      <main id="conteudo">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-12 px-4 pt-10 pb-16 text-center sm:px-6 md:pt-16 lg:gap-16 lg:pb-24">
            <div className="animate-rise flex max-w-3xl flex-col items-center">
              <p className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-2.5 py-1 text-xs font-semibold text-forest">
                <span className="size-1.5 rounded-full bg-fresh" aria-hidden />
                Primeira Turma · beta gratuito
              </p>
              <h1 className="font-display mt-5 text-[2.25rem] leading-[1.08] font-semibold tracking-tight text-forest min-[400px]:text-[2.5rem] sm:text-5xl lg:text-[3.6rem]">
                Menos açúcar no automático.
                <span className="block text-ink/85 italic">Mais escolhas suas.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
                Em 21 dias, com uma missão curta por dia, você entende quando e por que o doce aparece na sua rotina e testa ajustes
                práticos, sem dieta, sem proibição e sem culpa.
              </p>
              <div className="mt-8 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-center">
                <StartCta />
                <a href="#como-funciona" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg px-4 font-semibold text-forest hover:bg-forest/[0.06]">
                  Ver como funciona <ArrowDown className="size-4" aria-hidden />
                </a>
              </div>
              <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted">
                <li className="flex items-center gap-2">
                  <Timer className="size-4 text-fresh" aria-hidden /> Missões de 5 a 20 minutos
                </li>
                <li className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-fresh" aria-hidden /> Sem pedir dados de saúde
                </li>
                <li className="flex items-center gap-2">
                  <Leaf className="size-4 text-fresh" aria-hidden /> No seu ritmo
                </li>
              </ul>
            </div>
            <div className="animate-rise w-full [animation-delay:120ms]">
              <DashboardPreview />
            </div>
          </div>
        </section>

        {/* Primeira Turma (beta) */}
        <section id="primeira-turma" className="scroll-mt-20 bg-forest text-paper">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <SectionIntro
              dark
              eyebrow="Primeira Turma"
              title="Participe de graça e ajude a construir o desafio."
              text="Esta é a primeira versão do Desafio Menos Açúcar. Quem entra agora faz os 21 dias sem pagar nada e, em troca, conta para a gente o que funcionou, o que não funcionou e o que faltou."
            />
            <ul className="mt-10 grid gap-3 md:grid-cols-3">
              {BETA_POINTS.map((b) => (
                <li key={b.title} className="flex flex-col items-center rounded-card border border-paper/15 bg-forest-900/40 p-6 text-center">
                  <b.icon className="size-6 text-fresh" strokeWidth={1.75} aria-hidden />
                  <h3 className="mt-4 font-semibold">{b.title}</h3>
                  <p className="mt-2 text-[0.9375rem] leading-relaxed text-paper/75">{b.text}</p>
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-col items-center gap-3">
              <StartCta label="Participar da Primeira Turma" variant="secondary" className="w-full border-transparent sm:w-auto" />
              <p className="max-w-md text-center text-sm text-paper/70">
                Pedimos só nome e e-mail. É uma versão inicial: algumas partes ainda vão mudar. Conteúdo educativo, não substitui orientação
                profissional.
              </p>
            </div>
          </div>
        </section>

        {/* Como funciona (explicação curta) */}
        <section id="como-funciona" className="scroll-mt-20 border-y border-line bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <SectionIntro
              eyebrow="Como funciona"
              title="Hábito se constrói com pequenas ações repetidas, não com regras rígidas."
              text="O desafio divide os 21 dias em três fases. Primeiro você observa, depois ajusta o ambiente e testa trocas, e por fim junta o que funcionou num plano seu. Uma nova missão é liberada por dia, e você pode fazer as anteriores quando quiser."
            />
            <ol className="mt-10 grid gap-3 md:grid-cols-3 md:gap-4">
              {([1, 2, 3] as const).map((w) => (
                <li key={w} className="flex flex-col items-center rounded-card border border-line bg-paper p-6 text-center">
                  <span className="font-display grid size-11 place-items-center rounded-lg bg-forest text-lg font-semibold text-paper">{w}</span>
                  <p className="mt-4 text-xs font-semibold tracking-wider text-muted uppercase">
                    Semana {w} · dias {w * 7 - 6} a {w * 7}
                  </p>
                  <p className="font-display mt-1 text-xl font-semibold text-ink">{WEEK_THEMES[w].title}</p>
                  <p className="mt-1 text-[0.9375rem] text-muted">{WEEK_THEMES[w].description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Benefícios */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <SectionIntro eyebrow="Por que é diferente" title="Feito para a vida real, com rotina corrida, festa de aniversário e café da tarde." />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {BENEFITS.map((b) => (
              <article key={b.title} className="flex flex-col items-center rounded-card border border-line bg-white p-6 text-center">
                <b.icon className="size-6 text-forest" strokeWidth={1.75} aria-hidden />
                <h3 className="mt-5 text-lg font-semibold text-ink">{b.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{b.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Três passos */}
        <section className="bg-forest text-paper">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
            <SectionIntro eyebrow="A experiência" title="Três passos, do primeiro dia ao seu plano." dark />
            <ol className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex flex-col items-center border-t border-paper/20 pt-6 text-center">
                  <span className="text-sm font-semibold text-paper/60">Passo {i + 1}</span>
                  <s.icon className="mt-3 size-6 text-fresh" strokeWidth={1.75} aria-hidden />
                  <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 max-w-sm leading-relaxed text-paper/75">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* O que inclui */}
        <section id="o-que-inclui" className="scroll-mt-20 mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <SectionIntro eyebrow="Transparência" title="O que está incluído" />
          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {INCLUDED.map((it) => (
              <li key={it.text} className="flex flex-col items-center rounded-card border border-line bg-white p-5 text-center">
                <span className="grid size-10 place-items-center rounded-lg bg-fresh-100 text-forest">
                  <it.icon className="size-5" strokeWidth={1.9} aria-hidden />
                </span>
                <span className="mt-3 leading-relaxed text-ink">{it.text}</span>
              </li>
            ))}
          </ul>
          <div className="mx-auto mt-10 max-w-2xl rounded-card border border-line bg-sand/60 p-6 text-center sm:p-8">
            <h3 className="font-display text-2xl font-semibold text-ink">O que o desafio não é</h3>
            <p className="mt-2 text-muted">Preferimos deixar claro desde o início.</p>
            <ul className="mt-6 grid gap-3">
              {NOT_INCLUDED.map((t) => (
                <li key={t} className="flex items-start justify-center gap-2">
                  <X className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden />
                  <span className="text-ink">{t}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 border-t border-line pt-5 text-sm leading-relaxed text-muted">
              O conteúdo é educativo. Se você tem diabetes, outra condição de saúde, histórico de transtorno alimentar ou está gestante,
              procure orientação profissional antes de mudar sua alimentação.
            </p>
          </div>
        </section>

        {/* FAQ: título centralizado; respostas alinhadas à esquerda para leitura confortável */}
        <section id="duvidas" className="scroll-mt-20 border-t border-line bg-white">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:py-24">
            <SectionIntro eyebrow="Dúvidas" title="Perguntas frequentes" />
            <div className="mt-10">
              <Faq />
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="rounded-card border border-line bg-white px-6 py-12 text-center sm:px-12">
            <h2 className="font-display mx-auto max-w-2xl text-3xl leading-tight font-semibold text-forest sm:text-4xl">
              O primeiro passo leva dois minutos.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-muted">Responda o questionário inicial e receba a sua primeira missão hoje.</p>
            <div className="mt-8 flex justify-center">
              <StartCta className="w-full sm:w-auto" />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-10 text-center text-sm text-muted sm:px-6">
          <Logo />
          <p className="max-w-md">Conteúdo educativo. Não substitui orientação de médicos ou nutricionistas.</p>
          <Link href="/entrar" className="font-semibold text-forest hover:underline">
            Já tenho conta
          </Link>
          <Link href="/privacidade" className="hover:text-forest hover:underline">
            Aviso de privacidade
          </Link>
        </div>
      </footer>
    </>
  );
}

function SectionIntro({ eyebrow, title, text, dark }: { eyebrow: string; title: string; text?: string; dark?: boolean }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className={dark ? "text-sm font-semibold text-leaf-light" : "text-sm font-semibold text-leaf"}>{eyebrow}</p>
      <h2 className={`font-display mt-2 text-[1.75rem] leading-tight font-semibold sm:text-4xl ${dark ? "text-paper" : "text-forest"}`}>{title}</h2>
      {text && <p className={`mt-4 leading-relaxed ${dark ? "text-paper/75" : "text-muted"}`}>{text}</p>}
    </div>
  );
}
