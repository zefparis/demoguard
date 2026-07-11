/**
 * DemoGuard — Audio quality assessor
 *
 * Evaluates voice signal quality from safe metadata only.
 * Never accesses raw audio data.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import type { DemoGuardVoiceSignal, SignalQuality } from '../types';

export function assessAudioQuality(signal: DemoGuardVoiceSignal | null): SignalQuality {
  if (!signal || !signal.recorded) return 'missing';
  if (!signal.duration_ms || signal.duration_ms < 1000) return 'low';
  if (!signal.mfcc_available) return 'low';
  return signal.quality;
}

export function isAudioUsable(signal: DemoGuardVoiceSignal | null): boolean {
  return assessAudioQuality(signal) === 'ok';
}
