/**
 * Plano de interpretação PRÉ-PROCESSADO (Libras) dos filmes originais.
 *
 * Cada chave é uma unidade de interpretação (fala, som importante, evento
 * visual ou texto na tela). O valor é a sequência de glosas na notação do
 * LIBRAS LANGUAGE ENGINE:
 *   GLOSA[top|wh|yn|neg|int|whisper|exc]  ·  #NOME = datilologia  ·  CL:X = classificador
 *
 * TODO: FUTURE AI INTEGRATION
 *   Estes planos fazem o papel do modelo de tradução contextual. Foram
 *   escritos à mão como DEMONSTRAÇÃO e NÃO foram validados por intérpretes de
 *   Libras nem por pessoas surdas — por isso entram no pipeline com status
 *   REVIEW_REQUIRED e podem ser corrigidos no Estúdio de Validação (/estudio).
 */

export interface PlannedUnit {
  /** id do cue (fala/som) ou do evento visual que origina a unidade */
  source: { kind: 'dialogue' | 'sound' | 'visual' | 'text'; id: string };
  gloss: string;
  /** Janela própria (para eventos visuais/textos sem cue). */
  window?: [number, number];
}

export interface InterpretationPlan {
  id: string;
  contentId: string;
  version: number;
  units: PlannedUnit[];
}

export const LIGACAO_PLAN: InterpretationPlan = {
  id: 'a-ligacao.pt-BR-LIBRAS.v1',
  contentId: 'a-ligacao',
  version: 1,
  units: [
    { source: { kind: 'sound', id: 'door-open' }, gloss: 'PORTA ABRIR' },
    { source: { kind: 'sound', id: 'door-slam' }, gloss: 'PORTA BATER-FORTE[int]' },
    { source: { kind: 'sound', id: 'phone' }, gloss: 'TELEFONE-TOCAR' },
    { source: { kind: 'visual', id: 've-screen' }, gloss: 'NÚMERO DESCONHECIDO', window: [19.1, 21.3] },
    { source: { kind: 'dialogue', id: 'c1' }, gloss: 'ALÔ[yn]' },
    { source: { kind: 'dialogue', id: 'c2' }, gloss: '#MARINA[yn] EU #DANIEL' },
    { source: { kind: 'dialogue', id: 'c3' }, gloss: 'VOCÊ SAIR AGORA PRECISAR[int]' },
    { source: { kind: 'dialogue', id: 'c4' }, gloss: '#DANIEL[yn] ACONTECER O-QUE[wh]' },
    { source: { kind: 'dialogue', id: 'c5' }, gloss: 'TELEFONE[top] EXPLICAR NÃO-DÁ[neg]' },
    { source: { kind: 'dialogue', id: 'c6' }, gloss: 'VOCÊ CONFIAR EU[int]' },
    { source: { kind: 'sound', id: 'silence' }, gloss: 'CHUVA PARAR SILÊNCIO' },
    { source: { kind: 'visual', id: 've-shadow' }, gloss: 'SOMBRA CL:PESSOA-PARAR', window: [41.2, 42.45] },
    { source: { kind: 'sound', id: 'knock' }, gloss: 'PORTA BATER-PORTA[int]' },
    { source: { kind: 'dialogue', id: 'c7' }, gloss: 'PORTA[top] ALGUÉM TER' },
    { source: { kind: 'text', id: 've-continua' }, gloss: 'CONTINUAR', window: [50.2, 52.5] },
  ],
};

export const MANIFESTO_PLAN: InterpretationPlan = {
  id: 'manifesto.pt-BR-LIBRAS.v1',
  contentId: 'manifesto',
  version: 1,
  units: [
    { source: { kind: 'dialogue', id: 'm1' }, gloss: 'OI TUDO-BEM[yn]' },
    { source: { kind: 'dialogue', id: 'm2' }, gloss: 'HOJE VAMOS COMEÇAR' },
    { source: { kind: 'dialogue', id: 'm3' }, gloss: 'CINEMA TODOS' },
    { source: { kind: 'dialogue', id: 'm4' }, gloss: 'ASSISTIR ENTENDER HISTÓRIA VIVER' },
    { source: { kind: 'dialogue', id: 'm5' }, gloss: '#LUMIA INTÉRPRETE #IA FILME' },
  ],
};

export const INTERPRETATION_PLANS: Record<string, InterpretationPlan> = {
  'a-ligacao': LIGACAO_PLAN,
  manifesto: MANIFESTO_PLAN,
};
