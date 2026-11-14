import { useCallback, useRef, useState } from "react";
import { ParticipantTile } from "../components/ParticipantTile";
import { useLiveKitRoom } from "../hooks/useLiveKitRoom";
import {
  HORN_EVENT_TYPE,
  HORN_TOPIC,
  CHARACTER_EVENT,
  CHARACTER_TOPIC,
} from "../lib/config";
import type { CharacterClaimMessage } from "../types";
import "../App.css";

interface Claim {
  identity: string;
  name: string;
}

export default function Guest() {
  const [claim, setClaim] = useState<Claim | null>(null);
  const claimRef = useRef<Claim | null>(null);

  const {
    status,
    connected,
    tiles,
    micEnabled,
    camEnabled,
    myIdentity,
    toggleMic,
    toggleCam,
    flipCamera,
    connect,
    sendData,
  } = useLiveKitRoom({
    autoConnect: true,
    displayName: `guest-${Math.random().toString(36).slice(2, 6)}`,
    onDataReceived: (payload) => {
      const m = payload as CharacterClaimMessage | null;
      if (!m || typeof m !== "object" || typeof m.type !== "string") return;
      if (!Object.values(CHARACTER_EVENT).includes(m.type as never)) return;

      switch (m.type) {
        case CHARACTER_EVENT.CLAIMED:
        case CHARACTER_EVENT.STATE: {
          const next = m.type === CHARACTER_EVENT.STATE ? m.claim : m;
          if (
            next &&
            typeof next === "object" &&
            "identity" in next &&
            typeof next.identity === "string"
          ) {
            claimRef.current = { identity: next.identity, name: next.name };
            setClaim({ identity: next.identity, name: next.name });
          } else {
            claimRef.current = null;
            setClaim(null);
          }
          break;
        }
        case CHARACTER_EVENT.RELEASE: {
          claimRef.current = null;
          setClaim(null);
          break;
        }
        default:
          break;
      }
    },
  });

  const isMine = claim !== null && myIdentity !== null && claim.identity === myIdentity;
  const taken = claim !== null;

  const claimCharacter = useCallback(async () => {
    await sendData(
      { type: CHARACTER_EVENT.CLAIM, name: "guest" },
      { topic: CHARACTER_TOPIC },
    );
    // Optimistically unmute; the character page confirms via CLAIMED.
    if (!micEnabled) await toggleMic();
  }, [sendData, micEnabled, toggleMic]);

  const releaseCharacter = useCallback(async () => {
    await sendData(
      { type: CHARACTER_EVENT.RELEASE, identity: myIdentity },
      { topic: CHARACTER_TOPIC },
    );
    claimRef.current = null;
    setClaim(null);
    if (micEnabled) await toggleMic();
  }, [sendData, myIdentity, micEnabled, toggleMic]);

  const isErrored = status.startsWith("error:");

  const honk = () => {
    sendData({ type: HORN_EVENT_TYPE }, { topic: HORN_TOPIC });
  };

  return (
    <div className="page">
      <header>
        <div className="brand">
          <span className={`dot${connected ? " live" : ""}`} /> 133bpm
        </div>
      </header>

      <main>
        <div className="status">
          {status}
          {isErrored && (
            <button type="button" onClick={connect} style={{ marginLeft: 8 }}>
              retry
            </button>
          )}
        </div>
        <div className="grid">
          {Array.from(tiles.values()).map((tile) => (
            <ParticipantTile key={tile.identity} {...tile} />
          ))}
        </div>
        <button
          type="button"
          className="primary horn-button"
          disabled={!connected}
          onClick={honk}
        >
          🎉 honk the horn
        </button>

        {/* Character claim */}
        <div className="status" style={{ marginTop: 8 }}>
          {taken
            ? isMine
              ? "🎤 you are the character — talk!"
              : `character claimed by ${claim.name}`
            : "character is free"}
        </div>
        <button
          type="button"
          className="primary"
          disabled={!connected || (taken && !isMine)}
          onClick={isMine ? releaseCharacter : claimCharacter}
        >
          {isMine ? "release character" : "be the character"}
        </button>
      </main>

      {/* Viewers watch silently by default. These let someone "call in" by
          turning on their own mic/camera once invited. Remove this footer
          entirely if viewers should never be able to publish. */}
      {connected && !isMine && (
        <footer>
          <button type="button" onClick={toggleMic}>
            {micEnabled ? "mute mic" : "call in (unmute mic)"}
          </button>
          <button type="button" onClick={toggleCam}>
            {camEnabled ? "stop camera" : "show my camera"}
          </button>
          <button type="button" onClick={flipCamera}>
            flip camera
          </button>
        </footer>
      )}
    </div>
  );
}
