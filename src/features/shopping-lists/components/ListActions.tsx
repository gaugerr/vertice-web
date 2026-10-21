import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, RotateCcw } from 'lucide-react';
import type { ShoppingList } from '../../../domain/models/shopping';
import { repository } from '../../../app/services';
import { useMutation } from '../../../shared/hooks/useMutation';
import { hasUnsavedChanges } from '../../../shared/lib/drafts';
import { hasPendingWrites } from '../../../data/database/writes';
import { formatDate } from '../../../shared/lib/date';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { ErrorMessage } from '../../../shared/ui/Feedback';
import { CompletionDialog } from './CompletionDialog';
import { ListForm } from './ListForm';

export function ListActions({ list }: { list: ShoppingList }) {
  const [action, setAction] = useState<'finish' | 'copy' | 'reopen' | null>(null);
  const [notice, setNotice] = useState('');
  const mutation = useMutation();
  const navigate = useNavigate();
  const completed = list.status === 'completed';
  async function reopen() {
    const result = await mutation.run(() => repository.reopenList(list.id));
    if (result.ok) setAction(null);
  }
  function finish() {
    if (hasUnsavedChanges() || hasPendingWrites()) {
      setNotice('Salve ou feche os campos em edição antes de finalizar a compra.');
      return;
    }
    setNotice('');
    setAction('finish');
  }
  return (
    <section className="list-lifecycle" aria-label="Ações da compra">
      {completed ? (
        <div className="completion-banner" role="status">
          <strong><Check size={18} aria-hidden="true" /> Compra finalizada</strong>
          <span>{list.purchaseDate ? formatDate(list.purchaseDate) : ''}{list.marketName ? ` · ${list.marketName}` : ''}</span>
          <p>Somente para consulta. Reabra a compra se precisar corrigir algum dado.</p>
        </div>
      ) : null}
      <div className="list-action-buttons">
        {completed ? (
          <Button variant="secondary" onClick={() => setAction('reopen')}><RotateCcw size={17} aria-hidden="true" /> Reabrir compra</Button>
        ) : <Button onClick={finish}><Check size={17} aria-hidden="true" /> Finalizar compra</Button>}
        <Button variant="secondary" onClick={() => setAction('copy')}><Copy size={17} aria-hidden="true" /> Copiar lista</Button>
      </div>
      {notice ? <p role="status" className="field-help">{notice}</p> : null}
      {action === 'finish' ? <CompletionDialog listId={list.id} onClose={() => setAction(null)} /> : null}
      {action === 'copy' ? <ListForm copySource={list} onClose={() => setAction(null)} onCreated={(id) => { setAction(null); navigate(`/lists/${id}`); }} /> : null}
      {action === 'reopen' ? (
        <Dialog title="Reabrir compra?" onClose={() => setAction(null)} busy={mutation.pending} preserveScroll>
          <p>Os produtos e valores serão mantidos. Você poderá corrigir os dados e finalizar esta mesma compra novamente.</p>
          <ErrorMessage message={mutation.error} />
          <div className="dialog-actions">
            <Button variant="secondary" disabled={mutation.pending} onClick={() => setAction(null)}>Cancelar</Button>
            <Button disabled={mutation.pending} onClick={reopen}>{mutation.pending ? 'Reabrindo…' : 'Confirmar reabertura'}</Button>
          </div>
        </Dialog>
      ) : null}
    </section>
  );
}
