import { useRef, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { useRepository } from '../../../app/repository-context';
import { useMutation } from '../../../shared/hooks/useMutation';
import { useUnsavedChanges } from '../../../shared/lib/drafts';
import { Button } from '../../../shared/ui/Button';
import { ErrorMessage } from '../../../shared/ui/Feedback';
import { suggestionLabel, type SuggestedProduct } from '../../../domain/services/item-suggestions';
import { useItemSuggestions } from '../hooks/useItemSuggestions';

export function AddItemForm({
  listId,
  categoryId,
  readOnly = false,
}: {
  listId: string;
  categoryId: string;
  readOnly?: boolean;
}) {
  const repository = useRepository();
  const [name, setName] = useState('');
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [composing, setComposing] = useState(false);
  const composition = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const revision = useRef(0);
  const context = useRef('');
  context.current = `${listId}/${categoryId}`;
  const mutation = useMutation();
  const suggestions = useItemSuggestions(listId, name, !readOnly);
  useUnsavedChanges(name.trim().length > 0);
  async function add(product?: SuggestedProduct) {
    if (readOnly || composition.current || mutation.pending) return;
    // Restore focus during the gesture, never after the asynchronous write.
    input.current?.focus({ preventScroll: true });
    const submittedName = name;
    const submittedRevision = revision.current;
    const submittedContext = context.current;
    const result = await mutation.run(() =>
      product
        ? repository.addSuggestedItem(listId, categoryId, product)
        : repository.addItem(listId, categoryId, submittedName),
    );
    if (result.ok && revision.current === submittedRevision && context.current === submittedContext)
      setName('');
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void add();
  }
  if (readOnly && !name.trim()) return null;
  return (
    <form
      className="add-item-form"
      onSubmit={submit}
      aria-busy={mutation.pending}
      onFocusCapture={() => {
        setFocused(true);
        setDismissed(false);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          setDismissed(true);
        }
      }}
    >
      <div className="add-item-control">
        <label className="sr-only" htmlFor="new-item">
          Adicionar item
        </label>
        <input
          id="new-item"
          ref={input}
          value={name}
          required
          maxLength={50}
          readOnly={readOnly}
          enterKeyHint="enter"
          onChange={(event) => {
            revision.current += 1;
            setName(event.target.value);
            setDismissed(false);
          }}
          onCompositionStart={() => {
            composition.current = true;
            setComposing(true);
          }}
          onCompositionEnd={() => {
            composition.current = false;
            setComposing(false);
          }}
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              (composition.current ||
                event.nativeEvent.isComposing ||
                event.nativeEvent.keyCode === 229)
            )
              event.preventDefault();
          }}
          placeholder="O que você precisa comprar?"
          autoComplete="off"
        />
        <Button
          type="submit"
          aria-label="Adicionar item"
          disabled={mutation.pending || readOnly}
          onPointerDown={(event) => {
            if (event.isPrimary && event.button === 0) event.preventDefault();
          }}
        >
          <Plus size={22} aria-hidden="true" />
        </Button>
      </div>
      {focused && !dismissed && !composing && !readOnly && suggestions.length > 0 ? (
        <ul className="item-suggestions" aria-label="Sugestões de compras anteriores">
          {suggestions.map((suggestion) => {
            const label = suggestionLabel(suggestion);
            return (
              <li key={suggestion.itemId}>
                <button
                  type="button"
                  disabled={mutation.pending}
                  aria-label={`Adicionar ${label}`}
                  onPointerDown={(event) => {
                    if (event.isPrimary && event.button === 0) event.preventDefault();
                  }}
                  onClick={() => void add(suggestion)}
                >
                  <span>{label}</span>
                  <Plus size={14} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <ErrorMessage message={mutation.error} />
    </form>
  );
}
