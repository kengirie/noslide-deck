import { cpSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Serves pdf.js's bundled `cmaps/` and `standard_fonts/` so the PDF renderer can
 * decode CID-keyed (CJK) text and substitute the standard-14 fonts.
 *
 * pdf.js only ships glyphs for embedded fonts. Without these assets, a PDF whose
 * fonts are referenced-but-not-embedded — e.g. exported from Keynote/PowerPoint
 * with predefined CMaps — renders with its text dropped. Wiring `cMapUrl` and
 * `standardFontDataUrl` (see src/lib/pdfRender.ts) lets pdf.js recover that text.
 *
 * Both dirs live under `<base>pdfjs/`: served from node_modules in dev, copied
 * into the build output otherwise. Rendering only runs in the upload client, so
 * these are needed at the app origin, not in mirrored deck sites.
 */
const require = createRequire(import.meta.url);
const PKG_DIR = dirname(require.resolve('pdfjs-dist/package.json'));
const DIRS = ['cmaps', 'standard_fonts'] as const;

const CONTENT_TYPES: Record<string, string> = {
  '.bcmap': 'application/octet-stream',
  '.pfb': 'application/octet-stream',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
};

export function pdfjsAssets(): Plugin {
  return {
    name: 'pdfjs-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';
        const match = /\/pdfjs\/(cmaps|standard_fonts)\/(.+)$/.exec(url);
        if (!match) return next();
        // Reject path traversal before touching the filesystem.
        const rel = normalize(match[2]);
        if (rel.startsWith('..')) return next();
        const abs = join(PKG_DIR, match[1], rel);
        if (!abs.startsWith(join(PKG_DIR, match[1])) || !existsSync(abs)) return next();
        res.setHeader('Content-Type', CONTENT_TYPES[extname(abs)] ?? 'application/octet-stream');
        res.end(readFileSync(abs));
      });
    },
    writeBundle(outputOptions) {
      const outDir = outputOptions.dir;
      if (!outDir) return;
      for (const dir of DIRS) {
        const src = join(PKG_DIR, dir);
        if (!existsSync(src)) continue;
        const dest = join(outDir, 'pdfjs', dir);
        mkdirSync(dirname(dest), { recursive: true });
        cpSync(src, dest, { recursive: true });
      }
    },
  };
}
