import { useRef, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { repository } from '../../../app/services';
import { useMutation } from '../../../shared/hooks/useMutation';
import { useUnsavedChanges } from '../../../shared/lib/drafts';
import { Button } from '../../../shared/ui/Button';
import { ErrorMessage } from '../../../shared/ui/Feedback';

export function AddItemForm({ listId, categoryId, readOnly = false }: { listId: string; categoryId: string; readOnly?: boolean }) {
  const [name, setName] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const revision = useRef(0);
  const mutation = useMutation();
  useUnsavedChanges(name.trim().length > 0);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (readOnly) return;
    // Keep mobile keyboard activation inside the submit gesture, before the write.
    input.current?.focus({ preventScroll: true });
    const submittedName = name;
    const submittedRevision = revision.current;
    const result = await mutation.run(() => repository.addItem(listId, categoryId, submittedName));
    if (result.ok && revision.current === submittedRevision) {
      setName('');
    }
  }
  if (readOnly && !name.trim()) return null;
  return (
    <form className="add-item-form" onSubmit={submit} aria-busy={mutation.pending}>
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
          onChange={(e) => {
            revision.current += 1;
            setName(e.target.value);
          }}
          placeholder="O que você precisa comprar?"
          autoComplete="off"
        />
        <Button
          type="submit"
          aria-label="Adicionar item"
          disabled={mutation.pending || readOnly}
          onPointerDown={(event) => {
            // Tapping + must not move focus from the text field to the button.
            if (event.isPrimary && event.button === 0) event.preventDefault();
          }}
        >
          <Plus size={22} />
        </Button>
      </div>
      <ErrorMessage message={mutation.error} />
    </form>
  );
}
