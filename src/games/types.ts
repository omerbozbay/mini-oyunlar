export type GameId = "auction" | "chain" | "detective" | "wordhunt";

export interface GameDefinition {
  id: GameId;
  title: string;
  category: string;
  description: string;
  emoji: string;
  color: string;
  status: "coming-soon" | "available";
  rules: string[];
}

// Gelecek oyun modülleri ortak sonuç tipini kullanabilir. Gizli durum sunucuda kalır.
export interface GameResult {
  sessionId: string;
  winnerId: string | null;
  outcome: "win" | "draw";
  scores: Record<string, number>;
}
