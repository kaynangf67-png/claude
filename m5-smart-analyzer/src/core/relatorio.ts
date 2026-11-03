import type { JournalStats } from './journal';

const pct = (x: number, d = 1) => `${(x * 100).toFixed(d).replace('.', ',')}%`;

/** Mínimos para o agente falar em conclusão. Abaixo disso a amostra é pequena demais. */
export const MIN_CASES_WARNING = 100;
export const MIN_CASES_SIGNAL = 300;

/** Resumo em português do diário de simulação, sempre com as ressalvas honestas. */
export function formatSummary(s: JournalStats, payoutPercent: number): string[] {
  const t = s.todos;
  const lines: string[] = [];
  lines.push(`Simulação: ${t.n + t.ties} operações virtuais resolvidas (${s.pending} pendentes).`);
  if (t.n === 0) {
    lines.push('Ainda sem resultado: aguarde os toques em zonas armadas.');
    return lines;
  }
  const profit = t.wins * (payoutPercent / 100) - t.losses;
  lines.push(
    `Todo toque em zona armada: ${pct(t.rate)} de acerto (${t.wins} de ${t.n}), intervalo ${pct(t.lo, 0)} a ${pct(t.hi, 0)}; ` +
    `equilíbrio com payout de ${payoutPercent}%: ${pct(s.breakeven)}.`,
  );
  lines.push(`Resultado virtual: ${profit >= 0 ? '+' : ''}${profit.toFixed(2).replace('.', ',')} entradas (dinheiro de mentira).`);
  const f = s.favoravel;
  const g = s.gatilho;
  lines.push(`Cenário favorável: ${f.n ? `${pct(f.rate)} (${f.wins} de ${f.n})` : 'sem casos'} · gatilho confirmado: ${g.n ? `${pct(g.rate)} (${g.wins} de ${g.n})` : 'sem casos'}.`);
  if (t.n < MIN_CASES_WARNING) {
    lines.push(`ATENÇÃO: amostra pequena (n=${t.n}). Não conclua nada: com poucos casos o acaso domina.`);
  } else if (s.verdicts.todos === 'abaixo') {
    lines.push('Abaixo do equilíbrio: como configurada, a estratégia PERDE dinheiro nesta amostra.');
  } else if (s.verdicts.todos === 'acima' && t.n >= MIN_CASES_SIGNAL) {
    lines.push('Possível vantagem, mas NÃO é prova: confirme em outros períodos e pares, com os parâmetros fixos, e confira o payout real. Preços da Binance não são os da corretora.');
  } else {
    lines.push('Inconclusivo: o intervalo ainda inclui o ponto de equilíbrio. Continue coletando.');
  }
  return lines;
}
