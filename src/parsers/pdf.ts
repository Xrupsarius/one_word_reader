import type { Book } from '../domain/book';
import { ParseError } from './errors';
import { parserMessages as m } from '../i18n/parsers.ru';

export async function parsePdf(file: File): Promise<Book> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const worker = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const workerPort =
    typeof Worker !== 'undefined' ? new Worker(worker.default, { type: 'module' }) : undefined;
  if (workerPort) pdfjs.GlobalWorkerOptions.workerPort = workerPort;
  const assetBase = new URL(
    import.meta.env.DEV ? '../../pdf-assets/' : '../pdf-assets/',
    import.meta.url,
  ).href;
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    cMapUrl: `${assetBase}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${assetBase}standard_fonts/`,
    useWorkerFetch: true,
    useSystemFonts: true,
  });
  try {
    const document = await task.promise;
    const chapters: Book['chapters'] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : ''))
        .join('')
        .trim();
      if (text) chapters.push({ title: m.page(pageNumber), text });
      page.cleanup();
    }
    if (!chapters.length) throw new ParseError(m.ocr);
    const metadata = await document.getMetadata().catch(() => null);
    const info = metadata?.info as { Title?: unknown; Author?: unknown } | undefined;
    return {
      title:
        typeof info?.Title === 'string' && info.Title.trim()
          ? info.Title.trim()
          : file.name.replace(/\.pdf$/i, ''),
      author: typeof info?.Author === 'string' ? info.Author.trim() : '',
      chapters,
    };
  } catch (error) {
    if (error instanceof ParseError) throw error;
    if (error instanceof Error && error.name === 'PasswordException')
      throw new ParseError(m.pdfPassword);
    throw new ParseError(m.pdfDamaged);
  } finally {
    await task.destroy();
    workerPort?.terminate();
  }
}
