import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Mic,
  Headphones,
  Trophy,
  RefreshCw,
  ArrowLeft,
  Check,
  X,
  Pause,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import type { Player } from "../../features/rooms/types";
import type { ReverseSession, ReverseContext } from "./types";
import { useReverseActions } from "./useReverseActions";
import { getReverseContext } from "./api";
import { NarratorPanel, MimicPanel } from "./RecordPanels";
import { ListenPanel } from "./ListenPanel";
import { AudioPreview, RemotePreview, Wave } from "./AudioWidgets";
import "./reverse.css";
function RoundAudio({
  session,
  round,
  original,
}: {
  session: string;
  round: number;
  original?: Blob;
}) {
  const [context, setContext] = useState<ReverseContext | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void getReverseContext(session, round)
      .then((c) => {
        if (active) setContext(c);
      })
      .catch(() => {
        if (active)
          setError("Kayıtlar yüklenemedi veya saklama süresi dolmuş olabilir.");
      });
    return () => {
      active = false;
    };
  }, [session, round]);
  return (
    <div className="round-audio">
      {context?.narrator_audio && (
        <RemotePreview
          path={context.narrator_audio.path}
          label="Anlatıcının ters sesi"
        />
      )}
      {context?.mimic_audio && (
        <RemotePreview
          path={context.mimic_audio.path}
          label="Taklidin ters sesi"
        />
      )}
      {original && (
        <AudioPreview
          blob={original}
          label="Yalnız bu cihazdaki özgün kaydım"
        />
      )}
      {error && <p className="small muted">{error}</p>}
      {context && !context.narrator_audio && !context.mimic_audio && (
        <p className="small muted">
          Bu turun seslerinin saklama süresi dolmuş.
        </p>
      )}
    </div>
  );
}
export function ReverseBoard({
  session,
  userId,
  players,
  reload,
}: {
  session: ReverseSession;
  userId: string;
  players: (Player & { online: boolean })[];
  reload: () => Promise<void>;
}) {
  const actions = useReverseActions(session, reload);
  const [context, setContext] = useState<ReverseContext | null>(null),
    [guess, setGuess] = useState("");
  const [originals, setOriginals] = useState<Record<number, Blob>>({}),
    [openHistory, setOpenHistory] = useState<Record<number, boolean>>({});
  const round = session.state.current;
  const narrator = userId === round.narrator_id;
  const online = players.length === 2 && players.every((p) => p.online);
  const disabled = actions.busy || !!actions.pending || !online;
  const store = useCallback((number: number, blob: Blob) => {
    setOriginals((prev) =>
      prev[number] === blob ? prev : { ...prev, [number]: blob },
    );
  }, []);
  useEffect(() => {
    let active = true;
    void getReverseContext(session.id, round.number)
      .then((value) => {
        if (active) setContext(value);
      })
      .catch(() => {
        if (active) setContext(null);
      });
    return () => {
      active = false;
    };
  }, [session.id, session.version, round.number]);
  useEffect(() => setGuess(""), [round.number]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!disabled && guess.trim())
      await actions.run("guess", { guess: guess.trim() });
  }
  const instructions: Record<string, string> = {
    preparing: narrator
      ? "Kategorini seç, kelimeni yaz ve kaydını gönder."
      : "Anlatıcının sesini hazırlamasını bekle.",
    listening: narrator
      ? "Arkadaşın ters kaydı bir kez dinlesin."
      : "Ters sesi bir kez dinle; duyduğunu taklit edeceksin.",
    imitating: narrator
      ? "Arkadaşın duyduğunu taklit ediyor."
      : "Duyduğunu tek kayıtta taklit et ve sesini ters çevir.",
    guessing: narrator
      ? "Arkadaşının tek tahminini göndermesini bekle."
      : "Ters çevrilmiş taklidini dinle ve tek tahminini yaz.",
    judging: narrator
      ? "Tahmini doğru veya yanlış olarak değerlendir."
      : "Anlatıcının değerlendirmesini bekle.",
    revealed: "Sonucu incele; sonraki tur için ikiniz de hazır olun.",
  };
  const panelProps = { session, context, disabled, run: actions.run, store };
  return (
    <section className="reverse-board" aria-label="Tersine Konuş oyunu">
      <header className="auction-heading">
        <div>
          <span className="eyebrow">
            <Mic size={15} /> SESLERİ TERSİNE ÇEVİRELİM
          </span>
          <h2>Tersine Konuş!</h2>
          <p>Bir kelime, iki ters ses, bol kahkaha.</p>
        </div>
        <span className="count-tag">Tur {round.number}/6</span>
      </header>
      <progress
        className="auction-progress"
        max={6}
        value={session.state.rounds.length}
        aria-label="Tamamlanan ses turları"
      />
      <div className="auction-scoreboard">
        {session.state.players.map((player) => (
          <div
            className={`auction-score ${player.id === userId ? "your-score" : ""}`}
            key={player.id}
          >
            <span className="score-name">
              <i
                className={
                  players.find((p) => p.user_id === player.id)?.online
                    ? "online"
                    : "offline"
                }
              />
              <b>{player.name}</b>
              {player.id === userId && <small>sen</small>}
            </span>
            <div>
              <span>
                <strong>{player.score} puan</strong>
              </span>
              <span>
                {player.id === round.narrator_id ? "Anlatıcı" : "Tahminci"}
              </span>
            </div>
          </div>
        ))}
      </div>
      <p className="audio-privacy">
        <ShieldCheck size={17} /> Paylaşılan ters sesler özel depoda geçici
        tutulur. Maçtan 24 saat sonra erişim kapanır. Özgün kaydın cihazından
        çıkmaz.
      </p>
      {!online && (
        <p className="notice setup" role="status">
          <Pause size={17} /> Oyun duraklatıldı. İkiniz de çevrimiçi olduğunuzda
          aynı turdan devam edecek.
        </p>
      )}
      {session.phase !== "finished" && (
        <>
          <div className="reverse-role">
            <span>
              {narrator ? <Mic size={18} /> : <Headphones size={18} />} Sen{" "}
              {narrator ? "Anlatıcı" : "Tahminci"}sın
            </span>
            {round.category && <b>{round.category}</b>}
          </div>
          <p className="stage-instruction">{instructions[round.phase]}</p>
          {round.phase === "preparing" &&
            (narrator ? (
              <NarratorPanel key={`n-${round.number}`} {...panelProps} />
            ) : (
              <div className="reverse-wait">
                <Wave />
                <p>Anlatıcı kelimesini ve sesini hazırlıyor…</p>
              </div>
            ))}
          {round.phase === "listening" &&
            (narrator ? (
              <div className="reverse-surface reverse-wait">
                <Wave playing={round.listen_status === "started"} />
                <p>
                  {round.listen_status === "started"
                    ? "Ses şu anda oynatılıyor."
                    : round.listen_status === "reserved"
                      ? "Ses dinlemeye hazırlanıyor."
                      : round.listen_status === "failed"
                        ? "Arkadaşın oynatma hatası bildirdi."
                        : "Arkadaşının sesi dinlemesi bekleniyor."}
                </p>
                {round.listen_status === "failed" && (
                  <button
                    className="primary-button"
                    disabled={disabled}
                    onClick={() => {
                      void actions.run("allow_listen_retry");
                    }}
                  >
                    Yeniden dinleme izni ver
                  </button>
                )}
              </div>
            ) : (
              <div className="reverse-surface">
                <ListenPanel
                  key={`listen-${round.number}`}
                  context={context}
                  disabled={disabled}
                  run={actions.run}
                />
              </div>
            ))}
          {round.phase === "imitating" &&
            (narrator ? (
              <div className="reverse-wait">
                <Wave />
                <p>
                  {round.mimic_status === "captured"
                    ? "Taklit kaydı alındı; ses ters çevriliyor."
                    : "Arkadaşın taklidini kaydediyor…"}
                </p>
              </div>
            ) : (
              <MimicPanel key={`m-${round.number}`} {...panelProps} />
            ))}
          {round.phase === "guessing" &&
            (narrator ? (
              <div className="reverse-wait">
                <Wave />
                <p>
                  Taklit hazır. Arkadaşın ters çevrilmiş sesinden kelimeyi
                  bulmaya çalışıyor.
                </p>
              </div>
            ) : (
              <div className="reverse-surface">
                {context?.mimic_audio ? (
                  <RemotePreview
                    path={context.mimic_audio.path}
                    label="Ters çevrilmiş taklidimi dinle"
                  />
                ) : (
                  <p>Taklit kaydın yükleniyor…</p>
                )}
                <p className="small muted">
                  Kendi ters çevrilmiş taklidini istediğin kadar
                  dinleyebilirsin.
                </p>
                <form onSubmit={submit}>
                  <label htmlFor="reverse-guess">Tek tahminin</label>
                  <input
                    id="reverse-guess"
                    value={guess}
                    disabled={disabled}
                    maxLength={120}
                    autoComplete="off"
                    onChange={(e) => setGuess(e.target.value)}
                    placeholder="Hangi kelime veya isim?"
                  />
                  <button
                    className="primary-button w-full"
                    disabled={disabled || !guess.trim()}
                  >
                    Tahminimi gönder
                  </button>
                </form>
              </div>
            ))}
          {round.phase === "judging" &&
            (narrator ? (
              <div className="reverse-surface judging-panel">
                <span className="small muted">TAHMİNCİNİN CEVABI</span>
                <h3>{round.guess}</h3>
                <p>
                  Senin kelimen: <b>{context?.my_word ?? "Yükleniyor…"}</b>
                </p>
                <div>
                  <button
                    className="primary-button"
                    disabled={disabled || !context?.my_word}
                    onClick={() => {
                      void actions.run("judge", { correct: true });
                    }}
                  >
                    <Check size={18} /> Doğru · +1 puan
                  </button>
                  <button
                    className="outline-button"
                    disabled={disabled || !context?.my_word}
                    onClick={() => {
                      void actions.run("judge", { correct: false });
                    }}
                  >
                    <X size={18} /> Yanlış
                  </button>
                </div>
              </div>
            ) : (
              <div className="reverse-wait">
                <p>
                  Tahminin: <b>{round.guess}</b>
                </p>
                <p>Anlatıcı değerlendiriyor…</p>
              </div>
            ))}
          {round.phase === "revealed" && (
            <div className="reverse-surface round-result">
              <span
                className={`round-result-icon ${round.correct ? "result-correct" : ""}`}
              >
                {round.correct ? <Check size={29} /> : <X size={29} />}
              </span>
              <h3>{round.correct ? "Doğru tahmin!" : "Bu kez olmadı!"}</h3>
              <p>
                Gizli kelime: <b>{round.answer}</b>
              </p>
              <p>Tahmin: {round.guess}</p>
              <RoundAudio
                session={session.id}
                round={round.number}
                original={originals[round.number]}
              />
              <button
                className="primary-button"
                disabled={disabled || round.ready.includes(userId)}
                onClick={() => {
                  void actions.run("next");
                }}
              >
                {round.ready.includes(userId)
                  ? "Arkadaşının hazır olması bekleniyor…"
                  : "Sonraki tura hazırım"}
                <ArrowRight size={17} />
              </button>
              <p className="small muted">{round.ready.length}/2 oyuncu hazır</p>
            </div>
          )}
        </>
      )}
      {session.phase === "finished" && (
        <div className="reverse-surface reverse-final">
          <span className="puzzle-emblem">
            <Trophy size={32} />
          </span>
          <h2>
            {session.state.winner_id
              ? `${session.state.players.find((p) => p.id === session.state.winner_id)?.name} kazandı!`
              : "Berabere kaldınız!"}
          </h2>
          <p>Altı tur, üçer anlatım, bir sürü güzel ses.</p>
          <div className="result-actions">
            <button
              className="primary-button"
              disabled={
                disabled || session.state.rematch_ready.includes(userId)
              }
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
              <ArrowLeft size={17} /> Lobiye dön
            </button>
          </div>
        </div>
      )}
      {session.state.rounds.length > 0 && (
        <section className="reverse-history">
          <h3>Tur geçmişi</h3>
          {session.state.rounds.map((item) => (
            <details
              key={item.number}
              onToggle={(event) => {
                const open = event.currentTarget.open;
                setOpenHistory((prev) => ({ ...prev, [item.number]: open }));
              }}
            >
              <summary>
                <span>
                  Tur {item.number} · {item.category}
                </span>
                <b>{item.correct ? "Doğru · +1" : "Yanlış · +0"}</b>
              </summary>
              <p>
                Kelime: <b>{item.answer}</b> · Tahmin: {item.guess}
              </p>
              <p className="small muted">
                Anlatıcı:{" "}
                {
                  session.state.players.find((p) => p.id === item.narrator_id)
                    ?.name
                }
              </p>
              {openHistory[item.number] && (
                <RoundAudio
                  session={session.id}
                  round={item.number}
                  original={originals[item.number]}
                />
              )}
            </details>
          ))}
        </section>
      )}
      {actions.error && (
        <p className="notice error" role="alert">
          {actions.error}
        </p>
      )}
      {actions.pending && (
        <div className="retry-command">
          <p>
            İsteğin sonucu henüz doğrulanamadı. Aynı işlem kimliğiyle güvenle
            tekrar deneyebilirsin.
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
            onClick={actions.clear}
          >
            Güncel duruma dön
          </button>
        </div>
      )}
    </section>
  );
}
