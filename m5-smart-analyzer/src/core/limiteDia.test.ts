import { describe, expect, it } from 'vitest';
import { carregarLimite, diaDe, LIMITE_PADRAO, salvarLimite, sanitizeLimite, statusDia, type RegistroReal } from './limiteDia';
import { memoryStore } from './testing/fixtures';

const TZ = 'America/Sao_Paulo';
const meioDia = Date.UTC(2026, 9, 29, 15, 0) / 1000; // 12:00 em São Paulo
const r = (dt: number, resultado: RegistroReal['resultado']): RegistroReal => ({ t: meioDia + dt, resultado });

describe('limite de risco do dia', () => {
  it('conta só o dia atual no fuso do usuário', () => {
    const ontem = r(-86_400, 'perda');
    const s = statusDia([ontem, r(0, 'perda'), r(60, 'ganho')], LIMITE_PADRAO, meioDia + 120, TZ);
    expect(s).toMatchObject({ perdas: 1, ganhos: 1, bloqueado: false });
    // 23:30 em São Paulo ainda é o mesmo dia, embora já seja dia seguinte em UTC
    expect(diaDe(meioDia + 11.5 * 3600, TZ)).toBe(diaDe(meioDia, TZ));
  });

  it('bloqueia ao atingir o número de perdas', () => {
    const regs = [r(0, 'perda'), r(1, 'perda'), r(2, 'perda')];
    const s = statusDia(regs, { ...LIMITE_PADRAO, maxPerdas: 3 }, meioDia + 10, TZ);
    expect(s.bloqueado).toBe(true);
    expect(s.motivo).toMatch(/3 perda/);
    expect(statusDia(regs.slice(0, 2), { ...LIMITE_PADRAO, maxPerdas: 3 }, meioDia + 10, TZ).bloqueado).toBe(false);
  });

  it('bloqueia pelo saldo em reais, usando o payout', () => {
    const cfg = { maxPerdas: null, valorEntrada: 10, limiteReais: 15, payout: 80 };
    // 1 ganho (+8) e 2 perdas (-20) = -12: ainda não
    expect(statusDia([r(0, 'ganho'), r(1, 'perda'), r(2, 'perda')], cfg, meioDia + 9, TZ)).toMatchObject({ saldo: -12, bloqueado: false });
    // mais 1 perda = -22: bloqueia
    expect(statusDia([r(0, 'ganho'), r(1, 'perda'), r(2, 'perda'), r(3, 'perda')], cfg, meioDia + 9, TZ).bloqueado).toBe(true);
  });

  it('empate não conta como perda nem como ganho', () => {
    expect(statusDia([r(0, 'empate'), r(1, 'empate'), r(2, 'empate')], LIMITE_PADRAO, meioDia + 9, TZ)).toMatchObject({ perdas: 0, empates: 3, bloqueado: false });
  });

  it('sem limites configurados, nunca bloqueia', () => {
    const regs = Array.from({ length: 20 }, (_, i) => r(i, 'perda'));
    expect(statusDia(regs, { maxPerdas: null, valorEntrada: null, limiteReais: null, payout: 80 }, meioDia + 30, TZ).bloqueado).toBe(false);
  });

  it('dados salvos inválidos voltam ao padrão; válidos persistem', () => {
    expect(sanitizeLimite({ maxPerdas: -1, valorEntrada: 'x', payout: 500 })).toEqual(LIMITE_PADRAO);
    const s = memoryStore();
    salvarLimite(s, { maxPerdas: 2, valorEntrada: 5, limiteReais: 20, payout: 85 }, [r(0, 'ganho')]);
    expect(carregarLimite(s)).toEqual({ cfg: { maxPerdas: 2, valorEntrada: 5, limiteReais: 20, payout: 85 }, regs: [r(0, 'ganho')] });
    s.setItem('m5sa.registros.v1', '{quebrado');
    expect(carregarLimite(s).regs).toEqual([]);
  });
});
