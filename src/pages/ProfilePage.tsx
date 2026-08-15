import { ExternalLink } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSeoMeta } from '@unhead/react';
import { AppLayout } from '@/components/layout/AppLayout';
import { DeckCard } from '@/components/deck/DeckCard';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthor } from '@/hooks/useAuthor';
import { useDeckFeed } from '@/hooks/useDeckFeed';
import { profileUrl } from '@/lib/siteConfig';
import NotFound from './NotFound';

function ProfileHeader({ pubkey, npub }: { pubkey: string; npub: string }) {
  const { t } = useTranslation();
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;
  const name = metadata?.display_name || metadata?.name || `${npub.slice(0, 12)}…`;

  useSeoMeta({
    title: `${name} — ${t('app.name')}`,
    description: metadata?.about || undefined,
    ogTitle: name,
    ogDescription: metadata?.about || undefined,
    ogImage: metadata?.picture,
  });

  return (
    <header className="container max-w-5xl pt-10">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar className="size-16 rounded-[3px]">
            <AvatarImage src={metadata?.picture} alt="" />
            <AvatarFallback className="rounded-[3px] font-display text-lg">
              {name.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="break-words font-display text-2xl font-bold leading-snug sm:text-3xl [overflow-wrap:anywhere]">
              {name}
            </h1>
            <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
              {npub.slice(0, 20)}…
            </p>
          </div>
        </div>

        <Button asChild variant="outline" size="sm" className="shrink-0">
          <a href={profileUrl(npub)} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" aria-hidden />
            {t('profile.viewOnLumilumi')}
          </a>
        </Button>
      </div>

      {metadata?.about && (
        <p className="mt-5 max-w-prose whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">
          {metadata.about}
        </p>
      )}
    </header>
  );
}

function ProfileDecks({ pubkey }: { pubkey: string }) {
  const { t } = useTranslation();
  const feed = useDeckFeed(pubkey);
  const decks = feed.data ?? [];

  return (
    <section className="container max-w-5xl py-10">
      <h2 className="border-b-2 border-foreground pb-2 font-mono text-xs uppercase tracking-[0.25em]">
        {t('profile.decks')}
      </h2>
      {feed.isLoading ? (
        <div className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i}>
              <Skeleton className="aspect-video w-full" />
              <Skeleton className="mt-3 h-5 w-3/4" />
            </div>
          ))}
        </div>
      ) : decks.length === 0 ? (
        <div className="mt-6 border border-dashed p-10 text-center text-sm text-muted-foreground">
          {t('profile.empty')}
        </div>
      ) : (
        <>
          <ul className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map((deck) => (
              <li key={`${deck.pubkey}:${deck.identifier}`} className="min-w-0">
                <DeckCard deck={deck} />
              </li>
            ))}
          </ul>
          {feed.hasNextPage && (
            <div className="mt-8 text-center">
              <Button
                variant="outline"
                onClick={() => feed.fetchNextPage()}
                disabled={feed.isFetchingNextPage}
              >
                {t('feed.more')}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/**
 * A user's in-app profile: their metadata, a link out to lumilumi, and the grid
 * of decks they've published. `pubkey` is passed in by the NIP-19 dispatcher
 * (npub/nprofile), but it can also decode a `:npub` route param on its own.
 */
const ProfilePage = ({ pubkey: pubkeyProp }: { pubkey?: string } = {}) => {
  const params = useParams<{ npub: string }>();

  let pubkey = pubkeyProp;
  if (!pubkey && params.npub) {
    try {
      const decoded = nip19.decode(params.npub);
      if (decoded.type === 'npub') pubkey = decoded.data;
      else if (decoded.type === 'nprofile') pubkey = decoded.data.pubkey;
    } catch {
      // fall through to NotFound
    }
  }

  if (!pubkey) return <NotFound />;

  const npub = nip19.npubEncode(pubkey);

  return (
    <AppLayout>
      <ProfileHeader pubkey={pubkey} npub={npub} />
      <ProfileDecks pubkey={pubkey} />
    </AppLayout>
  );
};

export default ProfilePage;
