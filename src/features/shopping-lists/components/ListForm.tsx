import { useState, type FormEvent } from 'react';
import { repository } from '../../../app/services';
import type { ShoppingList } from '../../../domain/models/shopping';
import { today } from '../../../shared/lib/date';
import { useUnsavedChanges } from '../../../shared/lib/drafts';
import { useMutation } from '../../../shared/hooks/useMutation';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { ErrorMessage } from '../../../shared/ui/Feedback';

export function ListForm({ list, onClose }: { list?: ShoppingList; onClose: () => void }) {
  const [storeName, setStoreName] = useState(list?.storeName ?? '');
  const [date, setDate] = useState(list?.date ?? today());
  const [description, setDescription] = useState(list?.description ?? '');
  const mutation = useMutation();
  const dirty =
    storeName !== (list?.storeName ?? '') ||
    description !== (list?.description ?? '') ||
    date !== (list?.date ?? today());
  useUnsavedChanges(dirty);
  function close() {
    if (!mutation.pending && (!dirty || window.confirm('Descartar as alterações não salvas?')))
      onClose();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const input = { storeName, date, description };
    const result = await mutation.run(async () => {
      if (list) await repository.updateList(list.id, input);
      else await repository.createListWithCategories(input);
    });
    if (result.ok) onClose();
  }
  return (
    <Dialog
      title={list ? 'Editar lista' : 'Nova lista de compras'}
      onClose={close}
      busy={mutation.pending}
    >
      <form onSubmit={submit} className="form-stack">
        <label>
          Nome da lista
          <input
            autoFocus
            required
            maxLength={50}
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="Ex.: Compras da semana"
          />
        </label>
        <label>
          Data
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          Descrição <span className="muted">(opcional)</span>
          <textarea
            rows={3}
            maxLength={10000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Um lembrete para suas compras"
          />
        </label>
        <p className="field-help">
          As seis categorias de compras serão organizadas automaticamente.
        </p>
        <ErrorMessage message={mutation.error} />
        <div className="dialog-actions">
          <Button variant="secondary" disabled={mutation.pending} onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.pending}>
            {mutation.pending ? 'Salvando…' : list ? 'Salvar alterações' : 'Criar lista'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
