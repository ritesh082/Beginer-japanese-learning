
export enum LearningType {
  HIRAGANA = 'Hiragana',
  KATAKANA = 'Katakana',
  KANJI = 'Kanji'
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

export interface QuizState {
  score: number;
  totalPoints: number;
  currentIndex: number;
  words: WordData[];
  feedback: 'correct' | 'incorrect' | null;
  compliment: string;
  startTime: number;
  difficulty: Difficulty;
}
