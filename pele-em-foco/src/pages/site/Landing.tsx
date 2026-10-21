import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Check, ClipboardList, Download, Leaf, NotebookPen, ShieldCheck, SunMoon, X } from 'lucide-react';
import { CheckoutButton } from '../../components/CheckoutButton';
import { ConfigPending } from '../../components/ui';
import { launch } from '../../config/launch';

const FEATURES = [
  { icon: SunMoon, title: 'Rotina de manhã e de noite', text: 'Checklist simples dos passos do dia, com progresso e histórico.' },
  { icon: NotebookPen, title: 'Diário da pele', text: 'Anote como a pele está e o que você usou, para perceber o que ajuda e mostrar ao dermatologista.' },
  { icon: BookOpen, title: 'Biblioteca com fontes', text: 'Artigos curtos sobre acne, rótulos, protetor solar e mitos, com links para AAD, SBD e Ministério da Saúde.' },
  { icon: ClipboardList, title: 'Guia de produtos e questionário', text: 'O que procurar e o que evitar em cada tipo de produto, e um questionário para saber por onde começar.' },
  { icon: Download, title: 'Seus dados são seus', text: 'Sem foto do rosto. Exporte ou apague tudo quando quiser.' },
] as const;

const FAQ = [
  { q: 'Quais formas de pagamento?', a: 'O checkout é da Cakto, uma plataforma de pagamentos brasileira. As formas disponíveis (como Pix e cartão) aparecem na tela de pagamento. Este site não vê nem guarda seus dados de pagamento.' },
  { q: 'Como recebo o acesso?', a: 'Depois do pagamento aprovado, crie sua conta no app com o mesmo e-mail usado na compra e confirme esse e-mail. O acesso é liberado automaticamente. O passo a passo também está na página “Já comprei: como acessar”.' },
  { q: 'Preciso instalar alguma coisa?', a: 'Não. O app abre no navegador do celular ou do computador, com login por e-mail e senha.' },
  { q: 'O acesso expira? Tem mensalidade?', a: 'Não. O pagamento é único e o acesso é vitalício, sem mensalidade nem cobrança automática. Se um dia o app for descontinuado, você será avisado(a) com antecedência e poderá exportar seus registros (veja os termos).' },
  { q: 'Serve para homens e mulheres?', a: 'Sim. A pele não tem gênero, e o app trata de barba, maquiagem, treino e outros contextos do dia a dia.' },
  { q: 'O app substitui o dermatologista?', a: 'Não. Ele ajuda você a entender a acne, manter uma rotina básica e reconhecer quando procurar avaliação. Ele não diagnostica nem indica tratamento.' },
  { q: 'Vou ter resultado em quanto tempo?', a: 'Não prometemos prazo nem resultado. Cada pele responde de um jeito, e cuidados para acne costumam levar semanas. O que o app oferece é informação confiável e um jeito de manter constância.' },
  { q: 'O app indica marcas?', a: 'O guia ensina a avaliar produtos por função, ingredientes e preço. Há alguns exemplos com link de afiliado do Mercado Livre: se você comprar por eles, o Pele em Foco recebe uma comissão, sem custo extra para você. Nenhuma marca paga para aparecer.' },
  { q: 'Meus dados ficam onde?', a: 'Numa conta sua, protegida por e-mail e senha. Só você vê sua rotina e seu diário. Não pedimos fotos do rosto, e você pode exportar ou apagar tudo quando quiser.' },
];

/** Cartão de oferta do app, usado no resultado do teste e em /conhecer. */
export function AppOffer({ eyebrow, text }: { eyebrow: string; text: string }) {
  return (
    <section className="card-forest stack-lg teste-offer" aria-labelledby="oferta" id="comprar">
      <div className="stack">
        <p className="eyebrow" style={{ color: 'var(--pf-sage-soft)' }}>{eyebrow}</p>
        <h2 id="oferta">App Pele em Foco</h2>
        <p style={{ color: 'var(--pf-sage-soft)', marginBottom: 0 }}>{text}</p>
      </div>
      <ul className="hero-points small teste-points">
        <li><Check size={16} aria-hidden="true" /> Rotina de manhã e de noite em checklist</li>
        <li><Check size={16} aria-hidden="true" /> Diário da pele com histórico</li>
        <li><Check size={16} aria-hidden="true" /> Biblioteca com fontes e guia de produtos</li>
        <li><Check size={16} aria-hidden="true" /> Acesso vitalício, pagamento único</li>
      </ul>
      <div className="row wrap" style={{ gap: 'var(--space-4)', alignItems: 'center' }}>
        {launch.priceLabel ? <p className="price">{launch.priceLabel}</p> : <ConfigPending>preço (VITE_PRICE_LABEL).</ConfigPending>}
        <CheckoutButton label="Quero o app" />
      </div>
      <p className="small" style={{ color: 'var(--pf-sage-soft)', margin: 0 }}>
        Pagamento seguro pela Cakto. Você tem {launch.refundDays} dias para pedir reembolso, conforme os <Link to="/termos" style={{ color: 'inherit' }}>termos</Link>.
      </p>
    </section>
  );
}

/** Detalhes do app, para quem quer saber mais antes de comprar. */
export function AppDetails() {
  return (
    <>
      <section className="stack-lg" id="recursos" aria-labelledby="recursos-title">
        <div className="stack">
          <p className="eyebrow">O que tem no app</p>
          <h2 id="recursos-title">Saber o que fazer é metade do caminho. A outra metade é lembrar de fazer.</h2>
        </div>
        <ul className="feature-list">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title}><Icon aria-hidden="true" /><span><strong>{title}.</strong> {text}</span></li>
          ))}
        </ul>
      </section>

      <div className="grid grid-2">
        <div className="card-sage stack">
          <h2 className="h3">Para quem é</h2>
          <ul className="icon-list">
            <li><Check size={18} aria-hidden="true" /> Quem quer entender a própria acne e não sabe por onde começar.</li>
            <li><Check size={18} aria-hidden="true" /> Quem tem pele oleosa e já gastou com produto que não fazia sentido.</li>
            <li><Check size={18} aria-hidden="true" /> Quem começa bem a rotina e larga depois de uma semana.</li>
            <li><Check size={18} aria-hidden="true" /> Quem quer acompanhar a pele para mostrar ao dermatologista.</li>
          </ul>
        </div>
        <div className="card-beige stack">
          <h2 className="h3">Para quem não é</h2>
          <ul className="icon-list">
            <li><X size={18} aria-hidden="true" /> Quem procura diagnóstico ou receita de medicamento.</li>
            <li><X size={18} aria-hidden="true" /> Quem tem acne dolorosa, com caroços ou cicatrizes e ainda não passou por dermatologista: comece pela consulta.</li>
            <li><X size={18} aria-hidden="true" /> Quem espera “pele perfeita em 7 dias”.</li>
          </ul>
        </div>
      </div>

      <section className="stack" aria-labelledby="compromisso">
        <div className="row" style={{ gap: 'var(--space-3)' }}><ShieldCheck aria-hidden="true" /><p className="eyebrow" style={{ marginBottom: 0 }}>Compromisso</p></div>
        <h2 id="compromisso" className="h3">O que o Pele em Foco não promete.</h2>
        <div className="grid grid-2">
          <p className="small"><strong>Não promete cura.</strong> Acne tem várias causas, e cada pele responde de um jeito.</p>
          <p className="small"><strong>Não promete prazo.</strong> Cuidados para acne levam semanas. O app ajuda na constância, não garante resultado.</p>
          <p className="small"><strong>Não usa antes e depois</strong> nem depoimentos inventados. As imagens do teste são ilustrativas, não fotos de pacientes.</p>
          <p className="small"><strong>Não esconde a comissão.</strong> Links de afiliado aparecem identificados.</p>
        </div>
      </section>

      <section className="stack" id="perguntas" aria-labelledby="faq-title">
        <h2 id="faq-title" className="h3">Perguntas frequentes</h2>
        <div>
          {FAQ.map((f) => (
            <details key={f.q} className="faq">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
          <details className="faq">
            <summary>E se eu não gostar?</summary>
            <p>Você pode pedir reembolso em até {launch.refundDays} dias após a compra, direto na Cakto (app.cakto.com.br/refund) ou pelo suporte. Detalhes nos <Link to="/termos">termos</Link>.</p>
          </details>
        </div>
      </section>
    </>
  );
}

/** /conhecer: para quem chega pelo menu ou quer pular o teste. */
export function Conhecer() {
  return (
    <section className="section">
      <div className="container narrow stack-lg">
        <header className="stack">
          <p className="eyebrow"><Leaf size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> App Pele em Foco</p>
          <h1>Sua rotina de pele, organizada e com informação confiável.</h1>
          <p className="lead">Rotina, diário e conteúdo com fontes num só lugar, no navegador do celular. Pagamento único, acesso vitalício.</p>
          <Link to="/" className="small row" style={{ gap: 'var(--space-2)' }}>Ainda não sabe o que a sua pele precisa? Faça o teste grátis <ArrowRight size={14} aria-hidden="true" /></Link>
        </header>
        <AppOffer eyebrow="Para montar e manter a sua rotina" text="Sua rotina de manhã e de noite em checklist, um diário para acompanhar como a pele reage, artigos com fontes e um guia para escolher produtos sem cair em promessa." />
        <AppDetails />
      </div>
    </section>
  );
}
