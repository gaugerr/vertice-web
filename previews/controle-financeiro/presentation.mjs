// Classificações apresentadas nas telas do financeiro. Não alteram valores nem regras de saldo.

// Limite de "perto do limite" é de apresentação: 80% do orçamento da categoria.
export function budgetStatus(used, limit) {
  if (limit == null) return { key: 'none', label: 'Sem limite' };
  if (used > limit) return { key: 'over', label: 'Acima do limite' };
  if (limit > 0 && used * 100 >= limit * 80) return { key: 'near', label: 'Perto do limite' };
  return { key: 'ok', label: 'Dentro do limite' };
}

export function budgetPercent(used, limit) {
  if (limit == null) return 0;
  if (!limit) return used ? 100 : 0;
  return Math.round((used / limit) * 100);
}

// Estado de cada lançamento em texto, para não depender só de cor.
export function paymentStatus({ type, paid, partial, credit }) {
  if (type === 'income') {
    if (paid) return { key: 'received', label: 'Recebido' };
    return partial ? { key: 'partial', label: 'Parcial' } : { key: 'pending', label: 'Previsto' };
  }
  if (paid) return credit ? { key: 'credit', label: 'No crédito' } : { key: 'paid', label: 'Pago' };
  return partial ? { key: 'partial', label: 'Parcial' } : { key: 'pending', label: 'Pendente' };
}

const WEEKDAYS = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
];
const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

// Cabeçalho de grupo por dia: "Hoje", "Ontem" ou "quinta-feira, 27 de novembro".
export function dayLabel(iso, todayIso) {
  const shift = (days) => {
    const d = new Date(todayIso + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  if (iso === todayIso) return 'Hoje';
  if (iso === shift(-1)) return 'Ontem';
  const d = new Date(iso + 'T12:00:00Z');
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]}`;
}
