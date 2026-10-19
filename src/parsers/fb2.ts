import type { Book } from '../domain/book';
import { ParseError } from './errors';
import { children, decodeXml, elements, plainText, xml } from './xml';
import { parserMessages as m } from '../i18n/parsers.ru';

export async function parseFb2(file: File): Promise<Book> {
  const doc = xml(decodeXml(await file.arrayBuffer()));
  if (doc.documentElement.localName !== 'FictionBook') throw new ParseError(m.notFb2);
  const info = elements(doc, 'title-info')[0];
  const authors = info
    ? children(info, 'author')
        .map(
          (author) =>
            ['first-name', 'middle-name', 'last-name']
              .map((name) => elements(author, name)[0]?.textContent?.trim())
              .filter(Boolean)
              .join(' ') || elements(author, 'nickname')[0]?.textContent?.trim(),
        )
        .filter(Boolean)
        .join(', ')
    : '';
  const chapters: Book['chapters'] = [];
  function section(node: Parameters<typeof children>[0]) {
    const titleNode = children(node, 'title')[0];
    const title = titleNode ? plainText(titleNode) : m.chapter(chapters.length + 1);
    let parts: string[] = [];
    const flush = () => {
      const text = parts.join('\n\n').trim();
      if (text) chapters.push({ title, text });
      parts = [];
    };
    for (const child of children(node)) {
      if (child.localName === 'title') continue;
      if (child.localName === 'section') {
        flush();
        section(child);
      } else parts.push(plainText(child));
    }
    flush();
  }
  for (const body of children(doc.documentElement, 'body')) {
    if (/^(notes|comments|footnotes)$/i.test(body.getAttribute('name') ?? '')) continue;
    let preamble: string[] = [];
    const flush = () => {
      const text = preamble.join('\n\n').trim();
      if (text) chapters.push({ title: m.chapter(chapters.length + 1), text });
      preamble = [];
    };
    for (const child of children(body)) {
      if (child.localName === 'section') {
        flush();
        section(child);
      } else preamble.push(plainText(child));
    }
    flush();
  }
  if (!chapters.length) throw new ParseError(m.emptyFb2);
  return {
    title: info ? elements(info, 'book-title')[0]?.textContent?.trim() || file.name : file.name,
    author: authors,
    chapters,
  };
}
