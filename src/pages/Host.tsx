import { ParticipantTile } from "../components/ParticipantTile";
import { useLiveKitRoom } from "../hooks/useLiveKitRoom";
import { HOST_IDENTITY } from "../lib/config";
import "../App.css";

export default function Host() {
  const {
    status,
    connected,
    connecting,
    micEnabled,
    camEnabled,
    tiles,
    connect,
    disconnect,
    toggleMic,
    toggleCam,
    flipCamera,
  } = useLiveKitRoom({
    identity: HOST_IDENTITY,
    displayName: "Host",
    autoEnableCamera: true,
    autoEnableMicrophone: true,
  });

  return (
    <div className="page">
      <header>
        <div className="brand">
          <span className={`dot${connected ? " live" : ""}`} /> 133bpm — host
        </div>
        {!connected && (
          <button
            type="button"
            className="primary"
            disabled={connecting}
            onClick={connect}
          >
            {connecting ? "going live..." : "go live"}
          </button>
        )}
      </header>

      <main>
        <div className="status">{status}</div>
        <div className="grid">
          {Array.from(tiles.values()).map((tile) => (
            <ParticipantTile key={tile.identity} {...tile} />
          ))}
        </div>
      </main>

      {connected && (
        <footer>
          <button type="button" onClick={toggleMic}>
            {micEnabled ? "mute mic" : "unmute mic"}
          </button>
          <button type="button" onClick={toggleCam}>
            {camEnabled ? "stop camera" : "start camera"}
          </button>
          <button type="button" onClick={flipCamera}>
            flip camera
          </button>
          <button type="button" className="danger" onClick={disconnect}>
            end broadcast
          </button>
        </footer>
      )}
    </div>
  );
}
