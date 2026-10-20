import { ArrowRight, BadgeCheck, ClipboardList, FileSearch, Gauge, Inbox, ListChecks, Mail, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { Logo } from "@/components/brand";
import { LinkButton } from "@/components/ui/button";

const agents = [
  { icon: Sparkles, name: "Estrategista", text: "Interpreta o objetivo, divide em tarefas, declara dependências, premissas e riscos." },
  { icon: Workflow, name: "Operador", text: "Executa apenas tarefas autorizadas, usando ferramentas registradas, e reporta falhas como falhas." },
  { icon: FileSearch, name: "Auditor", text: "Confere cada resultado lendo o registro de volta. Sem confirmação, o resultado fica como não verificado." },
  { icon: Gauge, name: "Otimizador", text: "Analisa o histórico de execuções e sugere melhorias. Não altera permissões nem políticas." },
];

const steps = [
  ["Objetivo", "Você descreve a missão em linguagem natural."],
  ["Plano", "O Estrategista propõe tarefas validadas contra um schema e contra as políticas da sua organização."],
  ["Revisão", "Você aprova ou edita o plano antes de qualquer execução."],
  ["Execução", "Ações de baixo risco rodam sozinhas; ações sensíveis pausam e pedem aprovação."],
  ["Verificação", "Cada resultado é conferido e registrado com evidências e trilha de auditoria."],
];

const useCases = [
  { icon: Inbox, title: "Triagem de mensagens", text: "Classificar mensagens de clientes por categoria e urgência." },
  { icon: Mail, title: "Rascunhos de resposta", text: "Preparar e-mails no Gmail para revisão humana antes do envio." },
  { icon: ListChecks, title: "Organização de trabalho", text: "Transformar pedidos em itens de trabalho com prioridade e prazo." },
  { icon: ClipboardList, title: "Relatórios", text: "Gerar relatórios com contagens reais dos dados autorizados." },
];

const comparison: [string, string, string][] = [
  ["Executa ações com estados explícitos e reprocessamento", "Sim", "Não"],
  ["Ferramentas restritas a um registro do servidor", "Sim", "Variável"],
  ["Aprovação vinculada à ação e aos parâmetros exatos", "Sim", "Não"],
  ["Distingue “executado” de “verificado”", "Sim", "Não"],
  ["Trilha de auditoria imutável por organização", "Sim", "Raramente"],
];

const plans = [
  { name: "Inicial", price: "R$ 0", desc: "Para avaliar o produto", items: ["1 organização", "Missões com plano manual", "Ferramentas internas", "Trilha de auditoria"] },
  { name: "Equipe", price: "R$ 490/mês", desc: "Para operações pequenas", items: ["Planejamento com IA", "Integração com Gmail", "Políticas por ferramenta", "Até 10 membros"], highlight: true },
  { name: "Empresa", price: "Sob consulta", desc: "Para requisitos específicos", items: ["Limites personalizados", "Separação de aprovadores", "Suporte dedicado", "Revisão de segurança"] },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-bg">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm text-muted md:flex" aria-label="Seções">
            <a href="#como-funciona" className="hover:text-fg">Como funciona</a>
            <a href="#autonomia" className="hover:text-fg">Autonomia controlada</a>
            <a href="#casos" className="hover:text-fg">Casos de uso</a>
            <a href="#precos" className="hover:text-fg">Preços</a>
          </nav>
          <div className="flex gap-2">
            <LinkButton href="/login" variant="ghost" size="sm">Entrar</LinkButton>
            <LinkButton href="/signup" size="sm">Criar conta</LinkButton>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
          <p className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-3 py-1 text-xs text-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden /> Autonomia com limites explícitos
          </p>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-fg sm:text-5xl">
            Defina o objetivo. O ORBIT planeja, executa, verifica e pede aprovação quando precisa.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            Uma plataforma de orquestração de agentes de IA para operações de negócio: tarefas com estados reais, ferramentas autorizadas no servidor, aprovações humanas vinculadas a cada ação e evidências do que de fato aconteceu.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/signup" size="lg">
              Criar conta <ArrowRight className="h-4 w-4" aria-hidden />
            </LinkButton>
            <LinkButton href="#como-funciona" variant="secondary" size="lg">Ver como funciona</LinkButton>
          </div>

          <div className="mt-16 card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-xs text-subtle">
              <span className="h-2 w-2 rounded-full bg-accent" /> Exemplo ilustrativo de missão
            </div>
            <ol className="grid gap-px bg-border sm:grid-cols-5">
              {steps.map(([title, text], i) => (
                <li key={title} className="bg-surface p-4">
                  <p className="font-mono text-xs text-accent">0{i + 1}</p>
                  <p className="mt-2 text-sm font-semibold text-fg">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="como-funciona" className="border-t border-border bg-surface/40">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">Quatro papéis, um motor de execução</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Os agentes são papéis com instruções e permissões separadas dentro do mesmo motor de orquestração. Eles podem usar o mesmo modelo de IA; o que muda é o que cada um pode fazer.
            </p>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {agents.map((a) => (
                <div key={a.name} className="card p-5">
                  <a.icon className="h-5 w-5 text-accent" aria-hidden />
                  <h3 className="mt-4 text-sm font-semibold">{a.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{a.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="autonomia" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Autonomia controlada, decidida no servidor</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted">
                A IA sugere; quem autoriza é a política da sua organização. Rótulos de risco produzidos pelo modelo nunca liberam uma ação.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Leitura de dados, relatórios e rascunhos podem rodar automaticamente.",
                  "Envio de e-mail sempre exige aprovação humana, com destinatários restritos a domínios liberados.",
                  "Ferramentas não registradas, SQL arbitrário e comandos de sistema simplesmente não existem para os agentes.",
                  "Se os parâmetros mudarem depois da aprovação, ela é invalidada e uma nova é solicitada.",
                  "Parada de emergência, limite de ações por missão, orçamento de IA e limite de missões por hora.",
                ].map((t) => (
                  <li key={t} className="flex gap-3">
                    <BadgeCheck className="mt-0.5 h-4 w-4 flex-none text-accent" aria-hidden />
                    <span className="text-fg/90">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-subtle">Exemplo de pedido de aprovação</p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between"><span className="text-muted">Ação</span><span className="font-medium">Enviar e-mail</span></div>
                <div className="flex items-center justify-between"><span className="text-muted">Destinatário</span><span className="font-mono text-xs">cliente@empresa.com.br</span></div>
                <div className="flex items-center justify-between"><span className="text-muted">Risco</span><span className="rounded-md border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs text-amber-300">Alto</span></div>
                <div className="flex items-center justify-between"><span className="text-muted">Motivo</span><span className="text-right">Ação externa e irreversível</span></div>
                <div className="flex items-center justify-between"><span className="text-muted">Validade</span><span>72 horas</span></div>
              </div>
              <p className="mt-5 border-t border-border pt-4 text-xs text-subtle">Ilustração da interface; não representa dados de clientes.</p>
            </div>
          </div>
        </section>

        <section id="casos" className="border-t border-border bg-surface/40">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">Casos de uso iniciais</h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {useCases.map((u) => (
                <div key={u.title} className="card p-5">
                  <u.icon className="h-5 w-5 text-accent" aria-hidden />
                  <h3 className="mt-4 text-sm font-semibold">{u.title}</h3>
                  <p className="mt-2 text-sm text-muted">{u.text}</p>
                </div>
              ))}
            </div>

            <div className="mt-14 card overflow-x-auto">
              <table className="table-base min-w-[560px]">
                <thead>
                  <tr>
                    <th scope="col">Capacidade</th>
                    <th scope="col">ORBIT</th>
                    <th scope="col">Chatbot genérico</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map(([c, a, b]) => (
                    <tr key={c}>
                      <td className="text-fg/90">{c}</td>
                      <td className="font-medium text-blue-300">{a}</td>
                      <td className="text-muted">{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section id="precos" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">Preços</h2>
          <p className="mt-2 text-sm text-muted">Estrutura ilustrativa, ainda não validada comercialmente. Valores podem mudar e não há cobrança no produto atualmente.</p>
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {plans.map((p) => (
              <div key={p.name} className={`card p-6 ${p.highlight ? "border-accent/50" : ""}`}>
                <h3 className="text-sm font-semibold">{p.name}</h3>
                <p className="mt-1 text-xs text-muted">{p.desc}</p>
                <p className="mt-5 text-2xl font-semibold tabular-nums">{p.price}</p>
                <ul className="mt-5 space-y-2 text-sm text-fg/90">
                  {p.items.map((i) => (
                    <li key={i} className="flex gap-2"><BadgeCheck className="mt-0.5 h-4 w-4 flex-none text-accent" aria-hidden />{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-16 sm:flex-row sm:items-center sm:px-6">
            <div>
              <h2 className="text-xl font-semibold">Comece com uma missão pequena e auditável.</h2>
              <p className="mt-1 text-sm text-muted">Crie a conta, cadastre alguns registros e veja cada passo da execução.</p>
            </div>
            <div className="flex gap-2">
              <LinkButton href="/signup">Criar conta</LinkButton>
              <LinkButton href="/login" variant="secondary">Entrar</LinkButton>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-subtle sm:flex-row sm:justify-between sm:px-6">
          <Logo />
          <p>© {new Date().getFullYear()} ORBIT. Produto em desenvolvimento.</p>
        </div>
      </footer>
    </div>
  );
}
