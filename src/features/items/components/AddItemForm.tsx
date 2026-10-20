import {useRef, useState, type FormEvent} from 'react';
import {Plus} from 'lucide-react';
import {repository} from '../../../app/services';
import {useMutation} from '../../../shared/hooks/useMutation';
import {useUnsavedChanges} from '../../../shared/lib/drafts';
import {Button} from '../../../shared/ui/Button';
import {ErrorMessage} from '../../../shared/ui/Feedback';

export function AddItemForm({listId, categoryId}: {listId: string; categoryId: string}) {
  const [name, setName] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const mutation = useMutation();
  useUnsavedChanges(name.trim().length > 0);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await mutation.run(() => repository.addItem(listId, categoryId, name));
    if (result.ok) {setName(''); input.current?.focus()}
  }
  return <form className="add-item-form" onSubmit={submit}><div className="add-item-control"><label className="sr-only" htmlFor="new-item">Adicionar item</label><input id="new-item" ref={input} value={name} required maxLength={50} disabled={mutation.pending} onChange={(e) => setName(e.target.value)} placeholder="O que você precisa comprar?" autoComplete="off" /><Button type="submit" aria-label="Adicionar item" disabled={mutation.pending}><Plus size={22} /></Button></div><ErrorMessage message={mutation.error} /></form>;
}
