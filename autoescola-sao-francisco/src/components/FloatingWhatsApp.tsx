import { useEffect, useState } from 'react';
import { messages } from '../config/site';
import { isWhatsAppConfigured, whatsappUrl } from '../lib/whatsapp';
import { WhatsAppIcon } from './BrandIcons';

/**
 * Botão fixo discreto: aparece depois da primeira dobra e some
 * quando o rodapé ou a chamada final já estão na tela.
 * Só existe quando o número do WhatsApp está configurado.
 */
export function FloatingWhatsApp() {
  const [pastHero, setPastHero] = useState(false);
  const [nearEnd, setNearEnd] = useState(false);

  useEffect(() => {
    const onScroll = () => setPastHero(window.scrollY > window.innerHeight * 0.8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const targets = document.querySelectorAll('footer, [aria-labelledby="final-title"]');
    const visible = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.add(e.target);
        else visible.delete(e.target);
      }
      setNearEnd(visible.size > 0);
    });
    targets.forEach((t) => observer.observe(t));

    return () => {
      window.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, []);

  if (!isWhatsAppConfigured) return null;
  const show = pastHero && !nearEnd;

  return (
    <a
      href={whatsappUrl(messages.general)}
      target="_blank"
      rel="noopener noreferrer"
      data-cta="flutuante"
      aria-label="Falar com a Auto Escola São Francisco pelo WhatsApp"
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
      className={`fixed right-4 bottom-4 z-40 inline-flex size-14 items-center justify-center rounded-full bg-lime-400 text-forest-950 shadow-[0_12px_30px_-10px_rgb(8_23_15/0.6)] transition-[opacity,transform] duration-300 hover:bg-lime-300 sm:right-6 sm:bottom-6 ${
        show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
      }`}
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      <WhatsAppIcon className="size-7" />
    </a>
  );
}
