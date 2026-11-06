export type ReverseStage =
  | "preparing"
  | "listening"
  | "imitating"
  | "guessing"
  | "judging"
  | "revealed";
export type ListenStatus =
  | "unused"
  | "reserved"
  | "started"
  | "used"
  | "failed";
export type MimicStatus = "unused" | "reserved" | "captured" | "committed";
export interface ReverseRound {
  number: number;
  narrator_id: string;
  guesser_id: string;
  phase: ReverseStage;
  category: string | null;
  listen_status: ListenStatus;
  mimic_status: MimicStatus;
  ready: string[];
  guess: string | null;
  answer?: string;
  correct?: boolean;
}
export interface ReversePlayer {
  id: string;
  name: string;
  score: number;
}
export interface ReverseSession {
  id: string;
  room_id: string;
  game: "reverse";
  theme: null;
  phase: "playing" | "finished" | "abandoned";
  version: number;
  state: {
    players: [ReversePlayer, ReversePlayer];
    starter: number;
    current: ReverseRound;
    rounds: ReverseRound[];
    winner_id: string | null;
    rematch_ready: string[];
  };
}
export interface AudioAsset {
  id: string;
  path: string;
  frames: number;
  sample_rate: number;
  channels: number;
  expires_at: string | null;
}
export interface ReverseContext {
  my_word: string | null;
  listen_token: string | null;
  listen_status: ListenStatus;
  listen_until: string | null;
  started_at: string | null;
  mimic_status: MimicStatus;
  narrator_audio: AudioAsset | null;
  mimic_audio: AudioAsset | null;
}
export interface AudioTicket {
  id: string;
  path: string;
}
export interface ListenTicket {
  token: string;
  audio: AudioAsset;
}
export interface AudioMeta {
  frames: number;
  sample_rate: number;
  channels: number;
}
