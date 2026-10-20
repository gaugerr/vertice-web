export function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
export function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {day: '2-digit', month: 'short', year: 'numeric'})
    .format(new Date(`${value}T12:00:00`));
}
export function legacyDate(value: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) throw new Error('Data inválida no backup.');
  const year = date.getFullYear();
  if (year < 1 || year > 9999) throw new Error('Data fora do intervalo suportado.');
  return `${String(year).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
