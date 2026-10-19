import type { Settings } from '../domain/settings';
import { sentencePosition, wordDelay } from './text';

export interface Snapshot {
  index: number;
  playing: boolean;
  ended: boolean;
}

export interface Scheduler {
  now(): number;
  set(callback: () => void, delay: number): unknown;
  clear(handle: unknown): void;
}

const scheduler: Scheduler = {
  now: () => performance.now(),
  set: (callback, delay) => setTimeout(callback, delay),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export class Reader {
  private words: readonly string[] = [];
  private state: Snapshot = { index: 0, playing: false, ended: false };
  private handle: unknown;
  private due = 0;
  private sessionStart = 0;
  private weights: number[] = [0];

  constructor(
    private settings: Settings,
    private notify: (state: Snapshot) => void,
    private clock = scheduler,
  ) {}

  load(words: readonly string[], index = 0, ended = false): void {
    this.pause();
    this.words = words;
    this.state = { index: Math.max(0, Math.min(words.length - 1, index)), playing: false, ended };
    this.rebuildWeights();
    this.emit();
  }

  configure(settings: Settings): void {
    const punctuationChanged = settings.punctuation !== this.settings.punctuation;
    this.settings = settings;
    if (punctuationChanged) this.rebuildWeights();
    if (this.state.playing) {
      this.clock.clear(this.handle);
      this.due = this.clock.now() + this.delay();
      this.schedule();
    }
    this.emit();
  }

  private rebuildWeights(): void {
    this.weights = [0];
    for (const word of this.words)
      this.weights.push(
        (this.weights.at(-1) ?? 0) + wordDelay(word, 60, this.settings.punctuation),
      );
  }

  remainingMs(): number {
    if (this.state.ended) return 0;
    return (
      (((this.weights.at(-1) ?? 0) - (this.weights[this.state.index] ?? 0)) * 60) /
      this.settings.wpm
    );
  }

  play(): void {
    if (!this.words.length || this.state.playing) return;
    if (this.state.ended) this.state.index = 0;
    this.state.ended = false;
    this.state.playing = true;
    this.sessionStart = this.clock.now();
    this.due = this.sessionStart + this.delay();
    this.emit();
    this.schedule();
  }

  pause(): void {
    this.clock.clear(this.handle);
    this.state.playing = false;
    this.emit();
  }

  toggle(): void {
    if (this.state.playing) this.pause();
    else this.play();
  }

  seek(index: number): void {
    const playing = this.state.playing;
    this.pause();
    this.state.index = Number.isFinite(index)
      ? Math.max(0, Math.min(this.words.length - 1, Math.floor(index)))
      : 0;
    this.state.ended = false;
    this.emit();
    if (playing) this.play();
  }

  jump(direction: -1 | 1): void {
    this.seek(sentencePosition(this.words, this.state.index, direction));
  }

  private delay(): number {
    const ramp = this.settings.ramp
      ? Math.min(1, 0.6 + (this.clock.now() - this.sessionStart) / 12500)
      : 1;
    return wordDelay(
      this.words[this.state.index] ?? '',
      this.settings.wpm * ramp,
      this.settings.punctuation,
    );
  }

  private emit(): void {
    this.notify({ ...this.state });
  }

  private schedule(): void {
    this.handle = this.clock.set(
      () => {
        if (!this.state.playing) return;
        if (this.state.index >= this.words.length - 1) {
          this.state = { ...this.state, playing: false, ended: true };
          this.emit();
          return;
        }
        this.state.index++;
        this.emit();
        const delay = this.delay();
        // Keep the original deadline, but avoid a burst of skipped words after suspension.
        this.due = Math.max(this.due + delay, this.clock.now() + delay * 0.25);
        this.schedule();
      },
      Math.max(0, this.due - this.clock.now()),
    );
  }
}
