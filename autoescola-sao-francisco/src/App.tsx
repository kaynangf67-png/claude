import { useEffect } from 'react';
import { About } from './components/About';
import { Categories } from './components/Categories';
import { Contact } from './components/Contact';
import { Courses } from './components/Courses';
import { FAQ } from './components/FAQ';
import { FinalCTA } from './components/FinalCTA';
import { FloatingWhatsApp } from './components/FloatingWhatsApp';
import { Footer } from './components/Footer';
import { Gallery } from './components/Gallery';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { HowItWorks } from './components/HowItWorks';
import { WhyUs } from './components/WhyUs';
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
        <About />
        <Categories />
        <HowItWorks />
        <Courses />
        <Gallery />
        <WhyUs />
        <FAQ />
        <Contact />
        <FinalCTA />
      </main>
      <Footer />
      <FloatingWhatsApp />
    </>
  );
}
