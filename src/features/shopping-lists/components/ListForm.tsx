import { useState, type FormEvent } from 'react';
import { flushSync } from 'react-dom';
import { useRepository } from '../../../app/repository-context';
import type { ShoppingList } from '../../../domain/models/shopping';
import { today } from '../../../shared/lib/date';
import { useUnsavedChanges } from '../../../shared/lib/drafts';
import { useMutation } from '../../../shared/hooks/useMutation';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { ErrorMessage } from '../../../shared/ui/Feedback';
import { BudgetField } from '../../budget/components/BudgetField';
import { budgetInput, parseBudgetInput } from '../../../domain/services/budget';

export function ListForm({
  list,
  copySource,
  onClose,
  onCreated,
}: {
  list?: ShoppingList;
  copySource?: ShoppingList;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const repository = useRepository();
  const [initial] = useState(() => ({
    storeName: copySource
      ? `${copySource.storeName.slice(0, 42)} — cópia`
      : (list?.storeName ?? ''),
    date: copySource ? today() : (list?.date ?? today()),
    description: (copySource ?? list)?.description ?? '',
    budget: budgetInput((copySource ?? list)?.budgetCents ?? null),
  }));
  const [storeName, setStoreName] = useState(initial.storeName);
  const [date, setDate] = useState(initial.date);
  const [description, setDescription] = useState(initial.description);
  const [budget, setBudget] = useState(initial.budget);
  const mutation = useMutation();
  const readOnly = list?.status === 'completed';
  const dirty =
    storeName !== initial.storeName ||
    description !== initial.description ||
    budget !== initial.budget ||
    date !== initial.date;
  useUnsavedChanges(dirty);
  function close() {
    if (!mutation.pending && (!dirty || window.confirm('Descartar as alterações não salvas?')))
      flushSync(onClose);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (readOnly) return;
    const result = await mutation.run(async () => {
      const input = { storeName, date, description, budgetCents: parseBudgetInput(budget) };
      if (list) {
        await repository.updateList(list.id, input);
        return;
      }
      return copySource
        ? repository.duplicateList(copySource.id, input)
        : repository.createListWithCategories(input);
    });
    if (result.ok) {
      flushSync(onClose);
      if (result.value) onCreated?.(result.value);
    }
  }
  return (
    <Dialog
      title={copySource ? 'Copiar lista' : list ? 'Editar lista' : 'Nova lista de compras'}
      onClose={close}
      busy={mutation.pending}
    >
      <form onSubmit={submit} className="form-stack">
        {readOnly ? (
          <p role="status">Esta compra foi finalizada. Reabra a compra para fazer alterações.</p>
        ) : null}
        <label>
          Nome da lista
          <input
            autoFocus
            required
            maxLength={50}
            readOnly={mutation.pending || readOnly}
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="Ex.: Compras da semana"
          />
        </label>
        <label>
          Data
          <input
            type="date"
            required
            value={date}
            readOnly={mutation.pending || readOnly}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          Descrição <span className="muted">(opcional)</span>
          <textarea
            rows={3}
            maxLength={10000}
            readOnly={mutation.pending || readOnly}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Um lembrete para suas compras"
          />
        </label>
        <BudgetField value={budget} onChange={setBudget} readOnly={mutation.pending || readOnly} />
        <p className="field-help">
          {copySource
            ? 'Todos os produtos e categorias serão copiados. As quantidades e unidades serão mantidas; os produtos estarão desmarcados e com os preços zerados.'
            : 'As seis categorias de compras serão organizadas automaticamente.'}
        </p>
        <ErrorMessage message={mutation.error} />
        <div className="dialog-actions">
          <Button variant="secondary" disabled={mutation.pending} onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.pending || readOnly}>
            {mutation.pending
              ? 'Salvando…'
              : copySource
                ? 'Criar cópia'
                : list
                  ? 'Salvar alterações'
                  : 'Criar lista'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
