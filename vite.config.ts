import path from "node:path";

import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

import { pdfjsAssets } from "./vite-plugin-pdfjs-assets";
import { siteAssetsManifest } from "./vite-plugin-site-assets";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  // GitHub Pages serves the app under /<repo>/; CI sets VITE_BASE accordingly
  base: process.env.VITE_BASE ?? "/",
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    tailwindcss(),
    pdfjsAssets(),
    siteAssetsManifest(),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/{vite,eslint}.config.*',
      '.agents/**',
    ],
    onConsoleLog(log) {
      return !log.includes("React Router Future Flag Warning");
    },
    env: {
      DEBUG_PRINT_LIMIT: '0', // Suppress DOM output that exceeds AI context windows
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));