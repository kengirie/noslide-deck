import type { NostrEvent } from '@nostrify/nostrify';
import { DECK_KIND } from './deckEvent';
import { NAMED_SITE_KIND } from './nsite';

/** NIP-09 deletion request. */
export const DELETION_KIND = 5;

const SHA256_HEX = /^[0-9a-f]{64}$/;

export interface DeleteRequestTemplate {
  kind: number;
  content: string;
  tags: string[][];
  created_at: number;
}

/**
 * Build a NIP-09 deletion request covering both the deck event (35891) and its
 * NIP-5A named-site manifest (35128) — they share the same `d` identifier.
 *
 * Relays delete addressable events "up to the created_at of the deletion
 * request", so the timestamp must be strictly newer than every event being
 * deleted or a skewed clock could leave them alive.
 */
export function buildDeckDeleteRequest(opts: {
  pubkey: string;
  identifier: string;
  /** Newest created_at among the events being deleted */
  latestCreatedAt: number;
  reason?: string;
}): DeleteRequestTemplate {
  const { pubkey, identifier, latestCreatedAt, reason } = opts;
  return {
    kind: DELETION_KIND,
    content: reason ?? '',
    created_at: Math.max(Math.floor(Date.now() / 1000), latestCreatedAt + 1),
    tags: [
      ['a', `${DECK_KIND}:${pubkey}:${identifier}`],
      ['a', `${NAMED_SITE_KIND}:${pubkey}:${identifier}`],
      ['k', String(DECK_KIND)],
      ['k', String(NAMED_SITE_KIND)],
    ],
  };
}

/**
 * NIP-09 client duty: hide events covered by a deletion request. Only the
 * author's own kind 5 counts, and only when it is at least as new as the
 * event version ("up to the created_at of the deletion request").
 */
export function coveredByDeletion(event: NostrEvent, deletions: NostrEvent[]): boolean {
  const identifier = event.tags.find(([name]) => name === 'd')?.[1] ?? '';
  const address = `${event.kind}:${event.pubkey}:${identifier}`;
  return deletions.some(
    (deletion) =>
      deletion.kind === DELETION_KIND &&
      deletion.pubkey === event.pubkey &&
      deletion.created_at >= event.created_at &&
      deletion.tags.some(([name, value]) => name === 'a' && value === address),
  );
}

function hashFromUrl(value: string): string | undefined {
  return value.match(/[0-9a-f]{64}/)?.[0];
}

/**
 * Every Blossom blob hash referenced by a deck event or a site manifest:
 * NIP-94 `x`, `imeta` entries, `path` tags, plus hashes embedded in blob URLs
 * (`url`/`image`) so the thumbnail is found even without a manifest.
 * The manifest's aggregate `x` tag is a site version id, not a blob — skipped.
 */
export function collectEventHashes(event: NostrEvent): Set<string> {
  const hashes = new Set<string>();

  for (const tag of event.tags) {
    const [name, value, marker] = tag;
    if (name === 'x' && marker !== 'aggregate' && value && SHA256_HEX.test(value)) {
      hashes.add(value);
    } else if (name === 'path' && tag[2] && SHA256_HEX.test(tag[2])) {
      hashes.add(tag[2]);
    } else if ((name === 'url' || name === 'image') && value) {
      const hash = hashFromUrl(value);
      if (hash) hashes.add(hash);
    } else if (name === 'imeta') {
      for (const entry of tag.slice(1)) {
        const space = entry.indexOf(' ');
        if (space <= 0) continue;
        const key = entry.slice(0, space);
        const val = entry.slice(space + 1);
        if (key === 'x' && SHA256_HEX.test(val)) hashes.add(val);
        else if (key === 'url') {
          const hash = hashFromUrl(val);
          if (hash) hashes.add(hash);
        }
      }
    }
  }

  return hashes;
}

/**
 * Blob hashes safe to delete: everything the doomed events reference, minus
 * anything the author's *other* decks/manifests still use — Blossom blobs are
 * content-addressed, so an identical page or PDF may be shared across decks.
 */
export function deletableHashes(targets: NostrEvent[], keep: NostrEvent[]): string[] {
  const doomed = new Set<string>();
  for (const event of targets) for (const hash of collectEventHashes(event)) doomed.add(hash);

  for (const event of keep) {
    for (const hash of collectEventHashes(event)) doomed.delete(hash);
  }

  return [...doomed].sort();
}
