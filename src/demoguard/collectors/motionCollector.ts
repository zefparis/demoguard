/**
 * DemoGuard — Motion collector
 *
 * Collects DeviceMotion data with iOS permission handling.
 * Returns safe summary only — no raw motion traces.
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
