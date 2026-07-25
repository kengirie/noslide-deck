#!/usr/bin/env node
/**
 * Publish the NIP-89 application handler for nostr slide deck (kind 35891 decks).
 *
 * Run once with the operator key:
 *   NSEC=nsec1... node scripts/publish-nip89.mjs
 *
 * Other Nostr clients that encounter a kind 35891 event can then offer
 * "Open with nostr slide deck".
 */
import { finalizeEvent, nip19 } from 'nostr-tools';

const DECK_KIND = 35891;
const APP_URL = process.env.APP_URL ?? 'https://kengirie.github.io/nostr-slide-deck';
const RELAYS = [
  'wss://relay.ditto.pub/',
  'wss://relay.dreamith.to/',
  'wss://relay.primal.net/',
  'wss://relay.damus.io/',
];

const nsec = process.env.NSEC;
if (!nsec?.startsWith('nsec1')) {
  console.error('Set NSEC=nsec1... in the environment.');
  process.exit(1);
}
const sk = nip19.decode(nsec).data;
const now = Math.floor(Date.now() / 1000);

const handler = finalizeEvent({
  kind: 31990,
  created_at: now,
  content: JSON.stringify({
    name: 'nostr slide deck',
    display_name: 'nostr slide deck',
    about: 'Drop a PDF, get a shareable slide page. Page-flip viewer, OG cards, zaps.',
    website: APP_URL,
  }),
  tags: [
    ['d', 'nostr-slide-deck'],
    ['k', String(DECK_KIND)],
    ['web', `${APP_URL}/<bech32>`, 'naddr'],
    ['alt', 'Handler information for the nostr slide deck app'],
  ],
}, sk);

const recommendation = finalizeEvent({
  kind: 31989,
  created_at: now,
  content: '',
  tags: [
    ['d', String(DECK_KIND)],
    ['a', `31990:${handler.pubkey}:nostr-slide-deck`, RELAYS[0], 'web'],
    ['alt', `Recommended app for kind ${DECK_KIND} slide decks`],
  ],
}, sk);

for (const event of [handler, recommendation]) {
  const results = await Promise.all(RELAYS.map((url) => new Promise((resolve) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => { ws.close(); resolve(`${url} timeout`); }, 8000);
    ws.onopen = () => ws.send(JSON.stringify(['EVENT', event]));
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data.toString());
      if (msg[0] === 'OK') { clearTimeout(timer); ws.close(); resolve(`${url} ${msg[2] ? 'OK' : 'REJECTED ' + msg[3]}`); }
    };
    ws.onerror = () => { clearTimeout(timer); resolve(`${url} error`); };
  })));
  console.log(`kind ${event.kind}:`, results.join(' | '));
}
console.log('handler naddr:', nip19.naddrEncode({ kind: 31990, pubkey: handler.pubkey, identifier: 'nostr-slide-deck' }));
