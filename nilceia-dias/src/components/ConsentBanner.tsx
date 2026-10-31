import { useEffect, useState } from 'react';
import { OPEN_CONSENT_EVENT, getConsent, setConsent } from '../lib/consent';
import { hasTracking, trackingIds } from '../lib/analytics';

/**
 * Banner de consentimento (LGPD). Só aparece se houver algum ID de
 * rastreamento configurado; sem IDs, o site não usa cookies não essenciais.
 */
export function ConsentBanner() {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    if (!hasTracking) return;
    const c = getConsent();
    if (!c) setOpen(true);
    else {
      setAnalytics(c.analytics);
      setMarketing(c.marketing);
    }
    const reopen = () => {
      setCustom(true);
      setOpen(true);
    };
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
  }, []);

  if (!open) return null;

  const save = (a: boolean, m: boolean) => {
    setConsent(a, m);
    setOpen(false);
  };
  const hasAnalytics = Boolean(trackingIds.gtm || trackingIds.ga4);
  const hasMarketing = Boolean(trackingIds.gtm || trackingIds.metaPixel);

  return (
    <div role="dialog" aria-modal="false" aria-labelledby="cookies-titulo" className="fixed inset-x-3 bottom-3 z-50 border border-line bg-paper p-5 shadow-[0_20px_50px_-20px_rgb(26_26_26/0.45)] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:max-w-md sm:p-6">
      <h2 id="cookies-titulo" className="display text-[1.4rem] leading-tight">Sua privacidade</h2>
      <p className="mt-2 text-sm text-muted">
        Usamos cookies para medir o desempenho do site e dos anúncios. Nenhum dado de contato é compartilhado. Você pode escolher o que
        autoriza. <a href="/privacidade/" className="underline underline-offset-2">Saiba mais</a>.
      </p>

      {custom && (
        <fieldset className="mt-4 space-y-1 border-t border-line pt-3">
          <legend className="sr-only">Categorias de cookies</legend>
          <label className="flex min-h-11 items-center justify-between gap-4 text-sm">
            <span>Essenciais (sempre ativos)</span>
            <input type="checkbox" checked disabled className="size-5 accent-onyx" />
          </label>
          {hasAnalytics && (
            <label className="flex min-h-11 items-center justify-between gap-4 text-sm">
              <span>Medição de audiência (Google Analytics)</span>
              <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} className="size-5 accent-onyx" />
            </label>
          )}
          {hasMarketing && (
            <label className="flex min-h-11 items-center justify-between gap-4 text-sm">
              <span>Marketing (Meta / Google Ads)</span>
              <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="size-5 accent-onyx" />
            </label>
          )}
        </fieldset>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        {custom ? (
          <button type="button" className="btn-primary col-span-2 !min-h-11" onClick={() => save(analytics, marketing)}>
            Salvar escolhas
          </button>
        ) : (
          <>
            <button type="button" className="btn-ghost !min-h-11 !px-3" onClick={() => save(false, false)}>
              Recusar
            </button>
            <button type="button" className="btn-primary !min-h-11 !px-3" onClick={() => save(true, true)}>
              Aceitar
            </button>
            <button type="button" className="col-span-2 min-h-11 text-xs tracking-[0.14em] text-muted uppercase underline-offset-4 hover:underline" onClick={() => setCustom(true)}>
              Personalizar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
