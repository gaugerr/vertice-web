import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ComparisonProvider } from './ComparisonProvider';
import { ComparisonButton } from './ComparisonButton';

beforeEach(() => {
  sessionStorage.clear();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
});
function open() {
  fireEvent.click(screen.getByRole('button', { name: 'Comparar' }));
}
function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe('comparison panel', () => {
  it('focuses within the opening gesture, calculates live, removes stale results and preserves mode drafts', () => {
    render(
      <ComparisonProvider>
        <ComparisonButton />
      </ComparisonProvider>,
    );
    open();
    expect(screen.getByLabelText('Preço da opção A (R$)')).toHaveFocus();
    fill('Preço da opção A (R$)', '10,90');
    fill('Conteúdo da opção A', '500');
    fill('Preço da opção B (R$)', '19,90');
    fill('Conteúdo da opção B', '1');
    fireEvent.change(screen.getByLabelText('Unidade da opção B'), { target: { value: 'kg' } });
    expect(
      screen.getByRole('heading', { name: 'Opção B mais barata por quantidade' }),
    ).toBeInTheDocument();
    fill('Conteúdo da opção B', '0');
    expect(
      screen.queryByRole('heading', { name: 'Opção B mais barata por quantidade' }),
    ).not.toBeInTheDocument();
    fireEvent.blur(screen.getByLabelText('Conteúdo da opção B'));
    expect(screen.getByLabelText('Conteúdo da opção B')).toHaveAttribute('aria-invalid', 'true');
    fill('Conteúdo da opção B', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Volume' }));
    expect(screen.getByLabelText('Preço da opção A (R$)')).toHaveValue('');
    fireEvent.click(screen.getByRole('button', { name: 'Peso' }));
    expect(screen.getByLabelText('Preço da opção A (R$)')).toHaveValue('10,90');
    fireEvent.click(screen.getByRole('button', { name: 'Fechar comparador' }));
    expect(screen.getByRole('button', { name: 'Comparar' })).toHaveFocus();
    open();
    expect(screen.getByLabelText('Preço da opção B (R$)')).toHaveValue('19,90');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar comparação' }));
    expect(screen.getByLabelText('Preço da opção A (R$)')).toHaveValue('');
    expect(screen.getByLabelText('Preço da opção A (R$)')).toHaveFocus();
  });
  it('continues in memory and explains reload limitations if session storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Blocked');
    });
    render(
      <ComparisonProvider>
        <ComparisonButton />
      </ComparisonProvider>,
    );
    open();
    expect(screen.getByText(/Uma recarga poderá apagar/)).toBeInTheDocument();
    fill('Preço da opção A (R$)', '10');
    fireEvent.click(screen.getByRole('button', { name: 'Fechar comparador' }));
    open();
    expect(screen.getByLabelText('Preço da opção A (R$)')).toHaveValue('10');
  });
});
