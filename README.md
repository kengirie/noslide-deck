# nostr slide deck

**投げ銭できる Speaker Deck。** PDF をドロップすると、共有できるスライドページが Nostr 上に公開されます。

Drop a PDF and get a shareable slide page on Nostr: links unfurl into a card of your first slide, readers flip through the pages, and zaps go straight to the speaker. No accounts — your Nostr key is you.

**App**: <https://kengirie.github.io/nostr-slide-deck/>

## How it works — smart client, dumb server

There is **zero app-specific server code**. Everything is generated in the browser at publish time (see [Abstract.md](Abstract.md) for the full design):

1. pdf.js renders every page of the PDF to WebP images client-side (plus a 1200×630 JPEG thumbnail).
2. The PDF, page images, and thumbnail are uploaded to multiple [Blossom](https://github.com/hzrd149/blossom) servers, addressed by SHA-256 hash.
3. A **deck event** (addressable kind `35891`, documented in [NIP.md](NIP.md)) records both the URL *and* the hash of every file, so files survive any single server's death.
4. A self-contained static viewer HTML — with `og:image` and friends **baked in at publish time** — is uploaded to Blossom and published as an nsite (NIP-5A kind `15128` manifest). Gateways like `nosto.re` serve it at `https://<npub>.nosto.re/<deck-id>/`, so crawlers get OG cards with no SSR anywhere.
5. Comments (NIP-22), reactions (NIP-25), zaps (NIP-57), and profiles are plain Nostr — visible from any client.

## Development

```sh
npm run dev    # dev server on :8080
npm test       # typecheck + lint + vitest + build, all in one
```

Deploys to GitHub Pages automatically on push to `main`.

### One-time operator setup

Register the NIP-89 app handler (lets other Nostr clients offer "Open with nostr slide deck" for deck events):

```sh
NSEC=nsec1... node scripts/publish-nip89.mjs
```

## Stack

React 19 · Vite · TailwindCSS 4 · [Nostrify](https://nostrify.dev) · pdf.js · [MKStack](https://soapbox.pub/mkstack) template.

Design: paper & ink（紙とインク）— Shippori Mincho B1 / IBM Plex Sans JP / IBM Plex Mono, crop-mark sheets, folio page numbers, and one vermilion seal.
