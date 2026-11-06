import { useEffect, useState, type FormEvent } from "react";
import {
  Check,
  Link2,
  LockKeyhole,
  RefreshCw,
  Trophy,
  ArrowLeft,
  Pause,
  LoaderCircle,
} from "lucide-react";
import { rpc } from "../../features/rooms/api";
import { games } from "../registry";
import type { Player } from "../../features/rooms/types";
import type { PuzzleSession } from "./types";
import { usePuzzleActions } from "./usePuzzleActions";
import { turkishWord, validWord } from "./input";
import "./puzzles.css";
import { DetectiveGame, GuessHistory } from "./DetectiveGame";
import { WordHuntGame, WordGrid } from "./WordHuntGame";

export function PuzzleBoard({
  session,
  userId,
  players,
  reload,
}: {
  session: PuzzleSession;
  userId: string;
  players: (Player & { online: boolean })[];
  reload: () => Promise<void>;
}) {
  const me = session.state.players.find((p) => p.id === userId)!;
  const opponent = session.state.players.find((p) => p.id !== userId)!;
  const [chain, setChain] = useState(["", "", "", "", ""]);
  const [guess, setGuess] = useState("");
  const [own, setOwn] = useState<string[] | string | null>(null);
  const actions = usePuzzleActions(session, userId, reload);
  const online = players.length === 2 && players.every((p) => p.online);
  const blocked = actions.busy || !!actions.pending || !online;
  const definition = games.find((g) => g.id === session.game)!;
  useEffect(() => {
    let active = true;
    if (me.prepared)
      void rpc<string[] | string | null>("my_game_secret", {
        p_session_id: session.id,
      })
        .then((value) => {
          if (active) setOwn(value);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [session.id, me.prepared]);
  useEffect(() => setGuess(""), [me.revision]);
  async function prepare(event: FormEvent) {
    event.preventDefault();
    if (blocked || me.prepared) return;
    await actions.run("prepare", chain.map(turkishWord));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (blocked || session.phase !== "playing" || me.done) return;
    await actions.run("guess", turkishWord(guess));
  }
  return (
    <section
      className={`puzzle-board puzzle-${session.game}`}
      aria-label={definition.title}
    >
      <header className="auction-heading">
        <div>
          <span className="eyebrow">
            <Link2 size={15} /> BİRLİKTE DÜŞÜNELİM
          </span>
          <h2>{definition.title}</h2>
          <p>
            {session.phase === "preparing"
              ? "Birbirinize küçük bir bulmaca hazırlayın."
              : "Bir ipucu, bir tahmin, bir adım daha."}
          </p>
        </div>
        <span className="count-tag">Süre sınırı yok</span>
      </header>
      <div className="puzzle-players">
        {session.state.players.map((p) => (
          <div
            className={`puzzle-player ${p.id === userId ? "puzzle-you" : ""}`}
            key={p.id}
          >
            <div>
              <i
                className={
                  players.find((member) => member.user_id === p.id)?.online
                    ? "online"
                    : "offline"
                }
              />
              <b>{p.name}</b>
              {p.id === userId && <small>sen</small>}
            </div>
            <span>
              {session.phase === "preparing"
                ? p.prepared
                  ? "Hazırladı ✓"
                  : "Hazırlıyor…"
                : session.game === "chain"
                  ? `${Math.max(0, p.progress - 1)}/4 kelime`
                  : `${p.guess_count} tahmin${p.solved ? " · Buldu ✓" : ""}`}
            </span>
          </div>
        ))}
      </div>
      {!online && (
        <p className="notice setup" role="status">
          <Pause size={16} /> Oyun duraklatıldı. İkiniz de çevrimiçi olduğunuzda
          devam edecek.
        </p>
      )}
      {session.game === "detective" && session.phase !== "finished" && (
        <DetectiveGame
          session={session}
          userId={userId}
          own={own}
          disabled={blocked}
          run={actions.run}
        />
      )}
      {session.game === "wordhunt" && session.phase !== "finished" && (
        <WordHuntGame
          session={session}
          userId={userId}
          own={own}
          disabled={blocked}
          run={actions.run}
        />
      )}
      {session.game === "chain" && session.phase === "preparing" && (
        <div className="puzzle-surface prepare-surface">
          <span className="puzzle-emblem">
            <Link2 size={31} />
          </span>
          <h3>Beş kelime, bir zincir.</h3>
          <p>
            Elma → Ağacı → Yaprağı → Sarması → Tatlısı gibi. Bağlantıların
            anlamlı olması size emanet; sözlük veya yapay zekâ kontrolü yok.
          </p>
          {me.prepared ? (
            <div className="locked-answer" role="status">
              <LockKeyhole size={20} />
              <b>Zincirin kilitlendi.</b>
              <p>
                {opponent.prepared
                  ? "Tahmin ekranı hazırlanıyor…"
                  : "Arkadaşının zincirini hazırlamasını bekliyoruz."}
              </p>
              {Array.isArray(own) && (
                <details>
                  <summary>Kendi zincirimi göster</summary>
                  <p>{own.join(" → ")}</p>
                </details>
              )}
            </div>
          ) : (
            <form onSubmit={prepare}>
              <div className="chain-inputs">
                {chain.map((word, i) => (
                  <div key={i}>
                    <label htmlFor={`chain-word-${i}`}>{i + 1}. kelime</label>
                    <input
                      id={`chain-word-${i}`}
                      value={word}
                      maxLength={80}
                      autoComplete="off"
                      spellCheck={false}
                      disabled={blocked}
                      placeholder={
                        ["Elma", "Ağacı", "Yaprağı", "Sarması", "Tatlısı"][i]
                      }
                      onChange={(e) =>
                        setChain((values) =>
                          values.map((v, n) => (n === i ? e.target.value : v)),
                        )
                      }
                    />
                  </div>
                ))}
              </div>
              <p className="small muted">
                Her kelime 2–40 Türkçe harf. Kilitledikten sonra değiştirilemez;
                rakibin yalnız izinli ipuçlarını görür.
              </p>
              <button
                className="primary-button w-full"
                disabled={
                  blocked || !chain.every((word) => validWord(word, 2, 40))
                }
              >
                {actions.busy ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <LockKeyhole size={17} />
                )}{" "}
                Zincirimi Hazırladım
              </button>
            </form>
          )}
        </div>
      )}
      {session.game === "chain" && session.phase === "playing" && (
        <div className="puzzle-surface">
          <div className="puzzle-section-title">
            <div>
              <span className="eyebrow muted">
                {opponent.name.toLocaleUpperCase("tr-TR")} OYUNCUSUNUN ZİNCİRİ
              </span>
              <h3>Bir sonraki kelime ne?</h3>
            </div>
            <span className="count-tag">{me.progress - 1}/4 bulundu</span>
          </div>
          <p className="small muted">
            İkiniz de aynı anda tahmin edebilirsiniz. Yanlış tahmin ve süre
            sınırı yok.
          </p>
          <div className="chain-track">
            {session.state.hints?.[userId].map((hint, i) => (
              <div
                className={`chain-step ${i === me.progress ? "chain-current" : ""} ${hint.word ? "chain-open" : ""}`}
                key={i}
              >
                <span className="chain-step-number">
                  {hint.word ? <Check size={15} /> : i + 1}
                </span>
                <div
                  className="chain-letters"
                  aria-label={
                    hint.word ??
                    `${hint.first} ile başlayan ${hint.length} harfli kelime`
                  }
                >
                  {Array.from(
                    hint.word ?? hint.first + "_".repeat(hint.length - 1),
                  ).map((letter, n) => (
                    <span key={n}>{letter}</span>
                  ))}
                </div>
                <small>{hint.length} harf</small>
              </div>
            ))}
          </div>
          <form className="puzzle-guess-form" onSubmit={submit}>
            <label htmlFor="chain-guess">
              {me.progress + 1}. kelime için tahminin
            </label>
            <div>
              <input
                id="chain-guess"
                value={guess}
                maxLength={80}
                autoComplete="off"
                disabled={blocked}
                onChange={(e) => setGuess(e.target.value)}
                placeholder="Aklındaki kelime…"
              />
              <button
                className="primary-button"
                disabled={blocked || !validWord(guess, 2, 40)}
              >
                Tahmin et
              </button>
            </div>
          </form>
          {me.history.length > 0 && (
            <p
              className={`guess-feedback ${me.history.at(-1)?.correct ? "feedback-correct" : ""}`}
              role="status"
            >
              {me.history.at(-1)?.correct
                ? "Doğru! Sıradaki bağlantıyı bulalım."
                : "Bu kelime değil. Yeni bir tahmin deneyebilirsin."}
              <small>Toplam {me.guess_count} tahmin</small>
            </p>
          )}
        </div>
      )}
      {session.phase === "finished" && (
        <div className="puzzle-surface puzzle-result">
          <span className="puzzle-emblem">
            <Trophy size={32} />
          </span>
          <h2>
            {session.state.winner_id
              ? `${session.state.players.find((p) => p.id === session.state.winner_id)?.name} kazandı!`
              : "Beraberlik!"}
          </h2>
          <p>
            {session.game === "chain"
              ? "İlk tamamlanan zincir sunucuda kaydedildi. İşte ikinizin hazırladığı bağlantılar."
              : "Tur tamamlandı. Gizli cevaplarınız ve tahminleriniz aşağıda."}
          </p>
          <div className="puzzle-reveals">
            {session.state.players.map((p) => (
              <article key={p.id}>
                <h3>{p.name}</h3>
                <p>
                  {Array.isArray(session.state.reveals?.[p.id])
                    ? (session.state.reveals?.[p.id] as string[]).join(" → ")
                    : session.state.reveals?.[p.id]}
                </p>
                <small>
                  {p.guess_count} tahmin
                  {session.game === "chain"
                    ? ` · ${p.progress - 1}/4 kelime`
                    : ""}
                </small>
              </article>
            ))}
          </div>
          {session.game === "detective" && (
            <div className="puzzle-histories">
              {session.state.players.map((p) => (
                <GuessHistory key={p.id} player={p} />
              ))}
            </div>
          )}
          {session.game === "wordhunt" && (
            <div className="word-result-grids">
              {session.state.players.map((p) => (
                <section key={p.id}>
                  <h3>{p.name}</h3>
                  <WordGrid player={p} length={session.state.word_length} />
                </section>
              ))}
            </div>
          )}
          <div className="result-actions">
            <button
              className="primary-button"
              disabled={blocked || session.state.rematch_ready.includes(userId)}
              onClick={() => {
                void actions.run("rematch");
              }}
            >
              <RefreshCw size={17} />
              {session.state.rematch_ready.includes(userId)
                ? "Arkadaşının onayı bekleniyor…"
                : "Rövanş"}
            </button>
            <button
              className="outline-button"
              disabled={actions.busy || !!actions.pending}
              onClick={() => {
                void actions.run("lobby");
              }}
            >
              <ArrowLeft size={17} /> Oyun lobisine dön
            </button>
          </div>
        </div>
      )}
      {actions.error && (
        <p className="notice error" role="alert">
          {actions.error}
        </p>
      )}
      {actions.pending && (
        <div className="retry-command">
          <p>
            İsteğin sonucu henüz doğrulanamadı. Tekrar deneme aynı işlem
            kimliğini kullanır.
          </p>
          <button
            className="outline-button"
            disabled={actions.busy}
            onClick={() => {
              void actions.retry();
            }}
          >
            İsteği yeniden dene
          </button>
          <button
            className="outline-button"
            disabled={actions.busy}
            onClick={actions.clearPending}
          >
            Güncel duruma dön
          </button>
        </div>
      )}
    </section>
  );
}
