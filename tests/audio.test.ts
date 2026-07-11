/**
 * DemoGuard — Audio recording tests (ScriptProcessorNode fix)
 *
 * Tests that recordAudio produces PCM-direct output (no codec),
 * and that the output contract is preserved.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { encodeWav, recordAudio } from '../src/lib/audio';
import { VOICE_DURATION_MS } from '../src/demoguard/collectors/audioCollector';

// ─── Mocks ───────────────────────────────────────────────────────

interface MockProcessor {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  onaudioprocess: ((e: { inputBuffer: { getChannelData: (ch: number) => Float32Array } }) => void) | null;
}

interface MockSource {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

interface MockAudioContext {
  sampleRate: number;
  createMediaStreamSource: ReturnType<typeof vi.fn>;
  createScriptProcessor: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  destination: {};
}

function createMockAudioContext(sampleRate: number = 48000): MockAudioContext {
  return {
    sampleRate,
    destination: {},
    createMediaStreamSource: vi.fn((): MockSource => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createScriptProcessor: vi.fn((): MockProcessor => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      onaudioprocess: null,
    })),
    close: vi.fn(() => Promise.resolve()),
  };
}

function createMockStream(): { getTracks: ReturnType<typeof vi.fn> } {
  const track = { stop: vi.fn() };
  return { getTracks: vi.fn(() => [track]) };
}

// ─── Tests ───────────────────────────────────────────────────────

describe('recordAudio (ScriptProcessorNode)', () => {
  let mockProcessor: MockProcessor;
  let mockCtx: MockAudioContext;
  let mockStream: { getTracks: ReturnType<typeof vi.fn> };
  let originalMediaDevices: PropertyDescriptor | undefined;
  let originalAudioContext: typeof window.AudioContext | undefined;

  beforeEach(() => {
    originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
    originalAudioContext = window.AudioContext;

    mockStream = createMockStream();
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn(() => Promise.resolve(mockStream)) },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    if (originalMediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices);
    } else {
      delete (navigator as unknown as Record<string, unknown>).mediaDevices;
    }
    if (originalAudioContext) {
      window.AudioContext = originalAudioContext;
    }
    vi.restoreAllMocks();
  });

  it('returns correct AudioRecordingResult shape', async () => {
    mockCtx = createMockAudioContext(48000);
    window.AudioContext = vi.fn(() => mockCtx) as unknown as typeof window.AudioContext;

    mockProcessor = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      onaudioprocess: null,
    };
    mockCtx.createScriptProcessor = vi.fn(() => mockProcessor);

    const fakeSamples = new Float32Array(4096).fill(0.5);
    setTimeout(() => {
      if (mockProcessor.onaudioprocess) {
        for (let i = 0; i < 10; i++) {
          mockProcessor.onaudioprocess({
            inputBuffer: { getChannelData: () => fakeSamples },
          });
        }
      }
    }, 10);

    const result = await recordAudio(100);

    expect(result).toHaveProperty('samples');
    expect(result).toHaveProperty('recorderState');
    expect(result).toHaveProperty('chunksCount');
    expect(result.recorderState).toBe('inactive');
    expect(Array.isArray(result.samples)).toBe(true);
    expect(result.samples.length).toBe(1);
    expect(result.samples[0]).toBeInstanceOf(Float32Array);
    expect(typeof result.chunksCount).toBe('number');
  });

  it('produces PCM samples directly (no codec round-trip)', async () => {
    mockCtx = createMockAudioContext(16000);
    window.AudioContext = vi.fn(() => mockCtx) as unknown as typeof window.AudioContext;

    mockProcessor = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      onaudioprocess: null,
    };
    mockCtx.createScriptProcessor = vi.fn(() => mockProcessor);

    const testAmplitude = 0.7;
    const fakeSamples = new Float32Array(4096).fill(testAmplitude);
    setTimeout(() => {
      if (mockProcessor.onaudioprocess) {
        for (let i = 0; i < 5; i++) {
          mockProcessor.onaudioprocess({
            inputBuffer: { getChannelData: () => fakeSamples },
          });
        }
      }
    }, 10);

    const result = await recordAudio(50);

    const samples = result.samples[0];
    expect(samples.length).toBeGreaterThan(0);

    const peak = Math.max(...samples);
    expect(peak).toBeCloseTo(testAmplitude, 1);

    const min = Math.min(...samples);
    expect(min).toBeCloseTo(testAmplitude, 1);
  });

  it('does not use MediaRecorder', async () => {
    mockCtx = createMockAudioContext(48000);
    window.AudioContext = vi.fn(() => mockCtx) as unknown as typeof window.AudioContext;

    mockProcessor = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      onaudioprocess: null,
    };
    mockCtx.createScriptProcessor = vi.fn(() => mockProcessor);

    // Define a mock MediaRecorder so we can spy on it
    const mockMR = vi.fn();
    const originalMR = (globalThis as unknown as { MediaRecorder?: unknown }).MediaRecorder;
    (globalThis as unknown as { MediaRecorder: unknown }).MediaRecorder = mockMR;

    setTimeout(() => {
      if (mockProcessor.onaudioprocess) {
        mockProcessor.onaudioprocess({
          inputBuffer: { getChannelData: () => new Float32Array(4096).fill(0.3) },
        });
      }
    }, 10);

    await recordAudio(50);

    expect(mockMR).not.toHaveBeenCalled();

    // Restore
    if (originalMR) {
      (globalThis as unknown as { MediaRecorder: unknown }).MediaRecorder = originalMR;
    } else {
      delete (globalThis as unknown as { MediaRecorder?: unknown }).MediaRecorder;
    }
  });

  it('resamples from context sample rate to 16kHz target', async () => {
    const inputRate = 48000;
    mockCtx = createMockAudioContext(inputRate);
    window.AudioContext = vi.fn(() => mockCtx) as unknown as typeof window.AudioContext;

    mockProcessor = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      onaudioprocess: null,
    };
    mockCtx.createScriptProcessor = vi.fn(() => mockProcessor);

    setTimeout(() => {
      if (mockProcessor.onaudioprocess) {
        for (let i = 0; i < 10; i++) {
          mockProcessor.onaudioprocess({
            inputBuffer: { getChannelData: () => new Float32Array(4096).fill(0.5) },
          });
        }
      }
    }, 10);

    const result = await recordAudio(50);
    const samples = result.samples[0];

    const expectedLen = Math.floor(40960 * 16000 / inputRate);
    expect(samples.length).toBe(expectedLen);
  });

  it('cleans up resources after recording', async () => {
    mockCtx = createMockAudioContext(48000);
    const closeSpy = mockCtx.close;
    window.AudioContext = vi.fn(() => mockCtx) as unknown as typeof window.AudioContext;

    const stopSpy = mockStream.getTracks()[0].stop;

    mockProcessor = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      onaudioprocess: null,
    };
    mockCtx.createScriptProcessor = vi.fn(() => mockProcessor);

    setTimeout(() => {
      if (mockProcessor.onaudioprocess) {
        mockProcessor.onaudioprocess({
          inputBuffer: { getChannelData: () => new Float32Array(4096).fill(0.3) },
        });
      }
    }, 10);

    await recordAudio(50);

    expect(stopSpy).toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalled();
  });
});

// ─── VOICE_DURATION_MS constant test ─────────────────────────────

describe('VOICE_DURATION_MS constant', () => {
  it('is set to 7000ms (not the old 4000ms)', () => {
    expect(VOICE_DURATION_MS).toBe(7000);
  });

  it('recordAudio with 7000ms produces ~7s buffer at 16kHz', async () => {
    vi.useFakeTimers();
    const originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
    const originalAudioContext = window.AudioContext;

    const mockStream = { getTracks: vi.fn(() => [{ stop: vi.fn() }]) };
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn(() => Promise.resolve(mockStream)) },
      configurable: true,
      writable: true,
    });

    const mockProcessor: MockProcessor = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      onaudioprocess: null,
    };

    const mockCtx: MockAudioContext = {
      sampleRate: 16000,
      destination: {},
      createMediaStreamSource: vi.fn((): MockSource => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
      createScriptProcessor: vi.fn(() => mockProcessor),
      close: vi.fn(() => Promise.resolve()),
    };
    window.AudioContext = vi.fn(() => mockCtx) as unknown as typeof window.AudioContext;

    // Simulate ~7s of audio at 16kHz: 28 frames * 4096 = 114688 samples
    const framesNeeded = Math.ceil((7000 * 16000) / 1000 / 4096); // 28 frames
    // Deliver frames synchronously before advancing timers
    const recordPromise = recordAudio(7000);
    // onaudioprocess is set synchronously after getUserMedia resolves
    await Promise.resolve(); // flush microtask for getUserMedia
    if (mockProcessor.onaudioprocess) {
      for (let i = 0; i < framesNeeded; i++) {
        mockProcessor.onaudioprocess({
          inputBuffer: { getChannelData: () => new Float32Array(4096).fill(0.5) },
        });
      }
    }
    vi.advanceTimersByTime(7000);

    const result = await recordPromise;
    const samples = result.samples[0];

    // 28 frames * 4096 = 114688 samples at 16kHz = 7.168s
    expect(samples.length).toBe(framesNeeded * 4096);
    expect(samples.length).toBeGreaterThan(100000); // well above 4s (64000)

    vi.useRealTimers();
    if (originalMediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', originalMediaDevices);
    } else {
      delete (navigator as unknown as Record<string, unknown>).mediaDevices;
    }
    if (originalAudioContext) {
      window.AudioContext = originalAudioContext;
    }
  });
});

// ─── encodeWav tests (PCM output verification) ───────────────────

describe('encodeWav (PCM output)', () => {
  it('produces valid WAV header with PCM format', () => {
    const samples = new Float32Array(1600).fill(0.5);
    const wav = encodeWav(samples, 16000);

    expect(wav[0]).toBe(0x52); // R
    expect(wav[1]).toBe(0x49); // I
    expect(wav[2]).toBe(0x46); // F
    expect(wav[3]).toBe(0x46); // F

    expect(wav[8]).toBe(0x57); // W
    expect(wav[9]).toBe(0x41); // A
    expect(wav[10]).toBe(0x56); // V
    expect(wav[11]).toBe(0x45); // E

    const view = new DataView(wav.buffer);
    expect(view.getUint16(20, true)).toBe(1); // PCM = 1
    expect(view.getUint16(22, true)).toBe(1); // Mono
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(34, true)).toBe(16);
  });

  it('preserves amplitude in PCM encoding (no codec degradation)', () => {
    const testAmplitude = 0.8;
    const samples = new Float32Array(1000).fill(testAmplitude);
    const wav = encodeWav(samples, 16000);

    const view = new DataView(wav.buffer);
    const firstSample = view.getInt16(44, true);

    expect(firstSample).toBeGreaterThan(25000);
    expect(firstSample).toBeLessThan(28000);
  });

  it('output size matches expected PCM size', () => {
    const numSamples = 1600;
    const samples = new Float32Array(numSamples).fill(0.5);
    const wav = encodeWav(samples, 16000);

    expect(wav.length).toBe(44 + numSamples * 2);
  });
});
