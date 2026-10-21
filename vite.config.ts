import { loadEnv } from 'vite';
// @ts-expect-error Build validation is shared with the Node setup tooling.
import { validateAccess } from './tools/validate-access.mjs';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  validateAccess({ ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env });
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: null,
        includeAssets: ['icons/*'],
        manifest: {
          id: '/',
          name: 'Vértice · Compras com clareza',
          short_name: 'Vértice',
          description: 'Organize suas compras e acompanhe seus gastos, mesmo offline.',
          lang: 'pt-BR',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          theme_color: '#101014',
          background_color: '#101014',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: '/icons/maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          cacheId: 'vertice-web',
          clientsClaim: true,
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
          globIgnores: ['**/online.txt'],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/online\.txt$/, /\/[^/?]+\.[^/?]+$/],
          cleanupOutdatedCaches: true,
        },
        devOptions: { enabled: false },
      }),
    ],
    build: { sourcemap: false },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
    },
  };
});
