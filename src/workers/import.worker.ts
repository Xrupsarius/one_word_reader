import { parse } from '../parsers';
import { prepareBook } from '../engine/text';
import type { ImportResult } from './protocol';
import { parserMessages } from '../i18n/parsers.ru';
import { ParseError } from '../parsers/errors';

self.onmessage = async (event: MessageEvent<File>) => {
  let result: ImportResult;
  try {
    const book = await parse(event.data);
    result = { ok: true, book, reading: prepareBook(book) };
  } catch (error) {
    result = {
      ok: false,
      error: error instanceof ParseError ? error.message : parserMessages.damaged,
    };
  }
  self.postMessage(result);
};
