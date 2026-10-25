import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import type { AccessState } from './controller';
import { AccessScreen } from './AccessScreen';

const mocks = vi.hoisted(() => ({
  state: null as unknown as AccessState,
  signIn: vi.fn().mockResolvedValue(undefined),
  refresh: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn(),
}));
vi.mock('./use-access', () => ({ useAccess: () => mocks.state }));
vi.mock('./config', () => ({ accessConfigured: true }));
vi.mock('./client', () => ({ signIn: mocks.signIn }));
vi.mock('./controller', () => ({
  accessController: { refresh: mocks.refresh, logout: mocks.logout },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state = {
    phase: 'denied',
    account: { uid: 'buyer', email: 'cliente+compras@example.com' },
    lease: null,
    message: 'Estamos aguardando a confirmação da sua compra para liberar o acesso ao Vértice.',
    busy: false,
    adminUid: null,
  };
});

it('prepara o WhatsApp com o e-mail correto e permite trocar de conta ou verificar novamente', async () => {
  const view = render(
    <MemoryRouter>
      <AccessScreen />
    </MemoryRouter>,
  );
  const support = screen.getByRole('link', { name: /Falar com o produtor no WhatsApp/ });
  const url = new URL(support.getAttribute('href')!);
  expect(url.hostname).toBe('wa.me');
  expect(url.pathname).toBe('/5551980614158');
  expect(url.searchParams.get('text')).toContain('cliente+compras@example.com');
  expect(support).toHaveAttribute('rel', 'noopener noreferrer');
  expect(screen.queryByRole('button', { name: 'Sair da conta' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Acessar com outra conta do Google' }));
  await waitFor(() => expect(mocks.signIn).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Verificar acesso' })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Verificar acesso' }));
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalledWith(true));
  mocks.state = { ...mocks.state, account: { uid: 'other', email: 'outra@example.com' } };
  view.rerender(
    <MemoryRouter>
      <AccessScreen />
    </MemoryRouter>,
  );
  const changed = new URL(
    screen.getByRole('link', { name: /Falar com o produtor no WhatsApp/ }).getAttribute('href')!,
  );
  expect(changed.searchParams.get('text')).toContain('outra@example.com');
  expect(changed.searchParams.get('text')).not.toContain('cliente+compras@example.com');
});

it('não mostra contato personalizado antes do login nem na renovação offline', () => {
  mocks.state = { ...mocks.state, phase: 'signedout', account: null };
  const view = render(
    <MemoryRouter>
      <AccessScreen />
    </MemoryRouter>,
  );
  expect(screen.getByRole('button', { name: 'Entrar com Google' })).toBeEnabled();
  expect(screen.queryByRole('link', { name: /Falar com o produtor/ })).not.toBeInTheDocument();
  mocks.state = {
    ...mocks.state,
    phase: 'expired',
    account: { uid: 'buyer', email: 'buyer@example.com' },
  };
  view.rerender(
    <MemoryRouter>
      <AccessScreen frozen />
    </MemoryRouter>,
  );
  expect(screen.getByRole('button', { name: 'Sair da conta' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Falar com o produtor/ })).not.toBeInTheDocument();
});
