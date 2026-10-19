import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { parse } from '../src/parsers';

vi.mock('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url', () => ({
  default: new URL('../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url)
    .href,
}));

async function fixture(name: string) {
  return new File([await readFile(new URL(`./fixtures/${name}`, import.meta.url))], name);
}

describe('DOCX', () => {
  it('extracts paragraphs from a small document', async () => {
    const book = await parse(await fixture('sample.docx'));
    expect(book.title).toBe('sample');
    expect(book.chapters[0]?.text).toBe('Первая глава\n\nПривет, документ!');
  });
  it('reports a damaged document', async () => {
    await expect(parse(new File(['broken'], 'broken.docx'))).rejects.toThrow('повреждён');
  });
});

describe('PDF', () => {
  it('extracts text from a real small PDF', async () => {
    const book = await parse(await fixture('sample.pdf'));
    expect(book.chapters[0]?.text).toBe('Hello PDF reader.');
    expect(book.chapters[0]?.title).toBe('Страница 1');
  });
  it('explains OCR when there is no text layer', async () => {
    await expect(parse(await fixture('scan.pdf'))).rejects.toThrow('нужен OCR');
  });
  it('reports a damaged PDF', async () => {
    await expect(parse(new File(['broken'], 'broken.pdf'))).rejects.toThrow('PDF');
  });
});
