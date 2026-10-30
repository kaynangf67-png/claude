import type { KeyValueStore } from './config';

/**
 * Limite de risco do dia, para as operações REAIS que você registra (o app não
 * vê a sua corretora). Bateu o limite: o app manda parar até o dia seguinte.
 * Não é regra da aula; é gestão de risco que você define.
 */
export type Resultado = 'ganho' | 'perda' | 'empate';

export interface RegistroReal {
  /** Instante em segundos. */
  t: number;
  resultado: Resultado;
}

export interface LimiteConfig {
  /** Para depois de tantas perdas no dia (null = sem limite por quantidade). */
  maxPerdas: number | null;
  /** Valor de cada entrada em R$ (null = não informado). */
  valorEntrada: number | null;
  /** Para quando o saldo do dia chegar a -X reais (null = sem limite em R$). */
  limiteReais: number | null;
  /** Payout em % para calcular o ganho de cada acerto. */
  payout: number;
}

export const LIMITE_PADRAO: LimiteConfig = { maxPerdas: 3, valorEntrada: null, limiteReais: null, payout: 80 };

export interface StatusDia {
  ganhos: number;
  perdas: number;
  empates: number;
  /** Saldo em R$ (null sem valor de entrada). */
  saldo: number | null;
  bloqueado: boolean;
  motivo: string | null;
}

/** Chave do dia no fuso do usuário (AAAA-MM-DD). */
export function diaDe(t: number, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t * 1000));
}

export function statusDia(regs: RegistroReal[], cfg: LimiteConfig, nowSec: number, tz: string): StatusDia {
  const hoje = diaDe(nowSec, tz);
  const doDia = regs.filter((r) => diaDe(r.t, tz) === hoje);
  const ganhos = doDia.filter((r) => r.resultado === 'ganho').length;
  const perdas = doDia.filter((r) => r.resultado === 'perda').length;
  const empates = doDia.filter((r) => r.resultado === 'empate').length;
  const saldo = cfg.valorEntrada === null ? null
    : Math.round((ganhos * cfg.valorEntrada * (cfg.payout / 100) - perdas * cfg.valorEntrada) * 100) / 100;
  let motivo: string | null = null;
  if (cfg.maxPerdas !== null && perdas >= cfg.maxPerdas) motivo = `${perdas} perda(s) hoje: chegou ao seu limite de ${cfg.maxPerdas}.`;
  else if (cfg.limiteReais !== null && saldo !== null && saldo <= -cfg.limiteReais) motivo = `Saldo do dia R$ ${saldo.toFixed(2).replace('.', ',')}: chegou ao seu limite de -R$ ${cfg.limiteReais.toFixed(2).replace('.', ',')}.`;
  return { ganhos, perdas, empates, saldo, bloqueado: motivo !== null, motivo };
}

const num = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;

/** Lê dados não confiáveis (localStorage); inválido volta ao padrão, nunca lança. */
export function sanitizeLimite(raw: unknown): LimiteConfig {
  if (typeof raw !== 'object' || raw === null) return { ...LIMITE_PADRAO };
  const o = raw as Record<string, unknown>;
  return {
    maxPerdas: o.maxPerdas === null ? null : num(o.maxPerdas, 1, 50) ?? LIMITE_PADRAO.maxPerdas,
    valorEntrada: num(o.valorEntrada, 0.01, 1_000_000),
    limiteReais: num(o.limiteReais, 0.01, 10_000_000),
    payout: num(o.payout, 1, 100) ?? LIMITE_PADRAO.payout,
  };
}

export function sanitizeRegistros(raw: unknown): RegistroReal[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r): r is RegistroReal =>
    typeof r === 'object' && r !== null && typeof (r as RegistroReal).t === 'number' && Number.isFinite((r as RegistroReal).t)
    && ['ganho', 'perda', 'empate'].includes((r as RegistroReal).resultado)).slice(-2000);
}

const K_CFG = 'm5sa.limite.v1';
const K_REG = 'm5sa.registros.v1';

export function carregarLimite(s: KeyValueStore): { cfg: LimiteConfig; regs: RegistroReal[] } {
  const ler = (k: string): unknown => { try { return JSON.parse(s.getItem(k) ?? 'null'); } catch { return null; } };
  return { cfg: sanitizeLimite(ler(K_CFG)), regs: sanitizeRegistros(ler(K_REG)) };
}

export function salvarLimite(s: KeyValueStore, cfg: LimiteConfig, regs: RegistroReal[]): void {
  try { s.setItem(K_CFG, JSON.stringify(cfg)); s.setItem(K_REG, JSON.stringify(regs)); } catch { /* armazenamento indisponível */ }
}
