import type { Book, ReadingText } from '../domain/book';

export type ImportResult =
  { ok: true; book: Book; reading: ReadingText } | { ok: false; error: string };
