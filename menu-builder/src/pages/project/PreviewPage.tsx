import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { MenuView } from '@/components/menu/MenuView';
import { Notice, Spinner } from '@/components/ui';
import { getRepository } from '@/data';
import { toPreviewMenu } from '@/domain/rules';
import type { ProjectBundle } from '@/domain/types';

/** Prévia privada: mostra exatamente o que o público veria se o cardápio fosse publicado agora. */
export function PreviewPage() {
  const { projectId = '' } = useParams();
  const [bundle, setBundle] = useState<ProjectBundle | null | undefined>(undefined);
  const [error, setError] = useState('');
  useEffect(() => {
    getRepository().getBundle(projectId).then(setBundle).catch((e: Error) => setError(e.message));
  }, [projectId]);

  if (error) return <div className="p-6"><Notice tone="danger">{error}</Notice></div>;
  if (bundle === undefined) return <Spinner />;
  if (bundle === null) return <div className="p-6"><Notice tone="danger">Projeto não encontrado.</Notice></div>;

  const hidden = bundle.products.length - toPreviewMenu(bundle).categories.reduce((n, c) => n + c.products.length, 0);
  return (
    <MenuView
      menu={toPreviewMenu(bundle)}
      banner={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-ink px-4 py-2 text-[13px] text-white">
          <Link to={`/projetos/${projectId}/cardapio`} className="inline-flex items-center gap-1 font-medium underline"><ArrowLeft className="size-3.5" aria-hidden="true" /> Voltar ao editor</Link>
          <span>Prévia privada{hidden > 0 ? ` · ${hidden} item(ns) ocultos por estarem em revisão ou sem preço` : ''}</span>
        </div>
      }
    />
  );
}
