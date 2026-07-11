/**
 * DemoGuard — Touch dynamics collector
 *
 * Listens to pointerdown, pointermove, pointerup (primary).
 * Falls back to touchstart/touchmove/touchend if Pointer Events not available.
 * Filters desktop mouse events: only pointerType 'touch' or TouchEvent counts.
 * Returns safe summary only — no raw touch traces.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import type { DemoGuardTouchSignal } from '../types';

export function collectTouch(durationMs: number = 5000): Promise<DemoGuardTouchSignal> {
  return new Promise((resolve) => {
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
    let touchDurationMs: number | undefined;
    let hasTouchApi = false;

    // Check if device has touch support
    if ('ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0) {
      hasTouchApi = true;
    }

    const onPointerDown = (e: PointerEvent) => {
      // Only count touch-type pointers on touch-capable devices
      // On desktop without touch, pointerType is 'mouse' — don't count as touch
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
        touchDurationMs = Math.round(performance.now() - downTime);
        isDown = false;
      }
    };

    // TouchEvent fallback (older browsers, iOS Safari quirks)
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
        touchDurationMs = Math.round(performance.now() - downTime);
        isDown = false;
      }
    };

    // Register listeners — passive to avoid scroll jank
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });

    // TouchEvent fallback
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    setTimeout(() => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);

      const pressureAvg = pressureSamples > 0 ? pressureSum / pressureSamples : undefined;

      // Determine quality: ok if touch captured, unsupported if no touch API, missing otherwise
      let quality: DemoGuardTouchSignal['quality'];
      if (touchCount > 0) {
        quality = 'ok';
      } else if (!hasTouchApi && pointerType === undefined) {
        // No touch API and no pointer events at all — unsupported
        quality = 'missing';
      } else {
        quality = 'missing';
      }

      resolve({
        touch_count: touchCount,
        pointer_type: pointerType,
        pressure_supported: pressureSupported,
        pressure_avg: pressureAvg,
        touch_duration_ms: touchDurationMs,
        move_distance: Math.round(totalMoveDistance),
        multi_touch_detected: multiTouchDetected,
        quality,
      });
    }, durationMs);
  });
}
