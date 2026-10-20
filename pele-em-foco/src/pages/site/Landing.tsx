import { Link } from 'react-router-dom';
import { BookOpen, Check, ClipboardList, Gift, Leaf, NotebookPen, ShieldCheck, SunMoon, X } from 'lucide-react';
import { CheckoutButton } from '../../components/CheckoutButton';
import { ConfigPending } from '../../components/ui';
import { BONUS_DAYS, launch } from '../../config/launch';

const CHAPTERS = [
  ['Entendendo a acne', 'Cravos, espinhas, oleosidade e por que a acne não tem uma causa única.'],
  ['Rotina da manhã', 'Limpar, hidratar e proteger do sol — sem complicar.'],
  ['Rotina da noite', 'Remover, limpar, tratar (se houver) e hidratar.'],
  ['Rótulos e ingredientes', 'Ácido salicílico, peróxido de benzoíla, retinoides, niacinamida: função e cuidados.'],
  ['Como comparar produtos', 'Função, ingredientes, preço por uso e uma planilha pronta.'],
  ['Alimentação e acne', 'O que a pesquisa sugere, o que é incerto e o que é mito.'],
  ['Hábitos, erros e mitos', 'O que parar de fazer conta tanto quanto o que fazer.'],
  ['Quando procurar dermatologista', 'Sinais para buscar avaliação e como chegar preparado(a) à consulta.'],
  ['Plano de 30 dias', 'Organização de hábitos com registro imprimível.'],
  ['Perguntas frequentes', 'Respostas diretas para as dúvidas mais comuns.'],
  ['Referências', 'AAD, SBD, Ministério da Saúde e estudos revisados, com links.'],
  ['Glossário', 'Os termos de skincare explicados em português claro.'],
] as const;

const SAMPLES = [
  { src: '/amostras/sumario.png', alt: 'Página de sumário do e-book Pele em Foco com os 12 capítulos' },
  { src: '/amostras/como-a-acne-se-forma.png', alt: 'Página do capítulo Entendendo a acne, explicando como uma espinha se forma e os tipos de lesão' },
  { src: '/amostras/como-ler-um-rotulo.png', alt: 'Página do capítulo sobre rótulos, com tabela de termos como não comedogênico e oil free' },
  { src: '/amostras/registro-30-dias.png', alt: 'Registro de hábitos de 30 dias para imprimir' },
];

const FAQ = [
  { q: 'Quais formas de pagamento?', a: 'O checkout é da Cakto, uma plataforma de pagamentos brasileira. As formas disponíveis (como Pix e cartão) aparecem na tela de pagamento. Este site não vê nem guarda seus dados de pagamento.' },
  { q: 'Em que formato vem o e-book?', a: 'PDF em português, com 53 páginas, pensado para ler no celular e também para imprimir as fichas e o registro de 30 dias.' },
  { q: 'Como recebo?', a: launch.caktoDelivery === 'members' ? 'O pagamento é feito na Cakto. Assim que ele é aprovado, você recebe por e-mail o login da área de membros da Cakto, onde estão o e-book em PDF e o link do app bônus.' : 'O pagamento é feito na Cakto. Assim que ele é aprovado, a Cakto envia para o seu e-mail o acesso ao e-book em PDF. O link do app bônus está no próprio e-book e na página de próximos passos.' },
  { q: 'Serve para homens e mulheres?', a: 'Sim. A pele não tem gênero, e o guia trata de barba, maquiagem, treino e outros contextos do dia a dia.' },
  { q: 'O guia substitui o dermatologista?', a: 'Não. Ele ajuda você a entender a acne, organizar uma rotina básica e reconhecer quando procurar avaliação. Ele não diagnostica nem indica tratamento.' },
  { q: 'Vou ter resultado em quanto tempo?', a: 'Não prometemos prazo nem resultado. Cada pele responde de um jeito, e tratamentos para acne costumam levar semanas. O que o guia oferece é informação confiável e um método para manter constância.' },
  { q: 'O guia indica marcas?', a: 'O guia ensina a avaliar produtos por função, ingredientes e preço. No app há alguns exemplos com link de afiliado do Mercado Livre: se você comprar por eles, o Pele em Foco recebe uma comissão, sem custo extra para você. Nenhuma marca paga para aparecer, e os critérios valem para qualquer produto.' },
  { q: 'Meus dados do app ficam onde?', a: 'Numa conta sua, protegida por e-mail e senha. Só você vê sua rotina e seu diário. Não pedimos fotos do rosto nem informações médicas, e você pode exportar ou apagar tudo quando quiser.' },
  { q: 'Quando começam os 30 dias do app?', a: 'Na ativação: quando você cria a conta com o mesmo e-mail da compra e confirma esse e-mail. Se você comprar hoje e criar a conta daqui a uma semana, os 30 dias começam daqui a uma semana.' },
];

function BonusTerms() {
  return (
    <p>
      Quem compra o e-book ganha <strong>{BONUS_DAYS} dias de acesso ao app</strong>, contados a partir da ativação. A ativação é automática quando você
      cria sua conta com <strong>o mesmo e-mail da compra</strong> e confirma esse e-mail. Depois dos {BONUS_DAYS} dias, você continua podendo ver, exportar
      e apagar seus registros.
    </p>
  );
}

function Price() {
  return launch.priceLabel ? (
    <p className="price">{launch.priceLabel}</p>
  ) : (
    <ConfigPending>preço (VITE_PRICE_LABEL).</ConfigPending>
  );
}

export function Landing() {
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="stack-lg">
            <p className="eyebrow">E-book + app de rotina como bônus</p>
            <h1 className="display">
              Entenda sua pele. <span className="italic-accent">Organize sua rotina.</span> Escolha com mais consciência.
            </h1>
            <p className="lead">
              Um guia prático sobre acne e pele oleosa, em português claro, construído a partir de fontes como a Academia Americana de Dermatologia,
              a Sociedade Brasileira de Dermatologia e o Ministério da Saúde.
            </p>
            <div className="row wrap" style={{ gap: 'var(--space-4)' }}>
              <CheckoutButton />
              <a href="#conteudo-do-guia" className="btn btn-ghost">Ver o que tem dentro</a>
            </div>
            <ul className="hero-points small">
              <li><Check size={16} aria-hidden="true" /> 12 capítulos + glossário</li>
              <li><Check size={16} aria-hidden="true" /> Fichas e registro de 30 dias para imprimir</li>
              <li><Check size={16} aria-hidden="true" /> App de rotina e diário como bônus</li>
            </ul>
          </div>
          <div className="hero-cover">
            <img src="/capa-pele-em-foco.png" width={560} height={795} alt="Capa do e-book Pele em Foco: Guia prático para entender a acne e organizar sua rotina de cuidados" />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container narrow stack-lg center-text">
          <p className="eyebrow">Por que este guia existe</p>
          <h2>Muita informação, pouca clareza.</h2>
          <p className="lead">
            Vídeo dizendo que leite causa espinha, outro dizendo que não. Prateleira com sérum, tônico, ácido e esfoliante. Dica caseira com limão e pasta de dente.
            O Pele em Foco organiza o que as fontes confiáveis dizem — inclusive o que ainda é incerto.
          </p>
        </div>
      </section>

      <section className="section alt" id="conteudo-do-guia">
        <div className="container stack-lg">
          <div className="stack" style={{ maxWidth: 640 }}>
            <p className="eyebrow">O que tem dentro</p>
            <h2>Do básico ao rótulo, sem enrolação.</h2>
          </div>
          <ol className="chapter-grid">
            {CHAPTERS.map(([title, text], i) => (
              <li key={title} className="card-flat">
                <span className="chapter-num">{i < CHAPTERS.length - 1 ? `Capítulo ${String(i + 2).padStart(2, '0')}` : 'Extra'}</span>
                <h3>{title}</h3>
                <p className="small muted">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section" aria-labelledby="amostras">
        <div className="container stack-lg">
          <div className="stack" style={{ maxWidth: 640 }}>
            <p className="eyebrow">Amostra</p>
            <h2 id="amostras">Veja algumas páginas.</h2>
            <p className="muted">Layout editorial, leitura confortável no celular e páginas práticas para imprimir.</p>
          </div>
          <div className="samples">
            {SAMPLES.map((s) => (
              <figure key={s.src}>
                <img src={s.src} alt={s.alt} loading="lazy" width={640} height={907} />
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="section alt" id="bonus" aria-labelledby="bonus-title">
        <div className="container bonus-grid">
          <div className="stack-lg">
            <p className="eyebrow"><Gift size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> Bônus para quem compra</p>
            <h2 id="bonus-title">App Pele em Foco: o guia vira hábito.</h2>
            <p className="lead">Saber o que fazer é metade do caminho. A outra metade é lembrar de fazer.</p>
            <ul className="feature-list">
              <li><SunMoon aria-hidden="true" /><span><strong>Rotina de manhã e de noite</strong> com checklists ajustados às suas preferências.</span></li>
              <li><NotebookPen aria-hidden="true" /><span><strong>Diário da pele</strong> com anotações opcionais e histórico de hábitos.</span></li>
              <li><BookOpen aria-hidden="true" /><span><strong>Biblioteca</strong> com resumos dos temas do guia e links para as fontes.</span></li>
              <li><ClipboardList aria-hidden="true" /><span><strong>Guia de produtos</strong> por categoria: o que procurar e o que evitar.</span></li>
            </ul>
          </div>
          <div className="card stack">
            <h3>Condições do bônus</h3>
            <BonusTerms />
            <ul className="small" style={{ marginBottom: 0, paddingLeft: '1.2rem' }}>
              <li>Funciona no navegador do celular ou do computador, sem instalar nada.</li>
              <li>Conta própria com e-mail e senha: seus registros acompanham você em qualquer aparelho.</li>
              <li>O link do app está na última página do e-book e na página de próximos passos.</li>
              <li>Não pede fotos do rosto e não faz diagnóstico.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container grid grid-2">
          <div className="card-sage stack">
            <h2 className="h3">Para quem é</h2>
            <ul className="icon-list">
              <li><Check size={18} aria-hidden="true" /> Jovens adultos — e qualquer pessoa — que querem entender a própria acne.</li>
              <li><Check size={18} aria-hidden="true" /> Quem tem pele oleosa e não sabe por onde começar.</li>
              <li><Check size={18} aria-hidden="true" /> Quem quer gastar menos com produtos que não fazem sentido.</li>
              <li><Check size={18} aria-hidden="true" /> Quem quer chegar mais preparado(a) a uma consulta.</li>
            </ul>
          </div>
          <div className="card-beige stack">
            <h2 className="h3">Para quem não é</h2>
            <ul className="icon-list">
              <li><X size={18} aria-hidden="true" /> Quem procura diagnóstico ou receita de medicamento.</li>
              <li><X size={18} aria-hidden="true" /> Quem tem acne dolorosa, com nódulos ou cicatrizes e ainda não passou por dermatologista — comece pela consulta.</li>
              <li><X size={18} aria-hidden="true" /> Quem espera “pele perfeita em 7 dias”.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="container narrow stack-lg">
          <div className="row" style={{ gap: 'var(--space-3)' }}><ShieldCheck aria-hidden="true" /><p className="eyebrow" style={{ marginBottom: 0 }}>Compromisso editorial</p></div>
          <h2>O que este guia não promete.</h2>
          <div className="grid grid-2">
            <p className="small"><strong>Não promete cura.</strong> Acne tem várias causas, e cada pele responde de um jeito.</p>
            <p className="small"><strong>Não promete prazo.</strong> Tratamentos costumam levar semanas; o plano de 30 dias organiza hábitos, não garante resultado.</p>
            <p className="small"><strong>Não usa antes e depois.</strong> Nem depoimentos inventados, nem fotos geradas por IA.</p>
            <p className="small"><strong>Não vende dieta milagrosa.</strong> O capítulo sobre alimentação mostra o que a pesquisa diz e o que ainda é incerto.</p>
          </div>
        </div>
      </section>

      <section className="section" id="comprar" aria-labelledby="oferta">
        <div className="container narrow">
          <div className="card-forest offer stack-lg">
            <div className="row" style={{ gap: 'var(--space-3)' }}><Leaf aria-hidden="true" /><p className="eyebrow" style={{ marginBottom: 0, color: 'var(--pf-sage)' }}>Pele em Foco</p></div>
            <h2 id="oferta">Tudo o que está incluído</h2>
            <ul className="icon-list">
              <li><Check size={18} aria-hidden="true" /> E-book em PDF com 12 capítulos, glossário e referências</li>
              <li><Check size={18} aria-hidden="true" /> Checklists, ficha para consulta e planilha de comparação</li>
              <li><Check size={18} aria-hidden="true" /> Registro de hábitos de 30 dias para imprimir</li>
              <li><Check size={18} aria-hidden="true" /> {BONUS_DAYS} dias de acesso ao app Pele em Foco como bônus</li>
            </ul>
            <Price />
            <CheckoutButton />
            <p className="small" style={{ color: 'var(--pf-sage-soft)', margin: 0 }}>
              Pagamento seguro processado pela Cakto. Você tem {launch.refundDays} dias a partir da compra para pedir reembolso, conforme os{' '}
              <Link to="/termos" style={{ color: 'inherit' }}>termos</Link>.
            </p>
          </div>
        </div>
      </section>

      <section className="section alt" id="perguntas" aria-labelledby="faq-title">
        <div className="container narrow stack">
          <h2 id="faq-title">Perguntas frequentes</h2>
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
        </div>
      </section>
    </>
  );
}
