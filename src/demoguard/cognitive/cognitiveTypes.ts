/**
 * DemoGuard Cognitive Battery — Shared type definitions
 *
 * All outputs are safe: no PII, no raw traces, no tokens, no audio.
 * Sensitive data is only sent to the proxy, never in UI/logs.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

export type CognitiveQuality = 'ok' | 'review' | 'failed' | 'missing';

// ─── Reflex ────────────────────────────────────────────────────────

export interface ReflexSignal {
  rounds: number;
  avg_ms: number;
  median_ms: number;
  variance_ms: number;
  min_ms: number;
  max_ms: number;
  too_fast_count: number;
  too_slow_count: number;
  regularity_score: number;
  quality: CognitiveQuality;
}

// ─── Stroop ────────────────────────────────────────────────────────

export interface StroopSignal {
  trials: number;
  conflict_trials: number;
  accuracy: number;
  avg_response_ms: number;
  conflict_cost_ms: number;
  error_count: number;
  quality: CognitiveQuality;
}

// ─── Digit Span ────────────────────────────────────────────────────

export interface DigitSpanSignal {
  trials: number;
  max_span: number;
  accuracy: number;
  positional_errors: number;
  quality: CognitiveQuality;
}

// ─── N-Back ────────────────────────────────────────────────────────

export interface NBackSignal {
  trials: number;
  targets: number;
  hits: number;
  false_positives: number;
  misses: number;
  accuracy: number;
  avg_response_ms: number;
  quality: CognitiveQuality;
}

// ─── Trail Tap ─────────────────────────────────────────────────────

export interface TrailTapSignal {
  nodes: number;
  completion_ms: number;
  wrong_taps: number;
  hesitation_count: number;
  path_efficiency: number;
  quality: CognitiveQuality;
}

// ─── Vocal RAN ─────────────────────────────────────────────────────

export interface VocalRanSignal {
  items_count: number;
  duration_ms: number;
  challenge_id: string;
  expected_hash: string;
  audio_present: boolean;
  quality: CognitiveQuality;
}

// ─── Cognitive Summary ─────────────────────────────────────────────

export type HumanLikelihood = 'high' | 'medium' | 'low';

export interface CognitiveSummary {
  completed_modules: number;
  total_modules: number;
  depth_score: number;
  consistency_score: number;
  anomaly_score: number;
  human_likelihood: HumanLikelihood;
  quality: CognitiveQuality;
}

// ─── Aggregate ─────────────────────────────────────────────────────

export interface CognitiveSignals {
  reflex: ReflexSignal | null;
  stroop: StroopSignal | null;
  digit_span: DigitSpanSignal | null;
  n_back: NBackSignal | null;
  trail_tap: TrailTapSignal | null;
  vocal_ran: VocalRanSignal | null;
  summary: CognitiveSummary | null;
}

// ─── Module names ──────────────────────────────────────────────────

export const COGNITIVE_MODULE_NAMES = [
  'reflex',
  'stroop',
  'digit_span',
  'n_back',
  'trail_tap',
  'vocal_ran',
] as const;

export type CognitiveModuleName = (typeof COGNITIVE_MODULE_NAMES)[number];

export const TOTAL_COGNITIVE_MODULES = COGNITIVE_MODULE_NAMES.length;
