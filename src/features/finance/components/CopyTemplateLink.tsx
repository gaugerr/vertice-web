import { useId, useRef, useState } from 'react';
import { Copy } from 'lucide-react';
import { Button } from '../../../shared/ui/Button';

export function CopyTemplateLink({ url, title }: { url: string; title: string }) {
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'manual'>('idle');
  const input = useRef<HTMLInputElement>(null);
  const id = useId();

  async function copyLink() {
    setStatus('copying');
    try {
      await navigator.clipboard.writeText(url);
      setStatus('copied');
    } catch {
      setStatus('manual');
    }
  }

  return (
    <div className="finance-copy-link">
      <Button
        variant="secondary"
        disabled={status === 'copying'}
        onClick={() => void copyLink()}
        aria-label={`Copiar link — ${title}`}
      >
        <Copy size={15} aria-hidden="true" />
        Copiar link
      </Button>
      <p className="finance-hint" role="status">
        {status === 'copied'
          ? 'Link copiado. Cole na barra de endereço do navegador para tentar criar a cópia.'
          : status === 'manual'
            ? 'Não foi possível copiar automaticamente. Selecione e copie o link abaixo.'
            : ''}
      </p>
      {status === 'manual' && (
        <div className="finance-manual-copy">
          <label htmlFor={id}>Link de cópia — {title}</label>
          <input
            id={id}
            ref={input}
            type="text"
            readOnly
            value={url}
            onFocus={(event) => event.currentTarget.select()}
          />
          <Button
            variant="secondary"
            onClick={() => {
              input.current?.focus();
              input.current?.select();
            }}
          >
            Selecionar link
          </Button>
        </div>
      )}
    </div>
  );
}
