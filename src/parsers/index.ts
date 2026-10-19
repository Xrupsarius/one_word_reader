import type { Book } from '../domain/book';
import { ParseError } from './errors';
import { parseEpub } from './epub';
import { parseFb2 } from './fb2';
import { parserMessages as m } from '../i18n/parsers.ru';

export async function parse(file: File): Promise<Book> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (['mobi', 'azw', 'azw3'].includes(extension ?? '')) {
    throw new ParseError(m.conversion);
  }
  if (extension === 'epub' || extension === 'fb2' || extension === 'docx' || extension === 'pdf') {
    try {
      if (extension === 'epub') return await parseEpub(file);
      if (extension === 'fb2') return await parseFb2(file);
      if (extension === 'docx') return await (await import('./docx')).parseDocx(file);
      return await (await import('./pdf')).parsePdf(file);
    } catch (error) {
      if (error instanceof ParseError) throw error;
      throw new ParseError(m.damaged);
    }
  }
  if (extension !== 'txt') throw new ParseError(m.unsupported);
  const bytes = await file.arrayBuffer();
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new ParseError(m.txtEncoding);
  }
  text = text
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .trim();
  if (!text) throw new ParseError(m.empty);
  return {
    title: file.name.replace(/\.txt$/i, ''),
    author: '',
    chapters: [{ title: m.text, text }],
  };
}
