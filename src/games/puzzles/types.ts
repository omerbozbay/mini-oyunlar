export type PuzzleId = "chain" | "detective" | "wordhunt";
export type LetterMark = "correct" | "present" | "absent";
export interface PuzzleGuess {
  guess: string;
  correct: boolean;
  target?: number;
  matches?: number;
  marks?: LetterMark[];
}
export interface PuzzlePlayer {
  id: string;
  name: string;
  prepared: boolean;
  revision: number;
  progress: number;
  history: PuzzleGuess[];
  done: boolean;
  solved: boolean;
  guess_count: number;
}
export interface ChainHint {
  first: string;
  length: number;
  word?: string;
}
export interface PuzzleState {
  players: [PuzzlePlayer, PuzzlePlayer];
  word_length: 5 | 6;
  starter: number;
  turn_id: string;
  round: number;
  winner_id: string | null;
  rematch_ready: string[];
  hints?: Record<string, ChainHint[]>;
  reveals?: Record<string, string | string[]>;
}
export interface PuzzleSession {
  id: string;
  room_id: string;
  game: PuzzleId;
  theme: null;
  phase: "preparing" | "playing" | "finished" | "abandoned";
  version: number;
  state: PuzzleState;
}
export interface PuzzleGameProps {
  session: PuzzleSession;
  userId: string;
  own: string | string[] | null;
  disabled: boolean;
  run: (action: string, payload?: unknown) => Promise<boolean>;
}
