/**
 * DG-3/DG-4: Quality assessors + device signal tests
 *
 * Adapted from payguard's demoguard-real-signals.test.ts and
 * demoguard-device-signals.test.ts. Only the quality assessor and
 * signal completeness tests are ported (no file-path UI safety tests).
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

// ─── Selfie quality ────────────────────────────────────────────────

describe('DG-3: Selfie quality assessor', () => {
  it('assessSelfieQuality returns missing for null signal', async () => {
    const { assessSelfieQuality } = await import('../src/demoguard/quality/selfieQuality');
    expect(assessSelfieQuality(null)).toBe('missing');
  });

  it('assessSelfieQuality returns missing for uncaptured signal', async () => {
    const { assessSelfieQuality } = await import('../src/demoguard/quality/selfieQuality');
    expect(assessSelfieQuality({ captured: false, quality: 'missing' })).toBe('missing');
  });

  it('assessSelfieQuality returns low for small resolution', async () => {
    const { assessSelfieQuality } = await import('../src/demoguard/quality/selfieQuality');
    expect(assessSelfieQuality({ captured: true, quality: 'ok', width: 200, height: 150 })).toBe('low');
  });

  it('assessSelfieQuality returns ok for good resolution', async () => {
    const { assessSelfieQuality } = await import('../src/demoguard/quality/selfieQuality');
    expect(assessSelfieQuality({ captured: true, quality: 'ok', width: 640, height: 480 })).toBe('ok');
  });
});

// ─── Audio quality ─────────────────────────────────────────────────

describe('DG-3: Audio quality assessor', () => {
  it('assessAudioQuality returns missing for null signal', async () => {
    const { assessAudioQuality } = await import('../src/demoguard/quality/audioQuality');
    expect(assessAudioQuality(null)).toBe('missing');
  });

  it('assessAudioQuality returns missing for unrecorded signal', async () => {
    const { assessAudioQuality } = await import('../src/demoguard/quality/audioQuality');
    expect(assessAudioQuality({ recorded: false, quality: 'missing' })).toBe('missing');
  });

  it('assessAudioQuality returns low for short duration', async () => {
    const { assessAudioQuality } = await import('../src/demoguard/quality/audioQuality');
    expect(assessAudioQuality({ recorded: true, duration_ms: 500, quality: 'ok', mfcc_available: true })).toBe('low');
  });

  it('assessAudioQuality returns low when mfcc not available', async () => {
    const { assessAudioQuality } = await import('../src/demoguard/quality/audioQuality');
    expect(assessAudioQuality({ recorded: true, duration_ms: 4000, quality: 'ok', mfcc_available: false })).toBe('low');
  });

  it('assessAudioQuality returns ok for good duration + mfcc', async () => {
    const { assessAudioQuality } = await import('../src/demoguard/quality/audioQuality');
    expect(assessAudioQuality({ recorded: true, duration_ms: 4000, quality: 'ok', mfcc_available: true })).toBe('ok');
  });
});

// ─── Device signal quality ─────────────────────────────────────────

describe('DG-4: Device signal quality assessor', () => {
  it('assessMotionQuality returns missing for null', async () => {
    const { assessMotionQuality } = await import('../src/demoguard/quality/deviceSignalQuality');
    expect(assessMotionQuality(null)).toBe('missing');
  });

  it('assessMotionQuality returns unsupported for unsupported signal', async () => {
    const { assessMotionQuality } = await import('../src/demoguard/quality/deviceSignalQuality');
    expect(assessMotionQuality({ supported: false, permission: 'unsupported', sample_count: 0, quality: 'unsupported' })).toBe('unsupported');
  });

  it('assessOrientationQuality returns missing for null', async () => {
    const { assessOrientationQuality } = await import('../src/demoguard/quality/deviceSignalQuality');
    expect(assessOrientationQuality(null)).toBe('missing');
  });

  it('assessTouchQuality returns missing for null', async () => {
    const { assessTouchQuality } = await import('../src/demoguard/quality/deviceSignalQuality');
    expect(assessTouchQuality(null)).toBe('missing');
  });

  it('assessVisibilityQuality returns missing for null', async () => {
    const { assessVisibilityQuality } = await import('../src/demoguard/quality/deviceSignalQuality');
    expect(assessVisibilityQuality(null)).toBe('missing');
  });

  it('assessNetworkQuality returns missing for null', async () => {
    const { assessNetworkQuality } = await import('../src/demoguard/quality/deviceSignalQuality');
    expect(assessNetworkQuality(null)).toBe('missing');
  });
});

// ─── Signal completeness ───────────────────────────────────────────

describe('DG-4: Signal completeness with device signals', () => {
  it('0% with no signals', async () => {
    const { computeSignalCompleteness } = await import('../src/demoguard/quality/signalCompleteness');
    const score = computeSignalCompleteness({
      selfie: null, reaction: null, voice: null,
      motion: null, orientation: null, touch: null, visibility: null, network: null,
    });
    expect(score).toBe(0);
  });

  it('increases with device signals added', async () => {
    const { computeSignalCompleteness } = await import('../src/demoguard/quality/signalCompleteness');
    const base = {
      selfie: null, reaction: null, voice: null,
      motion: null, orientation: null, touch: null, visibility: null, network: null,
    };
    const score0 = computeSignalCompleteness(base);
    const score1 = computeSignalCompleteness({
      ...base,
      motion: { supported: true, permission: 'granted', sample_count: 50, variance: 0.5, quality: 'ok' },
    });
    expect(score1).toBeGreaterThan(score0);
  });

  it('unsupported optional does not penalize like missing critical', async () => {
    const { computeSignalCompleteness } = await import('../src/demoguard/quality/signalCompleteness');
    const withUnsupported = {
      selfie: null, reaction: null, voice: null,
      motion: { supported: false, permission: 'unsupported', sample_count: 0, quality: 'unsupported' } as const,
      orientation: { supported: false, permission: 'unsupported', sample_count: 0, changes: 0, quality: 'unsupported' } as const,
      touch: null, visibility: null, network: null,
    };
    const scoreUnsupported = computeSignalCompleteness(withUnsupported);
    expect(scoreUnsupported).toBeGreaterThan(0);
  });

  it('100% when all 14 slots filled (8 original + 6 cognitive)', async () => {
    const { computeSignalCompleteness } = await import('../src/demoguard/quality/signalCompleteness');
    const score = computeSignalCompleteness({
      selfie: { captured: true, quality: 'ok', width: 640, height: 480 },
      reaction: { reaction_ms: 300, too_fast: false, too_slow: false, quality: 'ok' },
      voice: { recorded: true, duration_ms: 4000, challenge_id: 'dg_voice_TEST', quality: 'ok', mfcc_available: true },
      motion: { supported: true, permission: 'granted', sample_count: 50, variance: 0.5, quality: 'ok' },
      orientation: { supported: true, permission: 'granted', sample_count: 50, changes: 10, quality: 'ok' },
      touch: { touch_count: 5, pointer_type: 'touch', pressure_supported: true, pressure_avg: 0.5, touch_duration_ms: 200, move_distance: 100, multi_touch_detected: false, quality: 'ok' },
      visibility: { blur_count: 0, focus_count: 1, visibility_hidden_count: 0, hidden_duration_ms: 0, page_focus_lost: false, quality: 'ok' },
      network: { online: true, effective_type: '4g', rtt: 50, downlink: 10, quality: 'ok' },
      cognitive: {
        reflex: { rounds: 5, avg_ms: 300, median_ms: 290, variance_ms: 100, min_ms: 200, max_ms: 400, too_fast_count: 0, too_slow_count: 0, regularity_score: 0.5, quality: 'ok' },
        stroop: { trials: 6, conflict_trials: 3, accuracy: 0.83, avg_response_ms: 600, conflict_cost_ms: 80, error_count: 1, quality: 'ok' },
        digit_span: { trials: 3, max_span: 7, accuracy: 0.67, positional_errors: 1, quality: 'ok' },
        n_back: { trials: 8, targets: 2, hits: 2, false_positives: 0, misses: 0, accuracy: 1, avg_response_ms: 500, quality: 'ok' },
        trail_tap: { nodes: 5, completion_ms: 3000, wrong_taps: 0, hesitation_count: 0, path_efficiency: 0.9, quality: 'ok' },
        vocal_ran: { items_count: 5, duration_ms: 3000, challenge_id: 'dg_vran_TEST', expected_hash: 'abc12345', audio_present: true, quality: 'ok' },
        summary: { completed_modules: 6, total_modules: 6, depth_score: 1, consistency_score: 0.9, anomaly_score: 0.1, human_likelihood: 'high', quality: 'ok' },
      },
    });
    expect(score).toBe(1);
  });
});

// ─── Motion collector (runtime) ────────────────────────────────────

describe('DG-4: Motion collector', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('handles unsupported DeviceMotion gracefully', async () => {
    vi.stubGlobal('window', {});
    const { collectMotion } = await import('../src/demoguard/collectors/motionCollector');
    const result = await collectMotion(100);
    expect(result.supported).toBe(false);
    expect(result.permission).toBe('unsupported');
    expect(result.quality).toBe('unsupported');
    expect(result.sample_count).toBe(0);
  });

  it('requestMotionPermission returns unsupported when no DeviceMotionEvent', async () => {
    vi.stubGlobal('window', {});
    const { requestMotionPermission } = await import('../src/demoguard/collectors/motionCollector');
    const result = await requestMotionPermission();
    expect(result).toBe('unsupported');
  });
});

// ─── Orientation collector (runtime) ───────────────────────────────

describe('DG-4: Orientation collector', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('handles unsupported DeviceOrientation gracefully', async () => {
    vi.stubGlobal('window', {});
    const { collectOrientation } = await import('../src/demoguard/collectors/orientationCollector');
    const result = await collectOrientation(100);
    expect(result.supported).toBe(false);
    expect(result.permission).toBe('unsupported');
    expect(result.quality).toBe('unsupported');
    expect(result.changes).toBe(0);
  });
});

// ─── Network collector (runtime) ───────────────────────────────────

describe('DG-4: Network collector', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('falls back gracefully when navigator.connection is absent', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    const { collectNetwork } = await import('../src/demoguard/collectors/networkCollector');
    const result = collectNetwork();
    expect(result.quality).toBe('unsupported');
    expect(result.online).toBe(true);
    expect(result.effective_type).toBeUndefined();
  });

  it('returns safe metadata when connection is available', async () => {
    vi.stubGlobal('navigator', {
      onLine: true,
      connection: { effectiveType: '4g', rtt: 50, downlink: 10 },
    });
    const { collectNetwork } = await import('../src/demoguard/collectors/networkCollector');
    const result = collectNetwork();
    expect(result.quality).toBe('ok');
    expect(result.online).toBe(true);
    expect(result.effective_type).toBe('4g');
    expect(result.rtt).toBe(50);
    expect(result.downlink).toBe(10);
  });
});
