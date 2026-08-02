import { useEffect, useRef } from 'react';
import type { TileState } from '../types';

export function ParticipantTile({ label, isLocal, speaking, videoTrack, audioTrack }: TileState) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoTrack) return;
    videoTrack.attach(el);
    return () => {
      videoTrack.detach(el);
    };
  }, [videoTrack]);

  useEffect(() => {
    // local mic audio is never played back to yourself
    if (isLocal) return;
    const el = audioRef.current;
    if (!el || !audioTrack) return;
    audioTrack.attach(el);
    return () => {
      audioTrack.detach(el);
    };
  }, [audioTrack, isLocal]);

  const classes = ['tile', isLocal && 'mirrored', speaking && 'speaking'].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {!videoTrack && <div className="placeholder">{label.slice(0, 2).toUpperCase()}</div>}
      <video ref={videoRef} autoPlay playsInline muted={isLocal} />
      {!isLocal && <audio ref={audioRef} autoPlay />}
      <div className="label">
        <span className="name">{label}</span>
      </div>
    </div>
  );
}
