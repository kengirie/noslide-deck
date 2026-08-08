import type { NostrEvent } from '@nostrify/nostrify';
import { DECK_KIND, deckAddress, type Deck } from './deckEvent';

/** NIP-22 comment event. */
export const COMMENT_KIND = 1111;

/** Maximum comment length in characters. */
export const COMMENT_MAX_LENGTH = 1000;

export interface DeckComment {
  id: string;
  pubkey: string;
  content: string;
  createdAt: number;
}

/**
 * Build a NIP-22 top-level comment (kind 1111) on a deck. The root scope (upper
 * case tags) and the parent (lower case tags) both point at the deck, since a
 * top-level comment's parent is the root itself.
 */
export function buildCommentEvent(
  deck: Deck,
  content: string,
): { kind: number; content: string; tags: string[][] } {
  const address = deckAddress(deck);
  const kind = String(DECK_KIND);
  return {
    kind: COMMENT_KIND,
    content: content.trim(),
    tags: [
      ['A', address],
      ['K', kind],
      ['P', deck.pubkey],
      ['a', address],
      ['k', kind],
      ['p', deck.pubkey],
    ],
  };
}

/**
 * Parse a kind-1111 event into a flat top-level comment on this deck. Returns
 * null for replies (parent is another comment) or malformed content — events
 * are user input and must never crash the app.
 */
export function parseComment(event: NostrEvent, address: string): DeckComment | null {
  if (event.kind !== COMMENT_KIND) return null;

  const content = event.content.trim();
  if (!content) return null;

  // Belongs to this deck's thread, and its parent is the deck itself (not
  // another comment) — i.e. the parent kind is the deck kind.
  const rootAddress = event.tags.find(([name]) => name === 'A')?.[1];
  const parentKind = event.tags.find(([name]) => name === 'k')?.[1];
  if (rootAddress !== address || parentKind !== String(DECK_KIND)) return null;

  return { id: event.id, pubkey: event.pubkey, content, createdAt: event.created_at };
}
