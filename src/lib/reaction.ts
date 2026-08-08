import type { NostrEvent } from '@nostrify/nostrify';
import { DECK_KIND, deckAddress, type Deck } from './deckEvent';

/** NIP-25 reaction event. */
export const REACTION_KIND = 7;

/**
 * A "like" per NIP-25: content is "+" or an empty string. Emoji reactions are
 * intentionally not counted as likes here — the MVP tracks a single like only.
 */
export function isLike(event: NostrEvent): boolean {
  const content = event.content.trim();
  return content === '' || content === '+';
}

/** Build a NIP-25 like (kind 7) targeting an addressable deck event. */
export function buildLikeEvent(deck: Deck): { kind: number; content: string; tags: string[][] } {
  return {
    kind: REACTION_KIND,
    content: '+',
    tags: [
      // The reacted event id is required; addressable coordinate is added too so
      // likes survive deck replacements (which change the id but not the address).
      ['e', deck.event.id, '', deck.pubkey],
      ['a', deckAddress(deck)],
      ['p', deck.pubkey],
      ['k', String(DECK_KIND)],
    ],
  };
}
