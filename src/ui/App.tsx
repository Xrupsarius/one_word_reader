import { useEffect, useRef, useState } from 'react';
import type { Book, ReadingText } from '../domain/book';
import { readSettings, type Settings } from '../domain/settings';
import { Reader, type Snapshot } from '../engine/reader';
import { prepareBook } from '../engine/text';
import { ru as t } from '../i18n/ru';
import type { ImportResult } from '../workers/protocol';
import { lastBook, openBook, saveBook, savePosition } from '../storage/library';
import { Library } from './Library';
import { Offline } from './Offline';
import { Word } from './Word';

const sampleBook: Book = {
  title: t.sampleTitle,
  author: '',
  chapters: [{ title: t.text, text: t.sample }],
};

export function App() {
  const [settings, setSettings] = useState(readSettings);
  const [book, setBook] = useState(sampleBook);
  const [reading, setReading] = useState<ReadingText>(() => prepareBook(sampleBook));
  const [snapshot, setSnapshot] = useState<Snapshot>({ index: 0, playing: false, ended: false });
  const [text, setText] = useState(t.sample);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [storageWarning, setStorageWarning] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [libraryVersion, setLibraryVersion] = useState(0);
  const currentIdRef = useRef<string | null>(null);
  const engineRef = useRef<Reader | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!engineRef.current)
    engineRef.current = new Reader(settings, (state) => {
      setSnapshot(state);
      if (!state.playing) setLibraryVersion((value) => value + 1);
      if (currentIdRef.current)
        void savePosition(currentIdRef.current, state.index, state.ended).catch(() =>
          setError(t.bookStorageWarning),
        );
    });
  const engine = engineRef.current;

  useEffect(() => {
    let cancelled = false;
    engine.load(prepareBook(sampleBook).words);
    void lastBook()
      .then((saved) => {
        if (cancelled || !saved) return;
        currentIdRef.current = null;
        setBook(saved.record.book);
        setReading(saved.record.reading);
        setText('');
        engine.load(saved.record.reading.words, saved.position.index, saved.position.ended);
        currentIdRef.current = saved.record.id;
      })
      .catch(() => {
        if (!cancelled) setError(t.bookStorageWarning);
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, [engine]);
  useEffect(() => {
    engine.configure(settings);
    document.documentElement.dataset.theme = settings.theme;
    try {
      localStorage.setItem('viewreader.settings', JSON.stringify(settings));
      setStorageWarning(false);
    } catch {
      setStorageWarning(true);
    }
  }, [engine, settings]);
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) engine.pause();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      engine.pause();
      workerRef.current?.terminate();
    };
  }, [engine]);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target;
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat || loading || restoring)
        return;
      if (
        target instanceof HTMLElement &&
        target.closest('input, textarea, select, [contenteditable="true"]')
      )
        return;
      if (event.code === 'Space') {
        if (target instanceof HTMLElement && target.closest('button, summary')) return;
        event.preventDefault();
        engine.toggle();
      } else if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
        event.preventDefault();
        engine.jump(event.code === 'ArrowLeft' ? -1 : 1);
      } else if (event.code === 'ArrowUp' || event.code === 'ArrowDown') {
        event.preventDefault();
        setSettings((s) => ({
          ...s,
          wpm: Math.min(1000, Math.max(100, s.wpm + (event.code === 'ArrowUp' ? 25 : -25))),
        }));
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [engine, loading, restoring]);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  function importFile(file: File) {
    if (loading || restoring) return;
    engine.pause();
    workerRef.current?.terminate();
    setLoading(true);
    setError('');
    const finish = () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      setLoading(false);
    };
    try {
      const worker = new Worker(new URL('../workers/import.worker.ts', import.meta.url), {
        type: 'module',
      });
      workerRef.current = worker;
      worker.onmessage = async (event: MessageEvent<ImportResult>) => {
        const result = event.data;
        if (result.ok) {
          currentIdRef.current = null;
          setBook(result.book);
          setReading(result.reading);
          setText('');
          engine.load(result.reading.words);
          try {
            const record = await saveBook(result.book, result.reading);
            currentIdRef.current = record.id;
            setLibraryVersion((value) => value + 1);
          } catch {
            setError(t.bookStorageWarning);
          }
        } else setError(result.error);
        finish();
      };
      worker.onerror = () => {
        setError(t.workerError);
        finish();
      };
      worker.postMessage(file);
    } catch {
      setError(t.workerError);
      finish();
    }
  }

  function applyText() {
    const next = text.trim();
    if (!next) {
      setError(t.empty);
      return;
    }
    importFile(new File([next], `${t.text}.txt`, { type: 'text/plain' }));
  }

  async function selectBook(id: string) {
    engine.pause();
    setLoading(true);
    setError('');
    try {
      const saved = await openBook(id);
      if (!saved) {
        setError(t.missingBook);
        return;
      }
      currentIdRef.current = null;
      setBook(saved.record.book);
      setReading(saved.record.reading);
      setText('');
      engine.load(saved.record.reading.words, saved.position?.index, saved.position?.ended);
      currentIdRef.current = id;
      await savePosition(id, saved.position?.index ?? 0, saved.position?.ended ?? false);
      setLibraryVersion((value) => value + 1);
      document.querySelector('.stage')?.scrollIntoView({ block: 'center' });
    } catch {
      setError(t.bookStorageWarning);
    } finally {
      setLoading(false);
    }
  }

  function removedBook(id: string) {
    if (currentIdRef.current !== id) return;
    engine.pause();
    currentIdRef.current = null;
    setBook(sampleBook);
    const reading = prepareBook(sampleBook);
    setReading(reading);
    setText(t.sample);
    engine.load(reading.words);
  }

  const chapter = reading.chapterStarts.findLastIndex((start) => start <= snapshot.index);
  return (
    <main
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) importFile(file);
      }}
      data-dragging={dragging}
    >
      <header>
        <div className="brand-mark" aria-hidden="true">
          <span /> <span /> <span />
        </div>
        <h1>{t.title}</h1>
        <p>{t.intro}</p>
        <input
          hidden
          ref={fileRef}
          type="file"
          accept=".txt,.epub,.fb2,.docx,.pdf,.mobi,.azw,.azw3"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) importFile(file);
            event.target.value = '';
          }}
        />
        <button
          aria-label={t.open}
          onClick={() => fileRef.current?.click()}
          disabled={loading || restoring}
        >
          {t.open}
        </button>
      </header>
      <div className="reading-layout">
        <div className="reader-column">
          <p role="status">
            {restoring ? t.restoring : loading ? t.loading : book.title}
            {book.author ? ` · ${book.author}` : ''}
          </p>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <section aria-label={t.text} aria-busy={loading}>
            <Word word={reading.words[snapshot.index] ?? ''} fontSize={settings.fontSize} />
            <input
              type="range"
              aria-label={t.position}
              min="0"
              max={Math.max(0, reading.words.length - 1)}
              value={snapshot.index}
              disabled={loading || restoring || !reading.words.length}
              onChange={(event) => engine.seek(Number(event.target.value))}
            />
            <div className="info">
              <span>
                {t.progress(reading.words.length ? snapshot.index + 1 : 0, reading.words.length)}
              </span>
              <span>{snapshot.ended ? t.completed : t.remaining(engine.remainingMs())}</span>
            </div>
            <div className="controls">
              <button
                disabled={loading || restoring}
                aria-label={t.back}
                onClick={() => engine.jump(-1)}
              >
                ⏮
              </button>
              <button
                disabled={loading || restoring}
                aria-label={snapshot.playing ? t.pause : snapshot.ended ? t.replay : t.play}
                className="play"
                onClick={() => engine.toggle()}
              >
                {snapshot.playing ? t.pause : snapshot.ended ? t.replay : t.play}
              </button>
              <button
                disabled={loading || restoring}
                aria-label={t.forward}
                onClick={() => engine.jump(1)}
              >
                ⏭
              </button>
            </div>
            <label htmlFor="wpm">
              {t.speed}: {settings.wpm} {t.wpm}
            </label>
            <input
              id="wpm"
              type="range"
              min="100"
              max="1000"
              step="25"
              value={settings.wpm}
              onChange={(event) => update('wpm', Number(event.target.value))}
            />
            {book.chapters.length > 1 && (
              <>
                <label htmlFor="chapter">{t.chapter}</label>
                <select
                  id="chapter"
                  value={chapter}
                  onChange={(event) =>
                    engine.seek(reading.chapterStarts[Number(event.target.value)] ?? 0)
                  }
                >
                  {book.chapters.map((item, index) => (
                    <option key={index} value={index}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </>
            )}
          </section>
        </div>
        <aside className="reading-sidebar" aria-label={t.settings}>
          <details>
            <summary>{t.settings}</summary>
            <label htmlFor="fontSize">
              {t.fontSize}: {settings.fontSize}
            </label>
            <input
              id="fontSize"
              type="range"
              min="24"
              max="64"
              step="2"
              value={settings.fontSize}
              onChange={(event) => update('fontSize', Number(event.target.value))}
            />
            <label htmlFor="theme">{t.theme}</label>
            <select
              id="theme"
              value={settings.theme}
              onChange={(event) => update('theme', event.target.value as Settings['theme'])}
            >
              <option value="system">{t.system}</option>
              <option value="light">{t.light}</option>
              <option value="dark">{t.dark}</option>
            </select>
            <label className="check">
              <input
                type="checkbox"
                checked={settings.ramp}
                onChange={(event) => update('ramp', event.target.checked)}
              />
              {t.ramp}
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={settings.punctuation}
                onChange={(event) => update('punctuation', event.target.checked)}
              />
              {t.punctuation}
            </label>
            {storageWarning && <p role="status">{t.storageWarning}</p>}
          </details>
          <details>
            <summary>{t.text}</summary>
            <label htmlFor="text">{t.text}</label>
            <textarea id="text" value={text} onChange={(event) => setText(event.target.value)} />
            <button disabled={loading || restoring} aria-label={t.apply} onClick={applyText}>
              {t.apply}
            </button>
          </details>
        </aside>
      </div>
      <Library
        version={libraryVersion}
        currentId={currentIdRef.current}
        disabled={loading || restoring}
        onOpen={(id) => void selectBook(id)}
        onDelete={removedBook}
        onError={setError}
      />
      <footer>{t.shortcuts}</footer>
      <Offline onUpdate={() => engine.pause()} />
    </main>
  );
}
