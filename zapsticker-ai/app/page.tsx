import { ArrowRight, Camera, Download, Mic, Package, Share2, Sparkles, Video } from "lucide-react";
import Link from "next/link";
import { StickerDemo } from "@/components/StickerDemo";

const STEPS = [
  { icon: Camera, title: "Foto", text: "Escolha da galeria ou tire na hora." },
  { icon: Mic, title: "Áudio", text: "Envie um arquivo ou grave sua voz." },
  { icon: Sparkles, title: "Gerar", text: "Recorte, contorno e animação automáticos." },
  { icon: Share2, title: "WhatsApp", text: "Compartilhe direto pelo celular." },
];

const OUTPUTS = [
  {
    icon: Sparkles,
    title: "Figurinha WebP 512×512",
    text: "No formato exigido pelo WhatsApp (até 100 KB, fundo transparente e contorno branco).",
  },
  {
    icon: Video,
    title: "Figurinha falante",
    text: "Vídeo curto com a animação e o seu áudio. É assim que o som chega no WhatsApp, porque figurinhas nativas não têm som.",
  },
  {
    icon: Share2,
    title: "Foto + áudio juntos",
    text: "Envie a imagem e o áudio na mesma mensagem pelo menu de compartilhar do celular.",
  },
  {
    icon: Package,
    title: "Pacote de figurinhas",
    text: "Junte 3 ou mais figurinhas em um arquivo .wastickers para apps que importam pacotes.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      <section className="grid items-center gap-12 py-10 sm:py-16 lg:grid-cols-[1.1fr_1fr] lg:py-24">
        <div className="animate-fade-up text-center lg:text-left">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-medium text-muted">
            <span className="size-2 rounded-full bg-brand" /> Sua foto. Sua voz. Sua figurinha.
          </span>
          <h1 className="mt-5 font-display text-[2.4rem] font-extrabold leading-[1.05] tracking-[-0.035em] sm:text-6xl">
            Transforme suas fotos em figurinhas <span className="text-brand">com áudio.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted lg:mx-0">
            Sua foto + seu áudio = uma figurinha única para compartilhar.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Link
              href="/criar?novo=1"
              className="inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-[20px] bg-brand px-8 text-base font-bold text-[#04230f] shadow-[0_12px_32px_-10px_rgba(37,211,102,0.75)] transition active:scale-[0.97] hover:bg-brand-600 sm:w-auto"
            >
              Criar minha figurinha <ArrowRight className="size-5" />
            </Link>
            <Link
              href="/minhas-figurinhas"
              className="inline-flex h-14 w-full items-center justify-center rounded-[20px] px-6 text-base font-semibold text-fg transition hover:bg-surface-2 sm:w-auto"
            >
              Minhas figurinhas
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted">Grátis · Sem cadastro · Tudo é processado no seu aparelho</p>
        </div>
        <div className="animate-fade-up [animation-delay:120ms]">
          <StickerDemo />
        </div>
      </section>

      <section className="py-10" aria-labelledby="como">
        <h2 id="como" className="text-center font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Simples assim
        </h2>
        <ol className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative rounded-3xl border border-line bg-surface p-5">
              <span className="absolute right-4 top-4 text-xs font-bold text-muted">{i + 1}</span>
              <span className="flex size-11 items-center justify-center rounded-2xl bg-brand/12 text-brand">
                <s.icon className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="py-10" aria-labelledby="recebe">
        <h2 id="recebe" className="text-center font-display text-2xl font-bold tracking-tight sm:text-3xl">
          O que você recebe
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-muted">
          O WhatsApp não toca som em figurinhas. Por isso o ZapSticker gera a figurinha oficial e também uma versão em vídeo com a sua voz.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 sm:gap-4">
          {OUTPUTS.map((o) => (
            <div key={o.title} className="flex gap-4 rounded-3xl border border-line bg-surface p-5">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-brand">
                <o.icon className="size-5" />
              </span>
              <div>
                <h3 className="font-semibold">{o.title}</h3>
                <p className="mt-1 text-sm text-muted">{o.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="my-10 overflow-hidden rounded-[32px] bg-gradient-to-br from-brand to-brand-teal p-8 text-center text-[#04230f] sm:p-12">
        <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-4xl">Pronto para criar a sua?</h2>
        <p className="mt-2 font-medium opacity-80">Leva menos de um minuto.</p>
        <Link
          href="/criar?novo=1"
          className="mt-6 inline-flex h-14 items-center gap-2 rounded-[20px] bg-[#04230f] px-8 font-bold text-white transition active:scale-[0.97]"
        >
          Criar minha figurinha <ArrowRight className="size-5" />
        </Link>
      </section>

      <footer className="flex flex-col items-center gap-2 py-8 text-center text-xs text-muted">
        <p>
          <strong className="text-fg">ZapSticker AI</strong> · Sua foto. Sua voz. Sua figurinha.
        </p>
        <p className="flex items-center gap-1">
          <Download className="size-3.5" /> Suas criações ficam salvas só neste aparelho.
        </p>
        <p>WhatsApp é uma marca da WhatsApp LLC. O ZapSticker AI não é afiliado ao WhatsApp.</p>
      </footer>
    </div>
  );
}
