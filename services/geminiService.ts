
import { GoogleGenAI, Type } from "@google/genai";
import { WordData, LearningType, Difficulty } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateWords = async (
  type: LearningType, 
  availableChars: string[],
  difficulty: Difficulty
): Promise<WordData[]> => {
  let complexityDescription = "common everyday words";
  if (difficulty === Difficulty.EASY) {
    complexityDescription = "extremely simple words, mostly 2-3 characters long";
  } else if (difficulty === Difficulty.HARD) {
    complexityDescription = "complex and longer words, at least 4 characters long";
  }

  const prompt = `Generate exactly 10 real Japanese words in ${type} using ONLY characters from: [${availableChars.join(', ')}]. Words must be ${complexityDescription}. For Kanji mode, use JLPT N5 words.`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      systemInstruction: "You are a Japanese language expert. Provide concise, accurate JSON responses containing Japanese words, their romaji, and English meanings based on specific constraints. Do not include any explanation.",
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            japanese: { type: Type.STRING },
            romaji: { type: Type.STRING },
            meaning: { type: Type.STRING },
          },
          required: ['japanese', 'romaji', 'meaning'],
        },
      },
    },
  });

  try {
    return JSON.parse(response.text || '[]');
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return [];
  }
};

export const getEncouragement = async (isCorrect: boolean, score?: number): Promise<string> => {
  const prompt = isCorrect 
    ? `Student correct! Score: ${score}. Short enthusiastic Japanese-themed compliment (English, <8 words).`
    : "Student wrong. Short kind encouraging message (<8 words).";

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      systemInstruction: "You are a helpful Japanese sensei giving very brief encouragement.",
      thinkingConfig: { thinkingBudget: 0 },
    }
  });

  return response.text || (isCorrect ? "Subarashii! Great job!" : "Don't give up! Ganbare!");
};
