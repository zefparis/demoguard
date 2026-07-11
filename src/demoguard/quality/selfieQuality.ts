/**
 * DemoGuard — Selfie quality assessor
 *
 * Evaluates selfie signal quality from safe metadata only.
 * Never accesses raw image data.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import type { DemoGuardSelfieSignal, SignalQuality } from '../types';

export function assessSelfieQuality(signal: DemoGuardSelfieSignal | null): SignalQuality {
  if (!signal || !signal.captured) return 'missing';
  if (!signal.width || !signal.height) return 'low';
  if (signal.width < 320 || signal.height < 240) return 'low';
  return signal.quality;
}

export function isSelfieUsable(signal: DemoGuardSelfieSignal | null): boolean {
  return assessSelfieQuality(signal) === 'ok';
}
