import { Link } from 'react-router-dom';
import { Mail, MonitorSmartphone, Download, LifeBuoy } from 'lucide-react';
import { ConfigPending } from '../../components/ui';
import { BONUS_DAYS, launch } from '../../config/launch';

/**
 * Página de obrigado configurada na Cakto (Produto → Upsell/Downsell → página de agradecimento personalizada).
 * A Cakto só redireciona para cá após Pix ou cartão aprovados; no boleto ela mostra a página padrão dela.
 * Esta página NÃO confirma pagamento nem libera nada: só orienta os próximos passos.
 */
export function Obrigado() {
  const members = launch.caktoDelivery === 'members';

  return (
    <section className="section">
      <div className="container narrow stack-lg">
        <div className="stack">
          <p className="eyebrow">Próximos passos</p>
          <h1>Comprou o Pele em Foco? Veja como acessar.</h1>
          <p className="muted">A confirmação do pagamento e o envio do e-book são feitos pela Cakto, a plataforma onde você pagou.</p>
        </div>

        <ol className="steps-list">
          <li className="card-flat row" style={{ alignItems: 'flex-start' }}>
            <Mail aria-hidden="true" />
            <div>
              <h2 className="h3">1. Confira seu e-mail</h2>
              <p className="small" style={{ marginBottom: 0 }}>
                {members
                  ? 'Com o pagamento aprovado, a Cakto envia para o e-mail da compra o seu login da área de membros.'
                  : 'Com o pagamento aprovado, a Cakto envia para o e-mail da compra o acesso ao e-book.'}{' '}
                Pix e cartão costumam ser aprovados na hora; boleto pode levar alguns dias úteis. Olhe também spam e promoções.
              </p>
            </div>
          </li>
          <li className="card-flat row" style={{ alignItems: 'flex-start' }}>
            <Download aria-hidden="true" />
            <div>
              <h2 className="h3">2. Baixe o e-book</h2>
              <p className="small" style={{ marginBottom: 0 }}>
                {members ? (
                  <>
                    Entre na área de membros da Cakto em <a href="https://aluno.cakto.com.br" target="_blank" rel="noopener noreferrer">aluno.cakto.com.br</a> com o login recebido e baixe o PDF.{' '}
                  </>
                ) : (
                  'Abra o e-mail da Cakto e baixe o PDF. '
                )}
                Ele abre no celular e no computador; se quiser, imprima as fichas e o registro de 30 dias.
              </p>
            </div>
          </li>
          <li className="card-flat row" style={{ alignItems: 'flex-start' }}>
            <MonitorSmartphone aria-hidden="true" />
            <div className="stack">
              <h2 className="h3">3. Crie sua conta no app com o mesmo e-mail da compra</h2>
              <p className="small" style={{ marginBottom: 0 }}>
                Confirme o e-mail pelo link que enviaremos. Assim que a compra aprovada for vinculada à sua conta, os <strong>{BONUS_DAYS} dias de acesso</strong> começam a contar.
                Se a Cakto ainda estiver processando o pagamento, entre de novo mais tarde ou use “Verificar novamente” no app.
              </p>
              <div className="row wrap">
                <Link to="/criar-conta" className="btn btn-primary">Criar conta</Link>
                <Link to="/entrar" className="btn btn-ghost">Já tenho conta</Link>
              </div>
            </div>
          </li>
          <li className="card-flat row" style={{ alignItems: 'flex-start' }}>
            <LifeBuoy aria-hidden="true" />
            <div className="stack">
              <h2 className="h3">Não recebeu?</h2>
              <p className="small" style={{ marginBottom: 0 }}>
                Confira se o pagamento foi aprovado no e-mail de confirmação da Cakto e se o e-mail digitado na compra está certo. Se estiver tudo aprovado e o acesso não chegou, fale com o suporte informando o e-mail usado na compra.
              </p>
              {launch.supportEmail ? <a href={`mailto:${launch.supportEmail}`}>{launch.supportEmail}</a> : <ConfigPending>e-mail de suporte (VITE_SUPPORT_EMAIL).</ConfigPending>}
            </div>
          </li>
        </ol>
      </div>
    </section>
  );
}
