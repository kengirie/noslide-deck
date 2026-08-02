import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

// Separate build for the NIP-5D viewer napplet. Kept fully independent from
// the site build; `npm run dev:napplet` / `build:napplet` point Vite here.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  server: {
    host: '::',
    port: 8081,
  },
  build: {
    outDir: '../dist-napplet',
    emptyOutDir: true,
    target: 'es2020',
    modulePreload: false,
  },
});
