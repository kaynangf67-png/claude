import { useState } from 'react';
import { parseSinaisMt5, resumoSinaisMt5, type LinhaGrupo, type ResumoSinais } from '../core/sinaisMt5';
import { verdict, type Comparison } from '../core/stats';
import { Field, Panel } from './kit';
import { StatCell, VERDICT_NOTE } from './LivePage';
import { useStore } from './store';

const CMP: Record<Comparison, string> = {
  sem_casos: 'sem casos nos dois lados',
  melhor: 'com a característica foi melhor (intervalos separados)',
  pior: 'com a característica foi pior (intervalos separados)',
  inconclusivo: 'diferença dentro do ruído',
};

function TabelaGrupos({ titulo, linhas }: { titulo: string; linhas: LinhaGrupo[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[22rem] text-left text-[13px]">
        <thead><tr className="border-b border-line text-[11px] uppercase tracking-wider text-faint"><th className="py-2 font-medium">{titulo}</th><th className="font-medium">Resultado</th></tr></thead>
        <tbody>{linhas.map((l) => (
          <tr key={l.nome} className="border-b border-line/60 align-top">
            <td className="py-2 pr-3">{l.nome}</td>
            <td><StatCell t={l.t} v={l.v} /></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

/** Resultado dos sinais que o indicador do MT5 gravou: geral e com x sem cada característica. */
export function SinaisMt5Panel() {
  const { config } = useStore();
  const payout = config.params.payoutPercent.value ?? 80;
  const [out, setOut] = useState<{ r: ResumoSinais; nome: string; n: number; rej: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const ler = async (lista: FileList | null) => {
    setErr(null); setOut(null);
    const files = lista ? [...lista] : [];
    if (files.length === 0) return;
    // cada arquivo é lido sozinho e depois juntado: um cabeçalho no meio não vira linha ruim
    const textos = await Promise.all(files.map((f) => f.text()));
    const { sinais, rejeitadas } = parseSinaisMt5(textos.join('\n'));
    if (sinais.length === 0) { setErr('Nenhum sinal válido. Use os m5sinais_<PAR>.csv da pasta comum do MT5.'); return; }
    const nome = files.length === 1 ? files[0]!.name : `${files.length} arquivos`;
    setOut({ r: resumoSinaisMt5(sinais, payout), nome, n: sinais.length, rej: rejeitadas });
  };

  return (
    <Panel title="Sinais do indicador MT5">
      <p className="mb-3 max-w-3xl text-[13px] leading-relaxed text-muted">
        O indicador M5Retracao grava cada sinal resolvido em <b className="text-ink">m5sinais_PAR.csv</b>, na mesma pasta comum do MT5 (Common\Files).
        Abra o arquivo aqui para ver o acerto geral e se cada filtro (médias, rejeição, engolfo, doji, pavio H1) separa sinais melhores dos piores.
      </p>
      <Field label="Arquivos m5sinais_*.csv (pode escolher vários)"><input type="file" multiple accept=".csv,.txt" onChange={(e) => void ler(e.target.files)} /></Field>
      {err && <p role="alert" className="mt-3 text-[13px] text-neg">{err}</p>}
      {out && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div><div className="text-[11px] uppercase tracking-wider text-faint">Todos os sinais</div><StatCell t={out.r.todos} v={out.r.veredito} /></div>
            <div><div className="text-[11px] uppercase tracking-wider text-faint">Ponto de equilíbrio</div><span className="num text-xl">{(out.r.breakeven * 100).toFixed(1).replace('.', ',')}%</span><div className="text-[11px] text-faint">payout {payout}%</div></div>
            <div className="text-xs text-faint">{out.nome} · {out.n} sinais{out.rej ? ` · ${out.rej} linha(s) ignorada(s)` : ''}</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-[13px]">
              <thead><tr className="border-b border-line text-[11px] uppercase tracking-wider text-faint"><th className="py-2 font-medium">Característica</th><th className="font-medium">Com</th><th className="font-medium">Sem</th><th className="font-medium">Leitura</th></tr></thead>
              <tbody>{out.r.caracteristicas.map((c) => (
                <tr key={c.id} className="border-b border-line/60 align-top">
                  <td className="py-2 pr-3">{c.nome}</td>
                  <td className="pr-3"><StatCell t={c.com} v={verdict(c.com, out.r.breakeven)} /></td>
                  <td className="pr-3"><StatCell t={c.sem} v={verdict(c.sem, out.r.breakeven)} /></td>
                  <td className="text-xs text-muted">{CMP[c.cmp]}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <TabelaGrupos titulo="Período (horário de Brasília)" linhas={out.r.periodos} />
            <TabelaGrupos titulo="Par" linhas={out.r.pares} />
          </div>
          <div className="space-y-1 text-xs leading-relaxed text-faint">
            <p>{VERDICT_NOTE}</p>
            <p>Período e par se leem um a um: o total de cima pode estar acima do equilíbrio só porque um par ou um horário puxa os outros. Opere só onde o grupo, sozinho, sair do inconclusivo.</p>
            <p>Cinco filtros, quatro períodos e vários pares olhados ao mesmo tempo: um deles pode parecer bom por puro acaso. Só torne um filtro obrigatório no indicador se ele separar com folga, em mais de um par e em semanas diferentes.</p>
            <p>O resultado usa o preço da corretora do seu MT5 no fechamento do M5, não o da Quotex.</p>
          </div>
        </div>
      )}
    </Panel>
  );
}
