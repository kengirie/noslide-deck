# Rostrum

[English](README.md) | 日本語

Nostr でスライドを共有できます。PDF をアップロードすると、[NIP-5A](https://github.com/nostr-protocol/nips/blob/master/5A.md) の nsite として公開されます。その nsite の URL が共有ページであり、そのままアプリでもあります。閲覧者はブラウザでスライドをめくれて、リンクをどこかに貼ると最初のスライドのカードが表示されます。

**GH pages**: <https://kengirie.github.io/noslide-deck/>
**Nsite**: <https://39ohbfiu1ziyvxhwqdklupc0yrc4mcgmjpfe3w6vvz1gp6wg7hslides.nwb.tf/>

## 仕組み — サーバーのないサーバーサイドレンダリング

リンクプレビュー（OG）カードを出すには、普通はリクエストごとに HTML を描画する**サーバー**が必要です。Speaker Deck はこの方式で、サーバーが賢い部分を担います:

```text
  ┌──────────────────────────────────────┐
  │  Server                     (smart)  │
  │  renders HTML per request (SSR)      │
  └────────────────────┬─────────────────┘
                       │ HTML + OG card
                       ▼
  ┌──────────────────────────────────────┐
  │  Viewer / crawler           (dumb)   │
  │  browser only — asks the server      │
  └──────────────────────────────────────┘
```

Rostrum はサーバーを使いません。この HTML を**公開時にブラウザの中で生成**し、シンプルな静的ホスト（デッキ自身の [NIP-5A](https://github.com/nostr-protocol/nips/blob/master/5A.md) nsite。[Blossom](https://github.com/hzrd149/blossom) 上に SHA-256 で保存）に置きます。つまり賢い部分は公開クライアントに移り、しかも一度だけ動きます:

```text
  ┌──────────────────────────────────────┐
  │  Upload client              (smart)  │
  │  pdf.js images · bakes HTML w/ OG    │
  └────────────────────┬─────────────────┘
                       │ files, by SHA-256
                       ▼
  ┌──────────────────────────────────────┐
  │  nsite + Blossom            (dumb)   │
  │  serves the baked files as-is        │
  └────────────────────┬─────────────────┘
                       │ HTTPS
                       ▼
  ┌──────────────────────────────────────┐
  │  Viewer                     (dumb)   │
  │  crawler: OG card · human: full app  │
  └──────────────────────────────────────┘
```

こうして 1 つの URL が、クローラーにも人間にも使えます。詳しく言うと、デッキは addressable な **kind `35891`** イベント（[NIP.md](NIP.md)）で、各ファイルを URL とハッシュの両方で記録し、デッキ自身の [NIP-5A](https://github.com/nostr-protocol/nips/blob/master/5A.md) **named site（kind `35128`）** として `https://<npubB36><deck-id>.<gateway>/` で配信されます。コメント（NIP-22）、リアクション（NIP-25）、プロフィールはすべて素の Nostr です。

ローカル開発とデプロイは [DEVELOPMENT.md](DEVELOPMENT.md) にあります。

## Stack

React 19 · React Router · Vite · TailwindCSS 4 · [Nostrify](https://nostrify.dev) · pdf.js · [MKStack](https://soapbox.pub/mkstack) テンプレート。

## ライセンス

MIT.
