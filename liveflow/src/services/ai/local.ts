import { addDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency, formatPercent } from '@/lib/format';
import { POST_FORMATS } from '@/services/formats';
import type { AIProvider, ChatMessage, CopilotContext, Script, ScriptInput } from './types';

/**
 * Gerador local baseado em templates + dados reais do usuário.
 * Não é um LLM: é determinístico, gratuito e funciona offline. Serve como
 * fallback e como modo demonstração. Para texto realmente criativo, use o
 * provedor remoto (Edge Function ai-generate).
 */

function pick<T>(list: T[], seed: number): T {
  return list[Math.abs(seed) % list.length];
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function splitBenefits(raw: string): string[] {
  const list = raw
    .split(/[\n,;•]+/)
    .map((b) => b.trim().replace(/^[-*]\s*/, ''))
    .filter(Boolean);
  return list.length ? list.slice(0, 5) : ['Prático no dia a dia', 'Ótimo custo-benefício', 'Entrega rápida'];
}

const HOOKS = [
  (_p: string, a: string) => `Se você é ${a}, para tudo e olha isso aqui.`,
  (p: string) => `Eu não acreditava que ${p.toLowerCase()} fizesse tanta diferença… até testar.`,
  (p: string) => `3 motivos pra você nunca mais ficar sem ${p.toLowerCase()}.`,
  (p: string, a: string) => `O erro que todo ${a} comete — e como ${p.toLowerCase()} resolve.`,
  (p: string) => `Esse é o ${p.toLowerCase()} que tá esgotando toda semana. Olha o porquê.`,
  (p: string) => `Antes e depois de usar ${p.toLowerCase()}: assiste até o final.`,
  (_p: string, _a: string, price: string) => `Por ${price} eu achei que era pegadinha. Não era.`,
  (p: string) => `Pare de gastar dinheiro com coisa ruim: ${p.toLowerCase()} que funciona de verdade.`,
  (p: string) => `Ninguém te conta isso sobre ${p.toLowerCase()}…`,
  (p: string, a: string) => `Teste rápido: ${p.toLowerCase()} aguenta a rotina de ${a}?`,
];

const PROOFS = [
  'Mostre o produto em uso real, sem cortes, nos primeiros 5 segundos.',
  'Mostre o número de avaliações e leia em voz alta um comentário real de cliente.',
  'Faça um comparativo lado a lado com uma alternativa comum.',
  'Mostre a embalagem chegando e o unboxing em uma tomada só.',
  'Demonstre o principal benefício com um teste visual (ex.: som, luz, resistência).',
];

const CTAS: Record<ScriptInput['objective'], string[]> = {
  vender: ['Toca no carrinho laranja e garante o seu antes que acabe o estoque.', 'O link tá no carrinho: aproveita o preço de hoje.'],
  engajar: ['Comenta "EU QUERO" que eu te mostro mais detalhes.', 'Salva esse vídeo e manda pra quem precisa ver isso.'],
  lancamento: ['Acabou de chegar: toca no carrinho e seja um dos primeiros a ter.', 'Lote de lançamento é limitado — garante pelo carrinho.'],
  promocao: ['Preço relâmpago só hoje: toca no carrinho agora.', 'Cupom ativo por tempo limitado — corre no carrinho.'],
};

export function buildScript(input: ScriptInput, variant = 0): Script {
  const seed = hashString(`${input.productName}|${input.audience}|${input.objective}|${input.format ?? ''}`) + variant * 7919;
  const audience = input.audience.trim() || 'quem quer praticidade';
  const price = input.price != null && input.price > 0 ? formatCurrency(input.price) : 'um preço que cabe no bolso';
  const benefits = splitBenefits(input.benefits);
  const hookFn = pick(HOOKS, seed);
  const hook = hookFn(input.productName, audience, price);
  const proof = pick(PROOFS, seed >> 3);
  const cta = pick(CTAS[input.objective], seed >> 5);

  const fmt = input.format ? POST_FORMATS[input.format] : null;
  const promo = input.objective === 'promocao' ? ', só enquanto durar a promoção' : '';
  const script = (
    fmt
      ? [
          `FORMATO: ${fmt.label} — ${fmt.description} Você não aparece.`,
          `[0–3s] GANCHO (texto grande na tela${input.format === 'narracao' ? ' + narração' : ''}): "${hook}"`,
          `[3–8s] CENA: ${fmt.shots[0]}. Texto: a dor de ${audience}.`,
          `[8–20s] CENA: ${fmt.shots[1]}. Destaque: ${benefits.slice(0, 2).join(' e ').toLowerCase()}.`,
          `[20–30s] CENA: ${fmt.shots[2]}. PROVA: ${proof}`,
          `[30–35s] OFERTA (texto na tela): "Hoje sai por ${price}${promo}."`,
          `[35–40s] CTA: "${cta}" — aponte para o carrinho laranja.`,
        ]
      : [
          `[0–3s] GANCHO: "${hook}"`,
          `[3–8s] PROBLEMA: Mostre a dor de ${audience} sem o produto.`,
          `[8–20s] SOLUÇÃO: Apresente ${input.productName} em uso. Destaque: ${benefits.slice(0, 2).join(' e ').toLowerCase()}.`,
          `[20–30s] PROVA: ${proof}`,
          `[30–35s] OFERTA: "Hoje sai por ${price}${promo}."`,
          `[35–40s] CTA: "${cta}"`,
        ]
  ).join('\n');

  return { hook, script, benefits, proof, cta };
}

function bestBy<T>(list: T[], score: (t: T) => number): T | undefined {
  return [...list].sort((a, b) => score(b) - score(a))[0];
}

function findProduct(ctx: CopilotContext, text: string) {
  const lower = text.toLowerCase();
  return ctx.products.find((p) => lower.includes(p.name.toLowerCase())) ?? null;
}

export function answerLocally(messages: ChatMessage[], ctx: CopilotContext): string {
  const last = messages[messages.length - 1]?.content ?? '';
  const q = last.toLowerCase();
  const active = ctx.products.filter((p) => p.status === 'active');
  const mentioned = findProduct(ctx, last);

  if (ctx.products.length === 0) {
    return 'Ainda não há produtos cadastrados. Cadastre ao menos um produto (ou carregue os dados de demonstração em Configurações) para que eu possa analisar seus números.';
  }

  if (/ganch/.test(q)) {
    const target = mentioned ?? bestBy(active, (p) => p.last30d.revenue) ?? ctx.products[0];
    const n = Math.min(15, Number(q.match(/\d+/)?.[0] ?? 10));
    const input: ScriptInput = { productName: target.name, price: target.promoPrice ?? target.price, benefits: '', audience: 'quem compra no TikTok Shop', objective: 'vender', format: 'maos' };
    const hooks = new Set<string>();
    for (let i = 0; hooks.size < n && i < n * 4; i++) hooks.add(buildScript(input, i).hook);
    return `**${hooks.size} ganchos para ${target.name}:**\n\n${[...hooks].map((h, i) => `${i + 1}. ${h}`).join('\n')}\n\nDica: teste 2–3 ganchos com o mesmo vídeo e mantenha o de maior retenção nos 3 primeiros segundos.`;
  }

  if (/roteiro|script/.test(q)) {
    const target = mentioned ?? bestBy(active, (p) => p.last30d.revenue) ?? ctx.products[0];
    const s = buildScript({ productName: target.name, price: target.promoPrice ?? target.price, benefits: '', audience: 'quem compra no TikTok Shop', objective: 'vender', format: 'maos' });
    return `**Roteiro para ${target.name}**\n\n**Gancho:** ${s.hook}\n\n${s.script}\n\nPara benefícios específicos, use o **Gerador de Roteiro** com a descrição do produto.`;
  }

  if (/sequ[eê]ncia|semana|cronograma|calend|plano|postar|publica/.test(q)) {
    const ranked = [...active].sort((a, b) => b.last30d.revenue - a.last30d.revenue);
    if (!ranked.length) return 'Não há produtos ativos para montar o plano.';
    const start = parseISO(ctx.today);
    const formats = ['maos', 'antes_depois', 'unboxing', 'comparativo', 'pov_texto', 'narracao', 'maos'] as const;
    const lines = Array.from({ length: 7 }, (_, i) => {
      const day = addDays(start, i);
      const a = ranked[i % Math.min(ranked.length, 3)];
      const b = ranked[(i + 1) % Math.min(ranked.length, 3)];
      const f1 = POST_FORMATS[formats[i]].label;
      const f2 = POST_FORMATS[formats[(i + 3) % formats.length]].label;
      return `- **${format(day, 'EEEE (dd/MM)', { locale: ptBR })}** · 12:00 ${a.name} (${f1}) · 19:00 ${b.name} (${f2})`;
    });
    return `**Plano de publicações sem rosto — próximos 7 dias**\n\n${lines.join('\n')}\n\nCritério: 2 vídeos por dia alternando os 3 produtos com maior faturamento em 30 dias e variando o formato para testar qual retém mais. Programe em **Publicações** e acompanhe o CTR por vídeo em Analytics.`;
  }

  if (/melhor|perform|vend(e|endo) mais|top/.test(q) && !/hoje|divulg/.test(q)) {
    const best = bestBy(ctx.products, (p) => p.last30d.revenue)!;
    const bestCtr = bestBy(ctx.products.filter((p) => p.last30d.views > 500), (p) => p.last30d.ctr);
    return [
      `**${best.name}** lidera nos últimos 30 dias: ${formatCurrency(best.last30d.revenue)} de faturamento, ${best.last30d.orders} pedidos e ${formatCurrency(best.last30d.commission)} de comissão.`,
      bestCtr && bestCtr.id !== best.id
        ? `Atenção: **${bestCtr.name}** tem o melhor CTR (${formatPercent(bestCtr.last30d.ctr)}) — o público clica muito. Vale mais exposição.`
        : '',
      `Total do período: ${formatCurrency(ctx.totals30d.revenue)} em ${ctx.totals30d.orders} pedidos.`,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  if (/divulg|hoje|qual produto/.test(q)) {
    // Pontua: comissão absoluta por clique × taxa de conversão, com bônus para promoção.
    const scored = active.map((p) => {
      const unit = (p.promoPrice ?? p.price) * (p.commissionRate / 100);
      const conv = p.last30d.conversionRate || 0.02;
      const score = unit * conv * (p.promoPrice ? 1.15 : 1);
      return { p, unit, conv, score };
    });
    const top = bestBy(scored, (s) => s.score);
    if (!top) return 'Não há produtos ativos. Ative um produto para receber recomendações.';
    return [
      `**Divulgue hoje: ${top.p.name}.**`,
      `- Comissão por venda: ${formatCurrency(top.unit)} (${top.p.commissionRate}%)`,
      `- Taxa de conversão (30d): ${formatPercent(top.conv)}`,
      top.p.promoPrice ? `- Está com preço promocional (${formatCurrency(top.p.promoPrice)}), o que costuma acelerar a decisão.` : '',
      '',
      'Critério: maior comissão esperada por clique (comissão unitária × conversão). Produtos com muitos cliques e pouca conversão podem ter problema de preço ou de página.',
    ]
      .filter((l) => l !== '')
      .join('\n');
  }

  if (/v[ií]deo|melhorar/.test(q)) {
    const weakest = [...ctx.videos].filter((v) => v.usageCount > 0).sort((a, b) => a.ctr30d - b.ctr30d)[0];
    const tips = [
      'Coloque o produto em uso nos 2 primeiros segundos — sem logo ou introdução.',
      'Legende o benefício principal na tela; boa parte do público assiste sem som.',
      'Corte pausas e respirações: ritmo de um corte a cada 2–3 segundos.',
      'Mostre preço e oferta antes dos 15 segundos.',
      'Feche com um CTA único e claro apontando para o carrinho.',
    ];
    const header = weakest
      ? `O vídeo com menor CTR recente é **${weakest.name}** (${formatPercent(weakest.ctr30d)}). Comece por ele:`
      : 'Checklist para melhorar a retenção e a conversão de um vídeo:';
    return `${header}\n\n${tips.map((t) => `- ${t}`).join('\n')}`;
  }

  return [
    'Posso ajudar com:',
    '- "Qual produto devo divulgar hoje?"',
    '- "Crie um roteiro para [produto]"',
    '- "Crie 10 ganchos"',
    '- "Como melhorar esse vídeo?"',
    '- "Qual produto está performando melhor?"',
    '- "Monte meu plano de publicações da semana"',
    '',
    '_Modo local: respostas baseadas em regras e nos seus dados. Configure o provedor remoto para respostas livres de um modelo de linguagem._',
  ].join('\n');
}

export class LocalAIProvider implements AIProvider {
  readonly id = 'local' as const;

  async generateScript(input: ScriptInput, variant = 0) {
    return buildScript(input, variant);
  }

  async generateVariations(input: ScriptInput, count: number) {
    const seen = new Set<string>();
    const out: Script[] = [];
    for (let v = 1; out.length < count && v < count * 6; v++) {
      const s = buildScript(input, v);
      if (seen.has(s.hook)) continue;
      seen.add(s.hook);
      out.push(s);
    }
    return out;
  }

  async chat(messages: ChatMessage[], context: CopilotContext) {
    await new Promise((r) => setTimeout(r, 350));
    return answerLocally(messages, context);
  }
}
