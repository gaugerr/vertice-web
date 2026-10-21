import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import { AccessBoundary } from './AccessBoundary';
import type { AccessState } from './controller';
const mocks = vi.hoisted(() => ({
  state: { value: null as unknown as AccessState },
  inspect: vi.fn().mockResolvedValue(null),
}));
vi.mock('./config', () => ({
  accessConfig: { url: 'https://test.supabase.co' },
  accessConfigured: true,
}));
vi.mock('./use-access', () => ({ useAccess: () => mocks.state.value }));
vi.mock('./legacy-migration', () => ({ inspectLegacy: mocks.inspect, migrateLegacy: vi.fn() }));
vi.mock('./controller', () => ({
  accessController: {
    canUse: () => false,
    canExport: () => false,
    refresh: vi.fn(),
    logout: vi.fn(),
  },
}));
const account = { uid: '83ec6841-7434-4dde-bd1d-490d35519d87', email: 'buyer@example.com' };
function Draft() {
  const [value, setValue] = useState('');
  return (
    <label>
      Preço não salvo
      <input value={value} onChange={(e) => setValue(e.target.value)} />
    </label>
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
  // RouterProvider memoizes its route tree; trigger its route subscription without navigation.

  await waitFor(() => expect(document.querySelector('[inert]')).toBeTruthy());
  expect(document.querySelector('input')?.value).toBe('12,90');
  expect(await screen.findByRole('dialog', { name: 'Acesso pausado' })).toBeInTheDocument();
  mocks.state.value = { ...mocks.state.value, phase: 'active' };
  act(() => view.rerender(tree()));
  expect(await screen.findByLabelText('Preço não salvo')).toHaveValue('12,90');
});
