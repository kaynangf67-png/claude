import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, Copy, ExternalLink, Globe, Loader2 } from 'lucide-react';
import { QrCode } from '@/components/menu/QrCode';
import { Badge, Button, Card, CardHeader, Field, Input, Notice } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { getRepository } from '@/data';
import { canApprove, publishChecks, slugError, slugify } from '@/domain/rules';
import { formatDateTime } from '@/lib/format';
import { publicMenuUrl } from '@/lib/env';
import { useProject } from './ProjectLayout';

type SlugState = { kind: 'idle' } | { kind: 'checking' } | { kind: 'ok' } | { kind: 'error'; message: string };

export function PublishStep() {
  const { bundle, updateProject } = useProject();
  const repo = getRepository();
  const toast = useToast();
  const p = bundle.project;
  const [slug, setSlug] = useState(p.slug ?? slugify(p.restaurantName));
  const [slugState, setSlugState] = useState<SlugState>({ kind: 'idle' });
  const [busy, setBusy] = useState<string | null>(null);

  const checks = publishChecks({ ...bundle, project: { ...p, slug: p.slug } });
  const ready = canApprove(bundle);
  const slugChanged = slug !== (p.slug ?? '');

  // Valida formato na hora e disponibilidade com atraso.
  useEffect(() => {
    if (!slugChanged) return setSlugState({ kind: 'idle' });
    const formatError = slugError(slug);
    if (formatError) return setSlugState({ kind: 'error', message: formatError });
    setSlugState({ kind: 'checking' });
    const t = setTimeout(async () => {
      try {
        const free = await repo.isSlugAvailable(slug, p.id);
        setSlugState(free ? { kind: 'ok' } : { kind: 'error', message: 'Este endereço já está em uso. Tente outro.' });
      } catch (e) {
        setSlugState({ kind: 'error', message: (e as Error).message });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [slug, slugChanged, repo, p.id]);

  async function run(label: string, fn: () => Promise<void>, success: string) {
    setBusy(label);
    try {
      await fn();
      toast('success', success);
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const url = p.slug ? publicMenuUrl(p.slug) : null;
  const isLive = p.status === 'published';

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Card>
        <CardHeader title="Endereço público" description="Parte final do link do cardápio. Mudar o endereço de um cardápio publicado invalida QR Codes já impressos." />
        <div className="space-y-3 p-5">
          <Field label="Endereço" required error={slugState.kind === 'error' ? slugState.message : undefined} hint={url ? `Atual: ${url}` : undefined}>
            {(id, d) => (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-ink-faint">{publicMenuUrl('')}</span>
                <Input id={id} aria-describedby={d} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} className="max-w-xs font-mono" maxLength={60} aria-invalid={slugState.kind === 'error' || undefined} />
                {slugState.kind === 'checking' && <Loader2 className="size-4 animate-spin text-ink-faint" aria-label="Verificando" />}
                {slugState.kind === 'ok' && <Badge tone="ok">Disponível</Badge>}
                <Button
                  size="sm"
                  disabled={!slugChanged || slugState.kind !== 'ok'}
                  loading={busy === 'slug'}
                  onClick={() => run('slug', () => updateProject({ slug }), 'Endereço salvo.')}
                >
                  Salvar endereço
                </Button>
              </div>
            )}
          </Field>
          {isLive && slugChanged && <Notice tone="warn">Este cardápio está publicado. Ao trocar o endereço, o link antigo e os QR Codes impressos param de funcionar.</Notice>}
        </div>
      </Card>

      <Card>
        <CardHeader title="Revisão final" description="O cardápio só pode ser aprovado quando todos os itens abaixo estiverem ok." />
        <ul className="divide-y divide-line">
          {checks.map((c) => (
            <li key={c.id} className="flex items-start gap-3 px-5 py-3">
              {c.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-label="ok" /> : <Circle className="mt-0.5 size-4 shrink-0 text-danger" aria-label="pendente" />}
              <div>
                <p className="text-sm font-medium">{c.label}</p>
                {c.detail && <p className="text-[13px] text-ink-soft">{c.detail}</p>}
              </div>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
          <p className="text-[13px] text-ink-soft">
            Confirme com o dono do restaurante os <strong>preços, nomes, fotos e dados do estabelecimento</strong> antes de aprovar.
          </p>
          <div className="flex gap-2">
            <Link to={`/projetos/${p.id}/previa`} className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium ring-1 ring-line-strong hover:bg-canvas">Ver prévia</Link>
            {p.status !== 'approved' && p.status !== 'published' && (
              <Button variant="primary" disabled={!ready} loading={busy === 'approve'} onClick={() => run('approve', () => updateProject({ status: 'approved' }), 'Cardápio aprovado. Agora você pode publicar.')}>
                Aprovar cardápio
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Publicação"
          description={isLive ? `Publicado ${p.publishedAt ? `em ${formatDateTime(p.publishedAt)}` : ''}. Alterações revisadas no editor aparecem no cardápio na hora.` : 'Somente cardápios aprovados podem ser publicados.'}
          action={isLive ? <Badge tone="ok"><Globe className="size-3" aria-hidden="true" /> No ar</Badge> : undefined}
        />
        <div className="space-y-5 p-5">
          {isLive && url ? (
            <>
              <div className="flex flex-wrap gap-2">
                <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover">
                  <ExternalLink className="size-4" aria-hidden="true" /> Abrir cardápio público
                </a>
                <Button icon={<Copy className="size-4" aria-hidden="true" />} onClick={() => navigator.clipboard.writeText(url).then(() => toast('success', 'Link copiado.'), () => toast('error', `Copie manualmente: ${url}`))}>
                  Copiar link
                </Button>
                <Button variant="danger" loading={busy === 'unpublish'} onClick={() => run('unpublish', () => updateProject({ status: 'unpublished' }), 'Cardápio despublicado. O link mostra "não encontrado".')}>
                  Despublicar
                </Button>
              </div>
              {repo.mode === 'demo' && (
                <Notice tone="warn">Modo demonstração: o link só funciona neste navegador, porque os dados estão salvos aqui. Com o Supabase configurado, ele funciona para qualquer pessoa.</Notice>
              )}
              <QrCode url={url} fileName={`qrcode-${p.slug}`} />
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-soft">
                {!p.slug ? 'Defina e salve o endereço público primeiro.' : p.status === 'approved' ? 'Tudo pronto. Publique para gerar o link e o QR Code.' : 'Aprove o cardápio para liberar a publicação.'}
              </p>
              <Button
                variant="primary"
                disabled={p.status !== 'approved' || !ready || !p.slug}
                loading={busy === 'publish'}
                onClick={() => run('publish', () => updateProject({ status: 'published', publishedAt: new Date().toISOString() }), 'Cardápio publicado com sucesso.')}
              >
                Publicar cardápio
              </Button>
            </div>
          )}
          {p.status === 'unpublished' && (
            <Button variant="primary" disabled={!ready || !p.slug} loading={busy === 'republish'} onClick={() => run('republish', () => updateProject({ status: 'published', publishedAt: new Date().toISOString() }), 'Cardápio publicado novamente.')}>
              Publicar novamente
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
