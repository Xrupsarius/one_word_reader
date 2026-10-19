import JSZip from 'jszip';
import type { Book } from '../domain/book';
import { ParseError } from './errors';
import { decodeXml, elements, plainText, xml } from './xml';
import { parserMessages as m } from '../i18n/parsers.ru';

function resolvePath(base: string, reference: string): string {
  const parts = base.split('/').slice(0, -1);
  const href = decodeURIComponent(reference.split('#')[0] ?? '');
  if (/^[a-z]+:|^\//i.test(href)) throw new ParseError(m.externalChapter);
  for (const part of href.split('/')) {
    if (part === '..') parts.pop();
    else if (part && part !== '.') parts.push(part);
  }
  return parts.join('/');
}

export async function parseEpub(file: File): Promise<Book> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  async function document(path: string) {
    const entry = zip.file(path);
    if (!entry) throw new ParseError(m.missingEpubFile(path));
    return xml(decodeXml(await entry.async('uint8array')));
  }
  if (zip.file('META-INF/encryption.xml')) {
    const encryption = await document('META-INF/encryption.xml');
    const algorithms = elements(encryption, 'EncryptionMethod').map(
      (item) => item.getAttribute('Algorithm') ?? '',
    );
    if (algorithms.some((value) => !value.includes('embedding') && !value.includes('obfuscation')))
      throw new ParseError(m.drm);
  }
  const container = await document('META-INF/container.xml');
  const path = elements(container, 'rootfile')[0]?.getAttribute('full-path');
  if (!path) throw new ParseError(m.missingDescription);
  const opf = await document(path);
  const manifest = new Map(elements(opf, 'item').map((item) => [item.getAttribute('id'), item]));
  const chapters: Book['chapters'] = [];
  for (const ref of elements(opf, 'itemref')) {
    if (ref.getAttribute('linear') === 'no') continue;
    const item = manifest.get(ref.getAttribute('idref'));
    if (!item) throw new ParseError(m.spine);
    const href = item.getAttribute('href');
    if (!href) throw new ParseError(m.chapterPath);
    const doc = await document(resolvePath(path, href));
    const body = elements(doc, 'body')[0] ?? doc.documentElement;
    const text = plainText(body);
    if (!text) continue;
    const heading = ['h1', 'h2', 'h3'].flatMap((name) => elements(doc, name))[0];
    const title =
      (heading ? plainText(heading) : elements(doc, 'title')[0]?.textContent?.trim()) ||
      m.chapter(chapters.length + 1);
    chapters.push({ title, text });
  }
  if (!chapters.length) throw new ParseError(m.emptyEpub);
  return {
    title: elements(opf, 'title')[0]?.textContent?.trim() || file.name.replace(/\.epub$/i, ''),
    author: elements(opf, 'creator')
      .map((item) => item.textContent?.trim())
      .filter(Boolean)
      .join(', '),
    chapters,
  };
}
