import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useDeleteDeck } from '@/hooks/useDeleteDeck';
import { useToast } from '@/hooks/useToast';
import type { Deck } from '@/lib/deckEvent';

/** Owner-only deck deletion with a confirmation dialog. */
export function DeleteDeckButton({ deck }: { deck: Deck }) {
  const { t } = useTranslation();
  const { user } = useCurrentUser();
  const del = useDeleteDeck();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!user || user.pubkey !== deck.pubkey) return null;

  const busy = del.step === 'collecting' || del.step === 'requesting' || del.step === 'purging';

  const run = async () => {
    const { ok, failedBlobs } = await del.deleteDeck(deck);
    if (!ok) return; // dialog stays open showing the error, button becomes retry
    setOpen(false);
    toast({
      title: t('deck.deleted'),
      description: failedBlobs > 0 ? t('deck.deletePartial', { count: failedBlobs }) : undefined,
    });
    navigate('/');
  };

  const progressLabel =
    del.step === 'purging'
      ? t('deck.deletePurging', { done: del.purged, total: del.totalBlobs })
      : t('deck.deleteRequesting');

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return; // no closing mid-flight
        setOpen(next);
        if (!next) del.reset();
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
          <Trash2 className="size-4" aria-hidden />
          {t('deck.delete')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('deck.deleteConfirmTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('deck.deleteConfirmDesc')}</AlertDialogDescription>
        </AlertDialogHeader>

        {busy && (
          <p className="text-center font-mono text-xs text-muted-foreground">{progressLabel}</p>
        )}
        {del.step === 'error' && (
          <p className="text-center text-xs text-destructive">
            {t('deck.deleteFailed')}
            {del.error ? ` — ${del.error}` : ''}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{t('deck.deleteCancel')}</AlertDialogCancel>
          <Button
            className="bg-seal text-seal-foreground hover:bg-seal/90"
            disabled={busy}
            onClick={run}
          >
            {del.step === 'error' ? t('publish.retry') : t('deck.deleteConfirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
