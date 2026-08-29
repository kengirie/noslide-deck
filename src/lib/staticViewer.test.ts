import { describe, expect, it } from 'vitest';
import { renderDeckAppHtml } from './staticViewer';

const base = {
  title: 'My Talk',
  summary: 'A short deck',
  canonicalUrl: 'https://abc123mytalk.nwb.tf/',
  ogImageUrl: 'https://abc123mytalk.nwb.tf/thumb.jpg',
  npub: 'npub1abcdef',
  deckId: 'my-talk',
  pagePaths: ['pages/001.webp', 'pages/002.webp'],
  scripts: ['/assets/index-CzHaZuvL.js'],
  styles: ['/assets/index-uQ6BYMAW.css'],
};

describe('renderDeckAppHtml', () => {
  it('boots the app and tags the deck for the router', () => {
    const html = renderDeckAppHtml(base);
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain('<script type="module" crossorigin src="/assets/index-CzHaZuvL.js"></script>');
    expect(html).toContain('<link rel="stylesheet" crossorigin href="/assets/index-uQ6BYMAW.css">');
    expect(html).toContain('<meta name="deck:npub" content="npub1abcdef">');
    expect(html).toContain('<meta name="deck:id" content="my-talk">');
  });

  it('bakes deck-specific OG meta and a noscript fallback', () => {
    const html = renderDeckAppHtml(base);
    expect(html).toContain('<meta property="og:title" content="My Talk">');
    expect(html).toContain('<meta property="og:image" content="https://abc123mytalk.nwb.tf/thumb.jpg">');
    expect(html).toContain('<noscript>');
    expect(html).toContain('src="pages/001.webp"');
  });

  it('keeps the strict CSP so the interactive page stays locked down', () => {
    expect(renderDeckAppHtml(base)).toContain("script-src 'self'");
  });

  it('bakes the signed deck event for instant hydration when provided', () => {
    const deckEvent = {
      id: 'a'.repeat(64),
      pubkey: 'b'.repeat(64),
      kind: 35891,
      created_at: 1700000000,
      content: '',
      tags: [['d', 'my-talk'], ['title', 'My Talk']],
      sig: 'c'.repeat(128),
    };
    const html = renderDeckAppHtml({ ...base, deckEvent });
    // Round-trips through the meta attribute back to the original event.
    const match = html.match(/<meta name="deck:event" content="([^"]*)">/);
    expect(match).not.toBeNull();
    const decoded = match![1]
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'")
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&amp;', '&');
    expect(JSON.parse(decoded)).toEqual(deckEvent);
  });

  it('omits the deck:event meta when no event is baked', () => {
    expect(renderDeckAppHtml(base)).not.toContain('name="deck:event"');
  });

  it('rejects a cross-origin or non-asset script ref', () => {
    expect(() => renderDeckAppHtml({ ...base, scripts: ['https://evil.example/x.js'] })).toThrow();
    expect(() => renderDeckAppHtml({ ...base, styles: ['/assets/../etc/passwd'] })).toThrow();
  });

  it('rejects a malformed deckId or npub', () => {
    expect(() => renderDeckAppHtml({ ...base, deckId: 'Bad_ID' })).toThrow();
    expect(() => renderDeckAppHtml({ ...base, npub: 'nsec1leak' })).toThrow();
  });
});
