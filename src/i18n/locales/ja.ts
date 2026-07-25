import type { en } from './en';

type Translation = { [K in keyof typeof en]: Record<keyof (typeof en)[K], string> };

export const ja: Translation = {
  app: {
    name: 'nostr slide deck',
    tagline: 'Nostrのスライド共有',
  },
  hero: {
    eyebrow: 'Nostrのスライド共有',
    title: 'PDFを置くだけ。共有できるスライドページに。',
    lead: 'リンクを貼れば1枚目がカードで開く。読む人はページをめくり、zapで応援できる。アカウント登録は不要 — Nostrの鍵があなたです。',
    dropTitle: 'ここにPDFをドロップ',
    dropHint: 'クリックしてファイルを選ぶこともできます',
  },
  features: {
    cards: 'X・Slackでカード展開',
    viewer: 'ページ送りビューア',
    zaps: '発表者へ直接zap',
  },
  publish: {
    rendering: '組版中…',
    formTitle: 'デッキ情報',
    title: 'タイトル',
    summary: '概要',
    hashtags: 'ハッシュタグ',
    hashtagsHint: '空白区切りで入力',
    slug: 'デッキID',
    slugHint: '小文字英数字とハイフン、13文字まで',
    publishButton: '公開する',
    startOver: 'やり直す',
    pages: 'ページ',
    loginToPublish: '公開にはNostrの鍵でログインしてください',
    uploading: 'アップロード中 {{done}} / {{total}}…',
    publishing: 'リレーに発行中…',
    publishFailed: '公開に失敗しました',
    retry: '再試行',
    serverWarning: '一部のサーバーがアップロードを拒否しました: {{servers}}',
    mirroring: '共有ページを印刷中…',
    mirrorWarning: '共有ページの発行に失敗しました。アプリ内では閲覧できます。',
    successTitle: '公開しました',
    successDesc: 'デッキは公開リレーとBlossomサーバーに保存されました。',
    openDeck: 'デッキページを開く',
    copyLink: '共有リンクをコピー',
    copied: 'コピーしました',
    publishAnother: '別のデッキを公開',
    gatewayDelay: '共有ページが有効になるまで最大10分ほどかかることがあります。',
    errorTitle: 'このPDFを読み込めませんでした',
    errorPassword: 'このPDFはパスワード保護されています。解除してからお試しください。',
    tryAgain: '別のファイルを試す',
    notPdf: 'PDFファイルではありません',
  },
  deck: {
    notFoundTitle: 'デッキが見つかりません',
    notFoundDesc: 'リレーにまだ届いていない可能性があります。少し待って再読み込みしてください。',
    downloadPdf: 'PDFをダウンロード',
    pageCount: '全{{count}}ページ',
    prevPage: '前のページ',
    nextPage: '次のページ',
    fullscreen: '全画面表示',
    shareOnX: 'Xでシェア',
    copyEmbed: '埋め込みコードをコピー',
  },
  feed: {
    recent: '新着デッキ',
    mine: '自分のデッキ',
    more: 'もっと見る',
    empty: 'まだデッキがありません。上のシートにPDFを置いて最初の1冊を。',
  },
  staticViewer: {
    openInApp: 'nostr slide deckで開く',
  },
  footer: {
    note: 'スライドは公開リレーとBlossomサーバーに保存されます。運営に依存せず、持ち運べます。',
    source: 'ソースコード',
  },
  theme: {
    toggle: 'ダークモード切替',
  },
  lang: {
    label: '言語',
  },
};
