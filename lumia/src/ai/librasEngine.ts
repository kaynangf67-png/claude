/**
 * LIBRAS LANGUAGE ENGINE
 *
 * Saída: SignRepresentation — uma representação LINGUÍSTICA (glosas +
 * marcadores não manuais + estrutura + incorporação de personagem +
 * intensidade + espaço de sinalização), e não uma lista de "palavras → sinais".
 *
 * Duas fontes alimentam o motor neste protótipo:
 *
 *  1. Plano de glosas pré-processado (data/demoInterpretation.ts) — faz o papel
 *     do modelo de tradução que ainda não existe. Ex.: "TELEFONE[top] EXPLICAR NÃO-DÁ[neg]".
 *  2. Motor de REGRAS (ruleBasedGloss) — usado no laboratório e no modo ao vivo:
 *     remove artigos/cópula, antecipa advérbios de tempo, topicaliza locativos,
 *     leva pronomes interrogativos e negação para o fim, soletra o que não
 *     conhece. É transparente (cada regra aplicada vira uma nota) e
 *     propositalmente conservador: tudo que ele produz exige revisão humana.
 *
 * TODO: FUTURE AI INTEGRATION
 *   Substituir (1) e complementar (2) por um modelo de tradução
 *   português → representação de Libras treinado com corpora anotados por
 *   pessoas surdas e intérpretes (glosas + marcações não manuais + loci),
 *   condicionado pelo ContextFrame (falante, ouvinte, emoção, cena). O contrato
 *   de saída continua sendo SignRepresentation.
 */
import type { ContextFrame, InterpretationUnit, NonManualMarker, SignRepresentation, SignToken } from './types';
import { LEXICON, normalizeLetters } from '@/avatar/signEngine';
import type { SignLanguageCode } from '@/types/content';

const MARKERS: Record<string, NonManualMarker> = {
  top: 'topic',
  wh: 'wh',
  yn: 'yn',
  neg: 'neg',
  int: 'intensifier',
  whisper: 'whisper',
  exc: 'exclamation',
};

/** Lê a notação de glosas: GLOSA[marcador,...] · #NOME = datilologia · CL:X = classificador. */
export function parseGlossPlan(plan: string): SignToken[] {
  return plan
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => {
      const m = raw.match(/^([^[\]]+)(?:\[([^\]]*)\])?$/);
      const body = m ? m[1] : raw;
      const markers = (m?.[2] ?? '')
        .split(',')
        .map((s) => MARKERS[s.trim()])
        .filter((x): x is NonManualMarker => Boolean(x));
      if (body.startsWith('#')) {
        const letters = normalizeLetters(body.slice(1));
        return { gloss: `#${letters}`, kind: 'fingerspell', markers, known: true, letters } satisfies SignToken;
      }
      const kind: SignToken['kind'] = body.startsWith('CL:') ? 'classifier' : 'lexical';
      return { gloss: body, kind, markers, known: Boolean(LEXICON[body]) } satisfies SignToken;
    });
}

export function formatGloss(tokens: SignToken[]): string {
  return tokens
    .map((t) => {
      const mk = t.markers.length ? `[${t.markers.map((m) => Object.entries(MARKERS).find(([, v]) => v === m)?.[0]).join(',')}]` : '';
      return `${t.kind === 'fingerspell' ? `#${t.letters}` : t.gloss}${mk}`;
    })
    .join(' ');
}

// --------------------------------------------------------------------------
// Motor de regras
// --------------------------------------------------------------------------

const DROP = new Set(['o', 'a', 'os', 'as', 'um', 'uma', 'uns', 'umas', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas', 'pra', 'para', 'por', 'pelo', 'pela', 'e', 'é', 'ser', 'estar', 'está', 'estou', 'estava', 'era', 'foi', 'ter', 'tinha', 'se', 'que', 'com', 'ao', 'à', 'daí', 'aí', 'dá']);
// "ter" existencial ("tem alguém") é tratado à parte.

const DICT: Record<string, string> = {
  olá: 'OI', oi: 'OI', obrigado: 'OBRIGADO', obrigada: 'OBRIGADO',
  eu: 'EU', mim: 'EU', me: 'EU', comigo: 'EU', você: 'VOCÊ', voce: 'VOCÊ', te: 'VOCÊ', tu: 'VOCÊ',
  aqui: 'AQUI', cá: 'AQUI', lá: 'LÁ', ali: 'LÁ',
  agora: 'AGORA', hoje: 'HOJE', amanhã: 'AMANHÃ', ontem: 'ONTEM',
  precisa: 'PRECISAR', preciso: 'PRECISAR', precisar: 'PRECISAR', precisamos: 'PRECISAR',
  deveria: 'DEVER', deve: 'DEVER', devia: 'DEVER', dever: 'DEVER',
  sair: 'SAIR', saia: 'SAIR', sai: 'SAIR', vir: 'VIR', vem: 'VIR', veio: 'VIR', vindo: 'VIR', ir: 'IR', vai: 'IR', vou: 'IR', vamos: 'VAMOS',
  começar: 'COMEÇAR', começa: 'COMEÇAR', casa: 'CASA', porta: 'PORTA', telefone: 'TELEFONE', celular: 'TELEFONE',
  querer: 'QUERER', quero: 'QUERER', quer: 'QUERER', gosto: 'GOSTAR', gostar: 'GOSTAR', gosta: 'GOSTAR',
  ajuda: 'AJUDAR', ajudar: 'AJUDAR', ajude: 'AJUDAR', confia: 'CONFIAR', confiar: 'CONFIAR', confie: 'CONFIAR',
  explicar: 'EXPLICAR', explica: 'EXPLICAR', aconteceu: 'ACONTECER', acontecer: 'ACONTECER', acontece: 'ACONTECER',
  alguém: 'ALGUÉM', pessoa: 'PESSOA', mulher: 'MULHER', homem: 'HOMEM', amigo: 'AMIGO', amiga: 'AMIGO',
  bom: 'BOM', boa: 'BOM', bem: 'BOM', medo: 'MEDO', feliz: 'FELIZ', triste: 'TRISTE', amor: 'AMOR', água: 'ÁGUA',
  trabalho: 'TRABALHAR', trabalhar: 'TRABALHAR', sei: 'SABER', saber: 'SABER', sabe: 'SABER', penso: 'PENSAR', pensar: 'PENSAR',
  falar: 'FALAR', fala: 'FALAR', disse: 'FALAR', olhar: 'OLHAR', olha: 'OLHAR', olhe: 'OLHAR', ver: 'ASSISTIR', assistir: 'ASSISTIR', assista: 'ASSISTIR',
  entender: 'ENTENDER', entenda: 'ENTENDER', entendi: 'ENTENDER', viver: 'VIVER', viva: 'VIVER', história: 'HISTÓRIA',
  esperar: 'ESPERAR', espera: 'ESPERAR', espere: 'ESPERAR', perigo: 'PERIGO', perigoso: 'PERIGO', rápido: 'RÁPIDO', rápida: 'RÁPIDO',
  cinema: 'CINEMA', filme: 'FILME', filmes: 'FILME', todos: 'TODOS', todas: 'TODOS', chuva: 'CHUVA', parar: 'PARAR', pare: 'PARAR', parou: 'PARAR',
  silêncio: 'SILÊNCIO', sim: 'SIM', não: 'NÃO', continua: 'CONTINUAR', continuar: 'CONTINUAR', número: 'NÚMERO',
};

const WH: Record<string, string> = { onde: 'ONDE', quando: 'QUANDO', quem: 'QUEM', como: 'COMO', 'por que': 'POR-QUE', porque: 'POR-QUE', 'o que': 'O-QUE', 'que': 'O-QUE', qual: 'O-QUE' };
const TIME = new Set(['AGORA', 'HOJE', 'AMANHÃ', 'ONTEM']);
const PLACE = new Set(['AQUI', 'LÁ']);

export interface RuleGlossResult {
  tokens: SignToken[];
  structure: SignRepresentation['structure'];
  notes: string[];
  question: 'wh' | 'yn' | null;
  negated: boolean;
}

export function ruleBasedGloss(sentence: string): RuleGlossResult {
  const notes: string[] = [];
  const clean = sentence.replace(/\((.*?)\)/g, ' ').trim();
  const isQuestion = clean.includes('?');
  const lower = ` ${clean.toLowerCase().replace(/[.,!?;:"“”…]/g, ' ')} `.replace(/\s+/g, ' ');
  let text = lower;
  let whGloss: string | null = null;
  for (const phrase of ['por que', 'o que']) {
    if (text.includes(` ${phrase} `)) {
      whGloss = WH[phrase];
      text = text.replace(` ${phrase} `, ' ');
    }
  }
  const words = text.trim().split(' ').filter(Boolean);
  const tokens: SignToken[] = [];
  let negated = false;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w === 'não') {
      negated = true;
      continue;
    }
    if (isQuestion && !whGloss && WH[w]) {
      whGloss = WH[w];
      continue;
    }
    if ((w === 'tem' || w === 'há') && i < words.length - 1) {
      tokens.push({ gloss: 'TER', kind: 'lexical', markers: [], known: true });
      continue;
    }
    if (w === 'tudo' && words[i + 1] === 'bem') {
      tokens.push({ gloss: 'TUDO-BEM', kind: 'lexical', markers: [], known: true });
      i++;
      continue;
    }
    if (DICT[w]) {
      tokens.push({ gloss: DICT[w], kind: 'lexical', markers: [], known: Boolean(LEXICON[DICT[w]]) });
      continue;
    }
    if (DROP.has(w)) continue;
    const letters = normalizeLetters(w);
    if (!letters) continue;
    tokens.push({ gloss: `#${letters}`, kind: 'fingerspell', markers: [], known: true, letters });
  }
  const dropped = words.length - tokens.length;
  if (dropped > 0) notes.push('Artigos, preposições e verbos de ligação omitidos (Libras não os sinaliza como palavras isoladas).');
  if (tokens.some((t) => t.kind === 'fingerspell')) notes.push('Palavras sem sinal no léxico foram soletradas (datilologia) — um intérprete pode preferir um sinal ou classificador.');

  // tempo primeiro
  const timeIdx = tokens.findIndex((t) => TIME.has(t.gloss));
  if (timeIdx > 0) {
    const [tk] = tokens.splice(timeIdx, 1);
    tokens.unshift(tk);
    notes.push(`Advérbio de tempo (${tk.gloss}) antecipado para o início da frase.`);
  }
  // locativo topicalizado
  const placeIdx = tokens.findIndex((t) => PLACE.has(t.gloss));
  if (placeIdx > 0 && !isQuestion) {
    const [pl] = tokens.splice(placeIdx, 1);
    pl.markers.push('topic');
    tokens.unshift(pl);
    notes.push(`Locativo (${pl.gloss}) topicalizado: sobrancelhas erguidas e pausa antes do comentário.`);
  }
  let structure: SignRepresentation['structure'] = 'declarative';
  let question: 'wh' | 'yn' | null = null;
  if (negated) {
    tokens.push({ gloss: 'NÃO', kind: 'lexical', markers: ['neg'], known: true });
    structure = 'negation';
    notes.push('Negação levada ao fim da frase com balanço de cabeça (marcador não manual).');
  }
  if (isQuestion && whGloss) {
    tokens.push({ gloss: whGloss, kind: 'lexical', markers: ['wh'], known: Boolean(LEXICON[whGloss]) });
    structure = 'wh-question';
    question = 'wh';
    notes.push('Pergunta QU: pronome interrogativo no fim, sobrancelhas franzidas.');
  } else if (isQuestion) {
    tokens.forEach((t) => t.markers.push('yn'));
    structure = 'yes-no-question';
    question = 'yn';
    notes.push('Pergunta sim/não: sobrancelhas erguidas e cabeça inclinada à frente durante toda a frase.');
  }
  if (/!/.test(sentence) && tokens.length) tokens[tokens.length - 1].markers.push('exclamation');
  return { tokens, structure, notes, question, negated };
}

// --------------------------------------------------------------------------
// Representação final
// --------------------------------------------------------------------------

const EMOTION_SPEED: Partial<Record<string, number>> = { urgent: 1.18, fear: 1.08, excited: 1.12, angry: 1.1, sad: 0.86, threatening: 0.9, romantic: 0.9 };

export function represent(unit: InterpretationUnit, ctx: ContextFrame, plan: string | null, language: SignLanguageCode = 'pt-BR-LIBRAS', origin?: SignRepresentation['origin']): SignRepresentation {
  const notes: string[] = [];
  let tokens: SignToken[];
  let structure: SignRepresentation['structure'];
  if (plan) {
    tokens = parseGlossPlan(plan);
    structure =
      unit.kind === 'sound' ? 'sound-description'
      : unit.kind === 'visual' || unit.kind === 'text' ? 'visual-description'
      : tokens.some((t) => t.markers.includes('wh')) ? 'wh-question'
      : tokens.some((t) => t.markers.includes('yn')) ? 'yes-no-question'
      : tokens.some((t) => t.markers.includes('topic')) ? 'topic-comment'
      : tokens.some((t) => t.markers.includes('neg')) ? 'negation'
      : ctx.imperative ? 'imperative' : 'declarative';
    notes.push(origin === 'human-edit' ? 'Glosas editadas por um revisor humano.' : 'Glosas do plano pré-processado (substitui o modelo de tradução futuro).');
  } else {
    const r = ruleBasedGloss(unit.text);
    tokens = r.tokens;
    structure = unit.kind === 'dialogue' ? r.structure : unit.kind === 'sound' ? 'sound-description' : 'visual-description';
    notes.push(...r.notes);
  }
  if (ctx.whisper) {
    tokens.forEach((t) => t.markers.includes('whisper') || t.markers.push('whisper'));
    notes.push('Sussurro: espaço de sinalização reduzido, corpo inclinado, olhar atento.');
  }
  if (ctx.speaker.speakerId && unit.kind === 'dialogue') {
    notes.push(`Incorporação (role shift): o intérprete assume o ponto de vista de ${ctx.speaker.speakerId}.`);
  }
  const intensity = Math.min(1, ctx.emotion.intensity * (tokens.some((t) => t.markers.includes('intensifier')) ? 1.15 : 1));
  return {
    unitId: unit.id,
    language,
    sourceText: unit.text,
    tokens,
    structure,
    roleShift: unit.kind === 'dialogue' ? ctx.speaker.speakerId : null,
    expression: ctx.emotion.emotion,
    intensity,
    speed: EMOTION_SPEED[ctx.emotion.emotion] ?? 1,
    signingSpace: ctx.whisper ? 0.68 : 0.85 + intensity * 0.25,
    origin: origin ?? (plan ? 'authored-demo' : 'rule-based'),
    notes,
  };
}
