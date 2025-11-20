import readingTime from 'reading-time';

export interface ReadingStats {
  minutes: number;
  words: number;
  text: string;
}

export function estimateReadingTime(content: string): ReadingStats {
  const stats = readingTime(content || '');
  return {
    minutes: Math.max(1, Math.round(stats.minutes)),
    words: stats.words,
    text: stats.text,
  };
}
