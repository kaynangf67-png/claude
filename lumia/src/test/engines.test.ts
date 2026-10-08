import { describe, expect, it, beforeAll, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseWebVTT } from '@/services/videoService';
import { parseGlossPlan, ruleBasedGloss, formatGloss } from '@/ai/librasEngine';
import { interpretSentence, runInterpretationPipeline } from '@/ai/interpretationPipeline';
import { evaluatePose, REST_POSE } from '@/avatar/animationEngine';
import { LEXICON, HANDSHAPES, ANCHORS } from '@/avatar/signEngine';
import { signIndexAt } from '@/avatar/timelineEngine';
import { MOVIES } from '@/data/movies';
import { validateRights } from '@/services/catalogService';
import { canTransition } from '@/services/validationService';

const PUBLIC = resolve(__dirname, '../../public');

beforeAll(() => {
  // fetch dos WebVTT a partir de /public (o pipeline roda como no navegador)
  vi.stubGlobal('fetch', async (url: string) => {
    const body = readFileSync(resolve(PUBLIC, url.replace(/^\//, '')), 'utf8');
    return new Response(body, { status: 200 });
  });
});

describe('WebVTT', () => {
  it('lê ids, tempos, falante (<v>) e ignora NOTE', () => {
    const cues = parseWebVTT(readFileSync(resolve(PUBLIC, 'media/a-ligacao/captions.pt-BR.vtt'), 'utf8'));
    expect(cues).toHaveLength(7);
    expect(cues[0]).toMatchObject({ id: 'c1', start: 23.6, end: 24.8, text: 'Alô?', voice: 'Marina' });
    expect(cues[1].voice).toBe('Daniel');
    expect(cues.every((c, i) => i === 0 || c.start >= cues[i - 1].start)).toBe(true);
  });
  it('rejeita arquivo que não é WebVTT', () => {
    expect(() => parseWebVTT('1\n00:00:01,000 --> 00:00:02,000\noi')).toThrow();
  });
});

describe('LIBRAS LANGUAGE ENGINE', () => {
  it('não faz palavra→sinal: topicaliza locativo e leva a negação ao fim', () => {
    const r = ruleBasedGloss('Você não deveria estar aqui.');
    expect(formatGloss(r.tokens)).toBe('AQUI[top] VOCÊ DEVER NÃO[neg]');
    expect(r.structure).toBe('negation');
  });
  it('pergunta QU: pronome interrogativo no fim com marcador wh', () => {
    const r = ruleBasedGloss('O que aconteceu?');
    expect(formatGloss(r.tokens)).toBe('ACONTECER O-QUE[wh]');
    expect(r.question).toBe('wh');
  });
  it('advérbio de tempo vai para o início', () => {
    expect(formatGloss(ruleBasedGloss('Vamos começar hoje.').tokens)).toBe('HOJE VAMOS COMEÇAR');
  });
  it('soletra palavras sem sinal no léxico', () => {
    const r = ruleBasedGloss('Oi Kaynan');
    expect(r.tokens[1]).toMatchObject({ kind: 'fingerspell', letters: 'KAYNAN' });
  });
  it('lê a notação de glosas do plano pré-processado', () => {
    const t = parseGlossPlan('TELEFONE[top] #DANIEL CL:PESSOA-PARAR NÃO-DÁ[neg,int]');
    expect(t.map((x) => x.kind)).toEqual(['lexical', 'fingerspell', 'classifier', 'lexical']);
    expect(t[3].markers).toEqual(['neg', 'intensifier']);
  });
  it('o mesmo texto com contextos diferentes muda expressão e velocidade', () => {
    const a = interpretSentence('Você precisa sair agora.', { emotion: 'urgent' }).representation;
    const b = interpretSentence('Você precisa sair agora.', { emotion: 'sad' }).representation;
    expect(a.expression).toBe('urgent');
    expect(b.expression).toBe('sad');
    expect(a.speed).toBeGreaterThan(b.speed);
  });
});

describe('Léxico e animação', () => {
  it('toda entrada usa configurações de mão e locações existentes', () => {
    for (const e of Object.values(LEXICON)) {
      for (const tr of [e.dominant, typeof e.nondominant === 'object' ? e.nondominant : null]) {
        if (!tr) continue;
        for (const k of tr.keys) {
          expect(HANDSHAPES[k.shape], `${e.gloss}:${k.shape}`).toBeDefined();
          expect(ANCHORS[k.anchor], `${e.gloss}:${k.anchor}`).toBeDefined();
        }
      }
      expect(e.validated).toBe(false); // honestidade: nada validado ainda
    }
  });
});

describe('Pipeline completo de "A Ligação"', () => {
  it('gera falas, sons, eventos visuais e texto como unidades sincronizadas', async () => {
    const item = MOVIES.find((m) => m.id === 'a-ligacao')!;
    const res = await runInterpretationPipeline(item);
    const kinds = new Set(res.timeline.segments.map((s) => s.unit.kind));
    expect(kinds).toEqual(new Set(['dialogue', 'sound', 'visual', 'text']));
    expect(res.timeline.segments).toHaveLength(15);
    // ninguém sai publicado sem revisão humana
    expect(res.timeline.segments.every((s) => s.status === 'REVIEW_REQUIRED')).toBe(true);
    // Daniel é identificado pela tag de voz; Marina é a ouvinte
    const c3 = res.timeline.segments.find((s) => s.unit.id === 'c3')!;
    expect(c3.context.speaker).toMatchObject({ speakerId: 'daniel', listenerId: 'marina', method: 'transcript-voice-tag' });
    expect(c3.context.emotion.emotion).toBe('urgent');
    expect(c3.representation.roleShift).toBe('daniel');
    // sussurro → espaço de sinalização contido
    const c7 = res.timeline.segments.find((s) => s.unit.id === 'c7')!;
    expect(c7.context.whisper).toBe(true);
    expect(c7.representation.signingSpace).toBeLessThan(0.75);
    expect(c7.context.emotion.emotion).toBe('fear');
  });

  it('agenda sinais em ordem, sem sobreposição e nunca antes da fala', async () => {
    const res = await runInterpretationPipeline(MOVIES.find((m) => m.id === 'a-ligacao')!);
    const { signs, segments } = res.timeline;
    for (let i = 1; i < signs.length; i++) expect(signs[i].start).toBeGreaterThanOrEqual(signs[i - 1].end - 1e-6);
    for (const s of segments) {
      expect(s.signStart).toBeGreaterThanOrEqual(s.unit.start);
      expect(s.signEnd).toBeGreaterThan(s.signStart);
    }
    for (let i = 1; i < segments.length; i++) expect(segments[i].signStart).toBeGreaterThan(segments[i - 1].signEnd);
  });

  it('revisão humana substitui glosas e status', async () => {
    const item = MOVIES.find((m) => m.id === 'a-ligacao')!;
    const res = await runInterpretationPipeline(item, { reviews: { 'a-ligacao:c1': { status: 'HUMAN_VERIFIED', glossOverride: 'OI[yn]', reviewer: 'Ana', role: 'Intérprete de Libras' } } });
    const c1 = res.timeline.segments.find((s) => s.unit.id === 'c1')!;
    expect(c1.status).toBe('HUMAN_VERIFIED');
    expect(formatGloss(c1.representation.tokens)).toBe('OI[yn]');
    expect(c1.representation.origin).toBe('human-edit');
  });

  it('sincronia é função pura do tempo: pausar/voltar/avançar dá a mesma pose', async () => {
    const res = await runInterpretationPipeline(MOVIES.find((m) => m.id === 'a-ligacao')!);
    const tl = res.timeline;
    const a = evaluatePose(tl, 26.0, res.loci);
    evaluatePose(tl, 45.3, res.loci); // "seek" para frente
    evaluatePose(tl, 3.0, res.loci); // e para trás
    const b = evaluatePose(tl, 26.0, res.loci);
    expect(b.right.pos).toEqual(a.right.pos);
    expect(b.expression.face).toEqual(a.expression.face);
    expect(a.activeSign?.token).toMatchObject({ kind: 'fingerspell', letters: 'MARINA' });
    // antes da primeira unidade, repouso
    expect(evaluatePose(tl, 1.0, res.loci).right.pos).toEqual(REST_POSE.pos);
  });

  it('mãos nunca saem do espaço de sinalização (enquadramento)', async () => {
    for (const id of ['a-ligacao', 'manifesto']) {
      const res = await runInterpretationPipeline(MOVIES.find((m) => m.id === id)!);
      for (let t = 0; t < 60; t += 0.05) {
        const p = evaluatePose(res.timeline, t, res.loci);
        for (const h of [p.right, p.left]) {
          expect(Number.isFinite(h.pos[0] + h.pos[1] + h.pos[2])).toBe(true);
          expect(Math.abs(h.pos[0])).toBeLessThan(0.42);
          expect(h.pos[1]).toBeGreaterThan(0.9);
          expect(h.pos[1]).toBeLessThan(1.85);
        }
      }
    }
  });

  it('linha do tempo do manifesto segue o exemplo OLÁ → TUDO BEM → HOJE → VAMOS → COMEÇAR', async () => {
    const res = await runInterpretationPipeline(MOVIES.find((m) => m.id === 'manifesto')!);
    const glosses = res.timeline.signs.slice(0, 5).map((s) => s.token.gloss);
    expect(glosses).toEqual(['OI', 'TUDO-BEM', 'HOJE', 'VAMOS', 'COMEÇAR']);
    expect(signIndexAt(res.timeline.signs, 0)).toBe(-1);
  });
});

describe('Direitos e validação', () => {
  const base = {
    title: 'X', synopsis: '', kind: 'movie' as const, year: 2026, durationMin: 90, maturity: 'L' as const, genres: [], country: 'BR', originalLanguage: 'pt-BR',
    licenseType: 'LICENSED' as const, licenseHolder: 'Estúdio', territories: ['BR'], allowsSignLanguageOverlay: true, signLanguages: ['pt-BR-LIBRAS' as const],
  };
  it('exige titular e território', () => {
    expect(validateRights({ ...base, licenseHolder: '' })).not.toHaveLength(0);
    expect(validateRights({ ...base, territories: [] })).not.toHaveLength(0);
    expect(validateRights(base)).toHaveLength(0);
  });
  it('bloqueia vídeo de conteúdo em negociação e intérprete sem permissão contratual', () => {
    expect(validateRights({ ...base, licenseType: 'IN_NEGOTIATION', videoUrl: 'https://x/v.mp4' })).not.toHaveLength(0);
    expect(validateRights({ ...base, allowsSignLanguageOverlay: false })).not.toHaveLength(0);
  });
  it('só publica após verificação humana', () => {
    expect(canTransition('REVIEW_REQUIRED', 'PUBLISHED')).toBe(false);
    expect(canTransition('HUMAN_VERIFIED', 'PUBLISHED')).toBe(true);
  });
});
