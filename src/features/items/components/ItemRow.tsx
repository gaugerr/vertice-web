import { memo, useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { ShoppingItem } from '../../../domain/models/shopping';
import { repository } from '../../../app/services';
import { decimalInput, formatMoney, lineCents } from '../../../domain/services/money';
import { useMutation } from '../../../shared/hooks/useMutation';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { ErrorMessage } from '../../../shared/ui/Feedback';
import { ItemForm } from './ItemForm';

export const ItemRow = memo(function ItemRow({ item }: { item: ShoppingItem }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const mutation = useMutation();
  async function remove() {
    const result = await mutation.run(() => repository.deleteItem(item.id));
    if (result.ok) setDeleting(false);
  }
  return (
    <li className={`item-row ${item.isPurchased ? 'purchased' : ''}`}>
      <div className="item-line">
        <input
          className="purchase-checkbox"
          type="checkbox"
          checked={item.isPurchased}
          disabled={mutation.pending}
          aria-label={`Marcar ${item.name} como comprado`}
          onChange={(event) => {
            const purchased = event.target.checked;
            void mutation.run(() => repository.setPurchased(item.id, purchased));
          }}
        />
        <div className="item-copy">
          <h3>{item.name}</h3>
          <p>
            {decimalInput(item.quantity)} {item.unit} × {formatMoney(Number(item.unitPrice) * 100)}
          </p>
        </div>
        <strong className="item-total">{formatMoney(lineCents(item))}</strong>
        <Button
          variant="icon"
          aria-label={`Editar ${item.name}`}
          disabled={mutation.pending}
          onClick={() => setEditing(true)}
        >
          <Pencil size={16} />
        </Button>
        <Button
          variant="icon"
          aria-label={`Excluir ${item.name}`}
          disabled={mutation.pending}
          onClick={() => setDeleting(true)}
        >
          <Trash2 size={16} />
        </Button>
      </div>
      <ErrorMessage message={mutation.error} />
      {editing && <ItemForm item={item} onClose={() => setEditing(false)} />}
      {deleting && (
        <Dialog title="Excluir item?" onClose={() => setDeleting(false)} busy={mutation.pending}>
          <p>Excluir “{item.name}” desta lista?</p>
          <ErrorMessage message={mutation.error} />
          <div className="dialog-actions">
            <Button
              variant="secondary"
              disabled={mutation.pending}
              onClick={() => setDeleting(false)}
            >
              Cancelar
            </Button>
            <Button variant="danger" disabled={mutation.pending} onClick={remove}>
              Excluir item
            </Button>
          </div>
        </Dialog>
      )}
    </li>
  );
});
