import { ParticipantTile } from "../components/ParticipantTile";
import { useLiveKitRoom } from "../hooks/useLiveKitRoom";
import { HORN_EVENT_TYPE, HORN_TOPIC } from "../lib/config";
import "../App.css";

export default function Guest() {
  const {
    status,
    connected,
    tiles,
    micEnabled,
    camEnabled,
    toggleMic,
    toggleCam,
    flipCamera,
    connect,
    sendData,
  } = useLiveKitRoom({ autoConnect: true });

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
      </main>

      {/* Viewers watch silently by default. These let someone "call in" by
          turning on their own mic/camera once invited. Remove this footer
          entirely if viewers should never be able to publish. */}
      {connected && (
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
