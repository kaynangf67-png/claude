import { MAX_FOLLOWUPS, findProduct } from './analyze';
import { firstName, formatBRL, formatBRLShort, normalize, productRef } from './format';
import type { Analysis, Business, Faq, Lead } from './types';

// ---------------------------------------------------------------------------
// Regras da IA aplicadas em código (não só no prompt):
// nunca inventar preço, nunca inventar desconto, nunca prometer estoque.
// ---------------------------------------------------------------------------

export interface GuardrailCheck {
  id: 'preco' | 'desconto' | 'estoque' | 'tamanho';
  label: string;
  ok: boolean;
  detail?: string;
}

function businessText(business: Business) {
  return normalize(
    [business.description, business.hours, ...business.faqs.flatMap((f) => [f.question, f.answer])].join(' \n '),
  );
}

function parseBRL(raw: string) {
  return Number(raw.replace(/\./g, '').replace(',', '.'));
}

export function checkMessage(text: string, business: Business): GuardrailCheck[] {
  const t = normalize(text);
  const known = businessText(business);
  const prices = new Set(business.products.map((p) => p.price));

  const quoted = [...text.matchAll(/R\$\s?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:,\d{2})?)/g)].map((m) => parseBRL(m[1]));
  const unknownPrices = quoted.filter((v) => !prices.has(v) && !known.includes(String(v)));

  const discountRe = /\b(desconto|promocao|cupom|oferta especial|abatimento)\b|\d+\s?%/;
  const discountInvented = discountRe.test(t) && !discountRe.test(known);

  const stockRe =
    /\b(temos em estoque|tem em estoque|em estoque|pronta entrega|ultimas? unidades?|garanto que (tem|chega)|disponivel para entrega imediata|entrega imediata)\b/;
  const stockPromised = stockRe.test(t) && !stockRe.test(known);

  return [
    {
      id: 'preco',
      label: 'Só preços cadastrados',
      ok: unknownPrices.length === 0,
      detail: unknownPrices.length ? `Valor não cadastrado: ${unknownPrices.map(formatBRL).join(', ')}` : undefined,
    },
    {
      id: 'desconto',
      label: 'Sem descontos inventados',
      ok: !discountInvented,
      detail: discountInvented ? 'A mensagem menciona desconto/promoção que não está cadastrado.' : undefined,
    },
    {
      id: 'estoque',
      label: 'Sem promessa de estoque',
      ok: !stockPromised,
      detail: stockPromised ? 'A mensagem promete disponibilidade. Confirme o estoque antes.' : undefined,
    },
    {
      id: 'tamanho',
      label: 'Curta e direta',
      ok: text.trim().length <= 420,
      detail: text.trim().length > 420 ? 'Mensagens longas no WhatsApp costumam ser ignoradas.' : undefined,
    },
  ];
}

// ---------------------------------------------------------------------------
// Motor local (modo demo): mensagens naturais montadas só com dados cadastrados.
// ---------------------------------------------------------------------------

const FAQ_TOPICS: Record<string, RegExp> = {
  pagamento: /\b(pagamento|pagar|parcel\w*|pix|cartao|boleto|vezes)\b/,
  entrega: /\b(entrega\w*|frete|prazo|chega)\b/,
  montagem: /\b(montagem|montar|instalacao)\b/,
  troca: /\b(troca|devolucao|garantia)\b/,
  horario: /\b(horario|abre|fecha|funciona|sabado|domingo)\b/,
  agendamento: /\b(agendar|agenda|marcar|horario disponivel|vaga)\b/,
};

export function findFaq(business: Business, topic: keyof typeof FAQ_TOPICS): Faq | undefined {
  const re = FAQ_TOPICS[topic];
  return business.faqs.find((f) => re.test(normalize(f.question)) || re.test(normalize(f.answer)));
}

function faqsForQuestion(business: Business, question: string) {
  const q = normalize(question);
  return (Object.keys(FAQ_TOPICS) as (keyof typeof FAQ_TOPICS)[])
    .filter((topic) => FAQ_TOPICS[topic].test(q))
    .map((topic) => findFaq(business, topic))
    .filter((f): f is Faq => !!f);
}

const PEOPLE = ['esposa', 'marido', 'mulher', 'namorada', 'namorado', 'noiva', 'noivo', 'socio', 'socia', 'familia', 'mae', 'pai', 'chefe', 'filha', 'filho'];
const PEOPLE_LABEL: Record<string, string> = {
  esposa: 'sua esposa', marido: 'seu marido', mulher: 'sua esposa', namorada: 'sua namorada', namorado: 'seu namorado',
  noiva: 'sua noiva', noivo: 'seu noivo', socio: 'seu sócio', socia: 'sua sócia', familia: 'sua família', mae: 'sua mãe',
  pai: 'seu pai', chefe: 'seu chefe', filha: 'sua filha', filho: 'seu filho',
};

function sharedDecisionPerson(lead: Lead) {
  const text = normalize(lead.messages.filter((m) => m.from === 'cliente').map((m) => m.text).join(' '));
  const who = PEOPLE.find((p) => new RegExp(`\\b${p}\\b`).test(text));
  return who ? PEOPLE_LABEL[who] : 'quem ia decidir com você';
}

function ensurePeriod(s: string) {
  const t = s.trim();
  return /[.!?…]$/.test(t) ? t : `${t}.`;
}

const pick = <T,>(options: T[], variant: number) => options[((variant % options.length) + options.length) % options.length];

export function generateLocalFollowup(lead: Lead, business: Business, analysis: Analysis, variant = 0): string {
  const n = firstName(lead.name);
  const prod = productRef(lead.productName);
  const product = findProduct(business, lead.productName);
  const payment = findFaq(business, 'pagamento');

  // Resposta a pergunta pendente: responde só com o que está cadastrado.
  if (analysis.objection === 'pergunta_sem_resposta') {
    const lastQuestion = [...lead.messages].reverse().find((m) => m.from === 'cliente')?.text ?? '';
    const parts: string[] = [`Oi, ${n}! Tudo bem? Desculpa a demora.`];
    const q = normalize(lastQuestion);
    if (product && /\b(quanto|preco|valor|custa|tem|voces tem|vcs tem)\b/.test(q)) {
      const ref = productRef(product.name);
      parts.push(`${ref.charAt(0).toUpperCase()}${ref.slice(1)} sai por ${formatBRLShort(product.price).replace(/\u00a0/g, ' ')}.`);
    }
    for (const faq of faqsForQuestion(business, lastQuestion)) parts.push(ensurePeriod(faq.answer));
    if (/\b(tem|disponivel|estoque|pronta entrega)\b/.test(q)) parts.push('Vou confirmar a disponibilidade pra você.');
    parts.push(pick(['Quer que eu te mande fotos e mais detalhes?', 'Posso te ajudar com mais alguma informação?'], variant));
    return parts.join(' ');
  }

  // Último follow-up permitido: tom de encerramento, sem pressão.
  if (lead.followupsSent >= MAX_FOLLOWUPS - 1) {
    return pick(
      [
        `Oi, ${n}! Não quero te incomodar, só queria saber se ainda tem interesse em ${prod}. Se não for o momento, tudo bem — fico à disposição quando precisar.`,
        `Oi, ${n}! Passando uma última vez sobre ${prod}. Se ainda fizer sentido pra você, é só me responder por aqui. Se não, sem problemas!`,
      ],
      variant,
    );
  }

  switch (analysis.objection) {
    case 'decisao_compartilhada': {
      const who = sharedDecisionPerson(lead);
      return pick(
        [
          `Oi, ${n}! Tudo bem? Você tinha falado com a gente sobre ${prod}. Conseguiu conversar com ${who}? Se tiver alguma dúvida sobre o modelo ou pagamento, posso te ajudar.`,
          `Oi, ${n}! Passando rapidinho pra saber se você e ${who} chegaram a uma decisão sobre ${prod}. Se quiserem mais fotos ou detalhes, é só me chamar.`,
        ],
        variant,
      );
    }
    case 'vai_pensar':
      return pick(
        [
          `Oi, ${n}! Tudo bem? Ficou alguma dúvida sobre ${prod}? Se quiser, te mando mais detalhes pra ajudar na decisão.`,
          `Oi, ${n}! Passando pra saber se você conseguiu pensar sobre ${prod}. Qualquer dúvida, tô por aqui!`,
        ],
        variant,
      );
    case 'preco':
    case 'desconto':
      return pick(
        [
          payment
            ? `Oi, ${n}! Tudo bem? Entendo, é um investimento. Só pra ajudar na decisão: ${ensurePeriod(payment.answer)} Quer que eu te explique as condições para ${prod}?`
            : `Oi, ${n}! Tudo bem? Entendo, é um investimento. Se quiser, posso te explicar as formas de pagamento ou te mostrar mais detalhes sobre ${prod}.`,
          `Oi, ${n}! Fiquei pensando na sua mensagem sobre ${prod}. Se quiser, te ajudo a avaliar se ele atende ao que você precisa — sem compromisso.`,
        ],
        variant,
      );
    case 'adiou':
      return pick(
        [
          `Oi, ${n}! Tudo bem? Você tinha comentado que ia decidir sobre ${prod} mais pra frente. Se ainda tiver interesse, fico à disposição pra te ajudar.`,
          `Oi, ${n}! Passando só pra lembrar de ${prod}, como você tinha comentado. Se surgir qualquer dúvida, é só chamar!`,
        ],
        variant,
      );
    case 'sem_resposta':
      return pick(
        [
          `Oi, ${n}! Tudo bem? Vi que você perguntou sobre ${prod}. Ficou alguma dúvida que eu possa esclarecer?`,
          `Oi, ${n}! Passando pra saber se as informações sobre ${prod} ajudaram. Se quiser fotos ou mais detalhes, me avisa.`,
        ],
        variant,
      );
    default:
      return `Oi, ${n}! Tudo bem? Posso te ajudar com mais alguma informação sobre ${prod}?`;
  }
}

// ---------------------------------------------------------------------------
// Prompt para o modo Claude (/api/followup).
// ---------------------------------------------------------------------------

export const FOLLOWUP_SYSTEM_PROMPT = `Você escreve mensagens de WhatsApp para pequenos negócios brasileiros recuperarem clientes que demonstraram interesse mas não compraram.

Regras obrigatórias:
- Use SOMENTE as informações do negócio fornecidas (produtos, preços, horários, perguntas frequentes). Se algo não estiver lá, não mencione.
- Nunca invente preços. Só cite um valor se ele estiver exatamente no catálogo.
- Nunca ofereça ou insinue descontos, promoções ou condições especiais que não estejam cadastrados.
- Nunca prometa estoque, disponibilidade ou prazo de entrega que não esteja cadastrado.
- Português do Brasil natural, como um atendente simpático escreveria no WhatsApp. Nada de linguagem robótica ou de telemarketing.
- Seja breve: 1 a 3 frases curtas. Não use emojis.
- Trate o cliente pelo primeiro nome e retome o que ele disse na conversa (ex.: se ia falar com a esposa, pergunte se conseguiu).
- Sem pressão, sem urgência artificial, sem "última chance". Se for o último contato permitido, deixe claro que tudo bem se não for o momento.
- Se a situação exigir uma decisão humana (pedido de desconto, reclamação, pergunta sem resposta cadastrada), escreva uma mensagem neutra que não comprometa a empresa.

Responda apenas com o texto da mensagem, sem aspas e sem explicações.`;

export function buildFollowupUserPrompt(lead: Lead, business: Business, analysis: Analysis) {
  const catalog = business.products.map((p) => `- ${p.name}: ${formatBRL(p.price)}`).join('\n') || '(nenhum)';
  const faqs = business.faqs.map((f) => `- P: ${f.question}\n  R: ${f.answer}`).join('\n') || '(nenhuma)';
  const conversation = lead.messages
    .map((m) => `${m.from === 'cliente' ? lead.name : business.name}${m.isFollowup ? ' (follow-up)' : ''}: ${m.text}`)
    .join('\n');
  const goal = analysis.isReply
    ? 'Escreva a RESPOSTA para a pergunta pendente do cliente, usando só dados cadastrados. Se a resposta não estiver nos dados, diga que vai verificar.'
    : lead.followupsSent >= MAX_FOLLOWUPS - 1
      ? 'Escreva o ÚLTIMO follow-up permitido: gentil, sem pressão, deixando a porta aberta.'
      : 'Escreva um follow-up para retomar a conversa.';

  return `<negocio>
Nome: ${business.name}
Segmento: ${business.segment}
Descrição: ${business.description}
Horário: ${business.hours}
Catálogo:
${catalog}
Perguntas frequentes:
${faqs}
</negocio>

<lead>
Cliente: ${lead.name}
Interesse: ${lead.productName}
Follow-ups já enviados: ${lead.followupsSent}
Diagnóstico: ${analysis.label}. ${analysis.reasons.join('; ')}.
</lead>

<conversa>
${conversation}
</conversa>

${goal}`;
}

// ---------------------------------------------------------------------------
// Cliente: tenta Claude via /api/followup, cai para o motor local se indisponível.
// ---------------------------------------------------------------------------

export type FollowupSource = 'claude' | 'local';
export interface GeneratedFollowup {
  text: string;
  source: FollowupSource;
}

let apiUnavailable = false;

export async function generateFollowup(
  lead: Lead,
  business: Business,
  analysis: Analysis,
  variant = 0,
): Promise<GeneratedFollowup> {
  if (!apiUnavailable) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      const res = await fetch('/api/followup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lead, business, analysis }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = (await res.json()) as { text?: string; configured?: boolean };
        if (data.configured === false) apiUnavailable = true;
        // O produto não usa emojis; remove os que a IA externa colocar.
        const text = data.text?.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/ {2,}/g, ' ').trim();
        if (text && checkMessage(text, business).every((c) => c.id === 'tamanho' || c.ok)) {
          return { text, source: 'claude' };
        }
      } else if (res.status === 404 || res.status === 503) {
        apiUnavailable = true;
      }
    } catch {
      apiUnavailable = true;
    }
  }
  // Pequena pausa para a geração local não parecer instantânea demais.
  await new Promise((r) => setTimeout(r, 650));
  return { text: generateLocalFollowup(lead, business, analysis, variant), source: 'local' };
}
