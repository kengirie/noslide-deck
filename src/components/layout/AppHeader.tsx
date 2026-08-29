import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LoginArea } from '@/components/auth/LoginArea';
import { getDeckSiteTarget } from '@/lib/siteConfig';
import { LanguageToggle } from './LanguageToggle';
import { ThemeToggle } from './ThemeToggle';

export function AppHeader() {
  const { t } = useTranslation();

  // The logo is "home". On the normal hosts home ("/") is already the upload
  // page. On a deck's own nsite "/" boots the deck, so send the logo to the
  // dedicated upload route instead — that's the way to start a new deck there.
  const homeHref = getDeckSiteTarget() ? '/upload' : '/';

  return (
    <header className="border-b-2 border-foreground">
      {/* flex-wrap: the controls drop to a second row on narrow screens */}
      <div className="container flex min-h-16 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
        <Link to={homeHref} className="flex min-w-0 items-center gap-3">
          <span className="min-w-0">
            <span className="block whitespace-nowrap font-display text-xl font-bold leading-none tracking-wide">
              {t('app.name')}
            </span>
            <span className="mt-1 hidden font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground sm:block">
              {t('app.tagline')}
            </span>
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-1 sm:gap-3">
          <LanguageToggle />
          <ThemeToggle />
          <LoginArea />
        </div>
      </div>
    </header>
  );
}
