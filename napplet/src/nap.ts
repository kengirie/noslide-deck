import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import type { DeckPage } from '../../src/lib/deckEvent';

/**
 * Defensive facade over the shell-injected `window.napplet` namespace.
 * NIP-5D is a moving draft, so every call here tolerates shape drift: missing
 * domains, bare-array vs `{ events }` query results, wrapped vs bare events,
 * and shells that hang (everything is timeout-raced).
 */

const QUERY_TIMEOUT_MS = 8000;
const OPEN_TOPIC = 'napplet:note/open';

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms)),
  ]);
}

function normalizeEvents(result: unknown): NostrEvent[] {
  const items = Array.isArray(result)
    ? result
    : (result as { events?: unknown[] } | null)?.events ?? [];
  const events: NostrEvent[] = [];
  for (const item of items) {
    const event = (item as { event?: NostrEvent })?.event ?? (item as NostrEvent);
    if (event && typeof event === 'object' && typeof (event as NostrEvent).kind === 'number') {
      events.push(event as NostrEvent);
    }
  }
  return events;
}

export interface NapBridge {
  /** Both domains the viewer cannot work without. */
  hasCore: boolean;
  query(filters: NostrFilter[], opts?: NapOutboxQueryOpts): Promise<NostrEvent[]>;
  fetchPageBlob(page: Pick<DeckPage, 'url' | 'sha256'>): Promise<Blob>;
  onOpenIntent(handler: (payload: unknown) => void): void;
  applyTheme(apply: (theme: NapThemeValues) => void): void;
  /** Undefined when the shell lacks the `link` domain — hide the UI instead. */
  openLink?: (url: string) => void;
}

export function createBridge(): NapBridge {
  const nap = window.napplet;
  const outbox = nap?.outbox;
  const resource = nap?.resource;

  return {
    hasCore: Boolean(outbox?.query && resource?.bytes),

    async query(filters, opts) {
      if (!outbox?.query) return [];
      const timeoutMs = opts?.timeoutMs ?? QUERY_TIMEOUT_MS;
      const result = await withTimeout(
        Promise.resolve(outbox.query(filters, { timeoutMs, ...opts })),
        timeoutMs + 2000,
        'outbox.query',
      );
      return normalizeEvents(result);
    },

    async fetchPageBlob(page) {
      if (!resource?.bytes) throw new Error('resource domain unavailable');
      // Content-addressed first: the shell verifies the hash for us. Shells
      // that reject the blossom: scheme fall back to the event's https URL.
      try {
        return await withTimeout(
          Promise.resolve(resource.bytes(`blossom:sha256:${page.sha256}`)),
          QUERY_TIMEOUT_MS,
          'resource.bytes',
        );
      } catch {
        return withTimeout(
          Promise.resolve(resource.bytes(page.url)),
          QUERY_TIMEOUT_MS,
          'resource.bytes',
        );
      }
    },

    onOpenIntent(handler) {
      try {
        nap?.inc?.on(OPEN_TOPIC, (event) => handler(event?.payload));
      } catch {
        // A shell without inc simply never delivers intents; the manual
        // naddr form remains as the entry point.
      }
    },

    applyTheme(apply) {
      const theme = nap?.theme;
      if (!theme?.get) return;
      theme.get().then(apply).catch(() => {});
      try {
        theme.onChanged?.(apply);
      } catch {
        // Static theme is fine.
      }
    },

    openLink: nap?.link?.open
      ? (url: string) => {
          nap!.link!.open(url).catch(() => {});
        }
      : undefined,
  };
}
