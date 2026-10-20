import {createBrowserRouter, Link, useRouteError} from 'react-router-dom';
import App from './App';
import ListsPage from '../features/shopping-lists/pages/ListsPage';
import CategoriesPage from '../features/categories/pages/CategoriesPage';
import ItemsPage from '../features/items/pages/ItemsPage';
import {Missing} from '../shared/ui/Feedback';

function RouteError() {
  const error = useRouteError();
  console.error('Vértice:', error);
  return <main className="main-content state-panel"><h1>Não foi possível abrir esta tela</h1><p>Seus registros salvos continuam no aparelho.</p><Link className="text-link" to="/" reloadDocument>Voltar ao início</Link></main>;
}
export const router = createBrowserRouter([{
  path: '/', Component: App, errorElement: <RouteError />,
  children: [
    {index: true, Component: ListsPage},
    {path: 'lists/:listId', Component: CategoriesPage},
    {path: 'lists/:listId/categories/:id', Component: ItemsPage},
    {path: 'settings', lazy: async () => ({Component: (await import('../features/settings/pages/SettingsPage')).default})},
    {path: '*', element: <Missing label="Esta página não foi encontrada." />},
  ],
}]);
