export const LK_URL = 'wss://project-133bpm-s6d3ajm5.livekit.cloud';
export const ROOM_NAME = 'best-party-moments';

// Fixed identity for the /host page. Keeping this stable (rather than random)
// means viewers can recognize the broadcast source across host reconnects.
// Note: LiveKit will disconnect an existing participant if a new one connects
// with the same identity, so only run /host in one tab/device at a time.
export const HOST_IDENTITY = 'host';

export function randomIdentity(): string {
  return Math.random().toString(36).slice(2, 10);
}