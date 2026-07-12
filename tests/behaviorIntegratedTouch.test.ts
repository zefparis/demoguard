/**
 * P10 BEHAVIOR-INTEGRATED-TOUCH — Tests (standalone adaptation)
 *
 * Adapted from payguard: uses BehaviorSession (non-singleton) instead
 * of the global touchBehaviorCollector. Same test logic, no modification.
 *
 * @copyright (c) 2026 Benjamin BARRERE / IA SOLUTION
 * Patents Pending FR2514274 | FR2514546
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BehaviorSession } from '../src/demoguard/behavior/behaviorSession';
import {
  recordTaskStart,
  recordReflexTap,
  recordStroopSelection,
  recordDigitSpanKey,
  recordDigitSpanSubmit,
  recordNBackDecision,
  recordTrailTap,
} from '../src/demoguard/behavior/taskBehaviorRecorder';
import { computeBehaviorSummary, computeTaskBehavior } from '../src/demoguard/behavior/behaviorScoring';
import type { TaskTouchBehavior, BehaviorPayload } from '../src/demoguard/behavior/behaviorTypes';

describe('P10 BEHAVIOR-INTEGRATED-TOUCH', () => {
  let session: BehaviorSession;

  beforeEach(() => {
    session = new BehaviorSession();
    session.reset();
  });

  describe('Reflex taps feed behavior collector', () => {
    it('records reflex taps and produces a TaskTouchBehavior', () => {
      recordTaskStart(session, 'reflex');
      recordReflexTap(session, 350, false);
      recordReflexTap(session, 100, true); // too fast
      recordReflexTap(session, 420, false);
      recordReflexTap(session, 380, false);

      const tb = session.getTaskBehavior('reflex');
      expect(tb).not.toBeNull();
      expect(tb!.task).toBe('reflex');
      expect(tb!.interactionCount).toBe(4);
      expect(tb!.behaviorQuality).toBe('ok');
    });

    it('measures inter-action timing', () => {
      recordTaskStart(session, 'reflex');
      recordReflexTap(session, 300, false);
      recordReflexTap(session, 400, false);
      recordReflexTap(session, 350, false);

      const tb = session.getTaskBehavior('reflex');
      expect(tb).not.toBeNull();
      expect(tb!.avgInterActionMs).not.toBeNull();
      expect(tb!.varianceInterActionMs).not.toBeNull();
    });
  });

  describe('Stroop selections feed behavior collector', () => {
    it('records stroop selections with correctness', () => {
      recordTaskStart(session, 'stroop');
      recordStroopSelection(session, 'red', true, 800, false);
      recordStroopSelection(session, 'blue', false, 1200, false);
      recordStroopSelection(session, 'green', true, 700, false);

      const tb = session.getTaskBehavior('stroop');
      expect(tb).not.toBeNull();
      expect(tb!.interactionCount).toBe(3);
      expect(tb!.behaviorQuality).toBe('ok');
    });
  });

  describe('Digit Span typing feeds behavior collector', () => {
    it('records digit span key presses and submits', () => {
      recordTaskStart(session, 'digit_span');
      recordDigitSpanKey(session, false); // type a digit
      recordDigitSpanKey(session, false); // type a digit
      recordDigitSpanKey(session, true);  // delete (correction)
      recordDigitSpanKey(session, false); // retype
      recordDigitSpanSubmit(session);

      const tb = session.getTaskBehavior('digit_span');
      expect(tb).not.toBeNull();
      expect(tb!.interactionCount).toBe(5);
      expect(tb!.correctionCount).toBe(1);
    });
  });

  describe('N-Back decisions feed behavior collector', () => {
    it('records n-back decisions with correctness', () => {
      recordTaskStart(session, 'n_back');
      recordNBackDecision(session, true, 500);  // correct
      recordNBackDecision(session, false, 800); // wrong
      recordNBackDecision(session, true, 600);  // correct

      const tb = session.getTaskBehavior('n_back');
      expect(tb).not.toBeNull();
      expect(tb!.interactionCount).toBe(3);
    });
  });

  describe('Trail Tap computes wrong taps and path efficiency', () => {
    it('records trail tap with wrong taps and path efficiency', () => {
      recordTaskStart(session, 'trail_tap');
      recordTrailTap(session, true, 100, 120);
      recordTrailTap(session, false, null, null);
      recordTrailTap(session, true, 80, 90);
      recordTrailTap(session, true, 110, 100);
      recordTrailTap(session, true, null, null);

      const tb = session.getTaskBehavior('trail_tap');
      expect(tb).not.toBeNull();
      expect(tb!.interactionCount).toBe(5);
      expect(tb!.wrongTapCount).toBe(1);
      expect(tb!.pathEfficiency).not.toBeNull();
      expect(tb!.pathEfficiency!).toBeGreaterThan(0);
      expect(tb!.pathEfficiency!).toBeLessThanOrEqual(1);
    });
  });

  describe('BehaviorSummary counts tasksObserved', () => {
    it('counts number of tasks with interactions', () => {
      recordTaskStart(session, 'reflex');
      recordReflexTap(session, 300, false);
      recordReflexTap(session, 400, false);

      recordTaskStart(session, 'stroop');
      recordStroopSelection(session, 'red', true, 800, false);

      const summary = session.getSummary();
      expect(summary.tasksObserved).toBe(2);
      expect(summary.totalInteractions).toBe(3);
    });

    it('returns 0 tasksObserved when no interactions recorded', () => {
      const summary = session.getSummary();
      expect(summary.tasksObserved).toBe(0);
      expect(summary.totalInteractions).toBe(0);
    });
  });

  describe('totalInteractions > 0 makes touch status OK', () => {
    it('touch diagnostics status is ok/review when interactions exist', () => {
      recordTaskStart(session, 'reflex');
      recordReflexTap(session, 300, false);
      recordReflexTap(session, 400, false);

      const diag = session.getTouchDiagnostics();
      if (diag.supported) {
        expect(diag.status).not.toBe('missing');
        expect(diag.interactionCount).toBe(2);
        expect(diag.reasonSafe).toBe('behavior_touch_captured');
      } else {
        expect(diag.status).toBe('unsupported');
        expect(diag.reasonSafe).toBe('touch_unsupported');
      }
    });

    it('touch diagnostics status is missing/unsupported when no interactions', () => {
      const diag = session.getTouchDiagnostics();
      expect(diag.status === 'missing' || diag.status === 'unsupported').toBe(true);
    });
  });

  describe('Mobile cognitive interactions prevent touch_missing', () => {
    it('when interactions exist, status cannot be missing', () => {
      recordTaskStart(session, 'stroop');
      recordStroopSelection(session, 'red', true, 700, false);

      const diag = session.getTouchDiagnostics();
      expect(diag.status).not.toBe('missing');
    });
  });

  describe('Pressure unavailable does not fail', () => {
    it('behavior quality is ok even without pressure', () => {
      recordTaskStart(session, 'reflex');
      recordReflexTap(session, 300, false);
      recordReflexTap(session, 400, false);

      const tb = session.getTaskBehavior('reflex');
      expect(tb).not.toBeNull();
      expect(tb!.pressureAvailable).toBe(false);
      expect(tb!.avgPressure).toBeNull();
      expect(tb!.behaviorQuality).toBe('ok');
    });
  });

  describe('No raw data in payload', () => {
    it('no raw coordinates in payload', () => {
      recordTaskStart(session, 'trail_tap');
      recordTrailTap(session, true, 100, 120);
      recordTrailTap(session, false, null, null);

      const payload = session.getPayload();
      const payloadStr = JSON.stringify(payload);
      expect(payloadStr).not.toContain('x_coord');
      expect(payloadStr).not.toContain('y_coord');
      expect(payloadStr).not.toContain('clientX');
      expect(payloadStr).not.toContain('clientY');
      expect(payloadStr).not.toContain('pageX');
      expect(payloadStr).not.toContain('pageY');
    });

    it('no raw tap trace in payload', () => {
      recordTaskStart(session, 'reflex');
      recordReflexTap(session, 300, false);
      recordReflexTap(session, 400, false);

      const payload = session.getPayload();
      const payloadStr = JSON.stringify(payload);
      expect(payloadStr).not.toContain('tapTrace');
      expect(payloadStr).not.toContain('rawEvents');
      expect(payloadStr).not.toContain('interactions');
      expect(payloadStr).not.toContain('timestamps');
      expect(payloadStr).not.toContain('coordinates');
      expect(payloadStr).not.toContain('path');
    });

    it('no forbidden fields in payload', () => {
      recordTaskStart(session, 'stroop');
      recordStroopSelection(session, 'red', true, 800, false);

      const payload = session.getPayload();
      const payloadStr = JSON.stringify(payload);
      const forbidden = [
        'token', 'jwt', 'sessionToken', 'hcsCode',
        'first_name', 'last_name', 'email', 'phone',
        'selfie_b64', 'voice_b64', 'raw_audio',
        'face_embedding', 'vocal_embedding',
        'debug', 'internal', 'breakdown',
      ];
      for (const f of forbidden) {
        expect(payloadStr).not.toContain(f);
      }
    });
  });

  describe('BehaviorPayload structure', () => {
    it('payload has taskBehaviors and summary', () => {
      recordTaskStart(session, 'reflex');
      recordReflexTap(session, 300, false);

      const payload: BehaviorPayload = session.getPayload();
      expect(payload).toHaveProperty('taskBehaviors');
      expect(payload).toHaveProperty('summary');
      expect(payload.taskBehaviors.reflex).toBeDefined();
      expect(payload.summary.totalInteractions).toBe(1);
    });
  });

  describe('Behavior scoring functions', () => {
    it('computeBehaviorSummary returns correct quality for good behavior', () => {
      const taskBehaviors: Partial<Record<string, TaskTouchBehavior>> = {
        reflex: { task: 'reflex', interactionCount: 5, avgInterActionMs: 400, varianceInterActionMs: 1000, hesitationCount: 0, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'ok' },
        stroop: { task: 'stroop', interactionCount: 6, avgInterActionMs: 800, varianceInterActionMs: 2000, hesitationCount: 1, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'ok' },
        digit_span: { task: 'digit_span', interactionCount: 8, avgInterActionMs: 500, varianceInterActionMs: 1500, hesitationCount: 0, correctionCount: 1, pressureAvailable: false, behaviorQuality: 'ok' },
        n_back: { task: 'n_back', interactionCount: 8, avgInterActionMs: 600, varianceInterActionMs: 3000, hesitationCount: 1, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'ok' },
      };
      const summary = computeBehaviorSummary(taskBehaviors);
      expect(summary.tasksObserved).toBe(4);
      expect(summary.totalInteractions).toBe(27);
      expect(summary.quality).toBe('ok');
      expect(summary.behaviorLikelihood).toBe('high');
    });

    it('computeBehaviorSummary returns failed for no tasks', () => {
      const summary = computeBehaviorSummary({});
      expect(summary.tasksObserved).toBe(0);
      expect(summary.quality).toBe('failed');
      expect(summary.behaviorLikelihood).toBe('low');
    });
  });

  describe('Task-specific variance thresholds (BEHAVIOR-VARIANCE-FIX-01)', () => {
    it('Stroop with normal cognitive pauses (1-2s) is ok, not review', () => {
      const records = [
        { task: 'stroop' as const, timestamp: 0, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'stroop' as const, timestamp: 1500, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'stroop' as const, timestamp: 2800, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'stroop' as const, timestamp: 4200, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'stroop' as const, timestamp: 5800, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'stroop' as const, timestamp: 7200, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
      ];
      const tb = computeTaskBehavior('stroop', records);
      expect(tb.behaviorQuality).toBe('ok');
      expect(tb.varianceInterActionMs).toBeLessThan(2_000_000);
    });

    it('Digit Span with variable recall times is ok', () => {
      const records = [
        { task: 'digit_span' as const, timestamp: 0, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'digit_span' as const, timestamp: 1200, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'digit_span' as const, timestamp: 2500, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'digit_span' as const, timestamp: 4200, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'digit_span' as const, timestamp: 5800, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'digit_span' as const, timestamp: 7000, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
      ];
      const tb = computeTaskBehavior('digit_span', records);
      expect(tb.behaviorQuality).toBe('ok');
      expect(tb.varianceInterActionMs).toBeLessThan(3_000_000);
    });

    it('N-Back with moderate cognitive variance is ok', () => {
      const records = [
        { task: 'n_back' as const, timestamp: 0, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'n_back' as const, timestamp: 800, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'n_back' as const, timestamp: 1800, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'n_back' as const, timestamp: 2600, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'n_back' as const, timestamp: 3700, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'n_back' as const, timestamp: 4800, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
      ];
      const tb = computeTaskBehavior('n_back', records);
      expect(tb.behaviorQuality).toBe('ok');
      expect(tb.varianceInterActionMs).toBeLessThan(1_500_000);
    });

    it('Reflex with abnormal 10s pause is still review (not laxiste)', () => {
      const records = [
        { task: 'reflex' as const, timestamp: 0, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'reflex' as const, timestamp: 300, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'reflex' as const, timestamp: 600, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'reflex' as const, timestamp: 10600, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'reflex' as const, timestamp: 10900, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
      ];
      const tb = computeTaskBehavior('reflex', records);
      expect(tb.behaviorQuality).toBe('review');
      expect(tb.varianceInterActionMs).toBeGreaterThan(100_000);
    });

    it('Reflex with fast uniform taps is ok', () => {
      const records = [
        { task: 'reflex' as const, timestamp: 0, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'reflex' as const, timestamp: 350, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'reflex' as const, timestamp: 680, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'reflex' as const, timestamp: 1020, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'reflex' as const, timestamp: 1380, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
      ];
      const tb = computeTaskBehavior('reflex', records);
      expect(tb.behaviorQuality).toBe('ok');
      expect(tb.varianceInterActionMs).toBeLessThan(100_000);
    });

    it('Full cognitive battery with normal variance produces quality ok', () => {
      const taskBehaviors: Partial<Record<string, TaskTouchBehavior>> = {
        reflex: { task: 'reflex', interactionCount: 5, avgInterActionMs: 350, varianceInterActionMs: 5000, hesitationCount: 0, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'ok' },
        stroop: { task: 'stroop', interactionCount: 6, avgInterActionMs: 1500, varianceInterActionMs: 500_000, hesitationCount: 1, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'ok' },
        digit_span: { task: 'digit_span', interactionCount: 8, avgInterActionMs: 2000, varianceInterActionMs: 1_500_000, hesitationCount: 0, correctionCount: 1, pressureAvailable: false, behaviorQuality: 'ok' },
        n_back: { task: 'n_back', interactionCount: 8, avgInterActionMs: 900, varianceInterActionMs: 800_000, hesitationCount: 1, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'ok' },
        trail_tap: { task: 'trail_tap', interactionCount: 10, avgInterActionMs: 700, varianceInterActionMs: 400_000, hesitationCount: 0, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'ok' },
      };
      const summary = computeBehaviorSummary(taskBehaviors);
      expect(summary.tasksObserved).toBe(5);
      expect(summary.consistencyScore).toBeGreaterThanOrEqual(0.5);
      expect(summary.quality).toBe('ok');
    });

    it('wrongTapCount and hesitationCount thresholds unchanged', () => {
      const records = [
        { task: 'trail_tap' as const, timestamp: 0, pressure: null, isCorrection: false, isWrongTap: true, pathSegmentDistance: 100, optimalSegmentDistance: 80 },
        { task: 'trail_tap' as const, timestamp: 1000, pressure: null, isCorrection: false, isWrongTap: true, pathSegmentDistance: 100, optimalSegmentDistance: 80 },
        { task: 'trail_tap' as const, timestamp: 2000, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: 100, optimalSegmentDistance: 80 },
      ];
      const tb = computeTaskBehavior('trail_tap', records);
      expect(tb.behaviorQuality).toBe('review');
      expect(tb.wrongTapCount).toBe(2);
    });
  });

  describe('Task-specific hesitation thresholds (BEHAVIOR-HESITATION-FIX-01)', () => {
    it('Digit Span with 4 hesitations (normal recall pauses) is ok', () => {
      // 4 gaps > 1500ms during memory recall — normal for digit_span (threshold 4)
      const records = [
        { task: 'digit_span' as const, timestamp: 0, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'digit_span' as const, timestamp: 2000, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },   // hesitation 1 (2000ms gap)
        { task: 'digit_span' as const, timestamp: 3000, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },   // 1000ms gap — no hesitation
        { task: 'digit_span' as const, timestamp: 4700, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },   // hesitation 2 (1700ms gap)
        { task: 'digit_span' as const, timestamp: 6400, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },   // hesitation 3 (1700ms gap)
        { task: 'digit_span' as const, timestamp: 8100, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },   // hesitation 4 (1700ms gap)
      ];
      const tb = computeTaskBehavior('digit_span', records);
      expect(tb.hesitationCount).toBe(4);
      expect(tb.behaviorQuality).toBe('ok');
    });

    it('Digit Span with 5 hesitations is review (above threshold 4)', () => {
      const records = [
        { task: 'digit_span' as const, timestamp: 0, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'digit_span' as const, timestamp: 2000, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },   // hesitation 1
        { task: 'digit_span' as const, timestamp: 3000, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },   // 1000ms — no hesitation
        { task: 'digit_span' as const, timestamp: 4700, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },   // hesitation 2
        { task: 'digit_span' as const, timestamp: 6400, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },   // hesitation 3
        { task: 'digit_span' as const, timestamp: 8100, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },   // hesitation 4
        { task: 'digit_span' as const, timestamp: 9800, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },   // hesitation 5
      ];
      const tb = computeTaskBehavior('digit_span', records);
      expect(tb.hesitationCount).toBe(5);
      expect(tb.behaviorQuality).toBe('review');
    });

    it('Reflex with 2 hesitations is review (above threshold 1)', () => {
      // Reflex is a fast motor task — 2 hesitations is abnormal
      const records = [
        { task: 'reflex' as const, timestamp: 0, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'reflex' as const, timestamp: 2000, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },   // hesitation 1
        { task: 'reflex' as const, timestamp: 2400, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'reflex' as const, timestamp: 4400, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },   // hesitation 2
        { task: 'reflex' as const, timestamp: 4800, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
      ];
      const tb = computeTaskBehavior('reflex', records);
      expect(tb.hesitationCount).toBe(2);
      expect(tb.behaviorQuality).toBe('review');
    });

    it('Reflex with 4+ hesitations is failed (not just review)', () => {
      const records = [
        { task: 'reflex' as const, timestamp: 0, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'reflex' as const, timestamp: 2000, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },   // hesitation 1
        { task: 'reflex' as const, timestamp: 2400, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },   // 400ms — no hesitation
        { task: 'reflex' as const, timestamp: 4400, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },   // hesitation 2
        { task: 'reflex' as const, timestamp: 6600, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },   // hesitation 3
        { task: 'reflex' as const, timestamp: 8800, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },   // hesitation 4
      ];
      const tb = computeTaskBehavior('reflex', records);
      expect(tb.hesitationCount).toBe(4);
      expect(tb.behaviorQuality).toBe('failed');
    });

    it('Full battery with 14 hesitations distributed plausibly → quality ok', () => {
      // Reproduces last real run: 14 hesitations across 5 tasks
      // Distribution: reflex 1 (ok), stroop 2 (ok), digit_span 4 (ok), n_back 4 (review), trail_tap 3 (review)
      // Total: 14. 3 tasks ok, 2 review → okRatio=0.6 → consistencyScore=0.55 >= 0.5 → quality='ok'
      const taskBehaviors: Partial<Record<string, TaskTouchBehavior>> = {
        reflex: { task: 'reflex', interactionCount: 5, avgInterActionMs: 350, varianceInterActionMs: 5000, hesitationCount: 1, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'ok' },
        stroop: { task: 'stroop', interactionCount: 6, avgInterActionMs: 1500, varianceInterActionMs: 500_000, hesitationCount: 2, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'ok' },
        digit_span: { task: 'digit_span', interactionCount: 8, avgInterActionMs: 2000, varianceInterActionMs: 1_500_000, hesitationCount: 4, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'ok' },
        n_back: { task: 'n_back', interactionCount: 8, avgInterActionMs: 1200, varianceInterActionMs: 800_000, hesitationCount: 4, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'review' },
        trail_tap: { task: 'trail_tap', interactionCount: 10, avgInterActionMs: 900, varianceInterActionMs: 400_000, hesitationCount: 3, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'review' },
      };
      const summary = computeBehaviorSummary(taskBehaviors);
      expect(summary.hesitationTotal).toBe(14);
      expect(summary.tasksObserved).toBe(5);
      expect(summary.consistencyScore).toBeGreaterThanOrEqual(0.5);
      expect(summary.quality).toBe('ok');
    });

    it('Full battery with all tasks within hesitation thresholds → quality ok', () => {
      // Best case: each task at or below its threshold
      const taskBehaviors: Partial<Record<string, TaskTouchBehavior>> = {
        reflex: { task: 'reflex', interactionCount: 5, avgInterActionMs: 350, varianceInterActionMs: 5000, hesitationCount: 1, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'ok' },
        stroop: { task: 'stroop', interactionCount: 6, avgInterActionMs: 1500, varianceInterActionMs: 500_000, hesitationCount: 2, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'ok' },
        digit_span: { task: 'digit_span', interactionCount: 8, avgInterActionMs: 2000, varianceInterActionMs: 1_500_000, hesitationCount: 4, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'ok' },
        n_back: { task: 'n_back', interactionCount: 8, avgInterActionMs: 900, varianceInterActionMs: 800_000, hesitationCount: 3, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'ok' },
        trail_tap: { task: 'trail_tap', interactionCount: 10, avgInterActionMs: 700, varianceInterActionMs: 400_000, hesitationCount: 1, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'ok' },
      };
      const summary = computeBehaviorSummary(taskBehaviors);
      expect(summary.hesitationTotal).toBe(11);
      expect(summary.quality).toBe('ok');
    });

    it('Non-regression: wrongTapCount still triggers review independently', () => {
      const records = [
        { task: 'trail_tap' as const, timestamp: 0, pressure: null, isCorrection: false, isWrongTap: true, pathSegmentDistance: 100, optimalSegmentDistance: 80 },
        { task: 'trail_tap' as const, timestamp: 500, pressure: null, isCorrection: false, isWrongTap: true, pathSegmentDistance: 100, optimalSegmentDistance: 80 },
        { task: 'trail_tap' as const, timestamp: 1000, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: 100, optimalSegmentDistance: 80 },
      ];
      const tb = computeTaskBehavior('trail_tap', records);
      expect(tb.hesitationCount).toBe(0);
      expect(tb.wrongTapCount).toBe(2);
      expect(tb.behaviorQuality).toBe('review');
    });

    it('14 hesitations scenario B (2 ok / 3 review) → consistencyScore >= 0.5 (BEHAVIOR-QUALITY-FIX-01)', () => {
      // Real-world plausible distribution: hesitations concentrated on reflex/trail_tap (strict thresholds)
      // reflex 2 (review, threshold 1), stroop 2 (ok, threshold 2), digit_span 4 (ok, threshold 4),
      // n_back 4 (review, threshold 3), trail_tap 2 (review, threshold 1)
      // Total: 14. okRatio = 2/5 = 0.4
      // Old global penalty: min(1, 14/10) = 1.0 → consistencyScore = 0.4*0.5 + 0.25 + 0 = 0.45 < 0.5 → review
      // New per-task penalty: avg(1.0, 0.5, 0.5, 0.67, 1.0) / 5 = 0.734 → consistencyScore = 0.4*0.5 + 0.25 + (1-0.734)*0.25 = 0.52 >= 0.5 → ok
      const taskBehaviors: Partial<Record<string, TaskTouchBehavior>> = {
        reflex: { task: 'reflex', interactionCount: 5, avgInterActionMs: 600, varianceInterActionMs: 5000, hesitationCount: 2, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'review' },
        stroop: { task: 'stroop', interactionCount: 6, avgInterActionMs: 1500, varianceInterActionMs: 500_000, hesitationCount: 2, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'ok' },
        digit_span: { task: 'digit_span', interactionCount: 8, avgInterActionMs: 2000, varianceInterActionMs: 1_500_000, hesitationCount: 4, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'ok' },
        n_back: { task: 'n_back', interactionCount: 8, avgInterActionMs: 1200, varianceInterActionMs: 800_000, hesitationCount: 4, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'review' },
        trail_tap: { task: 'trail_tap', interactionCount: 10, avgInterActionMs: 900, varianceInterActionMs: 400_000, hesitationCount: 2, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'review' },
      };
      const summary = computeBehaviorSummary(taskBehaviors);
      expect(summary.hesitationTotal).toBe(14);
      expect(summary.tasksObserved).toBe(5);
      expect(summary.consistencyScore).toBeGreaterThanOrEqual(0.5);
      expect(summary.quality).toBe('ok');
    });

    it('14 hesitations scenario C (2 ok / 3 review, different distribution) → consistencyScore >= 0.5', () => {
      // Another plausible distribution: reflex 2, stroop 3, digit_span 4, n_back 3, trail_tap 2
      // reflex 2 (review), stroop 3 (review), digit_span 4 (ok), n_back 3 (ok), trail_tap 2 (review)
      const taskBehaviors: Partial<Record<string, TaskTouchBehavior>> = {
        reflex: { task: 'reflex', interactionCount: 5, avgInterActionMs: 600, varianceInterActionMs: 5000, hesitationCount: 2, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'review' },
        stroop: { task: 'stroop', interactionCount: 6, avgInterActionMs: 1500, varianceInterActionMs: 500_000, hesitationCount: 3, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'review' },
        digit_span: { task: 'digit_span', interactionCount: 8, avgInterActionMs: 2000, varianceInterActionMs: 1_500_000, hesitationCount: 4, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'ok' },
        n_back: { task: 'n_back', interactionCount: 8, avgInterActionMs: 900, varianceInterActionMs: 800_000, hesitationCount: 3, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'ok' },
        trail_tap: { task: 'trail_tap', interactionCount: 10, avgInterActionMs: 800, varianceInterActionMs: 400_000, hesitationCount: 2, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'review' },
      };
      const summary = computeBehaviorSummary(taskBehaviors);
      expect(summary.hesitationTotal).toBe(14);
      expect(summary.consistencyScore).toBeGreaterThanOrEqual(0.5);
      expect(summary.quality).toBe('ok');
    });

    it('High hesitationTotal but most tasks within thresholds → per-task penalty is lenient', () => {
      // 11 hesitations but all within thresholds (reflex 1, stroop 2, digit_span 4, n_back 3, trail_tap 1)
      // Old global: min(1, 11/10) = 1.0 → penalty maxed
      // New per-task: avg(0.5, 0.5, 0.5, 0.5, 0.5) = 0.5 → penalty moderate
      const taskBehaviors: Partial<Record<string, TaskTouchBehavior>> = {
        reflex: { task: 'reflex', interactionCount: 5, avgInterActionMs: 350, varianceInterActionMs: 5000, hesitationCount: 1, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'ok' },
        stroop: { task: 'stroop', interactionCount: 6, avgInterActionMs: 1500, varianceInterActionMs: 500_000, hesitationCount: 2, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'ok' },
        digit_span: { task: 'digit_span', interactionCount: 8, avgInterActionMs: 2000, varianceInterActionMs: 1_500_000, hesitationCount: 4, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'ok' },
        n_back: { task: 'n_back', interactionCount: 8, avgInterActionMs: 900, varianceInterActionMs: 800_000, hesitationCount: 3, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'ok' },
        trail_tap: { task: 'trail_tap', interactionCount: 10, avgInterActionMs: 700, varianceInterActionMs: 400_000, hesitationCount: 1, correctionCount: 0, pressureAvailable: false, behaviorQuality: 'ok' },
      };
      const summary = computeBehaviorSummary(taskBehaviors);
      expect(summary.hesitationTotal).toBe(11);
      // All tasks ok → okRatio = 1.0, per-task penalty = 0.5 (each at threshold/2x)
      // consistencyScore = 1.0*0.5 + 0.25 + 0.5*0.25 = 0.875
      expect(summary.consistencyScore).toBeGreaterThanOrEqual(0.8);
      expect(summary.quality).toBe('ok');
    });

    it('Non-regression: variance still triggers review independently', () => {
      // Reflex with high variance but 0 hesitations
      const records = [
        { task: 'reflex' as const, timestamp: 0, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'reflex' as const, timestamp: 300, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'reflex' as const, timestamp: 600, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'reflex' as const, timestamp: 10600, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
        { task: 'reflex' as const, timestamp: 10900, pressure: null, isCorrection: false, isWrongTap: false, pathSegmentDistance: null, optimalSegmentDistance: null },
      ];
      const tb = computeTaskBehavior('reflex', records);
      expect(tb.hesitationCount).toBe(1); // 10000ms gap > 1500ms
      expect(tb.behaviorQuality).toBe('review'); // triggered by variance > 100k
    });
  });
});
