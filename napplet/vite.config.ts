import { fileURLToPath } from 'node:url';

import { defineConfig, type Plugin } from 'vite';

/**
 * NIP-5D loads a napplet as ONE self-contained /index.html injected via
 * iframe.srcdoc, so the build must fold every JS chunk and stylesheet into the
 * HTML. Done here instead of a plugin dependency to keep the artifact fully
 * under our control.
 */
function singleFile(): Plugin {
  return {
    name: 'napplet-single-file',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = bundle['index.html'];
      if (!html || html.type !== 'asset') return;
      let source = String(html.source);

      const lookup = (src: string) => bundle[src.replace(/^\.?\//, '')];

      source = source.replace(
        /<script[^>]*\ssrc="([^"]+)"[^>]*><\/script>/g,
        (tag, src: string) => {
          const chunk = lookup(src);
          if (!chunk || chunk.type !== 'chunk') return tag;
          delete bundle[chunk.fileName];
          // A literal </script> inside the code would end the inline tag early.
          const code = chunk.code.replaceAll('</script>', '<\\/script>');
          return `<script type="module">${code}</script>`;
        },
      );

      source = source.replace(
        /<link[^>]*\srel="stylesheet"[^>]*\shref="([^"]+)"[^>]*>/g,
        (tag, href: string) => {
          const asset = lookup(href);
          if (!asset || asset.type !== 'asset') return tag;
          delete bundle[asset.fileName];
          return `<style>${String(asset.source)}</style>`;
        },
      );

      html.source = source;
    },
  };
}

// Separate build for the NIP-5D viewer napplet. Kept fully independent from
// the site build; `npm run dev:napplet` / `build:napplet` point Vite here.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  server: {
    host: '::',
    port: 8081,
  },
  plugins: [singleFile()],
  build: {
    outDir: '../dist-napplet',
    emptyOutDir: true,
    target: 'es2020',
    modulePreload: false,
  },
});
