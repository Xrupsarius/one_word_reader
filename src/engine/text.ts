import type { Book, ReadingText } from '../domain/book';

export const sentenceEnd = /[.!?…]["'»”’\])}]*$/u;
const clauseEnd = /[,;:—–]["'»”’\])}]*$/u;

export function tokenize(text: string): string[] {
  return text.split(/\s+/u).filter(Boolean);
}

export function prepareBook(book: Book): ReadingText {
  const words: string[] = [];
  const chapterStarts: number[] = [];
  for (const chapter of book.chapters) {
    chapterStarts.push(words.length);
    for (const word of tokenize(chapter.text)) words.push(word);
  }
  return { words, chapterStarts };
}

export function core(word: string): string {
  return word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

export function focusParts(word: string): [string, string, string] {
  const letters = Array.from(core(word));
  const n = letters.length;
  const offset = n <= 1 ? 0 : n <= 5 ? 1 : n <= 9 ? 2 : n <= 13 ? 3 : 4;
  const chars = Array.from(word);
  const lead = Math.max(
    0,
    chars.findIndex((char) => /[\p{L}\p{N}]/u.test(char)),
  );
  const index = lead + offset;
  return [chars.slice(0, index).join(''), chars[index] ?? '', chars.slice(index + 1).join('')];
}

export function wordDelay(word: string, wpm: number, punctuation = true): number {
  if (!Number.isFinite(wpm) || wpm <= 0) throw new RangeError('WPM must be positive');
  let delay = 60000 / wpm;
  if (punctuation) {
    if (sentenceEnd.test(word)) delay *= 2.2;
    else if (clauseEnd.test(word)) delay *= 1.6;
  }
  const length = Array.from(core(word)).length;
  if (length > 12) delay *= 1.5;
  else if (length > 8) delay *= 1.3;
  return delay;
}

export function sentencePosition(
  words: readonly string[],
  index: number,
  direction: -1 | 1,
): number {
  if (!words.length) return 0;
  let target = Math.min(words.length - 1, Math.max(0, index));
  if (direction === 1) {
    while (target < words.length - 1 && !sentenceEnd.test(words[target] ?? '')) target++;
    return Math.min(words.length - 1, target + 1);
  }
  const start = target;
  while (target > 0 && !sentenceEnd.test(words[target - 1] ?? '')) target--;
  if (target === start && target > 0) {
    target--;
    while (target > 0 && !sentenceEnd.test(words[target - 1] ?? '')) target--;
  }
  return target;
}
