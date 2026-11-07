import { useEffect, useState } from "react";
import {
  Check,
  Coins,
  Gavel,
  Hand,
  LoaderCircle,
  RefreshCw,
  Trophy,
  ArrowLeft,
  Pause,
  Gift,
} from "lucide-react";
import themes from "./themes.json";
import { command, sendCommand, type AuctionCommand } from "./api";
import { maxBid } from "./rules";
import type { AuctionProduct, AuctionSession, AuctionPlayer } from "./types";
import type { Player } from "../../features/rooms/types";
import { errorMessage } from "../../lib/validation";
import "./auction.css";

export function ProductImage({
  product,
  className = "",
}: {
  product: AuctionProduct;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [product.image, product.id]);
  return failed ? (
    <span
      className={`product-fallback ${className}`}
      role="img"
      aria-label={product.name}
    >
      <Gavel size={40} />
    </span>
  ) : product.image_cell !== undefined ? (
    <svg
      className={`product-photo ${className}`}
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={product.name}
    >
      <image
        href={product.image}
        x={-(product.image_cell % 4) * 100}
        y={-Math.floor(product.image_cell / 4) * 100}
        width="400"
        height="500"
        preserveAspectRatio="none"
        onError={() => setFailed(true)}
      />
    </svg>
  ) : (
    <img
      className={className}
      src={product.image}
      alt={product.name}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export function ThemePicker({
  selected,
  host,
  disabled,
  onSelect,
}: {
  selected: string;
  host: boolean;
  disabled: boolean;
  onSelect: (theme: string) => void;
}) {
  return (
    <section className="theme-picker" aria-label="Açık Artırma temaları">
      <div className="section-heading">
        <div>
          <span className="eyebrow muted">AYNI BÜTÇE, BİNLERCE HAYAL</span>
          <h2>Ne için yarışıyoruz?</h2>
        </div>
        <span className="count-tag">{themes.length} tema · 20 TL</span>
      </div>
      <div className="theme-grid">
        {themes.map((theme) => (
          <button
            className={`theme-card ${selected === theme.id ? "theme-selected" : ""}`}
            key={theme.id}
            aria-pressed={selected === theme.id}
            disabled={!host || disabled}
            onClick={() => onSelect(theme.id)}
          >
            <ProductImage product={theme.items[0]} />
            <span>
              <b>{theme.title}</b>
              <small>{theme.items.length} seçenek · Her maç 10 ürün</small>
            </span>
            {selected === theme.id && <Check size={17} />}
          </button>
        ))}
      </div>
      <p className="small muted">
        {host
          ? "Temayı değiştirirseniz ikinizin de yeniden hazır olması gerekir."
          : "Temayı oda sahibi seçiyor; seçimi ikiniz de aynı anda görürsünüz."}
      </p>
    </section>
  );
}

export function AuctionBoard({
  session,
  userId,
  players,
  reload,
}: {
  session: AuctionSession;
  userId: string;
  players: (Player & { online: boolean })[];
  reload: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<AuctionCommand | null>(null);
  const [amount, setAmount] = useState(session.state.current_bid + 1);
  useEffect(
    () => setAmount(session.state.current_bid + 1),
    [session.version, session.state.current_bid],
  );
  const theme = themes.find((theme) => theme.id === session.theme)!;
  const s = session.state;
  const me = s.players.find((p) => p.id === userId)!;
  const opponent = s.players.find((p) => p.id !== userId)!;
  const bothOnline = players.length === 2 && players.every((p) => p.online);
  const myTurn = s.turn_id === userId;
  const blocked = busy || !!pending || !bothOnline;
  const ceiling = maxBid(me);
  const freeAllocation = s.players.some((p) => p.budget === 0);
  const allocator = s.players.find((p) => p.budget > 0)?.id ?? s.turn_id;
  const canAllocate =
    allocator === userId && !blocked && session.phase === "bidding";
  const canBid =
    myTurn && !blocked && session.phase === "bidding" && !freeAllocation;
  async function execute(cmd: AuctionCommand) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await sendCommand(cmd);
      setPending(null);
      await reload();
    } catch (e) {
      setError(errorMessage(e));
      // Ağ sonucu belirsizse aynı UUID ile tekrar dene. SQL retleri hamleyi uygulamaz.
      setPending(
        e && typeof e === "object" && "code" in e && e.code === "P0001"
          ? null
          : cmd,
      );
      await reload();
    } finally {
      setBusy(false);
    }
  }
  const perform = (
    action: string,
    price: number | null = null,
    choice: string | null = null,
  ) => {
    void execute(command(session, action, price, choice));
  };
  return (
    <section className="auction-board" aria-label="Açık Artırma oyunu">
      <header className="auction-heading">
        <div>
          <span className="eyebrow">
            <Gavel size={14} /> AÇIK ARTIRMA
          </span>
          <h2>{theme.title}</h2>
          <p>{theme.subtitle}</p>
        </div>
        <span className="count-tag">{Math.min(s.index + 1, 10)} / 10 ürün</span>
      </header>
      <progress
        className="auction-progress"
        value={s.index}
        max={10}
        aria-label="Dağıtılan ürünler"
      />
      <div className="auction-scoreboard">
        {s.players.map((p) => (
          <div
            className={`auction-score ${p.id === userId ? "your-score" : ""}`}
            key={p.id}
          >
            <span className="score-name">
              <i
                className={
                  players.find((member) => member.user_id === p.id)?.online
                    ? "online"
                    : "offline"
                }
              />
              <b>{p.name}</b>
              {p.id === userId && <small>sen</small>}
            </span>
            <div>
              <span>
                <Coins size={17} />
                <strong>{p.budget} TL</strong>
              </span>
              <span>{p.items.length} ürün</span>
            </div>
          </div>
        ))}
      </div>
      {!bothOnline && (
        <p className="notice setup" role="status">
          <Pause size={17} /> Oyun duraklatıldı. İki oyuncu da çevrimiçi
          olduğunda kaldığınız yerden devam edeceksiniz.
        </p>
      )}
      {session.phase === "bidding" && (
        <>
          {s.last_skipped && (
            <p className="notice setup">
              {s.last_skipped.name}: ikiniz de pas geçtiniz, ürün alınmadı.
            </p>
          )}
          {s.last_award && (
            <div
              className="award-notice"
              role="status"
              key={s.last_award.product.id}
            >
              <Check size={18} />
              <span>
                <b>
                  {
                    s.players.find((p) => p.id === s.last_award?.player_id)
                      ?.name
                  }
                </b>
                , {s.last_award.product.name} ürününü{" "}
                {s.last_award.product.free
                  ? "ücretsiz aldı."
                  : `${s.last_award.product.price} TL’ye aldı.`}
              </span>
            </div>
          )}
          <div className="auction-stage" key={`${session.id}-${s.index}`}>
            <div className="stage-image">
              <ProductImage product={s.products[s.index]} />
              <span>ÜRÜN {s.index + 1}</span>
            </div>
            <div className="stage-details">
              <span className="eyebrow muted">SIRADAKİ GÜZELLİK</span>
              <h3>{s.products[s.index].name}</h3>
              <p>{s.products[s.index].description}</p>
              <div className="current-offer">
                <small>SON TEKLİF</small>
                <strong key={s.current_bid}>
                  {freeAllocation
                    ? "Ücretsiz seçim"
                    : s.current_bid
                      ? `${s.current_bid} TL`
                      : "1 TL’den açılıyor"}
                </strong>
                <span>
                  {s.bidder_id
                    ? s.players.find((p) => p.id === s.bidder_id)?.name
                    : "Henüz teklif yok"}
                </span>
              </div>
              <div className={`turn-notice ${myTurn ? "your-turn" : ""}`}>
                {freeAllocation
                  ? allocator === userId
                    ? "Ürünü kime vereceğini sen seç."
                    : `${s.players.find((p) => p.id === allocator)?.name} ürünü kime vereceğini seçiyor.`
                  : myTurn
                    ? "Sıra sende!"
                    : `Sıra ${s.players.find((p) => p.id === s.turn_id)?.name} oyuncusunda`}
              </div>
            </div>
          </div>
          <div className="bid-panel">
            {freeAllocation ? (
              <div className="allocation-panel">
                <h3>Bir oyuncunun bütçesi bitti</h3>
                <p>
                  Kalan ürünler sırayla gösterilecek. Parası kalan oyuncunun
                  bütçesinden de para kesilmez.
                </p>
                <div>
                  <button
                    className="primary-button"
                    disabled={!canAllocate}
                    onClick={() => perform("allocate", null, userId)}
                  >
                    Ücretsiz kendime al
                  </button>
                  <button
                    className="outline-button"
                    disabled={!canAllocate}
                    onClick={() => perform("allocate", null, opponent.id)}
                  >
                    <Gift size={17} /> Ücretsiz arkadaşıma ver
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="bid-label">
                  <label htmlFor="auction-amount">Teklifin</label>
                  <span>
                    En fazla <b>{ceiling} TL</b> · Ürün sayısı sınırı yok
                  </span>
                </div>
                <div className="bid-controls">
                  <input
                    id="auction-amount"
                    type="number"
                    inputMode="numeric"
                    min={s.current_bid + 1}
                    max={ceiling}
                    step={1}
                    value={amount}
                    disabled={!canBid}
                    onChange={(e) => setAmount(Number(e.target.value))}
                  />
                  <div className="bid-increments">
                    {[1, 2, 5].map((increment) => (
                      <button
                        key={increment}
                        disabled={
                          !canBid || s.current_bid + increment > ceiling
                        }
                        onClick={() => setAmount(s.current_bid + increment)}
                      >
                        +{increment}
                      </button>
                    ))}
                  </div>
                  <button
                    className="primary-button"
                    disabled={
                      !canBid ||
                      !Number.isInteger(amount) ||
                      amount <= s.current_bid ||
                      amount > ceiling
                    }
                    onClick={() => perform("bid", amount)}
                  >
                    {busy ? (
                      <LoaderCircle className="spin" size={17} />
                    ) : (
                      <Gavel size={17} />
                    )}{" "}
                    Teklif ver
                  </button>
                  <button
                    className="outline-button"
                    disabled={!canBid || s.current_bid === 0}
                    onClick={() => perform("pass")}
                  >
                    <Hand size={17} /> Pas
                  </button>
                </div>
                <p className="small muted">
                  İlk teklif verilmeden pas geçilemez. Her ürün sırayla
                  gösterilir ve bir oyuncuya gider; sonraki ürünler otomatik
                  dağıtılmaz.
                </p>
              </>
            )}
          </div>
        </>
      )}
      {session.phase === "arranging" && (
        <div className="auction-arranging">
          <h2>Koleksiyonlara son dokunuş</h2>
          <p>
            10 ürünün tamamını gördünüz. İstersen kendi ürünlerinden arkadaşına
            hediye ver; para iadesi yapılmaz. İkiniz de onaylayınca gizli oylama
            başlar.
          </p>
          <button
            className="primary-button"
            disabled={blocked || (s.arrange_ready ?? []).includes(userId)}
            onClick={() => perform("confirm")}
          >
            <Check size={17} />
            {(s.arrange_ready ?? []).includes(userId)
              ? "Arkadaşının onayı bekleniyor…"
              : "Koleksiyonum hazır"}
          </button>
          <p className="small muted">
            {(s.arrange_ready ?? []).length}/2 onay · Yeni hediye iki onayı da
            sıfırlar.
          </p>
        </div>
      )}
      {(session.phase === "voting" || session.phase === "finished") && (
        <div className="auction-result">
          <span className="result-icon">
            <Trophy size={31} />
          </span>
          <h2>
            {session.phase === "voting"
              ? "İki şaheser, bir karar."
              : s.winner_id
                ? `${s.players.find((p) => p.id === s.winner_id)?.name} kazandı!`
                : "Bu oyunun kazananı ikinizsiniz!"}
          </h2>
          <p>
            {session.phase === "voting"
              ? "Tüm ürünler görüldü, koleksiyonlar kilitlendi. Kararını gizlice ver; iki oy da gelince sonuç açılacak."
              : s.winner_id
                ? "İkiniz de aynı kazananı seçtiniz. Tebrikler!"
                : "Oylar eşleşmedi veya ikiniz de beraberlik seçtiniz. Sonuç: beraberlik."}
          </p>
          {session.phase === "voting" &&
            (s.votes_cast.includes(userId) ? (
              <div className="notice setup" role="status">
                Tercihin kaydedildi. Diğer oyuncunun oyunu bekliyoruz; tercihler
                ikisi de tamamlanınca açılır.
              </div>
            ) : (
              <div className="vote-options">
                <button
                  className="primary-button"
                  disabled={blocked}
                  onClick={() => perform("vote", null, userId)}
                >
                  Ben kazandım
                </button>
                <button
                  className="outline-button"
                  disabled={blocked}
                  onClick={() => perform("vote", null, opponent.id)}
                >
                  Rakibim kazandı
                </button>
                <button
                  className="outline-button"
                  disabled={blocked}
                  onClick={() => perform("vote")}
                >
                  Beraberlik
                </button>
              </div>
            ))}
          {session.phase === "finished" && (
            <div className="result-actions">
              <button
                className="primary-button"
                disabled={blocked || s.rematch_ready.includes(userId)}
                onClick={() => perform("rematch")}
              >
                <RefreshCw size={17} />
                {s.rematch_ready.includes(userId)
                  ? "Rövanş için arkadaşın bekleniyor…"
                  : "Aynı temada rövanş"}
              </button>
              <button
                className="outline-button"
                disabled={busy || !!pending}
                onClick={() => perform("lobby")}
              >
                <ArrowLeft size={17} /> Oyun lobisine dön
              </button>
              {s.rematch_ready.length > 0 && (
                <p className="small muted">
                  Rövanş için iki oyuncunun da onayı gerekiyor.
                </p>
              )}
            </div>
          )}
        </div>
      )}
      <div className="auction-collections">
        {s.players.map((p) => (
          <Collection
            key={p.id}
            player={p}
            theme={theme.title}
            finished={session.phase !== "bidding"}
            canGift={
              p.id === userId &&
              (session.phase === "bidding" || session.phase === "arranging")
            }
            disabled={blocked}
            onGift={(product) => perform("gift", null, product)}
          />
        ))}
      </div>
      {s.last_gift && (
        <p className="notice setup" role="status">
          {s.players.find((p) => p.id === s.last_gift!.from)?.name},{" "}
          {s.last_gift.product.name} ürününü{" "}
          {s.players.find((p) => p.id === s.last_gift!.to)?.name} oyuncusuna
          hediye etti.
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {pending && (
        <div className="retry-command">
          <p>
            İsteğin sonucu henüz doğrulanamadı. Aynı hamleyi güvenle yeniden
            kontrol edebilirsin.
          </p>
          <button
            className="outline-button"
            disabled={busy}
            onClick={() => {
              void execute(pending);
            }}
          >
            İsteği yeniden dene
          </button>
          <button
            className="outline-button"
            disabled={busy}
            onClick={() => {
              setPending(null);
              void reload();
            }}
          >
            Güncel duruma dön
          </button>
        </div>
      )}
    </section>
  );
}

function Collection({
  player,
  theme,
  finished,
  canGift,
  disabled,
  onGift,
}: {
  player: AuctionPlayer;
  theme: string;
  finished: boolean;
  canGift: boolean;
  disabled: boolean;
  onGift: (id: string) => void;
}) {
  return (
    <section
      className={`auction-collection ${finished ? "collection-finished" : ""}`}
    >
      <div className="collection-title">
        <h3>
          {player.name}
          <small>{finished ? theme : "Topladıkları"}</small>
        </h3>
        <span>{player.items.length} ürün</span>
      </div>
      {finished && (
        <p className="collection-spend">
          Harcanan: <b>{20 - player.budget} TL</b> · Kalan:{" "}
          <b>{player.budget} TL</b>
        </p>
      )}
      <div className="collection-grid">
        {player.items.map((product) => (
          <article className="won-product" key={product.id}>
            <ProductImage product={product} />
            <div>
              <b>{product.name}</b>
              <small>
                {product.free ? "Ücretsiz" : `${product.price} TL`}
                {product.gifted_by ? " · Hediye" : ""}
              </small>
              <p>{product.description}</p>
              {canGift && (
                <button
                  className="gift-button"
                  disabled={disabled}
                  onClick={() => onGift(product.id)}
                  aria-label={`${product.name} ürününü arkadaşına hediye et`}
                >
                  <Gift size={14} /> Arkadaşına ver
                </button>
              )}
            </div>
          </article>
        ))}
        {player.items.length === 0 && (
          <p className="collection-empty">
            İlk güzel parçan burada yerini alacak.
          </p>
        )}
      </div>
    </section>
  );
}
