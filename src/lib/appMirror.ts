import type { NostrSigner } from '@nostrify/nostrify';
import { APP_GATEWAYS, siteAssetUrl } from './siteConfig';
import { sha256Hex, uploadToServers } from './blossomMulti';

/**
 * Mirroring the interactive app into a deck's own nsite (方針A).
 *
 * The app's code assets (their `path` + `sha256`) come from the canonical
 * root-base build published as the "slides" nsite — its `site-assets.json`.
 * A published deck lists those assets in its own NIP-5A manifest so the gateway
 * serves the full app from the deck's URL. Blobs are content-addressed, so a
 * deck pins whatever app version was live at publish time and keeps working
 * across later app redeploys.
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
  /** Gateway host that served the manifest; used to copy asset bytes if needed. */
  gateway: string;
}

function isSiteAssets(data: unknown): data is Omit<SiteAssets, 'gateway'> {
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

/** Fetch the app-asset manifest from the canonical "slides" nsite, trying each gateway. */
export async function fetchSiteAssets(signal?: AbortSignal): Promise<SiteAssets> {
  let lastError: unknown;
  for (const gateway of APP_GATEWAYS) {
    try {
      const response = await fetch(siteAssetUrl(gateway, '/site-assets.json'), { signal });
      if (!response.ok) {
        lastError = new Error(`${response.status} from ${gateway}`);
        continue;
      }
      // nsite gateways serve their SPA fallback (index.html, 200) for any path
      // not in the manifest, so a missing site-assets.json arrives as HTML.
      // response.json() rejects that; treat it as "app not deployed here".
      const data: unknown = await response.json().catch(() => null);
      if (isSiteAssets(data)) return { ...data, gateway };
      lastError = new Error(`No site-assets.json served by ${gateway} (is the app nsite deployed?)`);
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
 * deck's Blossom servers, so the gateway can serve the mirrored app. Assets the
 * "slides" nsite already published (the default app Blossom server) are found by
 * HEAD and skipped; anything missing is copied from the canonical nsite.
 */
export async function ensureAppAssets(opts: {
  assets: SiteAsset[];
  servers: string[];
  signer: NostrSigner;
  gateway: string;
  signal?: AbortSignal;
}): Promise<void> {
  const { assets, servers, signer, gateway, signal } = opts;
  for (const asset of assets) {
    const present = await Promise.all(servers.map((server) => blobExists(server, asset.sha256, signal)));
    if (present.some(Boolean)) continue;

    const response = await fetch(siteAssetUrl(gateway, asset.path), { signal });
    if (!response.ok) {
      throw new Error(`Failed to copy app asset ${asset.path}: ${response.status}`);
    }
    // The gateway returns its SPA fallback (index.html) for a missing asset, so
    // verify the bytes hash to the expected sha256 before mirroring — otherwise
    // we'd pin HTML under a JS/CSS path and permanently break the deck site.
    const buffer = await response.arrayBuffer();
    const actual = await sha256Hex(buffer);
    if (actual !== asset.sha256) {
      throw new Error(`App asset ${asset.path} did not match its hash (app nsite likely stale/undeployed)`);
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
