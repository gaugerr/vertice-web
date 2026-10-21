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
    parsed.ok && name.trim() && (parsed.details.brand || parsed.details.packageContent)
      ? formatItemName({ name: name.trim(), ...parsed.details })
      : '';
  return (
    <div className="product-details form-stack" role="group" aria-labelledby={`${id}-title`}>
      <p id={`${id}-title`} className="product-details-title">
        Detalhes opcionais
      </p>
      <label>
        Marca
        <input
          value={draft.brand}
          maxLength={50}
          readOnly={readOnly}
          autoComplete="off"
          enterKeyHint="done"
          placeholder="Ex.: Melitta"
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
      <div className="product-package-field">
        <label htmlFor={`${id}-amount`}>Embalagem</label>
        <div className="product-content-fields">
          <input
            id={`${id}-amount`}
            value={draft.amount}
            inputMode={draft.unit === 'un' ? 'numeric' : 'decimal'}
            enterKeyHint="done"
            autoComplete="off"
            maxLength={100}
            readOnly={readOnly}
            placeholder="Ex.: 500"
            aria-invalid={!!errors.amount}
            aria-describedby={errors.amount ? `${id}-amount-error` : undefined}
            onFocus={(event) => event.currentTarget.select()}
            onChange={(event) =>
              setDraft((previous) => ({ ...previous, amount: event.target.value }))
            }
          />
          <select
            aria-label="Unidade da embalagem"
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
        </div>
      </div>
      {errors.amount ? (
        <p id={`${id}-amount-error`} className="product-detail-error">
          {errors.amount}
        </p>
      ) : null}
      {preview ? (
        <p className="product-name-preview" aria-label="Prévia do nome">
          {preview}
        </p>
      ) : null}
    </div>
  );
}
