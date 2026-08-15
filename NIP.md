# Slide Decks

`draft` `optional`

This document describes the event format used by [noslide deck](https://github.com/kengirie/noslide-deck) to publish presentation slide decks on Nostr.

## Deck event (kind `35891`)

A slide deck is an *addressable* event of kind `35891`. The combination `35891:<pubkey>:<d>` identifies a deck; publishing again with the same `d` replaces the deck (e.g. an updated version of the slides).

The event records **both a URL and a SHA-256 hash for every file**. The URL says where the file currently lives; the hash says what the file is, so it can be retrieved from any [Blossom](https://github.com/hzrd149/blossom) server if the original goes away.

### Tags

| tag | required | description |
| --- | --- | --- |
| `d` | yes | Deck identifier: `[a-z0-9-]`, max 13 characters (kept compatible with NIP-5A named-site identifiers) |
| `title` | yes | Deck title |
| `summary` | no | Short description (also mirrored in `content`) |
| `image` | no | Thumbnail URL (first page, 1200×630) for share cards |
| `published_at` | no | Unix seconds of first publication, kept stable across replacements |
| `url` | yes | URL of the original PDF |
| `x` | yes | SHA-256 of the PDF (lowercase hex) |
| `m` | yes | MIME type of the original file (`application/pdf`) |
| `size` | no | PDF size in bytes |
| `imeta` | yes (≥1) | One per page image, **in page order** (NIP-92 variadic format): `url`, `x`, `m`, `dim` |
| `t` | no | Hashtags for discovery |
| `alt` | yes | NIP-31 human-readable fallback |

Page order is the order of the `imeta` tags within the event.

### Example

```json
{
  "kind": 35891,
  "content": "How to publish slides on Nostr.",
  "tags": [
    ["d", "nostr-slides"],
    ["title", "Slides on Nostr"],
    ["summary", "How to publish slides on Nostr."],
    ["image", "https://npub1xxx.nosto.re/nostr-slides/thumb.webp"],
    ["published_at", "1700000000"],
    ["url", "https://blossom.example/6ba7...c9e1.pdf"],
    ["x", "6ba7...c9e1"],
    ["m", "application/pdf"],
    ["size", "1048576"],
    ["imeta", "url https://blossom.example/aa11...ff00.webp", "x aa11...ff00", "m image/webp", "dim 1600x900"],
    ["imeta", "url https://blossom.example/bb22...ee11.webp", "x bb22...ee11", "m image/webp", "dim 1600x900"],
    ["t", "nostr"],
    ["alt", "Slide deck \"Slides on Nostr\" (2 pages), published with noslide deck"]
  ]
}
```

## Interactions

Standard NIPs are used as-is; nothing app-specific:

- **Comments**: NIP-22 (kind 1111) replies referencing the deck's address
- **Reactions**: NIP-25 targeting the deck event
- **App handler**: NIP-89 (kind 31990) announcing this app as a handler for kind 35891

## Deletion

Deleting a deck is a single [NIP-09](https://github.com/nostr-protocol/nips/blob/master/09.md) request (kind `5`) with two `a` tags — the deck event and its named-site manifest share the same identifier:

```json
{
  "kind": 5,
  "tags": [
    ["a", "35891:<pubkey>:<d>"],
    ["a", "35128:<pubkey>:<d>"],
    ["k", "35891"],
    ["k", "35128"]
  ]
}
```

The client then removes the deck's blobs from the author's Blossom servers via [BUD-12](https://github.com/hzrd149/blossom/blob/master/buds/12.md) `DELETE /<sha256>`, using one [BUD-11](https://github.com/hzrd149/blossom/blob/master/buds/11.md) token that lists every hash in `x` tags and is scoped with `server` tags. Blobs still referenced by the author's other decks are spared, since Blossom storage is content-addressed and shared. Clients hide decks covered by such a request even when a relay still serves them.

## Static mirror (nsite)

At publish time the client also renders a static HTML viewer with Open Graph meta tags baked in and publishes it as a NIP-5A **named site** (kind `35128`) whose `d` tag equals the deck identifier, with paths `/index.html`, `/thumb.jpg`, and `/pages/NNN.webp`. Gateways serve it at the canonical named-site address `https://<pubkeyB36><d>.<gateway>/` (which is why deck identifiers follow the named-site `d` rules: `^[a-z0-9-]{1,13}$`, not ending with `-`). Share links unfurl into cards without any server-side rendering; the deck event above remains the source of truth, and the user's root nsite (kind `15128`) is never touched.
