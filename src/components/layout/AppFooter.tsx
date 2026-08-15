import { useTranslation } from 'react-i18next';

export function AppFooter() {
  const { t } = useTranslation();

  return (
    <footer className="border-t">
      <div className="container flex flex-col gap-3 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-sm text-muted-foreground">{t('footer.note')}</p>
        <a
          href="https://github.com/kengirie/noslide-deck"
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
        >
          {t('footer.source')} ↗
        </a>
      </div>
    </footer>
  );
}
