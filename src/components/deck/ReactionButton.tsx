import { useState } from 'react';
import { Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import AuthDialog from '@/components/auth/AuthDialog';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useDeckReactions } from '@/hooks/useDeckReactions';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useToast } from '@/hooks/useToast';
import { deckAddress, type Deck } from '@/lib/deckEvent';
import { buildLikeEvent } from '@/lib/reaction';
import { cn } from '@/lib/utils';

/** NIP-25 like button for a deck. Like-only — no un-like in this MVP. */
export function ReactionButton({ deck }: { deck: Deck }) {
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const { data } = useDeckReactions(deck);
  const publish = useNostrPublish();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [authOpen, setAuthOpen] = useState(false);
  const [justLiked, setJustLiked] = useState(false);

  const likedByServer = Boolean(user && data?.likers.has(user.pubkey));
  const liked = likedByServer || justLiked;
  const count = (data?.count ?? 0) + (justLiked && !likedByServer ? 1 : 0);

  const like = async () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    if (liked || publish.isPending) return;
    try {
      setJustLiked(true);
      await publish.mutateAsync(buildLikeEvent(deck));
      queryClient.invalidateQueries({ queryKey: ['nostr', 'reactions', deckAddress(deck)] });
    } catch {
      setJustLiked(false);
      toast({ title: t('reactions.failed'), variant: 'destructive' });
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={like}
        disabled={publish.isPending}
        aria-pressed={liked}
        aria-label={t('reactions.like')}
      >
        <Heart className={cn('size-4', liked && 'fill-seal text-seal')} aria-hidden />
        <span className="font-mono text-xs tabular-nums">{count}</span>
      </Button>
      <AuthDialog isOpen={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
