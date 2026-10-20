import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, Pencil, ShoppingBag, Trash2 } from 'lucide-react';
import type { ShoppingList } from '../../../domain/models/shopping';
import { formatDate } from '../../../shared/lib/date';
import { repository } from '../../../app/services';
import { useMutation } from '../../../shared/hooks/useMutation';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { ErrorMessage } from '../../../shared/ui/Feedback';
import { ListForm } from './ListForm';

export function ListCard({ list }: { list: ShoppingList }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const mutation = useMutation();
  async function remove() {
    const result = await mutation.run(() => repository.deleteListCascade(list.id));
    if (result.ok) setDeleting(false);
  }
  return (
    <article className="list-card">
      <Link
        to={`/lists/${list.id}`}
        className="list-card-link"
        aria-label={`Abrir lista ${list.storeName}`}
      >
        <div className="card-top">
          <span className="tile-icon">
            <ShoppingBag size={22} aria-hidden="true" />
          </span>
          <ArrowUpRight size={20} className="muted" aria-hidden="true" />
        </div>
        <h2>{list.storeName}</h2>
        <p className="description">
          {list.description || 'Tudo o que você precisa, em um só lugar.'}
        </p>
        <span className="card-date">
          <CalendarDays size={14} aria-hidden="true" />
          {formatDate(list.date)}
        </span>
      </Link>
      <div className="card-actions">
        <Button
          variant="icon"
          aria-label={`Editar lista ${list.storeName}`}
          onClick={() => setEditing(true)}
        >
          <Pencil size={16} />
        </Button>
        <Button
          variant="icon"
          aria-label={`Excluir lista ${list.storeName}`}
          onClick={() => setDeleting(true)}
        >
          <Trash2 size={16} />
        </Button>
      </div>
      {editing && <ListForm list={list} onClose={() => setEditing(false)} />}
      {deleting && (
        <Dialog title="Excluir lista?" onClose={() => setDeleting(false)} busy={mutation.pending}>
          <p>“{list.storeName}” e todos os seus itens serão excluídos deste aparelho.</p>
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
              Excluir lista
            </Button>
          </div>
        </Dialog>
      )}
    </article>
  );
}
