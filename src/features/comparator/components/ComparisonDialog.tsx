import {
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type FocusEvent,
  type KeyboardEvent,
  type SetStateAction,
} from 'react';
import {
  comparePackages,
  emptyPackages,
  MODE_UNITS,
  type ComparisonMode,
  type ComparisonUnit,
  type PackageInput,
  type PackagePair,
} from '../../../domain/services/comparison';
import { Dialog } from '../../../shared/ui/Dialog';
import { Button } from '../../../shared/ui/Button';
import type { ComparisonSession } from '../session';

const modes: [ComparisonMode, string][] = [
  ['weight', 'Peso'],
  ['volume', 'Volume'],
  ['units', 'Unidades'],
];

export function ComparisonDialog({
  session,
  setSession,
  storageFailed,
  onClose,
}: {
  session: ComparisonSession;
  setSession: Dispatch<SetStateAction<ComparisonSession>>;
  storageFailed: boolean;
  onClose: () => void;
}) {
  const first = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const output = useRef<HTMLDivElement>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const mode = session.mode;
  const pair = session.drafts[mode];
  const result = comparePackages(mode, pair);
  const headline =
    result.status !== 'ready'
      ? ''
      : result.winner === 'tie'
        ? 'Mesmo preço por quantidade'
        : `Opção ${result.winner} mais barata por quantidade`;

  useLayoutEffect(() => {
    const dialog = form.current?.closest('dialog');
    const viewport = window.visualViewport;
    if (!dialog || !viewport) return;
    const fit = () => {
      dialog.style.setProperty('--comparison-height', `${Math.max(120, viewport.height - 24)}px`);
      dialog.style.setProperty('--comparison-top', `${viewport.offsetTop + viewport.height / 2}px`);
    };
    fit();
    viewport.addEventListener('resize', fit, { passive: true });
    viewport.addEventListener('scroll', fit, { passive: true });
    return () => {
      viewport.removeEventListener('resize', fit);
      viewport.removeEventListener('scroll', fit);
    };
  }, []);

  function update(index: number, field: keyof PackageInput, value: string) {
    setSession((previous) => {
      const current = previous.drafts[previous.mode];
      const next = current.map((option, i) =>
        i === index ? { ...option, [field]: value } : option,
      ) as PackagePair;
      return { ...previous, drafts: { ...previous.drafts, [previous.mode]: next } };
    });
  }
  function enter(event: KeyboardEvent<HTMLInputElement>, index: number) {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    event.preventDefault();
    const inputs = form.current?.querySelectorAll<HTMLInputElement>(
      'input[data-comparison-number]',
    );
    if (index < 3) inputs?.[index + 1]?.focus();
    else {
      output.current?.focus({ preventScroll: true });
      output.current?.scrollIntoView({ block: 'nearest' });
    }
  }
  function clear() {
    setSession((previous) => ({
      ...previous,
      drafts: { ...previous.drafts, [previous.mode]: emptyPackages(previous.mode) },
    }));
    setTouched({});
    first.current?.focus();
  }
  function touch(event: FocusEvent<HTMLInputElement>, key: string) {
    // A blur must not move the button/select between pointer-down and pointer-up.
    if (event.relatedTarget instanceof HTMLElement && event.relatedTarget.closest('button, select'))
      return;
    setTouched((previous) => ({ ...previous, [key]: true }));
  }

  return (
    <Dialog
      title="Qual compensa?"
      onClose={onClose}
      initialFocusRef={first}
      preserveScroll
      className="comparison-dialog"
    >
      <form ref={form} className="comparison-form" onSubmit={(event) => event.preventDefault()}>
        <div className="comparison-modes" role="group" aria-label="Tipo de comparação">
          {modes.map(([value, label]) => (
            <Button
              key={value}
              variant="secondary"
              aria-pressed={mode === value}
              onClick={() => setSession((previous) => ({ ...previous, mode: value }))}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="comparison-options">
          {pair.map((option, index) => {
            const label = index === 0 ? 'A' : 'B';
            const errors = result.status === 'ready' ? {} : result.errors[index];
            const priceKey = `${mode}-${index}-price`,
              contentKey = `${mode}-${index}-content`;
            const priceError = touched[priceKey] ? errors.price : undefined;
            const contentError = touched[contentKey] ? errors.content : undefined;
            return (
              <fieldset key={label} className="comparison-option form-stack">
                <legend>Opção {label}</legend>
                <label>
                  Preço da embalagem (R$)
                  <input
                    ref={index === 0 ? first : undefined}
                    aria-label={`Preço da opção ${label} (R$)`}
                    aria-invalid={!!priceError}
                    aria-describedby={priceError ? `compare-${label}-price-error` : undefined}
                    data-comparison-number
                    inputMode="decimal"
                    enterKeyHint="next"
                    autoComplete="off"
                    maxLength={100}
                    value={option.price}
                    placeholder="Ex.: 10,90"
                    onChange={(event) => update(index, 'price', event.target.value)}
                    onFocus={(event) => event.currentTarget.select()}
                    onBlur={(event) => touch(event, priceKey)}
                    onKeyDown={(event) => enter(event, index * 2)}
                  />
                  {priceError && (
                    <span id={`compare-${label}-price-error`} className="comparison-error">
                      {priceError}
                    </span>
                  )}
                </label>
                <div className="form-row">
                  <label>
                    {mode === 'units' ? 'Quantidade de unidades' : 'Conteúdo da embalagem'}
                    <input
                      aria-label={`Conteúdo da opção ${label}`}
                      aria-invalid={!!contentError}
                      aria-describedby={contentError ? `compare-${label}-content-error` : undefined}
                      data-comparison-number
                      inputMode={mode === 'units' ? 'numeric' : 'decimal'}
                      enterKeyHint={index === 1 ? 'done' : 'next'}
                      autoComplete="off"
                      maxLength={100}
                      value={option.content}
                      placeholder={mode === 'units' ? 'Ex.: 12' : 'Ex.: 500'}
                      onChange={(event) => update(index, 'content', event.target.value)}
                      onFocus={(event) => event.currentTarget.select()}
                      onBlur={(event) => touch(event, contentKey)}
                      onKeyDown={(event) => enter(event, index * 2 + 1)}
                    />
                    {contentError && (
                      <span id={`compare-${label}-content-error`} className="comparison-error">
                        {contentError}
                      </span>
                    )}
                  </label>
                  <label>
                    Unidade
                    <select
                      aria-label={`Unidade da opção ${label}`}
                      value={option.unit}
                      disabled={mode === 'units'}
                      onChange={(event) =>
                        update(index, 'unit', event.target.value as ComparisonUnit)
                      }
                    >
                      {MODE_UNITS[mode].map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </fieldset>
            );
          })}
        </div>
        <div
          className="comparison-output"
          ref={output}
          tabIndex={-1}
          aria-label="Resultado da comparação"
        >
          {result.status === 'ready' ? (
            <>
              <h3>{headline}</h3>
              <p>
                A: {result.unitPrices[0]}/{result.reference}
              </p>
              <p>
                B: {result.unitPrices[1]}/{result.reference}
              </p>
              {result.winner !== 'tie' && (
                <p className="comparison-saving">
                  Economia de {result.saving} por {result.reference} — {result.savingPercent}.
                </p>
              )}
            </>
          ) : (
            <p>
              {result.status === 'invalid'
                ? 'Corrija os campos para comparar as embalagens.'
                : 'Preencha preço e conteúdo das duas opções.'}
            </p>
          )}
        </div>
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {headline}
        </p>
        <p className="field-help">
          Compara somente preço por quantidade. Qualidade, concentração e rendimento também podem
          influenciar sua escolha.
        </p>
        {storageFailed && (
          <p className="comparison-error" role="status">
            Comparação mantida apenas enquanto o app estiver aberto. Uma recarga poderá apagar estes
            campos.
          </p>
        )}
        <div className="dialog-actions">
          <Button variant="secondary" onClick={clear}>
            Limpar comparação
          </Button>
          <Button onClick={onClose}>Fechar comparador</Button>
        </div>
      </form>
    </Dialog>
  );
}
