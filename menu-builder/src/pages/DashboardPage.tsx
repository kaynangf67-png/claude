import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Archive, ArchiveRestore, Copy, Eye, FolderOpen, MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { StatusBadge } from '@/components/project/StatusBadge';
import { Badge, Button, Card, Dialog, EmptyState, IconButton, Input, Notice, Spinner } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { getRepository } from '@/data';
import type { ProjectStatus, ProjectSummary } from '@/domain/types';
import { cn, formatDateTime } from '@/lib/format';

const IN_PROGRESS: ProjectStatus[] = ['setup', 'awaiting_analysis', 'awaiting_review', 'approved'];
type Filter = 'todos' | 'andamento' | 'publicados' | 'arquivados';

export function DashboardPage() {
  const repo = getRepository();
  const toast = useToast();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('todos');
  const [query, setQuery] = useState('');
  const [toDelete, setToDelete] = useState<ProjectSummary | null>(null);

  const load = useCallback(() => {
    repo.listProjects().then(setProjects).catch((e: Error) => setError(e.message));
  }, [repo]);
  useEffect(load, [load]);

  const stats = useMemo(() => {
    const list = projects ?? [];
    return [
      { label: 'Projetos criados', value: list.length },
      { label: 'Em andamento', value: list.filter((p) => IN_PROGRESS.includes(p.status)).length },
      { label: 'Publicados', value: list.filter((p) => p.status === 'published').length },
      { label: 'Aguardando revisão', value: list.filter((p) => p.status === 'awaiting_review' || p.pendingReviewCount > 0).length },
    ];
  }, [projects]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (projects ?? [])
      .filter((p) => {
        if (filter === 'andamento') return IN_PROGRESS.includes(p.status);
        if (filter === 'publicados') return p.status === 'published';
        if (filter === 'arquivados') return p.status === 'archived';
        return p.status !== 'archived';
      })
      .filter((p) => !q || p.restaurantName.toLowerCase().includes(q) || p.businessType.toLowerCase().includes(q));
  }, [projects, filter, query]);

  async function duplicate(p: ProjectSummary) {
    try {
      const copy = await repo.duplicateProject(p.id);
      toast('success', `Cópia criada: ${copy.restaurantName}`);
      load();
    } catch (e) {
      toast('error', (e as Error).message);
    }
  }

  async function setArchived(p: ProjectSummary, archived: boolean) {
    try {
      await repo.updateProject(p.id, { status: archived ? 'archived' : 'setup' });
      toast('success', archived ? 'Projeto arquivado. O cardápio público saiu do ar.' : 'Projeto restaurado como "Em configuração".');
      load();
    } catch (e) {
      toast('error', (e as Error).message);
    }
  }

  async function remove() {
    if (!toDelete) return;
    try {
      await repo.deleteProject(toDelete.id);
      toast('success', 'Projeto excluído.');
      setToDelete(null);
      load();
    } catch (e) {
      toast('error', (e as Error).message);
    }
  }

  return (
    <>
      <PageHeader
        title="Painel"
        description="Acompanhe os cardápios em produção e publicados."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" aria-hidden="true" />} onClick={() => navigate('/projetos/novo')}>
            Novo cardápio
          </Button>
        }
      />
      <div className="space-y-6 px-4 sm:px-8">
        {error && <Notice tone="danger" title="Erro ao carregar">{error}</Notice>}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label} className="px-4 py-4">
              <p className="text-[13px] text-ink-soft">{s.label}</p>
              <p className="tabular mt-1 text-2xl font-semibold">{projects ? s.value : '–'}</p>
            </Card>
          ))}
        </div>

        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Filtrar projetos">
              {(['todos', 'andamento', 'publicados', 'arquivados'] as Filter[]).map((f) => (
                <button
                  key={f}
                  role="tab"
                  aria-selected={filter === f}
                  onClick={() => setFilter(f)}
                  className={cn('h-8 rounded-md px-3 text-[13px] font-medium whitespace-nowrap', filter === f ? 'bg-accent-soft text-accent' : 'text-ink-soft hover:bg-canvas')}
                >
                  {{ todos: 'Ativos', andamento: 'Em andamento', publicados: 'Publicados', arquivados: 'Arquivados' }[f]}
                </button>
              ))}
            </div>
            <label className="relative w-full sm:w-64">
              <span className="sr-only">Buscar projeto</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar restaurante" className="h-9 pl-9" />
            </label>
          </div>

          {!projects && !error ? (
            <Spinner />
          ) : visible.length === 0 ? (
            projects && projects.length === 0 ? (
              <EmptyState
                icon={<FolderOpen className="size-5" aria-hidden="true" />}
                title="Nenhum cardápio ainda"
                description="Crie o primeiro projeto: informe o restaurante, envie as fotos do cardápio e revise os itens."
                action={<Button variant="primary" onClick={() => navigate('/projetos/novo')}>Novo cardápio</Button>}
              />
            ) : (
              <p className="px-4 py-12 text-center text-sm text-ink-soft">Nenhum projeto neste filtro.</p>
            )
          ) : (
            <ul className="divide-y divide-line">
              {visible.map((p) => (
                <ProjectRow key={p.id} project={p} onDuplicate={() => duplicate(p)} onArchive={(a) => setArchived(p, a)} onDelete={() => setToDelete(p)} />
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Dialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Excluir projeto?"
        footer={
          <>
            <Button onClick={() => setToDelete(null)}>Cancelar</Button>
            <Button variant="danger" onClick={remove}>Excluir definitivamente</Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">
          <strong className="text-ink">{toDelete?.restaurantName}</strong> será excluído com todas as categorias, produtos e imagens. Se estiver publicado, o link e o QR Code
          deixam de funcionar. Esta ação não pode ser desfeita. Para apenas tirar do ar, use <em>Arquivar</em>.
        </p>
      </Dialog>
    </>
  );
}

function ProjectRow({ project: p, onDuplicate, onArchive, onDelete }: { project: ProjectSummary; onDuplicate: () => void; onArchive: (archived: boolean) => void; onDelete: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenuOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const initials = p.restaurantName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {p.logoUrl ? (
          <img src={p.logoUrl} alt="" className="size-11 shrink-0 rounded-lg bg-canvas object-contain ring-1 ring-line" />
        ) : (
          <span className="grid size-11 shrink-0 place-items-center rounded-lg text-sm font-semibold text-white" style={{ background: p.primaryColor }} aria-hidden="true">
            {initials || '?'}
          </span>
        )}
        <div className="min-w-0">
          <Link to={`/projetos/${p.id}`} className="block truncate text-[15px] font-semibold text-ink hover:text-accent">
            {p.restaurantName}
          </Link>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-ink-faint">
            {p.businessType && <span>{p.businessType}</span>}
            <span>Atualizado {formatDateTime(p.updatedAt)}</span>
            <span>{p.productCount} {p.productCount === 1 ? 'item' : 'itens'}</span>
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {p.isDemo && <Badge tone="warn">Fictício</Badge>}
        {p.pendingReviewCount > 0 && <Badge tone="warn">{p.pendingReviewCount} para revisar</Badge>}
        <StatusBadge status={p.status} />
      </div>
      <div className="flex items-center gap-1">
        <Link to={`/projetos/${p.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium ring-1 ring-line-strong hover:bg-canvas">
          <Pencil className="size-3.5" aria-hidden="true" /> Editar
        </Link>
        <Link to={`/projetos/${p.id}/previa`} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-soft hover:bg-canvas">
          <Eye className="size-3.5" aria-hidden="true" /> Visualizar
        </Link>
        <IconButton label="Duplicar" onClick={onDuplicate}>
          <Copy className="size-4" aria-hidden="true" />
        </IconButton>
        <div className="relative" ref={menuRef}>
          <IconButton label="Mais ações" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </IconButton>
          {menuOpen && (
            <div role="menu" className="absolute right-0 z-20 mt-1 w-44 rounded-lg bg-panel py-1 shadow-pop ring-1 ring-line">
              <button role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-canvas" onClick={() => { setMenuOpen(false); onArchive(p.status !== 'archived'); }}>
                {p.status === 'archived' ? <ArchiveRestore className="size-4" aria-hidden="true" /> : <Archive className="size-4" aria-hidden="true" />}
                {p.status === 'archived' ? 'Restaurar' : 'Arquivar'}
              </button>
              <button role="menuitem" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft" onClick={() => { setMenuOpen(false); onDelete(); }}>
                <Trash2 className="size-4" aria-hidden="true" /> Excluir
              </button>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
