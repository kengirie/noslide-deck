import type { RelayMetadata } from '@/contexts/AppContext';

/**
 * The app's fixed relay set — used for every read and write, for logged-out and
 * logged-in users alike. Deliberately NOT overridden by a user's NIP-65 (10002):
 * decks (kind 35891), reactions, and comments are scoped to this app, so pinning
 * read and write to the same relays keeps "where a deck is published" and "where
 * a viewer reads it" structurally identical. Without this, a deck written to the
 * author's personal write relays was invisible to a viewer reading the app
 * defaults — the not-logged-in "slides don't load" bug.
 *
 * Selection is data-driven (measured anonymous read+write + existing kind 35891
 * coverage): the four core relays already hold this app's decks and accept
 * unauthenticated reads/writes, so no migration is needed. purplepag.es is a
 * read-only kind-0 aggregator that backfills author profiles the core relays
 * may lack. Blossom (kind 10063) is intentionally left dynamic — a deck's
 * manifest self-describes its blob servers, so that layer has no read/write
 * mismatch to fix.
 */
export const APP_RELAYS: RelayMetadata = {
  relays: [
    { url: 'wss://nos.lol/', read: true, write: true },
    { url: 'wss://nostr.mom/', read: true, write: true },
    { url: 'wss://relay.ditto.pub/', read: true, write: true },
    { url: 'wss://relay.dreamith.to/', read: true, write: true },
    // Read-only kind-0 aggregator: backfills author profiles, holds no decks.
    { url: 'wss://purplepag.es/', read: true, write: false },
  ],
  updatedAt: 0,
};
