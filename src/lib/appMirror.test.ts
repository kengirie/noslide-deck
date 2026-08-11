import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSiteAssets } from './appMirror';

const VALID = {
  scripts: ['/assets/index-abc.js'],
  styles: ['/assets/index-abc.css'],
  assets: [{ path: '/assets/index-abc.js', sha256: 'a'.repeat(64) }],
};

function jsonResponse(body: unknown): Response {
  return { ok: true, json: async () => body } as unknown as Response;
}
function htmlFallback(): Response {
  return { ok: true, json: async () => JSON.parse('<!doctype html>') } as unknown as Response;
}

describe('fetchSiteAssets source selection', () => {
  afterEach(() => vi.restoreAllMocks());

  it('prefers the running app origin on a root-base build (BASE_URL="/")', async () => {
    // vitest sets import.meta.env.BASE_URL to "/", so the own-origin source wins.
    const fetchMock = vi.fn(async () => jsonResponse(VALID));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchSiteAssets();
    expect(result.assetBase).toBe(`${location.origin}/`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${location.origin}/site-assets.json`);
  });

  it('falls through to the next source when a gateway serves the SPA fallback', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(htmlFallback()) // own origin: no real manifest
      .mockResolvedValueOnce(jsonResponse(VALID)); // first gateway: real manifest
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchSiteAssets();
    expect(result.assets).toHaveLength(1);
    expect(result.assetBase).toContain('.'); // a gateway URL, not the local origin
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
