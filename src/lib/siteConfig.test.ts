import { afterEach, describe, expect, it } from 'vitest';
import { getDeckSiteTarget } from './siteConfig';

describe('getDeckSiteTarget', () => {
  afterEach(() => {
    delete window.__DECK__;
  });

  it('returns null on the normal app hosts (no injected deck)', () => {
    expect(getDeckSiteTarget()).toBeNull();
  });

  it('returns the injected deck on a mirrored deck site', () => {
    window.__DECK__ = { npub: 'npub1abc', deckId: 'my-talk' };
    expect(getDeckSiteTarget()).toEqual({ npub: 'npub1abc', deckId: 'my-talk' });
  });

  it('ignores a malformed injection', () => {
    window.__DECK__ = { npub: 'npub1abc' } as unknown as Window['__DECK__'];
    expect(getDeckSiteTarget()).toBeNull();
  });
});
