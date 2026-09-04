import { useCallback, useState } from 'react';
import { useNostr } from '@nostrify/react';
import { nip19 } from 'nostr-tools';
import type { DeckMetadata } from '@/components/publish/DeckMetadataForm';
import { useTranslation } from 'react-i18next';
import { getEffectiveBlossomServers } from '@/lib/appBlossom';
import { ensureAppAssets, fetchSiteAssets } from '@/lib/appMirror';
import { uploadToServers, type BlossomServerResult } from '@/lib/blossomMulti';
import { DECK_KIND, buildDeckEvent, parseHashtagInput } from '@/lib/deckEvent';
import { buildNamedSiteManifest, buildServerList, type SitePath } from '@/lib/nsite';
import type { RenderedDeck } from '@/lib/pdfRender';
import { LOOKUP_RELAYS, deckGatewayUrl } from '@/lib/siteConfig';
import { renderDeckAppHtml, renderEmbedHtml } from '@/lib/staticViewer';
import { useAppContext } from './useAppContext';
import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';

export interface PublishResult {
  naddr: string;
  identifier: string;
  pubkey: string;
  npub: string;
  /** Share URL on the nsite gateway; absent when the mirror step failed */
  gatewayUrl?: string;
  /** Human-readable warning when the static mirror could not be published */
  mirrorError?: string;
}

interface PublishState {
  step: 'idle' | 'uploading' | 'publishing' | 'mirroring' | 'done' | 'error';
  uploaded: number;
  totalUploads: number;
  /** Servers that rejected at least one blob (upload still succeeded elsewhere) */
  failedServers: string[];
  error: string | null;
  result: PublishResult | null;
}

const IDLE: PublishState = {
  step: 'idle',
  uploaded: 0,
  totalUploads: 0,
  failedServers: [],
  error: null,
  result: null,
};

export interface PublishDeckArgs {
  file: File;
  deck: RenderedDeck;
  meta: DeckMetadata;
}

/** Orchestrates upload → deck event → static nsite mirror, entirely in the browser. */
export function usePublishDeck() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { config } = useAppContext();
  const { t } = useTranslation();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const [state, setState] = useState<PublishState>(IDLE);

  const reset = useCallback(() => setState(IDLE), []);

  const publish = useCallback(
    async ({ file, deck, meta }: PublishDeckArgs) => {
      if (!user) return;
      const servers = getEffectiveBlossomServers(
        config.blossomServerMetadata,
        config.useAppBlossomServers,
      );

      const totalUploads = deck.pages.length + 2;
      const failed = new Set<string>();
      let uploaded = 0;
      setState({ ...IDLE, step: 'uploading', totalUploads });

      const track = (results: BlossomServerResult[]) => {
        for (const result of results) {
          if (!result.ok) failed.add(result.server);
        }
        uploaded += 1;
        setState((prev) => ({
          ...prev,
          uploaded,
          failedServers: Array.from(failed),
        }));
      };

      try {
        const pdfUpload = await uploadToServers({
          blob: file,
          name: file.name,
          type: 'application/pdf',
          servers,
          signer: user.signer,
        });
        track(pdfUpload.results);

        const thumbUpload = await uploadToServers({
          blob: deck.thumbnail,
          name: 'thumb.jpg',
          type: 'image/jpeg',
          servers,
          signer: user.signer,
        });
        track(thumbUpload.results);

        const pageUploads = [];
        for (const page of deck.pages) {
          const upload = await uploadToServers({
            blob: page.blob,
            name: `page-${String(page.pageNumber).padStart(3, '0')}.webp`,
            type: 'image/webp',
            servers,
            signer: user.signer,
          });
          track(upload.results);
          pageUploads.push({
            url: upload.url,
            sha256: upload.sha256,
            width: page.width,
            height: page.height,
          });
        }

        // Keep published_at stable when replacing an existing deck
        let publishedAt = Math.floor(Date.now() / 1000);
        try {
          const [prev] = await nostr.query(
            [{ kinds: [DECK_KIND], authors: [user.pubkey], '#d': [meta.slug], limit: 1 }],
            { signal: AbortSignal.timeout(3000) },
          );
          if (prev) {
            const prevPublishedAt = Number(prev.tags.find(([n]) => n === 'published_at')?.[1]);
            publishedAt = Number.isFinite(prevPublishedAt) ? prevPublishedAt : prev.created_at;
          }
        } catch {
          // No relay answer in time — treat as first publication
        }

        setState((prev) => ({ ...prev, step: 'publishing' }));

        const template = buildDeckEvent({
          identifier: meta.slug,
          title: meta.title,
          summary: meta.summary,
          imageUrl: thumbUpload.url,
          pdf: { url: pdfUpload.url, sha256: pdfUpload.sha256, size: file.size },
          pages: pageUploads,
          hashtags: parseHashtagInput(meta.hashtags),
          publishedAt,
        });
        const deckEvent = await publishEvent(template);

        const npub = nip19.npubEncode(user.pubkey);
        const result: PublishResult = {
          naddr: nip19.naddrEncode({
            kind: DECK_KIND,
            pubkey: user.pubkey,
            identifier: meta.slug,
          }),
          identifier: meta.slug,
          pubkey: user.pubkey,
          npub,
        };

        // Unified deck site (方針A): the deck becomes its own NIP-5A named site
        // (kind 35128, d = deck id) that serves the full interactive app, so the
        // share URL and the app URL are one and the same. Failures here must not
        // kill the publish — the deck is already live in-app.
        setState((prev) => ({ ...prev, step: 'mirroring' }));
        try {
          const gatewayUrl = deckGatewayUrl(user.pubkey, meta.slug);
          const pagePaths = pageUploads.map((_, i) => `pages/${String(i + 1).padStart(3, '0')}.webp`);

          // App code assets to mirror, from the canonical "slides" nsite build.
          const siteAssets = await fetchSiteAssets();
          await ensureAppAssets({
            assets: siteAssets.assets,
            servers,
            signer: user.signer,
            assetBase: siteAssets.assetBase,
          });

          const html = renderDeckAppHtml({
            title: meta.title,
            summary: meta.summary,
            canonicalUrl: gatewayUrl,
            ogImageUrl: `${gatewayUrl}thumb.jpg`,
            npub,
            deckId: meta.slug,
            pagePaths,
            scripts: siteAssets.scripts,
            styles: siteAssets.styles,
            deckEvent,
          });
          const htmlUpload = await uploadToServers({
            blob: new Blob([html], { type: 'text/html' }),
            name: 'index.html',
            type: 'text/html',
            servers,
            signer: user.signer,
          });

          const embedHtml = renderEmbedHtml({
            title: meta.title,
            canonicalUrl: gatewayUrl,
            pagePaths,
            fullscreenLabel: t('deck.fullscreen'),
          });
          const embedUpload = await uploadToServers({
            blob: new Blob([embedHtml], { type: 'text/html' }),
            name: 'embed.html',
            type: 'text/html',
            servers,
            signer: user.signer,
          });

          const deckPaths: SitePath[] = [
            { path: '/index.html', sha256: htmlUpload.sha256 },
            // Cold load / reload of in-app routes: the gateway resolves an
            // extensionless request via "<path>/index.html", so /upload gets the
            // SPA entry as text/html. (A bare "/upload" entry must NOT be used:
            // an extensionless exact match has no MIME type and the gateway
            // serves it as octet-stream — the browser downloads it instead.)
            { path: '/upload/index.html', sha256: htmlUpload.sha256 },
            // The gateway serves /404.html for any unknown path, giving every
            // other SPA route (e.g. /<npub>/<deck-id>) a working reload too.
            { path: '/404.html', sha256: htmlUpload.sha256 },
            { path: '/embed.html', sha256: embedUpload.sha256 },
            { path: '/thumb.jpg', sha256: thumbUpload.sha256 },
            ...pageUploads.map((page, i) => ({
              path: `/pages/${String(i + 1).padStart(3, '0')}.webp`,
              sha256: page.sha256,
            })),
            ...siteAssets.assets.map((asset) => ({ path: asset.path, sha256: asset.sha256 })),
          ];

          const manifest = await publishEvent(
            await buildNamedSiteManifest({
              identifier: meta.slug,
              paths: deckPaths,
              servers,
              title: meta.title,
              description: meta.summary || undefined,
            }),
          );

          // Gateways discover the user's Blossom servers via kind 10063;
          // publish one if the user has none yet.
          let serverList = null;
          if (config.blossomServerMetadata.updatedAt === 0) {
            serverList = await publishEvent(buildServerList(servers));
          }

          // Best-effort copies to the gateway ecosystem's lookup relays
          for (const event of [manifest, serverList]) {
            if (!event) continue;
            try {
              await nostr.event(event, {
                relays: LOOKUP_RELAYS,
                signal: AbortSignal.timeout(5000),
              });
            } catch {
              // Lookup relays are an optimization only
            }
          }

          result.gatewayUrl = gatewayUrl;
        } catch (err) {
          result.mirrorError = err instanceof Error ? err.message : String(err);
          // The UI only shows a generic warning; surface the real cause for debugging.
          console.error('Deck site mirror failed:', err);
        }

        setState((prev) => ({ ...prev, step: 'done', result }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          step: 'error',
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    },
    [
      user,
      config.blossomServerMetadata,
      config.useAppBlossomServers,
      nostr,
      publishEvent,
      t,
    ],
  );

  return { ...state, publish, reset };
}
