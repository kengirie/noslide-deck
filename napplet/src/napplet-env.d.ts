import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';

/**
 * Minimal typings for the NIP-5D `window.napplet` namespace, covering only the
 * domains this viewer uses. The shapes follow the NAP domain docs but stay
 * loose on purpose: the spec is a moving draft, so every access goes through
 * the defensive wrappers in nap.ts rather than trusting these types at runtime.
 */
declare global {
  interface NapOutboxQueryOpts {
    authors?: string[];
    relays?: string[];
    timeoutMs?: number;
  }

  /** Query results may be bare events or `{ event, sidecar }` wrappers. */
  type NapEventResult = NostrEvent | { event: NostrEvent; sidecar?: { relayHints?: string[] } };

  interface NapOutbox {
    query(filters: NostrFilter[], opts?: NapOutboxQueryOpts): Promise<{ events: NapEventResult[] } | NapEventResult[]>;
  }

  interface NapResource {
    bytes(url: string): Promise<Blob>;
  }

  interface NapIncEvent {
    sender?: string;
    payload?: unknown;
  }

  interface NapSubscription {
    close?: () => void;
  }

  interface NapInc {
    on(topic: string, handler: (event: NapIncEvent) => void): NapSubscription | void;
  }

  interface NapTheme {
    get(): Promise<NapThemeValues>;
    onChanged(handler: (theme: NapThemeValues) => void): NapSubscription | void;
  }

  interface NapThemeValues {
    colors?: { background?: string; foreground?: string; accent?: string };
  }

  interface NapLink {
    open(url: string, opts?: { label?: string }): Promise<{ status?: string }>;
  }

  interface Window {
    napplet?: {
      outbox?: NapOutbox;
      resource?: NapResource;
      inc?: NapInc;
      theme?: NapTheme;
      link?: NapLink;
      [domain: string]: unknown;
    };
  }
}

export {};
