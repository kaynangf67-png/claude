import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ImagePlus, Loader2, Lock, Trash2, UploadCloud, XCircle } from 'lucide-react';
import { Badge, Button, Card, CardHeader, Dialog, EmptyState, IconButton, Notice, Select } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { getRepository } from '@/data';
import { ASSET_PURPOSES, PRIVATE_PURPOSES, PURPOSE_LABEL, type Asset, type AssetPurpose } from '@/domain/types';
import { cn, formatBytes } from '@/lib/format';
import { MAX_ASSETS_PER_PROJECT, MAX_FILES_PER_BATCH, MAX_STORED_BYTES, prepareImage, sha256Hex, validateImageFile } from '@/lib/images';
import { useProject } from './ProjectLayout';

interface Pending {
  key: string;
  file: File;
  preview: string;
  purpose: AssetPurpose;
  error: string | null;
  state: 'ready' | 'uploading' | 'done' | 'failed';
}

export function AssetsStep() {
  const { bundle, setBundle, updateProject } = useProject();
  const repo = getRepository();
  const toast = useToast();
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [defaultPurpose, setDefaultPurpose] = useState<AssetPurpose>('menu_page');
  const [toDelete, setToDelete] = useState<Asset | null>(null);

  // Libera as prévias locais ao sair.
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  useEffect(() => () => pendingRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  const remaining = MAX_ASSETS_PER_PROJECT - bundle.assets.length;

  function addFiles(list: FileList | File[]) {
    const files = [...list];
    const room = Math.min(MAX_FILES_PER_BATCH - pending.length, remaining - pending.length);
    if (files.length > room) toast('error', `Limite: ${MAX_FILES_PER_BATCH} arquivos por envio e ${MAX_ASSETS_PER_PROJECT} por projeto. ${files.length - Math.max(room, 0)} arquivo(s) ignorado(s).`);
    const accepted = files.slice(0, Math.max(room, 0)).map<Pending>((file) => ({
      key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
      purpose: defaultPurpose,
      error: validateImageFile(file),
      state: 'ready',
    }));
    setPending((p) => [...p, ...accepted]);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  function removePending(key: string) {
    setPending((list) => {
      const item = list.find((p) => p.key === key);
      if (item) URL.revokeObjectURL(item.preview);
      return list.filter((p) => p.key !== key);
    });
  }

  async function uploadAll() {
    const queue = pending.filter((p) => !p.error && p.state !== 'done');
    if (!queue.length) return;
    setUploading(true);
    let ok = 0;
    for (const item of queue) {
      setPending((list) => list.map((p) => (p.key === item.key ? { ...p, state: 'uploading' } : p)));
      try {
        const blob = await prepareImage(item.file, item.purpose);
        if (blob.size > MAX_STORED_BYTES) throw new Error('Imagem continua acima de 5 MB após a redução.');
        const sha256 = await sha256Hex(blob);
        const asset = await repo.uploadAsset(bundle.project.id, blob, { purpose: item.purpose, originalFilename: item.file.name, sha256 });
        setBundle((b) => ({ ...b, assets: [...b.assets, asset] }));
        setPending((list) => list.map((p) => (p.key === item.key ? { ...p, state: 'done' } : p)));
        ok++;
      } catch (e) {
        setPending((list) => list.map((p) => (p.key === item.key ? { ...p, state: 'failed', error: (e as Error).message } : p)));
      }
    }
    setUploading(false);
    // Remove da fila o que já subiu; mantém as falhas visíveis.
    setPending((list) => list.filter((p) => p.state !== 'done'));
    if (ok) {
      toast('success', ok === 1 ? 'Sua imagem foi enviada.' : `Suas ${ok} imagens foram enviadas.`);
      const hasMenuPages = queue.some((q) => q.purpose === 'menu_page');
      if (hasMenuPages && bundle.project.status === 'setup') await updateProject({ status: 'awaiting_analysis' }).catch(() => {});
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await repo.deleteAsset(toDelete);
      setBundle((b) => ({
        ...b,
        assets: b.assets.filter((a) => a.id !== toDelete.id),
        products: b.products.map((p) => (p.imageUrl === toDelete.fileUrl ? { ...p, imageUrl: null } : p)),
        project: {
          ...b.project,
          logoUrl: b.project.logoUrl === toDelete.fileUrl ? null : b.project.logoUrl,
          coverUrl: b.project.coverUrl === toDelete.fileUrl ? null : b.project.coverUrl,
        },
      }));
      toast('success', 'Imagem excluída.');
    } catch (e) {
      toast('error', (e as Error).message);
    }
    setToDelete(null);
  }

  const readyCount = pending.filter((p) => !p.error && p.state !== 'done').length;
  const doneInBatch = pending.filter((p) => p.state === 'done').length;
  const batchTotal = pending.filter((p) => !p.error || p.state === 'failed').length;
  const groups = ASSET_PURPOSES.map((purpose) => ({ purpose, items: bundle.assets.filter((a) => a.purpose === purpose) })).filter((g) => g.items.length);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Card>
        <CardHeader
          title="Enviar imagens"
          description="Fotos das páginas do cardápio, fotos de pratos, ambiente, logotipo. Use apenas imagens autorizadas pelo restaurante."
        />
        <div className="space-y-4 p-5">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn('flex flex-col items-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors', dragging ? 'border-accent bg-accent-soft' : 'border-line-strong bg-canvas')}
          >
            <UploadCloud className="size-8 text-ink-faint" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium">Arraste as imagens para cá</p>
            <p className="mt-1 text-[13px] text-ink-faint">JPG, PNG ou WebP até 15 MB. Imagens grandes são reduzidas antes do envio.</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <label className="flex items-center gap-2 text-[13px] text-ink-soft">
                Finalidade padrão
                <Select value={defaultPurpose} onChange={(e) => setDefaultPurpose(e.target.value as AssetPurpose)} className="h-9 w-auto">
                  {ASSET_PURPOSES.map((p) => <option key={p} value={p}>{PURPOSE_LABEL[p]}</option>)}
                </Select>
              </label>
              <Button variant="primary" icon={<ImagePlus className="size-4" aria-hidden="true" />} onClick={() => input.current?.click()} disabled={remaining <= 0}>
                Selecionar arquivos
              </Button>
            </div>
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
          </div>

          {pending.length > 0 && (
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {uploading ? `Enviando ${doneInBatch + 1} de ${batchTotal}…` : `${pending.length} arquivo(s) selecionado(s) — confira a finalidade de cada um`}
                </p>
                <Button variant="primary" loading={uploading} disabled={readyCount === 0} onClick={uploadAll}>
                  Enviar {readyCount} {readyCount === 1 ? 'imagem' : 'imagens'}
                </Button>
              </div>
              {uploading && (
                <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-canvas" role="progressbar" aria-valuemin={0} aria-valuemax={batchTotal} aria-valuenow={doneInBatch}>
                  <div className="h-full bg-accent transition-all" style={{ width: `${(doneInBatch / Math.max(batchTotal, 1)) * 100}%` }} />
                </div>
              )}
              <ul className="grid gap-2 sm:grid-cols-2">
                {pending.map((p) => (
                  <li key={p.key} className={cn('flex items-center gap-3 rounded-lg p-2 ring-1', p.error ? 'bg-danger-soft ring-danger/20' : 'ring-line')}>
                    <img src={p.preview} alt="" className="size-14 shrink-0 rounded-md object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{p.file.name}</p>
                      {p.error ? (
                        <p className="text-[12px] text-danger">{p.error}</p>
                      ) : (
                        <Select
                          aria-label={`Finalidade de ${p.file.name}`}
                          value={p.purpose}
                          disabled={p.state !== 'ready'}
                          onChange={(e) => setPending((list) => list.map((x) => (x.key === p.key ? { ...x, purpose: e.target.value as AssetPurpose } : x)))}
                          className="mt-1 h-8 text-[13px]"
                        >
                          {ASSET_PURPOSES.map((x) => <option key={x} value={x}>{PURPOSE_LABEL[x]}</option>)}
                        </Select>
                      )}
                    </div>
                    {p.state === 'uploading' ? (
                      <Loader2 className="size-4 animate-spin text-accent" aria-label="Enviando" />
                    ) : p.state === 'failed' ? (
                      <XCircle className="size-4 text-danger" aria-label="Falhou" />
                    ) : (
                      <IconButton label={`Remover ${p.file.name}`} onClick={() => removePending(p.key)} disabled={uploading}>
                        <Trash2 className="size-4" aria-hidden="true" />
                      </IconButton>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Notice tone="neutral">
            <strong>Página do cardápio</strong> fica privada e serve só para a IA ler os itens; ela nunca vira foto de produto automaticamente.
            Fotos de pratos, logotipo, capa e ambiente podem aparecer no cardápio público.
          </Notice>
        </div>
      </Card>

      <Card>
        <CardHeader title="Imagens do projeto" description={`${bundle.assets.length} de ${MAX_ASSETS_PER_PROJECT} imagens`} />
        {groups.length === 0 ? (
          <EmptyState icon={<ImagePlus className="size-5" aria-hidden="true" />} title="Nenhuma imagem enviada" description="Comece pelas fotos das páginas do cardápio. Fotos de pratos podem vir depois." />
        ) : (
          <div className="space-y-6 p-5">
            {groups.map((g) => (
              <div key={g.purpose}>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  {PURPOSE_LABEL[g.purpose]} <span className="font-normal text-ink-faint">({g.items.length})</span>
                  {PRIVATE_PURPOSES.includes(g.purpose) && <Badge><Lock className="size-3" aria-hidden="true" /> privada</Badge>}
                </h3>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {g.items.map((a) => (
                    <li key={a.id} className="overflow-hidden rounded-lg ring-1 ring-line">
                      <a href={a.fileUrl} target="_blank" rel="noopener noreferrer" className="block aspect-[4/3] bg-canvas">
                        {a.fileUrl && <img src={a.fileUrl} alt={a.originalFilename} className="size-full object-cover" loading="lazy" />}
                      </a>
                      <div className="flex items-center gap-1 px-2 py-1.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-medium" title={a.originalFilename}>{a.originalFilename}</p>
                          <p className="flex items-center gap-1 text-[11px] text-ink-faint">
                            {formatBytes(a.sizeBytes)}
                            {a.analyzedAt && <><CheckCircle2 className="size-3 text-ok" aria-hidden="true" /> analisada</>}
                            {a.analysisError && <span className="text-danger">· erro na análise</span>}
                          </p>
                        </div>
                        <IconButton label={`Excluir ${a.originalFilename}`} onClick={() => setToDelete(a)}>
                          <Trash2 className="size-4" aria-hidden="true" />
                        </IconButton>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <Button variant="primary" onClick={() => navigate('../extracao')} disabled={!bundle.assets.some((a) => a.purpose === 'menu_page') && bundle.products.length === 0}>
          Continuar para Extração
        </Button>
      </div>

      <Dialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Excluir imagem?"
        footer={<><Button onClick={() => setToDelete(null)}>Cancelar</Button><Button variant="danger" onClick={confirmDelete}>Excluir</Button></>}
      >
        <p className="text-sm text-ink-soft">
          A imagem será removida do armazenamento. Produtos, logotipo ou capa que a usam ficarão sem imagem. Itens já extraídos desta página continuam no editor.
        </p>
      </Dialog>
    </div>
  );
}
