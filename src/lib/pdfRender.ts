// pdf.js is loaded lazily: it touches browser-only globals (DOMMatrix) at
// import time and is only needed once a file is dropped.

/** Rendered width of page images. PDFs are vector, so upscaling stays sharp. */
const PAGE_WIDTH = 1600;
/** OG card dimensions (og:image sweet spot for X/Slack). */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
const WEBP_QUALITY = 0.85;

export interface RenderedPage {
  /** 1-based page number */
  pageNumber: number;
  blob: Blob;
  width: number;
  height: number;
}

export interface RenderedDeck {
  pages: RenderedPage[];
  /** Letterboxed first page at OG_WIDTH x OG_HEIGHT for the share card */
  thumbnail: Blob;
}

export type PdfRenderErrorKind = 'password' | 'invalid';

export class PdfRenderError extends Error {
  kind: PdfRenderErrorKind;

  constructor(kind: PdfRenderErrorKind, message: string) {
    super(message);
    this.name = 'PdfRenderError';
    this.kind = kind;
  }
}

/**
 * Where pdf.js fetches its bundled CMap tables and standard-14 font programs,
 * served by the `pdfjs-assets` Vite plugin under the app base. Absolute URLs so
 * the pdf worker resolves them against the origin, not its own script URL.
 * `cMapPacked` matches the shipped `.bcmap` (binary) format.
 */
const pdfAsset = (dir: string) =>
  new URL(`${import.meta.env.BASE_URL}pdfjs/${dir}/`, window.location.href).href;
const CMAP_URL = pdfAsset('cmaps');
const STANDARD_FONT_DATA_URL = pdfAsset('standard_fonts');

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

function loadPdfjs(): Promise<typeof import('pdfjs-dist')> {
  pdfjsPromise ??= (async () => {
    const [pdfjs, { default: PdfWorker }] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?worker'),
    ]);
    pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker();
    return pdfjs;
  })();
  return pdfjsPromise;
}

function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/webp'): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null'))),
      type,
      WEBP_QUALITY,
    );
  });
}

/** Draw the first page onto a letterboxed OG-sized canvas. */
async function makeThumbnail(source: HTMLCanvasElement): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = OG_WIDTH;
  canvas.height = OG_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d canvas context unavailable');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, OG_WIDTH, OG_HEIGHT);
  const scale = Math.min(OG_WIDTH / source.width, OG_HEIGHT / source.height);
  const w = source.width * scale;
  const h = source.height * scale;
  ctx.drawImage(source, (OG_WIDTH - w) / 2, (OG_HEIGHT - h) / 2, w, h);
  // JPEG: some link-preview crawlers (LINE, older clients) don't render WebP og:images
  const blob = await canvasToBlob(canvas, 'image/jpeg');
  canvas.width = 0;
  canvas.height = 0;
  return blob;
}

/**
 * Render every page of a PDF to WebP images, sequentially to bound memory use.
 * Also produces an OG-sized thumbnail from page 1.
 */
export async function renderPdf(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<RenderedDeck> {
  const { getDocument } = await loadPdfjs();

  const data = await file.arrayBuffer();
  const loadingTask = getDocument({
    data,
    // Recover text from PDFs whose fonts are referenced but not embedded
    // (e.g. Keynote/PowerPoint exports); without these, such text is dropped.
    cMapUrl: CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
  });
  let doc;
  try {
    doc = await loadingTask.promise;
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'PasswordException') {
      throw new PdfRenderError('password', 'PDF is password-protected');
    }
    throw new PdfRenderError('invalid', err instanceof Error ? err.message : 'Failed to open PDF');
  }

  try {
    const pages: RenderedPage[] = [];
    let thumbnail: Blob | null = null;

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: PAGE_WIDTH / base.width });

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('2d canvas context unavailable');

      await page.render({ canvas, canvasContext: ctx, viewport, background: '#ffffff' }).promise;

      const blob = await canvasToBlob(canvas);
      pages.push({ pageNumber: i, blob, width: canvas.width, height: canvas.height });
      if (i === 1) thumbnail = await makeThumbnail(canvas);

      page.cleanup();
      canvas.width = 0;
      canvas.height = 0;
      onProgress?.(i, doc.numPages);
    }

    if (!thumbnail) throw new PdfRenderError('invalid', 'PDF has no pages');
    return { pages, thumbnail };
  } finally {
    await loadingTask.destroy();
  }
}
