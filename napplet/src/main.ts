import './styles.css';
import { parseDeckEvent } from '../../src/lib/deckEvent';
import { PageImageStore } from './images';
import { mountViewer } from './viewer';
import { t } from './i18n';

const app = document.getElementById('app');
if (!app) throw new Error('#app missing');

function renderMessage(text: string): void {
  app!.textContent = '';
  const state = document.createElement('div');
  state.className = 'state';
  const mark = document.createElement('div');
  mark.className = 'seal-mark';
  const p = document.createElement('p');
  p.textContent = text;
  state.append(mark, p);
  app!.append(state);
}

async function boot(): Promise<void> {
  if (import.meta.env.DEV && !window.napplet) {
    const { installMockShell } = await import('../dev/mock');
    installMockShell();
  }

  const outbox = window.napplet?.outbox;
  const resource = window.napplet?.resource;
  if (!outbox || !resource) {
    renderMessage(t('shellMissing'));
    return;
  }

  renderMessage(t('loading'));
  const result = await outbox.query([{ kinds: [35891], limit: 1 }]);
  const events = Array.isArray(result) ? result : result.events;
  const raw = events[0];
  const event = raw && 'event' in raw ? raw.event : raw;
  const deck = event ? parseDeckEvent(event) : null;
  if (!deck) {
    renderMessage(t('notFound'));
    return;
  }

  const images = new PageImageStore(deck.pages, (page) => resource.bytes(page.url));
  mountViewer(app!, deck, { images });
}

boot().catch(() => renderMessage(t('notFound')));
