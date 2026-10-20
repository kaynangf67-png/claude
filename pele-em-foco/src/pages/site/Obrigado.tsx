import { Link } from 'react-router-dom';
import { Mail, MonitorSmartphone, Download, LifeBuoy } from 'lucide-react';
import { ConfigPending } from '../../components/ui';
import { launch } from '../../config/launch';
import { formatLong } from '../../lib/dates';

/**
 * Página de pós-compra (URL de redirecionamento do checkout).
 * Ela NÃO confirma pagamento nem libera nada: só orienta os próximos passos.
 */
export function Obrigado() {
  return (
    <section className="section">
      <div className="container narrow stack-lg">
        <div className="stack">
          <p className="eyebrow">Próximos passos</p>
          <h1>Comprou o Pele em Foco? Veja como acessar.</h1>
          <p className="muted">Esta página explica o caminho. A confirmação do pagamento e o envio do e-book são feitos pela plataforma de pagamento.</p>
        </div>

        <ol className="steps-list">
          <li className="card-flat row" style={{ alignItems: 'flex-start' }}>
            <Mail aria-hidden="true" />
            <div>
              <h2 className="h3">1. Confira seu e-mail</h2>
              <p className="small" style={{ marginBottom: 0 }}>Depois que o pagamento é aprovado, a plataforma envia um e-mail com o link de download. Pix e cartão costumam ser rápidos; boleto pode levar alguns dias úteis. Olhe também a caixa de spam e promoções.</p>
            </div>
          </li>
          <li className="card-flat row" style={{ alignItems: 'flex-start' }}>
            <Download aria-hidden="true" />
            <div>
              <h2 className="h3">2. Baixe o e-book</h2>
              <p className="small" style={{ marginBottom: 0 }}>O PDF abre no celular e no computador. Se quiser, imprima as fichas e o registro de 30 dias.</p>
            </div>
          </li>
          <li className="card-flat row" style={{ alignItems: 'flex-start' }}>
            <MonitorSmartphone aria-hidden="true" />
            <div className="stack">
              <h2 className="h3">3. Abra o app bônus</h2>
              <p className="small" style={{ marginBottom: 0 }}>
                O link também está no e-mail e na última página do e-book. Funciona no navegador; dá para adicionar à tela inicial do celular pelo menu do navegador.
              </p>
              {launch.bonusEndDate ? (
                <p className="small" style={{ marginBottom: 0 }}>Acesso gratuito até <strong>{formatLong(launch.bonusEndDate)}</strong>.</p>
              ) : (
                <ConfigPending>data final do bônus (VITE_BONUS_END_DATE).</ConfigPending>
              )}
              <Link to="/app" className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>Abrir o app</Link>
            </div>
          </li>
          <li className="card-flat row" style={{ alignItems: 'flex-start' }}>
            <LifeBuoy aria-hidden="true" />
            <div className="stack">
              <h2 className="h3">Não recebeu?</h2>
              <p className="small" style={{ marginBottom: 0 }}>Confira o status da compra na plataforma de pagamento (o e-mail de confirmação dela traz o link da sua área de compras). Se o pagamento estiver aprovado e o e-mail não chegou, fale com o suporte.</p>
              {launch.supportEmail ? <a href={`mailto:${launch.supportEmail}`}>{launch.supportEmail}</a> : <ConfigPending>e-mail de suporte (VITE_SUPPORT_EMAIL).</ConfigPending>}
            </div>
          </li>
        </ol>
      </div>
    </section>
  );
}
