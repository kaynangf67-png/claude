import { useState, type FormEvent, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Card, CardHeader, Field, Input, Notice, Select, Textarea } from '@/components/ui';
import type { ProjectInput } from '@/data';
import { projectFieldErrors } from '@/domain/rules';
import { MENU_THEMES, THEME_LABEL } from '@/domain/types';

const BUSINESS_TYPES = ['Restaurante', 'Lanchonete', 'Pizzaria', 'Hamburgueria', 'Cafeteria', 'Doceria', 'Bar', 'Churrascaria', 'Marmitaria', 'Açaíteria', 'Padaria', 'Sorveteria'];

interface Props {
  initial: ProjectInput;
  submitLabel: string;
  onSubmit: (value: ProjectInput) => Promise<void>;
  /** Botões extras do rodapé. Recebe o estado atual para "salvar rascunho". */
  footer: (state: { busy: boolean; submit: () => void }) => ReactNode;
}

export function ProjectForm({ initial, onSubmit, footer }: Props) {
  const [value, setValue] = useState<ProjectInput>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);

  const set = <K extends keyof ProjectInput>(key: K, v: ProjectInput[K]) => {
    setValue((prev) => ({ ...prev, [key]: v }));
    if (touched) setErrors(projectFieldErrors({ ...value, [key]: v }));
  };

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    setTouched(true);
    const found = projectFieldErrors(value);
    setErrors(found);
    if (Object.keys(found).length) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
      return;
    }
    setBusy(true);
    try {
      await onSubmit({ ...value, restaurantName: value.restaurantName.trim() });
    } finally {
      setBusy(false);
    }
  }

  const text = (key: keyof ProjectInput) => ({
    value: String(value[key] ?? ''),
    onChange: (e: { target: { value: string } }) => set(key, e.target.value as never),
    'aria-invalid': errors[key] ? true : undefined,
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Card>
        <CardHeader title="Restaurante" description="Os campos com * são essenciais. Os demais podem ser preenchidos depois." />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Nome do restaurante" required error={errors.restaurantName} className="sm:col-span-2">
            {(id, d) => <Input id={id} aria-describedby={d} autoFocus maxLength={120} {...text('restaurantName')} />}
          </Field>
          <Field label="Tipo de estabelecimento">
            {(id) => (
              <>
                <Input id={id} list="business-types" placeholder="Ex.: Pizzaria" {...text('businessType')} />
                <datalist id="business-types">{BUSINESS_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
              </>
            )}
          </Field>
          <Field label="Telefone" hint="Como deve aparecer no cardápio.">
            {(id, d) => <Input id={id} aria-describedby={d} type="tel" placeholder="(27) 3333-3333" {...text('phone')} />}
          </Field>
          <Field label="Descrição curta" hint="Uma ou duas frases aprovadas pelo restaurante." className="sm:col-span-2">
            {(id, d) => <Textarea id={id} aria-describedby={d} maxLength={300} {...text('description')} />}
          </Field>
          <Field label="Endereço" className="sm:col-span-2">
            {(id) => <Textarea id={id} rows={2} placeholder={'Rua Exemplo, 123 — Centro\nCidade - UF'} {...text('address')} />}
          </Field>
          <Field label="Horário de funcionamento" hint="Uma linha por período." className="sm:col-span-2">
            {(id, d) => <Textarea id={id} aria-describedby={d} rows={3} placeholder={'Segunda a sexta: 11h às 15h\nSábado: 11h às 16h'} {...text('openingHours')} />}
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="WhatsApp de contato" description="Botão opcional apenas para contato geral. O cardápio não faz pedidos." />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Número do WhatsApp" error={errors.whatsappNumber} hint="DDD + número.">
            {(id, d) => <Input id={id} aria-describedby={d} type="tel" placeholder="(27) 99999-9999" {...text('whatsappNumber')} />}
          </Field>
          <label className="flex items-start gap-3 self-end rounded-lg p-2 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--color-accent)]" checked={value.showWhatsapp} onChange={(e) => set('showWhatsapp', e.target.checked)} />
            <span>
              <span className="font-medium">Exibir botão de WhatsApp no cardápio</span>
              <span className="block text-[13px] text-ink-faint">Marque só com autorização do restaurante.</span>
            </span>
          </label>
        </div>
      </Card>

      <Card>
        <CardHeader title="Links oficiais" description="Referências para a equipe e botões no cardápio público." />
        <div className="space-y-4 p-5">
          <Notice tone="neutral" icon={<Info className="size-4" aria-hidden="true" />}>
            Nesta versão os dados <strong>não são importados automaticamente</strong> destes links: Instagram e Google Maps não permitem leitura livre por terceiros.
            Copie as informações para os campos acima ou envie capturas de tela na etapa Materiais.
          </Notice>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Instagram" error={errors.instagramUrl}>
              {(id, d) => <Input id={id} aria-describedby={d} type="url" placeholder="https://instagram.com/..." {...text('instagramUrl')} />}
            </Field>
            <Field label="Google Maps" error={errors.googleMapsUrl}>
              {(id, d) => <Input id={id} aria-describedby={d} type="url" placeholder="https://maps.app.goo.gl/..." {...text('googleMapsUrl')} />}
            </Field>
            <Field label="Site oficial" error={errors.websiteUrl}>
              {(id, d) => <Input id={id} aria-describedby={d} type="url" placeholder="https://..." {...text('websiteUrl')} />}
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Identidade visual" description="Pode ajustar depois na etapa Aparência, com prévia ao vivo. O logotipo é enviado na etapa Materiais." />
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <ColorField label="Cor principal" hint="Preços e botões." value={value.primaryColor} error={errors.primaryColor} onChange={(v) => set('primaryColor', v)} />
          <ColorField label="Cor secundária" hint="Fundo do topo do cardápio." value={value.secondaryColor} error={errors.secondaryColor} onChange={(v) => set('secondaryColor', v)} />
          <Field label="Estilo visual">
            {(id) => (
              <Select id={id} value={value.theme} onChange={(e) => set('theme', e.target.value as ProjectInput['theme'])}>
                {MENU_THEMES.map((t) => <option key={t} value={t}>{THEME_LABEL[t]}</option>)}
              </Select>
            )}
          </Field>
        </div>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">{footer({ busy, submit: () => submit() })}</div>
    </form>
  );
}

export function ColorField({ label, hint, value, error, onChange }: { label: string; hint?: string; value: string; error?: string; onChange: (v: string) => void }) {
  return (
    <Field label={label} hint={hint} error={error}>
      {(id, d) => (
        <div className="flex gap-2">
          <input type="color" aria-label={`${label}: seletor`} value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 shrink-0 cursor-pointer rounded-lg bg-panel p-1 ring-1 ring-line-strong" />
          <Input id={id} aria-describedby={d} aria-invalid={error ? true : undefined} value={value} onChange={(e) => onChange(e.target.value.trim())} maxLength={7} className="font-mono uppercase" />
        </div>
      )}
    </Field>
  );
}
