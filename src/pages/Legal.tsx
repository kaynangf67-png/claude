import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/ui';
import { LEGAL } from '../lib/legal';

function Contact() {
  return LEGAL.email ? (
    <a className="font-semibold text-brand-700 underline" href={`mailto:${LEGAL.email}`}>
      {LEGAL.email}
    </a>
  ) : (
    <span className="font-semibold">o e-mail de contato informado no rodapé</span>
  );
}

function Operator() {
  if (!LEGAL.operator) return <>o responsável pelo RecuperaAI</>;
  return (
    <>
      {LEGAL.operator}
      {LEGAL.document ? ` (${LEGAL.document})` : ''}
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <div className="space-y-2 text-[15px] leading-relaxed text-slate-700">{children}</div>
    </section>
  );
}

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5 sm:px-6">
        <Link to="/">
          <Logo />
        </Link>
        <Link to="/" className="btn-ghost">
          Voltar
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <article className="card space-y-6 p-6 sm:p-10">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-slate-500">Última atualização: {LEGAL.updatedAt}</p>
          </div>
          {children}
        </article>
        <LegalFooter />
      </main>
    </div>
  );
}

export function LegalFooter({ className = '' }: { className?: string }) {
  return (
    <p className={`mt-6 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-500 ${className}`}>
      <Link to="/termos" className="hover:text-ink hover:underline">
        Termos de uso
      </Link>
      <Link to="/privacidade" className="hover:text-ink hover:underline">
        Política de privacidade
      </Link>
      {LEGAL.email && (
        <a href={`mailto:${LEGAL.email}`} className="hover:text-ink hover:underline">
          {LEGAL.email}
        </a>
      )}
    </p>
  );
}

export function Terms() {
  return (
    <LegalLayout title="Termos de uso">
      <p className="text-[15px] leading-relaxed text-slate-700">
        Estes termos regem o uso do RecuperaAI, oferecido por <Operator />. Ao criar uma conta ou assinar um plano, você
        concorda com eles.
      </p>

      <Section title="1. O que é o RecuperaAI">
        <p>
          O RecuperaAI ajuda pequenos negócios a identificar clientes que demonstraram interesse e não compraram, e
          sugere mensagens de follow-up. O serviço está em <strong>acesso antecipado</strong>: ainda não se conecta
          diretamente ao WhatsApp. Você registra as conversas no sistema e envia as mensagens pelo seu próprio WhatsApp.
          Nenhuma mensagem é enviada automaticamente.
        </p>
      </Section>

      <Section title="2. Onde ficam os seus dados">
        <p>
          Nesta versão, a sua conta, os dados do negócio e as conversas cadastradas ficam salvos{' '}
          <strong>apenas no navegador do aparelho que você usa</strong>. Se você limpar os dados do navegador, trocar de
          aparelho ou usar uma janela anônima, essas informações podem ser perdidas, e nós não temos como recuperá-las.
        </p>
      </Section>

      <Section title="3. Assinatura, pagamento e cancelamento">
        <p>
          A assinatura é mensal, com renovação automática, e o pagamento é processado pela Cakto. Não temos acesso aos
          dados do seu cartão.
        </p>
        <p>
          O acesso é ativado em até 24 horas após a confirmação do pagamento, no e-mail usado na compra.
        </p>
        <p>
          Você pode cancelar quando quiser, sem multa, pela área do comprador da Cakto ou escrevendo para <Contact />. O
          cancelamento interrompe as próximas cobranças; o período já pago continua disponível até o fim.
        </p>
        <p>
          <strong>Direito de arrependimento:</strong> por ser uma compra feita pela internet, você pode desistir em até 7
          dias a partir da contratação e receber de volta o valor pago, conforme o art. 49 do Código de Defesa do
          Consumidor.
        </p>
      </Section>

      <Section title="4. Uso responsável">
        <p>
          Você é responsável pelas mensagens que envia aos seus clientes e por ter autorização para contatá-los. Não use
          o RecuperaAI para enviar spam, mensagens enganosas ou para contatar quem pediu para não ser contatado.
        </p>
        <p>
          As mensagens sugeridas pela IA podem conter erros. Revise cada mensagem antes de enviar. A IA foi configurada
          para usar apenas os preços e informações que você cadastrou, mas a decisão final é sua.
        </p>
      </Section>

      <Section title="5. Resultados">
        <p>
          O RecuperaAI não garante vendas recuperadas nem um valor mínimo de receita. Os números da demonstração são
          exemplos ilustrativos.
        </p>
      </Section>

      <Section title="6. Alterações e lei aplicável">
        <p>
          Podemos atualizar estes termos. Mudanças relevantes serão comunicadas por e-mail aos assinantes. Estes termos
          seguem a legislação brasileira.
        </p>
      </Section>

      <Section title="7. Contato">
        <p>
          Dúvidas, cancelamento ou reembolso: <Contact />.
        </p>
      </Section>
    </LegalLayout>
  );
}

export function Privacy() {
  return (
    <LegalLayout title="Política de privacidade">
      <p className="text-[15px] leading-relaxed text-slate-700">
        Esta política explica como <Operator /> trata dados pessoais no RecuperaAI, de acordo com a Lei Geral de Proteção
        de Dados (Lei nº 13.709/2018).
      </p>

      <Section title="1. Dados que você cadastra no app">
        <p>
          Nome, e-mail, dados do seu negócio, produtos, preços e as conversas com seus clientes que você registra. Nesta
          versão, esses dados ficam <strong>armazenados apenas no seu navegador</strong> e não são enviados aos nossos
          servidores.
        </p>
        <p>
          Quando a geração de mensagens por IA externa estiver ativada, o conteúdo da conversa e os dados do seu negócio
          são enviados ao provedor de IA (Anthropic) somente para escrever a sugestão de mensagem.
        </p>
      </Section>

      <Section title="2. Dados de pagamento">
        <p>
          O pagamento é feito na Cakto, que trata os dados conforme a política dela. Recebemos da Cakto o nome, o e-mail,
          o telefone e a situação da compra, para ativar e manter o seu acesso. Nunca recebemos dados do cartão.
        </p>
      </Section>

      <Section title="3. Dados dos seus clientes">
        <p>
          As conversas que você cadastra contêm dados dos seus clientes. Em relação a esses dados, você é o controlador e
          decide como usá-los; o RecuperaAI apenas fornece a ferramenta. Cadastre somente o necessário para o
          atendimento.
        </p>
      </Section>

      <Section title="4. Para que usamos os dados">
        <p>
          Para prestar o serviço, ativar e manter a assinatura, dar suporte e cumprir obrigações legais. Não vendemos
          dados pessoais e não usamos as suas conversas para publicidade.
        </p>
      </Section>

      <Section title="5. Cookies e serviços de terceiros">
        <p>
          Não usamos cookies de rastreamento nem anúncios. O site carrega fontes do Google Fonts, o que envia ao Google
          dados técnicos da conexão, como o endereço IP. O site é hospedado na Vercel.
        </p>
      </Section>

      <Section title="6. Seus direitos">
        <p>
          Você pode pedir acesso, correção ou exclusão dos seus dados, ou tirar dúvidas sobre o tratamento, escrevendo
          para <Contact />. Os dados salvos no seu navegador são apagados quando você clica em “Sair” ou limpa os dados do
          navegador. Os leads também podem ser apagados em “Minha empresa”.
        </p>
      </Section>

      <Section title="7. Retenção">
        <p>
          Mantemos os dados de pagamento e assinatura pelo tempo exigido pela legislação fiscal e de defesa do
          consumidor. Os demais dados são excluídos quando você pedir ou ao final da relação.
        </p>
      </Section>
    </LegalLayout>
  );
}
