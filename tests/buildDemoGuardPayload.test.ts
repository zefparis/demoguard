/**
 * DemoGuard — Payload builder tests
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { describe, it, expect } from 'vitest';
import { buildDemoGuardPayload } from '../src/payload/buildDemoGuardPayload';
import type { DemoGuardState } from '../src/state/demoguardReducer';
import { initialState } from '../src/state/demoguardReducer';
import type { TouchDiagnosticsBehaviorSafe } from '../src/demoguard/behavior/behaviorTypes';
import type { VoiceDiagnosticsSafe, DemoGuardSignals } from '../src/demoguard/types';

const mockState: DemoGuardState = {
  ...initialState,
  sessionPublicId: 'sess_test',
  startedAt: '2026-01-01T00:00:00.000Z',
  completedAt: '2026-01-01T00:05:00.000Z',
  device: {
    platform: 'iPhone',
    osVersion: '17.0',
    model: 'iPhone 15',
    manufacturer: 'Apple',
    screenWidth: 390,
    screenHeight: 844,
    pixelRatio: 3,
    language: 'fr-FR',
    timezone: 'Europe/Paris',
    online: true,
  },
  permissions: {
    camera: 'granted',
    microphone: 'granted',
    motion: 'granted',
    orientation: 'granted',
    notifications: 'prompt',
    location: 'prompt',
  },
  signals: {
    selfie: { captured: true, quality: 'ok', width: 1280, height: 960 },
    reaction: null,
    voice: { recorded: true, quality: 'ok', challenge_id: 'test' },
    motion: { supported: true, permission: 'granted', sample_count: 50, variance: 0.5, quality: 'ok' },
    orientation: { supported: true, permission: 'granted', sample_count: 50, changes: 10, quality: 'ok' },
    touch: { touch_count: 20, pointer_type: 'touch', pressure_supported: true, pressure_avg: 0.5, move_distance: 500, multi_touch_detected: false, quality: 'ok' },
    visibility: { blur_count: 0, focus_count: 1, visibility_hidden_count: 0, hidden_duration_ms: 0, page_focus_lost: false, quality: 'ok' },
    network: { online: true, effective_type: '4g', rtt: 50, downlink: 10, quality: 'ok' },
    cognitive: null,
    behavior: null,
    voiceDiagnostics: undefined,
    touchDiagnostics: undefined,
    touchDiagnosticsBehavior: undefined,
  },
  cognitiveSignals: {
    reflex: { rounds: 5, avg_ms: 300, median_ms: 290, variance_ms: 100, min_ms: 200, max_ms: 400, too_fast_count: 0, too_slow_count: 0, regularity_score: 0.8, quality: 'ok' },
    stroop: { trials: 6, conflict_trials: 3, accuracy: 0.9, avg_response_ms: 500, conflict_cost_ms: 100, error_count: 1, quality: 'ok' },
    digit_span: { trials: 3, max_span: 5, accuracy: 0.8, positional_errors: 1, quality: 'ok' },
    n_back: { trials: 8, targets: 2, hits: 2, false_positives: 0, misses: 0, accuracy: 1.0, avg_response_ms: 400, quality: 'ok' },
    trail_tap: { nodes: 6, completion_ms: 5000, wrong_taps: 0, hesitation_count: 1, path_efficiency: 0.9, quality: 'ok' },
    vocal_ran: { items_count: 5, duration_ms: 4000, challenge_id: 'test', expected_hash: 'abc123', audio_present: true, quality: 'ok' },
    summary: { completed_modules: 6, total_modules: 6, depth_score: 0.9, consistency_score: 0.8, anomaly_score: 0.1, human_likelihood: 'high', quality: 'ok' },
  },
};

describe('buildDemoGuardPayload', () => {
  it('builds a valid payload with required fields', () => {
    const payload = buildDemoGuardPayload(mockState, null, null, {
      selfie_b64: 'base64data',
      voice_b64: 'voicebase64',
      mfcc_summary: [1, 2, 3],
    });

    expect(payload.hcs_session_public_id).toBe('sess_test');
    expect(payload.source).toBe('demoguard_mobile');
    expect(payload.demo_guard.version).toBe('1.0.0');
    expect(payload.demo_guard.device.platform).toBe('iPhone');
    expect(payload.demo_guard.signals.selfie?.captured).toBe(true);
    expect(payload.demo_guard.signals.cognitive?.reflex?.avg_ms).toBe(300);
  });

  it('includes sensitive data when provided', () => {
    const payload = buildDemoGuardPayload(mockState, null, null, {
      selfie_b64: 'base64data',
      voice_b64: 'voicebase64',
      mfcc_summary: [1, 2, 3],
    });

    expect(payload.sensitive?.selfie_b64).toBe('base64data');
    expect(payload.sensitive?.voice_b64).toBe('voicebase64');
    expect(payload.sensitive?.mfcc_summary).toEqual([1, 2, 3]);
  });

  it('omits sensitive when all null', () => {
    const payload = buildDemoGuardPayload(mockState, null, null, {
      selfie_b64: null,
      voice_b64: null,
      mfcc_summary: null,
    });

    expect(payload.sensitive).toBeUndefined();
  });

  it('computes quality from signals', () => {
    const payload = buildDemoGuardPayload(mockState, null, null, {
      selfie_b64: null,
      voice_b64: null,
      mfcc_summary: null,
    });

    expect(payload.demo_guard.quality).toBeDefined();
    expect(payload.demo_guard.quality.signal_completeness).toBeGreaterThan(0);
  });

  // ── Edge case: 0 interactions (behavior null) ──────────────────

  it('handles 0 interactions — behavior null, touchDiagnosticsBehavior null', () => {
    const payload = buildDemoGuardPayload(mockState, null, null, {
      selfie_b64: null,
      voice_b64: null,
      mfcc_summary: null,
    });

    expect(payload.demo_guard.signals.behavior).toBeNull();
    expect(payload.demo_guard.signals.touchDiagnosticsBehavior).toBeUndefined();
    expect(payload.demo_guard.signals.cognitive).toBeDefined();
    // Payload still valid — quality computed from remaining signals
    expect(payload.demo_guard.quality).toBeDefined();
    expect(payload.demo_guard.quality.signal_completeness).toBeGreaterThan(0);
  });

  it('handles 0 interactions — behavior with empty taskBehaviors', () => {
    const emptyBehavior = {
      taskBehaviors: {},
      summary: {
        tasksObserved: 0,
        totalInteractions: 0,
        avgRhythmMs: null,
        rhythmVariance: null,
        hesitationTotal: 0,
        correctionTotal: 0,
        consistencyScore: 0,
        motorConfidence: 0,
        behaviorLikelihood: 'low' as const,
        quality: 'failed' as const,
      },
    };
    const emptyDiag: TouchDiagnosticsBehaviorSafe = {
      status: 'missing',
      supported: true,
      interactionCount: 0,
      tasksObserved: 0,
      quality: 'missing',
      reasonSafe: 'behavior_touch_missing',
      behaviorConsistency: 0,
      motorConfidence: 0,
    };

    const payload = buildDemoGuardPayload(mockState, emptyBehavior, emptyDiag, {
      selfie_b64: null,
      voice_b64: null,
      mfcc_summary: null,
    });

    expect(payload.demo_guard.signals.behavior).toBeDefined();
    expect(payload.demo_guard.signals.behavior?.summary.totalInteractions).toBe(0);
    expect(payload.demo_guard.signals.behavior?.summary.quality).toBe('failed');
    expect(payload.demo_guard.signals.touchDiagnosticsBehavior).toBeDefined();
    expect(payload.demo_guard.signals.touchDiagnosticsBehavior?.status).toBe('missing');
    expect(payload.demo_guard.signals.touchDiagnosticsBehavior?.interactionCount).toBe(0);
  });

  // ── Edge case: touch unsupported ───────────────────────────────

  it('handles touch unsupported — touch signal null, touchDiagnosticsBehavior unsupported', () => {
    const touchUnsupportedState: DemoGuardState = {
      ...mockState,
      signals: {
        ...mockState.signals,
        touch: null,
      },
    };
    const unsupportedDiag: TouchDiagnosticsBehaviorSafe = {
      status: 'unsupported',
      supported: false,
      interactionCount: 0,
      tasksObserved: 0,
      quality: 'unsupported',
      reasonSafe: 'touch_unsupported',
      behaviorConsistency: 0,
      motorConfidence: 0,
    };

    const payload = buildDemoGuardPayload(touchUnsupportedState, null, unsupportedDiag, {
      selfie_b64: null,
      voice_b64: null,
      mfcc_summary: null,
    });

    expect(payload.demo_guard.signals.touch).toBeUndefined();
    expect(payload.demo_guard.signals.touchDiagnosticsBehavior).toBeDefined();
    expect(payload.demo_guard.signals.touchDiagnosticsBehavior?.status).toBe('unsupported');
    expect(payload.demo_guard.signals.touchDiagnosticsBehavior?.supported).toBe(false);
    // Payload still valid
    expect(payload.demo_guard.quality).toBeDefined();
  });

  // ── Edge case: voice skipped ───────────────────────────────────

  it('handles voice skipped — voice null, voiceDiagnostics not_checked', () => {
    const voiceSkippedState: DemoGuardState = {
      ...mockState,
      signals: {
        ...mockState.signals,
        voice: null,
      },
      cognitiveSignals: {
        ...mockState.cognitiveSignals!,
        vocal_ran: null,
        summary: {
          completed_modules: 5,
          total_modules: 6,
          depth_score: 0.75,
          consistency_score: 0.7,
          anomaly_score: 0.15,
          human_likelihood: 'medium',
          quality: 'ok',
        },
      },
    };
    const skippedVoiceDiag: VoiceDiagnosticsSafe = {
      status: 'not_checked',
      reasonSafe: 'not_attempted',
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

    const payload = buildDemoGuardPayload(
      { ...voiceSkippedState, voiceDiagnostic: skippedVoiceDiag },
      null,
      null,
      { selfie_b64: null, voice_b64: null, mfcc_summary: null },
    );

    expect(payload.demo_guard.signals.voice).toBeUndefined();
    expect(payload.demo_guard.signals.voiceDiagnostics).toBeDefined();
    expect(payload.demo_guard.signals.voiceDiagnostics?.status).toBe('not_checked');
    expect(payload.demo_guard.signals.voiceDiagnostics?.analysisMode).toBe('skipped');
    expect(payload.demo_guard.signals.cognitive?.vocal_ran).toBeNull();
    expect(payload.demo_guard.signals.cognitive?.summary?.completed_modules).toBe(5);
    // No voice sensitive data
    expect(payload.sensitive?.voice_b64).toBeUndefined();
    // Payload still valid
    expect(payload.demo_guard.quality).toBeDefined();
  });

  // ── Edge case: all edge cases combined ─────────────────────────

  it('handles all edge cases combined: 0 interactions + touch unsupported + voice skipped', () => {
    const edgeState: DemoGuardState = {
      ...mockState,
      signals: {
        ...mockState.signals,
        touch: null,
        voice: null,
      },
      cognitiveSignals: {
        reflex: mockState.cognitiveSignals!.reflex,
        stroop: mockState.cognitiveSignals!.stroop,
        digit_span: mockState.cognitiveSignals!.digit_span,
        n_back: mockState.cognitiveSignals!.n_back,
        trail_tap: mockState.cognitiveSignals!.trail_tap,
        vocal_ran: null,
        summary: {
          completed_modules: 5,
          total_modules: 6,
          depth_score: 0.65,
          consistency_score: 0.6,
          anomaly_score: 0.2,
          human_likelihood: 'medium',
          quality: 'review',
        },
      },
      voiceDiagnostic: {
        status: 'not_checked',
        reasonSafe: 'not_attempted',
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
      },
    };
    const unsupportedDiag: TouchDiagnosticsBehaviorSafe = {
      status: 'unsupported',
      supported: false,
      interactionCount: 0,
      tasksObserved: 0,
      quality: 'unsupported',
      reasonSafe: 'touch_unsupported',
      behaviorConsistency: 0,
      motorConfidence: 0,
    };

    const payload = buildDemoGuardPayload(edgeState, null, unsupportedDiag, {
      selfie_b64: null,
      voice_b64: null,
      mfcc_summary: null,
    });

    // All edge conditions present
    expect(payload.demo_guard.signals.behavior).toBeNull();
    expect(payload.demo_guard.signals.touch).toBeUndefined();
    expect(payload.demo_guard.signals.voice).toBeUndefined();
    expect(payload.demo_guard.signals.touchDiagnosticsBehavior?.status).toBe('unsupported');
    expect(payload.demo_guard.signals.voiceDiagnostics?.status).toBe('not_checked');
    expect(payload.demo_guard.signals.cognitive?.vocal_ran).toBeNull();
    expect(payload.demo_guard.signals.cognitive?.summary?.completed_modules).toBe(5);
    // No sensitive data
    expect(payload.sensitive).toBeUndefined();
    // Payload still valid
    expect(payload.hcs_session_public_id).toBe('sess_test');
    expect(payload.demo_guard.quality).toBeDefined();
  });

  // ── GAP 0: null → undefined for signal slots (Zod .optional() rejects null) ──

  it('GAP 0: reaction key absent from JSON when null (not serialized as null)', () => {
    const payload = buildDemoGuardPayload(mockState, null, null, {
      selfie_b64: null,
      voice_b64: null,
      mfcc_summary: null,
    });
    const json = JSON.stringify(payload.demo_guard.signals);
    expect(json).not.toContain('"reaction"');
    expect(payload.demo_guard.signals.reaction).toBeUndefined();
  });

  it('GAP 0: all null signal slots are undefined (omitted from JSON)', () => {
    const nullSignalsState: DemoGuardState = {
      ...mockState,
      signals: {
        selfie: null,
        reaction: null,
        voice: null,
        motion: null,
        orientation: null,
        touch: null,
        visibility: null,
        network: null,
        cognitive: null,
        behavior: null,
      },
    };
    const payload = buildDemoGuardPayload(nullSignalsState, null, null, {
      selfie_b64: null,
      voice_b64: null,
      mfcc_summary: null,
    });
    const json = JSON.stringify(payload.demo_guard.signals);
    expect(json).not.toContain('"selfie":null');
    expect(json).not.toContain('"reaction"');
    expect(json).not.toContain('"voice":null');
    expect(json).not.toContain('"motion":null');
    expect(json).not.toContain('"orientation":null');
    expect(json).not.toContain('"touch":null');
    expect(json).not.toContain('"visibility":null');
    expect(json).not.toContain('"network":null');
  });

  // ── GAP 1: cognitive.summary is computed (not null) ──

  it('GAP 1: cognitive.summary is a computed object (not null)', () => {
    const payload = buildDemoGuardPayload(mockState, null, null, {
      selfie_b64: null,
      voice_b64: null,
      mfcc_summary: null,
    });
    expect(payload.demo_guard.signals.cognitive?.summary).toBeDefined();
    expect(payload.demo_guard.signals.cognitive?.summary).not.toBeNull();
    expect(typeof payload.demo_guard.signals.cognitive?.summary).toBe('object');
    expect(payload.demo_guard.signals.cognitive?.summary?.completed_modules).toBe(6);
    expect(payload.demo_guard.signals.cognitive?.summary?.total_modules).toBe(6);
  });

  it('GAP 1: cognitive.summary is null when cognitiveSignals is null', () => {
    const noCogState: DemoGuardState = {
      ...mockState,
      cognitiveSignals: null,
    };
    const payload = buildDemoGuardPayload(noCogState, null, null, {
      selfie_b64: null,
      voice_b64: null,
      mfcc_summary: null,
    });
    expect(payload.demo_guard.signals.cognitive).toBeNull();
  });

  // ── GAP 3: touchDiagnostics is always an object ──

  it('GAP 3: touchDiagnostics is an object even when touch is null and behaviorDiag is null', () => {
    const noTouchState: DemoGuardState = {
      ...mockState,
      signals: { ...mockState.signals, touch: null },
    };
    const payload = buildDemoGuardPayload(noTouchState, null, null, {
      selfie_b64: null,
      voice_b64: null,
      mfcc_summary: null,
    });
    expect(payload.demo_guard.signals.touchDiagnostics).toBeDefined();
    expect(payload.demo_guard.signals.touchDiagnostics?.status).toBe('missing');
    expect(payload.demo_guard.signals.touchDiagnostics?.supported).toBe(false);
    expect(payload.demo_guard.signals.touchDiagnostics?.interactionCount).toBe(0);
  });

  it('GAP 3: touchDiagnostics uses behaviorDiag when available', () => {
    const diag: TouchDiagnosticsBehaviorSafe = {
      status: 'ok',
      supported: true,
      interactionCount: 42,
      tasksObserved: 5,
      quality: 'ok',
      reasonSafe: 'behavior_touch_captured',
      behaviorConsistency: 0.8,
      motorConfidence: 0.9,
    };
    const payload = buildDemoGuardPayload(mockState, null, diag, {
      selfie_b64: null,
      voice_b64: null,
      mfcc_summary: null,
    });
    expect(payload.demo_guard.signals.touchDiagnostics?.status).toBe('ok');
    expect(payload.demo_guard.signals.touchDiagnostics?.interactionCount).toBe(42);
  });

  // ── GAP 4: voiceDiagnostics is always an object (fallback not_checked) ──

  it('GAP 4: voiceDiagnostics is an object even when voice is null and no diagnostic', () => {
    const noVoiceState: DemoGuardState = {
      ...mockState,
      signals: { ...mockState.signals, voice: null },
      voiceDiagnostic: null,
    };
    const payload = buildDemoGuardPayload(noVoiceState, null, null, {
      selfie_b64: null,
      voice_b64: null,
      mfcc_summary: null,
    });
    expect(payload.demo_guard.signals.voiceDiagnostics).toBeDefined();
    expect(payload.demo_guard.signals.voiceDiagnostics?.status).toBe('not_checked');
    expect(payload.demo_guard.signals.voiceDiagnostics?.reasonSafe).toBe('voice_missing');
    expect(payload.demo_guard.signals.voiceDiagnostics?.audioCaptured).toBe(false);
  });

  it('GAP 4: voiceDiagnostics fallback to not_checked when voice recorded but no diagnostic', () => {
    const voiceRecordedState: DemoGuardState = {
      ...mockState,
      voiceDiagnostic: null,
    };
    const payload = buildDemoGuardPayload(voiceRecordedState, null, null, {
      selfie_b64: null,
      voice_b64: 'voicebase64',
      mfcc_summary: null,
    });
    expect(payload.demo_guard.signals.voiceDiagnostics?.status).toBe('not_checked');
    expect(payload.demo_guard.signals.voiceDiagnostics?.reasonSafe).toBe('not_attempted');
    expect(payload.demo_guard.signals.voiceDiagnostics?.audioCaptured).toBe(true);
    expect(payload.demo_guard.signals.voiceDiagnostics?.payloadPrepared).toBe(true);
  });

  // ── FIX-02: Stale state regression — device signals must be in payload ──

  it('FIX-02: device signals from stop*Collection appear in payload when merged into state (not stale)', () => {
    // Simulate the stale state bug: state.signals has null device signals
    // (as they would be before the dispatch is applied)
    const staleState: DemoGuardState = {
      ...mockState,
      signals: {
        ...mockState.signals,
        motion: null,
        orientation: null,
        touch: null,
        visibility: null,
        network: null,
      },
    };

    // Simulate what continuousSignals.stop() returns
    const deviceSignals: Partial<DemoGuardSignals> = {
      motion: { supported: true, permission: 'granted', sample_count: 360, variance: 0.15, quality: 'ok' },
      orientation: { supported: true, permission: 'granted', sample_count: 360, changes: 27, quality: 'ok' },
      touch: { touch_count: 47, pointer_type: 'touch', pressure_supported: true, pressure_avg: 0.3, move_distance: 3200, multi_touch_detected: false, quality: 'ok' },
      visibility: { blur_count: 0, focus_count: 0, visibility_hidden_count: 0, hidden_duration_ms: 0, page_focus_lost: false, quality: 'ok' },
      network: { online: true, effective_type: '4g', rtt: 50, downlink: 10, quality: 'ok' },
    };

    // OLD (buggy): buildDemoGuardPayload(staleState, ...) → device signals undefined
    const buggyPayload = buildDemoGuardPayload(staleState, null, null, {
      selfie_b64: null, voice_b64: null, mfcc_summary: null,
    });
    expect(buggyPayload.demo_guard.signals.motion).toBeUndefined();
    expect(buggyPayload.demo_guard.signals.orientation).toBeUndefined();
    expect(buggyPayload.demo_guard.signals.touch).toBeUndefined();

    // FIX: merge deviceSignals into state before building payload
    const stateWithSignals: DemoGuardState = {
      ...staleState,
      signals: { ...staleState.signals, ...deviceSignals },
    };

    const fixedPayload = buildDemoGuardPayload(stateWithSignals, null, null, {
      selfie_b64: null, voice_b64: null, mfcc_summary: null,
    });

    expect(fixedPayload.demo_guard.signals.motion).toBeDefined();
    expect(fixedPayload.demo_guard.signals.motion?.sample_count).toBe(360);
    expect(fixedPayload.demo_guard.signals.orientation).toBeDefined();
    expect(fixedPayload.demo_guard.signals.orientation?.changes).toBe(27);
    expect(fixedPayload.demo_guard.signals.touch).toBeDefined();
    expect(fixedPayload.demo_guard.signals.touch?.touch_count).toBe(47);
    expect(fixedPayload.demo_guard.signals.visibility).toBeDefined();
    expect(fixedPayload.demo_guard.signals.visibility?.blur_count).toBe(0);
    expect(fixedPayload.demo_guard.signals.network).toBeDefined();
    expect(fixedPayload.demo_guard.signals.network?.online).toBe(true);
  });

  it('FIX-02: completeness increases when device signals are merged (not stale)', () => {
    const staleState: DemoGuardState = {
      ...mockState,
      signals: {
        ...mockState.signals,
        motion: null,
        orientation: null,
        touch: null,
        visibility: null,
        network: null,
      },
    };

    const buggyPayload = buildDemoGuardPayload(staleState, null, null, {
      selfie_b64: null, voice_b64: null, mfcc_summary: null,
    });
    const buggyCompleteness = buggyPayload.demo_guard.quality.signal_completeness;

    const deviceSignals: Partial<DemoGuardSignals> = {
      motion: { supported: true, permission: 'granted', sample_count: 360, variance: 0.15, quality: 'ok' },
      orientation: { supported: true, permission: 'granted', sample_count: 360, changes: 27, quality: 'ok' },
      touch: { touch_count: 47, pointer_type: 'touch', pressure_supported: true, pressure_avg: 0.3, move_distance: 3200, multi_touch_detected: false, quality: 'ok' },
      visibility: { blur_count: 0, focus_count: 0, visibility_hidden_count: 0, hidden_duration_ms: 0, page_focus_lost: false, quality: 'ok' },
      network: { online: true, effective_type: '4g', rtt: 50, downlink: 10, quality: 'ok' },
    };

    const stateWithSignals: DemoGuardState = {
      ...staleState,
      signals: { ...staleState.signals, ...deviceSignals },
    };

    const fixedPayload = buildDemoGuardPayload(stateWithSignals, null, null, {
      selfie_b64: null, voice_b64: null, mfcc_summary: null,
    });
    const fixedCompleteness = fixedPayload.demo_guard.quality.signal_completeness;

    expect(fixedCompleteness).toBeGreaterThan(buggyCompleteness);
  });
});
