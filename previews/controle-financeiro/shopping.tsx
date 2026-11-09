import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  createHashRouter,
  RouterProvider,
  Outlet,
  useBlocker,
  useLocation,
} from 'react-router-dom';
import { VerticeDatabase } from '../../src/data/database/database';
import { DexieShoppingRepository } from '../../src/data/repositories/dexie-shopping-repository';
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

// Separate origin and explicit database name: never opens the official purchases database.
const database = new VerticeDatabase('vertice_shopping_navigation_preview_v1');
const repository = new DexieShoppingRepository(database);
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
    <RepositoryProvider value={repository} scope="navigation-preview">
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
async function seed() {
  await database.transaction(
    'rw',
    database.lists,
    database.categories,
    database.items,
    database.migrations,
    async () => {
      if (await database.migrations.get('navigation-demo-seeded')) return;
      if (!(await database.lists.count())) {
        const ts = { createdAt: '2026-11-09T12:00:00.000Z', updatedAt: '2026-11-09T12:00:00.000Z' };
        await database.lists.put({
          id: 'week-demo',
          storeName: 'Compras da semana',
          date: '2026-11-09',
          description: 'Lista de exemplo para explorar o Vértice.',
          budgetCents: 20000,
          status: 'active',
          completedAt: null,
          purchaseDate: null,
          marketName: null,
          ...ts,
        });
        await database.categories.bulkPut([
          {
            id: 'essentials-demo',
            shoppingListId: 'week-demo',
            title: 'Essenciais',
            position: 0,
            ...ts,
          },
          {
            id: 'meat-demo',
            shoppingListId: 'week-demo',
            title: 'Carnes e Bebidas',
            position: 1,
            ...ts,
          },
          {
            id: 'produce-demo',
            shoppingListId: 'week-demo',
            title: 'Hortifruti',
            position: 2,
            ...ts,
          },
        ]);
        await database.items.bulkPut([
          {
            id: 'rice-demo',
            shoppingListId: 'week-demo',
            categoryId: 'essentials-demo',
            name: 'Arroz',
            unitPrice: '24.90',
            quantity: '1',
            unit: 'un',
            isPurchased: true,
            brand: null,
            packageContent: { amount: '5', unit: 'kg' },
            ...ts,
          },
          {
            id: 'coffee-demo',
            shoppingListId: 'week-demo',
            categoryId: 'essentials-demo',
            name: 'Café',
            unitPrice: '18.90',
            quantity: '1',
            unit: 'un',
            isPurchased: false,
            brand: null,
            packageContent: { amount: '500', unit: 'g' },
            ...ts,
          },
          {
            id: 'beans-demo',
            shoppingListId: 'week-demo',
            categoryId: 'essentials-demo',
            name: 'Feijão',
            unitPrice: '8.99',
            quantity: '2',
            unit: 'un',
            isPurchased: true,
            brand: null,
            packageContent: { amount: '1', unit: 'kg' },
            ...ts,
          },
          {
            id: 'chicken-demo',
            shoppingListId: 'week-demo',
            categoryId: 'meat-demo',
            name: 'Peito de frango',
            unitPrice: '19.90',
            quantity: '1',
            unit: 'kg',
            isPurchased: false,
            brand: null,
            packageContent: null,
            ...ts,
          },
          {
            id: 'banana-demo',
            shoppingListId: 'week-demo',
            categoryId: 'produce-demo',
            name: 'Banana',
            unitPrice: '5.99',
            quantity: '1',
            unit: 'kg',
            isPurchased: false,
            brand: null,
            packageContent: null,
            ...ts,
          },
        ]);
      }
      await database.migrations.put({
        id: 'navigation-demo-seeded',
        owner: 'preview',
        digest: '1',
      });
    },
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
seed()
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
