import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parse } from '../src/parsers';

describe('TXT parser', () => {
  it('reads a real UTF-8 fixture and preserves paragraphs', async () => {
    const contents = await readFile(new URL('./fixtures/sample.txt', import.meta.url));
    const book = await parse(new File([contents], 'Книга.TXT'));
    expect(book.title).toBe('Книга');
    expect(book.author).toBe('');
    expect(book.chapters).toEqual([
      { title: 'Текст', text: 'Первая строка: привет, мир!\n\nВторая строка — читаем дальше.' },
    ]);
  });
  it('rejects empty fixtures', async () => {
    const contents = await readFile(new URL('./fixtures/empty.txt', import.meta.url));
    await expect(parse(new File([contents], 'empty.txt'))).rejects.toThrow('нет текста');
  });
  it('normalizes BOM and Windows line endings', async () => {
    const book = await parse(new File(['\ufeffПривет\r\nмир\r!'], 'book.txt'));
    expect(book.chapters[0]?.text).toBe('Привет\nмир\n!');
  });
  it('reports invalid UTF-8', async () => {
    await expect(parse(new File([new Uint8Array([0xff, 0xfd])], 'bad.txt'))).rejects.toThrow(
      'UTF-8',
    );
  });
  it.each(['mobi', 'azw', 'azw3'])('explains conversion for %s', async (extension) => {
    await expect(parse(new File(['text'], `book.${extension}`))).rejects.toThrow(
      'Сконвертируйте в EPUB',
    );
  });
  it('rejects unsupported formats', async () => {
    await expect(parse(new File(['text'], 'book.zip'))).rejects.toThrow('Доступен TXT');
  });
});
