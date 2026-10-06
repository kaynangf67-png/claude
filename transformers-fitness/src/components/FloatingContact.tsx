import { useEffect, useState } from 'react';
import { Phone } from 'lucide-react';
import { academia, messages } from '../config/academia';
import { channelLabel, contactUrl, hasWhatsApp } from '../lib/contact';
import { WhatsAppIcon } from './BrandIcons';

/** Botão flutuante de contato: sempre visível no celular; no desktop, aparece após a primeira dobra. */
export function FloatingContact() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const tooltip = hasWhatsApp ? 'Fale com a Transformers Fitness' : `Ligar: ${academia.phone.display}`;

  return (
    <a
      href={contactUrl(messages.default)}
      {...(hasWhatsApp ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      data-cta="flutuante"
      aria-label={hasWhatsApp ? 'Fale com a Transformers Fitness pelo WhatsApp' : channelLabel}
      className={`group fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex items-center transition duration-500 sm:right-6 sm:bottom-6 ${
        visible ? 'translate-y-0 opacity-100' : 'sm:pointer-events-none sm:translate-y-6 sm:opacity-0'
      }`}
    >
      <span className="pointer-events-none mr-3 hidden translate-x-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-ink-950 opacity-0 shadow-xl transition duration-300 group-hover:translate-x-0 group-hover:opacity-100 sm:block">
        {tooltip}
      </span>
      <span
        className={`relative grid size-14 place-items-center rounded-full text-white shadow-[0_12px_30px_-6px_rgb(0_0_0/0.6)] transition-transform duration-300 group-hover:scale-105 sm:size-16 ${
          hasWhatsApp ? 'bg-whatsapp' : 'bg-brand-500'
        }`}
      >
        <span
          className={`pulse-ring absolute inset-0 rounded-full ${hasWhatsApp ? 'bg-whatsapp' : 'bg-brand-500'}`}
          aria-hidden
        />
        {hasWhatsApp ? <WhatsAppIcon className="relative size-7 sm:size-8" /> : <Phone className="relative size-6 sm:size-7" />}
      </span>
    </a>
  );
}
