import { useEffect } from 'react';
import { AboutClinic } from './components/AboutClinic';
import { ClinicGallery } from './components/ClinicGallery';
import { Differentials } from './components/Differentials';
import { FAQ } from './components/FAQ';
import { FinalCTA } from './components/FinalCTA';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { HowItWorks } from './components/HowItWorks';
import { Treatments } from './components/Treatments';
import { TrustSection } from './components/TrustSection';
import { WhatsAppButton } from './components/WhatsAppButton';
import { useReveal } from './hooks/useReveal';

export default function App() {
  useReveal();
  useEffect(() => {
    if (window.location.hash) document.querySelector(window.location.hash)?.scrollIntoView();
  }, []);

  return (
    <>
      <Header />
      <main id="conteudo">
        <Hero />
        <TrustSection />
        <Differentials />
        <Treatments />
        <ClinicGallery />
        <AboutClinic />
        <HowItWorks />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
