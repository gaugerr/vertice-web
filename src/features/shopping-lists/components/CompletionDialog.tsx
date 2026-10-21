import { useState, type FormEvent } from 'react';
import type { ListReview } from '../../../domain/models/shopping';
import { unpricedPurchasedItems } from '../../../domain/services/completion';
import { formatMoney } from '../../../domain/services/money';
import { repository } from '../../../app/services';
import { useQuery } from '../../../shared/hooks/useQuery';
import { useMutation } from '../../../shared/hooks/useMutation';
import { useUnsavedChanges } from '../../../shared/lib/drafts';
import { today } from '../../../shared/lib/date';
import { Dialog } from '../../../shared/ui/Dialog';
import { Button } from '../../../shared/ui/Button';
import { ErrorMessage, Loading, QueryError } from '../../../shared/ui/Feedback';
import { BudgetPanel } from '../../budget/components/BudgetPanel';

export function CompletionDialog({ listId, onClose }: { listId: string; onClose: () => void }) {
  const result = useQuery(() => repository.getListReview(listId), [listId]);
  if (result.status !== 'ready') return (
    <Dialog title="Finalizar compra" onClose={onClose} preserveScroll>
      {result.status === 'loading' ? <Loading /> : <QueryError error={result.error} />}
    </Dialog>
  );
  return <CompletionForm review={result.data} onClose={onClose} />;
}

function CompletionForm({ review, onClose }: { review: ListReview; onClose: () => void }) {
  const [initial] = useState(() => ({
    marketName: review.list.marketName ?? '', purchaseDate: review.list.purchaseDate ?? today(),
  }));
  const [marketName, setMarketName] = useState(initial.marketName);
  const [purchaseDate, setPurchaseDate] = useState(initial.purchaseDate);
  const [reviewedRevision, setReviewedRevision] = useState(review.revision);
  const mutation = useMutation();
  const dirty = marketName !== initial.marketName || purchaseDate !== initial.purchaseDate;
  useUnsavedChanges(dirty);
  const changed = reviewedRevision !== review.revision;
  const closed = review.list.status === 'completed';
  const unpriced = unpricedPurchasedItems(review.items);
  const blocked = closed || !review.purchasedCount || unpriced.length > 0;
  function close() {
    if (!mutation.pending && (!dirty || window.confirm('Descartar os dados de finalização não salvos?'))) onClose();
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (blocked) return;
    if (changed) { setReviewedRevision(review.revision); return; }
    const result = await mutation.run(() => repository.completeList(review.list.id, {
      marketName: marketName.trim() || null, purchaseDate,
    }, reviewedRevision));
    if (result.ok) onClose();
  }
  return (
    <Dialog title="Finalizar compra" onClose={close} busy={mutation.pending} preserveScroll>
      <form className="form-stack completion-form" onSubmit={submit}>
        <p>Confira os valores salvos de <strong>{review.list.storeName}</strong>.</p>
        <div className="completion-summary">
          <span>Total da compra</span>
          <strong aria-label="Total para finalizar">{formatMoney(review.totalCents)}</strong>
          <span>{review.purchasedCount} comprados · {review.pendingCount} não comprados</span>
        </div>
        <BudgetPanel list={review.list} spent={review.totalCents} readOnly />
        {closed ? <p role="status">Esta compra já foi finalizada em outra aba.</p> : null}
        {changed && !closed ? <p className="review-notice" role="status">A lista mudou em outra aba. Confira o resumo atualizado antes de confirmar novamente.</p> : null}
        {!review.purchasedCount ? <p className="review-notice">Marque pelo menos um produto como comprado antes de finalizar.</p> : null}
        {unpriced.length ? (
          <div className="review-notice" role="alert">
            <p>Informe um preço maior que zero nestes produtos comprados:</p>
            <ul>{unpriced.map((item) => <li key={item.id}>{item.name} · {review.categories.find((c) => c.id === item.categoryId)?.title}</li>)}</ul>
          </div>
        ) : null}
        {review.pendingCount ? <p className="field-help">Os produtos não comprados continuarão nesta lista e não entram no total.</p> : null}
        <label>Mercado <span className="muted">(opcional)</span>
          <input maxLength={50} value={marketName} readOnly={mutation.pending || closed}
            onChange={(event) => setMarketName(event.target.value)} placeholder="Ex.: Mercado do bairro" />
        </label>
        <label>Data da compra
          <input required type="date" value={purchaseDate} readOnly={mutation.pending || closed}
            onChange={(event) => setPurchaseDate(event.target.value)} />
        </label>
        <ErrorMessage message={mutation.error} />
        <div className="dialog-actions">
          <Button variant="secondary" disabled={mutation.pending} onClick={close}>Continuar comprando</Button>
          <Button type="submit" disabled={mutation.pending || blocked}>
            {mutation.pending ? 'Finalizando…' : changed ? 'Conferir resumo atualizado' : 'Confirmar finalização'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
