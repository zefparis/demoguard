/**
 * DemoGuard — Behavior-integrated touch types
 *
 * Touch is not a standalone test. It is a behavioral layer measured
 * during cognitive tasks: timing, hesitation, pressure, corrections,
 * fluidity, path efficiency, decision rhythm.
 *
 * No raw coordinates, raw paths, raw tap traces, or raw pressure series.
 * Only safe aggregates.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

export type CognitiveTaskName =
  | 'reflex'
  | 'stroop'
  | 'digit_span'
  | 'n_back'
  | 'trail_tap'
  | 'vocal_ran';

export type BehaviorQuality = 'ok' | 'review' | 'failed' | 'missing';

export interface TaskTouchBehavior {
  task: CognitiveTaskName;
  interactionCount: number;
  avgInterActionMs: number | null;
  varianceInterActionMs: number | null;
  hesitationCount: number;
  correctionCount: number;
  wrongTapCount?: number;
  pressureAvailable: boolean;
  avgPressure?: number | null;
  pathEfficiency?: number | null;
  behaviorQuality: BehaviorQuality;
}

export interface BehaviorSummary {
  tasksObserved: number;
  totalInteractions: number;
  avgRhythmMs: number | null;
  rhythmVariance: number | null;
  hesitationTotal: number;
  correctionTotal: number;
  consistencyScore: number;
  motorConfidence: number;
  behaviorLikelihood: 'high' | 'medium' | 'low';
  quality: 'ok' | 'review' | 'failed';
}

export interface BehaviorPayload {
  taskBehaviors: {
    reflex?: TaskTouchBehavior;
    stroop?: TaskTouchBehavior;
    digit_span?: TaskTouchBehavior;
    n_back?: TaskTouchBehavior;
    trail_tap?: TaskTouchBehavior;
    vocal_ran?: TaskTouchBehavior;
  };
  summary: BehaviorSummary;
}

export interface TouchDiagnosticsBehaviorSafe {
  status: 'ok' | 'review' | 'missing' | 'unsupported';
  supported: boolean;
  interactionCount: number;
  tasksObserved: number;
  quality: 'ok' | 'review' | 'missing' | 'unsupported';
  reasonSafe: 'behavior_touch_captured' | 'behavior_touch_missing' | 'touch_unsupported';
  behaviorConsistency: number;
  motorConfidence: number;
}
