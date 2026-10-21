import { useRef, useState, type ChangeEvent } from 'react';
import { Download, FileJson, Upload } from 'lucide-react';
import { useRepository } from '../../../app/repository-context';
import {
  downloadBackup,
  encodeBackup,
  MAX_BACKUP_BYTES,
  parseBackup,
} from '../../../data/backup/backup';
import type { ShoppingSnapshot } from '../../../domain/models/shopping';
import { useMutation } from '../../../shared/hooks/useMutation';
import { errorMessage } from '../../../shared/lib/errors';
import { useUnsavedChanges } from '../../../shared/lib/drafts';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { ErrorMessage } from '../../../shared/ui/Feedback';

export function BackupPanel() {
  const repository = useRepository();
  const [snapshot, setSnapshot] = useState<ShoppingSnapshot | null>(null);
  const [filename, setFilename] = useState('');
  const [fileError, setFileError] = useState('');
  const [message, setMessage] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const mutation = useMutation();
  useUnsavedChanges(snapshot !== null);
  async function exportFile() {
    const result = await mutation.run(async () =>
      downloadBackup(encodeBackup(await repository.exportSnapshot())),
    );
    if (result.ok) setMessage('Backup exportado. Guarde o arquivo em um lugar seguro.');
  }
  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setFileError('');
    setMessage('');
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error('O arquivo excede 10 MiB.');
      const parsed = parseBackup(await file.text());
      setFilename(file.name);
      setSnapshot(parsed);
    } catch (error) {
      setFileError(errorMessage(error));
    }
  }
  async function restore() {
    if (!snapshot) return;
    const result = await mutation.run(() => repository.replaceSnapshot(snapshot));
    if (result.ok) {
      setSnapshot(null);
      setMessage('Backup restaurado.');
    }
  }
  return (
    <section className="settings-card">
      <div className="settings-icon">
        <FileJson size={24} aria-hidden="true" />
      </div>
      <h2>Seus dados, com você</h2>
      <p>
        Salve uma cópia das suas compras. Você também pode importar um backup do Vértice Flutter.
      </p>
      <div className="backup-actions">
        <Button disabled={mutation.pending} onClick={exportFile}>
          <Download size={18} aria-hidden="true" />
          Exportar backup
        </Button>
        <Button
          variant="secondary"
          disabled={mutation.pending}
          onClick={() => input.current?.click()}
        >
          <Upload size={18} aria-hidden="true" />
          Importar backup
        </Button>
      </div>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        aria-label="Arquivo de backup"
        className="sr-only"
        onChange={readFile}
      />
      <p className="field-help">
        Arquivos JSON de até 10 MiB. Restaurar substitui os dados atuais.
      </p>
      <ErrorMessage message={fileError || mutation.error} />
      {message && (
        <p role="status" className="success-message">
          {message}
        </p>
      )}
      {snapshot && (
        <Dialog title="Restaurar backup?" onClose={() => setSnapshot(null)} busy={mutation.pending}>
          <p className="backup-filename">{filename}</p>
          <div className="backup-summary">
            <span>
              <strong>{snapshot.lists.length}</strong> listas
            </span>
            <span>
              <strong>{snapshot.categories.length}</strong> categorias
            </span>
            <span>
              <strong>{snapshot.items.length}</strong> itens
            </span>
          </div>
          <p>
            Todos os dados atuais serão substituídos. Exporte um backup antes se quiser mantê-los.
          </p>
          <ErrorMessage message={mutation.error} />
          <div className="dialog-actions">
            <Button
              variant="secondary"
              disabled={mutation.pending}
              onClick={() => setSnapshot(null)}
            >
              Cancelar
            </Button>
            <Button disabled={mutation.pending} onClick={restore}>
              {mutation.pending ? 'Restaurando…' : 'Substituir e restaurar'}
            </Button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
