/**
 * DemoGuard — Orientation collector (streaming mode)
 *
 * Collects DeviceOrientation data with iOS permission handling.
 * Returns safe summary only.
 *
 * Streaming API: startOrientationCollection() / stopOrientationCollection()
 * One-shot API: collectOrientation(durationMs) — kept for backward compat.
 *
 * Downsampling: 500ms windows, circular buffer (max 720 windows ≈ 6 min).
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import type { DemoGuardOrientationSignal, PermissionStatus } from '../types';

export function isOrientationSupported(): boolean {
  return typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
}

export async function requestOrientationPermission(): Promise<PermissionStatus> {
  if (!isOrientationSupported()) return 'unsupported';
  const DOE = window.DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<string>;
  };
  if (typeof DOE.requestPermission === 'function') {
    try {
      const result = await DOE.requestPermission();
      return result === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }
  return 'granted';
}

// ─── Streaming state ──────────────────────────────────────────────

const WINDOW_MS = 500;
const MAX_WINDOWS = 720;

interface OrientationWindow {
  count: number;
  changes: number;
}

let streamingState: {
  running: boolean;
  permission: PermissionStatus;
  windowStart: number;
  currentWindow: OrientationWindow;
  windows: OrientationWindow[];
  totalSamples: number;
  totalChanges: number;
  lastAlpha: number | null;
  lastBeta: number | null;
  lastGamma: number | null;
  handler: ((e: DeviceOrientationEvent) => void) | null;
} | null = null;

function newWindow(): OrientationWindow {
  return { count: 0, changes: 0 };
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

export function startOrientationCollection(permission: PermissionStatus = 'granted'): void {
  if (streamingState?.running) return;
  if (!isOrientationSupported()) {
    streamingState = {
      running: true,
      permission: 'unsupported',
      windowStart: 0,
      currentWindow: newWindow(),
      windows: [],
      totalSamples: 0,
      totalChanges: 0,
      lastAlpha: null,
      lastBeta: null,
      lastGamma: null,
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
    windows: [] as OrientationWindow[],
    totalSamples: 0,
    totalChanges: 0,
    lastAlpha: null as number | null,
    lastBeta: null as number | null,
    lastGamma: null as number | null,
    handler: null as ((e: DeviceOrientationEvent) => void) | null,
  };

  const handler = (e: DeviceOrientationEvent) => {
    if (!streamingState?.running) return;
    const now = performance.now();

    if (now - streamingState.windowStart >= WINDOW_MS) {
      flushWindow();
    }

    streamingState.currentWindow.count++;
    streamingState.totalSamples++;

    if (
      streamingState.lastAlpha !== null ||
      streamingState.lastBeta !== null ||
      streamingState.lastGamma !== null
    ) {
      if (
        e.alpha !== streamingState.lastAlpha ||
        e.beta !== streamingState.lastBeta ||
        e.gamma !== streamingState.lastGamma
      ) {
        streamingState.currentWindow.changes++;
        streamingState.totalChanges++;
      }
    }
    streamingState.lastAlpha = e.alpha;
    streamingState.lastBeta = e.beta;
    streamingState.lastGamma = e.gamma;
  };

  state.handler = handler;
  streamingState = state;
  window.addEventListener('deviceorientation', handler, { passive: true });
}

export function stopOrientationCollection(): DemoGuardOrientationSignal {
  if (!streamingState) {
    return {
      supported: false,
      permission: 'unsupported',
      sample_count: 0,
      changes: 0,
      quality: 'unsupported',
    };
  }

  if (streamingState.handler) {
    window.removeEventListener('deviceorientation', streamingState.handler);
  }

  flushWindow();

  const state = streamingState;
  streamingState = null;

  if (!isOrientationSupported() || state.permission === 'unsupported') {
    return {
      supported: false,
      permission: 'unsupported',
      sample_count: 0,
      changes: 0,
      quality: 'unsupported',
    };
  }

  if (state.permission === 'denied') {
    return {
      supported: true,
      permission: 'denied',
      sample_count: 0,
      changes: 0,
      quality: 'missing',
    };
  }

  const quality = state.totalSamples > 10 ? 'ok' : state.totalSamples > 0 ? 'low' : 'missing';

  return {
    supported: true,
    permission: state.permission,
    sample_count: state.totalSamples,
    changes: state.totalChanges,
    quality,
  };
}

export function isOrientationCollecting(): boolean {
  return streamingState?.running ?? false;
}

// ─── One-shot API (backward compat) ───────────────────────────────

export function collectOrientation(durationMs: number = 3000): Promise<DemoGuardOrientationSignal> {
  return new Promise((resolve) => {
    if (!isOrientationSupported()) {
      resolve({
        supported: false,
        permission: 'unsupported',
        sample_count: 0,
        changes: 0,
        quality: 'unsupported',
      });
      return;
    }

    let sampleCount = 0;
    let changes = 0;
    let lastAlpha: number | null = null;
    let lastBeta: number | null = null;
    let lastGamma: number | null = null;

    const handler = (e: DeviceOrientationEvent) => {
      sampleCount++;
      if (lastAlpha !== null || lastBeta !== null || lastGamma !== null) {
        if (
          e.alpha !== lastAlpha ||
          e.beta !== lastBeta ||
          e.gamma !== lastGamma
        ) {
          changes++;
        }
      }
      lastAlpha = e.alpha;
      lastBeta = e.beta;
      lastGamma = e.gamma;
    };

    window.addEventListener('deviceorientation', handler);

    setTimeout(() => {
      window.removeEventListener('deviceorientation', handler);

      const quality = sampleCount > 10 ? 'ok' : sampleCount > 0 ? 'low' : 'missing';

      resolve({
        supported: true,
        permission: 'granted',
        sample_count: sampleCount,
        changes,
        quality,
      });
    }, durationMs);
  });
}
