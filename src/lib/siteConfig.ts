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

/** Profiles are delegated to an existing Nostr client instead of a custom page. */
export function profileUrl(npub: string): string {
  return `https://lumilumi.app/${npub}`;
}

/** GitHub Pages deployment of the interactive app (VITE_BASE = /nostr-slide-deck/). */
export const GH_PAGES_BASE = 'https://kengirie.github.io/nostr-slide-deck';

/**
 * The interactive app is also published as a named nsite ("slides"). Its gateway
 * subdomain is `<pubkeyB36>slides`, reachable on any nsite gateway — we offer a
 * couple so a reader can pick one that's up.
 */
export const SITE_NSITE_SUBDOMAIN = '39ohbfiu1ziyvxhwqdklupc0yrc4mcgmjpfe3w6vvz1gp6wg7hslides';
export const APP_GATEWAYS = ['nsite.lol', 'nwb.tf'];

export interface AppDeckLink {
  label: string;
  url: string;
}

/**
 * Interactive-app URLs for a deck across every host, so the static share page
 * can offer "open in the app to like/comment" links. Deck route: `/<npub>/<id>`.
 */
export function appDeckUrls(npub: string, deckId: string): AppDeckLink[] {
  const path = `${npub}/${deckId}`;
  return [
    { label: 'GitHub Pages', url: `${GH_PAGES_BASE}/${path}` },
    ...APP_GATEWAYS.map((gateway) => ({
      label: gateway,
      url: `https://${SITE_NSITE_SUBDOMAIN}.${gateway}/${path}`,
    })),
  ];
}
