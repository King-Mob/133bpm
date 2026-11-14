// Type declarations for the vendored HeadAudio module (dist build, unminified API).
// Source: https://github.com/met4citizen/HeadAudio (MIT)
export class HeadAudio extends AudioWorkletNode {
  constructor(ctx: AudioContext, options?: HeadAudioOptions);
  loadModel(url: string, reset?: boolean): Promise<void>;
  update(deltaMs: number): void;
  start(): void;
  stop(): void;
  calibrate(): void;
  resetAll(): void;
  resetTimer(): void;
  onvalue: ((key: string, value: number) => void) | null;
  onstarted: ((data: { event: "start"; t: number }) => void) | null;
  onended: ((data: { event: "end"; t: number }) => void) | null;
  oncalibrated: ((data: { event: "calibrated"; t: number; error?: unknown }) => void) | null;
  onprocessorerror: ((event: Event) => void) | null;
  onframe: ((data: HeadAudioFrameEvent) => void) | null;
  onvad: ((data: HeadAudioVadEvent) => void) | null;
  onfeature: ((data: HeadAudioFeatureEvent) => void) | null;
  onviseme: ((data: HeadAudioVisemeEvent) => void) | null;
  readonly visemeNames: string[];
  readonly visemeActive: number;
}

export interface HeadAudioOptions {
  visemeMinMs?: number;
  visemeRampMs?: number;
  visemeEasingSharpness?: number;
  visemeMaxs?: number[];
  processorOptions?: {
    frameEventsEnabled?: boolean;
    vadEventsEnabled?: boolean;
    featureEventsEnabled?: boolean;
    visemeEventsEnabled?: boolean;
  };
  parameterData?: {
    vadMode?: number;
    vadGateActiveDb?: number;
    vadGateActiveMs?: number;
    vadGateInactiveDb?: number;
    vadGateInactiveMs?: number;
    silMode?: number;
    silCalibrationWindowSec?: number;
    silSensitivity?: number;
    speakerMeanHz?: number;
  };
}

export interface HeadAudioFrameEvent {
  event: "frame";
  frame: Float32Array;
  t: number;
}

export interface HeadAudioVadEvent {
  event: "vad";
  active: number;
  inactive: number;
  db: number;
  t: number;
}

export interface HeadAudioFeatureEvent {
  event: "feature";
  vector: Float32Array;
  le: number;
  t: number;
  d: number;
}

export interface HeadAudioVisemeEvent {
  event: "viseme";
  viseme: number;
  t: number;
  d: number;
  vector?: Float32Array;
  distances?: number[];
}
