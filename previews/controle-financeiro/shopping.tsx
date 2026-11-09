import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  createHashRouter,
  RouterProvider,
  Outlet,
  useBlocker,
  useLocation,
} from 'react-router-dom';
import { RepositoryProvider } from '../../src/app/repository-context';
import { ComparisonProvider } from '../../src/features/comparator/components/ComparisonProvider';
import ListsPage from '../../src/features/shopping-lists/pages/ListsPage';
import CategoriesPage from '../../src/features/categories/pages/CategoriesPage';
import ItemsPage from '../../src/features/items/pages/ItemsPage';
import { BackupPanel } from '../../src/features/backup/components/BackupPanel';
import { RouteError } from '../../src/shared/ui/RouteError';
import { BackLink } from '../../src/shared/ui/BackLink';
import { hasUnsavedChanges } from '../../src/shared/lib/drafts';
import { hasPendingWrites } from '../../src/data/database/writes';
import '../../src/styles/globals.css';
import './shopping.css';
import { openPreviewWorkspace } from '../../shared/workspaces/runtime.mjs';

async function boot() {
  // Separate origin and explicit database name: never opens the official purchases database.
  const workspace = await openPreviewWorkspace();
  const repository = workspace.shopping();
  function message(data: object) {
    window.parent.postMessage(data, window.location.origin);
  }
  function Layout() {
    const blocker = useBlocker(() => hasUnsavedChanges() || hasPendingWrites());
    const location = useLocation();
    useEffect(() => {
      if (blocker.state !== 'blocked') return;
      if (
        !hasPendingWrites() &&
        window.confirm('Descartar as alterações não salvas e sair desta tela?')
      )
        blocker.proceed();
      else blocker.reset();
    }, [blocker]);
    useEffect(() => {
      window.scrollTo(0, 0);
      message({
        type: 'vertice:shopping-route',
        label:
          location.pathname === '/'
            ? 'Minhas listas'
            : location.pathname === '/settings'
              ? 'Dados das compras'
              : location.pathname.includes('/categories/')
                ? 'Produtos'
                : 'Minha compra',
      });
    }, [location.pathname]);
    useEffect(() => {
      const beforeUnload = (event: BeforeUnloadEvent) => {
        if (hasUnsavedChanges() || hasPendingWrites()) {
          event.preventDefault();
          event.returnValue = '';
        }
      };
      window.addEventListener('beforeunload', beforeUnload);
      return () => window.removeEventListener('beforeunload', beforeUnload);
    }, []);
    return (
      <RepositoryProvider value={repository} scope={workspace.actor.uid + ':' + workspace.space.id}>
        <ComparisonProvider>
          <main className="main-content">
            <Outlet />
          </main>
        </ComparisonProvider>
      </RepositoryProvider>
    );
  }
  function PurchaseSettings() {
    return (
      <>
        <BackLink to="/">Minhas listas</BackLink>
        <div className="page-heading">
          <p className="eyebrow">DADOS DO PREVIEW</p>
          <h1>Suas compras de teste</h1>
          <p>Exporte e restaure somente as listas deste ambiente de demonstração.</p>
        </div>
        <BackupPanel />
      </>
    );
  }
  const router = createHashRouter([
    {
      path: '/',
      Component: Layout,
      errorElement: <RouteError />,
      children: [
        { index: true, Component: ListsPage },
        { path: 'lists/:listId', Component: CategoriesPage },
        { path: 'lists/:listId/categories/:id', Component: ItemsPage },
        { path: 'settings', Component: PurchaseSettings },
      ],
    },
  ]);
  Promise.resolve()
    .then(() => {
      createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />);
    })
    .catch(() => {
      document.getElementById('root')!.textContent =
        'Não foi possível abrir as compras de demonstração. Seus registros foram preservados. Tente reabrir o preview.';
    });
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin || event.source !== window.parent) return;
    if (
      event.data?.type === 'vertice:shopping-navigate' &&
      ['/', '/settings'].includes(event.data.path)
    )
      router.navigate(event.data.path);
  });

  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin || event.source !== window.parent) return;
    if (event.data?.type === 'vertice:workspace-check') {
      message({
        type: 'vertice:workspace-check-result',
        requestId: event.data.requestId,
        allowed: !hasUnsavedChanges() && !hasPendingWrites(),
      });
    }
  });
}
boot().catch((error) => {
  document.getElementById('root')!.textContent = error.message;
});
