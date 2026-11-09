import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  root,
  base: '/shopping/',
  plugins: [react(), tailwindcss()],
  publicDir: false,
  define: {
    'import.meta.env.VITE_ACCESS_MODE': JSON.stringify('legacy'),
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(''),
    'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(''),
  },
  build: {
    outDir: root + 'dist/shopping',
    emptyOutDir: true,
    rollupOptions: { input: root + 'shopping.html' },
  },
});
