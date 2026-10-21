import { LastPriceReference } from './LastPriceReference';
import { useState, type FormEvent, type RefObject } from 'react';
import type { ShoppingItem, Unit } from '../../../domain/models/shopping';
import { useRepository } from '../../../app/repository-context';
import { decimalInput } from '../../../domain/services/money';
import { useMutation } from '../../../shared/hooks/useMutation';
import { useUnsavedChanges } from '../../../shared/lib/drafts';
import { Button } from '../../../shared/ui/Button';
import { ErrorMessage } from '../../../shared/ui/Feedback';
import { formatItemName } from '../../../domain/services/product-details';
import { useProductDetailsDraft } from '../hooks/useProductDetailsDraft';
import { ProductDetailsFields } from './ProductDetailsFields';

export function PurchaseForm({
  item,
  priceInput,
  marking,
  onClose,
  readOnly = false,
}: {
  item: ShoppingItem;
  priceInput: RefObject<HTMLInputElement | null>;
  marking: boolean;
  onClose: () => void;
  readOnly?: boolean;
}) {
  const repository = useRepository();
  const [original] = useState(item);
  const [unitPrice, setPrice] = useState(decimalInput(item.unitPrice));
  const [quantity, setQuantity] = useState(decimalInput(item.quantity));
  const [unit, setUnit] = useState<Unit>(item.unit);
  const mutation = useMutation();
  const details = useProductDetailsDraft(item);
  const busy = marking || mutation.pending;
  const dirty =
    unitPrice !== decimalInput(original.unitPrice) ||
    quantity !== decimalInput(original.quantity) ||
    unit !== original.unit ||
    details.dirty;
  useUnsavedChanges(dirty);

  function close() {
    if (!busy && (!dirty || window.confirm('Descartar os valores não salvos?'))) onClose();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (marking || readOnly) return;
    const result = await mutation.run(() =>
      repository.updatePurchaseDetails(item.id, {
        unitPrice,
        quantity,
        unit,
        ...details.getPatch(),
      }),
    );
    if (result.ok) onClose();
  }

  return (
    <form
      id={`purchase-${item.id}`}
      className="purchase-form form-stack"
      aria-label={`Valores de ${formatItemName(item)}`}
      aria-busy={busy}
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          close();
        }
      }}
    >
      {readOnly ? (
        <p role="status">
          Esta compra foi finalizada em outra aba. Seus valores digitados continuam aqui; reabra a
          compra para salvá-los.
        </p>
      ) : null}
      <div className="purchase-fields">
        <label>
          Preço por {unit} (R$)
          <input
            ref={priceInput}
            required
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            maxLength={100}
            readOnly={mutation.pending || readOnly}
            value={unitPrice}
            onChange={(event) => setPrice(event.target.value)}
          />
        </label>
        <label>
          Quantidade
          <input
            required
            inputMode="decimal"
            enterKeyHint="done"
            maxLength={100}
            readOnly={mutation.pending || readOnly}
            value={quantity}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </label>
        <label>
          Unidade
          <select
            aria-label="Unidade"
            value={unit}
            disabled={mutation.pending || readOnly}
            onChange={(event) => setUnit(event.target.value as Unit)}
          >
            <option value="un">un</option>
            <option value="kg">kg</option>
            <option value="L">L</option>
          </select>
        </label>
      </div>
      <LastPriceReference
        listId={item.shoppingListId}
        name={item.name}
        unit={unit}
        unitPrice={unitPrice}
        details={details}
      />
      <ProductDetailsFields
        details={details}
        name={item.name}
        readOnly={mutation.pending || readOnly}
      />
      <ErrorMessage message={mutation.error} />
      <div className="purchase-actions">
        <Button variant="secondary" disabled={busy} onClick={close}>
          Fechar
        </Button>
        <Button type="submit" disabled={busy || readOnly}>
          {mutation.pending ? 'Salvando…' : 'Salvar valores'}
        </Button>
      </div>
    </form>
  );
}
