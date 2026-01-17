
import React, { useState, useEffect, useCallback } from 'react';
import { LearningType, Difficulty, CharacterRow, WordData, QuizState } from './types';
import { HIRAGANA_ROWS, KATAKANA_ROWS } from './constants';
import { generateWords, getEncouragement } from './services/geminiService';

const App: React.FC = () => {
  const [learningType, setLearningType] = useState<LearningType | null>(null);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [loading, setLoading] = useState(false);
  const [quizState, setQuizState] = useState<QuizState | null>(null);
  const [userInput, setUserInput] = useState('');
  const [isGameFinished, setIsGameFinished] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const startQuiz = async () => {
    if (selectedRows.length === 0 && learningType !== LearningType.KANJI) return;

    setLoading(true);
    let chars: string[] = [];
    if (learningType === LearningType.HIRAGANA) {
      chars = HIRAGANA_ROWS.filter(r => selectedRows.includes(r.id)).flatMap(r => r.characters);
    } else if (learningType === LearningType.KATAKANA) {
      chars = KATAKANA_ROWS.filter(r => selectedRows.includes(r.id)).flatMap(r => r.characters);
    } else {
      chars = ['N5 Kanji'];
    }

    const words = await generateWords(learningType!, chars, difficulty);
    if (words.length > 0) {
      setQuizState({
        score: 0,
        totalPoints: 0,
        currentIndex: 0,
        words,
        feedback: null,
        compliment: 'Ready? Start typing the romaji!',
        startTime: Date.now(),
        difficulty: difficulty
      });
      setIsGameFinished(false);
      setUserInput('');
      setIsTransitioning(false);
    }
    setLoading(false);
  };

  const calculatePoints = (startTime: number, diff: Difficulty): number => {
    const elapsedSeconds = (Date.now() - startTime) / 1000;
    let intervals = 0;
    let pointsPerInterval = 100;
    let intervalDuration = 5;

    if (diff === Difficulty.EASY) {
      intervalDuration = 10;
      intervals = Math.floor(elapsedSeconds / intervalDuration);
      pointsPerInterval = 100;
    } else if (diff === Difficulty.MEDIUM) {
      intervalDuration = 5;
      intervals = Math.floor(elapsedSeconds / intervalDuration);
      pointsPerInterval = 100;
    } else if (diff === Difficulty.HARD) {
      intervalDuration = 3;
      intervals = Math.floor(elapsedSeconds / intervalDuration);
      pointsPerInterval = 200;
    }

    const points = 1000 - (intervals * pointsPerInterval);
    return Math.max(0, points);
  };

  const handleInputSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Guard against multiple clicks or submitting while feedback is showing
    if (!quizState || quizState.feedback || !userInput.trim() || isTransitioning) return;

    setIsTransitioning(true);
    const currentWord = quizState.words[quizState.currentIndex];
    const isCorrect = userInput.toLowerCase().trim() === currentWord.romaji.toLowerCase().trim();
    
    const points = isCorrect ? calculatePoints(quizState.startTime, quizState.difficulty) : 0;
    
    // UI feedback starts
    setQuizState(prev => prev ? ({
      ...prev,
      feedback: isCorrect ? 'correct' : 'incorrect',
      totalPoints: prev.totalPoints + points,
    }) : null);

    // AI Compliment fetched separately to not block UI feedback
    getEncouragement(isCorrect, points).then(compliment => {
      setQuizState(prev => prev ? ({ ...prev, compliment }) : null);
    });

    // Wait and move to next question
    setTimeout(() => {
      setQuizState(prev => {
        if (!prev) return null;
        const nextIndex = prev.currentIndex + 1;
        if (nextIndex >= prev.words.length) {
          setIsGameFinished(true);
          return prev;
        }
        return {
          ...prev,
          currentIndex: nextIndex,
          feedback: null,
          startTime: Date.now()
        };
      });
      setUserInput('');
      setIsTransitioning(false); // Allow the next interaction
    }, 2000);
  };

  const reset = () => {
    setLearningType(null);
    setSelectedRows([]);
    setQuizState(null);
    setIsGameFinished(false);
    setIsTransitioning(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-10 px-4">
      <header className="max-w-4xl w-full text-center mb-10">
        <h1 className="text-4xl font-extrabold text-indigo-600 mb-2">Nihongo Master</h1>
        <p className="text-slate-500">Master Japanese characters with AI feedback and speed challenges.</p>
      </header>

      <main className="max-w-2xl w-full bg-white rounded-3xl shadow-xl shadow-slate-200 overflow-hidden">
        {!learningType ? (
          <div className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-6 text-slate-800">What would you like to learn today?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[LearningType.HIRAGANA, LearningType.KATAKANA, LearningType.KANJI].map((type) => (
                <button
                  key={type}
                  onClick={() => setLearningType(type)}
                  className="p-6 border-2 border-slate-100 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50 transition-all duration-200 group"
                >
                  <span className="block text-3xl mb-2 group-hover:scale-110 transition-transform">
                    {type === LearningType.HIRAGANA ? 'あ' : type === LearningType.KATAKANA ? 'ア' : '漢'}
                  </span>
                  <span className="font-semibold text-slate-700">{type}</span>
                </button>
              ))}
            </div>
          </div>
        ) : !quizState ? (
          <div className="p-8">
            <button 
              onClick={() => setLearningType(null)}
              className="mb-4 text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium transition-colors"
            >
              ← Back
            </button>
            <h2 className="text-2xl font-bold mb-4 text-slate-800">Configure your {learningType} session</h2>
            
            <div className="mb-8">
              <p className="text-slate-600 mb-3 font-medium">Difficulty Level:</p>
              <div className="flex gap-2">
                {[Difficulty.EASY, Difficulty.MEDIUM, Difficulty.HARD].map((level) => (
                  <button
                    key={level}
                    onClick={() => setDifficulty(level)}
                    className={`flex-1 py-2 rounded-xl border-2 transition-all font-bold ${
                      difficulty === level 
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                        : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {learningType !== LearningType.KANJI ? (
              <div className="space-y-4 mb-8">
                <p className="text-slate-600 font-medium">Select characters to include:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {(learningType === LearningType.HIRAGANA ? HIRAGANA_ROWS : KATAKANA_ROWS).map((row) => (
                    <label 
                      key={row.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                        selectedRows.includes(row.id) 
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                        : 'border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <input 
                        type="checkbox"
                        className="w-5 h-5 accent-indigo-600 rounded"
                        checked={selectedRows.includes(row.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedRows([...selectedRows, row.id]);
                          else setSelectedRows(selectedRows.filter(id => id !== row.id));
                        }}
                      />
                      <div className="flex flex-col">
                        <span className="font-bold japanese-font text-lg">{row.characters.join(' ')}</span>
                        <span className="text-xs opacity-70">{row.label}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-8 p-6 bg-slate-50 rounded-2xl text-slate-600 border border-slate-200">
                Testing common JLPT N5 Kanji words optimized for {difficulty} level.
              </div>
            )}

            <button
              onClick={startQuiz}
              disabled={loading || (learningType !== LearningType.KANJI && selectedRows.length === 0)}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-2xl font-bold text-lg shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Generating Words...
                </>
              ) : 'Start Practice'}
            </button>
          </div>
        ) : isGameFinished ? (
          <div className="p-10 text-center">
            <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl">
              🎉
            </div>
            <h2 className="text-3xl font-extrabold text-slate-800 mb-2">Quiz Complete!</h2>
            <p className="text-slate-500 mb-8">Level: <span className="text-indigo-600 font-bold">{quizState.difficulty}</span></p>
            <div className="bg-slate-50 rounded-2xl p-6 mb-8">
              <span className="text-slate-500 uppercase text-xs font-bold tracking-wider">Final Score</span>
              <div className="text-5xl font-black text-indigo-600 mt-2">{quizState.totalPoints}</div>
            </div>
            <button
              onClick={reset}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg transition-all"
            >
              Return Home
            </button>
          </div>
        ) : (
          <div className="p-8">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center font-bold text-indigo-600">
                   {quizState.currentIndex + 1}
                 </div>
                 <span className="text-slate-400 font-medium">/ {quizState.words.length}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  quizState.difficulty === Difficulty.HARD ? 'bg-red-50 text-red-600 border-red-100' : 
                  quizState.difficulty === Difficulty.MEDIUM ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                  'bg-green-50 text-green-600 border-green-100'
                }`}>
                  {quizState.difficulty}
                </span>
                <div className="bg-slate-100 text-slate-700 px-4 py-1.5 rounded-full text-sm font-bold">
                  Score: {quizState.totalPoints}
                </div>
              </div>
            </div>

            <div className="text-center mb-10">
              <div className={`text-7xl mb-4 font-bold japanese-font transition-all duration-500 ${quizState.feedback === 'correct' ? 'text-green-500 scale-110' : quizState.feedback === 'incorrect' ? 'text-red-500 shake' : 'text-slate-800'}`}>
                {quizState.words[quizState.currentIndex].japanese}
              </div>
              <div className="h-6 text-slate-400 font-medium">
                {quizState.feedback && quizState.words[quizState.currentIndex].meaning}
              </div>
            </div>

            <form onSubmit={handleInputSubmit} className="space-y-6">
              <div className="relative">
                <input
                  type="text"
                  autoFocus
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  disabled={isTransitioning}
                  placeholder="Type romaji..."
                  className={`w-full py-4 px-6 text-2xl text-center rounded-2xl border-4 transition-all focus:outline-none ${
                    quizState.feedback === 'correct' 
                      ? 'border-green-500 bg-green-50 text-green-700' 
                      : quizState.feedback === 'incorrect' 
                        ? 'border-red-500 bg-red-50 text-red-700' 
                        : 'border-slate-100 focus:border-indigo-400 bg-slate-50'
                  }`}
                />
                {quizState.feedback === 'incorrect' && (
                  <div className="mt-2 text-center text-red-500 font-bold animate-pulse">
                    Correct Answer: <span className="uppercase">{quizState.words[quizState.currentIndex].romaji}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isTransitioning || !userInput.trim()}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-2xl font-bold text-lg shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
              >
                {quizState.feedback === 'correct' ? (
                  <span className="flex items-center gap-2">Correct! <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></span>
                ) : quizState.feedback === 'incorrect' ? (
                  <span className="flex items-center gap-2">Incorrect <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></span>
                ) : (
                  'Check Answer'
                )}
              </button>
              
              <div className="bg-slate-50 p-4 rounded-xl text-center min-h-[60px] flex items-center justify-center">
                 <p className="text-slate-600 font-medium italic">
                    {quizState.compliment}
                 </p>
              </div>

              <div className="flex justify-between items-center text-sm font-bold text-slate-400 px-2">
                <span>SPEED BONUS</span>
                <Timer startTime={quizState.startTime} isPaused={isTransitioning} difficulty={quizState.difficulty} />
              </div>
            </form>
          </div>
        )}
      </main>

      <footer className="mt-auto py-8 text-slate-400 text-sm text-center">
        Built for Language Lovers • Powered by Gemini AI<br/>
        <span className="opacity-60 text-[10px] mt-1 block">Scoring: {difficulty === Difficulty.HARD ? '3s intervals' : difficulty === Difficulty.MEDIUM ? '5s intervals' : '10s intervals'}</span>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
        .shake {
          animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
        }
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

const Timer: React.FC<{ startTime: number, isPaused: boolean, difficulty: Difficulty }> = ({ startTime, isPaused, difficulty }) => {
  const [currentScore, setCurrentScore] = useState(1000);

  useEffect(() => {
    if (isPaused) return;
    
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      let intervals = 0;
      let pointsPerInterval = 100;
      let intervalDuration = 5;

      if (difficulty === Difficulty.EASY) {
        intervalDuration = 10;
        pointsPerInterval = 100;
      } else if (difficulty === Difficulty.MEDIUM) {
        intervalDuration = 5;
        pointsPerInterval = 100;
      } else if (difficulty === Difficulty.HARD) {
        intervalDuration = 3;
        pointsPerInterval = 200;
      }

      intervals = Math.floor(elapsed / intervalDuration);
      const score = Math.max(0, 1000 - (intervals * pointsPerInterval));
      setCurrentScore(score);
    }, 100);

    return () => clearInterval(interval);
  }, [startTime, isPaused, difficulty]);

  return (
    <span className={`${currentScore > 700 ? 'text-green-500' : currentScore > 300 ? 'text-amber-500' : 'text-red-500'}`}>
      {currentScore} pts
    </span>
  );
};

export default App;
