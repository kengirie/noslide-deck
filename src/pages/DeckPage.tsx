import { useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSeoMeta } from '@unhead/react';
import { AppLayout } from '@/components/layout/AppLayout';
import { SlideViewer } from '@/components/deck/SlideViewer';
import { ZapButton } from '@/components/ZapButton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthor } from '@/hooks/useAuthor';
import { useDeck } from '@/hooks/useDeck';
import type { Deck } from '@/lib/deckEvent';
import { deckGatewayUrl } from '@/lib/siteConfig';
import NotFound from './NotFound';

/** X's intent logo is overkill — a simple label button matches the print look. */
function SharePanel({ deck }: { deck: Deck }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<'link' | 'embed' | null>(null);
  const shareUrl = deckGatewayUrl(deck.pubkey, deck.identifier);
  const intentUrl = `https://x.com/intent/post?text=${encodeURIComponent(deck.title)}&url=${encodeURIComponent(shareUrl)}`;
  const embedCode = `<iframe src="${shareUrl}embed.html" width="640" height="390" style="border:0;max-width:100%;" allowfullscreen title="${deck.title.replaceAll('"', '&quot;')}"></iframe>`;

  const copy = async (kind: 'link' | 'embed', value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button variant="outline" size="sm" onClick={() => copy('link', shareUrl)}>
        {copied === 'link' ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        {copied === 'link' ? t('publish.copied') : t('publish.copyLink')}
      </Button>
      <Button variant="outline" size="sm" onClick={() => copy('embed', embedCode)}>
        {copied === 'embed' ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        {copied === 'embed' ? t('publish.copied') : t('deck.copyEmbed')}
      </Button>
      <Button asChild variant="outline" size="sm">
        <a href={intentUrl} target="_blank" rel="noreferrer">
          {t('deck.shareOnX')}
        </a>
      </Button>
    </div>
  );
}

function AuthorCard({ pubkey }: { pubkey: string }) {
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;
  const npub = nip19.npubEncode(pubkey);
  const name = metadata?.name ?? `${npub.slice(0, 12)}…`;

  return (
    <Link to={`/${npub}`} className="flex items-center gap-3">
      <Avatar className="size-10 rounded-[3px]">
        <AvatarImage src={metadata?.picture} alt="" />
        <AvatarFallback className="rounded-[3px] font-display">{name.slice(0, 2)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{name}</span>
        <span className="block truncate font-mono text-[10px] text-muted-foreground">
          {npub.slice(0, 16)}…
        </span>
      </span>
    </Link>
  );
}

function DeckArticle({ deck }: { deck: Deck }) {
  const { t, i18n } = useTranslation();

  useSeoMeta({
    title: `${deck.title} — ${t('app.name')}`,
    description: deck.summary || undefined,
    ogTitle: deck.title,
    ogDescription: deck.summary || undefined,
    ogImage: deck.image,
  });

  const published = deck.publishedAt
    ? new Date(deck.publishedAt * 1000).toLocaleDateString(i18n.language, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <article className="container max-w-5xl py-8">
      <SlideViewer deck={deck} />

      <div className="mx-4 mt-8 border-t pt-6 sm:mx-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold leading-snug sm:text-3xl">
              {deck.title}
            </h1>
            {deck.summary && (
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
                {deck.summary}
              </p>
            )}
            <p className="mt-3 font-mono text-[11px] tracking-wider text-muted-foreground">
              {published && <span>{published} ・ </span>}
              {t('deck.pageCount', { count: deck.pages.length })}
            </p>
            {deck.hashtags.length > 0 && (
              <p className="mt-2 flex flex-wrap gap-2">
                {deck.hashtags.map((tag) => (
                  <span key={tag} className="font-mono text-xs text-seal">
                    #{tag}
                  </span>
                ))}
              </p>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-start gap-4 sm:items-end">
            <AuthorCard pubkey={deck.pubkey} />
            <div className="flex items-center gap-2">
              <ZapButton target={deck.event} className="text-seal" showCount />
              <Button asChild variant="outline" size="sm">
                <a href={deck.pdf.url} download target="_blank" rel="noreferrer">
                  <Download className="size-4" aria-hidden />
                  {t('deck.downloadPdf')}
                </a>
              </Button>
            </div>
            <SharePanel deck={deck} />
          </div>
        </div>
      </div>
    </article>
  );
}

const DeckPage = () => {
  const { t } = useTranslation();
  const { npub, deckId } = useParams<{ npub: string; deckId: string }>();

  let pubkey: string | undefined;
  try {
    const decoded = npub ? nip19.decode(npub) : null;
    if (decoded?.type === 'npub') pubkey = decoded.data;
  } catch {
    // fall through to NotFound
  }

  const { data: deck, isLoading } = useDeck(pubkey, deckId);

  if (!pubkey || !deckId) return <NotFound />;

  return (
    <AppLayout>
      {isLoading ? (
        <div className="container max-w-5xl py-8">
          <div className="mx-4 my-4 sm:mx-6">
            <Skeleton className="aspect-video w-full" />
            <Skeleton className="mt-8 h-8 w-2/3" />
            <Skeleton className="mt-3 h-4 w-1/2" />
          </div>
        </div>
      ) : deck ? (
        <DeckArticle deck={deck} />
      ) : (
        <div className="container flex flex-col items-center gap-3 py-24">
          <div className="flex flex-col items-center gap-2 border border-dashed px-12 py-10 text-center">
            <p className="font-display text-xl font-semibold">{t('deck.notFoundTitle')}</p>
            <p className="max-w-sm text-sm text-muted-foreground">{t('deck.notFoundDesc')}</p>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default DeckPage;
