import { daysBetween, formatBRLShort, normalize, ofProduct, relativeTime } from './format';
import type { Analysis, Business, Lead, Message, Objection, Temperature } from './types';

export const MAX_FOLLOWUPS = 2;
/** Intervalo mínimo entre follow-ups sem resposta, em dias. */
export const MIN_DAYS_BETWEEN_FOLLOWUPS = 2;

const PATTERNS = {
  price: /\b(quanto|preco|valor|custa|sai por|fica quanto|orcamento)\b/,
  payment: /\b(parcel\w*|vezes|cartao|pix|boleto|a vista|pagamento|entrada)\b/,
  delivery: /\b(entrega\w*|frete|montagem|prazo|chega)\b/,
  details: /\b(medida\w*|tamanho|cor(es)?|modelo|tecido|material|garantia|fotos?)\b/,
  availability: /\b(tem (em )?estoque|tem disponivel|disponivel|pronta entrega|voces tem|vcs tem|tem\s+\w+\s+(para|pra))\b/,
  schedule: /\b(agendar|agenda|horario|marcar|vaga)\b/,
  sharedDecision:
    /\b(conversar|falar|ver|consultar|mostrar)\s+(com\s+)?(a\s+|o\s+|minha\s+|meu\s+)?(esposa|marido|mulher|namorad[ao]|noiv[ao]|socio|socia|familia|mae|pai|chefe|filh[ao])\b/,
  think: /\b(vou pensar|vou ver|deixa eu ver|vou analisar|vou avaliar|vou pesquisar|pesquisar mais|dar uma olhada|te aviso|te falo|te retorno|depois (eu )?(te )?(falo|aviso|vejo|retorno))\b/,
  postponed: /\b(semana que vem|mes que vem|proxima semana|proximo mes|mais pra frente|depois do pagamento|quando receber|fim do mes|mais tarde|amanha eu)\b/,
  expensive: /\b(caro|cara|salgado|puxado|fora do (meu )?orcamento|acima do (meu )?orcamento)\b/,
  discount: /\b(desconto|abaixa|abaixar|faz por|melhor preco|negociar|chorar)\b/,
  closed: /\b(fechado|pode mandar|vou levar|vou querer|quero sim|comprei|paguei|pode separar|fechar (o )?pedido|segue o comprovante|como (eu )?faco (pra|para) fechar)\b/,
  rejected:
    /\b(nao tenho (mais )?interesse|nao quero|desisti|comprei em outro|ja comprei|nao vou (mais )?(querer|comprar)|obrigad[ao],? mas nao|nao precisa)\b/,
  complaint: /\b(absurdo|pessimo|horrivel|reclamacao|procon|reclame aqui|descaso|nunca mais|enganad[ao]|golpe)\b/,
};

function isQuestion(text: string) {
  const t = normalize(text);
  return (
    text.includes('?') ||
    /^(quanto|qual|quais|como|quando|onde|tem|voces|vcs|consegue|da pra|pode|aceita|faz|fazem)\b/.test(t)
  );
}

function lastBy(messages: Message[], from: 'cliente' | 'empresa') {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].from === from) return messages[i];
  return undefined;
}

function quote(text: string) {
  const t = text.trim();
  return `“${t.length > 90 ? t.slice(0, 87) + '…' : t}”`;
}

export function findProduct(business: Business, productName: string) {
  const n = normalize(productName);
  return business.products.find((p) => normalize(p.name) === n);
}

/**
 * Lê a conversa e explica, em linguagem de dono de negócio, se aquilo é uma venda
 * que pode estar sendo perdida — e o que fazer agora. Determinístico e explicável:
 * toda conclusão vem acompanhada do motivo.
 */
export function analyzeLead(lead: Lead, business: Business, now = Date.now()): Analysis {
  const msgs = lead.messages;
  const last = msgs[msgs.length - 1];
  const lastInteraction = last?.at ?? lead.createdAt;
  const daysSince = daysBetween(lastInteraction, now);
  const customerText = msgs.filter((m) => m.from === 'cliente').map((m) => normalize(m.text));
  const allCustomer = customerText.join(' \n ');
  const lastCustomer = lastBy(msgs, 'cliente');
  const lastCustomerN = lastCustomer ? normalize(lastCustomer.text) : '';
  const product = findProduct(business, lead.productName);

  const reasons: string[] = [];
  let score = 0;

  // ---- Sinais de interesse -------------------------------------------------
  if (PATTERNS.price.test(allCustomer)) {
    score += 2;
    reasons.push(
      product
        ? `Perguntou o preço ${ofProduct(lead.productName)} (${formatBRLShort(product.price)})`
        : `Perguntou o preço ${ofProduct(lead.productName)}`,
    );
  }
  const intentSignals: string[] = [];
  if (PATTERNS.payment.test(allCustomer)) intentSignals.push('formas de pagamento');
  if (PATTERNS.delivery.test(allCustomer)) intentSignals.push('entrega');
  if (PATTERNS.details.test(allCustomer)) intentSignals.push('detalhes do produto');
  if (PATTERNS.availability.test(allCustomer)) intentSignals.push('disponibilidade');
  if (PATTERNS.schedule.test(allCustomer)) intentSignals.push('agendamento');
  if (intentSignals.length) {
    score += intentSignals.length;
    reasons.push(`Quis saber sobre ${joinPt(intentSignals)} — sinal de intenção de compra`);
  }
  const showedInterest = score > 0;

  // ---- Estados terminais ---------------------------------------------------
  const base = { score, daysSince, lastInteraction, isReply: false, showedInterest };

  if (lead.status === 'recuperado') {
    return {
      ...base,
      isLostOpportunity: false,
      label: 'Venda recuperada',
      temperature: 'quente',
      objection: 'nenhuma',
      keyReason: 'Comprou depois do follow-up',
      reasons: [
        ...reasons,
        lead.recoveredAt ? `Compra confirmada ${relativeTime(lead.recoveredAt, now)}` : 'Compra confirmada',
      ],
      recommendedAction: 'Nenhuma ação necessária. Venda concluída! 🎉',
      urgency: 'nenhuma',
      needsHuman: false,
      canFollowUp: false,
      blockReason: 'Este cliente já comprou.',
      followupState: 'nao_necessario',
    };
  }

  if (lead.status === 'perdido' || PATTERNS.rejected.test(lastCustomerN)) {
    return {
      ...base,
      isLostOpportunity: false,
      label: 'Cliente desistiu',
      keyReason: lastCustomer ? `Disse ${quote(lastCustomer.text)}` : 'Marcado como perdido',
      temperature: 'frio',
      objection: 'nenhuma',
      reasons: [
        ...reasons,
        lastCustomer && PATTERNS.rejected.test(lastCustomerN)
          ? `Disse ${quote(lastCustomer.text)}`
          : 'Marcado como perdido',
      ],
      recommendedAction: 'Não insista. Respeite a decisão do cliente.',
      urgency: 'nenhuma',
      needsHuman: false,
      canFollowUp: false,
      blockReason: 'O cliente encerrou a negociação. Mandar mensagem agora seria spam.',
      followupState: 'nao_necessario',
    };
  }

  if (PATTERNS.closed.test(lastCustomerN)) {
    return {
      ...base,
      isLostOpportunity: false,
      label: 'Pronto para fechar',
      keyReason: `Disse ${quote(lastCustomer!.text)}`,
      temperature: 'quente',
      objection: 'nenhuma',
      reasons: [...reasons, `Disse ${quote(lastCustomer!.text)}`],
      recommendedAction: 'Finalize o pedido com o cliente e marque como venda recuperada.',
      urgency: 'agora',
      needsHuman: true,
      humanReason: 'Cliente quer fechar — confirme pedido e pagamento pessoalmente.',
      canFollowUp: false,
      blockReason: 'O cliente já quer comprar. Responda você mesmo para fechar.',
      followupState: 'nao_necessario',
    };
  }

  // ---- Quem falou por último? ----------------------------------------------
  let objection: Objection = 'nenhuma';
  let needsHuman = false;
  let humanReason: string | undefined;
  let isReply = false;

  if (PATTERNS.complaint.test(allCustomer)) {
    needsHuman = true;
    humanReason = 'O cliente demonstrou insatisfação. Uma pessoa deve conduzir essa conversa.';
    reasons.push('Mensagem com tom de reclamação');
  }

  const repliedAfterFollowup =
    lead.followupsSent > 0 &&
    last?.from === 'cliente' &&
    !!lead.lastFollowupAt &&
    new Date(last.at).getTime() > new Date(lead.lastFollowupAt).getTime();

  if (repliedAfterFollowup) {
    objection = 'respondeu_followup';
    score += 3;
    reasons.push(`Respondeu ao follow-up: ${quote(last!.text)}`);
  } else if (last?.from === 'cliente') {
    if (PATTERNS.discount.test(lastCustomerN)) {
      objection = 'desconto';
      score += 1;
      needsHuman = true;
      humanReason = 'O cliente pediu desconto. A IA não oferece descontos — essa decisão é sua.';
      reasons.push(`Pediu desconto: ${quote(last.text)}`);
    } else if (PATTERNS.sharedDecision.test(lastCustomerN)) {
      objection = 'decisao_compartilhada';
      score += 2;
      reasons.push(`Disse ${quote(last.text)} — a decisão depende de outra pessoa`);
    } else if (PATTERNS.expensive.test(lastCustomerN)) {
      objection = 'preco';
      score += 1;
      reasons.push(`Achou o preço alto: ${quote(last.text)}`);
    } else if (PATTERNS.postponed.test(lastCustomerN)) {
      objection = 'adiou';
      score += 2;
      reasons.push(`Adiou a decisão: ${quote(last.text)}`);
    } else if (PATTERNS.think.test(lastCustomerN)) {
      objection = 'vai_pensar';
      score += 2;
      reasons.push(`Disse ${quote(last.text)} — ficou de dar retorno`);
    } else if (isQuestion(last.text)) {
      objection = 'pergunta_sem_resposta';
      isReply = true;
      needsHuman = true;
      humanReason = `Cliente fez uma pergunta ${relativeTime(last.at, now)} e ainda não teve resposta.`;
      reasons.push(`Fez uma pergunta que ficou sem resposta: ${quote(last.text)}`);
    } else {
      objection = 'sem_resposta';
      reasons.push('A conversa parou depois da última mensagem do cliente');
    }
  } else if (last?.from === 'empresa' && showedInterest) {
    objection = 'sem_resposta';
    reasons.push(
      last.isFollowup
        ? 'Não respondeu ao follow-up enviado'
        : 'Parou de responder depois que a empresa passou as informações',
    );
  }

  const keyReason = objection !== 'nenhuma' ? reasons[reasons.length - 1] : reasons[0];

  // ---- Recência ------------------------------------------------------------
  if (daysSince <= 2) score += 2;
  else if (daysSince <= 5) score += 1;
  else if (daysSince > 7) score -= 2;
  reasons.push(`Última interação ${relativeTime(lastInteraction, now)}`);

  const temperature: Temperature = score >= 5 ? 'quente' : score >= 3 ? 'morno' : 'frio';
  const isLostOpportunity = showedInterest && objection !== 'nenhuma' && objection !== 'respondeu_followup';

  if (isLostOpportunity && objection !== 'pergunta_sem_resposta') reasons.push('Ainda não comprou');

  // ---- Regras anti-spam ------------------------------------------------------
  const daysSinceFollowup = lead.lastFollowupAt ? daysBetween(lead.lastFollowupAt, now) : Infinity;
  const awaitingFollowupReply = lead.followupsSent > 0 && last?.from === 'empresa';

  let canFollowUp = isLostOpportunity;
  let blockReason: string | undefined;
  let followupState: Analysis['followupState'] = isLostOpportunity ? 'pendente' : 'nao_necessario';

  if (objection === 'respondeu_followup') {
    canFollowUp = false;
    followupState = 'respondido';
    blockReason = 'O cliente respondeu! Agora é com você: continue a conversa e feche a venda.';
  } else if (awaitingFollowupReply && lead.followupsSent >= MAX_FOLLOWUPS) {
    canFollowUp = false;
    followupState = 'limite';
    blockReason = `Já foram enviados ${lead.followupsSent} follow-ups sem resposta. Insistir mais vira spam.`;
  } else if (awaitingFollowupReply && daysSinceFollowup < MIN_DAYS_BETWEEN_FOLLOWUPS) {
    canFollowUp = false;
    followupState = 'aguardando';
    blockReason = `Follow-up enviado ${relativeTime(lead.lastFollowupAt!, now)}. Aguarde pelo menos ${
      MIN_DAYS_BETWEEN_FOLLOWUPS * 24
    }h antes de um novo contato.`;
  }

  // ---- Ação recomendada ------------------------------------------------------
  let recommendedAction: string;
  let urgency: Analysis['urgency'];
  if (objection === 'respondeu_followup') {
    recommendedAction = 'Responda agora e conduza para o fechamento';
    urgency = 'agora';
  } else if (objection === 'pergunta_sem_resposta') {
    recommendedAction = 'Responder agora — o cliente está esperando';
    urgency = 'agora';
  } else if (followupState === 'limite') {
    recommendedAction = 'Aguardar o cliente ou marcar como perdido';
    urgency = 'nenhuma';
  } else if (followupState === 'aguardando') {
    recommendedAction = 'Aguardar resposta do follow-up';
    urgency = 'nenhuma';
  } else if (!isLostOpportunity) {
    recommendedAction = showedInterest ? 'Conversa em andamento' : 'Entender o que o cliente procura';
    urgency = 'nenhuma';
  } else if (temperature === 'quente') {
    recommendedAction = 'Follow-up em até 24 horas';
    urgency = '24h';
  } else if (temperature === 'morno') {
    recommendedAction = 'Follow-up em até 48 horas';
    urgency = '48h';
  } else {
    recommendedAction = 'Um último follow-up. Sem resposta, marque como perdido';
    urgency = '7d';
  }
  if (objection === 'desconto') recommendedAction = 'Decidir sobre o desconto e responder pessoalmente';

  const label =
    objection === 'respondeu_followup'
      ? 'Cliente voltou a conversar'
      : objection === 'pergunta_sem_resposta'
        ? 'Cliente sem resposta'
        : isLostOpportunity
          ? 'Venda potencialmente perdida'
          : 'Em atendimento';

  return {
    ...base,
    score,
    isReply,
    showedInterest,
    keyReason,
    isLostOpportunity,
    label,
    temperature,
    objection,
    reasons,
    recommendedAction,
    urgency,
    needsHuman,
    humanReason,
    canFollowUp,
    blockReason,
    followupState,
  };
}

function joinPt(items: string[]) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
}

/** Leads que demonstraram interesse e ainda não compraram (aparecem em "Recuperar vendas"). */
export function isRecoverable(lead: Lead, analysis: Analysis) {
  return lead.status !== 'recuperado' && lead.status !== 'perdido' && analysis.showedInterest;
}

const TEMP_ORDER: Record<Temperature, number> = { quente: 0, morno: 1, frio: 2 };
export const byPriority = (a: { analysis: Analysis; lead: Lead }, b: { analysis: Analysis; lead: Lead }) =>
  Number(b.analysis.urgency === 'agora') - Number(a.analysis.urgency === 'agora') ||
  Number(b.analysis.canFollowUp) - Number(a.analysis.canFollowUp) ||
  TEMP_ORDER[a.analysis.temperature] - TEMP_ORDER[b.analysis.temperature] ||
  b.lead.value - a.lead.value;
