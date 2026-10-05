import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatBRLShort } from '../lib/format';
import { actions, useAppState } from '../lib/store';
import { Modal } from './ui';

const OTHER = '__outro__';

export function NewLeadDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { business } = useAppState();
  const navigate = useNavigate();
  const products = business?.products ?? [];
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [productId, setProductId] = useState(products[0]?.id ?? OTHER);
  const [customProduct, setCustomProduct] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [firstMessage, setFirstMessage] = useState('');

  const product = products.find((p) => p.id === productId);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const productName = product ? product.name : customProduct.trim();
    const value = product ? product.price : Number(customValue.replace(/\./g, '').replace(',', '.')) || 0;
    if (!name.trim() || !productName) return;
    const id = actions.addLead({
      name: name.trim(),
      phone: phone.trim(),
      productName,
      value,
      firstMessage: firstMessage.trim() || undefined,
    });
    onClose();
    setName('');
    setPhone('');
    setFirstMessage('');
    navigate(`/app/leads/${id}`);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <div>
          <p className="text-base font-bold">Novo lead</p>
          <p className="text-sm text-slate-500">Cadastre um cliente e simule a conversa do WhatsApp.</p>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-4 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="nl-name">Nome do cliente</label>
            <input id="nl-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Maria Oliveira" required />
          </div>
          <div>
            <label className="label" htmlFor="nl-phone">WhatsApp</label>
            <input id="nl-phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" inputMode="tel" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="nl-product">Produto ou serviço de interesse</label>
          <select id="nl-product" className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatBRLShort(p.price)}
              </option>
            ))}
            <option value={OTHER}>Outro (não cadastrado)</option>
          </select>
        </div>
        {productId === OTHER && (
          <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
            <div>
              <label className="label" htmlFor="nl-custom">Qual?</label>
              <input id="nl-custom" className="input" value={customProduct} onChange={(e) => setCustomProduct(e.target.value)} required />
            </div>
            <div>
              <label className="label" htmlFor="nl-value">Valor (R$)</label>
              <input id="nl-value" className="input" value={customValue} onChange={(e) => setCustomValue(e.target.value)} inputMode="decimal" placeholder="0,00" />
            </div>
          </div>
        )}
        <div>
          <label className="label" htmlFor="nl-msg">Primeira mensagem do cliente (opcional)</label>
          <textarea id="nl-msg" rows={2} className="input" value={firstMessage} onChange={(e) => setFirstMessage(e.target.value)} placeholder="Ex.: Oi, quanto custa?" />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
          <button className="btn-primary">Criar e abrir conversa</button>
        </div>
      </form>
    </Modal>
  );
}
