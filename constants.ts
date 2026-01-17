
import { CharacterRow } from './types';

export const HIRAGANA_ROWS: CharacterRow[] = [
  { id: 'vowels', label: 'Vowels (A, I, U, E, O)', characters: ['あ', 'い', 'う', 'え', 'お'], romaji: ['a', 'i', 'u', 'e', 'o'] },
  { id: 'k_row', label: 'K-Row (Ka, Ki, Ku, Ke, Ko)', characters: ['か', 'き', 'く', 'け', 'こ'], romaji: ['ka', 'ki', 'ku', 'ke', 'ko'] },
  { id: 's_row', label: 'S-Row (Sa, Shi, Su, Se, So)', characters: ['さ', 'し', 'す', 'せ', 'そ'], romaji: ['sa', 'shi', 'su', 'se', 'so'] },
  { id: 't_row', label: 'T-Row (Ta, Chi, Tsu, Te, To)', characters: ['た', 'ち', 'つ', 'て', 'と'], romaji: ['ta', 'chi', 'tsu', 'te', 'to'] },
  { id: 'n_row', label: 'N-Row (Na, Ni, Nu, Ne, No)', characters: ['な', 'に', 'ぬ', 'ね', 'の'], romaji: ['na', 'ni', 'nu', 'ne', 'no'] },
  { id: 'h_row', label: 'H-Row (Ha, Hi, Fu, He, Ho)', characters: ['は', 'ひ', 'ふ', 'へ', 'ほ'], romaji: ['ha', 'hi', 'fu', 'he', 'ho'] },
  { id: 'm_row', label: 'M-Row (Ma, Mi, Mu, Me, Mo)', characters: ['ま', 'み', 'む', 'め', 'も'], romaji: ['ma', 'mi', 'mu', 'me', 'mo'] },
  { id: 'y_row', label: 'Y-Row (Ya, Yu, Yo)', characters: ['や', 'ゆ', 'よ'], romaji: ['ya', 'yu', 'yo'] },
  { id: 'r_row', label: 'R-Row (Ra, Ri, Ru, Re, Ro)', characters: ['ら', 'り', 'る', 'れ', 'ろ'], romaji: ['ra', 'ri', 'ru', 're', 'ro'] },
  { id: 'w_row', label: 'W-Row (Wa, Wo, N)', characters: ['わ', 'を', 'ん'], romaji: ['wa', 'wo', 'n'] },
];

export const KATAKANA_ROWS: CharacterRow[] = [
  { id: 'vowels', label: 'Vowels (A, I, U, E, O)', characters: ['ア', 'イ', 'ウ', 'エ', 'オ'], romaji: ['a', 'i', 'u', 'e', 'o'] },
  { id: 'k_row', label: 'K-Row (Ka, Ki, Ku, Ke, Ko)', characters: ['カ', 'キ', 'ク', 'ケ', 'コ'], romaji: ['ka', 'ki', 'ku', 'ke', 'ko'] },
  { id: 's_row', label: 'S-Row (Sa, Shi, Su, Se, So)', characters: ['サ', 'シ', 'ス', 'セ', 'ソ'], romaji: ['sa', 'shi', 'su', 'se', 'so'] },
  { id: 't_row', label: 'T-Row (Ta, Chi, Tsu, Te, To)', characters: ['タ', 'チ', 'ツ', 'テ', 'ト'], romaji: ['ta', 'chi', 'tsu', 'te', 'to'] },
  { id: 'n_row', label: 'N-Row (Na, Ni, Nu, Ne, No)', characters: ['ナ', 'ニ', 'ヌ', 'ネ', 'ノ'], romaji: ['na', 'ni', 'nu', 'ne', 'no'] },
  { id: 'h_row', label: 'H-Row (Ha, Hi, Fu, He, Ho)', characters: ['ハ', 'ヒ', 'フ', 'ヘ', 'ホ'], romaji: ['ha', 'hi', 'fu', 'he', 'ho'] },
  { id: 'm_row', label: 'M-Row (Ma, Mi, Mu, Me, Mo)', characters: ['マ', 'ミ', 'ム', 'メ', 'モ'], romaji: ['ma', 'mi', 'mu', 'me', 'mo'] },
  { id: 'y_row', label: 'Y-Row (Ya, Yu, Yo)', characters: ['ヤ', 'ユ', 'ヨ'], romaji: ['ya', 'yu', 'yo'] },
  { id: 'r_row', label: 'R-Row (Ra, Ri, Ru, Re, Ro)', characters: ['ラ', 'リ', 'ル', 'レ', 'ロ'], romaji: ['ra', 'ri', 'ru', 're', 'ro'] },
  { id: 'w_row', label: 'W-Row (Wa, Wo, N)', characters: ['ワ', 'ヲ', 'ン'], romaji: ['wa', 'wo', 'n'] },
];
