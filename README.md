# Rostrum

English | [日本語](README.ja.md)

Share slides on Nostr. When you upload a PDF, it is published as a [NIP-5A](https://github.com/nostr-protocol/nips/blob/master/5A.md) nsite. The nsite URL is both the share page and the app: readers can flip through the slides in the browser, and when the link is pasted somewhere, it shows a card of the first slide.


**GH pages**: <https://kengirie.github.io/rostrum/>

**Nsite**: <https://39ohbfiu1ziyvxhwqdklupc0yrc4mcgmjpfe3w6vvz1gp6wg7hslides.nwb.tf/>

## How it works — Server-Side Rendering, without a server

To show a link-preview (OG) card, you usually need a **server** that renders HTML for each request. Speaker Deck does it this way. The server is the smart part:

```text
  ┌──────────────────────────────────────┐
  │  Server                     (smart)  │
  │  renders HTML per request (SSR)      │
  └────────────────────┬─────────────────┘
                       │ HTML + OG card
                       ▼
  ┌──────────────────────────────────────┐
  │  Viewer / crawler           (dumb)   │
  │  browser only — asks the server      │
  └──────────────────────────────────────┘
```

Rostrum does not use a server. It makes this HTML **in the browser when you publish**, and puts it on a simple static host ([NIP-5A](https://github.com/nostr-protocol/nips/blob/master/5A.md) nsite). So the smart part moves to the upload client, and it runs only once:

```text
  ┌──────────────────────────────────────┐
  │  Upload client              (smart)  │
  │  pdf.js images · bakes HTML w/ OG    │
  └────────────────────┬─────────────────┘
                       │ files, by SHA-256
                       ▼
  ┌──────────────────────────────────────┐
  │  nsite + Blossom            (dumb)   │
  │  serves the baked files as-is        │
  └────────────────────┬─────────────────┘
                       │ HTTPS
                       ▼
  ┌──────────────────────────────────────┐
  │  Viewer                     (dumb)   │
  │  crawler: OG card · human: full app  │
  └──────────────────────────────────────┘
```

So one URL works for both a crawler and a person. In detail, a deck is an addressable **kind `35891`** event ([NIP.md](NIP.md)). It keeps every file by URL *and* by hash, and it is served as its own [NIP-5A](https://github.com/nostr-protocol/nips/blob/master/5A.md) **named site (kind `35128`)** at `https://<npubB36><deck-id>.<gateway>/`. Comments (NIP-22), reactions (NIP-25), and profiles are all plain Nostr.

Local setup and deployment live in [DEVELOPMENT.md](DEVELOPMENT.md).

## Stack

React 19 · React Router · Vite · TailwindCSS 4 · [Nostrify](https://nostrify.dev) · pdf.js · [MKStack](https://soapbox.pub/mkstack) template.

## License

MIT.
