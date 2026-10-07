import { useRef, useState, type FormEvent } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { ProductImage } from '@/components/app/media';
import { useServices } from '@/contexts/services';
import { errorMessage } from '@/hooks/queries';
import { fieldErrors, productSchema, validateImageFile, type ProductInput } from '@/lib/validation';
import type { Product } from '@/types/domain';

export const CATEGORIES = ['Eletrônicos', 'Casa', 'Beleza', 'Moda', 'Criadores', 'Fitness', 'Infantil', 'Pet', 'Outros'];

export function toProductInput(p?: Product | null): ProductInput {
  return {
    name: p?.name ?? '',
    description: p?.description ?? '',
    image_url: p?.image_url ?? null,
    price: p ? String(p.price) : '',
    promo_price: p?.promo_price != null ? String(p.promo_price) : '',
    commission_rate: p ? String(p.commission_rate) : '10',
    category: p?.category ?? '',
    product_url: p?.product_url ?? '',
    sku: p?.sku ?? '',
    status: p?.status ?? 'active',
  };
}

export function ProductForm({
  initial,
  submitLabel,
  onSubmit,
  compact,
  footer,
}: {
  initial?: Product | null;
  submitLabel: string;
  onSubmit: (input: ProductInput) => Promise<unknown>;
  compact?: boolean;
  footer?: (submitting: boolean) => React.ReactNode;
}) {
  const services = useServices();
  const [form, setForm] = useState<ProductInput>(() => toProductInput(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const str = (v: unknown) => (v == null ? '' : String(v));

  async function handleImage(file: File | undefined) {
    if (!file) return;
    const invalid = validateImageFile(file);
    if (invalid) return setErrors((e) => ({ ...e, image_url: invalid }));
    setUploading(true);
    try {
      set('image_url', await services.products.uploadImage(file));
      setErrors((e) => ({ ...e, image_url: '' }));
    } catch (err) {
      setErrors((e) => ({ ...e, image_url: errorMessage(err) }));
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = productSchema.safeParse(form);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    setSubmitting(true);
    try {
      await onSubmit(form);
    } catch (err) {
      setErrors({ _: errorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      {!compact && (
        <div className="flex items-center gap-4">
          <ProductImage product={{ id: initial?.id ?? form.name ?? 'novo', name: str(form.name), image_url: form.image_url }} className="size-20 rounded-xl" />
          <div className="grid gap-1.5">
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} loading={uploading}>
                <ImagePlus /> {form.image_url ? 'Trocar imagem' : 'Enviar imagem'}
              </Button>
              {form.image_url && (
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => set('image_url', null)} aria-label="Remover imagem">
                  <Trash2 />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">PNG, JPG ou WebP até 5 MB.</p>
            {errors.image_url && <p className="text-xs text-destructive">{errors.image_url}</p>}
          </div>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => handleImage(e.target.files?.[0])} />
        </div>
      )}

      <Field label="Nome do produto" htmlFor="p-name" error={errors.name}>
        <Input id="p-name" value={str(form.name)} onChange={(e) => set('name', e.target.value)} placeholder="Ex.: Fone Bluetooth Pro" aria-invalid={!!errors.name} autoFocus />
      </Field>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Preço (R$)" htmlFor="p-price" error={errors.price}>
          <Input id="p-price" inputMode="decimal" value={str(form.price)} onChange={(e) => set('price', e.target.value.replace(',', '.'))} placeholder="0,00" aria-invalid={!!errors.price} />
        </Field>
        <Field label="Promocional" htmlFor="p-promo" error={errors.promo_price}>
          <Input id="p-promo" inputMode="decimal" value={str(form.promo_price)} onChange={(e) => set('promo_price', e.target.value.replace(',', '.'))} placeholder="Opcional" aria-invalid={!!errors.promo_price} />
        </Field>
        <Field label="Comissão (%)" htmlFor="p-comm" error={errors.commission_rate} className="col-span-2 sm:col-span-1">
          <Input id="p-comm" inputMode="decimal" value={str(form.commission_rate)} onChange={(e) => set('commission_rate', e.target.value.replace(',', '.'))} aria-invalid={!!errors.commission_rate} />
        </Field>
      </div>

      {!compact && (
        <>
          <Field label="Descrição" htmlFor="p-desc" error={errors.description}>
            <Textarea id="p-desc" value={str(form.description)} onChange={(e) => set('description', e.target.value)} placeholder="Principais benefícios, diferenciais, especificações…" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Categoria" htmlFor="p-cat">
              <NativeSelect id="p-cat" value={str(form.category)} onChange={(e) => set('category', e.target.value)}>
                <option value="">Sem categoria</option>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="SKU" htmlFor="p-sku" error={errors.sku}>
              <Input id="p-sku" value={str(form.sku)} onChange={(e) => set('sku', e.target.value)} placeholder="Opcional" />
            </Field>
          </div>
          <Field label="Link do produto" htmlFor="p-url" error={errors.product_url}>
            <Input id="p-url" type="url" value={str(form.product_url)} onChange={(e) => set('product_url', e.target.value)} placeholder="https://" aria-invalid={!!errors.product_url} />
          </Field>
          <Field label="Status" htmlFor="p-status">
            <NativeSelect id="p-status" value={form.status} onChange={(e) => set('status', e.target.value as ProductInput['status'])}>
              <option value="active">Ativo</option>
              <option value="paused">Pausado</option>
              <option value="archived">Arquivado</option>
            </NativeSelect>
          </Field>
        </>
      )}

      {errors._ && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{errors._}</p>}
      {footer ? (
        footer(submitting)
      ) : (
        <Button type="submit" loading={submitting} disabled={uploading}>
          {submitLabel}
        </Button>
      )}
    </form>
  );
}
