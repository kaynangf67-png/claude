import { useState, type FormEvent } from 'react';
import { NotebookPen, Pencil, Trash2 } from 'lucide-react';
import { AccessLocked } from '../../components/AccessLocked';
import { ConfirmDialog, EmptyState, Notice, Spinner, SubmitButton, useFlash } from '../../components/ui';
import { useBackend, useSession } from '../../app/session';
import { useAsync } from '../../app/useAsync';
import { formatFullDate, todayKey } from '../../lib/dates';
import { NOTES_MAX, OBSERVATIONS, PRODUCTS_MAX, SKIN_FEELS, observationLabel, skinFeelLabel } from '../../lib/journal';
import type { JournalEntry, JournalInput } from '../../services/types';

const blank = (date: string): JournalInput => ({ entryDate: date, notes: '', skinFeel: null, observations: [], productsUsed: '' });

export function Journal() {
  const { data } = useBackend();
  const { access } = useSession();
  const active = access?.status === 'active';
  const today = todayKey();
  const list = useAsync(() => data.listJournal(), [data]);
  const entries = list.data ?? [];
  const [form, setForm] = useState<JournalInput>(blank(today));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<JournalEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const flash = useFlash();

  const set = <K extends keyof JournalInput>(k: K, v: JournalInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggleObs = (v: string) => set('observations', form.observations.includes(v) ? form.observations.filter((x) => x !== v) : [...form.observations, v]);

  const startEdit = (e: JournalEntry) => {
    setEditingId(e.id);
    setForm({ entryDate: e.entryDate, notes: e.notes, skinFeel: e.skinFeel, observations: e.observations, productsUsed: e.productsUsed });
    setDateError(null);
    document.getElementById('form-diario')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('data-diario')?.focus();
  };
  const cancelEdit = () => {
    setEditingId(null);
    setForm(blank(today));
    setDateError(null);
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!form.entryDate || form.entryDate > today) return setDateError('Escolha uma data até hoje.');
    const clash = entries.find((x) => x.entryDate === form.entryDate && x.id !== editingId);
    if (clash) return setDateError('Já existe um registro para esta data. Edite o registro existente no histórico.');
    setDateError(null);
    setSaving(true);
    try {
      const saved = await data.saveJournal(form, editingId ?? undefined);
      list.setData([saved, ...entries.filter((x) => x.id !== saved.id)].sort((a, b) => (a.entryDate < b.entryDate ? 1 : -1)));
      flash.show(editingId ? 'Registro atualizado.' : 'Registro salvo.');
      setEditingId(null);
      setForm(blank(today));
    } catch (e) {
      flash.show(e instanceof Error ? e.message : 'Não foi possível salvar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await data.deleteJournal(toDelete.id);
      list.setData(entries.filter((x) => x.id !== toDelete.id));
      if (editingId === toDelete.id) cancelEdit();
      flash.show('Registro apagado.');
    } catch (e) {
      flash.show(e instanceof Error ? e.message : 'Não foi possível apagar.', 'error');
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  };

  return (
    <div className="stack-lg">
      <header className="page-title">
        <p className="eyebrow">Diário da pele</p>
        <h1>Suas observações</h1>
        <p>Privado: só você vê. Tudo é opcional.</p>
      </header>

      <Notice>
        O diário guarda <strong>observações pessoais</strong>. Ele não faz diagnóstico e não prova que um produto ou hábito causou uma mudança na pele. Leve suas anotações a uma consulta, se quiser.
      </Notice>

      {!access ? <Spinner /> : !active ? (
        <AccessLocked compact />
      ) : (
        <form id="form-diario" className="card stack" onSubmit={submit} noValidate aria-labelledby="form-titulo">
          <div className="row between wrap">
            <h2 id="form-titulo" className="h3">{editingId ? 'Editar registro' : 'Novo registro'}</h2>
            {editingId && <button type="button" className="btn btn-ghost" onClick={cancelEdit}>Cancelar edição</button>}
          </div>
          <div className="field">
            <label htmlFor="data-diario">Data</label>
            <input id="data-diario" type="date" className={`input ${dateError ? 'invalid' : ''}`} max={today} value={form.entryDate} onChange={(e) => set('entryDate', e.target.value)} aria-invalid={dateError ? true : undefined} aria-describedby={dateError ? 'data-erro' : undefined} required />
            {dateError && <span id="data-erro" className="field-error">{dateError}</span>}
          </div>
          <fieldset>
            <legend className="small">Como a pele parece? (opcional)</legend>
            <div className="option-grid">
              {SKIN_FEELS.map((o) => (
                <label key={o.value} className="option">
                  <input type="radio" name="skin-feel" checked={form.skinFeel === o.value} onChange={() => set('skinFeel', o.value)} onClick={() => form.skinFeel === o.value && set('skinFeel', null)} />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="small">Observações (opcional)</legend>
            <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
              {OBSERVATIONS.map((o) => (
                <button key={o.value} type="button" className="chip" aria-pressed={form.observations.includes(o.value)} onClick={() => toggleObs(o.value)}>{o.label}</button>
              ))}
            </div>
          </fieldset>
          <div className="field">
            <label htmlFor="produtos">Produtos usados (opcional)</label>
            <input id="produtos" className="input" maxLength={PRODUCTS_MAX} placeholder="Ex.: gel de limpeza, hidratante, protetor" value={form.productsUsed} onChange={(e) => set('productsUsed', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="notas">Anotações (opcional)</label>
            <textarea id="notas" className="input" maxLength={NOTES_MAX} placeholder="Ex.: testa mais oleosa à tarde, dormi pouco." value={form.notes} onChange={(e) => set('notes', e.target.value)} aria-describedby="notas-contador" />
            <span id="notas-contador" className="xs muted">{form.notes.length}/{NOTES_MAX}</span>
          </div>
          {form.skinFeel === 'irritada' && (
            <Notice tone="alert">Se a irritação veio depois de um produto novo, suspenda o uso. Ardor intenso, inchaço ou bolhas merecem avaliação médica.</Notice>
          )}
          <SubmitButton busy={saving} busyLabel="Salvando…" className="btn btn-primary btn-lg">{editingId ? 'Salvar alterações' : 'Salvar registro'}</SubmitButton>
          {flash.node}
        </form>
      )}

      <section aria-labelledby="historico" className="stack">
        <h2 id="historico" className="h3">Histórico</h2>
        {list.loading && !list.data ? (
          <Spinner />
        ) : list.error ? (
          <p className="field-error" role="alert">{list.error}</p>
        ) : entries.length === 0 ? (
          <EmptyState icon={<NotebookPen />} title="Nenhum registro ainda">
            Quando você salvar uma anotação, ela aparece aqui, da mais recente para a mais antiga.
          </EmptyState>
        ) : (
          <ol className="history">
            {entries.map((e) => (
              <li key={e.id} className="history-item card-flat">
                <div className="row between wrap">
                  <h3 className="history-date">{formatFullDate(e.entryDate)}</h3>
                  <div className="row">
                    {active && (
                      <button className="btn btn-ghost" onClick={() => startEdit(e)} aria-label={`Editar registro de ${formatFullDate(e.entryDate)}`}>
                        <Pencil size={16} aria-hidden="true" /> Editar
                      </button>
                    )}
                    <button className="btn btn-ghost" onClick={() => setToDelete(e)} aria-label={`Apagar registro de ${formatFullDate(e.entryDate)}`}>
                      <Trash2 size={16} aria-hidden="true" /> Apagar
                    </button>
                  </div>
                </div>
                {(e.skinFeel || e.observations.length > 0) && (
                  <p className="small" style={{ marginBottom: 0 }}>
                    {[skinFeelLabel(e.skinFeel), ...e.observations.map(observationLabel)].filter(Boolean).join(' · ')}
                  </p>
                )}
                {e.productsUsed && <p className="small muted" style={{ marginBottom: 0 }}>Produtos: {e.productsUsed}</p>}
                {e.notes && <p className="small" style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>{e.notes}</p>}
                {!e.notes && !e.productsUsed && !e.skinFeel && e.observations.length === 0 && <p className="small muted" style={{ marginBottom: 0 }}>Sem detalhes.</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <ConfirmDialog
        open={!!toDelete}
        title="Apagar este registro?"
        confirmLabel="Apagar"
        busy={deleting}
        onCancel={() => setToDelete(null)}
        onConfirm={() => void confirmDelete()}
      >
        <p>O registro de {toDelete ? formatFullDate(toDelete.entryDate) : ''} será apagado. Não dá para desfazer.</p>
      </ConfirmDialog>
    </div>
  );
}
