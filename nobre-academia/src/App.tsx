import { Activities } from './components/Activities';
import { Amenities } from './components/Amenities';
import { FAQ } from './components/FAQ';
import { FinalCTA } from './components/FinalCTA';
import { FloatingContact } from './components/FloatingContact';
import { Footer } from './components/Footer';
import { Gallery } from './components/Gallery';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { Hours } from './components/Hours';
import { Location } from './components/Location';
import { Moments } from './components/Moments';
import { Reviews } from './components/Reviews';
import { TrustBar } from './components/TrustBar';
import { WhyNobre } from './components/WhyNobre';
import { useReveal } from './hooks/useReveal';

export default function App() {
  useReveal();

  return (
    <>
      <Header />
      <main id="conteudo">
        <Hero />
        <TrustBar />
        <WhyNobre />
        <Activities />
        <Moments />
        <Gallery />
        <Amenities />
        <Reviews />
        <Location />
        <Hours />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
      <FloatingContact />
    </>
  );
}
