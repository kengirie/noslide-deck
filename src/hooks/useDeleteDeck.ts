import { useCallback, useState } from 'react';
import { useNostr } from '@nostrify/react';
import { useQueryClient } from '@tanstack/react-query';
import type { NostrEvent } from '@nostrify/nostrify';
import { getEffectiveBlossomServers } from '@/lib/appBlossom';
import { deleteFromServers } from '@/lib/blossomMulti';
import { buildDeckDeleteRequest, deletableHashes } from '@/lib/deckDelete';
import { DECK_KIND, type Deck } from '@/lib/deckEvent';
import { NAMED_SITE_KIND } from '@/lib/nsite';
import { LOOKUP_RELAYS } from '@/lib/siteConfig';
import { useAppContext } from './useAppContext';
import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';

interface DeleteState {
  step: 'idle' | 'collecting' | 'requesting' | 'purging' | 'done' | 'error';
  purged: number;
  totalBlobs: number;
  /** Hashes that no server would delete (deck events are gone regardless) */
  failedHashes: string[];
  error: string | null;
}

const IDLE: DeleteState = {
  step: 'idle',
  purged: 0,
  totalBlobs: 0,
  failedHashes: [],
  error: null,
};

/**
 * Deletes a deck: NIP-09 request for the deck event + named-site manifest,
 * then best-effort BUD-12 blob deletion. Two signatures total (kind 5 and one
 * multi-hash delete token). Blobs shared with the author's other decks are
 * spared — Blossom is content-addressed, so deleting them would break those.
 */
export function useDeleteDeck() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { config } = useAppContext();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const queryClient = useQueryClient();
  const [state, setState] = useState<DeleteState>(IDLE);

  const reset = useCallback(() => setState(IDLE), []);

  const deleteDeck = useCallback(
    async (deck: Deck): Promise<{ ok: boolean; failedBlobs: number }> => {
      if (!user || user.pubkey !== deck.pubkey) return { ok: false, failedBlobs: 0 };

      setState({ ...IDLE, step: 'collecting' });
      try {
        // Everything the author has published: the doomed pair (same `d`) and
        // the surviving decks whose blobs must not be touched. Relay failures
        // here fall back to "nothing else exists" — an unreachable relay
        // shouldn't block a deletion the user asked for, and cross-deck blob
        // sharing is the rare case.
        let manifest: NostrEvent | undefined;
        const keep: NostrEvent[] = [];
        try {
          const events = await nostr.query(
            [{ kinds: [DECK_KIND, NAMED_SITE_KIND], authors: [user.pubkey], limit: 200 }],
            { signal: AbortSignal.timeout(5000) },
          );
          for (const event of events) {
            const d = event.tags.find(([name]) => name === 'd')?.[1];
            if (d === deck.identifier) {
              if (event.kind === NAMED_SITE_KIND) {
                if (!manifest || event.created_at > manifest.created_at) manifest = event;
              }
            } else {
              keep.push(event);
            }
          }
        } catch {
          // Proceed with what the deck event alone tells us
        }

        const targets = manifest ? [deck.event, manifest] : [deck.event];
        const hashes = deletableHashes(targets, keep);

        // The deletion request is the source of truth: once relays accept it,
        // the deck is gone from the app and the gateway stops resolving.
        setState((prev) => ({ ...prev, step: 'requesting', totalBlobs: hashes.length }));
        const deleteRequest = await publishEvent(
          buildDeckDeleteRequest({
            pubkey: user.pubkey,
            identifier: deck.identifier,
            latestCreatedAt: Math.max(deck.event.created_at, manifest?.created_at ?? 0),
          }),
        );

        // The manifest copy lives on the gateway's lookup relays too — the
        // deletion request must reach them or the share page stays resolvable.
        try {
          await nostr.event(deleteRequest, {
            relays: LOOKUP_RELAYS,
            signal: AbortSignal.timeout(5000),
          });
        } catch {
          // Lookup relays are best-effort, same as at publish time
        }

        setState((prev) => ({ ...prev, step: 'purging' }));
        const servers = getEffectiveBlossomServers(
          config.blossomServerMetadata,
          config.useAppBlossomServers,
        );
        const outcomes = await deleteFromServers({
          hashes,
          servers,
          signer: user.signer,
          reason: `Delete slide deck "${deck.title}"`,
          onProgress: (done) => setState((prev) => ({ ...prev, purged: done })),
        });

        const failedHashes = outcomes.filter((o) => !o.ok).map((o) => o.sha256);
        setState((prev) => ({ ...prev, step: 'done', failedHashes }));

        queryClient.invalidateQueries({ queryKey: ['nostr', 'deck', deck.pubkey, deck.identifier] });
        queryClient.invalidateQueries({ queryKey: ['nostr', 'deck-feed'] });
        return { ok: true, failedBlobs: failedHashes.length };
      } catch (err) {
        setState((prev) => ({
          ...prev,
          step: 'error',
          error: err instanceof Error ? err.message : String(err),
        }));
        return { ok: false, failedBlobs: 0 };
      }
    },
    [user, nostr, config.blossomServerMetadata, config.useAppBlossomServers, publishEvent, queryClient],
  );

  return { ...state, deleteDeck, reset };
}
