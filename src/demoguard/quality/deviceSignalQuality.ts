/**
 * DemoGuard — Device signal quality assessor
 *
 * Evaluates quality of motion, orientation, touch, visibility, network signals.
 * Only uses safe metadata — never raw data.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import type {
  DemoGuardMotionSignal,
  DemoGuardOrientationSignal,
  DemoGuardTouchSignal,
  DemoGuardVisibilitySignal,
  DemoGuardNetworkSignal,
  SignalQuality,
} from '../types';

export function assessMotionQuality(signal: DemoGuardMotionSignal | null): SignalQuality {
  if (!signal) return 'missing';
  if (!signal.supported) return 'unsupported';
  return signal.quality;
}

export function assessOrientationQuality(signal: DemoGuardOrientationSignal | null): SignalQuality {
  if (!signal) return 'missing';
  if (!signal.supported) return 'unsupported';
  return signal.quality;
}

export function assessTouchQuality(signal: DemoGuardTouchSignal | null): SignalQuality {
  if (!signal) return 'missing';
  return signal.quality;
}

export function assessVisibilityQuality(signal: DemoGuardVisibilitySignal | null): SignalQuality {
  if (!signal) return 'missing';
  return signal.quality;
}

export function assessNetworkQuality(signal: DemoGuardNetworkSignal | null): SignalQuality {
  if (!signal) return 'missing';
  return signal.quality;
}
