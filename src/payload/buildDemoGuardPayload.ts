/**
 * DemoGuard — Payload builder (pure function)
 *
 * Assembles the final DemoGuardPayload at submit time.
 * Shape is strictly identical to the payload validated by HV Zod schema.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import type { DemoGuardPayload, DemoGuardSignals, DemoGuardSensitive } from '../demoguard/types';
import type { DemoGuardState } from '../state/demoguardReducer';
import type { BehaviorPayload, TouchDiagnosticsBehaviorSafe } from '../demoguard/behavior/behaviorTypes';
import { DEMOGUARD_VERSION, DEMOGUARD_SOURCE } from '../demoguard/constants';
import { computeQuality } from '../demoguard/quality/signalCompleteness';
import { computeCognitiveSummary } from '../demoguard/cognitive/cognitiveScoring';
import { buildVoiceDiagnosticsSafe, buildTouchDiagnosticsSafe } from './diagnosticsSafe';

export interface SensitiveRef {
  selfie_b64: string | null;
  voice_b64: string | null;
  voice_mimetype?: string | null;
  mfcc_summary: number[] | null;
}

export function buildDemoGuardPayload(
  state: DemoGuardState,
  behaviorPayload: BehaviorPayload | null,
  behaviorDiag: TouchDiagnosticsBehaviorSafe | null,
  sensitive: SensitiveRef,
): DemoGuardPayload {
  const cognitiveWithSummary = state.cognitiveSignals
    ? { ...state.cognitiveSignals, summary: computeCognitiveSummary(state.cognitiveSignals) }
    : null;

  const signals: DemoGuardSignals = {
    selfie: state.signals.selfie ?? undefined,
    // DEPRECATED V1 vestige — never implemented, replaced by cognitive.reflex (ReflexSignal).
    // Kept as undefined for schema compat (HV Zod .optional() accepts absent key).
    // See REACTION_SIGNAL_AUDIT_01.md — do NOT re-add a reaction collector.
    reaction: undefined,
    voice: state.signals.voice ?? undefined,
    motion: state.signals.motion ?? undefined,
    orientation: state.signals.orientation ?? undefined,
    touch: state.signals.touch ?? undefined,
    visibility: state.signals.visibility ?? undefined,
    network: state.signals.network ?? undefined,
    cognitive: cognitiveWithSummary,
    behavior: behaviorPayload,
    voiceDiagnostics: buildVoiceDiagnosticsSafe(
      state.signals.voice,
      state.voiceDiagnostic,
      !!sensitive.voice_b64,
    ),
    touchDiagnostics: buildTouchDiagnosticsSafe(
      state.signals.touch,
      behaviorDiag,
    ),
    touchDiagnosticsBehavior: behaviorDiag ?? undefined,
  };

  const device = state.device!;
  const permissions = state.permissions!;

  const quality = computeQuality(signals, device, permissions);

  const sensitivePayload: DemoGuardSensitive = {};
  if (sensitive.selfie_b64) sensitivePayload.selfie_b64 = sensitive.selfie_b64;
  if (sensitive.voice_b64) sensitivePayload.voice_b64 = sensitive.voice_b64;
  if (sensitive.voice_mimetype) sensitivePayload.voice_mimetype = sensitive.voice_mimetype;
  if (sensitive.mfcc_summary) sensitivePayload.mfcc_summary = sensitive.mfcc_summary;

  return {
    hcs_session_public_id: state.sessionPublicId,
    source: DEMOGUARD_SOURCE,
    demo_guard: {
      version: DEMOGUARD_VERSION,
      started_at: state.startedAt ?? new Date().toISOString(),
      completed_at: state.completedAt ?? new Date().toISOString(),
      device,
      permissions,
      signals,
      quality,
    },
    sensitive: Object.keys(sensitivePayload).length > 0 ? sensitivePayload : undefined,
  };
}
