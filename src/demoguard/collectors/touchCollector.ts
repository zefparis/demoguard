/**
 * DemoGuard — Touch dynamics collector (streaming mode)
 *
 * Listens to pointerdown, pointermove, pointerup (primary).
 * Falls back to touchstart/touchmove/touchend if Pointer Events not available.
 * Filters desktop mouse events: only pointerType 'touch' or TouchEvent counts.
 * Returns safe summary only — no raw touch traces.
 *
 * Streaming API: startTouchCollection() / stopTouchCollection()
 * One-shot API: collectTouch(durationMs) — kept for backward compat.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import type { DemoGuardTouchSignal } from '../types';

// ─── Streaming state ──────────────────────────────────────────────

let streamingState: {
  running: boolean;
  touchCount: number;
  pointerType: string | undefined;
  pressureSum: number;
  pressureSamples: number;
  pressureSupported: boolean;
  multiTouchDetected: boolean;
  downTime: number;
  totalMoveDistance: number;
  lastX: number;
  lastY: number;
  isDown: boolean;
  lastTouchDurationMs: number | undefined;
  hasTouchApi: boolean;
  onPointerDown: ((e: PointerEvent) => void) | null;
  onPointerMove: ((e: PointerEvent) => void) | null;
  onPointerUp: (() => void) | null;
  onTouchStart: ((e: TouchEvent) => void) | null;
  onTouchMove: ((e: TouchEvent) => void) | null;
  onTouchEnd: (() => void) | null;
} | null = null;

export function startTouchCollection(): void {
  if (streamingState?.running) return;

  let touchCount = 0;
  let pointerType: string | undefined;
  let pressureSum = 0;
  let pressureSamples = 0;
  let pressureSupported = false;
  let multiTouchDetected = false;
  let downTime = 0;
  let totalMoveDistance = 0;
  let lastX = 0;
  let lastY = 0;
  let isDown = false;
  let lastTouchDurationMs: number | undefined;
  let hasTouchApi = false;

  if ('ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0) {
    hasTouchApi = true;
  }

  const onPointerDown = (e: PointerEvent) => {
    if (hasTouchApi && e.pointerType !== 'touch') return;
    touchCount++;
    isDown = true;
    downTime = performance.now();
    lastX = e.clientX;
    lastY = e.clientY;
    pointerType = e.pointerType;
    if (e.pressure > 0) {
      pressureSupported = true;
      pressureSum += e.pressure;
      pressureSamples++;
    }
    if (e.isPrimary === false) {
      multiTouchDetected = true;
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!isDown) return;
    if (hasTouchApi && e.pointerType !== 'touch') return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    totalMoveDistance += Math.sqrt(dx * dx + dy * dy);
    lastX = e.clientX;
    lastY = e.clientY;
    if (e.pressure > 0) {
      pressureSum += e.pressure;
      pressureSamples++;
    }
  };

  const onPointerUp = () => {
    if (isDown) {
      lastTouchDurationMs = Math.round(performance.now() - downTime);
      isDown = false;
    }
  };

  const onTouchStart = (e: TouchEvent) => {
    touchCount += e.changedTouches.length;
    isDown = true;
    downTime = performance.now();
    const t = e.changedTouches[0];
    if (t) {
      lastX = t.clientX;
      lastY = t.clientY;
    }
    pointerType = 'touch';
    if (e.touches.length > 1) {
      multiTouchDetected = true;
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!isDown) return;
    const t = e.changedTouches[0];
    if (t) {
      const dx = t.clientX - lastX;
      const dy = t.clientY - lastY;
      totalMoveDistance += Math.sqrt(dx * dx + dy * dy);
      lastX = t.clientX;
      lastY = t.clientY;
    }
  };

  const onTouchEnd = () => {
    if (isDown) {
      lastTouchDurationMs = Math.round(performance.now() - downTime);
      isDown = false;
    }
  };

  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: true });
  window.addEventListener('touchend', onTouchEnd, { passive: true });

  streamingState = {
    running: true,
    touchCount,
    pointerType,
    pressureSum,
    pressureSamples,
    pressureSupported,
    multiTouchDetected,
    downTime,
    totalMoveDistance,
    lastX,
    lastY,
    isDown,
    lastTouchDurationMs,
    hasTouchApi,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
}

export function stopTouchCollection(): DemoGuardTouchSignal {
  if (!streamingState) {
    return {
      touch_count: 0,
      pointer_type: undefined,
      pressure_supported: false,
      pressure_avg: undefined,
      touch_duration_ms: undefined,
      move_distance: 0,
      multi_touch_detected: false,
      quality: 'missing',
    };
  }

  const s = streamingState;
  streamingState = null;

  window.removeEventListener('pointerdown', s.onPointerDown!);
  window.removeEventListener('pointermove', s.onPointerMove!);
  window.removeEventListener('pointerup', s.onPointerUp!);
  window.removeEventListener('touchstart', s.onTouchStart!);
  window.removeEventListener('touchmove', s.onTouchMove!);
  window.removeEventListener('touchend', s.onTouchEnd!);

  const pressureAvg = s.pressureSamples > 0 ? s.pressureSum / s.pressureSamples : undefined;

  let quality: DemoGuardTouchSignal['quality'];
  if (s.touchCount > 0) {
    quality = 'ok';
  } else if (!s.hasTouchApi && s.pointerType === undefined) {
    quality = 'missing';
  } else {
    quality = 'missing';
  }

  return {
    touch_count: s.touchCount,
    pointer_type: s.pointerType,
    pressure_supported: s.pressureSupported,
    pressure_avg: pressureAvg,
    touch_duration_ms: s.lastTouchDurationMs,
    move_distance: Math.round(s.totalMoveDistance),
    multi_touch_detected: s.multiTouchDetected,
    quality,
  };
}

export function isTouchCollecting(): boolean {
  return streamingState?.running ?? false;
}

// ─── One-shot API (backward compat) ───────────────────────────────

export function collectTouch(durationMs: number = 5000): Promise<DemoGuardTouchSignal> {
  return new Promise((resolve) => {
    startTouchCollection();
    setTimeout(() => {
      resolve(stopTouchCollection());
    }, durationMs);
  });
}
