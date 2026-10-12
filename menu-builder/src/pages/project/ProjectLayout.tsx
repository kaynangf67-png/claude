import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Eye } from 'lucide-react';
import { StatusBadge } from '@/components/project/StatusBadge';
import { Badge, Notice, Spinner } from '@/components/ui';
import { getRepository, type ProjectPatch } from '@/data';
import { canApprove } from '@/domain/rules';
import type { ProjectBundle } from '@/domain/types';
import { cn } from '@/lib/format';

interface ProjectCtx {
  bundle: ProjectBundle;
  reload: () => Promise<void>;
  setBundle: (updater: (b: ProjectBundle) => ProjectBundle) => void;
  updateProject: (patch: ProjectPatch) => Promise<void>;
}

const Ctx = createContext<ProjectCtx | null>(null);
export function useProject(): ProjectCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProject fora do ProjectLayout');
  return ctx;
}

const STEPS = [
  { path: 'dados', label: 'Dados' },
  { path: 'materiais', label: 'Materiais' },
  { path: 'extracao', label: 'Extração' },
  { path: 'cardapio', label: 'Revisão' },
  { path: 'aparencia', label: 'Aparência' },
  { path: 'publicacao', label: 'Publicação' },
] as const;

function stepDone(path: (typeof STEPS)[number]['path'], b: ProjectBundle): boolean {
  switch (path) {
    case 'dados':
      return b.project.restaurantName.trim() !== '';
    case 'materiais':
      return b.assets.length > 0;
    case 'extracao':
      return b.assets.some((a) => a.analyzedAt) || b.products.some((p) => p.sourceReference.startsWith('ia:'));
    case 'cardapio':
      return b.products.length > 0 && !b.products.some((p) => p.reviewRequired);
    case 'aparencia':
      return Boolean(b.project.logoUrl || b.project.coverUrl);
    case 'publicacao':
      return b.project.status === 'published' || (b.project.status === 'approved' && canApprove(b));
  }
}

export function ProjectLayout() {
  const { projectId = '' } = useParams();
  const repo = getRepository();
  const [bundle, setBundleState] = useState<ProjectBundle | null>(null);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    try {
      const b = await repo.getBundle(projectId);
      if (!b) setError('Projeto não encontrado ou sem permissão de acesso.');
      setBundleState(b);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [repo, projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const updateProject = useCallback(
    async (patch: ProjectPatch) => {
      const project = await repo.updateProject(projectId, patch);
      setBundleState((b) => (b ? { ...b, project } : b));
    },
    [repo, projectId],
  );

  if (error) return <div className="p-4 sm:p-8"><Notice tone="danger" title="Não foi possível abrir o projeto">{error} <Link to="/">Voltar ao painel</Link></Notice></div>;
  if (!bundle) return <Spinner label="Carregando projeto…" />;

  const pending = bundle.products.filter((p) => p.reviewRequired).length;
  return (
    <Ctx.Provider value={{ bundle, reload, updateProject, setBundle: (fn) => setBundleState((b) => (b ? fn(b) : b)) }}>
      <div className="border-b border-line bg-panel">
        <div className="px-4 pt-5 sm:px-8">
          <Link to="/" className="inline-flex items-center gap-1 text-[13px] text-ink-faint hover:text-ink">
            <ArrowLeft className="size-3.5" aria-hidden="true" /> Painel
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="min-w-0 truncate text-xl font-semibold tracking-tight">{bundle.project.restaurantName || 'Novo projeto'}</h1>
            <StatusBadge status={bundle.project.status} />
            {bundle.project.isDemo && <Badge tone="warn">Projeto fictício</Badge>}
            {pending > 0 && <Badge tone="warn">{pending} para revisar</Badge>}
            <Link to={`/projetos/${projectId}/previa`} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium ring-1 ring-line-strong hover:bg-canvas">
              <Eye className="size-3.5" aria-hidden="true" /> Prévia
            </Link>
          </div>
        </div>
        <nav aria-label="Etapas do projeto" className="mt-4 overflow-x-auto px-2 sm:px-6">
          <ol className="flex min-w-max">
            {STEPS.map((s, i) => {
              const done = stepDone(s.path, bundle);
              return (
                <li key={s.path}>
                  <NavLink
                    to={s.path}
                    className={({ isActive }) =>
                      cn('flex h-11 items-center gap-2 border-b-2 px-3 text-[13px] font-medium whitespace-nowrap', isActive ? 'border-accent text-accent' : 'border-transparent text-ink-soft hover:text-ink')
                    }
                  >
                    <span className={cn('grid size-5 place-items-center rounded-full text-[11px] font-semibold', done ? 'bg-ok text-white' : 'bg-canvas text-ink-soft ring-1 ring-line-strong')}>
                      {done ? <Check className="size-3" aria-label="concluída" /> : i + 1}
                    </span>
                    {s.label}
                  </NavLink>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
      <div className="px-4 py-6 sm:px-8">
        <Outlet />
      </div>
    </Ctx.Provider>
  );
}
