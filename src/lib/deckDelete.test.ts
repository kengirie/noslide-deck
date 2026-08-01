import { describe, expect, it } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';
import {
  buildDeckDeleteRequest,
  collectEventHashes,
  coveredByDeletion,
  deletableHashes,
} from './deckDelete';

const PUBKEY = 'a'.repeat(64);
const H_PDF = '1'.repeat(64);
const H_PAGE1 = '2'.repeat(64);
const H_PAGE2 = '3'.repeat(64);
const H_THUMB = '4'.repeat(64);
const H_HTML = '5'.repeat(64);
const H_AGG = '6'.repeat(64);

function deckEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: 'e'.repeat(64),
    pubkey: PUBKEY,
    created_at: 1700000000,
    kind: 35891,
    content: '',
    sig: '',
    tags: [
      ['d', 'my-deck'],
      ['title', 'My deck'],
      ['image', `https://blossom.example/${H_THUMB}.jpg`],
      ['url', `https://blossom.example/${H_PDF}.pdf`],
      ['x', H_PDF],
      ['m', 'application/pdf'],
      ['imeta', `url https://blossom.example/${H_PAGE1}.webp`, `x ${H_PAGE1}`, 'm image/webp'],
      ['imeta', `url https://blossom.example/${H_PAGE2}.webp`, `x ${H_PAGE2}`, 'm image/webp'],
    ],
    ...overrides,
  };
}

function manifestEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: 'f'.repeat(64),
    pubkey: PUBKEY,
    created_at: 1700000100,
    kind: 35128,
    content: '',
    sig: '',
    tags: [
      ['d', 'my-deck'],
      ['path', '/index.html', H_HTML],
      ['path', '/thumb.jpg', H_THUMB],
      ['path', '/pages/001.webp', H_PAGE1],
      ['x', H_AGG, 'aggregate'],
      ['server', 'https://blossom.example/'],
    ],
    ...overrides,
  };
}

describe('buildDeckDeleteRequest', () => {
  it('references both the deck and its named-site manifest by address', () => {
    const template = buildDeckDeleteRequest({
      pubkey: PUBKEY,
      identifier: 'my-deck',
      latestCreatedAt: 1700000100,
    });
    expect(template.kind).toBe(5);
    expect(template.tags).toContainEqual(['a', `35891:${PUBKEY}:my-deck`]);
    expect(template.tags).toContainEqual(['a', `35128:${PUBKEY}:my-deck`]);
    expect(template.tags).toContainEqual(['k', '35891']);
    expect(template.tags).toContainEqual(['k', '35128']);
  });

  it('timestamps strictly after the newest deleted event, even with clock skew', () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const template = buildDeckDeleteRequest({
      pubkey: PUBKEY,
      identifier: 'my-deck',
      latestCreatedAt: future,
    });
    expect(template.created_at).toBeGreaterThan(future);
  });

  it('carries an optional human-readable reason', () => {
    const template = buildDeckDeleteRequest({
      pubkey: PUBKEY,
      identifier: 'my-deck',
      latestCreatedAt: 0,
      reason: 'obsolete',
    });
    expect(template.content).toBe('obsolete');
  });
});

describe('collectEventHashes', () => {
  it('collects pdf, pages, and thumbnail hashes from a deck event', () => {
    const hashes = collectEventHashes(deckEvent());
    expect(hashes).toEqual(new Set([H_PDF, H_PAGE1, H_PAGE2, H_THUMB]));
  });

  it('collects path hashes from a manifest but not the aggregate x tag', () => {
    const hashes = collectEventHashes(manifestEvent());
    expect(hashes).toEqual(new Set([H_HTML, H_THUMB, H_PAGE1]));
    expect(hashes.has(H_AGG)).toBe(false);
  });

  it('ignores malformed hashes', () => {
    const hashes = collectEventHashes(deckEvent({
      tags: [
        ['x', 'nothex'],
        ['path', '/index.html', 'short'],
        ['url', 'https://blossom.example/not-a-hash.pdf'],
      ],
    }));
    expect(hashes.size).toBe(0);
  });
});

describe('coveredByDeletion', () => {
  const deletion = (overrides: Partial<NostrEvent> = {}): NostrEvent => ({
    id: 'd'.repeat(64),
    pubkey: PUBKEY,
    created_at: 1700000001,
    kind: 5,
    content: '',
    sig: '',
    tags: [['a', `35891:${PUBKEY}:my-deck`]],
    ...overrides,
  });

  it('hides a deck whose address is covered by the author', () => {
    expect(coveredByDeletion(deckEvent(), [deletion()])).toBe(true);
  });

  it('ignores deletion requests from other pubkeys', () => {
    expect(coveredByDeletion(deckEvent(), [deletion({ pubkey: 'b'.repeat(64) })])).toBe(false);
  });

  it('ignores deletion requests older than the deck version', () => {
    expect(coveredByDeletion(deckEvent(), [deletion({ created_at: 1600000000 })])).toBe(false);
  });

  it('ignores deletion requests for other addresses', () => {
    expect(
      coveredByDeletion(deckEvent(), [deletion({ tags: [['a', `35891:${PUBKEY}:other`]] })]),
    ).toBe(false);
  });
});

describe('deletableHashes', () => {
  it('unions target hashes and sorts them', () => {
    const hashes = deletableHashes([deckEvent(), manifestEvent()], []);
    expect(hashes).toEqual([H_PDF, H_PAGE1, H_PAGE2, H_THUMB, H_HTML].sort());
  });

  it('spares blobs still referenced by the surviving decks', () => {
    const otherDeck = deckEvent({
      tags: [
        ['d', 'other-deck'],
        ['url', `https://blossom.example/${H_PDF}.pdf`],
        ['x', H_PDF],
        ['imeta', `url https://blossom.example/${H_PAGE1}.webp`, `x ${H_PAGE1}`],
      ],
    });
    const hashes = deletableHashes([deckEvent(), manifestEvent()], [otherDeck]);
    expect(hashes).not.toContain(H_PDF);
    expect(hashes).not.toContain(H_PAGE1);
    expect(hashes).toEqual([H_PAGE2, H_THUMB, H_HTML].sort());
  });
});
