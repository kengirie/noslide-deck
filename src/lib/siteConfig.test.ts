import { afterEach, describe, expect, it } from 'vitest';
import { getDeckSiteTarget } from './siteConfig';

function setMeta(name: string, content: string) {
  const el = document.createElement('meta');
  el.setAttribute('name', name);
  el.setAttribute('content', content);
  document.head.appendChild(el);
}

describe('getDeckSiteTarget', () => {
  afterEach(() => {
    delete window.__DECK__;
    document.head.querySelectorAll('meta[name^="deck:"]').forEach((el) => el.remove());
  });

  it('returns null on the normal app hosts (no injection)', () => {
    expect(getDeckSiteTarget()).toBeNull();
  });

  it('reads the deck from meta tags on a mirrored deck site', () => {
    setMeta('deck:npub', 'npub1abc');
    setMeta('deck:id', 'my-talk');
    expect(getDeckSiteTarget()).toEqual({ npub: 'npub1abc', deckId: 'my-talk' });
  });

  it('falls back to window.__DECK__ when meta tags are absent', () => {
    window.__DECK__ = { npub: 'npub1xyz', deckId: 'deck-2' };
    expect(getDeckSiteTarget()).toEqual({ npub: 'npub1xyz', deckId: 'deck-2' });
  });

  it('ignores a partial meta injection', () => {
    setMeta('deck:npub', 'npub1abc');
    expect(getDeckSiteTarget()).toBeNull();
  });
});
