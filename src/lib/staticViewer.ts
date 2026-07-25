/**
 * Publish-time static viewer.
 *
 * The whole point of Abstract.md §6: crawlers don't run JavaScript, so the
 * OG meta tags are baked into a self-contained HTML file at publish time and
 * served by the nsite gateway. No SSR anywhere.
 *
 * Page images are referenced RELATIVELY (pages/001.webp) so the same HTML
 * works on any gateway domain; only og:image/og:url need absolute URLs.
 */

export interface StaticViewerInput {
  title: string;
  summary: string;
  /** Absolute canonical URL of this deck page on the gateway */
  canonicalUrl: string;
  /** Absolute URL of the 1200x630 thumbnail (gateway path URL, not a single Blossom server) */
  ogImageUrl: string;
  /** Relative paths of page images in order, e.g. "pages/001.webp" */
  pagePaths: string[];
  /** Absolute URL of the original PDF (Blossom) */
  pdfUrl: string;
  /** In-app URL for the full experience (comments, zaps) */
  appUrl: string;
  labels: {
    openInApp: string;
    downloadPdf: string;
  };
}

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

/**
 * Chrome-less viewer for <iframe> embeds, published alongside index.html as
 * /embed.html. Same relative page paths; a small bottom bar links back to the
 * canonical deck page.
 */
export function renderEmbedHtml(input: Pick<StaticViewerInput, 'title' | 'canonicalUrl' | 'pagePaths'>): string {
  const title = escapeHtml(input.title);
  const canonical = escapeHtml(assertHttpUrl(input.canonicalUrl));
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
.bar a{color:#ece9e2;text-decoration:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
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
  render();
})();
</script>
</body>
</html>
`;
}

export function renderStaticViewerHtml(input: StaticViewerInput): string {
  const title = escapeHtml(input.title);
  const summary = escapeHtml(input.summary);
  const canonical = escapeHtml(assertHttpUrl(input.canonicalUrl));
  const ogImage = escapeHtml(assertHttpUrl(input.ogImageUrl));
  const pdfUrl = escapeHtml(assertHttpUrl(input.pdfUrl));
  const appUrl = escapeHtml(assertHttpUrl(input.appUrl));
  const pages = input.pagePaths.map(assertRelativePath);
  const pagesJson = JSON.stringify(pages).replaceAll('<', '\\u003c');

  const noscriptImages = pages
    .map((p, i) => `<img src="${escapeHtml(p)}" alt="${title} — ${i + 1}" loading="lazy">`)
    .join('\n      ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
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
<style>
:root{--paper:#faf9f6;--ink:#1c1a17;--rule:#dcd9d2;--gray:#6e6a63;--seal:#d7381e}
@media(prefers-color-scheme:dark){:root{--paper:#161411;--ink:#ece9e2;--rule:#302d27;--gray:#98938a;--seal:#e8543a}}
*{box-sizing:border-box;margin:0}
body{background:var(--paper);color:var(--ink);font-family:ui-sans-serif,system-ui,sans-serif;min-height:100vh;display:flex;flex-direction:column}
main{flex:1;display:flex;flex-direction:column;justify-content:center;max-width:72rem;margin:0 auto;padding:1.5rem;width:100%}
.sheet{position:relative;background:#fff;box-shadow:0 12px 32px -16px rgba(0,0,0,.35)}
.sheet img{display:block;width:100%;height:auto}
.bar{display:flex;align-items:center;justify-content:space-between;margin-top:.75rem;gap:1rem}
.bar button{background:none;border:1px solid var(--rule);color:var(--ink);padding:.4rem .9rem;cursor:pointer;font-size:1rem;border-radius:2px}
.bar button:disabled{opacity:.3;cursor:default}
.folio{font-family:ui-monospace,monospace;font-size:.75rem;letter-spacing:.15em;color:var(--gray)}
h1{font-size:1.25rem;margin-top:1.5rem;font-weight:700}
p.summary{color:var(--gray);font-size:.9rem;margin-top:.5rem;max-width:60ch}
.links{margin-top:1rem;display:flex;gap:1rem;flex-wrap:wrap}
.links a{color:var(--seal);font-size:.85rem;text-decoration:none;border-bottom:1px solid currentColor}
noscript .sheet-list img{margin-bottom:1rem;border:1px solid var(--rule)}
</style>
</head>
<body>
<main>
  <div class="sheet"><img id="slide" src="${escapeHtml(pages[0] ?? '')}" alt="${title} — 1"></div>
  <div class="bar">
    <div>
      <button id="prev" aria-label="Previous">&#8249;</button>
      <button id="next" aria-label="Next">&#8250;</button>
    </div>
    <span class="folio" id="folio"></span>
  </div>
  <noscript>
    <div class="sheet-list">
      ${noscriptImages}
    </div>
  </noscript>
  <h1>${title}</h1>
  ${summary ? `<p class="summary">${summary}</p>` : ''}
  <div class="links">
    <a href="${appUrl}">${escapeHtml(input.labels.openInApp)}</a>
    <a href="${pdfUrl}" download>${escapeHtml(input.labels.downloadPdf)}</a>
  </div>
</main>
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
  prev.addEventListener('click',function(){go(-1)});
  next.addEventListener('click',function(){go(1)});
  img.addEventListener('click',function(){go(1)});
  document.addEventListener('keydown',function(e){
    if(e.key==='ArrowRight')go(1);
    if(e.key==='ArrowLeft')go(-1);
  });
  render();
})();
</script>
</body>
</html>
`;
}
