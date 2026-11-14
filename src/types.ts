import type { Track } from 'livekit-client';

export interface TileState {
  identity: string;
  label: string;
  isLocal: boolean;
  speaking: boolean;
  videoTrack?: Track;
  audioTrack?: Track;
}

// Data-channel messages for the character-claim protocol (topic: CHARACTER_TOPIC).
// The Character page is the arbiter: CLAIM → CLAIMED, RELEASE → STATE(free).
export type CharacterClaimMessage =
  | { type: "CHARACTER_CLAIM"; name?: string }
  | { type: "CHARACTER_CLAIMED"; identity: string; name: string }
  | { type: "CHARACTER_RELEASE"; identity: string }
  | { type: "CHARACTER_STATE"; claim: { identity: string; name: string } | null };
