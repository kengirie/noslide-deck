import type { NostrEvent } from '@nostrify/nostrify';

import { DECK_KIND, deckAddress, parseDeckEvent, type Deck } from '../../src/lib/deckEvent';
import type { NapBridge } from './nap';

export type DeckLoadResult =
  | { status: 'ok'; deck: Deck }
  | { status: 'not-found' }
  | { status: 'deleted' }
  | { status: 'malformed' };

async function isDeleted(bridge: NapBridge, deck: Deck): Promise<boolean> {
  const deletions = await bridge
    .query(
      [{ kinds: [5], authors: [deck.pubkey], '#a': [deckAddress(deck)] }],
      { authors: [deck.pubkey] },
    )
    .catch(() => [] as NostrEvent[]);
  // NIP-09 for addressable events: a deletion only covers versions published
  // up to its timestamp; a re-published deck is alive again.
  return deletions.some((d) => d.created_at >= deck.event.created_at);
}

export async function loadDeckByAddress(
  bridge: NapBridge,
  pubkey: string,
  identifier: string,
): Promise<DeckLoadResult> {
  const events = await bridge.query(
    [{ kinds: [DECK_KIND], authors: [pubkey], '#d': [identifier], limit: 1 }],
    { authors: [pubkey] },
  );
  const candidates = events
    .filter((e) => e.kind === DECK_KIND && e.pubkey === pubkey)
    .filter((e) => e.tags.some(([name, value]) => name === 'd' && value === identifier))
    .sort((a, b) => b.created_at - a.created_at);
  if (candidates.length === 0) return { status: 'not-found' };
  return loadDeckFromEvent(bridge, candidates[0]);
}

export async function loadDeckFromEvent(
  bridge: NapBridge,
  event: NostrEvent,
): Promise<DeckLoadResult> {
  const deck = parseDeckEvent(event);
  if (!deck) return { status: 'malformed' };
  if (await isDeleted(bridge, deck)) return { status: 'deleted' };
  return { status: 'ok', deck };
}
