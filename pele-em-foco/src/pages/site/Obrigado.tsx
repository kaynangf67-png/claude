import { Link } from 'react-router-dom';
import { Mail, MonitorSmartphone, LifeBuoy, MailCheck } from 'lucide-react';
import { ConfigPending } from '../../components/ui';
import { launch } from '../../config/launch';

/**
 * Página de obrigado configurada na Cakto (Produto → Upsell/Downsell → página de agradecimento personalizada).
 * A Cakto só redireciona para cá após Pix ou cartão aprovados; no boleto ela mostra a página padrão dela.
 * Esta página NÃO confirma pagamento nem libera nada: só orienta os próximos passos.
 */
export function Obrigado() {
  return (
    <section className="section">
      <div className="container narrow stack-lg">
        <div className="stack">
          <p className="eyebrow">Próximos passos</p>
          <h1>Comprou o Pele em Foco? Veja como acessar o app.</h1>
          <p className="muted">A confirmação do pagamento é feita pela Cakto, a plataforma onde você pagou. O acesso é liberado na sua conta do app.</p>
        </div>

        <ol className="steps-list">
          <li className="card-flat row" style={{ alignItems: 'flex-start' }}>
            <Mail aria-hidden="true" />
            <div>
              <h2 className="h3">1. Aguarde a confirmação do pagamento</h2>
              <p className="small" style={{ marginBottom: 0 }}>
                A Cakto envia a confirmação para o e-mail da compra. Pix e cartão costumam ser aprovados na hora; boleto pode levar alguns dias úteis. Olhe também spam e promoções.
              </p>
            </div>
          </li>
          <li className="card-flat row" style={{ alignItems: 'flex-start' }}>
            <MonitorSmartphone aria-hidden="true" />
            <div className="stack">
              <h2 className="h3">2. Crie sua conta com o mesmo e-mail da compra</h2>
              <p className="small" style={{ marginBottom: 0 }}>
                Use exatamente o e-mail que você digitou no checkout. É por ele que o app encontra a sua compra.
              </p>
              <div className="row wrap">
                <Link to="/criar-conta" className="btn btn-primary">Criar conta</Link>
                <Link to="/entrar" className="btn btn-ghost">Já tenho conta</Link>
              </div>
            </div>
          </li>
          <li className="card-flat row" style={{ alignItems: 'flex-start' }}>
            <MailCheck aria-hidden="true" />
            <div>
              <h2 className="h3">3. Confirme o e-mail e entre</h2>
              <p className="small" style={{ marginBottom: 0 }}>
                Clique no link de confirmação que enviaremos. Ao entrar, o acesso <strong>vitalício</strong> é liberado automaticamente.
                Se a Cakto ainda estiver processando o pagamento, entre de novo mais tarde ou use “Verificar novamente” no app.
              </p>
            </div>
          </li>
          <li className="card-flat row" style={{ alignItems: 'flex-start' }}>
            <LifeBuoy aria-hidden="true" />
            <div className="stack">
              <h2 className="h3">Não funcionou?</h2>
              <p className="small" style={{ marginBottom: 0 }}>
                Confira se o pagamento foi aprovado no e-mail da Cakto e se a conta usa o mesmo e-mail da compra. Se estiver tudo certo e o acesso não liberou, fale com o suporte informando o e-mail usado na compra.
              </p>
              {launch.supportEmail ? <a href={`mailto:${launch.supportEmail}`}>{launch.supportEmail}</a> : <ConfigPending>e-mail de suporte (VITE_SUPPORT_EMAIL).</ConfigPending>}
            </div>
          </li>
        </ol>
      </div>
    </section>
  );
}
