import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { useServices } from '@/contexts/services';
import { qk, usePlan, useAction } from '@/hooks/queries';
import type { ProductInput } from '@/lib/validation';
import type { Product } from '@/types/domain';
import { ProductForm } from './product-form';

export function ProductDialog({ open, onOpenChange, product }: { open: boolean; onOpenChange: (o: boolean) => void; product?: Product | null }) {
  const services = useServices();
  const plan = usePlan();
  const save = useAction(
    (input: ProductInput) => (product ? services.products.update(product.id, input) : services.products.create(input, plan)),
    { invalidate: [qk.products], success: product ? 'Produto atualizado' : 'Produto cadastrado', onSuccess: () => onOpenChange(false) },
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent title={product ? 'Editar produto' : 'Novo produto'} description="Esses dados alimentam lives, analytics e a IA." side="sheet">
          <ProductForm
            key={product?.id ?? 'new'}
            initial={product}
            submitLabel="Salvar"
            onSubmit={(input) => save.mutateAsync(input)}
            footer={(submitting) => (
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button type="submit" loading={submitting}>
                  {product ? 'Salvar alterações' : 'Cadastrar produto'}
                </Button>
              </DialogFooter>
            )}
          />
        </DialogContent>
      )}
    </Dialog>
  );
}
