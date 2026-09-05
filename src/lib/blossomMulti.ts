import type { NostrSigner } from '@nostrify/nostrify';

/**
 * Multi-server Blossom upload (BUD-02).
 *
 * Unlike BlossomUploader's Promise.any (first success wins, other outcomes
 * unknown), this uploads to every server, reports per-server results, and
 * succeeds as long as at least one server accepted the blob — the redundancy
 * story of Abstract.md depends on knowing where the file actually landed.
 */

export interface BlossomServerResult {
  server: string;
  ok: boolean;
  url?: string;
  error?: string;
}

export interface BlossomMultiResult {
  sha256: string;
  size: number;
  /** Blob URL on the first server that accepted it */
  url: string;
  results: BlossomServerResult[];
}

export class BlossomMultiError extends Error {
  results: BlossomServerResult[];

  constructor(results: BlossomServerResult[]) {
    super(`All Blossom servers rejected the upload: ${results.map((r) => `${r.server}: ${r.error}`).join('; ')}`);
    this.name = 'BlossomMultiError';
    this.results = results;
  }
}

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function encodeAuthEvent(event: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(event));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function extensionFor(type: string): string {
  if (type === 'application/pdf') return '.pdf';
  if (type === 'image/webp') return '.webp';
  if (type === 'image/png') return '.png';
  if (type === 'image/jpeg') return '.jpg';
  return '';
}

export interface UploadToServersOptions {
  blob: Blob;
  name: string;
  type: string;
  servers: string[];
  signer: NostrSigner;
  signal?: AbortSignal;
}

export async function uploadToServers(opts: UploadToServersOptions): Promise<BlossomMultiResult> {
  const { blob, name, type, servers, signer, signal } = opts;
  const buffer = await blob.arrayBuffer();
  const sha256 = await sha256Hex(buffer);
  const now = Math.floor(Date.now() / 1000);

  // One BUD-02 auth event reused for every server (same blob hash).
  // Generous expiration: large PDFs upload slowly.
  // created_at sits 60s in the past: servers with zero clock-skew tolerance
  // (e.g. blossoML) reject events even a second ahead of their own clock.
  const auth = await signer.signEvent({
    kind: 24242,
    content: `Upload ${name}`,
    created_at: now - 60,
    tags: [
      ['t', 'upload'],
      ['x', sha256],
      ['size', String(blob.size)],
      ['expiration', String(now + 600)],
    ],
  });
  const authorization = `Nostr ${encodeAuthEvent(auth)}`;

  const results: BlossomServerResult[] = await Promise.all(
    servers.map(async (server): Promise<BlossomServerResult> => {
      try {
        const response = await fetch(new URL('/upload', server), {
          method: 'PUT',
          body: blob,
          headers: { authorization, 'content-type': type },
          signal,
        });
        const text = await response.text();
        if (!response.ok) {
          return { server, ok: false, error: `${response.status} ${text.slice(0, 120)}` };
        }
        let url: string | undefined;
        try {
          const parsed: unknown = JSON.parse(text);
          if (parsed && typeof parsed === 'object' && 'url' in parsed && typeof parsed.url === 'string') {
            url = parsed.url;
          }
        } catch {
          // Some servers reply with an empty body; fall back to the canonical hash URL
        }
        return { server, ok: true, url: url ?? new URL(`/${sha256}${extensionFor(type)}`, server).toString() };
      } catch (err) {
        return { server, ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }),
  );

  const first = results.find((r) => r.ok);
  if (!first?.url) throw new BlossomMultiError(results);

  return { sha256, size: blob.size, url: first.url, results };
}

export interface BlossomDeleteResult {
  sha256: string;
  /** True when every server no longer has the blob (deleted or already gone) */
  ok: boolean;
  results: BlossomServerResult[];
}

export interface DeleteFromServersOptions {
  hashes: string[];
  servers: string[];
  signer: NostrSigner;
  /** Human-readable purpose shown by signers (BUD-11 content requirement) */
  reason: string;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}

/**
 * Multi-server Blossom delete (BUD-12). One BUD-11 auth token covers every
 * hash (multiple `x` tags make it valid for each DELETE individually), so the
 * user signs once no matter how many pages the deck has. The token is scoped
 * to our servers with `server` tags — an unscoped delete token could be
 * replayed against any server holding the same blobs.
 */
export async function deleteFromServers(opts: DeleteFromServersOptions): Promise<BlossomDeleteResult[]> {
  const { hashes, servers, signer, reason, onProgress, signal } = opts;
  if (hashes.length === 0) return [];
  const now = Math.floor(Date.now() / 1000);

  // created_at backdated 60s for the same clock-skew reason as uploadToServers
  const auth = await signer.signEvent({
    kind: 24242,
    content: reason,
    created_at: now - 60,
    tags: [
      ['t', 'delete'],
      ...hashes.map((sha256) => ['x', sha256]),
      ...servers.map((server) => ['server', new URL(server).hostname]),
      ['expiration', String(now + 600)],
    ],
  });
  const authorization = `Nostr ${encodeAuthEvent(auth)}`;

  const outcomes: BlossomDeleteResult[] = [];
  let done = 0;
  for (const sha256 of hashes) {
    const results: BlossomServerResult[] = await Promise.all(
      servers.map(async (server): Promise<BlossomServerResult> => {
        try {
          const response = await fetch(new URL(`/${sha256}`, server), {
            method: 'DELETE',
            headers: { authorization },
            signal,
          });
          // 404 means the blob is already gone — the outcome the user wanted
          if (response.ok || response.status === 404) return { server, ok: true };
          const text = await response.text();
          return { server, ok: false, error: `${response.status} ${text.slice(0, 120)}` };
        } catch (err) {
          return { server, ok: false, error: err instanceof Error ? err.message : String(err) };
        }
      }),
    );
    outcomes.push({ sha256, ok: results.every((r) => r.ok), results });
    done += 1;
    onProgress?.(done, hashes.length);
  }

  return outcomes;
}
