
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { WordData, LearningType, Difficulty } from "../types";

// Always use the process.env.API_KEY directly as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Helper to call Gemini with exponential backoff for 429 errors.
 */
async function callGeminiWithRetry(
  params: any,
  retries = 3,
  delay = 1000
): Promise<GenerateContentResponse | null> {
  try {
    const response = await ai.models.generateContent(params);
    return response;
  } catch (error: any) {
    if (retries > 0 && error?.status === 429) {
      console.warn(`Rate limited. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callGeminiWithRetry(params, retries - 1, delay * 2);
    }
    console.error("Gemini API Error:", error);
    return null;
  }
}

export const generateWords = async (
  type: LearningType, 
  availableChars: string[],
  difficulty: Difficulty,
  customTopic?: string,
  priorityChars?: string[]
): Promise<WordData[]> => {
  let complexityDescription = "common everyday words";
  if (difficulty === Difficulty.EASY) {
    complexityDescription = "extremely simple words, mostly 2-3 characters long";
  } else if (difficulty === Difficulty.HARD) {
    complexityDescription = "complex and longer words, at least 4 characters long";
  }

  const charListStr = availableChars.join(', ');
  let prompt = "";
  const priorityStr = priorityChars && priorityChars.length > 0 
    ? `The user is struggling with these specific characters from the set, try to use them: [${priorityChars.join(', ')}].`
    : "";

  if (type === LearningType.CUSTOM && customTopic) {
    prompt = `Generate exactly 10 real Japanese words about the topic: "${customTopic}". ${priorityStr}`;
  } else if (type === LearningType.KANJI) {
    prompt = `Generate exactly 10 JLPT N5 level Kanji words. ${priorityStr}`;
  } else {
    prompt = `TASK: Generate a list of real Japanese words (aim for 10, but fewer is okay if needed) written ONLY in ${type} script.
    
    STRICT CHARACTER CONSTRAINT: 
    Every single character in every word MUST be chosen ONLY from this specific list: [${charListStr}].
    
    FORBIDDEN:
    - DO NOT use any characters NOT in the list above.
    - DO NOT use Kanji.
    - DO NOT use Katakana if this is a Hiragana task (and vice versa).
    - DO NOT use Dakuten or Handakuten unless they are explicitly in the character list provided.
    
    Difficulty: ${complexityDescription}. 
    ${priorityStr}`;
  }

  const response = await callGeminiWithRetry({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      systemInstruction: `You are a Japanese language vocabulary generator for beginners.
      Your primary rule is CHARACTER SET ADHERENCE. 
      If a user gives you a list of 5 characters, every word you generate MUST be composed only of those 5 characters. 
      It is better to provide 3 correct words than 10 words that violate the character list.
      Respond only with valid JSON that matches the provided schema.`,
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

  if (!response) return [];

  try {
    const words: WordData[] = JSON.parse(response.text || '[]');
    
    // Safety check: Filter out words that contain characters not in the available set 
    // This is the final line of defense if the AI ignores instructions.
    if (type === LearningType.HIRAGANA || type === LearningType.KATAKANA) {
      const charSet = new Set(availableChars);
      return words.filter(word => {
        const wordChars = word.japanese.split('');
        const isValid = wordChars.every(char => charSet.has(char));
        if (!isValid) {
          console.warn(`AI generated invalid word "${word.japanese}" for restricted set. Filtering out.`);
        }
        return isValid;
      });
    }

    return words;
  } catch (e) {
    console.error("Failed to parse Gemini response", e);
    return [];
  }
};

export const getEncouragement = async (isCorrect: boolean, name: string, score?: number): Promise<string> => {
  const prompt = isCorrect 
    ? `Student "${name}" just got a correct answer! Current Session Score: ${score}. Provide a short enthusiastic Japanese-themed compliment. CRITICAL: You MUST include their name "${name}" in the message. (English, <10 words).`
    : `Student "${name}" made a mistake. Provide a short kind encouraging message. CRITICAL: You MUST include their name "${name}" in the message to keep them motivated. (English, <10 words).`;

  const response = await callGeminiWithRetry({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      systemInstruction: "You are a helpful Japanese sensei giving very brief, personalized encouragement.",
      thinkingConfig: { thinkingBudget: 0 },
    }
  });

  return response?.text || (isCorrect ? `Sugoi, ${name}!` : `Don't give up, ${name}!`);
};
