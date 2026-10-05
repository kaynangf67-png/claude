import { Database, RotateCcw, Trash2 } from 'lucide-react';
import { BusinessForm } from '../components/BusinessForm';
import { PageHeader } from '../components/ui';
import { actions, toast, useAppState } from '../lib/store';

export function Settings() {
  const { business, leads } = useAppState();
  if (!business) return null;

  return (
    <>
      <PageHeader title="Minha empresa" subtitle="Tudo o que a IA sabe sobre o seu negócio está aqui." />
      <BusinessForm
        initial={business}
        submitLabel="Salvar alterações"
        onSubmit={(b) => {
          actions.saveBusiness(b);
          toast({ title: 'Informações salvas', description: 'A IA já usa os dados atualizados.' });
        }}
      />

      <section className="card mt-8 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <Database className="size-4" /> Dados de demonstração
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Você tem {leads.length} {leads.length === 1 ? 'lead' : 'leads'}. Os dados ficam salvos só neste navegador.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="btn-secondary"
            onClick={() => {
              if (confirm('Substituir seus leads pelos 10 leads de exemplo?')) {
                actions.loadDemoLeads();
                toast({ title: 'Dados de exemplo restaurados' });
              }
            }}
          >
            <RotateCcw className="size-4" /> Restaurar leads de exemplo
          </button>
          <button
            className="btn-ghost text-red-600 hover:bg-red-50"
            onClick={() => {
              if (confirm('Apagar todos os leads? O painel volta para R$ 0,00.')) {
                actions.clearLeads();
                toast({ title: 'Leads apagados', tone: 'info' });
              }
            }}
          >
            <Trash2 className="size-4" /> Começar do zero
          </button>
        </div>
      </section>
    </>
  );
}
