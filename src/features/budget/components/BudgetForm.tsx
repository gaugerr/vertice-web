import { useState, type FormEvent } from 'react';
import type { ShoppingList } from '../../../domain/models/shopping';
import { budgetInput, parseBudgetInput } from '../../../domain/services/budget';
import { repository } from '../../../app/services';
import { useMutation } from '../../../shared/hooks/useMutation';
import { useUnsavedChanges } from '../../../shared/lib/drafts';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { ErrorMessage } from '../../../shared/ui/Feedback';
import { BudgetField } from './BudgetField';

export function BudgetForm({ list, onClose }: { list: ShoppingList; onClose: () => void }) {
  const [original] = useState(() => budgetInput(list.budgetCents));
  const [value, setValue] = useState(original);
  const mutation = useMutation();
  const dirty = value !== original;
  useUnsavedChanges(dirty);
  function close() {
    if (!mutation.pending && (!dirty || window.confirm('Descartar o orçamento não salvo?')))
      onClose();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await mutation.run(() =>
      repository.setListBudget(list.id, parseBudgetInput(value)),
    );
    if (result.ok) onClose();
  }
  return (
    <Dialog title="Orçamento da compra" onClose={close} busy={mutation.pending}>
      <form className="form-stack" onSubmit={submit}>
        <BudgetField value={value} onChange={setValue} readOnly={mutation.pending} />
        <ErrorMessage message={mutation.error} />
        <div className="dialog-actions">
          <Button variant="secondary" onClick={close} disabled={mutation.pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.pending}>
            {mutation.pending ? 'Salvando…' : 'Salvar orçamento'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
