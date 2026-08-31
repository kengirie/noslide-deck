/**
 * The nsite gateway that serves published deck pages. A dumb pipe: any
 * NIP-5A-compatible gateway can be swapped in here without republishing —
 * the manifests and blobs live on relays and Blossom servers.
 */
export const GATEWAY_DOMAIN = 'nwb.tf';

/** Extra relays the gateway ecosystem uses to look up user data (10063 etc.). */
export const LOOKUP_RELAYS = ['wss://user.kindpag.es/', 'wss://purplepag.es/'];

import type { NostrEvent } from '@nostrify/nostrify';
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

/** GitHub Pages deployment of the interactive app (VITE_BASE = /rostrum/). */
export const GH_PAGES_BASE = 'https://kengirie.github.io/rostrum';

/**
 * The interactive app is also published as a named nsite ("slides"). Its gateway
 * subdomain is `<pubkeyB36>slides`, reachable on any nsite gateway — we offer a
 * couple so a reader can pick one that's up.
 */
export const SITE_NSITE_SUBDOMAIN = '39ohbfiu1ziyvxhwqdklupc0yrc4mcgmjpfe3w6vvz1gp6wg7hslides';
export const APP_GATEWAYS = ['nsite.lol', 'nwb.tf'];

/**
 * Absolute URL of a mirrored app asset (or the `site-assets.json` index itself)
 * on the canonical "slides" nsite. A published deck mirrors the interactive app
 * into its own nsite (方針A) using the app's code assets from that root-base
 * build. Callers try each of `APP_GATEWAYS` in turn since any one may be down.
 */
export function siteAssetUrl(gateway: string, path: string): string {
  return `https://${SITE_NSITE_SUBDOMAIN}.${gateway}${path}`;
}

declare global {
  interface Window {
    /** Fallback injection point; the primary channel is the `deck:*` meta tags. */
    __DECK__?: { npub: string; deckId: string };
  }
}

/**
 * When the app is served from a deck's own nsite (方針A), its baked index.html
 * tags the deck via `<meta name="deck:npub|deck:id">` so the SPA opens that deck
 * at the site root instead of the home/upload page. Meta tags are used (not an
 * inline script) so the app's strict CSP (`script-src 'self'`) can stay in
 * force on the now-interactive deck page. Returns null on the normal app hosts.
 */
export function getDeckSiteTarget(): { npub: string; deckId: string } | null {
  if (typeof document !== 'undefined') {
    const npub = document.querySelector('meta[name="deck:npub"]')?.getAttribute('content');
    const deckId = document.querySelector('meta[name="deck:id"]')?.getAttribute('content');
    if (npub && deckId) return { npub, deckId };
  }
  const target = typeof window !== 'undefined' ? window.__DECK__ : undefined;
  if (target && typeof target.npub === 'string' && typeof target.deckId === 'string') {
    return target;
  }
  return null;
}

/**
 * The signed deck event (kind 35891) baked into a deck nsite's index.html by
 * `renderDeckAppHtml`. Lets the app hydrate the deck instantly instead of
 * waiting on a cold relay query. Returns null on the normal app hosts (no such
 * meta) or if the baked JSON is malformed — callers then fall back to relays.
 */
export function getBakedDeckEvent(): NostrEvent | null {
  if (typeof document === 'undefined') return null;
  const raw = document.querySelector('meta[name="deck:event"]')?.getAttribute('content');
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as NostrEvent;
  } catch {
    // Malformed baked event — fall back to fetching from relays.
  }
  return null;
}

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
