import { useEffect } from 'react';
import { About } from './components/About';
import { Contact } from './components/Contact';
import { FAQ } from './components/FAQ';
import { FinalCTA } from './components/FinalCTA';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { HowItWorks } from './components/HowItWorks';
import { Insurance } from './components/Insurance';
import { Reviews } from './components/Reviews';
import { Services } from './components/Services';
import { TrustSection } from './components/TrustSection';
import { WhatsAppButton } from './components/WhatsAppButton';
import { useReveal } from './hooks/useReveal';

export default function App() {
  useReveal();
  useEffect(() => {
    try {
      if (window.location.hash) document.querySelector(window.location.hash)?.scrollIntoView();
    } catch {
      // hash que não é um seletor válido: ignora
    }
  }, []);

  return (
    <>
      <Header />
      <main id="conteudo">
        <Hero />
        <TrustSection />
        <About />
        <Services />
        <HowItWorks />
        <Reviews />
        <Insurance />
        <FAQ />
        <Contact />
        <FinalCTA />
      </main>
      <Footer />
      <WhatsAppButton />
    </>
  );
}
