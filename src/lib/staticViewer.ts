import type { NostrEvent } from '@nostrify/nostrify';

/**
 * Publish-time HTML baked into a deck's own nsite.
 *
 * A deck site serves the full interactive app (方針A) so the share URL and the
 * app URL are one — but crawlers don't run JavaScript, so deck-specific OG meta
 * is baked into index.html (renderDeckAppHtml). The chrome-less embed
 * (renderEmbedHtml) stays a self-contained no-framework viewer.
 *
 * Page images are referenced RELATIVELY (pages/001.webp) so the same HTML works
 * on any gateway domain; only og:image/og:url need absolute URLs.
 */

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function assertHttpUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`Refusing non-http URL in static viewer: ${value}`);
  }
  return url.toString();
}

function assertRelativePath(value: string): string {
  if (!/^[a-z0-9/_-]+\.(webp|png|jpg)$/i.test(value) || value.startsWith('/')) {
    throw new Error(`Refusing suspicious relative path: ${value}`);
  }
  return value;
}

/** Root-relative same-origin app asset, e.g. "/assets/index-abc.js". */
function assertAssetRef(value: string): string {
  if (!/^\/[A-Za-z0-9/._-]+\.(js|css)$/.test(value)) {
    throw new Error(`Refusing suspicious asset ref: ${value}`);
  }
  return value;
}

/**
 * Content-Security-Policy for a mirrored deck site. Identical in spirit to the
 * app's own index.html: scripts only from same-origin (the mirrored /assets),
 * so the deck identity is passed via meta tags rather than an inline script.
 */
const DECK_SITE_CSP =
  "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "frame-src 'self' https:; font-src 'self'; base-uri 'self'; manifest-src 'self'; " +
  "connect-src 'self' blob: https: wss:; img-src 'self' data: blob: https:; media-src 'self' https:";

export interface DeckAppHtmlInput {
  title: string;
  summary: string;
  /** Absolute canonical URL of this deck on its gateway. */
  canonicalUrl: string;
  /** Absolute URL of the 1200x630 thumbnail. */
  ogImageUrl: string;
  /** npub of the deck author; the app boots into `${npub}/${deckId}`. */
  npub: string;
  /** Deck identifier (also the named-site `d`). */
  deckId: string;
  /** Relative page image paths for the <noscript> fallback, e.g. "pages/001.webp". */
  pagePaths: string[];
  /** App entry module scripts from site-assets.json, e.g. "/assets/index-*.js". */
  scripts: string[];
  /** App entry stylesheets from site-assets.json, e.g. "/assets/index-*.css". */
  styles: string[];
  /**
   * The signed deck event (kind 35891), baked in so the app hydrates the deck
   * from the page itself — no relay round-trip, no cold-start "not found" flash.
   * A deck nsite is a pinned snapshot, so this baked copy IS its canonical deck.
   */
  deckEvent?: NostrEvent;
}

/**
 * index.html for a deck's own nsite (方針A): boots the full interactive app
 * (which opens this deck at "/") while baking deck-specific OG meta for crawlers
 * and a <noscript> image fallback. Unifies the share URL and the app URL.
 */
export function renderDeckAppHtml(input: DeckAppHtmlInput): string {
  const title = escapeHtml(input.title);
  const summary = escapeHtml(input.summary);
  const canonical = escapeHtml(assertHttpUrl(input.canonicalUrl));
  const ogImage = escapeHtml(assertHttpUrl(input.ogImageUrl));
  const pages = input.pagePaths.map(assertRelativePath);
  const scripts = input.scripts.map(assertAssetRef);
  const styles = input.styles.map(assertAssetRef);
  // Non-executable data in an attribute — safe under `script-src 'self'`, same
  // reason the deck identity travels as meta tags rather than an inline script.
  const deckEventMeta = input.deckEvent
    ? `<meta name="deck:event" content="${escapeHtml(JSON.stringify(input.deckEvent))}">`
    : '';

  if (!/^npub1[a-z0-9]+$/.test(input.npub)) throw new Error(`Refusing bad npub: ${input.npub}`);
  if (!/^[a-z0-9-]{1,13}$/.test(input.deckId)) throw new Error(`Refusing bad deckId: ${input.deckId}`);

  const styleTags = styles
    .map((href) => `<link rel="stylesheet" crossorigin href="${escapeHtml(href)}">`)
    .join('\n');
  const scriptTags = scripts
    .map((src) => `<script type="module" crossorigin src="${escapeHtml(src)}"></script>`)
    .join('\n');
  const noscriptImages = pages
    .map((p, i) => `<img src="${escapeHtml(p)}" alt="${title} — ${i + 1}" loading="lazy" style="max-width:100%;height:auto;margin-bottom:1rem">`)
    .join('\n      ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="content-security-policy" content="${DECK_SITE_CSP}">
<link rel="manifest" href="/manifest.webmanifest">
<title>${title}</title>
<meta name="description" content="${summary}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="article">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${summary}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${summary}">
<meta name="twitter:image" content="${ogImage}">
<meta name="deck:npub" content="${escapeHtml(input.npub)}">
<meta name="deck:id" content="${escapeHtml(input.deckId)}">
${deckEventMeta}
${styleTags}
${scriptTags}
</head>
<body>
<div id="root"></div>
<noscript>
  <div style="max-width:72rem;margin:0 auto;padding:1.5rem;font-family:ui-sans-serif,system-ui,sans-serif">
    <h1 style="font-size:1.25rem">${title}</h1>
    ${summary ? `<p style="color:#6e6a63">${summary}</p>` : ''}
    <div style="margin-top:1rem">
      ${noscriptImages}
    </div>
  </div>
</noscript>
</body>
</html>
`;
}

/**
 * Chrome-less viewer for <iframe> embeds, published alongside index.html as
 * /embed.html. Same relative page paths; a small bottom bar links back to the
 * canonical deck page.
 */
export function renderEmbedHtml(
  input: { title: string; canonicalUrl: string; pagePaths: string[]; fullscreenLabel: string },
): string {
  const title = escapeHtml(input.title);
  const canonical = escapeHtml(assertHttpUrl(input.canonicalUrl));
  const fsLabel = escapeHtml(input.fullscreenLabel);
  const pages = input.pagePaths.map(assertRelativePath);
  const pagesJson = JSON.stringify(pages).replaceAll('<', '\\u003c');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="robots" content="noindex">
<style>
*{box-sizing:border-box;margin:0}
html,body{height:100%}
body{background:#161411;display:flex;flex-direction:column;overflow:hidden;font-family:ui-monospace,monospace}
.stage{flex:1;position:relative;display:flex;align-items:center;justify-content:center;padding:10px;cursor:pointer}
.stage img{max-width:100%;max-height:100%;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.5)}
.bar{height:30px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 10px;font-size:11px;letter-spacing:.1em;color:#98938a}
.bar a{color:#ece9e2;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;max-width:60%}
.bar a:hover{color:#e8543a}
.bar button{background:none;border:0;color:#ece9e2;font-size:15px;cursor:pointer;padding:0 6px;line-height:1}
.bar button:disabled{opacity:.3;cursor:default}
.left{display:flex;align-items:center;flex-shrink:0}
</style>
</head>
<body>
<div class="stage" id="stage"><img id="slide" src="${escapeHtml(pages[0] ?? '')}" alt="${title}"></div>
<div class="bar">
  <span class="left">
    <button id="prev" aria-label="Previous">&#8249;</button>
    <button id="next" aria-label="Next">&#8250;</button>
    <span id="folio"></span>
    <button id="fs" aria-label="${fsLabel}" title="${fsLabel}">&#9974;</button>
  </span>
  <a href="${canonical}" target="_blank" rel="noopener">${title} &#8599;</a>
</div>
<script>
(function(){
  var pages=${pagesJson};
  var i=0;
  var img=document.getElementById('slide');
  var folio=document.getElementById('folio');
  var prev=document.getElementById('prev');
  var next=document.getElementById('next');
  function pad(n){return String(n).padStart(2,'0')}
  function render(){
    img.src=pages[i];
    folio.textContent=pad(i+1)+' / '+pad(pages.length);
    prev.disabled=i<=0;
    next.disabled=i>=pages.length-1;
    if(pages[i+1]){(new Image()).src=pages[i+1]}
  }
  function go(d){var n=i+d;if(n>=0&&n<pages.length){i=n;render()}}
  prev.addEventListener('click',function(e){e.stopPropagation();go(-1)});
  next.addEventListener('click',function(e){e.stopPropagation();go(1)});
  document.getElementById('stage').addEventListener('click',function(){go(1)});
  document.addEventListener('keydown',function(e){
    if(e.key==='ArrowRight')go(1);
    if(e.key==='ArrowLeft')go(-1);
  });
  var fs=document.getElementById('fs');
  var fsEnabled=document.fullscreenEnabled||document.webkitFullscreenEnabled;
  if(fs&&fsEnabled){
    fs.addEventListener('click',function(e){
      e.stopPropagation();
      var d=document,el=d.documentElement;
      if(d.fullscreenElement||d.webkitFullscreenElement){(d.exitFullscreen||d.webkitExitFullscreen).call(d)}
      else{(el.requestFullscreen||el.webkitRequestFullscreen).call(el)}
    });
  }else if(fs){fs.style.display='none'}
  render();
})();
</script>
</body>
</html>
`;
}
