import type { Unit } from '../../../domain/models/shopping';
import { priceCents, priceDifference, productIdentity } from '../../../domain/services/price-history';
import { formatMoney } from '../../../domain/services/money';
import { formatDate } from '../../../shared/lib/date';
import { usePriceReferences } from '../hooks/usePriceReferences';
import type { ProductDetailsFormDraft } from '../hooks/useProductDetailsDraft';

export function LastPriceReference({ listId, name, unit, unitPrice, details }: {
  listId: string;
  name: string;
  unit: Unit;
  unitPrice: string;
  details: ProductDetailsFormDraft;
}) {
  const { references, failed } = usePriceReferences(listId);
  const key = details.parsed.ok ? productIdentity({ name, unit, ...details.parsed.details }) : null;
  if (!key) return null;
  if (failed) return <p className="price-reference-unavailable">Referência indisponível</p>;
  const reference = references.get(key);
  if (!reference) return null;
  const difference = priceDifference(unitPrice, reference.unitPrice);
  const unitLabel = unit === 'un' ? 'unidade' : unit;
  return (
    <aside className="price-reference" aria-label="Preço da última compra">
      <p>Última compra: <strong>{formatMoney(priceCents(reference.unitPrice))}/{unit}</strong></p>
      <p className="price-reference-source">{reference.marketName ? `${reference.marketName} · ` : ''}{formatDate(reference.purchaseDate)}</p>
      {difference !== null ? (
        <p className={difference > 0n ? 'price-reference-higher' : difference < 0n ? 'price-reference-lower' : undefined}>
          {difference === 0n ? 'Mesmo preço da última compra' : `${formatMoney(difference < 0n ? -difference : difference)} a ${difference > 0n ? 'mais' : 'menos'} por ${unitLabel}`}
        </p>
      ) : null}
    </aside>
  );
}
