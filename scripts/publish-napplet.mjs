#!/usr/bin/env node
/**
 * Publish the Kamishibai viewer napplet (NIP-5D):
 *   1. Upload dist-napplet/index.html to the Blossom servers (BUD-02).
 *   2. Sign and publish the kind 35129 named-napplet manifest (NIP-5A tag
 *      schema) with `requires` and `archetype` declarations.
 *
 * Build first, then run with the operator key (same key as publish-nip89.mjs):
 *   npm run build:napplet
 *   NSEC=nsec1... node scripts/publish-napplet.mjs
 *
 * `--dry-run` signs with a throwaway key (unless NSEC is set) and prints the
 * manifest without uploading or publishing anything.
 */
import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { finalizeEvent, nip19 } from 'nostr-tools';

const NAPPLET_KIND = 35129;
const IDENTIFIER = 'kamishibai-viewer';
const ARTIFACT = new URL('../dist-napplet/index.html', import.meta.url);

const SERVERS = (process.env.SERVERS ?? 'https://blossoml3001.site/').split(',');
const RELAYS = (process.env.RELAYS ?? [
  'wss://relay.ditto.pub/',
  'wss://relay.dreamith.to/',
  'wss://relay.primal.net/',
  'wss://relay.damus.io/',
].join(',')).split(',');

const dryRun = process.argv.includes('--dry-run');

const nsec = process.env.NSEC;
let sk;
if (nsec?.startsWith('nsec1')) {
  sk = nip19.decode(nsec).data;
} else if (dryRun) {
  sk = new Uint8Array(randomBytes(32));
  console.log('dry run: signing with a throwaway key');
} else {
  console.error('Set NSEC=nsec1... in the environment (or pass --dry-run).');
  process.exit(1);
}

const html = await readFile(ARTIFACT).catch(() => {
  console.error('dist-napplet/index.html not found — run `npm run build:napplet` first.');
  process.exit(1);
});

const sha256 = createHash('sha256').update(html).digest('hex');
// NIP-5A aggregate hash: sorted "<hash> <path>\n" lines, hashed again.
const aggregate = createHash('sha256').update(`${sha256} /index.html\n`).digest('hex');
const now = Math.floor(Date.now() / 1000);

console.log(`artifact: ${html.length} bytes, sha256 ${sha256}`);

if (!dryRun) {
  const auth = finalizeEvent({
    kind: 24242,
    created_at: now,
    content: 'Upload kamishibai-viewer napplet',
    tags: [
      ['t', 'upload'],
      ['x', sha256],
      ['size', String(html.length)],
      ['expiration', String(now + 600)],
    ],
  }, sk);
  const authorization = `Nostr ${Buffer.from(JSON.stringify(auth)).toString('base64')}`;

  for (const server of SERVERS) {
    try {
      const response = await fetch(new URL('/upload', server), {
        method: 'PUT',
        body: html,
        headers: { authorization, 'content-type': 'text/html' },
      });
      console.log(`blossom ${server}: ${response.ok ? 'OK' : `${response.status} ${(await response.text()).slice(0, 120)}`}`);
    } catch (err) {
      console.log(`blossom ${server}: ${err.message}`);
    }
  }
}

const manifest = finalizeEvent({
  kind: NAPPLET_KIND,
  created_at: now,
  content: '',
  tags: [
    ['d', IDENTIFIER],
    ['title', 'Kamishibai Viewer'],
    ['description', 'Viewer for Kamishibai slide decks (kind 35891)'],
    ['path', '/index.html', sha256],
    ['x', aggregate, 'aggregate'],
    ...SERVERS.map((url) => ['server', url]),
    ['requires', 'outbox'],
    ['requires', 'resource'],
    ['archetype', 'note', 'napplet:note/open'],
    ['alt', 'NIP-5D napplet manifest for the Kamishibai slide deck viewer'],
  ],
}, sk);

if (dryRun) {
  console.log(JSON.stringify(manifest, null, 2));
} else {
  const results = await Promise.all(RELAYS.map((url) => new Promise((resolve) => {
    const ws = new WebSocket(url);
    const timer = setTimeout(() => { ws.close(); resolve(`${url} timeout`); }, 8000);
    ws.onopen = () => ws.send(JSON.stringify(['EVENT', manifest]));
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data.toString());
      if (msg[0] === 'OK') { clearTimeout(timer); ws.close(); resolve(`${url} ${msg[2] ? 'OK' : 'REJECTED ' + msg[3]}`); }
    };
    ws.onerror = () => { clearTimeout(timer); resolve(`${url} error`); };
  })));
  console.log(`kind ${NAPPLET_KIND}:`, results.join(' | '));
}

console.log('napplet naddr:', nip19.naddrEncode({
  kind: NAPPLET_KIND,
  pubkey: manifest.pubkey,
  identifier: IDENTIFIER,
}));
