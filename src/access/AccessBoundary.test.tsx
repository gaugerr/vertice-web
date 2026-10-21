import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AccessBoundary } from './AccessBoundary';
import { useUnsavedChanges } from '../shared/lib/drafts';
import { useAccountScope } from '../app/repository-context';
import type { AccessState } from './controller';
const mocks = vi.hoisted(() => ({
  state: { value: null as unknown as AccessState },
  inspect: vi.fn().mockResolvedValue(null),
  canExport: vi.fn().mockReturnValue(false),
}));
vi.mock('./config', () => ({
  accessConfig: { url: 'https://test.supabase.co', enforced: true },
  accessConfigured: true,
}));
vi.mock('./use-access', () => ({ useAccess: () => mocks.state.value }));
vi.mock('./legacy-migration', () => ({ inspectLegacy: mocks.inspect, migrateLegacy: vi.fn() }));
vi.mock('./controller', () => ({
  accessController: {
    canUse: () => false,
    canExport: mocks.canExport,
    refresh: vi.fn(),
    logout: vi.fn(),
  },
}));
const account = { uid: '83ec6841-7434-4dde-bd1d-490d35519d87', email: 'buyer@example.com' };
function Draft() {
  const [value, setValue] = useState('');
  useUnsavedChanges(Boolean(value));
  const scope = useAccountScope();
  return (
    <>
      <span data-testid="account-scope">{scope}</span>
      <label>
        Preço não salvo
        <input value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
    </>
  );
}
it('keeps a mounted draft inert under a blocking dialog and restores it for the same account', async () => {
  mocks.state.value = { phase: 'active', account, lease: null, message: '', busy: false };
  const tree = () => (
    <MemoryRouter>
      <AccessBoundary>
        <Draft />
      </AccessBoundary>
    </MemoryRouter>
  );
  const view = render(tree());
  const input = await screen.findByLabelText('Preço não salvo');
  fireEvent.change(input, { target: { value: '12,90' } });
  mocks.state.value = { ...mocks.state.value, phase: 'expired' };
  act(() => view.rerender(tree()));

  await waitFor(() => expect(document.querySelector('[inert]')).toBeTruthy());
  expect(document.querySelector('input')?.value).toBe('12,90');
  expect(await screen.findByRole('dialog', { name: 'Acesso pausado' })).toBeInTheDocument();
  mocks.state.value = { ...mocks.state.value, phase: 'active' };
  act(() => view.rerender(tree()));
  expect(await screen.findByLabelText('Preço não salvo')).toHaveValue('12,90');
});

beforeEach(() => {
  mocks.inspect.mockResolvedValue(null);
  mocks.canExport.mockReturnValue(false);
});
afterEach(() => {
  vi.restoreAllMocks();
  mocks.canExport.mockReturnValue(false);
});
it('offers committed-data export after a cold expired start without opening shopping views', () => {
  mocks.inspect.mockClear();
  mocks.canExport.mockReturnValue(true);
  mocks.state.value = { phase: 'expired', account, lease: null, message: '', busy: false };
  render(
    <MemoryRouter>
      <AccessBoundary>
        <Draft />
      </AccessBoundary>
    </MemoryRouter>,
  );
  expect(screen.getByRole('button', { name: 'Exportar meus dados salvos' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Preço não salvo')).not.toBeInTheDocument();
  expect(mocks.inspect).not.toHaveBeenCalled();
});
it('requires discarding the old draft before mounting another account', async () => {
  mocks.state.value = { phase: 'active', account, lease: null, message: '', busy: false };
  const tree = () => (
    <MemoryRouter>
      <AccessBoundary>
        <Draft />
      </AccessBoundary>
    </MemoryRouter>
  );
  const view = render(tree());
  fireEvent.change(await screen.findByLabelText('Preço não salvo'), { target: { value: '19,90' } });
  const next = { uid: '99ec6841-7434-4dde-bd1d-490d35519d87', email: 'other@example.com' };
  mocks.state.value = { ...mocks.state.value, account: next };
  view.rerender(tree());
  expect(screen.getByTestId('account-scope')).toHaveTextContent(account.uid);
  expect(document.querySelector('input')).toHaveValue('19,90');
  const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Descartar edição e continuar' }));
  await waitFor(() => expect(screen.getByTestId('account-scope')).toHaveTextContent(next.uid));
  expect(screen.getByLabelText('Preço não salvo')).toHaveValue('');
  expect(confirmation).toHaveBeenCalledTimes(1);
});
