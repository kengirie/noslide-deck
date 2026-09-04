import { useTranslation } from 'react-i18next';
import { useSeoMeta } from '@unhead/react';
import { AppLayout } from '@/components/layout/AppLayout';
import { DeckCard } from '@/components/deck/DeckCard';
import { PdfDropZone } from '@/components/publish/PdfDropZone';
import { PublishSection } from '@/components/publish/PublishSection';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useDeckFeed } from '@/hooks/useDeckFeed';
import { usePdfPages } from '@/hooks/usePdfPages';

const FEATURES = ['cards', 'viewer', 'embeds'] as const;

function FeedSection({ title, author, showEmpty }: { title: string; author?: string; showEmpty?: boolean }) {
  const { t } = useTranslation();
  const feed = useDeckFeed(author);
  const decks = feed.data ?? [];

  if (!feed.isLoading && decks.length === 0 && !showEmpty) return null;

  return (
    <section className="container pb-16">
      <h2 className="border-b-2 border-foreground pb-2 font-mono text-xs uppercase tracking-[0.25em]">
        {title}
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
          {t('feed.empty')}
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

const Index = () => {
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const pdf = usePdfPages();

  useSeoMeta({
    // Keep the home tab to just the brand name; deck/profile tabs still suffix it.
    title: t('app.name'),
    description: t('hero.lead'),
  });

  return (
    <AppLayout>
      {pdf.status === 'idle' ? (
        <>
        <section className="container grid items-center gap-10 py-12 md:py-20 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-5">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-seal">
              {t('hero.eyebrow')}
            </p>
            <h1 className="mt-4 font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              {t('hero.title')}
            </h1>
            <p className="mt-6 max-w-prose text-base leading-relaxed text-muted-foreground">
              {t('hero.lead')}
            </p>
            <ul className="mt-8 border-t">
              {FEATURES.map((key) => (
                <li key={key} className="border-b py-3 text-sm">
                  {t(`features.${key}`)}
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-7">
            <PdfDropZone onFile={pdf.start} />
          </div>
        </section>
        {user && <FeedSection title={t('feed.mine')} author={user.pubkey} />}
        <FeedSection title={t('feed.recent')} showEmpty />
        </>
      ) : (
        <PublishSection
          key={pdf.file ? `${pdf.file.name}:${pdf.file.size}:${pdf.file.lastModified}` : 'none'}
          pdf={pdf}
          onReset={pdf.reset}
        />
      )}
    </AppLayout>
  );
};

export default Index;
