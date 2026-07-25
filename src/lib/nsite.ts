import { sha256Hex } from './blossomMulti';

/**
 * NIP-5A named site manifest (kind 35128, addressable by `d`).
 *
 * Each deck is its own named site: the `d` tag is the deck identifier and the
 * site is served at `https://<pubkeyB36><d>.<gateway>/`. This keeps the user's
 * root nsite (kind 15128) untouched and makes a deck's mirror independently
 * replaceable.
 */
export const NAMED_SITE_KIND = 35128;
/** BUD-03 Blossom server list — nsite gateways use it to locate blobs. */
export const BLOSSOM_SERVER_LIST_KIND = 10063;

export interface SitePath {
  /** Absolute path within the site, e.g. "/index.html" */
  path: string;
  sha256: string;
}

/** NIP-5A aggregate hash: sorted "<hash> <path>\n" lines, SHA-256, lowercase hex. */
export async function aggregateHash(paths: SitePath[]): Promise<string> {
  const bytes = new TextEncoder().encode(
    paths
      .map(({ path, sha256 }) => `${sha256} ${path}\n`)
      .sort()
      .join(''),
  );
  return sha256Hex(bytes.buffer as ArrayBuffer);
}

/**
 * Base36 (lowercase, no padding beyond the fixed width) encoding of a 32-byte
 * hex pubkey. NIP-5A: "always exactly 50 characters".
 */
export function pubkeyToBase36(pubkeyHex: string): string {
  if (!/^[0-9a-f]{64}$/.test(pubkeyHex)) {
    throw new Error(`Invalid pubkey hex: ${pubkeyHex}`);
  }
  const digits = '0123456789abcdefghijklmnopqrstuvwxyz';
  let n = BigInt('0x' + pubkeyHex);
  let out = '';
  while (n > 0n) {
    out = digits[Number(n % 36n)] + out;
    n /= 36n;
  }
  return out.padStart(50, '0');
}

export interface SiteManifestTemplate {
  kind: number;
  content: string;
  tags: string[][];
}

/** Build a named-site manifest for a deck. Replaces any previous site with the same `d`. */
export async function buildNamedSiteManifest(opts: {
  identifier: string;
  paths: SitePath[];
  servers: string[];
  title?: string;
  description?: string;
}): Promise<SiteManifestTemplate> {
  const { identifier, paths, servers, title, description } = opts;
  // Named-site `d` rule: ^[a-z0-9-]{1,13}$ and must not end with '-'
  if (!/^[a-z0-9-]{1,13}$/.test(identifier) || identifier.endsWith('-')) {
    throw new Error(`Invalid named-site identifier: ${identifier}`);
  }
  if (paths.length === 0) throw new Error('A site manifest needs at least one path');

  const tags: string[][] = [
    ['d', identifier],
    ...paths.map(({ path, sha256 }) => ['path', path, sha256]),
    ['x', await aggregateHash(paths), 'aggregate'],
    ...servers.map((url) => ['server', url]),
  ];
  if (title) tags.push(['title', title]);
  if (description) tags.push(['description', description]);

  return { kind: NAMED_SITE_KIND, content: '', tags };
}

/** BUD-03 server list template for users who don't have one yet. */
export function buildServerList(servers: string[]): SiteManifestTemplate {
  return {
    kind: BLOSSOM_SERVER_LIST_KIND,
    content: '',
    tags: servers.map((url) => ['server', url]),
  };
}
