/**
 * The nsite gateway that serves published deck pages. A dumb pipe: any
 * NIP-5A-compatible gateway can be swapped in here without republishing —
 * the manifests and blobs live on relays and Blossom servers.
 */
export const GATEWAY_DOMAIN = 'nwb.tf';

/** Extra relays the gateway ecosystem uses to look up user data (10063 etc.). */
export const LOOKUP_RELAYS = ['wss://user.kindpag.es/', 'wss://purplepag.es/'];

import { pubkeyToBase36 } from './nsite';

/**
 * Canonical NIP-5A named-site URL: `<pubkeyB36><dTag>.<gateway>` — the deck is
 * its own named site (kind 35128), not a path on the user's root site.
 */
export function deckGatewayUrl(pubkeyHex: string, deckId: string): string {
  return `https://${pubkeyToBase36(pubkeyHex)}${deckId}.${GATEWAY_DOMAIN}/`;
}

/** Absolute in-app URL honoring the deploy base path (e.g. GitHub Pages subpath). */
export function absoluteAppUrl(path: string): string {
  return `${location.origin}${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
}

/** Profiles are delegated to an existing Nostr client instead of a custom page. */
export function profileUrl(npub: string): string {
  return `https://lumilumi.app/${npub}`;
}
