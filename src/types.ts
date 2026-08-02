import type { Track } from 'livekit-client';

export interface TileState {
  identity: string;
  label: string;
  isLocal: boolean;
  speaking: boolean;
  videoTrack?: Track;
  audioTrack?: Track;
}
