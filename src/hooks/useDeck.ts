import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { DELETION_KIND, coveredByDeletion } from '@/lib/deckDelete';
import { DECK_KIND, parseDeckEvent, type Deck } from '@/lib/deckEvent';

/**
 * Fetch and validate a deck by author + identifier. Resolves to null when
 * missing or covered by the author's NIP-09 deletion request — some relays
 * keep deleted events, so hiding them is the client's job.
 */
export function useDeck(pubkey: string | undefined, identifier: string | undefined) {
  const { nostr } = useNostr();

  return useQuery<Deck | null>({
    queryKey: ['nostr', 'deck', pubkey, identifier],
    enabled: Boolean(pubkey && identifier),
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
