import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  publicDir: false,
  build: {
    outDir: root + 'dist',
    emptyOutDir: false,
    minify: true,
    lib: {
      entry: fileURLToPath(new URL('../../shared/workspaces/runtime.mjs', import.meta.url)),
      formats: ['es'],
      fileName: () => 'workspaces.js',
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
