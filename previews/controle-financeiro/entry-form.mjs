// Regras de apresentação do formulário de lançamentos. Não gravam nada: as parcelas
// e datas exibidas usam as mesmas funções de finance-domain que saveLedgerEntry usa.
import { adjacentMonth, dueDate } from './finance-domain.mjs';

export const CREDIT_METHOD_NAME = 'Cartão de Crédito';

export function isCreditMethod(method) {
  return method?.name === CREDIT_METHOD_NAME;
}

export function paidCopy({ type, isCredit, paid }) {
  if (isCredit)
    return {
      label: 'Contar como gasto deste mês',
      hint: paid
        ? 'Compra no crédito: entra no resultado deste mês. Não há fatura a pagar.'
        : 'Fica como previsto até ser marcada.',
    };
  const income = type === 'income';
  return {
    label: income ? 'Já foi recebido' : 'Já foi pago',
    hint: paid
      ? 'Entra no resultado do mês como realizado.'
      : 'Fica como previsto até ser marcado como ' + (income ? 'recebido.' : 'pago.'),
  };
}

export function formatBRL(cents) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

const formatISO = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

// Espelha saveLedgerEntry: parcelas dividem o total (centavos extras nas primeiras),
// repetições usam o mesmo valor; a data cai no mesmo dia em cada mês.
export function seriesPreview({ amount, date, mode, count }) {
  if (mode !== 'installments' && mode !== 'repeat') return null;
  if (!Number.isInteger(amount) || amount <= 0) return null;
  if (!Number.isInteger(count) || count < 2 || count > 120) return null;
  if (mode === 'installments' && amount < count) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) return null;
  const day = Number(date.slice(8));
  let month = date.slice(0, 7);
  const amounts = [];
  const dates = [];
  for (let i = 0; i < count; i++) {
    amounts.push(
      mode === 'repeat' ? amount : Math.floor(amount / count) + (i < amount % count ? 1 : 0),
    );
    dates.push(dueDate(month, day));
    month = adjacentMonth(month, 1);
  }
  return {
    amounts,
    dates,
    first: dates[0],
    last: dates.at(-1),
    total: amounts.reduce((n, v) => n + v, 0),
  };
}

export function seriesSummary(preview, mode) {
  const { amounts, first, last, total } = preview;
  if (mode === 'repeat')
    return `${amounts.length} lançamentos de ${formatBRL(amounts[0])}, de ${formatISO(first)} a ${formatISO(last)}.`;
  const high = Math.max(...amounts);
  const low = Math.min(...amounts);
  const each =
    high === low
      ? `de ${formatBRL(high)}`
      : `de ${formatBRL(high)} nas primeiras e ${formatBRL(low)} nas demais`;
  return `${amounts.length} parcelas ${each}, de ${formatISO(first)} a ${formatISO(last)}. Total ${formatBRL(total)}.`;
}
