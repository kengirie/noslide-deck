import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DECK_ID_MAX_LENGTH, isValidDeckId } from '@/lib/deckId';
import { cn } from '@/lib/utils';

export interface DeckMetadata {
  title: string;
  summary: string;
  /** Raw hashtag input, whitespace/comma separated */
  hashtags: string;
  /** The `d` identifier of the deck */
  slug: string;
}

interface DeckMetadataFormProps {
  value: DeckMetadata;
  onChange: (next: DeckMetadata) => void;
}

export function DeckMetadataForm({ value, onChange }: DeckMetadataFormProps) {
  const { t } = useTranslation();
  const slugInvalid = value.slug.length > 0 && !isValidDeckId(value.slug);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="deck-title">{t('publish.title')}</Label>
        <Input
          id="deck-title"
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="deck-summary">{t('publish.summary')}</Label>
        <Textarea
          id="deck-summary"
          rows={3}
          value={value.summary}
          onChange={(e) => onChange({ ...value, summary: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="deck-hashtags">{t('publish.hashtags')}</Label>
        <Input
          id="deck-hashtags"
          value={value.hashtags}
          onChange={(e) => onChange({ ...value, hashtags: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">{t('publish.hashtagsHint')}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="deck-slug">{t('publish.slug')}</Label>
        <Input
          id="deck-slug"
          className="font-mono"
          maxLength={DECK_ID_MAX_LENGTH}
          value={value.slug}
          onChange={(e) => onChange({ ...value, slug: e.target.value.toLowerCase() })}
          aria-invalid={slugInvalid}
        />
        <p className={cn('text-xs', slugInvalid ? 'text-destructive' : 'text-muted-foreground')}>
          {t('publish.slugHint')}
        </p>
      </div>
    </div>
  );
}
