import { useEffect, useState } from 'react';
import { whatsappMessages } from '../config/clinic';
import { WhatsAppIcon } from './BrandIcons';
import { WhatsAppLink } from './ui';

/** Botão flutuante: aparece depois do Hero para não competir com o CTA principal. */
export function WhatsAppButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`fixed right-4 bottom-4 z-40 transition-[opacity,transform] duration-300 sm:right-6 sm:bottom-6 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'
      }`}
      inert={!visible}
    >
      <WhatsAppLink
        message={whatsappMessages.general}
        cta="flutuante"
        showIcon={false}
        ariaLabel="Falar pelo WhatsApp"
        className="group flex min-h-14 items-center gap-2 rounded-full bg-whatsapp pr-5 pl-4 text-white shadow-[0_12px_30px_-10px_rgb(6_21_39/0.5)] transition-colors hover:bg-whatsapp-hover"
      >
        <WhatsAppIcon className="size-6" />
        <span className="text-[0.95rem] font-semibold">WhatsApp</span>
      </WhatsAppLink>
    </div>
  );
}
