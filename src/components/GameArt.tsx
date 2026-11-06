import type { GameId } from "../games/types";
import { Mic, Headphones } from "lucide-react";

export function GameArt({ game }: { game: GameId }) {
  return (
    <div className={`game-art art-${game}`} aria-hidden="true">
      <span className="art-spark spark-one">✦</span>
      <span className="art-spark spark-two">✧</span>
      {game === "reverse" && (
        <div className="reverse-card-art">
          <Mic size={45} />
          <div className="reverse-card-waves">
            {[16, 33, 49, 36, 23].map((height, i) => (
              <i key={i} style={{ height }} />
            ))}
          </div>
          <Headphones size={42} />
          <span>↶</span>
        </div>
      )}
      {game === "auction" && (
        <>
          <div className="pizza">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <b />
            <b />
            <b />
          </div>
          <span className="price-tag">20 ₺</span>
          <span className="tiny-leaf">✿</span>
        </>
      )}
      {game === "chain" && (
        <div className="word-chain">
          <span>E</span>
          <span>L</span>
          <span>M</span>
          <span>A</span>
          <small>bir kelime, bin çağrışım</small>
        </div>
      )}
      {game === "detective" && (
        <>
          <div className="number-notes">
            <span>4</span>
            <span>2</span>
            <span>?</span>
            <span>8</span>
          </div>
          <div className="magnifier">
            <span>?</span>
          </div>
        </>
      )}
      {game === "wordhunt" && (
        <div className="letter-grid">
          {"BAHAROYUN".split("").map((letter, i) => (
            <span className={`letter-${i}`} key={i}>
              {letter}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <span className="hero-star star-one">✦</span>
      <span className="hero-star star-two">✳</span>
      <div className="orbit" />
      <div className="floating-card">
        <span>♥</span>
        <b>2</b>
        <span>♥</span>
      </div>
      <div className="buddy buddy-purple">
        <div className="eyes">
          <i />
          <i />
        </div>
        <div className="smile" />
      </div>
      <div className="buddy buddy-yellow">
        <div className="eyes">
          <i />
          <i />
        </div>
        <div className="smile" />
      </div>
      <div className="dice">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <span className="together-note">sen + ben = 🎉</span>
    </div>
  );
}
