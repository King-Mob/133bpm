import { useEffect, useRef, useState } from "react";
import { useLiveKitRoom } from "../hooks/useLiveKitRoom";
import { HORN_EVENT_TYPE } from "../lib/config";
import "../App.css";

function isHornEvent(payload: unknown): boolean {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "type" in payload &&
    (payload as { type: unknown }).type === HORN_EVENT_TYPE
  );
}

export default function Horn() {
  const [honking, setHonking] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerHonk = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = 0;
      // Autoplay can be blocked by the browser until this page has seen a user
      // gesture (e.g. a click anywhere) — expected on first load, harmless.
      audio.play().catch(() => {});
    }

    setHonking(true);
    if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    resetTimeoutRef.current = setTimeout(() => setHonking(false), 1200);
  };

  const { status, connected } = useLiveKitRoom({
    autoConnect: true,
    onDataReceived: (payload) => {
      if (isHornEvent(payload)) triggerHonk();
    },
  });

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    };
  }, []);

  return (
    <div className="page">
      <header>
        <div className="brand">
          <span className={`dot${connected ? " live" : ""}`} /> 133bpm — horn
        </div>
      </header>

      <main className="horn-main">
        <div className="status">{status}</div>
        <img
          src="/horn.png"
          alt="party horn"
          className={`horn-image${honking ? " honking" : ""}`}
        />
      </main>

      <audio ref={audioRef} src="/horn.mp3" preload="auto" />
    </div>
  );
}
