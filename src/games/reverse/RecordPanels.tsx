import { useEffect, useRef, useState } from "react";
import { Send, Repeat2, LoaderCircle, Check } from "lucide-react";
import { useRecorder } from "./useRecorder";
import { reverseAudio } from "./audio";
import { audioPayload, uploadAudio } from "./api";
import { RecorderWidget } from "./AudioWidgets";
import type { AudioTicket, ReverseContext, ReverseSession } from "./types";
import type { ReverseRun } from "./ListenPanel";
export const reverseCategories = [
  "Türk ünlüler",
  "Yabancı ünlüler",
  "Şarkıcılar",
  "Futbolcular",
  "Film ve dizi karakterleri",
  "Yemekler",
  "Şehirler",
  "Hayvanlar",
  "Rastgele kelimeler",
  "Özel kategori",
];
interface Props {
  session: ReverseSession;
  context: ReverseContext | null;
  disabled: boolean;
  run: ReverseRun;
  store: (round: number, blob: Blob) => void;
}
export function NarratorPanel({ session, disabled, run, store }: Props) {
  const recorder = useRecorder();
  const [category, setCategory] = useState(reverseCategories[0]),
    [custom, setCustom] = useState(""),
    [word, setWord] = useState(""),
    [processing, setProcessing] = useState(false),
    [error, setError] = useState("");
  const selected = category === "Özel kategori" ? custom.trim() : category;
  useEffect(() => {
    if (recorder.blob) store(session.state.current.number, recorder.blob);
  }, [recorder.blob, session.state.current.number, store]);
  async function send() {
    if (disabled || processing || !recorder.blob) return;
    setProcessing(true);
    setError("");
    try {
      const reversed = await reverseAudio(recorder.blob);
      const result = await run("upload_ticket");
      if (!result) return;
      const ticket = result as unknown as AudioTicket;
      await uploadAudio(ticket, reversed.blob);
      await run("send_audio", {
        ...audioPayload(ticket, reversed),
        category: selected,
        word: word.trim(),
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Ses gönderilemedi. Yeniden deneyebilirsin.",
      );
    } finally {
      setProcessing(false);
    }
  }
  return (
    <div className="reverse-surface">
      <label htmlFor="reverse-category">Bu turun kategorisi</label>
      <select
        id="reverse-category"
        value={category}
        disabled={disabled || processing}
        onChange={(e) => setCategory(e.target.value)}
      >
        {reverseCategories.map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>
      {category === "Özel kategori" && (
        <>
          <label htmlFor="reverse-custom">Kendi kategori adın</label>
          <input
            id="reverse-custom"
            value={custom}
            maxLength={60}
            disabled={disabled || processing}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="Örn. Ortak anılarımız"
          />
        </>
      )}
      <label htmlFor="reverse-word">Gizli kelime veya isim</label>
      <input
        id="reverse-word"
        value={word}
        maxLength={120}
        disabled={disabled || processing}
        onChange={(e) => setWord(e.target.value)}
        placeholder="Söyleyeceğin kelimeyi sen seç"
      />
      <p className="small muted">
        Bu yazı tahminciden gizlenir; tur sonunda açıklanır.
      </p>
      <RecorderWidget
        recorder={recorder}
        disabled={disabled || processing}
        retake
        onStart={() => {
          void recorder.start();
        }}
      />
      <button
        className="primary-button w-full"
        disabled={
          disabled ||
          processing ||
          !recorder.blob ||
          !word.trim() ||
          selected.length < 2 ||
          selected.length > 60
        }
        onClick={() => {
          void send();
        }}
      >
        {processing ? (
          <LoaderCircle size={18} className="spin" />
        ) : (
          <Send size={18} />
        )}{" "}
        {processing ? "Ses ters çevrilip gönderiliyor…" : "Gönder"}
      </button>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
export function MimicPanel({ session, context, disabled, run, store }: Props) {
  const recorder = useRecorder();
  const ticket = useRef<AudioTicket | null>(null),
    captured = useRef<Blob | null>(null);
  const [processing, setProcessing] = useState(false),
    [error, setError] = useState("");
  const status = session.state.current.mimic_status;
  useEffect(() => {
    if (recorder.blob) {
      store(session.state.current.number, recorder.blob);
      if (captured.current !== recorder.blob && status === "reserved") {
        captured.current = recorder.blob;
        void run("mimic_captured");
      }
    }
  }, [recorder.blob, status, session.state.current.number, store]);
  async function start() {
    if (disabled || processing || status === "captured") return;
    setError("");
    const recording = recorder.start();
    const result = await run("reserve_mimic");
    if (!result) {
      recorder.reset();
      return;
    }
    ticket.current = result as unknown as AudioTicket;
    await recording;
  }
  async function process() {
    if (disabled || processing || !recorder.blob || status !== "captured")
      return;
    setProcessing(true);
    setError("");
    try {
      const reversed = await reverseAudio(recorder.blob);
      const upload = ticket.current ?? context?.mimic_audio;
      if (!upload)
        throw Error(
          "Kayıt bileti alınamadı. Sayfayı yenileyip teknik kurtarmayı kullan.",
        );
      await uploadAudio(upload, reversed.blob);
      await run("send_mimic", audioPayload(upload, reversed));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ses işlenemedi.");
    } finally {
      setProcessing(false);
    }
  }
  async function recover() {
    if (await run("mimic_failed")) {
      recorder.reset();
      captured.current = null;
      ticket.current = null;
      setError("");
    }
  }
  return (
    <div className="reverse-surface">
      <p className="reverse-tip">
        Normal akışta tek taklit kaydın var. Mikrofon veya işleme hatası olursa
        teknik kurtarma ile tekrar deneyebilirsin.
      </p>
      <RecorderWidget
        recorder={recorder}
        disabled={disabled || processing || status === "captured"}
        onStart={() => {
          void start();
        }}
      />
      {recorder.blob && status === "reserved" && (
        <button
          className="outline-button"
          disabled={disabled}
          onClick={() => {
            void run("mimic_captured");
          }}
        >
          <Check size={16} /> Kayıt durumunu doğrula
        </button>
      )}
      <button
        className="primary-button w-full"
        disabled={
          disabled || processing || !recorder.blob || status !== "captured"
        }
        onClick={() => {
          void process();
        }}
      >
        {processing ? (
          <LoaderCircle className="spin" size={18} />
        ) : (
          <Repeat2 size={18} />
        )}{" "}
        {processing ? "Sesin işleniyor…" : "Sesimi Ters Çevir"}
      </button>
      {(error ||
        recorder.status === "error" ||
        (!recorder.blob && status === "captured")) && (
        <div className="notice setup">
          <p>
            {error ||
              "Kayıt cihazda bulunamadı veya kesildi. Gönderilmiş taklit değiştirilmeden teknik kurtarma yapılabilir."}
          </p>
          <button
            className="outline-button"
            disabled={disabled || processing}
            onClick={() => {
              void recover();
            }}
          >
            Teknik kurtarma: yeniden kayıt aç
          </button>
        </div>
      )}
    </div>
  );
}
