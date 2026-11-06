import { useEffect, useState, type FormEvent } from "react";
import { Leaf, LockKeyhole, Delete, CornerDownLeft } from "lucide-react";
import { turkishWord, validWord } from "./input";
import type { PuzzlePlayer, LetterMark, PuzzleGameProps } from "./types";
export const alphabet = Array.from("ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ");
const labels = {
  correct: "doğru konum",
  present: "başka konum",
  absent: "yok veya fazla",
};
export function keyboardMarks(player: PuzzlePlayer) {
  const result: Record<string, LetterMark> = {};
  const rank = { absent: 1, present: 2, correct: 3 };
  for (const entry of player.history)
    Array.from(entry.guess).forEach((letter, i) => {
      const mark = entry.marks?.[i];
      if (mark && (!result[letter] || rank[mark] > rank[result[letter]]))
        result[letter] = mark;
    });
  return result;
}
export function WordGrid({
  player,
  length,
  guess = "",
}: {
  player: PuzzlePlayer;
  length: number;
  guess?: string;
}) {
  return (
    <div
      className="word-grid"
      role="grid"
      aria-label={`${player.name} tahminleri`}
    >
      {Array.from({ length: 6 }, (_, row) => {
        const entry = player.history[row];
        const letters = Array.from(
          entry?.guess ??
            (row === player.history.length && !player.done ? guess : ""),
        );
        return (
          <div
            className={`word-row ${entry?.correct ? "word-row-solved" : ""}`}
            key={row}
            role="row"
            style={{ gridTemplateColumns: `repeat(${length},minmax(0,1fr))` }}
          >
            {Array.from({ length }, (_, i) => {
              const mark = entry?.marks?.[i];
              return (
                <span
                  className={`word-cell mark-${mark ?? "empty"}`}
                  key={i}
                  role="gridcell"
                  aria-label={`${letters[i] ?? "Boş"}${mark ? ", " + labels[mark] : ""}`}
                >
                  <b>{letters[i] ?? ""}</b>
                  {mark && (
                    <small aria-hidden="true">
                      {mark === "correct"
                        ? "✓"
                        : mark === "present"
                          ? "↔"
                          : "−"}
                    </small>
                  )}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
export function WordHuntGame({
  session,
  userId,
  own,
  disabled,
  run,
}: PuzzleGameProps) {
  const me = session.state.players.find((p) => p.id === userId)!;
  const opponent = session.state.players.find((p) => p.id !== userId)!;
  const length = session.state.word_length;
  const [value, setValue] = useState("");
  useEffect(() => setValue(""), [me.revision, session.phase]);
  const normalized = turkishWord(value);
  const canGuess = session.phase === "playing" && !disabled && !me.done;
  async function send() {
    if (!validWord(value, length, length) || disabled) return;
    if (session.phase === "preparing" && !me.prepared)
      await run("prepare", normalized);
    else if (canGuess) await run("guess", normalized);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    await send();
  }
  const add = (letter: string) =>
    setValue((v) =>
      Array.from(turkishWord(v) + letter)
        .slice(0, length)
        .join(""),
    );
  useEffect(() => {
    if (!canGuess) return;
    const keydown = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.isComposing ||
        target?.matches("input,textarea,select") ||
        target?.isContentEditable
      )
        return;
      if (event.key === "Enter") {
        event.preventDefault();
        void send();
      } else if (event.key === "Backspace") {
        event.preventDefault();
        setValue((v) => Array.from(v).slice(0, -1).join(""));
      } else if (validWord(event.key, 1, 1)) {
        event.preventDefault();
        add(turkishWord(event.key));
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [canGuess, value, length, run]);
  if (session.phase === "preparing")
    return (
      <div className="puzzle-surface prepare-surface">
        <span className="puzzle-emblem">
          <Leaf size={31} />
        </span>
        <h3>{length} harflik küçük bir sır.</h3>
        <p>
          Arkadaşın için Türkçe bir kelime seç. Aynı uzunlukta oynayacaksınız;
          kelimelerin anlamlı olması size emanet.
        </p>
        {me.prepared ? (
          <div className="locked-answer" role="status">
            <LockKeyhole size={20} />
            <b>Kelimen kilitlendi.</b>
            <p>
              {opponent.prepared
                ? "Tahmin ekranı hazırlanıyor…"
                : "Arkadaşının kelimesini hazırlamasını bekliyoruz."}
            </p>
            {own && (
              <details>
                <summary>Kendi kelimemi göster</summary>
                <p>{own}</p>
              </details>
            )}
          </div>
        ) : (
          <form className="single-secret" onSubmit={submit}>
            <label htmlFor="wordhunt-secret">Gizli Türkçe kelimen</label>
            <input
              id="wordhunt-secret"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={24}
              value={value}
              disabled={disabled}
              onChange={(e) => setValue(e.target.value)}
              placeholder={length === 5 ? "Örn. KALEM" : "Örn. YORGAN"}
            />
            <p className="word-counter" aria-live="polite">
              {Array.from(normalized).length}/{length} harf
            </p>
            <p className="small muted">
              Ç, Ğ, I, İ, Ö, Ş, Ü desteklenir. Sözlük kontrolü yok; yalnız harf
              ve uzunluk doğrulanır.
            </p>
            <button
              className="primary-button w-full"
              disabled={disabled || !validWord(value, length, length)}
            >
              <LockKeyhole size={17} /> Kelimemi Kilitle
            </button>
          </form>
        )}
      </div>
    );
  const marks = keyboardMarks(me);
  return (
    <div className="puzzle-surface wordhunt-surface">
      <div className="puzzle-section-title">
        <div>
          <span className="eyebrow muted">RAKİBİNİN KELİMESİNİ KEŞFET</span>
          <h3>Her harf bir ipucu.</h3>
        </div>
        <span className="count-tag">{me.guess_count}/6 tahmin</span>
      </div>
      <WordGrid player={me} length={length} guess={normalized} />
      <p className="word-legend">
        ✓ Doğru yerde · ↔ Başka yerde · − Yok / fazla
      </p>
      {me.done ? (
        <p className={`guess-feedback ${me.solved?'feedback-correct':''}`} role="status">
          {me.solved ? "Kelimeyi buldun!" : "Altı tahminin tamamlandı."} Sonuç
          için arkadaşının bitirmesini bekliyoruz. Cevaplar oyun sonunda
          açılacak.
        </p>
      ) : (
        <>
          <form className="puzzle-guess-form" onSubmit={submit}>
            <label htmlFor="wordhunt-guess">{length} harfli tahminin</label>
            <div>
              <input
                id="wordhunt-guess"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={24}
                disabled={!canGuess}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Bir kelime yaz…"
              />
              <button
                className="primary-button"
                disabled={!canGuess || !validWord(value, length, length)}
              >
                Tahmin et
              </button>
            </div>
          </form>
          <div className="turkish-keyboard" aria-label="Türkçe ekran klavyesi">
            <div className="keyboard-letters">
              {alphabet.map((letter) => (
                <button
                  type="button"
                  className={`mark-${marks[letter] ?? "empty"}`}
                  key={letter}
                  disabled={!canGuess || normalized.length >= length}
                  aria-label={`${letter} harfi${marks[letter] ? ", " + labels[marks[letter]] : ""}`}
                  onClick={() => add(letter)}
                >
                  {letter}
                </button>
              ))}
            </div>
            <div className="keyboard-actions">
              <button
                type="button"
                disabled={!canGuess || value.length === 0}
                onClick={() =>
                  setValue((v) => Array.from(v).slice(0, -1).join(""))
                }
              >
                <Delete size={18} /> Sil
              </button>
              <button
                type="button"
                disabled={!canGuess || !validWord(value, length, length)}
                onClick={() => {
                  void send();
                }}
              >
                <CornerDownLeft size={18} /> Enter
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
