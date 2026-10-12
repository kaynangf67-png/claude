import { Link } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { EmptyState } from '@/components/ui';

export function NotFoundPage() {
  return (
    <EmptyState
      icon={<FileQuestion className="size-5" aria-hidden="true" />}
      title="Página não encontrada"
      description="O endereço não existe ou o projeto foi removido."
      action={<Link to="/" className="text-sm font-medium text-accent hover:underline">Voltar ao painel</Link>}
    />
  );
}
