import { lazy, Suspense } from 'react';
import { accessConfig } from '../../../access/config';
const AccountPanel = lazy(() => import('../../../access/AccountPanel'));
import { HardDrive, Smartphone } from 'lucide-react';
import { BackupPanel } from '../../backup/components/BackupPanel';
import { InstallButton } from '../../../pwa/components/InstallButton';
import { BackLink } from '../../../shared/ui/BackLink';

export default function SettingsPage() {
  return (
    <>
      <BackLink to="/">Minhas listas</BackLink>
      <div className="page-heading">
        <p className="eyebrow">Vértice</p>
        <h1>Dados e aplicativo</h1>
        <p>Controle suas compras e as suas informações.</p>
      </div>
      {accessConfig.enforced && (
        <Suspense fallback={<p>Carregando conta…</p>}>
          <AccountPanel />
        </Suspense>
      )}
      <BackupPanel />
      <section className="settings-card">
        <div className="settings-icon">
          <HardDrive size={24} aria-hidden="true" />
        </div>
        <h2>Salvo neste aparelho</h2>
        <p>
          Suas listas ficam no armazenamento deste navegador. Limpar os dados do site pode apagar os
          registros. Mantenha um backup atualizado.
        </p>
        <p className="field-help">Ainda não há sincronização das compras entre aparelhos.</p>
      </section>
      <section className="settings-card">
        <div className="settings-icon">
          <Smartphone size={24} aria-hidden="true" />
        </div>
        <h2>Seu app de compras, sempre por perto</h2>
        <p>
          Abra com internet uma vez e aguarde “Pronto para usar offline”. Depois, use suas listas
          mesmo sem conexão.
        </p>
        <InstallButton />
        <p className="field-help">
          No iPhone: Compartilhar → Adicionar à Tela de Início. No Chrome: menu → Instalar
          aplicativo ou Adicionar à tela inicial.
        </p>
      </section>
      <p className="version-label">Vértice · versão 0.1.0</p>
    </>
  );
}
