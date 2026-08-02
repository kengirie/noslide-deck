import { describe, expect, it } from 'vitest';
import { naddrEncode, neventEncode } from 'nostr-tools/nip19';

import { DECK_KIND } from '../../src/lib/deckEvent';
import { resolveOpenPayload } from './address';
import { FIXTURE_IDENTIFIER, FIXTURE_PUBKEY, makeDeckEvent } from './test-fixtures';

const deckNaddr = naddrEncode({
  kind: DECK_KIND,
  pubkey: FIXTURE_PUBKEY,
  identifier: FIXTURE_IDENTIFIER,
});

describe('resolveOpenPayload', () => {
  it('accepts a bare naddr string', () => {
    expect(resolveOpenPayload(deckNaddr)).toEqual({
      type: 'address',
      pubkey: FIXTURE_PUBKEY,
      identifier: FIXTURE_IDENTIFIER,
    });
  });

  it('accepts an { naddr } payload', () => {
    expect(resolveOpenPayload({ naddr: deckNaddr }).type).toBe('address');
  });

  it('accepts a kind/pubkey/identifier triple', () => {
    expect(
      resolveOpenPayload({ kind: DECK_KIND, pubkey: FIXTURE_PUBKEY, identifier: FIXTURE_IDENTIFIER }),
    ).toEqual({ type: 'address', pubkey: FIXTURE_PUBKEY, identifier: FIXTURE_IDENTIFIER });
  });

  it('passes a full deck event through', () => {
    const event = makeDeckEvent();
    expect(resolveOpenPayload({ event })).toEqual({ type: 'event', event });
  });

  it('rejects other kinds as unsupported', () => {
    const other = naddrEncode({ kind: 30023, pubkey: FIXTURE_PUBKEY, identifier: 'post' });
    expect(resolveOpenPayload(other).type).toBe('unsupported');
    expect(resolveOpenPayload({ kind: 1, pubkey: FIXTURE_PUBKEY, identifier: 'x' }).type).toBe('unsupported');
    expect(resolveOpenPayload({ event: makeDeckEvent({ kind: 1 }) }).type).toBe('unsupported');
  });

  it('rejects non-naddr entities as unsupported', () => {
    const nevent = neventEncode({ id: 'e'.repeat(64) });
    expect(resolveOpenPayload(nevent).type).toBe('invalid');
    expect(resolveOpenPayload({ naddr: nevent }).type).toBe('unsupported');
  });

  it('rejects garbage as invalid', () => {
    expect(resolveOpenPayload('naddr1garbage').type).toBe('invalid');
    expect(resolveOpenPayload(null).type).toBe('invalid');
    expect(resolveOpenPayload(42).type).toBe('invalid');
    expect(resolveOpenPayload({}).type).toBe('invalid');
    expect(resolveOpenPayload({ pubkey: 'not-hex', identifier: FIXTURE_IDENTIFIER }).type).toBe('invalid');
  });
});
