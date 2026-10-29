import { describe, expect, it } from 'vitest';
import { horaBrasilia, parseSinaisMt5, resumoSinaisMt5 } from './sinaisMt5';

const HEAD = 'timestamp,simbolo,lado,entrada,fechamento,resultado,ma,rejeicao,engolfo,doji\n';
const linha = (t: number, res: string, ma = 1, rej = 0, eng = 0, doji = 0, lado = 'venda') =>
  `${t},EURUSD,${lado},1.10000,1.09990,${res},${ma},${rej},${eng},${doji}`;

describe('sinais exportados pelo indicador MT5', () => {
  it('lê o arquivo, ignora cabeçalho e rejeita linhas ruins', () => {
    const r = parseSinaisMt5(HEAD + [linha(300, 'ganho'), linha(600, 'perda', -1), '123,1,2', linha(900, 'talvez'), linha(1200, 'empate')].join('\n'));
    expect(r.sinais.map((s) => s.t)).toEqual([300, 600, 1200]);
    expect(r.rejeitadas).toBe(2);
    expect(r.sinais[1]!.ma).toBe(-1);
    expect(r.sinais[2]!.tie).toBe(true);
  });

  it('remove sinal duplicado (indicador recarregado)', () => {
    const r = parseSinaisMt5(HEAD + [linha(300, 'ganho'), linha(300, 'ganho')].join('\n'));
    expect(r.sinais).toHaveLength(1);
    expect(r.rejeitadas).toBe(1);
  });

  it('separa com x sem cada característica; desconhecido fica de fora', () => {
    const rows = [
      ...Array.from({ length: 6 }, (_, i) => linha(300 * (i + 1), i < 4 ? 'ganho' : 'perda', 1)),
      ...Array.from({ length: 4 }, (_, i) => linha(10_000 + 300 * i, i < 1 ? 'ganho' : 'perda', 0)),
      linha(50_000, 'ganho', -1),
    ];
    const s = resumoSinaisMt5(parseSinaisMt5(HEAD + rows.join('\n')).sinais, 80);
    const ma = s.caracteristicas.find((c) => c.id === 'ma')!;
    expect([ma.com.wins, ma.com.losses, ma.sem.wins, ma.sem.losses]).toEqual([4, 2, 1, 3]);
    expect(ma.cmp).toBe('inconclusivo'); // 10 casos: ruído
    expect(s.todos.n).toBe(11);
    expect(s.breakeven).toBeCloseTo(0.5556, 3);
  });
});

describe('coluna do pavio H1', () => {
  it('lê a 11ª coluna e trata arquivo antigo (sem a coluna) como desconhecido', () => {
    const novo = parseSinaisMt5('t\n300,EURUSD,venda,1.1,1.0,ganho,1,0,0,0,1\n').sinais[0]!;
    const antigo = parseSinaisMt5('t\n300,EURUSD,venda,1.1,1.0,ganho,1,0,0,0\n').sinais[0]!;
    expect(novo.h1).toBe(1);
    expect(antigo.h1).toBe(-1);
    const r = resumoSinaisMt5([antigo], 80).caracteristicas.find((c) => c.id === 'h1')!;
    expect(r.com.n + r.sem.n).toBe(0);
  });

  it('converte UTC para a hora de Brasília', () => {
    expect(horaBrasilia(0)).toBe(21); // 00:00 UTC = 21h do dia anterior
    expect(horaBrasilia(12 * 3600)).toBe(9);
    expect(horaBrasilia(3 * 3600 + 59 * 60)).toBe(0);
  });

  it('separa por período do dia e por par, sem misturar', () => {
    const manha = 12 * 3600; // 9h Brasília
    const noite = 23 * 3600; // 20h Brasília
    const txt = HEAD + [
      `${manha},EURUSD,venda,1,1,ganho,1,0,0,0`,
      `${manha + 300},EURUSD,venda,1,1,perda,1,0,0,0`,
      `${noite},USDJPY,compra,1,1,ganho,1,0,0,0`,
      `${noite},EURUSD,compra,1,1,empate,1,0,0,0`,
    ].join('\n');
    const r = resumoSinaisMt5(parseSinaisMt5(txt).sinais, 80);
    const p = Object.fromEntries(r.periodos.map((x) => [x.nome.split(' ')[0], x.t]));
    expect(p['Manhã']).toMatchObject({ wins: 1, losses: 1 });
    expect(p['Noite']).toMatchObject({ wins: 1, losses: 0, ties: 1 });
    expect(p['Tarde']!.n).toBe(0);
    expect(r.pares.map((x) => x.nome)).toEqual(['EURUSD', 'USDJPY']);
    expect(r.pares[0]!.t).toMatchObject({ wins: 1, losses: 1, ties: 1 });
  });

  it('lê exaustão e RSI (colunas 12 e 13); arquivo sem elas fica desconhecido', () => {
    const txt = HEAD + ['300,EURUSD,venda,1,1,ganho,1,0,0,0,1,1,0', '600,EURUSD,venda,1,1,perda,1,0,0,0,1'].join('\n');
    const [a, b] = parseSinaisMt5(txt).sinais;
    expect([a!.exaustao, a!.rsi]).toEqual([1, 0]);
    expect([b!.exaustao, b!.rsi]).toEqual([-1, -1]);
    const ids = resumoSinaisMt5([a!, b!], 80).caracteristicas.map((c) => c.id);
    expect(ids).toContain('exaustao');
    expect(ids).toContain('rsi');
  });
});
