import { CheckCircle2, CircleDashed, KeyRound, Plug } from 'lucide-react';
import type { MarketplaceId } from '@vendora/shared';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MarketplaceChip, Notice, PageHeader, Skeleton, Spinner } from '../../components/ui';
import { api, ApiError, type Capabilities, type CapabilityState } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { useToast } from '../../lib/toast';

interface Integration {
  id: MarketplaceId;
  name: string;
  capabilities: Capabilities;
  connection: { status: string; externalUserId: string; expiresAt: string; connectedAt: string } | null;
}

const STATE: Record<CapabilityState, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  implemented_untested: { label: 'Implementado, não testado em produção', cls: 'text-blue-800 bg-blue-50 border-blue-200', icon: CheckCircle2 },
  needs_credentials: { label: 'Depende de credenciais', cls: 'text-amber-800 bg-amber-50 border-amber-200', icon: KeyRound },
  not_implemented: { label: 'Ainda não implementado', cls: 'text-ink-500 bg-ink-100 border-ink-200', icon: CircleDashed },
};

const RESULT: Record<string, { tone: 'info' | 'error'; text: string }> = {
  connected: { tone: 'info', text: 'Conta conectada. A leitura de anúncios do Mercado Livre passa a usar a API oficial.' },
  denied: { tone: 'error', text: 'A autorização foi cancelada no marketplace.' },
  invalid_state: { tone: 'error', text: 'A autorização expirou ou não pertence a esta sessão. Tente conectar de novo.' },
  failed: { tone: 'error', text: 'O marketplace não aceitou a autorização. Confira as credenciais do app.' },
};

function Cap({ label, state }: { label: string; state: CapabilityState }) {
  const s = STATE[state];
  return (
    <div className="flex flex-col items-start gap-1 text-sm">
      <span className="text-ink-700">{label}</span>
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${s.cls}`}>
        <s.icon className="size-3" /> {s.label}
      </span>
    </div>
  );
}

export function IntegrationsPage() {
  const toast = useToast();
  const [params] = useSearchParams();
  const [items, setItems] = useState<Integration[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const result = RESULT[params.get('status') ?? ''];

  const load = () => api.get<{ integrations: Integration[] }>('/api/integrations').then((r) => setItems(r.integrations));
  useEffect(() => {
    load().catch(() => setItems([]));
  }, []);

  async function connect(id: MarketplaceId) {
    setBusy(id);
    try {
      const { url } = await api.post<{ url: string }>(`/api/integrations/${id}/connect`);
      window.location.assign(url);
    } catch (e) {
      toast('error', e instanceof ApiError ? e.message : 'Falha ao iniciar a conexão.');
      setBusy(null);
    }
  }
  async function disconnect(id: MarketplaceId) {
    await api.del(`/api/integrations/${id}`);
    await load();
    toast('success', 'Conta desconectada.');
  }

  return (
    <>
      <PageHeader
        title="Integrações"
        subtitle="Estado real de cada integração. Enquanto a publicação automática não estiver pronta, exporte o anúncio e publique pelo painel do vendedor."
      />
      {result && (
        <div className="mb-6">
          <Notice tone={result.tone}>{result.text}</Notice>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {items === null
          ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-64" />)
          : items.map((it) => {
              const canConnect = it.capabilities.authorization === 'implemented_untested';
              return (
                <div key={it.id} className="card flex flex-col p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <MarketplaceChip id={it.id} />
                    <Plug className="size-4 text-ink-400" />
                  </div>
                  <div className="space-y-3">
                    <Cap label="Autorização da conta" state={it.capabilities.authorization} />
                    <Cap label="Envio do anúncio" state={it.capabilities.publish} />
                    <Cap label="Status da publicação" state={it.capabilities.status} />
                  </div>
                  <div className="mt-5 flex-1 text-xs text-ink-500">
                    {it.id === 'mercado_livre' &&
                      (it.capabilities.authorization === 'needs_credentials'
                        ? 'Para conectar, o administrador precisa criar um app no DevCenter do Mercado Livre e definir ML_CLIENT_ID e ML_CLIENT_SECRET.'
                        : 'Conectar permite ler seus anúncios pela API oficial em vez da página pública.')}
                    {it.id !== 'mercado_livre' &&
                      'Exige cadastro e aprovação como parceiro na plataforma antes de liberar credenciais de API.'}
                  </div>
                  {it.connection ? (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs text-ink-700">
                        Conectado (usuário {it.connection.externalUserId}) · {it.connection.status === 'connected' ? 'ativo' : 'expirado'} ·
                        desde {formatDate(it.connection.connectedAt)}
                      </p>
                      <button className="btn-secondary w-full" onClick={() => disconnect(it.id)}>
                        Desconectar
                      </button>
                    </div>
                  ) : (
                    <button className="btn-secondary mt-4 w-full" disabled={!canConnect || busy === it.id} onClick={() => connect(it.id)}>
                      {busy === it.id && <Spinner />}
                      {canConnect ? 'Conectar conta' : 'Indisponível'}
                    </button>
                  )}
                </div>
              );
            })}
      </div>
    </>
  );
}
