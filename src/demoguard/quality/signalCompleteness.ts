/**
 * DemoGuard — Signal completeness scorer v2 (standalone)
 *
 * Returns a score in [0, 1] based on how many signal slots are filled.
 * Critical slots (selfie, voice) weigh more than optional ones.
 * Unsupported optional slots don't penalize the score.
 * 'reaction' (V1 vestige) was removed from the signal schema — see REACTION_SIGNAL_AUDIT_01.md.
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

// When testScope === 'voice-only', selfie and cognitive tests (except vocal_ran)
// are not applicable — excluded from both the slot list and the total count.
const VOICE_ONLY_CRITICAL_SLOTS: (keyof DemoGuardSignals)[] = ['voice'];
const VOICE_ONLY_COGNITIVE_MODULES = 1; // only vocal_ran

export function computeSignalCompleteness(signals: DemoGuardSignals, testScope?: string | null): number {
  const isVoiceOnly = testScope === 'voice-only';
  const criticalSlots = isVoiceOnly ? VOICE_ONLY_CRITICAL_SLOTS : CRITICAL_SLOTS;
  const criticalFilled = criticalSlots.filter((s) => signals[s] != null).length;
  const optionalFilled = OPTIONAL_SLOTS.filter((s) => {
    const sig = signals[s];
    if (sig == null) return false;
    if (isUnsupported(sig)) return true;
    return true;
  }).length;

  let cognitiveFilled = 0;
  if (signals.cognitive) {
    const cog = signals.cognitive;
    if (isVoiceOnly) {
      cognitiveFilled = cog.vocal_ran ? 1 : 0;
    } else {
      const cogModules = [cog.reflex, cog.stroop, cog.digit_span, cog.n_back, cog.trail_tap, cog.vocal_ran];
      cognitiveFilled = cogModules.filter((m) => m !== null).length;
    }
  }

  const cognitiveTotal = isVoiceOnly ? VOICE_ONLY_COGNITIVE_MODULES : 6;
  const totalSlots = criticalSlots.length + OPTIONAL_SLOTS.length + cognitiveTotal;
  const filled = criticalFilled + optionalFilled + cognitiveFilled;
  return filled / totalSlots;
}

function isDeviceReady(device: DemoGuardDeviceContext): boolean {
  return device.online && !!device.screenWidth && !!device.screenHeight;
}

function arePermissionsReady(perms: DemoGuardPermissions, testScope?: string | null): boolean {
  // In voice-only mode, camera permission is not required
  const essential: (keyof DemoGuardPermissions)[] =
    testScope === 'voice-only' ? ['microphone'] : ['camera', 'microphone'];
  return essential.every((p) => perms[p] === 'granted' || perms[p] === 'prompt');
}

export function computeQuality(
  signals: DemoGuardSignals,
  device: DemoGuardDeviceContext,
  permissions: DemoGuardPermissions,
  testScope?: string | null,
): DemoGuardQuality {
  const isVoiceOnly = testScope === 'voice-only';
  const signal_completeness = computeSignalCompleteness(signals, testScope);
  const device_ready = isDeviceReady(device);
  const permissions_ready = arePermissionsReady(permissions, testScope);

  // In voice-only mode, selfie is not applicable — only voice is critical
  const criticalSlots = isVoiceOnly ? VOICE_ONLY_CRITICAL_SLOTS : CRITICAL_SLOTS;
  const critical_missing: string[] = [];
  for (const slot of criticalSlots) {
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
