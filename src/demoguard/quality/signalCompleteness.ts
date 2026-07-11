/**
 * DemoGuard — Signal completeness scorer v2 (standalone)
 *
 * Returns a score in [0, 1] based on how many signal slots are filled.
 * Critical slots (selfie, voice) weigh more than optional ones.
 * 'reaction' is NOT a critical slot in standalone app (no separate reaction test).
 * Unsupported optional slots don't penalize the score.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import type { DemoGuardSignals, DemoGuardPermissions, DemoGuardDeviceContext, DemoGuardQuality, SignalQuality } from '../types';

const CRITICAL_SLOTS: (keyof DemoGuardSignals)[] = ['selfie', 'voice'];
const OPTIONAL_SLOTS: (keyof DemoGuardSignals)[] = ['motion', 'orientation', 'touch', 'visibility', 'network'];

function isUnsupported(signal: unknown): boolean {
  return signal !== null && typeof signal === 'object' && 'quality' in signal && (signal as { quality: SignalQuality }).quality === 'unsupported';
}

export function computeSignalCompleteness(signals: DemoGuardSignals): number {
  const criticalFilled = CRITICAL_SLOTS.filter((s) => signals[s] != null).length;
  const optionalFilled = OPTIONAL_SLOTS.filter((s) => {
    const sig = signals[s];
    if (sig == null) return false;
    if (isUnsupported(sig)) return true;
    return true;
  }).length;

  let cognitiveFilled = 0;
  if (signals.cognitive) {
    const cog = signals.cognitive;
    const cogModules = [cog.reflex, cog.stroop, cog.digit_span, cog.n_back, cog.trail_tap, cog.vocal_ran];
    cognitiveFilled = cogModules.filter((m) => m !== null).length;
  }

  const totalSlots = CRITICAL_SLOTS.length + OPTIONAL_SLOTS.length + 6;
  const filled = criticalFilled + optionalFilled + cognitiveFilled;
  return filled / totalSlots;
}

function isDeviceReady(device: DemoGuardDeviceContext): boolean {
  return device.online && !!device.screenWidth && !!device.screenHeight;
}

function arePermissionsReady(perms: DemoGuardPermissions): boolean {
  const essential: (keyof DemoGuardPermissions)[] = ['camera', 'microphone'];
  return essential.every((p) => perms[p] === 'granted' || perms[p] === 'prompt');
}

export function computeQuality(
  signals: DemoGuardSignals,
  device: DemoGuardDeviceContext,
  permissions: DemoGuardPermissions,
): DemoGuardQuality {
  const signal_completeness = computeSignalCompleteness(signals);
  const device_ready = isDeviceReady(device);
  const permissions_ready = arePermissionsReady(permissions);

  const critical_missing: string[] = [];
  for (const slot of CRITICAL_SLOTS) {
    if (signals[slot] == null) critical_missing.push(slot);
  }

  const missing_optional: string[] = [];
  for (const slot of OPTIONAL_SLOTS) {
    const sig = signals[slot];
    if (sig == null) {
      missing_optional.push(slot);
    } else if (isUnsupported(sig)) {
      // unsupported is not penalized
    }
  }

  const overall_ready = device_ready && permissions_ready && critical_missing.length === 0 && signal_completeness >= 0.5;

  return {
    signal_completeness,
    device_ready,
    permissions_ready,
    overall_ready,
    critical_missing,
    missing_optional,
  };
}
