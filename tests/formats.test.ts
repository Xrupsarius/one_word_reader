import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parse } from '../src/parsers';

async function fixture(name: string) {
  return new File([await readFile(new URL(`./fixtures/${name}`, import.meta.url))], name);
}

describe('EPUB', () => {
  it('reads metadata and chapters in spine order rather than ZIP order', async () => {
    const book = await parse(await fixture('sample.epub'));
    expect(book.title).toBe('Тест EPUB');
    expect(book.author).toBe('Автор EPUB');
    expect(book.chapters.map((chapter) => chapter.title)).toEqual(['Первая', 'Вторая']);
    expect(book.chapters[0]?.text).toContain('Первый текст & смысл.');
    expect(book.chapters[0]?.text).not.toMatch(/script|GARBAGE|<p>/);
  });
  it('rejects invalid ZIP files', async () => {
    await expect(parse(new File(['broken'], 'bad.epub'))).rejects.toThrow('повреждён');
  });
});

describe('FB2', () => {
  it('reads metadata, sections and nested text without notes or binary', async () => {
    const book = await parse(await fixture('sample.fb2'));
    expect(book.title).toBe('Тестовая книга');
    expect(book.author).toBe('Иван Автор');
    expect(book.chapters.map((chapter) => chapter.title)).toEqual([
      'Начало',
      'Подглава',
      'Продолжение',
    ]);
    expect(book.chapters[0]?.text).toBe('Первый абзац.');
    expect(book.chapters[1]?.text).toBe('Вложенный текст.');
    expect(JSON.stringify(book)).not.toMatch(/BINARYGARBAGE|сноска|emphasis/);
  });
  it('decodes a real windows-1251 fixture', async () => {
    const book = await parse(await fixture('windows1251.fb2'));
    expect(book.title).toBe('Кириллица');
    expect(book.chapters[0]?.text).toBe('Привет, ёжик!');
  });
  it('reports malformed XML', async () => {
    await expect(parse(new File(['<FictionBook><body></FictionBook>'], 'bad.fb2'))).rejects.toThrow(
      'XML',
    );
  });
  it('does not expand XML entities', async () => {
    await expect(
      parse(
        new File(['<!DOCTYPE test [<!ENTITY a "boom">]><FictionBook>&a;</FictionBook>'], 'bad.fb2'),
      ),
    ).rejects.toThrow('сущности');
  });
});
