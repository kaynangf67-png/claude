import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ScanText, Sparkles } from 'lucide-react';
import { Badge, Button, Card, CardHeader, EmptyState, Notice } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { getRepository } from '@/data';
import type { ExtractionResult } from '@/domain/types';
import { cn, formatBytes } from '@/lib/format';
import { useProject } from './ProjectLayout';

const MAX_PER_RUN = 8;

export function ExtractionStep() {
  const { bundle, reload } = useProject();
  const repo = getRepository();
  const toast = useToast();
  const navigate = useNavigate();
  const pages = bundle.assets.filter((a) => a.purpose === 'menu_page');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(pages.filter((a) => !a.analyzedAt).slice(0, MAX_PER_RUN).map((a) => a.id)));
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [error, setError] = useState('');

  const chosen = useMemo(() => pages.filter((a) => selected.has(a.id)), [pages, selected]);
  const reanalysis = chosen.filter((a) => a.analyzedAt).length;
  const demo = repo.mode === 'demo';

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_PER_RUN) next.add(id);
      else toast('info', `Selecione no máximo ${MAX_PER_RUN} imagens por análise.`);
      return next;
    });
  }

  async function run() {
    setRunning(true);
    setError('');
    setResult(null);
    try {
      const r = await repo.extractMenu(bundle.project.id, chosen.map((a) => a.id), reanalysis > 0);
      setResult(r);
      await reload();
      setSelected(new Set());
      toast('success', r.reviewRequired ? 'Alguns preços precisam de confirmação.' : 'Seu cardápio está pronto para revisão.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  if (pages.length === 0) {
    return (
      <Card className="mx-auto max-w-3xl">
        <EmptyState
          icon={<ScanText className="size-5" aria-hidden="true" />}
          title="Nenhuma página de cardápio enviada"
          description="Envie fotos das páginas do cardápio (finalidade “Página do cardápio”) para a IA ler os itens. Você também pode cadastrar tudo manualmente no editor."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" onClick={() => navigate('../materiais')}>Enviar fotos</Button>
              <Button onClick={() => navigate('../cardapio')}>Cadastrar manualmente</Button>
            </div>
          }
        />
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {demo && (
        <Notice tone="warn" title="IA desativada no modo demonstração" icon={<AlertTriangle className="size-4" aria-hidden="true" />}>
          Nenhuma imagem será analisada aqui. Para ativar: configure o Supabase, publique a função <code>extract-menu</code> e defina a chave da IA. <Link to="/configuracoes">Ver instruções</Link>. Enquanto isso,
          cadastre os itens no editor.
        </Notice>
      )}

      <Card>
        <CardHeader
          title="O que será enviado para análise"
          description={`Selecione até ${MAX_PER_RUN} páginas por vez. Cada imagem conta no limite diário de uso de IA.`}
        />
        <ul className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
          {pages.map((a) => {
            const on = selected.has(a.id);
            return (
              <li key={a.id}>
                <label className={cn('block cursor-pointer overflow-hidden rounded-lg ring-2 transition', on ? 'ring-accent' : 'ring-line hover:ring-line-strong')}>
                  <div className="relative aspect-[3/4] bg-canvas">
                    {a.fileUrl && <img src={a.fileUrl} alt={a.originalFilename} className="size-full object-cover" loading="lazy" />}
                    <input type="checkbox" checked={on} onChange={() => toggle(a.id)} className="absolute top-2 left-2 size-5 accent-[var(--color-accent)]" aria-label={`Analisar ${a.originalFilename}`} />
                    {a.analyzedAt && (
                      <span className="absolute right-2 bottom-2"><Badge tone="ok"><CheckCircle2 className="size-3" aria-hidden="true" /> analisada</Badge></span>
                    )}
                  </div>
                  <p className="truncate px-2 py-1.5 text-[12px]" title={a.originalFilename}>{a.originalFilename} · {formatBytes(a.sizeBytes)}</p>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="space-y-3 border-t border-line px-5 py-4">
          {reanalysis > 0 && (
            <Notice tone="warn">
              {reanalysis} imagem(ns) selecionada(s) já foram analisadas. Analisar de novo gera custo e pode criar itens repetidos (eles serão marcados como possível duplicidade).
            </Notice>
          )}
          {error && <Notice tone="danger" title="A análise não foi concluída">{error}</Notice>}
          {running && (
            <div className="flex items-center gap-3 rounded-lg bg-accent-soft px-4 py-3 text-sm text-accent" role="status">
              <Sparkles className="size-4 animate-pulse" aria-hidden="true" />
              Estamos identificando os produtos e preços. Isso pode levar até um minuto por lote.
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-ink-soft">
              {chosen.length} de {pages.length} selecionada(s). Itens duvidosos chegam ao editor marcados para revisão; nenhum preço ilegível é preenchido.
            </p>
            <Button variant="primary" icon={<Sparkles className="size-4" aria-hidden="true" />} loading={running} disabled={demo || chosen.length === 0} onClick={run}>
              Analisar {chosen.length || ''} {chosen.length === 1 ? 'imagem' : 'imagens'}
            </Button>
          </div>
        </div>
      </Card>

      {result && (
        <Card>
          <CardHeader title="Resultado da análise" />
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['Itens criados', result.createdProducts],
                ['Para revisar', result.reviewRequired],
                ['Imagens analisadas', result.analyzedAssets],
                ['Imagens puladas', result.skippedAssets],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-canvas px-3 py-2.5">
                  <p className="text-[12px] text-ink-soft">{label}</p>
                  <p className="tabular text-lg font-semibold">{value}</p>
                </div>
              ))}
            </div>
            {result.warnings.length > 0 && (
              <Notice tone="warn" title="Avisos da análise">
                <ul className="list-disc space-y-0.5 pl-4">{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
              </Notice>
            )}
            <div className="flex justify-end">
              <Button variant="primary" onClick={() => navigate('../cardapio')}>Revisar itens</Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
