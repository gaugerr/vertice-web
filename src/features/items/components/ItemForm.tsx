import { LastPriceReference } from './LastPriceReference';
import { useState, type FormEvent } from 'react';
import type { ShoppingItem, Unit } from '../../../domain/models/shopping';
import { useRepository } from '../../../app/repository-context';
import { decimalInput } from '../../../domain/services/money';
import { useMutation } from '../../../shared/hooks/useMutation';
import { useUnsavedChanges } from '../../../shared/lib/drafts';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { ErrorMessage } from '../../../shared/ui/Feedback';
import { useProductDetailsDraft } from '../hooks/useProductDetailsDraft';
import { ProductDetailsFields } from './ProductDetailsFields';

export function ItemForm({
  item,
  onClose,
  readOnly = false,
}: {
  item: ShoppingItem;
  onClose: () => void;
  readOnly?: boolean;
}) {
  const repository = useRepository();
  const [name, setName] = useState(item.name);
  const [unitPrice, setPrice] = useState(decimalInput(item.unitPrice));
  const [quantity, setQuantity] = useState(decimalInput(item.quantity));
  const [unit, setUnit] = useState<Unit>(item.unit);
  const mutation = useMutation();
  const details = useProductDetailsDraft(item);
  const dirty =
    name !== item.name ||
    unitPrice !== decimalInput(item.unitPrice) ||
    quantity !== decimalInput(item.quantity) ||
    unit !== item.unit ||
    details.dirty;
  useUnsavedChanges(dirty);
  function close() {
    if (!mutation.pending && (!dirty || window.confirm('Descartar as alterações não salvas?')))
      onClose();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (readOnly) return;
    // Editing fields never overwrites purchase state changed in another tab.
    const result = await mutation.run(() =>
      repository.updateItem(item.id, { name, unitPrice, quantity, unit, ...details.getPatch() }),
    );
    if (result.ok) onClose();
  }
  return (
    <Dialog title="Editar item" onClose={close} busy={mutation.pending}>
      <form onSubmit={submit} className="form-stack">
        {readOnly ? (
          <p role="status">
            Esta compra foi finalizada. Reabra a compra para salvar as alterações. Seus campos foram
            preservados.
          </p>
        ) : null}
        <label>
          Nome do item
          <input
            autoFocus
            required
            maxLength={50}
            readOnly={mutation.pending || readOnly}
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
              readOnly={mutation.pending || readOnly}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
          <label>
            Unidade
            <select
              aria-label="Unidade"
              disabled={mutation.pending || readOnly}
              value={unit}
              onChange={(e) => setUnit(e.target.value as Unit)}
            >
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
            readOnly={mutation.pending || readOnly}
            value={unitPrice}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
        <LastPriceReference
          listId={item.shoppingListId}
          name={name}
          unit={unit}
          unitPrice={unitPrice}
          details={details}
        />
        <ProductDetailsFields
          details={details}
          name={name}
          readOnly={mutation.pending || readOnly}
        />
        <ErrorMessage message={mutation.error} />
        <div className="dialog-actions">
          <Button variant="secondary" disabled={mutation.pending} onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" disabled={mutation.pending || readOnly}>
            {mutation.pending ? 'Salvando…' : 'Salvar item'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
