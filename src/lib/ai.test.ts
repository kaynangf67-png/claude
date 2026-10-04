import { describe, expect, it } from 'vitest';
import { analyzeLead, isRecoverable } from './analyze';
import { DEMO_BUSINESS, buildDemoLeads } from './demoData';
import { checkMessage, generateLocalFollowup } from './followup';
import type { Lead } from './types';

const now = Date.now();
const leads = buildDemoLeads(now);
const byName = (name: string) => leads.find((l) => l.name === name)!;
const analyze = (l: Lead) => analyzeLead(l, DEMO_BUSINESS, now);

describe('analyzeLead — dados demo', () => {
  it('João: "vou conversar com minha esposa" → venda perdida, lead quente, follow-up em 24h', () => {
    const a = analyze(byName('João Silva'));
    expect(a.isLostOpportunity).toBe(true);
    expect(a.label).toBe('Venda potencialmente perdida');
    expect(a.temperature).toBe('quente');
    expect(a.objection).toBe('decisao_compartilhada');
    expect(a.recommendedAction).toBe('Follow-up em até 24 horas');
    expect(a.reasons.some((r) => r.includes('R$'))).toBe(true);
  });

  it('classifica temperaturas variadas', () => {
    expect(analyze(byName('Mariana Costa')).temperature).toBe('quente');
    expect(analyze(byName('Carlos Henrique')).temperature).toBe('morno');
    expect(analyze(byName('Fernanda Lima')).temperature).toBe('morno');
    expect(analyze(byName('Patrícia Souza')).temperature).toBe('frio');
  });

  it('pergunta sem resposta → responder agora, atendimento humano', () => {
    const a = analyze(byName('Lucas Pereira'));
    expect(a.objection).toBe('pergunta_sem_resposta');
    expect(a.isReply).toBe(true);
    expect(a.needsHuman).toBe(true);
    expect(a.urgency).toBe('agora');
  });

  it('anti-spam: follow-up recente bloqueia novo envio', () => {
    const a = analyze(byName('Ricardo Alves'));
    expect(a.canFollowUp).toBe(false);
    expect(a.followupState).toBe('aguardando');
  });

  it('anti-spam: limite de follow-ups', () => {
    const l = { ...byName('Ricardo Alves'), followupsSent: 2 };
    expect(analyze(l).followupState).toBe('limite');
  });

  it('recuperados e perdidos não entram em "Recuperar vendas"', () => {
    const open = leads.filter((l) => isRecoverable(l, analyze(l))).map((l) => l.name);
    expect(open).toHaveLength(7);
    expect(open).not.toContain('Beatriz Rocha');
    expect(open).not.toContain('Ana Paula Martins');
  });

  it('pedido de desconto exige humano', () => {
    const l = byName('Fernanda Lima');
    const withDiscount: Lead = {
      ...l,
      messages: [...l.messages, { id: 'x', from: 'cliente', text: 'Consegue fazer um desconto?', at: new Date(now).toISOString() }],
    };
    const a = analyze(withDiscount);
    expect(a.objection).toBe('desconto');
    expect(a.needsHuman).toBe(true);
  });

  it('cliente querendo fechar → pronto para fechar', () => {
    const l = byName('João Silva');
    const a = analyze({
      ...l,
      messages: [...l.messages, { id: 'y', from: 'cliente', text: 'Como faço pra fechar?', at: new Date(now).toISOString() }],
    });
    expect(a.label).toBe('Pronto para fechar');
  });
});

describe('generateLocalFollowup', () => {
  it('reproduz a mensagem de referência para o João', () => {
    const l = byName('João Silva');
    expect(generateLocalFollowup(l, DEMO_BUSINESS, analyze(l), 0)).toBe(
      'Oi, João! Tudo bem? Você tinha falado com a gente sobre o sofá retrátil 3 lugares. Conseguiu conversar com sua esposa? Se tiver alguma dúvida sobre o modelo ou pagamento, posso te ajudar.',
    );
  });

  it('nenhuma mensagem gerada viola as regras', () => {
    for (const l of leads) {
      for (const v of [0, 1]) {
        const msg = generateLocalFollowup(l, DEMO_BUSINESS, analyze(l), v);
        const failed = checkMessage(msg, DEMO_BUSINESS).filter((c) => !c.ok);
        expect(failed, `${l.name} v${v}: ${msg}`).toEqual([]);
      }
    }
  });

  it('objeção de preço usa a forma de pagamento cadastrada, sem desconto', () => {
    const l = byName('Fernanda Lima');
    const msg = generateLocalFollowup(l, DEMO_BUSINESS, analyze(l), 0);
    expect(msg).toContain('10x sem juros');
    expect(msg.toLowerCase()).not.toContain('desconto');
  });

  it('resposta ao Lucas cita só o preço do catálogo e não promete estoque', () => {
    const l = byName('Lucas Pereira');
    const msg = generateLocalFollowup(l, DEMO_BUSINESS, analyze(l), 0);
    expect(msg).toContain('R$ 890');
    expect(msg).toContain('Entregamos em São Paulo');
    expect(msg).toContain('Vou confirmar a disponibilidade');
  });
});

describe('checkMessage', () => {
  it('detecta preço inventado, desconto e promessa de estoque', () => {
    const bad = checkMessage('Oi! Faço por R$ 1.999 com 10% de desconto, temos em estoque!', DEMO_BUSINESS);
    expect(bad.find((c) => c.id === 'preco')!.ok).toBe(false);
    expect(bad.find((c) => c.id === 'desconto')!.ok).toBe(false);
    expect(bad.find((c) => c.id === 'estoque')!.ok).toBe(false);
  });
  it('aceita preço cadastrado', () => {
    expect(checkMessage('O sofá custa R$ 2.490,00.', DEMO_BUSINESS).every((c) => c.ok)).toBe(true);
  });
});
