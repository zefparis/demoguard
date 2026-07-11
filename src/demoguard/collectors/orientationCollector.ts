/**
 * DemoGuard — Orientation collector
 *
 * Collects DeviceOrientation data with iOS permission handling.
 * Returns safe summary only.
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
