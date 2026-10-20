import { useId } from 'react';

export function BudgetField({ value, onChange, readOnly = false }: {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}) {
  const helpId = useId();
  return (
    <label>
      Orçamento da compra (R$) <span className="muted">(opcional)</span>
      <input
        aria-label="Orçamento da compra (R$)"
        aria-describedby={helpId}
        inputMode="decimal"
        enterKeyHint="done"
        autoComplete="off"
        maxLength={100}
        readOnly={readOnly}
        value={value}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Ex.: 300,00"
      />
      <span id={helpId} className="field-help">Deixe em branco para ficar sem limite. Use até duas casas decimais.</span>
    </label>
  );
}
