import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '@/components/app/page';
import { Button } from '@/components/ui/button';

export default function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="Página não encontrada"
      description="O endereço pode ter mudado ou o item foi removido."
      action={
        <Button asChild>
          <Link to="/">Voltar ao dashboard</Link>
        </Button>
      }
      className="mt-10"
    />
  );
}
