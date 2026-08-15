import { useState } from 'react';
import { nip19 } from 'nostr-tools';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { LoginArea } from '@/components/auth/LoginArea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useDeckComments } from '@/hooks/useDeckComments';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { COMMENT_MAX_LENGTH, buildCommentEvent, parseComment, type DeckComment } from '@/lib/comment';
import { deckAddress, type Deck } from '@/lib/deckEvent';

function CommentItem({ comment }: { comment: DeckComment }) {
  const { i18n } = useTranslation();
  const author = useAuthor(comment.pubkey);
  const metadata = author.data?.metadata;
  const npub = nip19.npubEncode(comment.pubkey);
  const name = metadata?.name ?? `${npub.slice(0, 12)}…`;
  const when = new Date(comment.createdAt * 1000).toLocaleString(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <li className="flex gap-3 py-4">
      <Link to={`/${npub}`} className="shrink-0">
        <Avatar className="size-9 rounded-[3px]">
          <AvatarImage src={metadata?.picture} alt="" />
          <AvatarFallback className="rounded-[3px] font-display text-xs">{name.slice(0, 2)}</AvatarFallback>
        </Avatar>
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <Link
            to={`/${npub}`}
            className="truncate text-sm font-medium hover:underline"
          >
            {name}
          </Link>
          <span className="font-mono text-[10px] tracking-wider text-muted-foreground">{when}</span>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">
          {comment.content}
        </p>
      </div>
    </li>
  );
}

/** NIP-22 flat comment thread for a deck: a composer plus the list. */
export function CommentSection({ deck }: { deck: Deck }) {
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const { data: comments, isLoading } = useDeckComments(deck);
  const publish = useNostrPublish();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<DeckComment[]>([]);

  const address = deckAddress(deck);
  const trimmed = draft.trim();
  const tooLong = trimmed.length > COMMENT_MAX_LENGTH;

  // Merge just-posted comments so they appear before relays echo them back.
  const merged = [...(comments ?? []), ...pending];
  const seen = new Set<string>();
  const all = merged
    .filter((comment) => (seen.has(comment.id) ? false : seen.add(comment.id)))
    .sort((a, b) => a.createdAt - b.createdAt);

  const submit = async () => {
    if (!trimmed || tooLong || publish.isPending) return;
    try {
      const event = await publish.mutateAsync(buildCommentEvent(deck, trimmed));
      const posted = parseComment(event, address);
      if (posted) setPending((prev) => [...prev, posted]);
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['nostr', 'comments', address] });
    } catch {
      toast({ title: t('comments.failed'), variant: 'destructive' });
    }
  };

  return (
    <section className="mx-4 mt-10 border-t pt-6 sm:mx-6">
      <h2 className="font-display text-lg font-bold">
        {t('comments.title')}
        {all.length > 0 && <span className="ml-2 font-mono text-sm text-muted-foreground">{all.length}</span>}
      </h2>

      {user ? (
        <div className="mt-4">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t('comments.placeholder')}
            rows={3}
            className="resize-none"
          />
          <div className="mt-2 flex items-center justify-end gap-3">
            {tooLong && <span className="text-xs text-destructive">{t('comments.tooLong')}</span>}
            <Button
              size="sm"
              className="bg-seal text-seal-foreground hover:bg-seal/90"
              disabled={!trimmed || tooLong || publish.isPending}
              onClick={submit}
            >
              {publish.isPending ? t('comments.posting') : t('comments.submit')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-start gap-3 border border-dashed px-4 py-4">
          <p className="text-sm text-muted-foreground">{t('comments.loginToComment')}</p>
          <LoginArea />
        </div>
      )}

      {isLoading ? (
        <div className="mt-6 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-3/4" />
        </div>
      ) : all.length > 0 ? (
        <ul className="mt-4 divide-y">
          {all.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">{t('comments.empty')}</p>
      )}
    </section>
  );
}
