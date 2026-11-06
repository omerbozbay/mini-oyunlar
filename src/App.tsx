import { useEffect, useState, type FormEvent } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  Copy,
  Crown,
  DoorOpen,
  Gamepad2,
  Gavel,
  Heart,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Plus,
  Radio,
  Sparkles,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { games } from "./games/registry";
import type { GameDefinition } from "./games/types";
import { GameArt, HeroArt } from "./components/GameArt";
import { Modal } from "./components/Modal";
import { configured, supabase } from "./lib/supabase";
import { errorMessage, roomCode } from "./lib/validation";
import {
  currentRoom,
  enterRoom,
  leaveRoom,
  selectGame,
  setReady,
  rpc,
} from "./features/rooms/api";
import { useRoom } from "./features/rooms/useRoom";
import { AuctionBoard, ThemePicker } from "./games/auction/Auction";
import { selectTheme, startAuction } from "./games/auction/api";
import { PuzzleBoard } from "./games/puzzles/PuzzleBoard";
import { ReverseBoard } from "./games/reverse/ReverseBoard";

function savedName() {
  try {
    return localStorage.getItem("ikimiz:name") ?? "";
  } catch {
    return "";
  }
}
function rememberName(name: string) {
  try {
    localStorage.setItem("ikimiz:name", name);
  } catch {
    /* Gizli modda isim saklamak zorunlu değil. */
  }
}

export default function App() {
  const [help, setHelp] = useState(false);
  return (
    <>
      <a href="#main" className="skip-link">
        İçeriğe geç
      </a>
      <header className="site-header wrap">
        <Link to="/" className="brand" aria-label="İkimiz ana sayfa">
          <span className="brand-symbol">
            <i />
            <i />
            <b />
          </span>
          <span>
            ikimiz<span className="brand-dot">.</span>
          </span>
        </Link>
        <nav aria-label="Ana menü">
          <a href="/#oyunlar" className="nav-games">
            Oyunlar
          </a>
          <button className="help-button" onClick={() => setHelp(true)}>
            <CircleHelp size={17} />
            <span>Nasıl oynanır?</span>
          </button>
        </nav>
      </header>
      <main id="main" className="wrap">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/oda/:code" element={<RoomRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer className="site-footer wrap">
        <span className="footer-brand">ikimiz.</span>
        <span>Güzel anlar, birlikte başlar.</span>
        <span>
          İki kişilik mutluluk <Heart size={14} />
        </span>
      </footer>
      {help && (
        <Modal title="Buluşmak üç küçük adım." onClose={() => setHelp(false)}>
          <ol className="steps">
            <li>
              <b>İsmini yaz, bir oda oluştur.</b>
              <p>Hesap, e-posta veya şifre gerekmez.</p>
            </li>
            <li>
              <b>Altı karakterli kodu arkadaşına gönder.</b>
              <p>
                Arkadaşın kendi telefonundan ismini ve kodu yazarak katılsın.
              </p>
            </li>
            <li>
              <b>Lobide buluşun, hazır olun.</b>
              <p>
                Oda sahibi beş oyundan birini seçsin. İkiniz de hazır olun;
                bütçenizle yarışın veya birbirinize gizli bulmacalar hazırlayın.
              </p>
            </li>
          </ol>
          <p className="muted small">
            Aynı tarayıcıda sayfayı yenilediğinde anonim kimliğin korunur.
            Tarayıcı verilerini silersen eski kimliğine dönemezsin.
          </p>
        </Modal>
      )}
    </>
  );
}

function Home() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState(savedName);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resume, setResume] = useState<string | null>(null);
  const [checking, setChecking] = useState(configured);
  const [selected, setSelected] = useState<GameDefinition | null>(null);

  useEffect(() => {
    if (!configured) return;
    let active = true;
    // Ana sayfayı sadece inceleyen ziyaretçi için anonim hesap açılmaz.
    (async () => {
      const { data } = await supabase!.auth.getSession();
      if (data.session) return currentRoom();
      return null;
    })()
      .then((value) => {
        if (active) setResume(value);
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const next = await enterRoom(name, mode === "join" ? code : undefined);
      rememberName(name.trim());
      navigate(`/oda/${next}`);
    } catch (e) {
      setError(errorMessage(e));
      // Başarısız yanıt aslında tamamlanan bir isteğe aitse mevcut oda kurtarılabilir.
      try {
        setResume(await currentRoom());
      } catch {
        /* Asıl hata mesajını koru. */
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="green-dot" /> İKİ KİŞİLİK KOCAMAN EĞLENCE
          </span>
          <h1>
            Bir sen.
            <br />
            Bir ben.
            <br />
            <span>Bir sürü oyun.</span>
            <svg viewBox="0 0 360 18" aria-hidden="true">
              <path d="M4 12Q175-5 350 10" />
            </svg>
          </h1>
          <p>
            Aynı yerde olmasanız da aynı eğlencede buluşun.
            <br className="desktop-break" /> Arkadaşını çağır, küçük bir oyun
            molası verin.
          </p>
          <div className="hero-proof">
            <span className="mini-faces">
              <i>☺</i>
              <i>☺</i>
            </span>
            <span>
              İki kişi yeter.
              <br />
              <b>Gerisi güzel anılar.</b>
            </span>
            <span className="doodle-arrow">↗</span>
          </div>
          <HeroArt />
        </div>
        <section className="entry-card" aria-labelledby="entry-title">
          <div className="entry-icon">
            <Gamepad2 size={27} />
          </div>
          <span className="small muted">OYUN MOLASI BAŞLASIN</span>
          <h2 id="entry-title">İyi ki geldin!</h2>
          <p className="entry-subtitle">Birlikte eğlenmeye bir adım kaldı.</p>
          {resume && (
            <Link className="resume-link" to={`/oda/${resume}`}>
              <Radio size={17} /> Mevcut odana dön: {resume}
              <ArrowRight size={17} />
            </Link>
          )}
          <div className="mode-tabs" aria-label="Oda işlemi">
            <button
              type="button"
              aria-pressed={mode === "create"}
              onClick={() => {
                setMode("create");
                setError("");
              }}
            >
              <Plus size={17} />
              Oda oluştur
            </button>
            <button
              type="button"
              aria-pressed={mode === "join"}
              onClick={() => {
                setMode("join");
                setError("");
              }}
            >
              <DoorOpen size={17} />
              Odaya katıl
            </button>
          </div>
          <form onSubmit={submit}>
            <label htmlFor="player-name">Sana ne diyelim?</label>
            <div className="input-wrap">
              <Users size={18} />
              <input
                id="player-name"
                autoComplete="nickname"
                placeholder="Oyuncu adın"
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                maxLength={48}
                required
                disabled={busy}
              />
            </div>
            {mode === "join" && (
              <>
                <label htmlFor="room-code">Oda kodu</label>
                <div className="input-wrap code-input">
                  <Gamepad2 size={18} />
                  <input
                    id="room-code"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    placeholder="Örn. A3F8B2"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    minLength={6}
                    required
                    disabled={busy}
                  />
                </div>
              </>
            )}
            <button
              className="primary-button w-full"
              disabled={busy || !configured || checking}
            >
              {busy ? (
                <LoaderCircle className="spin" size={19} />
              ) : (
                <>
                  {mode === "create"
                    ? "Odamızı oluşturalım"
                    : "Arkadaşıma katıl"}
                  <ArrowRight size={19} />
                </>
              )}
            </button>
            {error && (
              <p role="alert" className="notice error">
                {error}
              </p>
            )}
            {!configured && (
              <p className="notice setup">
                Oda bağlantısı için <code>.env.local</code> dosyasını doldurup
                geliştirme sunucusunu yeniden başlatın.
              </p>
            )}
          </form>
          <div className="entry-assurance">
            <LockKeyhole size={14} /> Üyelik yok. Şifre yok. Sadece siz.
          </div>
        </section>
      </section>
      <section id="oyunlar" className="games-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow muted">KÜÇÜK OYUNLAR, BÜYÜK KEYİF</span>
            <h2>
              Bugün ne oynasak?<span>✦</span>
            </h2>
          </div>
          <span className="count-tag">
            <Gamepad2 size={16} /> {games.length} oyun hazır
          </span>
        </div>
        <div className="games-grid">
          {games.map((game, i) => (
            <button
              key={game.id}
              className={`game-card ${game.color}`}
              onClick={() => setSelected(game)}
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <div className="art-container">
                <GameArt game={game.id} />
                <span className="soon-tag">
                  {game.status === "available" ? "Oynamaya hazır" : "Yakında"}
                </span>
              </div>
              <div className="game-card-content">
                <span className="game-category">{game.category}</span>
                <h3>
                  {game.title}
                  <ChevronRight size={20} />
                </h3>
                <p>{game.description}</p>
                <span className="game-meta">
                  <Users size={13} /> 2 oyuncu <span>·</span> Kuralları keşfet
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>
      <section className="bottom-note">
        <span className="note-icon">
          <Heart size={22} />
        </span>
        <div>
          <h3>Uzakta da olsan, bir oyun kadar yakın.</h3>
          <p>
            Farklı telefonlar, ortak bir oda. En sevdiğin kişiye bir kod gönder.
          </p>
        </div>
        <span className="note-spark">✳</span>
      </section>
      {selected && (
        <GameModal game={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function GameModal({
  game,
  onClose,
}: {
  game: GameDefinition;
  onClose: () => void;
}) {
  return (
    <Modal title={game.title} onClose={onClose}>
      <div className={`modal-art ${game.color}`}>
        <GameArt game={game.id} />
      </div>
      <p className="notice setup">
        {game.status === "available"
          ? "Oynamaya hazır · Bir oda oluştur, arkadaşını davet et."
          : "Geliştirme aşamasında · Henüz oynanabilir değil"}
      </p>
      <p>{game.description}</p>
      <ul className="rules-list">
        {game.rules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
      <button className="primary-button w-full" onClick={onClose}>
        Anladım <Check size={18} />
      </button>
    </Modal>
  );
}

function RoomRoute() {
  const { code = "" } = useParams();
  try {
    return <Lobby code={roomCode(code)} />;
  } catch {
    return (
      <EmptyRoom message="Oda kodu geçersiz. Altı karakterli davet kodunu kontrol et." />
    );
  }
}

function EmptyRoom({ message }: { message: string }) {
  return (
    <section className="empty-state">
      <span className="entry-icon">
        <DoorOpen size={30} />
      </span>
      <h1>Burada bir mola verelim.</h1>
      <p>{message}</p>
      <Link to="/" className="primary-button">
        Ana sayfaya dön <ArrowRight size={18} />
      </Link>
    </section>
  );
}

function Lobby({ code }: { code: string }) {
  const navigate = useNavigate();
  const { snapshot, players, userId, loading, error, connection, reload } =
    useRoom(code);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState<GameDefinition | null>(null);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(timer);
  }, [copied]);

  async function act(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setActionError("");
    try {
      await action();
      await reload();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading)
    return (
      <section className="empty-state" role="status">
        <LoaderCircle className="spin" size={32} />
        <h2>Odanı hazırlıyoruz…</h2>
        <p>Güzel bir oyun molası çok yakında.</p>
      </section>
    );
  if (error && !snapshot)
    return (
      <section className="empty-state">
        <WifiOff size={32} />
        <h2>Bağlantıyı kontrol edelim.</h2>
        <p role="alert">{error}</p>
        <button
          className="primary-button"
          onClick={() => {
            void reload();
          }}
        >
          Yeniden dene
        </button>
        <Link to="/" className="text-link">
          Ana sayfaya dön
        </Link>
      </section>
    );
  if (!snapshot)
    return (
      <EmptyRoom message="Oda kapalı veya bu kimlikle üye değilsin. Katılmak için ana sayfada ismini ve oda kodunu gir." />
    );
  const { room } = snapshot;
  const me = players.find((p) => p.user_id === userId);
  const host = room.host_id === userId;
  const bothReady =
    players.length === 2 && players.every((p) => p.online && p.ready);
  const game = games.find((g) => g.id === room.selected_game)!;

  return (
    <section className="lobby">
      <div className="lobby-top">
        <div>
          <span className="eyebrow">SİZE ÖZEL BİR OYUN MOLASI</span>
          <h1>
            Bizim oda<span>✦</span>
          </h1>
          <p>Arkadaşınla buluş, sıradaki eğlenceyi birlikte seç.</p>
        </div>
        <button
          className="outline-button"
          onClick={() => setLeaving(true)}
          disabled={busy}
        >
          <LogOut size={17} /> Odadan ayrıl
        </button>
      </div>
      <div className={`lobby-layout ${snapshot.game ? "playing-auction" : ""}`}>
        <aside className="room-panel">
          <span className="small muted">ARKADAŞINA BU KODU GÖNDER</span>
          <div className="room-code">{room.code}</div>
          <button
            className="copy-button"
            onClick={() => {
              void act(async () => {
                if (!navigator.clipboard)
                  throw new Error("Kodu seçip elle kopyalayabilirsin.");
                await navigator.clipboard.writeText(room.code);
                setCopied(true);
              });
            }}
            disabled={busy}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Kod kopyalandı!" : "Oda kodunu kopyala"}
          </button>
          <div className="divider" />
          <div className="players-heading">
            <h2>Biz kimleriz?</h2>
            <span>{players.length}/2</span>
          </div>
          {players.map((player, i) => {
            const online = player.online;
            return (
              <div className="player-row" key={player.user_id}>
                <span className={`avatar avatar-${i}`}>
                  {Array.from(player.name)[0]?.toLocaleUpperCase("tr-TR")}
                  <i className={online ? "online" : "offline"} />
                </span>
                <div className="player-info">
                  <b>
                    {player.name}
                    {player.user_id === userId && <small> (sen)</small>}
                    {player.user_id === room.host_id && (
                      <Crown size={13} aria-label="Oda sahibi" />
                    )}
                  </b>
                  <span>{online ? "Bağlı" : "Çevrimdışı"}</span>
                </div>
                <span
                  className={`ready-pill ${player.ready ? "is-ready" : ""}`}
                >
                  {player.ready ? (
                    <>
                      <Check size={12} /> Hazır
                    </>
                  ) : (
                    "Bekliyor"
                  )}
                </span>
              </div>
            );
          })}
          {players.length < 2 && (
            <div className="waiting-player">
              <span>
                <Plus size={23} />
              </span>
              <div>
                <b>Bir kişilik yer var</b>
                <p>Arkadaşın gelince burası şenlenecek.</p>
              </div>
            </div>
          )}
          <button
            className={`primary-button w-full ${me?.ready ? "ready-button" : ""}`}
            disabled={busy || !me?.online || !!snapshot.game}
            onClick={() => {
              void act(() => setReady(room.id, !me?.ready));
            }}
          >
            {busy ? (
              <LoaderCircle size={18} className="spin" />
            ) : (
              <>
                <Check size={18} />
                {snapshot.game
                  ? "Oyun oturumu açık"
                  : me?.ready
                    ? "Hazırım · Vazgeç"
                    : "Ben hazırım!"}
              </>
            )}
          </button>
          <div
            className={`connection-status ${connection === "live" ? "is-live" : ""}`}
            role="status"
          >
            {connection === "live" ? <Wifi size={14} /> : <WifiOff size={14} />}
            {connection === "live"
              ? "Canlı bağlantı açık"
              : connection === "connecting"
                ? "Canlı bağlantı kuruluyor…"
                : "Yeniden bağlanıyor · Durum kontrol ediliyor"}
          </div>
        </aside>
        {snapshot.game?.game === "reverse" ? (
          <ReverseBoard
            key={snapshot.game.id}
            session={snapshot.game}
            userId={userId}
            players={players}
            reload={reload}
          />
        ) : snapshot.game && snapshot.game.game !== "auction" ? (
          <PuzzleBoard
            key={snapshot.game.id}
            session={snapshot.game}
            userId={userId}
            players={players}
            reload={reload}
          />
        ) : snapshot.game?.game === "auction" ? (
          <AuctionBoard
            key={snapshot.game.id}
            session={snapshot.game}
            userId={userId}
            players={players}
            reload={reload}
          />
        ) : (
          <div className="lobby-games">
            <div className="section-heading">
              <div>
                <span className="eyebrow muted">SIRADAKİ EĞLENCE</span>
                <h2>Bir oyun seçelim.</h2>
              </div>
              <span className="count-tag">
                {host ? "Seçim sende" : "Oda sahibi seçiyor"}
              </span>
            </div>
            <div className="lobby-game-grid">
              {games.map((item) => (
                <article
                  className={`lobby-game ${item.color} ${item.id === room.selected_game ? "selected-game" : ""}`}
                  key={item.id}
                >
                  <GameArt game={item.id} />
                  <div>
                    <h3>{item.title}</h3>
                    <p>
                      {item.status === "available"
                        ? "Oynamaya hazır"
                        : "Yakında"}
                    </p>
                    <div className="lobby-game-buttons">
                      <button
                        className="small-button"
                        disabled={
                          !host || busy || item.id === room.selected_game
                        }
                        onClick={() => {
                          void act(() => selectGame(room.id, item.id));
                        }}
                      >
                        {item.id === room.selected_game ? (
                          <>
                            <Check size={14} /> Seçili
                          </>
                        ) : (
                          "Seç"
                        )}
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`${item.title} kuralları`}
                        onClick={() => setSelected(item)}
                      >
                        <CircleHelp size={18} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {room.selected_game === "auction" && (
              <ThemePicker
                selected={room.auction_theme ?? "pizza"}
                host={host}
                disabled={busy}
                onSelect={(theme) => {
                  void act(() => selectTheme(room.id, theme));
                }}
              />
            )}
            {room.selected_game === "wordhunt" && (
              <section
                className="word-length-picker"
                aria-label="Kelime Avı harf modu"
              >
                <div>
                  <h3>Kaç harfle oynayalım?</h3>
                  <p>
                    İki oyuncu aynı uzunlukta oynar. Değişiklik hazır
                    durumlarını sıfırlar.
                  </p>
                </div>
                <div role="group" aria-label="Harf sayısı">
                  {([5, 6] as const).map((length) => (
                    <button
                      className="outline-button"
                      aria-pressed={(room.word_length ?? 5) === length}
                      key={length}
                      disabled={!host || busy}
                      onClick={() => {
                        void act(() =>
                          rpc("select_word_length", {
                            p_room_id: room.id,
                            p_length: length,
                          }),
                        );
                      }}
                    >
                      {length} harf
                    </button>
                  ))}
                </div>
              </section>
            )}
            <div className="launch-panel">
              <div>
                <Sparkles size={22} />
                <div>
                  <h3>{game.title}</h3>
                  <p>
                    {bothReady
                      ? game.status === "available"
                        ? room.selected_game === "auction"
                          ? "İkiniz de hazırsınız! İlk ürün sizi bekliyor."
                          : "İkiniz de hazırsınız! Gizli bulmacanızı hazırlama zamanı."
                        : "Bu oyun henüz geliştirme aşamasında."
                      : "İki oyuncu da hazır olduğunda burada buluşacağız."}
                  </p>
                </div>
              </div>
              <button
                className="primary-button"
                disabled={
                  busy || !host || !bothReady || game.status !== "available"
                }
                onClick={() => {
                  void act(() => startAuction(room.id));
                }}
              >
                {game.status === "available" ? (
                  <>
                    <Gavel size={17} /> Oyunu başlat
                  </>
                ) : (
                  <>
                    <LockKeyhole size={17} /> Oyun yakında
                  </>
                )}
              </button>
              <p className="small muted">
                {host
                  ? "Oyunu yalnızca oda sahibi başlatabilecek."
                  : "Oyunu oda sahibi başlatabilecek."}{" "}
                {game.status === "available"
                  ? "Tema değiştiğinde ikiniz de yeniden hazır olmalısınız."
                  : "Diğer oyunlar geliştirme aşamasında."}
              </p>
            </div>
          </div>
        )}
      </div>
      {(error || actionError) && (
        <p className="notice error" role="alert">
          {actionError || error}
        </p>
      )}
      {copied && (
        <span className="sr-only" role="status">
          Oda kodu kopyalandı.
        </span>
      )}
      {selected && (
        <GameModal game={selected} onClose={() => setSelected(null)} />
      )}
      {leaving && (
        <Modal title="Odadan ayrılalım mı?" onClose={() => setLeaving(false)}>
          <p>
            Yeniden katılmak için oda kodunu kullanabilirsin. Son oyuncu da
            ayrılırsa oda kapanır.
          </p>
          <div className="dialog-actions">
            <button
              className="outline-button"
              onClick={() => setLeaving(false)}
            >
              Burada kal
            </button>
            <button
              className="primary-button"
              disabled={busy}
              onClick={() => {
                void act(async () => {
                  await leaveRoom(room.id);
                  navigate("/", { replace: true });
                });
              }}
            >
              Ayrıl <LogOut size={16} />
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
