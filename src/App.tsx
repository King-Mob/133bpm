import { useCallback, useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import type { RemoteParticipant, RemoteTrack, TrackPublication } from 'livekit-client';
import { ParticipantTile } from './components/ParticipantTile';
import { LK_URL, ROOM_NAME, randomIdentity } from './lib/config';
import type { TileState } from './types';
import './App.css';

type FacingMode = 'user' | 'environment';

export default function App() {
  const [status, setStatus] = useState('not connected.');
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [camEnabled, setCamEnabled] = useState(false);
  const [tiles, setTiles] = useState<Map<string, TileState>>(new Map());

  const roomRef = useRef<Room | null>(null);
  const localIdentityRef = useRef<string | null>(null);
  const facingModeRef = useRef<FacingMode>('user');

  const upsertTile = useCallback((identity: string, updater: (tile: TileState) => TileState) => {
    setTiles((prev) => {
      const next = new Map(prev);
      const existing =
        next.get(identity) ??
        ({
          identity,
          label: identity,
          isLocal: identity === localIdentityRef.current,
          speaking: false,
        } satisfies TileState);
      next.set(identity, updater(existing));
      return next;
    });
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setStatus('requesting token...');
    try {
      const identity = randomIdentity();
      localIdentityRef.current = identity;

      const tokenRes = await fetch(
        `/api/token?room=${encodeURIComponent(ROOM_NAME)}&identity=${encodeURIComponent(identity)}`,
      );
      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({}));
        throw new Error(err.error ?? 'failed to get token');
      }
      const { token } = await tokenRes.json();

      const room = new Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub, participant: RemoteParticipant) => {
        upsertTile(participant.identity, (tile) => ({
          ...tile,
          label: participant.name || participant.identity,
          ...(track.kind === Track.Kind.Video ? { videoTrack: track } : { audioTrack: track }),
        }));
      });

      room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, _pub, participant: RemoteParticipant) => {
        upsertTile(participant.identity, (tile) => ({
          ...tile,
          ...(track.kind === Track.Kind.Video ? { videoTrack: undefined } : { audioTrack: undefined }),
        }));
      });

      room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
        setTiles((prev) => {
          const next = new Map(prev);
          next.delete(participant.identity);
          return next;
        });
      });

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        const speakingIds = new Set(speakers.map((p) => p.identity));
        setTiles((prev) => {
          const next = new Map(prev);
          next.forEach((tile, id) => next.set(id, { ...tile, speaking: speakingIds.has(id) }));
          return next;
        });
      });

      room.on(RoomEvent.LocalTrackPublished, (pub: TrackPublication) => {
        const track = pub.track;
        if (!track) return;
        upsertTile(identity, (tile) => ({
          ...tile,
          ...(track.kind === Track.Kind.Video ? { videoTrack: track } : { audioTrack: track }),
        }));
      });

      room.on(RoomEvent.LocalTrackUnpublished, (pub: TrackPublication) => {
        upsertTile(identity, (tile) => ({
          ...tile,
          ...(pub.kind === Track.Kind.Video ? { videoTrack: undefined } : { audioTrack: undefined }),
        }));
      });

      room.on(RoomEvent.Disconnected, () => {
        setStatus('disconnected.');
        setConnected(false);
        setMicEnabled(false);
        setCamEnabled(false);
        setTiles(new Map());
        roomRef.current = null;
      });

      setStatus('connecting to room...');
      await room.connect(LK_URL, token);

      setStatus(`connected in "${ROOM_NAME}"`);
      setConnected(true);

      // seed the local tile before enabling devices so the placeholder shows immediately
      upsertTile(identity, (tile) => ({ ...tile, label: 'you', isLocal: true }));

      await room.localParticipant.setCameraEnabled(true, { facingMode: facingModeRef.current });
      await room.localParticipant.setMicrophoneEnabled(true);
      setCamEnabled(true);
      setMicEnabled(true);

      // pick up anyone already in the room
      room.remoteParticipants.forEach((participant) => {
        participant.trackPublications.forEach((pub) => {
          const track = pub.track;
          if (!track) return;
          upsertTile(participant.identity, (tile) => ({
            ...tile,
            label: participant.name || participant.identity,
            ...(track.kind === Track.Kind.Video ? { videoTrack: track } : { audioTrack: track }),
          }));
        });
      });
    } catch (err) {
      setStatus(`error: ${(err as Error).message}`);
      roomRef.current = null;
    } finally {
      setConnecting(false);
    }
  }, [upsertTile]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const enabled = room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(!enabled);
    setMicEnabled(!enabled);
  }, []);

  const toggleCam = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const enabled = room.localParticipant.isCameraEnabled;
    await room.localParticipant.setCameraEnabled(!enabled, { facingMode: facingModeRef.current });
    setCamEnabled(!enabled);
  }, []);

  const flipCamera = useCallback(async () => {
    facingModeRef.current = facingModeRef.current === 'user' ? 'environment' : 'user';
    const room = roomRef.current;
    if (room?.localParticipant.isCameraEnabled) {
      await room.localParticipant.setCameraEnabled(true, { facingMode: facingModeRef.current });
    }
  }, []);

  const disconnect = useCallback(async () => {
    await roomRef.current?.disconnect();
  }, []);

  // make sure we always let go of the camera/mic if the component unmounts
  useEffect(() => {
    return () => {
      roomRef.current?.disconnect();
    };
  }, []);

  return (
    <div className="page">
      <header>
        <div className="brand">
          <span className={`dot${connected ? ' live' : ''}`} /> 133bpm
        </div>
        {!connected && (
          <button type="button" className="primary" disabled={connecting} onClick={connect}>
            {connecting ? 'connecting...' : 'connect'}
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
            {micEnabled ? 'mute mic' : 'unmute mic'}
          </button>
          <button type="button" onClick={toggleCam}>
            {camEnabled ? 'stop camera' : 'start camera'}
          </button>
          <button type="button" onClick={flipCamera}>
            flip camera
          </button>
          <button type="button" className="danger" onClick={disconnect}>
            leave
          </button>
        </footer>
      )}
    </div>
  );
}
