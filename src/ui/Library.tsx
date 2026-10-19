import { useEffect, useState } from 'react';
import { deleteBook, library } from '../storage/library';
import { ru as t } from '../i18n/ru';

interface Props {
  version: number;
  currentId: string | null;
  disabled: boolean;
  onOpen(id: string): void;
  onDelete(id: string): void;
  onError(message: string): void;
}

export function Library({ version, currentId, disabled, onOpen, onDelete, onError }: Props) {
  const [books, setBooks] = useState<Awaited<ReturnType<typeof library>>>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [deleting, setDeleting] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void library()
      .then((items) => {
        if (!cancelled) setBooks(items);
      })
      .catch(() => {
        if (!cancelled) onError(t.bookStorageWarning);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [version, refresh, onError]);

  async function remove(id: string) {
    setDeleting(id);
    try {
      onDelete(id);
      await deleteBook(id);
      setRefresh((value) => value + 1);
    } catch {
      onError(t.bookStorageWarning);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <section className="library" aria-labelledby="library-title">
      <h2 id="library-title">{t.library}</h2>
      {loading ? (
        <p role="status">{t.loadingLibrary}</p>
      ) : books.length === 0 ? (
        <p>{t.emptyLibrary}</p>
      ) : (
        <ul>
          {books.map((book) => {
            const percent = book.position?.ended
              ? 100
              : Math.floor(((book.position?.index ?? 0) / Math.max(1, book.total)) * 100);
            return (
              <li key={book.id} data-current={currentId === book.id}>
                <div>
                  <strong>{book.title}</strong>
                  {book.author && <span>{book.author}</span>}
                  <span>
                    {percent}% · {book.total} {t.words}
                  </span>
                  <progress max="100" value={percent} aria-label={t.bookProgress(book.title)} />
                </div>
                <div className="library-actions">
                  <button
                    disabled={disabled || deleting !== null}
                    onClick={() => onOpen(book.id)}
                    aria-label={t.openBook(book.title)}
                  >
                    {currentId === book.id ? t.continue : t.openShort}
                  </button>
                  <button
                    disabled={disabled || deleting !== null}
                    onClick={() => void remove(book.id)}
                    aria-label={t.deleteBook(book.title)}
                  >
                    {t.delete}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
