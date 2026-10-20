import { useEffect, useState } from 'react';
import { whatsappMessages } from '../config/site';
import { WhatsAppIcon } from './BrandIcons';
import { WhatsAppLink } from './ui';

/**
 * Botão flutuante: aparece depois do topo da página e some quando o CTA final
 * ou o rodapé entram na tela, para nunca cobrir links e informações de contato.
 */
export function WhatsAppButton() {
  const [pastHero, setPastHero] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const onScroll = () => setPastHero(window.scrollY > window.innerHeight * 0.7);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const targets = document.querySelectorAll('[data-hide-fab]');
    const inView = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) inView.add(e.target);
        else inView.delete(e.target);
      }
      setBlocked(inView.size > 0);
    });
    targets.forEach((t) => observer.observe(t));

    return () => {
      window.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, []);

  const visible = pastHero && !blocked;

  return (
    <div
      className={`fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 transition-[opacity,transform] duration-300 sm:right-6 sm:bottom-6 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`}
      inert={!visible}
    >
      <WhatsAppLink
        message={whatsappMessages.general}
        cta="flutuante"
        showIcon={false}
        ariaLabel="Agendar pelo WhatsApp (abre em nova aba)"
        className="flex size-14 items-center justify-center gap-2 rounded-full bg-wine-800 text-white shadow-[0_14px_30px_-10px_rgb(75_23_40/0.6)] ring-4 ring-white/80 transition-colors hover:bg-wine-950 sm:size-auto sm:min-h-14 sm:pr-5 sm:pl-4"
      >
        <WhatsAppIcon className="size-6" />
        <span className="hidden text-[0.92rem] font-semibold sm:inline">Agendar</span>
      </WhatsAppLink>
    </div>
  );
}
