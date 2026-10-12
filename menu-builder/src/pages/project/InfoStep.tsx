import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProjectForm } from '@/components/project/ProjectForm';
import { Button } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import type { ProjectInput } from '@/data';
import { useProject } from './ProjectLayout';

export function InfoStep() {
  const { bundle, updateProject } = useProject();
  const navigate = useNavigate();
  const toast = useToast();
  const p = bundle.project;
  const initial: ProjectInput = {
    restaurantName: p.restaurantName, description: p.description, businessType: p.businessType, phone: p.phone,
    whatsappNumber: p.whatsappNumber, showWhatsapp: p.showWhatsapp, address: p.address, openingHours: p.openingHours,
    instagramUrl: p.instagramUrl, googleMapsUrl: p.googleMapsUrl, websiteUrl: p.websiteUrl, logoUrl: p.logoUrl,
    coverUrl: p.coverUrl, primaryColor: p.primaryColor, secondaryColor: p.secondaryColor, theme: p.theme,
  };
  const next = useRef(false);
  return (
    <div className="mx-auto max-w-4xl">
      <ProjectForm
        key={p.id}
        initial={initial}
        submitLabel="Salvar"
        onSubmit={async (value) => {
          try {
            // logo/capa são geridos na etapa Aparência; não sobrescrever com valor antigo do formulário.
            const { logoUrl: _l, coverUrl: _c, ...fields } = value;
            await updateProject(fields);
            toast('success', p.status === 'published' ? 'Dados salvos. O cardápio publicado já mostra as alterações.' : 'Dados salvos.');
            if (next.current) navigate('../materiais');
          } catch (e) {
            toast('error', (e as Error).message);
          }
        }}
        footer={({ busy, submit }) => (
          <>
            <Button type="submit" loading={busy} onClick={() => (next.current = false)}>Salvar</Button>
            <Button type="button" variant="primary" disabled={busy} onClick={() => { next.current = true; submit(); }}>Salvar e ir para Materiais</Button>
          </>
        )}
      />
    </div>
  );
}
