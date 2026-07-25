import { useState } from 'react';
import { Check, Copy, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CropMarks } from '@/components/CropMarks';
import { LoginArea } from '@/components/auth/LoginArea';
import { SealMark } from '@/components/layout/SealMark';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { usePdfPages } from '@/hooks/usePdfPages';
import { usePublishDeck, type PublishResult } from '@/hooks/usePublishDeck';
import { asciiSlug, isValidDeckId, randomDeckId } from '@/lib/deckId';
import { cn } from '@/lib/utils';
import { DeckMetadataForm, type DeckMetadata } from './DeckMetadataForm';

type PdfPages = ReturnType<typeof usePdfPages>;

function titleFromFile(file: File | null): string {
  if (!file) return '';
  return file.name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').trim();
}

function folio(n: number): string {
  return String(n).padStart(2, '0');
}

function PublishSuccess({
  result,
  onNew,
}: {
  result: PublishResult;
  onNew: () => void;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const copyLink = async (value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
  };

  return (
    <section className="container flex flex-col items-center gap-6 py-24 text-center">
      <SealMark className="size-14 text-2xl" />
      <h1 className="font-display text-3xl font-bold">{t('publish.successTitle')}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{t('publish.successDesc')}</p>

      {result.gatewayUrl ? (
        <div className="flex w-full max-w-xl flex-col items-center gap-2">
          <div className="flex w-full items-center gap-2 border bg-card p-2">
            <code className="min-w-0 flex-1 truncate text-left font-mono text-xs">
              {result.gatewayUrl}
            </code>
            <Button
              size="sm"
              className="shrink-0 bg-seal text-seal-foreground hover:bg-seal/90"
              onClick={() => copyLink(result.gatewayUrl!)}
            >
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? t('publish.copied') : t('publish.copyLink')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t('publish.gatewayDelay')}</p>
        </div>
      ) : (
        result.mirrorError && (
          <p className="max-w-md text-xs text-destructive">{t('publish.mirrorWarning')}</p>
        )
      )}

      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <Button asChild variant={result.gatewayUrl ? 'outline' : 'default'}>
          <Link to={`/${result.npub}/${result.identifier}`}>{t('publish.openDeck')}</Link>
        </Button>
      </div>
      <Button variant="ghost" onClick={onNew}>
        <RotateCcw className="size-4" aria-hidden />
        {t('publish.publishAnother')}
      </Button>
    </section>
  );
}

/** Render with a `key` derived from the file so state reseeds per file. */
export function PublishSection({ pdf, onReset }: { pdf: PdfPages; onReset: () => void }) {
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const pub = usePublishDeck();
  const [selected, setSelected] = useState(1);
  const [slugTouched, setSlugTouched] = useState(false);
  const [meta, setMeta] = useState<DeckMetadata>(() => {
    const title = titleFromFile(pdf.file);
    return { title, summary: '', hashtags: '', slug: asciiSlug(title) || randomDeckId() };
  });

  const handleMetaChange = (next: DeckMetadata) => {
    if (!slugTouched && next.title !== meta.title) {
      const derived = asciiSlug(next.title);
      if (derived) next = { ...next, slug: derived };
    }
    setMeta(next);
  };

  if (pdf.status === 'rendering') {
    const { done, total } = pdf.progress;
    return (
      <section className="container flex flex-col items-center gap-6 py-24">
        <p className="font-display text-2xl font-semibold">{t('publish.rendering')}</p>
        <p className="font-mono text-sm tracking-widest text-muted-foreground">
          {folio(done)} / {total > 0 ? folio(total) : '--'}
        </p>
        <Progress value={total > 0 ? (done / total) * 100 : 0} className="max-w-md" />
      </section>
    );
  }

  if (pdf.status === 'error') {
    return (
      <section className="container flex flex-col items-center gap-4 py-24 text-center">
        <p className="font-display text-2xl font-semibold">{t('publish.errorTitle')}</p>
        {pdf.errorKind === 'password' && (
          <p className="text-sm text-muted-foreground">{t('publish.errorPassword')}</p>
        )}
        <Button variant="outline" onClick={onReset}>
          <RotateCcw className="size-4" aria-hidden />
          {t('publish.tryAgain')}
        </Button>
      </section>
    );
  }

  if (pub.step === 'done' && pub.result) {
    return (
      <PublishSuccess
        result={pub.result}
        onNew={() => {
          pub.reset();
          onReset();
        }}
      />
    );
  }

  const current = pdf.previews.find((p) => p.pageNumber === selected) ?? pdf.previews[0];
  const total = pdf.previews.length;
  const busy = pub.step === 'uploading' || pub.step === 'publishing' || pub.step === 'mirroring';
  const canPublish =
    !busy &&
    pdf.status === 'ready' &&
    pdf.deck !== null &&
    pdf.file !== null &&
    meta.title.trim().length > 0 &&
    isValidDeckId(meta.slug);

  const handlePublish = () => {
    if (!pdf.deck || !pdf.file) return;
    pub.publish({ file: pdf.file, deck: pdf.deck, meta });
  };

  return (
    <section className="container grid gap-10 py-10 lg:grid-cols-12 lg:gap-14">
      <div className="order-2 lg:order-1 lg:col-span-4">
        <h1 className="font-display text-2xl font-bold">{t('publish.formTitle')}</h1>
        <div className="mt-6">
          <DeckMetadataForm
            value={meta}
            onChange={handleMetaChange}
            onSlugEdited={() => setSlugTouched(true)}
          />
        </div>
        <div className="mt-8 space-y-3">
          {user ? (
            <Button
              className="w-full bg-seal text-seal-foreground hover:bg-seal/90"
              disabled={!canPublish}
              onClick={handlePublish}
            >
              {pub.step === 'error' ? t('publish.retry') : t('publish.publishButton')}
            </Button>
          ) : (
            <div className="flex flex-col items-center gap-2 border border-dashed p-4">
              <p className="text-center text-xs text-muted-foreground">
                {t('publish.loginToPublish')}
              </p>
              <LoginArea />
            </div>
          )}

          {pub.step === 'uploading' && (
            <div className="space-y-2">
              <p className="text-center font-mono text-xs text-muted-foreground">
                {t('publish.uploading', { done: pub.uploaded, total: pub.totalUploads })}
              </p>
              <Progress value={(pub.uploaded / Math.max(pub.totalUploads, 1)) * 100} />
            </div>
          )}
          {pub.step === 'publishing' && (
            <p className="text-center font-mono text-xs text-muted-foreground">
              {t('publish.publishing')}
            </p>
          )}
          {pub.step === 'mirroring' && (
            <p className="text-center font-mono text-xs text-muted-foreground">
              {t('publish.mirroring')}
            </p>
          )}
          {pub.step === 'error' && (
            <p className="text-center text-xs text-destructive">
              {t('publish.publishFailed')}
              {pub.error ? ` — ${pub.error}` : ''}
            </p>
          )}
          {pub.failedServers.length > 0 && pub.step !== 'error' && (
            <p className="text-center text-xs text-muted-foreground">
              {t('publish.serverWarning', { servers: pub.failedServers.join(', ') })}
            </p>
          )}

          <Button variant="ghost" className="w-full" onClick={onReset} disabled={busy}>
            <RotateCcw className="size-4" aria-hidden />
            {t('publish.startOver')}
          </Button>
        </div>
      </div>

      <div className="order-1 lg:order-2 lg:col-span-8">
        {current && (
          <div className="relative mx-4 my-4 sm:mx-6">
            <CropMarks />
            <div className="relative bg-card shadow-[0_12px_32px_-16px_rgb(28_26_23/0.35)]">
              <img
                src={current.url}
                alt={`${meta.title} — ${current.pageNumber}`}
                className="block w-full"
              />
            </div>
            <p className="mt-2 text-right font-mono text-[10px] tracking-widest text-muted-foreground">
              {folio(current.pageNumber)} / {folio(total)}
            </p>
          </div>
        )}

        <h2 className="mt-6 border-b pb-2 font-mono text-xs uppercase tracking-[0.25em] text-muted-foreground">
          {t('publish.pages')} — {total}
        </h2>
        <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {pdf.previews.map((page) => (
            <li key={page.pageNumber}>
              <button
                type="button"
                onClick={() => setSelected(page.pageNumber)}
                className={cn(
                  'block w-full border bg-card outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring',
                  page.pageNumber === current?.pageNumber
                    ? 'border-seal ring-1 ring-seal'
                    : 'border-border hover:border-muted-foreground',
                )}
              >
                <img src={page.url} alt={String(page.pageNumber)} className="block w-full" />
              </button>
              <p className="mt-1 text-center font-mono text-[10px] text-muted-foreground">
                {folio(page.pageNumber)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
