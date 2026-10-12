import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ImageIcon } from 'lucide-react';
import { MenuView } from '@/components/menu/MenuView';
import { ColorField } from '@/components/project/ProjectForm';
import { Button, Card, CardHeader, Field, Select } from '@/components/ui';
import { useToast } from '@/components/ui/toast';
import { HEX_COLOR, toPreviewMenu } from '@/domain/rules';
import { MENU_THEMES, THEME_LABEL, type Asset, type MenuTheme } from '@/domain/types';
import { cn } from '@/lib/format';
import { useProject } from './ProjectLayout';

export function DesignStep() {
  const { bundle, updateProject } = useProject();
  const toast = useToast();
  const p = bundle.project;
  const [draft, setDraft] = useState({ logoUrl: p.logoUrl, coverUrl: p.coverUrl, primaryColor: p.primaryColor, secondaryColor: p.secondaryColor, theme: p.theme });
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify({ logoUrl: p.logoUrl, coverUrl: p.coverUrl, primaryColor: p.primaryColor, secondaryColor: p.secondaryColor, theme: p.theme });
  const valid = HEX_COLOR.test(draft.primaryColor) && HEX_COLOR.test(draft.secondaryColor);

  const preview = useMemo(
    () => toPreviewMenu({ ...bundle, project: { ...p, ...(valid ? draft : { ...draft, primaryColor: p.primaryColor, secondaryColor: p.secondaryColor }) } }),
    [bundle, p, draft, valid],
  );
  const logos = bundle.assets.filter((a) => a.purpose === 'logo');
  const covers = bundle.assets.filter((a) => a.purpose === 'cover' || a.purpose === 'ambiance' || a.purpose === 'dish');

  async function save() {
    setBusy(true);
    try {
      await updateProject(draft);
      toast('success', 'Aparência salva.');
    } catch (e) {
      toast('error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-5">
        <Card>
          <CardHeader title="Estilo e cores" />
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <Field label="Estilo visual">
              {(id) => (
                <Select id={id} value={draft.theme} onChange={(e) => setDraft({ ...draft, theme: e.target.value as MenuTheme })}>
                  {MENU_THEMES.map((t) => <option key={t} value={t}>{THEME_LABEL[t]}</option>)}
                </Select>
              )}
            </Field>
            <ColorField label="Cor principal" hint="Preços e botões." value={draft.primaryColor} error={HEX_COLOR.test(draft.primaryColor) ? undefined : 'Use #rrggbb.'} onChange={(v) => setDraft({ ...draft, primaryColor: v })} />
            <ColorField label="Cor secundária" hint="Topo sem foto de capa." value={draft.secondaryColor} error={HEX_COLOR.test(draft.secondaryColor) ? undefined : 'Use #rrggbb.'} onChange={(v) => setDraft({ ...draft, secondaryColor: v })} />
          </div>
        </Card>
        <ImagePicker title="Logotipo" empty="Envie o logotipo em Materiais com a finalidade “Logotipo”." assets={logos} value={draft.logoUrl} onChange={(logoUrl) => setDraft({ ...draft, logoUrl })} contain />
        <ImagePicker title="Imagem de capa" empty="Envie uma foto de capa, do ambiente ou de um prato em Materiais." assets={covers} value={draft.coverUrl} onChange={(coverUrl) => setDraft({ ...draft, coverUrl })} />
        <div className="flex justify-end gap-2">
          <Button disabled={!dirty || busy} onClick={() => setDraft({ logoUrl: p.logoUrl, coverUrl: p.coverUrl, primaryColor: p.primaryColor, secondaryColor: p.secondaryColor, theme: p.theme })}>Descartar</Button>
          <Button variant="primary" loading={busy} disabled={!dirty || !valid} onClick={save}>Salvar aparência</Button>
        </div>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-2 text-[13px] font-medium text-ink-soft">Prévia no celular (só itens revisados)</p>
        <div className="mx-auto h-[640px] w-full max-w-[380px] overflow-y-auto rounded-[28px] bg-black p-2 shadow-pop">
          <div className="h-full overflow-y-auto rounded-[22px] [&_nav]:static">
            <MenuView menu={preview} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ImagePicker({ title, empty, assets, value, onChange, contain }: { title: string; empty: string; assets: Asset[]; value: string | null; onChange: (v: string | null) => void; contain?: boolean }) {
  return (
    <Card>
      <CardHeader title={title} />
      <div className="p-5">
        {assets.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-ink-soft">
            <ImageIcon className="size-4" aria-hidden="true" /> {empty} <Link to="../materiais" className="font-medium text-accent underline">Ir para Materiais</Link>
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            <li>
              <button type="button" onClick={() => onChange(null)} aria-pressed={value === null} className={cn('grid aspect-square w-full place-items-center rounded-lg text-[12px] text-ink-soft ring-2', value === null ? 'ring-accent' : 'ring-line')}>
                Nenhum
              </button>
            </li>
            {assets.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => onChange(a.fileUrl)} aria-pressed={value === a.fileUrl} aria-label={a.originalFilename} className={cn('block aspect-square w-full overflow-hidden rounded-lg bg-canvas ring-2', value === a.fileUrl ? 'ring-accent' : 'ring-line hover:ring-line-strong')}>
                  <img src={a.fileUrl} alt="" className={cn('size-full', contain ? 'object-contain p-1' : 'object-cover')} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
