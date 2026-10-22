import { useCallback, useEffect, useRef, useState } from 'react';
import { BackLink } from '../shared/ui/BackLink';
import { getClient, callAccess } from './client';
import { useAccess } from './use-access';
import { AccessScreen } from './AccessScreen';
import { Button } from '../shared/ui/Button';
import { trackWrite } from '../data/database/writes';
import { useUnsavedChanges } from '../shared/lib/drafts';
interface License {
  id: string;
  email: string;
  status: 'active' | 'revoked';
  user_id: string | null;
  order_reference: string | null;
  created_at: string;
}
interface Event {
  id: number;
  action: string;
  created_at: string;
}
export default function AdminPage() {
  const state = useAccess();
  const uid = state.account?.uid;
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
    if (uid) void load();
  }, [load, uid]);
  async function change(input: unknown) {
    setPending(true);
    setError('');
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
                <div className="access-actions">
                  <Button
                    variant={row.status === 'active' ? 'danger' : 'secondary'}
                    disabled={pending}
                    onClick={() => {
                      if (
                        window.confirm(
                          `${row.status === 'active' ? 'Revogar' : 'Reativar'} acesso de ${row.email}?${row.status === 'active' ? ' Um aparelho offline pode continuar por até sete dias.' : ''}`,
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
        </>
      )}
    </main>
  );
}
