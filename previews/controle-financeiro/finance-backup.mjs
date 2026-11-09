import { validateState } from './finance-domain.mjs';
export const BACKUP_LIMIT = 5 * 1024 * 1024;
export function createBackup(state, exportedAt = new Date().toISOString()) {
  validateState(state);
  return JSON.stringify(
    { app: 'vertice-finance-preview', formatVersion: 1, exportedAt, state },
    null,
    2,
  );
}
export function readBackup(raw) {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > BACKUP_LIMIT)
    throw Error('Use um backup financeiro de até 5 MB.');
  let file;
  try {
    file = JSON.parse(raw, (key, value) => {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw Error('Chave inválida.');
      return value;
    });
  } catch {
    throw Error('O arquivo não é um backup JSON válido.');
  }
  if (file?.app !== 'vertice-finance-preview' || file.formatVersion !== 1)
    throw Error('Escolha um backup do financeiro do Vértice.');
  const state = validateState(file.state);
  if (!Number.isSafeInteger(state.revision) || state.revision < 0)
    throw Error('Versão de dados inválida.');
  const lists = [
    state.categories,
    state.methods,
    state.entries,
    state.fixedAccounts,
    state.goals,
    ...state.goals.map((g) => g.contributions || []),
  ];
  for (const list of lists)
    for (const x of list)
      if (
        !/^[\p{L}\p{N}_.:-]{1,200}$/u.test(x.id) ||
        ['__proto__', 'constructor', 'prototype'].includes(x.id)
      )
        throw Error('Identificador inválido no backup.');
  for (const c of state.categories)
    if (c.color !== undefined && !/^#[a-f0-9]{3,8}$/i.test(c.color))
      throw Error('Cor de categoria inválida.');
  return state;
}
