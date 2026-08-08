import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { deckAddress, type Deck } from '@/lib/deckEvent';
import { REACTION_KIND, isLike } from '@/lib/reaction';

export interface DeckReactions {
  /** Number of distinct pubkeys that currently like the deck. */
  count: number;
  /** Pubkeys that liked the deck, for deriving whether the viewer liked it. */
  likers: Set<string>;
}

/**
 * Count likes on a deck. Reactions are queried by the deck's addressable
 * coordinate (`#a`) so replacements don't drop older likes; each pubkey's
 * latest reaction wins.
 */
export function useDeckReactions(deck: Deck | undefined) {
  const { nostr } = useNostr();
  const address = deck ? deckAddress(deck) : undefined;

  return useQuery<DeckReactions>({
    queryKey: ['nostr', 'reactions', address],
    enabled: Boolean(address),
    queryFn: async ({ signal }) => {
      const events = await nostr.query(
        [{ kinds: [REACTION_KIND], '#a': [address!] }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(4000)]) },
      );

      const latest = new Map<string, NostrEvent>();
      for (const event of events) {
        const prev = latest.get(event.pubkey);
        if (!prev || event.created_at > prev.created_at) latest.set(event.pubkey, event);
      }

      const likers = new Set<string>();
      for (const event of latest.values()) {
        if (isLike(event)) likers.add(event.pubkey);
      }

      return { count: likers.size, likers };
    },
  });
}
