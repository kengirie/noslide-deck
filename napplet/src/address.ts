import type { NostrEvent } from '@nostrify/nostrify';
import { decode } from 'nostr-tools/nip19';

import { DECK_KIND } from '../../src/lib/deckEvent';
import { isValidDeckId } from '../../src/lib/deckId';

/**
 * Resolve a `napplet:note/open` payload into something the viewer can load.
 * The convention's payload shape is still a draft, so we accept every form a
 * shell might plausibly send: a bare naddr string, `{ naddr }`, a
 * kind/pubkey/identifier triple, or a full event.
 */
export type OpenTarget =
  | { type: 'address'; pubkey: string; identifier: string }
  | { type: 'event'; event: NostrEvent }
  | { type: 'unsupported' }
  | { type: 'invalid' };

const PUBKEY_HEX = /^[0-9a-f]{64}$/;

function fromNaddr(naddr: string): OpenTarget {
  let decoded: ReturnType<typeof decode>;
  try {
    decoded = decode(naddr);
  } catch {
    return { type: 'invalid' };
  }
  if (decoded.type !== 'naddr') return { type: 'unsupported' };
  const { kind, pubkey, identifier } = decoded.data;
  if (kind !== DECK_KIND) return { type: 'unsupported' };
  if (!PUBKEY_HEX.test(pubkey) || !isValidDeckId(identifier)) return { type: 'invalid' };
  return { type: 'address', pubkey, identifier };
}

export function resolveOpenPayload(payload: unknown): OpenTarget {
  if (typeof payload === 'string') {
    return payload.startsWith('naddr1') ? fromNaddr(payload) : { type: 'invalid' };
  }
  if (!payload || typeof payload !== 'object') return { type: 'invalid' };

  const p = payload as Record<string, unknown>;

  if (typeof p.naddr === 'string') return fromNaddr(p.naddr);

  if (p.event && typeof p.event === 'object') {
    const event = p.event as NostrEvent;
    return event.kind === DECK_KIND ? { type: 'event', event } : { type: 'unsupported' };
  }

  if (typeof p.pubkey === 'string' && typeof p.identifier === 'string') {
    const kind = typeof p.kind === 'number' ? p.kind : DECK_KIND;
    if (kind !== DECK_KIND) return { type: 'unsupported' };
    if (!PUBKEY_HEX.test(p.pubkey) || !isValidDeckId(p.identifier)) return { type: 'invalid' };
    return { type: 'address', pubkey: p.pubkey, identifier: p.identifier };
  }

  return { type: 'invalid' };
}
