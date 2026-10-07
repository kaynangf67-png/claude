import type { ReactNode } from 'react';
import { BarChart3, CalendarClock, Sparkles } from 'lucide-react';
import { Logo } from '@/components/app/brand';
import { Badge } from '@/components/ui/badge';
import { backendMode } from '@/services/backend';

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,560px)]">
      <section className="relative hidden overflow-hidden bg-[oklch(0.17_0.03_285)] p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -top-40 -left-40 size-[520px] rounded-full bg-[oklch(0.55_0.22_285)] opacity-40 blur-[120px]" />
        <div className="absolute -right-32 bottom-0 size-[420px] rounded-full bg-[oklch(0.65_0.21_355)] opacity-30 blur-[120px]" />
        <div className="relative">
          <Logo className="[&>span:last-child]:text-white" />
        </div>
        <div className="relative mt-auto max-w-lg">
          <h2 className="text-4xl leading-tight font-semibold tracking-tight">Venda no TikTok Shop sem aparecer.</h2>
          <p className="mt-4 text-white/70">Vídeos curtos com o produto no carrinho: prepare, programe, poste e veja o que vende.</p>
          <div className="mt-10 grid gap-3">
            {[
              { icon: CalendarClock, t: 'Publicações programadas', d: 'Legenda, hashtags e produto prontos. O LiveFlow avisa a hora de postar.' },
              { icon: BarChart3, t: 'Vendas reais', d: 'Importe o CSV do TikTok Shop e descubra qual vídeo e formato vende mais.' },
              { icon: Sparkles, t: 'Roteiros sem rosto', d: 'Mãos, unboxing, antes e depois: cenas e ganchos prontos para gravar.' },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="flex gap-3 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <Icon className="mt-0.5 size-5 text-[oklch(0.8_0.12_285)]" />
                <div>
                  <p className="font-medium">{t}</p>
                  <p className="text-sm text-white/60">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between lg:justify-end">
          <Logo className="lg:hidden" />
          {backendMode === 'demo' && <Badge tone="warning">Modo demonstração</Badge>}
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </div>
      </section>
    </div>
  );
}
