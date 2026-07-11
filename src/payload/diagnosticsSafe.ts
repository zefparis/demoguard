/**
 * DemoGuard — Safe diagnostics builders (ported from payguard)
 *
 * buildVoiceDiagnosticsSafe: always returns an object (never null/undefined)
 * buildTouchDiagnosticsSafe: always returns an object (never null/undefined)
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import type {
  DemoGuardVoiceSignal,
  DemoGuardTouchSignal,
  VoiceDiagnosticsSafe,
  TouchDiagnosticsSafe,
} from '../demoguard/types';
import type { TouchDiagnosticsBehaviorSafe } from '../demoguard/behavior/behaviorTypes';

export function buildVoiceDiagnosticsSafe(
  voiceSignal: DemoGuardVoiceSignal | null | undefined,
  voiceDiagnostic: VoiceDiagnosticsSafe | null,
  hasVoiceB64: boolean,
): VoiceDiagnosticsSafe {
  if (voiceDiagnostic) {
    return voiceDiagnostic;
  }
  if (voiceSignal && voiceSignal.recorded) {
    return {
      status: 'not_checked',
      reasonSafe: 'not_attempted',
      analysisMode: 'skipped',
      audioCaptured: true,
      payloadPrepared: hasVoiceB64,
      relayAttempted: false,
      relayAccepted: false,
      hcsAnalyzed: false,
      featuresExtracted: false,
      livenessStatus: 'unknown',
      confidence: null,
      latencyMs: null,
    };
  }
  return {
    status: 'not_checked',
    reasonSafe: 'voice_missing',
    analysisMode: 'skipped',
    audioCaptured: false,
    payloadPrepared: false,
    relayAttempted: false,
    relayAccepted: false,
    hcsAnalyzed: false,
    featuresExtracted: false,
    livenessStatus: 'unknown',
    confidence: null,
    latencyMs: null,
  };
}

export function buildTouchDiagnosticsSafe(
  touchSignal: DemoGuardTouchSignal | null | undefined,
  behaviorDiag: TouchDiagnosticsBehaviorSafe | null,
): TouchDiagnosticsSafe {
  if (behaviorDiag) {
    return {
      status: behaviorDiag.status,
      supported: behaviorDiag.supported,
      interactionCount: behaviorDiag.interactionCount,
      quality: behaviorDiag.quality,
      reasonSafe: behaviorDiag.reasonSafe,
    };
  }
  if (!touchSignal) {
    return {
      status: 'missing',
      supported: false,
      interactionCount: 0,
      quality: 'missing',
      reasonSafe: 'touch_not_collected',
    };
  }
  const interactionCount = touchSignal.touch_count;
  const quality = touchSignal.quality;
  const supported = interactionCount > 0 || quality !== 'unsupported';
  return {
    status: quality === 'ok' ? 'ok' : quality === 'missing' ? 'missing' : quality === 'unsupported' ? 'unsupported' : 'review',
    supported,
    interactionCount,
    quality: quality as 'ok' | 'review' | 'missing' | 'unsupported',
    reasonSafe: interactionCount > 0 ? 'touch_captured' : 'touch_missing',
  };
}
