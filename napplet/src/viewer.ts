import type { Deck } from '../../src/lib/deckEvent';
import type { PageImageStore } from './images';
import { t } from './i18n';

export interface ViewerDeps {
  images: PageImageStore;
  /** Present only when the shell provides the `link` domain. */
  openPdf?: (url: string) => void;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  // Deck fields are attacker-controlled event data: textContent only, never innerHTML.
  if (text !== undefined) node.textContent = text;
  return node;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function mountViewer(root: HTMLElement, deck: Deck, deps: ViewerDeps): () => void {
  root.textContent = '';

  const viewer = el('div', 'viewer');
  const stage = el('div', 'stage');
  const img = el('img', 'slide');
  img.alt = deck.title;
  const pageError = el('div', 'page-error hidden', t('pageImageFailed'));
  stage.append(img, pageError);

  const bar = el('div', 'bar');
  const nav = el('span', 'nav');
  const prev = el('button', undefined, '‹');
  prev.setAttribute('aria-label', t('prev'));
  const next = el('button', undefined, '›');
  next.setAttribute('aria-label', t('next'));
  const folio = el('span', 'folio');
  nav.append(prev, next, folio);
  const title = el('span', 'deck-title', deck.title);
  bar.append(nav, title);

  if (deps.openPdf) {
    const pdf = el('button', 'pdf', `${t('downloadPdf')} ⤓`);
    pdf.addEventListener('click', (e) => {
      e.stopPropagation();
      deps.openPdf?.(deck.pdf.url);
    });
    bar.append(pdf);
  }

  viewer.append(stage, bar);
  root.append(viewer);

  const first = deck.pages[0];
  if (first?.width && first.height) {
    img.style.aspectRatio = `${first.width} / ${first.height}`;
  }

  let index = 0;

  function render(): void {
    const current = index;
    folio.textContent = `${pad(current + 1)} / ${pad(deck.pages.length)}`;
    prev.disabled = current <= 0;
    next.disabled = current >= deck.pages.length - 1;

    deps.images.focus(current);
    pageError.classList.add('hidden');
    img.classList.add('pending');
    deps.images.get(current).then(
      (url) => {
        if (index !== current) return;
        img.src = url;
        img.classList.remove('pending');
      },
      () => {
        if (index !== current) return;
        pageError.classList.remove('hidden');
      },
    );

    // Preload neighbors; failures surface when the page is actually shown.
    for (const neighbor of [current - 1, current + 1]) {
      if (neighbor >= 0 && neighbor < deck.pages.length) {
        deps.images.get(neighbor).catch(() => {});
      }
    }
  }

  function go(delta: number): void {
    const target = index + delta;
    if (target < 0 || target >= deck.pages.length) return;
    index = target;
    render();
  }

  prev.addEventListener('click', (e) => {
    e.stopPropagation();
    go(-1);
  });
  next.addEventListener('click', (e) => {
    e.stopPropagation();
    go(1);
  });
  // Same zones as the site viewer: left third goes back, the rest advances.
  stage.addEventListener('click', (e) => {
    const rect = stage.getBoundingClientRect();
    go(e.clientX - rect.left < rect.width / 3 ? -1 : 1);
  });

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'ArrowRight') go(1);
    if (e.key === 'ArrowLeft') go(-1);
  }
  document.addEventListener('keydown', onKeydown);

  render();

  return () => {
    document.removeEventListener('keydown', onKeydown);
    deps.images.dispose();
    root.textContent = '';
  };
}
