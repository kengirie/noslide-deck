import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Emits `dist/site-assets.json` describing the built app's code assets so a
 * published deck can mirror the interactive app into its own nsite (方針A).
 *
 * A deck's NIP-5A named site serves this same app at its root, so it must list
 * the app's JS/CSS (+ web manifest) by `sha256` in its own manifest and boot
 * them from `<head>`. Fonts are intentionally NOT shipped (system fonts only),
 * so the mirror stays tiny — a handful of blobs, not thousands.
 *
 * Paths are normalized to root-relative ("/assets/…") regardless of the build's
 * `base`, because a deck site is always served from "/".
 */
export function siteAssetsManifest(): Plugin {
  let base = '/';
  return {
    name: 'site-assets-manifest',
    apply: 'build',
    configResolved(config) {
      base = config.base || '/';
    },
    writeBundle(outputOptions) {
      const outDir = outputOptions.dir;
      if (!outDir) return;

      const sha256Hex = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');
      const toRoot = (url: string) => (url.startsWith(base) ? '/' + url.slice(base.length) : url);

      // Entry tags Vite injected into index.html — reused verbatim in the deck head.
      const html = readFileSync(join(outDir, 'index.html'), 'utf8');
      const scripts = [...html.matchAll(/<script[^>]*\btype="module"[^>]*\bsrc="([^"]+)"/g)].map((m) =>
        toRoot(m[1]),
      );
      const styles = [...html.matchAll(/<link[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"/g)].map((m) =>
        toRoot(m[1]),
      );

      const assets: { path: string; sha256: string }[] = [];
      const addFile = (rel: string) => {
        const abs = join(outDir, rel);
        if (!existsSync(abs)) return;
        assets.push({ path: '/' + rel.replace(/^\/+/, ''), sha256: sha256Hex(readFileSync(abs)) });
      };

      // All JS/CSS chunks the app loads (entry + code-split pdf worker/chunks).
      for (const file of readdirSync(join(outDir, 'assets'))) {
        if (file.endsWith('.js') || file.endsWith('.css')) addFile(`assets/${file}`);
      }
      // PWA manifest referenced by <link rel="manifest">.
      addFile('manifest.webmanifest');

      writeFileSync(join(outDir, 'site-assets.json'), JSON.stringify({ scripts, styles, assets }));
    },
  };
}
