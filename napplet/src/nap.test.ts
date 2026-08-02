import { afterEach, describe, expect, it, vi } from 'vitest';

import { createBridge } from './nap';
import { makeDeckEvent } from './test-fixtures';

afterEach(() => {
  delete (window as { napplet?: unknown }).napplet;
  vi.restoreAllMocks();
});

describe('createBridge', () => {
  it('reports missing core when the shell provides no domains', () => {
    expect(createBridge().hasCore).toBe(false);
  });

  it('normalizes { events: [{ event }] } query results', async () => {
    const event = makeDeckEvent();
    window.napplet = {
      outbox: { query: async () => ({ events: [{ event }] }) },
      resource: { bytes: async () => new Blob() },
    };
    const bridge = createBridge();
    expect(bridge.hasCore).toBe(true);
    expect(await bridge.query([{ kinds: [35891] }])).toEqual([event]);
  });

  it('normalizes bare-array query results and drops junk items', async () => {
    const event = makeDeckEvent();
    window.napplet = {
      outbox: {
        query: async () => [event, null, 'noise', { event: undefined }] as unknown as NapEventResult[],
      },
      resource: { bytes: async () => new Blob() },
    };
    expect(await createBridge().query([{ kinds: [35891] }])).toEqual([event]);
  });

  it('rejects when the shell never answers', async () => {
    vi.useFakeTimers();
    window.napplet = {
      outbox: { query: () => new Promise(() => {}) },
      resource: { bytes: async () => new Blob() },
    };
    const promise = createBridge().query([{ kinds: [35891] }], { timeoutMs: 50 }).catch((e) => e);
    await vi.advanceTimersByTimeAsync(3000);
    expect(await promise).toBeInstanceOf(Error);
    vi.useRealTimers();
  });

  it('falls back to the https URL when the blossom scheme is rejected', async () => {
    const bytes = vi.fn(async (url: string) => {
      if (url.startsWith('blossom:')) throw new Error('unsupported scheme');
      return new Blob(['img']);
    });
    window.napplet = {
      outbox: { query: async () => ({ events: [] }) },
      resource: { bytes },
    };
    const blob = await createBridge().fetchPageBlob({
      url: 'https://blossom.example/p1.webp',
      sha256: '1'.repeat(64),
    });
    expect(blob.size).toBeGreaterThan(0);
    expect(bytes).toHaveBeenCalledWith('blossom:sha256:' + '1'.repeat(64));
    expect(bytes).toHaveBeenCalledWith('https://blossom.example/p1.webp');
  });

  it('survives a shell whose optional domains are absent', () => {
    window.napplet = {
      outbox: { query: async () => ({ events: [] }) },
      resource: { bytes: async () => new Blob() },
    };
    const bridge = createBridge();
    expect(bridge.openLink).toBeUndefined();
    // Neither of these may throw without inc/theme.
    bridge.onOpenIntent(() => {});
    bridge.applyTheme(() => {});
  });
});
