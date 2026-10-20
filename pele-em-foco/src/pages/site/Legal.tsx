import { Link } from 'react-router-dom';
import { ConfigPending } from '../../components/ui';
import { launch } from '../../config/launch';
import { formatLong } from '../../lib/dates';

function Draft() {
  return (
    <ConfigPending>
      este texto é um modelo. Revise com um profissional de direito antes de publicar e preencha responsável, CPF/CNPJ, contato e plataforma de pagamento.
    </ConfigPending>
  );
}

const responsible = () => `${launch.businessName ?? '[nome do responsável]'} (${launch.businessDocument ?? '[CPF/CNPJ]'})`;
const contact = () => launch.supportEmail ?? '[e-mail de suporte]';

export function Privacidade() {
  return (
    <section className="section">
      <article className="container narrow stack legal">
        <p className="eyebrow">Documento</p>
        <h1>Política de privacidade</h1>
        <Draft />
        <p className="small muted">Versão de outubro de 2026.</p>

        <h2>Quem somos</h2>
        <p>O Pele em Foco é um produto educativo de {responsible()}. Contato para assuntos de privacidade: {contact()}.</p>

        <h2>Site e página de vendas</h2>
        <p>Este site não usa cookies de rastreamento, pixels de anúncio ou ferramentas de análise nesta versão. Se isso mudar, esta política será atualizada antes.</p>
        <p>A compra acontece na plataforma de pagamento, que coleta os dados necessários (nome, e-mail, CPF, dados de pagamento) sob a política de privacidade dela. Recebemos dessa plataforma as informações da compra para entregar o produto e prestar suporte.</p>

        <h2>App Pele em Foco</h2>
        <ul>
          <li>Os dados que você registra no app (preferências, rotina, diário) ficam <strong>somente no armazenamento local do seu navegador</strong>. Eles não são enviados para nossos servidores.</li>
          <li>Não há criação de conta nesta versão e não pedimos fotos do rosto, documentos ou informações médicas.</li>
          <li>Você pode exportar ou apagar todos os dados a qualquer momento em Perfil. Limpar os dados do navegador também os remove.</li>
          <li>Como os dados ficam no seu aparelho, quem tiver acesso a ele pode vê-los. Use o bloqueio de tela do seu dispositivo.</li>
        </ul>

        <h2>Seus direitos (LGPD)</h2>
        <p>Você pode pedir confirmação, acesso, correção ou exclusão dos dados pessoais que tratamos (por exemplo, os dados da compra) pelo contato {contact()}.</p>
      </article>
    </section>
  );
}

export function Termos() {
  return (
    <section className="section">
      <article className="container narrow stack legal">
        <p className="eyebrow">Documento</p>
        <h1>Termos de uso e reembolso</h1>
        <Draft />
        <p className="small muted">Versão de outubro de 2026.</p>

        <h2>O produto</h2>
        <p>O Pele em Foco é composto por um e-book em PDF e, como bônus, acesso a um aplicativo web de organização de rotina. Fornecedor: {responsible()}.</p>

        <h2>Natureza educativa</h2>
        <p>O conteúdo é informativo e educativo. Não constitui diagnóstico, prescrição ou tratamento e não substitui consulta com médico dermatologista. Resultados variam de pessoa para pessoa e não são garantidos.</p>

        <h2>Uso do e-book</h2>
        <p>A compra dá direito a uso pessoal. Não é permitido revender, redistribuir ou publicar o arquivo, no todo ou em parte.</p>

        <h2>Bônus: app Pele em Foco</h2>
        <ul>
          <li>{launch.bonusEndDate ? <>O acesso gratuito ao app para compradores vale até <strong>{formatLong(launch.bonusEndDate)}</strong>.</> : '[Período de acesso gratuito a configurar.]'}</li>
          <li>Antes do fim desse período, comunicaremos pelo e-mail da compra as condições de uso depois dele. Não haverá cobrança automática sem a sua contratação expressa.</li>
          <li>Os registros feitos no app ficam no seu aparelho e podem ser exportados.</li>
          <li>O app é fornecido como bônus, sem garantia de disponibilidade ininterrupta.</li>
        </ul>

        <h2>Reembolso</h2>
        <p>Você pode desistir da compra em até <strong>{launch.refundDays} dias</strong> contados da compra ou do recebimento do produto, com devolução integral do valor. O prazo mínimo de 7 dias é o direito de arrependimento previsto no art. 49 do Código de Defesa do Consumidor para compras fora do estabelecimento comercial. O pedido pode ser feito pela plataforma de pagamento ou pelo contato {contact()}.</p>

        <h2>Contato</h2>
        <p>{contact()}. Veja também a <Link to="/privacidade">política de privacidade</Link>.</p>
      </article>
    </section>
  );
}

export function NotFound() {
  return (
    <section className="section">
      <div className="container narrow stack">
        <h1>Página não encontrada</h1>
        <p className="muted">O endereço pode ter mudado.</p>
        <div className="row wrap">
          <Link to="/" className="btn btn-primary">Ir para o início</Link>
          <Link to="/app" className="btn btn-secondary">Abrir o app</Link>
        </div>
      </div>
    </section>
  );
}
