import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DeckPage } from '../../src/lib/deckEvent';
import { PageImageStore } from './images';

const pages: DeckPage[] = Array.from({ length: 10 }, (_, i) => ({
  url: `https://blossom.example/p${i}.webp`,
  sha256: String(i).repeat(64).slice(0, 64),
  mimeType: 'image/webp',
}));

// jsdom has no object-URL implementation; count create/revoke pairs instead.
let created: string[];
let revoked: string[];

beforeEach(() => {
  created = [];
  revoked = [];
  let n = 0;
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL(): string {
      const url = `blob:mock-${n++}`;
      created.push(url);
      return url;
    }
    static revokeObjectURL(url: string): void {
      revoked.push(url);
    }
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const fetchBlob = () => Promise.resolve(new Blob(['x']));

describe('PageImageStore', () => {
  it('caches a fetched page', async () => {
    const store = new PageImageStore(pages, fetchBlob);
    const a = await store.get(0);
    const b = await store.get(0);
    expect(a).toBe(b);
    expect(created).toHaveLength(1);
  });

  it('revokes pages outside the focus window', async () => {
    const store = new PageImageStore(pages, fetchBlob);
    const first = await store.get(0);
    await store.get(1);
    for (const i of [4, 5, 6]) await store.get(i);
    store.focus(5);
    expect(revoked).toContain(first);
    // 4, 5, 6 are within ±2 of 5 and stay alive.
    expect(revoked).toHaveLength(2);
  });

  it('revokes an in-flight page as soon as it resolves after eviction', async () => {
    let release!: (blob: Blob) => void;
    const store = new PageImageStore(pages, (page) =>
      page === pages[9]
        ? new Promise<Blob>((r) => { release = r; })
        : fetchBlob(),
    );
    const pending = store.get(9);
    store.focus(0);
    release(new Blob(['late']));
    const url = await pending;
    expect(revoked).toContain(url);
  });

  it('refetches after a failed fetch instead of caching the rejection', async () => {
    let calls = 0;
    const store = new PageImageStore(pages, () => {
      calls += 1;
      return calls === 1 ? Promise.reject(new Error('offline')) : fetchBlob();
    });
    await expect(store.get(0)).rejects.toThrow('offline');
    await expect(store.get(0)).resolves.toMatch(/^blob:mock-/);
  });

  it('rejects for an out-of-range index', async () => {
    const store = new PageImageStore(pages, fetchBlob);
    await expect(store.get(99)).rejects.toThrow('No page');
  });
});
