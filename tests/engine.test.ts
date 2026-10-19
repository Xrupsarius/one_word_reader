import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../src/domain/settings';
import { Reader, type Snapshot, type Scheduler } from '../src/engine/reader';
import { focusParts, prepareBook, sentencePosition, tokenize, wordDelay } from '../src/engine/text';

describe('text and timing', () => {
  it.each([
    ['слово', 200],
    ['слово.', 440],
    ['слово!»', 440],
    ['слово…', 440],
    ['слово,', 320],
    ['слово;', 320],
    ['слово:', 320],
    ['—', 320],
    ['абвгдежз', 200],
    ['абвгдежзи', 260],
    ['абвгдежзийкл', 260],
    ['абвгдежзийклм', 300],
    ['«абвгдежзийклм!»', 660],
  ])('calculates delay of %s', (word, delay) => expect(wordDelay(word, 300)).toBeCloseTo(delay));
  it('disables punctuation independently of length', () =>
    expect(wordDelay('абвгдежзи!', 300, false)).toBe(260));
  it('rejects invalid speed', () => expect(() => wordDelay('text', 0)).toThrow());
  it('tokenizes whitespace', () => expect(tokenize('  Один\n\tдва ')).toEqual(['Один', 'два']));
  it('aligns ORP including leading punctuation', () => {
    expect(focusParts('«Привет!»')).toEqual(['«Пр', 'и', 'вет!»']);
    expect(focusParts('Я')).toEqual(['', 'Я', '']);
    expect(focusParts('')).toEqual(['', '', '']);
  });
  it('uses Unicode code points', () => expect(focusParts('𐐀𐐁𐐂')).toEqual(['𐐀', '𐐁', '𐐂']));
  it('flattens chapters with offsets', () =>
    expect(
      prepareBook({
        title: '',
        author: '',
        chapters: [
          { title: '1', text: 'Один два.' },
          { title: '2', text: 'Три.' },
        ],
      }),
    ).toEqual({ words: ['Один', 'два.', 'Три.'], chapterStarts: [0, 2] }));
  it('moves between sentence starts', () => {
    const words = tokenize('Один два. Три четыре! Пять шесть.');
    expect(sentencePosition(words, 1, 1)).toBe(2);
    expect(sentencePosition(words, 3, -1)).toBe(2);
    expect(sentencePosition(words, 2, -1)).toBe(0);
    expect(sentencePosition(words, 5, 1)).toBe(5);
  });
});

describe('reader playback', () => {
  afterEach(() => vi.useRealTimers());
  function setup(options = {}) {
    vi.useFakeTimers();
    let state: Snapshot = { index: 0, playing: false, ended: false };
    const clock: Scheduler = {
      now: () => Date.now(),
      set: (fn, ms) => setTimeout(fn, ms),
      clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    };
    const reader = new Reader(
      { ...defaultSettings, ...options },
      (value) => {
        state = value;
      },
      clock,
    );
    reader.load(['раз', 'два', 'три.']);
    return { reader, state: () => state };
  }
  it('holds each word for its delay and ends after the last delay', () => {
    const { reader, state } = setup();
    reader.play();
    vi.advanceTimersByTime(199);
    expect(state().index).toBe(0);
    vi.advanceTimersByTime(1);
    expect(state().index).toBe(1);
    vi.advanceTimersByTime(200);
    expect(state().index).toBe(2);
    vi.advanceTimersByTime(440);
    expect(state().ended).toBe(true);
    expect(state().playing).toBe(false);
    reader.play();
    expect(state().index).toBe(0);
  });
  it('pauses and resumes the same word', () => {
    const { reader, state } = setup();
    reader.play();
    vi.advanceTimersByTime(200);
    reader.pause();
    vi.advanceTimersByTime(1000);
    expect(state().index).toBe(1);
    reader.play();
    expect(state().index).toBe(1);
  });
  it('seeks while playing without duplicate timers', () => {
    const { reader, state } = setup();
    reader.play();
    reader.seek(1);
    vi.advanceTimersByTime(200);
    expect(state().index).toBe(2);
    expect(vi.getTimerCount()).toBe(1);
  });
  it('updates active speed and estimates punctuation pauses', () => {
    const { reader, state } = setup();
    expect(reader.remainingMs()).toBeCloseTo(840);
    reader.play();
    reader.configure({ ...defaultSettings, wpm: 600 });
    vi.advanceTimersByTime(100);
    expect(state().index).toBe(1);
    expect(reader.remainingMs()).toBeCloseTo(320);
  });
  it('starts the optional ramp at 60% speed', () => {
    const { reader, state } = setup({ ramp: true });
    reader.play();
    vi.advanceTimersByTime(300);
    expect(state().index).toBe(0);
    vi.advanceTimersByTime(34);
    expect(state().index).toBe(1);
  });
  it('does not start empty books', () => {
    const { reader, state } = setup();
    reader.load([]);
    reader.play();
    expect(state().playing).toBe(false);
  });
  it('corrects small callback drift against absolute deadlines', () => {
    let now = 0;
    let callback = () => {};
    const delays: number[] = [];
    const clock: Scheduler = {
      now: () => now,
      clear: () => {},
      set: (fn, ms) => {
        callback = fn;
        delays.push(ms);
      },
    };
    const reader = new Reader(defaultSettings, () => {}, clock);
    reader.load(['раз', 'два', 'три']);
    reader.play();
    now = 210;
    callback();
    expect(delays.at(-1)).toBe(190);
    now = 405;
    callback();
    expect(delays.at(-1)).toBe(195);
  });
});
