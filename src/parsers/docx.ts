import mammoth from 'mammoth/mammoth.browser.js';
import type { Book } from '../domain/book';
import { ParseError } from './errors';
import { parserMessages as m } from '../i18n/parsers.ru';

export async function parseDocx(file: File): Promise<Book> {
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  const text = result.value.trim();
  if (!text) throw new ParseError(m.emptyDocx);
  const title = file.name.replace(/\.docx$/i, '');
  return { title, author: '', chapters: [{ title, text }] };
}
