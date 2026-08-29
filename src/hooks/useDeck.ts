import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { DELETION_KIND, coveredByDeletion } from '@/lib/deckDelete';
import { DECK_KIND, parseDeckEvent, type Deck } from '@/lib/deckEvent';
import { getBakedDeckEvent } from '@/lib/siteConfig';

/**
 * Fetch and validate a deck by author + identifier. Resolves to null when
 * missing or covered by the author's NIP-09 deletion request — some relays
 * keep deleted events, so hiding them is the client's job.
 *
 * On a deck's own nsite the deck event is baked into the page, so we hydrate
 * from it instantly (no cold relay round-trip, no "not found" flash) and skip
 * the network entirely — the nsite is a pinned snapshot, so its baked deck is
 * canonical. On the normal hosts there's no baked event and this is a no-op.
 */
export function useDeck(pubkey: string | undefined, identifier: string | undefined) {
  const { nostr } = useNostr();

  const initialDeck = useMemo<Deck | undefined>(() => {
    if (!pubkey || !identifier) return undefined;
    const baked = getBakedDeckEvent();
    if (!baked || baked.pubkey !== pubkey) return undefined;
    const deck = parseDeckEvent(baked);
    return deck && deck.identifier === identifier ? deck : undefined;
  }, [pubkey, identifier]);

  return useQuery<Deck | null>({
    queryKey: ['nostr', 'deck', pubkey, identifier],
    enabled: Boolean(pubkey && identifier),
    // A baked snapshot never goes stale within the session, so it's never
    // refetched — that also keeps a flaky relay from overwriting it with null.
    ...(initialDeck ? { initialData: initialDeck, staleTime: Infinity } : {}),
    queryFn: async ({ signal }) => {
      const address = `${DECK_KIND}:${pubkey}:${identifier}`;
      const events = await nostr.query(
        [
          { kinds: [DECK_KIND], authors: [pubkey!], '#d': [identifier!], limit: 1 },
          { kinds: [DELETION_KIND], authors: [pubkey!], '#a': [address], limit: 5 },
        ],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) },
      );
      const deletions = events.filter((event) => event.kind === DELETION_KIND);
      const decks = events
        .filter((event) => event.kind === DECK_KIND && !coveredByDeletion(event, deletions))
        .map(parseDeckEvent)
        .filter((deck): deck is Deck => deck !== null)
        .sort((a, b) => b.event.created_at - a.event.created_at);
      return decks[0] ?? null;
    },
  });
}
