/**
 * VAD Recorder tests — Real-time Voice Activity Detection
 *
 * Tests the VAD accumulator logic and recording flow:
 * - VAD accumulator correctly classifies voiced/unvoiced frames
 * - Recording stops early when voiced duration target is reached
 * - MAX_RECORDING_MS timeout when not enough voiced audio
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createVadAccumulator,
  VAD_ENERGY_THRESHOLD,
  MIN_VOICED_DURATION_MS,
  MAX_RECORDING_MS,
} from '../src/lib/vadRecorder';

// ─── VAD Accumulator (pure logic, no browser APIs) ─────────────────

describe('VAD Accumulator', () => {
  it('classifies frames above threshold as voiced', () => {
    const vad = createVadAccumulator(0.015);
    const r1 = vad.processFrame(1.0, 10);
    expect(r1.maxEnergy).toBe(1.0);
    expect(r1.voiced).toBe(true);
    expect(r1.voicedDurationMs).toBe(10);
  });

  it('classifies silent frames as unvoiced', () => {
    const vad = createVadAccumulator(0.015);
    vad.processFrame(1.0, 10);
    const r = vad.processFrame(0.0001, 10);
    expect(r.voiced).toBe(false);
    expect(r.voicedDurationMs).toBe(10);
  });

  it('accumulates voiced duration across multiple voiced frames', () => {
    const vad = createVadAccumulator(0.015);
    const frameMs = 2.67;
    for (let i = 0; i < 100; i++) {
      vad.processFrame(0.5, frameMs);
    }
    expect(vad.getVoicedDurationMs()).toBeCloseTo(267, 0);
  });

  it('does not accumulate duration for unvoiced frames', () => {
    const vad = createVadAccumulator(0.015);
    vad.processFrame(1.0, 10);
    vad.processFrame(0.00001, 10);
    vad.processFrame(0.00001, 10);
    expect(vad.getVoicedDurationMs()).toBe(10);
  });

  it('updates max energy as louder frames arrive', () => {
    const vad = createVadAccumulator(0.015);
    vad.processFrame(0.5, 10);
    expect(vad.getMaxEnergy()).toBe(0.5);
    vad.processFrame(2.0, 10);
    expect(vad.getMaxEnergy()).toBe(2.0);
    const r = vad.processFrame(0.5, 10);
    expect(r.voiced).toBe(true);
  });

  it('reaches MIN_VOICED_DURATION_MS after enough voiced frames', () => {
    const vad = createVadAccumulator(0.015);
    const frameMs = 10;
    const framesNeeded = Math.ceil(MIN_VOICED_DURATION_MS / frameMs);
    for (let i = 0; i < framesNeeded; i++) {
      vad.processFrame(0.8, frameMs);
    }
    expect(vad.getVoicedDurationMs()).toBeGreaterThanOrEqual(MIN_VOICED_DURATION_MS);
  });

  it('does not reach MIN_VOICED_DURATION_MS with only silence', () => {
    const vad = createVadAccumulator(0.015);
    for (let i = 0; i < 1200; i++) {
      vad.processFrame(0.000001, 10);
    }
    expect(vad.getVoicedDurationMs()).toBe(0);
  });

  it('handles mixed voiced/silent frames correctly', () => {
    const vad = createVadAccumulator(0.015);
    for (let i = 0; i < 50; i++) vad.processFrame(0.7, 10);
    for (let i = 0; i < 100; i++) vad.processFrame(0.00001, 10);
    for (let i = 0; i < 250; i++) vad.processFrame(0.7, 10);
    expect(vad.getVoicedDurationMs()).toBe(3000);
  });
});

// ─── Constants ─────────────────────────────────────────────────────

describe('VAD constants', () => {
  it('VAD_ENERGY_THRESHOLD is 0.015', () => {
    expect(VAD_ENERGY_THRESHOLD).toBe(0.015);
  });

  it('MIN_VOICED_DURATION_MS is 3000 (aligned with backend)', () => {
    expect(MIN_VOICED_DURATION_MS).toBe(3000);
  });

  it('MAX_RECORDING_MS is 12000 (safety cap)', () => {
    expect(MAX_RECORDING_MS).toBe(12000);
  });
});

// ─── Simulated recording flow (mocks browser APIs) ─────────────────

describe('VAD recording flow simulation', () => {
  let originalMediaDevices: PropertyDescriptor | undefined;
  let originalAudioContext: typeof window.AudioContext | undefined;

  beforeEach(() => {
    originalMediaDevices = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices');
    originalAudioContext = window.AudioContext;
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

  function createMockStream() {
    const track = {
      stop: vi.fn(),
      muted: false,
      readyState: 'live' as string,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    return {
      getTracks: vi.fn(() => [track]),
      getAudioTracks: vi.fn(() => [track]),
    };
  }

  function createMockAnalyser(fillValue: number) {
    return {
      fftSize: 1024,
      getFloatTimeDomainData: vi.fn((arr: Float32Array) => {
        arr.fill(fillValue);
      }),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }

  function createMockAudioContext(analyser: ReturnType<typeof createMockAnalyser>) {
    const mockGain = { gain: { value: 0 }, connect: vi.fn(), disconnect: vi.fn() };
    const mockSource = { connect: vi.fn(), disconnect: vi.fn() };
    return {
      sampleRate: 48000,
      state: 'running' as string,
      destination: {},
      createMediaStreamSource: vi.fn(() => mockSource),
      createAnalyser: vi.fn(() => analyser),
      createGain: vi.fn(() => mockGain),
      close: vi.fn(() => Promise.resolve()),
      resume: vi.fn(() => Promise.resolve()),
      audioWorklet: { addModule: vi.fn().mockRejectedValue(new Error('not available')) },
    };
  }

  function createMockRecorder() {
    const recorder = {
      state: 'recording' as 'recording' | 'inactive',
      start: vi.fn(),
      stop: vi.fn(function (this: { state: string; onstop: (() => void) | null }) {
        this.state = 'inactive';
        if (this.onstop) this.onstop();
      }),
      ondataavailable: null as ((e: { data: { size: number } }) => void) | null,
      onstop: null as (() => void) | null,
    };
    return recorder;
  }

  function setupMediaRecorderMock(recorder: ReturnType<typeof createMockRecorder>) {
    const MockMR = vi.fn(() => recorder) as unknown as {
      new (): typeof recorder;
      isTypeSupported: ReturnType<typeof vi.fn>;
    };
    MockMR.isTypeSupported = vi.fn(() => true);
    const originalMR = (globalThis as unknown as { MediaRecorder?: unknown }).MediaRecorder;
    (globalThis as unknown as { MediaRecorder: unknown }).MediaRecorder = MockMR;
    return originalMR;
  }

  function restoreMediaRecorder(originalMR: unknown) {
    if (originalMR) {
      (globalThis as unknown as { MediaRecorder: unknown }).MediaRecorder = originalMR;
    } else {
      delete (globalThis as unknown as { MediaRecorder?: unknown }).MediaRecorder;
    }
  }

  it('stops before MAX_RECORDING_MS when voiced duration reached early', async () => {
    const mockStream = createMockStream();
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn(() => Promise.resolve(mockStream)) },
      configurable: true,
      writable: true,
    });

    const mockAnalyser = createMockAnalyser(0.5);
    const mockCtx = createMockAudioContext(mockAnalyser);
    window.AudioContext = vi.fn(() => mockCtx) as unknown as typeof window.AudioContext;

    const mockRecorder = createMockRecorder();
    const originalMR = setupMediaRecorderMock(mockRecorder);

    vi.useFakeTimers();

    const { recordAudioWithVad } = await import('../src/lib/vadRecorder');
    const recordPromise = recordAudioWithVad({ minVoicedDurationMs: 1000, maxRecordingMs: 5000 });

    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(2000);

    const result = await recordPromise;

    expect(result.timeout).toBe(false);
    expect(result.voicedDurationMs).toBeGreaterThan(0);
    expect(result.totalDurationMs).toBeLessThan(5000);

    vi.useRealTimers();
    restoreMediaRecorder(originalMR);
  });

  it('returns voiced_duration_timeout when MAX_RECORDING_MS reached with silence', async () => {
    const mockStream = createMockStream();
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn(() => Promise.resolve(mockStream)) },
      configurable: true,
      writable: true,
    });

    const mockAnalyser = createMockAnalyser(0.0);
    const mockCtx = createMockAudioContext(mockAnalyser);
    window.AudioContext = vi.fn(() => mockCtx) as unknown as typeof window.AudioContext;

    const mockRecorder = createMockRecorder();
    const originalMR = setupMediaRecorderMock(mockRecorder);

    // Use real timers with small maxRecordingMs to avoid fake timer issues
    // with async cleanup chain (audioCtx.close(), etc.)
    const { recordAudioWithVad } = await import('../src/lib/vadRecorder');
    const result = await recordAudioWithVad({ minVoicedDurationMs: 3000, maxRecordingMs: 500 });

    expect(result.timeout).toBe(true);
    expect(result.voicedDurationMs).toBe(0);

    restoreMediaRecorder(originalMR);
  }, 10000);
});
