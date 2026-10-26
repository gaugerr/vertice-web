import { useCallback, useEffect, useRef, useState } from 'react';
import { BackLink } from '../shared/ui/BackLink';
import { getClient, callAccess } from './client';
import { useAccess } from './use-access';
import { AccessScreen } from './AccessScreen';
import { Button } from '../shared/ui/Button';
import { trackWrite } from '../data/database/writes';
import { useUnsavedChanges } from '../shared/lib/drafts';
import { Dialog } from '../shared/ui/Dialog';
interface License {
  id: string;
  email: string;
  status: 'active' | 'revoked';
  user_id: string | null;
  order_reference: string | null;
  created_at: string;
  provisioning_source?: 'manual' | 'cakto';
  manual_override?: 'allow' | 'deny' | null;
}
interface Event {
  id: string | number;
  action: string;
  created_at: string;
}
export default function AdminPage() {
  const state = useAccess();
  const uid = state.account?.uid;
  const accountEmail = state.account?.email?.toLowerCase();
  const [rows, setRows] = useState<License[]>([]);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [authorizedUid, setAuthorizedUid] = useState<string | null>(null);
  const authorized = Boolean(uid && authorizedUid === uid);
  const [email, setEmail] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [events, setEvents] = useState<{ email: string; rows: Event[] } | null>(null);
  const [deleting, setDeleting] = useState<License | null>(null);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [notice, setNotice] = useState('');
  const generation = useRef(0);
  useUnsavedChanges(Boolean(email || reference));
  const request = useCallback(async <T,>(input: unknown): Promise<T> => {
    const { data, error } = await getClient().auth.getSession();
    if (error || !data.session) throw new Error('Entre com o Google para administrar.');
    return callAccess<T>('license-admin', input, data.session.access_token);
  }, []);
  const load = useCallback(async () => {
    const seq = ++generation.current;
    setPending(true);
    setError('');
    try {
      const data = await request<{ licenses: License[]; hasMore: boolean }>({
        action: 'list',
        search: query,
        page,
      });
      if (seq === generation.current) {
        setRows(data.licenses.slice(0, 20));
        setMore(data.hasMore);
        setAuthorizedUid(uid ?? null);
      }
    } catch (e) {
      if (seq === generation.current) {
        setRows([]);
        setAuthorizedUid(null);
        setError(e instanceof Error ? e.message : 'Falha ao consultar.');
      }
    } finally {
      if (seq === generation.current) setPending(false);
    }
  }, [request, query, page, uid]);
  useEffect(() => {
    generation.current++;
    setAuthorizedUid(null);
    setRows([]);
    setEvents(null);
    setDeleting(null);
    setConfirmEmail('');
    if (uid) void load();
  }, [load, uid]);
  async function change(input: unknown) {
    setPending(true);
    setError('');
    setNotice('');
    try {
      await trackWrite(() => request(input));
      setEmail('');
      setReference('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'A operação falhou.');
    } finally {
      setPending(false);
    }
  }
  async function deleteLicense() {
    if (!deleting || confirmEmail !== deleting.email || pending) return;
    setPending(true);
    setDeleteError('');
    setNotice('');
    try {
      await trackWrite(() => request({ action: 'delete', id: deleting.id, confirmEmail }));
      setDeleting(null);
      setConfirmEmail('');
      setEvents(null);
      setNotice('Licença excluída. Conta de login, compras e histórico preservados.');
      await load();
    } catch {
      setDeleteError(
        'Não foi possível confirmar a exclusão. Atualize o painel antes de tentar novamente. Licenças de administradores não podem ser excluídas.',
      );
    } finally {
      setPending(false);
    }
  }
  if (!state.account)
    return (
      <div className="access-page">
        <AccessScreen />
      </div>
    );
  return (
    <main className="admin-page">
      <BackLink to="/">Minhas listas</BackLink>
      <h1>Licenças</h1>
      <p>{state.account.email} · Administração online</p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {!authorized && (
        <Button disabled={pending} onClick={() => void load()}>
          Verificar permissão
        </Button>
      )}
      {authorized && (
        <>
          <form
            className="settings-card"
            onSubmit={(e) => {
              e.preventDefault();
              void change({ action: 'grant', email, orderReference: reference });
            }}
          >
            <h2>Liberar acesso vitalício</h2>
            <label className="access-label">
              E-mail Google do comprador
              <input
                type="email"
                required
                maxLength={254}
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="access-label">
              Referência da compra (opcional)
              <input
                maxLength={120}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
            <Button type="submit" disabled={pending}>
              Liberar acesso
            </Button>
          </form>
          <form
            className="admin-search"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(0);
              setQuery(search);
            }}
          >
            <label className="access-label">
              Buscar e-mail
              <input
                type="search"
                maxLength={254}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <Button type="submit" disabled={pending}>
              Buscar
            </Button>
          </form>
          <ul className="license-list">
            {rows.map((row) => (
              <li className="settings-card" key={row.id}>
                <strong className="account-email">{row.email}</strong>
                <p>
                  {row.status === 'active' ? 'Ativa' : 'Revogada'} ·{' '}
                  {row.user_id ? 'Vinculada à conta' : 'Aguardando primeiro acesso'}
                </p>
                {row.order_reference && <p>Compra: {row.order_reference}</p>}
                {row.provisioning_source === 'cakto' && (
                  <p>
                    Compra pela Cakto{row.manual_override ? ' · Com ajuste manual de acesso' : ''}
                  </p>
                )}
                <div className="access-actions">
                  <Button
                    variant={row.status === 'active' ? 'danger' : 'secondary'}
                    disabled={pending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `${row.status === 'active' ? 'Revogar' : 'Reativar'} acesso de ${row.email}?${row.status === 'active' ? ' Um aparelho offline pode continuar por até sete dias.' : ''}${row.provisioning_source === 'cakto' ? (row.status === 'active' ? ' O bloqueio manual terá prioridade sobre a automação.' : ' A reativação manual manterá o acesso mesmo após reembolso.') : ''}`,
                        )
                      )
                        void change({
                          action: row.status === 'active' ? 'revoke' : 'reactivate',
                          id: row.id,
                        });
                    }}
                  >
                    {row.status === 'active' ? 'Revogar' : 'Reativar'}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={pending}
                    onClick={() => {
                      setPending(true);
                      void request<{ events: Event[] }>({ action: 'audit', id: row.id })
                        .then((data) => setEvents({ email: row.email, rows: data.events }))
                        .catch(() => setError('Não foi possível consultar o histórico.'))
                        .finally(() => setPending(false));
                    }}
                  >
                    Histórico
                  </Button>
                  <Button
                    variant="danger"
                    disabled={pending || row.user_id === uid || row.email === accountEmail}
                    onClick={() => {
                      setDeleting(row);
                      setConfirmEmail('');
                      setDeleteError('');
                    }}
                  >
                    Excluir licença
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {!rows.length && <p>Nenhuma licença encontrada.</p>}
          <div className="access-actions">
            <Button
              variant="secondary"
              disabled={pending || page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <span>Página {page + 1}</span>
            <Button
              variant="secondary"
              disabled={pending || !more}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
          {events && (
            <section className="settings-card">
              <h2>Histórico de {events.email}</h2>
              <ul>
                {events.rows.map((event) => (
                  <li key={event.id}>
                    {{
                      grant: 'Liberação',
                      revoke: 'Revogação',
                      reactivate: 'Reativação',
                      claim: 'Primeiro acesso',
                      cakto_grant: 'Liberação pela Cakto',
                      cakto_revoke: 'Revogação pela Cakto',
                      cakto_reactivate: 'Reativação pela Cakto',
                      delete: 'Exclusão da licença',
                    }[event.action] ?? event.action}{' '}
                    · {new Date(event.created_at).toLocaleString('pt-BR')}
                  </li>
                ))}
              </ul>
              <Button variant="secondary" onClick={() => setEvents(null)}>
                Fechar histórico
              </Button>
            </section>
          )}
          {deleting && (
            <Dialog
              title="Excluir licença?"
              busy={pending}
              onClose={() => {
                if (!pending) setDeleting(null);
              }}
            >
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void deleteLicense();
                }}
              >
                <p>
                  Esta ação remove somente a licença. O login Google, as compras, os eventos da
                  Cakto e o histórico são preservados. Não solicita reembolso.
                </p>
                <p>
                  O acesso será bloqueado na próxima verificação online. Um aparelho offline pode
                  manter acesso por até sete dias. Uma nova notificação de compra aprovada poderá
                  criar a licença novamente. Para manter um bloqueio com prioridade sobre a
                  automação, use Revogar.
                </p>
                <label className="access-label account-email">
                  Digite {deleting.email} para confirmar
                  <input
                    type="email"
                    required
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={254}
                    value={confirmEmail}
                    disabled={pending}
                    onChange={(event) => setConfirmEmail(event.target.value)}
                  />
                </label>
                {deleteError && (
                  <>
                    <p role="alert">{deleteError}</p>
                    <Button
                      variant="secondary"
                      disabled={pending}
                      onClick={() => {
                        setDeleting(null);
                        void load();
                      }}
                    >
                      Atualizar painel
                    </Button>
                  </>
                )}
                <div className="access-actions">
                  <Button variant="secondary" disabled={pending} onClick={() => setDeleting(null)}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="danger"
                    disabled={pending || confirmEmail !== deleting.email}
                  >
                    {pending ? 'Excluindo…' : 'Excluir definitivamente'}
                  </Button>
                </div>
              </form>
            </Dialog>
          )}
        </>
      )}
    </main>
  );
}
