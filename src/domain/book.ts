export interface Chapter {
  title: string;
  text: string;
}

export interface Book {
  title: string;
  author: string;
  chapters: Chapter[];
}

export interface ReadingText {
  words: string[];
  chapterStarts: number[];
}
