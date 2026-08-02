import type { NostrEvent, NostrFilter } from '@nostrify/nostrify';
import { buildDeckEvent, DECK_KIND } from '../../src/lib/deckEvent';

/**
 * Dev-only mock of the NIP-5D shell: installs `window.napplet` with fixture
 * data so the viewer can be developed without a real shell. Only imported
 * behind `import.meta.env.DEV`; never part of the built artifact.
 */

const PUBKEY = 'a'.repeat(64);
const IDENTIFIER = 'mock-deck';
const PAGE_COUNT = 5;

const template = buildDeckEvent({
  identifier: IDENTIFIER,
  title: '紙芝居 mock deck',
  summary: 'Fixture deck served by the dev mock shell.',
  pdf: { url: 'https://blossom.example/mock.pdf', sha256: 'b'.repeat(64), size: 12345 },
  pages: Array.from({ length: PAGE_COUNT }, (_, i) => ({
    url: `https://blossom.example/page-${i + 1}.webp`,
    sha256: String(i + 1).repeat(64).slice(0, 64),
    width: 1600,
    height: 900,
  })),
  hashtags: ['mock'],
});

const fixtureEvent: NostrEvent = {
  ...template,
  id: 'c'.repeat(64),
  pubkey: PUBKEY,
  created_at: 1_700_000_000,
  sig: 'd'.repeat(64),
};

function pageSvg(n: number): Blob {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
  <rect width="1600" height="900" fill="#faf9f6"/>
  <rect x="40" y="40" width="1520" height="820" fill="none" stroke="#dcd9d2" stroke-width="2"/>
  <text x="800" y="470" font-size="220" text-anchor="middle" fill="#1c1a17" font-family="serif">${n}</text>
  <rect x="1500" y="800" width="24" height="24" fill="#d7381e"/>
</svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
}

function matchesFixture(filter: NostrFilter): boolean {
  const kinds = filter.kinds ?? [];
  const authors = filter.authors ?? [PUBKEY];
  const ids = filter['#d'] ?? [IDENTIFIER];
  return kinds.includes(DECK_KIND) && authors.includes(PUBKEY) && ids.includes(IDENTIFIER);
}

export function installMockShell(): void {
  if (window.napplet) return;

  window.napplet = {
    outbox: {
      async query(filters: NostrFilter[]) {
        await new Promise((r) => setTimeout(r, 250));
        const events = filters.some(matchesFixture) ? [{ event: fixtureEvent }] : [];
        return { events };
      },
    },
    resource: {
      async bytes(url: string) {
        await new Promise((r) => setTimeout(r, 150));
        const match = url.match(/page-(\d+)\.webp$/) ?? url.match(/^blossom:sha256:(\d)/);
        if (!match) throw new Error(`Mock shell has no bytes for ${url}`);
        return pageSvg(Number(match[1]));
      },
    },
    inc: {
      on(topic: string, handler: (event: NapIncEvent) => void) {
        if (topic === 'napplet:note/open') {
          setTimeout(() => {
            handler({
              sender: 'dev-mock',
              payload: { kind: DECK_KIND, pubkey: PUBKEY, identifier: IDENTIFIER },
            });
          }, 400);
        }
        return { close() {} };
      },
    },
    link: {
      async open(url: string) {
        window.open(url, '_blank', 'noopener');
        return { status: 'ok' };
      },
    },
  };
}
