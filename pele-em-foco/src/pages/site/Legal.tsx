import { Link } from 'react-router-dom';
import { ConfigPending } from '../../components/ui';
import { launch } from '../../config/launch';

function Draft() {
  return (
    <ConfigPending>
      este texto é um modelo. Revise com um profissional de direito antes de publicar e preencha responsável, CPF/CNPJ e contato.
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
        <p>O <strong>teste de rotina</strong> (página /teste) funciona só no seu navegador: as respostas não são salvas nem enviadas para nós ou para terceiros.</p>
        <p>Este site não usa cookies de rastreamento, pixels de anúncio ou ferramentas de análise nesta versão. Se isso mudar, esta política será atualizada antes.</p>
        <p>A compra acontece no checkout da <strong>Cakto</strong>, que coleta os dados necessários (como nome, e-mail, CPF e dados de pagamento) e os trata conforme a política de privacidade dela. Não temos acesso aos dados do seu cartão. Recebemos da Cakto as informações da compra (como nome, e-mail e status do pagamento) para entregar o produto e prestar suporte.</p>

        <h2>App Pele em Foco</h2>
        <ul>
          <li><strong>Conta:</strong> e-mail, senha (guardada pelo provedor de autenticação apenas em formato criptográfico, nunca em texto), nome opcional e a data em que você aceitou o aviso educativo.</li>
          <li><strong>Uso do app:</strong> os passos da rotina que você marca, por data, e as anotações opcionais do diário (observações, produtos usados e texto livre).</li>
          <li><strong>Acesso:</strong> o vínculo entre sua conta e a compra (número do pedido e e-mail recebidos da Cakto) e a data de liberação do acesso.</li>
          <li>Os dados ficam no banco de dados do app, hospedado no Supabase. Regras no próprio banco garantem que cada conta só leia e altere os próprios registros.</li>
          <li>Não pedimos fotos do rosto, documentos ou diagnósticos. O diário é opcional e serve para observações pessoais; evite escrever informações de saúde que você não queira registrar.</li>
          <li>Você pode exportar seus dados, apagar rotina e diário ou excluir a conta inteira em Perfil, a qualquer momento.</li>
          <li>Não usamos seus registros para publicidade e não os vendemos.</li>
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
        <p>O Pele em Foco é um aplicativo web educativo de organização da rotina de cuidados com a pele, vendido por pagamento único. Fornecedor: {responsible()}. O pagamento é processado pela Cakto.</p>

        <h2>Natureza educativa</h2>
        <p>O conteúdo é informativo e educativo. Não constitui diagnóstico, prescrição ou tratamento e não substitui consulta com médico dermatologista. Resultados variam de pessoa para pessoa e não são garantidos.</p>

        <h2>Acesso ao app</h2>
        <ul>
          <li>A compra dá <strong>acesso vitalício</strong> ao app, sem mensalidade nem cobrança automática, para uso pessoal. O acesso é liberado quando a compra aprovada é vinculada a uma conta com o mesmo e-mail, já confirmado.</li>
          <li>Cada compra libera uma única conta. Não é permitido compartilhar a conta, revender o acesso ou copiar o conteúdo.</li>
          <li>Reembolso ou contestação do pagamento encerram o acesso. Seus registros continuam disponíveis para exportar ou apagar.</li>
          <li>“Vitalício” vale enquanto o app for oferecido. Não há garantia de disponibilidade ininterrupta. Se o app for descontinuado, avisaremos com pelo menos 30 dias de antecedência pelo e-mail da conta, e você poderá exportar seus registros.</li>
        </ul>

        <h2>Reembolso</h2>
        <p>Você pode desistir da compra em até <strong>{launch.refundDays} dias</strong> contados da compra ou do recebimento do produto, com devolução integral do valor. O prazo mínimo de 7 dias é o direito de arrependimento previsto no art. 49 do Código de Defesa do Consumidor para compras fora do estabelecimento comercial. O pedido pode ser feito diretamente na Cakto, em <a href="https://app.cakto.com.br/refund" target="_blank" rel="noopener noreferrer">app.cakto.com.br/refund</a>, ou pelo contato {contact()}. O estorno volta pelo mesmo meio de pagamento, no prazo da Cakto e da operadora.</p>

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
