import { initialState, migrateV1, validateState } from './finance-domain.mjs';
export const STORAGE_KEY = 'vertice-finance-preview-v2';
export const LEGACY_KEY = 'vertice-finance-preview-v1';
export const BACKUP_KEY = LEGACY_KEY + '-backup';
export class FinanceStore {
  constructor(storage) {
    this.storage = storage;
    this.state = null;
  }
  load() {
    const raw = this.storage.getItem(STORAGE_KEY);
    let next;
    if (raw !== null) {
      try {
        next = validateState(JSON.parse(raw));
      } catch {
        throw Error(
          'Não foi possível ler o financeiro salvo. Nada foi apagado. Você pode baixar os dados preservados e tentar novamente.',
        );
      }
      if (!Number.isSafeInteger(next.revision) || next.revision < 0)
        throw Error('Versão financeira inválida. Os dados foram preservados.');
    } else {
      const legacy = this.storage.getItem(LEGACY_KEY);
      if (legacy !== null) {
        try {
          next = migrateV1(JSON.parse(legacy));
        } catch {
          throw Error(
            'Não foi possível converter os registros anteriores. Nada foi apagado. Baixe os dados preservados antes de corrigir o arquivo.',
          );
        }
        if (this.storage.getItem(BACKUP_KEY) === null) this.storage.setItem(BACKUP_KEY, legacy);
      } else next = initialState();
      next.revision = 0;
      validateState(next);
      this.storage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    this.state = next;
    return next;
  }
  commit(change) {
    if (!this.state) throw Error('Abra os dados financeiros antes de salvar.');
    const current = this.storage.getItem(STORAGE_KEY);
    if (current === null)
      throw Error('Os dados financeiros mudaram. Reabra o preview antes de salvar.');
    const latest = validateState(JSON.parse(current));
    if (latest.revision !== this.state.revision)
      throw Error(
        'O financeiro foi alterado em outra aba. Feche o formulário e atualize a página antes de salvar.',
      );
    const next = structuredClone(this.state);
    change(next);
    next.revision = this.state.revision + 1;
    validateState(next);
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      throw Error(
        'Não foi possível salvar no navegador. Libere espaço ou permita o armazenamento e tente novamente; o formulário foi preservado.',
      );
    }
    this.state = next;
    return next;
  }
}
