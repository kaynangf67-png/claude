import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/AppShell';
import { ProjectForm } from '@/components/project/ProjectForm';
import { Button } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { DEFAULT_PROJECT, getRepository } from '@/data';

export function NewProjectPage() {
  const navigate = useNavigate();
  const toast = useToast();
  return (
    <>
      <PageHeader title="Novo cardápio" description="Etapa 1 de 6 — dados do restaurante. Só o nome é obrigatório para salvar o rascunho." />
      <div className="mx-auto max-w-4xl px-4 sm:px-8">
        <ProjectForm
          initial={DEFAULT_PROJECT}
          submitLabel="Criar projeto"
          onSubmit={async (value) => {
            try {
              const project = await getRepository().createProject(value);
              toast('success', 'Projeto criado. Agora envie as fotos do cardápio.');
              navigate(`/projetos/${project.id}/materiais`);
            } catch (e) {
              toast('error', (e as Error).message);
            }
          }}
          footer={({ busy }) => (
            <>
              <Button type="button" onClick={() => navigate('/')}>Cancelar</Button>
              <Button type="submit" variant="primary" loading={busy}>Salvar e continuar</Button>
            </>
          )}
        />
      </div>
    </>
  );
}
