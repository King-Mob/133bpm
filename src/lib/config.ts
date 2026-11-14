export const LK_URL = 'wss://project-133bpm-s6d3ajm5.livekit.cloud';
export const ROOM_NAME = 'best-party-moments';

// Fixed identity for the /host page. Keeping this stable (rather than random)
// means viewers can recognize the broadcast source across host reconnects.
// Note: LiveKit will disconnect an existing participant if a new one connects
// with the same identity, so only run /host in one tab/device at a time.
export const HOST_IDENTITY = 'host';

// Data-track event used to trigger the party horn on /horn.
export const HORN_EVENT_TYPE = 'HORN';
export const HORN_TOPIC = 'horn';

// Data-track events for claiming the character on /character. The Character
// page joins the room as a participant (CHARACTER_IDENTITY) and acts as the
// single arbiter: first CHARACTER_CLAIM while unclaimed wins, and it answers
// with CHARACTER_CLAIMED. This keeps simultaneous claims race-free with no
// server-side state.
export const CHARACTER_TOPIC = "character";
export const CHARACTER_EVENT = {
  CLAIM: "CHARACTER_CLAIM",
  CLAIMED: "CHARACTER_CLAIMED",
  RELEASE: "CHARACTER_RELEASE",
  STATE: "CHARACTER_STATE", // unsolicited current-state broadcast (late joiners)
} as const;
export const CHARACTER_IDENTITY = "character";

export function randomIdentity(): string {
  return Math.random().toString(36).slice(2, 10);
}