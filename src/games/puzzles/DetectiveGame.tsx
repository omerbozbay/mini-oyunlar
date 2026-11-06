import { useEffect, useState, type FormEvent } from "react";
import { Search, LockKeyhole } from "lucide-react";
import { validNumber } from "./input";
import type { PuzzlePlayer, PuzzleGameProps } from "./types";
export function GuessHistory({ player }: { player: PuzzlePlayer }) {
  return (
    <section className="puzzle-history">
      <h3>
        {player.name}
        <small>{player.guess_count} tahmin</small>
      </h3>
      {player.history.length === 0 ? (
        <p>İlk tahmin burada görünecek.</p>
      ) : (
        <ol>
          {player.history.map((entry, i) => (
            <li key={i}>
              <span>{i + 1}</span>
              <b>{entry.guess}</b>
              <small>{entry.matches} doğru rakam</small>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
export function DetectiveGame({
  session,
  userId,
  own,
  disabled,
  run,
}: PuzzleGameProps) {
  const me = session.state.players.find((p) => p.id === userId)!;
  const opponent = session.state.players.find((p) => p.id !== userId)!;
  const [value, setValue] = useState("");
  useEffect(() => setValue(""), [me.revision, session.phase]);
  const myTurn = session.state.turn_id === userId;
  const locked = disabled || me.done || !myTurn;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (disabled || !validNumber(value)) return;
    if (session.phase === "preparing" && !me.prepared)
      await run("prepare", value.trim());
    else if (!locked) await run("guess", value.trim());
  }
  if (session.phase === "preparing")
    return (
      <div className="puzzle-surface prepare-surface">
        <span className="puzzle-emblem">
          <Search size={31} />
        </span>
        <h3>Sırrın dört rakamda.</h3>
        <p>
          İlk rakam sıfır olmasın, rakamların hepsi farklı olsun. Sayın yalnız
          sana görünecek.
        </p>
        {me.prepared ? (
          <div className="locked-answer" role="status">
            <LockKeyhole size={20} />
            <b>Gizli sayın kilitlendi.</b>
            <p>Arkadaşının hazırlığını tamamlamasını bekliyoruz.</p>
            {own && (
              <details>
                <summary>Kendi sayımı göster</summary>
                <p>{own}</p>
              </details>
            )}
          </div>
        ) : (
          <form className="single-secret" onSubmit={submit}>
            <label htmlFor="detective-secret">Dört haneli gizli sayın</label>
            <input
              id="detective-secret"
              inputMode="numeric"
              autoComplete="off"
              maxLength={12}
              value={value}
              disabled={disabled}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Örn. 5821"
            />
            <p className="small muted">Tam dört farklı rakam · İlk rakam 1–9</p>
            <button
              className="primary-button w-full"
              disabled={disabled || !validNumber(value)}
            >
              <LockKeyhole size={17} /> Sayımı Kilitle
            </button>
          </form>
        )}
      </div>
    );
  return (
    <>
      <div className="puzzle-surface detective-surface">
        <span className="eyebrow muted">TUR {session.state.round}</span>
        <h3>Gizli sayının izini sür.</h3>
        <div
          className="number-tiles"
          aria-label="Rakibin gizli dört haneli sayısı"
        >
          {["?", "?", "?", "?"].map((v, i) => (
            <span key={i}>{v}</span>
          ))}
        </div>
        <p>
          Yalnız doğru rakam sayısını öğrenirsin. Konum ipucu yok; dört rakam
          eşleşse bile sıranın da aynı olması gerekir.
        </p>
        <div
          className={`turn-notice ${myTurn ? "your-turn" : ""}`}
          role="status"
        >
          {myTurn ? "Sıra sende" : `Sıra ${opponent.name} oyuncusunda`}
        </div>
        {opponent.solved && myTurn && (
          <p className="notice setup">
            Rakibin buldu. Beraberlik için bu turdaki son tahmin hakkın sende!
          </p>
        )}
        {me.solved && (
          <p className="notice setup">
            Buldun! Adil sonuç için rakibinin bu turdaki son hakkını bekliyoruz.
          </p>
        )}
        <form className="puzzle-guess-form" onSubmit={submit}>
          <label htmlFor="detective-guess">Dört haneli tahminin</label>
          <div>
            <input
              id="detective-guess"
              inputMode="numeric"
              autoComplete="off"
              maxLength={12}
              value={value}
              disabled={locked}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Örn. 9042"
            />
            <button
              className="primary-button"
              disabled={locked || !validNumber(value)}
            >
              Tahmin et
            </button>
          </div>
        </form>
        {me.history.length > 0 && (
          <p className="guess-feedback" role="status">
            Son tahminin: {me.history.at(-1)?.matches} doğru rakam.
          </p>
        )}
      </div>
      <div className="puzzle-histories">
        {session.state.players.map((p) => (
          <GuessHistory key={p.id} player={p} />
        ))}
      </div>
    </>
  );
}
