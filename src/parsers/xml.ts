import { DOMParser, type Document, type Element, type Node } from '@xmldom/xmldom';
import { ParseError } from './errors';
import { parserMessages as m } from '../i18n/parsers.ru';

export function decodeXml(bytes: ArrayBuffer | Uint8Array): string {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const prefix = new TextDecoder('ascii').decode(data.slice(0, 256));
  const encoding =
    data[0] === 0xff && data[1] === 0xfe
      ? 'utf-16le'
      : data[0] === 0xfe && data[1] === 0xff
        ? 'utf-16be'
        : (prefix.match(/encoding\s*=\s*["']([^"']+)["']/i)?.[1] ?? 'utf-8');
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(data);
  } catch {
    throw new ParseError(m.xmlEncoding);
  }
}

export function xml(text: string): Document & { documentElement: Element } {
  if (/<!DOCTYPE[\s\S]*?\[|<!ENTITY/i.test(text)) throw new ParseError(m.xmlEntities);
  try {
    const doc = new DOMParser({
      onError: (level, message) => {
        if (level !== 'warning') throw new Error(message);
      },
    }).parseFromString(text, 'application/xml');
    if (!doc.documentElement) throw new Error('Empty XML');
    return doc as Document & { documentElement: Element };
  } catch {
    throw new ParseError(m.xmlDamaged);
  }
}

export function elements(node: Document | Element, name: string): Element[] {
  return Array.from(node.getElementsByTagName('*')).filter((item) => item.localName === name);
}

export function children(node: Node, name?: string): Element[] {
  return Array.from(node.childNodes).filter(
    (item): item is Element =>
      item.nodeType === 1 && (!name || (item as Element).localName === name),
  );
}

const ignored = new Set(['script', 'style', 'binary', 'stylesheet', 'annotation']);
const blocks = new Set([
  'p',
  'div',
  'section',
  'title',
  'subtitle',
  'h1',
  'h2',
  'h3',
  'h4',
  'li',
  'br',
  'tr',
  'v',
  'empty-line',
]);

export function plainText(node: Node, omitTitles = false): string {
  const chunks: string[] = [];
  function visit(current: Node) {
    if (current.nodeType === 3 || current.nodeType === 4) {
      chunks.push(current.nodeValue ?? '');
      return;
    }
    const name = (current as Element).localName ?? '';
    if (ignored.has(name) || (omitTitles && name === 'title')) return;
    if (blocks.has(name)) chunks.push('\n');
    for (const child of Array.from(current.childNodes)) visit(child);
    if (blocks.has(name)) chunks.push('\n');
  }
  visit(node);
  return chunks
    .join('')
    .replace(/[\t\r ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
