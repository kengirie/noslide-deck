import { useInfiniteQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { DELETION_KIND, coveredByDeletion } from '@/lib/deckDelete';
import { DECK_KIND, deckAddress, parseDeckEvent, type Deck } from '@/lib/deckEvent';

const PAGE_SIZE = 12;

/** Paginated deck feed, newest first. Pass `author` to show one pubkey's decks. */
export function useDeckFeed(author?: string) {
  const { nostr } = useNostr();

  return useInfiniteQuery({
    queryKey: ['nostr', 'deck-feed', author ?? 'global'],
    queryFn: async ({ pageParam, signal }) => {
      const filter: {
        kinds: number[];
        limit: number;
        until?: number;
        authors?: string[];
      } = { kinds: [DECK_KIND], limit: PAGE_SIZE };
      if (pageParam) filter.until = pageParam;
      if (author) filter.authors = [author];

      const events = await nostr.query([filter], {
        signal: AbortSignal.any([signal, AbortSignal.timeout(2500)]),
      });
      const decks = events
        .map(parseDeckEvent)
        .filter((deck): deck is Deck => deck !== null)
        .sort((a, b) => b.event.created_at - a.event.created_at);

      // NIP-09: relays that kept a deleted deck must not leak it into the feed
      if (decks.length > 0) {
        try {
          const deletions = await nostr.query(
            [{
              kinds: [DELETION_KIND],
              authors: [...new Set(decks.map((deck) => deck.pubkey))],
              '#a': decks.map(deckAddress),
              limit: decks.length * 2,
            }],
            { signal: AbortSignal.any([signal, AbortSignal.timeout(2500)]) },
          );
          if (deletions.length > 0) {
            return decks.filter((deck) => !coveredByDeletion(deck.event, deletions));
          }
        } catch {
          // Deletion lookup is best-effort; compliant relays already dropped them
        }
      }
      return decks;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return lastPage[lastPage.length - 1].event.created_at - 1;
    },
    initialPageParam: undefined as number | undefined,
    select: (data) => {
      // Addressable events: keep only the newest version per address
      const seen = new Map<string, Deck>();
      for (const deck of data.pages.flat()) {
        const key = deckAddress(deck);
        const prev = seen.get(key);
        if (!prev || deck.event.created_at > prev.event.created_at) seen.set(key, deck);
      }
      return [...seen.values()].sort((a, b) => b.event.created_at - a.event.created_at);
    },
  });
}
