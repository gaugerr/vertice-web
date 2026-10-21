import { useLayoutEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

export function Dialog({
  title,
  onClose,
  children,
  busy = false,
  initialFocusRef,
  preserveScroll = false,
  className,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  preserveScroll?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useLayoutEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    const position = { x: window.scrollX, y: window.scrollY };
    const overflow = document.body.style.overflow;
    if (preserveScroll) document.body.style.overflow = 'hidden';
    dialog?.showModal();
    const target =
      initialFocusRef?.current ??
      dialog?.querySelector<HTMLElement>('input:not([type="hidden"]), textarea, select');
    target?.focus();
    return () => {
      dialog?.close();
      if (preserveScroll) document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: preserveScroll });
      if (preserveScroll) window.scrollTo(position.x, position.y);
    };
  }, [initialFocusRef, preserveScroll]);
  return (
    <dialog
      ref={ref}
      className={className}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <div className="dialog-header">
        <h2 id={titleId}>{title}</h2>
        <Button variant="icon" aria-label="Fechar" disabled={busy} onClick={onClose}>
          <X size={20} />
        </Button>
      </div>
      {children}
    </dialog>
  );
}
