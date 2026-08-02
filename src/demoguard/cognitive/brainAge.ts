/**
 * DemoGuard — Brain Age estimator (cosmetic, client-only)
 *
 * A purely cosmetic "brain age" score computed from cognitive metrics
 * already measured during the session. Designed as a viral engagement
 * hook — NOT a scientific measurement, NOT a medical claim.
 *
 * INVARIANTS:
 *   - Client-side only. Never sent to backend, never in payload.
 *   - Does NOT influence human_likelihood, quality, or any security decision.
 *   - Purely additive display on the final screen.
 *
 * Formula:
 *   Base: 30 years
 *   Reflex:   fast (avg_ms < 400) → younger, slow (> 500) → older
 *   Stroop:   high accuracy + fast response → younger, errors → older
 *   Memory:   digit_span_max_span >= 7 → younger, <= 4 → older
 *   Clamp:    [18, 65]
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import type { CognitiveSignals } from './cognitiveTypes';

export interface BrainAgeResult {
  age: number;
  label: string;
  breakdown: {
    reflexDelta: number;
    stroopDelta: number;
    memoryDelta: number;
  };
}

/**
 * Compute a cosmetic "brain age" from cognitive session metrics.
 * Returns null if insufficient data (no cognitive signals at all).
 */
export function computeBrainAge(cognitive: CognitiveSignals | null): BrainAgeResult | null {
  if (!cognitive) return null;

  let age = 30; // base
  let reflexDelta = 0;
  let stroopDelta = 0;
  let memoryDelta = 0;

  // ── Reflex adjustment ────────────────────────────────────────────
  // Norm: ~400ms avg for healthy adults. Faster → younger.
  // Every 50ms under 400 → -1 year. Every 50ms over 400 → +1 year.
  const reflex = cognitive.reflex;
  if (reflex && reflex.avg_ms > 0) {
    const diff = reflex.avg_ms - 400;
    reflexDelta = Math.round(diff / 50);
    age += reflexDelta;
  }

  // ── Stroop adjustment ────────────────────────────────────────────
  // High accuracy + fast response → younger.
  // accuracy: 1.0 → -3 years, 0.5 → +3 years (linear)
  // avg_response_ms: 600ms baseline; every 100ms under → -1, over → +1
  const stroop = cognitive.stroop;
  if (stroop && stroop.trials > 0) {
    const accDelta = Math.round((0.75 - stroop.accuracy) * 12); // 0.75 neutral
    const speedDelta = Math.round((stroop.avg_response_ms - 600) / 100);
    stroopDelta = accDelta + speedDelta;
    age += stroopDelta;
  }

  // ── Digit Span adjustment ────────────────────────────────────────
  // max_span: 7+ → -3 years per point above 7, 4- → +3 per point below 5
  // Norm: 7 digits for healthy young adults.
  const digit = cognitive.digit_span;
  if (digit && digit.max_span > 0) {
    if (digit.max_span >= 7) {
      memoryDelta = -(digit.max_span - 7) * 2; // 7→0, 8→-2, 9→-4
    } else if (digit.max_span <= 4) {
      memoryDelta = (5 - digit.max_span) * 3; // 4→+3, 3→+6
    } else {
      memoryDelta = (6 - digit.max_span) * 1; // 5→+1, 6→0
    }
    age += memoryDelta;
  }

  // ── Clamp [18, 65] ───────────────────────────────────────────────
  age = Math.max(18, Math.min(65, Math.round(age)));

  // ── Label ────────────────────────────────────────────────────────
  let label: string;
  if (age <= 22) label = 'cerebral';
  else if (age <= 30) label = 'sharp';
  else if (age <= 40) label = 'solid';
  else if (age <= 50) label = 'steady';
  else label = 'wise';

  return { age, label, breakdown: { reflexDelta, stroopDelta, memoryDelta } };
}
