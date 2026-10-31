import { Navigation } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Intent } from '../config/site';
import { DirectionsLink, WhatsAppLink } from './ui';

/**
 * Mobile: barra fixa inferior que aparece depois da primeira dobra.
 * Desktop: botão flutuante discreto no canto.
 * Some quando o CTA final ou o rodapé estão visíveis, para não duplicar
 * nem cobrir conteúdo.
 */
export function StickyCTA({ intent }: { intent: Intent }) {
  const [pastHero, setPastHero] = useState(false);
  const [nearEnd, setNearEnd] = useState(false);

  useEffect(() => {
    const hero = document.getElementById('topo');
    const end = document.getElementById('rodape');
    if (!('IntersectionObserver' in window)) return;
    const io1 = new IntersectionObserver(([e]) => setPastHero(!e.isIntersecting), { threshold: 0 });
    const io2 = new IntersectionObserver(([e]) => setNearEnd(e.isIntersecting), { threshold: 0 });
    if (hero) io1.observe(hero);
    if (end) io2.observe(end);
    return () => {
      io1.disconnect();
      io2.disconnect();
    };
  }, []);

  const visible = pastHero && !nearEnd;

  return (
    <>
      <div
        className={`safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-3 pt-3 backdrop-blur-md transition-transform duration-300 md:hidden ${
          visible ? 'translate-y-0' : 'pointer-events-none translate-y-full'
        }`}
        inert={!visible}
      >
        <div className="flex gap-2">
          <WhatsAppLink intent={intent} source="sticky" className="btn-primary flex-1 !px-4" ctaId="barra-mobile">
            Agendar pelo WhatsApp
          </WhatsAppLink>
          <DirectionsLink source="sticky" className="btn-ghost !px-4">
            <Navigation aria-hidden="true" strokeWidth={1.5} className="size-4" />
            <span>Como chegar</span>
          </DirectionsLink>
        </div>
      </div>

      <div
        className={`fixed right-6 bottom-6 z-30 hidden transition-[opacity,transform] duration-300 md:block ${
          visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
        }`}
        inert={!visible}
      >
        <WhatsAppLink intent={intent} source="floating" className="btn-primary !min-h-12 shadow-[0_12px_30px_-12px_rgb(26_26_26/0.5)]">
          Agendar
        </WhatsAppLink>
      </div>
    </>
  );
}
