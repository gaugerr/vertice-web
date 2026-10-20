import { useState } from 'react';
import type { ShoppingList } from '../../../domain/models/shopping';
import { budgetSummary, type BudgetStatus } from '../../../domain/services/budget';
import { formatMoney } from '../../../domain/services/money';
import { Button } from '../../../shared/ui/Button';
import { BudgetForm } from './BudgetForm';

const messages: Record<BudgetStatus, string> = {
  none: '',
  normal: '',
  near: 'Orçamento perto do limite',
  reached: 'Limite atingido',
  exceeded: 'Orçamento ultrapassado',
};

export function BudgetPanel({
  list,
  spent,
  compact = false,
}: {
  list: ShoppingList;
  spent: number;
  compact?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const summary = budgetSummary(list.budgetCents, spent);
  const remaining = summary.remainingCents;
  return (
    <section
      className={`budget-panel budget-${summary.status} ${compact ? 'budget-compact' : ''}`}
      aria-label="Orçamento da lista"
    >
      <div className="budget-heading">
        <span>
          {list.budgetCents === null
            ? 'Sem orçamento definido'
            : `Limite da lista · ${formatMoney(list.budgetCents)}`}
        </span>
        <Button variant="secondary" onClick={() => setEditing(true)}>
          {list.budgetCents === null ? 'Definir orçamento' : 'Ajustar orçamento'}
        </Button>
      </div>
      {list.budgetCents !== null && remaining !== null && (
        <>
          <div className="budget-amounts">
            <span>
              Gasto na lista <span aria-label="Gasto da lista">{formatMoney(spent)}</span>
            </span>
            <span className="budget-balance" aria-label="Saldo do orçamento">
              {remaining < 0
                ? `Ultrapassou em ${formatMoney(-remaining)}`
                : remaining === 0
                  ? `Saldo ${formatMoney(0)}`
                  : `Restam ${formatMoney(remaining)}`}
            </span>
          </div>
          <progress
            aria-label="Orçamento utilizado"
            aria-valuetext={`${formatMoney(spent)} de ${formatMoney(list.budgetCents)}`}
            max={100}
            value={summary.progressPercent}
          />
        </>
      )}
      <p className="budget-warning" role="status" aria-live="polite" aria-atomic="true">
        {messages[summary.status]}
      </p>
      {editing && <BudgetForm list={list} onClose={() => setEditing(false)} />}
    </section>
  );
}
