import { memo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Pencil, Trash2 } from 'lucide-react';
import type { ShoppingItem } from '../../../domain/models/shopping';
import { useRepository } from '../../../app/repository-context';
import { decimalInput, formatMoney, lineCents } from '../../../domain/services/money';
import { useMutation } from '../../../shared/hooks/useMutation';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { ErrorMessage } from '../../../shared/ui/Feedback';
import { ItemForm } from './ItemForm';
import { PurchaseForm } from './PurchaseForm';
import { formatItemName } from '../../../domain/services/product-details';

export const ItemRow = memo(function ItemRow({
  item,
  onPurchaseEditingChange,
  readOnly = false,
}: {
  item: ShoppingItem;
  onPurchaseEditingChange: (id: string, editing: boolean) => void;
  readOnly?: boolean;
}) {
  const repository = useRepository();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const priceInput = useRef<HTMLInputElement>(null);
  const checkbox = useRef<HTMLInputElement>(null);
  const mutation = useMutation();
  const displayName = formatItemName(item);
  function closePurchase() {
    flushSync(() => {
      setPurchasing(false);
      onPurchaseEditingChange(item.id, false);
    });
    checkbox.current?.focus({ preventScroll: true });
  }
  async function remove() {
    const result = await mutation.run(() => repository.deleteItem(item.id));
    if (result.ok) setDeleting(false);
  }
  return (
    <li className={`item-row ${item.isPurchased ? 'purchased' : ''}`}>
      <div className="item-line">
        <input
          className="purchase-checkbox"
          ref={checkbox}
          type="checkbox"
          checked={item.isPurchased}
          disabled={mutation.pending || purchasing || readOnly}
          aria-label={`Marcar ${displayName} como comprado`}
          aria-controls={purchasing ? `purchase-${item.id}` : undefined}
          onChange={(event) => {
            const purchased = event.target.checked;
            if (purchased) {
              // Mount and focus inside the trusted tap so mobile browsers can open the keyboard.
              flushSync(() => {
                setPurchasing(true);
                onPurchaseEditingChange(item.id, true);
              });
              priceInput.current?.focus();
              priceInput.current?.select();
            }
            void mutation.run(() => repository.setPurchased(item.id, purchased));
          }}
        />
        <div className="item-copy">
          <h3>{displayName}</h3>
          <p>
            {decimalInput(item.quantity)} {item.unit} × {formatMoney(Number(item.unitPrice) * 100)}
          </p>
          {readOnly ? (
            <span className="item-purchase-status">
              {item.isPurchased ? 'Comprado' : 'Não comprado'}
            </span>
          ) : null}
        </div>
        <strong className="item-total">{formatMoney(lineCents(item))}</strong>
        {!readOnly ? (
          <Button
            variant="icon"
            aria-label={`Editar ${displayName}`}
            disabled={mutation.pending || purchasing}
            onClick={() => setEditing(true)}
          >
            <Pencil size={16} />
          </Button>
        ) : null}
        {!readOnly ? (
          <Button
            variant="icon"
            aria-label={`Excluir ${displayName}`}
            disabled={mutation.pending || purchasing}
            onClick={() => setDeleting(true)}
          >
            <Trash2 size={16} />
          </Button>
        ) : null}
      </div>
      <ErrorMessage message={mutation.error} />
      {purchasing && (
        <PurchaseForm
          item={item}
          priceInput={priceInput}
          marking={mutation.pending}
          readOnly={readOnly}
          onClose={closePurchase}
        />
      )}
      {editing && <ItemForm item={item} readOnly={readOnly} onClose={() => setEditing(false)} />}
      {deleting && (
        <Dialog title="Excluir item?" onClose={() => setDeleting(false)} busy={mutation.pending}>
          <p className="item-delete-label">Excluir “{displayName}” desta lista?</p>
          <ErrorMessage message={mutation.error} />
          <div className="dialog-actions">
            <Button
              variant="secondary"
              disabled={mutation.pending}
              onClick={() => setDeleting(false)}
            >
              Cancelar
            </Button>
            <Button variant="danger" disabled={mutation.pending || readOnly} onClick={remove}>
              Excluir item
            </Button>
          </div>
        </Dialog>
      )}
    </li>
  );
});
