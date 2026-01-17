
export enum LearningType {
  HIRAGANA = 'Hiragana',
  KATAKANA = 'Katakana',
  KANJI = 'Kanji',
  CUSTOM = 'Custom',
  REVIEW = 'Review'
}

export enum Difficulty {
  EASY = 'Easy',
  MEDIUM = 'Medium',
  HARD = 'Hard'
}

export interface CharacterRow {
  id: string;
  label: string;
  characters: string[];
  romaji: string[];
}

export interface WordData {
  japanese: string;
  romaji: string;
  meaning: string;
}

export interface SRSRecord {
  word: WordData;
  nextReview: number; // Timestamp
  level: number; // SRS level (0 to 8)
  interval: number; // Current interval in milliseconds
}

export interface QuizState {
  score: number;
  totalPoints: number;
  currentIndex: number;
  words: WordData[];
  feedback: 'correct' | 'incorrect' | null;
  compliment: string;
  startTime: number;
  difficulty: Difficulty;
  isEndless: boolean;
  isReviewSession?: boolean;
  streak: number;
  multiplier: number;
}

export interface QuizResult {
  id: string;
  date: number;
  type: LearningType;
  difficulty: Difficulty;
  score: number;
  accuracy: number;
  totalAnswered: number;
  struggledWords: WordData[];
  maxStreak: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'SRS' | 'Accuracy' | 'Streak';
  condition: (history: QuizResult[], srsData: Record<string, SRSRecord>) => boolean;
}
