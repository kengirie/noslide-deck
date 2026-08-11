# Development & deployment

## Development

```sh
npm run dev    # dev server on :8080
npm test       # typecheck + lint + vitest + build, all in one
```

> Note: `npm run dev` does **not** emit `site-assets.json` (a build artifact), so
> publishing a deck end-to-end requires a built preview: `npm run build && npx vite preview`.

### One-time operator setup

Register the NIP-89 app handler (lets other Nostr clients offer "Open with nostr slide deck" for deck events):

```sh
NSEC=nsec1... node scripts/publish-nip89.mjs
```

## Deployment

Push to `main` and `deploy.yml` ships the app to GitHub Pages (base `/noslide-deck/`).

Each published deck also mirrors the app into its own nsite, so a deck's share URL *is* an app URL — open `https://<npubB36><deck-id>.<gateway>/` and you get the full app booted into that deck. Those deck sites need a root-base build of the app, published as the "slides" nsite via `nsite.yml` (base `/`). Publishing from GitHub Pages pulls the app assets from there, so **after any app change, redeploy the "slides" nsite** — cut a Release, or run it by hand:

```sh
gh workflow run nsite.yml --ref main
```

Note: a bare tag push won't trigger it (needs a published Release or a manual run), a no-op redeploy fails on purpose, and gateways cache for a bit — check `.../site-assets.json` returns JSON before relying on it. Hosts and the "slides" subdomain live in [`src/lib/siteConfig.ts`](src/lib/siteConfig.ts).
