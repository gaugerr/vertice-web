import { useEffect, useLayoutEffect, useRef, useMemo, useState, type ReactNode } from 'react';
import { VerticeDatabase } from '../data/database/database';
import { RepositoryProvider } from '../app/repository-context';
import { guardedRepository, accountDatabaseName } from './account-repository';
import { accessConfig } from './config';
import { useAccess } from './use-access';
import { accessController } from './controller';
import type { Account } from './lease';
import { AccessScreen } from './AccessScreen';
import { waitForWrites } from '../data/database/writes';
import { downloadBackup, encodeBackup } from '../data/backup/backup';
import { DexieShoppingRepository } from '../data/repositories/dexie-shopping-repository';
import { inspectLegacy, migrateLegacy } from './legacy-migration';
import { Button } from '../shared/ui/Button';
export function AccessBoundary({ children }: { children: ReactNode }) {
  const state = useAccess();
  const [mounted, setMounted] = useState<Account | null>(null);
  useEffect(() => {
    if (!mounted && state.phase === 'active' && state.account) setMounted(state.account);
  }, [mounted, state]);
  if (!mounted)
    return (
      <AccessScreen
        onExport={
          state.account && accessController.canExport(state.account.uid)
            ? () => exportAccount(state.account!)
            : undefined
        }
      />
    );
  const allowed = state.account?.uid === mounted.uid && state.phase === 'active';
  return (
    <AccountTree
      key={mounted.uid}
      account={mounted}
      allowed={allowed}
      onDiscard={() => {
        void waitForWrites().then(() => setMounted(null));
      }}
    >
      {children}
    </AccountTree>
  );
}
function AccountTree({
  account,
  allowed,
  children,
  onDiscard,
}: {
  account: Account;
  allowed: boolean;
  children: ReactNode;
  onDiscard: () => void;
}) {
  const project = new URL(accessConfig.url).hostname.split('.')[0];
  const scope = `${project}:${account.uid}`;
  const db = useMemo(
    () => new VerticeDatabase(accountDatabaseName(project, account.uid)),
    [project, account.uid],
  );
  const repository = useMemo(
    () =>
      guardedRepository(
        db,
        () => accessController.canUse(account.uid),
        () => accessController.canUse(account.uid),
      ),
    [db, account.uid],
  );
  const [migration, setMigration] = useState<Awaited<ReturnType<typeof inspectLegacy>> | undefined>(
    undefined,
  );
  const [migrationError, setMigrationError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    void inspectLegacy(scope, db)
      .then((value) => {
        if (live) setMigration(value);
      })
      .catch(() => {
        if (live)
          setMigrationError('Não foi possível verificar os dados antigos. Tente novamente.');
      });
    return () => {
      live = false;
      void waitForWrites().then(() => db.close());
    };
  }, [db, scope]);
  async function transfer() {
    setBusy(true);
    setMigrationError('');
    try {
      await migrateLegacy(scope, db, () => accessController.canUse(account.uid));
      setMigration(null);
    } catch (error) {
      setMigrationError(error instanceof Error ? error.message : 'A transferência falhou.');
    } finally {
      setBusy(false);
    }
  }
  async function exportCommitted() {
    if (!accessController.canExport(account.uid))
      throw new Error('Entre novamente com a mesma conta para exportar.');
    await waitForWrites();
    if (!accessController.canExport(account.uid))
      throw new Error('A conta mudou. Entre novamente para exportar.');
    const snapshot = await new DexieShoppingRepository(db).exportSnapshot();
    if (!accessController.canExport(account.uid))
      throw new Error('A conta mudou. Entre novamente para exportar.');
    downloadBackup(encodeBackup(snapshot));
  }
  return (
    <RepositoryProvider value={repository} scope={scope}>
      <div inert={!allowed} aria-hidden={!allowed || undefined}>
        {migration === undefined ? (
          <section className="access-card">
            <p>Verificando suas listas…</p>
            {migrationError && (
              <>
                <p role="alert">{migrationError}</p>
                <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
              </>
            )}
          </section>
        ) : migration ? (
          <section className="access-card">
            <h1>Trazer suas listas para esta conta?</h1>
            <p>{migration.count} listas encontradas neste navegador.</p>
            <p>
              Conta de destino: <strong>{account.email}</strong>
            </p>
            <p>Os dados originais serão preservados.</p>
            {!migration.canImport && (
              <p>
                A conta já tem compras. A transferência automática não substitui esses dados. Use os
                backups para revisar suas cópias.
              </p>
            )}
            <div className="access-actions">
              <Button disabled={busy || !migration.canImport} onClick={() => void transfer()}>
                {busy ? 'Transferindo…' : 'Confirmar transferência'}
              </Button>
              <Button
                variant="secondary"
                disabled={busy || migration.pending}
                onClick={() => setMigration(null)}
              >
                Agora não
              </Button>
            </div>
            {migrationError && <p role="alert">{migrationError}</p>}
          </section>
        ) : (
          children
        )}
      </div>
      {!allowed && (
        <BlockingOverlay>
          <AccessScreen
            frozen
            onDiscard={onDiscard}
            onExport={accessController.canExport(account.uid) ? exportCommitted : undefined}
          />
        </BlockingOverlay>
      )}
    </RepositoryProvider>
  );
}

function BlockingOverlay({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="access-overlay"
      aria-label="Acesso pausado"
      onCancel={(e) => e.preventDefault()}
    >
      {children}
    </dialog>
  );
}

async function exportAccount(account: Account) {
  await waitForWrites();
  if (!accessController.canExport(account.uid))
    throw new Error('Entre novamente com a mesma conta para exportar.');
  const project = new URL(accessConfig.url).hostname.split('.')[0];
  const db = new VerticeDatabase(accountDatabaseName(project, account.uid));
  try {
    const snapshot = await new DexieShoppingRepository(db).exportSnapshot();
    if (!accessController.canExport(account.uid))
      throw new Error('A conta mudou. Entre novamente para exportar.');
    downloadBackup(encodeBackup(snapshot));
  } finally {
    db.close();
  }
}
