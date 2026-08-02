import type { NostrEvent } from '@nostrify/nostrify';
import { buildDeckEvent } from '../../src/lib/deckEvent';

export const FIXTURE_PUBKEY = 'a'.repeat(64);
export const FIXTURE_IDENTIFIER = 'fixture-deck';

export function makeDeckEvent(overrides?: Partial<NostrEvent>): NostrEvent {
  const template = buildDeckEvent({
    identifier: FIXTURE_IDENTIFIER,
    title: 'Fixture deck',
    summary: 'A deck for tests.',
    pdf: { url: 'https://blossom.example/deck.pdf', sha256: 'b'.repeat(64), size: 1000 },
    pages: [
      { url: 'https://blossom.example/p1.webp', sha256: '1'.repeat(64), width: 1600, height: 900 },
      { url: 'https://blossom.example/p2.webp', sha256: '2'.repeat(64), width: 1600, height: 900 },
    ],
  });
  return {
    ...template,
    id: 'c'.repeat(64),
    pubkey: FIXTURE_PUBKEY,
    created_at: 1_700_000_000,
    sig: 'd'.repeat(64),
    ...overrides,
  };
}
