import { useMemo, useRef, useState, type DragEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, FileSpreadsheet, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/app/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/input';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/misc';
import { useServices } from '@/contexts/services';
import { ALL_DATA_KEYS, errorMessage, usePlan, usePosts, useProducts } from '@/hooks/queries';
import { parseCsv } from '@/lib/csv';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ImportResult } from '@/services/domain/imports';
import { buildImportPlan, FIELDS, guessMapping, type FieldKey, type Mapping } from '@/services/importer';

const MAX_BYTES = 10 * 1024 * 1024;

/** UTF-8 primeiro; se aparecerem caracteres inválidos, tenta Windows-1252 (CSV salvo pelo Excel em PT-BR). */
async function readText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const utf8 = new TextDecoder('utf-8').decode(buf);
  return utf8.includes('�') ? new TextDecoder('windows-1252').decode(buf) : utf8;
}

export default function ImportPage() {
  const services = useServices();
  const plan = usePlan();
  const products = useProducts();
  const posts = usePosts();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'map' | 'review' | 'done'>('upload');
  const [fileName, setFileName] = useState('');
  const [table, setTable] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [createMissing, setCreateMissing] = useState(true);
  const [replace, setReplace] = useState(true);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);

  const headers = table[0] ?? [];
  const importPlan = useMemo(
    () => (table.length ? buildImportPlan(table, mapping, { products: products.data ?? [], posts: posts.data ?? [] }) : null),
    [table, mapping, products.data, posts.data],
  );

  async function load(file: File | undefined) {
    if (!file) return;
    if (!/\.(csv|txt)$/i.test(file.name)) return toast.error('Envie um arquivo .csv. Se baixou em Excel (.xlsx), abra e use “Salvar como → CSV”.');
    if (file.size > MAX_BYTES) return toast.error('Arquivo acima de 10 MB. Exporte um período menor.');
    const rows = parseCsv(await readText(file));
    if (rows.length < 2) return toast.error('O arquivo não tem linhas de dados.');
    setFileName(file.name);
    setTable(rows);
    setMapping(guessMapping(rows[0]));
    setStep('map');
  }

  async function runImport() {
    if (!importPlan) return;
    setImporting(true);
    try {
      const r = await services.imports.apply(importPlan, { createMissing, replace, plan });
      setResult(r);
      setStep('done');
      await Promise.all(ALL_DATA_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: key })));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setImporting(false);
    }
  }

  const blocking = importPlan?.errors.filter((e) => e.line === 1) ?? [];
  const rowErrors = importPlan?.errors.filter((e) => e.line > 1) ?? [];
  const willSkip = importPlan?.products.filter((p) => !p.productId && !createMissing) ?? [];

  return (
    <div className="animate-in mx-auto max-w-5xl">
      <Link to="/analytics" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Analytics
      </Link>
      <PageHeader title="Importar vendas" description="Traga os números reais do TikTok Shop por planilha (CSV). Nada é enviado para fora — os dados vão só para a sua conta." />

      <ol className="mb-5 flex flex-wrap gap-2 text-[13px]">
        {(['upload', 'map', 'review', 'done'] as const).map((s, i) => (
          <li key={s} className={cn('rounded-full px-3 py-1 font-medium', step === s ? 'bg-accent text-accent-foreground' : 'text-muted-foreground')}>
            {i + 1}. {{ upload: 'Arquivo', map: 'Colunas', review: 'Revisão', done: 'Pronto' }[s]}
          </li>
        ))}
      </ol>

      {step === 'upload' && (
        <Card>
          <CardContent className="pt-4 sm:pt-5">
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e: DragEvent) => { e.preventDefault(); setDragging(false); load(e.dataTransfer.files[0]); }}
              className={cn('flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors', dragging ? 'border-primary bg-primary/5' : 'hover:border-primary/50 hover:bg-muted/40')}
            >
              <UploadCloud className="size-9 text-muted-foreground" strokeWidth={1.6} />
              <p className="mt-3 font-medium">Arraste o CSV aqui ou clique para escolher</p>
              <p className="mt-1 text-sm text-muted-foreground">Export de pedidos ou de comissões do painel do TikTok Shop · até 10 MB</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(e) => { load(e.target.files?.[0]); e.target.value = ''; }} />
            <ul className="mt-5 grid gap-1.5 text-sm text-muted-foreground">
              <li>• Uma linha por pedido ou por dia — o LiveFlow agrega por data e produto.</li>
              <li>• Separador vírgula ou ponto e vírgula; valores como “R$ 1.234,56” funcionam.</li>
              <li>• Se o export tiver o link do vídeo, as vendas são ligadas às suas publicações.</li>
            </ul>
          </CardContent>
        </Card>
      )}

      {step === 'map' && (
        <div className="grid gap-5">
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="size-4 text-primary" /> {fileName}</CardTitle>
                <CardDescription>{formatNumber(table.length - 1)} linhas · confira o que cada coluna significa</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FIELDS.map((f) => (
                <label key={f.key} className="grid gap-1.5">
                  <span className="text-[13px] font-medium">{f.label}{f.required && <span className="text-destructive"> *</span>}</span>
                  <NativeSelect
                    value={mapping[f.key] ?? ''}
                    onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value === '' ? undefined : Number(e.target.value) }))}
                  >
                    <option value="">— não usar —</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>)}
                  </NativeSelect>
                </label>
              ))}
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <CardHeader><CardTitle>Prévia</CardTitle></CardHeader>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  {headers.map((h, i) => {
                    const field = (Object.entries(mapping) as [FieldKey, number][]).find(([, idx]) => idx === i)?.[0];
                    return (
                      <TH key={i}>
                        <div>{h}</div>
                        {field && <Badge tone="primary" className="mt-1">{FIELDS.find((f) => f.key === field)!.label}</Badge>}
                      </TH>
                    );
                  })}
                </TR>
              </THead>
              <TBody>
                {table.slice(1, 6).map((r, ri) => (
                  <TR key={ri}>{headers.map((_, ci) => <TD key={ci} className="max-w-48 truncate whitespace-nowrap text-xs">{r[ci]}</TD>)}</TR>
                ))}
              </TBody>
            </Table>
          </Card>
          {blocking.length > 0 && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{blocking.map((e) => e.message).join(' ')}</p>}
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep('upload')}><ArrowLeft /> Outro arquivo</Button>
            <Button onClick={() => setStep('review')} disabled={blocking.length > 0 || !importPlan?.rows.length}>Revisar <ArrowRight /></Button>
          </div>
        </div>
      )}

      {step === 'review' && importPlan && importPlan.range && (
        <div className="grid gap-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { l: 'Período', v: `${formatDate(importPlan.range.from, 'dd/MM')} – ${formatDate(importPlan.range.to, 'dd/MM/yy')}` },
              { l: 'Pedidos', v: formatNumber(importPlan.totals.orders) },
              { l: 'Faturamento', v: formatCurrency(importPlan.totals.revenue) },
              { l: importPlan.commissionEstimated ? 'Comissão (estimada)' : 'Comissão', v: formatCurrency(importPlan.totals.commission) },
            ].map((x) => (
              <Card key={x.l} className="p-4"><p className="text-xs text-muted-foreground">{x.l}</p><p className="tabular mt-1 truncate text-lg font-semibold">{x.v}</p></Card>
            ))}
          </div>
          {importPlan.commissionEstimated && (
            <p className="flex gap-2 rounded-lg bg-warning/10 p-3 text-xs"><AlertTriangle className="size-4 shrink-0 text-warning" />Sem coluna de comissão: estimamos pela % cadastrada em cada produto (produtos novos ficam com 0%).</p>
          )}
          <Card className="overflow-hidden">
            <CardHeader>
              <div><CardTitle>Produtos no arquivo</CardTitle><CardDescription>{importPlan.matchedPosts > 0 ? `${importPlan.matchedPosts} ${importPlan.matchedPosts === 1 ? 'linha ligada' : 'linhas ligadas'} a publicações pelo link do vídeo.` : 'Nenhuma linha ligada a publicações (sem coluna de link ou links não registrados).'}</CardDescription></div>
            </CardHeader>
            <Table>
              <THead>
                <TR className="hover:bg-transparent"><TH>No arquivo</TH><TH className="text-right">Linhas</TH><TH className="text-right">Faturamento</TH><TH>No LiveFlow</TH></TR>
              </THead>
              <TBody>
                {importPlan.products.map((p) => {
                  const match = p.productId ? products.data?.find((x) => x.id === p.productId) : null;
                  return (
                    <TR key={p.key}>
                      <TD className="max-w-64 truncate">{p.name}{p.sku && <span className="ml-1 text-xs text-muted-foreground">({p.sku})</span>}</TD>
                      <TD className="tabular text-right">{p.rows}</TD>
                      <TD className="tabular text-right">{formatCurrency(p.revenue)}</TD>
                      <TD>{match ? <Badge tone="success">{match.name}</Badge> : createMissing ? <Badge tone="info">Será criado</Badge> : <Badge tone="warning">Ignorado</Badge>}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </Card>
          <Card>
            <CardContent className="grid gap-3 pt-4 sm:pt-5">
              <label className="flex items-start gap-2.5 text-sm">
                <input type="checkbox" checked={createMissing} onChange={(e) => setCreateMissing(e.target.checked)} className="mt-0.5 accent-[var(--primary)]" />
                <span><strong>Criar produtos que não existem</strong><br /><span className="text-muted-foreground">Senão, as linhas desses produtos são ignoradas{willSkip.length ? ` (${willSkip.length} produto(s))` : ''}.</span></span>
              </label>
              <label className="flex items-start gap-2.5 text-sm">
                <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="mt-0.5 accent-[var(--primary)]" />
                <span><strong>Substituir importações anteriores do mesmo período</strong><br /><span className="text-muted-foreground">Evita contar duas vezes se você importar o mesmo arquivo de novo. Não afeta dados de demonstração.</span></span>
              </label>
            </CardContent>
          </Card>
          {rowErrors.length > 0 && (
            <Card>
              <CardHeader><div><CardTitle>{rowErrors.length} linha(s) com problema serão ignoradas</CardTitle></div></CardHeader>
              <CardContent>
                <ul className="grid gap-1 text-xs text-muted-foreground">
                  {rowErrors.slice(0, 8).map((e) => <li key={e.line}>Linha {e.line}: {e.message}</li>)}
                  {rowErrors.length > 8 && <li>… e mais {rowErrors.length - 8}</li>}
                </ul>
              </CardContent>
            </Card>
          )}
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep('map')}><ArrowLeft /> Colunas</Button>
            <Button variant="brand" onClick={runImport} loading={importing}>Importar {formatNumber(importPlan.rows.length)} linhas</Button>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <Card>
          <CardContent className="flex flex-col items-center py-10 text-center">
            <CheckCircle2 className="size-10 text-success" />
            <p className="mt-3 text-lg font-semibold">Vendas importadas</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatNumber(result.inserted)} registros diários gravados
              {result.createdProducts ? ` · ${result.createdProducts} produto(s) criado(s)` : ''}
              {result.skippedRows ? ` · ${result.skippedRows} linha(s) ignorada(s)` : ''}.
            </p>
            <div className="mt-6 flex gap-2">
              <Button variant="outline" onClick={() => { setStep('upload'); setTable([]); setResult(null); }}>Importar outro</Button>
              <Button asChild><Link to="/analytics">Ver Analytics</Link></Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
