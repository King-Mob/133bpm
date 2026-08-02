export const LK_URL = 'wss://project-133bpm-s6d3ajm5.livekit.cloud';
export const ROOM_NAME = 'best-party-moments';

export function randomIdentity(): string {
  return Math.random().toString(36).slice(2, 10);
}
