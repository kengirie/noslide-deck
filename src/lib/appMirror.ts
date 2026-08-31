import type { NostrSigner } from '@nostrify/nostrify';
import { APP_GATEWAYS, siteAssetUrl } from './siteConfig';
import { sha256Hex, uploadToServers } from './blossomMulti';

/**
 * Mirroring the interactive app into a deck's own nsite (方針A).
 *
 * A deck site serves the app from its root, so it needs a ROOT-base build's code
 * assets (their `path` + `sha256`). Two sources, in order:
 *   1. The running app itself, when it is a root-base build (`BASE_URL === '/'`,
 *      e.g. the "slides" nsite or a local `vite preview`) — its own
 *      `site-assets.json` is same-origin and always current.
 *   2. The canonical "slides" nsite via each gateway — the fallback used when the
 *      publisher runs a sub-path build (e.g. GitHub Pages under /rostrum/,
 *      whose baked base would break routing at a deck root).
 *
 * The deck lists those assets in its own NIP-5A manifest so the gateway serves
 * the full app from the deck's URL. Blobs are content-addressed, so a deck pins
 * whatever app version was live at publish time and survives later redeploys.
 */

export interface SiteAsset {
  path: string;
  sha256: string;
}

export interface SiteAssets {
  /** App entry module scripts, e.g. "/assets/index-*.js". */
  scripts: string[];
  /** App entry stylesheets, e.g. "/assets/index-*.css". */
  styles: string[];
  /** Every code asset to mirror into the deck manifest. */
  assets: SiteAsset[];
  /** URL prefix (ends in "/") the asset bytes can be copied from if missing. */
  assetBase: string;
}

interface AssetSource {
  manifestUrl: string;
  assetBase: string;
}

/** Candidate sources for the app-asset manifest, best first. */
function assetSources(): AssetSource[] {
  const sources: AssetSource[] = [];
  // Prefer the running app when it is a root-base build — its assets already
  // suit a deck root and are same-origin (no cross-origin/deploy dependency).
  if (import.meta.env.BASE_URL === '/' && typeof location !== 'undefined') {
    const base = `${location.origin}/`;
    sources.push({ manifestUrl: `${base}site-assets.json`, assetBase: base });
  }
  for (const gateway of APP_GATEWAYS) {
    sources.push({ manifestUrl: siteAssetUrl(gateway, '/site-assets.json'), assetBase: siteAssetUrl(gateway, '/') });
  }
  return sources;
}

function isSiteAssets(data: unknown): data is Pick<SiteAssets, 'scripts' | 'styles' | 'assets'> {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    Array.isArray(d.scripts) &&
    Array.isArray(d.styles) &&
    Array.isArray(d.assets) &&
    d.assets.every(
      (a) =>
        a && typeof a === 'object' && typeof (a as SiteAsset).path === 'string' && typeof (a as SiteAsset).sha256 === 'string',
    )
  );
}

/** Load the app-asset manifest from the first source that serves a real one. */
export async function fetchSiteAssets(signal?: AbortSignal): Promise<SiteAssets> {
  let lastError: unknown;
  for (const source of assetSources()) {
    try {
      const response = await fetch(source.manifestUrl, { signal });
      if (!response.ok) {
        lastError = new Error(`${response.status} from ${source.manifestUrl}`);
        continue;
      }
      // nsite gateways serve their SPA fallback (index.html, 200) for any path
      // not in the manifest, so a missing site-assets.json arrives as HTML.
      // response.json() rejects that; treat it as "app not available here".
      const data: unknown = await response.json().catch(() => null);
      if (isSiteAssets(data)) return { ...data, assetBase: source.assetBase };
      lastError = new Error(`No site-assets.json at ${source.manifestUrl} (is a root-base app deployed?)`);
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`Could not load the app asset manifest: ${lastError instanceof Error ? lastError.message : lastError}`);
}

const CONTENT_TYPE: Record<string, string> = {
  js: 'text/javascript',
  css: 'text/css',
  webmanifest: 'application/manifest+json',
};

async function blobExists(server: string, sha256: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(new URL(`/${sha256}`, server), { method: 'HEAD', signal });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Ensure each app asset is retrievable by `sha256` from at least one of the
 * deck's Blossom servers, so the gateway can serve the mirrored app. Assets
 * already on a deck server (e.g. published by the "slides" nsite) are found by
 * HEAD and skipped; anything missing is copied from `assetBase`.
 */
export async function ensureAppAssets(opts: {
  assets: SiteAsset[];
  servers: string[];
  signer: NostrSigner;
  assetBase: string;
  signal?: AbortSignal;
}): Promise<void> {
  const { assets, servers, signer, assetBase, signal } = opts;
  for (const asset of assets) {
    const present = await Promise.all(servers.map((server) => blobExists(server, asset.sha256, signal)));
    if (present.some(Boolean)) continue;

    const response = await fetch(new URL(asset.path.replace(/^\//, ''), assetBase), { signal });
    if (!response.ok) {
      throw new Error(`Failed to copy app asset ${asset.path}: ${response.status}`);
    }
    // A gateway returns its SPA fallback (index.html) for a missing asset, so
    // verify the bytes hash to the expected sha256 before mirroring — otherwise
    // we'd pin HTML under a JS/CSS path and permanently break the deck site.
    const buffer = await response.arrayBuffer();
    const actual = await sha256Hex(buffer);
    if (actual !== asset.sha256) {
      throw new Error(`App asset ${asset.path} did not match its hash (source app stale/undeployed)`);
    }
    const ext = asset.path.split('.').pop() ?? '';
    await uploadToServers({
      blob: new Blob([buffer], { type: CONTENT_TYPE[ext] ?? 'application/octet-stream' }),
      name: asset.path.split('/').pop() ?? 'asset',
      type: CONTENT_TYPE[ext] ?? 'application/octet-stream',
      servers,
      signer,
      signal,
    });
  }
}
