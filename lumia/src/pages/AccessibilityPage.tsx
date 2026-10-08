import { Link } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import { AccessibilitySettings } from '@/components/AccessibilityPanel';
import { Disclaimer } from '@/components/ui';
import { Footer } from '@/components/Footer';

const FEATURES: Array<[string, string, string]> = [
  ['🤟', 'Libras', 'Intérprete digital com mãos, rosto e corpo — incorpora personagens, marca perguntas e negações no rosto e acompanha cada cena.'],
  ['💬', 'Legendas', 'WebVTT com nome de quem fala, em três tamanhos, sempre fora da área do intérprete.'],
  ['🔊', 'Sons importantes', 'Porta batendo, telefone, batidas, silêncio repentino — com ícone e destaque para o que muda a cena.'],
  ['🎭', 'Descrição contextual', 'O tom de cada fala (urgente, ameaçador, com medo) e o clima da cena.'],
  ['📏', 'Tamanho do intérprete', 'Pequeno, médio, grande ou do tamanho que você arrastar. Mãos e rosto nunca saem do quadro.'],
  ['📍', 'Posição', 'Canto inferior direito por padrão; esquerdo ou qualquer lugar. Ele desvia de rostos e ações importantes.'],
  ['🌓', 'Contraste', 'Modo de alto contraste para toda a interface.'],
  ['⌨️', 'Controles acessíveis', 'Teclado (K, J, L, F, C, I), leitores de tela, alvos de toque grandes, gestos no celular.'],
];

export default function AccessibilityPage() {
  const { prefs, setPrefs } = useApp();
  return (
    <main className="page" id="conteudo">
      <section className="container" style={{ maxWidth: 1200 }}>
        <p className="eyebrow">Acessibilidade</p>
        <h1 className="serif" style={{ fontSize: 'clamp(48px,8vw,110px)', margin: '8px 0 16px', lineHeight: 0.95 }}>
          Cinema deve ser <em className="gradient-text">para todos.</em>
        </h1>
        <p className="muted" style={{ fontSize: 19, maxWidth: 760 }}>
          Para muitas pessoas surdas, a legenda não basta: o português escrito pode ser a segunda língua, e a legenda não mostra o tom, o som da porta ou quem está
          falando fora de cena. A LUMIA junta tudo isso numa experiência só.
        </p>
      </section>
      <section className="section" style={{ paddingTop: 40 }}>
        <div className="pillars" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {FEATURES.map(([e, t, d]) => (
            <div className="pillar" key={t}>
              <span className="em" aria-hidden>
                {e}
              </span>
              <strong>{t}</strong>
              <span>{d}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="split">
          <div>
            <h2 className="section-title" style={{ marginBottom: 12 }}>
              Suas preferências
            </h2>
            <p className="muted">As mudanças aqui são salvas na hora e valem para todos os títulos.</p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '18px 0' }}>
              <Link className="btn btn-libras" to="/assistir/a-ligacao?libras=1">
                <span aria-hidden>🤟</span> Testar no filme demonstrativo
              </Link>
              <Link className="btn btn-ghost" to="/perfil">
                Perfil completo
              </Link>
            </div>
            <Disclaimer />
          </div>
          <div className="panel">
            <AccessibilitySettings prefs={prefs} setPrefs={setPrefs} librasOn={prefs.interpreterEnabled} setLibrasOn={(v) => setPrefs({ interpreterEnabled: v })} />
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
