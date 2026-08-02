import type { DeckPage } from '../../src/lib/deckEvent';

export type BlobFetcher = (page: DeckPage) => Promise<Blob>;

/** Pages kept alive on each side of the focused page. */
const KEEP_WINDOW = 2;

interface Entry {
  promise: Promise<string>;
  url?: string;
  evicted?: boolean;
}

/**
 * Object-URL cache for slide images. The shell CSP only allows `img-src data:
 * blob:`, so every page goes fetch-blob → objectURL. Decks can be 100+ pages of
 * WebP, so URLs outside the focus window are revoked instead of accumulating.
 */
export class PageImageStore {
  private entries = new Map<number, Entry>();

  constructor(
    private pages: DeckPage[],
    private fetchBlob: BlobFetcher,
  ) {}

  /** Resolve the displayable URL for a page, fetching if needed. */
  get(index: number): Promise<string> {
    const existing = this.entries.get(index);
    if (existing && !existing.evicted) return existing.promise;

    const page = this.pages[index];
    if (!page) return Promise.reject(new Error(`No page at index ${index}`));

    const entry: Entry = {
      promise: this.fetchBlob(page).then(
        (blob) => {
          const url = URL.createObjectURL(blob);
          entry.url = url;
          // Evicted while in flight: free immediately; a later get() refetches.
          if (entry.evicted) URL.revokeObjectURL(url);
          return url;
        },
        (error) => {
          this.entries.delete(index);
          throw error;
        },
      ),
    };
    this.entries.set(index, entry);
    return entry.promise;
  }

  /** Drop everything outside `index ± KEEP_WINDOW`. */
  focus(index: number): void {
    for (const [i, entry] of this.entries) {
      if (Math.abs(i - index) <= KEEP_WINDOW) continue;
      entry.evicted = true;
      if (entry.url) URL.revokeObjectURL(entry.url);
      this.entries.delete(i);
    }
  }

  dispose(): void {
    for (const entry of this.entries.values()) {
      entry.evicted = true;
      if (entry.url) URL.revokeObjectURL(entry.url);
    }
    this.entries.clear();
  }
}
