import { useMemo, useRef, useState, type DragEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Archive, Clapperboard, Copy, Link2, MoreVertical, Pencil, Play, Radio, Search, Send, Trash2, UploadCloud } from 'lucide-react';
import { EmptyState, PageHeader } from '@/components/app/page';
import { VideoThumb } from '@/components/app/media';
import { VideoStatusBadge } from '@/components/app/status';
import { useConfirm } from '@/components/app/confirm';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input, NativeSelect } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/misc';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useServices } from '@/contexts/services';
import { qk, useAction, usePlan, useProducts, useVideos } from '@/hooks/queries';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { VIDEO_MIME_TYPES } from '@/lib/validation';
import type { Video, VideoStatus } from '@/types/domain';
import { UploadDialog } from './UploadDialog';
import { VideoPlayerDialog } from './VideoPlayerDialog';

type EditMode = { kind: 'rename' | 'product'; video: Video } | null;

function EditDialog({ edit, onClose }: { edit: EditMode; onClose: () => void }) {
  const services = useServices();
  const products = useProducts();
  const [value, setValue] = useState(() => (edit?.kind === 'rename' ? edit.video.name : edit?.video.product_id ?? ''));
  const save = useAction(
    () => (edit!.kind === 'rename' ? services.videos.rename(edit!.video.id, value) : services.videos.setProduct(edit!.video.id, value || null)),
    { invalidate: [qk.videos], success: 'Vídeo atualizado', onSuccess: onClose },
  );
  return (
    <Dialog open={Boolean(edit)} onOpenChange={(o) => !o && onClose()}>
      {edit && (
        <DialogContent title={edit.kind === 'rename' ? 'Renomear vídeo' : 'Associar produto'}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(undefined);
            }}
          >
            {edit.kind === 'rename' ? (
              <Field label="Nome" htmlFor="v-name">
                <Input id="v-name" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
              </Field>
            ) : (
              <Field label="Produto" htmlFor="v-prod">
                <NativeSelect id="v-prod" value={value} onChange={(e) => setValue(e.target.value)}>
                  <option value="">Nenhum</option>
                  {(products.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" loading={save.isPending}>Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}

export default function VideosPage() {
  const services = useServices();
  const plan = usePlan();
  const videos = useVideos();
  const products = useProducts();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<VideoStatus | 'all'>('all');
  const [dragging, setDragging] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [edit, setEdit] = useState<EditMode>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirm, confirmNode] = useConfirm();

  const productMap = useMemo(() => new Map((products.data ?? []).map((p) => [p.id, p])), [products.data]);
  const playing = (videos.data ?? []).find((v) => v.id === params.get('v')) ?? null;

  const duplicate = useAction((id: string) => services.videos.duplicate(id, plan), { invalidate: [qk.videos], success: 'Configuração duplicada' });
  const archive = useAction((v: Video) => services.videos.setStatus(v.id, v.status === 'archived' ? 'available' : 'archived'), { invalidate: [qk.videos], success: 'Status atualizado' });
  const remove = useAction((id: string) => services.videos.remove(id), { invalidate: [qk.videos, qk.lives], success: 'Vídeo excluído' });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (videos.data ?? []).filter(
      (v) =>
        (status === 'all' ? v.status !== 'archived' : v.status === status) &&
        (!q || v.name.toLowerCase().includes(q) || (v.product_id && productMap.get(v.product_id)?.name.toLowerCase().includes(q))),
    );
  }, [videos.data, query, status, productMap]);

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('video/'));
    if (files.length) setUploadFiles(files);
  }

  const openPlayer = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('v', id);
    else next.delete('v');
    setParams(next, { replace: true });
  };

  return (
    <div className="animate-in" onDragOver={(e) => { e.preventDefault(); setDragging(true); }}>
      <PageHeader
        title="Biblioteca de vídeos"
        description="Seus vídeos ficam privados. Nenhum envio para plataformas externas acontece sem sua autorização."
        actions={
          <Button onClick={() => fileRef.current?.click()}>
            <UploadCloud /> Enviar vídeos
          </Button>
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept={VIDEO_MIME_TYPES.join(',')}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) setUploadFiles([...e.target.files]);
          e.target.value = '';
        }}
      />

      <div
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false); }}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && fileRef.current?.click()}
        className={cn(
          'mb-6 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/40',
        )}
      >
        <UploadCloud className={cn('size-8', dragging ? 'text-primary' : 'text-muted-foreground')} strokeWidth={1.6} />
        <p className="mt-2 text-sm font-medium">{dragging ? 'Solte para enviar' : 'Arraste vídeos aqui ou clique para selecionar'}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">MP4, MOV ou WebM · até 2 GB por arquivo</p>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome ou produto" className="pl-9" aria-label="Buscar vídeos" />
        </div>
        <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as VideoStatus | 'all')} className="sm:w-60" aria-label="Status">
          <option value="all">Todos (exceto arquivados)</option>
          <option value="available">Disponível</option>
          <option value="scheduled">Agendado</option>
          <option value="streaming">Em transmissão</option>
          <option value="finished">Finalizado</option>
          <option value="archived">Arquivado</option>
        </NativeSelect>
      </div>

      {videos.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="aspect-[4/3.2]" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Clapperboard} title={(videos.data ?? []).length ? 'Nada encontrado' : 'Nenhum vídeo ainda'} description={(videos.data ?? []).length ? 'Ajuste a busca ou o filtro.' : 'Envie seu primeiro vídeo para transformá-lo em live.'} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((v) => {
            const product = v.product_id ? productMap.get(v.product_id) : null;
            return (
              <Card key={v.id} className="group overflow-hidden">
                <button className="relative block w-full" onClick={() => openPlayer(v.id)} aria-label={`Assistir ${v.name}`}>
                  <VideoThumb video={v} className="aspect-video w-full rounded-none" />
                  <span className="absolute inset-0 grid place-items-center bg-black/0 transition-colors group-hover:bg-black/25">
                    <span className="grid size-11 scale-90 place-items-center rounded-full bg-white/90 text-black opacity-0 shadow-lg transition-all group-hover:scale-100 group-hover:opacity-100">
                      <Play className="size-5 translate-x-px fill-current" />
                    </span>
                  </span>
                  <span className="absolute top-2 left-2">
                    <VideoStatusBadge status={v.status} />
                  </span>
                </button>
                <div className="flex items-start gap-2 p-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={v.name}>{v.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{product?.name ?? 'Sem produto'}</p>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {formatDate(v.created_at)} · {v.usage_count} {v.usage_count === 1 ? 'uso' : 'usos'}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${v.name}`}>
                        <MoreVertical />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onSelect={() => openPlayer(v.id)}><Play /> Visualizar</DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to={`/publicacoes?nova=1&video=${v.id}${v.product_id ? `&produto=${v.product_id}` : ''}`}><Send /> Programar publicação</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link to={`/lives/nova?video=${v.id}`}><Radio /> Usar numa live</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setEdit({ kind: 'rename', video: v })}><Pencil /> Renomear</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setEdit({ kind: 'product', video: v })}><Link2 /> Associar produto</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => duplicate.mutate(v.id)}><Copy /> Duplicar configuração</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => archive.mutate(v)}><Archive /> {v.status === 'archived' ? 'Desarquivar' : 'Arquivar'}</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        destructive
                        onSelect={async () => {
                          if (await confirm({ title: `Excluir "${v.name}"?`, description: 'O arquivo será removido. Lives que usam este vídeo perdem o vínculo.', confirmLabel: 'Excluir', destructive: true })) remove.mutate(v.id);
                        }}
                      >
                        <Trash2 /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <UploadDialog files={uploadFiles} onClose={() => setUploadFiles([])} />
      <VideoPlayerDialog video={playing} product={playing?.product_id ? productMap.get(playing.product_id) : null} onOpenChange={(o) => !o && openPlayer(null)} />
      <EditDialog key={edit ? `${edit.kind}-${edit.video.id}` : 'none'} edit={edit} onClose={() => setEdit(null)} />
      {confirmNode}
    </div>
  );
}
