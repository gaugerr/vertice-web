import {registerSW} from 'virtual:pwa-register';
import {observeConnectivity} from './connectivity';
import {hasUnsavedChanges} from '../shared/lib/drafts';
import {waitForWrites} from '../data/database/writes';

export interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{outcome: 'accepted' | 'dismissed'}>;
}
interface PwaState {online: boolean; offlineReady: boolean; updateReady: boolean; installReady: boolean; failed: boolean}
let state: PwaState = {online: navigator.onLine, offlineReady: false, updateReady: false, installReady: false, failed: false};
const listeners = new Set<() => void>();
let prompt: InstallPrompt | undefined;
let updateSW: ((reloadPage?: boolean) => Promise<void>) | undefined;
let initialized = false;
function change(patch: Partial<PwaState>) {state = {...state, ...patch}; for (const listener of listeners) listener()}
export function subscribePwa(listener: () => void) {listeners.add(listener); return () => {listeners.delete(listener)}}
export function getPwaState() {return state}
export async function installApp(): Promise<void> {
  if (!prompt) return;
  await prompt.prompt(); await prompt.userChoice; prompt = undefined; change({installReady: false});
}
export async function applyUpdate(): Promise<void> {
  if (hasUnsavedChanges() && !window.confirm('Existem alterações não salvas. Descartar e atualizar o aplicativo?')) return;
  await waitForWrites();
  await updateSW?.(true);
}
export function initializePwa(): void {
  if (initialized) return; initialized = true;
  observeConnectivity((online) => {if (online !== state.online) change({online})});
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); prompt = event as InstallPrompt; change({installReady: true});
  });
  window.addEventListener('appinstalled', () => {prompt = undefined; change({installReady: false})});
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    updateSW = registerSW({
      immediate: true,
      onOfflineReady: () => change({offlineReady: true}),
      onNeedRefresh: () => change({updateReady: true}),
      onRegisterError: () => change({failed: true}),
      onRegisteredSW: (_url, registration) => {
        if (registration?.active) change({offlineReady: true});
        const check = () => {if (document.visibilityState === 'visible' && navigator.onLine) void registration?.update().catch(() => {})};
        window.addEventListener('focus', check);
      },
    });
    void navigator.serviceWorker.ready.then(() => {
      change({offlineReady: true});
      void navigator.storage?.persist?.().catch(() => {});
    });
  }
}
