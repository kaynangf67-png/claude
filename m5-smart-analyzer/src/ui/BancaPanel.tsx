import { useMemo, useState } from 'react';
import {
  simularBanca, simularCenarios, validarBanca, type BancaInput, type BancaResult,
} from '../core/banca';
import { journalStats } from '../core/journal';
import { Btn, Field, Panel } from './kit';
import { useLive } from './live';
import { useStore } from './store';

const pct = (x: number, d = 1) => `${(x * 100).toFixed(d).replace('.', ',')}%`;
const money = (x: number) => x.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const num = (s: string) => Number(s.replace(',', '.'));

interface Col { titulo: string; winRate: number; result: BancaResult; cor: string }

/** Gráfico de faixas: mediana e intervalo 5–95% da banca ao longo das operações, por cenário. */
function Faixas({ cols, initial, trades }: { cols: Col[]; initial: number; trades: number }) {
  const W = 640;
  const H = 230;
  const m = { l: 56, r: 12, t: 12, b: 26 };
  const all = cols.flatMap((c) => c.result.faixas.flatMap((f) => [f.p5, f.p95]));
  const lo = Math.min(initial, ...all);
  const hi = Math.max(initial, ...all);
  const x = (t: number) => m.l + (t / trades) * (W - m.l - m.r);
  const y = (v: number) => m.t + (1 - (v - lo) / (hi - lo || 1)) * (H - m.t - m.b);
  const line = (c: Col, k: 'p5' | 'p50' | 'p95') => c.result.faixas.map((f, i) => `${i ? 'L' : 'M'}${x(f.trade).toFixed(1)},${y(f[k]).toFixed(1)}`).join(' ');
  const band = (c: Col) =>
    `${line(c, 'p95')} L${[...c.result.faixas].reverse().map((f) => `${x(f.trade).toFixed(1)},${y(f.p5).toFixed(1)}`).join(' L')} Z`;
  const ticks = [lo, initial, hi].filter((v, i, a) => a.indexOf(v) === i);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Evolução da banca ao longo das operações: mediana e faixa de 5% a 95% por cenário">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeDasharray={v === initial ? '5 4' : '1 4'} />
          <text x={m.l - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="var(--color-muted)">{money(v)}</text>
        </g>
      ))}
      {cols.map((c) => (
        <g key={c.titulo}>
          <path d={band(c)} fill={c.cor} opacity="0.12" />
          <path d={line(c, 'p50')} fill="none" stroke={c.cor} strokeWidth="2" />
        </g>
      ))}
      <text x={m.l} y={H - 6} fontSize="10" fill="var(--color-muted)">0</text>
      <text x={W - m.r} y={H - 6} textAnchor="end" fontSize="10" fill="var(--color-muted)">{trades} operações</text>
    </svg>
  );
}

export function BancaPanel() {
  const { config, setTab } = useStore();
  const live = useLive();
  const payoutCfg = config.params.payoutPercent.value ?? 80;
  const [taxa, setTaxa] = useState('56');
  const [amostra, setAmostra] = useState('');
  const [payout, setPayout] = useState(String(payoutCfg));
  const [modo, setModo] = useState<'percent' | 'fixo'>('percent');
  const [entrada, setEntrada] = useState('2');
  const [banca, setBanca] = useState('1000');
  const [operacoes, setOperacoes] = useState('500');
  const [rodar, setRodar] = useState(0);

  const input: Omit<BancaInput, 'winRate'> = {
    payoutPercent: num(payout), stakeMode: modo, stake: num(entrada), initial: num(banca), trades: Math.round(num(operacoes)),
  };
  const winRate = num(taxa) / 100;
  const n = amostra.trim() === '' ? 0 : Math.round(num(amostra));
  const erro = useMemo(() => {
    if (n < 0 || !Number.isFinite(n)) return 'A amostra precisa ser um número inteiro (ou deixe em branco).';
    return validarBanca({ ...input, winRate });
  }, [input.payoutPercent, input.stakeMode, input.stake, input.initial, input.trades, winRate, n]); // eslint-disable-line react-hooks/exhaustive-deps

  const cols: Col[] | null = useMemo(() => {
    if (rodar === 0 || erro) return null;
    if (n > 0) {
      const c = simularCenarios(Math.round(winRate * n), n, input);
      return [
        { titulo: 'Pessimista', winRate: c.pessimista.winRate, result: c.pessimista.result, cor: 'var(--color-neg)' },
        { titulo: 'Observada', winRate: c.observado.winRate, result: c.observado.result, cor: 'var(--color-warn)' },
        { titulo: 'Otimista', winRate: c.otimista.winRate, result: c.otimista.result, cor: 'var(--color-pos)' },
      ];
    }
    return [{ titulo: 'Taxa informada', winRate, result: simularBanca({ ...input, winRate }), cor: 'var(--color-warn)' }];
  }, [rodar]); // eslint-disable-line react-hooks/exhaustive-deps

  const diario = journalStats(live.journal, payoutCfg).todos;
  const usarDiario = () => {
    setTaxa(((diario.wins / diario.n) * 100).toFixed(1));
    setAmostra(String(diario.n));
    setPayout(String(payoutCfg));
  };

  return (
    <Panel title="Simulador de banca">
      <p className="mb-3 max-w-3xl text-[13px] leading-relaxed text-muted">
        Mostra o que costuma acontecer com a sua banca dada uma taxa de acerto, o payout e o tamanho da entrada, simulando 1000 caminhos possíveis.
        É <strong className="text-ink">matemática, não previsão</strong>: assume operações independentes e taxa constante, o que o mercado não garante.
        Se você informar o tamanho da amostra, o simulador mostra três cenários (pessimista, observado e otimista) pelo intervalo de confiança, porque uma taxa
        medida em poucas operações é muito incerta.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Taxa de acerto (%)"><input className="num" inputMode="decimal" value={taxa} onChange={(e) => setTaxa(e.target.value)} /></Field>
        <Field label="Amostra (nº de operações)" hint="De onde veio a taxa. Em branco = taxa exata, sem incerteza.">
          <input className="num" inputMode="numeric" value={amostra} onChange={(e) => setAmostra(e.target.value)} placeholder="ex.: 200" />
        </Field>
        <Field label="Payout (%)" hint={`Configurações: ${payoutCfg}%`}><input className="num" inputMode="decimal" value={payout} onChange={(e) => setPayout(e.target.value)} /></Field>
        <Field label="Banca inicial (R$)"><input className="num" inputMode="decimal" value={banca} onChange={(e) => setBanca(e.target.value)} /></Field>
        <Field label="Tipo de entrada">
          <select value={modo} onChange={(e) => setModo(e.target.value as 'percent' | 'fixo')}>
            <option value="percent">% da banca atual</option><option value="fixo">Valor fixo (R$)</option>
          </select>
        </Field>
        <Field label={modo === 'percent' ? 'Entrada (% da banca)' : 'Entrada (R$)'}><input className="num" inputMode="decimal" value={entrada} onChange={(e) => setEntrada(e.target.value)} /></Field>
        <Field label="Nº de operações a simular"><input className="num" inputMode="numeric" value={operacoes} onChange={(e) => setOperacoes(e.target.value)} /></Field>
        <div className="flex items-end gap-2">
          <Btn variant="primary" onClick={() => setRodar((x) => x + 1)} disabled={!!erro}>Simular</Btn>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        <Btn variant="ghost" onClick={usarDiario} disabled={diario.n === 0} title="Usa os resultados do diário ao vivo (aba Ao vivo)">
          Usar o diário ao vivo{diario.n ? ` (${diario.wins} de ${diario.n})` : ' (sem resultados ainda)'}
        </Btn>
        <button className="text-info underline" onClick={() => setTab('configuracoes')}>Mudar o payout padrão</button>
      </div>
      {erro && <p role="alert" className="mt-2 text-[13px] text-neg">{erro}</p>}

      {cols && (
        <div className="mt-5 space-y-4">
          <Faixas cols={cols} initial={input.initial} trades={input.trades} />
          <div className={`grid gap-3 ${cols.length === 3 ? 'md:grid-cols-3' : ''}`}>
            {cols.map((c) => {
              const r = c.result;
              const neg = r.ev <= 0;
              return (
                <div key={c.titulo} className="min-w-0 rounded-md border border-line bg-raised p-3 text-[13px]">
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="font-semibold" style={{ color: c.cor }}>{c.titulo}</span>
                    <span className="num text-xs text-muted">acerto {pct(c.winRate)}</span>
                  </div>
                  <p className={`mb-2 text-xs ${neg ? 'text-neg' : 'text-pos'}`}>
                    {neg
                      ? `Abaixo do equilíbrio (${pct(r.breakeven)}): valor esperado negativo. A banca tende a zero, e quanto mais operar, pior.`
                      : `Acima do equilíbrio (${pct(r.breakeven)}): valor esperado positivo de ${(r.ev * 100).toFixed(1).replace('.', ',')}% de cada entrada, se a taxa for real.`}
                  </p>
                  <dl className="space-y-1">
                    <L k="Banca final (mediana)" v={`R$ ${money(r.final.p50)}`} />
                    <L k="Faixa 5% a 95%" v={`R$ ${money(r.final.p5)} a ${money(r.final.p95)}`} />
                    <L k="Chance de terminar acima" v={pct(r.pAcima, 0)} />
                    <L k="Chance de cair 50% ou mais" v={pct(r.pQueda50, 0)} bad={r.pQueda50 > 0.25} />
                    <L k="Chance de quebra (< 10%)" v={pct(r.pQuebra, 0)} bad={r.pQuebra > 0.05} />
                    <L k="Maior queda (mediana / 95%)" v={`${pct(r.maxDrawdown.mediana, 0)} / ${pct(r.maxDrawdown.p95, 0)}`} />
                    <L k="Entrada ideal (Kelly)" v={r.kelly > 0 ? `${pct(r.kelly)} da banca` : 'não apostar'} />
                  </dl>
                </div>
              );
            })}
          </div>
          <p className="max-w-3xl text-xs leading-relaxed text-faint">
            Kelly é o teto teórico sob taxa conhecida; na prática, com taxa incerta, use uma fração pequena dele ou menos. Os cenários vão do pior ao melhor caso estatístico, e o real pode estar fora.
            Os resultados mudam se você mudar a semente do sorteio, mas as conclusões gerais, não. Isto não é conselho financeiro.
          </p>
        </div>
      )}
    </Panel>
  );
}

function L({ k, v, bad }: { k: string; v: string; bad?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted">{k}</dt>
      <dd className={`num text-right ${bad ? 'text-neg' : ''}`}>{v}</dd>
    </div>
  );
}
