import type { NostrEvent } from '@nostrify/nostrify';
import { isValidDeckId } from './deckId';

/** Addressable slide-deck event. Generated via the kind generator; documented in NIP.md. */
export const DECK_KIND = 35891;

const SHA256_HEX = /^[0-9a-f]{64}$/;

export interface DeckFile {
  url: string;
  sha256: string;
  mimeType: string;
  size?: number;
}

export interface DeckPage {
  url: string;
  sha256: string;
  mimeType: string;
  width?: number;
  height?: number;
}

export interface Deck {
  pubkey: string;
  identifier: string;
  title: string;
  summary: string;
  image?: string;
  publishedAt?: number;
  pdf: DeckFile;
  pages: DeckPage[];
  hashtags: string[];
  event: NostrEvent;
}

export interface DeckEventInput {
  identifier: string;
  title: string;
  summary?: string;
  /** Thumbnail URL for the share card */
  imageUrl?: string;
  pdf: { url: string; sha256: string; size: number };
  pages: Array<{ url: string; sha256: string; width?: number; height?: number }>;
  hashtags?: string[];
  /** Unix seconds of first publication (kept stable across replacements) */
  publishedAt?: number;
}

export interface DeckEventTemplate {
  kind: number;
  content: string;
  tags: string[][];
}

/** Split raw hashtag form input ("nostr, bitcoin #tech") into normalized tags. */
export function parseHashtagInput(raw: string): string[] {
  return [...new Set(
    raw
      .split(/[\s,、#＃]+/)
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean),
  )];
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function buildDeckEvent(input: DeckEventInput): DeckEventTemplate {
  if (!isValidDeckId(input.identifier)) {
    throw new Error(`Invalid deck identifier: ${input.identifier}`);
  }
  if (!input.title.trim()) throw new Error('Deck title is required');
  if (input.pages.length === 0) throw new Error('Deck needs at least one page');

  const tags: string[][] = [
    ['d', input.identifier],
    ['title', input.title.trim()],
  ];
  if (input.summary?.trim()) tags.push(['summary', input.summary.trim()]);
  if (input.imageUrl) tags.push(['image', input.imageUrl]);
  if (input.publishedAt) tags.push(['published_at', String(input.publishedAt)]);

  // PDF original, NIP-94-style top-level tags
  tags.push(
    ['url', input.pdf.url],
    ['x', input.pdf.sha256],
    ['m', 'application/pdf'],
    ['size', String(input.pdf.size)],
  );

  // One imeta tag (NIP-92) per page; array order is page order
  for (const page of input.pages) {
    const entries = [`url ${page.url}`, `x ${page.sha256}`, 'm image/webp'];
    if (page.width && page.height) entries.push(`dim ${page.width}x${page.height}`);
    tags.push(['imeta', ...entries]);
  }

  for (const tag of input.hashtags ?? []) {
    tags.push(['t', tag.toLowerCase()]);
  }

  tags.push([
    'alt',
    `Slide deck "${input.title.trim()}" (${input.pages.length} pages), published with noslide deck`,
  ]);

  return { kind: DECK_KIND, content: input.summary?.trim() ?? '', tags };
}

function tagValue(event: NostrEvent, name: string): string | undefined {
  return event.tags.find(([n]) => n === name)?.[1];
}

function parseImeta(tag: string[]): DeckPage | null {
  const fields = new Map<string, string>();
  for (const entry of tag.slice(1)) {
    const space = entry.indexOf(' ');
    if (space <= 0) continue;
    fields.set(entry.slice(0, space), entry.slice(space + 1));
  }
  const url = fields.get('url');
  const sha256 = fields.get('x');
  if (!url || !isHttpUrl(url) || !sha256 || !SHA256_HEX.test(sha256)) return null;

  const page: DeckPage = { url, sha256, mimeType: fields.get('m') ?? 'image/webp' };
  const dim = fields.get('dim')?.match(/^(\d+)x(\d+)$/);
  if (dim) {
    page.width = Number(dim[1]);
    page.height = Number(dim[2]);
  }
  return page;
}

/**
 * Validate and parse a deck event. Returns null for anything malformed —
 * events are user-generated input and must never crash the app.
 */
export function parseDeckEvent(event: NostrEvent): Deck | null {
  if (event.kind !== DECK_KIND) return null;

  const identifier = tagValue(event, 'd');
  const title = tagValue(event, 'title');
  if (!identifier || !isValidDeckId(identifier) || !title?.trim()) return null;

  const pdfUrl = tagValue(event, 'url');
  const pdfSha = tagValue(event, 'x');
  if (!pdfUrl || !isHttpUrl(pdfUrl) || !pdfSha || !SHA256_HEX.test(pdfSha)) return null;

  const pages = event.tags
    .filter(([name]) => name === 'imeta')
    .map(parseImeta)
    .filter((page): page is DeckPage => page !== null);
  if (pages.length === 0) return null;

  const image = tagValue(event, 'image');
  const publishedAtRaw = tagValue(event, 'published_at');
  const publishedAt = publishedAtRaw ? Number(publishedAtRaw) : undefined;
  const sizeRaw = tagValue(event, 'size');

  return {
    pubkey: event.pubkey,
    identifier,
    title: title.trim(),
    summary: tagValue(event, 'summary') ?? event.content,
    image: image && isHttpUrl(image) ? image : undefined,
    publishedAt: Number.isFinite(publishedAt) ? publishedAt : undefined,
    pdf: {
      url: pdfUrl,
      sha256: pdfSha,
      mimeType: tagValue(event, 'm') ?? 'application/pdf',
      size: sizeRaw ? Number(sizeRaw) : undefined,
    },
    pages,
    hashtags: event.tags.filter(([name]) => name === 't').map(([, value]) => value).filter(Boolean),
    event,
  };
}

/** NIP-01 address for the deck ("a" tag value). */
export function deckAddress(deck: Pick<Deck, 'pubkey' | 'identifier'>): string {
  return `${DECK_KIND}:${deck.pubkey}:${deck.identifier}`;
}
