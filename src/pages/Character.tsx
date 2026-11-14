import { useCallback, useEffect, useRef, useState } from "react";
import { HeadAudio } from "../headaudio/headaudio.min.mjs";
import { useLiveKitRoom } from "../hooks/useLiveKitRoom";
import {
  CHARACTER_EVENT,
  CHARACTER_IDENTITY,
  CHARACTER_TOPIC,
} from "../lib/config";
import type { CharacterClaimMessage } from "../types";

const HEADAUDIO_WORKLET_URL = "/headaudio/headworklet.min.mjs";
const HEADAUDIO_MODEL_URL = "/headaudio/model-en-mixed.bin";

const CLOSED_POSITION = -290; // px, marginTop when mouth is shut
const OPEN_AMOUNT = 155; // px, how far the mouth opens at full openness

// HeadAudio emits 15 Oculus visemes. Map each to an openness value for our
// single-art mouth: bilabials/fricatives = closed, vowels = open, rest between.
const VISEME_OPENNESS: Record<string, number> = {
  viseme_sil: 0, // silence / rest
  viseme_PP: 0, // m, b, p — lips pressed together
  viseme_FF: 0.1, // f, v — lip to teeth
  viseme_TH: 0.2, // th — tongue between teeth
  viseme_SS: 0.25, // s — teeth near closed
  viseme_DD: 0.3, // t, d — tongue up, slight opening
  viseme_kk: 0.35, // k — back of tongue
  viseme_nn: 0.3, // n — nasal, slight opening
  viseme_RR: 0.4, // r — rounded, slight open
  viseme_CH: 0.5, // ch, j — pursed, moderately open
  viseme_U: 0.4, // oo — rounded, small opening
  viseme_O: 0.7, // oh — rounded, open
  viseme_I: 0.6, // ih — wide, medium
  viseme_E: 0.65, // eh — medium
  viseme_aa: 1, // ah — fully open
};

interface Claim {
  identity: string;
  name: string;
}

export default function Character() {
  // Claimant state, mirrored into a ref so async audio callbacks always see
  // current values without re-creating the audio graph.
  const [claim, setClaim] = useState<Claim | null>(null);
  const claimRef = useRef<Claim | null>(null);

  const {
    status: roomStatus,
    connected: roomConnected,
    sendData,
    tiles,
    participantIds,
  } = useLiveKitRoom({
    identity: CHARACTER_IDENTITY,
    displayName: "Character",
    autoConnect: true,
    onDataReceived: (payload, participant) => {
      claimDataRef.current?.(payload, participant?.identity);
    },
  });

  // Set by the arbitration effect below; the hook reads this at mount via
  // onDataReceived, so we bridge through a ref to keep the handler current.
  const claimDataRef = useRef<
    (payload: unknown, fromIdentity?: string) => void
  >(null);

  const setClaimBoth = useCallback((c: Claim | null) => {
    claimRef.current = c;
    setClaim(c);
  }, []);

  const [micState, setMicState] = useState<
    "idle" | "starting" | "on" | "error"
  >("idle");
  const [errorText, setErrorText] = useState("");
  const lipsRef = useRef<HTMLImageElement>(null);

  // Audio graph, shared by the local-mic rig and the remote-claimant feed:
  // { ctx, stream?, node, raf }. stream is null when fed from a remote track.
  const audioRef = useRef<{
    ctx: AudioContext;
    stream: MediaStream | null;
    source: MediaStreamAudioSourceNode | null;
    node: HeadAudio;
    raf: number;
  } | null>(null);

  const teardownAudio = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audioRef.current = null;
    cancelAnimationFrame(audio.raf);
    audio.source?.disconnect();
    audio.stream?.getTracks().forEach((t) => t.stop());
    void audio.ctx.close();
    if (lipsRef.current)
      lipsRef.current.style.marginTop = `${CLOSED_POSITION}px`;
  }, []);

  const stopMic = useCallback(() => {
    teardownAudio();
    setMicState("idle");
  }, [teardownAudio]);

  // Builds the worklet graph on an existing AudioContext and starts the rAF
  // loop. Returns the node; source wiring is up to the caller (mic vs remote).
  const buildGraph = useCallback(async (ctx: AudioContext) => {
    await ctx.audioWorklet.addModule(HEADAUDIO_WORKLET_URL);
    const node = new HeadAudio(ctx, {
      visemeMinMs: 80,
      visemeRampMs: 60,
      visemeMaxs: new Array(15).fill(1),
      parameterData: {
        vadGateActiveDb: -40, // above computer-fan noise floor
        vadGateInactiveDb: -45, // hysteresis: drops out only below this
        vadGateActiveMs: 30, // ignore sub-30ms blips (clicks, breaths)
      },
    });
    await node.loadModel(HEADAUDIO_MODEL_URL);

    const visemes: Record<string, number> = {};
    node.onvalue = (key, value) => {
      visemes[key] = value * (VISEME_OPENNESS[key] ?? 0);
    };
    node.onprocessorerror = (e) => {
      console.error("HeadAudio processor error", e);
      teardownAudio();
      setMicState("idle");
    };

    let level = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      node.update(dt);

      // Dominant viseme wins: visemes are alternatives, not additive, and the
      // node ramps outgoing/incoming weights simultaneously — averaging dilutes
      // every peak. Take the max scaled weight.
      let target = 0;
      for (const key in visemes) {
        if (visemes[key] > target) target = visemes[key];
      }

      if (now % 10 === 0) {
        console.log(visemes);
      }

      level += (target - level) * (target > level ? 0.4 : 0.2);

      if (lipsRef.current) {
        lipsRef.current.style.marginTop = `${CLOSED_POSITION + OPEN_AMOUNT * level}px`;
      }
      const audio = audioRef.current;
      if (audio) audio.raf = requestAnimationFrame(tick);
    };
    audioRef.current = { ctx, stream: null, source: null, node, raf: 0 };
    audioRef.current.raf = requestAnimationFrame(tick);
    return node;
  }, [teardownAudio]);

  // Local mic rig: the tuning fallback while nobody has claimed the character.
  const startMic = useCallback(async () => {
    setMicState("starting");
    setErrorText("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const node = await buildGraph(ctx);
      const source = ctx.createMediaStreamSource(stream);
      source.connect(node);
      if (audioRef.current) {
        audioRef.current.stream = stream;
        audioRef.current.source = source;
      }
      setMicState("on");
    } catch (e) {
      console.error("Failed to start mic + HeadAudio", e);
      setErrorText(e instanceof Error ? e.message : String(e));
      teardownAudio();
      setMicState("error");
    }
  }, [buildGraph, teardownAudio]);

  // When a claimant takes over, swap the audio feed: their remote mic track
  // (already subscribed by the hook) becomes the HeadAudio source. If the
  // local rig is running, tear it down first — one audio graph at a time.
  const claimantTrack = claim
    ? tiles.get(claim.identity)?.audioTrack
    : undefined;

  useEffect(() => {
    if (!claim || !claimantTrack || claimantTrack.mediaStreamTrack.readyState !== "live") return;
    let cancelled = false;

    (async () => {
      // The local-mic rig owns audioRef while micState === "on"; free it.
      teardownAudio();
      setMicState("idle");
      try {
        const ctx = new AudioContext();
        const node = await buildGraph(ctx);
        if (cancelled || audioRef.current === null) {
          teardownAudio();
          return;
        }
        const remoteStream = new MediaStream([claimantTrack.mediaStreamTrack]);
        const source = ctx.createMediaStreamSource(remoteStream);
        source.connect(node);
        audioRef.current.source = source;
      } catch (e) {
        console.error("Failed to feed claimant audio", e);
        teardownAudio();
      }
    })();

    return () => {
      cancelled = true;
    };
    // Rebuild only when the claimant's track identity changes, not on every
    // tiles update (speaking flags etc. would otherwise re-trigger this).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claimantTrack, buildGraph, teardownAudio]);

  // ---- Claim arbitration -------------------------------------------------
  // The character page is the single arbiter: first CLAIM received while
  // unclaimed wins; CLAIMED answers the winner; disconnects auto-release.

  const releaseClaim = useCallback(
    (identity: string, broadcast: boolean) => {
      const c = claimRef.current;
      if (!c || c.identity !== identity) return;
      setClaimBoth(null);
      if (broadcast) {
        void sendData(
          { type: CHARACTER_EVENT.RELEASE, identity },
          { topic: CHARACTER_TOPIC },
        );
      }
    },
    [sendData, setClaimBoth],
  );
  useEffect(() => {
    if (!roomConnected) return;

    const handle = (msg: CharacterClaimMessage, from: string) => {
      switch (msg.type) {
        case CHARACTER_EVENT.CLAIM: {
          if (claimRef.current) return; // already taken; loser sees STATE/CLAIMED elsewhere
          const winner: Claim = {
            identity: from,
            name: msg.name ?? from,
          };
          setClaimBoth(winner);
          // Publish OUTSIDE the DataReceived callback — publishing synchronously
          // while processing an incoming packet silently dropped the outgoing one.
          setTimeout(() => {
            void sendData(
              { type: CHARACTER_EVENT.CLAIMED, ...winner },
              { topic: CHARACTER_TOPIC },
            );
          }, 0);
          break;
        }
        case CHARACTER_EVENT.RELEASE: {
          releaseClaim(msg.identity, false);
          // Let everyone (incl. late joiners) know it's free again
          void sendData(
            { type: CHARACTER_EVENT.STATE, claim: null },
            { topic: CHARACTER_TOPIC },
          );
          break;
        }
        default:
          break;
      }
    };
    // The hook delivers every data message through claimDataRef (set above);
    // validate the shape here and route recognized claim messages to handle().
    claimDataRef.current = (payload, fromIdentity) => {
      if (!fromIdentity || fromIdentity === CHARACTER_IDENTITY) return; // ignore our own
      const m = payload as CharacterClaimMessage;
      if (!m || typeof m !== "object" || typeof m.type !== "string") return;
      if (!Object.values(CHARACTER_EVENT).includes(m.type as never)) return;
      handle(m, fromIdentity);
    };

    // Late joiners / reloads: announce current state when we (re)connect
    void sendData(
      { type: CHARACTER_EVENT.STATE, claim: claimRef.current },
      { topic: CHARACTER_TOPIC },
    );

    return () => {
      claimDataRef.current = null;
    };
  }, [roomConnected, sendData, releaseClaim, setClaimBoth]);

  // Auto-release when the claimant leaves the room entirely. Uses the room's
  // participant list, not tiles: silent guests publish nothing, so they never
  // get a tile — checking tiles would instantly release every fresh claim.
  const claimantInRoom = claim
    ? participantIds.has(claim.identity) || claim.identity === CHARACTER_IDENTITY
    : true;
  useEffect(() => {
    if (roomConnected && claim && !claimantInRoom) {
      releaseClaim(claim.identity, true);
    }
  }, [roomConnected, claim, claimantInRoom, releaseClaim]);
  useEffect(() => {
    return () => {
      const c = claimRef.current;
      if (c) {
        void sendData(
          { type: CHARACTER_EVENT.RELEASE, identity: c.identity },
          { topic: CHARACTER_TOPIC },
        );
      }
      teardownAudio();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount for the mic rig
  useEffect(() => {
    return () => {
      teardownAudio();
    };
  }, [teardownAudio]);

  return (
    <div id="character-container">
      <img id="lindsey-lipless" src="lindsey_lipless.png" />
      <img
        ref={lipsRef}
        id="lindsey-lips"
        src="lindsey_lips.png"
        style={{ marginTop: `${CLOSED_POSITION}px` }}
      />
      <div className="mic-controls">
        {claim ? (
          <span className="status">
            live as {claim.name} ({roomStatus})
          </span>
        ) : micState === "on" ? (
          <button onClick={stopMic}>Stop mic</button>
        ) : (
          <button
            className="primary"
            disabled={micState === "starting" || !roomConnected}
            onClick={startMic}
          >
            {micState === "starting"
              ? "Starting…"
              : !roomConnected
                ? "Waiting for room…"
                : "Start mic"}
          </button>
        )}
        {micState === "error" && (
          <span className="status">Mic failed: {errorText}</span>
        )}
      </div>
    </div>
  );
}
