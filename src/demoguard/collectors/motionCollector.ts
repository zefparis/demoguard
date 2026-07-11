/**
 * DemoGuard — Motion collector (streaming mode)
 *
 * Collects DeviceMotion data with iOS permission handling.
 * Returns safe summary only — no raw motion traces.
 *
 * Streaming API: startMotionCollection() / stopMotionCollection()
 * One-shot API: collectMotion(durationMs) — kept for backward compat.
 *
 * Downsampling: 500ms windows, circular buffer (max 720 windows ≈ 6 min).
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import type { DemoGuardMotionSignal, PermissionStatus } from '../types';

export function isMotionSupported(): boolean {
  return typeof window !== 'undefined' && 'DeviceMotionEvent' in window;
}

export async function requestMotionPermission(): Promise<PermissionStatus> {
  if (!isMotionSupported()) return 'unsupported';
  const DME = window.DeviceMotionEvent as unknown as {
    requestPermission?: () => Promise<string>;
  };
  if (typeof DME.requestPermission === 'function') {
    try {
      const result = await DME.requestPermission();
      return result === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }
  return 'granted';
}

// ─── Streaming state ──────────────────────────────────────────────

const WINDOW_MS = 500;
const MAX_WINDOWS = 720; // 6 minutes max coverage

interface MotionWindow {
  count: number;
  magSum: number;
  magSqSum: number;
}

let streamingState: {
  running: boolean;
  permission: PermissionStatus;
  windowStart: number;
  currentWindow: MotionWindow;
  windows: MotionWindow[];
  totalSamples: number;
  handler: ((e: DeviceMotionEvent) => void) | null;
} | null = null;

function newWindow(): MotionWindow {
  return { count: 0, magSum: 0, magSqSum: 0 };
}

function flushWindow(): void {
  if (!streamingState) return;
  if (streamingState.currentWindow.count > 0) {
    streamingState.windows.push(streamingState.currentWindow);
    if (streamingState.windows.length > MAX_WINDOWS) {
      streamingState.windows.shift();
    }
  }
  streamingState.currentWindow = newWindow();
  streamingState.windowStart = performance.now();
}

export function startMotionCollection(permission: PermissionStatus = 'granted'): void {
  if (streamingState?.running) return;
  if (!isMotionSupported()) {
    streamingState = {
      running: true,
      permission: 'unsupported',
      windowStart: 0,
      currentWindow: newWindow(),
      windows: [],
      totalSamples: 0,
      handler: null,
    };
    return;
  }

  const windowStart = performance.now();
  const state = {
    running: true,
    permission,
    windowStart,
    currentWindow: newWindow(),
    windows: [] as MotionWindow[],
    totalSamples: 0,
    handler: null as ((e: DeviceMotionEvent) => void) | null,
  };

  const handler = (e: DeviceMotionEvent) => {
    if (!streamingState?.running) return;
    const now = performance.now();

    if (e.accelerationIncludingGravity) {
      const a = e.accelerationIncludingGravity;
      const mag = Math.sqrt(
        (a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2,
      );

      if (now - streamingState.windowStart >= WINDOW_MS) {
        flushWindow();
      }

      streamingState.currentWindow.count++;
      streamingState.currentWindow.magSum += mag;
      streamingState.currentWindow.magSqSum += mag * mag;
      streamingState.totalSamples++;
    }
  };

  state.handler = handler;
  streamingState = state;
  window.addEventListener('devicemotion', handler, { passive: true });
}

export function stopMotionCollection(): DemoGuardMotionSignal {
  if (!streamingState) {
    return {
      supported: false,
      permission: 'unsupported',
      sample_count: 0,
      quality: 'unsupported',
    };
  }

  if (streamingState.handler) {
    window.removeEventListener('devicemotion', streamingState.handler);
  }

  flushWindow();

  const state = streamingState;
  streamingState = null;

  if (!isMotionSupported() || state.permission === 'unsupported') {
    return {
      supported: false,
      permission: 'unsupported',
      sample_count: 0,
      quality: 'unsupported',
    };
  }

  if (state.permission === 'denied') {
    return {
      supported: true,
      permission: 'denied',
      sample_count: 0,
      quality: 'missing',
    };
  }

  let variance: number | undefined;
  const totalSamples = state.totalSamples;
  if (totalSamples > 1) {
    let globalMagSum = 0;
    let globalMagSqSum = 0;
    let globalCount = 0;
    for (const w of state.windows) {
      globalMagSum += w.magSum;
      globalMagSqSum += w.magSqSum;
      globalCount += w.count;
    }
    if (globalCount > 1) {
      const mean = globalMagSum / globalCount;
      variance = (globalMagSqSum / globalCount) - mean * mean;
    }
  }

  const quality = totalSamples > 10 ? 'ok' : totalSamples > 0 ? 'low' : 'missing';

  return {
    supported: true,
    permission: state.permission,
    sample_count: totalSamples,
    variance,
    quality,
  };
}

export function isMotionCollecting(): boolean {
  return streamingState?.running ?? false;
}

// ─── One-shot API (backward compat) ───────────────────────────────

export function collectMotion(durationMs: number = 3000): Promise<DemoGuardMotionSignal> {
  return new Promise((resolve) => {
    if (!isMotionSupported()) {
      resolve({
        supported: false,
        permission: 'unsupported',
        sample_count: 0,
        quality: 'unsupported',
      });
      return;
    }

    let sampleCount = 0;
    const magnitudes: number[] = [];

    const handler = (e: DeviceMotionEvent) => {
      sampleCount++;
      if (e.accelerationIncludingGravity) {
        const a = e.accelerationIncludingGravity;
        const mag = Math.sqrt(
          (a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2,
        );
        magnitudes.push(mag);
      }
    };

    window.addEventListener('devicemotion', handler);

    setTimeout(() => {
      window.removeEventListener('devicemotion', handler);

      let variance: number | undefined;
      if (magnitudes.length > 1) {
        const mean = magnitudes.reduce((s, v) => s + v, 0) / magnitudes.length;
        variance = magnitudes.reduce((s, v) => s + (v - mean) ** 2, 0) / magnitudes.length;
      }

      const quality = sampleCount > 10 ? 'ok' : sampleCount > 0 ? 'low' : 'missing';

      resolve({
        supported: true,
        permission: 'granted',
        sample_count: sampleCount,
        variance,
        quality,
      });
    }, durationMs);
  });
}
