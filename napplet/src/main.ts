import './styles.css';
import { resolveOpenPayload, type OpenTarget } from './address';
import { loadDeckByAddress, loadDeckFromEvent, type DeckLoadResult } from './deck';
import { t, type MessageKey } from './i18n';
import { PageImageStore } from './images';
import { createBridge, type NapBridge } from './nap';
import { mountViewer } from './viewer';

const app = document.getElementById('app');
if (!app) throw new Error('#app missing');
const root: HTMLElement = app;

let unmount: (() => void) | null = null;
/** Increments on every open; stale async results check it before rendering. */
let generation = 0;

function clear(): void {
  unmount?.();
  unmount = null;
  root.textContent = '';
}

function stateShell(): HTMLElement {
  const state = document.createElement('div');
  state.className = 'state';
  const mark = document.createElement('div');
  mark.className = 'seal-mark';
  state.append(mark);
  root.append(state);
  return state;
}

function renderMessage(key: MessageKey, opts?: { retry?: () => void }): void {
  clear();
  const state = stateShell();
  const p = document.createElement('p');
  p.textContent = t(key);
  state.append(p);
  if (opts?.retry) {
    const button = document.createElement('button');
    button.textContent = t('retry');
    button.addEventListener('click', opts.retry);
    state.append(button);
  }
}

function renderWaiting(bridge: NapBridge, errorKey?: MessageKey): void {
  clear();
  const state = stateShell();
  const h1 = document.createElement('h1');
  h1.textContent = t('waitingTitle');
  const p = document.createElement('p');
  p.textContent = t('waitingBody');
  state.append(h1, p);

  if (errorKey) {
    const error = document.createElement('p');
    error.textContent = t(errorKey);
    error.style.color = 'var(--seal)';
    state.append(error);
  }

  // Manual entry doubles as the fallback for shells without intent delivery.
  const form = document.createElement('form');
  const input = document.createElement('input');
  input.placeholder = t('naddrPlaceholder');
  input.autocomplete = 'off';
  input.spellcheck = false;
  const button = document.createElement('button');
  button.type = 'submit';
  button.textContent = t('open');
  form.append(input, button);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = input.value.trim();
    if (value) open(bridge, resolveOpenPayload(value));
  });
  state.append(form);
}

function renderResult(bridge: NapBridge, result: DeckLoadResult, retry: () => void): void {
  if (result.status === 'ok') {
    clear();
    const images = new PageImageStore(result.deck.pages, (page) => bridge.fetchPageBlob(page));
    unmount = mountViewer(root, result.deck, {
      images,
      openPdf: bridge.openLink,
    });
    return;
  }
  if (result.status === 'not-found') renderMessage('notFound', { retry });
  else if (result.status === 'deleted') renderMessage('deleted');
  else renderMessage('malformed');
}

function open(bridge: NapBridge, target: OpenTarget): void {
  if (target.type === 'invalid') {
    renderWaiting(bridge, 'badAddress');
    return;
  }
  if (target.type === 'unsupported') {
    renderWaiting(bridge, 'unsupportedKind');
    return;
  }

  const thisGeneration = ++generation;
  renderMessage('loading');

  const load =
    target.type === 'address'
      ? loadDeckByAddress(bridge, target.pubkey, target.identifier)
      : loadDeckFromEvent(bridge, target.event);

  load.then(
    (result) => {
      if (thisGeneration !== generation) return;
      renderResult(bridge, result, () => open(bridge, target));
    },
    () => {
      if (thisGeneration !== generation) return;
      renderMessage('notFound', { retry: () => open(bridge, target) });
    },
  );
}

async function boot(): Promise<void> {
  if (import.meta.env.DEV && !window.napplet) {
    const { installMockShell } = await import('../dev/mock');
    installMockShell();
  }

  const bridge = createBridge();
  if (!bridge.hasCore) {
    renderMessage('shellMissing');
    return;
  }

  bridge.applyTheme((theme) => {
    const style = document.documentElement.style;
    if (theme.colors?.background) style.setProperty('--paper', theme.colors.background);
    if (theme.colors?.foreground) style.setProperty('--ink', theme.colors.foreground);
  });

  bridge.onOpenIntent((payload) => open(bridge, resolveOpenPayload(payload)));
  renderWaiting(bridge);
}

boot().catch(() => renderMessage('shellMissing'));
