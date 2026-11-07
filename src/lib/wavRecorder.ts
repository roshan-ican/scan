/**
 * Push-to-talk recorder that produces 16 kHz mono 16-bit WAV.
 *
 * Safari's MediaRecorder only records audio/mp4, which Gemini does not reliably accept,
 * so this records raw samples with the Web Audio API and encodes WAV itself.
 * getUserMedia needs a secure context: on the iPhone open the app over HTTPS.
 */

const TARGET_RATE = 16000;
const MAX_SECONDS = 30;

export interface Recording {
  base64: string;
  mimeType: 'audio/wav';
  durationMs: number;
}

export type MicErrorKind = 'insecure' | 'denied' | 'unavailable';

export class MicError extends Error {
  constructor(public kind: MicErrorKind, message: string) {
    super(message);
  }
}

export class WavRecorder {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private chunks: Float32Array[] = [];
  private sampleRate = 48000;
  private startedAt = 0;
  private cancelled = false;
  private maxTimer: ReturnType<typeof setTimeout> | null = null;

  /** Call from a user gesture (pointerdown). onLevel gets 0..1 roughly 10x a second. */
  async start(onLevel?: (level: number) => void, onMaxReached?: () => void): Promise<void> {
    this.cancelled = false;
    this.chunks = [];

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new MicError('insecure', 'The microphone needs the HTTPS address of this app.');
    }

    // Create the AudioContext inside the gesture so iOS lets it run.
    const Ctx: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new Ctx();
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (err: any) {
      this.cleanup();
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        throw new MicError('denied', 'Microphone access was blocked.');
      }
      throw new MicError('unavailable', 'No microphone is available.');
    }

    // Released while the permission prompt was open.
    if (this.cancelled) {
      this.cleanup();
      return;
    }

    this.sampleRate = this.ctx.sampleRate;
    this.source = this.ctx.createMediaStreamSource(this.stream);
    // ScriptProcessor is deprecated but is the most dependable option in iOS Safari.
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1);
    let lastLevelAt = 0;
    this.processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(input));
      if (onLevel) {
        const now = performance.now();
        if (now - lastLevelAt > 90) {
          lastLevelAt = now;
          let sum = 0;
          for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
          onLevel(Math.min(1, Math.sqrt(sum / input.length) * 6));
        }
      }
    };
    this.source.connect(this.processor);
    this.processor.connect(this.ctx.destination);
    this.startedAt = performance.now();
    this.maxTimer = setTimeout(() => onMaxReached?.(), MAX_SECONDS * 1000);
  }

  get isRecording(): boolean {
    return this.processor !== null;
  }

  /** Stop and return the WAV. Returns null if nothing was recorded. */
  async stop(): Promise<Recording | null> {
    const durationMs = this.startedAt ? performance.now() - this.startedAt : 0;
    const chunks = this.chunks;
    const rate = this.sampleRate;
    this.cancelled = true;
    this.cleanup();
    if (!chunks.length) return null;

    const pcm = downsample(concat(chunks), rate, TARGET_RATE);
    return { base64: bytesToBase64(encodeWav(pcm, TARGET_RATE)), mimeType: 'audio/wav', durationMs };
  }

  cancel(): void {
    this.cancelled = true;
    this.cleanup();
  }

  private cleanup(): void {
    if (this.maxTimer) clearTimeout(this.maxTimer);
    this.maxTimer = null;
    try {
      this.processor?.disconnect();
      this.source?.disconnect();
    } catch {
      // already disconnected
    }
    if (this.processor) this.processor.onaudioprocess = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => {});
    this.processor = null;
    this.source = null;
    this.stream = null;
    this.ctx = null;
    this.startedAt = 0;
    this.chunks = [];
  }
}

function concat(chunks: Float32Array[]): Float32Array {
  const length = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Float32Array(length);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/** Averaging downsampler (good enough for speech). */
function downsample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate <= toRate) return input;
  const ratio = fromRate / toRate;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
}

function encodeWav(samples: Float32Array, rate: number): Uint8Array {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}
