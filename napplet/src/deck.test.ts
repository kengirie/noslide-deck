import { describe, expect, it } from 'vitest';
import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';

import { loadDeckByAddress, loadDeckFromEvent } from './deck';
import type { NapBridge } from './nap';
import { FIXTURE_IDENTIFIER, FIXTURE_PUBKEY, makeDeckEvent } from './test-fixtures';

function fakeBridge(byKind: Record<number, NostrEvent[]>): NapBridge {
  return {
    hasCore: true,
    async query(filters: NostrFilter[]) {
      return filters.flatMap((f) => (f.kinds ?? []).flatMap((k) => byKind[k] ?? []));
    },
    fetchPageBlob: () => Promise.reject(new Error('unused')),
    onOpenIntent: () => {},
    applyTheme: () => {},
  };
}

describe('loadDeckByAddress', () => {
  it('loads and parses a live deck', async () => {
    const bridge = fakeBridge({ 35891: [makeDeckEvent()] });
    const result = await loadDeckByAddress(bridge, FIXTURE_PUBKEY, FIXTURE_IDENTIFIER);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.deck.title).toBe('Fixture deck');
      expect(result.deck.pages).toHaveLength(2);
    }
  });

  it('reports not-found when relays return nothing', async () => {
    const bridge = fakeBridge({ 35891: [] });
    const result = await loadDeckByAddress(bridge, FIXTURE_PUBKEY, FIXTURE_IDENTIFIER);
    expect(result.status).toBe('not-found');
  });

  it('ignores events from other authors or identifiers', async () => {
    const wrongAuthor = makeDeckEvent({ pubkey: 'f'.repeat(64) });
    const bridge = fakeBridge({ 35891: [wrongAuthor] });
    const result = await loadDeckByAddress(bridge, FIXTURE_PUBKEY, FIXTURE_IDENTIFIER);
    expect(result.status).toBe('not-found');
  });

  it('reports deleted when a newer kind 5 targets the deck address', async () => {
    const deck = makeDeckEvent();
    const deletion: NostrEvent = {
      id: '9'.repeat(64),
      pubkey: FIXTURE_PUBKEY,
      kind: 5,
      created_at: deck.created_at + 10,
      content: '',
      tags: [['a', `35891:${FIXTURE_PUBKEY}:${FIXTURE_IDENTIFIER}`]],
      sig: 'd'.repeat(64),
    };
    const bridge = fakeBridge({ 35891: [deck], 5: [deletion] });
    const result = await loadDeckByAddress(bridge, FIXTURE_PUBKEY, FIXTURE_IDENTIFIER);
    expect(result.status).toBe('deleted');
  });

  it('treats a re-published deck as alive despite an older deletion', async () => {
    const deck = makeDeckEvent();
    const deletion: NostrEvent = {
      id: '9'.repeat(64),
      pubkey: FIXTURE_PUBKEY,
      kind: 5,
      created_at: deck.created_at - 10,
      content: '',
      tags: [['a', `35891:${FIXTURE_PUBKEY}:${FIXTURE_IDENTIFIER}`]],
      sig: 'd'.repeat(64),
    };
    const bridge = fakeBridge({ 35891: [deck], 5: [deletion] });
    const result = await loadDeckByAddress(bridge, FIXTURE_PUBKEY, FIXTURE_IDENTIFIER);
    expect(result.status).toBe('ok');
  });
});

describe('loadDeckFromEvent', () => {
  it('reports malformed for an unparsable event', async () => {
    const broken = makeDeckEvent({ tags: [['d', FIXTURE_IDENTIFIER]] });
    const result = await loadDeckFromEvent(fakeBridge({}), broken);
    expect(result.status).toBe('malformed');
  });
});
