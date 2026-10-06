import gsap from 'gsap';
import { MapPin } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { BRAND } from '../../config/constants';
import { LogoMark } from '../ui/Logo';

interface Props {
  ready: boolean;
  onStart: () => void;
}

/** Abertura: animação curta do logo → slogan → botão ENCONTRAR VAGA. */
export function SplashScreen({ ready, onStart }: Props) {
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.splash-mark', { scale: 0.4, opacity: 0, duration: 0.7, ease: 'back.out(1.8)' })
        .fromTo('.splash-mark .logo-pin', { strokeDasharray: 170, strokeDashoffset: 170 }, { strokeDashoffset: 0, duration: 0.9 }, '<0.1')
        .from('.splash-letter', { y: 26, opacity: 0, stagger: 0.045, duration: 0.5 }, '-=0.5')
        .from('.splash-slogan', { y: 12, opacity: 0, duration: 0.6 }, '+=0.1')
        .from('.splash-cta', { y: 20, opacity: 0, duration: 0.6 }, '-=0.2')
        .from('.splash-foot', { opacity: 0, duration: 0.6 }, '-=0.3');
      gsap.to('.splash-glow', { scale: 1.15, opacity: 0.75, duration: 2.4, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    }, root);
    return () => ctx.revert();
  }, []);

  const start = () => {
    gsap.to(root.current, {
      opacity: 0,
      scale: 1.04,
      duration: 0.7,
      ease: 'power2.inOut',
      onComplete: onStart,
    });
  };

  return (
    <div ref={root} className="splash" role="dialog" aria-label="Abertura do VagaAqui">
      <div className="splash-grid" />
      <div className="splash-glow" />
      <div className="splash-content">
        <div className="splash-mark">
          <LogoMark size={92} />
        </div>
        <h1 className="splash-title" aria-label={BRAND.name}>
          {'Vaga'.split('').map((c, i) => (
            <span key={`a${i}`} className="splash-letter">
              {c}
            </span>
          ))}
          {'Aqui'.split('').map((c, i) => (
            <span key={`b${i}`} className="splash-letter wordmark-accent">
              {c}
            </span>
          ))}
        </h1>
        <p className="splash-slogan">{BRAND.slogan}</p>
        <button className="btn btn-primary btn-xl splash-cta" onClick={start} disabled={!ready}>
          <MapPin size={22} />
          {ready ? 'ENCONTRAR VAGA' : 'Carregando mapa 3D…'}
        </button>
        <p className="splash-foot">Probabilidades estimadas · nunca garantia de vaga · dados simulados nesta demonstração</p>
      </div>
    </div>
  );
}
