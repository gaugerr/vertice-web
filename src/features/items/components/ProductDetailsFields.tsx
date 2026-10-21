import { useId } from 'react';
import { formatItemName, PACKAGE_UNITS } from '../../../domain/services/product-details';
import type { PackageUnit } from '../../../domain/models/shopping';
import type { ProductDetailsFormDraft } from '../hooks/useProductDetailsDraft';

export function ProductDetailsFields({
  details,
  name,
  readOnly,
}: {
  details: ProductDetailsFormDraft;
  name: string;
  readOnly: boolean;
}) {
  const id = useId();
  const { draft, setDraft, errors, parsed } = details;
  const preview =
    parsed.ok && name.trim() ? formatItemName({ name: name.trim(), ...parsed.details }) : '';
  return (
    <div className="product-details form-stack">
      <div className="product-content-fields">
        <label>
          Conteúdo por embalagem <span className="muted">(opcional)</span>
          <input
            value={draft.amount}
            inputMode={draft.unit === 'un' ? 'numeric' : 'decimal'}
            enterKeyHint="done"
            autoComplete="off"
            maxLength={100}
            readOnly={readOnly}
            placeholder="Ex.: 500"
            aria-invalid={!!errors.amount}
            aria-describedby={`${id}-help${errors.amount ? ` ${id}-amount-error` : ''}`}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) =>
              setDraft((previous) => ({ ...previous, amount: event.target.value }))
            }
          />
        </label>
        <label>
          Unidade do conteúdo
          <select
            aria-label="Unidade do conteúdo"
            value={draft.unit}
            disabled={readOnly}
            onChange={(event) =>
              setDraft((previous) => ({ ...previous, unit: event.target.value as PackageUnit }))
            }
          >
            {PACKAGE_UNITS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </label>
      </div>
      {errors.amount ? (
        <p id={`${id}-amount-error`} className="product-detail-error">
          {errors.amount}
        </p>
      ) : null}
      <p id={`${id}-help`} className="field-help">
        Informe o conteúdo de cada embalagem. A quantidade comprada fica no campo acima.
      </p>
      <label>
        Marca <span className="muted">(opcional)</span>
        <input
          value={draft.brand}
          maxLength={50}
          readOnly={readOnly}
          autoComplete="off"
          enterKeyHint="done"
          placeholder="Ex.: Marca X"
          aria-invalid={!!errors.brand}
          aria-describedby={errors.brand ? `${id}-brand-error` : undefined}
          onChange={(event) => setDraft((previous) => ({ ...previous, brand: event.target.value }))}
        />
      </label>
      {errors.brand ? (
        <p id={`${id}-brand-error`} className="product-detail-error">
          {errors.brand}
        </p>
      ) : null}
      {preview ? (
        <p className="product-name-preview" aria-label="Prévia do nome">
          Prévia: {preview}
        </p>
      ) : null}
    </div>
  );
}
