import { createBrowserRouter } from 'react-router-dom';
import Root from './Root';
import ListsPage from '../features/shopping-lists/pages/ListsPage';
import CategoriesPage from '../features/categories/pages/CategoriesPage';
import ItemsPage from '../features/items/pages/ItemsPage';
import { Missing } from '../shared/ui/Feedback';

import { RouteError } from '../shared/ui/RouteError';

export const router = createBrowserRouter([
  {
    path: '/login',
    lazy: async () => ({ Component: (await import('../access/LoginPage')).default }),
  },
  {
    path: '/auth/callback',
    lazy: async () => ({ Component: (await import('../access/CallbackPage')).default }),
  },
  {
    path: '/privacy',
    lazy: async () => ({ Component: (await import('../access/PrivacyPage')).default }),
  },
  {
    path: '/admin',
    lazy: async () => ({ Component: (await import('../access/AdminPage')).default }),
  },
  {
    path: '/',
    Component: Root,
    errorElement: <RouteError />,
    children: [
      { index: true, Component: ListsPage },
      { path: 'lists/:listId', Component: CategoriesPage },
      { path: 'lists/:listId/categories/:id', Component: ItemsPage },
      {
        path: 'settings',
        lazy: async () => ({
          Component: (await import('../features/settings/pages/SettingsPage')).default,
        }),
      },
      { path: '*', element: <Missing label="Esta página não foi encontrada." /> },
    ],
  },
]);
