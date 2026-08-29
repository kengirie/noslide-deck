import { useEffect } from 'react';
import { useNostr } from '@nostrify/react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAppContext } from '@/hooks/useAppContext';
import { parseBlossomServerList } from '@/lib/appBlossom';

/**
 * NostrSync - Syncs user's Nostr data
 *
 * This component runs globally to sync various Nostr data when the user logs in.
 * Currently syncs:
 * - BUD-03 Blossom server list (kind 10063)
 *
 * Note: the NIP-65 relay list (kind 10002) is intentionally NOT synced. The app
 * uses a fixed relay set (see APP_RELAYS) so a deck's read and write relays stay
 * identical; letting a user's personal NIP-65 override that reintroduced the
 * "logged-out viewer can't load slides" mismatch. Blossom servers stay dynamic
 * because a deck manifest self-describes its blob servers.
 */
export function NostrSync() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { config, updateConfig } = useAppContext();

  useEffect(() => {
    if (!user) return;

    const syncBlossomServersFromNostr = async () => {
      try {
        const events = await nostr.query(
          [{ kinds: [10063], authors: [user.pubkey], limit: 1 }],
          { signal: AbortSignal.timeout(5000) }
        );

        if (events.length > 0) {
          const event = events[0];

          // Only update if the event is newer than our stored data
          if (event.created_at > config.blossomServerMetadata.updatedAt) {
            const fetchedServers = parseBlossomServerList(event);

            if (fetchedServers.length > 0) {
              console.log('Syncing Blossom server list from Nostr:', fetchedServers);
              updateConfig((current) => ({
                ...current,
                blossomServerMetadata: {
                  servers: fetchedServers,
                  updatedAt: event.created_at,
                },
              }));
            }
          }
        }
      } catch (error) {
        console.error('Failed to sync Blossom servers from Nostr:', error);
      }
    };

    syncBlossomServersFromNostr();
  }, [user, config.blossomServerMetadata.updatedAt, nostr, updateConfig]);

  return null;
}
