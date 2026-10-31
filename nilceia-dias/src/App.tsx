import { Fragment, useEffect } from 'react';
import { pages, type SectionKey } from './config/pages';
import { About } from './components/About';
import { Authority } from './components/Authority';
import { Brides } from './components/Brides';
import { ConsentBanner } from './components/ConsentBanner';
import { FAQ } from './components/FAQ';
import { FinalCTA } from './components/FinalCTA';
import { Footer } from './components/Footer';
import { Gallery } from './components/Gallery';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Identification } from './components/Identification';
import { Location } from './components/Location';
import { Privacy } from './components/Privacy';
import { Proof } from './components/Proof';
import { Services } from './components/Services';
import { Steps } from './components/Steps';
import { StickyCTA } from './components/StickyCTA';
import { useReveal } from './hooks/useReveal';

export default function App({ pageKey }: { pageKey: string }) {
  const page = pages[pageKey] ?? pages.home;
  const intent = page.primaryIntent;
  useReveal();

  useEffect(() => {
    if (window.location.hash) document.querySelector(window.location.hash)?.scrollIntoView({ behavior: 'instant' });
  }, []);

  const render: Record<SectionKey, () => React.ReactNode> = {
    authority: () => <Authority />,
    identification: () => <Identification />,
    services: () => <Services heroPhoto={page.hero.photo} hasBrides={page.sections.includes('brides')} />,
    brides: () => <Brides />,
    gallery: () => <Gallery />,
    proof: () => <Proof />,
    about: () => <About intent={intent} />,
    steps: () => <Steps intent={intent} />,
    location: () => <Location intent={intent} />,
    faq: () => <FAQ />,
    final: () => <FinalCTA intent={intent} />,
  };

  if (page.key === 'privacidade') {
    return (
      <>
        <Header page={page} />
        <main id="conteudo">
          <Privacy />
        </main>
        <Footer intent={intent} />
        <ConsentBanner />
      </>
    );
  }

  return (
    <>
      <Header page={page} />
      <main id="conteudo">
        <Hero page={page} />
        {page.sections.map((s) => (
          <Fragment key={s}>{render[s]()}</Fragment>
        ))}
      </main>
      <Footer intent={intent} />
      <StickyCTA intent={intent} />
      <ConsentBanner />
    </>
  );
}
