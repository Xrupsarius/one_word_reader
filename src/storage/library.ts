import { openDB, type DBSchema } from 'idb';
import type { Book, ReadingText } from '../domain/book';

export interface StoredBook {
  id: string;
  book: Book;
  reading: ReadingText;
  added: number;
}
export interface Position {
  id: string;
  index: number;
  ended: boolean;
  updated: number;
}
export interface Summary {
  id: string;
  title: string;
  author: string;
  total: number;
  added: number;
}

interface LibraryDB extends DBSchema {
  books: { key: string; value: StoredBook };
  summaries: { key: string; value: Summary };
  positions: { key: string; value: Position; indexes: { updated: number } };
}

const database = openDB<LibraryDB>('viewreader', 1, {
  upgrade(db) {
    db.createObjectStore('books', { keyPath: 'id' });
    db.createObjectStore('summaries', { keyPath: 'id' });
    db.createObjectStore('positions', { keyPath: 'id' }).createIndex('updated', 'updated');
  },
});
// Keep the rejection observable by callers without an unhandled rejection on startup.
void database.catch(() => {});

export async function saveBook(book: Book, reading: ReadingText): Promise<StoredBook> {
  const record = { id: crypto.randomUUID(), book, reading, added: Date.now() };
  const db = await database;
  const tx = db.transaction(['books', 'summaries', 'positions'], 'readwrite');
  await Promise.all([
    tx.objectStore('books').put(record),
    tx.objectStore('summaries').put({
      id: record.id,
      title: book.title,
      author: book.author,
      total: reading.words.length,
      added: record.added,
    }),
    tx.objectStore('positions').put({ id: record.id, index: 0, ended: false, updated: Date.now() }),
  ]);
  await tx.done;
  return record;
}

export async function savePosition(id: string, index: number, ended: boolean): Promise<void> {
  const db = await database;
  await db.put('positions', { id, index, ended, updated: Date.now() });
}

export async function lastBook() {
  const db = await database;
  const cursor = await db.transaction('positions').store.index('updated').openCursor(null, 'prev');
  if (!cursor) return undefined;
  const record = await db.get('books', cursor.value.id);
  return record ? { record, position: cursor.value } : undefined;
}

export async function library() {
  const db = await database;
  const [summaries, positions] = await Promise.all([
    db.getAll('summaries'),
    db.getAll('positions'),
  ]);
  const lookup = new Map(positions.map((position) => [position.id, position]));
  return summaries
    .sort((a, b) => b.added - a.added)
    .map((summary) => ({ ...summary, position: lookup.get(summary.id) }));
}

export async function openBook(id: string) {
  const db = await database;
  const [record, position] = await Promise.all([db.get('books', id), db.get('positions', id)]);
  return record ? { record, position } : undefined;
}

export async function deleteBook(id: string) {
  const db = await database;
  const tx = db.transaction(['books', 'summaries', 'positions'], 'readwrite');
  await Promise.all([
    tx.objectStore('books').delete(id),
    tx.objectStore('summaries').delete(id),
    tx.objectStore('positions').delete(id),
  ]);
  await tx.done;
}
