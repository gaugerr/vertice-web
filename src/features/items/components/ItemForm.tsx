import { useState, type FormEvent } from 'react';
import type { ShoppingItem, Unit } from '../../../domain/models/shopping';
import { repository } from '../../../app/services';
import { decimalInput } from '../../../domain/services/money';
import { useMutation } from '../../../shared/hooks/useMutation';
import { useUnsavedChanges } from '../../../shared/lib/drafts';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { ErrorMessage } from '../../../shared/ui/Feedback';

export function ItemForm({ item, onClose }: { item: ShoppingItem; onClose: () => void }) {
  const [name, setName] = useState(item.name);
  const [unitPrice, setPrice] = useState(decimalInput(item.unitPrice));
  const [quantity, setQuantity] = useState(decimalInput(item.quantity));
  const [unit, setUnit] = useState<Unit>(item.unit);
  const mutation = useMutation();
  const dirty =
    name !== item.name ||
    unitPrice !== decimalInput(item.unitPrice) ||
    quantity !== decimalInput(item.quantity) ||
    unit !== item.unit;
  useUnsavedChanges(dirty);
  function close() {
    if (!mutation.pending && (!dirty || window.confirm('Descartar as alterações não salvas?')))
      onClose();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    // Editing fields never overwrites purchase state changed in another tab.
    const result = await mutation.run(() =>
      repository.updateItem(item.id, { name, unitPrice, quantity, unit }),
    );
    if (result.ok) onClose();
  }
  return (
    <Dialog title="Editar item" onClose={close} busy={mutation.pending}>
      <form onSubmit={submit} className="form-stack">
        <label>
          Nome do item
          <input
            autoFocus
            required
            maxLength={50}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="form-row">
          <label>
            Quantidade
            <input
              required
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          <label>
            Unidade
            <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
              <option value="un">un</option>
              <option value="kg">kg</option>
              <option value="L">L</option>
            </select>
          </label>
        </div>
        <label>
          Preço por {unit} (R$)
          <input
            required
            inputMode="decimal"
            value={unitPrice}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
        <ErrorMessage message={mutation.error} />
        <div className="dialog-actions">
          <Button variant="secondary" disabled={mutation.pending} onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.pending}>
            {mutation.pending ? 'Salvando…' : 'Salvar item'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
