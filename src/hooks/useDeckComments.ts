import { useQuery } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import { deckAddress, type Deck } from '@/lib/deckEvent';
import { COMMENT_KIND, parseComment, type DeckComment } from '@/lib/comment';

/**
 * Fetch flat, top-level comments on a deck. All comments in a thread carry the
 * root `A` tag, so a single `#A` query returns them; replies are filtered out.
 * Sorted oldest-first to read like a conversation.
 */
export function useDeckComments(deck: Deck | undefined) {
  const { nostr } = useNostr();
  const address = deck ? deckAddress(deck) : undefined;

  return useQuery<DeckComment[]>({
    queryKey: ['nostr', 'comments', address],
    enabled: Boolean(address),
    queryFn: async ({ signal }) => {
      const events = await nostr.query(
        [{ kinds: [COMMENT_KIND], '#A': [address!] }],
        { signal: AbortSignal.any([signal, AbortSignal.timeout(4000)]) },
      );

      return events
        .map((event) => parseComment(event, address!))
        .filter((comment): comment is DeckComment => comment !== null)
        .sort((a, b) => a.createdAt - b.createdAt);
    },
  });
}
