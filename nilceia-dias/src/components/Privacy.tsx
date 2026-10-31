import { brand } from '../config/site';
import { hasTracking } from '../lib/analytics';
import { openConsentPanel } from '../lib/consent';

/**
 * Política de privacidade — MODELO. Revise com a responsável (e, se
 * possível, com um profissional jurídico) antes de publicar.
 */
export function Privacy() {
  return (
    <section className="pt-28 pb-20 sm:pt-36">
      <div className="wrap max-w-3xl">
        <p className="eyebrow">Transparência</p>
        <h1 className="h-section mt-6">Política de privacidade</h1>
        <div className="mt-10 space-y-6 text-muted [&_h2]:display [&_h2]:mt-10 [&_h2]:text-[1.6rem] [&_h2]:text-onyx">
          <p>
            Esta política explica como o site da {brand.name} ({brand.address.street}, {brand.address.neighborhood}, {brand.address.city} —{' '}
            {brand.address.state}) trata informações dos visitantes, em conformidade com a Lei Geral de Proteção de Dados (Lei nº
            13.709/2018).
          </p>
          <h2>Dados que o site coleta</h2>
          <p>
            O site não possui formulários e não pede nome, e-mail ou telefone. O contato acontece pelo WhatsApp, por iniciativa sua; ao
            tocar em um botão, o aplicativo abre com uma mensagem pronta que você pode editar ou não enviar.
          </p>
          <h2>Cookies e medição</h2>
          <p>
            Com a sua autorização, podemos usar ferramentas de medição (como Google Analytics) e de anúncios (como Meta Pixel e Google
            Ads) para entender quantas pessoas visitam o site, de quais campanhas vieram e quais botões foram usados. Esses registros não
            incluem seu telefone, nome ou o conteúdo das mensagens. Sem a sua autorização, essas ferramentas não são carregadas.
          </p>
          <p>
            O site também guarda no seu navegador a origem da visita (parâmetros de campanha, como utm_source) durante a sessão, para
            identificar de qual anúncio veio o contato. Essa referência pode aparecer, de forma resumida, no fim da mensagem do WhatsApp.
          </p>
          {hasTracking && (
            <p>
              <button type="button" onClick={openConsentPanel} className="underline underline-offset-4 hover:text-onyx">
                Alterar minhas preferências de cookies
              </button>
            </p>
          )}
          <h2>Mapa</h2>
          <p>O mapa da seção de localização é fornecido pelo Google e só é carregado quando você toca em “Carregar mapa”.</p>
          <h2>Seus direitos</h2>
          <p>
            Você pode pedir informações sobre o tratamento de dados, ou revogar autorizações, pelo WhatsApp {brand.phoneDisplay}.
          </p>
          <p className="text-sm">Última atualização: outubro de 2026.</p>
        </div>
        <a href="/" className="btn-ghost mt-12">
          Voltar ao site
        </a>
      </div>
    </section>
  );
}
