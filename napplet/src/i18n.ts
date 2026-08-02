/**
 * Mini i18n for the napplet. The sandbox has no localStorage (NIP-5D forbids
 * `allow-same-origin`), so there is no persisted language toggle — we follow
 * `navigator.language` only. i18next stays out of the single-file bundle.
 */
const en = {
  waitingTitle: 'Kamishibai Viewer',
  waitingBody: 'Open a slide deck from your shell, or paste an naddr below.',
  naddrPlaceholder: 'naddr1…',
  open: 'Open',
  loading: 'Loading deck…',
  notFound: 'Deck not found on the relays.',
  deleted: 'This deck was deleted by its author.',
  malformed: 'This deck event is malformed and cannot be displayed.',
  unsupportedKind: 'This viewer only displays Kamishibai slide decks (kind 35891).',
  badAddress: 'That address is not a Kamishibai slide deck.',
  shellMissing: 'This shell does not provide the capabilities the viewer needs (outbox, resource).',
  retry: 'Retry',
  downloadPdf: 'PDF',
  pageImageFailed: 'Failed to load this page.',
  prev: 'Previous page',
  next: 'Next page',
};

const ja: typeof en = {
  waitingTitle: '紙芝居ビューア',
  waitingBody: 'シェルからスライドデッキを開くか、naddr を貼り付けてください。',
  naddrPlaceholder: 'naddr1…',
  open: '開く',
  loading: 'デッキを読み込み中…',
  notFound: 'リレー上にデッキが見つかりませんでした。',
  deleted: 'このデッキは作者によって削除されました。',
  malformed: 'このデッキのイベントが壊れているため表示できません。',
  unsupportedKind: 'このビューアは紙芝居のスライドデッキ(kind 35891)専用です。',
  badAddress: 'このアドレスは紙芝居のスライドデッキではありません。',
  shellMissing: 'このシェルはビューアに必要な機能(outbox, resource)を提供していません。',
  retry: '再試行',
  downloadPdf: 'PDF',
  pageImageFailed: 'このページの読み込みに失敗しました。',
  prev: '前のページ',
  next: '次のページ',
};

export type MessageKey = keyof typeof en;

const lang: 'en' | 'ja' = navigator.language?.toLowerCase().startsWith('ja') ? 'ja' : 'en';
const dict = lang === 'ja' ? ja : en;

export function t(key: MessageKey): string {
  return dict[key] ?? en[key] ?? key;
}

export function currentLang(): 'en' | 'ja' {
  return lang;
}
