import { useCallback, useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import type { RemoteParticipant, RemoteTrack, TrackPublication } from 'livekit-client';
import { LK_URL, ROOM_NAME, randomIdentity } from '../lib/config';
import type { TileState } from '../types';

type FacingMode = 'user' | 'environment';

export interface UseLiveKitRoomOptions {
    /** Fixed participant identity (e.g. a stable "host" id). Random if omitted. */
    identity?: string;
    /** Sent to the token endpoint as ?name=, shown to other participants. */
    displayName?: string;
    /** Connect as soon as the hook mounts, instead of waiting for a manual connect() call. */
    autoConnect?: boolean;
    /** Enable camera the moment the room connects. */
    autoEnableCamera?: boolean;
    /** Enable microphone the moment the room connects. */
    autoEnableMicrophone?: boolean;
}

export function useLiveKitRoom(options: UseLiveKitRoomOptions = {}) {
    const { identity: fixedIdentity, displayName, autoConnect, autoEnableCamera, autoEnableMicrophone } = options;

    const [status, setStatus] = useState('not connected.');
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [micEnabled, setMicEnabled] = useState(false);
    const [camEnabled, setCamEnabled] = useState(false);
    const [tiles, setTiles] = useState<Map<string, TileState>>(new Map());

    const roomRef = useRef<Room | null>(null);
    const localIdentityRef = useRef<string | null>(null);
    const facingModeRef = useRef<FacingMode>('user');
    const autoConnectedRef = useRef(false);

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
        if (roomRef.current) return; // already connecting/connected — avoid duplicate rooms
        setConnecting(true);
        setStatus('requesting token...');
        try {
            const identity = fixedIdentity ?? randomIdentity();
            localIdentityRef.current = identity;

            const params = new URLSearchParams({ room: ROOM_NAME, identity });
            if (displayName) params.set('name', displayName);

            const tokenRes = await fetch(`/api/token?${params.toString()}`);
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

            // seed the local tile only if we know media is about to publish — otherwise
            // leave it absent until (if ever) the participant turns something on, so
            // silent viewers don't get an empty "you" tile cluttering the grid.
            if (autoEnableCamera || autoEnableMicrophone) {
                upsertTile(identity, (tile) => ({ ...tile, label: displayName ?? 'you', isLocal: true }));
            }

            if (autoEnableCamera) {
                await room.localParticipant.setCameraEnabled(true, { facingMode: facingModeRef.current });
                setCamEnabled(true);
            }
            if (autoEnableMicrophone) {
                await room.localParticipant.setMicrophoneEnabled(true);
                setMicEnabled(true);
            }

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
    }, [fixedIdentity, displayName, autoEnableCamera, autoEnableMicrophone, upsertTile]);

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

    // auto-connect once per mounted instance; the ref guard also protects against
    // React StrictMode's dev-only double-invoke of effects
    useEffect(() => {
        if (!autoConnect || autoConnectedRef.current) return;
        autoConnectedRef.current = true;
        connect();
        // connect() is stable-ish via useCallback; we only want this to fire on mount
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoConnect]);

    // always let go of the camera/mic + socket if the component unmounts
    useEffect(() => {
        return () => {
            roomRef.current?.disconnect();
        };
    }, []);

    return {
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
    };
}