/**
 * Empirical validation: generate a real payload via buildDemoGuardPayload
 * using a Vitest test (import.meta.env is available in Vitest).
 * Writes payload to tests/empirical-payload-output.json
 *
 * Run: npx vitest run tests/empirical-payload.test.ts
 */
import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'fs';
import { buildDemoGuardPayload } from '../src/payload/buildDemoGuardPayload';
import { initialState } from '../src/state/demoguardReducer';
import type { DemoGuardState } from '../src/state/demoguardReducer';

const mockState: DemoGuardState = {
  ...initialState,
  sessionPublicId: 'hcs_sess_test_empirical_01',
  startedAt: '2026-07-11T20:00:00.000Z',
  completedAt: '2026-07-11T20:05:00.000Z',
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
    voice: { recorded: true, quality: 'ok', challenge_id: 'dg_vran_test01' },
    motion: { supported: true, permission: 'granted', sample_count: 50, variance: 0.5, quality: 'ok' },
    orientation: { supported: true, permission: 'granted', sample_count: 50, changes: 10, quality: 'ok' },
    touch: { touch_count: 20, pointer_type: 'touch', pressure_supported: true, pressure_avg: 0.5, move_distance: 500, multi_touch_detected: false, quality: 'ok' },
    visibility: { blur_count: 0, focus_count: 1, visibility_hidden_count: 0, hidden_duration_ms: 0, page_focus_lost: false, quality: 'ok' },
    network: { online: true, effective_type: '4g', rtt: 50, downlink: 10, quality: 'ok' },
    cognitive: null,
    behavior: null,
  },
  cognitiveSignals: {
    reflex: { rounds: 5, avg_ms: 300, median_ms: 290, variance_ms: 100, min_ms: 200, max_ms: 400, too_fast_count: 0, too_slow_count: 0, regularity_score: 0.8, quality: 'ok' },
    stroop: { trials: 6, conflict_trials: 3, accuracy: 0.9, avg_response_ms: 500, conflict_cost_ms: 100, error_count: 1, quality: 'ok' },
    digit_span: { trials: 3, max_span: 5, accuracy: 0.8, positional_errors: 1, quality: 'ok' },
    n_back: { trials: 8, targets: 2, hits: 2, false_positives: 0, misses: 0, accuracy: 1.0, avg_response_ms: 400, quality: 'ok' },
    trail_tap: { nodes: 6, completion_ms: 5000, wrong_taps: 0, hesitation_count: 1, path_efficiency: 0.9, quality: 'ok' },
    vocal_ran: null,
    summary: null,
  },
};

describe('empirical payload generation', () => {
  it('generates payload and writes to file for curl validation', () => {
    const payload = buildDemoGuardPayload(mockState, null, null, {
      selfie_b64: null,
      voice_b64: null,
      mfcc_summary: null,
    });

    const fullPayload = {
      ...payload,
      tenant_id: 'demoguard-demo',
    };

    const json = JSON.stringify(fullPayload, null, 2);
    writeFileSync('tests/empirical-payload-output.json', json);

    // Verify key properties
    expect(fullPayload.tenant_id).toBe('demoguard-demo');
    expect(fullPayload.source).toBe('demoguard_mobile');
    expect(fullPayload.demo_guard.signals.cognitive?.summary).toBeDefined();
    expect(fullPayload.demo_guard.signals.cognitive?.summary).not.toBeNull();
    expect(fullPayload.demo_guard.signals.touchDiagnostics).toBeDefined();
    expect(fullPayload.demo_guard.signals.voiceDiagnostics).toBeDefined();

    // Verify GAP 0: reaction (null) is absent from JSON, real signals are present
    const parsed = JSON.parse(json);
    expect(parsed.demo_guard.signals).not.toHaveProperty('reaction');
    expect(parsed.demo_guard.signals).toHaveProperty('selfie');
    expect(parsed.demo_guard.signals).toHaveProperty('voice');
    expect(parsed.demo_guard.signals).toHaveProperty('motion');
    expect(parsed.demo_guard.signals).toHaveProperty('touch');
    expect(parsed.demo_guard.signals).toHaveProperty('cognitive');
    expect(parsed.demo_guard.signals.cognitive).toHaveProperty('summary');
    expect(parsed.demo_guard.signals.cognitive.summary).not.toBeNull();
    expect(parsed.demo_guard.signals).toHaveProperty('touchDiagnostics');
    expect(parsed.demo_guard.signals).toHaveProperty('voiceDiagnostics');
  });
});
