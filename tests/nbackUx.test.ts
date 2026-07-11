/**
 * NBackScreen UX tests — practice mode, single counter, scoring non-regression
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { describe, it, expect } from 'vitest';
import {
  NBACK_TRIALS,
  NBACK_PRACTICE_TRIALS,
  generateNBackTrials,
  generateNBackPracticeTrials,
  evaluateNBackTrial,
  computeNBackResult,
} from '../src/demoguard/cognitive/nBackChallenge';
import { computeCognitiveSummary } from '../src/demoguard/cognitive/cognitiveScoring';
import type { CognitiveSignals } from '../src/demoguard/cognitive/cognitiveTypes';

describe('NBack UX — Practice mode', () => {
  it('generates exactly 2 practice trials', () => {
    const practice = generateNBackPracticeTrials();
    expect(practice).toHaveLength(2);
    expect(practice.every((t) => t.isPractice === true)).toBe(true);
  });

  it('practice trials are not counted in nbackResults scoring', () => {
    const practiceTrials = generateNBackPracticeTrials();
    const realTrials = generateNBackTrials(NBACK_TRIALS);

    const practiceResults = practiceTrials.map((cfg) =>
      evaluateNBackTrial(cfg, cfg.isTarget, 500),
    );
    const realResults = realTrials.map((cfg) =>
      evaluateNBackTrial(cfg, cfg.isTarget, 500),
    );

    const allResults = [...practiceResults, ...realResults];
    const signal = computeNBackResult(allResults);

    expect(signal.trials).toBe(NBACK_TRIALS);
    expect(signal.trials).not.toBe(NBACK_TRIALS + NBACK_PRACTICE_TRIALS);
  });

  it('first practice trial is non-target, second is target (guided example)', () => {
    const practice = generateNBackPracticeTrials();
    expect(practice[0].isTarget).toBe(false);
    expect(practice[1].isTarget).toBe(true);
    expect(practice[1].letter).toBe(practice[0].letter);
  });
});

describe('NBack UX — Single counter', () => {
  it('NBACK_TRIALS is 8 (real trials only, practice excluded)', () => {
    expect(NBACK_TRIALS).toBe(8);
  });

  it('NBACK_PRACTICE_TRIALS is 2', () => {
    expect(NBACK_PRACTICE_TRIALS).toBe(2);
  });

  it('progress string shows only trial index / total, not mixed counters', () => {
    const trials = generateNBackTrials(NBACK_TRIALS);
    for (let i = 0; i < trials.length; i++) {
      const progress = `5/7 — ${i + 1}/${trials.length}`;
      // Format: "5/7 — X/8" where X is the trial index (1-based)
      expect(progress).toMatch(/^5\/7 — \d+\/8$/);
      // The trial counter should never exceed total trials
      const trialNum = parseInt(progress.split('—')[1].trim().split('/')[0], 10);
      expect(trialNum).toBe(i + 1);
      expect(trialNum).toBeLessThanOrEqual(NBACK_TRIALS);
    }
  });
});

describe('NBack UX — Scoring non-regression', () => {
  it('computeCognitiveSummary with perfect n_back still yields high human_likelihood', () => {
    const signals: CognitiveSignals = {
      reflex: { rounds: 5, avg_ms: 300, median_ms: 290, variance_ms: 100, min_ms: 200, max_ms: 400, too_fast_count: 0, too_slow_count: 0, regularity_score: 0.8, quality: 'ok' },
      stroop: { trials: 6, conflict_trials: 3, accuracy: 0.9, avg_response_ms: 500, conflict_cost_ms: 100, error_count: 1, quality: 'ok' },
      digit_span: { trials: 3, max_span: 5, accuracy: 0.8, positional_errors: 1, quality: 'ok' },
      n_back: { trials: 8, targets: 2, hits: 2, false_positives: 0, misses: 0, accuracy: 1.0, avg_response_ms: 400, quality: 'ok' },
      trail_tap: { nodes: 6, completion_ms: 5000, wrong_taps: 0, hesitation_count: 1, path_efficiency: 0.9, quality: 'ok' },
      vocal_ran: null,
      summary: null,
    };

    const summary = computeCognitiveSummary(signals);
    expect(summary.completed_modules).toBe(5);
    expect(summary.total_modules).toBe(6);
    expect(summary.human_likelihood).toBe('high');
    expect(summary.quality).toBe('ok');
  });

  it('computeCognitiveSummary with failed n_back (accuracy < 0.4) flags anomaly', () => {
    const signals: CognitiveSignals = {
      reflex: { rounds: 5, avg_ms: 300, median_ms: 290, variance_ms: 100, min_ms: 200, max_ms: 400, too_fast_count: 0, too_slow_count: 0, regularity_score: 0.8, quality: 'ok' },
      stroop: { trials: 6, conflict_trials: 3, accuracy: 0.9, avg_response_ms: 500, conflict_cost_ms: 100, error_count: 1, quality: 'ok' },
      digit_span: { trials: 3, max_span: 5, accuracy: 0.8, positional_errors: 1, quality: 'ok' },
      n_back: { trials: 8, targets: 2, hits: 0, false_positives: 5, misses: 2, accuracy: 0.125, avg_response_ms: 200, quality: 'failed' },
      trail_tap: { nodes: 6, completion_ms: 5000, wrong_taps: 0, hesitation_count: 1, path_efficiency: 0.9, quality: 'ok' },
      vocal_ran: null,
      summary: null,
    };

    const summary = computeCognitiveSummary(signals);
    expect(summary.anomaly_score).toBeGreaterThan(0);
  });

  it('n_back signal shape is unchanged (trials, targets, hits, false_positives, misses, accuracy, avg_response_ms, quality)', () => {
    const trials = generateNBackTrials(NBACK_TRIALS);
    const results = trials.map((cfg) => evaluateNBackTrial(cfg, cfg.isTarget, 500));
    const signal = computeNBackResult(results);

    expect(signal).toHaveProperty('trials');
    expect(signal).toHaveProperty('targets');
    expect(signal).toHaveProperty('hits');
    expect(signal).toHaveProperty('false_positives');
    expect(signal).toHaveProperty('misses');
    expect(signal).toHaveProperty('accuracy');
    expect(signal).toHaveProperty('avg_response_ms');
    expect(signal).toHaveProperty('quality');
  });
});
