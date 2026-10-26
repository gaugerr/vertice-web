import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import type { AccessState } from './controller';
import AdminPage from './AdminPage';

const mocks = vi.hoisted(() => ({
  state: null as unknown as AccessState,
  request: vi.fn(),
  session: vi.fn(),
}));
vi.mock('./use-access', () => ({ useAccess: () => mocks.state }));
vi.mock('./client', () => ({
  getClient: () => ({ auth: { getSession: mocks.session } }),
  callAccess: mocks.request,
}));
vi.mock('./AccessScreen', () => ({ AccessScreen: () => <p>Entrar</p> }));

const buyer = {
  id: 'buyer-license',
  email: 'buyer@example.test',
  status: 'revoked',
  user_id: 'buyer',
  order_reference: null,
  created_at: '2026-10-26T12:00:00Z',
};
const owner = { ...buyer, id: 'owner-license', email: 'owner@example.test', user_id: 'owner' };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state = {
    phase: 'authorized',
    account: { uid: 'owner', email: 'owner@example.test' },
    lease: null,
    message: '',
    busy: false,
    adminUid: 'owner',
  } as unknown as AccessState;
  mocks.session.mockResolvedValue({
    data: { session: { access_token: 'local-test-token' } },
    error: null,
  });
  let deleted = false;
  mocks.request.mockImplementation(async (_endpoint, input) => {
    if (input.action === 'list')
      return { licenses: deleted ? [owner] : [buyer, owner], hasMore: false };
    if (input.action === 'delete') {
      deleted = true;
      return { deleted: true };
    }
    throw new Error('Unexpected test request');
  });
});

async function open() {
  render(
    <MemoryRouter>
      <AdminPage />
    </MemoryRouter>,
  );
  const row = await screen.findByText(buyer.email, { selector: 'strong' });
  fireEvent.click(within(row.closest('li')!).getByRole('button', { name: 'Excluir licença' }));
  return screen.getByRole('dialog', { name: 'Excluir licença?' });
}

it('requires the exact email, deletes only the selected license and refreshes the list', async () => {
  const dialog = await open();
  const confirm = within(dialog).getByRole('button', { name: 'Excluir definitivamente' });
  const input = within(dialog).getByRole('textbox');
  expect(confirm).toBeDisabled();
  fireEvent.change(input, { target: { value: 'other@example.test' } });
  expect(confirm).toBeDisabled();
  expect(mocks.request.mock.calls.filter(([, value]) => value.action === 'delete')).toHaveLength(0);
  fireEvent.change(input, { target: { value: buyer.email } });
  fireEvent.click(confirm);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(mocks.request).toHaveBeenCalledWith(
    'license-admin',
    {
      action: 'delete',
      id: buyer.id,
      confirmEmail: buyer.email,
    },
    'local-test-token',
  );
  expect(screen.queryByText(buyer.email, { selector: 'strong' })).not.toBeInTheDocument();
  expect(screen.getByText(owner.email, { selector: 'strong' })).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent(
    'Conta de login, compras e histórico preservados',
  );
});

it('cancel does not delete and the administrator license cannot be selected', async () => {
  const dialog = await open();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  const row = screen.getByText(owner.email, { selector: 'strong' }).closest('li')!;
  expect(within(row).getByRole('button', { name: 'Excluir licença' })).toBeDisabled();
  expect(mocks.request.mock.calls.filter(([, value]) => value.action === 'delete')).toHaveLength(0);
});

it('keeps the row and confirmation after a failed request without claiming the deletion did not happen', async () => {
  const dialog = await open();
  mocks.request.mockRejectedValueOnce(new Error('Network timeout'));
  fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: buyer.email } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Excluir definitivamente' }));
  await waitFor(() =>
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Atualize o painel'),
  );
  expect(within(dialog).getByRole('button', { name: 'Excluir definitivamente' })).toBeEnabled();
  expect(screen.getByText(buyer.email, { selector: 'strong' })).toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
