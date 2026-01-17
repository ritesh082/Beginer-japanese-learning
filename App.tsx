
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { LearningType, Difficulty, CharacterRow, WordData, QuizState, QuizResult, SRSRecord, Achievement } from './types';
import { HIRAGANA_ROWS, KATAKANA_ROWS } from './constants';
import { generateWords, getEncouragement } from './services/geminiService';

const SRS_INTERVALS = [
  0,                  // Level 0: Immediate (not used as interval)
  60 * 60 * 1000,      // Level 1: 1 hour
  24 * 60 * 60 * 1000, // Level 2: 1 day
  3 * 24 * 60 * 60 * 1000,  // Level 3: 3 days
  7 * 24 * 60 * 60 * 1000,  // Level 4: 7 days
  14 * 24 * 60 * 60 * 1000, // Level 5: 14 days
  30 * 24 * 60 * 60 * 1000, // Level 6: 30 days
  90 * 24 * 60 * 60 * 1000, // Level 7: 90 days
  180 * 24 * 60 * 60 * 1000 // Level 8: 180 days (Mastered)
];

const BASE_POINTS = 500;
const MAX_SPEED_BONUS = 500;
const STREAK_INCREMENT = 0.1;
const MAX_MULTIPLIER = 2.0;

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'apprentice_badge',
    title: 'Apprentice',
    description: 'Have at least 5 words at SRS Level 1 or higher.',
    icon: '🌱',
    category: 'SRS',
    condition: (_, srs) => Object.values(srs).filter(w => w.level >= 1).length >= 5
  },
  {
    id: 'senior_badge',
    title: 'Senior Learner',
    description: 'Have at least 10 words at SRS Level 4 or higher.',
    icon: '📜',
    category: 'SRS',
    condition: (_, srs) => Object.values(srs).filter(w => w.level >= 4).length >= 10
  },
  {
    id: 'master_badge',
    title: 'Nihongo Master',
    description: 'Master at least 5 words (SRS Level 8).',
    icon: '👑',
    category: 'SRS',
    condition: (_, srs) => Object.values(srs).filter(w => w.level >= 8).length >= 5
  },
  {
    id: 'perfect_session',
    title: 'Flawless Victory',
    description: 'Complete a standard session with 100% accuracy.',
    icon: '💎',
    category: 'Accuracy',
    condition: (history) => history.some(h => h.accuracy === 100 && h.totalAnswered >= 5)
  },
  {
    id: 'consistent_learner',
    title: 'Consistent',
    description: 'Complete 3 sessions with over 90% accuracy.',
    icon: '⚖️',
    category: 'Accuracy',
    condition: (history) => history.filter(h => h.accuracy >= 90).length >= 3
  },
  {
    id: 'streak_fire',
    title: 'On Fire',
    description: 'Achieve a streak of 10 correct answers.',
    icon: '🔥',
    category: 'Streak',
    condition: (history) => history.some(h => h.maxStreak >= 10)
  }
];

const App: React.FC = () => {
  const [userName, setUserName] = useState<string | null>(null);
  const [view, setView] = useState<'home' | 'quiz' | 'history'>('home');
  const [learningType, setLearningType] = useState<LearningType | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [isEndless, setIsEndless] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quizState, setQuizState] = useState<QuizState | null>(null);
  const [userInput, setUserInput] = useState('');
  const [isGameFinished, setIsGameFinished] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Stats, History, and SRS
  const [history, setHistory] = useState<QuizResult[]>([]);
  const [srsData, setSrsData] = useState<Record<string, SRSRecord>>({});
  const [sessionStruggledWords, setSessionStruggledWords] = useState<WordData[]>([]);
  const [totalCorrectInSession, setTotalCorrectInSession] = useState(0);
  const [sessionMaxStreak, setSessionMaxStreak] = useState(0);
  const [unlockedAchievementIds, setUnlockedAchievementIds] = useState<Set<string>>(new Set());

  // Custom mode states
  const [customTopic, setCustomTopic] = useState('');
  const [customWords, setCustomWords] = useState<WordData[]>([]);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const loginInputRef = useRef<HTMLInputElement>(null);

  // Load data on mount
  useEffect(() => {
    const savedName = localStorage.getItem('nihongo_user');
    if (savedName) setUserName(savedName);

    const savedHistory = localStorage.getItem('nihongo_history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));

    const savedSRS = localStorage.getItem('nihongo_srs');
    if (savedSRS) setSrsData(JSON.parse(savedSRS));

    const savedAchievements = localStorage.getItem('nihongo_achievements');
    if (savedAchievements) setUnlockedAchievementIds(new Set(JSON.parse(savedAchievements)));
  }, []);

  // Check for achievements
  useEffect(() => {
    const newUnlocked = new Set(unlockedAchievementIds);
    let changed = false;

    ACHIEVEMENTS.forEach(achievement => {
      if (!newUnlocked.has(achievement.id) && achievement.condition(history, srsData)) {
        newUnlocked.add(achievement.id);
        changed = true;
      }
    });

    if (changed) {
      setUnlockedAchievementIds(newUnlocked);
      localStorage.setItem('nihongo_achievements', JSON.stringify(Array.from(newUnlocked)));
    }
  }, [history, srsData, unlockedAchievementIds]);

  // Automatic focus management
  useEffect(() => {
    if (view === 'quiz' && !isTransitioning && !isGameFinished) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [view, isTransitioning, isGameFinished]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const name = loginInputRef.current?.value.trim();
    if (name) {
      setUserName(name);
      localStorage.setItem('nihongo_user', name);
    }
  };

  const handleLogout = () => {
    if (window.confirm("Switch user? All your progress is tied to your local device.")) {
      setUserName(null);
      localStorage.removeItem('nihongo_user');
      reset();
    }
  };

  const updateSRS = useCallback((word: WordData, isCorrect: boolean) => {
    setSrsData(prev => {
      const current = prev[word.japanese] || { word, level: 0, interval: 0, nextReview: 0 };
      let nextLevel = isCorrect ? Math.min(current.level + 1, 8) : 0;
      const nextRecord: SRSRecord = {
        word,
        level: nextLevel,
        interval: SRS_INTERVALS[nextLevel],
        nextReview: Date.now() + (isCorrect ? SRS_INTERVALS[nextLevel] : 300000)
      };
      const newData = { ...prev, [word.japanese]: nextRecord };
      localStorage.setItem('nihongo_srs', JSON.stringify(newData));
      return newData;
    });
  }, []);

  const dueWords = useMemo(() => {
    const now = Date.now();
    return (Object.values(srsData) as SRSRecord[]).filter(item => item.nextReview <= now && item.level < 8);
  }, [srsData]);

  const masteryStats = useMemo(() => {
    const rowFailCounts: Record<string, number> = {};
    const charFailCounts: Record<string, number> = {};
    const wordFailCounts: Record<string, { word: WordData, fails: number }> = {};
    const allRows = [...HIRAGANA_ROWS, ...KATAKANA_ROWS];

    history.forEach(res => {
      res.struggledWords.forEach(w => {
        if (!wordFailCounts[w.japanese]) wordFailCounts[w.japanese] = { word: w, fails: 0 };
        wordFailCounts[w.japanese].fails += 1;
        const chars = w.japanese.split('');
        chars.forEach(char => {
          charFailCounts[char] = (charFailCounts[char] || 0) + 1;
          const row = allRows.find(r => r.characters.includes(char));
          if (row) rowFailCounts[row.id] = (rowFailCounts[row.id] || 0) + 1;
        });
      });
    });

    return {
      struggledWords: Object.values(wordFailCounts).sort((a, b) => b.fails - a.fails).slice(0, 10),
      strugglingRowIds: Object.keys(rowFailCounts).sort((a, b) => rowFailCounts[b] - rowFailCounts[a]),
      weakestChars: Object.keys(charFailCounts).sort((a, b) => charFailCounts[b] - charFailCounts[a]).slice(0, 10),
      rowFailCounts
    };
  }, [history]);

  const saveToHistory = useCallback((state: QuizState, totalCorrect: number, struggled: WordData[]) => {
    const result: QuizResult = {
      id: Date.now().toString(),
      date: Date.now(),
      type: learningType!,
      difficulty: state.difficulty,
      score: state.totalPoints,
      totalAnswered: state.currentIndex,
      accuracy: state.currentIndex > 0 ? (totalCorrect / state.currentIndex) * 100 : 0,
      struggledWords: struggled,
      maxStreak: sessionMaxStreak
    };
    const newHistory = [result, ...history].slice(0, 50);
    setHistory(newHistory);
    localStorage.setItem('nihongo_history', JSON.stringify(newHistory));
  }, [history, learningType, sessionMaxStreak]);

  const startQuiz = async (forceRows?: string[], srsReviewWords?: WordData[]) => {
    if (srsReviewWords) {
      setQuizState({
        score: 0, totalPoints: 0, currentIndex: 0,
        words: srsReviewWords, feedback: null,
        compliment: `Welcome back, ${userName}! Let's review.`,
        startTime: Date.now(), difficulty: Difficulty.MEDIUM,
        isEndless: false, isReviewSession: true,
        streak: 0, multiplier: 1.0
      });
      setLearningType(LearningType.REVIEW);
      setView('quiz');
      setTotalCorrectInSession(0);
      setSessionMaxStreak(0);
      setSessionStruggledWords([]);
      return;
    }

    const activeLearningType = learningType || LearningType.HIRAGANA;
    const activeRows = forceRows || selectedRows;

    if (activeLearningType !== LearningType.CUSTOM && activeRows.length === 0 && activeLearningType !== LearningType.KANJI) {
      alert("Please select at least one row.");
      return;
    }

    setLoading(true);
    let finalWords = [...customWords];

    if (activeLearningType !== LearningType.CUSTOM || (activeLearningType === LearningType.CUSTOM && finalWords.length === 0)) {
      let chars: string[] = [];
      if (activeLearningType === LearningType.HIRAGANA) {
        chars = HIRAGANA_ROWS.filter(r => activeRows.includes(r.id)).flatMap(r => r.characters);
      } else if (activeLearningType === LearningType.KATAKANA) {
        chars = KATAKANA_ROWS.filter(r => activeRows.includes(r.id)).flatMap(r => r.characters);
      } else {
        chars = ['N5 Kanji'];
      }
      
      // CRITICAL FIX: Filter priority characters (those student struggles with)
      // to ensure they only include characters from the currently selected rows.
      // This stops the AI from using characters outside the user's choice.
      const priorityChars = masteryStats.weakestChars.filter(char => chars.includes(char));
      
      finalWords = await generateWords(activeLearningType, chars, difficulty, customTopic, priorityChars);
    }

    if (finalWords.length > 0) {
      setQuizState({
        score: 0, totalPoints: 0, currentIndex: 0, words: finalWords,
        feedback: null, compliment: `Gambatte, ${userName}!`,
        startTime: Date.now(), difficulty, isEndless,
        streak: 0, multiplier: 1.0
      });
      setIsGameFinished(false);
      setUserInput('');
      setIsTransitioning(false);
      setSessionStruggledWords([]);
      setTotalCorrectInSession(0);
      setSessionMaxStreak(0);
      setView('quiz');
    } else {
      alert("AI Sensei couldn't find matches within your selection. Try selecting more rows or simpler difficulty.");
    }
    setLoading(false);
  };

  const calculatePoints = (state: QuizState, isCorrect: boolean): number => {
    if (!isCorrect) return 0;
    const elapsed = Date.now() - state.startTime;
    const speedBonus = Math.max(0, MAX_SPEED_BONUS - Math.floor(elapsed / 20)); 
    let diffMult = 1.0;
    if (state.difficulty === Difficulty.EASY) diffMult = 0.7;
    if (state.difficulty === Difficulty.HARD) diffMult = 1.5;
    const points = (BASE_POINTS + speedBonus) * state.multiplier * diffMult;
    return Math.floor(points);
  };

  const handleInputSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizState || quizState.feedback || !userInput.trim() || isTransitioning) return;

    setIsTransitioning(true);
    const currentWord = quizState.words[quizState.currentIndex];
    const isCorrect = userInput.toLowerCase().trim() === currentWord.romaji.toLowerCase().trim();
    
    updateSRS(currentWord, isCorrect);
    const points = calculatePoints(quizState, isCorrect);
    
    const nextStreak = isCorrect ? quizState.streak + 1 : 0;
    const nextMultiplier = isCorrect 
      ? Math.min(MAX_MULTIPLIER, 1.0 + (nextStreak * STREAK_INCREMENT)) 
      : 1.0;

    if (isCorrect) {
      setTotalCorrectInSession(prev => prev + 1);
      if (nextStreak > sessionMaxStreak) setSessionMaxStreak(nextStreak);
    } else {
      setSessionStruggledWords(prev => [...prev, currentWord]);
    }

    setQuizState(prev => prev ? ({
      ...prev,
      feedback: isCorrect ? 'correct' : 'incorrect',
      totalPoints: prev.totalPoints + points,
      streak: nextStreak,
      multiplier: nextMultiplier
    }) : null);

    getEncouragement(isCorrect, userName!, points).then(compliment => {
      setQuizState(prev => prev ? ({ ...prev, compliment }) : null);
    });

    setTimeout(() => {
      setQuizState(prev => {
        if (!prev) return null;
        let nextIndex = prev.currentIndex + 1;
        if (!prev.isEndless && nextIndex >= prev.words.length) {
          setIsGameFinished(true);
          saveToHistory(prev, isCorrect ? totalCorrectInSession + 1 : totalCorrectInSession, isCorrect ? sessionStruggledWords : [...sessionStruggledWords, currentWord]);
          return prev;
        }
        if (prev.isEndless && nextIndex >= prev.words.length) nextIndex = 0;
        return { ...prev, currentIndex: nextIndex, feedback: null, startTime: Date.now() };
      });
      setUserInput('');
      setIsTransitioning(false);
    }, 2000);
  };

  const handleExitQuiz = () => {
    if (window.confirm("Are you sure you want to quit this session?")) {
      reset();
    }
  };

  const reset = () => {
    setLearningType(null);
    setSelectedRows([]);
    setQuizState(null);
    setIsGameFinished(false);
    setIsTransitioning(false);
    setIsEndless(false);
    setCustomWords([]);
    setCustomTopic('');
    setView('home');
  };

  if (!userName) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-10 border border-white text-center">
          <div className="relative mb-6 inline-block">
            <div className="absolute -inset-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full blur opacity-30 animate-pulse"></div>
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Nihongo" alt="Sensei" className="relative w-24 h-24 rounded-full border-4 border-white shadow-lg mx-auto" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 mb-2">Irasshaimase!</h1>
          <p className="text-slate-500 mb-8 font-medium">Welcome to Nihongo Master. Please enter your name to start your journey.</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              ref={loginInputRef}
              type="text" 
              required
              placeholder="Your name..." 
              className="w-full py-4 px-6 rounded-2xl border-4 border-slate-50 focus:border-indigo-400 focus:outline-none text-xl text-center font-bold text-slate-700 transition-all bg-slate-50"
            />
            <button type="submit" className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95 transition-all">
              GET STARTED
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-6 px-4">
      <header className="max-w-4xl w-full flex flex-col items-center mb-8">
        <div className="w-full flex justify-between items-start mb-6">
           <div className="flex-1"></div>
           <div className="flex flex-col items-center">
              <div className="relative mb-2 group">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                <img 
                  src="logo.png" 
                  alt="Nihongo Master Logo" 
                  className="relative w-20 h-20 rounded-full border-4 border-white shadow-xl object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + userName; }}
                />
              </div>
              <h1 className="text-3xl font-black text-indigo-600 tracking-tight">Nihongo Master</h1>
           </div>
           <div className="flex-1 flex justify-end">
              <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3">
                 <span className="text-xs font-black text-slate-400 uppercase tracking-widest hidden sm:block">Master</span>
                 <span className="font-bold text-slate-700">{userName}</span>
                 <button onClick={handleLogout} className="text-slate-300 hover:text-red-500 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                 </button>
              </div>
           </div>
        </div>
        
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100">
          <button onClick={() => { reset(); setView('home'); }} className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${view === 'home' || view === 'quiz' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>Practice</button>
          <button onClick={() => setView('history')} className={`px-6 py-2 rounded-lg font-bold text-sm transition-all ${view === 'history' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>Insights</button>
        </div>
      </header>

      <main className="max-w-2xl w-full bg-white rounded-3xl shadow-xl shadow-slate-200 overflow-hidden relative border border-white">
        {view === 'history' ? (
          <div className="p-8">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 mb-6">
              <span className="text-3xl">🧠</span> {userName}'s Stats
            </h2>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                <span className="text-xs font-bold text-orange-400 uppercase tracking-widest">Words Due</span>
                <div className="text-3xl font-black text-orange-700">{dueWords.length}</div>
              </div>
              <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Mastered</span>
                <div className="text-3xl font-black text-indigo-700">{(Object.values(srsData) as SRSRecord[]).filter(w => w.level >= 8).length}</div>
              </div>
            </div>

            <div className="space-y-10">
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Achievements</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {ACHIEVEMENTS.map(achievement => {
                    const isUnlocked = unlockedAchievementIds.has(achievement.id);
                    return (
                      <div key={achievement.id} className={`p-3 rounded-2xl border text-center transition-all ${isUnlocked ? 'bg-white border-indigo-200 shadow-md scale-100' : 'bg-slate-50 border-slate-100 grayscale opacity-40'}`}>
                        <div className="text-3xl mb-1">{achievement.icon}</div>
                        <div className="text-[10px] font-black text-slate-800 leading-tight uppercase mb-1">{achievement.title}</div>
                        <div className="text-[8px] text-slate-500 leading-tight line-clamp-2">{achievement.description}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-3">Mastery Pipeline</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 4, 8].map(lv => (
                    <div key={lv} className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                       <div className="text-xl font-black text-slate-700">{(Object.values(srsData) as SRSRecord[]).filter(w => w.level >= lv && (lv === 8 ? true : w.level < lv + 3)).length}</div>
                       <div className="text-[10px] text-slate-400 font-bold uppercase">{lv === 1 ? 'Apprentice' : lv === 4 ? 'Senior' : 'Mastered'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : !learningType ? (
          <div className="p-8">
             {dueWords.length > 0 && (
               <div className="mb-8 bg-gradient-to-r from-orange-400 to-amber-500 p-6 rounded-2xl text-white shadow-lg shadow-orange-100">
                  <h3 className="text-xl font-bold mb-1">Time to Review, {userName}!</h3>
                  <p className="text-white/80 text-sm mb-4">{dueWords.length} words are waiting for you.</p>
                  <button onClick={() => startQuiz(undefined, dueWords.map(d => d.word))} className="bg-white text-orange-600 px-6 py-2 rounded-xl font-black text-sm hover:bg-slate-50 transition-colors uppercase">Start Review</button>
               </div>
             )}

            <h2 className="text-2xl font-bold mb-6 text-slate-800 text-center">What's the plan, {userName}?</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {[LearningType.HIRAGANA, LearningType.KATAKANA, LearningType.KANJI, LearningType.CUSTOM].map((type) => (
                <button
                  key={type}
                  onClick={() => setLearningType(type)}
                  className={`p-4 border-2 rounded-2xl transition-all duration-200 group flex flex-col items-center border-slate-100 hover:border-indigo-400 hover:bg-indigo-50`}
                >
                  <span className={`text-3xl mb-2 group-hover:scale-110 transition-transform text-indigo-600`}>
                    {type === LearningType.HIRAGANA ? 'あ' : type === LearningType.KATAKANA ? 'ア' : type === LearningType.KANJI ? '漢' : '習'}
                  </span>
                  <span className="font-bold text-sm text-slate-700">{type}</span>
                </button>
              ))}
            </div>
          </div>
        ) : !quizState ? (
          <div className="p-8">
            <button onClick={() => setLearningType(null)} className="mb-4 text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium transition-colors">← Back</button>
            <h2 className="text-2xl font-bold mb-4 text-slate-800">Configure Practice</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8">
              <div>
                <p className="text-slate-600 mb-3 font-medium">Difficulty:</p>
                <div className="flex flex-col gap-2">
                  <button onClick={() => setDifficulty(Difficulty.EASY)} className={`py-2 px-4 rounded-xl border-2 transition-all font-bold text-sm ${difficulty === Difficulty.EASY ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}`}>Easy</button>
                  <button onClick={() => setDifficulty(Difficulty.MEDIUM)} className={`py-2 px-4 rounded-xl border-2 transition-all font-bold text-sm ${difficulty === Difficulty.MEDIUM ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}`}>Medium</button>
                  <button onClick={() => setDifficulty(Difficulty.HARD)} className={`py-2 px-4 rounded-xl border-2 transition-all font-bold text-sm ${difficulty === Difficulty.HARD ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}`}>Hard</button>
                </div>
              </div>
              <div>
                <p className="text-slate-600 mb-3 font-medium">Goal:</p>
                <div className="flex flex-col gap-2">
                  <button onClick={() => setIsEndless(false)} className={`py-2 px-4 rounded-xl border-2 transition-all font-bold text-sm ${!isEndless ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}`}>Standard (10 words)</button>
                  <button onClick={() => setIsEndless(true)} className={`py-2 px-4 rounded-xl border-2 transition-all font-bold text-sm ${isEndless ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'}`}>Infinite Drill</button>
                </div>
              </div>
            </div>
            
            {learningType !== LearningType.KANJI && learningType !== LearningType.CUSTOM && (
              <div className="space-y-4 mb-8">
                <p className="text-slate-600 font-medium">Character Rows:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {(learningType === LearningType.HIRAGANA ? HIRAGANA_ROWS : KATAKANA_ROWS).map((row) => (
                    <label key={row.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${selectedRows.includes(row.id) ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 hover:border-slate-200'}`}>
                      <input type="checkbox" className="w-5 h-5 accent-indigo-600 rounded" checked={selectedRows.includes(row.id)} onChange={(e) => { if (e.target.checked) setSelectedRows([...selectedRows, row.id]); else setSelectedRows(selectedRows.filter(id => id !== row.id)); }} />
                      <div className="flex flex-col"><span className="font-bold japanese-font text-lg">{row.characters.join(' ')}</span><span className="text-xs opacity-70">{row.label}</span></div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => startQuiz()} disabled={loading} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg shadow-lg disabled:bg-slate-300 transition-all active:scale-95">
              {loading ? 'AI is Thinking...' : 'Let\'s Go!'}
            </button>
          </div>
        ) : isGameFinished ? (
          <div className="p-10 text-center">
            <div className="text-6xl mb-6">🏆</div>
            <h2 className="text-3xl font-extrabold text-slate-800 mb-2">Great Session, {userName}!</h2>
            <div className="space-y-2 mb-8">
              <p className="text-slate-500 font-medium">Score: <span className="text-indigo-600 font-bold">{quizState.totalPoints}</span></p>
              <p className="text-slate-500 font-medium">Max Streak: <span className="text-orange-500 font-bold">{sessionMaxStreak} 🔥</span></p>
            </div>
            <button onClick={reset} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg shadow-lg">Return Home</button>
          </div>
        ) : (
          <div className="p-8">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">{quizState.currentIndex + 1}</div>
                 {!quizState.isEndless && <span className="text-slate-400 font-medium">/ {quizState.words.length}</span>}
              </div>
              <div className="flex items-center gap-3">
                {quizState.streak > 1 && (
                  <div className="flex items-center bg-orange-50 text-orange-600 px-3 py-1 rounded-full text-xs font-black animate-bounce border border-orange-100">
                    {quizState.streak} 🔥 {quizState.multiplier.toFixed(1)}x
                  </div>
                )}
                <button onClick={handleExitQuiz} className="text-xs font-bold text-slate-400 hover:text-red-500 uppercase tracking-widest">Quit</button>
              </div>
            </div>

            <div className="text-center mb-10">
              <div className={`text-8xl mb-4 font-bold japanese-font transition-all ${quizState.feedback === 'correct' ? 'text-green-500 scale-110' : quizState.feedback === 'incorrect' ? 'text-red-500 shake' : 'text-slate-800'}`}>{quizState.words[quizState.currentIndex].japanese}</div>
              <div className="h-6 text-slate-400 font-bold uppercase text-[10px] tracking-widest">{quizState.feedback && quizState.words[quizState.currentIndex].meaning}</div>
            </div>

            <form onSubmit={handleInputSubmit} className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <input ref={inputRef} type="text" autoFocus value={userInput} onChange={(e) => setUserInput(e.target.value)} disabled={isTransitioning} placeholder="Type romaji..." className={`w-full py-5 px-6 text-3xl text-center rounded-2xl border-4 transition-all focus:outline-none ${quizState.feedback === 'correct' ? 'border-green-500 bg-green-50 text-green-700' : quizState.feedback === 'incorrect' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-100 focus:border-indigo-400 bg-slate-50'}`} />
                  {quizState.feedback === 'incorrect' && <div className="mt-2 text-center text-red-500 font-bold uppercase animate-pulse text-sm">Answer: {quizState.words[quizState.currentIndex].romaji}</div>}
                </div>
                <button type="submit" disabled={isTransitioning || !userInput.trim()} className={`py-5 px-10 rounded-2xl font-black text-xl shadow-lg transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${quizState.feedback ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>SUBMIT</button>
              </div>
              <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="italic text-slate-600 text-sm flex-1 font-medium">{quizState.compliment}</p>
                <div className="text-right">
                  <span className="block text-[10px] text-slate-400 font-black uppercase">Session Points</span>
                  <span className="text-lg font-black text-indigo-600">{quizState.totalPoints}</span>
                </div>
              </div>
            </form>
          </div>
        )}
      </main>

      <footer className="mt-auto py-8 text-slate-400 text-[10px] font-black uppercase tracking-[3px] opacity-60">
        Nihongo Master • {userName}'s Lab
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
        @keyframes shake {
          10%, 90% { transform: translate3d(-1px, 0, 0); }
          20%, 80% { transform: translate3d(2px, 0, 0); }
          30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
          40%, 60% { transform: translate3d(4px, 0, 0); }
        }
      `}</style>
    </div>
  );
};

export default App;
